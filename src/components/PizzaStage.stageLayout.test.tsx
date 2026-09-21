import "@testing-library/jest-dom/vitest";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { PizzaStage } from "./PizzaStage";

/**
 * Visual Polish 2.0A (Finding P1-1): `roomy` is a purely presentational className toggle on
 * `.pizza-stage` (App.css's `.pizza-stage--roomy`, a larger static `.pizza-dough` size cap) --
 * this only pins that the prop actually reaches the DOM as the expected class, never anything
 * about gesture/coordinate math (unchanged, still covered by
 * PizzaStage.doughStretch/sauceParity/sauceReset/cutGesture/bakeVisual.test.tsx, which all
 * still pass unmodified against the same 300x300 DOUGH_RECT fixture regardless of this prop).
 */

function preparedState(): GameState {
  let state = createInitialGameState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  return state;
}

function Harness({ roomy }: { roomy?: boolean }) {
  const [state] = useReducer(gameReducer, undefined, preparedState);
  return (
    <PizzaStage
      pizza={state.pizza}
      recipe={state.recipe}
      interactive
      activeIngredient={null}
      bakeProgress={null}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled={false}
      resetToken={0}
      makingStepToken={state.makingStepToken}
      makingStep={state.makingStep}
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={state.cutState}
      onAddCutLine={() => {}}
      roomy={roomy}
    />
  );
}

function stageElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>(".pizza-stage");
  if (!element) throw new Error("Pizza stage wrapper missing");
  return element;
}

afterEach(() => {
  cleanup();
});

describe("PizzaStage roomy layout", () => {
  it("omits pizza-stage--roomy by default (ORDER/RESULT's pre-2.0A size)", () => {
    render(<Harness />);
    expect(stageElement().className).not.toContain("pizza-stage--roomy");
  });

  it("adds pizza-stage--roomy when roomy=true (PREPARE/BAKE/CUT's larger stage)", () => {
    render(<Harness roomy />);
    expect(stageElement().className).toContain("pizza-stage--roomy");
  });

  it("still renders the interactive dough drop target either way", () => {
    render(<Harness roomy />);
    expect(document.querySelector('[data-pizza-drop-target="true"]')).toBeInTheDocument();
  });
});
