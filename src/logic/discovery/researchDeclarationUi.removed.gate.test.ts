import { describe, expect, it } from "vitest";

/**
 * Contract 2.1 S3 gate: the Contract 2.0 "declare one ingredient before the attempt" UI is gone from production code.
 * Reducer state / actions that still carry the old model (researchTest, SET_RESEARCH_TEST, lastIngredientTest) are
 * deliberately out of this gate: S4 removes them.
 */
const sources = import.meta.glob<string>("/src/**/*.{ts,tsx,css}", { query: "?raw", import: "default", eager: true });
const production = Object.entries(sources).filter(([path]) => !/\.test\.(ts|tsx)$/.test(path) && !path.includes("/testSupport/"));

const scan = (pattern: RegExp) => production.filter(([, text]) => pattern.test(text)).map(([path]) => path);

describe("Contract 2.0 declaration UI is removed from production (S3)", () => {
  it("no ResearchTestPicker component, import or test id", () => {
    expect(scan(/ResearchTestPicker|research-test-picker|research-test-button|research-test-/)).toEqual([]);
  });
  it("no picker / declaration copy", () => {
    expect(scan(/調べる食材をえらぶ|今回調べる食材|今回調べる:|食材調査なし|試作中は変更できません|今回調べた結果|調べていません/)).toEqual([]);
  });
  it("no UI-boundary declaration wiring (onSetResearchTest / ingredientTest prop / BakeUnusedConfirm)", () => {
    expect(scan(/onSetResearchTest|BakeUnusedConfirm|ingredient-test|ingredientTestLine/)).toEqual([]);
    expect(scan(/\bingredientTest\b/).filter((p) => /\/(components|screens)\//.test(p) || p.endsWith("/App.tsx"))).toEqual([]);
  });

  it("S4: no old state / action / helper remains in production (reducer, hint model, domain)", () => {
    expect(scan(/researchTest\b|researchTestLocked|lastIngredientTest|SET_RESEARCH_TEST|canDeclareResearchTest|isRegisteredResearchEntry|IngredientTestVerdict|evaluateIngredientTest|identifyDeclaredIngredient/)).toEqual([]);
    expect(Object.keys(sources)).not.toContain("/src/logic/discovery/researchIdentify.ts");
    expect(Object.keys(sources)).toContain("/src/logic/discovery/researchIdentifyFlag.ts");
  });
  it("S5: the RESULT panel is fed through the feature flag only", () => {
    const screen = sources["/src/screens/GameScreen.tsx"] ?? "";
    expect(screen).toContain("researchRows={RESEARCH_IDENTIFY_ENABLED ? state.lastResearchRows : null}");
  });
});
