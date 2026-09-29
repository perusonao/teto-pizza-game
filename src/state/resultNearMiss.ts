/**
 * Discovery Hint 2.0 (Issue #229, slice 229-C): the one "おしい" line a Free Cooking RESULT may
 * show, from 229-A's `classifyNearMiss`. Pure; ResultPanel renders the returned copy as-is.
 *
 * Authority: docs/reports/TETO_DISCOVERY-HINT-2_FRESH-AUDIT.md §4.2 + the Owner decisions for
 * 229-C (OD-HINT-5 OFF):
 * - ORIGINAL: compared with today's DISCOVERABLE recipes only. d=1 names the direction (add one /
 *   remove one / change the sauce), d=2 says "close" with no direction, d>=3 says nothing, or
 *   only the generic "new material" nudge when the nearest recipe's key material is unused.
 * - ALREADY_DISCOVERED: one extra line only at d=1; the known-pizza result stays as it is.
 * - NEW_DISCOVERY, AMBIGUOUS, INCOMPLETE_MATCH (its own copy fix lives in ResultPanel), a FAILED
 *   round and any non-Free-Cooking round: no line.
 * The line never names a recipe, and never which ingredient to add or remove.
 *
 * Original Pizza Recovery P2 (docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P2_RESULT-FEEDBACK_Result.md):
 * - A sauce-only difference is worded from its step (`NearMiss.sauceStep`). CHANGE and ADD (the pizza
 *   has no sauce yet) keep the existing "change the sauce" line -- true for both and directional, which
 *   the hint-to-discovery reachability walk (discoveryHint.walk.test.ts) relies on. REMOVE (the target
 *   has no sauce) uses the generic "remove one" line: "change the sauce" would be false there and would
 *   hint at the undiscovered no-sauce Technique (H5-INV-4). A refined ADD wording is an Owner copy
 *   decision (OD-P2-3) and is not changed here.
 * - The optional generic FAR line (`NEAR_MISS_FAR_GENERIC_COPY`, OD-P2-2) is OFF in production
 *   (`RESULT_FAR_GENERIC_ENABLED`). It is derived from nothing but "an ORIGINAL with no nearer
 *   line", asserts nothing about distance or recipes, and needs an Owner decision to be shown.
 * - Input has no hint-fact / Pitz / ladder field, so no line can replace or reuse a Hint 5.0 rung.
 */
import type { PizzaCompletionResult } from "../logic/completionGate";
import { discoverableHintCandidates } from "../logic/discovery/hintTarget";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { classifyNearMiss, type NearMiss, type NearMissKind } from "../logic/discovery/nearMiss";
import { signatureOfPizza } from "../logic/discovery/signature";
import type { DexState } from "./dex";
import type { InventoryState } from "./inventory";
import type { PizzaState } from "./pizzaState";

export interface ResultNearMissInput {
  freeCook: boolean;
  completion: PizzaCompletionResult | null;
  lastDiscovery: DiscoveryOutcome | null;
  pizza: PizzaState;
  dex: DexState;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  inventory: InventoryState;
}

export interface ResultNearMissLine {
  kind: NearMissKind;
  textJa: string;
}

/** OD-P2-2: whether the generic FAR line is shown. `false` = production behaviour is unchanged. */
export const RESULT_FAR_GENERIC_ENABLED = false;

export const NEAR_MISS_COPY: Record<Exclude<NearMissKind, "FAR">, string> & { FAR_KEY_UNUSED: string } = {
  ADD_ONE: "\u{1F90F} おしい！ 材料をあと1つ足すと、何か見つかりそう！",
  REMOVE_ONE: "\u{1F90F} おしい！ 材料を1つ減らすと、何か見つかりそう！",
  SAUCE_ONLY: "\u{1F90F} おしい！ ソースを変えると、何か見つかりそう！",
  CLOSE: "\u{1F440} かなり近づいてるよ。少しだけ変えてみよう！",
  FAR_KEY_UNUSED: "\u{1F6D2} 新しく入荷した材料は使ってみた？",
};

/** Owner copy candidate for OD-P2-2 (shown only when RESULT_FAR_GENERIC_ENABLED): recipe-agnostic
 *  advice, kept out of `NEAR_MISS_COPY` so the production copy set stays exactly as it was. */
export const NEAR_MISS_FAR_GENERIC_COPY = "\u{1F9EA} 別の組み合わせも試してみよう！";

export interface ResultNearMissOptions {
  /** Show the generic FAR line (OD-P2-2). Defaults to `RESULT_FAR_GENERIC_ENABLED`. */
  farGeneric?: boolean;
}

/**
 * The line for a classified near-miss. Pure. `known` = the pizza is an ALREADY_DISCOVERED one.
 */
export function nearMissLine(
  nearMiss: NearMiss,
  known: boolean,
  options: ResultNearMissOptions = {},
): ResultNearMissLine | null {
  if (nearMiss.kind === "FAR") {
    if (known) return null;
    if (nearMiss.keyUnused) return { kind: "FAR", textJa: NEAR_MISS_COPY.FAR_KEY_UNUSED };
    return (options.farGeneric ?? RESULT_FAR_GENERIC_ENABLED) ? { kind: "FAR", textJa: NEAR_MISS_FAR_GENERIC_COPY } : null;
  }
  if (known && nearMiss.distance !== 1) return null;
  if (nearMiss.kind === "SAUCE_ONLY" && nearMiss.sauceStep === "REMOVE") {
    return { kind: "REMOVE_ONE", textJa: NEAR_MISS_COPY.REMOVE_ONE };
  }
  return { kind: nearMiss.kind, textJa: NEAR_MISS_COPY[nearMiss.kind] };
}

export function resultNearMiss(
  input: ResultNearMissInput,
  options: ResultNearMissOptions = {},
): ResultNearMissLine | null {
  if (!input.freeCook || input.completion?.status === "FAILED") return null;
  const outcome = input.lastDiscovery?.kind;
  const known = outcome === "ALREADY_DISCOVERED";
  if (outcome !== "ORIGINAL" && !known) return null;

  const nearMiss = classifyNearMiss(signatureOfPizza(input.pizza), discoverableHintCandidates(input));
  return nearMiss ? nearMissLine(nearMiss, known, options) : null;
}
