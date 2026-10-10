/**
 * Cooking Steps 2.0 CS-1a (docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md §13,
 * OD-CS-20): which POST_BAKE step `GameScreen` renders a cooking UI for.
 *
 * `GameScreen` used to test `phase === "POST_BAKE" && makingStep === "CUT"` at six separate sites.
 * They now read this one decision:
 * - the layout sites (roomy stage, cooking layout, step tabs, stage interactivity) ask "is a
 *   post-bake step rendered at all?";
 * - the CUT-content sites (slice instruction, cut bar, the 切り終わる readiness) ask "is it CUT?".
 *
 * Only CUT has a Production UI. Every other POST_BAKE step (the reserved FINISH) returns `null`,
 * so it renders nothing new -- exactly what those six conditions produced before. A future step
 * gets its UI by being added here together with its own content, never by default.
 */
import type { GamePhase, MakingStep } from "../state/gameReducer";

/** The POST_BAKE steps with a Production cooking UI. */
export type RenderedPostBakeStep = "CUT";

export function renderedPostBakeStep(phase: GamePhase, makingStep: MakingStep): RenderedPostBakeStep | null {
  if (phase !== "POST_BAKE") return null;
  return makingStep === "CUT" ? "CUT" : null;
}
