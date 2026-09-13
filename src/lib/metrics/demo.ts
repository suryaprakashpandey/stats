import { buckets, levelInstants, levelWindow, periodWindow, toKey } from "./series";
import type { ClientConnection, MetricDef, MetricResult, Period, ProviderMeta } from "./types";

/**
 * Sample data for the playground and landing page. Deterministic so the
 * preview looks the same on every load.
 */

export const DEMO_PROVIDER: ProviderMeta = {
  id: "demo",
  name: "Sample data",
  emoji: "🧪",
  tagline: "Made-up numbers to play with",
  color: "#EFE9FF",
  instant: true,
  fields: [],
  metrics: [
    { key: "mrr", label: "Monthly recurring revenue", shortLabel: "MRR", emoji: "💸", format: "currency", kind: "level" },
    { key: "revenue", label: "Revenue", shortLabel: "Revenue", emoji: "💰", format: "currency", kind: "flow", defaultChart: "bars" },
    { key: "active_users", label: "Active users", shortLabel: "Active users", emoji: "🔥", format: "number", kind: "level" },
    { key: "signups", label: "Sign-ups", shortLabel: "Sign-ups", emoji: "✨", format: "number", kind: "flow", defaultChart: "bars" },
    { key: "stars", label: "GitHub stars", shortLabel: "Stars", emoji: "⭐", format: "number", kind: "level" },
    { key: "downloads", label: "Downloads", shortLabel: "Downloads", emoji: "📦", format: "number", kind: "flow", defaultChart: "bars" },
    { key: "customers", label: "Customers", shortLabel: "Customers", emoji: "🧑‍🤝‍🧑", format: "number", kind: "level" },
    { key: "churn", label: "Subscription churn rate", shortLabel: "Churn", emoji: "📉", format: "percent", kind: "level" },
  ],
};

export const DEMO_CONNECTION: ClientConnection = {
  id: "demo",
  provider: "demo",
  label: "Sample data",
  config: {},
  status: "ok",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoShape {
  /** current headline value */
  value: number;
  /** growth over the window as a fraction of the end value (level metrics) */
  growth: number;
  /** noise amplitude (fraction) */
  noise: number;
  currency?: string;
  seed: number;
  /** Decimals kept on level values (default 0). */
  precision?: number;
}

const SHAPES: Record<string, DemoShape> = {
  mrr: { value: 4210, growth: 0.32, noise: 0.03, currency: "USD", seed: 11 },
  revenue: { value: 6120, growth: 0.25, noise: 0.45, currency: "USD", seed: 12 },
  active_users: { value: 1874, growth: 0.28, noise: 0.12, seed: 13 },
  signups: { value: 512, growth: 0.3, noise: 0.5, seed: 14 },
  stars: { value: 2431, growth: 0.41, noise: 0.05, seed: 15 },
  downloads: { value: 38_920, growth: 0.22, noise: 0.35, seed: 16 },
  customers: { value: 318, growth: 0.24, noise: 0.04, seed: 17 },
  churn: { value: 3.8, growth: -0.25, noise: 0.12, seed: 18, precision: 1 },
};

export function demoMetric(metric: string, period: Period, now = new Date()): MetricResult {
  const def = DEMO_PROVIDER.metrics.find((m) => m.key === metric) as MetricDef;
  const shape = SHAPES[metric] ?? SHAPES.active_users;
  const w = periodWindow(period, now);

  if (def.kind === "level") {
    // smooth ease-in growth curve from start -> value with gentle noise
    const lw = levelWindow(w);
    const instants = levelInstants(lw);
    const n = instants.length;
    const rand = mulberry32(shape.seed * 1000 + n);
    const startValue = shape.value * (1 - shape.growth);
    const precision = shape.precision ?? 0;
    const m = Math.pow(10, precision);
    const roundV = (x: number) => Math.round(x * m) / m;
    const series = instants.map(({ t }, i) => {
      const f = n === 1 ? 1 : i / (n - 1);
      const eased = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const wobble = (rand() - 0.5) * shape.noise * shape.value * (1 - f);
      const v = startValue + (shape.value - startValue) * eased + wobble;
      return { t, v: roundV(i === n - 1 ? shape.value : Math.max(0, v)) };
    });
    return {
      value: shape.value,
      previous: series[0]?.v ?? null,
      series,
      currency: shape.currency,
      period: { from: toKey(w.from), to: toKey(w.to), days: w.days },
      granularity: lw.granularity,
      fetchedAt: now.toISOString(),
    };
  }

  // flow: bucket values that trend upward with weekly rhythm and noise
  const starts = buckets(w);
  const n = starts.length;
  const rand = mulberry32(shape.seed * 1000 + n);
  const perBucket = shape.value / n;
  const series = starts.map((d, i) => {
    const f = n === 1 ? 1 : i / (n - 1);
    const trend = 1 - shape.growth + shape.growth * 2 * f;
    const weekly = w.granularity === "day" ? (d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 0.75 : 1.05) : 1;
    const noise = 1 + (rand() - 0.5) * shape.noise;
    return { t: toKey(d), v: Math.round(perBucket * trend * weekly * noise) };
  });
  const total = series.reduce((a, b) => a + b.v, 0);
  const previous = Math.round(total / (1 + shape.growth));
  return {
    value: total,
    previous,
    series,
    currency: shape.currency,
    period: { from: toKey(w.from), to: toKey(w.to), days: w.days },
    granularity: w.granularity,
    fetchedAt: now.toISOString(),
  };
}
