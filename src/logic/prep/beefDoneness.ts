/**
 * Cooking Prep Phase 1 PR-B S3: the beef doneness -> colour rule (pure). Spec: docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md §4, §18.3.
 *
 * `doneness` runs 0 (raw) .. 1 (prepped). The two ends:
 *   - RAW is exactly what `BeefSlices` (../../components/IngredientGlyph.tsx, PR-2 late4, Owner HV PASS) draws today, so an un-prepped beef is unchanged.
 *   - COOKED is PROVISIONAL (spec §4.4: lean #7a4226 / fat #d9b48a / edge #3d2314); the iPhone HV confirms it. The second ribbon's tones are derived the same way.
 * Colours are interpolated linearly in RGB in TypeScript (no `color-mix()`, older iOS Safari) and handed to CSS as custom properties; the SVG markup itself is untouched.
 */
import type { CSSProperties } from "react";

export interface BeefColors {
  lean: string;
  lean2: string;
  fat: string;
  fat2: string;
  edge: string;
}

/** `BeefSlices` as shipped (#691): ribbon 1 / ribbon 2 fill, the two fat streaks, the outline. */
export const BEEF_RAW_COLORS: BeefColors = { lean: "#b8473a", lean2: "#8f3a30", fat: "#f1d3c4", fat2: "#e6c3b4", edge: "#4a1a14" };
/** Prepped target (provisional until the iPhone HV). */
export const BEEF_COOKED_COLORS: BeefColors = { lean: "#7a4226", lean2: "#5f331f", fat: "#d9b48a", fat2: "#c79f78", edge: "#3d2314" };

/** Heat offset the prep adds to the bake curve (`toppingVisualFrame`). Owner decision P-7: 0 -- the difference is the SVG colour. `bakeVisual.ts` is untouched. */
export const PREP_HEAT_OFFSET = 0;

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

export function beefDonenessColors(doneness: number): BeefColors {
  return {
    lean: lerpHex(BEEF_RAW_COLORS.lean, BEEF_COOKED_COLORS.lean, doneness),
    lean2: lerpHex(BEEF_RAW_COLORS.lean2, BEEF_COOKED_COLORS.lean2, doneness),
    fat: lerpHex(BEEF_RAW_COLORS.fat, BEEF_COOKED_COLORS.fat, doneness),
    fat2: lerpHex(BEEF_RAW_COLORS.fat2, BEEF_COOKED_COLORS.fat2, doneness),
    edge: lerpHex(BEEF_RAW_COLORS.edge, BEEF_COOKED_COLORS.edge, doneness),
  };
}

/** The custom properties `CookingPrep.css` reads (`.ingredient-piece--prepared`). `--beef-gloss` is the sheen strength, 0 raw .. 1 prepped. */
export function beefDonenessStyle(doneness: number): CSSProperties {
  const c = beefDonenessColors(doneness);
  return {
    "--beef-lean": c.lean,
    "--beef-lean-2": c.lean2,
    "--beef-fat": c.fat,
    "--beef-fat-2": c.fat2,
    "--beef-edge": c.edge,
    "--beef-gloss": String(clamp01(doneness)),
  } as CSSProperties;
}

/** Class + style of one PLACED piece of a prepped ingredient on the pizza (Phase 1: beef only); `null` = draw it as before. */
export function preparedPieceVisual(ingredientId: string): { className: string; style: CSSProperties } | null {
  if (ingredientId !== "beef") return null;
  return { className: PREPARED_PIECE_CLASS, style: beefDonenessStyle(1) };
}

export const PREPARED_PIECE_CLASS = "ingredient-piece--prepared";
