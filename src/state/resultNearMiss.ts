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
 */
import type { PizzaCompletionResult } from "../logic/completionGate";
import { discoverableHintCandidates } from "../logic/discovery/hintTarget";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { classifyNearMiss, type NearMissKind } from "../logic/discovery/nearMiss";
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

export const NEAR_MISS_COPY: Record<Exclude<NearMissKind, "FAR">, string> & { FAR_KEY_UNUSED: string } = {
  ADD_ONE: "\u{1F90F} おしい！ 材料をあと1つ足すと、何か見つかりそう！",
  REMOVE_ONE: "\u{1F90F} おしい！ 材料を1つ減らすと、何か見つかりそう！",
  SAUCE_ONLY: "\u{1F90F} おしい！ ソースを変えると、何か見つかりそう！",
  CLOSE: "\u{1F440} かなり近づいてるよ。少しだけ変えてみよう！",
  FAR_KEY_UNUSED: "\u{1F6D2} 新しく入荷した材料は使ってみた？",
};

export function resultNearMiss(input: ResultNearMissInput): ResultNearMissLine | null {
  if (!input.freeCook || input.completion?.status === "FAILED") return null;
  const outcome = input.lastDiscovery?.kind;
  const known = outcome === "ALREADY_DISCOVERED";
  if (outcome !== "ORIGINAL" && !known) return null;

  const nearMiss = classifyNearMiss(signatureOfPizza(input.pizza), discoverableHintCandidates(input));
  if (!nearMiss) return null;
  if (nearMiss.kind === "FAR") {
    return !known && nearMiss.keyUnused ? { kind: "FAR", textJa: NEAR_MISS_COPY.FAR_KEY_UNUSED } : null;
  }
  if (known && nearMiss.distance !== 1) return null;
  return { kind: nearMiss.kind, textJa: NEAR_MISS_COPY[nearMiss.kind] };
}
