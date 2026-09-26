/**
 * Discovery Hint Economy 1.0 Fresh Audit (docs/reports/TETO_DISCOVERY-HINT-ECONOMY-1_FRESH-AUDIT.md):
 * a deterministic fresh-save -> Dex 25 walk that prices Discovery Hint levels in Pitz.
 *
 * TEST-ONLY ANALYSIS HARNESS. No production module imports this file, and nothing here changes
 * production behaviour: hint purchases do not exist in the runtime yet, so the walk debits them from
 * `GameState.pitzBalance` itself (the only simulated transaction). Everything else goes through the
 * real reducer: START_FREE_COOK / CONFIRM_BAKE / REGISTER_TO_DEX (matcher, Dex, Discovery Ladder,
 * Pitz reward incl. the first-discovery bonus, inventory consumption) and PURCHASE_INGREDIENT /
 * RESTOCK_INGREDIENT (material Shop first pack / refill).
 *
 * It reuses the #229 Final Gate walk's shape (src/state/discoveryHint.walk.test.ts): open the Shop
 * when nothing is DISCOVERABLE, pick the hint target with the production `selectHintTarget`, read
 * hints with the production `buildHintSteps`, read the RESULT's near-miss line with the production
 * `resultNearMiss`, and bake until the real matcher reports NEW_DISCOVERY. The difference is that
 * the player here knows only what it bought (hint levels) plus what every player sees for free (the
 * Shop's newly stocked material, the near-miss line), and searches from there.
 *
 * Model assumptions (all documented in the report §6):
 * - Quality: every scored bake lands on `qualityTotal` (the reducer's own score is overridden before
 *   REGISTER_TO_DEX, so `applyPitzCredit` runs unchanged on that total). No Cooking Time bonus (no
 *   `now` is passed), i.e. conservative earnings.
 * - A pizza places `k` pieces of each topping (`materialK`, the Shop's own "one pack = 10 pizzas"
 *   unit) and one application of its sauce, so stock drains at the Shop's designed rate.
 * - A finite material is refilled right before a bake that needs more than its stock.
 * - The Shop's NEW materials are bought as soon as they unlock (a stage cannot start without them).
 * - When the Shop (pack or refill) is unaffordable, the player replays Margherita (starters only,
 *   zero material cost, the always-available income) until it is affordable; those bakes are counted
 *   as `grindBakes`, the soft-friction metric. Hints are never ground for: an unaffordable hint is
 *   recorded as an insufficient-Pitz attempt and skipped.
 * - Dex 0 (the Margherita onboarding) hints are free when `onboardingFree` is set (the proposal).
 */
import { getIngredient } from "../../data/ingredients";
import { getRecipe, RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { buildHintSteps, type HintStep } from "../discovery/hintSteps";
import { selectHintTarget } from "../discovery/hintTarget";
import { starsFromTotal } from "../scoring";
import { discoveredRecipeIds } from "../../state/dex";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../../state/gameReducer";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { resultNearMiss } from "../../state/resultNearMiss";

export type HintPrices = readonly [h1: number, h2: number, h3: number, h4: number];

export interface PriceCurve {
  id: string;
  prices: HintPrices;
}

export const HINT_PRICE_CURVES: readonly PriceCurve[] = [
  { id: "A", prices: [10, 20, 40, 80] },
  { id: "B", prices: [5, 10, 20, 40] },
  { id: "C", prices: [10, 20, 30, 50] },
  { id: "D", prices: [0, 10, 20, 40] },
];

/** Free baseline: the current production (Discovery Hint 2.0, every level free). */
export const FREE_CURVE: PriceCurve = { id: "FREE", prices: [0, 0, 0, 0] };

/**
 * P0 never buys. P1/P2/P4 buy up to H1/H2/H4 before the first bake. P3 bakes once blind, then buys
 * up to H3 on the first failure. P5 buys H1 up front and one more level after every failed bake.
 * L3 (analysis only, not a player profile of the task) buys up to H3 before the first bake, so
 * P0/P1/P2/L3/P4 give the experimental-bake cost of knowing exactly H0..H4.
 */
export type ProfileId = "P0" | "P1" | "P2" | "P3" | "P4" | "P5" | "L3";
export const PROFILES: readonly ProfileId[] = ["P0", "P1", "P2", "P3", "P4", "P5"];

export interface SimOptions {
  curve: PriceCurve;
  profile: ProfileId;
  /** The score every scored bake is registered with (0-100). */
  qualityTotal: number;
  /** Dex 0 Margherita onboarding hints cost nothing (default true). */
  onboardingFree?: boolean;
  /** Safety cap on experimental bakes per stage before the walk gives up on that stage. */
  maxBakesPerStage?: number;
}

export interface StageRecord {
  /** Dex count after this stage (1..25). */
  discovery: number;
  recipe: string;
  hintTarget: string;
  pitzBefore: number;
  /** earnedPitz + first-discovery bonus of the discovering bake. */
  discoveryReward: number;
  /** Pitz from other scored bakes this stage (ALREADY_DISCOVERED experiments, Margherita replays). */
  otherEarned: number;
  hintSpend: number;
  unlockSpend: number;
  refillSpend: number;
  pitzAfter: number;
  /** Highest hint level owned for the target when the discovery happened (0 = none). */
  hintLevel: number;
  /** Highest level the target offers (3 or 4; 3 when it has no H4 line). */
  maxHintLevel: number;
  experimentalBakes: number;
  grindBakes: number;
  stockConsumed: number;
  insufficientHintAttempts: number;
  minPitz: number;
  shop: string[];
  /** true when the stage needed Margherita replays to pay the Shop. */
  softBlocked: boolean;
  reason: string;
  searchExhausted: boolean;
}

export interface SimResult {
  curve: string;
  profile: ProfileId;
  qualityTotal: number;
  stages: StageRecord[];
  completed: boolean;
  totalHintSpend: number;
  totalUnlockSpend: number;
  totalRefillSpend: number;
  totalDiscoveryEarned: number;
  totalOtherEarned: number;
  totalEarned: number;
  minPitz: number;
  endingPitz: number;
  insufficientHintAttempts: number;
  experimentalBakes: number;
  grindBakes: number;
  softBlockedStages: number;
  hardDeadlock: boolean;
}

const MARGHERITA: readonly string[] = ["tomato-sauce", "mozzarella", "basil"];
const BAKE_VALUE = 68;

const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const isCheese = (id: string) => getIngredient(id)?.category === "cheese";
const isFiniteMaterial = (id: string) => !!getIngredient(id)?.unlockCondition;
/** k: the largest `minCount` any recipe asks of `id` -- the Shop's own pack unit (`materialK`), recomputed
 *  here so this harness stays outside the ladder/Shop layer's import boundary (discoveryLadder.test.ts).
 *  Prices are never re-derived: the harness reads them off the reducer's own balance change. */
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
      toppings.push({ id: `sim${n}`, ingredientId, x: 20 + ((n * 7) % 60), y: 30 + ((n * 11) % 40) });
      n += 1;
    }
  }
  return { ...createEmptyPizza(), sauceIds: ids.filter(isSauce).slice(0, 1), toppings, bakeResult: BAKE_VALUE };
}

/** What the revealed hint lines tell the player (read from the lines themselves). */
interface Knowledge {
  include: Set<string>;
  sauce: string | null;
  notTomato: boolean;
  count: number | null;
  cheese: boolean | null;
}

function knowledgeOf(steps: readonly HintStep[]): Knowledge {
  const k: Knowledge = { include: new Set(), sauce: null, notTomato: false, count: null, cheese: null };
  for (const step of steps) {
    if (step.namedIngredientId) {
      if (isSauce(step.namedIngredientId)) k.sauce = step.namedIngredientId;
      else k.include.add(step.namedIngredientId);
    } else if (step.axis === "SAUCE") {
      k.notTomato = true;
    } else if (step.axis === "COUNT_CHEESE") {
      const m = /全部で(\d+)種類/.exec(step.textJa);
      k.count = m ? Number(m[1]) : null;
      k.cheese = !step.textJa.includes("チーズは使わない");
    }
  }
  return k;
}

type Feedback = { score: number; kind: string };

function feedbackOf(s: GameState): Feedback {
  const line = resultNearMiss(s);
  if (!line) return { score: 3, kind: s.lastDiscovery?.kind === "ALREADY_DISCOVERED" ? "KNOWN" : "NONE" };
  if (line.kind === "CLOSE") return { score: 2, kind: "CLOSE" };
  if (line.kind === "FAR") return { score: 3, kind: "FAR_KEY_UNUSED" };
  return { score: 1, kind: line.kind };
}

const keyOf = (ids: readonly string[]) => [...ids].sort().join("+");

export function simulateHintEconomy(options: SimOptions): SimResult {
  const { curve, profile, qualityTotal } = options;
  const onboardingFree = options.onboardingFree ?? true;
  const maxBakes = options.maxBakesPerStage ?? 80;

  let s = createInitialGameState(undefined, undefined, 0);
  let minPitz = s.pitzBalance;
  const purchased = new Map<string, number>();
  const stages: StageRecord[] = [];
  let completed = false;

  // Per-stage accumulators, reset at each stage start.
  let acc = newAcc(0);
  function newAcc(pitzBefore: number) {
    return { pitzBefore, otherEarned: 0, hintSpend: 0, unlockSpend: 0, refillSpend: 0, experimental: 0, grind: 0, stock: 0, insufficient: 0, minPitz: pitzBefore, shop: [] as string[], refused: new Set<number>() };
  }
  const track = () => {
    minPitz = Math.min(minPitz, s.pitzBalance);
    acc.minPitz = Math.min(acc.minPitz, s.pitzBalance);
  };

  /** One Free Cooking round with `ids`; returns the RESULT->DISCOVERED state. */
  function bakeRaw(ids: readonly string[]): GameState {
    const before = s.inventory;
    s = { ...act(s, { type: "START_FREE_COOK" }), pizza: pizzaOf(ids) };
    s = act(s, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: BAKE_VALUE });
    for (let i = 0; i < 6 && s.phase !== "RESULT"; i += 1) s = act(s, { type: "CONFIRM_MAKING_STEP" });
    if (s.phase !== "RESULT") throw new Error(`bake did not reach RESULT (${ids.join("+")})`);
    if (s.score) s = { ...s, score: { ...s.score, total: qualityTotal, stars: starsFromTotal(qualityTotal) } };
    s = act(s, { type: "REGISTER_TO_DEX" });
    for (const id of Object.keys(before)) acc.stock += Math.max(0, (before[id] ?? 0) - (s.inventory[id] ?? 0));
    track();
    return s;
  }

  function creditOf(state: GameState): number {
    const c = state.lastPitzCredit;
    return c ? c.earnedPitz + c.discoveryBonusPitz + (state.lastEfficiencyCredit?.bonusPitz ?? 0) : 0;
  }

  /** Margherita replays until `price` is affordable (the zero-cost income). */
  function grindTo(price: number) {
    let guard = 0;
    while (s.pitzBalance < price) {
      if (discoveredRecipeIds(s.dex).length === 0 || guard++ > 200) throw new Error("hard deadlock: no income source");
      bakeRaw(MARGHERITA);
      acc.grind += 1;
      acc.otherEarned += creditOf(s);
    }
  }

  /** One Shop transaction through the reducer. Unaffordable -> the reducer leaves the state as it is;
   *  the player then replays Margherita once and tries again. Returns the Pitz actually charged. */
  function shop(action: GameAction): number {
    for (let guard = 0; guard < 200; guard += 1) {
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

  function buyPack(id: string) {
    acc.unlockSpend += shop({ type: "PURCHASE_INGREDIENT", ingredientId: id });
    acc.shop.push(id);
  }

  function ensureStock(ids: readonly string[]) {
    for (const id of ids) {
      if (!isFiniteMaterial(id)) continue;
      while ((s.inventory[id] ?? 0) < piecesOf(id)) acc.refillSpend += shop({ type: "RESTOCK_INGREDIENT", ingredientId: id });
    }
  }

  const maxLevelOf = (steps: readonly HintStep[]) => Math.max(...steps.map((x) => x.level));

  /** Buys levels up to `want` (capped at the target's own max), one at a time, only when affordable. */
  function buyUpTo(target: Recipe, want: number, dexCount: number) {
    const steps = buildHintSteps(target, { discoveredCount: dexCount });
    const cap = Math.min(want, maxLevelOf(steps));
    let owned = purchased.get(target.id) ?? 0;
    while (owned < cap) {
      const level = owned + 1;
      const free = onboardingFree && dexCount === 0;
      const price = free ? 0 : curve.prices[level - 1];
      if (s.pitzBalance < price) {
        // Counted once per level per stage: the CTA stays disabled until the balance changes.
        if (!acc.refused.has(level)) acc.insufficient += 1;
        acc.refused.add(level);
        return;
      }
      s = { ...s, pitzBalance: s.pitzBalance - price };
      acc.hintSpend += price;
      owned = level;
      purchased.set(target.id, owned);
      track();
    }
  }

  function knowledgeFor(target: Recipe, dexCount: number): Knowledge {
    const level = purchased.get(target.id) ?? 0;
    return knowledgeOf(buildHintSteps(target, { discoveredCount: dexCount }).filter((x) => x.level <= level));
  }

  for (let stageGuard = 0; stageGuard < 40; stageGuard += 1) {
    const dexCount = discoveredRecipeIds(s.dex).length;
    if (dexCount === 25) {
      completed = true;
      break;
    }
    acc = newAcc(s.pitzBalance);

    // Shop: every NEW material, as soon as it unlocks.
    const newMaterials = s.unlockedForShopIngredientIds.filter((id) => !s.ownedIngredientIds.includes(id));
    for (const id of newMaterials) buyPack(id);
    // Stock the owned finite materials enough that every DISCOVERABLE recipe is visible.
    ensureStock(s.ownedIngredientIds.filter((id) => isFiniteMaterial(id) && (s.inventory[id] ?? 0) < 1));

    const t = selectHintTarget(s);
    if (t.kind !== "TARGET") throw new Error(`Dex ${dexCount}: no hint target (${t.kind})`);
    const target = getRecipe(t.recipeId as RecipeId)!;
    const targetMax = maxLevelOf(buildHintSteps(target, { discoveredCount: dexCount }));

    // Up-front purchases.
    const upfront = { P0: 0, P1: 1, P2: 2, P3: 0, P4: 4, P5: 1, L3: 3 }[profile];
    if (upfront > 0) buyUpTo(target, upfront, dexCount);

    // Search. The player knows the materials it just bought (the Shop's NEW notice) and newest-first
    // owned order; everything else comes from bought hints and the near-miss line.
    const ownedNewestFirst = () => [...s.ownedIngredientIds].reverse();
    const tried = new Set<string>();
    let k = knowledgeFor(target, dexCount);

    const satisfies = (ids: readonly string[], know: Knowledge) => {
      const sauces = ids.filter(isSauce);
      if (sauces.length > 1) return false;
      for (const inc of know.include) if (!ids.includes(inc)) return false;
      if (know.sauce && sauces[0] !== know.sauce) return false;
      if (know.notTomato && sauces[0] === "tomato-sauce") return false;
      if (know.cheese === false && ids.some(isCheese)) return false;
      if (know.cheese === true && !ids.some(isCheese)) return false;
      if (know.count !== null && ids.length > know.count) return false;
      return true;
    };

    const initialGuess = (know: Knowledge): string[] => {
      const newSauce = acc.shop.find(isSauce);
      const sauce =
        know.sauce ??
        (newSauce && !(know.notTomato && newSauce === "tomato-sauce") ? newSauce : null) ??
        (know.notTomato ? ownedNewestFirst().find((id) => isSauce(id) && id !== "tomato-sauce") ?? null : "tomato-sauce");
      const set = new Set<string>(know.include);
      for (const id of acc.shop) if (!isSauce(id)) set.add(id);
      if (know.cheese !== false && ![...set].some(isCheese)) set.add("mozzarella");
      let ids = [...(sauce ? [sauce] : []), ...set];
      if (know.cheese === false) ids = ids.filter((id) => !isCheese(id));
      while (know.count !== null && ids.length > know.count) {
        const drop = [...ids].reverse().find((id) => !know.include.has(id) && id !== know.sauce && !isSauce(id));
        if (!drop) break;
        ids = ids.filter((id) => id !== drop);
      }
      return ids;
    };

    /** Single-change neighbours of `base`, in the order a player would try them. */
    const neighbours = (base: readonly string[], kind: string, know: Knowledge): string[][] => {
      const toppings = ownedNewestFirst().filter((id) => !isSauce(id));
      const sauces = ownedNewestFirst().filter(isSauce);
      const adds = toppings.filter((id) => !base.includes(id)).map((id) => [...base, id]);
      const removes = base.filter((id) => !isSauce(id)).map((id) => base.filter((x) => x !== id));
      const current = base.find(isSauce);
      const swaps = sauces.filter((id) => id !== current).map((id) => [id, ...base.filter((x) => !isSauce(x))]);
      const noSauce = current ? [base.filter((x) => !isSauce(x))] : [];
      let list: string[][];
      if (kind === "ADD_ONE") list = adds;
      else if (kind === "REMOVE_ONE") list = removes;
      else if (kind === "SAUCE_ONLY") list = [...swaps, ...noSauce];
      else {
        const replace: string[][] = [];
        for (const r of base.filter((id) => !isSauce(id) && !know.include.has(id))) {
          for (const a of toppings.filter((id) => !base.includes(id))) replace.push([...base.filter((x) => x !== r), a]);
        }
        list = [...adds, ...removes, ...swaps, ...replace];
      }
      return list.filter((ids) => satisfies(ids, know) && !tried.has(keyOf(ids)));
    };

    let best: { ids: string[]; fb: Feedback } | null = null;
    let queue: string[][] = [initialGuess(k)];
    let discovered = false;
    let failures = 0;
    let exhausted = false;
    let discoveryReward = 0;

    while (!discovered) {
      if (acc.experimental >= maxBakes) {
        exhausted = true;
        break;
      }
      const next = queue.shift();
      if (!next) {
        // No untried neighbour left from the best pizza: widen to any untried neighbour of it.
        const widened = best ? neighbours(best.ids, "CLOSE", k) : [];
        if (widened.length === 0) {
          exhausted = true;
          break;
        }
        queue = widened;
        continue;
      }
      if (tried.has(keyOf(next))) continue;
      tried.add(keyOf(next));
      ensureStock(next);
      bakeRaw(next);
      acc.experimental += 1;
      if (s.lastDiscovery?.kind === "NEW_DISCOVERY") {
        discovered = true;
        discoveryReward = creditOf(s);
        break;
      }
      acc.otherEarned += creditOf(s);
      const fb = feedbackOf(s);
      failures += 1;

      // Level-by-level buyers react to the failure.
      const before = purchased.get(target.id) ?? 0;
      if (profile === "P3" && failures === 1) buyUpTo(target, 3, dexCount);
      if (profile === "P5") buyUpTo(target, before + 1, dexCount);
      if ((purchased.get(target.id) ?? 0) !== before) {
        k = knowledgeFor(target, dexCount);
        const guess = initialGuess(k);
        best = null;
        queue = tried.has(keyOf(guess)) ? [] : [guess];
        if (queue.length === 0) {
          // The guess is already baked: continue from it with the new constraints.
          best = { ids: guess, fb };
          queue = neighbours(guess, fb.kind, k);
        }
        continue;
      }

      if (!best || fb.score < best.fb.score) {
        best = { ids: next, fb };
        queue = neighbours(next, fb.kind, k);
      }
    }

    if (!discovered) {
      // The search model gave up: bake the answer (counted as an exhausted stage, not a deadlock).
      const answer = [...new Set(target.requiredIngredients.map((r) => r.ingredientId))];
      ensureStock(answer);
      bakeRaw(answer);
      acc.experimental += 1;
      discoveryReward = creditOf(s);
    }

    const found = s.lastDiscovery?.kind === "NEW_DISCOVERY" ? s.lastDiscovery.recipeId : "?";
    stages.push({
      discovery: discoveredRecipeIds(s.dex).length,
      recipe: found,
      hintTarget: target.id,
      pitzBefore: acc.pitzBefore,
      discoveryReward,
      otherEarned: acc.otherEarned,
      hintSpend: acc.hintSpend,
      unlockSpend: acc.unlockSpend,
      refillSpend: acc.refillSpend,
      pitzAfter: s.pitzBalance,
      hintLevel: purchased.get(target.id) ?? 0,
      maxHintLevel: targetMax,
      experimentalBakes: acc.experimental,
      grindBakes: acc.grind,
      stockConsumed: acc.stock,
      insufficientHintAttempts: acc.insufficient,
      minPitz: acc.minPitz,
      shop: acc.shop,
      softBlocked: acc.grind > 0,
      reason:
        acc.grind > 0
          ? `Shop needed ${acc.grind} Margherita replay(s)`
          : acc.insufficient > 0
            ? "hint unaffordable (skipped)"
            : "ok",
      searchExhausted: exhausted,
    });
  }

  const sum = (f: (r: StageRecord) => number) => stages.reduce((a, r) => a + f(r), 0);
  const totalDiscoveryEarned = sum((r) => r.discoveryReward);
  const totalOtherEarned = sum((r) => r.otherEarned);
  return {
    curve: curve.id,
    profile,
    qualityTotal,
    stages,
    completed,
    totalHintSpend: sum((r) => r.hintSpend),
    totalUnlockSpend: sum((r) => r.unlockSpend),
    totalRefillSpend: sum((r) => r.refillSpend),
    totalDiscoveryEarned,
    totalOtherEarned,
    totalEarned: totalDiscoveryEarned + totalOtherEarned,
    minPitz,
    endingPitz: s.pitzBalance,
    insufficientHintAttempts: sum((r) => r.insufficientHintAttempts),
    experimentalBakes: sum((r) => r.experimentalBakes),
    grindBakes: sum((r) => r.grindBakes),
    softBlockedStages: stages.filter((r) => r.softBlocked).length,
    hardDeadlock: !completed,
  };
}
