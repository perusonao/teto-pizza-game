import { describe, expect, it } from "vitest";
import { getCookingProfile, isCutEligible } from "./cookingProfiles";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { DISCOVERY_LADDER, W1_25_DISCOVERY_LADDER } from "./discoveryLadder";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { countsTowardLadder, getRecipe, participatesInLunchRush, RECIPES, type Recipe } from "./recipes";
import { findOrderForRecipe } from "./orders";
import { getReferencePizza } from "./referencePizza";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { buildHint5Ladder, isKeyFreeHintRoles } from "../logic/discovery/hint5Ladder";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { classifyNearMiss } from "../logic/discovery/nearMiss";
import { researchResultRows } from "../logic/discovery/researchResultRows";
import { signatureOfPizza } from "../logic/discovery/signature";
import { REFERENCE_SLOT_MAX_RADIUS } from "../logic/pizzaReferenceLayout";
import { computeScoringV2 } from "../logic/scoringV2";
import { discoverAll, walkState, W1_ORDER } from "../logic/testSupport/branchingFixture";
import { researchEntryViews } from "../state/discoveryHint";
import { STARTER_INGREDIENT_IDS } from "./ingredients";
import { buildIdealSquareSauceFixture } from "../logic/pan/squareReference";
import { requiredSauceIds } from "../logic/testSupport/requiredSauces";
import { effectivePanShape } from "../logic/pan/effectivePan";
import { missionOrderRecipeIds } from "../mission/lunchRush";
import { recipeDiscoveryState } from "../state/recipeDiscoveryState";
import { recipeChapter, recipeChapterSlot } from "../state/recipeChapters";
import { EMPTY_DEX } from "../state/dex";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { createDefaultSave, loadSave, persistDex, SAVE_STORAGE_KEY, type StorageLike } from "../state/persistence";
import { commit, finishedPizza, ringBatch, run, sauceStepState } from "../state/testSupport/sauceKindFixtures";

/**
 * Multi-Sauce S3 / Square Dough E-2 (Issue #521): authoring and behaviour pins for `grandma-pizza` -- the first recipe with TWO required sauces
 * (tomato-sauce = the primary / Reference sauce, olive-oil = the secondary, judged by presence) and the first whose own pan is the square tray
 * (`panShape: "square"`, discovery identity `pan: "tray"`). Counts and the bake window are GAMEPLAY CALIBRATION, not source authority; the source
 * facts (Owner-relayed, 2026-10-24) and the game's simplifications are recorded on the recipe row in recipes.ts.
 */
const ID = "grandma-pizza";
const recipe = getRecipe(ID as Recipe["id"])!;

const ideal = () => ringBatch(50, 50, 25, 46);
const oneTick = () => ringBatch(50, 50, 25, 1);

/** The finished pizza as a Free Cooking / Research round cooks it: on the tray (□) unless `pan` says otherwise. */
function pizzaOf(...actions: ReturnType<typeof commit>[]): PizzaState {
  return { ...finishedPizza(recipe, run(sauceStepState(recipe), actions).pizza), pan: "tray" };
}
const roundPizzaOf = (...actions: ReturnType<typeof commit>[]): PizzaState => ({ ...pizzaOf(...actions), pan: null });

describe("grandma-pizza authoring", () => {
  it("is production recipe No.64, appended after New Sauces Phase B-1 (the earlier 63 keep their order)", () => {
    expect(RECIPES.findIndex((r) => r.id === ID)).toBe(63);
    expect(recipe.nameJa).toBe("グランマピザ");
    // the description names no timing, origin or pan (the source facts are Owner-relayed; no wording is approved)
    expect(recipe.description).toBe("トマトソースとオリーブオイルに、モッツァレラとにんにくをのせた、シンプルな一枚。");
    expect(recipe.description).not.toMatch(/焼く前|焼いた後|塗った生地|ロングアイランド|長方形|天板|薄/);
  });

  it("uses the Owner-fixed composition: tomato-sauce 1 / olive-oil 1 / mozzarella 3 / garlic 2, bake 56-76 (provisional)", () => {
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "olive-oil", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 3 },
      { ingredientId: "garlic", minCount: 2 },
    ]);
    expect(recipe.bakeTarget).toEqual({ start: 56, end: 76 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(requiredSauceIds(ID)).toEqual(["tomato-sauce", "olive-oil"]);
  });

  it("E-AC1: the recipe is on the square pan AND its target declares pan: tray, together (no late-bound halves)", () => {
    expect((recipe as { panShape?: string }).panShape).toBe("square");
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.identityDimensions.pan).toBe("tray");
    expect(target.capabilities).toEqual([]);
    // no other recipe is on the tray
    expect(RECIPES.filter((r) => "panShape" in r).map((r) => r.id)).toEqual([ID]);
    expect(RECIPE_DISCOVERY_CATALOG.filter((t) => t.identityDimensions.pan !== null).map((t) => t.recipeId)).toEqual([ID]);
  });

  it("is non-credit (ladderCredit:false) and out of Lunch Rush; the ladder is untouched (no new step)", () => {
    expect(recipe.ladderCredit).toBe(false);
    expect(recipe.lunchRush).toBe(false);
    expect(countsTowardLadder(ID)).toBe(false);
    expect(participatesInLunchRush(ID)).toBe(false);
    expect(missionOrderRecipeIds({ dex: EMPTY_DEX } as never)).not.toContain(ID);
    expect(DISCOVERY_LADDER.steps.slice(0, 24)).toEqual(W1_25_DISCOVERY_LADDER.steps);
    expect(DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)).not.toContain(ID);
  });

  it("uses only existing ingredients and has no CUT", () => {
    expect(isCutEligible(ID as Recipe["id"])).toBe(false);
    expect(getCookingProfile(ID as Recipe["id"]).steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
  });

  it("every production table has its row: primary sauce profile (tomato-sauce), ORDERS entry, discovery target, Reference", () => {
    expect(getRecipeSauceProfile(ID as Recipe["id"])).toEqual({ recipeId: ID, ingredientId: "tomato-sauce", interaction: "PAINT" });
    expect(findOrderForRecipe(ID as Recipe["id"])?.id).toBe("order-grandma-pizza");
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.targetId).toBe("grandma-pizza-pizzadb");
    expect(target.items).toEqual(["garlic", "mozzarella", "olive-oil", "tomato-sauce"]);
    expect(target.sauceBase).toEqual(["olive-oil", "tomato-sauce"]);
    expect(getReferencePizza(ID)?.sauce).toMatchObject({ ingredientId: "tomato-sauce" });
  });

  it("the Reference pieces (mozzarella 3, garlic 2) sit on distinct square-grid slots inside the pan, within the approved slot radius", () => {
    const reference = getReferencePizza(ID)!;
    expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([["mozzarella", 3], ["garlic", 2]]);
    const all = reference.pieceGroups.flatMap((g) => g.positions);
    expect(new Set(all.map((p) => `${p.x},${p.y}`)).size).toBe(5);
    for (const p of all) expect(Math.hypot(p.x - 50, p.y - 50)).toBeLessThanOrEqual(REFERENCE_SLOT_MAX_RADIUS);
  });

  it("Hint 5.0: key-free; ONE SAUCE rung naming both sauces, then CHEESE, STRUCTURE and a SUB_CLASS per topping (OD-544-3)", () => {
    expect(RECIPE_HINT_ROLES[ID as Recipe["id"]]).toEqual({ keyFree: true });
    expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[ID as Recipe["id"]])).toBe(true);
    const rungs = buildHint5Ladder(ID)!.rungs;
    expect(rungs.filter((r) => r.kind === "SAUCE")).toHaveLength(1);
    expect([...rungs.find((r) => r.kind === "SAUCE")!.subjectIds].sort()).toEqual(["olive-oil", "tomato-sauce"]);
    expect(rungs.map((r) => r.kind)).not.toContain("KEY_TOPPING");
    // the ladder never says pan / tray / technique (the pan is not hinted at)
    expect(JSON.stringify(rungs)).not.toMatch(/tray|pan|天板|技|テクニック/);
  });
});

describe("grandma-pizza progression: makeable from ladder step 14, a branching pool beside marinara", () => {
  it("is not makeable at step 13 (garlic missing) and DISCOVERABLE together with marinara at step 14", () => {
    const poolAt = (n: number) => RECIPES.filter((r) => recipeDiscoveryState(r, walkState(W1_ORDER.slice(0, n))) === "DISCOVERABLE").map((r) => r.id);
    expect(poolAt(13)).not.toContain(ID);
    expect(poolAt(14)).toContain(ID);
    expect(poolAt(14)).toContain("marinara");
  });

  it("chapter / No. identity: it is the last slot of chapter 2 (key step 14); every earlier recipe keeps its slot (it is appended, so none moves)", () => {
    const before = RECIPES.filter((r) => r.id !== ID);
    expect(recipeChapter(recipe)).toBe(2);
    expect(recipeChapterSlot(recipe)).toBe(RECIPES.filter((r) => recipeChapter(r) === 2).length);
    for (const r of before) {
      expect(recipeChapterSlot(r, undefined), r.id).toBe(recipeChapterSlot(r, before));
    }
  });

  it("finding it never advances the ladder (ladderCredit:false)", () => {
    const before = walkState(W1_ORDER.slice(0, 14));
    const after = walkState([...W1_ORDER.slice(0, 14), ID]);
    expect(after.ladderCount).toBe(before.ladderCount);
    expect(after.unlockedForShopIngredientIds).toEqual(before.unlockedForShopIngredientIds);
  });
});

describe("grandma-pizza on the tray: two sauces, the real reducer, Completion Gate and discovery", () => {
  it("the recipe's own pan is square, so every pan-aware surface (geometry, metrics, Reference) takes the tray path", () => {
    expect(effectivePanShape(recipe, createEmptyPizza())).toBe("square");
  });

  it("tomato then olive-oil keeps both sauces on the pizza, each with its own deposits (the ledger is per kind)", () => {
    const pizza = pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal()));
    expect([...pizza.sauceIds].sort()).toEqual(["olive-oil", "tomato-sauce"]);
    expect(pizza.sauceDeposits.filter((d) => (d as { ingredientId?: string }).ingredientId === "tomato-sauce").length).toBeGreaterThan(0);
    expect(pizza.sauceDeposits.filter((d) => (d as { ingredientId?: string }).ingredientId === "olive-oil").length).toBeGreaterThan(0);
  });

  it("both orders (tomato -> oil, oil -> tomato) pass the Completion Gate; the oil is judged by presence (one tick passes)", () => {
    for (const actions of [
      [commit("tomato-sauce", ideal()), commit("olive-oil", ideal())],
      [commit("olive-oil", ideal()), commit("tomato-sauce", ideal())],
      [commit("tomato-sauce", ideal()), commit("olive-oil", oneTick())],
    ]) {
      expect(evaluatePizzaCompletion(recipe, pizzaOf(...actions)).status).toBe("PASS");
    }
  });

  it("a missing sauce FAILS: tomato only (no oil), oil only (no tomato), and a faint tomato still fails its quantity floor", () => {
    expect(evaluatePizzaCompletion(recipe, pizzaOf(commit("tomato-sauce", ideal())))).toMatchObject({ status: "FAILED", reason: "MISSING_REQUIRED_INGREDIENT", ingredientId: "olive-oil" });
    expect(evaluatePizzaCompletion(recipe, pizzaOf(commit("olive-oil", ideal())))).toMatchObject({ status: "FAILED", ingredientId: "tomato-sauce" });
    expect(evaluatePizzaCompletion(recipe, pizzaOf(commit("tomato-sauce", oneTick()), commit("olive-oil", ideal())))).toMatchObject({ status: "FAILED", reason: "INSUFFICIENT_SAUCE", ingredientId: "tomato-sauce" });
  });

  it("Scoring 2.0 measures the tomato on the square pan against the square Reference: the ideal square painting scores a full sauce quantity / coverage match", () => {
    const pizza = { ...pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", oneTick())), sauceDeposits: buildIdealSquareSauceFixture().map((d) => ({ ...d, ingredientId: "tomato-sauce" })), bakeResult: 66 };
    const sauce = computeScoringV2(recipe, pizza).components.sauce;
    expect(sauce.available).toBe(true);
    if (sauce.available) {
      expect(sauce.quantitySimilarity).toBeGreaterThan(0.95);
      expect(sauce.coverageSimilarity).toBeGreaterThan(0.95);
    }
  });

  it("E-AC3: cooked on the tray with its exact ingredients it is discovered as grandma-pizza only (UNIQUE_MATCH -> NEW_DISCOVERY)", () => {
    const both = signatureOfPizza(pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal())));
    expect(matchDiscovery(both, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: ID } });
    expect(evaluateDiscovery(both, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
    const tomatoOnly = matchDiscovery(signatureOfPizza(pizzaOf(commit("tomato-sauce", ideal()))), RECIPE_DISCOVERY_CATALOG);
    expect(tomatoOnly.kind === "UNIQUE_MATCH" ? tomatoOnly.target.recipeId : null).not.toBe(ID);
    const withPesto = signatureOfPizza(pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", oneTick()), commit("pesto", oneTick())));
    expect(matchDiscovery(withPesto, RECIPE_DISCOVERY_CATALOG).kind).toBe("NO_MATCH");
  });

  it("E-AC2: cooked round (pan absent / null) the exact same ingredients are NOT a discovery -- ORIGINAL, no new recipe", () => {
    for (const round of [roundPizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal())), (() => { const p = { ...roundPizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal())) }; delete (p as { pan?: unknown }).pan; return p; })()]) {
      const outcome = evaluateDiscovery(signatureOfPizza(round), RECIPE_DISCOVERY_CATALOG, []);
      expect(outcome.kind).toBe("ORIGINAL");
      expect(matchDiscovery(signatureOfPizza(round), RECIPE_DISCOVERY_CATALOG).kind).toBe("NO_MATCH");
    }
  });

  it("E-AC4: on the tray, another recipe's ingredients are ORIGINAL (the tray does not discover anything else)", () => {
    const margheritaOnTray = { ...createEmptyPizza(), pan: "tray" as const, sauceIds: ["tomato-sauce"], toppings: ["mozzarella", "basil"].map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 40 + i * 6, y: 50 })) };
    expect(evaluateDiscovery(signatureOfPizza(margheritaOnTray), RECIPE_DISCOVERY_CATALOG, []).kind).toBe("ORIGINAL");
  });

  it("near-miss never points at grandma-pizza for a round pizza, and does for a tray pizza one ingredient short", () => {
    const short = (pan: "tray" | null): PizzaState => ({ ...createEmptyPizza(), pan, sauceIds: ["tomato-sauce", "olive-oil"], toppings: [{ id: "g", ingredientId: "garlic", x: 40, y: 50 }, { id: "g2", ingredientId: "garlic", x: 44, y: 50 }] }); // (no mozzarella: one ingredient short)
    expect(classifyNearMiss(signatureOfPizza(short(null)), [recipe])).toBeNull();
    expect(classifyNearMiss(signatureOfPizza(short("tray")), [recipe])).toMatchObject({ kind: "ADD_ONE", distance: 1 });
  });

  it("Research rows: both sauces are POSITIVE for the grandma target, and a one-sauce target still sees the oil as NEGATIVE", () => {
    const pizza = { sauceIds: ["tomato-sauce", "olive-oil"], toppings: [] };
    expect(researchResultRows({ targetRecipeId: ID, pizza, knownIngredientIds: [] }).rows).toEqual([
      { ingredientId: "tomato-sauce", category: "sauce", verdict: "POSITIVE" },
      { ingredientId: "olive-oil", category: "sauce", verdict: "POSITIVE" },
    ]);
    expect(researchResultRows({ targetRecipeId: "margherita", pizza, knownIngredientIds: [] }).rows).toEqual([
      { ingredientId: "tomato-sauce", category: "sauce", verdict: "POSITIVE" },
      { ingredientId: "olive-oil", category: "sauce", verdict: "NEGATIVE" },
    ]);
  });
});

describe("grandma-pizza and the Research cohort letters (OD-544-4/5/6)", () => {
  const ladderOwned = (step: number): string[] => [...STARTER_INGREDIENT_IDS, ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds)];
  const keysBefore = (step: number): string[] => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
  const labelsAt = (step: number): Record<string, string> =>
    Object.fromEntries(researchEntryViews({ dex: discoverAll(keysBefore(step)), ownedIngredientIds: ladderOwned(step) }).map((v) => [v.recipeId, v.label]));

  it("the garlic cohort (marinara's step 14): before grandma-pizza is makeable marinara is bare; at step 14 marinara reads A and grandma-pizza B -- the one accepted letter shift", () => {
    // step 13: no garlic yet -> no garlic cohort entry is open for grandma-pizza (olive-oil 13 only)
    expect(Object.keys(labelsAt(13))).not.toContain(ID);
    const at14 = labelsAt(14);
    expect(at14.marinara).toBe("？？？ピザ A（にんにく）");
    expect(at14[ID]).toBe("？？？ピザ B（にんにく）");
  });

  it("the letters are display identifiers derived from the anonymous hash order, deterministic for the same input, and name neither the pan nor the technique", () => {
    expect(labelsAt(14)).toEqual(labelsAt(14));
    for (const label of Object.values(labelsAt(14))) expect(label).not.toMatch(/天板|四角|tray|pan|グランマ/);
  });
});

describe("grandma-pizza and existing saves", () => {
  const fakeStorage = (initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } => {
    const store = new Map(Object.entries(initial));
    return {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
      dump: () => Object.fromEntries(store),
    };
  };

  it("keeps the save schema at v2 and a save made before grandma-pizza loads unchanged", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
    const dex = discoverAll(W1_ORDER.slice(0, 20));
    const storage = fakeStorage();
    persistDex(dex, storage);
    const before = storage.dump()[SAVE_STORAGE_KEY];
    const loaded = loadSave(storage);
    expect(loaded.dex).toEqual(dex);
    expect(loaded.dex.map((e) => e.recipeId)).not.toContain(ID);
    expect(storage.dump()[SAVE_STORAGE_KEY]).toBe(before); // loading never rewrites the save
  });

  it("a Dex entry for grandma-pizza round-trips through the save (and stores no pan / tray field)", () => {
    const dex = discoverAll([...W1_ORDER.slice(0, 14), ID]);
    const storage = fakeStorage();
    persistDex(dex, storage);
    expect(loadSave(storage).dex).toEqual(dex);
    expect(loadSave(storage).dex.map((e) => e.recipeId)).toContain(ID);
    expect(storage.dump()[SAVE_STORAGE_KEY]).not.toMatch(/"pan"|panShape/);
  });
});
