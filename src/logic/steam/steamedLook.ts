/**
 * Cooking Steam Phase 1 (Issue #726), S1: how a placed steamed piece is tinted (pure, CSS only).
 *
 * `amount` is the number `steamResultOf` keeps (0..1). Nothing is drawn from the SVG itself: the three custom properties below feed a `filter` only (never
 * `transform`, which the placement scale owns). The opening of the shells is drawn by the steam screen, not here. Un-steamed (`undefined`) and unreadable
 * values add NO style, so an ordinary piece is byte-identical to today. Values are PROVISIONAL until the iPhone HV.
 */
import type { CSSProperties } from "react";
import { STEAM_SHELL_THRESHOLDS, steamLookOfAmount } from "./steamPot";

export const STEAMED_PIECE_CLASS = "ingredient-piece--steamed";

const FULL_OPEN = STEAM_SHELL_THRESHOLDS[STEAM_SHELL_THRESHOLDS.length - 1];

/** 0..1: moist sheen, rising until every shell is open. */
export function steamedSheen(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.min(1, Math.max(0, amount) / FULL_OPEN);
}

export function steamedPieceStyle(amount: number | undefined): CSSProperties | undefined {
  if (amount === undefined || !Number.isFinite(amount)) return undefined;
  const over = steamLookOfAmount(amount) === "over";
  const sheen = over ? 0.2 : steamedSheen(amount);
  const bright = over ? 0.9 : 1 + 0.12 * sheen;
  const sat = over ? 0.85 : 1 + 0.1 * sheen;
  return {
    "--steam-bright": bright.toFixed(3),
    "--steam-sat": sat.toFixed(3),
    "--steam-sheen": sheen.toFixed(3),
  } as CSSProperties;
}

/** The class + variables a placed piece draws when it was steamed at `amount`; `null` when nothing applies (not steamed). */
export function steamedPieceVisual(amount: number | undefined): { className: string; style: CSSProperties } | null {
  const style = steamedPieceStyle(amount);
  return style === undefined ? null : { className: STEAMED_PIECE_CLASS, style };
}
