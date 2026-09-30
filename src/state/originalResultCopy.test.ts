import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { ORIGINAL_LEAD_COPY, originalResultKind } from "./originalResultCopy";

describe("P2-A: the kind of ORIGINAL is distinguished internally", () => {
  const cases: [DiscoveryOutcome | null | undefined, string][] = [
    [{ kind: "ORIGINAL", blockedTargetIds: [] }, "ORDINARY"],
    [{ kind: "AMBIGUOUS", targetIds: ["a", "b"] }, "AMBIGUOUS"],
    [{ kind: "INCOMPLETE_MATCH", recipeId: "funghi", targetId: "shipped:funghi" }, "INCOMPLETE_MATCH"],
    [null, "ORDINARY"],
    [undefined, "ORDINARY"],
  ];
  it.each(cases)("%j -> %s", (outcome, kind) => {
    expect(originalResultKind(outcome)).toBe(kind);
  });

  it("OD-P2-1 = A: the neutral lead is shared by ORDINARY and AMBIGUOUS; INCOMPLETE_MATCH is unchanged", () => {
    expect(ORIGINAL_LEAD_COPY.ORDINARY).toBe("図鑑にはまだ載っていないピザ！");
    expect(ORIGINAL_LEAD_COPY.AMBIGUOUS).toBe(ORIGINAL_LEAD_COPY.ORDINARY);
    expect(ORIGINAL_LEAD_COPY.INCOMPLETE_MATCH).toBe("図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。");
  });
});

describe("OD-P2-1 = A: the neutral lead discloses nothing", () => {
  const lead = ORIGINAL_LEAD_COPY.AMBIGUOUS;

  it("lead / action split: the lead carries no next-action (the FAR / near-miss line owns it)", () => {
    for (const kind of ["ORDINARY", "AMBIGUOUS"] as const) {
      expect(ORIGINAL_LEAD_COPY[kind]).not.toMatch(/試して|みよう|組み合わせ/);
    }
  });

  it("no uniqueness claim, no digit / count, no candidate wording, no internal reason", () => {
    expect(lead).not.toContain("あなただけ");
    expect(lead).not.toMatch(/[0-9０-９]|つ以上|複数|候補|登録できない|登録不能|載せられない|同じ|重複|衝突/);
  });

  it("names no recipe and no ingredient", () => {
    for (const s of [...RECIPES.flatMap((r) => [r.id, r.nameJa]), ...INGREDIENTS.flatMap((i) => [i.id, i.nameJa])]) {
      expect(lead).not.toContain(s);
    }
  });

  it("canary: production has no identity collision, so AMBIGUOUS is unreachable in production", () => {
    const keys = RECIPE_DISCOVERY_CATALOG.map((t) => JSON.stringify([[...t.items].sort(), [...(t.sauceBase ?? [])].sort()]));
    expect(new Set(keys).size).toBe(keys.length);
    // Adding a colliding recipe fails this test: OD-P2-1 must be RE-DECIDED before a collision recipe ships.
  });
});
