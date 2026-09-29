import { describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { ALL_INGREDIENT_IDS as ALL_IDS } from "../logic/discovery/testSupport/deductionInversion";
import { EMPTY_DEX, registerScoreToDex } from "./dex";
import { hint5LadderActive, hint5SheetView, hintSheetView, requestHint5RungFact } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";


// Hint 5.0 is ON in production (H5-6). This suite pins the pre-Hint-5.0 purchase behaviour, which is the
// rollback path, so it runs with the ladder flag OFF.
vi.mock("../logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: false }));
/**
 * Discovery Hint 5.0 (Issue #292), H5-2: flag-OFF parity. The flag is ON in production since H5-6, so this
 * is the ROLLBACK path (the module is mocked OFF above); ./hint5Flag.preview.test.ts pins the ON default.
 * - PURCHASE_HINT5_RUNG is a no-op.
 * - The ladder view is null.
 * - 材料 / 構成 / 特徴 behave exactly as before H5-2.
 *
 * Every pre-existing hint suite also runs with the flag off and passes unchanged.
 */

const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const dex = registerScoreToDex(EMPTY_DEX, "margherita", { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;

function sheetOn(target: string, pitz: number): GameState {
  const initial = createInitialGameState(dex, ALL_IDS, pitz, Object.fromEntries(FINITE.map((id) => [id, 30])), [], ALL_IDS, {}, {});
  return act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: target });
}

describe("Hint 5.0 flag OFF (the rollback)", () => {
  it("PURCHASE_HINT5_RUNG changes nothing for any target at any index; the ladder view and request helper are inert", () => {
    for (const r of RECIPES.filter((x) => x.id !== "margherita")) {
      const s = sheetOn(r.id, 1000);
      for (const expectedRungIndex of [1, 2, 5]) expect(act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex }), r.id).toBe(s);
      expect(hint5SheetView(s), r.id).toBeNull();
      expect(hint5LadderActive(s), r.id).toBe(false);
      expect(requestHint5RungFact(s, 1), r.id).toBeNull();
    }
  });

  it("材料 / 構成 / 特徴 are unchanged: the same charges and the same stored facts as before H5-2", () => {
    const s = sheetOn("capricciosa", 100);
    const material = act(s, { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0 });
    expect(material.pitzBalance).toBe(95);
    expect(material.discoveryHintFacts.capricciosa).toEqual(["ing:tomato-sauce"]);
    const structure = act(s, { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0, family: "structure" });
    expect(structure.pitzBalance).toBe(95);
    expect(structure.discoveryHintFacts.capricciosa![0]).toBe("meta:ingredient-total");
    const view = hintSheetView(s);
    expect(view.kind).toBe("SELECTABLE");
    expect(view).toMatchObject({ deduction: { nextPrice: 5 } });
  });

  it("the Dex-0 Margherita onboarding is unchanged (free reveal)", () => {
    const initial = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, Object.fromEntries(FINITE.map((id) => [id, 30])), [], ALL_IDS, {}, {});
    const s = act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(hintSheetView(s).kind).toBe("TARGET");
    expect(act(s, { type: "PURCHASE_DISCOVERY_HINT", level: 1 }).pitzBalance).toBe(0);
  });
});
