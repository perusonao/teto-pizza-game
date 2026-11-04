/**
 * Pinsa Romana public gate (Issue #577, Owner decision of P3-b: option A).
 *
 * The late catalog (./lateCatalog.ts) is ON in Production since E5, so a Pinsa row in it ships whenever this literal is `true`. This literal is
 * the Pinsa-only switch: while `false` the recipe, its order and its discovery target id do not exist at runtime (the type-keyed tables keep
 * their rows so `RecipeId` stays exhaustive, exactly as for any inactive late recipe).
 *
 * `true` since the Owner's publish approval (2026-10-25, after the iPhone Claude Artifact HV: round dough and the current arugula look accepted;
 * look improvements are post-release follow-ups, see docs/reports/TETO_PINSA-577_PRODUCTION-ON_Result.md). THE ROLLBACK is this one literal set back
 * to `false`: `TETO_PINSA_OFF=1 npm test` (vitest.config.ts) compiles exactly that and runs the whole suite, so the closed state stays proven.
 *
 * A literal on purpose (like `LATE_CATALOG_PRODUCTION`) so a bundler drops the Pinsa branch. Tests mock this module to exercise either state.
 */
export const PINSA_PRODUCTION = true;

export function pinsaEnabled(): boolean {
  return PINSA_PRODUCTION;
}
