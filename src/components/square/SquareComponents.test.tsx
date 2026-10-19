import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { resetCanvas2dProbe } from "../CheesePoolCanvas";
import { SAUCE_DISPLAY_GRID } from "../../logic/sauceDisplay";
import { SquareSauceCanvas } from "./SquareSauceCanvas";
import { SquareTargetGuide } from "./SquareTargetGuide";
import { SquareThumbnailBase } from "./SquareThumbnailBase";
import { buildSquareSauceLayerPixels } from "./squarePanStage";

/** jsdom has no canvas: the 2D context is stubbed like SauceCanvasFallback.test.tsx does, so what the component stages can be read back. */
const staged: Uint8ClampedArray[] = [];
const ctx = {
  clearRect() {},
  save() {},
  restore() {},
  beginPath() {},
  arc() {},
  fill() {},
  createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  putImageData(image: { data: Uint8ClampedArray }) {
    staged.push(new Uint8ClampedArray(image.data));
  },
  drawImage() {},
} as unknown as CanvasRenderingContext2D;

function stub(mode: "ok" | "refused") {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    if (mode === "refused" && this.width === 200) return null; // the sauce canvas is refused, the probe and the staging surface are not
    return ctx as never;
  } as never);
}

const corners = [8, 92].flatMap((x) => [8, 92].map((y) => ({ x, y, amount: 0.5 })));

beforeEach(() => {
  staged.length = 0;
  resetCanvas2dProbe();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetCanvas2dProbe();
});

describe("SquareSauceCanvas", () => {
  it("stages exactly the square raster (corners reached, nothing off the pan) on a 200x200 square-class canvas", () => {
    stub("ok");
    const { container } = render(<SquareSauceCanvas deposits={corners} color="#c73b2e" className="extra" />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveClass("square-sauce-canvas", "extra");
    expect([canvas?.width, canvas?.height]).toEqual([200, 200]);
    expect(staged).toHaveLength(1);
    expect(Array.from(staged[0])).toEqual(Array.from(buildSquareSauceLayerPixels(corners, "#c73b2e")));
    const G = SAUCE_DISPLAY_GRID;
    expect(staged[0][(Math.floor(0.08 * G) * G + Math.floor(0.08 * G)) * 4 + 3]).toBeGreaterThan(40);
  });

  it("draws nothing for no deposits", () => {
    stub("ok");
    render(<SquareSauceCanvas deposits={[]} color="#c73b2e" />);
    expect(staged).toHaveLength(0);
  });

  it("falls back to dots, in the square class (so it is clipped to the pan), when the canvas is refused", () => {
    stub("refused");
    const { container } = render(<SquareSauceCanvas deposits={corners} color="#c73b2e" />);
    const fallback = container.querySelector('[data-sauce-fallback="true"]');
    expect(fallback).toHaveClass("square-sauce-canvas");
    expect(fallback?.children).toHaveLength(corners.length);
    expect(container.querySelector("canvas")).toBeNull();
  });
});

describe("SquareTargetGuide / SquareThumbnailBase", () => {
  it("the guide is a rect (no circle) in the 0-100 box", () => {
    const { container } = render(<SquareTargetGuide />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 100 100");
    expect(container.querySelector("rect")).not.toBeNull();
    expect(container.querySelector("circle")).toBeNull();
  });
  it("the thumbnail base frames its children and takes the sauce colour", () => {
    const { container } = render(
      <SquareThumbnailBase color="#c73b2e">
        <span data-testid="piece" />
      </SquareThumbnailBase>,
    );
    expect(container.querySelector(".square-thumbnail")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".square-thumbnail__base")).toHaveStyle({ backgroundColor: "#c73b2e" });
    expect(container.querySelector(".square-thumbnail > [data-testid='piece']")).not.toBeNull();
  });
});
