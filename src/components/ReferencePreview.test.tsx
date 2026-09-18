import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MARGHERITA_REFERENCE } from "../data/referencePizza";
import { ReferencePreview } from "./ReferencePreview";

/**
 * Issue #32 Phase 1: pins the Margherita Reference popover's visual-consistency fix --
 * mozzarella must render the same physical `.pizza-cheese` piece the player places (not the
 * old standalone 🧀 emoji), basil keeps its shared emoji artwork, and none of this touches the
 * Reference's piece counts or target coordinates (those remain Scoring 2.0's authoritative
 * fixture, untouched by this phase).
 */
afterEach(() => {
  cleanup();
});

function Harness() {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <ReferencePreview
      reference={MARGHERITA_REFERENCE}
      recipeNameJa="マルゲリータ"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    />
  );
}

describe("ReferencePreview visual consistency (Issue #32 Phase 1)", () => {
  it("no longer renders the standalone 🧀 mozzarella emoji", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).not.toContain("\u{1F9C0}");
  });

  it("renders mozzarella using the same shared .pizza-cheese physical visual as the player", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    const mozzarellaPieces = dialog.querySelectorAll(
      ".reference-mini-pizza__topping--mozzarella .pizza-cheese.pizza-cheese--mozzarella",
    );
    expect(mozzarellaPieces).toHaveLength(MARGHERITA_REFERENCE.pieceGroups[0].positions.length);
  });

  it("renders basil using the shared emoji visual primitive", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    const basilPieces = dialog.querySelectorAll(
      ".reference-mini-pizza__topping--basil .ingredient-piece-visual__emoji",
    );
    expect(basilPieces).toHaveLength(MARGHERITA_REFERENCE.pieceGroups[1].positions.length);
    for (const piece of basilPieces) {
      expect(piece.textContent).toBe("\u{1F33F}");
    }
  });

  it("piece counts remain unchanged: mozzarella 3, basil 2", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelectorAll(".reference-mini-pizza__topping--mozzarella")).toHaveLength(3);
    expect(dialog.querySelectorAll(".reference-mini-pizza__topping--basil")).toHaveLength(2);
  });

  it("renders each piece at its exact canonical target coordinates, unchanged", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    for (const group of MARGHERITA_REFERENCE.pieceGroups) {
      const pieces = dialog.querySelectorAll(`.reference-mini-pizza__topping--${group.ingredientId}`);
      group.positions.forEach((position, index) => {
        const style = (pieces[index] as HTMLElement).style;
        expect(style.left).toBe(`${position.x}%`);
        expect(style.top).toBe(`${position.y}%`);
      });
    }
  });

  it("clicking the backdrop still closes the popover (unrelated interaction untouched)", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
