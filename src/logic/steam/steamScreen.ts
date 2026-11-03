/**
 * Cooking Steam Phase 1 (#726, S3a): what the steam screen says and when (pure, no React).
 *
 * Only words, timing constants and the live steam level / look of the two operations. No gauge, number or countdown is ever produced here: the pot, the shells
 * and the steam are the only clues. Nothing is judged; every word describes. PROVISIONAL until the iPhone HV.
 */
import { STEAM_LID_FULL_MS, steamLidLevelAt, type SteamLid } from "./steamLid";
import { STEAM_LOOK_COPY, STEAM_LOOK_LIVE, STEAM_OVER_MS, STEAM_SHELL_COUNT, steamLookOf, steamOpenCount, type SteamLook, type SteamVariant } from "./steamPot";
import { steamShakeLevelAt, type SteamShake } from "./steamShake";

/** After a result is kept, its words show this long before the screen closes by itself. */
export const STEAM_DONE_MS = 900;
/** After the screen closes the stage ignores input for this long (a late tap must not reach the dough). */
export const STEAM_GUARD_MS = 300;
/** Repaint rate while steaming (~20Hz: smooth enough to watch the shells open, cheap enough for a phone). */
export const STEAM_TICK_MS = 50;

export type SteamMode = "idle" | "steaming" | "done";

export interface SteamLive {
  mode: SteamMode;
  /** 0..1 steam in the pot now (the kept amount once done). */
  level: number;
  /** How long full steam has been held, ms (0 unless every shell is open). */
  overMs: number;
  look: SteamLook;
  openCount: number;
}

const IDLE: SteamLive = { mode: "idle", level: 0, overMs: 0, look: "closed", openCount: 0 };

/** The pot as the lid operation shows it at `now` (a monotonic clock reading passed in). `fullMs` is the lid-on time that opens every shell. */
export function steamLidLive(state: SteamLid, now: number, fullMs: number = STEAM_LID_FULL_MS): SteamLive {
  if (state.status === "idle") return IDLE;
  if (state.status === "released") return { mode: "done", level: state.result.amount, overMs: state.result.look === "over" ? STEAM_OVER_MS : 0, look: state.result.look, openCount: state.result.openCount };
  const elapsed = Number.isFinite(now - state.startedAt) ? Math.max(0, now - state.startedAt) : 0;
  const level = steamLidLevelAt(elapsed, fullMs);
  const overMs = Math.max(0, elapsed - fullMs);
  return { mode: "steaming", level, overMs, look: steamLookOf(level, overMs), openCount: steamOpenCount(level) };
}

/** The pot as the shake operation shows it at `now`. Full steam only counts as held while it has not started to fade (same rule as OPEN). */
export function steamShakeLive(state: SteamShake, now: number): SteamLive {
  if (state.status === "idle") return IDLE;
  if (state.status === "released") return { mode: "done", level: state.result.amount, overMs: state.result.look === "over" ? STEAM_OVER_MS : 0, look: state.result.look, openCount: state.result.openCount };
  const level = steamShakeLevelAt(state, now);
  const overMs = level >= 1 && state.fullSince !== null ? Math.max(0, now - state.fullSince) : 0;
  return { mode: "steaming", level, overMs, look: steamLookOf(level, overMs), openCount: steamOpenCount(level) };
}

/** True when shell `index` (0-based) is open in a pot with `openCount` shells open. */
export const steamShellOpen = (index: number, openCount: number): boolean => index >= 0 && index < STEAM_SHELL_COUNT && index < openCount;

/** The headline words. `tooShort`: the last attempt was lifted too early and kept nothing. */
export function steamTitle(variant: SteamVariant, live: SteamLive, tooShort: boolean): string {
  if (live.mode === "done") return STEAM_LOOK_COPY[live.look];
  if (live.mode === "steaming") return STEAM_LOOK_LIVE[live.look];
  if (tooShort) return "もう少し蒸してね";
  return variant === "lid" ? "ふたをして、蒸そう" : "鍋をゆすって、蒸そう";
}

/** What a screen reader hears (no digits, no grade). */
export function steamAnnouncement(variant: SteamVariant, live: SteamLive): string {
  if (live.mode === "done") return STEAM_LOOK_COPY[live.look];
  if (live.mode === "steaming") return "蒸しています。ふたを開けると決まります";
  return variant === "lid" ? "ふたをして蒸します" : "鍋をゆすって蒸します";
}
