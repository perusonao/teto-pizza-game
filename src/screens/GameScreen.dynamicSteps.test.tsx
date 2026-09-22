import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import type { IngredientCategory } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { getCookingProfile } from "../data/cookingProfiles";

/**
 * Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps): component-level regression coverage for
 * the 「次へ」/「焼く！」 CTA bar (GameScreen.tsx's own `isLastPrepareStep`). Before this task that
 * check was hardcoded to `state.makingStep === "TOPPING"`, which only ever fires for a recipe
 * whose derived profile actually has a TOPPING step -- for quattro-formaggi (no required
 * topping-category ingredient, last PREPARE step is CHEESE) the CTA would have kept rendering
 * 「次へ」 forever, and 「焼く！」 (the only way to reach BAKE) would never appear. This file renders
 * the real `GameScreen` against real reducer state built by overriding `recipe`/`cookingProfile`
 * directly onto a prepared round (the same pattern GameScreen.makingStepNav.test.tsx's own
 * synthetic-recipe fixture and gameReducer.cutStep.test.ts already use, to bypass unlock-chain
 * gating that is orthogonal to what this file tests) -- both recipes are real, shipped `RecipeId`s
 * whose `getCookingProfile` derivation is exercised exactly as production does.
 */

function preparedFor(recipeId: "marinara" | "quattro-formaggi"): GameState {
  const base = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new Error(`${recipeId} fixture missing`);
  const cookingProfile = getCookingProfile(recipeId);
  return { ...base, recipe, cookingProfile, cutState: { ...base.cutState, config: cookingProfile.cutConfig ?? base.cutState.config } };
}

function confirm(state: GameState): GameState {
  return gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
}

const CATEGORY_FOR_STEP: Record<string, IngredientCategory> = {
  DOUGH: "sauce",
  SAUCE: "sauce",
  CHEESE: "cheese",
  TOPPING: "topping",
};

function renderAt(state: GameState) {
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory={CATEGORY_FOR_STEP[state.makingStep] ?? "topping"}
      selectedIngredientId={null}
      bakeProgress={null}
      referenceModeEnabled
      referencePizza={null}
      isReferencePopoverOpen={false}
      isGlobalOverlayOpen={false}
      sauceMetrics={emptySauceMetrics()}
      sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
      isDispensingSauce={false}
      pieceShadowMetrics={[]}
      showDoughShape
      doughShapeComplete
      onGoHome={() => {}}
      onBeginPrepare={() => {}}
      onResetPizza={() => {}}
      onConfirmMakingStep={() => {}}
      onStartBake={() => {}}
      onShowHint={() => {}}
      onChangeCategory={() => {}}
      onSelectIngredient={() => {}}
      onTapPizza={() => {}}
      onBakeTick={() => {}}
      onConfirmBake={() => {}}
      onRetrySameRecipe={() => {}}
      onBackToPizzaSelect={() => {}}
      onMissionServeNext={() => {}}
      onMissionStart={() => {}}
      onMissionExitToFree={() => {}}
      onMissionCloseIntro={() => {}}
      onShowRanking={() => {}}
      onReferencePopoverChange={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      onAddCutLine={() => {}}
      onUndoCutLine={() => {}}
      cutRejectionMessage={null}
      onDoughElementChange={() => {}}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={() => {}}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("marinara (no CHEESE step): CTA bar", () => {
  it("PREPARE tabs: CHEESE tab absent, 生地/ソース/具材 remain, no blank step", () => {
    renderAt(preparedFor("marinara"));
    expect(screen.queryByRole("tab", { name: "チーズ" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "生地" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ソース" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "具材" })).toBeInTheDocument();
  });

  it("at TOPPING (marinara's own last PREPARE step), the CTA is 「焼く！」, not 「次へ」", () => {
    const atTopping = confirm(confirm(preparedFor("marinara"))); // DOUGH -> SAUCE -> TOPPING
    expect(atTopping.makingStep).toBe("TOPPING");
    renderAt(atTopping);
    expect(screen.getByRole("button", { name: /焼く！/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /次へ/ })).not.toBeInTheDocument();
  });

  it("BAKE tab label has no 🔥 anywhere in the screen", () => {
    renderAt(preparedFor("marinara"));
    expect(screen.queryByText(/\u{1F525}/u)).not.toBeInTheDocument();
  });
});

describe("quattro-formaggi (no TOPPING step): CTA bar", () => {
  it("PREPARE tabs: TOPPING tab absent, 生地/ソース/チーズ remain, no blank step", () => {
    renderAt(preparedFor("quattro-formaggi"));
    expect(screen.queryByRole("tab", { name: "具材" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "生地" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ソース" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "チーズ" })).toBeInTheDocument();
  });

  it("at CHEESE (quattro-formaggi's own last PREPARE step), the CTA is 「焼く！」, not stuck on 「次へ」 (regression: this used to be hardcoded to TOPPING)", () => {
    const atCheese = confirm(confirm(preparedFor("quattro-formaggi"))); // DOUGH -> SAUCE -> CHEESE
    expect(atCheese.makingStep).toBe("CHEESE");
    renderAt(atCheese);
    expect(screen.getByRole("button", { name: /焼く！/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /次へ/ })).not.toBeInTheDocument();
  });

  it("the CTA correctly still shows 「次へ」 (not 焼く！) at an earlier, non-last step (SAUCE)", () => {
    const atSauce = confirm(preparedFor("quattro-formaggi")); // DOUGH -> SAUCE
    expect(atSauce.makingStep).toBe("SAUCE");
    renderAt(atSauce);
    expect(screen.getByRole("button", { name: /次へ/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /焼く！/ })).not.toBeInTheDocument();
  });
});

describe("margherita (full-step recipe, regression baseline)", () => {
  function preparedMargherita(): GameState {
    return gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
  }

  it("CHEESE and TOPPING tabs both remain; CTA is 「次へ」 until TOPPING, then 「焼く！」", () => {
    const atCheese = confirm(confirm(preparedMargherita())); // DOUGH -> SAUCE -> CHEESE
    renderAt(atCheese);
    expect(screen.getByRole("tab", { name: "チーズ" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "具材" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /次へ/ })).toBeInTheDocument();
    cleanup();

    const atTopping = confirm(atCheese); // CHEESE -> TOPPING
    renderAt(atTopping);
    expect(screen.getByRole("button", { name: /焼く！/ })).toBeInTheDocument();
  });
});
