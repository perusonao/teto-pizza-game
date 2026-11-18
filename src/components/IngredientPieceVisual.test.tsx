import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { createEmptyPizza } from "../state/pizzaState";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { PizzaStage } from "./PizzaStage";
import { createCutState } from "../logic/cut/state";

/**
 * Issue #32 Phase 1: pins IngredientPieceVisual's own rendering contract -- a cheese
 * ingredient (mozzarella, etc.) renders the shared physical `.pizza-cheese` shape, everything
 * else renders its emoji -- and that the player's own pizza (PizzaStage) renders a placed
 * mozzarella topping through this exact same component, not a parallel implementation.
 */
afterEach(() => {
  cleanup();
});

describe("IngredientPieceVisual", () => {
  it("renders the shared physical .pizza-cheese shape for a cheese ingredient (mozzarella)", () => {
    const mozzarella = getIngredient("mozzarella");
    if (!mozzarella) throw new Error("Missing mozzarella fixture");

    const { container } = render(<IngredientPieceVisual ingredient={mozzarella} />);

    const piece = container.querySelector(".pizza-cheese.pizza-cheese--mozzarella");
    expect(piece).toBeInTheDocument();
    expect(piece?.textContent).toBe("");
    expect(container.textContent).not.toContain("\u{1F9C0}");
  });

  it("appends an extra className (e.g. PizzaStage's bake meltClass) onto the cheese piece", () => {
    const mozzarella = getIngredient("mozzarella");
    if (!mozzarella) throw new Error("Missing mozzarella fixture");

    const { container } = render(
      <IngredientPieceVisual ingredient={mozzarella} className="pizza-cheese--melted" />,
    );

    const piece = container.querySelector(".pizza-cheese.pizza-cheese--mozzarella.pizza-cheese--melted");
    expect(piece).toBeInTheDocument();
  });

  it("a cheese with a pieceVisual (feta) keeps the .pizza-cheese wrapper and draws its SVG inside it", () => {
    const feta = getIngredient("feta");
    if (!feta) throw new Error("Missing feta fixture");

    const { container } = render(<IngredientPieceVisual ingredient={feta} className="pizza-cheese--melted" />);

    const piece = container.querySelector(".pizza-cheese.pizza-cheese--feta.pizza-cheese--glyph.pizza-cheese--melted");
    expect(piece).toBeInTheDocument();
    expect(piece?.querySelector('svg[data-ingredient-visual="feta-cubes"]')).not.toBeNull();
    expect(container.textContent).not.toContain("\u{1F9C0}");
  });

  it("renders the emoji for a non-cheese ingredient (basil)", () => {
    const basil = getIngredient("basil");
    if (!basil) throw new Error("Missing basil fixture");

    const { container } = render(<IngredientPieceVisual ingredient={basil} />);

    expect(container.querySelector(".pizza-cheese")).not.toBeInTheDocument();
    const emojiSpan = container.querySelector(".ingredient-piece-visual__emoji");
    expect(emojiSpan).toBeInTheDocument();
    expect(emojiSpan?.textContent).toBe(basil.emoji);
  });
});

describe("Player pizza mozzarella uses the shared IngredientPieceVisual primitive", () => {
  it("a placed mozzarella topping on PizzaStage renders the same .pizza-cheese shape", () => {
    const recipe = getRecipe("margherita");
    if (!recipe) throw new Error("Missing margherita recipe fixture");
    const activeIngredient = getIngredient(STARTER_INGREDIENT_IDS[0]) ?? null;

    const pizza = {
      ...createEmptyPizza(),
      toppings: [{ id: "t1", ingredientId: "mozzarella", x: 50, y: 50 }],
    };

    const { container } = render(
      <PizzaStage
        pizza={pizza}
        recipe={recipe}
        interactive={false}
        activeIngredient={activeIngredient}
        bakeProgress={null}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled={false}
        resetToken={0}
        makingStepToken={0}
        makingStep="TOPPING"
        showDoughShape={false}
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        cutState={createCutState()}
        onAddCutLine={() => {}}
      />,
    );

    const piece = container.querySelector(".pizza-cheese.pizza-cheese--mozzarella");
    expect(piece).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u{1F9C0}");
  });
});

describe("Topping Visuals 2.0 (#824 PR-1): surface boundary and the parmigiano placed drawing", () => {
  const parmigiano = () => {
    const ingredient = getIngredient("parmigiano");
    if (!ingredient) throw new Error("Missing parmigiano fixture");
    return ingredient;
  };

  it("placed (the default): parmigiano keeps the .pizza-cheese wrapper and draws the shavings SVG inside it", () => {
    const { container } = render(<IngredientPieceVisual ingredient={parmigiano()} className="pizza-cheese--melted" style={{ filter: "brightness(1.05)" }} />);

    const piece = container.querySelector(".pizza-cheese.pizza-cheese--parmigiano.pizza-cheese--glyph.pizza-cheese--melted");
    expect(piece).toBeInTheDocument();
    expect((piece as HTMLElement).style.filter).toBe("brightness(1.05)");
    expect((piece as HTMLElement).style.getPropertyValue("--cheese-color")).toBe(parmigiano().color);
    expect(piece?.querySelector('svg[data-ingredient-visual="parmigiano-shavings"]')).not.toBeNull();
    expect(container.textContent).not.toContain("\u{1F9C0}");
  });

  it('selection: parmigiano renders exactly the existing CSS plate (no glyph class, no SVG, no children)', () => {
    const { container } = render(<IngredientPieceVisual ingredient={parmigiano()} surface="selection" />);

    const piece = container.firstElementChild as HTMLElement;
    expect(piece.className).toBe("pizza-cheese pizza-cheese--parmigiano");
    expect(piece.innerHTML).toBe("");
    expect(container.querySelector("svg")).toBeNull();
    expect(piece.style.getPropertyValue("--cheese-color")).toBe(parmigiano().color);
  });

  it("selection output for parmigiano is identical to the output before the surface prop existed (explicit selection == the legacy markup)", () => {
    const legacy = render(<span className="pizza-cheese pizza-cheese--parmigiano" style={{ "--cheese-color": parmigiano().color } as React.CSSProperties} />);
    const legacyHtml = legacy.container.innerHTML;
    cleanup();
    const { container } = render(<IngredientPieceVisual ingredient={parmigiano()} surface="selection" />);
    expect(container.innerHTML).toBe(legacyHtml);
  });

  it.each(["mozzarella", "feta", "basil", "cucumber", "egg", "eggplant"])(
    "%s (no registered placed drawing) renders identically on both surfaces",
    (id) => {
      const ingredient = getIngredient(id);
      if (!ingredient) throw new Error(`Missing ${id} fixture`);
      const placed = render(<IngredientPieceVisual ingredient={ingredient} />).container.innerHTML;
      cleanup();
      const selection = render(<IngredientPieceVisual ingredient={ingredient} surface="selection" />).container.innerHTML;
      expect(placed).toBe(selection);
    },
  );

  it("the placed drawing never replaces a catalogue pieceVisual, and eggplant stays without one (Fry stays dormant)", () => {
    expect(getIngredient("eggplant")?.pieceVisual).toBeUndefined();
    expect(getIngredient("cucumber")?.pieceVisual).toBeUndefined();
    expect(getIngredient("parmigiano")?.pieceVisual).toBeUndefined();
    const feta = getIngredient("feta");
    if (!feta) throw new Error("Missing feta fixture");
    const { container } = render(<IngredientPieceVisual ingredient={feta} />);
    expect(container.querySelector('svg[data-ingredient-visual="feta-cubes"]')).not.toBeNull();
    expect(container.querySelector('svg[data-ingredient-visual="parmigiano-shavings"]')).toBeNull();
  });

  it("the placed sprinkle gets a wider box (60px) than the default 28px glyph; the selection surface and other cheeses keep the default", () => {
    const placed = render(<IngredientPieceVisual ingredient={parmigiano()} />);
    expect((placed.container.firstElementChild as HTMLElement).style.getPropertyValue("--cheese-glyph-size")).toBe("60px");
    placed.unmount();
    const selection = render(<IngredientPieceVisual ingredient={parmigiano()} surface="selection" />);
    expect((selection.container.firstElementChild as HTMLElement).style.getPropertyValue("--cheese-glyph-size")).toBe("");
    selection.unmount();
    for (const id of ["mozzarella", "feta"]) {
      const ingredient = getIngredient(id);
      if (!ingredient) throw new Error(`Missing ${id} fixture`);
      const other = render(<IngredientPieceVisual ingredient={ingredient} />);
      expect((other.container.firstElementChild as HTMLElement).style.getPropertyValue("--cheese-glyph-size")).toBe("");
      other.unmount();
    }
  });

  it("a parmigiano placed on PizzaStage uses the shavings drawing inside the bake-styled .pizza-cheese wrapper", () => {
    const recipe = getRecipe("margherita");
    if (!recipe) throw new Error("Missing margherita recipe fixture");
    const pizza = {
      ...createEmptyPizza(),
      toppings: [{ id: "t1", ingredientId: "parmigiano", x: 50, y: 50 }],
    };
    const { container } = render(
      <PizzaStage
        pizza={pizza}
        recipe={recipe}
        interactive={false}
        activeIngredient={getIngredient(STARTER_INGREDIENT_IDS[0]) ?? null}
        bakeProgress={null}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled={false}
        resetToken={0}
        makingStepToken={0}
        makingStep="TOPPING"
        showDoughShape={false}
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        cutState={createCutState()}
        onAddCutLine={() => {}}
      />,
    );

    const wrapper = container.querySelector(".pizza-topping--parmigiano .pizza-cheese.pizza-cheese--parmigiano.pizza-cheese--glyph");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.querySelector('svg[data-ingredient-visual="parmigiano-shavings"]')).not.toBeNull();
  });
});
