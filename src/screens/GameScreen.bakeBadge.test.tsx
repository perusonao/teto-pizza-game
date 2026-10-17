import "@testing-library/jest-dom/vitest";
import type { Dispatch } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { computeBakeHeat, doughVisualColors } from "../logic/bakeVisual";
import { FREE_COOK_BAKE_TARGET } from "../data/freeCook";
import { getRecipe } from "../data/recipes";
import { cook, freeRound, MARGHERITA, NOW, ORDINARY, playFreeRound } from "../state/testSupport/trialNotebookFlow";

/**
 * #469 / #520: the RESULT 焼き加減 badge is 5-level in every round kind. FREE Cooking (the matched recipe AND the ORIGINAL
 * pizza) reads the generic window its BAKE gauge showed (`FREE_COOK_BAKE_TARGET`, 58-78), never the matched recipe's own
 * window (#482); Guided reads the recipe's. Real reducer states, rendered through GameScreen.
 */
afterEach(cleanup);

function Screen({ state, dispatch, bakeProgress = null }: { state: GameState; dispatch: Dispatch<GameAction>; bakeProgress?: number | null }) {
  return (
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory="cheese"
      selectedIngredientId={null}
      bakeProgress={bakeProgress}
      referenceModeEnabled={false}
      referencePizza={null}
      isReferencePopoverOpen={false}
      isGlobalOverlayOpen={false}
      sauceMetrics={emptySauceMetrics()}
      sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
      isDispensingSauce={false}
      pieceShadowMetrics={[]}
      showDoughShape
      doughShapeComplete={false}
      onGoHome={() => {}}
      onBeginPrepare={() => {}}
      onResetPizza={() => {}}
      onUndoPlacement={() => {}}
      onConfirmMakingStep={() => {}}
      onStartBake={() => {}}
      onShowHint={() => {}}
      onChangeCategory={() => {}}
      onSelectIngredient={() => {}}
      onTapPizza={() => {}}
      onBakeTick={() => {}}
      onConfirmBake={() => {}}
      onRetrySameRecipe={() => dispatch({ type: "RETRY_SAME_RECIPE", now: NOW })}
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
      onDoughElementChange={() => {}}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={() => {}}
    />
  );
}

function badges(state: GameState): string[] {
  render(<Screen state={state} dispatch={() => {}} />);
  return [...document.querySelectorAll(".result-panel__bake-badge")].map((el) => el.textContent ?? "");
}

// FREE window 58-78 (centre 68, JUST 65-71). Margherita window 60-80 (centre 70, JUST 67-73): 59 is in the generic window
// (惜しい（焼き不足）) but outside Margherita's (生焼け); 72 is 惜しい（焼きすぎ） for FREE but ジャスト for Margherita.
describe("the RESULT bake badge by round kind (#469 / #520)", () => {
  const free = (bake: number) => playFreeRound(freeRound(), MARGHERITA, bake);
  const orig = (bake: number) => playFreeRound(freeRound(), ORDINARY, bake);

  it.each([
    [59, "惜しい（焼き不足）"],
    [64, "惜しい（焼き不足）"],
    [68, "ジャスト"],
    [72, "惜しい（焼きすぎ）"],
    [77, "惜しい（焼きすぎ）"],
  ])("FREE Cooking, recipe matched, at %s: 5-level %s on the GENERIC window, while the round carries the matched recipe", (bake, label) => {
    const state = free(bake);
    expect(state.freeCook).toBe(true);
    expect(state.recipe.id).toBe("margherita");
    const texts = badges(state);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(`焼き加減: ${label}`);
  });

  it.each([
    [64, "惜しい（焼き不足）"],
    [68, "ジャスト"],
    [76, "惜しい（焼きすぎ）"],
  ])("FREE Cooking, ORIGINAL pizza, at %s: 5-level %s", (bake, label) => {
    const state = orig(bake);
    expect(state.freeCook).toBe(true);
    const texts = badges(state);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(`焼き加減: ${label}`);
  });

  it("FREE Cooking keeps 生焼け / 焦げ at the raw / burnt edges (outside the generic window)", () => {
    expect(badges(orig(10)).every((t) => t.includes("生焼け"))).toBe(true);
    cleanup();
    expect(badges(orig(95)).every((t) => t.includes("焦げ"))).toBe(true);
  });

  it.each([
    [64, "惜しい（焼き不足）"],
    [70, "ジャスト"],
    [76, "惜しい（焼きすぎ）"],
  ])("guided recipe (Margherita 60-80) at %s: 5-level badge %s", (bake, label) => {
    const start = gameReducer(createGuidedInitialState("margherita"), { type: "BEGIN_PREPARE", now: NOW });
    const state = cook(start, MARGHERITA, bake);
    expect(state.freeCook).toBe(false);
    expect(state.phase).toBe("RESULT");
    const texts = badges(state);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(`焼き加減: ${label}`);
  });
});

// Issue #481: JUST band on the BAKE gauge and no 「完璧」 on a near-miss RESULT.
function bakePhase(start: GameState, pizza: typeof MARGHERITA): GameState {
  let s = gameReducer(start, { type: "CONFIRM_MAKING_STEP" });
  if (pizza.sauce) {
    s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: pizza.sauce, deposits: pizza.sauceDeposits ?? buildIdealSauceFixture() });
  }
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.cheese ?? []) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.toppings ?? []) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  return gameReducer(s, { type: "START_BAKE", now: NOW + 60_000 });
}

describe("JUST band and near-miss dialogue through GameScreen (#481)", () => {
  it("guided BAKE draws the band at centre +-3 (Margherita 60-80 -> 67 / 6)", () => {
    const state = bakePhase(gameReducer(createGuidedInitialState("margherita"), { type: "BEGIN_PREPARE", now: NOW }), MARGHERITA);
    expect(state.phase).toBe("BAKE");
    render(<Screen state={state} dispatch={() => {}} />);
    const band = document.querySelector<HTMLElement>(".bake-gauge__just")!;
    expect(parseFloat(band.style.left)).toBe(67);
    expect(parseFloat(band.style.width)).toBe(6);
  });

  it("FREE Cooking BAKE draws the band on the GENERIC window (58-78 -> 65 / 6) (#520)", () => {
    const state = bakePhase(gameReducer(freeRound(), { type: "START_FREE_COOK", now: NOW }), ORDINARY);
    expect(state.phase).toBe("BAKE");
    expect(state.freeCook).toBe(true);
    render(<Screen state={state} dispatch={() => {}} />);
    expect(document.querySelector(".bake-gauge")).not.toBeNull();
    const band = document.querySelector<HTMLElement>(".bake-gauge__just")!;
    expect(parseFloat(band.style.left)).toBe(65);
    expect(parseFloat(band.style.width)).toBe(6);
  });

  it.each([59, 64, 72, 77])("FREE Cooking near-miss RESULT at %s never says 完璧 (#520)", (bake) => {
    render(<Screen state={playFreeRound(freeRound(), MARGHERITA, bake)} dispatch={() => {}} />);
    expect(document.body.textContent).not.toContain("完璧");
  });

  it.each([64, 76])("guided near-miss RESULT at %s never says 完璧", (bake) => {
    const start = gameReducer(createGuidedInitialState("margherita"), { type: "BEGIN_PREPARE", now: NOW });
    render(<Screen state={cook(start, MARGHERITA, bake)} dispatch={() => {}} />);
    expect(document.body.textContent).not.toContain("完璧");
  });
});

/**
 * Issue #482 (OD-B6 F1, Codex P2): a Free Cooking pizza is judged -- Gate, badge, the stage's bake visuals and its perfect glow --
 * by the one generic window the gauge showed, although a matched pizza carries the matched recipe in `state.recipe`. Scoring
 * 2.0 alone reads the recipe's own window. Margherita is 60-80, the generic window 58-78: at 59 the two windows disagree
 * (recipe: 生焼け, generic: in window).
 */
describe("FREE MATCHED: badge, bake colour and glow agree on the generic window (#482)", () => {
  const expectedDough = (bake: number, window: { start: number; end: number }) => {
    const { colorA, colorB } = doughVisualColors(computeBakeHeat(bake, window));
    const probe = document.createElement("div");
    probe.style.background = `radial-gradient(circle at 40% 35%, ${colorA}, ${colorB} 85%)`;
    return probe.style.background;
  };
  const doughBackground = () => document.querySelector<HTMLElement>(".pizza-dough-shape")!.style.background;
  const MARGHERITA_WINDOW = getRecipe("margherita")!.bakeTarget;

  it("at 59 (inside the generic window, outside Margherita's): badge 惜しい（焼き不足）(5-level, generic window), perfect glow, and the colour of the generic window", () => {
    const state = cook(gameReducer(freeRound(), { type: "START_FREE_COOK", now: NOW }), MARGHERITA, 59);
    expect(state.freeCook).toBe(true);
    expect(state.recipe.id).toBe("margherita");
    expect(state.bakeState).toBe("perfect");
    render(<Screen state={state} dispatch={() => {}} bakeProgress={59} />);
    for (const el of document.querySelectorAll(".result-panel__bake-badge")) expect(el.textContent).toContain("焼き加減: 惜しい（焼き不足）");
    expect(document.querySelectorAll(".pizza-perfect-glow")).toHaveLength(1);
    // The two windows really disagree here (so this test would fail on the recipe window) ...
    expect(expectedDough(59, FREE_COOK_BAKE_TARGET)).not.toBe(expectedDough(59, MARGHERITA_WINDOW));
    // ... and the stage paints the generic one.
    expect(doughBackground()).toBe(expectedDough(59, FREE_COOK_BAKE_TARGET));
  });

  it("the stage colour and glow of a matched pizza equal those of the same bake read through the generic window, across the range", () => {
    for (const bake of [58, 59, 62, 68, 74, 78]) {
      const state = cook(gameReducer(freeRound(), { type: "START_FREE_COOK", now: NOW }), MARGHERITA, bake);
      render(<Screen state={state} dispatch={() => {}} bakeProgress={bake} />);
      expect(doughBackground(), String(bake)).toBe(expectedDough(bake, FREE_COOK_BAKE_TARGET));
      expect(document.querySelectorAll(".pizza-perfect-glow"), String(bake)).toHaveLength(state.bakeState === "perfect" ? 1 : 0);
      cleanup();
    }
  });

  it("Guided is untouched: the stage still reads the recipe's own window (Margherita at 79 is in its window, outside the generic one)", () => {
    const start = gameReducer(createGuidedInitialState("margherita"), { type: "BEGIN_PREPARE", now: NOW });
    const state = cook(start, MARGHERITA, 79);
    expect(state.freeCook).toBe(false);
    expect(state.completion?.status).toBe("PASS");
    render(<Screen state={state} dispatch={() => {}} bakeProgress={79} />);
    expect(doughBackground()).toBe(expectedDough(79, MARGHERITA_WINDOW));
    expect(doughBackground()).not.toBe(expectedDough(79, FREE_COOK_BAKE_TARGET));
  });
});
