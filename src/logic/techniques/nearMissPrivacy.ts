/**
 * Cooking Techniques 1.0 TQ-1A (Issue #262), Owner Decision OD-TQ-P1: the near-miss privacy
 * fallback, pure part. Unwired (TQ-1C applies it to the RESULT near-miss line).
 *
 * An axis-specific line ("おしい！ ソースを変えると、何か見つかりそう！") is allowed only when at least
 * two concrete answers are consistent with it, so it never singles out the answer -- in particular
 * never "no sauce" for an undiscovered NO_SAUCE. Otherwise the line falls back to one that names no
 * axis. Same k >= 2 idea as Discovery Hint 4.0's privacy guard, on the player's *owned* universe:
 * ownership only grows, so a line allowed once stays allowed.
 */

export const NEAR_MISS_PRIVACY_FALLBACK_JA = "おしい！あと少し、なにかが違うみたい…？";

/**
 * The number of concrete base choices consistent with "change the sauce": every owned sauce the
 * pizza did not use, plus "no sauce at all" when the pizza used one. Duplicates and non-sauce ids
 * are ignored.
 */
export function sauceAxisAnswerCount(input: {
  ownedIngredientIds: readonly string[];
  usedSauceIds: readonly string[];
  sauceIngredientIds: readonly string[];
}): number {
  const sauces = new Set(input.sauceIngredientIds);
  const used = new Set(input.usedSauceIds.filter((id) => sauces.has(id)));
  const alternatives = new Set(input.ownedIngredientIds.filter((id) => sauces.has(id) && !used.has(id)));
  return alternatives.size + (used.size > 0 ? 1 : 0);
}

/** OD-TQ-P1: axis-specific guidance only when it keeps at least two candidate answers. */
export function axisGuidanceAllowed(answerCount: number): boolean {
  return Number.isFinite(answerCount) && answerCount >= 2;
}
