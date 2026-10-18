/**
 * Square Dough F3 (Issue #538, Design Lock §4B.2 AC-1..AC-9): the RESULT's neutral dough-shape line.
 *
 * A pizza cooked on the tray that was NOT identified (the ORIGINAL card, shared by ORIGINAL / AMBIGUOUS /
 * INCOMPLETE_MATCH) says one fixed sentence about the dough shape and the way of cooking. Like
 * `executionAdviceJa`, it is a pure function of the player's own pizza and nothing else: it never reads the matcher
 * outcome, a recipe, a hint, the Dex, the technique ledger or a Research target, so it is byte-identical across the
 * three kinds and cannot tell the player whether the ingredients match, nearly match or collide with any recipe
 * (INV-4). It names no recipe, ingredient, count, distance or technique, and a round pizza gets nothing (AC-5).
 */
import type { PizzaState } from "./pizzaState";

export const PAN_SHAPE_NOTICE_JA = "材料だけでなく、生地の形や調理法も見直してみよう。";

/** The line for this pizza, or `null` (round / no explicit pan). Only the explicit `PizzaState.pan` counts (F1). */
export function panShapeNoticeJa(pizza: PizzaState | null | undefined): string | null {
  return pizza?.pan === "tray" ? PAN_SHAPE_NOTICE_JA : null;
}
