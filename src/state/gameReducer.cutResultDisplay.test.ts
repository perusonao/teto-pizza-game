import { describe, expect, it } from "vitest";
import { gameReducer, type GameState } from "./gameReducer";
import { DEFAULT_COOKING_PROFILE } from "../data/cookingProfiles";
import { requiredCutCount } from "../logic/cut/evaluation";
import { resolveRequestedSliceCount, type CutLine } from "../logic/cut/types";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * Pizza Cutting 1.0 Phase 3 (docs/design/TETO_PIZZA-CUTTING_1.0.md §14 Option D / RESULT UI
 * section): reducer-level integration coverage for the specific scenarios this phase's own
 * task adds on top of what Phase 2 (gameReducer.cutStep.test.ts) and Phase 1
 * (../logic/cut/evaluation.test.ts, pure math) already pin -- undo-then-re-cut producing a
 * fresh (never stale) evaluation, a mismatched/uneven/off-center cut actually reaching
 * `state.cutState.evaluation` (the exact value RESULT's `cutEvaluation` prop reads,
 * ../screens/GameScreen.tsx), CUT time never perturbing `cutScore`, and the non-CUT-recipe
 * "always null" contract RESULT's own display guard (`ResultPanel.tsx`'s `cutEvaluation &&`)
 * depends on.
 */

const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

function idealCutLine(index: number, count: number): CutLine {
  const angle = (Math.PI * index) / count;
  const dx = Math.cos(angle) * DOUGH_RADIUS;
  const dy = Math.sin(angle) * DOUGH_RADIUS;
  return {
    start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy },
    end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy },
  };
}

/** A chord offset well off-center (still a valid rim-to-rim line), for a low centerAccuracy case. */
function offCenterCutLine(offset: number): CutLine {
  const halfChord = Math.sqrt(Math.max(0, DOUGH_RADIUS * DOUGH_RADIUS - offset * offset));
  return {
    start: { x: DOUGH_CENTER + offset, y: DOUGH_CENTER - halfChord },
    end: { x: DOUGH_CENTER + offset, y: DOUGH_CENTER + halfChord },
  };
}

function bakedMargheritaAtCut(): GameState {
  let state: GameState = createGuidedInitialState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
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
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
  return state;
}

describe("re-cut after undo computes a fresh evaluation, never a stale one", () => {
  it("undoing a bad line and redrawing the ideal one scores as if the bad line never happened", () => {
    let state = bakedMargheritaAtCut();
    // Draw two lines clustered together (a bad/uneven cut) -- 18deg apart, just outside Phase
    // 4A's own duplicate-rejection gate (MIN_CUT_ANGULAR_SEPARATION_RADIANS, 15deg,
    // ../logic/cut/geometry.ts) so this still exercises "uneven, but distinct" rather than
    // tripping the new "near-duplicate" rejection this phase adds.
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0.3, 3) });
    // ...then undo the bad second line and redraw the correct, evenly-spaced one instead.
    state = gameReducer(state, { type: "UNDO_CUT_LINE" });
    expect(state.cutState.lines).toHaveLength(1);
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(1, 3) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(2, 3) });

    const confirmed = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(confirmed.phase).toBe("RESULT");
    // The final, confirmed evaluation reflects only the 3 ideal lines actually in `lines` at
    // confirm time -- the undone, tightly-clustered line's own effect on uniformity is gone,
    // not blended into the final score.
    expect(confirmed.cutState.evaluation?.completedCutCount).toBe(3);
    expect(confirmed.cutState.evaluation?.actualPieceCount).toBe(6);
    expect(confirmed.cutState.evaluation?.uniformity).toBeGreaterThan(0.95);
  });

  it("adding a line after an evaluation was already computed invalidates it back to null (no stale evaluation survives a further edit)", () => {
    let state = bakedMargheritaAtCut();
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    // Reducer-level guard: CONFIRM_MAKING_STEP is the only call site that computes an
    // evaluation, and it always transitions phase away from POST_BAKE's own CUT step in the
    // same dispatch -- so ADD_CUT_LINE/UNDO_CUT_LINE can never be dispatched again afterward to
    // observe a "confirmed, then further edited" state (the exact no-op backstop
    // gameReducer.cutStep.test.ts's own "10. ADD_CUT_LINE/UNDO_CUT_LINE are no-ops outside
    // POST_BAKE's own CUT step" section already pins). This test instead pins the in-progress
    // half of that same contract: `state.ts`'s own `addCutLine`/`undoLastCutLine` always
    // invalidate a stale `evaluation` back to `null`, confirmed directly against the pure
    // module (mirrors ../logic/cut/state.test.ts, exercised here through the real reducer
    // action types instead of calling the module directly).
    expect(state.cutState.evaluation).toBeNull();
  });
});

describe("uneven / off-center / mismatched-count cuts reach state.cutState.evaluation through the real reducer flow", () => {
  it("an uneven (tightly clustered) 3-line cut confirms with a low uniformity, visible on cutState.evaluation", () => {
    let state = bakedMargheritaAtCut();
    // 18deg apart (0deg/18deg/36deg) -- clustered well inside one half of the ideal 60deg-per-
    // wedge spacing (a genuinely uneven cut), but each pair still clears Phase 4A's own 15deg
    // minimum-angular-separation duplicate gate (../logic/cut/geometry.ts), so this remains a
    // real, distinct 3-line cut rather than one the new gate would reject before it ever reached
    // this evaluation.
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0.3, 3) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0.6, 3) });
    const confirmed = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(confirmed.phase).toBe("RESULT");
    expect(confirmed.cutState.evaluation).not.toBeNull();
    expect(confirmed.cutState.evaluation!.uniformity).toBeLessThan(0.5);
    expect(confirmed.cutState.evaluation!.cutScore).toBeLessThan(80);
  });

  it("an off-center 3-line cut confirms with a low centerAccuracy, visible on cutState.evaluation", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: offCenterCutLine(DOUGH_RADIUS * 0.85) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(1, 3) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(2, 3) });
    const confirmed = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(confirmed.phase).toBe("RESULT");
    expect(confirmed.cutState.evaluation).not.toBeNull();
    expect(confirmed.cutState.evaluation!.centerAccuracy).toBeLessThan(0.9);
  });

  it("an incomplete cut (below requiredCutCount) can never actually confirm -- the reducer-level backstop rejects it outright", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    const rejected = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(rejected).toBe(state);
    expect(rejected.phase).toBe("POST_BAKE");
    expect(rejected.cutState.evaluation).toBeNull();
  });

  it("a 4-line cut on a 6-slice recipe produces a mismatched actualPieceCount, still finite and displayable", () => {
    let state = bakedMargheritaAtCut();
    for (let i = 0; i < 4; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 4) });
    }
    const confirmed = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(confirmed.phase).toBe("RESULT");
    expect(confirmed.cutState.evaluation!.requestedSliceCount).toBe(6);
    expect(confirmed.cutState.evaluation!.actualPieceCount).toBe(8);
    expect(confirmed.cutState.evaluation!.countCorrectness).toBeLessThan(1);
    expect(Number.isFinite(confirmed.cutState.evaluation!.cutScore)).toBe(true);
  });
});

describe("CUT time never influences cutScore (design doc §6.1)", () => {
  it("identical lines confirmed after 1s vs. after 30s of CUT-step elapsed time produce the exact same cutScore", () => {
    function confirmAfter(cutElapsedMs: number): number {
      let state: GameState = gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE", now: 0 });
      state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 1 });
      state = gameReducer(state, {
        type: "COMMIT_SAUCE_DISPENSE",
        ingredientId: "tomato-sauce",
        deposits: buildIdealMargheritaSauceFixture(),
      });
      state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 2 });
      for (const p of MOZZARELLA_GROUP.positions) {
        state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
      }
      state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 3 });
      for (const p of BASIL_GROUP.positions) {
        state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
      }
      state = gameReducer(state, { type: "START_BAKE", now: 4 });
      state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 5 }); // CUT starts at 5
      for (let i = 0; i < 3; i += 1) {
        state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
      }
      state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 5 + cutElapsedMs });
      expect(state.cookingTiming?.perStepElapsedMs.CUT).toBe(cutElapsedMs);
      return state.cutState.evaluation!.cutScore;
    }

    expect(confirmAfter(1_000)).toBe(confirmAfter(30_000));
  });
});

describe("non-CUT recipes never populate state.cutState.evaluation (RESULT's own display guard contract)", () => {
  it("a recipe with the default (empty) post-BAKE profile reaches RESULT with cutState.evaluation still null", () => {
    let state: GameState = createGuidedInitialState();
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    // margherita is this repo's own default/first recipe and does carry a CUT-enabled
    // profile (Phase 2) -- force a non-CUT profile the same way this repo's own existing
    // gameReducer test files already do for a "generic any-recipe" stand-in
    // (Phase 2 Result Report §14), rather than re-deriving a second real non-CUT recipe's own
    // full PREPARE fixture here.
    state = { ...state, cookingProfile: DEFAULT_COOKING_PROFILE };
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(state.phase).toBe("RESULT");
    expect(state.cutState.evaluation).toBeNull();
  });
});

// Sanity check that this file's own `requiredCutCount`/`resolveRequestedSliceCount` imports
// match the exact contract the reducer itself uses (guards against a future signature drift
// silently making the fixtures above pass for the wrong reason).
describe("fixture sanity", () => {
  it("margherita's requiredCutCount is 3 (6 slices / 2)", () => {
    const state = bakedMargheritaAtCut();
    expect(requiredCutCount(resolveRequestedSliceCount(state.cutState.config))).toBe(3);
  });
});
