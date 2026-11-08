/**
 * Staged Catalog types (Issue #780, Full-Expansion 177 plan §6-§7, Owner G-1 / P-1 2026-11-07). STAGED ONLY: nothing under
 * `src/data/staged/` is imported by production code (pinned by stagedIsolation.test.ts). These shapes are deliberately NOT
 * `Recipe` / `Ingredient`: a staged entry is a candidate with open dependencies, not catalog data. Promotion into the real
 * catalog is a separate, per-train Catalog Integrator PR (plan §8).
 */
export type StagedIngredientCategory = "sauce" | "cheese" | "topping";
export type StagedIngredientKind =
  | "VEG" | "FRUIT" | "CHEESE" | "MEAT" | "SEAFOOD" | "NUT" | "SPICE" | "SAUCE" | "LIQUID" | "DESSERT" | "COMPOSITE";
export type StagedFamily = "meat" | "seafood" | "vegetable" | "herb" | "fruit" | "spice" | "other";

/** Mechanic keys a staged recipe can wait for (plan §5, tracks M1-M6). */
export type StagedMechanicKey =
  | "DOUGH_VARIANT" | "PAN_PROFILE" | "DOUGH_SHAPE_TARGET" | "ENCLOSE" | "MID_BAKE" | "PREP" | "FRY"
  | "STEP_ORDER" | "ZONED" | "LAMINATE" | "MULTI_SPREAD_3";

/** Owner provisional rules (plan §9). Listed on an entry = that decision is still open for it. */
export type StagedOwnerRule = "R-1" | "R-2" | "R-3" | "R-4" | "R-5" | "R-6" | "R-7" | "R-8";

export interface StagedRequirement {
  readonly ingredientId: string;
  /** PROVISIONAL placeholder (sauce 1 / cheese 3 / topping 2); real counts are set per train. */
  readonly minCount: number;
  readonly applicationPhase?: "POST_BAKE";
}

export interface StagedRecipe {
  /** Candidate id (matrix `canonicalCandidateId`). Final ids are re-judged before promotion (Owner 2026-11-07). */
  readonly id: string;
  /** Provenance: the 172-matrix evidence row. */
  readonly evidenceId: string;
  readonly nameJa: string;
  readonly origin: string;
  readonly requiredIngredients: readonly StagedRequirement[];
  readonly sauce: { readonly status: string; readonly baseIngredientId: string | null };
  readonly dough: { readonly class: string; readonly variant: string | null; readonly shape: string | null };
  readonly pan: string | null;
  readonly mechanics: readonly StagedMechanicKey[];
  readonly ownerRules: readonly StagedOwnerRule[];
  readonly ownerReasons: readonly string[];
  /** Matrix tokens that did not resolve to an id (R-7). */
  readonly unresolvedTokens: readonly string[];
  readonly identityComplete: boolean;
  /** Provisional rules the generator applied to this entry (I-1 / I-2 / R-6), for audit and reversal. */
  readonly applied: readonly string[];
  /** Ingredients owned by in-flight work (burrata: PR #783; honey / walnut: B20-A). */
  readonly inFlightIngredients: readonly string[];
  readonly lane: "R-A" | "R-B" | "R-C";
  readonly source: string;
}

export type StagedIngredientStatus = "ACTIVE" | "ALIASED_PROVISIONAL" | "MERGED_PROVISIONAL";

export interface StagedIngredient {
  readonly id: string;
  readonly nameJa: string;
  readonly category: StagedIngredientCategory;
  readonly placement: "spread" | "scatter";
  readonly kind: StagedIngredientKind;
  /** Hint 5.0 family for a topping (PROVISIONAL); `null` for sauce / cheese. */
  readonly family: StagedFamily | null;
  readonly composite: boolean;
  /** I-1: the shipped id it may be an alias of. */
  readonly aliasCandidate: string | null;
  /** I-2: candidate ids merged into this one. */
  readonly mergedFrom: readonly string[];
  readonly usedBy: readonly string[];
  /** ACTIVE = referenced by a staged recipe. The other two keep the candidate registered (reversible) but unreferenced. */
  readonly status: StagedIngredientStatus;
}
