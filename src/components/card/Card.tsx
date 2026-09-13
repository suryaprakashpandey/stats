"use client";
import { forwardRef, useState, type CSSProperties } from "react";
import { resolveIdentity, type CardIdentity } from "@/lib/cards/resolve";
import { getTheme, type Theme } from "@/lib/cards/themes";
import { SIZES, type CardConfig, type CardSlot } from "@/lib/cards/types";
import { describeChange, formatDate, formatValue, niceMilestone, type ChangeInfo } from "@/lib/metrics/format";
import { Chart } from "./Chart";

export interface CardProps {
  config: CardConfig;
  slots: CardSlot[];
  /** Pass a stable id when several cards render on one page (SVG gradient ids). */
  id?: string;
  className?: string;
}

/**
 * The share card. Pure and self-contained: only inline styles + a few utility
 * classes, so html-to-image renders exactly what you see.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ config, slots, id = "card", className }, ref) {
  const theme = getTheme(config.theme);
  const size = SIZES[config.size];
  const identity = resolveIdentity(config, slots);
  const vars = {
    "--c-fg": theme.fg,
    "--c-muted": theme.muted,
    "--c-accent": theme.accent,
    "--c-surface": theme.surface,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      className={className}
      data-card
      style={{
        ...vars,
        width: size.w,
        height: size.h,
        background: theme.bg,
        color: theme.fg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-card), ui-rounded, system-ui, sans-serif",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        borderRadius: 0,
        boxShadow: theme.dark ? "inset 0 0 0 1px rgba(255,255,255,0.12)" : "inset 0 0 0 1px rgba(28,25,23,0.08)",
      }}
    >
      {theme.blobs && <Blobs theme={theme} size={config.size} />}
      {config.template === "milestone" ? (
        <Milestone config={config} slot={slots[0]} theme={theme} identity={identity} id={id} />
      ) : config.template === "stack" ? (
        <Stack config={config} slots={slots} theme={theme} identity={identity} id={id} />
      ) : (
        <Single config={config} slot={slots[0]} theme={theme} identity={identity} id={id} />
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function Blobs({ theme, size }: { theme: Theme; size: CardConfig["size"] }) {
  const [a, b] = theme.blobs!;
  const big = size === "wide" ? 340 : 420;
  return (
    <>
      <div
        style={{
          position: "absolute",
          width: big,
          height: big,
          borderRadius: "50%",
          background: a,
          top: -big * 0.45,
          right: -big * 0.3,
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: big * 0.8,
          height: big * 0.8,
          borderRadius: "50%",
          background: b,
          bottom: -big * 0.45,
          left: -big * 0.25,
        }}
      />
    </>
  );
}

function Header({ config, theme, identity, compact = false }: { config: CardConfig; theme: Theme; identity: CardIdentity; compact?: boolean }) {
  const hasName = Boolean(identity.name || identity.logoUrl);
  const date = config.showDate ? formatDate(new Date()) : null;
  if (!hasName && !date) return null;
  const box = compact ? 32 : 40;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", minHeight: box }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {identity.logoUrl && <Logo key={identity.logoUrl} src={identity.logoUrl} size={box} background={theme.surface} />}
        {identity.name && (
          <span style={{ fontWeight: 800, fontSize: compact ? 16 : 19, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {identity.name}
          </span>
        )}
      </div>
      {date && <Pill theme={theme}>{date}</Pill>}
    </div>
  );
}

/**
 * The app/repo logo. A plain <img> (not next/image) so html-to-image can inline
 * it; it is keyed by src by the caller, and hides itself when the image fails
 * so a bad URL never leaves a broken-image icon on the card.
 */
function Logo({ src, size, background }: { src: string; size: number; background: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: "30%", objectFit: "cover", background, flexShrink: 0, display: "block" }}
    />
  );
}

function Pill({ theme, children, tone }: { theme: Theme; children: React.ReactNode; tone?: "up" | "down" | "flat" }) {
  const colors = tone === "up" ? theme.up : tone === "down" ? theme.down : { bg: theme.surface, fg: theme.muted };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: colors.bg,
        color: colors.fg,
        fontWeight: 700,
        fontSize: 13,
        padding: "6px 12px",
        borderRadius: 999,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Footer({ config, theme, compact = false }: { config: CardConfig; theme: Theme; compact?: boolean }) {
  if (!config.caption && !config.showWatermark) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, position: "relative", fontSize: compact ? 12 : 13, color: theme.muted, fontWeight: 600 }}>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{config.caption}</span>
      {config.showWatermark && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, opacity: 0.85 }}>
          <Sparkle color={theme.muted} /> howitsgoing
        </span>
      )}
    </div>
  );
}

function Sparkle({ color, size = 11 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 2c.6 4.6 2.4 8.4 10 10-7.6 1.6-9.4 5.4-10 10-.6-4.6-2.4-8.4-10-10 7.6-1.6 9.4-5.4 10-10z" />
    </svg>
  );
}

function ChangeRow({ change, theme, size = "md" }: { change: ChangeInfo | null; theme: Theme; size?: "sm" | "md" }) {
  if (!change) return null;
  const arrow = change.direction === "up" ? "▲" : change.direction === "down" ? "▼" : "•";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: size === "sm" ? 12 : 14, color: theme.muted, fontWeight: 600 }}>
      <Pill theme={theme} tone={change.direction}>
        <span style={{ fontSize: size === "sm" ? 9 : 10 }}>{arrow}</span> {change.text.replace(/^[+−]/, "")}
      </Pill>
      <span>{change.context}</span>
    </div>
  );
}

function bigNumberSize(text: string, base: number): number {
  const len = text.length;
  if (len <= 6) return base;
  if (len <= 8) return base * 0.86;
  if (len <= 10) return base * 0.72;
  return base * 0.6;
}

function Skeleton({ w, h, theme, r = 12 }: { w: number | string; h: number; theme: Theme; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: theme.surface, opacity: 0.9 }} />;
}

function seriesValues(slot: CardSlot | undefined): number[] {
  return slot?.result?.series?.map((p) => p.v) ?? [];
}

/* ------------------------------------------------------------------ */
/* Single                                                               */
/* ------------------------------------------------------------------ */

function Single({ config, slot, theme, identity, id }: { config: CardConfig; slot?: CardSlot; theme: Theme; identity: CardIdentity; id: string }) {
  const wide = config.size === "wide";
  const pad = wide ? 36 : 44;
  const size = SIZES[config.size];
  const result = slot?.result;
  const label = config.headline || slot?.label || "";
  const valueText = result ? formatValue(result.value, slot!.def.format, result.currency) : "";
  const change = config.showChange && slot ? describeChange(result, slot.def.kind, slot.def.format, config.period) : null;
  const values = seriesValues(slot);
  const showChart = config.showChart && values.length > 1;
  const chartW = size.w - pad * 2;
  // Exact vertical budget so fixed-size blocks can never push content out of
  // the card: header + body/chart + note + footer + the gaps between them.
  const contentH = size.h - pad * 2;
  const hasHeader = Boolean(identity.name || identity.logoUrl || config.showDate);
  const hasFooter = Boolean(config.caption || config.showWatermark);
  const hasNote = Boolean(result?.note);
  const headerH = hasHeader ? (wide ? 32 : 40) : 0;
  const footerH = hasFooter ? 20 : 0;
  const noteH = hasNote ? 15 : 0;
  const blocks = [hasHeader, true, showChart, hasNote, hasFooter].filter(Boolean).length;
  const gapsH = (blocks - 1) * 18;
  // Wide lays body and chart side by side (row takes the taller one, and the
  // body at ~136px always fits inside the chart height). Stacked sizes reserve
  // ~152px for the body and only shrink the chart below its default when the
  // note + chrome would otherwise overflow (square is the tight one).
  const wideChartH = Math.max(110, contentH - headerH - footerH - noteH - gapsH);
  const defaultChartH = config.size === "tall" ? 250 : 170;
  const stackedChartH = Math.max(90, Math.min(defaultChartH, contentH - headerH - footerH - noteH - gapsH - 152));

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: wide ? 10 : 12, minWidth: 0 }}>
      <div style={{ textTransform: "uppercase", letterSpacing: 1.2, fontSize: wide ? 12 : 13, fontWeight: 800, color: theme.muted }}>
        {slot?.loading && !label ? (
          <Skeleton w={160} h={14} theme={theme} r={6} />
        ) : (
          <>
            {slot?.def.emoji && <span style={{ marginRight: 8 }}>{slot.def.emoji}</span>}
            {label}
          </>
        )}
      </div>
      {slot?.loading && !result ? (
        <Skeleton w={wide ? 220 : 280} h={wide ? 60 : 72} theme={theme} r={16} />
      ) : slot?.error ? (
        <div style={{ fontSize: 18, fontWeight: 700, color: theme.muted }}>😵 {slot.error}</div>
      ) : (
        <div style={{ fontSize: bigNumberSize(valueText, wide ? 72 : 84), fontWeight: 900, letterSpacing: -2, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{valueText || "—"}</div>
      )}
      {result && <ChangeRow change={change} theme={theme} />}
    </div>
  );

  const chart = showChart ? (
    <Chart
      id={`${id}-single`}
      values={values}
      width={wide ? Math.round(chartW * 0.45) : chartW}
      height={wide ? wideChartH : stackedChartH}
      style={config.chartStyle}
      color={theme.accent}
      softColor={theme.accentSoft}
      gridColor={theme.muted}
      baseline={slot!.def.kind === "flow" ? "zero" : "min"}
    />
  ) : null;

  const note = result?.note ? (
    <div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, opacity: 0.85, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {result.note}
    </div>
  ) : null;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, padding: pad, gap: 18, minHeight: 0 }}>
      <Header config={config} theme={theme} identity={identity} compact={wide} />
      {wide ? (
        <div style={{ display: "flex", alignItems: "center", gap: 24, flex: 1, minHeight: 0 }}>
          <div style={{ flex: "1 1 55%", minWidth: 0 }}>{body}</div>
          {chart && <div style={{ flex: "0 0 auto" }}>{chart}</div>}
        </div>
      ) : (
        <>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{body}</div>
          {chart && <div style={{ flexShrink: 0 }}>{chart}</div>}
        </>
      )}
      {note}
      <Footer config={config} theme={theme} compact={wide} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stack                                                                */
/* ------------------------------------------------------------------ */

function Stack({ config, slots, theme, identity, id }: { config: CardConfig; slots: CardSlot[]; theme: Theme; identity: CardIdentity; id: string }) {
  const wide = config.size === "wide";
  const pad = wide ? 32 : 40;
  const size = SIZES[config.size];
  const n = Math.max(1, slots.length);
  const cols = wide ? (n <= 2 ? n : 2) : n <= 2 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const gap = 14;
  const tileW = (size.w - pad * 2 - gap * (cols - 1)) / cols;
  const headerH = identity.name || identity.logoUrl || config.showDate ? (wide ? 32 : 40) + 18 : 0;
  const footerH = config.caption || config.showWatermark ? 16 + 18 : 0;
  const tileH = (size.h - pad * 2 - headerH - footerH - gap * (rows - 1)) / rows;
  // The sparkline gets whatever vertical room is left after label + number +
  // change row + padding (~136px); below 36px it would clip, so hide it.
  const sparkH = Math.min(64, tileH - 136);
  const showSpark = config.showChart && sparkH >= 36;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, padding: pad, gap: 18 }}>
      <Header config={config} theme={theme} identity={identity} compact={wide} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, flex: 1 }}>
        {slots.map((slot, i) => {
          const result = slot.result;
          const valueText = result ? formatValue(result.value, slot.def.format, result.currency, { compact: Math.abs(result.value) >= 10_000 }) : "";
          const change = config.showChange ? describeChange(result, slot.def.kind, slot.def.format, config.period) : null;
          const values = seriesValues(slot);
          return (
            <div
              key={i}
              style={{
                background: theme.surface,
                borderRadius: 22,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 0,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: theme.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ fontSize: 14 }}>{slot.def.emoji}</span> {slot.ref.label || slot.def.shortLabel}
              </div>
              {slot.loading && !result ? (
                <Skeleton w={120} h={34} theme={theme} />
              ) : slot.error ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.muted }}>😵 {slot.error}</div>
              ) : (
                <div style={{ fontSize: bigNumberSize(valueText, cols === 1 ? 44 : 34), fontWeight: 900, letterSpacing: -1, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{valueText || "—"}</div>
              )}
              {change && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: theme.muted, fontWeight: 700 }}>
                  <span style={{ color: change.direction === "up" ? theme.up.fg : change.direction === "down" ? theme.down.fg : theme.muted }}>
                    {change.direction === "up" ? "▲" : change.direction === "down" ? "▼" : "•"} {change.text.replace(/^[+−]/, "")}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{change.context}</span>
                </div>
              )}
              {showSpark && values.length > 1 && (
                <div style={{ marginTop: "auto" }}>
                  <Chart
                    id={`${id}-stack-${i}`}
                    values={values}
                    width={tileW - 36}
                    height={sparkH}
                    style={config.chartStyle === "bars" ? "bars" : config.chartStyle}
                    color={theme.accent}
                    softColor={theme.accentSoft}
                    baseline={slot.def.kind === "flow" ? "zero" : "min"}
                    strokeWidth={3}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Footer config={config} theme={theme} compact={wide} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Milestone                                                            */
/* ------------------------------------------------------------------ */

const CONFETTI = [
  [8, 12, 10, 0],
  [22, 30, 6, 1],
  [80, 10, 8, 2],
  [92, 40, 12, 0],
  [14, 78, 8, 2],
  [86, 84, 10, 1],
  [50, 6, 6, 1],
  [66, 90, 6, 0],
  [30, 92, 10, 2],
  [72, 24, 5, 2],
] as const;

function Milestone({ config, slot, theme, identity, id }: { config: CardConfig; slot?: CardSlot; theme: Theme; identity: CardIdentity; id: string }) {
  const wide = config.size === "wide";
  const pad = wide ? 36 : 44;
  const result = slot?.result;
  const milestoneValue = config.milestone?.value ?? (result ? niceMilestone(result.value) : undefined);
  const valueText = milestoneValue !== undefined && slot ? formatValue(milestoneValue, slot.def.format, result?.currency) : "";
  const label = config.headline || slot?.label || "";
  const message = config.milestone?.message || config.caption || "Thank you for the support 💛";
  const palette = [theme.accent, theme.up.fg, theme.muted];
  void id;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, padding: pad, gap: 12 }}>
      {CONFETTI.map(([x, y, s, c], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: s,
            height: s,
            borderRadius: i % 3 === 0 ? 2 : "50%",
            background: palette[c],
            opacity: 0.55,
            transform: `rotate(${i * 37}deg)`,
          }}
        />
      ))}
      <Header config={config} theme={theme} identity={identity} compact={wide} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: wide ? 6 : 10, position: "relative" }}>
        <div style={{ fontSize: wide ? 34 : 56, lineHeight: 1 }}>{config.emoji || "🎉"}</div>
        <div style={{ fontSize: wide ? 15 : 18, fontWeight: 700, color: theme.muted }}>{identity.name ? `${identity.name} just hit` : "We just hit"}</div>
        {slot?.loading && !result ? (
          <Skeleton w={260} h={wide ? 64 : 90} theme={theme} r={20} />
        ) : slot?.error ? (
          <div style={{ fontSize: 18, fontWeight: 700, color: theme.muted }}>😵 {slot.error}</div>
        ) : (
          <div style={{ fontSize: bigNumberSize(valueText, wide ? 66 : 96), fontWeight: 900, letterSpacing: -3, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{valueText || "—"}</div>
        )}
        <div style={{ fontSize: wide ? 18 : 22, fontWeight: 800, letterSpacing: -0.3 }}>{label}</div>
        <div style={{ fontSize: wide ? 13 : 15, fontWeight: 600, color: theme.muted, maxWidth: 380, marginTop: 4 }}>{message}</div>
      </div>
      <Footer config={{ ...config, caption: config.milestone?.message ? config.caption : "" }} theme={theme} compact={wide} />
    </div>
  );
}
