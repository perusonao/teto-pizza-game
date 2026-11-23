import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/**
 * V10-1 trial: the component paints with the ACTIVE variant's look, here replaced by `v101` to prove the wiring of the blur (a component that ignored `look.edgeBlur` would draw
 * no blur, which no other test can see because the shipped active variant draws none).
 */
vi.mock("./sprinkleLayout", async (importOriginal) => ({ ...(await importOriginal<typeof import("./sprinkleLayout")>()), SPRINKLE_ACTIVE_VARIANT: "v101" }));

afterEach(() => {
  cleanup();
});

describe("ParmigianoSprinkle paints the active variant's edge blur", () => {
  it("with v101 active the svg root has blur(0.4px) and the sprinkle is still F3's layout (11..12 shavings, one svg)", async () => {
    const { ParmigianoSprinkle } = await import("./ParmigianoSprinkle");
    const { container } = render(
      <span data-topping-id="topping-9" style={{ left: "50%", top: "30%" }}>
        <ParmigianoSprinkle />
      </span>,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0].style.filter).toBe("blur(0.4px)");
    const count = container.querySelectorAll("g[data-shaving]").length;
    expect(count).toBeGreaterThanOrEqual(11);
    expect(count).toBeLessThanOrEqual(12);
  });
});
