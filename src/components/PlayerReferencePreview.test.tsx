import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getPlayerReferencePizza } from "../data/playerReference";
import { getRecipe } from "../data/recipes";
import { PlayerReferencePreview } from "./PlayerReferencePreview";

/**
 * Issue #47 Slice B Finding F: pins the generic player-facing Reference panel used for every
 * recipe without a Scoring 2.0 Reference fixture (e.g. Bismarck) -- identity + approximate
 * placement only, no numeric precision that could be mistaken for a scoring target.
 */
afterEach(() => {
  cleanup();
});

function Harness({ recipeId }: { recipeId: string }) {
  const recipe = getRecipe(recipeId as never)!;
  const [isOpen, setIsOpen] = useState(true);
  return (
    <PlayerReferencePreview
      reference={getPlayerReferencePizza(recipe)}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    />
  );
}

describe("PlayerReferencePreview (Bismarck, no Scoring 2.0 fixture)", () => {
  it("renders a dialog labeled with the recipe's own name", () => {
    render(<Harness recipeId="bismarck" />);
    expect(screen.getByRole("dialog", { name: /ビスマルクの見本/ })).toBeInTheDocument();
  });

  it("renders mozzarella using the shared physical .pizza-cheese visual", () => {
    render(<Harness recipeId="bismarck" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelectorAll(".pizza-cheese.pizza-cheese--mozzarella")).toHaveLength(3);
  });

  it("renders egg using the shared emoji visual", () => {
    render(<Harness recipeId="bismarck" />);
    const dialog = screen.getByRole("dialog");
    const eggPieces = Array.from(dialog.querySelectorAll(".ingredient-piece-visual__emoji")).filter(
      (el) => el.textContent === "\u{1F95A}",
    );
    expect(eggPieces).toHaveLength(1);
  });

  it("never shows numeric quantity/coverage precision bars (Finding F: no misleading precision)", () => {
    render(<Harness recipeId="bismarck" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelectorAll(".reference-preview__bar-row")).toHaveLength(0);
  });

  it("shows a disclaimer that the layout is generated, not an exact scoring target", () => {
    render(<Harness recipeId="bismarck" />);
    expect(screen.getByText(/採点の基準座標ではありません/)).toBeInTheDocument();
  });

  it("clicking the backdrop closes the popover", () => {
    render(<Harness recipeId="bismarck" />);
    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render its own trigger button when renderTrigger is false", () => {
    const recipe = getRecipe("bismarck")!;
    render(
      <PlayerReferencePreview
        reference={getPlayerReferencePizza(recipe)}
        isOpen={false}
        onOpenChange={() => {}}
        renderTrigger={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /見本/ })).not.toBeInTheDocument();
  });
});
