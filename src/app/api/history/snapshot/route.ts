import type { NextRequest } from "next/server";
import { z } from "zod";
import { toDateKey, valueAtDate } from "@/lib/history";
import { getMetricDef, getProvider } from "@/lib/metrics/catalog";
import { demoMetric } from "@/lib/metrics/demo";
import { addDays, fromKey } from "@/lib/metrics/series";
import { fetchMetric } from "@/lib/metrics/service";
import type { MetricFormat, MetricResult } from "@/lib/metrics/types";
import { listCards, listConnections } from "@/lib/queries";
import { requireUser, UnauthorizedError } from "@/lib/session";

// Snapshot fan-out can hit several providers; give it room.
export const maxDuration = 60;

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

export type HeroKey = "mau" | "mrr" | "arr" | "users" | "stars" | "churn";

export interface SnapshotHero {
  key: HeroKey;
  label: string;
  shortLabel: string;
  emoji: string;
  format: MetricFormat;
  currency?: string;
  /** Value at (or just before) the requested date; null when unknown. */
  value: number | null;
  /** Value 30 days before the requested date; null when unknown. */
  previous: number | null;
  /** Percent change vs `previous`; null when not computable. */
  changePct: number | null;
  direction: "up" | "down" | "flat";
  /** The series day the value came from. */
  atKey: string | null;
  /** True when the date falls inside the fetched series window. */
  inWindow: boolean;
  /** Where the number came from, e.g. "Stripe (Acme)". */
  source: string;
  /** Churn reads inverted: down is good, up is bad. */
  goodWhenDown?: boolean;
}

interface Candidate {
  connectionId: string;
  provider: string;
  metric: string;
  params: Record<string, string>;
  label: string;
}

const HERO_ORDER: HeroKey[] = ["mau", "mrr", "arr", "users", "stars", "churn"];

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: "Bad date. Use YYYY-MM-DD." }, { status: 400 });

    const todayKey = toDateKey(new Date());
    const dateKey = parsed.data.date && parsed.data.date <= todayKey ? parsed.data.date : todayKey;
    const prevKey = toDateKey(addDays(fromKey(dateKey), -30));

    const [connections, cards] = await Promise.all([listConnections(user.id), listCards(user.id)]);
    const byId = new Map(connections.map((c) => [c.id, c]));
    const ofProvider = (p: string) => connections.filter((c) => c.provider === p);

    // GitHub stars need a repo — reuse whichever repos the user's cards point at.
    const starRefs: Candidate[] = [];
    for (const c of cards) {
      for (const m of c.config.metrics ?? []) {
        const conn = byId.get(m.connectionId);
        if (conn?.provider === "github" && m.metric === "stars" && m.params?.repo) {
          starRefs.push({ connectionId: conn.id, provider: "github", metric: "stars", params: m.params, label: m.params.repo });
        }
      }
      if (starRefs.length >= 3) break;
    }

    const first = (p: string, metric: string): Candidate | null => {
      const conn = ofProvider(p)[0];
      return conn ? { connectionId: conn.id, provider: p, metric, params: {}, label: conn.label } : null;
    };

    const plan: Record<Exclude<HeroKey, "arr">, Candidate[]> = {
      mau: [...(first("posthog", "mau") ? [first("posthog", "mau")!] : []), { connectionId: "demo", provider: "demo", metric: "active_users", params: {}, label: "Sample data" }],
      mrr: [
        ...(first("stripe", "mrr") ? [first("stripe", "mrr")!] : []),
        ...(first("lemonsqueezy", "mrr") ? [first("lemonsqueezy", "mrr")!] : []),
        { connectionId: "demo", provider: "demo", metric: "mrr", params: {}, label: "Sample data" },
      ],
      users: [
        ...(first("posthog", "users") ? [first("posthog", "users")!] : []),
        ...(first("stripe", "customers") ? [first("stripe", "customers")!] : []),
        { connectionId: "demo", provider: "demo", metric: "customers", params: {}, label: "Sample data" },
      ],
      stars: [...starRefs, { connectionId: "demo", provider: "demo", metric: "stars", params: {}, label: "Sample data" }],
      churn: [
        ...(first("stripe", "churn") ? [first("stripe", "churn")!] : []),
        ...(first("lemonsqueezy", "churn") ? [first("lemonsqueezy", "churn")!] : []),
        { connectionId: "demo", provider: "demo", metric: "churn", params: {}, label: "Sample data" },
      ],
    };

    const META: Record<HeroKey, { label: string; shortLabel: string; emoji: string; format: MetricFormat; goodWhenDown?: boolean }> = {
      mau: { label: "Monthly active users", shortLabel: "MAU", emoji: "🔥", format: "number" },
      mrr: { label: "Monthly recurring revenue", shortLabel: "MRR", emoji: "💸", format: "currency" },
      arr: { label: "Annual run rate", shortLabel: "ARR", emoji: "📊", format: "currency" },
      users: { label: "Total users", shortLabel: "Users", emoji: "🧑‍🚀", format: "number" },
      stars: { label: "GitHub stars", shortLabel: "Stars", emoji: "⭐", format: "number" },
      churn: { label: "Subscription churn rate", shortLabel: "Churn", emoji: "📉", format: "percent", goodWhenDown: true },
    };

    async function resolve(candidates: Candidate[], heroKey: Exclude<HeroKey, "arr">): Promise<SnapshotHero | null> {
      for (const c of candidates) {
        try {
          let res: MetricResult;
          let currency: string | undefined;
          let source = c.label;
          if (c.connectionId === "demo") {
            res = demoMetric(c.metric, "12m");
            currency = res.currency;
          } else {
            const conn = byId.get(c.connectionId);
            if (!conn) continue;
            const def = getMetricDef(conn.provider, c.metric);
            if (!def) continue;
            res = await fetchMetric({ userId: user.id, connectionId: c.connectionId, metric: c.metric, params: c.params, period: "12m" });
            currency = res.currency;
            const provider = getProvider(conn.provider);
            source = `${provider?.emoji ?? "🔌"} ${conn.label}`;
            if (c.params.repo) source += ` · ${c.params.repo}`;
          }
          const meta = META[heroKey];
          const at = valueAtDate(res.series, dateKey);
          const before = valueAtDate(res.series, prevKey);
          // Series-less results (e.g. followers-style): fall back to the live value.
          const value = res.series.length === 0 ? res.value : at.value;
          const previous = res.series.length === 0 ? null : before.value;
          const delta = value !== null && previous !== null ? value - previous : null;
          const changePct = delta !== null && previous !== 0 ? (delta / previous!) * 100 : null;
          return {
            key: heroKey,
            label: meta.label,
            shortLabel: meta.shortLabel,
            emoji: meta.emoji,
            format: meta.format,
            currency,
            value,
            previous,
            changePct: changePct === null ? null : Math.round(changePct * 10) / 10,
            direction: delta === null || delta === 0 ? "flat" : delta > 0 ? "up" : "down",
            atKey: at.atKey,
            inWindow: res.series.length === 0 ? false : at.inWindow,
            source,
            goodWhenDown: meta.goodWhenDown,
          };
        } catch {
          continue;
        }
      }
      return null;
    }

    const [mau, mrr, users, stars, churn] = await Promise.all([
      resolve(plan.mau, "mau"),
      resolve(plan.mrr, "mrr"),
      resolve(plan.users, "users"),
      resolve(plan.stars, "stars"),
      resolve(plan.churn, "churn"),
    ]);

    const heroes: SnapshotHero[] = [];
    if (mau) heroes.push(mau);
    if (mrr) {
      heroes.push(mrr);
      if (mrr.value !== null) {
        const prev = mrr.previous !== null ? Math.round(mrr.previous * 12 * 100) / 100 : null;
        const value = Math.round(mrr.value * 12 * 100) / 100;
        const delta = prev !== null ? value - prev : null;
        const changePct = delta !== null && prev !== 0 ? Math.round((delta / prev!) * 1000) / 10 : null;
        heroes.push({
          key: "arr",
          label: META.arr.label,
          shortLabel: META.arr.shortLabel,
          emoji: META.arr.emoji,
          format: META.arr.format,
          currency: mrr.currency,
          value,
          previous: prev,
          changePct,
          direction: delta === null || delta === 0 ? "flat" : delta > 0 ? "up" : "down",
          atKey: mrr.atKey,
          inWindow: mrr.inWindow,
          source: `${mrr.source} × 12`,
        });
      }
    }
    if (users) heroes.push(users);
    if (stars) heroes.push(stars);
    if (churn) heroes.push(churn);

    heroes.sort((a, b) => HERO_ORDER.indexOf(a.key) - HERO_ORDER.indexOf(b.key));

    return Response.json({ date: dateKey, compareTo: prevKey, items: heroes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: "Not signed in" }, { status: 401 });
    console.error("[api/history/snapshot]", err);
    return Response.json({ error: "Couldn't load that day's numbers." }, { status: 500 });
  }
}
