/**
 * Pizza Cutting 1.0 Phase 1 (docs/design/TETO_PIZZA-CUTTING_1.0.md §3/§15.1): the ideal
 * diameter-cut fixture builders used by this module family's own tests. Not wired into any
 * reducer, component, or recipe data -- pure, deterministic fixture construction only, so every
 * geometry/evaluation test in this phase builds its "perfect N-slice" input the same way instead
 * of each test file re-deriving its own angle math.
 */
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import type { CutLine } from "./types";

/**
 * A full diameter chord through `DOUGH_CENTER` at `angleDegrees` (0 = +x axis, measured in the
 * same screen-space sense `DoughPoint` already uses). Both endpoints land exactly on the rim,
 * satisfying `isEdgeToEdgeCutLine` (./types.ts) -- the same rim-to-rim chord shape Phase 2's
 * real `clampToDough`-clamped commit will always produce (design doc §2.2), just constructed
 * directly instead of from a simulated drag.
 */
export function createDiameterCutLine(angleDegrees: number): CutLine {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const dx = Math.cos(angleRadians) * DOUGH_RADIUS;
  const dy = Math.sin(angleRadians) * DOUGH_RADIUS;
  return {
    start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy },
    end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy },
  };
}

/**
 * The design doc's own ideal fixture (§3/§20's "0deg / 60deg / 120deg" 6-slice case,
 * generalized over `sliceCount`): `sliceCount / 2` diameters evenly spaced across a half-turn
 * (a diameter at angle theta and theta+180deg is the same chord) produce `sliceCount` equal
 * wedges. Only 6 is a formally shipped/tested fixture in Phase 1 (design doc §3.2) -- this
 * generalization exists so the engine's "4/8 stay free later" claim (§3.2 point 4) is itself
 * checkable, not just asserted.
 */
export function createIdealSliceFixtureLines(sliceCount: number): readonly CutLine[] {
  const lineCount = sliceCount / 2;
  return Array.from({ length: lineCount }, (_, i) =>
    createDiameterCutLine((180 / lineCount) * i),
  );
}
