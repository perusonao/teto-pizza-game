import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SAUCE_DISPLAY_GRID } from "../../logic/sauceDisplay";
import { SQUARE_PAN_GEOMETRY, SQUARE_PAN_HALF_SIDE, SQUARE_TARGET_HALF_SIDE } from "../../logic/pan/panGeometry";
import { cheesePoolReachPercent } from "../CheesePoolCanvas";
import {
  SQUARE_PAN_INSET_PERCENT,
  buildSquareSauceLayerPixels,
  squareCheesePoolClipPath,
  squareCheesePoolReach,
  squareCheeseReachBounds,
  squareTargetGuideRect,
} from "./squarePanStage";

// read from disk: vitest's CSS pipeline turns a `?raw` stylesheet into an empty string
const css = readFileSync(`${process.cwd()}/src/components/square/squarePanStage.css`, "utf8");
const G = SAUCE_DISPLAY_GRID;
const alphaAt = (px: Uint8ClampedArray, col: number, row: number) => px[(row * G + col) * 4 + 3];
const centre = (i: number) => ((i + 0.5) / G) * 100;
const dab = (x: number, y: number, amount = 0.5) => ({ x, y, amount });

/** a pixel is "off the pan" when its centre is outside the square (the mask feathers only the single pixel straddling the edge) */
const offPan = (col: number, row: number) =>
  Math.max(Math.abs(centre(col) - 50), Math.abs(centre(row) - 50)) > SQUARE_PAN_HALF_SIDE + 100 / G;

describe("pan inset / CSS", () => {
  it("the inset is the pan's margin in percent, and the CSS clip-path says the same", () => {
    expect(SQUARE_PAN_INSET_PERCENT).toBe(50 - SQUARE_PAN_HALF_SIDE);
    expect(css).toContain(`clip-path: inset(${SQUARE_PAN_INSET_PERCENT}%)`);
  });
  it("the stylesheet never sets a filter (the bake filter, #518, is not this file's) and has no round clip", () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/filter\s*:|circle\(|border-radius:\s*50%/);
  });
});

describe("bake overlays (D2-b1)", () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
  const bakeRules = rules.filter((r) => /pizza-bake-overlay|pizza-char-spots|pizza-perfect-glow/.test(r.selector));

  it("covers the overlay, the char spots and the perfect glow, and every selector is scoped to the square pan (a round pizza never matches)", () => {
    expect(bakeRules.length).toBeGreaterThanOrEqual(2);
    for (const rule of bakeRules) {
      for (const selector of rule.selector.split(",")) expect(selector.trim()).toMatch(/^\.pizza-dough--square-pan\s/);
    }
    const joined = bakeRules.map((r) => r.selector).join(",");
    for (const name of ["pizza-bake-overlay", "pizza-char-spots", "pizza-perfect-glow"]) expect(joined).toContain(name);
  });

  it("the overlay and char spots take the pan's box and its 6% inset (the CSS equals the geometry); the glow spills past it", () => {
    const overlay = bakeRules.find((r) => r.selector.includes(".pizza-char-spots"))!;
    expect(overlay.body).toContain(`clip-path: inset(${SQUARE_PAN_INSET_PERCENT}% round`);
    expect(overlay.body).toMatch(/inset:\s*calc\(-1 \* var\(--dough-border-width, 10px\)\)/);
    const glow = bakeRules.find((r) => r.selector.includes(".pizza-perfect-glow"))!;
    expect(glow.body).toMatch(/clip-path:\s*inset\((\d+(\.\d+)?)%/);
    expect(Number(/clip-path:\s*inset\((\d+(\.\d+)?)%/.exec(glow.body)![1])).toBeLessThan(SQUARE_PAN_INSET_PERCENT);
  });
});

describe("target guide", () => {
  it("is the square Reference region, centred", () => {
    const rect = squareTargetGuideRect();
    expect(rect.width).toBeCloseTo(2 * SQUARE_TARGET_HALF_SIDE);
    expect(rect.x + rect.width / 2).toBeCloseTo(50);
    expect(rect.y + rect.height / 2).toBeCloseTo(50);
    expect(SQUARE_PAN_GEOMETRY.targetArea.contains(rect.x + 0.01, rect.y + 0.01)).toBe(true);
    expect(SQUARE_PAN_GEOMETRY.targetArea.contains(rect.x - 0.5, rect.y - 0.5)).toBe(false);
  });
});

describe("square sauce pixels", () => {
  it("reach all four corners of the pan (a circle mask would clip them)", () => {
    const corners = [
      [8, 8],
      [92, 8],
      [92, 92],
      [8, 92],
    ];
    const px = buildSquareSauceLayerPixels(corners.map(([x, y]) => dab(x, y)), "#c73b2e");
    for (const [x, y] of corners) {
      const col = Math.floor((x / 100) * G);
      const row = Math.floor((y / 100) * G);
      expect(alphaAt(px, col, row), `corner ${x},${y}`).toBeGreaterThan(40);
      expect(Math.hypot(x - 50, y - 50)).toBeGreaterThan(48); // these corner pixels lie outside the round dough
    }
  });

  it("never draw outside the pan, whatever the deposits (swept over the whole box and past it)", () => {
    const deposits = [];
    for (let x = -10; x <= 110; x += 5) for (let y = -10; y <= 110; y += 5) deposits.push(dab(x, y, 0.4));
    const px = buildSquareSauceLayerPixels(deposits, "#c73b2e");
    let drawn = 0;
    for (let row = 0; row < G; row += 1) {
      for (let col = 0; col < G; col += 1) {
        const alpha = alphaAt(px, col, row);
        if (alpha > 0) drawn += 1;
        if (offPan(col, row)) expect(alpha, `pixel ${col},${row}`).toBe(0);
      }
    }
    expect(drawn).toBeGreaterThan(G * G * 0.5); // the on-pan area really is painted, so the test above is not vacuous
  });

  it("a heavy deposit on the pan's edge does not leak past it, and one off the pan draws nothing", () => {
    const edge = buildSquareSauceLayerPixels([dab(50, 6.2, 2)], "#c73b2e");
    for (let row = 0; row < G; row += 1) for (let col = 0; col < G; col += 1) if (offPan(col, row)) expect(alphaAt(edge, col, row)).toBe(0);
    expect(buildSquareSauceLayerPixels([dab(-5, 50, 2), dab(50, 120, 2)], "#c73b2e").every((v) => v === 0)).toBe(true);
  });

  it("is empty for no deposits, and ignores non-finite ones", () => {
    expect(buildSquareSauceLayerPixels([], "#c73b2e").every((v) => v === 0)).toBe(true);
    expect(buildSquareSauceLayerPixels([dab(Number.NaN, 50)], "#c73b2e").every((v) => v === 0)).toBe(true);
  });

  it("takes the layer colour, and dims only where it overlaps what is under it", () => {
    const top = [dab(30, 50, 0.4)];
    const plain = buildSquareSauceLayerPixels(top, "#112233");
    const i = (Math.floor(0.5 * G) * G + Math.floor(0.3 * G)) * 4;
    expect([plain[i], plain[i + 1], plain[i + 2]]).toEqual([0x11, 0x22, 0x33]);
    const over = buildSquareSauceLayerPixels(top, "#112233", { underDeposits: [dab(30, 50, 0.4)], ingredientId: "olive-oil" });
    expect(over[i + 3]).toBeLessThan(plain[i + 3]);
    const apart = buildSquareSauceLayerPixels(top, "#112233", { underDeposits: [dab(80, 50, 0.4)], ingredientId: "olive-oil" });
    expect(apart[i + 3]).toBe(plain[i + 3]);
  });
});

describe("cheese pool reach on the square pan", () => {
  it("uses the round pool's own reach (one definition)", () => {
    expect(squareCheesePoolReach).toBe(cheesePoolReachPercent);
  });
  it("a pool wholly on the pan is unclipped", () => {
    expect(squareCheesePoolClipPath(50, 50, 12)).toBe("inset(0% 0% 0% 0%)");
    expect(squareCheeseReachBounds(50, 50, 12)).toEqual({ minX: 38, minY: 38, maxX: 62, maxY: 62 });
  });
  it("a pool in a corner is clipped to the pan edge on the two sides that overhang (10 of its 24 across), and still reaches the corner", () => {
    const reach = 12;
    const bounds = squareCheeseReachBounds(8, 8, reach);
    expect(bounds).toEqual({ minX: 6, minY: 6, maxX: 20, maxY: 20 });
    expect(squareCheesePoolClipPath(8, 8, reach)).toBe("inset(41.667% 0% 0% 41.667%)");
    expect(squareCheesePoolClipPath(92, 92, reach)).toBe("inset(0% 41.667% 41.667% 0%)");
  });
  it("a pool wholly off the pan, or bad input, has no clip", () => {
    expect(squareCheesePoolClipPath(-30, 50, 12)).toBeNull();
    expect(squareCheesePoolClipPath(Number.NaN, 50, 12)).toBeNull();
    expect(squareCheesePoolClipPath(50, 50, 0)).toBeNull();
  });
});
