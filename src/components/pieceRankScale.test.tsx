import "@testing-library/jest-dom/vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { INGREDIENTS } from "../data/ingredients";
import { toppingRankScale } from "../data/toppingSizeClass";
import { createIdealDoughShape } from "../logic/doughShape";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import type { CutLine } from "../logic/cut/types";
import { PizzaStage } from "./PizzaStage";
import { ReferenceThumbnail } from "./ReferenceThumbnail";
import { renderPizzaVisualPieces } from "./PizzaVisualPieces";

/**
 * Issue #479 S2a: `--piece-rank-scale` is wired onto the on-pizza pieces only, and every class is 1, so nothing changes size.
 * Pins (1) every on-pizza route sets the variable (whole, cut-half, M1 cheese, emoji / SVG glyph, Canvas mozzarella, Reference),
 * (2) the stylesheet composes it by multiplication in exactly the three size rules, (3) the tray / drag preview / inventory /
 * hint chips never see it.
 */

const SRC = join(__dirname, "..");
const css = readFileSync(join(SRC, "App.css"), "utf8");

const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

function bakedMargherita(): GameState {
  let state: GameState = createGuidedInitialState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  state = gameReducer(state, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: buildIdealMargheritaSauceFixture() });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  for (const p of MOZZARELLA_GROUP.positions) state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  for (const p of BASIL_GROUP.positions) state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
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

function stage(state: GameState, lines: CutLine[], makingStep: GameState["makingStep"]) {
  return (
    <PizzaStage
      pizza={{ ...state.pizza, doughShape: createIdealDoughShape() }}
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
    />
  );
}

/** the ingredient id of a placed span: whole pieces carry it in a class, cut halves look their placed topping up */
const ingredientOf = (el: HTMLElement, state: GameState) => {
  const m = [...el.classList].find((c) => c.startsWith("pizza-topping--"));
  if (m) return m.slice("pizza-topping--".length);
  return state.pizza.toppings.find((t) => t.id === el.dataset.toppingId)!.ingredientId;
};
const expectedRank = (el: HTMLElement, state: GameState) => String(toppingRankScale(ingredientOf(el, state)));

const pieceSpans = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".pizza-topping, .pizza-topping-half[data-topping-id]")];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PizzaStage sets --piece-rank-scale (the production class value) on every placed piece", () => {
  const state = bakedMargherita();

  it("uncut (default Canvas mozzarella or the jsdom M1 fallback) and as a six-piece cut: whole and half spans alike", () => {
    const uncut = render(stage(state, [], "CUT"));
    const whole = pieceSpans(uncut.container);
    expect(whole).toHaveLength(state.pizza.toppings.length);
    for (const el of whole) expect(el.style.getPropertyValue("--piece-rank-scale"), ingredientOf(el, state)).toBe(expectedRank(el, state));
    cleanup();

    // one horizontal cut straight through the first placed piece, so that piece is sliced into a neighbouring piece too
    const first = state.pizza.toppings[0];
    const cut = render(stage(state, [through(0, first.y - DOUGH_CENTER), through(90), through(45)], "CUT"));
    const spans = pieceSpans(cut.container);
    expect(spans.length).toBeGreaterThanOrEqual(state.pizza.toppings.length);
    expect(cut.container.querySelectorAll(".pizza-topping-half[data-topping-id]").length).toBeGreaterThan(0);
    for (const el of spans) expect(el.style.getPropertyValue("--piece-rank-scale"), ingredientOf(el, state)).toBe(expectedRank(el, state));
  });

  it("keeps the landing-animation wrapper classes and its inline position / rotation intact", () => {
    const { container } = render(stage(state, [], "CUT"));
    for (const el of pieceSpans(container)) {
      expect(el.className).toMatch(/pizza-topping pizza-topping--[a-z-]+/);
      expect(el.style.left).toMatch(/%$/);
      expect(el.style.top).toMatch(/%$/);
      expect(el.style.getPropertyValue("--piece-rotation")).toMatch(/deg$/);
      expect(el.style.transform).toBe(""); // the wrapper's transform stays the stylesheet's (translate + landing keyframes), never an inline scale
    }
  });

  it("leaves the Canvas mozzarella box at its unscaled default size (70px)", async () => {
    const inked = () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: inked,
    })) as never);
    localStorage.removeItem("teto-pizza-cheese-canvas");
    vi.resetModules();
    const { resetCanvas2dProbe } = await import("./CheesePoolCanvas");
    resetCanvas2dProbe();
    const { PizzaStage: Fresh } = await import("./PizzaStage");
    const props = (stage(state, [], "CUT") as React.ReactElement<React.ComponentProps<typeof PizzaStage>>).props;
    const { container } = render(<Fresh {...props} />);
    const canvases = container.querySelectorAll<HTMLCanvasElement>("canvas.pizza-cheese-canvas");
    expect(canvases.length).toBeGreaterThan(0);
    for (const c of canvases) expect(c.style.getPropertyValue("--cheese-canvas-size")).toBe("70px");
  });
});

describe("Reference views set the same variable through renderPizzaVisualPieces", () => {
  const groups = [
    { ingredientId: "mozzarella", positions: [{ x: 40, y: 40 }] }, // CSS cheese
    { ingredientId: "parmigiano", positions: [{ x: 60, y: 40 }] }, // rotated CSS cheese
    { ingredientId: "fresh-tomato", positions: [{ x: 40, y: 60 }] }, // dedicated SVG glyph
    { ingredientId: "basil", positions: [{ x: 60, y: 60 }] }, // emoji
  ];

  it("every wrapper carries its --piece-rank-scale and keeps its own position / rotation", () => {
    const { container } = render(<div>{renderPizzaVisualPieces({ pieceGroups: groups, wrapperClassName: () => "w" })}</div>);
    const wrappers = container.querySelectorAll<HTMLElement>(".w");
    expect(wrappers).toHaveLength(4);
    [...wrappers].forEach((w, i) => {
      expect(w.style.getPropertyValue("--piece-rank-scale"), groups[i].ingredientId).toBe(String(toppingRankScale(groups[i].ingredientId)));
      expect(w.style.left).toMatch(/%$/);
      expect(w.style.transform).toMatch(/^translate\(-50%, -50%\) rotate\(/);
    });
  });

  it("the Reference thumbnail pieces match the PizzaStage value for the same ingredient", () => {
    const { container } = render(<ReferenceThumbnail sauceIngredientId="tomato-sauce" pieceGroups={groups} />);
    const pieces = container.querySelectorAll<HTMLElement>(".reference-thumbnail__piece");
    expect(pieces).toHaveLength(4);
    [...pieces].forEach((p, i) => expect(p.style.getPropertyValue("--piece-rank-scale"), groups[i].ingredientId).toBe(String(toppingRankScale(groups[i].ingredientId))));
  });
});

describe("stylesheet: the variable multiplies the three on-pizza size rules and nothing else", () => {
  const block = (selector: string) => {
    const m = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
    return m ? m[1] : "";
  };

  it("emoji / SVG glyph font-size, the shared cheese transform and the parmigiano transform read it, composed with --piece-scale", () => {
    expect(block(".ingredient-piece-visual__emoji")).toContain("font-size: calc(28px * var(--piece-scale, 1) * var(--piece-rank-scale, 1))");
    expect(block(".pizza-cheese")).toContain("transform: scale(calc(var(--bake-melt-scale, 1) * var(--piece-scale, 1) * var(--piece-rank-scale, 1)))");
    expect(block(".pizza-cheese--parmigiano")).toContain(
      "transform: rotate(-18deg) scale(calc(var(--bake-melt-scale, 1) * var(--piece-scale, 1) * var(--piece-rank-scale, 1)))",
    );
  });

  it("the default (variable unset) is the old expression times 1, and the SVG glyph / cheese-canvas sizes are not hard-coded to it", () => {
    expect(block(".ingredient-glyph")).not.toContain("--piece-rank-scale");
    expect(block(".pizza-cheese-canvas")).not.toContain("--piece-rank-scale");
    expect(block(".pizza-topping")).not.toContain("--piece-rank-scale");
    expect(block(".pizza-topping-half")).not.toContain("--piece-rank-scale");
  });

  it("the tray chip, drag preview, inventory card and hint / shortage chips never read it", () => {
    for (const sel of [
      ".ingredient-chip__emoji",
      ".piece-drag-preview",
      ".piece-drag-preview__emoji",
      ".inventory-card__emoji",
      ".mission-shortage-panel__glyph",
      ".hint-sheet__glyph",
      ".pizza-thumbnail__piece",
      ".pizza-thumbnail__piece-emoji",
    ]) {
      expect(block(sel), sel).not.toContain("--piece-rank-scale");
    }
  });
});

describe("boundary: only the two on-pizza wrappers set the variable (the data and preview modules only name it in a comment)", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
  const sources = walk(SRC).filter((p) => /\.(tsx?|css)$/.test(p) && !/\.test\.tsx?$/.test(p));

  it("no tray, drag preview, inventory, hint or shop component mentions --piece-rank-scale", () => {
    const users = sources.filter((p) => readFileSync(p, "utf8").includes("--piece-rank-scale")).map((p) => p.slice(SRC.length + 1));
    expect(users.sort()).toEqual(["App.css", "components/PizzaStage.tsx", "components/PizzaVisualPieces.tsx", "data/toppingSizeClass.ts", "preview/toppingScalePreview.ts"]);
  });

  it("the tray, inventory and thumbnail renderers still draw the ingredient without any rank wrapper (unscaled)", () => {
    expect(INGREDIENTS.length).toBeGreaterThan(0);
    for (const f of ["IngredientTray.tsx", "InventoryOverlay.tsx", "PizzaThumbnail.tsx", "IngredientPieceVisual.tsx"]) {
      const text = readFileSync(join(SRC, "components", f), "utf8");
      expect(text).not.toContain("toppingRankScale");
      expect(text).not.toContain("activeToppingRankScale");
      expect(text).not.toContain("toppingScalePreview");
    }
  });
});
