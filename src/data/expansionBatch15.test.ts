import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { ordinaryLadderSteps, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { researchCohortLetters, researchEntryLabel } from "../logic/discovery/researchEntry";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { discoveredRecipeIds, EMPTY_DEX, registerScoreToDex } from "../state/dex";
import matrix from "../../docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json";

/**
 * Expansion Batch 15 (Issue #728): nigerian-suya-pizza. PROVISIONAL SPEC: the original pizzadb.jp page was NOT confirmed (unreachable), and the only evidence is the 172 matrix row
 * `nigerian-suya-pizza-pizzadb-p5` (comparison table p5, relayed 2026-09-22, never independently re-fetched). Its source sauce field is 'その他' (BASE_SAUCE_UNSPECIFIED).
 *
 * SUYA-ONLY EXCEPTION (Owner decision 2026-11-02): NO_SAUCE is approved for THIS recipe only. It is NOT a general rule that an unspecified sauce field means NO_SAUCE, and no other
 * unspecified-sauce row (caponata, goulash, ume-shiso, ...) is approved by it. The same Owner decision approves, for this recipe only, a differentiation exception: its nearest neighbour
 * (rendang-pizza) shares three of four ingredients (Jaccard 0.60, above the 0.4 criterion B12 pinned for jamaican-jerk). The GLOBAL 0.4 criterion is NOT changed here; what is pinned instead is
 * the structural guarantee that matters to the matcher: no other recipe has the same ingredient set, and none is a subset or a superset of it.
 *
 * The counts (mozzarella 2 / beef 3 / green-pepper 1 / onion 2 = 8 pieces), the generic 58-78 bake window and "every piece is placed before the bake" are GAMEPLAY ASSUMPTIONS / CALIBRATION
 * (Owner: provisionally approved). The suya spice is not in the source ingredient list and is NOT modelled (no spice step exists). No new material, technique or ladder step.
 */
const ID = "nigerian-suya-pizza";
const recipe = RECIPES.find((r) => r.id === ID)! as Recipe;
const COUNTS = { mozzarella: 2, beef: 3, "green-pepper": 1, onion: 2 };
const ORDINARY = ordinaryRecipes(RECIPES);

const idsOf = (r: Recipe) => r.requiredIngredients.map((q) => q.ingredientId as string);
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};

describe(ID, () => {
  it("has the matrix ingredient set (beef / green-pepper / mozzarella / onion) with the provisional 8-piece counts and NO sauce requirement", () => {
    expect(Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual(COUNTS);
    expect(recipe.requiredIngredients.reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(recipe.requiredIngredients.some((q) => getIngredient(q.ingredientId)?.category === "sauce")).toBe(false);
  });

  it("is a non-credit, Lunch Rush opt-out, key-free, no-CUT ordinary recipe with the generic bake window and every requirement placed before the bake", () => {
    expect(recipe.ladderCredit).toBe(false);
    expect(recipe.lunchRush).toBe(false);
    expect(isCutEligible(ID)).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true); // no POST_BAKE piece: the source states no timing
    expect(RECIPE_HINT_ROLES[ID]).toEqual({ keyFree: true });
    expect(recipe.unlockCondition).toBeUndefined();
  });

  it("is NO_SAUCE (the existing `null` mapping) and its Reference has no sauce", () => {
    expect(getRecipeSauceProfile(ID)).toBeNull();
    expect(noSauceRecipeIds().includes(ID)).toBe(true);
    expect(getReferencePizza(ID)!.sauce).toBeNull();
  });

  it("its Reference has 8 pieces on the RT-01 ring in requiredIngredients order, matching the required counts", () => {
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(recipe.requiredIngredients.map((q) => q.ingredientId));
    for (const g of ref.pieceGroups) expect(g.positions.length).toBe(COUNTS[g.ingredientId as keyof typeof COUNTS]);
  });

  it("invents no spice step or spice ingredient: the recipe uses only the four source ingredients (the suya spice is not in the source list)", () => {
    expect(idsOf(recipe).sort()).toEqual(["beef", "green-pepper", "mozzarella", "onion"]);
    expect(INGREDIENTS.some((i) => /suya|yaji/i.test(i.id))).toBe(false);
  });
});

describe("the Batch 15 differentiation (suya-only exception; the global 0.4 criterion is untouched)", () => {
  it("no other recipe (late catalog included) has this ingredient set, and none is a subset or a superset of it", () => {
    const key = (ids: readonly string[]) => [...ids].sort().join("|");
    const mine = idsOf(recipe);
    expect(RECIPES.filter((r) => key(idsOf(r)) === key(mine)).map((r) => r.id)).toEqual([ID]);
    const mineSet = new Set(mine);
    for (const other of RECIPES) {
      if (other.id === ID) continue;
      const theirs = new Set(idsOf(other));
      expect([...theirs].every((i) => mineSet.has(i)) || mine.every((i) => theirs.has(i)), `${ID} vs ${other.id}`).toBe(false);
    }
  });

  it("exactly two ordinary recipes are at or above the 0.4 Jaccard criterion, and both are named: rendang-pizza (0.60, the approved exception) and tandoori-paneer-pizza (0.50)", () => {
    const near = ORDINARY.filter((r) => r.id !== ID)
      .map((r) => ({ id: r.id, j: jaccard(idsOf(recipe), idsOf(r)) }))
      .filter((x) => x.j >= 0.4)
      .sort((a, b) => b.j - a.j);
    expect(near.map((x) => x.id)).toEqual(["rendang-pizza", "tandoori-paneer-pizza"]);
    expect(near[0].j).toBeCloseTo(0.6, 5);
    expect(near[1].j).toBeCloseTo(0.5, 5);
  });

  it("the identity includes the (absent) sauce: rendang-pizza paints curry-ketchup, suya has none, so neither cooks the other's pizza", () => {
    expect(getRecipeSauceProfile("rendang-pizza")).toMatchObject({ ingredientId: "curry-ketchup" });
    expect(getRecipeSauceProfile(ID)).toBeNull();
  });
});

describe("no new material, technique or ladder step", () => {
  it("adds no ladder step of its own: no step is keyed to it and the ordinary ladder is unchanged (73 steps in total are pinned in catalogLedger.test.ts)", () => {
    expect(DISCOVERY_LADDER.steps.some((s) => s.keyRecipeId === ID)).toBe(false);
    const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
    expect(steps[57]).toMatchObject({ step: 58, ingredientIds: ["beef"], keyRecipeId: "rendang-pizza" });
    expect(steps[65]).toMatchObject({ step: 66, ingredientIds: ["cinnamon"], keyRecipeId: "moussaka-style-pizza" }); // (Expansion Batch 16 appended the ordinary step 67 after it)
  });
  it("every ingredient already exists, and beef (ordinary step 58) is the last one unlocked", () => {
    for (const q of recipe.requiredIngredients) expect(getIngredient(q.ingredientId), q.ingredientId).toBeDefined();
    const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
    const stepOf = (id: string) => steps.find((s) => s.ingredientIds.includes(id))?.step ?? 0; // 0 = starter
    expect(recipe.requiredIngredients.map((q) => [q.ingredientId, stepOf(q.ingredientId)]).sort((a, b) => (a[1] as number) - (b[1] as number))).toEqual([
      ["mozzarella", 0],
      ["onion", 12],
      ["green-pepper", 32],
      ["beef", 58],
    ]);
  });
});

describe("the discovery target is the four matrix ids (Owner exception: the unspecified sauce field read as NO_SAUCE for this ONE recipe)", () => {
  const rows = (matrix as { rows: { evidenceId: string; productDecisionStatus: string; sauceBase: { status: string }; blockers: { type: string }[]; ingredients: { canonicalIngredientIds: string[]; complete: boolean } }[] }).rows;
  const row = rows.find((r) => r.evidenceId === "nigerian-suya-pizza-pizzadb-p5")!;

  it("the matrix row is unchanged (still BLOCKED_PRODUCT_DECISION: BASE_SAUCE_UNSPECIFIED) -- the shipped NO_SAUCE is an Owner exception, not a source fact", () => {
    expect(row.productDecisionStatus).toBe("BLOCKED_PRODUCT_DECISION");
    expect(row.sauceBase.status).toBe("unspecified");
    expect(row.blockers.map((b) => b.type)).toEqual(["BASE_SAUCE_UNSPECIFIED"]);
    expect([...row.ingredients.canonicalIngredientIds].sort()).toEqual(["beef", "green-pepper", "mozzarella", "onion"]);
  });

  it("the runtime target is the four matrix ids with no sauce base", () => {
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.targetId).toBe("nigerian-suya-pizza-pizzadb-p5");
    expect([...target.items].sort()).toEqual(["beef", "green-pepper", "mozzarella", "onion"]);
    expect(target.sauceBase ?? []).toEqual([]);
  });

  it("the exception is not generalised: other unspecified-sauce HOLD / candidate rows are not shipped (caponata, tsukimi, pesto-genovese, goulash; ume-shiso-pizza and goulash-pizza were shipped later by their OWN Owner-approved Batches 16 / 17)", () => {
    const shipped = new Set(RECIPES.map((r) => r.id as string));
    for (const held of ["caponata-pizza", "tsukimi-pizza", "pesto-genovese-pizza"]) expect(shipped.has(held), held).toBe(false);
  });
});

/** A pizza that physically recreates the Reference (no sauce, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(bakeResult = 66): PizzaState {
  const reference = getReferencePizza(ID)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [],
    toppings: reference.pieceGroups.flatMap((group, gi) => group.positions.map((p, i) => ({ id: `${ID}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }))),
    bakeResult,
  } as PizzaState;
}

describe(`${ID}: Free Cooking / Research round (Completion Gate, discovery)`, () => {
  it("a perfect round passes the Completion Gate", () => {
    expect(evaluatePizzaCompletion(recipe, referenceLikePizza())).toEqual({ status: "PASS" });
  });

  it("cooked with exactly its ingredients and no sauce it is a UNIQUE_MATCH -> NEW_DISCOVERY, and a Dex that has it does not announce it again", () => {
    const sig = signatureOfPizza(referenceLikePizza());
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: ID } });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
    const dex = registerScoreToDex(EMPTY_DEX, ID, { total: 70, stars: 3, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 }).dex;
    expect(discoveredRecipeIds(dex)).toEqual([ID]);
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [ID])).not.toMatchObject({ kind: "NEW_DISCOVERY" });
  });

  it("resolveFreeCookPizza discovers it from exactly the four ids (any positive counts)", () => {
    const r = resolveFreeCookPizza(referenceLikePizza(), EMPTY_DEX);
    expect(r.kind).toBe("MATCHED");
    if (r.kind === "MATCHED") expect(r.outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
  });

  it("a sauce, a missing ingredient or an extra ingredient makes it an ORIGINAL pizza; with curry-ketchup it is NOT rendang's pizza either (the exact set decides)", () => {
    const base = referenceLikePizza();
    const variants: Record<string, PizzaState> = {
      "tomato sauce": { ...base, sauceIds: ["tomato-sauce"] } as PizzaState,
      "curry-ketchup (rendang's base plus green-pepper)": { ...base, sauceIds: ["curry-ketchup"] } as PizzaState,
      "no green-pepper": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "green-pepper") } as PizzaState,
      "no beef": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "beef") } as PizzaState,
      "extra anchovy": { ...base, toppings: [...base.toppings, { id: "x", ingredientId: "anchovy", x: 50, y: 50 }] } as PizzaState,
    };
    for (const [label, pizza] of Object.entries(variants)) expect(resolveFreeCookPizza(pizza, EMPTY_DEX).kind, label).toBe("ORIGINAL");
  });

  it("rendang's own pizza (curry-ketchup, no green-pepper) is still rendang, and is not captured by suya", () => {
    const rendang = { ...referenceLikePizza(), sauceIds: ["curry-ketchup"], toppings: referenceLikePizza().toppings.filter((t) => t.ingredientId !== "green-pepper") } as PizzaState;
    const sig = signatureOfPizza(rendang);
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: "rendang-pizza" } });
  });

  it("a raw or burnt bake is a FAILED round, not an original pizza", () => {
    expect(resolveFreeCookPizza(referenceLikePizza(30), EMPTY_DEX).kind).toBe("FAILED");
    expect(resolveFreeCookPizza(referenceLikePizza(95), EMPTY_DEX).kind).toBe("FAILED");
  });
});

describe("unlock and Research label (Owner-approved change to rendang-pizza)", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const withoutSuya = ORDINARY.filter((r) => r.id !== ID);

  it("is makeable only once beef is owned (step 58)", () => {
    const owned = (until: string) => [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, ladderMaterials.indexOf(until) + (until === "beef" ? 1 : 0))];
    expect(researchCohortLetters(owned("beef"), ORDINARY).has(ID)).toBe(true);
    expect(researchCohortLetters(owned("beef").filter((m) => m !== "beef"), ORDINARY).has(ID)).toBe(false);
  });

  it("the beef cohort becomes {nigerian-suya-pizza, rendang-pizza}: suya takes A and rendang-pizza B (rendang was unlettered); label shapes stay 'unlock material + letter only'", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, ladderMaterials.indexOf("beef") + 1)];
    const now = researchCohortLetters(owned, ORDINARY);
    const before = researchCohortLetters(owned, withoutSuya);
    expect(before.has("rendang-pizza")).toBe(false);
    expect(now.get(ID)).toBe("A");
    expect(now.get("rendang-pizza")).toBe("B");
    expect(researchEntryLabel({ unlockIngredientId: "beef", cohortLetter: null })).toBe("？？？ピザ（牛肉）");
    expect(researchEntryLabel({ unlockIngredientId: "beef", cohortLetter: now.get(ID) ?? null })).toBe("？？？ピザ A（牛肉）");
    expect(researchEntryLabel({ unlockIngredientId: "beef", cohortLetter: now.get("rendang-pizza") ?? null })).toBe("？？？ピザ B（牛肉）");
  });

  it("at EVERY ladder prefix the only pre-existing recipe whose letter changes is rendang-pizza (null -> B); no other recipe moves", () => {
    const moved = new Set<string>();
    for (let n = 0; n <= ladderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, n)];
      const now = researchCohortLetters(owned, ORDINARY);
      const before = researchCohortLetters(owned, withoutSuya);
      for (const r of withoutSuya) if (now.get(r.id) !== before.get(r.id)) moved.add(`${r.id}:${before.get(r.id) ?? "-"}->${now.get(r.id) ?? "-"}`);
    }
    expect([...moved]).toEqual(["rendang-pizza:-->B"]);
  });

  it("random purchase orders: a letter, once given, never changes", () => {
    let s = 20261102;
    const random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let o = 0; o < 40; o += 1) {
      const perm = [...ladderMaterials];
      for (let i = perm.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      const seen = new Map<string, string>();
      for (let n = 0; n <= perm.length; n += 1) {
        for (const [id, letter] of researchCohortLetters([...STARTER_INGREDIENT_IDS, ...perm.slice(0, n)], ORDINARY)) {
          const prev = seen.get(id);
          if (prev !== undefined) expect(letter, `${id} order ${o} prefix ${n}`).toBe(prev);
          seen.set(id, letter);
        }
      }
    }
  });
});
