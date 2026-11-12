import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
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
import { COMPOSED } from "../logic/catalog/testSupport/composedForBuild";

/**
 * Expansion Batch 16 (Issue #736): ume-shiso-pizza + one new material, `umeboshi-paste`. PROVISIONAL SPEC: the original pizzadb.jp page was NOT confirmed (unreachable); the only evidence is the 172 matrix row `ume-shiso-pizza-pizzadb-p14`
 * (comparison table p14, relayed 2026-09-22, never independently re-fetched): 梅肉 / 大葉 / モッツァレラ / しらす, sauce field 'その他' (BASE_SAUCE_UNSPECIFIED).
 *
 * B16-ONLY EXCEPTIONS (Owner decisions 2026-11-03), neither a general rule:
 *  1. reading the unspecified sauce field 'その他' as the 梅肉 sauce (umeboshi-paste, the existing PAINT). No other unspecified-sauce row (caponata, goulash, ...) is approved by this.
 *  2. its nearest neighbour shirasu-pizza shares mozzarella / shiso / whitebait (Jaccard 0.60, above the 0.4 criterion). The GLOBAL 0.4 criterion is NOT changed; what is pinned is the structural guarantee (no same / subset / superset
 *     ingredient set, the sauce included) and that shirasu-pizza is the ONLY recipe at or above 0.4.
 *
 * The counts (sauce 1 / mozzarella 2 / whitebait 4 / shiso 2 = 8 non-sauce pieces), the generic 58-78 bake window, the colour `#b8405a` and the emoji 🍑 are GAMEPLAY ASSUMPTIONS / CALIBRATION (Owner-confirmed as provisional).
 * Every piece is placed BEFORE the bake (the source states no timing): no POST_BAKE, no FINISH step. No new technique, no spice or other step.
 */
const ID = "ume-shiso-pizza";
const recipe = RECIPES.find((r) => r.id === ID)! as Recipe;
const COUNTS = { "umeboshi-paste": 1, mozzarella: 2, whitebait: 4, shiso: 2 };
const PIECE_COUNTS = { mozzarella: 2, whitebait: 4, shiso: 2 };
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

describe("umeboshi-paste, the one new material (provisional spec)", () => {
  const ing = getIngredient("umeboshi-paste")!;
  it("is a SPREAD SAUCE (PAINT in the SAUCE step), named 梅肉, finite, with the provisional colour; it carries no topping family and is not meat", () => {
    expect(ing).toMatchObject({ id: "umeboshi-paste", nameJa: "梅肉", category: "sauce", placement: "spread", color: "#b8405a" });
    expect(ing.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(ing.pieceVisual).toBe("umeboshi-paste-dab"); // Issue #739: drawn by a dedicated paste-dab SVG; the 🍑 is only the text fallback (checked below)
    expect(ingredientAttributeFamily("umeboshi-paste")).not.toBe("meat"); // 梅肉 = plum flesh (false_friend_not_meat)
  });
  it("has an emoji no other ingredient uses (G18)", () => {
    expect(ing.emoji).toBe("\u{1F351}");
    expect(INGREDIENTS.filter((i) => i.emoji === ing.emoji).map((i) => i.id)).toEqual(["umeboshi-paste"]);
  });
  it("is told apart from the sauces it could be mistaken for: CIE76 dE against tomato-sauce, doubanjiang and the dough colour is above 20 (the doubanjiang review accepted 22)", () => {
    for (const other of ["tomato-sauce", "doubanjiang", "fromage-blanc-sauce", "curry-ketchup"]) expect(deltaE(ing.color, getIngredient(other)!.color), other).toBeGreaterThan(20);
    expect(deltaE(ing.color, "#e8c98f")).toBeGreaterThan(20); // the dough
  });
  it("is an ordinary finite material (not late, no star gate)", () => {
    expect("umeboshi-paste" in LATE_ENTITLEMENT_FLOORS).toBe(false);
  });
});

describe(ID, () => {
  it("has the matrix ingredient set (梅肉 as the sauce, mozzarella, whitebait, shiso) with the provisional counts (8 non-sauce pieces)", () => {
    expect(Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual(COUNTS);
    const pieces = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
    expect(pieces.reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category === "sauce").map((q) => q.ingredientId)).toEqual(["umeboshi-paste"]);
    expect(recipe.requiredIngredients.map((q) => q.ingredientId)).toEqual(["umeboshi-paste", "mozzarella", "whitebait", "shiso"]); // sauce -> cheese -> toppings (Rule W / legacy H4 agreement)
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
    expect(recipe.description).toBe("梅のさわやかなソースに、しらすと大葉をそえた、和風の一枚。");
  });

  it("has NO FINISH step (no late requirement): DOUGH / SAUCE / CHEESE / TOPPING, and is not a NO_SAUCE recipe", () => {
    expect(getCookingProfile(ID)!.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect((noSauceRecipeIds() as readonly string[]).includes(ID)).toBe(false);
  });

  it("paints umeboshi-paste with the existing PAINT gesture, and its Reference carries that sauce", () => {
    expect(getRecipeSauceProfile(ID)).toEqual({ recipeId: ID, ingredientId: "umeboshi-paste", interaction: "PAINT" });
    expect(getReferencePizza(ID)!.sauce).not.toBeNull();
  });

  it("its Reference has 8 pieces on the RT-01 ring in requiredIngredients order, matching the required counts, the shiso leaves landing as leaves", () => {
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(recipe.requiredIngredients.filter((q) => q.ingredientId !== "umeboshi-paste").map((q) => q.ingredientId));
    for (const g of ref.pieceGroups) expect(g.positions.length).toBe(PIECE_COUNTS[g.ingredientId as keyof typeof PIECE_COUNTS]);
    expect(ref.pieceGroups.find((g) => g.ingredientId === "shiso")!.interaction.landingStyle).toBe("LIGHT_LEAF");
  });

  it("invents no spice step or other ingredient: only the four source ingredients (plus nothing)", () => {
    expect([...idsOf(recipe)].sort()).toEqual(["mozzarella", "shiso", "umeboshi-paste", "whitebait"]);
  });
});

describe("the Batch 16 differentiation (B16-only exception; the global 0.4 criterion is untouched)", () => {
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

  it("exactly ONE ordinary recipe is at or above the 0.4 Jaccard criterion, and it is named: shirasu-pizza (0.60, the approved B16-only exception)", () => {
    const near = ORDINARY.filter((r) => r.id !== ID)
      .map((r) => ({ id: r.id, j: jaccard(idsOf(recipe), idsOf(r)) }))
      .filter((x) => x.j >= 0.4)
      .sort((a, b) => b.j - a.j);
    expect(near.map((x) => x.id)).toEqual(["shirasu-pizza"]);
    expect(near[0].j).toBeCloseTo(0.6, 5);
  });

  it("the identity includes the sauce: shirasu-pizza paints nothing, ume-shiso paints umeboshi-paste (and has no lemon), so neither cooks the other's pizza", () => {
    expect(getRecipeSauceProfile("shirasu-pizza")).toBeNull();
    expect(getRecipeSauceProfile(ID)).toMatchObject({ ingredientId: "umeboshi-paste" });
    expect(idsOf(RECIPES.find((r) => r.id === "shirasu-pizza")! as Recipe)).toContain("lemon");
    expect(idsOf(recipe)).not.toContain("lemon");
  });
});

describe("ordinary step 67", () => {
  const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
  it("is appended after step 66 (steps 1-66 frozen): umeboshi-paste alone, no star gate, keyed to ume-shiso-pizza", () => {
    expect(steps).toHaveLength(COMPOSED.ordinarySteps.length); // R-1 (#780): composed from the frozen baseline and the landed specs (composedCatalog.ts); a landing train needs no edit here.
    expect(steps[65]).toMatchObject({ step: 66, ingredientIds: ["cinnamon"], keyRecipeId: "moussaka-style-pizza" });
    expect(steps[66]).toMatchObject({ step: 67, kind: "MATERIAL", ingredientIds: ["umeboshi-paste"], keyRecipeId: ID });
    expect(steps[66].starGates).toBeUndefined();
  });
  it("every other ingredient of the recipe is owned before step 67 (umeboshi-paste is the last unlock), so the key recipe is exactly this one", () => {
    const before = new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, 66).flatMap((s) => s.ingredientIds)]);
    for (const q of recipe.requiredIngredients) if (q.ingredientId !== "umeboshi-paste") expect(before.has(q.ingredientId), q.ingredientId).toBe(true);
    expect(before.has("umeboshi-paste")).toBe(false);
  });
});

describe("the discovery target composes the matrix row's ingredients with the 梅肉 sauce (B16-ONLY Owner exception: the unspecified sauce field 'その他' read as umeboshi-paste)", () => {
  const rows = (matrix as { rows: { evidenceId: string; productDecisionStatus: string; sauceBase: { status: string }; blockers: { type: string }[]; ingredients: { canonicalIngredientIds: string[]; complete: boolean } }[] }).rows;
  const row = rows.find((r) => r.evidenceId === "ume-shiso-pizza-pizzadb-p14")!;

  it("the matrix row is unchanged (still BLOCKED_PRODUCT_DECISION: BASE_SAUCE_UNSPECIFIED) -- the shipped sauce is an Owner exception, not a source fact", () => {
    expect(row.productDecisionStatus).toBe("BLOCKED_PRODUCT_DECISION");
    expect(row.sauceBase.status).toBe("unspecified");
    expect(row.blockers.map((b) => b.type)).toEqual(["BASE_SAUCE_UNSPECIFIED"]);
    expect([...row.ingredients.canonicalIngredientIds].sort()).toEqual(["mozzarella", "shiso", "umeboshi-paste", "whitebait"]);
  });

  it("the runtime target is the four matrix ids with umeboshi-paste as the sauce base", () => {
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.targetId).toBe("ume-shiso-pizza-pizzadb-p14");
    expect([...target.items].sort()).toEqual(["mozzarella", "shiso", "umeboshi-paste", "whitebait"]);
    expect([...(target.sauceBase ?? [])]).toEqual(["umeboshi-paste"]);
    expect(target.identityDimensions.late).toEqual([]); // no late axis: every piece is before the bake
  });

  it("the exception is not generalised: other unspecified-sauce HOLD / candidate rows are not shipped (caponata, tsukimi, pesto-genovese; goulash-pizza was shipped later by its OWN Owner-approved Batch 17)", () => {
    const shipped = new Set(RECIPES.map((r) => r.id as string));
    for (const held of ["caponata-pizza", "tsukimi-pizza", "pesto-genovese-pizza"]) expect(shipped.has(held), held).toBe(false);
  });
});

/** A pizza that physically recreates the Reference (the 梅肉 sauce, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(bakeResult = 66): PizzaState {
  const reference = getReferencePizza(ID)!;
  return {
    ...createEmptyPizza(),
    sauceIds: ["umeboshi-paste"],
    toppings: reference.pieceGroups.flatMap((group, gi) => group.positions.map((p, i) => ({ id: `${ID}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }))),
    bakeResult,
  } as PizzaState;
}

describe(`${ID}: Free Cooking / Research round (Completion Gate, discovery)`, () => {
  it("a perfect round passes the Completion Gate", () => {
    expect(evaluatePizzaCompletion(recipe, referenceLikePizza())).toEqual({ status: "PASS" });
  });

  it("cooked with exactly its ingredients and the 梅肉 sauce it is a UNIQUE_MATCH -> NEW_DISCOVERY, and a Dex that has it does not announce it again", () => {
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
      "tomato sauce": { ...base, sauceIds: ["tomato-sauce"] } as PizzaState,
      "no shiso": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "shiso") } as PizzaState,
      "no whitebait": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "whitebait") } as PizzaState,
      "extra lemon (shirasu's piece)": { ...base, toppings: [...base.toppings, { id: "x", ingredientId: "lemon", x: 50, y: 50 }] } as PizzaState,
      "shiso placed AFTER the bake": { ...base, toppings: base.toppings.map((t) => (t.ingredientId === "shiso" ? { ...t, stage: "post" as const } : t)) } as PizzaState,
    };
    for (const [label, pizza] of Object.entries(variants)) expect(resolveFreeCookPizza(pizza, EMPTY_DEX).kind, label).toBe("ORIGINAL");
  });

  it("shirasu-pizza's own pizza (no sauce, lemon, shiso x1 before the bake) is still shirasu-pizza, and is not captured by ume-shiso; shirasu + 梅肉 is an ORIGINAL", () => {
    const shirasu = RECIPES.find((r) => r.id === "shirasu-pizza")! as Recipe;
    const pieces: PizzaState["toppings"] = shirasu.requiredIngredients.flatMap((q, qi) => Array.from({ length: q.minCount }, (_, i) => ({ id: `s-${qi}-${i}`, ingredientId: q.ingredientId, x: 30 + qi * 7 + i * 3, y: 40 + i * 5 })));
    const own = { ...createEmptyPizza(), toppings: pieces, bakeResult: 66 } as PizzaState;
    expect(matchDiscovery(signatureOfPizza(own), RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: "shirasu-pizza" } });
    expect(resolveFreeCookPizza({ ...own, sauceIds: ["umeboshi-paste"] } as PizzaState, EMPTY_DEX).kind).toBe("ORIGINAL");
  });

  it("a raw or burnt bake is a FAILED round, not an original pizza", () => {
    expect(resolveFreeCookPizza(referenceLikePizza(30), EMPTY_DEX).kind).toBe("FAILED");
    expect(resolveFreeCookPizza(referenceLikePizza(95), EMPTY_DEX).kind).toBe("FAILED");
  });
});

describe("unlock and Research label (a single-member cohort: nothing else moves)", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const withoutMe = ORDINARY.filter((r) => r.id !== ID);

  it("is makeable only once umeboshi-paste is owned (step 67), and its Research label names only that material (no letter)", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    expect(researchCohortLetters(owned.filter((m) => m !== "umeboshi-paste"), withoutMe).has(ID)).toBe(false);
    expect(researchCohortLetters(owned, ORDINARY).has(ID)).toBe(false);
    expect(researchEntryLabel({ unlockIngredientId: "umeboshi-paste", cohortLetter: null })).toBe("？？？ピザ（梅肉）");
  });

  it("at EVERY ladder prefix no pre-existing recipe changes its Research letter (no acceptedLetterShifts), and the shiso / whitebait cohort of shirasu-pizza is untouched", () => {
    for (let n = 0; n <= ladderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, n)];
      const now = researchCohortLetters(owned, ORDINARY);
      const before = researchCohortLetters(owned, withoutMe);
      expect([...now].filter(([id]) => id !== ID).sort(), `prefix ${n}`).toEqual([...before].sort());
      expect(now.has(ID), `prefix ${n}`).toBe(false);
    }
  });

  it("random purchase orders: a letter, once given, never changes", () => {
    let s = 20261103;
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
