/**
 * Cooking Sear Phase 1 (Issue #724): the sausage amount -> colour rule (pure).
 *
 * `amount` runs 0 (raw, exactly the shipped `SausageSlices` drawing) .. 1 (charred). Three stops, interpolated linearly in RGB in TypeScript and handed to CSS
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
/** Mid stop (amount 0.5): caramel-browned face, golden fat, a darker rim. */
export const SAUSAGE_GOLDEN_COLORS: SausageColors = { outer: "#6b2f1e", inner: "#94501f", fat: "#e9b96f", dots: "#4a2013", edge: "#2e1109" };
/** End stop (amount 1): charred. */
export const SAUSAGE_CHARRED_COLORS: SausageColors = { outer: "#2c1610", inner: "#3b2115", fat: "#6a4a33", dots: "#1c0d08", edge: "#120705" };

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
  const [from, to, t] = a <= 0.5 ? [SAUSAGE_RAW_COLORS, SAUSAGE_GOLDEN_COLORS, a / 0.5] : [SAUSAGE_GOLDEN_COLORS, SAUSAGE_CHARRED_COLORS, (a - 0.5) / 0.5];
  return {
    outer: lerpHex(from.outer, to.outer, t),
    inner: lerpHex(from.inner, to.inner, t),
    fat: lerpHex(from.fat, to.fat, t),
    dots: lerpHex(from.dots, to.dots, t),
    edge: lerpHex(from.edge, to.edge, t),
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
