import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ScoringV2ShadowPanel } from "./ScoringV2ShadowPanel";
import { computeScoringV2Shadow } from "../logic/scoringV2";
import { getRecipe } from "../data/recipes";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { createEmptyPizza } from "../state/pizzaState";

const MARGHERITA = getRecipe("margherita")!;
const [MOZZ, BASIL] = MARGHERITA_REFERENCE.pieceGroups;

function referenceResult() {
  return computeScoringV2Shadow(MARGHERITA, {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    sauceDeposits: buildIdealMargheritaSauceFixture(),
    toppings: [
      ...MOZZ.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
      ...BASIL.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
    ],
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

/**
 * Phase 4A-2: mirrors SauceMetricsPanel.test.tsx's own Production/Preview gating pattern
 * (Phase 4A-1B.1 Fix C) -- same `VITE_PREVIEW_MODE` SSOT, same `vi.stubEnv` mechanism. This is
 * the closest a unit test can get to "test 25: production build contains no Shadow debug
 * panel" without actually running a production `vite build` -- see the Shadow Result report's
 * own "production debug-gating evidence" section for the real `vite build` + dist-grep
 * confirmation this test stands in for at the unit level.
 */
describe("Production/Preview gating (mirrors SauceMetricsPanel's Fix C pattern)", () => {
  it("Production (VITE_PREVIEW_MODE unset) never renders the Shadow panel, even with a real Shadow result", () => {
    const { container } = render(<ScoringV2ShadowPanel result={referenceResult()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Scoring 2.0 Shadow/)).not.toBeInTheDocument();
  });

  it("Production (VITE_PREVIEW_MODE unset) renders nothing even when result is null", () => {
    const { container } = render(<ScoringV2ShadowPanel result={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Preview (VITE_PREVIEW_MODE true) renders the Shadow panel with a Total line", () => {
    vi.stubEnv("VITE_PREVIEW_MODE", "true");
    render(<ScoringV2ShadowPanel result={referenceResult()} />);
    expect(screen.getByText(/Scoring 2.0 Shadow/)).toBeInTheDocument();
    expect(screen.getByText(/Total: \d+ \/ 100/)).toBeInTheDocument();
  });

  it("Preview + null result (no CONFIRM_BAKE yet this round) renders nothing", () => {
    vi.stubEnv("VITE_PREVIEW_MODE", "true");
    const { container } = render(<ScoringV2ShadowPanel result={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Preview + a Reference-unavailable recipe shows the explicit unavailable message, never a fabricated number", () => {
    vi.stubEnv("VITE_PREVIEW_MODE", "true");
    const marinara = getRecipe("marinara")!;
    const result = computeScoringV2Shadow(marinara, createEmptyPizza());
    render(<ScoringV2ShadowPanel result={result} />);
    expect(screen.getByText("Reference unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
  });
});
