import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createInitialSquareDough, isSquareCellOnPan, squareCellIndex, type SquareDough } from "../logic/pan/squareDough";
import { dragAlong } from "../logic/pan/squareDoughDrag";
import { squareDoughGaugeStore } from "../logic/pan/squareDoughGaugeStore";
import { CORNER_MARKS } from "../logic/pan/squareDoughView";
import { SquareDoughLayer } from "./SquareDoughLayer";

afterEach(() => {
  cleanup();
  squareDoughGaugeStore.reset();
});

const pulls = (n: number): SquareDough => CORNER_MARKS.slice(0, n).reduce((d, m) => dragAlong(d, { x: 50, y: 50 }, m), createInitialSquareDough());
const mount = (dough: SquareDough) => render(<SquareDoughLayer dough={dough} interactive onCommit={() => undefined} ramp="ball" />);

describe("SquareDoughLayer: the gap guide and the corner ticks (AB-min)", () => {
  it("4/4 corners with STEP 1 open: the gap guide is drawn (tint + at most 3 arrows) and every corner tick is the OUTLINED 'reached' look, not the solid done look", () => {
    mount(pulls(4));
    const guide = screen.getByTestId("square-gap-guide");
    expect(Number(guide.getAttribute("data-bare"))).toBeGreaterThan(0);
    expect(Number(guide.getAttribute("data-gaps"))).toBeGreaterThanOrEqual(1);
    expect(Number(guide.getAttribute("data-gaps"))).toBeLessThanOrEqual(3);
    expect(screen.getByTestId("square-gap-tint").children).toHaveLength(Number(guide.getAttribute("data-bare")));
    const marks = [...screen.getByTestId("square-corner-marks").children];
    expect(marks).toHaveLength(4);
    for (const mark of marks) {
      expect(mark).toHaveAttribute("data-reached", "true");
      expect(mark).toHaveAttribute("data-pending", "true");
      expect(mark.getAttribute("class")).toContain("square-dough-layer__corner--reached-pending");
      expect(mark.getAttribute("class")).not.toMatch(/corner--reached(?!-)/);
    }
    // the corner arrows are gone (all reached) and the SAUCE guide is not involved
    expect(screen.queryByTestId("square-drag-hints")).toBeNull();
    expect(document.querySelector(".square-target-guide")).toBeNull();
  });

  it("fewer than four corners: no gap guide, the corner arrows still point at the unreached corners", () => {
    mount(pulls(2));
    expect(screen.queryByTestId("square-gap-guide")).toBeNull();
    expect(screen.getByTestId("square-drag-hints").children).toHaveLength(2);
  });

  it("STEP 2 (a full sheet): no gap guide, and the corner ticks are the solid done look", () => {
    const thickness = new Array<number>(256).fill(0);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) if (isSquareCellOnPan(r, c)) thickness[squareCellIndex(r, c)] = 0.3;
    mount({ thickness });
    expect(screen.queryByTestId("square-gap-guide")).toBeNull();
    for (const mark of screen.getByTestId("square-corner-marks").children) {
      expect(mark).toHaveAttribute("data-pending", "false");
      expect(mark.getAttribute("class")).toContain("square-dough-layer__corner--reached");
      expect(mark.getAttribute("class")).not.toContain("reached-pending");
    }
  });
});
