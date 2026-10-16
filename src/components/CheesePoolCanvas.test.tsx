import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHEESE_POOL_MELT_SPREAD, CheesePoolCanvas, canvas2dAvailable, cheesePoolReachPercent, cheesePoolSpreadScale, hasVisiblePixels, resetCanvas2dProbe } from "./CheesePoolCanvas";

afterEach(() => {
  vi.restoreAllMocks();
  resetCanvas2dProbe();
});

/** read-back stubs: a canvas that holds pixels, and one the browser emptied (#486 G1) */
const opaque = vi.fn((_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255), width: w, height: h }));
const blank = () => vi.fn((_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }));
const imageData = (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });

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
    const ctx = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: opaque };
    mockContext(ctx);
    expect(canvas2dAvailable()).toBe(true);
    const { container } = render(
      <CheesePoolCanvas seed="topping-4" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={<span data-testid="m1-piece" />} />,
    );
    expect(container.querySelector("canvas.pizza-cheese-canvas")).not.toBeNull();
    expect(container.querySelector('[data-testid="m1-piece"]')).toBeNull();
    expect(ctx.drawImage).toHaveBeenCalled();
  });
  it("asks for a CPU-backed context (willReadFrequently) because every draw is read back", () => {
    const ctx = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: opaque };
    const spy = mockContext(ctx);
    render(<CheesePoolCanvas seed="topping-wrf" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={<span />} />);
    expect(spy.mock.calls.some((c) => (c[1] as CanvasRenderingContext2DSettings | undefined)?.willReadFrequently === true)).toBe(true);
  });
  it("shows the M1 fallback when the probe passes but this canvas gets no context, and does not draw again afterwards", () => {
    const ctx = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: opaque };
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
    const ctx = { createImageData: vi.fn(), putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() };
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

  describe("#486 G1: a canvas the browser emptied is never shown as an invisible cheese", () => {
    const M1 = <span data-testid="m1-piece" />;

    it("shows M1 when the draw succeeds but the read-back is fully transparent (and rebuilds the bitmap once before giving up)", () => {
      const ctx = { createImageData: imageData, putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: blank() };
      mockContext(ctx);
      const { container } = render(<CheesePoolCanvas seed="g1-blank" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={M1} />);
      expect(container.querySelector("canvas")).toBeNull();
      expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
      expect(ctx.drawImage).toHaveBeenCalledTimes(2); // first draw + one retry with a rebuilt bitmap, no loop
    });

    it("keeps the canvas when the first draw is blank but the retry holds pixels", () => {
      const read = vi.fn().mockReturnValueOnce(imageData(64, 64)).mockImplementation(opaque);
      const ctx = { createImageData: imageData, putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: read };
      mockContext(ctx);
      const { container } = render(<CheesePoolCanvas seed="g1-retry" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={M1} />);
      expect(container.querySelector("canvas")).not.toBeNull();
      expect(container.querySelector('[data-testid="m1-piece"]')).toBeNull();
    });

    it("shows M1 when the read-back itself throws", () => {
      const ctx = { createImageData: imageData, putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: vi.fn(() => { throw new Error("read failed"); }) };
      mockContext(ctx);
      const { container } = render(<CheesePoolCanvas seed="g1-throw" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={M1} />);
      expect(container.querySelector("canvas")).toBeNull();
      expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
    });

    it("when the page comes back (pageshow / visible) with an emptied canvas, it redraws; if that is blank too it falls back to M1", async () => {
      const { act } = await import("@testing-library/react");
      const read = vi.fn().mockImplementation(opaque);
      const ctx = { createImageData: imageData, putImageData: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), getImageData: read };
      mockContext(ctx);
      const { container } = render(<CheesePoolCanvas seed="g1-return" melt={1} toast={0.4} char={0} grid={64} sizePx={62} fallback={M1} />);
      expect(container.querySelector("canvas")).not.toBeNull();
      const drawsBefore = ctx.drawImage.mock.calls.length;
      // a healthy canvas is left alone
      act(() => { window.dispatchEvent(new Event("pageshow")); });
      expect(ctx.drawImage.mock.calls.length).toBe(drawsBefore);
      // the browser emptied it while hidden: the redraw is blank again -> M1
      read.mockImplementation(blank());
      act(() => { window.dispatchEvent(new Event("pageshow")); });
      expect(container.querySelector("canvas")).toBeNull();
      expect(container.querySelector('[data-testid="m1-piece"]')).not.toBeNull();
    });

    it("hasVisiblePixels: any non-zero alpha counts, an all-zero buffer does not", () => {
      const withAlpha = new Uint8ClampedArray(16 * 4);
      withAlpha[3 + 4 * 5] = 1;
      const ctx = (data: Uint8ClampedArray) => ({ getImageData: () => ({ data }) }) as unknown as CanvasRenderingContext2D;
      expect(hasVisiblePixels(ctx(withAlpha), 4, 4)).toBe(true);
      expect(hasVisiblePixels(ctx(new Uint8ClampedArray(16 * 4)), 4, 4)).toBe(false);
    });
  });
});

describe("#421 melt spread scale", () => {
  it("is exactly 1 up to melt 0.3 (the pre-bake look is unchanged) and grows monotonically to 1 + CHEESE_POOL_MELT_SPREAD", () => {
    expect(cheesePoolSpreadScale(0)).toBe(1);
    expect(cheesePoolSpreadScale(0.3)).toBe(1);
    let last = 1;
    for (let m = 0.35; m <= 1.0001; m += 0.05) {
      const s = cheesePoolSpreadScale(m);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
    expect(cheesePoolSpreadScale(1)).toBeCloseTo(1 + CHEESE_POOL_MELT_SPREAD, 5);
  });
});

describe("#421 cut reach of the melted pool (Codex P2)", () => {
  /** the pool's half-width as a share of the dough interior (dough minus its 10 px borders) */
  const poolHalfPercent = (px: number, doughPx: number) => ((px / 2) * (1 + CHEESE_POOL_MELT_SPREAD) * 100) / (doughPx - 20);

  it("covers the melted pool's half-width (box half x spread) over the rendered dough's own size, for every dough the layouts draw", () => {
    for (const px of [56, 70, 84]) {
      for (const dough of [196, 209, 226, 300, 380]) {
        expect(cheesePoolReachPercent(px, dough)).toBeGreaterThanOrEqual(poolHalfPercent(px, dough));
        expect(cheesePoolReachPercent(px, dough)).toBeLessThan(poolHalfPercent(px, dough) + 1);
      }
    }
  });

  it("is larger on a smaller dough (the same fixed-pixel canvas is a bigger share of it); an unmeasured or tiny dough uses the smallest-dough floor, which still covers the compact RESULT dough", () => {
    expect(cheesePoolReachPercent(70, 196)).toBeGreaterThan(cheesePoolReachPercent(70, 300));
    expect(cheesePoolReachPercent(70, 0)).toBe(cheesePoolReachPercent(70, 120));
    expect(cheesePoolReachPercent(70, 0)).toBeGreaterThanOrEqual(cheesePoolReachPercent(70, 196));
    expect(cheesePoolReachPercent(70, 0)).toBeGreaterThan(5); // wider than the default topping reach, which is what the cut check used before
  });
});
