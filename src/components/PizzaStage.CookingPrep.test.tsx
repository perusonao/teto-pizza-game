import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { toStep } from "../logic/prep/prepFixtures";
import { BEEF_COOKED_COLORS } from "../logic/prep/beefDoneness";
import { PizzaStage } from "./PizzaStage";

/** Cooking Prep Phase 1 PR-B S3: PizzaStage draws a prepped ingredient's placed pieces in the prepped look, and everything else exactly as before. */
function withBeefAndMozzarella(): GameState {
  let s = toStep("GUIDED", "TOPPING");
  s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "beef", x: 40, y: 50 });
  s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
  s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "beef", x: 50, y: 30 });
  return s;
}
function stage(state: GameState, extra: { preparedIngredientIds?: readonly string[]; overlay?: React.ReactNode } = {}) {
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
      makingStep="TOPPING"
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={state.cutState}
      onAddCutLine={() => {}}
      {...extra}
    />
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PizzaStage prepped pieces", () => {
  const state = withBeefAndMozzarella();
  const stripIds = (html: string) => html.replace(/topping-\d+/g, "topping-N").replace(/_r_[0-9a-z]+_/g, "ID");

  it("without the prop (flag OFF) the markup is exactly today's: no prepped class, no custom property", () => {
    const { container } = render(stage(state));
    expect(container.querySelectorAll(".ingredient-piece--prepared")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/--beef-(lean|fat|edge|gloss)/);
    expect(container.innerHTML).not.toMatch(/cooking-prep/);
  });

  it("an empty list is the same markup as no prop", () => {
    const a = render(stage(state));
    const html = stripIds(a.container.innerHTML);
    a.unmount();
    const b = stripIds(render(stage(state, { preparedIngredientIds: [] })).container.innerHTML);
    const at = [...html].findIndex((ch, i) => ch !== b[i]);
    expect(at === -1 ? "same" : `${html.slice(Math.max(0, at - 80), at + 80)} <<>> ${b.slice(Math.max(0, at - 80), at + 80)}`).toBe("same");
  });

  it("with beef prepped, every placed beef piece (and only those) carries the prepped look", () => {
    const { container } = render(stage(state, { preparedIngredientIds: ["beef"] }));
    const beef = [...container.querySelectorAll(".pizza-topping--beef .ingredient-piece-visual__emoji")] as HTMLElement[];
    expect(beef).toHaveLength(2);
    for (const piece of beef) {
      expect(piece).toHaveClass("ingredient-piece--prepared");
      expect(piece.style.getPropertyValue("--beef-lean")).toBe(BEEF_COOKED_COLORS.lean);
      expect(piece.style.getPropertyValue("--beef-gloss")).toBe("1");
    }
    expect(container.querySelectorAll(".pizza-topping--mozzarella .ingredient-piece--prepared")).toHaveLength(0);
  });

  it("the SVG markup of the beef glyph is untouched by the prep (colour comes from CSS only)", () => {
    const off = render(stage(state));
    const offSvg = off.container.querySelector(".pizza-topping--beef svg")!.outerHTML;
    off.unmount();
    const on = render(stage(state, { preparedIngredientIds: ["beef"] }));
    expect(on.container.querySelector(".pizza-topping--beef svg")!.outerHTML).toBe(offSvg);
  });

  it("the overlay renders inside the stage, after the dough, and changes nothing else", () => {
    const { container } = render(stage(state, { overlay: <span data-testid="o" /> }));
    const stageEl = container.querySelector(".pizza-stage")!;
    expect(stageEl.lastElementChild).toHaveAttribute("data-testid", "o");
    expect(stageEl.querySelector(".pizza-dough")!.compareDocumentPosition(stageEl.lastElementChild!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
