import { describe, expect, it } from "vitest";
import { getCookingProfile, isCutEligible, postBakeSteps } from "../../data/cookingProfiles";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { FREE_COOK_BAKE_TARGET, FREE_COOK_RECIPE } from "../../data/freeCook";
import { INGREDIENTS } from "../../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../../data/referencePizza";
import { getRecipe, RECIPES, type BakeTarget, type RecipeId } from "../../data/recipes";
import { bakeCompletionFailure, evaluatePizzaCompletion } from "../../logic/completionGate";
import type { RecipeDiscoveryTarget } from "../../logic/discovery/matcher";
import type { QualityStars } from "../../logic/scoring";
import { computeScoringV2, toLegacyScoreBreakdown } from "../../logic/scoringV2";
import { evaluateFreeCookCompletion } from "../../logic/discovery/freeCook";
import type { DexEntry, DexState } from "../../state/dex";
import { gameReducer } from "../../state/gameReducer";
import { startGuidedPrepare } from "../../state/testSupport/guidedRound";
import { consumePizzaInventory, type InventoryState } from "../../state/inventory";
import { completionPolicyForRound } from "../../state/roundKind";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { getDinnerMission, type DinnerMissionDefinition } from "./dinnerMission";
import { dinnerRunReducer, startDinnerRun, type DinnerRunState } from "./dinnerRun";
import {
  dinnerAttemptView,
  dinnerBakePlanView,
  planDinnerBake,
  resolveDinnerAttempt,
  resolveDinnerIdentity,
  type DinnerAttemptInput,
  type DinnerAttemptResult,
} from "./dinnerResultDetection";

/**
 * Dinner Mission DM-3R-1: result detection. Test numbers follow the DM-3R-1 task list; the Result
 * Report (docs/reports/TETO_DINNER-MISSION_DM-3R-1_RESULT-DETECTION_Result.md) maps each one.
 */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const T0 = 1_000_000;
const DURATION = 600_000;
const NOW = T0 + 10_000;
const DM_A = getDinnerMission("dm-a")!;
const DM_B = getDinnerMission("dm-b")!;
const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const DM_B_IDS = ["margherita", "funghi", "melanzane-pizza", "parmigiana-pizza"];
const EXACT_A: InventoryState = { egg: 2, bacon: 3, mushroom: 3 };
const EXACT_B: InventoryState = { mushroom: 3, eggplant: 6, parmigiano: 2 };

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}

/** DM-A + DM-B targets and marinara are discovered; everything else (hawaiian, ...) is not. */
const DEX = dexOf([...new Set([...DM_A_IDS, ...DM_B_IDS, "marinara", "new-haven-apizza"])]);

function midBake(recipeId: string): number {
  const { start, end } = getRecipe(recipeId as RecipeId)!.bakeTarget;
  return (start + end) / 2;
}

/** Inside the Completion Gate band but outside the perfect zone: ★ is capped at 4. */
function edgeBake(recipeId: string): number {
  const { start, end } = getRecipe(recipeId as RecipeId)!.bakeTarget;
  return start - (end - start) * 0.25;
}

/** The Reference pizza of `recipeId` (piece counts overridable, extra pieces appended). */
function pizzaFor(
  recipeId: string,
  options: { counts?: Record<string, number>; extra?: Record<string, number>; bake?: number | null } = {},
): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`no reference for ${recipeId}`);
  const toppings = reference.pieceGroups.flatMap((group, gi) => {
    const count = options.counts?.[group.ingredientId] ?? group.positions.length;
    return Array.from({ length: count }, (_, i) => ({
      id: `${recipeId}-${gi}-${i}`,
      ingredientId: group.ingredientId,
      ...(group.positions[i] ?? { x: 40 + (i % 4) * 5, y: 45 + Math.floor(i / 4) * 5 }),
    }));
  });
  for (const [ingredientId, count] of Object.entries(options.extra ?? {})) {
    for (let i = 0; i < count; i += 1) {
      toppings.push({ id: `extra-${ingredientId}-${i}`, ingredientId, x: 35 + i * 6, y: 60 });
    }
  }
  return {
    ...createEmptyPizza(),
    sauceIds: reference.sauce ? [reference.sauce.ingredientId] : [],
    sauceDeposits: buildIdealSauceFixture(),
    toppings,
    bakeResult: options.bake === undefined ? midBake(recipeId) : options.bake,
  };
}

/** A PLAYING run with `completed` already done. The run holds no stock: each attempt's stock is
 *  its own `preConsumptionInventory`, so START uses a stock that fits every mission. */
function runOf(mission: DinnerMissionDefinition, completed: readonly string[] = []): DinnerRunState {
  const started = startDinnerRun(mission, { dex: DEX, ownedIngredientIds: ALL_IDS, inventory: { ...EXACT_A, ...EXACT_B, egg: 2 } }, T0, DURATION);
  if (!started.ok) throw new Error(`start failed: ${JSON.stringify(started.block)}`);
  return { ...started.state, completedRecipeIds: [...completed] };
}

function input(
  run: DinnerRunState,
  pizza: PizzaState,
  overrides: Partial<DinnerAttemptInput> = {},
): DinnerAttemptInput {
  return {
    run,
    pizza,
    cutCompleted: true,
    preConsumptionInventory: EXACT_A,
    ownedIngredientIds: ALL_IDS,
    dex: DEX,
    minimumStars: 3,
    now: NOW,
    ...overrides,
  };
}

function resolved(result: DinnerAttemptResult) {
  if (result.status !== "RESOLVED") throw new Error(`not resolved: ${JSON.stringify(result)}`);
  return result;
}

/** Scoring 2.0's ★ for `pizza` as `recipeId` -- the one star authority (no Dinner formula). */
function scoringStars(recipeId: string, pizza: PizzaState): QualityStars {
  const recipe = getRecipe(recipeId as RecipeId)!;
  return toLegacyScoreBreakdown(computeScoringV2(recipe, pizza), pizza.bakeResult, recipe.bakeTarget).stars;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

describe("identity: the Free Cooking matcher, reused (§3 / §4)", () => {
  it("32: every one of the 32 runtime recipes has a unique signature and its Reference identifies itself", () => {
    expect(RECIPES).toHaveLength(33);
    expect(RECIPE_DISCOVERY_CATALOG).toHaveLength(33);
    const keys = RECIPE_DISCOVERY_CATALOG.map((t) => JSON.stringify([[...t.items].sort(), [...(t.sauceBase ?? [])].sort()]));
    expect(new Set(keys).size).toBe(33); // 0 identical signatures
    for (const recipe of RECIPES) {
      expect(resolveDinnerIdentity(pizzaFor(recipe.id)), recipe.id).toEqual({ kind: "RECIPE", recipeId: recipe.id });
    }
  });

  it("the identity ignores the bake value, so Stage A at START_BAKE equals Stage B's identity", () => {
    for (const id of [...DM_A_IDS, ...DM_B_IDS]) {
      const raw = pizzaFor(id, { bake: null });
      expect(planDinnerBake(raw)).toEqual(planDinnerBake(pizzaFor(id, { bake: 0 })));
      expect(planDinnerBake(raw)).toEqual(planDinnerBake(pizzaFor(id, { bake: 100 })));
    }
  });

  it("9: an ambiguous match never picks a candidate (no first-match)", () => {
    const funghi = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "funghi")!;
    // A clone listed FIRST: a first-match matcher would return it.
    const catalog: RecipeDiscoveryTarget[] = [
      { ...funghi, targetId: "aaa-future-clone", recipeId: "margherita" },
      ...RECIPE_DISCOVERY_CATALOG,
    ];
    const identity = resolveDinnerIdentity(pizzaFor("funghi"), catalog);
    expect(identity).toEqual({ kind: "AMBIGUOUS", targetIds: ["aaa-future-clone", "shipped:funghi"] });
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi"), { catalog })));
    expect(result.classification).toEqual({ category: "ORIGINAL", reason: "AMBIGUOUS_IDENTITY" });
    expect(result.run.completedRecipeIds).toEqual([]);
  });

  it("33: a future signature collision on any target fails safe -- no progress, generic window, no CUT", () => {
    for (const id of DM_A_IDS) {
      const base = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === id)!;
      for (const order of ["first", "last"] as const) {
        const clone: RecipeDiscoveryTarget = { ...base, targetId: `future-${id}`, recipeId: "hawaiian" };
        const catalog = order === "first" ? [clone, ...RECIPE_DISCOVERY_CATALOG] : [...RECIPE_DISCOVERY_CATALOG, clone];
        const pizza = pizzaFor(id);
        const plan = planDinnerBake(pizza, catalog);
        expect(plan.identity.kind, id).toBe("AMBIGUOUS");
        expect(plan.bakeWindow).toEqual({ source: "GENERIC", target: FREE_COOK_BAKE_TARGET });
        expect(plan.cutRequired).toBe(false);
        const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizza, { catalog, minimumStars: 1 })));
        expect(result.classification.category).toBe("ORIGINAL");
        expect(result.completedTargetId).toBeNull();
        expect(result.run.completedRecipeIds).toEqual([]);
      }
    }
  });
});

describe("Stage A: bake window and CUT from the composition (§9 / §10)", () => {
  it("14: each target bakes with its own window, and the Completion band follows it", () => {
    for (const id of [...DM_A_IDS, ...DM_B_IDS]) {
      const plan = planDinnerBake(pizzaFor(id, { bake: null }));
      expect(plan.bakeWindow, id).toEqual({ source: "RECIPE", target: getRecipe(id as RecipeId)!.bakeTarget });
    }
    // bismarck 55-75 (band 45-85): 86 passes the generic band (48-88) but is overbaked for bismarck.
    const burnt = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck", { bake: 86 }))));
    expect(burnt.classification).toMatchObject({ category: "INVALID_PIZZA", completion: { reason: "OVERBAKED" } });
    // margherita 60-80 (band 50-90): 89.5 fails the generic band but is inside margherita's.
    const late = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("margherita", { bake: 89.5 }))));
    expect(late.classification).toMatchObject({ category: "TARGET_PASS", recipeId: "margherita" });
  });

  it("15: no match -> the generic Free Cooking window, judged by the generic band", () => {
    const original = pizzaFor("funghi", { extra: { egg: 1 }, bake: null });
    expect(planDinnerBake(original)).toEqual({
      identity: { kind: "NONE" },
      bakeWindow: { source: "GENERIC", target: FREE_COOK_BAKE_TARGET },
      postBakeSteps: [],
      cutRequired: false,
    });
    const at86 = resolved(resolveDinnerAttempt(input(runOf(DM_A), { ...original, bakeResult: 86 })));
    expect(at86.classification).toEqual({ category: "ORIGINAL", reason: "NO_MATCH" });
    const at89 = resolved(resolveDinnerAttempt(input(runOf(DM_A), { ...original, bakeResult: 89.5 })));
    expect(at89.classification).toMatchObject({ category: "INVALID_PIZZA", completion: { reason: "OVERBAKED" } });
  });

  it("16: a CUT recipe needs CUT before the result; the pending call resolves and consumes nothing", () => {
    for (const id of [...DM_A_IDS, ...DM_B_IDS]) {
      const plan = planDinnerBake(pizzaFor(id));
      expect(isCutEligible(id as RecipeId)).toBe(true);
      expect(plan.cutRequired, id).toBe(true);
      expect(plan.postBakeSteps).toEqual(postBakeSteps(getCookingProfile(id as RecipeId)));
      expect(plan.postBakeSteps).toContain("CUT");
    }
    const pending = resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi"), { cutCompleted: false }));
    expect(pending).toEqual({ status: "REJECTED", reason: "CUT_PENDING" });
  });

  it("17: a no-CUT identity (new-haven-apizza, or no match) resolves right after BAKE", () => {
    const plan = planDinnerBake(pizzaFor("new-haven-apizza"));
    expect(plan.cutRequired).toBe(false);
    expect(plan.postBakeSteps).toEqual([]);
    const result = resolveDinnerAttempt(
      input(runOf(DM_A), pizzaFor("new-haven-apizza"), {
        cutCompleted: false,
        preConsumptionInventory: { ...EXACT_A, "olive-oil": 1, parmigiano: 2, clam: 3, garlic: 2 },
      }),
    );
    expect(resolved(result).classification).toEqual({ category: "NON_TARGET", recipeId: "new-haven-apizza" });
    const none = resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi", { extra: { egg: 1 } }), { cutCompleted: false }));
    expect(resolved(none).classification.category).toBe("ORIGINAL");
  });

  it("the BAKE view carries the window and steps only -- no identity, id or name", () => {
    for (const recipe of RECIPES) {
      const view = dinnerBakePlanView(planDinnerBake(pizzaFor(recipe.id, { bake: null })));
      // DM-3R-2 adds the CUT slice count (the same standard config for every CUT recipe) -- still
      // no identity, id or name.
      const keys = view.cutRequired
        ? ["bakeTarget", "cutConfig", "cutRequired", "postBakeSteps"]
        : ["bakeTarget", "cutRequired", "postBakeSteps"];
      expect(Object.keys(view).sort()).toEqual(keys);
      if (view.cutConfig) expect(view.cutConfig).toEqual({ requestedSliceCount: 6 });
      const text = JSON.stringify(view);
      expect(text).not.toContain(recipe.id);
      expect(text).not.toContain(recipe.nameJa);
    }
  });
});

describe("Stage B: classification (§6)", () => {
  it("1: an exact remaining target passes and completes that target", () => {
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi"))));
    expect(result.classification).toMatchObject({ category: "TARGET_PASS", recipeId: "funghi", stars: 5, minimumStars: 3 });
    expect(result.completedTargetId).toBe("funghi");
    expect(result.run.completedRecipeIds).toEqual(["funghi"]);
    expect(result.run.status).toBe("PLAYING");
  });

  it("2: ★ below S is QUALITY_FAIL and the target stays open", () => {
    const pizza = pizzaFor("funghi", { bake: edgeBake("funghi") });
    expect(scoringStars("funghi", pizza)).toBe(4);
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizza, { minimumStars: 5 })));
    expect(result.classification).toEqual({
      category: "QUALITY_FAIL",
      recipeId: "funghi",
      failure: { kind: "BELOW_MINIMUM_STARS", stars: 4, totalScore: expect.any(Number), minimumStars: 5 },
    });
    expect(result.run.completedRecipeIds).toEqual([]);
  });

  it("3: ★ exactly S passes", () => {
    const edge = pizzaFor("funghi", { bake: edgeBake("funghi") });
    expect(resolved(resolveDinnerAttempt(input(runOf(DM_A), edge, { minimumStars: 4 }))).classification.category).toBe(
      "TARGET_PASS",
    );
    const perfect = pizzaFor("funghi");
    expect(resolved(resolveDinnerAttempt(input(runOf(DM_A), perfect, { minimumStars: 5 }))).classification.category).toBe(
      "TARGET_PASS",
    );
  });

  it("34: pass <=> Scoring 2.0 ★ >= S, for S = 1..5 over several pizzas", () => {
    const pizzas = [
      pizzaFor("funghi"),
      pizzaFor("funghi", { bake: edgeBake("funghi") }),
      { ...pizzaFor("funghi"), sauceDeposits: buildIdealSauceFixture().slice(0, 60) },
      {
        ...pizzaFor("funghi", { bake: edgeBake("funghi") }),
        toppings: pizzaFor("funghi").toppings.map((t, i) => ({ ...t, x: 30 + i * 3, y: 30 + i * 3 })),
      },
    ];
    const seen = new Set<number>();
    for (const pizza of pizzas) {
      const stars = scoringStars("funghi", pizza);
      seen.add(stars);
      for (const s of [1, 2, 3, 4, 5] as const) {
        const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizza, { minimumStars: s })));
        if (result.classification.category === "QUALITY_FAIL" && result.classification.failure.kind === "COMPLETION_GATE") {
          throw new Error("fixture fails the gate; pick another");
        }
        expect(result.classification.category, `★${stars} S=${s}`).toBe(stars >= s ? "TARGET_PASS" : "QUALITY_FAIL");
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it("minimumStars has no default: a missing or out-of-range S rejects without consuming", () => {
    for (const bad of [0, 6, 3.5, Number.NaN, undefined]) {
      const result = resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi"), { minimumStars: bad as unknown as QualityStars }));
      expect(result).toEqual({ status: "REJECTED", reason: "INVALID_MINIMUM_STARS" });
    }
  });

  it("4: a Completion Gate failure (Dinner's 'order' quantity) is QUALITY_FAIL with the gate reason", () => {
    const pizza = pizzaFor("funghi", { counts: { mushroom: 1 } });
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizza, { minimumStars: 1 })));
    expect(result.classification).toMatchObject({
      category: "QUALITY_FAIL",
      recipeId: "funghi",
      failure: { kind: "COMPLETION_GATE", completion: { status: "FAILED", reason: "INSUFFICIENT_REQUIRED_AMOUNT", ingredientId: "mushroom" } },
    });
    expect(result.run.completedRecipeIds).toEqual([]);
  });

  it("5: a completed target made again is DUPLICATE_TARGET, whatever its quality, with no progress", () => {
    const run = runOf(DM_A, ["funghi"]);
    for (const pizza of [pizzaFor("funghi"), pizzaFor("funghi", { counts: { mushroom: 1 } })]) {
      const result = resolved(resolveDinnerAttempt(input(run, pizza)));
      expect(result.classification).toEqual({ category: "DUPLICATE_TARGET", recipeId: "funghi" });
      expect(result.completedTargetId).toBeNull();
      expect(result.run.completedRecipeIds).toEqual(["funghi"]);
    }
  });

  it("6: a discovered non-target recipe is NON_TARGET, named, no progress", () => {
    const pizza = pizzaFor("marinara");
    const result = resolved(
      resolveDinnerAttempt(input(runOf(DM_A), pizza, { preConsumptionInventory: { ...EXACT_A, garlic: 3, oregano: 2 } })),
    );
    expect(result.classification).toEqual({ category: "NON_TARGET", recipeId: "marinara" });
    expect(result.run.completedRecipeIds).toEqual([]);
    expect(dinnerAttemptView(result.classification, DEX)).toEqual({ category: "NON_TARGET", recipeId: "marinara", nameJa: "マリナーラ" });
  });

  it("7 / 31: an undiscovered non-target recipe is ORIGINAL and its view has no id, name or reason", () => {
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("hawaiian"))));
    expect(result.classification).toEqual({ category: "ORIGINAL", reason: "UNDISCOVERED_RECIPE", internalRecipeId: "hawaiian" });
    expect(dinnerAttemptView(result.classification, DEX)).toEqual({ category: "ORIGINAL" });
  });

  it("31: privacy sweep -- no view names any undiscovered recipe, for every recipe's pizza in both missions", () => {
    const undiscovered = RECIPES.filter((r) => !DEX.some((e) => e.recipeId === r.id));
    expect(undiscovered.length).toBeGreaterThan(10);
    const stock: InventoryState = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 20]));
    for (const mission of [DM_A, DM_B]) {
      for (const recipe of RECIPES) {
        for (const pizza of [pizzaFor(recipe.id), pizzaFor(recipe.id, { bake: 0 })]) {
          const result = resolved(resolveDinnerAttempt(input(runOf(mission), pizza, { preConsumptionInventory: stock })));
          const text = JSON.stringify(dinnerAttemptView(result.classification, DEX));
          for (const hidden of undiscovered) {
            expect(text, `${mission.missionId}/${recipe.id}`).not.toContain(hidden.id);
            expect(text, `${mission.missionId}/${recipe.id}`).not.toContain(hidden.nameJa);
          }
        }
      }
    }
  });

  it("the view fails closed: a named category whose recipe is not discovered shows as ORIGINAL", () => {
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi"))));
    expect(dinnerAttemptView(result.classification, dexOf(["margherita"]))).toEqual({ category: "ORIGINAL" });
  });

  it("8: no identity (a superset of a target) is ORIGINAL NO_MATCH", () => {
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi", { extra: { egg: 1 } }))));
    expect(result.classification).toEqual({ category: "ORIGINAL", reason: "NO_MATCH" });
    expect(result.run.completedRecipeIds).toEqual([]);
  });

  it("INVALID_PIZZA: plain dough, or raw / burnt past the band, is not a dish", () => {
    const dough = { ...createEmptyPizza(), bakeResult: 68 };
    const empty = resolved(resolveDinnerAttempt(input(runOf(DM_A), dough)));
    expect(empty.classification).toMatchObject({ category: "INVALID_PIZZA", completion: { reason: "MISSING_REQUIRED_INGREDIENT" } });
    const raw = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi", { bake: 0 }))));
    expect(raw.classification).toMatchObject({ category: "INVALID_PIZZA", completion: { reason: "UNDERBAKED" } });
    expect(dinnerAttemptView(raw.classification, DEX)).toEqual({ category: "INVALID_PIZZA", reason: "UNDERBAKED" });
  });

  it("an unbaked pizza, a finished run or a bad clock value is rejected", () => {
    const run = runOf(DM_A);
    expect(resolveDinnerAttempt(input(run, pizzaFor("funghi", { bake: null })))).toEqual({ status: "REJECTED", reason: "NOT_BAKED" });
    expect(resolveDinnerAttempt(input({ ...run, status: "CLEARED" }, pizzaFor("funghi")))).toEqual({
      status: "REJECTED",
      reason: "RUN_NOT_PLAYING",
    });
    expect(resolveDinnerAttempt(input(run, pizzaFor("funghi"), { now: Number.NaN }))).toEqual({ status: "REJECTED", reason: "INVALID_TIME" });
  });

  it("the deadline wins (DM-1): at endsAt the run is TIME_UP and nothing counts", () => {
    const run = runOf(DM_A);
    const result = resolveDinnerAttempt(input(run, pizzaFor("funghi"), { now: run.clock.endsAt }));
    expect(result.status).toBe("TIME_UP");
    if (result.status !== "TIME_UP") return;
    expect(result.run).toMatchObject({ status: "FAILED", completedRecipeIds: [], outcome: { reason: "TIME_UP", endedAt: run.clock.endsAt } });
  });
});

describe("nested targets (OD-R3: the composition decides, never an intent)", () => {
  it("10: DM-A -- breakfast ingredients without bacon ARE bismarck", () => {
    const pizza = pizzaFor("breakfast-pizza", { counts: { bacon: 0 } });
    expect(resolveDinnerIdentity(pizza)).toEqual({ kind: "RECIPE", recipeId: "bismarck" });
    const open = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizza, { minimumStars: 1 })));
    expect(open.classification).toMatchObject({ category: "QUALITY_FAIL", recipeId: "bismarck" });
    // breakfast's mozzarella 2 < bismarck's 3 under Dinner's quantity rule
    expect(open.classification).toMatchObject({ failure: { kind: "COMPLETION_GATE", completion: { ingredientId: "mozzarella" } } });
    const done = resolved(resolveDinnerAttempt(input(runOf(DM_A, ["bismarck"]), pizza)));
    expect(done.classification).toEqual({ category: "DUPLICATE_TARGET", recipeId: "bismarck" });
    const proper = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck"))));
    expect(proper.classification).toMatchObject({ category: "TARGET_PASS", recipeId: "bismarck" });
    expect(proper.run.completedRecipeIds).toEqual(["bismarck"]);
  });

  it("11: DM-A -- bismarck plus bacon IS breakfast-pizza, and breakfast's Reference completes breakfast", () => {
    const bismarckPlusBacon = pizzaFor("bismarck", { extra: { bacon: 3 } });
    expect(resolveDinnerIdentity(bismarckPlusBacon)).toEqual({ kind: "RECIPE", recipeId: "breakfast-pizza" });
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("breakfast-pizza"))));
    expect(result.classification).toMatchObject({ category: "TARGET_PASS", recipeId: "breakfast-pizza" });
    expect(result.run.completedRecipeIds).toEqual(["breakfast-pizza"]);
  });

  it("12: DM-B -- parmigiana ingredients without parmigiano ARE melanzane, and complete melanzane", () => {
    const pizza = pizzaFor("parmigiana-pizza", { counts: { parmigiano: 0 } });
    expect(resolveDinnerIdentity(pizza)).toEqual({ kind: "RECIPE", recipeId: "melanzane-pizza" });
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_B), pizza, { preConsumptionInventory: EXACT_B })));
    expect(result.classification).toMatchObject({ category: "TARGET_PASS", recipeId: "melanzane-pizza" });
    expect(result.run.completedRecipeIds).toEqual(["melanzane-pizza"]);
    // margherita + eggplant is melanzane too (margherita ⊂ melanzane)
    expect(resolveDinnerIdentity(pizzaFor("margherita", { extra: { eggplant: 3 } }))).toEqual({
      kind: "RECIPE",
      recipeId: "melanzane-pizza",
    });
  });

  it("13: DM-B -- parmigiana's Reference completes parmigiana, never melanzane", () => {
    const result = resolved(
      resolveDinnerAttempt(input(runOf(DM_B), pizzaFor("parmigiana-pizza"), { preConsumptionInventory: EXACT_B })),
    );
    expect(result.classification).toMatchObject({ category: "TARGET_PASS", recipeId: "parmigiana-pizza" });
    expect(result.run.completedRecipeIds).toEqual(["parmigiana-pizza"]);
  });

  it("melanzane made while melanzane is done and parmigiana is open stays a DUPLICATE (no promotion)", () => {
    const run = runOf(DM_B, ["melanzane-pizza"]);
    const result = resolved(
      resolveDinnerAttempt(input(run, pizzaFor("melanzane-pizza"), { preConsumptionInventory: { ...EXACT_B, eggplant: 12 } })),
    );
    expect(result.classification).toEqual({ category: "DUPLICATE_TARGET", recipeId: "melanzane-pizza" });
    expect(result.run.completedRecipeIds).toEqual(["melanzane-pizza"]);
  });
});

describe("inventory: every attempt is consumed, none refunded (§13)", () => {
  const stock: InventoryState = { ...EXACT_A, garlic: 3, oregano: 2, ham: 2, pineapple: 3 };
  const cases: [string, PizzaState, DinnerRunState, number][] = [
    ["18 TARGET_PASS", pizzaFor("funghi"), runOf(DM_A), 3],
    ["19 QUALITY_FAIL", pizzaFor("funghi", { bake: edgeBake("funghi") }), runOf(DM_A), 5],
    ["20 DUPLICATE_TARGET", pizzaFor("funghi"), runOf(DM_A, ["funghi"]), 3],
    ["21 NON_TARGET", pizzaFor("marinara"), runOf(DM_A), 3],
    ["22 ORIGINAL", pizzaFor("funghi", { extra: { egg: 1 } }), runOf(DM_A), 3],
    ["22b ORIGINAL (undiscovered)", pizzaFor("hawaiian"), runOf(DM_A), 3],
    ["INVALID_PIZZA", pizzaFor("funghi", { bake: 0 }), runOf(DM_A), 3],
  ];
  for (const [name, pizza, run, minimumStars] of cases) {
    it(`${name}: postConsumptionInventory is consumePizzaInventory(pizza, before)`, () => {
      const result = resolved(
        resolveDinnerAttempt(input(run, pizza, { preConsumptionInventory: stock, minimumStars: minimumStars as QualityStars })),
      );
      expect(result.classification.category).toBe(name.replace(/^\S+ /, "").replace(/ \(.*\)$/, ""));
      expect(result.postConsumptionInventory).toEqual(consumePizzaInventory(pizza, stock));
      expect(result.postConsumptionInventory).not.toEqual(stock);
    });
  }
});

describe("feasibility after every attempt, and CLEAR precedence (§14 / §15)", () => {
  it("23: bismarck PASS on the exact DM-A stock leaves the rest cookable", () => {
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck"))));
    expect(result.postConsumptionInventory.egg).toBe(1);
    expect(result.remainingShortages).toEqual([]);
    expect(result.run.status).toBe("PLAYING");
  });

  it("24: a remaining target the post-bake stock cannot cover fails the run INFEASIBLE", () => {
    // funghi + egg matches nothing (ORIGINAL), yet it eats funghi's 3 mushrooms and one of the eggs.
    const pizza = pizzaFor("funghi", { extra: { egg: 1 } });
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizza)));
    expect(result.classification.category).toBe("ORIGINAL");
    expect(result.run.status).toBe("FAILED");
    expect(result.run.outcome).toMatchObject({ kind: "FAILED", reason: "INFEASIBLE", endedAt: NOW });
    expect(result.remainingShortages.map((s) => s.ingredientId).sort()).toEqual(["egg", "mushroom"]);
  });

  it("25: DM-A -- a duplicate bismarck uses the second egg, so breakfast can no longer be made", () => {
    const first = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck"))));
    expect(first.run.status).toBe("PLAYING");
    const second = resolved(
      resolveDinnerAttempt(input(first.run, pizzaFor("bismarck"), { preConsumptionInventory: first.postConsumptionInventory, now: NOW + 1 })),
    );
    expect(second.classification).toEqual({ category: "DUPLICATE_TARGET", recipeId: "bismarck" });
    expect(second.postConsumptionInventory.egg).toBe(0);
    expect(second.run.status).toBe("FAILED");
    expect(second.run.outcome).toMatchObject({ reason: "INFEASIBLE" });
    expect(second.remainingShortages).toEqual([{ ingredientId: "egg", need: 1, have: 0, recipeIds: ["breakfast-pizza"] }]);
  });

  it("26: DM-B -- a duplicate melanzane uses parmigiana's eggplant", () => {
    const first = resolved(
      resolveDinnerAttempt(input(runOf(DM_B), pizzaFor("melanzane-pizza"), { preConsumptionInventory: EXACT_B })),
    );
    expect(first.run.status).toBe("PLAYING");
    const second = resolved(
      resolveDinnerAttempt(input(first.run, pizzaFor("melanzane-pizza"), { preConsumptionInventory: first.postConsumptionInventory, now: NOW + 1 })),
    );
    expect(second.classification.category).toBe("DUPLICATE_TARGET");
    expect(second.run.status).toBe("FAILED");
    expect(second.remainingShortages).toEqual([{ ingredientId: "eggplant", need: 3, have: 0, recipeIds: ["parmigiana-pizza"] }]);
  });

  it("27: a QUALITY_FAIL melanzane still eats its eggplant, and melanzane + parmigiana no longer fit", () => {
    const pizza = pizzaFor("melanzane-pizza", { bake: edgeBake("melanzane-pizza") });
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_B), pizza, { preConsumptionInventory: EXACT_B, minimumStars: 5 })));
    expect(result.classification.category).toBe("QUALITY_FAIL");
    expect(result.postConsumptionInventory.eggplant).toBe(3);
    expect(result.run.status).toBe("FAILED");
    expect(result.remainingShortages).toEqual([
      { ingredientId: "eggplant", need: 6, have: 3, recipeIds: ["melanzane-pizza", "parmigiana-pizza"] },
    ]);
  });

  it("28: the last target CLEARs, even when the stock is then empty (CLEAR wins, as in DM-1)", () => {
    const run = runOf(DM_A, ["margherita", "bismarck", "funghi"]);
    const result = resolved(resolveDinnerAttempt(input(run, pizzaFor("breakfast-pizza"), { preConsumptionInventory: { egg: 1, bacon: 3 } })));
    expect(result.postConsumptionInventory).toMatchObject({ egg: 0, bacon: 0 });
    expect(result.run.status).toBe("CLEARED");
    expect(result.run.outcome).toEqual({ kind: "CLEAR", endedAt: NOW, clearMs: NOW - T0 });
    expect(result.remainingShortages).toEqual([]);
  });

  // DM-3R-2 (Issue #250): DM-1's SELECT_TARGET is gone, so parity is now with the one run
  // transition the resolver delegates to -- RESOLVE_ATTEMPT carrying the classified attempt. The
  // run (status / progress / outcome) and the appended attempt must be exactly that transition's.
  it("the run transition matches DM-1 RESOLVE_ATTEMPT for the same classified attempt and stock", () => {
    const scenarios: [DinnerMissionDefinition, InventoryState, string[], PizzaState, QualityStars][] = [
      [DM_A, EXACT_A, [], pizzaFor("bismarck"), 3],
      [DM_A, { egg: 1, bacon: 3 }, ["margherita", "bismarck", "funghi"], pizzaFor("breakfast-pizza"), 3],
      [DM_B, EXACT_B, [], pizzaFor("melanzane-pizza", { bake: edgeBake("melanzane-pizza") }), 5],
      [DM_B, EXACT_B, [], pizzaFor("parmigiana-pizza"), 3],
    ];
    for (const [mission, stock, completed, pizza, minimumStars] of scenarios) {
      const run = runOf(mission, completed);
      const result = resolved(resolveDinnerAttempt(input(run, pizza, { preConsumptionInventory: stock, minimumStars })));
      const attempt = result.run.attempts[result.run.attempts.length - 1];
      expect(result.run.attempts).toHaveLength(run.attempts.length + 1);
      const dm1 = dinnerRunReducer(run, {
        type: "RESOLVE_ATTEMPT",
        attempt,
        stock: { ownedIngredientIds: ALL_IDS, inventory: result.postConsumptionInventory },
        now: NOW,
      });
      expect(result.run).toEqual(dm1);
      expect(attempt.completedTargetId).toBe(result.completedTargetId);
    }
  });

  it("DM-3R-2 attempt log: category, internal identity, displayed recipe, ★, consumption, completed target", () => {
    const pass = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck"), { preConsumptionInventory: EXACT_A })));
    expect(pass.run.attempts).toEqual([
      {
        at: NOW,
        category: "TARGET_PASS",
        identityRecipeId: "bismarck",
        displayedRecipeId: "bismarck",
        completedTargetId: "bismarck",
        stars: (pass.classification as { stars: number }).stars,
        consumed: { egg: 1 },
      },
    ]);
    // An undiscovered non-target: the internal identity is kept, nothing is displayed.
    const hidden = resolved(
      resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("hawaiian"), { preConsumptionInventory: { ...EXACT_A, ham: 3, pineapple: 3 } })),
    );
    expect(hidden.classification.category).toBe("ORIGINAL");
    expect(hidden.run.attempts[0]).toMatchObject({
      category: "ORIGINAL",
      identityRecipeId: "hawaiian",
      displayedRecipeId: null,
      completedTargetId: null,
      stars: null,
    });
    expect(Object.keys(hidden.run.attempts[0].consumed).sort()).toEqual(["ham", "pineapple"]);
  });
});

describe("purity, privacy and determinism (§11)", () => {
  it("29 / 30: no Dex, Discovery or Pitz write -- inputs frozen, nothing Discovery- or Pitz-shaped out", () => {
    const dex = deepFreeze(dexOf(DM_A_IDS));
    const snapshot = JSON.stringify(dex);
    for (const id of ["funghi", "hawaiian", "marinara", "bismarck"]) {
      const result = resolveDinnerAttempt(
        input(runOf(DM_A), pizzaFor(id), { dex, preConsumptionInventory: { ...EXACT_A, garlic: 3, oregano: 2, ham: 2, pineapple: 3 } }),
      );
      const text = JSON.stringify(result);
      expect(text).not.toMatch(/NEW_DISCOVERY|ALREADY_DISCOVERED|lastDiscovery|pitz/i);
    }
    expect(JSON.stringify(dex)).toBe(snapshot);
  });

  it("29 / 30: the module imports no Dex writer, Discovery evaluator or Pitz code", () => {
    const sources = import.meta.glob<string>("./dinnerResultDetection.ts", { query: "?raw", import: "default", eager: true });
    const source = sources["./dinnerResultDetection.ts"];
    const imports = source.split("\n").filter((line) => /^import |^} from /.test(line)).join("\n");
    expect(imports).not.toMatch(/pitz|discoveryRegistration|registerScoreToDex|gameReducer|persistence|lunchRush/i);
    expect(source).not.toMatch(/evaluateDiscovery|registerScoreToDex\(|pitzBalance/);
  });

  it("35: deterministic -- same input, same output; catalog order does not matter", () => {
    const run = runOf(DM_B);
    const pizza = pizzaFor("parmigiana-pizza", { counts: { parmigiano: 0 } });
    const a = resolveDinnerAttempt(input(run, pizza, { preConsumptionInventory: EXACT_B }));
    const b = resolveDinnerAttempt(input(run, pizza, { preConsumptionInventory: EXACT_B }));
    const c = resolveDinnerAttempt(input(run, pizza, { preConsumptionInventory: EXACT_B, catalog: [...RECIPE_DISCOVERY_CATALOG].reverse() }));
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("36: input immutability -- deeply frozen inputs, unchanged afterwards", () => {
    const run = deepFreeze(runOf(DM_A, ["margherita"]));
    const pizza = deepFreeze(pizzaFor("bismarck"));
    const inventory = deepFreeze({ ...EXACT_A });
    const owned = deepFreeze([...ALL_IDS]);
    const dex = deepFreeze(dexOf(DM_A_IDS));
    const before = JSON.stringify({ run, pizza, inventory, owned, dex });
    const result = resolved(
      resolveDinnerAttempt({ run, pizza, cutCompleted: true, preConsumptionInventory: inventory, ownedIngredientIds: owned, dex, minimumStars: 3, now: NOW }),
    );
    expect(result.run).not.toBe(run);
    expect(JSON.stringify({ run, pizza, inventory, owned, dex })).toBe(before);
    planDinnerBake(pizza);
    dinnerAttemptView(result.classification, dex);
    expect(JSON.stringify({ run, pizza, inventory, owned, dex })).toBe(before);
  });
});

describe("inventory contract: PRE-consumption stock in, consumed exactly once (DM-3R-2 wiring guard)", () => {
  it("postConsumptionInventory equals the real CONFIRM_BAKE's stock when given the stock CONFIRM_BAKE saw", () => {
    for (const id of ["funghi", "bismarck", "melanzane-pizza"] as const) {
      // Twice the minimum, so a second subtraction is visible (consumption clamps at 0).
      const stock: InventoryState = { egg: 4, bacon: 6, mushroom: 6, eggplant: 12, parmigiano: 4 };
      const prepared = startGuidedPrepare(id, { inventory: stock });
      const pizza = pizzaFor(id, { bake: null });
      const baking = gameReducer({ ...prepared, pizza }, { type: "START_BAKE" });
      const baked = gameReducer(baking, { type: "CONFIRM_BAKE", value: midBake(id) });
      expect(baked.inventory, id).not.toEqual(stock);
      const result = resolved(
        resolveDinnerAttempt(input(runOf(DM_A), baked.pizza, { preConsumptionInventory: baking.inventory, ownedIngredientIds: baked.ownedIngredientIds })),
      );
      expect(result.postConsumptionInventory, id).toEqual(baked.inventory);
      // Mis-wiring guard: the post-bake stock would consume the pizza a second time.
      const doubled = resolved(resolveDinnerAttempt(input(runOf(DM_A), baked.pizza, { preConsumptionInventory: baked.inventory })));
      expect(doubled.postConsumptionInventory, id).not.toEqual(baked.inventory);
    }
  });
});

describe("evaluateFreeCookCompletion's optional bake window (the one extension to existing code)", () => {
  it("omitted and explicit FREE_COOK_BAKE_TARGET agree for every recipe at raw / mid / edge / burnt bakes", () => {
    for (const recipe of RECIPES) {
      for (const bake of [0, 40, 47.9, 48, 68, 88, 88.1, 100, null]) {
        const pizza = pizzaFor(recipe.id, { bake });
        expect(evaluateFreeCookCompletion(pizza), `${recipe.id}@${bake}`).toEqual(evaluateFreeCookCompletion(pizza, FREE_COOK_BAKE_TARGET));
      }
    }
    const dough = { ...createEmptyPizza(), bakeResult: 0 };
    expect(evaluateFreeCookCompletion(dough)).toEqual(evaluateFreeCookCompletion(dough, FREE_COOK_BAKE_TARGET));
  });

  it("a recipe window moves only the bake band; the empty-pizza rule is unchanged", () => {
    const bismarck = getRecipe("bismarck")!.bakeTarget;
    expect(evaluateFreeCookCompletion(pizzaFor("bismarck", { bake: 86 }))).toEqual({ status: "PASS" });
    expect(evaluateFreeCookCompletion(pizzaFor("bismarck", { bake: 86 }), bismarck)).toMatchObject({ status: "FAILED", reason: "OVERBAKED" });
    expect(evaluateFreeCookCompletion({ ...createEmptyPizza(), bakeResult: 65 }, bismarck)).toMatchObject({
      status: "FAILED",
      reason: "MISSING_REQUIRED_INGREDIENT",
    });
  });
});

describe("Issue #256: a CUT waived for a Completion-Gate bake failure (D-R / D-P)", () => {
  const DINNER_POLICY = completionPolicyForRound({ roundKind: "DINNER" });
  /** The base CONFIRM_BAKE's verdict for a Dinner round: the sentinel recipe carrying `window`. */
  const baseVerdict = (pizza: PizzaState, window: BakeTarget) =>
    bakeCompletionFailure(evaluatePizzaCompletion({ ...FREE_COOK_RECIPE, bakeTarget: window }, pizza, DINNER_POLICY));

  it("D-R1: a pending CUT with a matching waiver resolves to INVALID_PIZZA, consumed once", () => {
    for (const [bake, reason] of [[0, "UNDERBAKED"], [100, "OVERBAKED"]] as const) {
      const pizza = pizzaFor("bismarck", { bake });
      expect(planDinnerBake(pizza).cutRequired).toBe(true);
      const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizza, { cutCompleted: false, cutWaivedFor: reason })));
      expect(result.classification).toMatchObject({ category: "INVALID_PIZZA" });
      expect(result.completedTargetId).toBeNull();
      expect(result.postConsumptionInventory).toEqual(consumePizzaInventory(pizza, EXACT_A));
    }
  });

  it("D-R2: without a waiver a pending CUT is still CUT_PENDING (in-band and out-of-band alike)", () => {
    for (const bake of [0, midBake("bismarck"), edgeBake("bismarck"), 100]) {
      const result = resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck", { bake }), { cutCompleted: false }));
      expect(result).toEqual({ status: "REJECTED", reason: "CUT_PENDING" });
    }
  });

  it("D-R3: a waiver the classification does not confirm is rejected, fail closed", () => {
    const cases = [
      { bake: midBake("bismarck"), waiver: "UNDERBAKED" }, // in band: not INVALID
      { bake: edgeBake("bismarck"), waiver: "OVERBAKED" }, // ★4 badge, still PASS
      { bake: 0, waiver: "OVERBAKED" }, // INVALID, but for the other reason
    ] as const;
    for (const { bake, waiver } of cases) {
      const result = resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck", { bake }), { cutCompleted: false, cutWaivedFor: waiver }));
      expect(result).toEqual({ status: "REJECTED", reason: "CUT_WAIVER_MISMATCH" });
    }
  });

  it("D-R4: a waiver is ignored when no CUT is pending (confirmed CUT, or a no-CUT plan)", () => {
    const cut = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck"), { cutCompleted: true, cutWaivedFor: "UNDERBAKED" })));
    expect(cut.classification).toMatchObject({ category: "TARGET_PASS", recipeId: "bismarck" });
    const noCut = pizzaFor("funghi", { extra: { egg: 1 }, bake: 0 });
    expect(planDinnerBake(noCut).cutRequired).toBe(false);
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), noCut, { cutCompleted: false, cutWaivedFor: "OVERBAKED" })));
    expect(result.classification).toMatchObject({ category: "INVALID_PIZZA" });
  });

  it("D-P: the base verdict equals Stage B's bake failure on every window, composition and bake (13,266 cases)", () => {
    const windows = [FREE_COOK_BAKE_TARGET, ...RECIPES.map((r) => r.bakeTarget)];
    let cases = 0;
    for (const window of windows) {
      for (const withItem of [false, true]) {
        for (let v = 0; v <= 100; v += 0.5) {
          const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: withItem ? ["tomato-sauce"] : [], bakeResult: v };
          const stageB = bakeCompletionFailure(evaluateFreeCookCompletion(pizza, window));
          expect(baseVerdict(pizza, window), `${JSON.stringify(window)} v=${v} item=${withItem}`).toBe(stageB);
          cases += 1;
        }
      }
    }
    expect(windows).toHaveLength(34); // FREE + 33 recipes (Slice 3: pesto-trapanese 50-70) (TQ-1D: aussie 50-70) (PR-4b-B: calabresa shares 58-78; No.27: pesto-pollo 50-70; Expansion: pesto-gamberi 50-70; Wave 2: vongole 62-82, pesto-vegetariana 50-70, ratatouille-pizza 58-78)
    expect(cases).toBe(13_668);
  });

  it("D-P runtime: for every CUT recipe's Reference pizza, bake 0..100, the forwarded verdict never mismatches", () => {
    let checked = 0;
    for (const recipe of RECIPES) {
      for (let bake = 0; bake <= 100; bake += 1) {
        const pizza = pizzaFor(recipe.id, { bake });
        const plan = planDinnerBake(pizza);
        if (!plan.cutRequired) continue;
        const waiver = baseVerdict(pizza, plan.bakeWindow.target);
        const result = resolveDinnerAttempt(input(runOf(DM_A), pizza, { cutCompleted: false, cutWaivedFor: waiver }));
        if (waiver === null) {
          expect(result).toEqual({ status: "REJECTED", reason: "CUT_PENDING" });
        } else {
          expect(result.status, `${recipe.id} @${bake}`).toBe("RESOLVED");
          expect(resolved(result).classification.category).toBe("INVALID_PIZZA");
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(2_000);
  });
});
