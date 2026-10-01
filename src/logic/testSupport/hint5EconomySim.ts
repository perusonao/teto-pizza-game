/**
 * Discovery Hint 5.0 (Issue #292), H5-2 / H5-4: a deterministic fresh-save -> Dex 25 walk that prices the
 * Sub-topping Classification Ladder with the P-C authority (OD-H5-E1) through the REAL reducer.
 *
 * TEST-ONLY ANALYSIS HARNESS. No production module imports it. The caller must run with the Hint 5.0
 * flag ON (vi.mock of ../discovery/hint5Flag): rungs are bought only through PURCHASE_HINT5_RUNG,
 * and each price is read off the reducer's own balance change.
 *
 * Everything else also goes through the real reducer, in the Hint Economy 1.0 harness's shape
 * (./discoveryHintEconomySim.ts):
 * - START_FREE_COOK / CONFIRM_BAKE / REGISTER_TO_DEX: the matcher, the Dex, the Discovery Ladder,
 *   the Pitz reward with the first-discovery bonus, and inventory consumption;
 * - PURCHASE_INGREDIENT / RESTOCK_INGREDIENT: the Shop.
 *
 * **What differs from the Economy 1.0 harness.** This walk measures the Pitz economy, not search
 * efficiency. Each stage:
 * 1. buys the profile's rungs for the stage target;
 * 2. bakes the target directly (the player deduced it). There are no experimental bakes, so
 *    earnings are conservative: no ALREADY_DISCOVERED income.
 *
 * **Profiles:**
 * - NONE buys nothing.
 * - FIXED4 buys rungs 1-4 (sauce, cheese, key topping, structure).
 * - FULL buys every rung, down to the last sub-topping classification.
 *
 * **Rules:**
 * - An unaffordable rung is skipped, never ground for. It is counted as an insufficient attempt.
 * - Round 6 (H5-4): an empty CHEESE / KEY rung is a normal paid rung (OD-H5-P4-CHEESE / P4b). Only an
 *   empty SAUCE rung is RESERVED_EMPTY_RUNG (the reducer refuses it at an affordable price); it would
 *   stop the ladder for that stage, and no runtime recipe has one (the RESERVED gate).
 * - Shop purchases the player cannot afford are paid by Margherita replays (grind bakes).
 * - Dex 0 (the Margherita onboarding) is free and never uses the ladder.
 */
import { getIngredient } from "../../data/ingredients";
import { countsTowardLadder, getRecipe, RECIPES, type RecipeId } from "../../data/recipes";
import { selectHintTarget } from "../discovery/hintTarget";
import { buildHint5Ladder, HINT5_RUNG_PRICE } from "../discovery/hint5Ladder";
import { starsFromTotal } from "../scoring";
import { discoveredRecipeIds } from "../../state/dex";
import { hint5SheetView } from "../../state/discoveryHint";
import { recipeDiscoveryState } from "../../state/recipeDiscoveryState";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../../state/gameReducer";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";

export type Hint5Profile = "NONE" | "FIXED4" | "FULL";
export const HINT5_PROFILES: readonly Hint5Profile[] = ["NONE", "FIXED4", "FULL"];

export interface Hint5StageRecord {
  /** Dex count after this stage (1..25). */
  discovery: number;
  recipe: string;
  pitzBefore: number;
  /** earnedPitz + first-discovery bonus of the discovering bake. */
  discoveryReward: number;
  /** Pitz from Margherita replays this stage. */
  otherEarned: number;
  hintSpend: number;
  /** Individual rung charges, in order (each is a P-C price). */
  rungCharges: number[];
  rungsBought: number;
  /** Rungs the target's ladder has (4 + sub-toppings). */
  rungsTotal: number;
  /** The ladder stopped at a RESERVED (empty SAUCE) rung. Never on the runtime catalog. */
  reservedStop: boolean;
  unlockSpend: number;
  refillSpend: number;
  pitzAfter: number;
  grindBakes: number;
  insufficientHintAttempts: number;
  minPitz: number;
}

export interface Hint5SimResult {
  profile: Hint5Profile;
  qualityTotal: number;
  stages: Hint5StageRecord[];
  completed: boolean;
  totalHintSpend: number;
  totalUnlockSpend: number;
  totalRefillSpend: number;
  totalDiscoveryEarned: number;
  totalOtherEarned: number;
  minPitz: number;
  endingPitz: number;
  grindBakes: number;
  insufficientHintAttempts: number;
  reservedStops: number;
}

const MARGHERITA: readonly string[] = ["tomato-sauce", "mozzarella", "basil"];
const BAKE_VALUE = 68;
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const isFiniteMaterial = (id: string) => !!getIngredient(id)?.unlockCondition;

/** k: the largest `minCount` any recipe asks of `id` (the Shop's pack unit, as in the 1.0 harness). */
function kOf(id: string): number {
  let k = 1;
  for (const r of RECIPES) for (const q of r.requiredIngredients) if (q.ingredientId === id) k = Math.max(k, q.minCount);
  return k;
}
const piecesOf = (id: string) => (isSauce(id) ? 1 : kOf(id));
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);

function pizzaOf(ids: readonly string[]): PizzaState {
  const toppings: PizzaState["toppings"] = [];
  let n = 0;
  for (const ingredientId of ids.filter((id) => !isSauce(id))) {
    for (let i = 0; i < piecesOf(ingredientId); i += 1) {
      toppings.push({ id: `h5sim${n}`, ingredientId, x: 20 + ((n * 7) % 60), y: 30 + ((n * 11) % 40) });
      n += 1;
    }
  }
  return { ...createEmptyPizza(), sauceIds: ids.filter(isSauce).slice(0, 1), toppings, bakeResult: BAKE_VALUE };
}

/** The P-C total of a target's whole ladder. Round 6: every rung is charged except a RESERVED (empty
 *  SAUCE) one. */
export function hint5LadderDesignTotal(recipeId: string): number {
  const ladder = buildHint5Ladder(recipeId)!;
  return ladder.rungs.filter((r) => r.kind !== "SAUCE" || r.subjectIds.length > 0).reduce((sum, r) => sum + HINT5_RUNG_PRICE[r.kind], 0);
}

/** H5-0 / H5-2 (before round 6): the same total with the empty CHEESE / KEY rungs uncharged. */
export function hint5LadderTotalBeforeRound6(recipeId: string): number {
  const ladder = buildHint5Ladder(recipeId)!;
  return ladder.rungs.filter((r) => r.kind === "STRUCTURE" || r.kind === "SUB_CLASS" || r.subjectIds.length > 0).reduce((sum, r) => sum + HINT5_RUNG_PRICE[r.kind], 0);
}

export function simulateHint5Economy(options: { profile: Hint5Profile; qualityTotal: number }): Hint5SimResult {
  const { profile, qualityTotal } = options;
  let s = createInitialGameState(undefined, undefined, 0);
  let minPitz = s.pitzBalance;
  const stages: Hint5StageRecord[] = [];
  let completed = false;

  const newAcc = (pitzBefore: number) => ({
    pitzBefore,
    otherEarned: 0,
    hintSpend: 0,
    rungCharges: [] as number[],
    reservedStop: false,
    unlockSpend: 0,
    refillSpend: 0,
    grind: 0,
    insufficient: 0,
    minPitz: pitzBefore,
  });
  let acc = newAcc(0);
  const track = () => {
    minPitz = Math.min(minPitz, s.pitzBalance);
    acc.minPitz = Math.min(acc.minPitz, s.pitzBalance);
  };
  const creditOf = (state: GameState) => {
    const c = state.lastPitzCredit;
    return c ? c.earnedPitz + c.discoveryBonusPitz + (state.lastEfficiencyCredit?.bonusPitz ?? 0) : 0;
  };

  function bakeRaw(ids: readonly string[]): GameState {
    s = { ...act(s, { type: "START_FREE_COOK" }), pizza: pizzaOf(ids) };
    s = act(s, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: BAKE_VALUE });
    for (let i = 0; i < 6 && s.phase !== "RESULT"; i += 1) s = act(s, { type: "CONFIRM_MAKING_STEP" });
    if (s.phase !== "RESULT") throw new Error(`bake did not reach RESULT (${ids.join("+")})`);
    if (s.score) s = { ...s, score: { ...s.score, total: qualityTotal, stars: starsFromTotal(qualityTotal) } };
    s = act(s, { type: "REGISTER_TO_DEX" });
    track();
    return s;
  }

  function grindTo(price: number) {
    let guard = 0;
    while (s.pitzBalance < price) {
      if (discoveredRecipeIds(s.dex).length === 0 || guard++ > 300) throw new Error("hard deadlock: no income source");
      bakeRaw(MARGHERITA);
      acc.grind += 1;
      acc.otherEarned += creditOf(s);
    }
  }

  function shop(action: GameAction): number {
    for (let guard = 0; guard < 300; guard += 1) {
      const before = s;
      s = act(s, action);
      if (s !== before && s.pitzBalance < before.pitzBalance) {
        track();
        return before.pitzBalance - s.pitzBalance;
      }
      grindTo(s.pitzBalance + 1);
    }
    throw new Error(`Shop transaction never succeeded: ${JSON.stringify(action)}`);
  }

  function ensureStock(ids: readonly string[]) {
    for (const id of ids) {
      if (!isFiniteMaterial(id)) continue;
      while ((s.inventory[id] ?? 0) < piecesOf(id)) acc.refillSpend += shop({ type: "RESTOCK_INGREDIENT", ingredientId: id });
    }
  }

  /** Buys the profile's rungs for the session target through the reducer. */
  function buyRungs(targetId: string) {
    s = act(s, { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: targetId });
    if (s.hintSession?.targetId !== targetId) throw new Error(`sheet target ${s.hintSession?.targetId} != ${targetId}`);
    for (let guard = 0; guard < 20; guard += 1) {
      const view = hint5SheetView(s, true);
      if (!view || !view.next) break;
      if (profile === "FIXED4" && view.next.rungIndex > 4) break;
      if (!view.next.affordable) {
        acc.insufficient += 1;
        break;
      }
      const before = s;
      s = act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: view.next.rungIndex });
      if (s === before) {
        acc.reservedStop = true; // affordable but refused: a RESERVED (empty SAUCE) rung
        break;
      }
      const charged = before.pitzBalance - s.pitzBalance;
      acc.hintSpend += charged;
      acc.rungCharges.push(charged);
      track();
    }
    s = act(s, { type: "CLOSE_HINT" });
  }

  for (let stageGuard = 0; stageGuard < 40; stageGuard += 1) {
    const dexCount = discoveredRecipeIds(s.dex).length;
    // Done when every recipe is discovered. Not "25": with a branching pool the walk may end after
    // more (or in a different order) than a single-path ladder, and the stop must not assume one.
    if (dexCount === RECIPES.length) {
      completed = true;
      break;
    }
    acc = newAcc(s.pitzBalance);
    for (const id of s.unlockedForShopIngredientIds.filter((x) => !s.ownedIngredientIds.includes(x))) {
      acc.unlockSpend += shop({ type: "PURCHASE_INGREDIENT", ingredientId: id });
    }
    ensureStock(s.ownedIngredientIds.filter((id) => isFiniteMaterial(id) && (s.inventory[id] ?? 0) < 1));
    const t = selectHintTarget(s);
    if (t.kind === "OPEN_POOL") {
      // PR-4b-B (Owner D-1): 2+ DISCOVERABLE and no sticky / purchased target -> no hint target, so
      // no rung can be bought. The player cooks a candidate blind, the non-credit one first (it
      // leaves one candidate again, which restores the hint). Nothing is spent on hints this stage.
      const candidates = RECIPES.filter((r) => recipeDiscoveryState(r, s) === "DISCOVERABLE");
      const pick = candidates.find((r) => !countsTowardLadder(r.id)) ?? candidates[0];
      if (!pick) throw new Error(`Dex ${dexCount}: OPEN_POOL without a candidate`);
      const answer = [...new Set(pick.requiredIngredients.map((r) => r.ingredientId))];
      ensureStock(answer);
      bakeRaw(answer);
      if (discoveredRecipeIds(s.dex).length !== dexCount + 1) throw new Error(`Dex ${dexCount}: pool candidate ${pick.id} was not discovered`);
      stages.push({
        discovery: dexCount + 1,
        recipe: pick.id,
        pitzBefore: acc.pitzBefore,
        discoveryReward: creditOf(s),
        otherEarned: acc.otherEarned,
        hintSpend: 0,
        rungCharges: [],
        rungsBought: 0,
        rungsTotal: buildHint5Ladder(pick.id)!.rungs.length,
        reservedStop: false,
        unlockSpend: acc.unlockSpend,
        refillSpend: acc.refillSpend,
        pitzAfter: s.pitzBalance,
        grindBakes: acc.grind,
        insufficientHintAttempts: 0,
        minPitz: acc.minPitz,
      });
      continue;
    }
    if (t.kind !== "TARGET") throw new Error(`Dex ${dexCount}: no hint target (${t.kind})`);
    const target = getRecipe(t.recipeId as RecipeId)!;
    const ids = [...new Set(target.requiredIngredients.map((r) => r.ingredientId))];
    ensureStock(ids);
    if (profile !== "NONE" && dexCount >= 1) buyRungs(target.id);
    ensureStock(ids);
    const before = discoveredRecipeIds(s.dex).length;
    bakeRaw(ids);
    if (discoveredRecipeIds(s.dex).length !== before + 1) throw new Error(`Dex ${dexCount}: ${target.id} was not discovered`);
    const ladder = buildHint5Ladder(target.id)!;
    stages.push({
      discovery: before + 1,
      recipe: target.id,
      pitzBefore: acc.pitzBefore,
      discoveryReward: creditOf(s),
      otherEarned: acc.otherEarned,
      hintSpend: acc.hintSpend,
      rungCharges: acc.rungCharges,
      rungsBought: acc.rungCharges.length,
      rungsTotal: ladder.rungs.length,
      reservedStop: acc.reservedStop,
      unlockSpend: acc.unlockSpend,
      refillSpend: acc.refillSpend,
      pitzAfter: s.pitzBalance,
      grindBakes: acc.grind,
      insufficientHintAttempts: acc.insufficient,
      minPitz: acc.minPitz,
    });
  }

  const sum = (f: (r: Hint5StageRecord) => number) => stages.reduce((a, r) => a + f(r), 0);
  return {
    profile,
    qualityTotal,
    stages,
    completed,
    totalHintSpend: sum((r) => r.hintSpend),
    totalUnlockSpend: sum((r) => r.unlockSpend),
    totalRefillSpend: sum((r) => r.refillSpend),
    totalDiscoveryEarned: sum((r) => r.discoveryReward),
    totalOtherEarned: sum((r) => r.otherEarned),
    minPitz,
    endingPitz: s.pitzBalance,
    grindBakes: sum((r) => r.grindBakes),
    insufficientHintAttempts: sum((r) => r.insufficientHintAttempts),
    reservedStops: stages.filter((r) => r.reservedStop).length,
  };
}
