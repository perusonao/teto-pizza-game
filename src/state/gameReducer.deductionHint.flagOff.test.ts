import { describe, expect, it, vi } from "vitest";

/**
 * Discovery Hint 4.0 DH4-2B: production parity. A production build has no DEV and no
 * VITE_PREVIEW_MODE, so the E3 flag is off: a 構成 / 特徴 request is a no-op and the sheet carries no
 * deduction part. The flag module is mocked to its production value here.
 */
vi.mock("../logic/discovery/deductionFlag", () => ({ DEDUCTION_HINTS_ENABLED: false }));

const { INGREDIENTS } = await import("../data/ingredients");
const { EMPTY_DEX, registerScoreToDex } = await import("./dex");
const { hintSheetView } = await import("./discoveryHint");
const { createInitialGameState, gameReducer } = await import("./gameReducer");

const { ALL_INGREDIENT_IDS: ALL_IDS } = await import("../logic/discovery/testSupport/deductionInversion");
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);

describe("E3 flag off (production)", () => {
  it("構成 / 特徴 requests change nothing; 材料 still works; the view has no deduction part", () => {
    const dex = registerScoreToDex(EMPTY_DEX, "margherita", { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
    const initial = createInitialGameState(dex, ALL_IDS, 100, Object.fromEntries(FINITE.map((id) => [id, 30])), [], ALL_IDS, {}, {});
    const s = [{ type: "START_FREE_COOK" } as const, { type: "SHOW_HINT", pinnedRecipeId: "capricciosa" } as const].reduce(gameReducer, initial);
    for (const family of ["structure", "attribute"] as const) {
      expect(gameReducer(s, { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0, family })).toBe(s);
    }
    const view = hintSheetView(s);
    expect(view).toMatchObject({ kind: "SELECTABLE", deduction: null });
    const material = gameReducer(s, { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0 });
    expect(material.pitzBalance).toBe(95);
    expect(gameReducer(s, { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0, family: "material" }).pitzBalance).toBe(95);
  });
});
