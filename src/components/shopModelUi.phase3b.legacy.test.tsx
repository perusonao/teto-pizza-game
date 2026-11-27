import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// B案 Phase 3b: the legacy model (Production's default; no flag mock here). Every Phase 3b path must read as before.
import { cleanup, render, screen } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES, getRecipe } from "../data/recipes";
import { compareHintCandidates, discoverableHintCandidates } from "../logic/discovery/hintTarget";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import type { DexEntry, DexState } from "../state/dex";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { menuCountableDex } from "../state/recipeChapters";
import { recipeDiscoveryState } from "../state/recipeDiscoveryState";
import { DexOverlay } from "./DexOverlay";

afterEach(cleanup);

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FULL_STOCK = Object.fromEntries(ALL_IDS.map((id) => [id, 99]));
const dexOf = (...ids: string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));
const SHOP = { reputation: 0, grantedMenuRecipeIds: [] };

describe("legacy: nothing of Phase 3b applies", () => {
  it("the model is legacy and every stage reads as open", () => {
    const model = activeProgressionModel();
    expect(model.id).toBe("legacy");
    for (const r of RECIPES) expect(model.isRecipeStageOpen(r.id, { dex: [], shop: SHOP })).toBe(true);
  });

  it("the counted Dex is the Dex itself (the same array)", () => {
    const dex = dexOf("margherita", "meat-lovers");
    expect(menuCountableDex(dex, SHOP)).toBe(dex);
  });

  it("hint / research candidates are every DISCOVERABLE recipe, as before", () => {
    const inputs = { dex: dexOf("margherita"), ownedIngredientIds: ALL_IDS, unlockedForShopIngredientIds: [], inventory: FULL_STOCK, shop: SHOP };
    const expected = RECIPES.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE").sort((a, b) => compareHintCandidates(a, b, RECIPES));
    expect(discoverableHintCandidates(inputs).map((r) => r.id)).toEqual(expected.map((r) => r.id));
  });

  it("a Free Cooking first discovery is a discovery (+50), nothing is held, the shop state is untouched", () => {
    const s = gameReducer(
      createInitialGameState(dexOf("margherita"), ALL_IDS, 0, FULL_STOCK),
      { type: "START_FREE_COOK" },
    );
    const atResult = {
      ...s,
      recipe: getRecipe("meat-lovers")!,
      phase: "RESULT",
      score: { total: 80, stars: 3, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 },
      completion: { status: "PASS" },
    } as GameState;
    const after = gameReducer(atResult, { type: "REGISTER_TO_DEX" });
    expect(after.justDiscovered).toBe(true);
    expect(after.lastPitzCredit?.discoveryBonusPitz).toBe(50);
    expect(after.lastIdentifiedAwaiting).toBeNull();
    expect(after.lastMenuEntries).toBeNull();
    expect(after.lastReputationGain).toBeNull();
    expect(after.shop).toBe(s.shop);
  });

  it("the Dex shows no 判明 card and counts every discovered recipe, even with a shop state passed", () => {
    render(<DexOverlay dex={dexOf("margherita", "meat-lovers")} shop={SHOP} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />);
    expect(document.querySelector("[data-dex-identified]")).toBeNull();
    expect(screen.queryByText("判明")).toBeNull();
    expect(screen.getByText(/発見 2 \//)).toBeInTheDocument();
    // PR #915: no stage condition in any chapter heading (legacy chapters are always open).
    expect(document.querySelector("[data-testid='dex-stage-unlock']")).toBeNull();
    expect(document.querySelector("[data-stage-locked]")).toBeNull();
    expect(screen.queryByText(/で解放/)).toBeNull();
  });
});
