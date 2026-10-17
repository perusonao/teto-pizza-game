import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createIdealDoughShape } from "../logic/doughShape";
import { alphaPlaneOf, bakeOilHex, buildSauceDisplayPixels, compositeOver, dimWhereOverlapping, SAUCE_OIL_OVERLAP_ALPHA_FACTOR } from "../logic/sauceDisplay";
import type { SauceDeposit } from "../state/pizzaState";
import type { SauceLayer } from "../state/sauceLayers";
import { resetCanvas2dProbe } from "./CheesePoolCanvas";
import { SauceDotsFallback, SauceLayersBoundary } from "./SauceCanvasFallback";
import { overlapFallbackOf, platformSupports2d, resetStagingSurface } from "./sauceCanvasSupport";
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

function stubContext(mode: "none" | "null" | "draw" | "no-2d" | "exhausted" | "no-staging") {
  fake.fail = mode === "draw" ? "draw" : "none";
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    if (mode === "no-2d") return null; // a platform without 2D at all (the probe fails too)
    if (mode === "exhausted") return null; // canvas memory is gone: EVERY new canvas is refused, a fresh probe canvas included
    if (mode === "no-staging" && this.width === 64) return null; // only the 64x64 staging surface is refused
    if (this.width === 200 && mode === "null") return null; // the sauce canvases are refused, the probe and the staging surface are not
    return fake.ctx as never;
  } as never);
}

beforeEach(() => {
  staged.length = 0;
  fills.length = 0;
  resetCanvas2dProbe();
  resetStagingSurface();
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

describe("canvas support is probed before the sauce canvases exist (Codex P2: probe before handling allocation failure)", () => {
  const deposits = [dep(40), dep(50), dep(60)];
  const run = (kind: string): SauceLayer => ({ ingredientId: kind, deposits: deposits.map((d) => ({ ...d, ingredientId: kind })), under: [] });
  const colorOf = () => "#c8412b";

  it("support known from the startup probe, then EVERY canvas refused (a fresh probe would fail too): heatmap, merged and overflow all handle it", () => {
    stubContext("none");
    expect(platformSupports2d()).toBe(true); // the startup probe, while canvases still work
    stubContext("exhausted");
    expect(platformSupports2d()).toBe(true); // cached: the exhaustion does not turn into "no 2D support"
    const heat = render(<SauceHeatmapCanvas deposits={deposits} doughShape={shape} color="#c8412b" className="h" />);
    expect(heat.container.querySelector("[data-sauce-fallback]")!.children).toHaveLength(3); // dots, not a blank layer
    expect(heat.container.querySelector("canvas")).toBeNull();
    heat.unmount();
    const merged = render(<SauceMergedHeatmapCanvas runs={[run("tomato-sauce"), run("pesto")]} doughShape={shape} colorOf={colorOf} className="m" />);
    expect(merged.container.querySelector("[data-sauce-fallback]")!.children).toHaveLength(6);
    merged.unmount();
    const overflow = render(<SauceMergedOverflowCanvas runs={[{ ingredientId: "pesto", deposits: [{ x: 2, y: 2, amount: 0.02 }], under: [] }]} doughShape={shape} colorOf={colorOf} />);
    expect(overflow.container.querySelector("canvas")).toBeNull();
    expect(overflow.container.querySelector("[data-sauce-fallback]")!.children).toHaveLength(1); // the off-dough marker stays, as a dot
    overflow.unmount();
    const single = render(<OverflowMarkerCanvas deposits={[dep(2, 2)]} doughShape={shape} color="#c8412b" />);
    expect(single.container.querySelector("canvas")).toBeNull();
  });

  it("the probe runs when the support module is first loaded, not at the first refusal", async () => {
    vi.resetModules();
    stubContext("none");
    const fresh = await import("./sauceCanvasSupport"); // loading it probes, while canvases work
    stubContext("exhausted");
    expect(fresh.platformSupports2d()).toBe(true);
  });

  it("the very first sauce canvas refused (support known): shown as dots", () => {
    stubContext("null"); // the probe canvas works, the 200x200 sauce canvases are refused from the start
    expect(platformSupports2d()).toBe(true);
    const { container } = render(<SauceHeatmapCanvas deposits={deposits} doughShape={shape} color="#c8412b" />);
    expect(container.querySelector("[data-sauce-fallback]")!.children).toHaveLength(3);
  });

  it("the 64x64 staging surface refused after the sauce canvas got its context: heatmap and merged show dots, not a blank layer", () => {
    stubContext("no-staging");
    expect(platformSupports2d()).toBe(true);
    const heat = render(<SauceHeatmapCanvas deposits={deposits} doughShape={shape} color="#c8412b" />);
    expect(heat.container.querySelector("[data-sauce-fallback]")).toBeInTheDocument();
    heat.unmount();
    resetStagingSurface();
    const merged = render(<SauceMergedHeatmapCanvas runs={[run("tomato-sauce")]} doughShape={shape} colorOf={colorOf} />);
    expect(merged.container.querySelector("[data-sauce-fallback]")).toBeInTheDocument();
  });

  it("no 2D support at the startup probe: every sauce canvas keeps the old behaviour (draws nothing, no fallback, canvas stays)", () => {
    stubContext("no-2d");
    expect(platformSupports2d()).toBe(false);
    const heat = render(<SauceHeatmapCanvas deposits={deposits} doughShape={shape} color="#c8412b" />);
    expect(heat.container.querySelector("canvas")).toBeInTheDocument();
    expect(heat.container.querySelector("[data-sauce-fallback]")).toBeNull();
    const merged = render(<SauceMergedHeatmapCanvas runs={[run("tomato-sauce")]} doughShape={shape} colorOf={colorOf} />);
    expect(merged.container.querySelector("canvas")).toBeInTheDocument();
    expect(merged.container.querySelector("[data-sauce-fallback]")).toBeNull();
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

  describe("heatmap fallback dots of an oil group (#502)", () => {
    const OIL = "#e9d9a0";
    const colors = (id: string) => (id === "olive-oil" ? OIL : id === "pesto" ? "#6b8f3a" : "#c8412b");
    const rgbOf = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
    const dotStyles = (container: HTMLElement) => [...container.querySelectorAll("[data-sauce-fallback] > span")].map((d) => (d as HTMLElement).getAttribute("style") ?? "");

    it("a mixed (oil + other sauce) group whose canvas fails draws its oil dots in the baked colour, the other sauce's unchanged", () => {
      stubContext("null");
      const oil = run("olive-oil", [30], []);
      const pesto = run("pesto", [60], oil.deposits);
      const { container } = render(<SauceMergedHeatmapCanvas runs={[oil, pesto]} doughShape={shape} colorOf={colors} bakedOil className="m" />);
      const [oilDot, pestoDot] = dotStyles(container);
      expect(oilDot).toContain(rgbOf(bakeOilHex(OIL)));
      expect(oilDot).not.toContain(rgbOf(OIL));
      expect(pestoDot).toContain(rgbOf("#6b8f3a"));
    });

    it("an oil-only group (it keeps the oil CSS filter) and a group without oil keep the raw colours", () => {
      stubContext("null");
      const oil = run("olive-oil", [30], []);
      const oilOnly = render(<SauceMergedHeatmapCanvas runs={[oil]} doughShape={shape} colorOf={colors} className="m" />);
      expect(dotStyles(oilOnly.container)[0]).toContain(rgbOf(OIL));
      oilOnly.unmount();
      const noOil = render(<SauceMergedHeatmapCanvas runs={[run("pesto", [30], [])]} doughShape={shape} colorOf={colors} bakedOil className="m" />);
      expect(dotStyles(noOil.container)[0]).toContain(rgbOf("#6b8f3a"));
    });
  });

  describe("oil over another sauce keeps its overlap dimming in the dot fallback (#519, Codex P2 on PR #524)", () => {
    const opacities = (container: HTMLElement) => [...container.querySelectorAll("[data-sauce-fallback] > span")].map((d) => parseFloat((d as HTMLElement).style.opacity));
    const OIL_DOT = 0.5 * SAUCE_OIL_OVERLAP_ALPHA_FACTOR;
    const colors = (id: string) => (id === "olive-oil" ? "#e9d9a0" : "#c8412b");
    const under = [{ ...dep(30), ingredientId: "tomato-sauce" }];

    it("only an olive-oil run that has something under it is dimmed, and only where it lies over it", () => {
      expect(overlapFallbackOf("olive-oil", under)).toEqual({ under, factor: SAUCE_OIL_OVERLAP_ALPHA_FACTOR });
      expect(overlapFallbackOf("olive-oil", [])).toBeUndefined(); // the bottom layer
      expect(overlapFallbackOf("olive-oil", undefined)).toBeUndefined();
      for (const kind of ["tomato-sauce", "pesto", undefined]) expect(overlapFallbackOf(kind, under)).toBeUndefined(); // the generic look is unchanged
    });

    it("a refused context on the oil heatmap: dots over the tomato are dimmed, the rest keep the plain 0.5", () => {
      stubContext("null");
      const { container } = render(
        <SauceHeatmapCanvas deposits={[dep(32), dep(70)]} underDeposits={under} ingredientId="olive-oil" doughShape={shape} color="#e9d9a0" className="h" />,
      );
      expect(opacities(container)).toEqual([OIL_DOT, 0.5]);
    });

    it("the same oil heatmap with nothing under it, or any other sauce over the tomato: every dot stays 0.5 (one-sauce pizzas are untouched)", () => {
      stubContext("null");
      const alone = render(<SauceHeatmapCanvas deposits={[dep(32)]} ingredientId="olive-oil" doughShape={shape} color="#e9d9a0" className="h" />);
      expect(opacities(alone.container)).toEqual([0.5]);
      alone.unmount();
      const pesto = render(<SauceHeatmapCanvas deposits={[dep(32)]} underDeposits={under} ingredientId="pesto" doughShape={shape} color="#6b8f3a" className="h" />);
      expect(opacities(pesto.container)).toEqual([0.5]);
    });

    it("a failed merged group: an oil run over an earlier run is dimmed where it overlaps it; the earlier run and non-overlapping dots are not", () => {
      stubContext("null");
      const tomato: SauceLayer = { ingredientId: "tomato-sauce", deposits: [{ ...dep(30), ingredientId: "tomato-sauce" }], under: [] };
      const oil: SauceLayer = { ingredientId: "olive-oil", deposits: [{ ...dep(32), ingredientId: "olive-oil" }, { ...dep(70), ingredientId: "olive-oil" }], under: tomato.deposits };
      const { container } = render(<SauceMergedHeatmapCanvas runs={[tomato, oil]} doughShape={shape} colorOf={colors} className="m" />);
      expect(opacities(container)).toEqual([0.5, OIL_DOT, 0.5]);
    });
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

  it("a failed merged overflow canvas keeps its off-dough markers as dots (only those; in-dough deposits are the heatmap's)", () => {
    stubContext("null");
    const outside: SauceLayer = {
      ingredientId: "pesto",
      deposits: [
        { x: 2, y: 2, amount: 0.02, ingredientId: "pesto" },
        { x: 50, y: 50, amount: 0.02, ingredientId: "pesto" },
      ],
      under: [],
    };
    const { container } = render(<SauceMergedOverflowCanvas runs={[outside]} doughShape={shape} colorOf={colorOf} />);
    expect(container.querySelector("canvas")).toBeNull();
    const dots = container.querySelector("[data-sauce-fallback]")!.children;
    expect(dots).toHaveLength(1);
    // marker look of the healthy canvas: small (3%) and 0.55 x the missed fraction (fully outside here), not a 16% / 0.5 deposit dot
    const dot = dots[0] as HTMLElement;
    expect(dot.style.width).toBe("3%");
    expect(Number(dot.style.opacity)).toBeCloseTo(0.55, 2);
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
