import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createIdealDoughShape } from "../logic/doughShape";
import { alphaPlaneOf, bakeOilHex, buildSauceDisplayPixels, compositeOver, dimWhereOverlapping } from "../logic/sauceDisplay";
import type { SauceDeposit } from "../state/pizzaState";
import type { SauceLayer } from "../state/sauceLayers";
import { resetCanvas2dProbe } from "./CheesePoolCanvas";
import { SauceDotsFallback, SauceLayersBoundary } from "./SauceCanvasFallback";
import { SauceHeatmapCanvas } from "./SauceHeatmapCanvas";
import { SauceMergedHeatmapCanvas, SauceMergedOverflowCanvas } from "./SauceMergedCanvas";
import { OverflowMarkerCanvas } from "./OverflowMarkerCanvas";

/**
 * Codex P2 on PR #494, canvas failure: a refused 2D context or a throwing draw must neither leave a sauce layer invisible (the gauge
 * would drain while nothing shows) nor unmount the app. jsdom has no canvas, so the 2D context is stubbed: the probe canvas (300 wide)
 * and the 64x64 staging surface get a working fake; the 200x200 sauce canvases get null or a throwing drawImage, like a browser that has
 * run out of canvas memory.
 */
const shape = createIdealDoughShape();
const dep = (x: number, y = 50) => ({ x, y, amount: 0.02 });

const staged: Uint8ClampedArray[] = [];
const fills: string[] = [];
const fake = {
  ctx: {
    clearRect() {},
    save() {},
    restore() {},
    beginPath() {},
    arc() {},
    fillStyle: "" as string,
    fill() {
      fills.push(String(fake.ctx.fillStyle));
    },
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData(image: { data: Uint8ClampedArray }) {
      staged.push(new Uint8ClampedArray(image.data));
    },
    drawImage() {
      if (fake.fail === "draw") throw new Error("simulated drawImage failure");
    },
  } as unknown as CanvasRenderingContext2D,
  fail: "none" as "none" | "null" | "draw",
};

function stubContext(mode: "none" | "null" | "draw" | "no-2d") {
  fake.fail = mode === "no-2d" ? "none" : mode;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    if (mode === "no-2d") return null; // a platform without 2D at all (the probe fails too)
    if (this.width === 200 && mode === "null") return null; // the sauce canvases are refused, the probe and the staging surface are not
    return fake.ctx as never;
  } as never);
}

beforeEach(() => {
  staged.length = 0;
  fills.length = 0;
  resetCanvas2dProbe();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCanvas2dProbe();
});

describe("SauceHeatmapCanvas / OverflowMarkerCanvas failure handling", () => {
  it("healthy: a canvas, no fallback", () => {
    stubContext("none");
    const { container } = render(<SauceHeatmapCanvas deposits={[dep(40), dep(50)]} doughShape={shape} color="#c8412b" className="h" />);
    expect(container.querySelector("canvas")).toBeInTheDocument();
    expect(container.querySelector("[data-sauce-fallback]")).toBeNull();
  });

  it("a refused 2D context shows the deposits as dots (the sauce that was spent stays visible)", () => {
    stubContext("null");
    const { container } = render(<SauceHeatmapCanvas deposits={[dep(40), dep(50), dep(60)]} doughShape={shape} color="#c8412b" className="h" />);
    const fallback = container.querySelector("[data-sauce-fallback]");
    expect(fallback).toBeInTheDocument();
    expect(fallback!.className).toBe("h"); // same box, blur and bake tint as the canvas
    expect(fallback!.children).toHaveLength(3);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("a drawImage that throws does not escape the component and shows the dots too", () => {
    stubContext("draw");
    expect(() => render(<SauceHeatmapCanvas deposits={[dep(40), dep(50)]} doughShape={shape} color="#c8412b" />)).not.toThrow();
    expect(document.querySelector("[data-sauce-fallback]")).toBeInTheDocument();
  });

  it("a platform without any 2D support draws nothing, exactly as before (no fallback, the canvas stays)", () => {
    stubContext("no-2d");
    const { container } = render(<SauceHeatmapCanvas deposits={[dep(40)]} doughShape={shape} color="#c8412b" />);
    expect(container.querySelector("canvas")).toBeInTheDocument();
    expect(container.querySelector("[data-sauce-fallback]")).toBeNull();
  });

  it("nothing to draw is not a failure", () => {
    stubContext("null");
    const { container } = render(<SauceHeatmapCanvas deposits={[]} doughShape={shape} color="#c8412b" />);
    expect(container.querySelector("[data-sauce-fallback]")).toBeNull();
  });

  it("the overflow markers of a failed canvas are left out and nothing throws", () => {
    stubContext("null");
    const { container } = render(<OverflowMarkerCanvas deposits={[dep(2, 2)]} doughShape={shape} color="#c8412b" />);
    expect(container.querySelector("canvas")).toBeNull();
    stubContext("draw");
  });
});

describe("merged sauce canvases", () => {
  const run = (kind: string, xs: number[], under: readonly SauceDeposit[]): SauceLayer => ({
    ingredientId: kind,
    deposits: xs.map((x) => ({ ...dep(x), ingredientId: kind })),
    under: [...under],
  });
  const colorOf = (id: string) => (id === "pesto" ? "#6b8f3a" : "#c8412b");

  it("a refused context shows every run's deposits as dots; a throwing draw does not escape", () => {
    const runs = [run("tomato-sauce", [30, 40], []), run("pesto", [35], [dep(30), dep(40)])];
    stubContext("null");
    const first = render(<SauceMergedHeatmapCanvas runs={runs} doughShape={shape} colorOf={colorOf} className="m" />);
    expect(first.container.querySelector("[data-sauce-fallback]")!.children).toHaveLength(3);
    first.unmount();
    stubContext("draw");
    expect(() => render(<SauceMergedHeatmapCanvas runs={runs} doughShape={shape} colorOf={colorOf} />)).not.toThrow();
    expect(document.querySelector("[data-sauce-fallback]")).toBeInTheDocument();
  });

  it("the flattened raster is the runs' own rasters (own colour, own overlap dimming) stacked in order", () => {
    stubContext("none");
    const a = run("tomato-sauce", [30, 40, 50], []);
    const b = run("pesto", [35, 45], a.deposits);
    render(<SauceMergedHeatmapCanvas runs={[a, b]} doughShape={shape} colorOf={colorOf} />);
    const expected = new Uint8ClampedArray(64 * 64 * 4);
    compositeOver(expected, buildSauceDisplayPixels(a.deposits, shape, colorOf("tomato-sauce")));
    const second = buildSauceDisplayPixels(b.deposits, shape, colorOf("pesto"));
    dimWhereOverlapping(second, alphaPlaneOf(buildSauceDisplayPixels(b.under, shape, "#000000")));
    compositeOver(expected, second);
    expect([...staged[staged.length - 1]]).toEqual([...expected]);
  });

  it("a group that grew at its end stacks only the new run on what it had (same result as from scratch)", () => {
    stubContext("none");
    const a = run("tomato-sauce", [30, 40], []);
    const b = run("pesto", [35], a.deposits);
    const c = run("tomato-sauce", [45], [...a.deposits, ...b.deposits]);
    const { rerender } = render(<SauceMergedHeatmapCanvas runs={[a, b]} doughShape={shape} colorOf={colorOf} />);
    rerender(<SauceMergedHeatmapCanvas runs={[a, b, c]} doughShape={shape} colorOf={colorOf} />);
    const grown = staged[staged.length - 1];
    cleanup();
    staged.length = 0;
    render(<SauceMergedHeatmapCanvas runs={[a, b, c]} doughShape={shape} colorOf={colorOf} />);
    expect([...grown]).toEqual([...staged[staged.length - 1]]);
  });

  it("a group that turns from oil-only to mixed rebuilds its oil runs with the oil look baked in (Codex P2 follow-up)", () => {
    stubContext("none");
    const oil = run("olive-oil", [30, 40], []);
    const tomato = run("tomato-sauce", [60], oil.deposits);
    const { rerender } = render(<SauceMergedHeatmapCanvas runs={[oil]} doughShape={shape} colorOf={colorOf} />);
    rerender(<SauceMergedHeatmapCanvas runs={[oil, tomato]} doughShape={shape} colorOf={colorOf} bakedOil />);
    const grown = staged[staged.length - 1];
    cleanup();
    staged.length = 0;
    render(<SauceMergedHeatmapCanvas runs={[oil, tomato]} doughShape={shape} colorOf={colorOf} bakedOil />);
    expect([...grown]).toEqual([...staged[staged.length - 1]]);
    // and it really is the baked oil, not the plain oil raster
    cleanup();
    staged.length = 0;
    render(<SauceMergedHeatmapCanvas runs={[oil]} doughShape={shape} colorOf={colorOf} />);
    const plainOil = staged[staged.length - 1];
    cleanup();
    staged.length = 0;
    render(<SauceMergedHeatmapCanvas runs={[oil]} doughShape={shape} colorOf={colorOf} bakedOil />);
    expect([...staged[staged.length - 1]]).not.toEqual([...plainOil]);
  });

  describe("overflow markers of a mixed oil group (Codex P2)", () => {
    const OIL = "#e9d9a0";
    const colors = (id: string) => (id === "olive-oil" ? OIL : id === "pesto" ? "#6b8f3a" : "#c8412b");
    // a deposit well outside the dough, so every run leaves exactly one marker
    const outside = (kind: string, under: SauceDeposit[] = []): SauceLayer => ({ ingredientId: kind, deposits: [{ x: 2, y: 2, amount: 0.02, ingredientId: kind }], under });

    it("the oil look is a real change of colour (the pale swatch gets deeper), and the same transform the heatmap bakes", () => {
      const baked = bakeOilHex(OIL);
      expect(baked).not.toBe(OIL);
      const sum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
      expect(sum(baked)).toBeLessThan(sum(OIL));
    });

    it("a mixed group draws its oil markers in the baked colour and the other sauce's markers unchanged", () => {
      stubContext("none");
      render(<SauceMergedOverflowCanvas runs={[outside("olive-oil"), outside("pesto")]} doughShape={shape} colorOf={colors} bakedOil />);
      expect(fills).toEqual([bakeOilHex(OIL), "#6b8f3a"]);
    });

    it("an oil-only group (it keeps the oil CSS filter) and a group without oil keep the raw colours", () => {
      stubContext("none");
      render(<SauceMergedOverflowCanvas runs={[outside("olive-oil"), outside("olive-oil")]} doughShape={shape} colorOf={colors} />);
      expect(fills).toEqual([OIL, OIL]);
      fills.length = 0;
      cleanup();
      render(<SauceMergedOverflowCanvas runs={[outside("pesto"), outside("tomato-sauce")]} doughShape={shape} colorOf={colors} />);
      expect(fills).toEqual(["#6b8f3a", "#c8412b"]);
    });

    it("when an oil-only group turns mixed its markers are redrawn in the baked colour (no stale raw dots)", () => {
      stubContext("none");
      const oil = outside("olive-oil");
      const { rerender } = render(<SauceMergedOverflowCanvas runs={[oil]} doughShape={shape} colorOf={colors} />);
      expect(fills).toEqual([OIL]);
      fills.length = 0;
      // the group gains a run and flips to mixed in the same step
      rerender(<SauceMergedOverflowCanvas runs={[oil, outside("pesto", oil.deposits.slice())]} doughShape={shape} colorOf={colors} bakedOil />);
      expect(fills).toEqual([bakeOilHex(OIL), "#6b8f3a"]);
      // ...and a flip with the SAME runs (the group's last run unchanged) redraws too
      fills.length = 0;
      const runs = [oil, outside("pesto")];
      const second = render(<SauceMergedOverflowCanvas runs={runs} doughShape={shape} colorOf={colors} />);
      fills.length = 0;
      second.rerender(<SauceMergedOverflowCanvas runs={runs} doughShape={shape} colorOf={colors} bakedOil />);
      expect(fills).toEqual([bakeOilHex(OIL), "#6b8f3a"]);
    });
  });

  it("the merged overflow canvas is dropped when it fails", () => {
    stubContext("null");
    const outside: SauceLayer = { ingredientId: "pesto", deposits: [{ x: 2, y: 2, amount: 0.02, ingredientId: "pesto" }], under: [] };
    const { container } = render(<SauceMergedOverflowCanvas runs={[outside]} doughShape={shape} colorOf={colorOf} />);
    expect(container.querySelector("canvas")).toBeNull();
  });
});

describe("SauceLayersBoundary", () => {
  it("shows the fallback instead of unmounting the app when a layer throws while rendering", () => {
    const Boom = () => {
      throw new Error("layer exploded");
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <div>
        <SauceLayersBoundary fallback={<SauceDotsFallback runs={[{ deposits: [dep(50)], color: "#c8412b" }]} />}>
          <Boom />
        </SauceLayersBoundary>
        <p>the rest of the app</p>
      </div>,
    );
    quiet.mockRestore();
    expect(container.querySelector("[data-sauce-fallback]")).toBeInTheDocument();
    expect(container).toHaveTextContent("the rest of the app");
  });

  it("adds no DOM of its own while healthy", () => {
    const { container } = render(
      <SauceLayersBoundary fallback={null}>
        <i data-x="1" />
      </SauceLayersBoundary>,
    );
    expect(container.innerHTML).toBe('<i data-x="1"></i>');
  });
});
