import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { buildSauceDisplayPixels } from "../logic/sauceDisplay";
import { createIdealDoughShape } from "../logic/doughShape";
import type { SauceLayer } from "../state/sauceLayers";
import { SauceHeatmapCanvas } from "./SauceHeatmapCanvas";
import { SauceMergedHeatmapCanvas } from "./SauceMergedCanvas";
import { createStagingSurface, releaseStagingSurface } from "./sauceCanvasSupport";

/**
 * #524 Owner HV (iPhone Safari: after the oil is painted the tomato layer's canvas holds the OIL's pixels, c0 == c1). Hypothesis: the sauce canvases
 * shared ONE 64x64 staging canvas as the `drawImage` source; a GPU canvas that reads the source LATER then sees what the NEXT layer wrote there.
 *
 * This file models such a canvas (`drawImage` of a canvas source is read at the END of the task, not at the call) and checks that every sauce canvas still
 * ends with ITS OWN pixels when several mount in the same commit. It FAILS on the shared-staging code (verified, see the report) and passes with a staging
 * surface per canvas. The model is a hypothesis about the device, not a proof that iPhone Safari does this.
 */
interface FakeCtx {
  canvas: HTMLCanvasElement;
  store: Uint8ClampedArray; // what putImageData wrote (a staging canvas's backing)
  drawn: Uint8ClampedArray; // what the canvas shows after its deferred draws ran
  [k: string]: unknown;
}
const ctxs = new WeakMap<HTMLCanvasElement, FakeCtx>();
const created: HTMLCanvasElement[] = []; // every canvas that got a context, in creation order
let queue: Array<() => void> = [];

function makeCtx(canvas: HTMLCanvasElement, deferred: boolean): FakeCtx {
  const c = {
    canvas,
    store: new Uint8ClampedArray(canvas.width * canvas.height * 4),
    drawn: new Uint8ClampedArray(canvas.width * canvas.height * 4),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: (img: { data: Uint8ClampedArray }) => {
      c.store.set(img.data);
    },
    clearRect: () => {
      c.drawn.fill(0);
    },
    drawImage: (src: HTMLCanvasElement) => {
      const run = () => {
        const source = ctxs.get(src)!;
        // the visible canvas keeps the 64x64 source pixels (what matters here is WHICH pixels, not the scaling)
        c.drawn = new Uint8ClampedArray(source.store);
      };
      if (deferred) queue.push(run);
      else run();
    },
    getImageData: () => ({ data: c.drawn }),
  } as unknown as FakeCtx;
  return c;
}

function install(deferred: boolean) {
  queue = [];
  created.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    let c = ctxs.get(this);
    if (!c) {
      c = makeCtx(this, deferred);
      ctxs.set(this, c);
      created.push(this);
    }
    return c as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext);
}
const flush = () => {
  const q = queue;
  queue = [];
  q.forEach((f) => f());
};
const visible = () => created.filter((c) => c.width === 200);
const staging = () => created.filter((c) => c.width === 64 || c.width === 0);
const alphaMask = (px: ArrayLike<number>) => Array.from({ length: px.length / 4 }, (_, i) => (px[i * 4 + 3] > 8 ? 1 : 0)).join("");

const shape = createIdealDoughShape();
const dep = (x: number, y: number, ingredientId: string) => ({ x, y, amount: 0.04, ingredientId });
const tomato = Array.from({ length: 8 }, (_, i) => dep(22 + i * 3, 38, "tomato-sauce"));
const oil = Array.from({ length: 8 }, (_, i) => dep(55 + i * 3, 66, "olive-oil"));
const RED = "#c73b2e";
const OIL = "#e9d9a0";
const expectedMask = (deposits: typeof tomato, color: string) => alphaMask(buildSauceDisplayPixels(deposits, shape, color));

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

function layered(): ReactElement {
  return (
    <>
      <SauceHeatmapCanvas deposits={tomato} doughShape={shape} color={RED} ingredientId="tomato-sauce" />
      <SauceHeatmapCanvas deposits={oil} underDeposits={tomato} doughShape={shape} color={OIL} ingredientId="olive-oil" />
    </>
  );
}

describe("a canvas that reads its drawImage source late (the iPhone Safari hypothesis)", () => {
  it("two layers mounting in the same commit: each canvas ends with ITS OWN pixels", () => {
    install(true);
    render(layered());
    flush();
    const [c0, c1] = visible();
    const m0 = alphaMask(ctxs.get(c0)!.drawn);
    const m1 = alphaMask(ctxs.get(c1)!.drawn);
    expect(m0, "tomato canvas holds the tomato's pixels").toBe(expectedMask(tomato, RED));
    expect(m1, "oil canvas holds the oil's pixels (the oil layer is not the tomato layer)").not.toBe(m0);
  });

  it("the symptom signature: the two canvases never end up with the SAME mask when their deposits differ", () => {
    install(true);
    render(layered());
    flush();
    const [c0, c1] = visible();
    expect(alphaMask(ctxs.get(c0)!.drawn)).not.toBe(alphaMask(ctxs.get(c1)!.drawn));
  });

  it("merged (flattened) groups that mount together are not mixed up either", () => {
    install(true);
    const run = (ingredientId: string, deposits: typeof tomato): SauceLayer => ({ ingredientId, deposits, under: [] });
    const colorOf = (id: string) => (id === "olive-oil" ? OIL : RED);
    render(
      <>
        <SauceMergedHeatmapCanvas runs={[run("tomato-sauce", tomato)]} doughShape={shape} colorOf={colorOf} />
        <SauceMergedHeatmapCanvas runs={[run("olive-oil", oil)]} doughShape={shape} colorOf={colorOf} />
      </>,
    );
    flush();
    const [a, b] = created.filter((c) => c.width !== 64 && c.width !== 0);
    expect(alphaMask(ctxs.get(a)!.drawn)).not.toBe(alphaMask(ctxs.get(b)!.drawn));
  });

  it("the same canvas redrawn twice in one task ends with its LATEST pixels", () => {
    install(true);
    const view = render(<SauceHeatmapCanvas deposits={tomato} doughShape={shape} color={RED} />);
    view.rerender(<SauceHeatmapCanvas deposits={[...tomato, ...oil]} doughShape={shape} color={RED} />);
    flush();
    expect(alphaMask(ctxs.get(visible()[0])!.drawn)).toBe(expectedMask([...tomato, ...oil], RED));
  });
});

describe("with a canvas that reads its source at the call (the usual case) nothing changed", () => {
  it("a single sauce draws exactly what the display function builds", () => {
    install(false);
    render(<SauceHeatmapCanvas deposits={tomato} doughShape={shape} color={RED} />);
    const drawn = ctxs.get(visible()[0])!.drawn;
    expect(Array.from(drawn)).toEqual(Array.from(buildSauceDisplayPixels(tomato, shape, RED)));
  });
  it("two layers: each canvas holds its own pixels", () => {
    install(false);
    render(layered());
    const [c0, c1] = visible();
    expect(alphaMask(ctxs.get(c0)!.drawn)).toBe(expectedMask(tomato, RED));
    expect(alphaMask(ctxs.get(c1)!.drawn)).not.toBe(alphaMask(ctxs.get(c0)!.drawn));
  });
});

describe("staging surface memory: one per canvas, released on unmount", () => {
  it("one sauce: one staging surface; two layers: two; each 64x64 (16 KB of pixels + 16 KB ImageData)", () => {
    install(false);
    const one = render(<SauceHeatmapCanvas deposits={tomato} doughShape={shape} color={RED} />);
    expect(staging()).toHaveLength(1);
    expect(staging()[0].width).toBe(64);
    one.unmount();
    install(false);
    render(layered());
    expect(staging()).toHaveLength(2);
    expect(new Set(staging()).size).toBe(2);
  });
  it("a redraw reuses the canvas's staging surface (no new canvas per redraw)", () => {
    install(false);
    const view = render(<SauceHeatmapCanvas deposits={tomato} doughShape={shape} color={RED} />);
    for (let i = 0; i < 5; i++) view.rerender(<SauceHeatmapCanvas deposits={[...tomato, dep(40 + i, 50, "tomato-sauce")]} doughShape={shape} color={RED} />);
    expect(staging()).toHaveLength(1);
  });
  it("unmounting gives every staging canvas back (0x0)", () => {
    install(false);
    const view = render(layered());
    expect(staging().every((c) => c.width === 64)).toBe(true);
    view.unmount();
    expect(staging().every((c) => c.width === 0 && c.height === 0)).toBe(true);
  });
  it("createStagingSurface / releaseStagingSurface: refused context -> null; release is safe on null and idempotent", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(createStagingSurface()).toBeNull();
    vi.restoreAllMocks();
    install(false);
    const s = createStagingSurface()!;
    expect(s.canvas.width).toBe(64);
    releaseStagingSurface(s);
    releaseStagingSurface(s);
    releaseStagingSurface(null);
    expect(s.canvas.width).toBe(0);
  });
});
