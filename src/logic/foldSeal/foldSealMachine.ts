import {
  FOLD_D_MIN,
  FOLD_GRAB_MARGIN,
  FOLD_LINE_Y,
  FOLD_THETA_COMMIT,
  SEAL_BINS_PER_STEP,
  SEAL_BUTTON_STEPS,
  SEAL_MAX_INTERP,
  SEAM_BINS,
} from "./foldSealConstants";
import { containsWithMargin, isFinitePoint, type FoldSealGeometry } from "./foldSealGeometry";
import {
  coverageOf,
  emptyBins,
  fillBins,
  seamAngleInBand,
  seamBinIndex,
  unsealedRuns,
  visibleGapRuns,
  type BinRun,
  type SeamBins,
} from "./foldSealSeam";

/**
 * FOLD+SEAL state machine (Issue #773 T6-F1). PURE: no DOM, no clock, no randomness, no storage; it imports nothing from the game's state, scoring,
 * economy, persistence, discovery or reducer. The pointer gestures and the button alternatives converge on the SAME events/transitions
 * (docs/reports/TETO_FOLD-SEAL_Design-Acceptance_2026-11-07.md §3-§6). Every threshold is provisional until the iPhone HV.
 *
 * Contract notes:
 *  - `foldSealReduce` never throws and never mutates its arguments. An event that does not apply (wrong phase, other pointer, out of range, non-finite
 *    number) returns the SAME state object, so a caller can detect a no-op by identity.
 *  - A failed or interrupted gesture has no penalty: a fold released short springs back to `idle`; an interrupted seal keeps its progress.
 *  - Insufficient sealing never blocks `stepIsComplete`. Nothing here feeds scoring, completion, save, Dex, inventory, Research or hints; the only
 *    output meant for drawing is `foldSealVisual`.
 */
export type FoldSealPhase = "idle" | "folding" | "folded" | "sealing";
export type FoldVia = "drag" | "button";
export type ButtonStep = 0 | 1 | 2 | 3 | 4;

export interface FoldGrab {
  readonly pointerId: number;
  readonly startY: number;
  /** Distance of the grabbed point above the fold line (box units). */
  readonly d: number;
}

export interface SealProgress {
  /** SEAM_BINS entries, 0 = open, 1 = sealed, left to right. */
  readonly bins: SeamBins;
  readonly pointerId: number | null;
  /** The seam angle of the previous in-band sample of the active stroke (null = no active stroke, or the finger left the band). */
  readonly lastAngle: number | null;
  readonly buttonStep: ButtonStep;
}

export interface FoldSealState {
  readonly phase: FoldSealPhase;
  /** 0 (open) .. PI (folded over). `folded` / `sealing` hold exactly PI. */
  readonly foldAngle: number;
  readonly grab: FoldGrab | null;
  readonly seal: SealProgress;
  readonly foldedVia: FoldVia | null;
  readonly sealSkipped: boolean;
  /** Bumped by the caller when the dough / sauce / toppings change; a different value discards the fold and seal. */
  readonly inputsRevision: number;
}

export type FoldSealEvent =
  | { type: "FOLD_DOWN"; pointerId: number; x: number; y: number }
  | { type: "FOLD_MOVE"; pointerId: number; x: number; y: number }
  | { type: "FOLD_UP"; pointerId: number }
  | { type: "FOLD_BUTTON" }
  | { type: "REOPEN" }
  | { type: "SEAL_DOWN"; pointerId: number; x: number; y: number }
  | { type: "SEAL_MOVE"; pointerId: number; x: number; y: number }
  | { type: "SEAL_UP"; pointerId: number }
  | { type: "SEAL_BUTTON" }
  | { type: "SEAL_SKIP" }
  | { type: "SEAL_RESET" }
  | { type: "CANCEL" }
  | { type: "INVALIDATE"; revision: number };

function sanitizeRevision(revision: number): number {
  return Number.isInteger(revision) ? revision : 0;
}

export function createInitialFoldSealState(revision = 0): FoldSealState {
  return {
    phase: "idle",
    foldAngle: 0,
    grab: null,
    seal: { bins: emptyBins(), pointerId: null, lastAngle: null, buttonStep: 0 },
    foldedVia: null,
    sealSkipped: false,
    inputsRevision: sanitizeRevision(revision),
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The fold angle for a finger at height `yFinger` after grabbing a point `d` above the fold line: the grabbed edge sticks to the finger. 0 .. PI. */
export function foldAngleFromFinger(yFinger: number, d: number): number {
  if (!Number.isFinite(yFinger) || !Number.isFinite(d) || d <= 0) return 0;
  return Math.acos(clamp((FOLD_LINE_Y - yFinger) / d, -1, 1));
}

export function isFoldCommitted(angle: number): boolean {
  return Number.isFinite(angle) && angle >= FOLD_THETA_COMMIT;
}

const isPointerId = (n: number) => typeof n === "number" && Number.isFinite(n);

function foldedState(s: FoldSealState, via: FoldVia): FoldSealState {
  return { ...s, phase: "folded", foldAngle: Math.PI, grab: null, foldedVia: via, seal: { bins: emptyBins(), pointerId: null, lastAngle: null, buttonStep: 0 }, sealSkipped: false };
}

function reopened(s: FoldSealState): FoldSealState {
  return createInitialFoldSealState(s.inputsRevision);
}

export function foldSealReduce(s: FoldSealState, e: FoldSealEvent, g: FoldSealGeometry): FoldSealState {
  switch (e.type) {
    case "FOLD_DOWN": {
      if (s.phase !== "idle" || !isPointerId(e.pointerId) || !isFinitePoint(e.x, e.y)) return s;
      const d = FOLD_LINE_Y - e.y;
      if (d < FOLD_D_MIN || !containsWithMargin(g, e.x, e.y, FOLD_GRAB_MARGIN)) return s;
      return { ...s, phase: "folding", foldAngle: 0, grab: { pointerId: e.pointerId, startY: e.y, d } };
    }
    case "FOLD_MOVE": {
      if (s.phase !== "folding" || !s.grab || e.pointerId !== s.grab.pointerId || !isFinitePoint(e.x, e.y)) return s;
      const angle = foldAngleFromFinger(e.y, s.grab.d);
      return angle === s.foldAngle ? s : { ...s, foldAngle: angle };
    }
    case "FOLD_UP": {
      if (s.phase !== "folding" || !s.grab || e.pointerId !== s.grab.pointerId) return s;
      return isFoldCommitted(s.foldAngle) ? foldedState(s, "drag") : { ...s, phase: "idle", foldAngle: 0, grab: null };
    }
    case "FOLD_BUTTON":
      return s.phase === "idle" ? foldedState(s, "button") : s;
    case "REOPEN":
      return s.phase === "folded" || s.phase === "sealing" ? reopened(s) : s;
    case "SEAL_DOWN": {
      if (s.phase !== "folded" || !isPointerId(e.pointerId)) return s;
      const phi = seamAngleInBand(g, e.x, e.y);
      if (phi === null) return s;
      const bin = seamBinIndex(phi);
      return { ...s, phase: "sealing", seal: { ...s.seal, bins: fillBins(s.seal.bins, bin, bin), pointerId: e.pointerId, lastAngle: phi } };
    }
    case "SEAL_MOVE": {
      if (s.phase !== "sealing" || e.pointerId !== s.seal.pointerId || !isFinitePoint(e.x, e.y)) return s;
      const phi = seamAngleInBand(g, e.x, e.y);
      if (phi === null) return s.seal.lastAngle === null ? s : { ...s, seal: { ...s.seal, lastAngle: null } };
      const here = seamBinIndex(phi);
      const prev = s.seal.lastAngle;
      const from = prev !== null && Math.abs(phi - prev) <= SEAL_MAX_INTERP ? seamBinIndex(prev) : here;
      const bins = fillBins(s.seal.bins, from, here);
      return bins === s.seal.bins && prev === phi ? s : { ...s, seal: { ...s.seal, bins, lastAngle: phi } };
    }
    case "SEAL_UP": {
      if (s.phase !== "sealing" || e.pointerId !== s.seal.pointerId) return s;
      return { ...s, phase: "folded", seal: { ...s.seal, pointerId: null, lastAngle: null } };
    }
    case "SEAL_BUTTON": {
      if (s.phase !== "folded" || s.seal.buttonStep >= SEAL_BUTTON_STEPS) return s;
      const step = s.seal.buttonStep;
      const bins = fillBins(s.seal.bins, step * SEAL_BINS_PER_STEP, (step + 1) * SEAL_BINS_PER_STEP - 1);
      return { ...s, seal: { ...s.seal, bins, buttonStep: (step + 1) as ButtonStep } };
    }
    case "SEAL_SKIP":
      return s.phase === "folded" && !s.sealSkipped ? { ...s, sealSkipped: true } : s;
    case "SEAL_RESET": {
      if (s.phase !== "folded") return s;
      if (s.seal.buttonStep === 0 && !s.sealSkipped && coverageOf(s.seal.bins) === 0) return s;
      return { ...s, sealSkipped: false, seal: { bins: emptyBins(), pointerId: null, lastAngle: null, buttonStep: 0 } };
    }
    case "CANCEL": {
      if (s.phase === "folding") return { ...s, phase: "idle", foldAngle: 0, grab: null };
      if (s.phase === "sealing") return { ...s, phase: "folded", seal: { ...s.seal, pointerId: null, lastAngle: null } };
      return s;
    }
    case "INVALIDATE": {
      if (!Number.isInteger(e.revision) || e.revision === s.inputsRevision) return s;
      return createInitialFoldSealState(e.revision);
    }
    default:
      return s;
  }
}

/** The fold is committed (`folded` or an active seal stroke). The step may proceed whatever the seal's quality. */
export function isFolded(s: FoldSealState): boolean {
  return s.phase === "folded" || s.phase === "sealing";
}

/** Whether the FOLD+SEAL step may be left for BAKE. Insufficient sealing never blocks it. */
export function stepIsComplete(s: FoldSealState): boolean {
  return isFolded(s);
}

/** Sealed fraction of the seam, 0..1. */
export function sealCoverage(s: FoldSealState): number {
  return coverageOf(s.seal.bins);
}

/** Every maximal unsealed run (left to right), once folded; empty before. */
export function sealOpenRuns(s: FoldSealState): BinRun[] {
  return isFolded(s) ? unsealedRuns(s.seal.bins) : [];
}

/** The ONE output meant for drawing. Gaps are VISUAL ONLY (subtle); it carries no score, no flag and no id. */
export interface FoldSealVisual {
  readonly phase: FoldSealPhase;
  readonly foldAngle: number;
  readonly sealedBins: SeamBins;
  readonly sealProgress: number;
  /** Unsealed runs long enough to draw as a gap (OPEN_RUN_MIN_BINS); empty before the fold commits. */
  readonly gaps: ReadonlyArray<BinRun>;
}

export function foldSealVisual(s: FoldSealState): FoldSealVisual {
  return {
    phase: s.phase,
    foldAngle: s.foldAngle,
    sealedBins: s.seal.bins,
    sealProgress: coverageOf(s.seal.bins),
    gaps: isFolded(s) ? visibleGapRuns(s.seal.bins) : [],
  };
}

/** Violated invariants of a state (empty = healthy). Used by the tests; also a cheap guard for a future caller. */
export function foldSealInvariantViolations(s: FoldSealState): string[] {
  const v: string[] = [];
  if (!(s.foldAngle >= 0 && s.foldAngle <= Math.PI)) v.push("foldAngle out of [0, PI]");
  if (isFolded(s) && s.foldAngle !== Math.PI) v.push("folded without foldAngle = PI");
  if (!isFolded(s) && (s.seal.pointerId !== null || s.seal.lastAngle !== null)) v.push("seal stroke outside folded/sealing");
  if (s.phase === "folding" && !s.grab) v.push("folding without grab");
  if (s.phase !== "folding" && s.grab) v.push("grab outside folding");
  if (s.phase === "sealing" && s.seal.pointerId === null) v.push("sealing without pointer");
  if (s.phase !== "sealing" && s.seal.pointerId !== null) v.push("seal pointer outside sealing");
  if (s.seal.bins.length !== SEAM_BINS || s.seal.bins.some((b) => b !== 0 && b !== 1)) v.push("bins malformed");
  if (!isFolded(s) && (coverageOf(s.seal.bins) !== 0 || s.seal.buttonStep !== 0 || s.sealSkipped)) v.push("seal data before the fold");
  if (isFolded(s) && s.foldedVia === null) v.push("folded without foldedVia");
  if (!isFolded(s) && s.foldedVia !== null) v.push("foldedVia before the fold");
  if (!Number.isInteger(s.inputsRevision)) v.push("inputsRevision not an integer");
  return v;
}
