import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe } from "../data/recipes";
import { SHIPPED_15_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { EMPTY_DEX, registerScoreToDex } from "./dex";
import { buildRecipeChapters, chapterProgress, isChapterCleared, recipeChapter, recipeChapterSlot, recipeKeyStep } from "./recipeChapters";
import { isLateRecipeId } from "../logic/catalog/testSupport/lateIds";
import { pinsaEnabled } from "../data/pinsaGate";

/** OD-DISC-9: chapters = ladder price tier of each recipe's key step, 6 / 9 / 10 at the 25 credited recipes; PR-4b-B's calabresa (key step 12, T2) makes it 6 / 10 / 10; No.27 pesto-pollo (key step 25, T3) makes it 6 / 10 / 11; Expansion Slice 1 pesto-gamberi (key step 26, T3) makes it 6 / 10 / 12 (Chapter 3 No.12). */
describe("recipeChapters (OD-DISC-9)", () => {
  it("partitions the recipes by price tier, in RECIPES order (chapters 1 / 2 / 3 are closed; Expansion Batch 1's step 30+ recipes open chapter 4, the first T4 band)", () => {
    const chapters = buildRecipeChapters();
    expect(chapters.map((c) => c.titleJa)).toEqual(["第1章", "第2章", "第3章", "第4章"]);
    const expected = [
      ["margherita", "bismarck", "funghi", "breakfast-pizza", "melanzane-pizza", "parmigiana-pizza"],
      ["marinara", "fugazza", "salsiccia", "pepperoni", "capricciosa", "meat-lovers", "bambino", "hawaiian", "pizza-portuguesa", "brazilian-calabresa", "aussie", "grandma-pizza"],
      [
        "quattro-formaggi", "genovese", "napoletana", "tonno-e-cipolla", "pizza-bianca",
        "pesto-tonno", "new-haven-apizza", "pesto-caprese", "pesto-patate", "puttanesca-pizza",
        "pesto-pollo", "pesto-gamberi", "vongole", "pesto-vegetariana", "ratatouille-pizza", "pesto-trapanese",
        "chilean-napolitana", "spanish-chorizo-pizza", // Batch 8a: non-credit, key steps 20 / 28 (Chapter 3)
      ],
      ["baba-ganoush-pizza", "prosciutto-funghi", "veggie-supreme-pizza", "jamon-serrano-pizza", "calabresa-argentina", "rucola-e-grana", "vegan-cashew-cheese-pizza", "pesto-salmone", "bacalhau", "full-english-pizza", "palmito-pizza", "polish-kielbasa", "porchetta-pizza", "salsiccia-e-friarielli", "brazilian-catupiry-corn-pizza", "jalapeno-popper-pizza", "pizza-feta-eliniki", "pizza-moscow", "pizza-bianca-ricotta", "pizza-overload", "california-style-pizza", "spinach-artichoke-pizza"],
    ].map((ids) => [...ids].sort((a, b) => RECIPES.findIndex((r) => r.id === a) - RECIPES.findIndex((r) => r.id === b)));
    const actual = chapters.map((c) => c.recipes.map((r) => r.id));
    expect(actual[0]).toEqual(expected[0]);
    expect(actual[1]).toEqual(expected[1]);
    expect(actual[2]).toEqual(expected[2]);
    expect(actual[3].slice(0, expected[3].length)).toEqual(expected[3]); // the last chapter grows by appending
  });

  it("chapter follows the key step (last material's step), margherita (starters only) is chapter 1", () => {
    const byId = (id: string) => RECIPES.find((r) => r.id === id)!;
    expect(recipeKeyStep(byId("margherita"))).toBe(0);
    expect(recipeChapter(byId("margherita"))).toBe(1);
    expect(recipeKeyStep(byId("parmigiana-pizza"))).toBe(5);
    expect(recipeChapter(byId("parmigiana-pizza"))).toBe(1);
    expect(recipeKeyStep(byId("marinara"))).toBe(14);
    expect(recipeChapter(byId("marinara"))).toBe(2);
    expect(recipeChapter(byId("quattro-formaggi"))).toBe(3);
    expect(recipeKeyStep(byId("brazilian-calabresa"))).toBe(12); // onion, same step as pizza-portuguesa
    expect(recipeChapter(byId("brazilian-calabresa"))).toBe(2);
    expect(recipeKeyStep(byId("aussie"))).toBe(12); // onion again (TQ-1D); egg 1 / bacon 2 / mozzarella are earlier or starters
    expect(recipeChapter(byId("aussie"))).toBe(2);
    expect(recipeKeyStep(byId("pesto-pollo"))).toBe(25); // chicken, the appended step
    expect(recipeChapter(byId("pesto-pollo"))).toBe(3);
  });

  it("is population-driven: another ladder yields its own partition from the same function", () => {
    const sizes = buildRecipeChapters(RECIPES.slice(0, 15), SHIPPED_15_DISCOVERY_LADDER).map((c) => c.recipes.length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(15);
  });

  it("progress counts discoveries per chapter; slots are 1-based positions inside the chapter", () => {
    let dex = EMPTY_DEX;
    for (const id of ["margherita", "bismarck", "marinara"]) {
      dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
    }
    const [c1, c2, c3] = buildRecipeChapters();
    expect(chapterProgress(c1, dex)).toEqual({ discovered: 2, total: 6 });
    expect(chapterProgress(c2, dex)).toEqual({ discovered: 1, total: 12 });
    expect(chapterProgress(c3, dex)).toEqual({ discovered: 0, total: 18 });
    expect(recipeChapterSlot(RECIPES.find((r) => r.id === "margherita")!)).toBe(1);
    expect(recipeChapterSlot(RECIPES.find((r) => r.id === "marinara")!)).toBe(1);
  });
});

/**
 * K2 (Issue #577, Owner 2026-10-23): the cleared mark ignores late-catalog (後乗せ) recipes, so E5 cannot take it from a chapter the
 * player already finished. Production has no late recipe in `RECIPES`; the ON catalog is simulated by appending a recipe whose id is a
 * real late id (default set) or an injected one.
 */
describe("isChapterCleared (K2)", () => {
  const discoverAll = (ids: readonly string[]) =>
    ids.reduce(
      (dex, id) => registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex,
      EMPTY_DEX,
    );
  // E5: with the late catalog on, the real chapter 4 already holds the late recipe; these tests start from its ordinary recipes and add the late one themselves.
  const chapter4 = () => {
    const c = buildRecipeChapters().find((x) => x.chapter === 4)!;
    return { ...c, recipes: c.recipes.filter((r) => !isLateRecipeId(r.id)) };
  };
  const lateClone = (id: string) => ({ ...chapter4().recipes[0], id }) as Recipe;
  const withLate = (id: string) => ({ ...chapter4(), recipes: [...chapter4().recipes, lateClone(id)] });

  it("Production (no late recipe in RECIPES): cleared exactly when discovered === total, for every chapter", () => {
    for (const chapter of buildRecipeChapters()) {
      const ids = chapter.recipes.map((r) => r.id);
      expect(isChapterCleared(chapter, discoverAll(ids))).toBe(true);
      expect(isChapterCleared(chapter, discoverAll(ids.slice(1)))).toBe(false);
      expect(isChapterCleared(chapter, EMPTY_DEX)).toBe(false);
      const p = chapterProgress(chapter, discoverAll(ids));
      expect(p.discovered === p.total).toBe(isChapterCleared(chapter, discoverAll(ids)));
    }
  });

  it("E5 (late catalog on in Production): the real chapter 4 holds the late recipe, and a player who finished the ordinary chapter keeps the mark", () => {
    const real = buildRecipeChapters().find((c) => c.chapter === 4)!;
    expect(real.recipes.some((r) => r.id === "ikura-salmon-pizza")).toBe(true);
    expect(real.recipes.some((r) => r.id === "yuzu-shrimp-pizza")).toBe(true); // New Sauces Phase B U1: its key step (yuzu-kosho) is a T4 step, so chapter 4
    const ordinary = real.recipes.filter((r) => !isLateRecipeId(r.id)).map((r) => r.id);
    expect(isChapterCleared(real, discoverAll(ordinary))).toBe(true);
    // every late recipe in the chapter adds to the displayed total and none is required for the mark (ikura and yuzu-shrimp-pizza; with the Pinsa gate open, pinsa-romana too: its key step is arugula's, in chapter 4)
    const lateInChapter = real.recipes.length - ordinary.length;
    expect(lateInChapter).toBe(pinsaEnabled() ? 3 : 2);
    expect(chapterProgress(real, discoverAll(ordinary))).toEqual({ discovered: ordinary.length, total: ordinary.length + lateInChapter });
  });

  it("late catalog ON: a finished chapter keeps its mark while the displayed count grows (26/27 ✓), and the late recipe is not required", () => {
    const ordinary = chapter4().recipes.map((r) => r.id);
    const on = withLate("ikura-salmon-pizza"); // a real late id: the default set is used
    const dex = discoverAll(ordinary);
    expect(chapterProgress(on, dex)).toEqual({ discovered: ordinary.length, total: ordinary.length + 1 });
    expect(isChapterCleared(on, dex)).toBe(true);
  });

  it("late catalog ON: a missing ORDINARY recipe still blocks the mark, and discovering the late recipe alone does not grant it", () => {
    const ordinary = chapter4().recipes.map((r) => r.id);
    const on = withLate("ikura-salmon-pizza");
    expect(isChapterCleared(on, discoverAll(ordinary.slice(1)))).toBe(false);
    expect(isChapterCleared(on, discoverAll([...ordinary.slice(1), "ikura-salmon-pizza"]))).toBe(false);
    expect(isChapterCleared(on, discoverAll([...ordinary, "ikura-salmon-pizza"]))).toBe(true);
  });

  it("only ids in the late set are skipped (an unknown extra recipe still counts); the set is injectable", () => {
    const ordinary = chapter4().recipes.map((r) => r.id);
    const extra = withLate("not-a-late-recipe");
    expect(isChapterCleared(extra, discoverAll(ordinary))).toBe(false);
    expect(isChapterCleared(extra, discoverAll(ordinary), new Set(["not-a-late-recipe"]))).toBe(true);
  });

  it("a chapter holding only late recipes is never cleared", () => {
    const onlyLate = { chapter: 9, titleJa: "第9章", recipes: [lateClone("ikura-salmon-pizza")] };
    expect(isChapterCleared(onlyLate, discoverAll(["ikura-salmon-pizza"]))).toBe(false);
  });
});

