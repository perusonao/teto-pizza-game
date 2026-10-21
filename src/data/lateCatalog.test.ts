import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveCoreSteps } from "./cookingProfiles";
import { discoveryIdentityOf, RECIPE_DISCOVERY_TARGET_IDS } from "./discoveryCatalog";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { INGREDIENTS } from "./ingredients";
import { countsTowardLadder, RECIPES, type Recipe } from "./recipes";
import { appendLadderSteps, validateLadderProgression } from "../logic/discoveryLadder";
import { productionCatalogView, validateCatalogTables, validateFinishCatalog } from "../logic/catalog/testSupport/recipeBatchValidator";
import type { RecipeId } from "./recipes";
import { lateCatalogEnabled, LATE_DISCOVERY_TARGET_IDS, LATE_INGREDIENTS, LATE_LADDER_STEPS, LATE_RECIPES, mergeLate, validateLateCatalog, type LateCatalogInput } from "./lateCatalog";

/**
 * FIN-E4 foundation (Owner D-3 = 案 1): the late catalog's single merge point. The real late arrays are EMPTY (the data is a later PR),
 * so everything that needs late content here uses a SYNTHETIC one injected through a module mock. Production (OFF) byte-identity is in
 * `lateCatalog.offGolden.test.ts`.
 */

const SYNTH_RECIPE_ID = "synthetic-late-pizza";
const SYNTH_INGREDIENT_ID = "synthetic-late-herb";
const SYNTH_TARGET_ID = "synthetic-late-pizza-pizzadb";

const synthIngredient = {
  id: SYNTH_INGREDIENT_ID,
  category: "topping" as const,
  nameJa: "テスト用後乗せ具材",
  color: "#3f8a3a",
  emoji: "\u{1F33F}",
  placement: "scatter" as const,
  unlockCondition: { minTotalStars: 0 },
};
const synthRecipe = {
  id: SYNTH_RECIPE_ID,
  nameJa: "テスト用後乗せピザ",
  description: "test-only late-addition recipe",
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 2 },
    { ingredientId: "chicken", minCount: 2 },
    { ingredientId: SYNTH_INGREDIENT_ID, minCount: 2, applicationPhase: "POST_BAKE" as const },
  ],
  bakeTarget: { start: 60, end: 80 },
  baseRewardPitz: 100,
  lunchRush: false,
} as const;
const synthStep = { ingredientIds: [SYNTH_INGREDIENT_ID], keyRecipeId: SYNTH_RECIPE_ID };

const validInput: LateCatalogInput = {
  recipes: [synthRecipe],
  ingredients: [synthIngredient],
  ladderSteps: [synthStep],
  discoveryTargetIds: { [SYNTH_RECIPE_ID]: SYNTH_TARGET_ID },
};
const BASE = { recipeIds: ["margherita"], ingredientIds: ["tomato-sauce", "mozzarella", "chicken"] };

describe("the shipped late catalog holds no content yet", () => {
  it("is empty everywhere (E4 data is a separate PR)", () => {
    expect(LATE_RECIPES).toHaveLength(0);
    expect(LATE_INGREDIENTS).toHaveLength(0);
    expect(LATE_LADDER_STEPS).toHaveLength(0);
    expect(Object.keys(LATE_DISCOVERY_TARGET_IDS)).toHaveLength(0);
  });
});

describe("mergeLate", () => {
  const base = [{ id: "a" }, { id: "b" }] as const;
  const late = [{ id: "z" }] as const;

  it("disabled: returns the base array ITSELF, even when late content exists", () => {
    expect(mergeLate(base, late, false)).toBe(base);
  });
  it("enabled with nothing late: also the base array itself", () => {
    expect(mergeLate(base, [] as const, true)).toBe(base);
  });
  it("enabled: base first, late appended in order; the inputs are not mutated", () => {
    const merged = mergeLate(base, late, true);
    expect(merged.map((x) => x.id)).toEqual(["a", "b", "z"]);
    expect(merged[0]).toBe(base[0]);
    expect(base).toHaveLength(2);
    expect(late).toHaveLength(1);
  });
});

describe("validateLateCatalog", () => {
  it("accepts a well-formed late catalog", () => {
    expect(validateLateCatalog(BASE, validInput)).toEqual([]);
  });
  it("accepts an empty late catalog", () => {
    expect(validateLateCatalog(BASE, { recipes: [], ingredients: [], ladderSteps: [], discoveryTargetIds: {} })).toEqual([]);
  });

  const bad = (over: Partial<LateCatalogInput>, expected: RegExp) =>
    expect(validateLateCatalog(BASE, { ...validInput, ...over }).join("\n")).toMatch(expected);

  it("rejects a late recipe with no POST_BAKE requirement", () => {
    bad({ recipes: [{ ...synthRecipe, requiredIngredients: synthRecipe.requiredIngredients.filter((r) => !("applicationPhase" in r)) }] }, /no POST_BAKE requirement/);
  });
  it("rejects a late recipe that may appear in Lunch Rush", () => {
    bad({ recipes: [{ ...synthRecipe, lunchRush: undefined }] }, /lunchRush:false/);
    bad({ recipes: [{ ...synthRecipe, lunchRush: true as unknown as false }] }, /lunchRush:false/);
  });
  it("rejects a duplicate recipe id (against the base and within the late list)", () => {
    bad({ recipes: [{ ...synthRecipe, id: "margherita" }], discoveryTargetIds: { margherita: "x" }, ladderSteps: [] }, /recipe id is not unique/);
    bad({ recipes: [synthRecipe, synthRecipe] }, /recipe id is not unique/);
  });
  it("rejects a late ingredient that would become a Starter (no unlockCondition)", () => {
    bad({ ingredients: [{ id: SYNTH_INGREDIENT_ID }] }, /needs an unlockCondition/);
  });
  it("rejects a duplicate ingredient id", () => {
    bad({ ingredients: [{ ...synthIngredient, id: "mozzarella" }] }, /ingredient id is not unique/);
  });
  it("rejects a ladder step whose key recipe or materials are unknown", () => {
    bad({ ladderSteps: [{ ingredientIds: [SYNTH_INGREDIENT_ID], keyRecipeId: "margherita" }] }, /key recipe is not a late recipe/);
    bad({ ladderSteps: [{ ingredientIds: ["nope"], keyRecipeId: SYNTH_RECIPE_ID }] }, /unknown ingredient/);
  });
  it("rejects a late recipe that is unreachable and a late ingredient that is unobtainable", () => {
    bad({ ladderSteps: [] }, /unreachable/);
    bad({ ladderSteps: [] }, /unobtainable/);
  });
  it("rejects two late steps keyed to one recipe", () => {
    bad({ ladderSteps: [synthStep, synthStep] }, /share a key recipe/);
  });
  it("rejects a late recipe that requires an unknown ingredient", () => {
    bad({ recipes: [{ ...synthRecipe, requiredIngredients: [...synthRecipe.requiredIngredients, { ingredientId: "nope", minCount: 1 }] }] }, /requires an unknown ingredient: nope/);
  });
  it("rejects a discovery target id already used by an ordinary recipe", () => {
    const problems = validateLateCatalog({ ...BASE, discoveryTargetIds: [SYNTH_TARGET_ID] }, validInput);
    expect(problems.join("\n")).toMatch(/discovery target id is not unique/);
  });
  it("rejects a missing, or an orphan, discovery target id", () => {
    bad({ discoveryTargetIds: {} }, /no discovery target id/);
    bad({ discoveryTargetIds: { [SYNTH_RECIPE_ID]: SYNTH_TARGET_ID, ghost: "g" } }, /unknown late recipe/);
  });
});

/**
 * `validateLadderProgression` on a catalog, with the discovery count the runtime uses: it counts every recipe it is given, but the ladder
 * advances only for `countsTowardLadder` recipes (src/state/materialEntitlement.ts), so SOFTLOCK is judged on the credited recipes alone while
 * KEY_RECIPE / UNREACHABLE / UNUSED_MATERIAL are judged on all of them.
 */
function ladderProgressionProblems(
  ladder: Parameters<typeof validateLadderProgression>[0],
  recipes: readonly { id: string; ladderCredit?: boolean; requiredIngredients: readonly { ingredientId: string }[] }[],
  starters: readonly string[],
): string[] {
  const view = (list: typeof recipes) => list.map((r) => ({ id: r.id, ingredientIds: [...new Set(r.requiredIngredients.map((q) => q.ingredientId))] }));
  const all = validateLadderProgression(ladder, view(recipes), starters).filter((p) => !p.startsWith("SOFTLOCK"));
  const credited = recipes.filter((r) => countsTowardLadder(r.id, recipes as never));
  const softlocks = validateLadderProgression(ladder, view(credited), starters).filter((p) => p.startsWith("SOFTLOCK"));
  return [...all, ...softlocks];
}

describe("the late catalog as it would be when ON is valid (checked even though Production never loads it)", () => {
  it("passes every catalog table check and every FINISH guard (vacuous while the late catalog is empty; binds the E4 data PR)", () => {
    const late = LATE_RECIPES as unknown as readonly Recipe[];
    const lateRecipeIds = new Set<string>(late.map((r) => r.id));
    const lateIngredientIds = new Set(LATE_INGREDIENTS.map((i) => i.id));
    const baseRecipes = RECIPES.filter((r) => !lateRecipeIds.has(r.id));
    const baseIngredients = INGREDIENTS.filter((i) => !lateIngredientIds.has(i.id));
    // The ordinary ladder: when the flag is on, the late steps are already its tail.
    const baseSteps = DISCOVERY_LADDER.steps.slice(0, DISCOVERY_LADDER.steps.length - (lateCatalogEnabled() ? LATE_LADDER_STEPS.length : 0));
    const view = productionCatalogView();
    const full = {
      ...view,
      recipes: [...baseRecipes, ...late],
      ingredients: [...baseIngredients, ...LATE_INGREDIENTS],
      ladder: appendLadderSteps({ ...DISCOVERY_LADDER, steps: baseSteps }, LATE_LADDER_STEPS),
      cookingSteps: (id: string) => {
        const recipe = late.find((r) => r.id === id);
        return recipe ? deriveCoreSteps(recipe) : view.cookingSteps(id);
      },
      targetCapabilities: (id: string) => {
        const recipe = late.find((r) => r.id === id);
        return recipe ? discoveryIdentityOf(recipe).capabilities : view.targetCapabilities(id);
      },
    };
    expect(
      validateLateCatalog(
        { recipeIds: baseRecipes.map((r) => r.id), ingredientIds: baseIngredients.map((i) => i.id), discoveryTargetIds: Object.values(RECIPE_DISCOVERY_TARGET_IDS) },
        { recipes: LATE_RECIPES, ingredients: LATE_INGREDIENTS, ladderSteps: LATE_LADDER_STEPS, discoveryTargetIds: LATE_DISCOVERY_TARGET_IDS },
      ),
    ).toEqual([]);
    expect(validateCatalogTables(full)).toEqual([]);
    expect(validateFinishCatalog(full)).toEqual([]);
    // Progression: every step newly completes its key recipe, no recipe needs a material the starters and steps never provide, and no step
    // is unreachable for lack of discoveries (a late recipe needing a LATER step's material, or too few makeable recipes, fails here).
    const starters = baseIngredients.filter((i) => !i.unlockCondition).map((i) => i.id);
    expect(ladderProgressionProblems(full.ladder, full.recipes, starters)).toEqual([]);
  });

  it("the progression check bites when non-credited late recipes pad the discovery count (SOFTLOCK counts credited recipes only)", () => {
    const starters = INGREDIENTS.filter((i) => !i.unlockCondition).map((i) => i.id);
    const extras = Array.from({ length: 5 }, (_, i) => ({ id: `late-x${i}`, ladderCredit: false, requiredIngredients: [{ ingredientId: `synthetic-x${i}` }] }));
    const ladder = appendLadderSteps(DISCOVERY_LADDER, extras.map((e) => ({ ingredientIds: [e.requiredIngredients[0].ingredientId], keyRecipeId: e.id })));
    const recipes = [...(RECIPES as unknown as readonly { id: string; ladderCredit?: boolean; requiredIngredients: readonly { ingredientId: string }[] }[]), ...extras];
    // Counting every recipe would accept this ladder; counting only credited ones (the runtime rule) reports the softlock.
    const naive = validateLadderProgression(ladder, recipes.map((r) => ({ id: r.id, ingredientIds: r.requiredIngredients.map((q) => q.ingredientId) })), starters);
    expect(naive.filter((p) => p.startsWith("SOFTLOCK"))).toEqual([]);
    expect(ladderProgressionProblems(ladder, recipes, starters).filter((p) => p.startsWith("SOFTLOCK")).length).toBeGreaterThan(0);
  });

  it("the progression check bites on a late recipe that needs a LATER step's material", () => {
    const starters = INGREDIENTS.filter((i) => !i.unlockCondition).map((i) => i.id);
    const recipes = RECIPES.map((r) => ({ id: r.id as string, ingredientIds: [...new Set(r.requiredIngredients.map((q) => q.ingredientId))] }));
    const a = { id: "late-a", ingredientIds: ["synthetic-a", "synthetic-b"] };
    const ladder = appendLadderSteps(DISCOVERY_LADDER, [
      { ingredientIds: ["synthetic-a"], keyRecipeId: "late-a" },
      { ingredientIds: ["synthetic-b"], keyRecipeId: "late-b" },
    ]);
    const problems = validateLadderProgression(ladder, [...recipes, a, { id: "late-b", ingredientIds: ["synthetic-b"] }], starters);
    expect(problems.join("\n")).toMatch(/KEY_RECIPE: step \d+ does not newly complete late-a/);
  });
});

// --- Module-level ON / OFF: the real catalog modules re-evaluated with the late catalog mocked ON (synthetic content) or OFF. ---

async function loadCatalog(enabled: boolean, lateContentPresentButDisabled = false) {
  vi.resetModules();
  if (enabled || lateContentPresentButDisabled) {
    vi.doMock("./lateCatalog", async (importOriginal) => ({
      ...(await importOriginal<typeof import("./lateCatalog")>()),
      LATE_CATALOG_PRODUCTION: enabled,
      lateCatalogEnabled: () => enabled,
      LATE_RECIPES: [synthRecipe],
      LATE_INGREDIENTS: [synthIngredient],
      LATE_LADDER_STEPS: [synthStep],
      LATE_DISCOVERY_TARGET_IDS: { [SYNTH_RECIPE_ID]: SYNTH_TARGET_ID },
    }));
  } else {
    vi.doUnmock("./lateCatalog");
  }
  // Sequential on purpose: concurrent imports would run the mock factory twice and hand modules different `lateCatalog` instances.
  await import("./lateCatalog");
  const recipes = await import("./recipes");
  const ingredients = await import("./ingredients");
  const ladder = await import("./discoveryLadder");
  const catalog = await import("./discoveryCatalog");
  const persistence = await import("../state/persistence");
  const entitlement = await import("../state/materialEntitlement");
  const ladderLogic = await import("../logic/discoveryLadder");
  const profiles = await import("./cookingProfiles");
  const techniques = await import("../logic/techniques/detection");
  return { recipes, ingredients, ladder, catalog, persistence, entitlement, ladderLogic, profiles, techniques };
}

afterEach(() => {
  vi.doUnmock("./lateCatalog");
  vi.resetModules();
});

describe("late catalog ON (synthetic content) vs OFF (Production)", () => {
  it("OFF is the ordinary catalog; ON is the ordinary catalog followed by the late content, nothing reordered", async () => {
    const off = await loadCatalog(false);
    const on = await loadCatalog(true);
    const ids = (x: readonly { id: string }[]) => x.map((r) => r.id);

    expect(off.recipes.RECIPES.map((r) => r.id)).not.toContain(SYNTH_RECIPE_ID);
    expect(ids(on.recipes.RECIPES)).toEqual([...ids(off.recipes.RECIPES), SYNTH_RECIPE_ID]);
    expect(JSON.stringify(on.recipes.RECIPES.slice(0, off.recipes.RECIPES.length))).toBe(JSON.stringify(off.recipes.RECIPES));

    expect(ids(off.ingredients.INGREDIENTS)).not.toContain(SYNTH_INGREDIENT_ID);
    expect(ids(on.ingredients.INGREDIENTS)).toEqual([...ids(off.ingredients.INGREDIENTS), SYNTH_INGREDIENT_ID]);
    // A late ingredient is never a Starter (owned from the start).
    expect(on.ingredients.STARTER_INGREDIENT_IDS).toEqual(off.ingredients.STARTER_INGREDIENT_IDS);
  });

  it("ladder: ON appends the late step after every ordinary step; the OFF ladder is an exact prefix (append-only)", async () => {
    const off = await loadCatalog(false);
    const on = await loadCatalog(true);
    const offSteps = off.ladder.DISCOVERY_LADDER.steps;
    const onSteps = on.ladder.DISCOVERY_LADDER.steps;

    expect(onSteps).toHaveLength(offSteps.length + 1);
    expect(JSON.stringify(onSteps.slice(0, offSteps.length))).toBe(JSON.stringify(offSteps));
    expect(onSteps[offSteps.length]).toMatchObject({ step: offSteps.length + 1, ingredientIds: [SYNTH_INGREDIENT_ID], keyRecipeId: SYNTH_RECIPE_ID });
    expect(on.ladderLogic.validateAppendOnlyExtension(off.ladder.DISCOVERY_LADDER, on.ladder.DISCOVERY_LADDER)).toEqual([]);
    expect(on.ladderLogic.validateDiscoveryLadder(on.ladder.DISCOVERY_LADDER)).toEqual([]);

    // The late material is obtainable (through its step) only ON.
    expect(off.entitlement.obtainableIngredientIds()).not.toContain(SYNTH_INGREDIENT_ID);
    expect(on.entitlement.obtainableIngredientIds()).toContain(SYNTH_INGREDIENT_ID);
    expect(on.entitlement.ingredientUnlockStep(SYNTH_INGREDIENT_ID)).toBe(offSteps.length + 1);
    expect(off.entitlement.ingredientUnlockStep(SYNTH_INGREDIENT_ID)).toBeNull();
  });

  it("discovery catalog: the ordinary targets are untouched; the late target declares the late axis and LATE_ADDITION", async () => {
    const off = await loadCatalog(false);
    const on = await loadCatalog(true);
    const offTargets = off.catalog.RECIPE_DISCOVERY_CATALOG;
    const onTargets = on.catalog.RECIPE_DISCOVERY_CATALOG;

    expect(JSON.stringify(onTargets.slice(0, offTargets.length))).toBe(JSON.stringify(offTargets));
    expect(offTargets.some((t) => (t.recipeId as string) === SYNTH_RECIPE_ID)).toBe(false);
    const target = onTargets[onTargets.length - 1];
    expect(target).toMatchObject({
      targetId: SYNTH_TARGET_ID,
      recipeId: SYNTH_RECIPE_ID,
      capabilities: ["LATE_ADDITION"],
      identityDimensions: { late: [["POST_BAKE", [SYNTH_INGREDIENT_ID]]] },
      eligibility: { status: "ELIGIBLE" },
    });
    expect(target.items).toEqual(["chicken", "mozzarella", SYNTH_INGREDIENT_ID, "tomato-sauce"].sort());
    expect(target.sauceBase).toEqual(["tomato-sauce"]);
    // The technique the late axis stands for is required by exactly the late target.
    expect(on.techniques.requiredTechniquesOf(target)).toContain("late-addition");
    expect(onTargets.slice(0, offTargets.length).some((t) => on.techniques.requiredTechniquesOf(t).includes("late-addition"))).toBe(false);
  });

  it("the late recipe gets a FINISH step from its profile; no ordinary recipe does", async () => {
    const on = await loadCatalog(true);
    expect(on.profiles.getCookingProfile(SYNTH_RECIPE_ID as unknown as RecipeId).steps).toContain("FINISH");
    for (const recipe of on.recipes.RECIPES.slice(0, -1)) {
      expect(on.profiles.getCookingProfile(recipe.id).steps).not.toContain("FINISH");
    }
  });

  it("OFF with late content present in the source: none of it reaches any catalog (the Production leak check, non-vacuous)", async () => {
    const off = await loadCatalog(false);
    const leaky = await loadCatalog(false, true);
    expect(JSON.stringify(leaky.recipes.RECIPES)).toBe(JSON.stringify(off.recipes.RECIPES));
    expect(JSON.stringify(leaky.ingredients.INGREDIENTS)).toBe(JSON.stringify(off.ingredients.INGREDIENTS));
    expect(JSON.stringify(leaky.ladder.DISCOVERY_LADDER)).toBe(JSON.stringify(off.ladder.DISCOVERY_LADDER));
    expect(JSON.stringify(leaky.catalog.RECIPE_DISCOVERY_CATALOG)).toBe(JSON.stringify(off.catalog.RECIPE_DISCOVERY_CATALOG));
    expect(leaky.recipes.RECIPES.map((r) => r.id as string)).not.toContain(SYNTH_RECIPE_ID);
  });

  it("an enabled but malformed late catalog fails at load, instead of reaching a player", async () => {
    vi.resetModules();
    vi.doMock("./lateCatalog", async (importOriginal) => ({
      ...(await importOriginal<typeof import("./lateCatalog")>()),
      lateCatalogEnabled: () => true,
      LATE_RECIPES: [{ ...synthRecipe, lunchRush: undefined }],
      LATE_INGREDIENTS: [synthIngredient],
      LATE_LADDER_STEPS: [synthStep],
      LATE_DISCOVERY_TARGET_IDS: { [SYNTH_RECIPE_ID]: SYNTH_TARGET_ID },
    }));
    await expect(import("./discoveryCatalog")).rejects.toThrow(/Invalid late catalog[\s\S]*lunchRush:false/);
  });
});

describe("save compatibility between ON and OFF builds (the browser origin is shared)", () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      raw: (k: string) => data.get(k),
    };
  }

  it("the Dex part of a save made with late content survives an OFF build opening and writing it, and is intact again when ON reopens it", async () => {
    const on = await loadCatalog(true);
    const storage = memoryStorage();
    const lateEntry = { recipeId: SYNTH_RECIPE_ID, discovered: true, bestScore: 82, bestStars: 3, timesMade: 2 };
    const ordinaryEntry = { recipeId: "margherita", discovered: true, bestScore: 90, bestStars: 4, timesMade: 1 };
    on.persistence.persistDex([ordinaryEntry, lateEntry] as never, storage);
    expect(on.persistence.loadSave(storage).dex.some((e) => e.recipeId === SYNTH_RECIPE_ID)).toBe(true);

    // OFF build: opens it without crashing, does not show the late entry, and keeps every ordinary one.
    const off = await loadCatalog(false);
    const seenByOff = off.persistence.loadSave(storage);
    expect(seenByOff.dex.some((e) => e.recipeId === SYNTH_RECIPE_ID)).toBe(false);

    // OFF writes (a normal Dex change): the late entry stays in storage (forward-compat merge), it is only invisible.
    const first = seenByOff.dex[0];
    off.persistence.persistDex([{ ...first, timesMade: first.timesMade + 1 }, ...seenByOff.dex.slice(1)] as never, storage);
    expect(storage.raw(off.persistence.SAVE_STORAGE_KEY)).toContain(SYNTH_RECIPE_ID);

    // Back ON: the late entry is there, and the ordinary change made by OFF is kept.
    const backOn = await loadCatalog(true);
    const reopened = backOn.persistence.loadSave(storage);
    expect(reopened.dex.find((e) => e.recipeId === SYNTH_RECIPE_ID)).toEqual(lateEntry);
    expect(reopened.dex.find((e) => e.recipeId === first.recipeId)?.timesMade).toBe(first.timesMade + 1);
  });
});
