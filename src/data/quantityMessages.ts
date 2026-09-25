/**
 * Issue #215 (Fresh Audit section 8): the one short Result line that explains Scoring 2.0's
 * quantity factor (../logic/scoringV2/quantityComponent.ts) -- "the pizza completed, but this
 * ingredient was fewer/more than the Reference". Shortage wins when both exist (it costs more,
 * and Human Feel shows one big reason). Presentation copy only; the logic module never emits
 * display text.
 */
import type { ScoringV2Result } from "../logic/scoringV2";
import { getIngredient } from "./ingredients";

const FALLBACK_INGREDIENT_NAME = "具材";

export function buildQuantityNote(result: ScoringV2Result | null | undefined): string | null {
  const quantity = result?.components.quantity;
  if (!quantity || !quantity.available) return null;
  const deviation = quantity.shortage ?? quantity.excess;
  if (!deviation) return null;
  const name = getIngredient(deviation.ingredientId)?.nameJa ?? FALLBACK_INGREDIENT_NAME;
  const direction = quantity.shortage ? "少なめ" : "多め";
  return `${name}がお手本より${direction}（${deviation.playerCount}個／お手本${deviation.targetCount}個）`;
}
