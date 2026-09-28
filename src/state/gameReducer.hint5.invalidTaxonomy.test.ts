import { describe, expect, it, vi } from "vitest";

/**
 * Discovery Hint 5.0 (Issue #292), H5-2: an invalid / missing taxonomy through the real reducer, with
 * the flag ON. hawaiian's roles are replaced by roles whose sub-topping has no valid family (a sauce
 * id). OD-H5-T-COV says the target is then not a Hint 5.0 target:
 * - no rung is sold and nothing is charged;
 * - no silent fallback to existence / group / category;
 * - no fallback to the 材料 / 構成 / 特徴 path either.
 *
 * The production data gates keep this state unreachable (hint5Taxonomy.gate.test.ts).
 */
vi.mock("../logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: true }));
vi.mock("../data/recipeHintRoles", async (importOriginal) => {
  const original = await importOriginal<typeof import("../data/recipeHintRoles")>();
  return {
    RECIPE_HINT_ROLES: { ...original.RECIPE_HINT_ROLES, hawaiian: { hintKeyToppingId: "pineapple", hintSubToppingOrder: ["tomato-sauce"] } },
  };
});

const { INGREDIENTS } = await import("../data/ingredients");
const { EMPTY_DEX, registerScoreToDex } = await import("./dex");
const { hint5SheetView } = await import("./discoveryHint");
const { createInitialGameState, gameReducer } = await import("./gameReducer");
const { ALL_INGREDIENT_IDS: ALL_IDS } = await import("../logic/discovery/testSupport/deductionInversion");

type GameState = ReturnType<typeof createInitialGameState>;
type GameAction = Parameters<typeof gameReducer>[1];
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const dex = registerScoreToDex(EMPTY_DEX, "margherita", { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;

function sheetOn(target: string): GameState {
  const initial = createInitialGameState(dex, ALL_IDS, 100, Object.fromEntries(FINITE.map((id) => [id, 30])), [], ALL_IDS, {}, {});
  return act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: target });
}

describe("invalid taxonomy with the flag ON (fail closed, no charge)", () => {
  it("hawaiian (invalid roles): no ladder view, no rung sold, no Pitz, no fact, no fallback path", () => {
    const s = sheetOn("hawaiian");
    expect(s.hintSession?.targetId).toBe("hawaiian");
    expect(hint5SheetView(s)).toBeNull();
    for (const expectedRungIndex of [1, 2, 5]) expect(act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex })).toBe(s);
    for (const family of [undefined, "structure", "attribute"] as const) {
      expect(act(s, { type: "PURCHASE_SELECTABLE_HINT", preference: "topping", expectedPaidCount: 0, ...(family ? { family } : {}) })).toBe(s);
    }
  });

  it("a valid target next to it is unaffected", () => {
    const s = sheetOn("bambino");
    expect(hint5SheetView(s)!.next).toMatchObject({ rungIndex: 1, price: 10 });
    expect(act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 1 }).pitzBalance).toBe(90);
  });
});
