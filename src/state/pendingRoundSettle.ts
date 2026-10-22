/**
 * Save R8 (Issue #617): completing a round from its journal. The one pure function behind both entry points -- the start of
 * the app (a `pending` journal found in the save) and leaving the round for HOME -- so the two always agree.
 *
 * It does what finishing the round by hand would have done, with the same code:
 *   1. `finalizeRound` (FINAL) re-scores the journaled pizza -- Free Cooking identifies it again with the same matcher;
 *   2. `REGISTER_TO_DEX` registers it (Dex / BEST / `timesMade` / Pitz / materials / techniques / hint facts / Research).
 * What is deliberately different from finishing by hand:
 *   - Stock is NOT touched. The journal exists because the stock was already consumed and saved; the stock of `base` is kept as
 *     it is (re-running the consumption would take it twice).
 *   - No efficiency bonus: the clock is not journaled, so there is no cooking time to judge.
 *   - It is idempotent by state, not by luck: only a `pending` journal settles, and the result is a `settled` journal that
 *     cannot settle again. The caller saves the registered progress and the `settled` journal in ONE write.
 */
import { FREE_COOK_RECIPE } from "../data/freeCook";
import { getRecipe, type RecipeId } from "../data/recipes";
import { finalizeRound } from "./finalizeRound";
import { gameReducer, unmatchedFreeCookPatch, type GameState } from "./gameReducer";
import {
  pizzaFromJournal,
  settledPendingRound,
  type PendingRound,
  type PendingRoundSummary,
} from "./pendingRound";

export interface SettleResult {
  /** A fresh round (ORDER) that carries the registered progression, ready to play on. */
  state: GameState;
  /** The journal, now `settled` with its summary: what to save (with `state`'s progression) and what to tell the player. */
  settled: PendingRound;
}

/**
 * `base` is any state that carries the progression to register onto -- the one built from the save at startup, or the live state
 * on HOME leaving (its stock is already the consumed stock). Returns `null` when the journal cannot be settled (not `pending`,
 * or it names a recipe this build lacks); the caller then keeps it as it is.
 */
export function settlePendingRound(base: GameState, round: PendingRound): SettleResult | null {
  if (round.status !== "pending") return null;
  const freeCook = round.kind === "FREE_COOK";
  const recipe = freeCook ? FREE_COOK_RECIPE : getRecipe(round.recipeId as RecipeId);
  if (!recipe) return null;

  const roundState: GameState = {
    ...base,
    phase: "RESULT",
    recipe,
    pizza: pizzaFromJournal(round.pizza),
    freeCook,
    roundKind: freeCook ? "FREE_COOK" : "GUIDED",
    isMissionRound: false,
    dinner: null,
    score: null,
    scoringV2Result: null,
    completion: null,
    bakeValue: null,
    pendingRound: null,
    unservedConsumption: null,
    cookingTiming: null,
    researchTargetId: round.research ? round.research.targetId : base.researchTargetId,
    researchTargetValidAtStart: round.research ? round.research.validAtStart : false,
  };

  const finalized = finalizeRound({
    recipe,
    pizza: roundState.pizza,
    bakeValue: round.bakeValue,
    freeCook,
    isMissionRound: false,
    roundKind: roundState.roundKind,
    dex: base.dex,
    inventory: base.inventory,
    // A Free round is identified by the FINAL pass either way; a Guided round whose FINISH was never confirmed is completed with the
    // evaluation the bake produced (the late requirement left out of the gate), a finished one with the FINAL evaluation.
    finalization: freeCook || round.finished ? "FINAL" : "PROVISIONAL",
  });

  let scored: GameState;
  if (finalized.kind === "UNMATCHED_FREE_COOK") {
    scored = { ...roundState, ...unmatchedFreeCookPatch(roundState, finalized), phase: "RESULT" };
  } else {
    scored = {
      ...roundState,
      recipe: finalized.recipe,
      pizza: finalized.pizza,
      score: finalized.score,
      bakeState: finalized.bakeState,
      scoringV2Result: finalized.scoringV2Result,
      completion: finalized.completion,
    };
  }
  // The stock was consumed (and saved) when the bake was confirmed: keep it exactly, whatever the re-scoring consumed.
  scored = { ...scored, inventory: base.inventory };

  const registered = gameReducer(scored, { type: "REGISTER_TO_DEX" });
  const summary = summarize(base, finalized.kind === "UNMATCHED_FREE_COOK", registered);
  // The inventory is kept again on the way out; `PLAY_AGAIN` carries the progression into a fresh round.
  const next = gameReducer({ ...registered, inventory: base.inventory }, { type: "PLAY_AGAIN" });
  return { state: next, settled: settledPendingRound(round, summary) };
}

function summarize(base: GameState, unmatched: boolean, registered: GameState): PendingRoundSummary {
  const newMaterialIds = registered.lastMaterialUnlockNotice ? [...registered.lastMaterialUnlockNotice.ingredientIds] : [];
  const newTechniqueIds = registered.lastTechniqueDiscovery ? [...registered.lastTechniqueDiscovery] : [];
  const earnedPitz = Math.max(0, registered.pitzBalance - base.pitzBalance);
  const failed = registered.completion?.status === "FAILED";
  if (unmatched) {
    // A Free Cooking pizza that matched no recipe: a failed dish, or an original pizza (registered as an outcome, no Dex entry).
    return {
      outcome: failed ? "FAILED" : registered.phase === "DISCOVERED" ? "ORIGINAL" : "UNMATCHED",
      recipeId: null,
      stars: null,
      earnedPitz: 0,
      discovered: false,
      newBest: false,
      newMaterialIds,
      newTechniqueIds,
    };
  }
  if (failed || registered.phase !== "DISCOVERED") {
    return { outcome: "FAILED", recipeId: null, stars: null, earnedPitz: 0, discovered: false, newBest: false, newMaterialIds: [], newTechniqueIds: [] };
  }
  return {
    outcome: "REGISTERED",
    recipeId: registered.recipe.id,
    stars: registered.score ? registered.score.stars : null,
    earnedPitz,
    discovered: registered.justDiscovered,
    newBest: registered.justGotNewBest,
    newMaterialIds,
    newTechniqueIds,
  };
}
