import { openHintSheetOn } from "./testSupport/hintSheetOpen";
import { describe, expect, it, vi } from "vitest";


// Hint 5.0 is ON in production (H5-6). This suite pins the pre-Hint-5.0 purchase behaviour, which is the
// rollback path, so it runs with the ladder flag OFF.
vi.mock("../logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: false }));
/**
 * Discovery Hint 4.0 DH4-2B: flag-off parity. Before OD-DH4-PROD-1 this was the production build;
 * it is now the one-line rollback (`DEDUCTION_HINTS_ENABLED = false`): a 構成 / 特徴 request is a
 * no-op and the sheet carries no deduction part, while 材料 is unchanged. The flag is mocked off here.
 */
vi.mock("../logic/discovery/deductionFlag", () => ({ DEDUCTION_HINTS_ENABLED: false, DEDUCTION_HINT_PRICE: { structure: 5, attribute: 5 } }));

const { INGREDIENTS } = await import("../data/ingredients");
const { EMPTY_DEX, registerScoreToDex } = await import("./dex");
const { hintSheetView } = await import("./discoveryHint");
const { createInitialGameState, gameReducer } = await import("./gameReducer");

const { ALL_INGREDIENT_IDS: ALL_IDS } = await import("../logic/discovery/testSupport/deductionInversion");
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);

describe("flag off (rollback)", () => {
  it("構成 / 特徴 requests change nothing; 材料 still works; the view has no deduction part", () => {
    const dex = registerScoreToDex(EMPTY_DEX, "margherita", { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
    const initial = createInitialGameState(dex, ALL_IDS, 100, Object.fromEntries(FINITE.map((id) => [id, 30])), [], ALL_IDS, {}, {});
    const s = openHintSheetOn(initial, "capricciosa");
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
