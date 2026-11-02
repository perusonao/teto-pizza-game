/**
 * Cooking Steam Phase 1 (Issue #726), S1: operation B -- shake the pot side to side (pure).
 *
 * Each sweep of the finger across the pot adds steam; when the shaking stops the steam fades. A tap on the shake button adds steam too (the required
 * alternative to dragging: no precise gesture, works with the keyboard). OPEN lifts the lid and keeps whatever the shells reached. Nothing is judged and there
 * is no time-out. The clock is always passed in; the fade is evaluated lazily at read time, so there is no timer in the state.
 */
import { clamp01, steamResultOf, type SteamResult } from "./steamPot";

/** A sweep counts when the finger moves this fraction of the pot's width against the way it was going. */
export const STEAM_SHAKE_STROKE_MIN = 0.18;
/** Steam added by one sweep. */
export const STEAM_PER_STROKE = 0.07;
/** Steam added by one tap on the shake button / Space / Enter. */
export const STEAM_PER_TAP = 0.1;
/** The steam holds this long after the last input, then fades. */
export const STEAM_DECAY_GRACE_MS = 400;
/** Fade speed (level per second) once the grace is over. */
export const STEAM_DECAY_PER_S = 0.12;
/** Lifting the lid sooner than this after the first input keeps nothing. */
export const STEAM_SHAKE_MIN_MS = 800;

export interface SteamShaking {
  status: "steaming";
  startedAt: number;
  /** The level AT `lastInputAt` (the fade after it is applied on read). */
  level: number;
  lastInputAt: number;
  /** The way the finger is going: -1 left, 1 right, 0 not yet known. */
  dir: -1 | 0 | 1;
  /** Where the current sweep started (dir 0) or its furthest point so far (dir +-1); null before the first move. */
  anchorX: number | null;
  /** When the level reached 1 and has stayed there (null otherwise). */
  fullSince: number | null;
}

export type SteamShake = { status: "idle"; tooShort?: boolean } | SteamShaking | { status: "released"; result: SteamResult; elapsedMs: number };

export type SteamShakeAction =
  /** The pointer is at `x` inside a pot `width` wide (same unit). */
  | { type: "MOVE"; now: number; x: number; width: number }
  | { type: "TAP"; now: number }
  | { type: "OPEN"; now: number }
  | { type: "CANCEL" }
  | { type: "INTERRUPT" };

export const STEAM_SHAKE_IDLE: SteamShake = { status: "idle" };

/** The steam level at `now`: the level at the last input minus the fade after the grace (never below 0; a clock before the last input -> that level). */
export function steamShakeLevelAt(s: SteamShaking, now: number): number {
  const sinceMs = now - s.lastInputAt - STEAM_DECAY_GRACE_MS;
  if (!Number.isFinite(sinceMs) || sinceMs <= 0) return clamp01(s.level);
  return clamp01(s.level - (STEAM_DECAY_PER_S * sinceMs) / 1000);
}

function start(now: number): SteamShaking {
  return { status: "steaming", startedAt: now, level: 0, lastInputAt: now, dir: 0, anchorX: null, fullSince: null };
}

/** Levels are kept to 1e-9 so that ten taps of 0.1 are exactly 1 (not 0.9999999999999999) and the thresholds compare cleanly. */
const tidy = (n: number): number => Math.round(n * 1e9) / 1e9;

/** Settle the fade up to `now`, then add `gain` at `now`. */
function addSteam(s: SteamShaking, now: number, gain: number): SteamShaking {
  const settled = steamShakeLevelAt(s, now);
  const level = clamp01(tidy(settled + gain));
  const fullSince = level >= 1 ? (settled >= 1 && s.fullSince !== null ? s.fullSince : now) : null;
  return { ...s, level, lastInputAt: now, fullSince };
}

export function steamShakeReducer(state: SteamShake, action: SteamShakeAction): SteamShake {
  switch (action.type) {
    case "MOVE": {
      if (state.status === "released") return state;
      if (!Number.isFinite(action.now) || !Number.isFinite(action.x) || !Number.isFinite(action.width) || action.width <= 0) return state;
      const s = state.status === "steaming" ? state : start(action.now);
      if (action.now < s.lastInputAt) return state; // the clock ran backwards
      const min = STEAM_SHAKE_STROKE_MIN * action.width;
      if (s.anchorX === null) return { ...s, anchorX: action.x };
      if (s.dir === 0) {
        const dx = action.x - s.anchorX;
        if (Math.abs(dx) < min) return s;
        // The first sweep fixes the direction and counts as a stroke.
        return { ...addSteam(s, action.now, STEAM_PER_STROKE), dir: dx > 0 ? 1 : -1, anchorX: action.x };
      }
      // Still going the same way: follow the furthest point, no steam. A move against it by `min` completes the sweep (at most one per MOVE).
      if ((action.x - s.anchorX) * s.dir >= 0) return { ...s, anchorX: action.x };
      if ((s.anchorX - action.x) * s.dir >= min) return { ...addSteam(s, action.now, STEAM_PER_STROKE), dir: s.dir === 1 ? -1 : 1, anchorX: action.x };
      return s;
    }
    case "TAP": {
      if (state.status === "released" || !Number.isFinite(action.now)) return state;
      const s = state.status === "steaming" ? state : start(action.now);
      if (action.now < s.lastInputAt) return state;
      return addSteam(s, action.now, STEAM_PER_TAP);
    }
    case "OPEN": {
      if (state.status !== "steaming") return state;
      const elapsedMs = action.now - state.startedAt;
      if (!Number.isFinite(elapsedMs) || elapsedMs < STEAM_SHAKE_MIN_MS) return { status: "idle", tooShort: true };
      const level = steamShakeLevelAt(state, action.now);
      // Full steam only counts as held while it has not started to fade.
      const overMs = level >= 1 && state.fullSince !== null ? action.now - state.fullSince : 0;
      return { status: "released", result: steamResultOf(level, overMs), elapsedMs };
    }
    case "CANCEL":
      return STEAM_SHAKE_IDLE;
    case "INTERRUPT":
      return state.status === "steaming" ? STEAM_SHAKE_IDLE : state;
  }
}
