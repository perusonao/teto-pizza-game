import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { squareDoughGaugeStore } from "../logic/pan/squareDoughGaugeStore";
import { SQUARE_DOUGH_FLAT_TARGET, isFlatTargetReached } from "../logic/pan/squareDoughView";
import { SquareDoughGauge } from "./SquareDoughGauge";
import { SquareDoughNext, SquareDoughSteps } from "./SquareDoughGuide";

afterEach(() => {
  cleanup();
  squareDoughGaugeStore.reset();
});

function renderAll(fallback: number) {
  return render(
    <>
      <SquareDoughSteps fallbackEvenness={fallback} />
      <SquareDoughGauge fallbackEvenness={fallback} />
      <SquareDoughNext fallbackEvenness={fallback} />
    </>,
  );
}

describe("isFlatTargetReached", () => {
  it("is judged on the number the gauge shows (one decimal), not on a hidden unrounded one", () => {
    expect(SQUARE_DOUGH_FLAT_TARGET).toBe(0.8);
    expect(isFlatTargetReached(0.7994)).toBe(false); // shows 79.9%
    expect(isFlatTargetReached(0.7996)).toBe(true); // shows 80.0%
    expect(isFlatTargetReached(0.8)).toBe(true);
    expect(isFlatTargetReached(Number.NaN)).toBe(false);
  });
});

describe("Square dough STEP 1/2 guide", () => {
  it("names both steps, the goal, the target and the next step before the target is reached", () => {
    renderAll(0.739);
    expect(screen.getByTestId("square-dough-step-1")).toHaveTextContent("STEP 1");
    expect(screen.getByTestId("square-dough-step-1")).toHaveTextContent("生地を平らにする");
    expect(screen.getByTestId("square-dough-step-1")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("square-dough-step-2")).toHaveTextContent("STEP 2");
    expect(screen.getByTestId("square-dough-step-2")).toHaveTextContent("四隅まで伸ばす");
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("盛り上がった濃いところを押して、平らにしよう");
    expect(screen.getByTestId("square-dough-gauge-goal")).toHaveTextContent("目標 80%");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-reached", "false");
    expect(screen.getByTestId("square-dough-next")).toHaveTextContent("つぎは「四隅まで伸ばす」");
  });

  it("the gauge, the goal sentence and the next line all follow the same real number", () => {
    renderAll(0.739);
    act(() => squareDoughGaugeStore.setEvenness(0.7994));
    expect(screen.getByTestId("square-dough-gauge-value")).toHaveTextContent("79.9%");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-reached", "false");
    expect(screen.getByTestId("square-dough-goal")).not.toHaveTextContent("平らになりました");
    act(() => squareDoughGaugeStore.setEvenness(0.8));
    expect(screen.getByTestId("square-dough-gauge-value")).toHaveTextContent("80.0%");
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-reached", "true");
    expect(screen.getByTestId("square-dough-goal")).toHaveTextContent("平らになりました！");
    expect(screen.getByTestId("square-dough-next")).toHaveTextContent("つぎは「四隅まで伸ばす」（じゅんび中）");
    // it can go back down (a press never lowers evenness today, but the words must follow the number, not a latch)
    act(() => squareDoughGaugeStore.setEvenness(0.7));
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-reached", "false");
    expect(screen.getByTestId("square-dough-goal")).not.toHaveTextContent("平らになりました");
  });

  it("uses the fallback evenness before the layer has reported one", () => {
    renderAll(0.85);
    expect(screen.getByTestId("square-dough-gauge")).toHaveAttribute("data-reached", "true");
  });
});
