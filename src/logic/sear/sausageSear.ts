/**
 * Cooking Sear Phase 1 (Issue #724): the sausage amount -> colour rule (pure).
 *
 * `amount` runs 0 (raw, exactly the shipped `SausageSlices` drawing) .. 1 (charred). Five stops, interpolated linearly in RGB in TypeScript and handed to CSS
 * as custom properties (no `color-mix()`, older iOS Safari). The SVG markup itself is untouched: ./Sear.css (../../components/Sear.css) overrides `fill` /
 * `stroke` on the glyph's paths, exactly as the beef prep does. The stops are PROVISIONAL until the iPhone HV.
 */
import type { CSSProperties } from "react";

export interface SausageColors {
  outer: string;
  inner: string;
  fat: string;
  dots: string;
  edge: string;
}

/** `SausageSlices` as shipped (outer ring, inner face, fat flecks, seeds, outline). */
export const SAUSAGE_RAW_COLORS: SausageColors = { outer: "#8f3f2e", inner: "#b95e47", fat: "#f5dcc6", dots: "#6e2a1e", edge: "#431a12" };
/**
 * Five stops at amounts 0 / 0.25 / 0.5 / 0.75 / 1 (the four looks ほんのり / こんがり / しっかり / まっくろ, #724 colour improvement).
 * Designed on luminance, not only hue: every stop's face is clearly darker than the one before (so the early looks read at pizza size, where a piece is
 * ~24px), the outer ring always stays darker than the face and the fat flecks always stay light (so even the charred slice keeps its two-ring shape
 * and its texture instead of turning into one black blob). The numeric floors are pinned in ./sausageSear.test.ts. PROVISIONAL until the iPhone HV.
 */
export const SAUSAGE_SEAR_STOPS: readonly { at: number; colors: SausageColors }[] = [
  { at: 0, colors: SAUSAGE_RAW_COLORS },
  { at: 0.25, colors: { outer: "#7a3b27", inner: "#9b5439", fat: "#f0cfa6", dots: "#5c2619", edge: "#3a160e" } },
  { at: 0.5, colors: { outer: "#683718", inner: "#814b24", fat: "#e8b86c", dots: "#44200f", edge: "#2a1208" } },
  { at: 0.75, colors: { outer: "#4d2c19", inner: "#643e26", fat: "#cf9c5f", dots: "#2c140a", edge: "#1c0d06" } },
  { at: 1, colors: { outer: "#281912", inner: "#4c3326", fat: "#b58f64", dots: "#130905", edge: "#0e0604" } },
];
export const SAUSAGE_GOLDEN_COLORS: SausageColors = SAUSAGE_SEAR_STOPS[2].colors;
export const SAUSAGE_CHARRED_COLORS: SausageColors = SAUSAGE_SEAR_STOPS[4].colors;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerpHex(from: string, to: string, t: number): string {
  const k = clamp01(t);
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

export function sausageSearColors(amount: number): SausageColors {
  const a = clamp01(amount);
  let i = 0;
  while (i < SAUSAGE_SEAR_STOPS.length - 2 && a > SAUSAGE_SEAR_STOPS[i + 1].at) i += 1;
  const from = SAUSAGE_SEAR_STOPS[i];
  const to = SAUSAGE_SEAR_STOPS[i + 1];
  const t = (a - from.at) / (to.at - from.at);
  return {
    outer: lerpHex(from.colors.outer, to.colors.outer, t),
    inner: lerpHex(from.colors.inner, to.colors.inner, t),
    fat: lerpHex(from.colors.fat, to.colors.fat, t),
    dots: lerpHex(from.colors.dots, to.colors.dots, t),
    edge: lerpHex(from.colors.edge, to.colors.edge, t),
  };
}

/** Sheen along the upper edge: rises to a peak around "golden" and dries out toward charred (0..1). */
export function sausageSearGloss(amount: number): number {
  const a = clamp01(amount);
  return a <= 0.5 ? a / 0.5 : Math.max(0, 1 - (a - 0.5) / 0.4);
}

export function sausageSearStyle(amount: number): CSSProperties {
  const c = sausageSearColors(amount);
  return {
    "--sear-outer": c.outer,
    "--sear-inner": c.inner,
    "--sear-fat": c.fat,
    "--sear-dots": c.dots,
    "--sear-edge": c.edge,
    "--sear-gloss": sausageSearGloss(amount).toFixed(3),
  } as CSSProperties;
}

export const SEARED_PIECE_CLASS = "ingredient-piece--seared";

/** The class + variables a placed piece of `ingredientId` draws when it was seared at `amount`; `null` when nothing applies (not sausage / not seared). */
export function searedPieceVisual(ingredientId: string, amount: number | undefined): { className: string; style: CSSProperties } | null {
  if (ingredientId !== "sausage" || amount === undefined) return null;
  return { className: SEARED_PIECE_CLASS, style: sausageSearStyle(amount) };
}
