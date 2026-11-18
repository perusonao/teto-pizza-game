import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ParmigianoSprinkle } from "./ParmigianoSprinkle";
import { sprinkleLayout, sprinkleShift } from "./sprinkleLayout";

/**
 * Issue #825: the placed parmigiano is drawn as a sprinkle seeded by the piece's id (read from the stage's `[data-topping-id]` wrapper). One piece is still one piece:
 * nothing here creates a second topping, and the id / position are only read.
 */
afterEach(() => {
  cleanup();
});

function inStage(id: string, left: string, top: string) {
  return (
    <span data-topping-id={id} style={{ left, top }}>
      <ParmigianoSprinkle />
    </span>
  );
}

const shavingCount = (container: HTMLElement) => container.querySelectorAll("g[data-shaving]").length;
const signature = (container: HTMLElement) => container.querySelector("svg")?.innerHTML ?? "";

describe("ParmigianoSprinkle", () => {
  it("draws the layout of its piece id (10 to 14 shavings), keeping the parmigiano svg marker", () => {
    const { container } = render(inStage("topping-4", "50%", "30%"));
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("data-ingredient-visual", "parmigiano-shavings");
    expect(shavingCount(container)).toBe(sprinkleLayout("topping-4").shavings.length);
    expect(shavingCount(container)).toBeGreaterThanOrEqual(8);
    expect(svg?.querySelector("ellipse")).toBeNull();
  });

  it("two pieces draw different sprinkles; the same piece draws the same one again (after the bake, on a CUT half, in RESULT)", () => {
    const first = render(inStage("topping-1", "50%", "30%"));
    const a = signature(first.container);
    first.unmount();
    const second = render(inStage("topping-2", "50%", "30%"));
    const b = signature(second.container);
    second.unmount();
    const again = render(inStage("topping-1", "50%", "30%"));
    expect(b).not.toBe(a);
    expect(signature(again.container)).toBe(a);
  });

  it("pulls the field inward for a piece placed near the rim, and leaves a central piece unshifted", () => {
    const rim = render(inStage("topping-9", "92%", "50%"));
    const group = rim.container.querySelector("svg > g");
    const shift = sprinkleShift(92, 50);
    expect(shift.x).toBeLessThan(0);
    expect(group?.getAttribute("transform")).toBe(`translate(${shift.x} ${shift.y})`);
    rim.unmount();
    const centre = render(inStage("topping-9", "50%", "50%"));
    expect(centre.container.querySelector("svg > g")?.getAttribute("transform")).toBeNull();
  });

  it("outside a stage (no wrapper) it still renders one fixed sprinkle", () => {
    const first = render(<ParmigianoSprinkle />);
    const a = signature(first.container);
    first.unmount();
    const second = render(<ParmigianoSprinkle />);
    expect(signature(second.container)).toBe(a);
    expect(shavingCount(second.container)).toBeGreaterThanOrEqual(8);
  });
});
