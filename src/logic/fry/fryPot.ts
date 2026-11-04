/**
 * Cooking Fry Phase 1 (Issue #749), F1: what the oil pan shows and keeps, shared by both operations (pure).
 *
 * The cue is the BUBBLES, not the colour: big and violent at first, then finer and calmer, finally nearly still. The stages are fixed time boundaries -- no
 * randomness -- so the same input always draws the same pan. There is no pass / fail, no target window and no gauge: every look is a fine result and nothing here is
 * read by scoring, identification, saves, stock, the Dex, Pitz or the pending-round journal. All numbers are PROVISIONAL until the iPhone HV (one place, here).
 *
 *   submergedMs   how long the piece has been in the oil (the only clock input)
 *   timeScale     the HV comparison knob: stage boundaries are multiplied by it (<1 = done sooner, >1 = later); invalid -> 1
 *   amount (0..1) the one number kept for the placed piece: grows with the time, capped at FRY_AMOUNT_CRISP_MAX; exactly 1 only for the "over" look
 */

/** Stage i lasts until this many ms (ascending). The stage after the last is "still". */
export const FRY_STAGE_END_MS = [2000, 3500, 6500, 8500] as const;
export type FryBubbleStage = "big" | "medium" | "fine" | "calm" | "still";
export const FRY_BUBBLE_STAGES: readonly FryBubbleStage[] = ["big", "medium", "fine", "calm", "still"];
/** Before this the piece is still raw; from here it is crisp. */
export const FRY_CRISP_FROM_MS = FRY_STAGE_END_MS[1];
/** From this on the piece is over-fried. */
export const FRY_OVER_FROM_MS = FRY_STAGE_END_MS[3];
/** The largest `amount` any look but "over" keeps, so `amount` alone still tells "crisp" from "over". */
export const FRY_AMOUNT_CRISP_MAX = 0.95;
/** `amount` of the "over" look. */
export const FRY_AMOUNT_OVER = 1;
/** The time knob under comparison (Preview / DEV, F3): shorter / standard / longer. */
export const FRY_TIME_SCALES = { short: 0.75, standard: 1, long: 1.35 } as const;

/** The two operations under comparison (Owner 2026-11-04): two taps, or a vertical drag in and out. */
export type FryVariant = "tap" | "drag";

export type FryLook = "raw" | "crisp" | "over";

export interface FryResult {
  /** 0..1, see the header. */
  amount: number;
  look: FryLook;
  /** The bubble stage at the moment the piece was lifted. */
  stage: FryBubbleStage;
}

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** A usable time scale, or 1. */
export const validTimeScale = (scale: number | undefined): number => (typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : 1);

/** Time in the oil with the comparison scale taken out (non-finite / negative -> 0). */
function effectiveMs(submergedMs: number, timeScale?: number): number {
  if (!Number.isFinite(submergedMs) || submergedMs <= 0) return 0;
  // Rounded to 1e-6 ms so that an exact boundary under a fractional scale (e.g. 3500 * 1.35) lands ON the boundary, not a float hair below it.
  return Math.round((submergedMs / validTimeScale(timeScale)) * 1e6) / 1e6;
}

export function fryBubbleStageAt(submergedMs: number, timeScale?: number): FryBubbleStage {
  const ms = effectiveMs(submergedMs, timeScale);
  const i = FRY_STAGE_END_MS.findIndex((end) => ms < end);
  return FRY_BUBBLE_STAGES[i === -1 ? FRY_STAGE_END_MS.length : i];
}

export function fryLookAt(submergedMs: number, timeScale?: number): FryLook {
  const ms = effectiveMs(submergedMs, timeScale);
  if (ms >= FRY_OVER_FROM_MS) return "over";
  return ms >= FRY_CRISP_FROM_MS ? "crisp" : "raw";
}

export function fryResultOf(submergedMs: number, timeScale?: number): FryResult {
  const look = fryLookAt(submergedMs, timeScale);
  const ms = effectiveMs(submergedMs, timeScale);
  return {
    amount: look === "over" ? FRY_AMOUNT_OVER : Math.min(ms / FRY_OVER_FROM_MS, FRY_AMOUNT_CRISP_MAX),
    look,
    stage: fryBubbleStageAt(submergedMs, timeScale),
  };
}

/** The look a kept `amount` stands for (the inverse of `fryResultOf`'s `amount`). Non-finite -> "raw". */
export function fryLookOfAmount(amount: number): FryLook {
  const a = clamp01(amount);
  if (a >= FRY_AMOUNT_OVER) return "over";
  return a >= FRY_CRISP_FROM_MS / FRY_OVER_FROM_MS ? "crisp" : "raw";
}

/** What the bubbles look like in each stage, for the pan drawing (F3): size and rate, both 0..1. Decreasing with the stage. */
export const FRY_BUBBLES: Record<FryBubbleStage, { size: number; rate: number }> = {
  big: { size: 1, rate: 1 },
  medium: { size: 0.7, rate: 0.75 },
  fine: { size: 0.4, rate: 0.5 },
  calm: { size: 0.25, rate: 0.25 },
  still: { size: 0.1, rate: 0.05 },
};

/** Words for the result. Descriptive, never a grade: there is no right one. */
export const FRY_LOOK_COPY: Record<FryLook, string> = {
  raw: "まだ生っぽい",
  crisp: "カリッと揚がった",
  over: "揚げすぎて濃い色になった",
};

/** Short words while the piece is in the oil (an onomatopoeia per stage; no gauge, no number, no time left). */
export const FRY_STAGE_LIVE: Record<FryBubbleStage, string> = {
  big: "ジュワワワッ！",
  medium: "ジュワ…",
  fine: "ぷつぷつ",
  calm: "ぷち…",
  still: "シーン…",
};
