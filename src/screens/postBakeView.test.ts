import { describe, expect, it } from "vitest";
import type { GamePhase, MakingStep } from "../state/gameReducer";
import { FINISH_FIXTURE_RECIPE } from "../state/testSupport/finishFixture";
import { deriveCoreSteps } from "../data/cookingProfiles";
import { finishStepAvailable, renderedPostBakeStep, selectPostBakeStep } from "./postBakeView";

const PHASES: readonly GamePhase[] = ["ORDER", "PREPARE", "BAKE", "POST_BAKE", "RESULT", "DISCOVERED"];
const STEPS: readonly MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL", "EDGE_FILL", "CUT", "FINISH"];

describe("renderedPostBakeStep (CS-1a)", () => {
  it("is exactly the old `phase === POST_BAKE && makingStep === CUT` condition, for every phase x step", () => {
    for (const phase of PHASES) {
      for (const step of STEPS) {
        const old = phase === "POST_BAKE" && step === "CUT";
        expect(renderedPostBakeStep(phase, step) !== null, `${phase}/${step}`).toBe(old);
        expect(renderedPostBakeStep(phase, step) === "CUT", `${phase}/${step}`).toBe(old);
      }
    }
  });

  it("the reserved FINISH step renders no Production UI", () => {
    expect(renderedPostBakeStep("POST_BAKE", "FINISH")).toBeNull();
  });
});

describe("selectPostBakeStep (FINISH D2-0)", () => {
  it("equals renderedPostBakeStep for every phase x step while FINISH is not opted in", () => {
    for (const phase of PHASES) {
      for (const step of STEPS) expect(selectPostBakeStep(phase, step, false), `${phase}/${step}`).toBe(renderedPostBakeStep(phase, step));
    }
  });

  it("selects FINISH only in POST_BAKE and only when opted in; CUT is unaffected by the opt-in", () => {
    for (const phase of PHASES) {
      for (const step of STEPS) {
        const expected = phase === "POST_BAKE" && step === "FINISH" ? "FINISH" : phase === "POST_BAKE" && step === "CUT" ? "CUT" : null;
        expect(selectPostBakeStep(phase, step, true), `${phase}/${step}`).toBe(expected);
      }
    }
  });

  it("renderedPostBakeStep itself still renders no FINISH UI", () => {
    expect(renderedPostBakeStep("POST_BAKE", "FINISH")).toBeNull();
  });
});

describe("finishStepAvailable (FINISH D2-0)", () => {
  const withFinish = deriveCoreSteps(FINISH_FIXTURE_RECIPE);
  const core = withFinish.filter((step) => step !== "FINISH");

  it("is true only for a Guided round whose profile has FINISH", () => {
    expect(finishStepAvailable({ roundKind: "GUIDED" }, withFinish)).toBe(true);
    expect(finishStepAvailable({ roundKind: "GUIDED" }, core)).toBe(false);
  });

  it("is false for Lunch Rush and Dinner even if the profile carried FINISH", () => {
    for (const roundKind of ["LUNCH_RUSH", "DINNER"] as const) {
      expect(finishStepAvailable({ roundKind }, withFinish), roundKind).toBe(false);
    }
  });

  it("is true for Free Cooking (incl. Research) only when its profile carries FINISH (FIN-E3a gate open), false without", () => {
    expect(finishStepAvailable({ roundKind: "FREE_COOK" }, withFinish)).toBe(true);
    expect(finishStepAvailable({ roundKind: "FREE_COOK" }, core)).toBe(false);
  });
});
