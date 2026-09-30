import { StrictMode, useReducer, type Dispatch } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { notebookSize, notebookView } from "../logic/discovery/trialNotebook";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { DEX_3, INVENTORY, NOW, OWNED, ORDINARY, FAR_ORIGINAL, MID_BAKE, pieces, type Pizza } from "./testSupport/trialNotebookFlow";
import { buildIdealSauceFixture } from "../data/referencePizza";

/**
 * P3-3a: the real `gameReducer` driven by React's own `useReducer` under <StrictMode>, which invokes every reducer
 * twice in development. The record must still be exactly-once, re-renders must not record, and leaving RESULT for
 * HOME (PLAY_AGAIN) and coming back must not add a retry. (The notebook is state only: no component reads it, which
 * trialNotebook.gate.test.ts pins; so a render cannot record.)
 */
afterEach(cleanup);

interface Probe {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  renders: number;
}

function mount(strict: boolean): { probe: () => Probe; rerender: () => void } {
  let current!: Probe;
  let renders = 0;
  function Harness() {
    const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialGameState(DEX_3, OWNED, 0, INVENTORY, []));
    renders += 1;
    current = { state, dispatch, renders };
    return <div data-phase={state.phase} />;
  }
  const tree = strict ? (
    <StrictMode>
      <Harness />
    </StrictMode>
  ) : (
    <Harness />
  );
  const view = render(tree);
  return { probe: () => ({ ...current, renders }), rerender: () => view.rerender(tree) };
}

function playRound(dispatch: Dispatch<GameAction>, pizza: Pizza) {
  const send = (a: GameAction) => act(() => dispatch(a));
  send({ type: "START_FREE_COOK", now: NOW });
  send({ type: "CONFIRM_MAKING_STEP" });
  if (pizza.sauce) send({ type: "COMMIT_SAUCE_DISPENSE", ingredientId: pizza.sauce, deposits: buildIdealSauceFixture() });
  send({ type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.cheese ?? []) send({ type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  send({ type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.toppings ?? []) send({ type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  send({ type: "START_BAKE", now: NOW + 60_000 });
  send({ type: "CONFIRM_BAKE", value: MID_BAKE });
}

describe.each([{ strict: true }, { strict: false }])("Trial Notebook through React (StrictMode: $strict)", ({ strict }) => {
  it("5. one ORIGINAL round records exactly once, however many times the reducer is invoked or the tree re-renders", () => {
    const m = mount(strict);
    playRound(m.probe().dispatch, ORDINARY);
    expect(m.probe().state.phase).toBe("RESULT");
    expect(notebookSize(m.probe().state.trialNotebook).identities).toBe(0); // nothing recorded before REGISTER_TO_DEX
    act(() => m.probe().dispatch({ type: "REGISTER_TO_DEX" }));
    const committed = m.probe().state;
    expect(committed.phase).toBe("DISCOVERED");
    expect(notebookView(committed.trialNotebook)).toHaveLength(1);
    expect(notebookView(committed.trialNotebook)[0]).toMatchObject({ number: 1, retryCount: 0 });
    expect(committed.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });

    // 6. RESULT re-renders (and a repeated REGISTER_TO_DEX) change nothing
    const rendersBefore = m.probe().renders;
    for (let i = 0; i < 5; i += 1) m.rerender();
    act(() => m.probe().dispatch({ type: "REGISTER_TO_DEX" }));
    act(() => m.probe().dispatch({ type: "REGISTER_TO_DEX" }));
    expect(m.probe().renders).toBeGreaterThan(rendersBefore);
    expect(m.probe().state.trialNotebook).toBe(committed.trialNotebook);
    expect(m.probe().state.lastTrialAttempt).toBe(committed.lastTrialAttempt);
  });

  it("7/9. RESULT -> HOME (PLAY_AGAIN) -> FREE keeps the notebook, adds no retry, and the next identical round is one DUPLICATE (+1)", () => {
    const m = mount(strict);
    playRound(m.probe().dispatch, ORDINARY);
    act(() => m.probe().dispatch({ type: "REGISTER_TO_DEX" }));
    const committed = m.probe().state.trialNotebook;
    act(() => m.probe().dispatch({ type: "PLAY_AGAIN" }));
    expect(m.probe().state.trialNotebook).toBe(committed);
    expect(notebookView(m.probe().state.trialNotebook)[0].retryCount).toBe(0);
    expect(m.probe().state.lastTrialAttempt).toBeNull();

    playRound(m.probe().dispatch, ORDINARY);
    act(() => m.probe().dispatch({ type: "REGISTER_TO_DEX" }));
    const after = m.probe().state;
    expect(after.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(notebookView(after.trialNotebook)).toHaveLength(1);
    expect(notebookView(after.trialNotebook)[0].retryCount).toBe(1); // exactly +1 (not +2) under StrictMode
  });

  it("a different combination in the same session is #2; the first keeps #1 and its retryCount", () => {
    const m = mount(strict);
    playRound(m.probe().dispatch, ORDINARY);
    act(() => m.probe().dispatch({ type: "REGISTER_TO_DEX" }));
    playRound(m.probe().dispatch, { ...FAR_ORIGINAL, toppings: [...(FAR_ORIGINAL.toppings ?? []), ...pieces("egg", 0)] });
    act(() => m.probe().dispatch({ type: "REGISTER_TO_DEX" }));
    const rows = notebookView(m.probe().state.trialNotebook);
    expect(rows.map((r) => r.number)).toEqual([2, 1]);
    expect(rows.map((r) => r.retryCount)).toEqual([0, 0]);
    expect(m.probe().state.lastTrialAttempt).toEqual({ kind: "NEW", number: 2 });
  });
});

describe("harness sanity", () => {
  it("StrictMode really does invoke the reducer twice per dispatch here (so the exactly-once tests above are meaningful)", () => {
    let calls = 0;
    const counting = (s: GameState, a: GameAction) => {
      calls += 1;
      return gameReducer(s, a);
    };
    let dispatch!: Dispatch<GameAction>;
    function Harness() {
      const [, d] = useReducer(counting, undefined, () => createInitialGameState(DEX_3, OWNED, 0, INVENTORY, []));
      dispatch = d;
      return null;
    }
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    act(() => dispatch({ type: "START_FREE_COOK", now: NOW }));
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
