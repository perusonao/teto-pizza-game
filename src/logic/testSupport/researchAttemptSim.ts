/**
 * Contract 2.1 Production Activation Gate C: an attempt-aware fresh-save -> Dex 27 walk.
 *
 * TEST-ONLY ANALYSIS HARNESS. No production module imports this file; nothing here changes runtime behaviour.
 * The caller must run with the Hint 5.0 flag ON (vi.mock of ../discovery/hint5Flag, as hint5EconomySim) and
 * `RESEARCH_IDENTIFY_ENABLED` ON (true in every Vitest run: DEV build).
 *
 * Reused production authorities (all through the REAL reducer / pure modules, nothing re-implemented):
 * - START_FREE_COOK{researchTargetId} / START_BAKE / CONFIRM_BAKE / REGISTER_TO_DEX: matcher, Dex, Research Target
 *   validity snapshot, `researchResultRows` (○ / × / known exclusion / K = 3), `ing:` persistence, Notebook line,
 *   Discovery Ladder, Pitz reward, inventory consumption;
 * - PURCHASE_INGREDIENT / RESTOCK_INGREDIENT: the material Shop; PURCHASE_HINT5_RUNG: Hint 5.0 ladder (real prices);
 * - `researchableEntryIds` / `researchEntryViews`: the player-visible Research Entries and their known ingredients.
 *
 * The simulated player sees only what the game shows: owned ingredients (tray), the Research Entry's known
 * ingredients (unlock fact + stored `ing:`), the RESULT's × rows (remembered for the stage's target), and the
 * Hint 5.0 completion records it bought. It never reads a recipe's ingredient list to choose a pizza. (The recipe
 * is read only by the invariant checks, as an oracle.)
 *
 * STRATEGY (deterministic; see `chooseAttempt`):
 *  target: the first researchable Research Entry in the game's own anonymous order, kept until the stage ends
 *  (a Dex gain, from the target or from a cross-recipe exact match).
 *  each attempt: every known-positive ingredient (the pizza must contain them) +
 *    sauce: the known sauce, else the next owned sauce that is not a remembered ×  (one sauce per pizza)
 *    cheese: every owned cheese that is neither known nor ×  (all at once, no cap) unless the cheese rung is settled
 *    topping: the first min(3, unknown) owned toppings that are neither known nor × (K = 3)
 *  "tray order" = the order of `ownedIngredientIds` (acquisition order); `orderSeed > 0` replaces it by a seeded
 *  permutation per stage (sensitivity runs). Never place a remembered ×.
 *  final build: once nothing is unknown (or STRUCTURE's total equals the known-positive count) the pizza is exactly the
 *  known-positive set.
 * Quantity: every topping is placed `piecesOf(id)` times (the Shop's pack unit, as the Hint 5.0 harness), so quantity
 * is never the bottleneck (optimistic) and stock drains at the Shop's designed rate.
 * Shop / Pitz: new materials are bought as soon as they unlock; a refill is bought just before an attempt that needs
 * stock, and when the target is not researchable for lack of stock (the player-visible "REFILL" state). An unaffordable
 * Shop purchase is paid by Margherita replays (zero-cost income = `grindBakes`). A hint is never ground for: an
 * unaffordable rung is skipped.
 */
import { getIngredient } from "../../data/ingredients";
import { getRecipe, RECIPES, type RecipeId } from "../../data/recipes";
import { starsFromTotal } from "../scoring";
import { discoveredRecipeIds } from "../../state/dex";
import { hint5SheetView, researchEntryViews, researchableEntryIds } from "../../state/discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../../state/gameReducer";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { notebookView } from "../discovery/trialNotebook";

/** NONE buys nothing; RUNG1..RUNG3 buy the first n ladder rungs (SAUCE, CHEESE, KEY_TOPPING) of every target before its
 *  first attempt; FIXED4 buys rungs 1-4 (+ STRUCTURE); FULL buys every rung. NONE / FIXED4 / FULL are the Hint 5.0
 *  harness's own profiles. */
export type ResearchHintProfile = "NONE" | "RUNG1" | "RUNG2" | "RUNG3" | "FIXED4" | "FULL";
export const RESEARCH_HINT_PROFILES: readonly ResearchHintProfile[] = ["NONE", "RUNG1", "RUNG2", "RUNG3", "FIXED4", "FULL"];
const RUNG_LIMIT: Record<ResearchHintProfile, number> = { NONE: 0, RUNG1: 1, RUNG2: 2, RUNG3: 3, FIXED4: 4, FULL: 99 };

export interface ResearchSimOptions {
  profile: ResearchHintProfile;
  /** Every scored bake is registered with this total (0-100), as the Hint 5.0 harness (80 = ★4, 65 = ★3, 30 = ★1). */
  qualityTotal: number;
  /** 0 = tray (acquisition) order; > 0 = a seeded per-stage permutation of the unknown candidates. */
  orderSeed?: number;
  /** Pieces placed of each UNKNOWN (judged) topping: "FULL" = the Shop's pack unit (conservative stock drain, default);
   *  "ONE" = a single piece, enough for a membership row (optimistic stock drain). Known / final-build toppings are
   *  always placed at the full unit. */
  explorePieces?: "FULL" | "ONE";
  /** ANALYSIS-ONLY lower bound: the player is told the target's ingredient total for free (what STRUCTURE sells), so it
   *  stops as soon as every member is found. Reads the recipe as an oracle; never a player model of the shipped game. */
  freeTotal?: boolean;
  /** ANALYSIS-ONLY counterfactual (the Fresh Authority Audit of the ★3-FULL replay criterion): credit the Pitz of that
   *  spending class straight back, to isolate how many Margherita replays each class causes. It is a harness ablation,
   *  never a proposed economy: with any refund on, Pitz / min-Pitz figures are meaningless, only `grindBakes` is read. */
  refund?: { refill?: boolean; hints?: boolean; unlock?: boolean };
}

export interface ResearchStage {
  /** Dex count after this stage. */
  discovery: number;
  /** The recipe(s) newly discovered by the stage's last attempt (a cross-recipe exact match may differ from target). */
  discovered: string[];
  target: string | null;
  /** The discovered recipe is the Research Target (false = cross-recipe discovery). */
  targetDiscovered: boolean;
  onboarding: boolean;
  /** Research attempts (bakes through REGISTER_TO_DEX with the stage's target), the discovering bake included. */
  attempts: number;
  /** Attempts that disclosed at least one ○ / × row. */
  attemptsWithRows: number;
  /** Owned ingredient pool at stage start, by category (sauce / cheese / topping), minus the target's known ones. */
  poolUnknown: { sauce: number; cheese: number; topping: number };
  ladderStepCount: number;
  hintSpend: number;
  rungsBought: number;
  refillCount: number;
  refillSpend: number;
  /** Refill Pitz spent on ingredients that ARE / are NOT in the stage target's recipe (test oracle; analysis only). */
  refillMemberSpend: number;
  refillNonMemberSpend: number;
  /** Pitz earned by this stage's Margherita replays. */
  grindEarned: number;
  unlockSpend: number;
  stockoutRefills: number;
  grindBakes: number;
  pitzBefore: number;
  pitzAfter: number;
  minPitz: number;
  discoveryReward: number;
  insufficientHintAttempts: number;
  reservedStop: boolean;
}

export interface ResearchSimResult {
  profile: ResearchHintProfile;
  qualityTotal: number;
  orderSeed: number;
  explorePieces: "FULL" | "ONE";
  freeTotal: boolean;
  stages: ResearchStage[];
  completed: boolean;
  totalAttempts: number;
  minPitz: number;
  endingPitz: number;
  grindBakes: number;
  reservedStops: number;
  insufficientHintAttempts: number;
  refillCount: number;
  stockoutRefills: number;
  /** Contract invariant violations observed on every attempt (must be empty). */
  violations: string[];
  /** Final reducer state (for save / schema checks). */
  finalState: GameState;
}

const MARGHERITA: readonly string[] = ["tomato-sauce", "mozzarella", "basil"];
const BAKE_VALUE = 68;
const cat = (id: string) => getIngredient(id)?.category;
const isFiniteMaterial = (id: string) => !!getIngredient(id)?.unlockCondition;

function kOf(id: string): number {
  let k = 1;
  for (const r of RECIPES) for (const q of r.requiredIngredients) if (q.ingredientId === id) k = Math.max(k, q.minCount);
  return k;
}
const piecesOf = (id: string) => (cat(id) === "sauce" ? 1 : kOf(id));
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);

function pizzaOf(ids: readonly string[], singles: ReadonlySet<string> = new Set()): PizzaState {
  const toppings: PizzaState["toppings"] = [];
  let n = 0;
  for (const ingredientId of ids.filter((id) => cat(id) !== "sauce")) {
    for (let i = 0; i < (singles.has(ingredientId) ? 1 : piecesOf(ingredientId)); i += 1) {
      toppings.push({ id: `ras${n}`, ingredientId, x: 20 + ((n * 7) % 60), y: 30 + ((n * 11) % 40) });
      n += 1;
    }
  }
  return { ...createEmptyPizza(), sauceIds: ids.filter((id) => cat(id) === "sauce").slice(0, 1), toppings, bakeResult: BAKE_VALUE };
}

/** A small deterministic PRNG (mulberry32) for the seeded tray orders. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededOrder<T>(items: readonly T[], seed: number, salt: number): T[] {
  const out = [...items];
  if (seed <= 0) return out;
  const r = rng(seed * 100003 + salt * 7919);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Knowledge {
  positive: string[];
  negative: Set<string>;
  cheeseSettled: boolean;
  total: number | null;
}

export interface AttemptPlan {
  ids: string[];
  /** The unknown (judged) ingredients among `ids`. */
  unknownIds: string[];
  /** Number of unknown (judgeable) ingredients in the pizza. */
  unknownTested: number;
  final: boolean;
}

/** The pure, deterministic attempt chooser (exported for the strategy unit test). */
export function chooseAttempt(
  owned: readonly string[],
  k: Knowledge,
  opts: { orderSeed: number; salt: number; toppingCap: number },
): AttemptPlan {
  const pos = new Set(k.positive);
  const seen = (id: string) => pos.has(id) || k.negative.has(id);
  const ordered = (cat_: string) => seededOrder(owned.filter((id) => cat(id) === cat_ && !seen(id)), opts.orderSeed, opts.salt + cat_.length);
  const knownSauce = k.positive.find((id) => cat(id) === "sauce");
  const unknownSauces = knownSauce ? [] : ordered("sauce");
  const unknownCheeses = k.cheeseSettled ? [] : ordered("cheese");
  const unknownToppings = ordered("topping");
  const totalKnownEnough = k.total !== null && k.positive.length >= k.total;
  const hasUnknown = unknownSauces.length + unknownCheeses.length + unknownToppings.length > 0;
  if (!hasUnknown || totalKnownEnough) return { ids: [...k.positive], unknownIds: [], unknownTested: 0, final: true };
  const ids = [...k.positive];
  if (unknownSauces.length > 0) ids.push(unknownSauces[0]);
  ids.push(...unknownCheeses);
  ids.push(...unknownToppings.slice(0, opts.toppingCap));
  const unknownIds = ids.slice(k.positive.length);
  return { ids, unknownIds, unknownTested: unknownIds.length, final: false };
}

export function simulateResearchAttempts(options: ResearchSimOptions): ResearchSimResult {
  const { profile, qualityTotal } = options;
  const orderSeed = options.orderSeed ?? 0;
  const explorePieces = options.explorePieces ?? "FULL";
  let s = createInitialGameState(undefined, undefined, 0);
  let minPitz = s.pitzBalance;
  const stages: ResearchStage[] = [];
  const violations: string[] = [];
  let completed = false;
  let totalAttempts = 0;

  const newAcc = (pitzBefore: number) => ({
    pitzBefore,
    attempts: 0,
    attemptsWithRows: 0,
    hintSpend: 0,
    rungs: 0,
    insufficient: 0,
    reservedStop: false,
    refillCount: 0,
    refillSpend: 0,
    refillMemberSpend: 0,
    refillNonMemberSpend: 0,
    grindEarned: 0,
    stockoutRefills: 0,
    unlockSpend: 0,
    grind: 0,
    minPitz: pitzBefore,
    reward: 0,
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

  function finishBake(ids: readonly string[], singles: ReadonlySet<string> = new Set()) {
    s = { ...s, pizza: pizzaOf(ids, singles) };
    s = act(s, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: BAKE_VALUE });
    for (let i = 0; i < 6 && s.phase !== "RESULT"; i += 1) s = act(s, { type: "CONFIRM_MAKING_STEP" });
    if (s.phase !== "RESULT") throw new Error(`bake did not reach RESULT (${ids.join("+")})`);
    if (s.score) s = { ...s, score: { ...s.score, total: qualityTotal, stars: starsFromTotal(qualityTotal) } };
    s = act(s, { type: "REGISTER_TO_DEX" });
    track();
  }

  function grindTo(price: number) {
    let guard = 0;
    while (s.pitzBalance < price) {
      if (discoveredRecipeIds(s.dex).length === 0 || guard++ > 400) throw new Error("hard deadlock: no income source");
      s = act(s, { type: "START_FREE_COOK" });
      finishBake(MARGHERITA);
      acc.grind += 1;
      acc.reward += creditOf(s);
      acc.grindEarned += creditOf(s);
    }
  }

  function shop(action: GameAction): number {
    for (let guard = 0; guard < 400; guard += 1) {
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

  let targetMembers: ReadonlySet<string> = new Set();
  function refill(id: string, stockout: boolean) {
    const charge = shop({ type: "RESTOCK_INGREDIENT", ingredientId: id });
    if (options.refund?.refill) s = { ...s, pitzBalance: s.pitzBalance + charge };
    acc.refillSpend += charge;
    // Test oracle only: was the refilled ingredient part of the stage target's recipe?
    if (targetMembers.has(id)) acc.refillMemberSpend += charge;
    else acc.refillNonMemberSpend += charge;
    acc.refillCount += 1;
    if (stockout) acc.stockoutRefills += 1;
  }
  function ensureStock(ids: readonly string[], singles: ReadonlySet<string> = new Set()) {
    for (const id of ids) {
      if (!isFiniteMaterial(id)) continue;
      while ((s.inventory[id] ?? 0) < (singles.has(id) ? 1 : piecesOf(id))) refill(id, false);
    }
  }

  /** START_FREE_COOK with the target; when it is not researchable for lack of stock (the player-visible REFILL state)
   *  the empty finite materials are refilled first. */
  function startValid(target: string) {
    s = act(s, { type: "START_FREE_COOK", researchTargetId: target });
    if (s.researchTargetValidAtStart) return;
    for (let i = 0; i < 40 && !researchableEntryIds(s).includes(target); i += 1) {
      const empty = s.ownedIngredientIds.find((x) => isFiniteMaterial(x) && (s.inventory[x] ?? 0) < 1);
      if (!empty) throw new Error(`target ${target} invalid with no empty material`);
      refill(empty, true);
    }
    s = act(s, { type: "START_FREE_COOK", researchTargetId: target });
    if (!s.researchTargetValidAtStart) throw new Error(`target ${target} still invalid after refill`);
  }

  const knowledgeOf = (target: string, negative: Set<string>): Knowledge => {
    const view = researchEntryViews(s).find((v) => v.recipeId === target);
    const facts = Object.prototype.hasOwnProperty.call(s.discoveryHintFacts, target) ? s.discoveryHintFacts[target] : [];
    return {
      positive: [...(view?.knownExactIngredientIds ?? [])],
      negative,
      cheeseSettled: facts.includes("h5:cheese"),
      total: options.freeTotal ? new Set(getRecipe(target as RecipeId)!.requiredIngredients.map((r) => r.ingredientId)).size : (view?.totalIngredientCount ?? null),
    };
  };

  function buyRungs(targetId: string) {
    s = act(s, { type: "SHOW_HINT" });
    if (s.hintSession?.targetId !== targetId) throw new Error(`sheet target ${s.hintSession?.targetId} != ${targetId}`);
    for (let guard = 0; guard < 20; guard += 1) {
      const view = hint5SheetView(s, true);
      if (!view || !view.next) break;
      if (view.next.rungIndex > RUNG_LIMIT[profile]) break;
      if (!view.next.affordable) {
        acc.insufficient += 1;
        break;
      }
      const before = s;
      s = act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: view.next.rungIndex });
      if (s === before) {
        acc.reservedStop = true;
        break;
      }
      acc.hintSpend += before.pitzBalance - s.pitzBalance;
      if (options.refund?.hints) s = { ...s, pitzBalance: s.pitzBalance + (before.pitzBalance - s.pitzBalance) };
      acc.rungs += 1;
      track();
    }
    s = act(s, { type: "CLOSE_HINT" });
  }

  /** Contract invariants on one finished research attempt; the recipe is read here as a TEST ORACLE only. */
  function checkInvariants(target: string, placed: readonly string[], factsBefore: readonly string[], knownBefore: readonly string[]) {
    const tag = `${target}#${totalAttempts}`;
    const lr = s.lastResearchRows;
    const members = new Set(getRecipe(target as RecipeId)!.requiredIngredients.map((r) => r.ingredientId));
    const factsAfter = s.discoveryHintFacts[target] ?? [];
    const added = factsAfter.filter((f) => !factsBefore.includes(f));
    if (!lr) {
      // No panel (a cross-recipe match, or nothing disclosed): nothing may have been stored by the attempt.
      if (added.some((f) => f.startsWith("ing:"))) violations.push(`${tag}: ing: stored without a panel`);
      return;
    }
    const usedSet = new Set(placed);
    const positives = lr.rows.filter((r) => r.verdict === "POSITIVE").map((r) => r.ingredientId);
    const toppingRows = lr.rows.filter((r) => r.category === "topping");
    if (toppingRows.length > 3) violations.push(`${tag}: ${toppingRows.length} topping rows (> K=3)`);
    if (lr.toppingOverCap && toppingRows.length > 0) violations.push(`${tag}: over-cap with topping rows`);
    for (const r of lr.rows) {
      if (!usedSet.has(r.ingredientId)) violations.push(`${tag}: row for an unplaced ingredient ${r.ingredientId}`);
      if (knownBefore.includes(r.ingredientId)) violations.push(`${tag}: row for a known ingredient ${r.ingredientId}`);
      if ((r.verdict === "POSITIVE") !== members.has(r.ingredientId)) violations.push(`${tag}: verdict disagrees with membership (${r.ingredientId})`);
    }
    const addedIng = added.filter((f) => f.startsWith("ing:")).map((f) => f.slice(4));
    if (JSON.stringify([...addedIng].sort()) !== JSON.stringify([...positives].sort())) violations.push(`${tag}: persisted ing: != disclosed positives`);
    if (added.some((f) => !f.startsWith("ing:"))) violations.push(`${tag}: a non-ing fact was added by an attempt (${added.join(",")})`);
    for (const id of factsAfter.filter((f) => f.startsWith("ing:")).map((f) => f.slice(4))) {
      if (!members.has(id)) violations.push(`${tag}: a negative ingredient is stored (${id})`);
    }
    const fb = notebookView(s.trialNotebook)[0]?.feedback ?? null;
    const text = fb?.textJa ?? "";
    if (/なし|ない|ゼロ|全部|あと/.test(text)) violations.push(`${tag}: forbidden wording in Notebook line: ${text}`);
    if (lr.rows.length > 0 && (!fb || fb.kind !== "RESEARCH_ROWS")) violations.push(`${tag}: rows without a Notebook line`);
    if (lr.rows.length === 0 && fb && fb.kind === "RESEARCH_ROWS") violations.push(`${tag}: Notebook line without rows`);
    if (JSON.stringify(s.discoveryHintFacts).includes("×")) violations.push(`${tag}: × in the save ledger`);
  }

  for (let stageGuard = 0; stageGuard < 80; stageGuard += 1) {
    const dexIds = discoveredRecipeIds(s.dex);
    if (dexIds.length === RECIPES.length) {
      completed = true;
      break;
    }
    acc = newAcc(s.pitzBalance);
    const ladderStepCount = dexIds.length;

    // Dex 0: the Margherita onboarding (guided by the game, starters only, no research target).
    if (dexIds.length === 0) {
      s = act(s, { type: "START_FREE_COOK" });
      finishBake(MARGHERITA);
      if (discoveredRecipeIds(s.dex).length !== 1) throw new Error("margherita onboarding was not discovered");
      acc.reward = creditOf(s);
      stages.push({
        discovery: 1,
        discovered: ["margherita"],
        target: null,
        targetDiscovered: false,
        onboarding: true,
        attempts: 1,
        attemptsWithRows: 0,
        poolUnknown: { sauce: 0, cheese: 0, topping: 0 },
        ladderStepCount: 0,
        hintSpend: 0,
        rungsBought: 0,
        refillCount: 0,
        refillSpend: 0,
        refillMemberSpend: 0,
        refillNonMemberSpend: 0,
        grindEarned: 0,
        unlockSpend: 0,
        stockoutRefills: 0,
        grindBakes: 0,
        pitzBefore: acc.pitzBefore,
        pitzAfter: s.pitzBalance,
        minPitz: acc.minPitz,
        discoveryReward: acc.reward,
        insufficientHintAttempts: 0,
        reservedStop: false,
      });
      continue;
    }

    // New materials are bought as soon as they unlock; every owned finite material with no stock is refilled.
    for (const id of s.unlockedForShopIngredientIds.filter((x) => !s.ownedIngredientIds.includes(x))) {
      const charge = shop({ type: "PURCHASE_INGREDIENT", ingredientId: id });
      if (options.refund?.unlock) s = { ...s, pitzBalance: s.pitzBalance + charge };
      acc.unlockSpend += charge;
    }
    for (const id of s.ownedIngredientIds.filter((x) => isFiniteMaterial(x) && (s.inventory[x] ?? 0) < 1)) refill(id, false);

    const entries = researchableEntryIds(s);
    if (entries.length === 0) throw new Error(`Dex ${dexIds.length}: no researchable entry`);
    const target = entries[0];
    targetMembers = new Set(getRecipe(target as RecipeId)!.requiredIngredients.map((r) => r.ingredientId));
    const known0 = knowledgeOf(target, new Set());
    const pool = (c: string) => s.ownedIngredientIds.filter((id) => cat(id) === c && !known0.positive.includes(id)).length;
    const poolUnknown = { sauce: pool("sauce"), cheese: pool("cheese"), topping: pool("topping") };
    const negative = new Set<string>();
    let noInfo = 0;
    let discoveredNow: string[] = [];
    let hintsDone = false;

    for (let attemptGuard = 0; attemptGuard < 120; attemptGuard += 1) {
      startValid(target);
      if (!hintsDone && profile !== "NONE" && dexIds.length >= 1) buyRungs(target);
      hintsDone = true;
      const plan = chooseAttempt(s.ownedIngredientIds, knowledgeOf(target, negative), {
        orderSeed,
        salt: stageGuard,
        toppingCap: Math.max(1, 3 - noInfo),
      });
      const singles = new Set(options.explorePieces === "ONE" ? plan.unknownIds.filter((id) => cat(id) === "topping") : []);
      ensureStock(plan.ids, singles);
      // A refill may have been paid by Margherita replays (which end this round): start the research round again.
      startValid(target);
      const factsBefore = [...(s.discoveryHintFacts[target] ?? [])];
      const knownBefore = knowledgeOf(target, negative).positive;
      const dexBefore = discoveredRecipeIds(s.dex);
      finishBake(plan.ids, singles);
      acc.attempts += 1;
      totalAttempts += 1;
      checkInvariants(target, plan.ids, factsBefore, knownBefore);
      const dexAfter = discoveredRecipeIds(s.dex);
      if (dexAfter.length > dexBefore.length) {
        discoveredNow = dexAfter.filter((id) => !dexBefore.includes(id));
        acc.reward += creditOf(s);
        if (s.lastResearchRows && s.lastResearchRows.rows.length > 0) acc.attemptsWithRows += 1;
        break;
      }
      const rows = s.lastResearchRows?.rows ?? [];
      if (rows.length === 0) noInfo += 1;
      else acc.attemptsWithRows += 1;
      for (const r of rows) if (r.verdict === "NEGATIVE") negative.add(r.ingredientId);
      if (noInfo > 8) throw new Error(`Dex ${dexIds.length}: ${target} stuck (no information) after ${acc.attempts} attempts`);
    }
    if (discoveredNow.length === 0) throw new Error(`Dex ${dexIds.length}: ${target} not discovered within the attempt guard`);
    stages.push({
      discovery: discoveredRecipeIds(s.dex).length,
      discovered: discoveredNow,
      target,
      targetDiscovered: discoveredNow.includes(target),
      onboarding: false,
      attempts: acc.attempts,
      attemptsWithRows: acc.attemptsWithRows,
      poolUnknown,
      ladderStepCount,
      hintSpend: acc.hintSpend,
      rungsBought: acc.rungs,
      refillCount: acc.refillCount,
      refillSpend: acc.refillSpend,
      refillMemberSpend: acc.refillMemberSpend,
      refillNonMemberSpend: acc.refillNonMemberSpend,
      grindEarned: acc.grindEarned,
      unlockSpend: acc.unlockSpend,
      stockoutRefills: acc.stockoutRefills,
      grindBakes: acc.grind,
      pitzBefore: acc.pitzBefore,
      pitzAfter: s.pitzBalance,
      minPitz: acc.minPitz,
      discoveryReward: acc.reward,
      insufficientHintAttempts: acc.insufficient,
      reservedStop: acc.reservedStop,
    });
  }

  const sum = (f: (r: ResearchStage) => number) => stages.reduce((a, r) => a + f(r), 0);
  return {
    profile,
    qualityTotal,
    orderSeed,
    explorePieces,
    freeTotal: options.freeTotal === true,
    stages,
    completed,
    totalAttempts: sum((r) => r.attempts),
    minPitz,
    endingPitz: s.pitzBalance,
    grindBakes: sum((r) => r.grindBakes),
    reservedStops: stages.filter((r) => r.reservedStop).length,
    insufficientHintAttempts: sum((r) => r.insufficientHintAttempts),
    refillCount: sum((r) => r.refillCount),
    stockoutRefills: sum((r) => r.stockoutRefills),
    violations,
    finalState: s,
  };
}
