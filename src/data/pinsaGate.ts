/**
 * Pinsa Romana public gate (Issue #577, Owner decision of P3-b: option A).
 *
 * The late catalog (./lateCatalog.ts) is ON in Production since E5, so a Pinsa row added to it would ship with the next deploy. This literal is
 * the Pinsa-only switch: while `false` the recipe, its order and its discovery target id do not exist at runtime (the type-keyed tables keep
 * their rows so `RecipeId` stays exhaustive, exactly as for any inactive late recipe). Publishing Pinsa needs a separate Owner approval, the
 * original-source check (PK-0 items 2/4/5) and the iPhone Safari Human Verification -- do NOT flip it in a feature PR.
 *
 * A literal on purpose (like `LATE_CATALOG_PRODUCTION`) so a bundler drops the Pinsa branch. Tests mock this module to exercise the ON state.
 */
export const PINSA_PRODUCTION = false;

export function pinsaEnabled(): boolean {
  return PINSA_PRODUCTION;
}
