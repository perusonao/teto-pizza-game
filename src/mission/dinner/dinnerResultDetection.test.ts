import { describe, expect, it } from "vitest";
import { getCookingProfile, isCutEligible, postBakeSteps } from "../../data/cookingProfiles";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { FREE_COOK_BAKE_TARGET } from "../../data/freeCook";
import { INGREDIENTS } from "../../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../../data/referencePizza";
import { getRecipe, RECIPES, type RecipeId } from "../../data/recipes";
import type { RecipeDiscoveryTarget } from "../../logic/discovery/matcher";
import type { QualityStars } from "../../logic/scoring";
import { computeScoringV2, toLegacyScoreBreakdown } from "../../logic/scoringV2";
import type { DexEntry, DexState } from "../../state/dex";
import { consumePizzaInventory, type InventoryState } from "../../state/inventory";
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
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings,
    bakeResult: options.bake === undefined ? midBake(recipeId) : options.bake,
  };
}

/** A PLAYING run with `completed` already done. The run holds no stock: each attempt's stock is
 *  its own `inventoryBeforeBake`, so START uses a stock that fits every mission. */
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
    inventoryBeforeBake: EXACT_A,
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
  it("32: every one of the 25 runtime recipes has a unique signature and its Reference identifies itself", () => {
    expect(RECIPES).toHaveLength(25);
    expect(RECIPE_DISCOVERY_CATALOG).toHaveLength(25);
    const keys = RECIPE_DISCOVERY_CATALOG.map((t) => JSON.stringify([[...t.items].sort(), [...(t.sauceBase ?? [])].sort()]));
    expect(new Set(keys).size).toBe(25); // 0 identical signatures
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
        inventoryBeforeBake: { ...EXACT_A, "olive-oil": 1, parmigiano: 2, clam: 3, garlic: 2 },
      }),
    );
    expect(resolved(result).classification).toEqual({ category: "NON_TARGET", recipeId: "new-haven-apizza" });
    const none = resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("funghi", { extra: { egg: 1 } }), { cutCompleted: false }));
    expect(resolved(none).classification.category).toBe("ORIGINAL");
  });

  it("the BAKE view carries the window and steps only -- no identity, id or name", () => {
    for (const recipe of RECIPES) {
      const view = dinnerBakePlanView(planDinnerBake(pizzaFor(recipe.id, { bake: null })));
      expect(Object.keys(view).sort()).toEqual(["bakeTarget", "cutRequired", "postBakeSteps"]);
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
      resolveDinnerAttempt(input(runOf(DM_A), pizza, { inventoryBeforeBake: { ...EXACT_A, garlic: 3, oregano: 2 } })),
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
          const result = resolved(resolveDinnerAttempt(input(runOf(mission), pizza, { inventoryBeforeBake: stock })));
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
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_B), pizza, { inventoryBeforeBake: EXACT_B })));
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
      resolveDinnerAttempt(input(runOf(DM_B), pizzaFor("parmigiana-pizza"), { inventoryBeforeBake: EXACT_B })),
    );
    expect(result.classification).toMatchObject({ category: "TARGET_PASS", recipeId: "parmigiana-pizza" });
    expect(result.run.completedRecipeIds).toEqual(["parmigiana-pizza"]);
  });

  it("melanzane made while melanzane is done and parmigiana is open stays a DUPLICATE (no promotion)", () => {
    const run = runOf(DM_B, ["melanzane-pizza"]);
    const result = resolved(
      resolveDinnerAttempt(input(run, pizzaFor("melanzane-pizza"), { inventoryBeforeBake: { ...EXACT_B, eggplant: 12 } })),
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
    it(`${name}: inventoryAfter is consumePizzaInventory(pizza, before)`, () => {
      const result = resolved(
        resolveDinnerAttempt(input(run, pizza, { inventoryBeforeBake: stock, minimumStars: minimumStars as QualityStars })),
      );
      expect(result.classification.category).toBe(name.replace(/^\S+ /, "").replace(/ \(.*\)$/, ""));
      expect(result.inventoryAfter).toEqual(consumePizzaInventory(pizza, stock));
      expect(result.inventoryAfter).not.toEqual(stock);
    });
  }
});

describe("feasibility after every attempt, and CLEAR precedence (§14 / §15)", () => {
  it("23: bismarck PASS on the exact DM-A stock leaves the rest cookable", () => {
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_A), pizzaFor("bismarck"))));
    expect(result.inventoryAfter.egg).toBe(1);
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
      resolveDinnerAttempt(input(first.run, pizzaFor("bismarck"), { inventoryBeforeBake: first.inventoryAfter, now: NOW + 1 })),
    );
    expect(second.classification).toEqual({ category: "DUPLICATE_TARGET", recipeId: "bismarck" });
    expect(second.inventoryAfter.egg).toBe(0);
    expect(second.run.status).toBe("FAILED");
    expect(second.run.outcome).toMatchObject({ reason: "INFEASIBLE" });
    expect(second.remainingShortages).toEqual([{ ingredientId: "egg", need: 1, have: 0, recipeIds: ["breakfast-pizza"] }]);
  });

  it("26: DM-B -- a duplicate melanzane uses parmigiana's eggplant", () => {
    const first = resolved(
      resolveDinnerAttempt(input(runOf(DM_B), pizzaFor("melanzane-pizza"), { inventoryBeforeBake: EXACT_B })),
    );
    expect(first.run.status).toBe("PLAYING");
    const second = resolved(
      resolveDinnerAttempt(input(first.run, pizzaFor("melanzane-pizza"), { inventoryBeforeBake: first.inventoryAfter, now: NOW + 1 })),
    );
    expect(second.classification.category).toBe("DUPLICATE_TARGET");
    expect(second.run.status).toBe("FAILED");
    expect(second.remainingShortages).toEqual([{ ingredientId: "eggplant", need: 3, have: 0, recipeIds: ["parmigiana-pizza"] }]);
  });

  it("27: a QUALITY_FAIL melanzane still eats its eggplant, and melanzane + parmigiana no longer fit", () => {
    const pizza = pizzaFor("melanzane-pizza", { bake: edgeBake("melanzane-pizza") });
    const result = resolved(resolveDinnerAttempt(input(runOf(DM_B), pizza, { inventoryBeforeBake: EXACT_B, minimumStars: 5 })));
    expect(result.classification.category).toBe("QUALITY_FAIL");
    expect(result.inventoryAfter.eggplant).toBe(3);
    expect(result.run.status).toBe("FAILED");
    expect(result.remainingShortages).toEqual([
      { ingredientId: "eggplant", need: 6, have: 3, recipeIds: ["melanzane-pizza", "parmigiana-pizza"] },
    ]);
  });

  it("28: the last target CLEARs, even when the stock is then empty (CLEAR wins, as in DM-1)", () => {
    const run = runOf(DM_A, ["margherita", "bismarck", "funghi"]);
    const result = resolved(resolveDinnerAttempt(input(run, pizzaFor("breakfast-pizza"), { inventoryBeforeBake: { egg: 1, bacon: 3 } })));
    expect(result.inventoryAfter).toMatchObject({ egg: 0, bacon: 0 });
    expect(result.run.status).toBe("CLEARED");
    expect(result.run.outcome).toEqual({ kind: "CLEAR", endedAt: NOW, clearMs: NOW - T0 });
    expect(result.remainingShortages).toEqual([]);
  });

  it("the run transition matches DM-1 RESOLVE_ATTEMPT for the same target and stock", () => {
    const scenarios: [DinnerMissionDefinition, InventoryState, string[], PizzaState, QualityStars][] = [
      [DM_A, EXACT_A, [], pizzaFor("bismarck"), 3],
      [DM_A, { egg: 1, bacon: 3 }, ["margherita", "bismarck", "funghi"], pizzaFor("breakfast-pizza"), 3],
      [DM_B, EXACT_B, [], pizzaFor("melanzane-pizza", { bake: edgeBake("melanzane-pizza") }), 5],
      [DM_B, EXACT_B, [], pizzaFor("parmigiana-pizza"), 3],
    ];
    for (const [mission, stock, completed, pizza, minimumStars] of scenarios) {
      const run = runOf(mission, completed);
      const result = resolved(resolveDinnerAttempt(input(run, pizza, { inventoryBeforeBake: stock, minimumStars })));
      const recipeId = (result.classification as { recipeId: string }).recipeId;
      const selected = dinnerRunReducer(run, { type: "SELECT_TARGET", recipeId, now: NOW });
      const dm1 = dinnerRunReducer(selected, {
        type: "RESOLVE_ATTEMPT",
        recipeId,
        completion: result.completedTargetId ? "PASS" : "FAILED",
        stock: { ownedIngredientIds: ALL_IDS, inventory: result.inventoryAfter },
        now: NOW,
      });
      expect({ ...result.run, attempts: [] }).toEqual({ ...dm1, attempts: [] });
    }
  });
});

describe("purity, privacy and determinism (§11)", () => {
  it("29 / 30: no Dex, Discovery or Pitz write -- inputs frozen, nothing Discovery- or Pitz-shaped out", () => {
    const dex = deepFreeze(dexOf(DM_A_IDS));
    const snapshot = JSON.stringify(dex);
    for (const id of ["funghi", "hawaiian", "marinara", "bismarck"]) {
      const result = resolveDinnerAttempt(
        input(runOf(DM_A), pizzaFor(id), { dex, inventoryBeforeBake: { ...EXACT_A, garlic: 3, oregano: 2, ham: 2, pineapple: 3 } }),
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
    const a = resolveDinnerAttempt(input(run, pizza, { inventoryBeforeBake: EXACT_B }));
    const b = resolveDinnerAttempt(input(run, pizza, { inventoryBeforeBake: EXACT_B }));
    const c = resolveDinnerAttempt(input(run, pizza, { inventoryBeforeBake: EXACT_B, catalog: [...RECIPE_DISCOVERY_CATALOG].reverse() }));
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
      resolveDinnerAttempt({ run, pizza, cutCompleted: true, inventoryBeforeBake: inventory, ownedIngredientIds: owned, dex, minimumStars: 3, now: NOW }),
    );
    expect(result.run).not.toBe(run);
    expect(JSON.stringify({ run, pizza, inventory, owned, dex })).toBe(before);
    planDinnerBake(pizza);
    dinnerAttemptView(result.classification, dex);
    expect(JSON.stringify({ run, pizza, inventory, owned, dex })).toBe(before);
  });
});
