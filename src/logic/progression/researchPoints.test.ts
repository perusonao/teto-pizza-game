import { describe, expect, it } from "vitest";
import { MENU_CATALOG } from "../../data/menuCatalog";
import { RESEARCH_FALLBACK_STAGE, RESEARCH_POINTS_BY_STAGE, researchPointsForStage, researchTrialStage } from "./researchPoints";
import { activeShopCatalog } from "./shopProgression";

/** B案 Phase 3f (Issue #901): the research point table and how a trial's stage is decided. */
const catalog = activeShopCatalog();
const firstOfStage = (stage: number) => MENU_CATALOG.find((e) => e.chapter === stage)!.recipeId;

describe("RESEARCH_POINTS_BY_STAGE", () => {
  it("awards 1 / 2 / 3 / 4 / 5 points by stage", () => {
    expect([...RESEARCH_POINTS_BY_STAGE]).toEqual([1, 2, 3, 4, 5]);
  });

  it("each stage earns its own entry of the table", () => {
    for (let stage = 1; stage <= 5; stage++) expect(researchPointsForStage(stage)).toBe(RESEARCH_POINTS_BY_STAGE[stage - 1]);
  });

  it("reads whatever table it is given (one table to tune)", () => {
    expect(researchPointsForStage(3, [10, 20, 30, 40, 50])).toBe(30);
  });

  it("a stage outside 1..5 is clamped into it", () => {
    expect(researchPointsForStage(0)).toBe(1);
    expect(researchPointsForStage(9)).toBe(5);
  });
});

describe("researchTrialStage", () => {
  it("the catalog has a recipe on every stage (the fixtures below rely on it)", () => {
    for (let stage = 1; stage <= 5; stage++) expect(firstOfStage(stage)).toBeTruthy();
  });

  it("takes the lower of the target and adopted match stages", () => {
    expect(researchTrialStage(firstOfStage(4), firstOfStage(1), catalog)).toEqual({ stage: 1, source: "EXACT_MATCH" });
    expect(researchTrialStage(firstOfStage(2), firstOfStage(4), catalog)).toEqual({ stage: 2, source: "RESEARCH_TARGET" });
    expect(researchTrialStage(firstOfStage(4), firstOfStage(4), catalog)).toEqual({ stage: 4, source: "EXACT_MATCH" });
  });

  it("an adopted target alone still earns at stage 1", () => {
    expect(researchTrialStage(firstOfStage(3), null, catalog)).toEqual({ stage: 1, source: "FALLBACK" });
    expect(researchTrialStage(firstOfStage(3), "not-adopted", catalog)).toEqual({ stage: 1, source: "FALLBACK" });
  });

  it("with no target, an adopted exact match decides it", () => {
    for (let stage = 1; stage <= 5; stage++) {
      expect(researchTrialStage(null, firstOfStage(stage), catalog)).toEqual({ stage, source: "EXACT_MATCH" });
    }
  });

  it("neither: stage 1", () => {
    expect(researchTrialStage(null, null, catalog)).toEqual({ stage: RESEARCH_FALLBACK_STAGE, source: "FALLBACK" });
    expect(RESEARCH_FALLBACK_STAGE).toBe(1);
  });

  it("a target or a match outside the adopted catalog has no stage and falls through", () => {
    expect(researchTrialStage("not-adopted", firstOfStage(5), catalog)).toEqual({ stage: 5, source: "EXACT_MATCH" });
    expect(researchTrialStage("not-adopted", "also-not", catalog)).toEqual({ stage: 1, source: "FALLBACK" });
  });
});
