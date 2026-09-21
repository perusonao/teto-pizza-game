import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CutDebugPanel } from "./CutDebugPanel";
import { evaluateCut } from "../logic/cut/evaluation";
import type { CutLine } from "../logic/cut/types";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";

function idealCutLine(index: number, count: number): CutLine {
  const angle = (Math.PI * index) / count;
  const dx = Math.cos(angle) * DOUGH_RADIUS;
  const dy = Math.sin(angle) * DOUGH_RADIUS;
  return {
    start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy },
    end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy },
  };
}

function idealEvaluation() {
  return evaluateCut([idealCutLine(0, 3), idealCutLine(1, 3), idealCutLine(2, 3)]);
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

/**
 * Pizza Cutting 1.0 Phase 3 (design doc §18 "CUT Phase 3" row): mirrors
 * ScoringV2DebugPanel.test.tsx's own Production/Preview gating pattern verbatim -- same
 * `VITE_PREVIEW_MODE` SSOT, same `vi.stubEnv` mechanism.
 */
describe("Production/Preview gating (mirrors ScoringV2DebugPanel's pattern)", () => {
  it("Production (VITE_PREVIEW_MODE unset) never renders the debug panel, even with a real evaluation", () => {
    const { container } = render(<CutDebugPanel evaluation={idealEvaluation()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/CUT Debug/)).not.toBeInTheDocument();
  });

  it("Production (VITE_PREVIEW_MODE unset) renders nothing even when evaluation is null", () => {
    const { container } = render(<CutDebugPanel evaluation={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Preview (VITE_PREVIEW_MODE true) renders the debug panel with the cutScore line", () => {
    vi.stubEnv("VITE_PREVIEW_MODE", "true");
    render(<CutDebugPanel evaluation={idealEvaluation()} />);
    expect(screen.getByText(/CUT Debug/)).toBeInTheDocument();
    expect(screen.getByText(/cutScore: \d+ \/ 100/)).toBeInTheDocument();
  });

  it("Preview + null evaluation (non-CUT recipe, or CUT not confirmed yet) renders nothing", () => {
    vi.stubEnv("VITE_PREVIEW_MODE", "true");
    const { container } = render(<CutDebugPanel evaluation={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Preview exposes the four raw 0-1 signals as percentages", () => {
    vi.stubEnv("VITE_PREVIEW_MODE", "true");
    render(<CutDebugPanel evaluation={idealEvaluation()} />);
    expect(screen.getByText(/count \d+%/)).toBeInTheDocument();
    expect(screen.getByText(/complete \d+%/)).toBeInTheDocument();
    expect(screen.getByText(/center \d+%/)).toBeInTheDocument();
    expect(screen.getByText(/uniform \d+%/)).toBeInTheDocument();
  });
});
