import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MARGHERITA_REFERENCE } from "../data/referencePizza";
import { ReferencePreview } from "./ReferencePreview";

afterEach(cleanup);

describe("ReferencePreview shared physical ingredient visuals", () => {
  it("renders the canonical shared mozzarella shape, never the cheese emoji", () => {
    render(
      <ReferencePreview reference={MARGHERITA_REFERENCE} isOpen onOpenChange={() => {}} />,
    );

    const dialog = screen.getByRole("dialog", { name: "マルゲリータの見本" });
    const mozzarella = dialog.querySelectorAll(
      '.reference-mini-pizza__topping [data-ingredient-piece="mozzarella"]',
    );

    expect(mozzarella).toHaveLength(3);
    for (const piece of mozzarella) {
      expect(piece).toHaveClass("ingredient-piece-visual", "pizza-cheese--mozzarella");
    }
    expect(within(dialog).queryByText("🧀")).not.toBeInTheDocument();
  });

  it("renders canonical basil through the shared visual and preserves all target centers", () => {
    const { container } = render(
      <ReferencePreview reference={MARGHERITA_REFERENCE} isOpen onOpenChange={() => {}} />,
    );

    const basil = container.querySelectorAll('[data-ingredient-piece="basil"]');
    expect(basil).toHaveLength(2);
    for (const piece of basil) {
      expect(piece).toHaveClass("ingredient-piece-visual", "pizza-topping__emoji");
      expect(piece).toHaveTextContent("🌿");
    }

    const targets = Array.from(
      container.querySelectorAll<HTMLElement>(".reference-mini-pizza__topping"),
    );
    expect(targets.map(({ style }) => [style.left, style.top])).toEqual([
      ["35%", "35%"],
      ["65%", "36%"],
      ["50%", "66%"],
      ["31%", "62%"],
      ["69%", "62%"],
    ]);
  });
});
