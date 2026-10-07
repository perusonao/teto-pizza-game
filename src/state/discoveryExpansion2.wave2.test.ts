import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { DISCOVERY_LADDER, POST_W1_APPENDED_STEPS, W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { HINT_CLASS_DISPLAY } from "../data/hintClassDisplay";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { ingredientAttributeFamily } from "../data/ingredientTaxonomy";
import { findOrderForRecipe } from "../data/orders";
import { RECIPE_HINT_ROLES } from "../data/recipeHintRoles";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";
import { countsTowardLadder, getRecipe, participatesInLunchRush, RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { getReferencePizza } from "../data/referencePizza";
import { HAND_ENFORCEMENT_PRODUCTION, DEFAULT_HAND_CAPACITY_PRODUCTION } from "../logic/catalog/handPolicy";
import { isCutEligible } from "../data/cookingProfiles";
import { buildHint5Ladder, isKeyFreeHintRoles } from "../logic/discovery/hint5Ladder";
import { selectHintTarget } from "../logic/discovery/hintTarget";
import { matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { materialOffer } from "../logic/materialShop";
import { discoverAll, pizzaOf, poolOf, remainingOf, walkState, W1_ORDER } from "../logic/testSupport/branchingFixture";
import { missionOrderRecipeIds } from "../mission/lunchRush";
import { resolveShopEntitlement } from "./materialEntitlement";
import { recipeChapter, recipeChapterSlot, recipeKeyStep } from "./recipeChapters";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "./recipeDiscoveryState";
import { createDefaultSave } from "./persistence";

/**
 * Expansion Wave 2: vongole (No.13) / pesto-vegetariana (No.14) / ratatouille-pizza (No.15) and the
 * materials parsley (step 27) / bell-pepper + zucchini (step 28). Focused authority pins; the real
 * production functions throughout (no mocked catalog).
 */
const IDS = ["vongole", "pesto-vegetariana", "ratatouille-pizza"] as const;
/** The non-credit onion-step recipes (calabresa, and TQ-1D's aussie): excluded where a test isolates the Wave 2 pool. */
// Outside the Wave 2 population: the two non-credit recipes, and Slice 3 pesto-trapanese (appended step 29, after this Wave).
const NON_CREDIT: readonly string[] = ["brazilian-calabresa", "aussie", "pesto-trapanese"];
const [VONGOLE, PESTO_VEG, RATATOUILLE] = IDS;
const rec = (id: string) => getRecipe(id as RecipeId)! as Recipe;
const NEW_INGREDIENTS = ["parsley", "bell-pepper", "zucchini"] as const;

/** Slice 1 (steps 1-26) path: W1, then pesto-pollo (25), pesto-gamberi (26). */
const UP_TO_GAMBERI = [...W1_ORDER, "pesto-pollo", "pesto-gamberi"]; // 27 credited discoveries -> step 27 reached
const UP_TO_VONGOLE = [...UP_TO_GAMBERI, VONGOLE]; // 28 credited discoveries -> step 28 reached

const stateAfter = (found: readonly string[], bought: readonly string[] = []): RecipeDiscoveryInputs => {
  const dex = discoverAll(found);
  const unlocked = resolveShopEntitlement(dex, [], []).unlockedForShopIngredientIds;
  const owned = [...STARTER_INGREDIENT_IDS, ...unlocked.filter((m) => !(NEW_INGREDIENTS as readonly string[]).includes(m) || bought.includes(m))];
  return { dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: unlocked, inventory: Object.fromEntries(owned.map((m) => [m, 10])) };
};

describe("Expansion Wave 2 authoring: exact production data", () => {
  it("counts: recipes 28 -> 31, ingredients 31 -> 34, toppings 24 -> 27, ladder 26 -> 28, credited 27 -> 30, chapters 6 / 10 / 15 (TQ-1D then appends the non-credit aussie: 32 recipes, chapters 6 / 11 / 15)", () => {
      });

  it("RECIPES declaration order: pesto-gamberi (No.28) is followed by vongole, pesto-vegetariana, ratatouille-pizza", () => {
    expect(RECIPES[27].id).toBe("pesto-gamberi");
    expect(RECIPES.slice(28, 31).map((r) => r.id)).toEqual([...IDS]);
    expect(RECIPES.filter((r) => IDS.includes(r.id as never))).toHaveLength(3);
  });

  it("exactly the 3 new ingredients are appended after shrimp, in order (existing catalog untouched)", () => {
    expect(INGREDIENTS.slice(31, 34).map((i) => i.id)).toEqual([...NEW_INGREDIENTS]);
    expect(INGREDIENTS[30].id).toBe("shrimp");
  });

  it("vongole: owner decisions (name / description / order / exact identity / bake / reward)", () => {
    const r = rec(VONGOLE);
    expect(r.nameJa).toBe("ヴォンゴレピザ");
    expect(r.description).toBe("オリーブオイルを塗った生地に、あさりとにんにく、パセリをのせた、磯の香りのシンプルな一枚。");
    expect(findOrderForRecipe(VONGOLE as RecipeId)).toMatchObject({
      requestedBy: "mito",
      lineJa: "あさりとパセリのヴォンゴレピザ、香りがよさそう！食べてみたいな！",
    });
    expect(r.requiredIngredients).toEqual([
      { ingredientId: "olive-oil", minCount: 1 },
      { ingredientId: "clam", minCount: 3 },
      { ingredientId: "garlic", minCount: 2 },
      { ingredientId: "parsley", minCount: 2 },
    ]);
    expect(r.requiredIngredients.some((q) => getIngredient(q.ingredientId)!.category === "cheese")).toBe(false);
    expect(r.bakeTarget).toEqual({ start: 62, end: 82 });
    expect(r.baseRewardPitz).toBe(100);
  });

  it("pesto-vegetariana: owner decisions (name / description / order / exact identity / bake / reward)", () => {
    const r = rec(PESTO_VEG);
    expect(r.nameJa).toBe("ペストベジタリアーナピザ");
    expect(r.description).toBe("ジェノベーゼソースにナス、ズッキーニ、パプリカ、モッツァレラを合わせた、香り豊かな野菜の一枚。");
    expect(findOrderForRecipe(PESTO_VEG as RecipeId)).toMatchObject({
      requestedBy: "mito",
      lineJa: "ズッキーニとパプリカのペストベジタリアーナピザ、彩りがきれい！食べてみたいな！",
    });
    expect(r.requiredIngredients).toEqual([
      { ingredientId: "pesto", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "eggplant", minCount: 2 },
      { ingredientId: "zucchini", minCount: 2 },
      { ingredientId: "bell-pepper", minCount: 2 },
    ]);
    expect(r.bakeTarget).toEqual({ start: 50, end: 70 });
    expect(r.baseRewardPitz).toBe(100);
  });

  it("ratatouille-pizza: owner decisions (name / description / order / exact identity / bake / reward)", () => {
    const r = rec(RATATOUILLE);
    expect(r.nameJa).toBe("ラタトゥイユピザ");
    expect(r.description).toBe("トマトソースにナス、ズッキーニ、パプリカ、オレガノをのせた、プロヴァンス風の彩り野菜の一枚。");
    expect(findOrderForRecipe(RATATOUILLE as RecipeId)).toMatchObject({
      requestedBy: "mito",
      lineJa: "ナスとズッキーニのラタトゥイユピザ、野菜がたっぷりでおいしそう！食べてみたいな！",
    });
    expect(r.requiredIngredients).toEqual([
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "eggplant", minCount: 2 },
      { ingredientId: "zucchini", minCount: 2 },
      { ingredientId: "bell-pepper", minCount: 2 },
      { ingredientId: "oregano", minCount: 1 },
    ]);
    expect(r.requiredIngredients.some((q) => getIngredient(q.ingredientId)!.category === "cheese")).toBe(false);
    expect(r.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(r.baseRewardPitz).toBe(100);
  });

  it("no identity collision: all 32 identities (ingredient set + counts) are unique and each new recipe matches only itself", () => {
    const keys = RECIPES.map((r) => JSON.stringify([...r.requiredIngredients].map((q) => [q.ingredientId, q.minCount]).sort()));
    expect(new Set(keys).size).toBe(RECIPES.length);
    expect(new Set(RECIPE_DISCOVERY_CATALOG.map((t) => t.items.join("|"))).size).toBe(RECIPES.length);
    for (const id of IDS) {
      const m = matchDiscovery(signatureOfPizza(pizzaOf(rec(id).requiredIngredients.map((q) => q.ingredientId))), RECIPE_DISCOVERY_CATALOG);
      expect(m.kind, id).toBe("UNIQUE_MATCH");
      expect(m.kind === "UNIQUE_MATCH" && m.target.recipeId, id).toBe(id);
    }
  });

  it("discovery targets (PIZZA DB evidence ids) and sauce bases", () => {
    const by = (id: string) => RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === id);
    expect(by(VONGOLE)).toMatchObject({ targetId: "vongole-pizzadb", sauceBase: ["olive-oil"], items: ["clam", "garlic", "olive-oil", "parsley"] });
    expect(by(PESTO_VEG)).toMatchObject({ targetId: "pesto-vegetariana-pizzadb-p12", sauceBase: ["pesto"] });
    expect(by(RATATOUILLE)).toMatchObject({ targetId: "ratatouille-pizza-pizzadb-p13", sauceBase: ["tomato-sauce"] });
  });

  it("Reference: every new recipe's pieces fit the 8-slot ring in requiredIngredients order", () => {
    const shape = (id: string) => getReferencePizza(id as RecipeId)!.pieceGroups.map((g) => [g.ingredientId, g.positions.length]);
    expect(shape(VONGOLE)).toEqual([["clam", 3], ["garlic", 2], ["parsley", 2]]);
    expect(shape(PESTO_VEG)).toEqual([["mozzarella", 2], ["eggplant", 2], ["zucchini", 2], ["bell-pepper", 2]]);
    expect(shape(RATATOUILLE)).toEqual([["eggplant", 2], ["zucchini", 2], ["bell-pepper", 2], ["oregano", 1]]);
    for (const id of IDS) {
      expect(getReferencePizza(id)!.pieceGroups.reduce((n, g) => n + g.positions.length, 0), id).toBeLessThanOrEqual(8);
    }
  });
});

describe("Expansion Wave 2: new ingredients (glyph / taxonomy / roast / economy derivation)", () => {
  it("parsley ☘️ (U+2618 U+FE0F) herb, bakeRoastResistant; bell-pepper 🫑 and zucchini 🥒 vegetable", () => {
    expect(getIngredient("parsley")).toMatchObject({ category: "topping", nameJa: "パセリ", emoji: "\u{2618}\u{FE0F}", placement: "scatter", bakeRoastResistant: true });
    expect(getIngredient("bell-pepper")).toMatchObject({ category: "topping", nameJa: "パプリカ", emoji: "\u{1FAD1}", placement: "scatter" });
    expect(getIngredient("zucchini")).toMatchObject({ category: "topping", nameJa: "ズッキーニ", emoji: "\u{1F952}", placement: "scatter" });
    expect(getIngredient("bell-pepper")!.bakeRoastResistant).toBeUndefined();
    expect(getIngredient("zucchini")!.bakeRoastResistant).toBeUndefined();
    expect(ingredientAttributeFamily("parsley")).toBe("herb");
    expect(ingredientAttributeFamily("bell-pepper")).toBe("vegetable");
    expect(ingredientAttributeFamily("zucchini")).toBe("vegetable");
  });

  it("G18: no Hint class symbol equals any ingredient glyph (new glyphs included); no label contains an ingredient name", () => {
    const glyphs = new Set(INGREDIENTS.map((i) => i.emoji));
    for (const d of Object.values(HINT_CLASS_DISPLAY)) {
      expect(glyphs.has(d.symbol), d.symbol).toBe(false);
      for (const i of INGREDIENTS) expect(d.labelJa.includes(i.nameJa), `${d.labelJa} / ${i.nameJa}`).toBe(false);
    }
    expect(new Set(INGREDIENTS.map((i) => i.emoji)).size).toBeGreaterThan(0);
    for (const id of NEW_INGREDIENTS) expect(INGREDIENTS.filter((i) => i.emoji === getIngredient(id)!.emoji).map((i) => i.id), id).toEqual([id]);
  });

  it("economy is derived, never hand-written: step 27 / 28, T3, first 100 / refill 50, k = 2 -> pack 20; no legacy price, restock or starter grant", () => {
    expect(materialOffer(getIngredient("parsley")!)).toEqual({ ingredientId: "parsley", step: 27, tier: "T3", k: 2, packQuantity: 20, packPrice: 100, refillPrice: 50 });
    expect(materialOffer(getIngredient("bell-pepper")!)).toEqual({ ingredientId: "bell-pepper", step: 28, tier: "T3", k: 2, packQuantity: 20, packPrice: 100, refillPrice: 50 });
    expect(materialOffer(getIngredient("zucchini")!)).toEqual({ ingredientId: "zucchini", step: 28, tier: "T3", k: 2, packQuantity: 20, packPrice: 100, refillPrice: 50 });
    for (const id of NEW_INGREDIENTS) {
      const i = getIngredient(id)!;
      expect(i.pricePitz, id).toBeUndefined();
      expect(i.restockQuantity, id).toBeUndefined();
      expect(i.starterGrantOnly, id).toBeUndefined();
      expect(STARTER_INGREDIENT_IDS, id).not.toContain(id);
    }
  });

  it("no recipe unlockCondition (new recipes are gated only by their materials)", () => {
    for (const id of IDS) expect(rec(id).unlockCondition).toBeUndefined();
  });
});

describe("Expansion Wave 2 ladder: steps 27 / 28 appended; steps 1..26 frozen", () => {
  it("appended steps: 27 = parsley -> vongole, 28 = bell-pepper + zucchini -> pesto-vegetariana; steps 1..26 byte-identical", () => {
    expect(POST_W1_APPENDED_STEPS.slice(0, 5)).toEqual([
      { ingredientIds: ["chicken"], keyRecipeId: "pesto-pollo" },
      { ingredientIds: ["shrimp"], keyRecipeId: "pesto-gamberi" },
      { ingredientIds: ["parsley"], keyRecipeId: VONGOLE },
      { ingredientIds: ["bell-pepper", "zucchini"], keyRecipeId: PESTO_VEG },
      { ingredientIds: ["almond"], keyRecipeId: "pesto-trapanese" }, // Expansion Slice 3, appended after Wave 2
    ]);
    expect(DISCOVERY_LADDER.steps.slice(0, 24)).toEqual(W1_25_DISCOVERY_LADDER.steps);
    expect(DISCOVERY_LADDER.steps[24]).toEqual({ step: 25, kind: "MATERIAL", ingredientIds: ["chicken"], keyRecipeId: "pesto-pollo" });
    expect(DISCOVERY_LADDER.steps[25]).toEqual({ step: 26, kind: "MATERIAL", ingredientIds: ["shrimp"], keyRecipeId: "pesto-gamberi" });
    expect(DISCOVERY_LADDER.steps[26]).toEqual({ step: 27, kind: "MATERIAL", ingredientIds: ["parsley"], keyRecipeId: VONGOLE });
    expect(DISCOVERY_LADDER.steps[27]).toEqual({ step: 28, kind: "MATERIAL", ingredientIds: ["bell-pepper", "zucchini"], keyRecipeId: PESTO_VEG });
  });

  it("chapter 3, No.13-15; key steps 27 / 28 / 28", () => {
    expect([VONGOLE, PESTO_VEG, RATATOUILLE].map((id) => [recipeChapter(rec(id)), recipeChapterSlot(rec(id)), recipeKeyStep(rec(id))])).toEqual([
      [3, 13, 27],
      [3, 14, 28],
      [3, 15, 28],
    ]);
  });

  it("ladderCredit true for all 3 (key rung or not): 27 -> 30 credited; the non-credit recipes stay calabresa and (TQ-1D) aussie", () => {
    for (const id of IDS) {
      expect(rec(id).ladderCredit, id).toBeUndefined();
      expect(countsTowardLadder(id), id).toBe(true);
    }
    expect((RECIPES as readonly Recipe[]).filter((r) => r.ladderCredit === false).map((r) => r.id)).toEqual(["brazilian-calabresa", "aussie"]);
  });

  it("states: vongole UNKNOWN before step 27, KBMM until parsley is bought, DISCOVERABLE after", () => {
    expect(recipeDiscoveryState(rec(VONGOLE), stateAfter(UP_TO_GAMBERI.slice(0, 26), ["parsley"]))).toBe("UNKNOWN");
    expect(recipeDiscoveryState(rec(VONGOLE), stateAfter(UP_TO_GAMBERI, []))).toBe("KNOWN_BUT_MISSING_MATERIAL");
    expect(recipeDiscoveryState(rec(VONGOLE), stateAfter(UP_TO_GAMBERI, ["parsley"]))).toBe("DISCOVERABLE");
  });

  it("Branching Discovery: step 28 makes pesto-vegetariana AND ratatouille-pizza DISCOVERABLE together (pool 2, both credited)", () => {
    const bought = ["bell-pepper", "zucchini"];
    const before = stateAfter(UP_TO_GAMBERI, ["parsley"]); // step 27 reached, step 28 not yet
    expect(poolOf(before).filter((id) => id === PESTO_VEG || id === RATATOUILLE)).toEqual([]);
    const s = stateAfter(UP_TO_VONGOLE, ["parsley", ...bought]);
    expect(poolOf(s).filter((id) => (IDS as readonly string[]).includes(id)).sort()).toEqual([PESTO_VEG, RATATOUILLE]);
    // The intended pool-2 state: nothing is named (privacy), the target is chosen by the player.
    expect(selectHintTarget(s, { recipes: RECIPES.filter((r) => !NON_CREDIT.includes(r.id)) }).kind).toBe("OPEN_POOL");
    // KBMM until BOTH new materials are bought: ratatouille needs both bell-pepper and zucchini.
    expect(recipeDiscoveryState(rec(RATATOUILLE), stateAfter(UP_TO_VONGOLE, ["parsley", "bell-pepper"]))).toBe("KNOWN_BUT_MISSING_MATERIAL");
    // Discovering either one leaves the other as the lone remaining target (the intended Branching Discovery).
    for (const [first, rest] of [[PESTO_VEG, RATATOUILLE], [RATATOUILLE, PESTO_VEG]] as const) {
      const after = stateAfter([...UP_TO_VONGOLE, first], ["parsley", ...bought]);
      expect(poolOf(after).filter((id) => (IDS as readonly string[]).includes(id)), first).toEqual([rest]);
      expect(selectHintTarget(after, { recipes: RECIPES.filter((r) => !NON_CREDIT.includes(r.id)) })).toMatchObject({ kind: "TARGET", recipeId: rest });
    }
  });

  it("progression has no softlock: every recipe is discovered by repeatedly picking any DISCOVERABLE one (all pick policies)", () => {
    for (const pick of [(p: string[]) => p[0], (p: string[]) => p[p.length - 1]]) {
      const order: string[] = ["margherita"];
      for (let guard = 0; guard < 100; guard += 1) {
        const s = walkState(order);
        const left = remainingOf(s);
        if (left.length === 0) break;
        const pool = poolOf(s);
        expect(pool.length, `after ${order.length} discoveries`).toBeGreaterThan(0);
        order.push(pick(pool));
      }
      expect(new Set(order).size).toBe(RECIPES.length);
      expect(remainingOf(walkState(order))).toEqual([]);
    }
  });
});

describe("Expansion Wave 2: sauce mapping, CUT, Lunch Rush, Hint 5.0, save", () => {
  it("vongole's olive-oil is its OWN sauce-slot mapping (PAINT_TEMPORARY, like pizza-bianca) -- not a no-sauce rule (TQ-1D's aussie is the one sauceless recipe, with a null profile)", () => {
    expect(getRecipeSauceProfile(VONGOLE as RecipeId)).toMatchObject({ ingredientId: "olive-oil", interaction: "PAINT_TEMPORARY" });
    expect(getRecipeSauceProfile("pizza-bianca" as RecipeId)).toMatchObject({ ingredientId: "olive-oil", interaction: "PAINT_TEMPORARY" });
    expect(getRecipeSauceProfile(PESTO_VEG as RecipeId)).toMatchObject({ ingredientId: "pesto", interaction: "PAINT" });
    expect(getRecipeSauceProfile(RATATOUILLE as RecipeId)).toMatchObject({ ingredientId: "tomato-sauce", interaction: "PAINT" });
    // olive-oil is a sauce-category ingredient, so vongole has exactly one sauce; only TQ-1D's aussie has none.
    expect(getIngredient("olive-oil")!.category).toBe("sauce");
    for (const r of RECIPES) {
      expect(r.requiredIngredients.filter((q) => getIngredient(q.ingredientId)!.category === "sauce"), r.id).toHaveLength(r.id === "aussie" ? 0 : 1);
    }
  });

  it("no CUT for any new recipe", () => {
    for (const id of IDS) expect(isCutEligible(id as RecipeId), id).toBe(false);
  });

  it("Lunch Rush: all 3 opt out (lunchRush false), opt-out total = 7 (with TQ-1D aussie), never in the mission pool", () => {
    for (const id of IDS) {
      expect(rec(id).lunchRush, id).toBe(false);
      expect(participatesInLunchRush(id), id).toBe(false);
    }
    expect((RECIPES as readonly Recipe[]).filter((r) => r.lunchRush === false)).toHaveLength(8);
    const all = INGREDIENTS.map((i) => i.id);
    const pool = missionOrderRecipeIds({
      dex: discoverAll(RECIPES.map((r) => r.id)),
      ownedIngredientIds: all,
      inventory: Object.fromEntries(all.map((i) => [i, 30])),
    });
    for (const id of IDS) expect(pool).not.toContain(id);
  });

  it("Hint is key-free: no hintKeyToppingId, no KEY_TOPPING rung, every non-structure rung names something", () => {
    for (const id of IDS) {
      expect(RECIPE_HINT_ROLES[id as RecipeId], id).toEqual({ keyFree: true });
      expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[id as RecipeId]), id).toBe(true);
      const kinds = buildHint5Ladder(id)!.rungs.map((r) => r.kind);
      expect(kinds, id).not.toContain("KEY_TOPPING");
      for (const r of buildHint5Ladder(id)!.rungs) if (r.kind !== "STRUCTURE") expect(r.subjectIds.length, `${id}/${r.kind}`).toBeGreaterThan(0);
    }
    // The cheese-less recipes never get a CHEESE rung (absence is never read off the RESULT).
    expect(buildHint5Ladder(VONGOLE)!.rungs.map((r) => r.kind)).not.toContain("CHEESE");
    expect(buildHint5Ladder(RATATOUILLE)!.rungs.map((r) => r.kind)).not.toContain("CHEESE");
  });

  it("save schema is unchanged (v2) and HAND capacity stays 12", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
    expect(HAND_ENFORCEMENT_PRODUCTION).toBe(false); // All-Owned Cooking Tray: the HAND is off in production
    expect(DEFAULT_HAND_CAPACITY_PRODUCTION).toBe(12);
  });
});
