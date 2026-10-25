import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clampToDough, clientPointToDoughPercent, DOUGH_CENTER, DOUGH_RADIUS, isInsideDough } from "../pizzaCoordinates";
import { OVAL_DOUGH_ASPECT, doughOutlineOf } from "./doughOutline";

const PINSA = "material-multigrain-long-ferment";

describe("doughOutlineOf", () => {
  it("is round for every pizza that does not use the Pinsa dough: nothing set, standard, unknown, null, undefined", () => {
    for (const pizza of [{}, { dough: "standard" }, { dough: "pinsa" }, { dough: 3 }, null, undefined]) expect(doughOutlineOf(pizza), JSON.stringify(pizza)).toBe("round");
    expect(doughOutlineOf({}, { doughKind: "standard" })).toBe("round");
    expect(doughOutlineOf({}, {})).toBe("round");
  });
  it("is oval for the Pinsa dough: chosen on the pizza (Free Cooking / Research chip) or fixed by the recipe (Guided)", () => {
    expect(doughOutlineOf({ dough: PINSA })).toBe("oval");
    expect(doughOutlineOf({}, { doughKind: PINSA })).toBe("oval");
    expect(doughOutlineOf(undefined, { doughKind: PINSA })).toBe("oval");
  });
  it("the pizza's own dough wins over the recipe's (a standard choice on a Pinsa recipe is not offered, but the rule is explicit)", () => {
    expect(doughOutlineOf({ dough: "standard" }, { doughKind: PINSA })).toBe("round");
    expect(doughOutlineOf({ dough: PINSA }, { doughKind: "standard" })).toBe("oval");
  });
});

describe("the oval is the circular dough-percent space drawn in a wider-than-tall box", () => {
  const W = 300;
  const H = W / OVAL_DOUGH_ASPECT;
  const rect = { left: 20, top: 100, width: W, height: H } as DOMRect;
  /** The point of the on-screen ellipse (semi-axes DOUGH_RADIUS% of W and of H) at angle `t`, scaled by `k`. */
  const onScreen = (t: number, k: number) => ({
    clientX: rect.left + (DOUGH_CENTER / 100) * W + Math.cos(t) * k * (DOUGH_RADIUS / 100) * W,
    clientY: rect.top + (DOUGH_CENTER / 100) * H + Math.sin(t) * k * (DOUGH_RADIUS / 100) * H,
  });

  it("every point on the drawn ellipse's rim is on the logical rim, at every angle; a hair inside is placeable, a hair outside is not", () => {
    for (let i = 0; i < 360; i += 7) {
      const t = (i * Math.PI) / 180;
      const rim = clientPointToDoughPercent(onScreen(t, 1).clientX, onScreen(t, 1).clientY, rect);
      expect(Math.hypot(rim.x - DOUGH_CENTER, rim.y - DOUGH_CENTER), `angle ${i}`).toBeCloseTo(DOUGH_RADIUS, 9);
      const inside = clientPointToDoughPercent(onScreen(t, 0.98).clientX, onScreen(t, 0.98).clientY, rect);
      expect(isInsideDough(inside.x, inside.y), `inside ${i}`).toBe(true);
      const outside = clientPointToDoughPercent(onScreen(t, 1.03).clientX, onScreen(t, 1.03).clientY, rect);
      expect(isInsideDough(outside.x, outside.y), `outside ${i}`).toBe(false);
    }
  });

  it("the oval's own corners (the box corners) are outside the dough, and a drag past the rim clamps back onto the ellipse, not onto a circle", () => {
    for (const [cx, cy] of [[rect.left, rect.top], [rect.left + W, rect.top], [rect.left, rect.top + H], [rect.left + W, rect.top + H]]) {
      const p = clientPointToDoughPercent(cx, cy, rect);
      expect(isInsideDough(p.x, p.y)).toBe(false);
    }
    const past = clientPointToDoughPercent(onScreen(Math.PI / 2, 1.4).clientX, onScreen(Math.PI / 2, 1.4).clientY, rect);
    const clamped = clampToDough(past.x, past.y);
    const px = { x: rect.left + (clamped.x / 100) * W, y: rect.top + (clamped.y / 100) * H };
    const k = Math.hypot((px.x - rect.left - 0.5 * W) / ((DOUGH_RADIUS / 100) * W), (px.y - rect.top - 0.5 * H) / ((DOUGH_RADIUS / 100) * H));
    expect(k).toBeCloseTo(1, 6); // on the ellipse
  });

  it("the CSS repeats the aspect ratio exactly (App.css), so the constant and the style cannot drift apart", () => {
    // read from disk: vitest's CSS pipeline turns a `?raw` stylesheet into an empty string
    const css = readFileSync(`${process.cwd()}/src/App.css`, "utf8");
    expect(css).toMatch(new RegExp(`\\.pizza-dough--oval[^{]*\\{[^}]*aspect-ratio:\\s*3\\s*/\\s*2;`));
    expect(OVAL_DOUGH_ASPECT).toBe(1.5);
  });
});
