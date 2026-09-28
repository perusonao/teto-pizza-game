import { describe, expect, it } from "vitest";
import type { GamePhase, MakingStep } from "../state/gameReducer";
import { renderedPostBakeStep } from "./postBakeView";

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
