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

function Harness({ roomy, resultCompact }: { roomy?: boolean; resultCompact?: boolean }) {
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
      resultCompact={resultCompact}
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

/** Gameplay UX PR-D (RESULT 1-Screen 2.0, Fresh Audit §6 Finding P1-5): `resultCompact` is a
 *  purely presentational className toggle on `.pizza-stage` (App.css's `.pizza-stage--result`),
 *  same discipline as `roomy` above -- never touches gesture/coordinate math. */
describe("PizzaStage resultCompact layout", () => {
  it("omits pizza-stage--result by default", () => {
    render(<Harness />);
    expect(stageElement().className).not.toContain("pizza-stage--result");
  });

  it("adds pizza-stage--result when resultCompact=true (RESULT's smaller hero)", () => {
    render(<Harness resultCompact />);
    expect(stageElement().className).toContain("pizza-stage--result");
  });

  it("never combines pizza-stage--result with pizza-stage--roomy (GameScreen only ever sets one)", () => {
    render(<Harness roomy={false} resultCompact />);
    const className = stageElement().className;
    expect(className).toContain("pizza-stage--result");
    expect(className).not.toContain("pizza-stage--roomy");
  });
});
