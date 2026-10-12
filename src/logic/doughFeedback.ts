/**
 * Issue #474 Phase A-0/A-1: pure, display-only feedback derived from the DOUGH step's own 8-point
 * shape. Never a score, never stored, never read by the reducer, Scoring or CUT -- it only says, in
 * words, why the DOUGH step's 次へ is (or is not) available yet. The completion rule itself stays
 * `isDoughShapeComplete` (../doughShape.ts, mean radius >= DOUGH_COMPLETION_THRESHOLD of the ideal
 * size); this module reads that same function so the two can never disagree.
 */
import { doughSizeProgress, isDoughShapeComplete, type DoughShape } from "./doughShape";

/** SMALL: below the completion size, 次へ is unavailable. READY: big enough, up to the ideal size.
 *  LARGE: past the ideal size (still fine -- D3A lets the dough exceed it). */
export type DoughSizeStatus = "SMALL" | "READY" | "LARGE";

/** Plain-language copy, one line each. No numbers and no score wording (Owner Decision, #474). */
export const DOUGH_SIZE_STATUS_TEXT: Record<DoughSizeStatus, string> = {
  SMALL: "もう少し大きく伸ばそう",
  READY: "いい大きさ！「次へ」で進めよう",
  LARGE: "大きめでもOK。縮めて整えてもいいよ",
};

export function doughSizeStatus(shape: DoughShape): DoughSizeStatus {
  if (!isDoughShapeComplete(shape)) return "SMALL";
  return doughSizeProgress(shape) > 1 ? "LARGE" : "READY";
}
