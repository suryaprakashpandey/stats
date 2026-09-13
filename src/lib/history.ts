import type { MetricResult, SeriesPoint } from "./metrics/types";

/**
 * Point-in-time helpers for the History timeline.
 *
 * Every provider already returns a chronological `series` (level metrics are
 * sampled at each instant, flow metrics are bucketed sums), so "what was MRR
 * on Aug 1st?" is just "the last series point at or before Aug 1st".
 */

export function toDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  return date.toISOString().slice(0, 10);
}

export interface PointValue {
  /** Value at (or just before) the requested date, null when predating history. */
  value: number | null;
  /** The series key the value came from (null when unknown). */
  atKey: string | null;
  /** True when the date is covered by the series window. */
  inWindow: boolean;
}

/** Last series point with `t <= dateKey` (series are chronological). */
export function valueAtDate(series: SeriesPoint[], dateKey: string): PointValue {
  let hit: SeriesPoint | null = null;
  for (const p of series) {
    if (p.t <= dateKey) hit = p;
    else break;
  }
  if (hit) return { value: hit.v, atKey: hit.t, inWindow: true };
  return { value: null, atKey: null, inWindow: series.length > 0 && dateKey >= series[0].t };
}

/** Convenience wrapper over a full MetricResult. */
export function resultAtDate(result: MetricResult, dateKey: string): PointValue & { current: number } {
  const hit = valueAtDate(result.series, dateKey);
  // No series (e.g. GitHub forks): fall back to the live value but flag it.
  if (result.series.length === 0) return { value: result.value, atKey: null, inWindow: false, current: result.value };
  return { ...hit, current: result.value };
}
