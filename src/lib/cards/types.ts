import { z } from "zod";
import type { MetricDef, MetricRef, MetricResult } from "../metrics/types";

export const SIZES = {
  square: { w: 540, h: 540, label: "Square", hint: "1080 × 1080 · Instagram, LinkedIn" },
  wide: { w: 640, h: 360, label: "Wide", hint: "1280 × 720 · X, Bluesky, Threads" },
  tall: { w: 540, h: 675, label: "Portrait", hint: "1080 × 1350 · Instagram, Stories" },
} as const;

export type CardSize = keyof typeof SIZES;

export const metricRefSchema = z.object({
  connectionId: z.string().min(1),
  metric: z.string().min(1),
  params: z.record(z.string(), z.string()).optional(),
  /** Optional label override for this metric on the card. */
  label: z.string().max(60).optional(),
});

export const cardConfigSchema = z.object({
  template: z.enum(["single", "stack", "milestone"]).default("single"),
  size: z.enum(["square", "wide", "tall"]).default("square"),
  theme: z.string().default("peach"),
  period: z.enum(["7d", "30d", "90d", "12m"]).default("30d"),
  metrics: z.array(metricRefSchema).min(1).max(4),
  /** Overrides the name from the data (e.g. the repo name). */
  appName: z.string().max(40).default(""),
  /** The big emoji on milestone cards. */
  emoji: z.string().max(8).default(""),
  /** Header logo: an image URL or an uploaded data URL. Empty = the logo from the data (e.g. the repo's GitHub avatar). */
  logoUrl: z
    .string()
    .max(400_000)
    .refine(
      (s) => s === "" || /^https?:\/\//i.test(s) || /^data:image\//i.test(s) || /^\/[^/]/i.test(s),
      "The logo must be an image URL.",
    )
    .default(""),
  showLogo: z.boolean().default(true),
  headline: z.string().max(60).default(""),
  caption: z.string().max(140).default(""),
  showChart: z.boolean().default(true),
  chartStyle: z.enum(["area", "line", "bars"]).default("area"),
  showChange: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showWatermark: z.boolean().default(true),
  milestone: z
    .object({
      value: z.number().optional(),
      message: z.string().max(100).optional(),
    })
    .optional(),
});

export type CardConfig = z.infer<typeof cardConfigSchema>;
export type CardTemplate = CardConfig["template"];
export type ChartStyle = CardConfig["chartStyle"];

export function defaultCardConfig(metrics: MetricRef[] = []): CardConfig {
  return cardConfigSchema.parse({ metrics: metrics.length ? metrics : [{ connectionId: "demo", metric: "mrr" }] });
}

/** Everything the card renderer needs for one metric. */
export interface CardSlot {
  ref: MetricRef & { label?: string };
  def: MetricDef;
  /** Display label (override → def.label). */
  label: string;
  result?: MetricResult;
  loading?: boolean;
  error?: string;
}
