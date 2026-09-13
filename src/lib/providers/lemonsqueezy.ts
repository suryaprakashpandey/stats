import "server-only";
import { bucketFlow, cumulativeLevel, levelInstants, levelWindow, periodWindow, previousWindow, sumInWindow, type DatedValue, type Window } from "../metrics/series";
import type { MetricResult, SeriesPoint } from "../metrics/types";
import { baseResult, monthlyFactor, ProviderError, requestJson, requireSecret, type ConnectionContext, type ServerProvider } from "./base";

const API = "https://api.lemonsqueezy.com/v1";
const MAX_PAGES = 30;

interface Resource<A> {
  id: string;
  attributes: A;
}
interface ListResponse<A> {
  data: Resource<A>[];
  meta?: { page?: { currentPage: number; lastPage: number; total: number } };
}

function headers(ctx: ConnectionContext): HeadersInit {
  const key = requireSecret(ctx.secrets, "apiKey", "API key");
  return { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" };
}

async function list<A>(ctx: ConnectionContext, path: string, params: Record<string, string> = {}): Promise<{ items: Resource<A>[]; total: number }> {
  const items: Resource<A>[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const qs = new URLSearchParams({ ...params, "page[size]": "100", "page[number]": String(page) });
    const data = await requestJson<ListResponse<A>>(`${API}${path}?${qs}`, { headers: headers(ctx) });
    items.push(...data.data);
    total = data.meta?.page?.total ?? items.length;
    if (!data.meta?.page || page >= data.meta.page.lastPage) break;
  }
  return { items, total };
}

interface SubAttrs {
  status: string;
  created_at: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  variant_id: number;
  first_subscription_item?: { price_id: number; quantity: number } | null;
}
interface PriceAttrs {
  unit_price: number;
  renewal_interval_unit: string | null;
  renewal_interval_quantity: number | null;
}
interface VariantAttrs {
  price: number;
  interval: string | null;
  interval_count: number | null;
}
interface OrderAttrs {
  status: string;
  total_usd: number;
  created_at: string;
}
interface CustomerAttrs {
  created_at: string;
}

interface SubInfo {
  monthly: number;
  start: Date;
  end: Date | null;
  active: boolean;
}

async function loadSubscriptions(ctx: ConnectionContext): Promise<SubInfo[]> {
  const { items } = await list<SubAttrs>(ctx, "/subscriptions");
  const priceCache = new Map<string, { unit: number; interval: string; count: number }>();

  async function monthlyFor(sub: SubAttrs): Promise<number> {
    const item = sub.first_subscription_item;
    const key = item?.price_id ? `price:${item.price_id}` : `variant:${sub.variant_id}`;
    if (!priceCache.has(key)) {
      if (item?.price_id) {
        const p = await requestJson<{ data: Resource<PriceAttrs> }>(`${API}/prices/${item.price_id}`, { headers: headers(ctx) }).catch(() => null);
        if (p) priceCache.set(key, { unit: p.data.attributes.unit_price, interval: p.data.attributes.renewal_interval_unit ?? "month", count: p.data.attributes.renewal_interval_quantity ?? 1 });
      }
      if (!priceCache.has(key)) {
        const v = await requestJson<{ data: Resource<VariantAttrs> }>(`${API}/variants/${sub.variant_id}`, { headers: headers(ctx) });
        priceCache.set(key, { unit: v.data.attributes.price, interval: v.data.attributes.interval ?? "month", count: v.data.attributes.interval_count ?? 1 });
      }
    }
    const p = priceCache.get(key)!;
    return (p.unit / 100) * (item?.quantity ?? 1) * monthlyFactor(p.interval, p.count);
  }

  const out: SubInfo[] = [];
  for (const s of items) {
    const a = s.attributes;
    const active = a.status === "active" || a.status === "past_due";
    const ended = ["cancelled", "expired", "unpaid"].includes(a.status) || (a.status === "cancelled" && a.ends_at);
    out.push({
      monthly: await monthlyFor(a),
      start: new Date(a.trial_ends_at && new Date(a.trial_ends_at) > new Date(a.created_at) ? a.trial_ends_at : a.created_at),
      end: ended && a.ends_at ? new Date(a.ends_at) : ended ? new Date(a.created_at) : null,
      active,
    });
  }
  return out;
}

function levelSeries(subs: SubInfo[], w: Window, pick: (s: SubInfo) => number): { series: SeriesPoint[]; previous: number } {
  const at = (t: Date) => Math.round(subs.filter((s) => s.start <= t && (s.end === null || s.end > t)).reduce((a, s) => a + pick(s), 0) * 100) / 100;
  const series = levelInstants(w).map(({ t, at: when }) => ({ t, v: at(when) }));
  return { series, previous: series[0]?.v ?? at(w.from) };
}

/** Trailing-30-day logo churn sampled at each instant: cancelled in the 30d ending at `t` ÷ active at the start of that window. */
function churnSeries(subs: SubInfo[], w: Window): { series: SeriesPoint[]; previous: number } {
  const DAY_MS = 86_400_000;
  const rateAt = (t: Date) => {
    const start = new Date(t.getTime() - 30 * DAY_MS);
    const base = subs.filter((s) => s.start <= start && (s.end === null || s.end > start)).length;
    if (base === 0) return 0;
    const churned = subs.filter((s) => s.end !== null && s.end > start && s.end <= t).length;
    return Math.round((churned / base) * 1000) / 10;
  };
  const series = levelInstants(w).map(({ t, at: when }) => ({ t, v: rateAt(when) }));
  return { series, previous: series[0]?.v ?? 0 };
}

export const lemonsqueezy: ServerProvider = {
  id: "lemonsqueezy",
  async verify(ctx) {
    const me = await requestJson<{ data: Resource<{ name?: string }> }>(`${API}/users/me`, { headers: headers(ctx) });
    return { label: me.data.attributes.name ? `Lemon Squeezy (${me.data.attributes.name})` : "Lemon Squeezy" };
  },

  async fetch(ctx, req): Promise<MetricResult> {
    const w = periodWindow(req.period);
    const prev = previousWindow(w);

    if (req.metric === "revenue") {
      const { items } = await list<OrderAttrs>(ctx, "/orders");
      const paid: DatedValue[] = items
        .filter((o) => o.attributes.status === "paid")
        .map((o) => ({ date: new Date(o.attributes.created_at), value: (o.attributes.total_usd ?? 0) / 100 }));
      return baseResult(w, {
        value: sumInWindow(paid, w),
        previous: sumInWindow(paid, prev),
        series: bucketFlow(paid, w),
        currency: "USD",
      });
    }

    if (req.metric === "mrr" || req.metric === "subscriptions" || req.metric === "churn") {
      const lw = levelWindow(w);
      const subs = await loadSubscriptions(ctx);
      if (req.metric === "churn") {
        const { series, previous } = churnSeries(subs, lw);
        return baseResult(lw, {
          value: series.at(-1)?.v ?? 0,
          previous,
          series,
          note: "Trailing 30-day churn, reconstructed from subscription start and end dates.",
        });
      }
      if (req.metric === "mrr") {
        const current = Math.round(subs.filter((s) => s.active).reduce((a, s) => a + s.monthly, 0) * 100) / 100;
        const { series, previous } = levelSeries(subs, lw, (s) => s.monthly);
        return baseResult(lw, {
          value: current,
          previous,
          series: series.map((p, i, arr) => (i === arr.length - 1 ? { ...p, v: current } : p)),
          currency: "USD",
          note: "History is reconstructed from subscription start and end dates.",
        });
      }
      const { series, previous } = levelSeries(subs, lw, () => 1);
      return baseResult(lw, { value: subs.filter((s) => s.active).length, previous, series });
    }

    if (req.metric === "customers") {
      const lw = levelWindow(w);
      const { items, total } = await list<CustomerAttrs>(ctx, "/customers");
      const dates = items.map((c) => new Date(c.attributes.created_at));
      const series = cumulativeLevel(dates, total, lw);
      return baseResult(lw, { value: total, previous: series[0]?.v ?? null, series });
    }

    throw new ProviderError(`Unknown Lemon Squeezy metric "${req.metric}".`);
  },
};
