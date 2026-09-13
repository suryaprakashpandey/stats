import { SIZES, type CardConfig } from "./types";
import type { CardIdentity } from "./resolve";

/** Shared layout rules for rendering and describing stack cards. */
export function stackLayout(config: CardConfig, slotCount: number, identity: CardIdentity) {
  const wide = config.size === "wide";
  const pad = wide ? 32 : 40;
  const size = SIZES[config.size];
  const n = Math.max(1, slotCount);
  const cols = wide ? (n <= 2 ? n : 2) : n <= 2 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const gap = 14;
  const tileW = (size.w - pad * 2 - gap * (cols - 1)) / cols;
  const headerH = identity.name || identity.logoUrl || config.showDate ? (wide ? 32 : 40) + 18 : 0;
  const footerH = config.caption || config.showWatermark ? 16 + 18 : 0;
  const tileH = (size.h - pad * 2 - headerH - footerH - gap * (rows - 1)) / rows;
  const showSpark = config.showChart && tileH >= 120;

  return { wide, pad, cols, gap, tileW, tileH, showSpark };
}
