/**
 * Cooking Techniques 1.0 TQ-1C (Issue #287): the per-round technique step, pure. The reducer calls
 * `resolveRoundTechniques` once, from REGISTER_TO_DEX -- the same transition that writes the Dex --
 * so a technique is saved in the same write as the recipe it came with and is never reported twice.
 *
 * Authority: docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md (P4, P5, P8, P10) and
 * docs/design/TETO_COOKING-TECHNIQUES_1.0_TQ-1C_PRE-IMPLEMENTATION-GATE.md §3.
 *
 * Two paths (OD-TQ1C-3):
 * - usage path: a technique the pizza *used* is recognised only in Free Cooking and only once its
 *   affordance is open (INV-TQ-6);
 * - recipe path (INV-TQ-1): every technique a discovered recipe requires is recorded, in every FREE
 *   round (a guided round can discover another recipe through the matcher).
 * Lunch Rush and Dinner record nothing on either path.
 *
 * INV-TQ-4: with the production catalog no target requires a technique, so the affordance never
 * opens and no recipe adds one -- this step is inert in production until TQ-1D adds such a recipe.
 * The catalog is injectable so the whole loop can be tested with a synthetic one.
 */
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { TECHNIQUES, type TechniqueId } from "../../data/techniques";
import { discoveredRecipeIds, isDiscovered, type DexState } from "../../state/dex";
import { ingredientUnlockStep } from "../../state/materialEntitlement";
import type { RuntimeSignature } from "../discovery/signature";
import type { TechniqueTargetView } from "./detection";
import {
  backfillTechniqueLedger,
  isTechniqueAffordanceOpen,
  knownTechniqueIds,
  registerTechniqueDiscovery,
  techniqueAffordanceStep,
} from "./registration";

/** One discovery target as the technique step sees it: which recipe, its items and its base. */
export interface TechniqueCatalogEntry extends TechniqueTargetView {
  recipeId: string;
  items: readonly string[];
}

export interface TechniqueRuntimeContext {
  catalog: readonly TechniqueCatalogEntry[];
  /** 0 for a starter, the ladder step that unlocks a material, or null when no step does. */
  materialStep: (ingredientId: string) => number | null;
}

/** The runtime catalog and the Discovery Ladder -- what the game uses. */
export function productionTechniqueContext(): TechniqueRuntimeContext {
  return { catalog: RECIPE_DISCOVERY_CATALOG, materialStep: (id) => ingredientUnlockStep(id) };
}

/**
 * Which paths a round may use (OD-TQ1C-3):
 * - `FREE_COOK`: both;
 * - `FREE_GUIDED`: the recipe path only;
 * - `NONE`: Lunch Rush or Dinner.
 */
export type TechniqueRoundEligibility = "FREE_COOK" | "FREE_GUIDED" | "NONE";

export function techniqueRoundEligibility(round: {
  isMissionRound: boolean;
  isDinnerRound: boolean;
  freeCook: boolean;
}): TechniqueRoundEligibility {
  if (round.isMissionRound || round.isDinnerRound) return "NONE";
  return round.freeCook ? "FREE_COOK" : "FREE_GUIDED";
}

export interface RoundTechniqueInput {
  eligibility: TechniqueRoundEligibility;
  /** The ledger before this round (known ids). */
  ledger: readonly TechniqueId[];
  signature: Pick<RuntimeSignature, "ingredientSet" | "sauceBase">;
  /** The pizza passed its Completion Gate. Gates the usage path only; the recipe path follows the
   *  Dex this same transition wrote (INV-TQ-1 must hold for whatever the Dex now says). */
  completionPassed: boolean;
  /** The Dex before this round's registration (the affordance reads its discovered count). */
  dexBefore: DexState;
  /** The Dex after this round's registration (the recipe path reads what is discovered now). */
  dexAfter: DexState;
  context: TechniqueRuntimeContext;
}

export interface RoundTechniqueResult {
  ledger: TechniqueId[];
  /** Newly discovered this round, in registry order -- revealed before the recipe (P5). */
  newlyDiscovered: TechniqueId[];
}

export function resolveRoundTechniques(input: RoundTechniqueInput): RoundTechniqueResult {
  const ledger = knownTechniqueIds(input.ledger);
  if (input.eligibility === "NONE") return { ledger, newlyDiscovered: [] };

  const discoveredCount = new Set(discoveredRecipeIds(input.dexBefore)).size;
  const usage =
    input.eligibility === "FREE_COOK" && input.completionPassed
      ? registerTechniqueDiscovery({
          ledger,
          signature: input.signature,
          completionPassed: true,
          // The recipe path below covers every discovered recipe, this round's match included.
          matchedTarget: null,
          isAffordanceOpen: (id) =>
            isTechniqueAffordanceOpen(
              techniqueAffordanceStep(id, input.context.catalog, input.context.materialStep),
              discoveredCount,
            ),
        })
      : { ledger, newlyDiscovered: [] };

  const discoveredTargets = input.context.catalog.filter((t) => isDiscovered(input.dexAfter, t.recipeId));
  const recipePath = backfillTechniqueLedger(usage.ledger, discoveredTargets);

  const newly = new Set<TechniqueId>([...usage.newlyDiscovered, ...recipePath.added]);
  return {
    ledger: knownTechniqueIds(recipePath.ledger),
    newlyDiscovered: TECHNIQUES.map((t) => t.id).filter((id) => newly.has(id)),
  };
}

/**
 * The ledger a session starts with: the saved known ids, repaired so every technique a discovered
 * recipe requires is present (INV-TQ-1 at load time). A no-op for every production save today.
 */
export function initialTechniqueLedger(
  saved: readonly string[],
  dex: DexState,
  context: TechniqueRuntimeContext = productionTechniqueContext(),
): TechniqueId[] {
  const discoveredTargets = context.catalog.filter((t) => isDiscovered(dex, t.recipeId));
  return knownTechniqueIds(backfillTechniqueLedger(knownTechniqueIds(saved), discoveredTargets).ledger);
}
