import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/**
 * V9 trial F2: the component paints with the ACTIVE variant's look. The active variant is a constant of the layout module; here it is replaced by `f2` to prove the wiring
 * (a component that ignored it would silently paint the default look, which no other test can see because the shipped active variant paints the default look).
 */
vi.mock("./sprinkleLayout", async (importOriginal) => ({ ...(await importOriginal<typeof import("./sprinkleLayout")>()), SPRINKLE_ACTIVE_VARIANT: "f2" }));

afterEach(() => {
  cleanup();
});

describe("ParmigianoSprinkle paints with the active variant's look", () => {
  it("with f2 active the shavings are 0.6 opaque and carry no core and no grain line", async () => {
    const { ParmigianoSprinkle } = await import("./ParmigianoSprinkle");
    const { container } = render(
      <span data-topping-id="topping-9" style={{ left: "50%", top: "30%" }}>
        <ParmigianoSprinkle />
      </span>,
    );
    const faces = [...container.querySelectorAll<SVGPathElement>("g[data-shaving] > path[fill-opacity]")];
    expect(faces.length).toBeGreaterThanOrEqual(11);
    for (const face of faces) expect(face).toHaveAttribute("fill-opacity", "0.6");
    expect(container.querySelectorAll("path[fill='#fffaec']")).toHaveLength(0);
    expect(container.querySelectorAll("path[stroke='#d9cca5']")).toHaveLength(0);
  });
});
