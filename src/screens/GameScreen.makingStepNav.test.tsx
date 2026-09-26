import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import type { IngredientCategory } from "../data/ingredients";
import { buildIdealMargheritaSauceFixture, buildIdealSauceFixture, getReferencePizza, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { walkPostBakeToResult } from "../state/testSupport/postBakeFlow";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import type { RecipeId } from "../data/recipes";
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
      onMissionSkipOrder={() => {}}
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

// Progression 2.0 W1 I5b-4b (Cooking layout contract, I5b-4 UI/UX Fresh Audit §3-§4 / §13): every
// cooking step renders the same flex skeleton -- tabs, then the compact order-card, then the
// pizza stage, then an in-flow bottom CTA bar that holds the step's primary action. jsdom has no
// layout, so this pins the DOM contract; the geometry (short viewports, safe-area insets, HUD)
// is measured in Chromium (docs/reports/TETO_PROGRESS2_W1_I5B4B_W1D_Result.md).
describe("I5b-4b: one cooking skeleton for PREPARE, BAKE and CUT", () => {
  const order = (el: Element | null) => {
    const all = Array.from(document.querySelectorAll(".game-screen *"));
    return el ? all.indexOf(el) : -1;
  };

  it.each([
    ["PREPARE (TOPPING)", toppedMargherita, /焼く！/],
    ["BAKE", bakingMargherita, /取り出す！/],
    ["CUT", cuttingMargherita, /切り終わる/],
  ] as const)("%s: cooking layout, tabs -> order-card -> stage -> bar, primary CTA in the bar", (_label, build, cta) => {
    renderAt(build(), MARGHERITA_REFERENCE);
    const screenEl = document.querySelector(".game-screen")!;
    expect(screenEl).toHaveClass("game-screen--cooking");
    const bars = document.querySelectorAll(".prepare-bake-bar");
    expect(bars).toHaveLength(1);
    const primary = screen.getByRole("button", { name: cta });
    expect(bars[0].contains(primary)).toBe(true);
    const tabs = document.querySelector(".making-step-tabs");
    const card = document.querySelector(".order-card");
    const stage = document.querySelector(".pizza-stage");
    expect(order(tabs)).toBeGreaterThan(-1);
    expect(order(tabs)).toBeLessThan(order(card));
    expect(order(card)).toBeLessThan(order(stage));
    expect(order(stage)).toBeLessThan(order(bars[0]));
  });

  it("BAKE: no portrait dialogue above the tabs -- Teto's bake line is in the compact order-card", () => {
    const state = bakingMargherita();
    renderAt(state, MARGHERITA_REFERENCE);
    expect(document.querySelector(".dialogue-area")).toBeNull();
    const card = document.querySelector(".order-card--bake")!;
    expect(card).toHaveTextContent(state.recipe.nameJa);
    expect(card).toHaveTextContent(/取り出/);
  });

  it("ORDER and RESULT keep their own layout (not the cooking skeleton)", () => {
    renderAt(createGuidedInitialState(), MARGHERITA_REFERENCE);
    expect(document.querySelector(".game-screen")).not.toHaveClass("game-screen--cooking");
  });

  it("a one-page tray still lays out the pager row, invisible and inert", () => {
    renderAt(toppedMargherita(), MARGHERITA_REFERENCE);
    const placeholder = document.querySelector(".ingredient-page-nav--placeholder")!;
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    for (const b of Array.from(placeholder.querySelectorAll("button"))) expect(b).toBeDisabled();
    expect(screen.queryByRole("group", { name: "素材ページ切り替え" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "次のページ" })).not.toBeInTheDocument();
  });
});

// Progression 2.0 W1-d: the Discovery Result's registration row comes from a real Free Cooking
// matcher discovery and the canonical chapter functions (OD-DISC-9).
describe("W1-d: Discovery Result from a real Free Cooking discovery", () => {
  it("bismarck discovered after margherita: No.02（第1章 2/6）, 図鑑を見る on that row", () => {
    const REFERENCE = getReferencePizzaForTest("bismarck");
    let state = createInitialGameState(
      [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
      ["tomato-sauce", "mozzarella", "basil", "egg"],
      0,
      { egg: 9 },
    );
    state = gameReducer(state, { type: "START_FREE_COOK", now: 1 });
    state = { ...state, phase: "PREPARE", pizza: REFERENCE };
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 65 });
    state = walkPostBakeToResult(state);
    state = gameReducer(state, { type: "REGISTER_TO_DEX" });
    expect(state.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "bismarck" });
    renderAt(state);
    const row = document.querySelector(".dex-registration-row")!;
    expect(row).toHaveTextContent("No.02（第1章 2/6）");
    expect(document.querySelector(".discovered-banner--new-pizza")).toHaveTextContent("ビスマルクを発見しました！");
  });
});

/** The reference pizza of `recipeId` as a baked PizzaState (the matcher's exact set). */
function getReferencePizzaForTest(recipeId: RecipeId): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((g, gi) =>
      g.positions.map((p, i) => ({ id: `${recipeId}-${gi}-${i}`, ingredientId: g.ingredientId, ...p })),
    ),
    bakeResult: 65,
  };
}
