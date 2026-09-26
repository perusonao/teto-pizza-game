import { describe, expect, it } from "vitest";
import { RECIPES } from "../data/recipes";
import { SHIPPED_15_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { EMPTY_DEX, registerScoreToDex } from "./dex";
import { buildRecipeChapters, chapterProgress, recipeChapter, recipeChapterSlot, recipeKeyStep } from "./recipeChapters";

/** OD-DISC-9: chapters = ladder price tier of each recipe's key step, 6 / 9 / 10 at 25 recipes. */
describe("recipeChapters (OD-DISC-9)", () => {
  it("partitions the 25 recipes 6 / 9 / 10 by price tier, in RECIPES order", () => {
    const chapters = buildRecipeChapters();
    expect(chapters.map((c) => c.titleJa)).toEqual(["第1章", "第2章", "第3章"]);
    expect(chapters.map((c) => c.recipes.map((r) => r.id))).toEqual([
      ["margherita", "bismarck", "funghi", "breakfast-pizza", "melanzane-pizza", "parmigiana-pizza"],
      ["marinara", "fugazza", "salsiccia", "pepperoni", "capricciosa", "meat-lovers", "bambino", "hawaiian", "pizza-portuguesa"],
      [
        "quattro-formaggi", "genovese", "napoletana", "tonno-e-cipolla", "pizza-bianca",
        "pesto-tonno", "new-haven-apizza", "pesto-caprese", "pesto-patate", "puttanesca-pizza",
      ],
    ].map((ids) => [...ids].sort((a, b) => RECIPES.findIndex((r) => r.id === a) - RECIPES.findIndex((r) => r.id === b))));
    expect(chapters.map((c) => c.recipes.length)).toEqual([6, 9, 10]);
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
    expect(chapterProgress(c2, dex)).toEqual({ discovered: 1, total: 9 });
    expect(chapterProgress(c3, dex)).toEqual({ discovered: 0, total: 10 });
    expect(recipeChapterSlot(RECIPES.find((r) => r.id === "margherita")!)).toBe(1);
    expect(recipeChapterSlot(RECIPES.find((r) => r.id === "marinara")!)).toBe(1);
  });
});
