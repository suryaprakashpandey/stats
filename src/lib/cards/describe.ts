import type { CardConfig, CardSlot } from "./types";
import { stackLayout } from "./layout";
import { resolveIdentity } from "./resolve";
import { describeChange, formatValue, niceMilestone, periodLabel } from "../metrics/format";

function sentence(text: string): string {
  const trimmed = text.trim();
  return trimmed ? `${trimmed}${/[.!?]$/.test(trimmed) ? "" : "."}` : "";
}

/** Describe visible card content without exposing provider error messages. */
export function describeCard(config: CardConfig, slots: CardSlot[]): string {
  const identity = resolveIdentity(config, slots);
  const stack = config.template === "stack";
  const visible = stack ? slots : [slots[0]];
  const chartsVisible = stack ? stackLayout(config, slots.length, identity).showSpark : config.showChart;
  const parts = visible.map((slot: CardSlot | undefined) => {
    const label = stack
      ? slot?.ref.label || slot?.def.shortLabel || "Metric"
      : config.headline || slot?.label || "Metric";
    const result = slot?.result;
    if (slot?.loading && !result) return sentence(`${label} is loading`);
    if (slot?.error) return sentence(`${label} is unavailable`);
    if (config.template === "milestone") {
      const value = config.milestone?.value ?? (result ? niceMilestone(result.value) : undefined);
      if (value === undefined || !slot) return sentence(`${label} is unavailable`);
      const who = identity.name || "We";
      return sentence(`${who} just hit ${formatValue(value, slot.def.format, result?.currency)} ${label}`);
    }
    if (!result || !slot) return sentence(`${label} is unavailable`);
    const value = formatValue(result.value, slot.def.format, result.currency,
      stack ? { compact: Math.abs(result.value) >= 10_000 } : {});
    const change = config.showChange ? describeChange(result, slot.def.kind, slot.def.format, config.period) : null;
    const changeText = change
      ? `, ${change.direction === "flat" ? "unchanged" : `${change.direction} ${change.text.replace(/^[+−]/, "")}`} ${change.context}`
      : "";
    const text = sentence(`${label} is ${value}${changeText}`);
    const chart = chartsVisible && result.series.length > 1
      ? `${config.chartStyle === "bars" ? "Bar" : config.chartStyle === "line" ? "Line" : "Area"} chart of the ${periodLabel(config.period).toLowerCase()}.`
      : "";
    return [text, chart].filter(Boolean).join(" ");
  });
  if (!visible.length) parts.push("No metrics selected.");
  if (config.template === "milestone") {
    parts.push(sentence(config.milestone?.message || config.caption || "Thank you for the support 💛"));
    if (config.milestone?.message && config.caption) parts.push(sentence(config.caption));
  } else if (config.caption) {
    parts.push(sentence(config.caption));
  }
  const prefix = identity.name && config.template !== "milestone" ? `${identity.name}: ` : "";
  return prefix + parts.filter(Boolean).join(" ");
}
