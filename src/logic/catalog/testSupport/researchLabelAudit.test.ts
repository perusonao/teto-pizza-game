import { describe, expect, it } from "vitest";
import { RECIPES } from "../../../data/recipes";
import { pinsaEnabled } from "../../../data/pinsaGate";
import { researchLetterChangesAcrossOrders } from "./researchLabelAudit";

describe("researchLetterChangesAcrossOrders (test support)", () => {
  it.runIf(pinsaEnabled())("keeps the canonical occurrence of a transition that a non-canonical scenario saw first (Codex P2, PR #759): pinsa-romana re-letters jamon-serrano-pizza in the canonical order", () => {
    const jamon = researchLetterChangesAcrossOrders(["pinsa-romana"], RECIPES, 0).get("jamon-serrano-pizza") ?? [];
    expect(jamon.some((c) => c.canonical)).toBe(true);
    expect(jamon.some((c) => !c.canonical && jamon.some((k) => k.canonical && k.change === c.change))).toBe(true); // the same change is recorded with both provenances
  });

  it("reports no change when nothing is added", () => {
    expect(researchLetterChangesAcrossOrders([], RECIPES, 2).size).toBe(0);
  });
});
