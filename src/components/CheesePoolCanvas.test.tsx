import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheesePoolCanvas } from "./CheesePoolCanvas";

describe("CheesePoolCanvas", () => {
  it("renders a square, aria-hidden canvas of the grid's bitmap size and the requested CSS size", () => {
    const { container } = render(<CheesePoolCanvas seed="topping-1" melt={1} toast={0.4} char={0} grid={64} sizePx={54} />);
    const canvas = container.querySelector("canvas.pizza-cheese-canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    expect([canvas.width, canvas.height]).toEqual([64, 64]);
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(canvas.style.getPropertyValue("--cheese-canvas-size")).toBe("54px");
  });

  it("does not throw where a 2D context is unavailable (jsdom) and for either grid", () => {
    expect(() => render(<CheesePoolCanvas seed="topping-2" melt={0} toast={0} char={0} grid={96} sizePx={60} />)).not.toThrow();
  });
});
