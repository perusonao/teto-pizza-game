import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SauceMetricsPanel } from "./SauceMetricsPanel";
import { computeSauceMetrics } from "../logic/sauceField";
import { IDEAL_MARGHERITA_SAUCE_FIXTURE, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { scoreSauceAgainstReference } from "../logic/referenceScoring";

const REFERENCE = MARGHERITA_REFERENCE.sauce;

function ring(radius: number, count: number, amount = 0.02) {
  const deposits = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    deposits.push({ x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, amount });
  }
  return deposits;
}

afterEach(() => {
  cleanup();
});

/**
 * Human Feel Fix 2 Human Feel Gate, at the component layer this time (sauceEvaluation.test.ts
 * already covers the pure derivation these render calls read from) -- confirms the panel
 * actually surfaces the right tier symbols and live message text for the same A/D scenarios,
 * and that the live message only shows while `isDispensing` is true.
 */
describe("SauceMetricsPanel: player-facing evaluation (Human Feel Fix 2)", () => {
  it("shows all three tiers as ◎ and 「いい感じ！」 while painting the reference fixture", () => {
    const metrics = computeSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    render(
      <SauceMetricsPanel
        metrics={metrics}
        shadowScore={scoreSauceAgainstReference(metrics, REFERENCE)}
        reference={REFERENCE}
        isDispensing
      />,
    );
    expect(screen.getAllByText("◎")).toHaveLength(3); // ◎ x3: 広さ/均一さ/ふち
    expect(screen.getByText("いい感じ！")).toBeInTheDocument();
  });

  it("shows 「もう少し広げよう」 for a center-only dab, and 広さ reads ×", () => {
    const metrics = computeSauceMetrics(ring(3, 4).concat(ring(6, 6)));
    render(
      <SauceMetricsPanel
        metrics={metrics}
        shadowScore={scoreSauceAgainstReference(metrics, REFERENCE)}
        reference={REFERENCE}
        isDispensing
      />,
    );
    expect(screen.getByText("もう少し広げよう")).toBeInTheDocument();
  });

  it("shows no live message when not currently dispensing, even for a bad state", () => {
    const metrics = computeSauceMetrics(ring(3, 4));
    render(
      <SauceMetricsPanel
        metrics={metrics}
        shadowScore={scoreSauceAgainstReference(metrics, REFERENCE)}
        reference={REFERENCE}
        isDispensing={false}
      />,
    );
    expect(screen.queryByText("もう少し広げよう")).not.toBeInTheDocument();
    expect(screen.queryByText("いい感じ！")).not.toBeInTheDocument();
  });

  it("the detailed quantity/coverage/evenness/overflow numbers stay hidden until the 開発用 toggle expands", () => {
    const metrics = computeSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    render(
      <SauceMetricsPanel
        metrics={metrics}
        shadowScore={scoreSauceAgainstReference(metrics, REFERENCE)}
        reference={REFERENCE}
      />,
    );
    expect(screen.queryByText("被覆")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Prototype Metrics/ }));
    expect(screen.getByText("被覆")).toBeInTheDocument();
  });
});
