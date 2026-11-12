import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createInitialSquareDough, isSquareCellOnPan, squareCellIndex, type SquareDough } from "../logic/pan/squareDough";
import { dragAlong } from "../logic/pan/squareDoughDrag";
import { createLumpySquareDough } from "../logic/pan/squareDoughFixtures";
import { squareDoughGaugeStore } from "../logic/pan/squareDoughGaugeStore";
import { SquareDoughGauge } from "./SquareDoughGauge";
import { SquareDoughNext, SquareDoughSteps } from "./SquareDoughGuide";

afterEach(() => {
  cleanup();
  squareDoughGaugeStore.reset();
});

function renderAll(fallback: SquareDough) {
  return render(
    <>
      <SquareDoughSteps fallbackDough={fallback} />
      <SquareDoughGauge fallbackDough={fallback} />
      <SquareDoughNext fallbackDough={fallback} />
    </>,
  );
}

/** A sheet that covers the whole pan (so STEP 1 is done) but is one spike and a film: far from even. */
function spiky(): SquareDough {
  const thickness = new Array<number>(256).fill(0);
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) if (isSquareCellOnPan(r, c)) thickness[squareCellIndex(r, c)] = 0.06;
  thickness[squareCellIndex(8, 8)] = 1;
  return { thickness };
}

describe("STEP 1 「四隅まで伸ばす」 (the production start: a small ball)", () => {
  it("names both steps in the new order, the corner count, the coverage goal and what comes next", () => {
    renderAll(createInitialSquareDough());
    expect(screen.getByTestId("square-dough-step-1")).toHaveTextContent("STEP 1");
    expect(screen.getByTestId("square-dough-step-1")).toHaveTextContent("四隅まで伸ばす");
    expect(screen.getByTestId("square-dough-step-1")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("square-dough-step-1")).toHaveAttribute("data-state", "now");
    expect(screen.getByTestId("square-dough-step-2")).toHaveTextContent("STEP 2");
    expect(screen.getByTestId("square-dough-step-2")).toHaveTextContent("厚みを整える");
    expect(screen.getByTestId("square-dough-step-2")).toHaveAttribute("data-state", "next");
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("四隅 0/4");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "coverage");
    expect(screen.getByTestId("square-dough-gauge-goal")).toHaveTextContent("目標 95%");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-reached", "false");
    expect(screen.getByTestId("square-dough-next")).toHaveTextContent("つぎは「厚みを整える」");
  });

  it("the count and the coverage follow the real dough the layer pushes", () => {
    renderAll(createInitialSquareDough());
    let d = createInitialSquareDough();
    d = dragAlong(d, { x: 50, y: 50 }, { x: 91, y: 9 });
    act(() => squareDoughGaugeStore.setDough(d));
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("四隅 1/4");
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-corners", "1");
    expect(Number(screen.getByTestId("square-dough-gauge").getAttribute("data-coverage"))).toBeGreaterThan(0.16);
  });
});

describe("STEP 2 「厚みを整える」", () => {
  it("opens when STEP 1 is done: the first pill is ticked, the gauge is the smoothness with its 60% goal, 「次へ」 is not promised yet", () => {
    renderAll(spiky());
    expect(screen.getByTestId("square-dough-step-1")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("square-dough-step-1")).toHaveTextContent("✓");
    expect(screen.getByTestId("square-dough-step-2")).toHaveAttribute("data-state", "now");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "evenness");
    expect(screen.getByTestId("square-dough-gauge-goal")).toHaveTextContent("目標 60%");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-reached", "false");
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("盛り上がった濃いところを押して、平らにしよう");
    expect(screen.getByTestId("square-dough-next")).toHaveTextContent("平らになったら「次へ」が使えるよ");
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-complete", "false");
  });

  it("the Preview lumpy start opens at STEP 2 and is already complete (0.739 is above the 60% goal)", () => {
    renderAll(createLumpySquareDough());
    expect(screen.getByTestId("square-dough-step-2")).toHaveAttribute("data-state", "now");
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-complete", "true");
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("できあがり");
    expect(screen.getByTestId("square-dough-next")).toHaveTextContent("「次へ」を押すまで、まだ整えられるよ");
  });

  it("the words follow the dough both ways (re-editing is allowed until 「次へ」): complete -> not complete -> complete, never a latch, never back to STEP 1", () => {
    renderAll(createLumpySquareDough());
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-complete", "true");
    act(() => {
      squareDoughGaugeStore.setCommitted(spiky());
      squareDoughGaugeStore.setDough(spiky());
    });
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-complete", "false");
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "2");
    act(() => {
      squareDoughGaugeStore.setCommitted(createLumpySquareDough());
      squareDoughGaugeStore.setDough(createLumpySquareDough());
    });
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-complete", "true");
  });

  it("the gauge value printed is the number the judgement used", () => {
    renderAll(createLumpySquareDough());
    const printed = screen.getByTestId("square-dough-gauge-value").textContent!;
    expect(printed).toMatch(/^\d+\.\d%$/);
    expect(Number(printed.replace("%", ""))).toBeGreaterThanOrEqual(60);
  });
});

describe("the step is announced from the committed dough, never from a gesture still in flight (Codex P2)", () => {
  it("a live dough that already meets STEP 1 does not open STEP 2 until it is committed; a cancelled gesture goes back to the committed dough without any step change", () => {
    const committed = createInitialSquareDough();
    renderAll(committed);
    act(() => squareDoughGaugeStore.setCommitted(committed));
    // the finger is down and the working dough has reached STEP 1's bar
    act(() => squareDoughGaugeStore.setDough(spiky()));
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "1");
    expect(screen.getByTestId("square-dough-step-2")).toHaveAttribute("data-state", "next");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-step", "1");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "coverage");
    expect(Number(screen.getByTestId("square-dough-gauge").getAttribute("data-coverage"))).toBeGreaterThan(0.95); // live numbers follow the finger
    // cancelled: the live dough returns to the committed one; the step never changed
    act(() => squareDoughGaugeStore.setDough(committed));
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "1");
    // committed: now STEP 2 opens
    act(() => {
      squareDoughGaugeStore.setCommitted(spiky());
      squareDoughGaugeStore.setDough(spiky());
    });
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "2");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "evenness");
  });
});

describe("the change note belongs to the metric the gauge shows", () => {
  it("hides a coverage note while the gauge shows evenness (the gesture that crossed into STEP 2), and shows an evenness note", () => {
    const sheet = spiky(); // STEP 1 is done, so the gauge is on evenness
    render(<SquareDoughGauge fallbackDough={sheet} />);
    act(() => squareDoughGaugeStore.reportChange(7.1, "coverage"));
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "evenness");
    expect(screen.getByTestId("square-dough-gauge-note")).toHaveAttribute("data-change", "");
    act(() => squareDoughGaugeStore.reportChange(31.8, "evenness"));
    expect(screen.getByTestId("square-dough-gauge-note")).toHaveAttribute("data-change", "31.8");
  });
});

describe("AB-min: all four corners reached, STEP 1 still open (the Owner HV stuck state)", () => {
  const pulls = (corners: number) =>
    [{ x: 11, y: 11 }, { x: 89, y: 11 }, { x: 89, y: 89 }, { x: 11, y: 89 }]
      .slice(0, corners)
      .reduce((d, m) => dragAlong(d, { x: 50, y: 50 }, m), createInitialSquareDough());

  it("says 「すき間をうめよう」 with the real coverage on the same goal line, and the next line follows; the gauge and steps are unchanged", () => {
    renderAll(createInitialSquareDough());
    act(() => squareDoughGaugeStore.setDough(pulls(4)));
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-corners", "4");
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "1");
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-gaps", "true");
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("すき間をうめよう");
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("ひろがり 75.5%");
    expect(screen.getByTestId("square-dough-goal")).not.toHaveTextContent("四隅");
    expect(screen.getByTestId("square-dough-next")).toHaveTextContent("天板いっぱい");
    // judgement and gauge are what they were: still STEP 1, coverage goal 95 %, not reached
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "coverage");
    expect(screen.getByTestId("square-dough-gauge-goal")).toHaveTextContent("目標 95%");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-reached", "false");
    expect(screen.getByTestId("square-dough-step-1")).toHaveAttribute("data-state", "now");
  });

  it("keeps the corner wording until the fourth corner (1..3 of 4 are unchanged)", () => {
    renderAll(createInitialSquareDough());
    act(() => squareDoughGaugeStore.setDough(pulls(3)));
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("四隅 3/4");
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-gaps", "false");
    expect(screen.getByTestId("square-dough-next")).toHaveTextContent("四隅まで伸びたら");
  });

  it("goes back to the STEP 2 wording once STEP 1 is done (the guide never outlives STEP 1)", () => {
    const full = new Array<number>(256).fill(0);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) if (isSquareCellOnPan(r, c)) full[squareCellIndex(r, c)] = 0.3;
    renderAll({ thickness: full });
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "2");
    expect(screen.getByTestId("square-dough-steps")).toHaveAttribute("data-gaps", "false");
    expect(screen.getByTestId("square-dough-goal")).not.toHaveTextContent("すき間");
  });
});
