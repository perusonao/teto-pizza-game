import { describe, expect, it } from "vitest";
import {
  DISCOVERY_LADDER,
  POST_W1_APPENDED_STEPS,
  W1_25_DISCOVERY_LADDER,
  W1_FIXED_STEP_COUNT,
  type DiscoveryLadder,
} from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "../state/persistence";
import {
  appendLadderSteps,
  ladderUnlockedMaterialIds,
  materialIdsOfSteps,
  nextLadderStep,
  reachedStepNumber,
  resolveMaterialUnlocks,
  validateAppendOnlyExtension,
  validateDiscoveryLadder,
  validateLadderProgression,
  type LadderProgressionRecipe,
} from "./discoveryLadder";
import {
  REC04_STARTERS,
  REC04_W1_25_LADDER_FIXTURE,
  buildAppendOnlyLadder,
  buildKeyRecipeLadder,
  toMaterialLadder,
  type LadderRecipe,
} from "./testSupport/discoveryLadderRule";

/**
 * LAD-1 (Issue #261, Owner Decision OD-W2-1): the append-only Discovery Ladder.
 *
 * - W1 steps 1..24 are frozen: never regenerated, never reordered.
 * - New unlocks are appended after step 24.
 * - Existing saves keep their meaning: the next unlock of a mid-W1 save is unchanged and a
 *   W1-complete save reaches the appended steps.
 * - softlock = 0, duplicate unlock = 0, unreachable = 0.
 * - Unknown (future) material ids survive in the entitlement ledger and in storage.
 */

const PRODUCTION: LadderRecipe[] = RECIPES.map((r) => ({
  id: r.id,
  ingredientIds: r.requiredIngredients.map((q) => q.ingredientId),
}));

/** The W1 population: production minus the appended-step recipes (No.27 pesto-pollo needs `chicken`,
 *  Expansion Slice 1 pesto-gamberi needs `shrimp`; W1 sells neither). The synthetic extension tests below extend THIS, so they keep exercising
 *  "a W1 ladder + a hypothetical addition" independent of the real appended step. */
/** Recipes behind the appended ladder steps 25-28 (chicken / shrimp / parsley / bell-pepper + zucchini);
 *  ratatouille-pizza becomes makeable at step 28 but is nobody's key recipe. */
const POST_W1_RECIPE_IDS: readonly string[] = ["pesto-pollo", "pesto-gamberi", "vongole", "pesto-vegetariana", "ratatouille-pizza"];
const PRODUCTION_W1: LadderRecipe[] = PRODUCTION.filter((r) => !POST_W1_RECIPE_IDS.includes(r.id));

/** A recipe made only of W1 materials and a starter (the TQ-1 Aussie shape). Since TQ-1D the real `aussie` is
 *  one too (and adds no ladder step); this synthetic copy keeps the extension tests independent of it. */
const SYN_ALL_W1: LadderRecipe = { id: "syn-all-w1", ingredientIds: ["bacon", "egg", "mozzarella", "onion"] };
/** Two recipes that need materials W1 does not sell (a Wave-2-shaped addition, synthetic). */
const SYN_NEW_A: LadderRecipe = { id: "syn-new-a", ingredientIds: ["syn-mat-a", "mozzarella", "tomato-sauce"] };
const SYN_NEW_B: LadderRecipe = { id: "syn-new-b", ingredientIds: ["syn-mat-a", "syn-mat-b", "onion", "mozzarella"] };

function stepKey(ladder: DiscoveryLadder): string[] {
  return ladder.steps.map((s) => `${s.step}:${s.ingredientIds.join("+")}->${s.keyRecipeId}`);
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { raw(): Record<string, unknown> } {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    raw: () => JSON.parse(data.get(SAVE_STORAGE_KEY) ?? "{}") as Record<string, unknown>,
  };
}

describe("LAD-1: the W1 steps 1..24 are frozen", () => {
  it("the production ladder starts with the 24 W1 steps, unchanged", () => {
    expect(W1_FIXED_STEP_COUNT).toBe(24);
    expect(W1_25_DISCOVERY_LADDER.steps).toHaveLength(W1_FIXED_STEP_COUNT);
    expect(DISCOVERY_LADDER.steps.slice(0, W1_FIXED_STEP_COUNT)).toEqual(W1_25_DISCOVERY_LADDER.steps);
    expect(W1_25_DISCOVERY_LADDER.steps).toEqual(REC04_W1_25_LADDER_FIXTURE.steps);
    expect(validateAppendOnlyExtension(W1_25_DISCOVERY_LADDER, DISCOVERY_LADDER)).toEqual([]);
  });

  it("appends exactly four steps (No.27: 25 chicken -> pesto-pollo; Expansion Slice 1: 26 shrimp -> pesto-gamberi; Wave 2: 27 parsley -> vongole, 28 bell-pepper + zucchini -> pesto-vegetariana); every other production recipe is makeable from the starters + W1 materials", () => {
    expect(POST_W1_APPENDED_STEPS).toEqual([
      { ingredientIds: ["chicken"], keyRecipeId: "pesto-pollo" },
      { ingredientIds: ["shrimp"], keyRecipeId: "pesto-gamberi" },
      { ingredientIds: ["parsley"], keyRecipeId: "vongole" },
      { ingredientIds: ["bell-pepper", "zucchini"], keyRecipeId: "pesto-vegetariana" },
    ]);
    expect(DISCOVERY_LADDER.steps).toHaveLength(28);
    expect(DISCOVERY_LADDER.steps[24]).toEqual({ step: 25, kind: "MATERIAL", ingredientIds: ["chicken"], keyRecipeId: "pesto-pollo" });
    expect(DISCOVERY_LADDER.steps[25]).toEqual({ step: 26, kind: "MATERIAL", ingredientIds: ["shrimp"], keyRecipeId: "pesto-gamberi" });
    expect(DISCOVERY_LADDER.steps[26]).toEqual({ step: 27, kind: "MATERIAL", ingredientIds: ["parsley"], keyRecipeId: "vongole" });
    expect(DISCOVERY_LADDER.steps[27]).toEqual({
      step: 28,
      kind: "MATERIAL",
      ingredientIds: ["bell-pepper", "zucchini"],
      keyRecipeId: "pesto-vegetariana",
    });
    expect(DISCOVERY_LADDER.populationId).toBe("w1-25");
    // W1-only population (without pesto-pollo) appends nothing.
    expect(buildAppendOnlyLadder(W1_25_DISCOVERY_LADDER, PRODUCTION_W1)).toEqual(W1_25_DISCOVERY_LADDER);
  });

  it("equals the append-only REC-04 rule over the production recipes", () => {
    // The recipe-id tie-break alone would order pesto-gamberi before pesto-pollo; steps 1..25 are
    // frozen, so step 25 (chicken) is fixed and only steps 26-28 are derived.
    const fixed25 = { ...W1_25_DISCOVERY_LADDER, steps: DISCOVERY_LADDER.steps.slice(0, 25) };
    expect(DISCOVERY_LADDER).toEqual(buildAppendOnlyLadder(fixed25, PRODUCTION));
    expect(validateAppendOnlyExtension(fixed25, DISCOVERY_LADDER)).toEqual([]);
  });

  it("the production ladder has no softlock, duplicate unlock or unreachable recipe", () => {
    expect(validateDiscoveryLadder(DISCOVERY_LADDER)).toEqual([]);
    expect(validateLadderProgression(DISCOVERY_LADDER, PRODUCTION, STARTER_INGREDIENT_IDS)).toEqual([]);
  });
});

describe("LAD-1: adding content never reorders W1", () => {
  it("a recipe made of W1 materials only adds no step (append-only) ...", () => {
    const next = buildAppendOnlyLadder(W1_25_DISCOVERY_LADDER, [...PRODUCTION_W1, SYN_ALL_W1]);
    expect(next.steps).toHaveLength(24);
    expect(next).toEqual(W1_25_DISCOVERY_LADDER);
    expect(validateLadderProgression(next, [...PRODUCTION_W1, SYN_ALL_W1], REC04_STARTERS)).toEqual([]);
  });

  it("... while a full regeneration would reorder W1 from step 3 (negative control, the reason for OD-W2-1)", () => {
    const regenerated = toMaterialLadder("regen", buildKeyRecipeLadder([...PRODUCTION_W1, SYN_ALL_W1]));
    expect(stepKey(regenerated).slice(0, 2)).toEqual(stepKey(W1_25_DISCOVERY_LADDER).slice(0, 2));
    // The real Aussie (TQ-1D) is made of W1 materials only too, and its id sorts before the synthetic one.
    expect(regenerated.steps[2]).toMatchObject({ step: 3, ingredientIds: ["onion"], keyRecipeId: "aussie" });
    expect(validateAppendOnlyExtension(W1_25_DISCOVERY_LADDER, regenerated).length).toBeGreaterThan(0);
  });

  it("new materials are appended after step 24, W1 materials are never unlocked again", () => {
    const population = [...PRODUCTION_W1, SYN_ALL_W1, SYN_NEW_A, SYN_NEW_B];
    const next = buildAppendOnlyLadder(W1_25_DISCOVERY_LADDER, population, "w2-synthetic");
    expect(validateAppendOnlyExtension(W1_25_DISCOVERY_LADDER, next)).toEqual([]);
    expect(stepKey(next).slice(24)).toEqual(["25:syn-mat-a->syn-new-a", "26:syn-mat-b->syn-new-b"]);
    expect(next.populationId).toBe("w2-synthetic");
    expect(validateDiscoveryLadder(next)).toEqual([]);
    expect(validateLadderProgression(next, population, REC04_STARTERS)).toEqual([]);
    const w1Materials = new Set(materialIdsOfSteps(W1_25_DISCOVERY_LADDER.steps));
    for (const step of next.steps.slice(24)) {
      for (const id of step.ingredientIds) expect(w1Materials.has(id)).toBe(false);
    }
  });

  it("appendLadderSteps renumbers from base + 1 and does not mutate its inputs", () => {
    const base = structuredClone(W1_25_DISCOVERY_LADDER);
    const appended = [{ ingredientIds: ["syn-mat-a"], keyRecipeId: "syn-new-a" }];
    const snapshot = structuredClone(appended);
    const next = appendLadderSteps(base, appended);
    expect(next.steps[24]).toEqual({ step: 25, kind: "MATERIAL", ingredientIds: ["syn-mat-a"], keyRecipeId: "syn-new-a" });
    expect(base).toEqual(W1_25_DISCOVERY_LADDER);
    expect(appended).toEqual(snapshot);
    expect(next.populationId).toBe(base.populationId);
  });
});

describe("LAD-1: existing save semantics", () => {
  const population = [...PRODUCTION_W1, SYN_NEW_A, SYN_NEW_B];
  const extended = buildAppendOnlyLadder(W1_25_DISCOVERY_LADDER, population, "w2-synthetic");

  it("every mid-W1 save keeps its next unlock and its unlocked materials", () => {
    for (let count = 0; count < W1_FIXED_STEP_COUNT; count += 1) {
      expect(nextLadderStep(extended, count)).toEqual(nextLadderStep(W1_25_DISCOVERY_LADDER, count));
      expect(ladderUnlockedMaterialIds(extended, count)).toEqual(ladderUnlockedMaterialIds(W1_25_DISCOVERY_LADDER, count));
      expect(reachedStepNumber(extended, count)).toBe(reachedStepNumber(W1_25_DISCOVERY_LADDER, count));
    }
  });

  it("a W1-complete save (25 discoveries) moves into the first appended step", () => {
    const w1Ledger = materialIdsOfSteps(W1_25_DISCOVERY_LADDER.steps);
    expect(reachedStepNumber(W1_25_DISCOVERY_LADDER, 25)).toBe(24);
    expect(reachedStepNumber(extended, 25)).toBe(25);
    const resolved = resolveMaterialUnlocks({ ladder: extended, discoveredCount: 25, alreadyUnlockedMaterialIds: w1Ledger });
    expect(resolved.newlyUnlockedMaterialIds).toEqual(["syn-mat-a"]);
    expect(resolved.unlockedMaterialIds.slice(0, w1Ledger.length)).toEqual(w1Ledger);
    expect(nextLadderStep(extended, 25)?.ingredientIds).toEqual(["syn-mat-b"]);
  });

  it("an older ladder never re-locks what an appended step already granted (unknown future ids survive)", () => {
    const granted = [...materialIdsOfSteps(W1_25_DISCOVERY_LADDER.steps), "syn-mat-a"];
    const onOldLadder = resolveMaterialUnlocks({ ladder: W1_25_DISCOVERY_LADDER, discoveredCount: 25, alreadyUnlockedMaterialIds: granted });
    expect(onOldLadder.unlockedMaterialIds).toContain("syn-mat-a");
    expect(onOldLadder.newlyUnlockedMaterialIds).toEqual([]);
  });

  it("a future material id in the stored entitlement ledger survives a load + write of this build", () => {
    const storage = memoryStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 2,
        dex: [],
        pitzBalance: 0,
        ownedIngredientIds: [],
        missionBest: {},
        inventory: {},
        starterGrantClaimedRecipeIds: [],
        unlockedForShopIngredientIds: ["egg", "future-material"],
      }),
    });
    const save = loadSave(storage);
    expect(save.unlockedForShopIngredientIds).toEqual(["egg"]);
    persistProgress({ ...save, pitzBalance: 10, unlockedForShopIngredientIds: ["egg", "bacon"] }, storage);
    expect(storage.raw().unlockedForShopIngredientIds).toEqual(["egg", "bacon", "future-material"]);
  });
});

describe("LAD-1: validators catch broken ladders (adversarial)", () => {
  const base = W1_25_DISCOVERY_LADDER;

  it("detects a reordered, edited or shortened fixed section", () => {
    const swapped: DiscoveryLadder = {
      ...base,
      steps: base.steps.map((s, i) => (i === 0 ? { ...base.steps[1], step: 1 } : i === 1 ? { ...base.steps[0], step: 2 } : s)),
    };
    expect(validateAppendOnlyExtension(base, swapped)).toEqual(["FIXED_STEP_CHANGED: step 1", "FIXED_STEP_CHANGED: step 2"]);
    const edited: DiscoveryLadder = {
      ...base,
      steps: base.steps.map((s) => (s.step === 11 ? { ...s, ingredientIds: ["oregano", "black-olive"] } : s)),
    };
    expect(validateAppendOnlyExtension(base, edited)).toEqual(["FIXED_STEP_CHANGED: step 11"]);
    const rekeyed: DiscoveryLadder = {
      ...base,
      steps: base.steps.map((s) => (s.step === 5 ? { ...s, keyRecipeId: "margherita" } : s)),
    };
    expect(validateAppendOnlyExtension(base, rekeyed)).toEqual(["FIXED_STEP_CHANGED: step 5"]);
    // Codex review on #268: two fixed step objects swapped in place while keeping their own
    // `step` numbers -- re-sorting by `step` would hide this, authored order must not.
    const movedObjects: DiscoveryLadder = {
      ...base,
      steps: [base.steps[1], base.steps[0], ...base.steps.slice(2)],
    };
    expect(validateAppendOnlyExtension(base, movedObjects)).toEqual(["FIXED_STEP_CHANGED: step 1", "FIXED_STEP_CHANGED: step 2"]);
    const movedIntoAppended: DiscoveryLadder = {
      ...base,
      steps: [...base.steps.slice(1), base.steps[0]],
    };
    expect(validateAppendOnlyExtension(base, movedIntoAppended).length).toBeGreaterThan(0);
    const shortened: DiscoveryLadder = { ...base, steps: base.steps.slice(0, 23) };
    expect(validateAppendOnlyExtension(base, shortened)).toEqual(["FIXED_STEP_REMOVED: 24 fixed steps, next has 23"]);
  });

  it("detects a duplicate unlock (a W1 material appended again)", () => {
    const dup = appendLadderSteps(base, [{ ingredientIds: ["egg"], keyRecipeId: "syn-new-a" }]);
    expect(validateDiscoveryLadder(dup)).toEqual(["ingredient egg appears in step 1 and step 25"]);
  });

  it("detects a starter sold as a ladder material and an unused (dead) material", () => {
    const population: LadderProgressionRecipe[] = [...PRODUCTION_W1, SYN_NEW_A];
    const bad = appendLadderSteps(base, [{ ingredientIds: ["basil", "syn-mat-a", "syn-unused"], keyRecipeId: "syn-new-a" }]);
    const problems = validateLadderProgression(bad, population, REC04_STARTERS);
    expect(problems).toContain("STARTER_IN_LADDER: basil (step 25)");
    expect(problems).toContain("UNUSED_MATERIAL: syn-unused (step 25)");
  });

  it("detects an unreachable recipe", () => {
    const problems = validateLadderProgression(base, [...PRODUCTION_W1, SYN_NEW_A], REC04_STARTERS);
    expect(problems).toEqual(["UNREACHABLE: syn-new-a needs syn-mat-a"]);
  });

  it("detects a useless step (its key recipe was already makeable) and an unknown key recipe", () => {
    const population = [...PRODUCTION_W1, SYN_NEW_A, SYN_NEW_B];
    const useless = appendLadderSteps(base, [
      { ingredientIds: ["syn-mat-a"], keyRecipeId: "margherita" },
      { ingredientIds: ["syn-mat-b"], keyRecipeId: "nope" },
    ]);
    const problems = validateLadderProgression(useless, population, REC04_STARTERS);
    expect(problems).toContain("KEY_RECIPE: step 25 does not newly complete margherita");
    expect(problems).toContain("KEY_RECIPE: step 26 names unknown recipe nope");
  });

  it("detects a softlock (a step needs more discoveries than the earlier steps make possible)", () => {
    const recipes: LadderProgressionRecipe[] = [
      { id: "r0", ingredientIds: ["s"] },
      { id: "r1", ingredientIds: ["a", "s"] },
      { id: "r2", ingredientIds: ["b", "s"] },
      { id: "r3", ingredientIds: ["a", "b", "c"] },
    ];
    // Step 3 needs 3 discoveries; before it only r0, r1, r2 exist => fine. Step 4 would need 4.
    const ok: DiscoveryLadder = {
      populationId: "syn",
      steps: [
        { step: 1, kind: "MATERIAL", ingredientIds: ["a"], keyRecipeId: "r1" },
        { step: 2, kind: "MATERIAL", ingredientIds: ["b"], keyRecipeId: "r2" },
        { step: 3, kind: "MATERIAL", ingredientIds: ["c"], keyRecipeId: "r3" },
      ],
    };
    expect(validateLadderProgression(ok, recipes, ["s"])).toEqual([]);
    const softlocked: DiscoveryLadder = {
      populationId: "syn",
      steps: [
        { step: 1, kind: "MATERIAL", ingredientIds: ["a"], keyRecipeId: "r1" },
        { step: 2, kind: "MATERIAL", ingredientIds: ["c"], keyRecipeId: "r3" },
        { step: 3, kind: "MATERIAL", ingredientIds: ["b"], keyRecipeId: "r2" },
      ],
    };
    // Before step 2 only r0, r1 are makeable (2 >= 2, fine) but step 2 does not complete r3 (needs b);
    // before step 3 only r0, r1 are makeable (2 < 3): softlock.
    const problems = validateLadderProgression(softlocked, recipes, ["s"]);
    expect(problems).toContain("SOFTLOCK: step 3 needs 3 discoveries, only 2 recipes are makeable before it");
    expect(problems).toContain("KEY_RECIPE: step 2 does not newly complete r3");
  });
});
