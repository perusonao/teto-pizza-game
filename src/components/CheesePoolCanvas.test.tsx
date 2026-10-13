import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheesePoolCanvas, canvas2dAvailable, resetCanvas2dProbe } from "./CheesePoolCanvas";

afterEach(() => {
  cleanup(); // unmount first: mounted canvases listen to pageshow / visibilitychange
  vi.restoreAllMocks();
  resetCanvas2dProbe();
});

/** a read-back with visible pixels / with none (a discarded backing store reads back fully transparent) */
const inked = () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) });
const blank = () => ({ data: new Uint8ClampedArray(64 * 64 * 4) });

function mockContext(ctx: unknown) {
  return vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctx) as never);
}

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

  it("shows the M1 fallback, not a blank piece, when the browser gives no 2D context", () => {
    mockContext(null);
    expect(canvas2dAvailable()).toBe(false);
    const { container } = render(
      <CheesePoolCanvas seed="topping-3" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={<span data-testid="m1-piece" className="pizza-cheese" />} />,
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
  });

  it("draws the canvas (and no fallback) when a 2D context is available", () => {
    const ctx = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: inked };
    mockContext(ctx);
    expect(canvas2dAvailable()).toBe(true);
    const { container } = render(
      <CheesePoolCanvas seed="topping-4" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={<span data-testid="m1-piece" />} />,
    );
    expect(container.querySelector("canvas.pizza-cheese-canvas")).not.toBeNull();
    expect(container.querySelector('[data-testid="m1-piece"]')).toBeNull();
    expect(ctx.drawImage).toHaveBeenCalled();
  });
  it("shows the M1 fallback when the probe passes but this canvas gets no context, and does not draw again afterwards", () => {
    const ctx = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: inked };
    let calls = 0;
    // the first call is the probe (a detached canvas) and succeeds; the visible canvas then gets null
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((function (this: HTMLCanvasElement) {
      calls += 1;
      return this.isConnected ? null : ctx;
    }) as never);
    const { container, rerender } = render(
      <CheesePoolCanvas seed="topping-5" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={<span data-testid="m1-piece" />} />,
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
    const after = calls;
    rerender(<CheesePoolCanvas seed="topping-5" melt={0.5} toast={0.4} char={0} grid={64} sizePx={62} fallback={<span data-testid="m1-piece" />} />);
    expect(calls).toBe(after); // the canvas is gone: no further getContext / drawing attempts
    expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
    spy.mockRestore();
  });

  it("shows the M1 fallback when drawing throws (bitmap or draw call failing)", () => {
    const ctx = {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      getImageData: inked,
      drawImage: vi.fn(() => {
        throw new Error("draw failed");
      }),
    };
    mockContext(ctx);
    const { container } = render(
      <CheesePoolCanvas seed="topping-6" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={<span data-testid="m1-piece" />} />,
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
    expect(ctx.drawImage).toHaveBeenCalledTimes(1); // no retry loop
  });

  it("shows the M1 fallback when the bitmap cannot be built (the offscreen canvas has no context)", () => {
    // the probe and the visible canvas succeed, the offscreen bitmap canvas (created by bitmapOf) does not
    const ctx = { createImageData: vi.fn(), putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: inked };
    let n = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => {
      n += 1;
      return n <= 2 ? ctx : null; // 1: probe, 2: the visible canvas, 3: the bitmap canvas
    }) as never);
    const { container } = render(
      <CheesePoolCanvas seed="topping-7" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={<span data-testid="m1-piece" />} />,
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  describe("#486 G1: a silently blank canvas (iOS discards the backing store without an error)", () => {
    const base = () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() });
    const m1 = <span data-testid="m1-piece" />;

    it("shows the M1 fallback when the canvas reads back fully transparent, after one bounded retry", () => {
      const ctx = { ...base(), getImageData: vi.fn(blank) };
      mockContext(ctx);
      const { container } = render(<CheesePoolCanvas seed="g1-a" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={m1} />);
      expect(container.querySelector("canvas")).toBeNull();
      expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
      expect(ctx.drawImage).toHaveBeenCalledTimes(2); // draw, rebuild the bitmap once, draw again: no loop
    });

    it("keeps the canvas when the rebuilt bitmap reads back with pixels", () => {
      const reads = [blank, inked];
      const ctx = { ...base(), getImageData: vi.fn(() => (reads.shift() ?? inked)()) };
      mockContext(ctx);
      const { container } = render(<CheesePoolCanvas seed="g1-b" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={m1} />);
      expect(container.querySelector("canvas.pizza-cheese-canvas")).not.toBeNull();
      expect(container.querySelector('[data-testid="m1-piece"]')).toBeNull();
    });

    it("shows the M1 fallback when the read-back itself is unavailable or throws", () => {
      mockContext({ ...base() }); // no getImageData at all
      const a = render(<CheesePoolCanvas seed="g1-c" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={m1} />);
      expect(a.container.querySelector("canvas")).toBeNull();
      expect(a.container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
      a.unmount();
      mockContext({
        ...base(),
        getImageData: () => {
          throw new Error("denied");
        },
      });
      const b = render(<CheesePoolCanvas seed="g1-d" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={m1} />);
      expect(b.container.querySelector("canvas")).toBeNull();
    });

    it("verifies again when the page comes back (visibilitychange / pageshow) and falls back if the canvas went blank meanwhile", () => {
      let live = true;
      const ctx = { ...base(), getImageData: vi.fn(() => (live ? inked() : blank())) };
      mockContext(ctx);
      const { container } = render(<CheesePoolCanvas seed="g1-e" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={m1} />);
      expect(container.querySelector("canvas")).not.toBeNull();
      const drawn = ctx.drawImage.mock.calls.length;
      live = false; // the backing store was discarded while the page was hidden
      act(() => {
        window.dispatchEvent(new Event("pageshow"));
      });
      expect(ctx.drawImage.mock.calls.length).toBeGreaterThan(drawn);
      expect(container.querySelector("canvas")).toBeNull();
      expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
      const after = ctx.drawImage.mock.calls.length;
      act(() => {
        window.dispatchEvent(new Event("pageshow"));
      });
      expect(ctx.drawImage.mock.calls.length).toBe(after); // replaced by M1: nothing draws again
    });

    it("without a fallback prop it never swaps the canvas out (the caller asked for none)", () => {
      mockContext({ ...base(), getImageData: vi.fn(blank) });
      const { container } = render(<CheesePoolCanvas seed="g1-f" melt={1} toast={0.4} char={0} grid={64} sizePx={62} />);
      expect(container.querySelector("canvas")).not.toBeNull();
    });
  });
});
