/**
 * Cooking Fry Phase 1 (Issue #749), F1: how a placed fried piece is tinted (pure, CSS only).
 *
 * `amount` is the number `fryResultOf` keeps (0..1). Nothing is drawn from the SVG itself: the custom properties below feed a `filter` only (never `transform`,
 * which the placement scale owns). The bubbles are drawn by the fry screen, not here. Un-fried (`undefined`) and unreadable values add NO style, so an ordinary
 * piece is byte-identical to today. Values are PROVISIONAL until the iPhone HV.
 */
import type { CSSProperties } from "react";
import { FRY_CRISP_FROM_MS, FRY_OVER_FROM_MS, fryLookOfAmount } from "./fryPot";

export const FRIED_PIECE_CLASS = "ingredient-piece--fried";

const CRISP_AT = FRY_CRISP_FROM_MS / FRY_OVER_FROM_MS;

/** 0..1: the golden colour, rising from nothing (raw) to full once the piece is crisp. */
export function friedGolden(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.min(1, Math.max(0, amount) / CRISP_AT);
}

export function friedPieceStyle(amount: number | undefined): CSSProperties | undefined {
  if (amount === undefined || !Number.isFinite(amount)) return undefined;
  const over = fryLookOfAmount(amount) === "over";
  const golden = over ? 1 : friedGolden(amount);
  const sepia = over ? 0.85 : 0.5 * golden;
  const bright = over ? 0.62 : 1 + 0.06 * golden;
  const sat = over ? 0.8 : 1 + 0.12 * golden;
  const sheen = over ? 0.1 : 0.55 * golden;
  return {
    "--fry-bright": bright.toFixed(3),
    "--fry-sat": sat.toFixed(3),
    "--fry-sepia": sepia.toFixed(3),
    "--fry-sheen": sheen.toFixed(3),
  } as CSSProperties;
}

/** The class + variables a placed piece draws when it was fried at `amount`; `null` when nothing applies (not fried). */
export function friedPieceVisual(amount: number | undefined): { className: string; style: CSSProperties } | null {
  const style = friedPieceStyle(amount);
  return style === undefined ? null : { className: FRIED_PIECE_CLASS, style };
}
