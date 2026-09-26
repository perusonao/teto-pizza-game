import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import type { IngredientCategory } from "../data/ingredients";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { getRecipe, type Recipe } from "../data/recipes";
import { getCookingProfile } from "../data/cookingProfiles";

/**
 * Issue #159 P0 (bullet 4): the making-step nav strip used to render only during PREPARE, so a
 * cut-target recipe's own CUT step never appeared in it -- the separate screen GameScreen
 * mounted during POST_BAKE/CUT had no memory of the steps before it, so the sequence a player
 * actually saw was inconsistent across the round. GameScreen.tsx now also mounts
 * `MakingStepTabs` during BAKE and POST_BAKE/CUT (see its own comment there). This file renders
 * the real `GameScreen` against real reducer state snapshots (built the same way
 * gameReducer.cutStep.test.ts's own `bakedMargheritaAtCut` does) at each phase of a full
 * margherita round (the one recipe with a `CUT` step, ../data/cookingProfiles.ts) and pins the
 * nav strip's own visible content at each one.
 */

const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

function preparedMargherita(): GameState {
  return gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" });
}

/** Walks a full, Reference-quality margherita round from DOUGH through TOPPING, stopping right
 *  before START_BAKE -- the same fixture shape gameReducer.cutStep.test.ts's own
 *  `bakedMargheritaAtCut` builds, factored so this file can also grab the mid-PREPARE and BAKE
 *  states along the way instead of only the final POST_BAKE one. */
function toppedMargherita(): GameState {
  let state = preparedMargherita();
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  state = gameReducer(state, {
    type: "COMMIT_SAUCE_DISPENSE",
    ingredientId: "tomato-sauce",
    deposits: buildIdealMargheritaSauceFixture(),
  });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  for (const p of MOZZARELLA_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
  for (const p of BASIL_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
  }
  return state;
}

function bakingMargherita(): GameState {
  return gameReducer(toppedMargherita(), { type: "START_BAKE" });
}

function cuttingMargherita(): GameState {
  return gameReducer(bakingMargherita(), { type: "CONFIRM_BAKE", value: 70 });
}

const CATEGORY_FOR_STEP: Record<string, IngredientCategory> = {
  DOUGH: "sauce",
  SAUCE: "sauce",
  CHEESE: "cheese",
  TOPPING: "topping",
};

function renderAt(state: GameState, referencePizza: typeof MARGHERITA_REFERENCE | null = null) {
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory={CATEGORY_FOR_STEP[state.makingStep] ?? "topping"}
      selectedIngredientId={null}
      bakeProgress={state.phase === "BAKE" ? 0.4 : null}
      referenceModeEnabled
      referencePizza={referencePizza}
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

describe("Making-step nav consistency across phases (Issue #159 P0, margherita = cut-target)", () => {
  it("PREPARE/DOUGH: CUT is already visible (locked) alongside the 4 real pre-BAKE tabs", () => {
    renderAt(preparedMargherita(), MARGHERITA_REFERENCE);
    expect(screen.getAllByRole("tab")).toHaveLength(5); // 生地/ソース/チーズ/具材 + カット
    const cutTab = screen.getByRole("tab", { name: "カット" });
    expect(cutTab).toBeDisabled();
    expect(cutTab.className).toContain("making-step-tab--locked");
  });

  it("BAKE: the nav strip stays mounted, every pre-BAKE step reads completed, BAKE reads active, CUT stays locked", () => {
    renderAt(bakingMargherita(), MARGHERITA_REFERENCE);
    for (const label of ["生地", "ソース", "チーズ", "具材"]) {
      expect(screen.getByRole("tab", { name: new RegExp(`✓ ${label}`) })).toBeInTheDocument();
    }
    expect(screen.getByText(/焼く/).className).toContain("making-step-tab--bake-active");
    const cutTab = screen.getByRole("tab", { name: "カット" });
    expect(cutTab).toBeDisabled();
    expect(cutTab.className).toContain("making-step-tab--locked");
  });

  it("POST_BAKE/CUT: pre-BAKE steps and BAKE both read completed, CUT reads active (not tappable -- 切り終わる is the real CTA)", () => {
    const state = cuttingMargherita();
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("CUT");
    renderAt(state, MARGHERITA_REFERENCE);
    for (const label of ["生地", "ソース", "チーズ", "具材"]) {
      expect(screen.getByRole("tab", { name: new RegExp(`✓ ${label}`) })).toBeInTheDocument();
    }
    expect(screen.getByText(/焼く/).className).toContain("making-step-tab--completed");
    const cutTab = screen.getByRole("tab", { name: "カット" });
    expect(cutTab).toHaveAttribute("aria-selected", "true");
    expect(cutTab).toBeDisabled();
  });

});

describe("Non-cut recipes never show a CUT tab, at any phase (regression)", () => {
  // Pizza Cutting 1.0 Phase 4B (Full Recipe Expansion): every currently shipped recipe --
  // including marinara, this test's own original fixture -- is now CUT-eligible
  // (../data/cookingProfiles.ts's CUT_ELIGIBLE_RECIPE_IDS), so no real RecipeId can stand in
  // for "a non-CUT recipe" anymore. This uses a synthetic id (a real Recipe's shape, marinara's
  // own, with only `id` swapped to one deliberately absent from the allowlist) standing in for a
  // future not-yet-eligible recipe (e.g. a non-round special shape) -- `getCookingProfile`
  // resolves it to DEFAULT_COOKING_PROFILE exactly like any other absent-allowlist id. Overrides
  // `recipe`/`cookingProfile` directly onto an otherwise-real baked margherita state (mirrors
  // IngredientTray.palette.test.tsx's own `requireExactly` override pattern) rather than
  // fighting the real unlock chain, which this test has no interest in.
  const marinaraFixture = getRecipe("marinara");
  if (!marinaraFixture) throw new Error("marinara fixture missing");
  const syntheticNonCutRecipe: Recipe = {
    ...marinaraFixture,
    id: "synthetic-non-cut-recipe-not-yet-eligible" as Recipe["id"],
  };

  function bakingSyntheticNonCutRecipe(): GameState {
    const state = bakingMargherita();
    return {
      ...state,
      recipe: syntheticNonCutRecipe,
      cookingProfile: getCookingProfile(syntheticNonCutRecipe.id),
    };
  }

  it("a non-CUT-eligible recipe's own BAKE screen shows the nav strip with no CUT tab (4 tabs only)", () => {
    const state = bakingSyntheticNonCutRecipe();
    expect(state.phase).toBe("BAKE");
    renderAt(state);
    expect(screen.queryByRole("tab", { name: "カット" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("RESULT: the nav strip is gone entirely (this issue's own scope is the pre-RESULT flow) -- a non-cut recipe reaches RESULT directly from BAKE, with no POST_BAKE screen in between", () => {
    const state = gameReducer(bakingSyntheticNonCutRecipe(), { type: "CONFIRM_BAKE", value: 70 });
    expect(state.phase).toBe("RESULT");
    renderAt(state);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
