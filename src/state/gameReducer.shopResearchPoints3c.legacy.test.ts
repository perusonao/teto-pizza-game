import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { researchPointBalanceOf } from "../logic/progression/shopProgress";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { SAVE_STORAGE_KEY } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import { onionPizza, SEED_SAVE, Tab } from "./testSupport/r8Harness";

/** B案 Phase 3c (Issue #901): under the legacy model (the Production default) no trial earns research points, and nothing moves. */
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FULL_STOCK = Object.fromEntries(ALL_IDS.map((id) => [id, 99]));
const score = { total: 80, stars: 3, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 };

describe("legacy: research points are never earned", () => {
  it("runs under the legacy model", () => {
    expect(activeProgressionModel().id).toBe("legacy");
  });

  it("a Free Cooking match earns none and leaves shopProgress untouched", () => {
    const s = gameReducer(createInitialGameState([], ALL_IDS, 0, FULL_STOCK), { type: "START_FREE_COOK" });
    const at = { ...s, recipe: getRecipe("margherita")!, phase: "RESULT", score, completion: { status: "PASS" } } as GameState;
    const after = gameReducer(at, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("DISCOVERED");
    expect(after.lastResearchPointGain).toBeNull();
    expect(after.shop).toBe(at.shop);
  });

  it("a failed trial is returned unchanged (the same object, as before Phase 3c)", () => {
    const s = gameReducer(createInitialGameState([], ALL_IDS, 0, FULL_STOCK), { type: "START_FREE_COOK" });
    const failed = { ...s, phase: "RESULT", score: null, completion: { status: "FAILED", failures: [{ kind: "OVERBAKED" }] } } as unknown as GameState;
    expect(gameReducer(failed, { type: "REGISTER_TO_DEX" })).toBe(failed);
  });

  it("the real bake -> save path writes no shopProgress at all", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    const tab = new Tab(storage);
    const started = gameReducer(tab.state, { type: "START_FREE_COOK" });
    tab.setRound(gameReducer({ ...started, pizza: onionPizza(4) }, { type: "START_BAKE" }));
    tab.bake(70);
    for (let i = 0; i < 4 && tab.state.phase === "POST_BAKE"; i++) tab.cutAndConfirm();
    expect(tab.state.phase).toBe("DISCOVERED");
    expect(tab.state.lastResearchPointGain).toBeNull();
    expect(researchPointBalanceOf(tab.state.shop)).toBe(0);
    expect(tab.stored()).not.toHaveProperty("shopProgress");
  });
});
