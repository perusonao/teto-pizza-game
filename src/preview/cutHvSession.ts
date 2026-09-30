/**
 * CUT-S2 Owner Human Verification (Issue #288): pure trial/session logic for the Preview-only CUT
 * shadow page (./CutHvPage.tsx). No React, no game state. CutQuality is computed here in shadow only:
 * it feeds nothing in the game, and the page never imports the reducer, save or scoring.
 */
import { evaluateCut } from "../logic/cut/evaluation";
import { evaluateCutQuality } from "../logic/cut/quality";
import type { CutLine } from "../logic/cut/types";
import type { StorageLike } from "../state/persistence";
import { CUT_HV_PREVIEW_MARK } from "./cutHvActivation";

export type HvStyle = "careful" | "normal" | "rough";

export const HV_STYLE_LABEL_JA: Readonly<Record<HvStyle, string>> = {
  careful: "丁寧",
  normal: "普通",
  rough: "雑",
};

/** Owner's procedure: careful x3, normal x5, rough x3 (11 trials). */
export const HV_TRIAL_PLAN: readonly HvStyle[] = [
  "careful", "careful", "careful",
  "normal", "normal", "normal", "normal", "normal",
  "rough", "rough", "rough",
];

/** The two uniformity zero-side tolerances under comparison. Nothing else differs between them. */
export const HV_ZERO_SIDE_CANDIDATES = [0.6, 0.4] as const;

export interface HvMetrics {
  /** Overall with uniformity zero-side 0.6 / 0.4 (every other tolerance and the weights are the S1/S2 values). */
  overall06: number;
  overall04: number;
  uniformity06: number;
  uniformity04: number;
  center: number;
  validity: number;
  count: number;
  /** The existing `evaluateCut` preview score (0-100), for comparison only. */
  cutScore: number;
  sliverCount: number;
  pieces: number;
  pieceAreas: readonly number[];
}

const SIX = { requestedSliceCount: 6 } as const;

export function computeHvMetrics(lines: readonly CutLine[]): HvMetrics {
  const q06 = evaluateCutQuality(lines, SIX, { uniformityZeroCreditDeviation: 0.6 });
  const q04 = evaluateCutQuality(lines, SIX, { uniformityZeroCreditDeviation: 0.4 });
  return {
    overall06: q06.overall,
    overall04: q04.overall,
    uniformity06: q06.sliceUniformity,
    uniformity04: q04.sliceUniformity,
    center: q06.centerAccuracy,
    validity: q06.lineValidity,
    count: q06.sliceCountFit,
    cutScore: evaluateCut(lines, SIX).cutScore,
    sliverCount: q06.sliverCount,
    pieces: q06.actualPieceCount,
    pieceAreas: q06.pieceAreas,
  };
}

export interface HvAttemptRecord {
  index: number;
  instructed: HvStyle;
  selfRating: HvStyle;
  metrics: HvMetrics;
  lines: readonly CutLine[];
  viewport: string;
}

export const CUT_HV_STORAGE_KEY = "teto-pizza-preview-cuthv-v1";

function isStyle(v: unknown): v is HvStyle {
  return v === "careful" || v === "normal" || v === "rough";
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isLine(v: unknown): v is CutLine {
  const p = (x: unknown) => typeof x === "object" && x !== null && isFiniteNumber((x as { x: unknown }).x) && isFiniteNumber((x as { y: unknown }).y);
  return typeof v === "object" && v !== null && p((v as CutLine).start) && p((v as CutLine).end);
}

/** Loads saved trials; anything malformed is dropped (never throws), so a bad value can only lose records. */
export function loadHvTrials(storage: StorageLike | null): HvAttemptRecord[] {
  try {
    const raw = storage?.getItem(CUT_HV_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: HvAttemptRecord[] = [];
    for (const r of parsed as HvAttemptRecord[]) {
      if (!r || !isStyle(r.instructed) || !isStyle(r.selfRating) || !Array.isArray(r.lines) || !r.lines.every(isLine)) continue;
      if (typeof r.viewport !== "string") continue;
      const lines = r.lines;
      out.push({ index: out.length, instructed: r.instructed, selfRating: r.selfRating, lines, viewport: r.viewport, metrics: computeHvMetrics(lines) });
    }
    return out.slice(0, HV_TRIAL_PLAN.length);
  } catch {
    return [];
  }
}

export function saveHvTrials(storage: StorageLike | null, trials: readonly HvAttemptRecord[]): void {
  try {
    storage?.setItem(CUT_HV_STORAGE_KEY, JSON.stringify(trials.map((t) => ({ instructed: t.instructed, selfRating: t.selfRating, lines: t.lines, viewport: t.viewport }))));
  } catch {
    // A failing storage only loses the reload-survival; the session itself keeps working.
  }
}

const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Tab-separated text the Owner pastes back: one header + one row per trial; the last column holds the
 *  committed lines so the trial can be reproduced exactly (the Owner never needs to read it). */
export function buildHvResultText(trials: readonly HvAttemptRecord[]): string {
  const header = ["#", "指示", "自己評価", "Q(0.6)", "Q(0.4)", "uniformity(0.6)", "uniformity(0.4)", "center", "validity", "count", "cutScore", "sliver", "pieces", "viewport", "lines"].join("\t");
  const rows = trials.map((t, i) =>
    [
      i + 1,
      HV_STYLE_LABEL_JA[t.instructed],
      HV_STYLE_LABEL_JA[t.selfRating],
      r2(t.metrics.overall06),
      r2(t.metrics.overall04),
      r2(t.metrics.uniformity06),
      r2(t.metrics.uniformity04),
      r2(t.metrics.center),
      r2(t.metrics.validity),
      r2(t.metrics.count),
      Math.round(t.metrics.cutScore),
      t.metrics.sliverCount,
      t.metrics.pieces,
      t.viewport,
      JSON.stringify(t.lines.map((l) => [l.start.x, l.start.y, l.end.x, l.end.y].map((n) => Math.round(n * 100) / 100))),
    ].join("\t"),
  );
  return `${CUT_HV_PREVIEW_MARK}\n${[header, ...rows].join("\n")}`;
}
