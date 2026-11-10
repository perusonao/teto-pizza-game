import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { getCookingProfile, isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { LATE_ENTITLEMENT_FLOORS } from "./lateCatalog";
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
 * Expansion Batch 17 (Issue #741): goulash-pizza + one new material, `sour-cream`. PROVISIONAL SPEC: the original pizzadb.jp page was NOT confirmed (unreachable); the only evidence is the 172 matrix row `goulash-pizza-pizzadb-p3`
 * (comparison table p3, relayed 2026-09-22, never independently re-fetched): 牛肉 / 玉ねぎ / パプリカパウダー / サワークリーム, sauce field 'その他' (BASE_SAUCE_UNSPECIFIED).
 *
 * B17-ONLY EXCEPTION (Owner decision 2026-11-03), not a general rule: reading the unspecified sauce field 'その他' as the サワークリーム sauce (sour-cream, the existing PAINT). No other unspecified-sauce row (caponata, tsukimi, pesto-genovese) is approved by this.
 * Unlike B15 / B16 no Jaccard exception is needed: the nearest neighbours (rendang-pizza, nigerian-suya-pizza) are at 0.33, under the global 0.4 criterion, which is NOT changed.
 *
 * The counts (sauce 1 / beef 3 / onion 3 / paprika-powder 2 = 8 non-sauce pieces), NO cheese, the generic 58-78 bake window, the colour `#f1ecdc`, the emoji 🍦 and the dab art are GAMEPLAY ASSUMPTIONS / CALIBRATION (Owner-confirmed as provisional).
 * Every piece is placed BEFORE the bake (the source states no timing): no POST_BAKE, no FINISH step. No new technique, no spice-grinding / prep / sear / steam step.
 */
const ID = "goulash-pizza";
const recipe = RECIPES.find((r) => r.id === ID)! as Recipe;
const COUNTS = { "sour-cream": 1, beef: 3, onion: 3, "paprika-powder": 2 };
const PIECE_COUNTS = { beef: 3, onion: 3, "paprika-powder": 2 };
const ORDINARY = ordinaryRecipes(RECIPES);
const idsOf = (r: Recipe) => r.requiredIngredients.map((q) => q.ingredientId as string);
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
function lab(hex: string): [number, number, number] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
  const [r, g, b] = c;
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
const deltaE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

describe("sour-cream, the one new material (provisional spec)", () => {
  const ing = getIngredient("sour-cream")!;
  it("is a SPREAD SAUCE (PAINT in the SAUCE step), named サワークリーム, finite, with the provisional colour; it carries no topping family", () => {
    expect(ing).toMatchObject({ id: "sour-cream", nameJa: "サワークリーム", category: "sauce", placement: "spread", color: "#f1ecdc" });
    expect(ing.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(ing.pieceVisual).toBe("sour-cream-dab"); // Owner plan A: a dedicated swirl-and-peak dab; the emoji is only the text fallback (checked below)
  });
  it("has an emoji no other ingredient uses (G18), and it is not 🥣 (tahini's)", () => {
    expect(ing.emoji).toBe("\u{1F366}");
    expect(ing.emoji).not.toBe("\u{1F963}");
    expect(INGREDIENTS.filter((i) => i.emoji === ing.emoji).map((i) => i.id)).toEqual(["sour-cream"]);
  });
  it("cannot be told apart from the other white sauces by COLOUR (a white sauce does not reach dE 20), which is why it has its own dab shape; the existing sauce colours are untouched", () => {
    expect(deltaE(ing.color, getIngredient("fromage-blanc-sauce")!.color)).toBeLessThan(20); // documents the limit: shape + label do the telling apart
    expect(getIngredient("fromage-blanc-sauce")!.color).toBe("#fffdf8");
    expect(getIngredient("umeboshi-paste")!.color).toBe("#b8405a");
    expect(getIngredient("tomato-sauce")!.pieceVisual).toBeUndefined(); // no existing sauce art was changed by this batch
    expect(getIngredient("fromage-blanc-sauce")!.pieceVisual).toBeUndefined();
  });
  it("stays distinguishable from the dough colour and every non-white sauce (dE above 20)", () => {
    expect(deltaE(ing.color, "#e8c98f")).toBeGreaterThan(10);
    for (const other of ["tomato-sauce", "doubanjiang", "curry-ketchup", "umeboshi-paste", "mustard"]) expect(deltaE(ing.color, getIngredient(other)!.color), other).toBeGreaterThan(20);
  });
  it("is an ordinary finite material (not late, no star gate)", () => {
    expect("sour-cream" in LATE_ENTITLEMENT_FLOORS).toBe(false);
  });
});

describe(ID, () => {
  it("has the matrix ingredient set (サワークリーム as the sauce, beef, onion, paprika-powder) with the provisional counts (8 non-sauce pieces) and NO cheese", () => {
    expect(Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual(COUNTS);
    const pieces = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
    expect(pieces.reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category === "sauce").map((q) => q.ingredientId)).toEqual(["sour-cream"]);
    expect(recipe.requiredIngredients.some((q) => getIngredient(q.ingredientId)?.category === "cheese")).toBe(false);
    expect(recipe.requiredIngredients.map((q) => q.ingredientId)).toEqual(["sour-cream", "beef", "onion", "paprika-powder"]);
  });

  it("is a credited, Lunch Rush opt-out, key-free, no-CUT ordinary recipe with the generic bake window and every requirement placed BEFORE the bake", () => {
    expect(recipe.ladderCredit).toBeUndefined(); // credited (the default)
    expect(recipe.lunchRush).toBe(false);
    expect(isCutEligible(ID)).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true); // no POST_BAKE: the FINISH constraints are untouched
    expect(RECIPE_HINT_ROLES[ID]).toEqual({ keyFree: true });
    expect(recipe.unlockCondition).toBeUndefined();
    expect(recipe.description).toBe("サワークリームのソースに、牛肉と玉ねぎとパプリカをのせた、ハンガリー風の一枚。");
  });

  it("has NO FINISH step and no CHEESE step: DOUGH / SAUCE / TOPPING, and is not a NO_SAUCE recipe", () => {
    expect(getCookingProfile(ID)!.steps).toEqual(["DOUGH", "SAUCE", "TOPPING"]);
    expect((noSauceRecipeIds() as readonly string[]).includes(ID)).toBe(false);
  });

  it("paints sour-cream with the existing PAINT gesture, and its Reference carries that sauce", () => {
    expect(getRecipeSauceProfile(ID)).toEqual({ recipeId: ID, ingredientId: "sour-cream", interaction: "PAINT" });
    expect(getReferencePizza(ID)!.sauce).not.toBeNull();
  });

  it("its Reference has 8 pieces on the RT-01 ring in requiredIngredients order, matching the required counts", () => {
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(recipe.requiredIngredients.filter((q) => q.ingredientId !== "sour-cream").map((q) => q.ingredientId));
    for (const g of ref.pieceGroups) expect(g.positions.length).toBe(PIECE_COUNTS[g.ingredientId as keyof typeof PIECE_COUNTS]);
  });

  it("invents no spice step or other ingredient: only the four source ingredients (plus nothing)", () => {
    expect([...idsOf(recipe)].sort()).toEqual(["beef", "onion", "paprika-powder", "sour-cream"]);
  });
});

describe("the Batch 17 differentiation (the global 0.4 criterion is untouched and met)", () => {
  it("no other recipe (late catalog included) has this ingredient set, and none is a subset or a superset of it (the sauce is part of the set)", () => {
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

  it("NO ordinary recipe is at or above the 0.4 Jaccard criterion; the nearest are rendang-pizza and nigerian-suya-pizza (0.33)", () => {
    const all = ORDINARY.filter((r) => r.id !== ID)
      .map((r) => ({ id: r.id, j: jaccard(idsOf(recipe), idsOf(r)) }))
      .sort((a, b) => b.j - a.j);
    expect(all.filter((x) => x.j >= 0.4)).toEqual([]);
    expect(all.filter((x) => x.j > 0.3).map((x) => x.id).sort()).toEqual(["nigerian-suya-pizza", "rendang-pizza"]);
    expect(all[0].j).toBeCloseTo(1 / 3, 5);
  });
});

describe("ordinary step 68", () => {
  const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
  it("is appended after step 67 (steps 1-67 frozen): sour-cream alone, no star gate, keyed to goulash-pizza", () => {
    expect(steps).toHaveLength(74); // Expansion Batch 23 (#780): the ordinary step 74 moved the derived late numbers +1 again; // Expansion Batch 20-A (#790) appended the ordinary step 71 (honey + walnut) after it; // Expansion Batch 19 (#774) appended the ordinary step 70 (burrata) after it; // Expansion Batch 18 appended the ordinary step 69 (cilantro) after it
    expect(steps[66]).toMatchObject({ step: 67, ingredientIds: ["umeboshi-paste"], keyRecipeId: "ume-shiso-pizza" });
    expect(steps[67]).toMatchObject({ step: 68, kind: "MATERIAL", ingredientIds: ["sour-cream"], keyRecipeId: ID });
    expect(steps[67].starGates).toBeUndefined();
  });
  it("every other ingredient of the recipe is owned before step 68 (sour-cream is the last unlock), so the key recipe is exactly this one", () => {
    const before = new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, 67).flatMap((s) => s.ingredientIds)]);
    for (const q of recipe.requiredIngredients) if (q.ingredientId !== "sour-cream") expect(before.has(q.ingredientId), q.ingredientId).toBe(true);
    expect(before.has("sour-cream")).toBe(false);
  });
  it("the FIXED late floors are unchanged: cod-roe / fresh-cream-sauce / nori stay at 68, so step 68 also opens the late tarako recipe (Owner-approved simultaneous unlock)", () => {
    expect([LATE_ENTITLEMENT_FLOORS["cod-roe"], LATE_ENTITLEMENT_FLOORS["fresh-cream-sauce"], LATE_ENTITLEMENT_FLOORS.nori]).toEqual([68, 68, 68]);
  });
});

describe("the discovery target composes the matrix row's ingredients with the サワークリーム sauce (B17-ONLY Owner exception: the unspecified sauce field 'その他' read as sour-cream)", () => {
  const rows = (matrix as { rows: { evidenceId: string; productDecisionStatus: string; sauceBase: { status: string }; blockers: { type: string }[]; ingredients: { canonicalIngredientIds: string[]; complete: boolean } }[] }).rows;
  const row = rows.find((r) => r.evidenceId === "goulash-pizza-pizzadb-p3")!;

  it("the matrix row is unchanged (still BLOCKED_PRODUCT_DECISION: BASE_SAUCE_UNSPECIFIED) -- the shipped sauce is an Owner exception, not a source fact", () => {
    expect(row.productDecisionStatus).toBe("BLOCKED_PRODUCT_DECISION");
    expect(row.sauceBase.status).toBe("unspecified");
    expect(row.blockers.map((b) => b.type)).toEqual(["BASE_SAUCE_UNSPECIFIED"]);
    expect([...row.ingredients.canonicalIngredientIds].sort()).toEqual(["beef", "onion", "paprika-powder", "sour-cream"]);
  });

  it("the runtime target is the four matrix ids with sour-cream as the sauce base", () => {
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.targetId).toBe("goulash-pizza-pizzadb-p3");
    expect([...target.items].sort()).toEqual(["beef", "onion", "paprika-powder", "sour-cream"]);
    expect([...(target.sauceBase ?? [])]).toEqual(["sour-cream"]);
    expect(target.identityDimensions.late).toEqual([]); // no late axis: every piece is before the bake
  });

  it("the exception is not generalised: other unspecified-sauce HOLD / candidate rows are not shipped (caponata, tsukimi, pesto-genovese, jerusalem-mixed-grill)", () => {
    const shipped = new Set(RECIPES.map((r) => r.id as string));
    for (const held of ["caponata-pizza", "tsukimi-pizza", "pesto-genovese-pizza", "jerusalem-mixed-grill-pizza"]) expect(shipped.has(held), held).toBe(false);
  });
});

/** A pizza that physically recreates the Reference (the sour-cream sauce, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(bakeResult = 66): PizzaState {
  const reference = getReferencePizza(ID)!;
  return {
    ...createEmptyPizza(),
    sauceIds: ["sour-cream"],
    toppings: reference.pieceGroups.flatMap((group, gi) => group.positions.map((p, i) => ({ id: `${ID}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }))),
    bakeResult,
  } as PizzaState;
}

describe(`${ID}: Free Cooking / Research round (Completion Gate, discovery)`, () => {
  it("a perfect round passes the Completion Gate", () => {
    expect(evaluatePizzaCompletion(recipe, referenceLikePizza())).toEqual({ status: "PASS" });
  });

  it("cooked with exactly its ingredients and the sour-cream sauce it is a UNIQUE_MATCH -> NEW_DISCOVERY, and a Dex that has it does not announce it again", () => {
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

  it("no sauce, another sauce, a missing or an extra ingredient makes it an ORIGINAL pizza (the exact set decides, the sauce included)", () => {
    const base = referenceLikePizza();
    const variants: Record<string, PizzaState> = {
      "no sauce": { ...base, sauceIds: [] } as PizzaState,
      "fromage-blanc sauce instead": { ...base, sauceIds: ["fromage-blanc-sauce"] } as PizzaState,
      "tomato sauce": { ...base, sauceIds: ["tomato-sauce"] } as PizzaState,
      "no paprika": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "paprika-powder") } as PizzaState,
      "no beef": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "beef") } as PizzaState,
      "extra mozzarella (a cheese)": { ...base, toppings: [...base.toppings, { id: "x", ingredientId: "mozzarella", x: 50, y: 50 }] } as PizzaState,
      "paprika placed AFTER the bake": { ...base, toppings: base.toppings.map((t) => (t.ingredientId === "paprika-powder" ? { ...t, stage: "post" as const } : t)) } as PizzaState,
    };
    for (const [label, pizza] of Object.entries(variants)) expect(resolveFreeCookPizza(pizza, EMPTY_DEX).kind, label).toBe("ORIGINAL");
  });

  it("rendang-pizza's own pizza (curry-ketchup, mozzarella, beef, onion) is still rendang-pizza and is not captured by goulash; rendang + sour-cream is an ORIGINAL", () => {
    const rendang = RECIPES.find((r) => r.id === "rendang-pizza")! as Recipe;
    const pieces: PizzaState["toppings"] = rendang.requiredIngredients
      .filter((q) => q.ingredientId !== "curry-ketchup")
      .flatMap((q, qi) => Array.from({ length: q.minCount }, (_, i) => ({ id: `r-${qi}-${i}`, ingredientId: q.ingredientId, x: 30 + qi * 7 + i * 3, y: 40 + i * 5 })));
    const own = { ...createEmptyPizza(), sauceIds: ["curry-ketchup"], toppings: pieces, bakeResult: 66 } as PizzaState;
    expect(matchDiscovery(signatureOfPizza(own), RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: "rendang-pizza" } });
    expect(resolveFreeCookPizza({ ...own, sauceIds: ["sour-cream"] } as PizzaState, EMPTY_DEX).kind).toBe("ORIGINAL");
  });

  it("a raw or burnt bake is a FAILED round, not an original pizza", () => {
    expect(resolveFreeCookPizza(referenceLikePizza(30), EMPTY_DEX).kind).toBe("FAILED");
    expect(resolveFreeCookPizza(referenceLikePizza(95), EMPTY_DEX).kind).toBe("FAILED");
  });
});

describe("unlock and Research label (a single-member cohort: nothing else moves)", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const withoutMe = ORDINARY.filter((r) => r.id !== ID);

  it("is makeable only once sour-cream is owned (step 68), and its Research label names only that material (no letter)", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    expect(researchCohortLetters(owned.filter((m) => m !== "sour-cream"), withoutMe).has(ID)).toBe(false);
    expect(researchCohortLetters(owned, ORDINARY).has(ID)).toBe(false);
    expect(researchEntryLabel({ unlockIngredientId: "sour-cream", cohortLetter: null })).toBe("？？？ピザ（サワークリーム）");
  });

  it("at EVERY ladder prefix no pre-existing recipe changes its Research letter (no acceptedLetterShifts), and the beef cohort of rendang / suya is untouched", () => {
    for (let n = 0; n <= ladderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, n)];
      const now = researchCohortLetters(owned, ORDINARY);
      const before = researchCohortLetters(owned, withoutMe);
      expect([...now].filter(([id]) => id !== ID).sort(), `prefix ${n}`).toEqual([...before].sort());
      expect(now.has(ID), `prefix ${n}`).toBe(false);
    }
  });

  it("random purchase orders: a letter, once given, never changes", () => {
    let s = 20261104;
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
