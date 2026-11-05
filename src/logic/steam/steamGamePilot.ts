/**
 * Steam Gameplay Pilot (Issue #755): fire control + judgement of when to lift the lid.
 *
 * PREVIEW EXPERIMENT ONLY. This model is NOT wired into the game, reducer, score,
 * save, inventory, recipes, Dex or production Steam #738. The old A/B flows stay
 * intact. All times come from the caller; no timers or random numbers live here.
 *
 * High fire opens the shells sooner, but overcooks them quickly after opening.
 * Low fire takes longer, and gives the player a more forgiving opening window.
 */
import { STEAM_SHELL_THRESHOLDS, steamOpenCount } from "./steamPot";

export type SteamGameHeat = "low" | "high";
export type SteamGameOutcome = "tooEarly" | "justRight" | "overcooked";

export const STEAM_GAME_HEAT_PER_SECOND = { low: 0.11, high: 0.20 } as const;
export const STEAM_GAME_OVER_PER_SECOND = { low: 0.27, high: 1.0 } as const;
export const STEAM_GAME_OVER_LIMIT = 1.6;
export const STEAM_GAME_FULL_LEVEL = STEAM_SHELL_THRESHOLDS[STEAM_SHELL_THRESHOLDS.length - 1];

export const STEAM_GAME_RESULT_COPY: Record<SteamGameOutcome, string> = {
  tooEarly: "まだ早い！ 貝が開ききっていない",
  justRight: "ふっくら！ ちょうどいい蒸し加減",
  overcooked: "蒸しすぎ！ 身が縮んでしまった",
};

export interface SteamGameCooking {
  status: "cooking";
  /** Start and last applied event time, on the same monotonic clock. */
  startedAt: number;
  lastAt: number;
  heat: SteamGameHeat;
  /** Accumulated cooking progress (0..1). */
  level: number;
  /** Overcooking exposure accrued only after all shells have opened. */
  over: number;
}

export interface SteamGameResult {
  outcome: SteamGameOutcome;
  openCount: number;
  level: number;
  over: number;
  elapsedMs: number;
}

export type SteamGameState =
  | { status: "idle" }
  | SteamGameCooking
  | { status: "released"; result: SteamGameResult };

export type SteamGameAction =
  | { type: "START"; now: number }
  | { type: "SET_HEAT"; heat: SteamGameHeat; now: number }
  | { type: "OPEN"; now: number }
  | { type: "INTERRUPT" }
  | { type: "RETRY" };

export const STEAM_GAME_IDLE: SteamGameState = { status: "idle" };

function validTime(now: number, lastAt: number): boolean {
  return Number.isFinite(now) && now >= lastAt;
}

/**
 * Settle the old heat setting first, up to the supplied event time. Reading a
 * snapshot never mutates the model. Crossing the last shell's threshold within
 * an interval charges only the time *after* the crossing as overcook exposure.
 */
export function steamGameAdvance(s: SteamGameCooking, now: number): SteamGameCooking {
  if (!validTime(now, s.lastAt) || now === s.lastAt) return s;
  const elapsedSeconds = (now - s.lastAt) / 1000;
  const rate = STEAM_GAME_HEAT_PER_SECOND[s.heat];
  const untilFullSeconds = Math.max(0, (STEAM_GAME_FULL_LEVEL - s.level) / rate);
  const timeOverSeconds = Math.max(0, elapsedSeconds - untilFullSeconds);
  return {
    ...s,
    lastAt: now,
    level: Math.min(1, s.level + elapsedSeconds * rate),
    over: s.over + timeOverSeconds * STEAM_GAME_OVER_PER_SECOND[s.heat],
  };
}

export function steamGameOutcome(level: number, over: number): SteamGameOutcome {
  if (steamOpenCount(level) < STEAM_SHELL_THRESHOLDS.length) return "tooEarly";
  if (over >= STEAM_GAME_OVER_LIMIT) return "overcooked";
  return "justRight";
}

/** State used for painting shells, steam and body shape; never a numeric UI gauge. */
export function steamGameSnapshot(state: SteamGameState, now: number) {
  const s = state.status === "cooking" ? steamGameAdvance(state, now) : state;
  if (s.status === "idle") {
    return { status: s.status, heat: null, level: 0, openCount: 0, overcooked: false, outcome: null };
  }
  if (s.status === "released") {
    return {
      status: s.status,
      heat: null,
      level: s.result.level,
      openCount: s.result.openCount,
      overcooked: s.result.outcome === "overcooked",
      outcome: s.result.outcome,
    };
  }
  return {
    status: s.status,
    heat: s.heat,
    level: s.level,
    openCount: steamOpenCount(s.level),
    overcooked: s.over >= STEAM_GAME_OVER_LIMIT,
    outcome: null,
  };
}

export function steamGameReducer(state: SteamGameState, action: SteamGameAction): SteamGameState {
  switch (action.type) {
    case "START":
      return state.status === "idle" && Number.isFinite(action.now)
        ? { status: "cooking", startedAt: action.now, lastAt: action.now, heat: "low", level: 0, over: 0 }
        : state;
    case "SET_HEAT":
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt)) return state;
      if (action.heat !== "low" && action.heat !== "high") return state;
      return { ...steamGameAdvance(state, action.now), heat: action.heat };
    case "OPEN": {
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt)) return state;
      const s = steamGameAdvance(state, action.now);
      return {
        status: "released",
        result: {
          outcome: steamGameOutcome(s.level, s.over),
          openCount: steamOpenCount(s.level),
          level: s.level,
          over: s.over,
          elapsedMs: action.now - s.startedAt,
        },
      };
    }
    case "INTERRUPT":
      return state.status === "cooking" ? STEAM_GAME_IDLE : state;
    case "RETRY":
      return STEAM_GAME_IDLE;
  }
}
