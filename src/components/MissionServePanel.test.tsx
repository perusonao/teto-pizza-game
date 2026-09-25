import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MissionServePanel } from "./MissionServePanel";
import type { ScoreBreakdown } from "../logic/scoring";

const SCORE: ScoreBreakdown = {
  matchScore: 100,
  ingredientScore: 100,
  placementScore: 90,
  bakeScore: 100,
  total: 92.66,
  stars: 5,
};

afterEach(() => cleanup());

describe("MissionServePanel: Issue #215 (LR-A / OD-4b)", () => {
  it("an under-order FAILED pizza names the order quantity", () => {
    render(
      <MissionServePanel
        score={SCORE}
        servedCount={2}
        completion={{
          status: "FAILED",
          reason: "INSUFFICIENT_REQUIRED_AMOUNT",
          ingredientId: "mushroom",
          failures: [{ reason: "INSUFFICIENT_REQUIRED_AMOUNT", ingredientId: "mushroom" }],
        }}
        cutEvaluation={null}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("注文のマッシュルームの数が足りません");
    expect(screen.queryByText(/SERVED/)).toBeNull();
  });

  it("an excess PASS pizza shows the quantity line with its reduced score", () => {
    render(
      <MissionServePanel
        score={SCORE}
        servedCount={2}
        completion={{ status: "PASS" }}
        cutEvaluation={null}
        quantityNoteJa="マッシュルームがお手本より多め（4個／お手本3個）"
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByText("93点")).toBeInTheDocument();
    expect(screen.getByText("マッシュルームがお手本より多め（4個／お手本3個）")).toBeInTheDocument();
    expect(screen.getByText(/\+1 SERVED/)).toBeInTheDocument();
  });

  it("renders no quantity line when omitted", () => {
    const { container } = render(
      <MissionServePanel score={SCORE} servedCount={0} completion={{ status: "PASS" }} cutEvaluation={null} onNext={vi.fn()} />,
    );
    expect(container.querySelector(".mission-serve-panel__quantity-note")).toBeNull();
  });
});
