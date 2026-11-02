/**
 * Cooking Steam Phase 1 (Issue #726), S1: what the steam pot shows and keeps, shared by both operations (pure).
 *
 * The shells open at fixed steam levels -- no randomness -- so the same input always draws the same pot. There is no pass / fail, no target window and no
 * gauge: every look is a fine result and nothing here is read by scoring, identification, saves or the pending-round journal. All numbers are PROVISIONAL
 * until the iPhone HV (one place, here).
 *
 *   level (0..1)  how much steam has built up
 *   amount (0..1) the one number kept for the placed piece: the level, capped at STEAM_AMOUNT_OPEN_MAX; exactly 1 only for the "over" look
 */

/** The level at which shell i opens (ascending). */
export const STEAM_SHELL_THRESHOLDS = [0.3, 0.42, 0.54, 0.66, 0.78] as const;
export const STEAM_SHELL_COUNT = STEAM_SHELL_THRESHOLDS.length;
/** Once every shell is open, staying at full steam this long leaves the shells limp ("over"). */
export const STEAM_OVER_MS = 3000;
/** The largest `amount` any look but "over" keeps, so `amount` alone still tells "open" from "over". */
export const STEAM_AMOUNT_OPEN_MAX = 0.95;
/** `amount` of the "over" look. */
export const STEAM_AMOUNT_OVER = 1;

/** The two operations under comparison (Owner 2026-11-02): tap the lid, or shake the pot side to side. */
export type SteamVariant = "lid" | "shake";

export type SteamLook = "closed" | "partial" | "open" | "over";

export interface SteamResult {
  /** 0..1, see the header. */
  amount: number;
  /** 0..STEAM_SHELL_COUNT shells open. */
  openCount: number;
  look: SteamLook;
}

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** How many shells are open at `level` (non-finite -> 0, clamped to 0..1). */
export function steamOpenCount(level: number): number {
  const l = clamp01(level);
  return STEAM_SHELL_THRESHOLDS.filter((t) => l >= t).length;
}

/** The look at `level`; `overMs` is how long full steam has been held (non-finite / negative -> 0). "over" needs every shell open first. */
export function steamLookOf(level: number, overMs: number): SteamLook {
  const open = steamOpenCount(level);
  if (open === 0) return "closed";
  if (open < STEAM_SHELL_COUNT) return "partial";
  return Number.isFinite(overMs) && overMs >= STEAM_OVER_MS ? "over" : "open";
}

export function steamResultOf(level: number, overMs: number): SteamResult {
  const look = steamLookOf(level, overMs);
  const l = clamp01(level);
  return {
    amount: look === "over" ? STEAM_AMOUNT_OVER : Math.min(l, STEAM_AMOUNT_OPEN_MAX),
    openCount: steamOpenCount(l),
    look,
  };
}

/** The look a kept `amount` stands for (the inverse of `steamResultOf`'s `amount`). Non-finite -> "closed". */
export function steamLookOfAmount(amount: number): SteamLook {
  return clamp01(amount) >= STEAM_AMOUNT_OVER ? "over" : steamLookOf(amount, 0);
}

/** Words for the result. Descriptive, never a grade: there is no right one. */
export const STEAM_LOOK_COPY: Record<SteamLook, string> = {
  closed: "まだ閉じてる",
  partial: "ちょっと開いた",
  open: "ぱっくり開いた",
  over: "くたっとしぼんだ",
};

/** Short words while the pot is steaming (no gauge, no number, no time left). */
export const STEAM_LOOK_LIVE: Record<SteamLook, string> = {
  closed: "ふつふつ…",
  partial: "ぽん、ぽん",
  open: "ぱかっ",
  over: "くたくた…",
};
