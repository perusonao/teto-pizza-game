/**
 * Cooking Steam Phase 1 (Issue #726), S1: operation A -- tap the lid, wait, lift it (pure).
 *
 * CLOSE puts the lid on and the steam builds with time alone; OPEN lifts it and keeps whatever the shells reached. Nothing is judged and there is no
 * time-out. A lift that comes too early is a stray tap and keeps nothing. The clock is always passed in (this file never reads the time).
 */
import { steamResultOf, type SteamResult } from "./steamPot";

/** Lid-on time at which every shell is open. Preview / DEV can compare other values (S3). */
export const STEAM_LID_FULL_MS = 4500;
/** Lifting the lid sooner than this keeps nothing. */
export const STEAM_LID_MIN_MS = 600;

export type SteamLid =
  | { status: "idle"; tooShort?: boolean }
  | { status: "steaming"; startedAt: number }
  | { status: "released"; result: SteamResult; elapsedMs: number };

export type SteamLidAction =
  | { type: "CLOSE"; now: number }
  /** `fullMs` (OPEN): the lid-on time that opens every shell; absent / invalid = STEAM_LID_FULL_MS. */
  | { type: "OPEN"; now: number; fullMs?: number }
  | { type: "CANCEL" }
  /** The lid button lost focus mid-steam: drop a steam in progress and nothing else (a kept result must survive the button being removed). */
  | { type: "INTERRUPT" };

export const STEAM_LID_IDLE: SteamLid = { status: "idle" };

const validFullMs = (fullMs: number | undefined): number => (typeof fullMs === "number" && Number.isFinite(fullMs) && fullMs > 0 ? fullMs : STEAM_LID_FULL_MS);

/** Steam level (0..1) after `elapsedMs` with the lid on: linear; non-finite / negative -> 0. */
export function steamLidLevelAt(elapsedMs: number, fullMs: number = STEAM_LID_FULL_MS): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(1, elapsedMs / validFullMs(fullMs));
}

export function steamLidReducer(state: SteamLid, action: SteamLidAction): SteamLid {
  switch (action.type) {
    case "CLOSE":
      return state.status === "idle" && Number.isFinite(action.now) ? { status: "steaming", startedAt: action.now } : state;
    case "OPEN": {
      if (state.status !== "steaming") return state;
      const elapsedMs = action.now - state.startedAt;
      if (!Number.isFinite(elapsedMs) || elapsedMs < STEAM_LID_MIN_MS) return { status: "idle", tooShort: true };
      const fullMs = validFullMs(action.fullMs);
      return { status: "released", result: steamResultOf(steamLidLevelAt(elapsedMs, fullMs), elapsedMs - fullMs), elapsedMs };
    }
    case "CANCEL":
      return STEAM_LID_IDLE;
    case "INTERRUPT":
      return state.status === "steaming" ? STEAM_LID_IDLE : state;
  }
}
