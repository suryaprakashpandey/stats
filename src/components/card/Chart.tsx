import type { ChartStyle } from "@/lib/cards/types";

export interface ChartProps {
  values: number[];
  width: number;
  height: number;
  style: ChartStyle;
  color: string;
  softColor: string;
  /** "zero" anchors the y-axis at 0 (flows); "min" zooms into the range (levels). */
  baseline: "zero" | "min";
  strokeWidth?: number;
  showEndDot?: boolean;
  /** Faint horizontal gridlines (line/area only). Pass the theme's muted colour. */
  gridColor?: string;
  id: string;
}

/** Monotone cubic interpolation → smooth path without overshoot. */
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  if (n === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    m.push(dx[i] === 0 ? 0 : dy[i] / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t.push(0);
    else t.push((m[i - 1] + m[i]) / 2);
  }
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const c1x = pts[i].x + h / 3;
    const c1y = pts[i].y + (t[i] * h) / 3;
    const c2x = pts[i + 1].x - h / 3;
    const c2y = pts[i + 1].y - (t[i + 1] * h) / 3;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

export function Chart({ values, width, height, style, color, softColor, baseline, strokeWidth = 4, showEndDot = true, gridColor, id }: ChartProps) {
  if (!values.length) return null;
  // Line charts need room for the end-dot halo (r ≈ 2.8× stroke) on every side.
  const halo = strokeWidth * 3;
  const padX = style === "bars" ? 0 : halo;
  const padTop = style === "bars" || !showEndDot ? 4 : halo + 4;
  const padBottom = style === "bars" ? 0 : 4;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const max = Math.max(...values);
  const minV = Math.min(...values);
  let lo = baseline === "zero" ? 0 : minV;
  let hi = max;
  if (baseline === "min") {
    const range = hi - lo;
    lo = lo - range * 0.25;
    if (minV >= 0) lo = Math.max(0, lo);
  }
  if (hi === lo) {
    hi = lo + 1;
    lo = lo === 0 ? 0 : lo - 1;
  }
  const y = (v: number) => padTop + innerH - ((v - lo) / (hi - lo)) * innerH;

  if (style === "bars") {
    const n = values.length;
    const gap = n > 40 ? 1 : n > 20 ? 3 : 6;
    const bw = Math.max(2, (innerW - gap * (n - 1)) / n);
    const radius = Math.min(bw / 2, 6);
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
        {values.map((v, i) => {
          const x = padX + i * (bw + gap);
          const top = y(v);
          const h = Math.max(2, height - padBottom - top);
          const last = i === n - 1;
          return (
            <rect
              key={i}
              x={x}
              y={height - padBottom - h}
              width={bw}
              height={h}
              rx={radius}
              fill={last ? color : softColor}
            />
          );
        })}
      </svg>
    );
  }

  const n = values.length;
  const pts = values.map((v, i) => ({ x: padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW), y: y(v) }));
  const line = smoothPath(pts);
  const base = height - padBottom;
  const area = `${line} L${pts[n - 1].x},${base} L${pts[0].x},${base} Z`;
  const last = pts[n - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={softColor} />
          <stop offset="100%" stopColor={softColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {style === "area" && <path d={area} fill={`url(#grad-${id})`} />}
      {gridColor &&
        [0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padX} x2={width - padX} y1={padTop + innerH * f} y2={padTop + innerH * f} stroke={gridColor} strokeWidth={1} opacity={0.3} />
        ))}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {showEndDot && (
        <g>
          <circle cx={last.x} cy={last.y} r={strokeWidth * 2.2} fill={color} opacity={0.22} />
          <circle cx={last.x} cy={last.y} r={strokeWidth * 1.3} fill={color} stroke="#fff" strokeWidth={strokeWidth * 0.6} />
        </g>
      )}
    </svg>
  );
}
