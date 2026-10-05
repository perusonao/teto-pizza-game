import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../../state/dex";
import { researchEntryViews } from "../../state/discoveryHint";
import type { ScoreBreakdown } from "../scoring";
import { deriveResearchEntries, researchCohortLetters, researchEntryLabel, researchLetter } from "./researchEntry";
import { researchRowsFeedback } from "./researchResultFeedback";

/**
 * Research 2.0 Phase 1 (OD-R2-1..5): the D+ Cohort Letter. Production data only (ladder step 12 = 3 siblings, step 28 =
 * 2 siblings), plus a synthetic catalog for the 26+ case. Nothing here saves anything.
 */

const SCORE: ScoreBreakdown = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 };
const discover = (...ids: string[]): DexState => ids.reduce((dex, id) => registerScoreToDex(dex, id, SCORE).dex, EMPTY_DEX);
const ladderOwned = (step: number): string[] => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number): string[] => [
  "margherita",
  ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId),
];
const play = (step: number, also: readonly string[] = []) => ({
  dex: discover(...keysBefore(step), ...also),
  ownedIngredientIds: ladderOwned(step),
});
/** The two non-credit step-12 recipes (TQ-1D: aussie) closed, as a player past step 12 has them. */
const settled = (step: number, also: readonly string[] = []) =>
  play(step, [...(step > 12 ? ["brazilian-calabresa", "aussie"] : []), ...also]);
/** recipeId -> label of every current entry. */
const labels = (i: ReturnType<typeof play>): Record<string, string> =>
  Object.fromEntries(researchEntryViews(i).map((v) => [v.recipeId, v.label]));
/** The same inputs after a save round trip (a reload re-derives from the save only). */
const reload = (i: ReturnType<typeof play>) => ({
  dex: JSON.parse(JSON.stringify(i.dex)) as DexState,
  ownedIngredientIds: JSON.parse(JSON.stringify(i.ownedIngredientIds)) as string[],
});

describe("researchLetter (spreadsheet style)", () => {
  it("A..Z, then AA, AB ...", () => {
    expect(researchLetter(0)).toBe("A");
    expect(researchLetter(1)).toBe("B");
    expect(researchLetter(25)).toBe("Z");
    expect(researchLetter(26)).toBe("AA");
    expect(researchLetter(27)).toBe("AB");
    expect(researchLetter(51)).toBe("AZ");
    expect(researchLetter(52)).toBe("BA");
    expect(researchLetter(701)).toBe("ZZ");
    expect(researchLetter(702)).toBe("AAA");
  });
  it("never repeats across the first 1000 slots", () => {
    const seen = new Set(Array.from({ length: 1000 }, (_, i) => researchLetter(i)));
    expect(seen.size).toBe(1000);
  });
});

describe("cohort grouping", () => {
  it("step 12: the three onion-last recipes form one cohort (A / B / C), in the anonymous hash order", () => {
    const l = labels(play(12));
    expect(l["aussie"]).toBe("？？？ピザ A（たまねぎ）");
    expect(l["brazilian-calabresa"]).toBe("？？？ピザ B（たまねぎ）");
    expect(l["pizza-portuguesa"]).toBe("？？？ピザ C（たまねぎ）");
    expect(Object.keys(l)).toHaveLength(3);
  });

  it("step 28: ratatouille-pizza = A, pesto-vegetariana = B (both unlock = ズッキーニ)", () => {
    const l = labels(settled(28));
    expect(l["ratatouille-pizza"]).toBe("？？？ピザ A（ズッキーニ）");
    expect(l["pesto-vegetariana"]).toBe("？？？ピザ B（ズッキーニ）");
    expect(Object.keys(l)).toHaveLength(2);
  });

  it("a single cohort has no letter: the label is the bare 「？？？ピザ（unlock）」", () => {
    const l = labels(settled(25));
    expect(l).toEqual({ "pesto-pollo": "？？？ピザ（チキン）" });
    for (const step of [3, 11, 13, 17, 26]) {
      for (const label of Object.values(labels(settled(step)))) expect(label).not.toMatch(/ピザ [A-Z]+（/);
    }
  });

  it("the letter order is the anonymous hash order, never the catalog, ladder or Dex order", () => {
    const fnv = (id: string): number => {
      let h = 0x811c9dc5;
      for (let i = 0; i < id.length; i += 1) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h;
    };
    const ids = ["aussie", "brazilian-calabresa", "pizza-portuguesa"];
    const byHash = [...ids].sort((a, b) => fnv(a) - fnv(b));
    const l = labels(play(12));
    expect(byHash.map((id) => l[id])).toEqual([
      "？？？ピザ A（たまねぎ）",
      "？？？ピザ B（たまねぎ）",
      "？？？ピザ C（たまねぎ）",
    ]);
    // the order of the input arrays cannot change a letter
    const shuffledRecipes = [...RECIPES].reverse();
    const letters = researchCohortLetters(ladderOwned(12), shuffledRecipes);
    expect([...letters.entries()].filter(([id]) => ids.includes(id)).sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([id]) => id)).toEqual(byHash);
  });

  it("an unregistrable recipe is not counted: a lone entry never shows a letter because of a sibling it cannot see", () => {
    // step 11: capricciosa's cohort is just itself; onion (step 12) is not owned, so its three recipes are invisible.
    const entries = deriveResearchEntries(play(11)).entries;
    expect(entries.map((e) => e.cohortLetter)).toEqual([null]);
    expect(researchCohortLetters(ladderOwned(11)).size).toBe(0);
  });
});

describe("sibling discovery never moves a letter (OD-R2-3)", () => {
  it("step 12: discovering B first leaves A and C as A and C", () => {
    const before = labels(play(12));
    const after = labels(play(12, ["brazilian-calabresa"]));
    expect(after).toEqual({
      aussie: before["aussie"],
      "pizza-portuguesa": before["pizza-portuguesa"],
    });
    expect(after["aussie"]).toBe("？？？ピザ A（たまねぎ）");
    expect(after["pizza-portuguesa"]).toBe("？？？ピザ C（たまねぎ）");
  });

  it("step 12: any discovery order keeps every remaining letter; the last sibling keeps its letter too", () => {
    const base = labels(play(12));
    for (const gone of [["aussie"], ["pizza-portuguesa"], ["aussie", "brazilian-calabresa"], ["brazilian-calabresa", "pizza-portuguesa"]]) {
      const after = labels(play(12, gone));
      for (const [id, label] of Object.entries(after)) expect(label).toBe(base[id]);
      expect(Object.keys(after)).toHaveLength(3 - gone.length);
    }
    expect(labels(play(12, ["aussie", "brazilian-calabresa"]))["pizza-portuguesa"]).toBe("？？？ピザ C（たまねぎ）");
  });

  it("step 28: after A is discovered B stays B", () => {
    expect(labels(settled(28, ["ratatouille-pizza"]))).toEqual({ "pesto-vegetariana": "？？？ピザ B（ズッキーニ）" });
    expect(labels(settled(28, ["pesto-vegetariana"]))).toEqual({ "ratatouille-pizza": "？？？ピザ A（ズッキーニ）" });
  });

  it("a slot is never reused: no remaining entry ever takes a discovered sibling's letter", () => {
    const after = Object.values(labels(play(12, ["aussie"])));
    expect(after).not.toContain("？？？ピザ A（たまねぎ）");
    expect(new Set(after).size).toBe(after.length);
  });

  it("a stored Notebook line of a now-discovered B cannot alias any current entry", () => {
    const before = play(12);
    const bLabel = labels(before)["brazilian-calabresa"];
    const stored = researchRowsFeedback({ labelJa: bLabel, rows: [{ ingredientId: "ham", category: "topping", verdict: "NEGATIVE" }] })!;
    const after = play(12, ["brazilian-calabresa"]);
    expect(stored.textJa.startsWith(bLabel)).toBe(true);
    expect(Object.values(labels(after))).not.toContain(bLabel);
  });

  it("a new cohort registered later never changes an existing label", () => {
    const at12 = labels(play(12));
    // The same player, one step later, with the step-12 siblings still undiscovered.
    const at13 = labels({ dex: discover(...keysBefore(12)), ownedIngredientIds: ladderOwned(13) });
    expect(at13["fugazza"]).toBe("？？？ピザ（オリーブオイル）");
    for (const [id, label] of Object.entries(at12)) expect(at13[id]).toBe(label);
  });
});

describe("reload re-derivation (nothing is saved, OD-R2-2)", () => {
  it("the same save yields byte-identical labels, in the same order", () => {
    for (const step of [12, 25, 28]) {
      const i = settled(step);
      const first = researchEntryViews(i).map((v) => [v.recipeId, v.label]);
      const second = researchEntryViews(reload(i)).map((v) => [v.recipeId, v.label]);
      expect(second).toEqual(first);
    }
  });

  it("the label function reads ownership + catalog only: no Dex, no stored Hint fact, no session", () => {
    const i = play(12);
    const bare = labels(i);
    const withFacts = Object.fromEntries(
      researchEntryViews({ ...i, discoveryHintFacts: { aussie: ["ing:onion", "h5:cheese"], "pizza-portuguesa": ["meta:ingredient-total"] } }).map((v) => [v.recipeId, v.label]),
    );
    expect(withFacts).toEqual(bare);
  });
});

describe("26+ siblings: Z -> AA -> AB", () => {
  const template = RECIPES.find((r) => r.id === "aussie")!;
  const clones = (n: number): Recipe[] => Array.from({ length: n }, (_, i) => ({ ...template, id: `synthetic-onion-${i}` }) as unknown as Recipe);

  it("28 onion-last siblings are lettered A..Z, AA, AB exactly once each", () => {
    const letters = researchCohortLetters(ladderOwned(12), clones(28));
    const values = [...letters.values()];
    expect(values).toHaveLength(28);
    expect(new Set(values).size).toBe(28);
    expect([...values].sort((a, b) => a.length - b.length || (a < b ? -1 : 1))).toEqual([
      ...Array.from({ length: 26 }, (_, i) => researchLetter(i)),
      "AA",
      "AB",
    ]);
    expect(values).toContain("Z");
  });

  it("the 27th and 28th by the anonymous order are AA and AB", () => {
    const recipes = clones(28);
    const letters = researchCohortLetters(ladderOwned(12), recipes);
    const ordered = [...letters.entries()].sort((a, b) => {
      const rank = (l: string) => (l.length === 1 ? l.charCodeAt(0) - 65 : 26 + (l.charCodeAt(1) - 65));
      return rank(a[1]) - rank(b[1]);
    });
    expect(ordered[25][1]).toBe("Z");
    expect(ordered[26][1]).toBe("AA");
    expect(ordered[27][1]).toBe("AB");
  });

  it("a discovered synthetic sibling keeps its slot and entries stay unique", () => {
    const recipes = clones(28);
    const dex = discover(...keysBefore(12), "synthetic-onion-3");
    const entries = deriveResearchEntries({ dex, ownedIngredientIds: ladderOwned(12) }, {}, recipes).entries;
    expect(entries).toHaveLength(27);
    expect(new Set(entries.map((e) => e.cohortLetter)).size).toBe(27);
  });
});

describe("the label authority (INV-B7)", () => {
  it("format: siblings 「？？？ピザ B（たまねぎ）」, single 「？？？ピザ（チキン）」, no circled digits or digits", () => {
    expect(researchEntryLabel({ unlockIngredientId: "onion", cohortLetter: "B" })).toBe("？？？ピザ B（たまねぎ）");
    expect(researchEntryLabel({ unlockIngredientId: "chicken", cohortLetter: null })).toBe("？？？ピザ（チキン）");
    expect(researchEntryLabel({ unlockIngredientId: "not-a-catalog-id", cohortLetter: "A" })).toBe("？？？ピザ A");
    for (const step of [12, 25, 28]) {
      for (const label of Object.values(labels(settled(step)))) expect(label).not.toMatch(/[\d①-⑳㉑-㉟㊱-㊿]/);
    }
  });

  it("carries only the unlock ingredient and the letter: no recipe name / id, No.xx, count or hash", () => {
    for (const step of [12, 28]) {
      for (const [recipeId, label] of Object.entries(labels(settled(step)))) {
        const recipe = RECIPES.find((r) => r.id === recipeId)!;
        expect(label).not.toContain(recipe.nameJa);
        expect(label).not.toContain(recipeId);
        expect(label).not.toMatch(/No\.|種類|\d/);
        expect(label).toMatch(/^？？？ピザ( [A-Z]+)?（[^（）]+）$/);
      }
    }
  });

  it("the projection exposes the letter but no cohort size, count or hash", () => {
    const entry = deriveResearchEntries(play(12)).entries[0];
    expect(Object.keys(entry).sort()).toEqual(["cohortLetter", "knownExactIngredientIds", "recipeId", "state", "totalIngredientCount", "unlockIngredientId"]);
    expect(JSON.stringify(deriveResearchEntries(play(12)))).not.toMatch(/cohortSize|hash|size|"count"|remaining/i);
  });
});
