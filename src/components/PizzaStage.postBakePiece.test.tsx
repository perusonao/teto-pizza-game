import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { createIdealDoughShape } from "../logic/doughShape";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import type { CutLine } from "../logic/cut/types";
import { PizzaStage } from "./PizzaStage";

/**
 * Issue #418: a pizza cut rim to rim is drawn as pieces -- every layer of the pizza body (silhouette,
 * sauce heatmap + overflow canvases, toppings, bake look) is copied per piece, clipped to the piece
 * and nudged apart, instead of one pizza with lines on it. Same structure in CUT and RESULT.
 */

const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

function bakedMargheritaAtCut(): GameState {
  let state: GameState = createGuidedInitialState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  state = gameReducer(state, {
    type: "COMMIT_SAUCE_DISPENSE",
    ingredientId: "tomato-sauce",
    deposits: buildIdealMargheritaSauceFixture(),
  });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  for (const p of MOZZARELLA_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  for (const p of BASIL_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
  return state;
}

function through(angleDeg: number, offset = 0): CutLine {
  const a = (angleDeg * Math.PI) / 180;
  const nx = -Math.sin(a) * offset;
  const ny = Math.cos(a) * offset;
  const start = { x: DOUGH_CENTER + nx - Math.cos(a) * DOUGH_RADIUS, y: DOUGH_CENTER + ny - Math.sin(a) * DOUGH_RADIUS };
  const end = { x: DOUGH_CENTER + nx + Math.cos(a) * DOUGH_RADIUS, y: DOUGH_CENTER + ny + Math.sin(a) * DOUGH_RADIUS };
  return { start, end, path: [start, end] };
}

function stage(state: GameState, lines: CutLine[], makingStep: GameState["makingStep"], resultCompact = false) {
  return (
    <PizzaStage
      pizza={{ ...state.pizza, doughShape: createIdealDoughShape() }} // a finished dough, as in a real CUT
      recipe={state.recipe}
      interactive={false}
      activeIngredient={null}
      bakeProgress={state.pizza.bakeResult}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled={false}
      resetToken={0}
      makingStepToken={state.makingStepToken}
      makingStep={makingStep}
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={{ ...state.cutState, lines }}
      onAddCutLine={() => {}}
      resultCompact={resultCompact}
    />
  );
}


const POST_ID = "post-basil-1";
function withPostPiece(state: GameState, ingredientId = "basil", x = 25, y = 30): GameState {
  return { ...state, pizza: { ...state.pizza, toppings: [...state.pizza.toppings, { id: POST_ID, ingredientId, x, y, stage: "post" as const }] } };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PizzaStage post-bake pieces (FINISH D2-1)", () => {
  const state = bakedMargheritaAtCut();

  it("is inert: pieces explicitly marked pre draw exactly the same DOM as pieces with no stage", () => {
    const explicitPre: GameState = {
      ...state,
      pizza: { ...state.pizza, toppings: state.pizza.toppings.map((t) => ({ ...t, stage: "pre" as const })) },
    };
    const a = render(stage(state, [through(0)], "CUT"));
    const normalise = (html: string) => html.replace(/_r_\d+_/g, "_r_"); // React's useId differs per render
    const html = normalise(a.container.innerHTML);
    expect(a.container.querySelector('[data-topping-stage="post"]')).toBeNull();
    cleanup();
    const b = render(stage(explicitPre, [through(0)], "CUT"));
    expect(normalise(b.container.innerHTML)).toBe(html);
  });

  it("draws a post piece as its own element, once, without any bake styling (uncut)", () => {
    const { container } = render(stage(withPostPiece(state), [], "CUT"));
    const post = container.querySelectorAll<HTMLElement>('[data-topping-stage="post"]');
    expect(post).toHaveLength(1);
    expect(container.querySelectorAll(`[data-topping-id="${POST_ID}"]`)).toHaveLength(1);
    expect(post[0].style.left).toBe("25%");
    expect(post[0].style.top).toBe("30%");
    // the same ingredient placed before the bake is bake-styled; the post one carries no filter at all
    const preBasil = container.querySelector<HTMLElement>('.pizza-topping[data-topping-id]:not([data-topping-stage]) :is([style*="filter"])');
    expect(preBasil).not.toBeNull();
    expect(post[0].querySelector('[style*="filter"]')).toBeNull();
    expect(post[0].getAttribute("style") ?? "").not.toMatch(/filter/);
  });

  it("a post mozzarella is a plain piece: no Canvas mozzarella, no melt frame", () => {
    const { container } = render(stage(withPostPiece(state, "mozzarella", 70, 70), [], "CUT"));
    const post = container.querySelector<HTMLElement>('[data-topping-stage="post"]')!;
    expect(post).toBeInTheDocument();
    expect(post.querySelector("canvas")).toBeNull();
    expect(post.querySelector('[style*="filter"]')).toBeNull();
    expect(post.outerHTML).not.toMatch(/--bake-cheese/);
  });

  it("after a cut, the post piece is whole in exactly one piece and shows its sliced part in a neighbour", () => {
    const whole = render(stage(withPostPiece(state, "basil", 20, 25), [through(0, 30)], "CUT"));
    const wholeIn = [...whole.container.querySelectorAll(".pizza-piece")].filter((p) => p.querySelector(`.pizza-topping[data-topping-stage="post"]`));
    expect(wholeIn).toHaveLength(1);
    cleanup();
    // on the cut line: whole in one piece, its other part in the neighbour
    const sliced = render(stage(withPostPiece(state, "basil", 50, 50), [through(0)], "CUT"));
    expect(sliced.container.querySelectorAll('.pizza-topping[data-topping-stage="post"]')).toHaveLength(1);
    expect(sliced.container.querySelectorAll('.pizza-topping-half[data-topping-stage="post"]').length).toBeGreaterThan(0);
  });

  it("is painted after the bake overlays and char spots, so a raw / burnt tint never covers it", () => {
    for (const lines of [[], [through(0)]]) {
      const { container } = render(stage(withPostPiece(state), lines, "CUT"));
      const follows = (el: Element, post: Element) => Boolean(el.compareDocumentPosition(post) & Node.DOCUMENT_POSITION_FOLLOWING);
      const post = container.querySelector('[data-topping-stage="post"]')!;
      // uncut: the separate layer, after the whole dough; cut: still inside the piece body, after its overlays
      const scope = lines.length === 0 ? container.querySelector(".pizza-dough")! : post.parentElement!;
      for (const layer of scope.querySelectorAll(".pizza-bake-overlay, .pizza-char-spots")) expect(follows(layer, post)).toBe(true);
      expect(scope.querySelectorAll(".pizza-bake-overlay, .pizza-char-spots").length).toBeGreaterThan(0);
      cleanup();
    }
  });

  it("RESULT scale: a post piece gets the same --piece-phase-scale as a pre-bake piece of its ingredient", () => {
    const { container } = render(stage(withPostPiece(state), [], null as unknown as GameState["makingStep"], true));
    const phase = (el: Element) => (el as HTMLElement).style.getPropertyValue("--piece-phase-scale");
    const pre = container.querySelector('.pizza-topping--basil:not([data-topping-stage])')!;
    const post = container.querySelector('.pizza-topping[data-topping-stage="post"]')!;
    expect(phase(pre)).toBe("0.75");
    expect(phase(post)).toBe(phase(pre));
    cleanup();
    // outside RESULT no variable is set, as on a pre-bake piece
    const cut = render(stage(withPostPiece(state), [], "CUT"));
    expect(phase(cut.container.querySelector('.pizza-topping[data-topping-stage="post"]')!)).toBe("");
  });

  it("RESULT (no making step) draws it too", () => {
    const { container } = render(stage(withPostPiece(state), [through(0)], null as unknown as GameState["makingStep"], true));
    expect(container.querySelectorAll('[data-topping-stage="post"]').length).toBeGreaterThan(0);
  });
});

/**
 * FINISH D2-2a (Issue #518, option b): on an uncut pizza the post-bake pieces leave `.pizza-dough` -- whose bake `filter`
 * tints every descendant -- for `.pizza-post-layer`, a sibling that covers the same box. The colour itself is checked on
 * real pixels in e2e/post-layer-d22a.spec.ts (jsdom has no layout or filter).
 */
describe("PizzaStage post-bake layer (FINISH D2-2a)", () => {
  const state = bakedMargheritaAtCut();

  it("draws post pieces in a layer outside .pizza-dough, never inside it", () => {
    const { container } = render(stage(withPostPiece(state), [], "TOPPING"));
    const dough = container.querySelector(".pizza-dough")!;
    const layer = container.querySelector(".pizza-post-layer")!;
    expect(layer).not.toBeNull();
    expect(dough.contains(layer)).toBe(false);
    expect(dough.parentElement).toBe(layer.parentElement); // siblings in the stage
    expect(dough.querySelector('[data-topping-stage="post"]')).toBeNull();
    expect(layer.querySelectorAll('[data-topping-stage="post"]').length).toBe(1);
    expect(container.querySelector(".pizza-stage")!.classList.contains("pizza-stage--post-layer")).toBe(true);
    // pre-bake pieces stay in the dough
    expect(dough.querySelectorAll(".pizza-topping:not([data-topping-stage])").length).toBeGreaterThan(0);
  });

  it("the layer takes no taps and carries no filter, opacity or transform of its own", () => {
    const { container } = render(stage(withPostPiece(state), [], "TOPPING"));
    const layer = container.querySelector(".pizza-post-layer") as HTMLElement;
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(layer.getAttribute("style")).toBeNull();
    expect((layer.firstElementChild as HTMLElement).getAttribute("style")).toBeNull();
  });

  it("with no post piece there is no layer and no stage modifier (the existing DOM)", () => {
    const { container } = render(stage(state, [], "TOPPING"));
    expect(container.querySelector(".pizza-post-layer")).toBeNull();
    expect(container.querySelector(".pizza-stage")!.className).not.toContain("post-layer");
  });

  it("a cut pizza keeps the in-piece path (cut + post-bake is not part of D2-2a)", () => {
    const { container } = render(stage(withPostPiece(state), [through(0)], "CUT"));
    expect(container.querySelector(".pizza-post-layer")).toBeNull();
    expect(container.querySelectorAll('.pizza-piece-body [data-topping-stage="post"]').length).toBeGreaterThan(0);
  });
});
