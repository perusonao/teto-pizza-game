import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import {
  AMBIGUOUS_COPY_CANDIDATES,
  AMBIGUOUS_COPY_DECIDED,
  ORIGINAL_LEAD_COPY,
  originalResultKind,
} from "./originalResultCopy";

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

  it("the ordinary and incomplete copy are exactly today's production copy", () => {
    expect(ORIGINAL_LEAD_COPY.ORDINARY).toBe("図鑑にはない、あなただけのピザ！");
    expect(ORIGINAL_LEAD_COPY.INCOMPLETE_MATCH).toBe("図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。");
  });
});

describe("OD-P2-1 (AMBIGUOUS wording) is pending: production copy is not decided here", () => {
  it("AMBIGUOUS is byte-identical to the ordinary copy until the Owner decides", () => {
    expect(AMBIGUOUS_COPY_DECIDED).toBe(false);
    expect(ORIGINAL_LEAD_COPY.AMBIGUOUS).toBe(ORIGINAL_LEAD_COPY.ORDINARY);
  });

  it("that is safe today only because production has no identity collision (AMBIGUOUS is unreachable)", () => {
    const keys = RECIPE_DISCOVERY_CATALOG.map((t) => JSON.stringify([[...t.items].sort(), [...(t.sauceBase ?? [])].sort()]));
    expect(new Set(keys).size).toBe(keys.length);
    // Adding a colliding recipe fails this test: OD-P2-1 must be decided first.
  });

  it("the Owner candidates are true, id-free, count-free and name no recipe or ingredient", () => {
    expect(AMBIGUOUS_COPY_CANDIDATES.map((c) => c.id)).toEqual(["A", "B", "C"]);
    for (const c of AMBIGUOUS_COPY_CANDIDATES) {
      expect(c.textJa).not.toMatch(/[0-9０-９]|つ以上|複数|候補/);
      for (const s of [...RECIPES.flatMap((r) => [r.id, r.nameJa]), ...INGREDIENTS.flatMap((i) => [i.id, i.nameJa])]) {
        expect(c.textJa).not.toContain(s);
      }
    }
  });
});
