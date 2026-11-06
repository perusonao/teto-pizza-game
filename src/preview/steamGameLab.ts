/**
 * Issue #755 / PR #756 (S5b): the Steam Gameplay Lab -- a standalone Preview / DEV-only mini game ("火加減 × 開けどき"), opened with
 * `?steamGameLab=on` (exactly once). It plays the pure pilot model (../logic/steam/steamGamePilot.ts) on its own screen and nothing else:
 * no reducer dispatch, inventory, score, recipe, Dex, pendingRound, save or storage, and no link to the Steam #738 UI. State dies on reload.
 *
 * Isolation: ../main.tsx reaches it only behind `import.meta.env.DEV || VITE_PREVIEW_MODE` (a production build replaces both statically and
 * drops the query name and the lazily imported chunk; ./steamGameLab.gate.test.ts scans a real build).
 */
import { STEAM_SHELL_THRESHOLDS } from "../logic/steam/steamPot";

export {
  STEAM_GAME_FULL_LEVEL,
  STEAM_GAME_IDLE,
  STEAM_GAME_OVER_LIMIT,
  STEAM_GAME_RESULT_COPY,
  steamGameAdvance,
  steamGameReducer,
  steamGameSnapshot,
  type SteamGameAction,
  type SteamGameCooking,
  type SteamGameHeat,
  type SteamGameOutcome,
  type SteamGameState,
} from "../logic/steam/steamGamePilot";

export const STEAM_GAME_LAB_PARAM = "steamGameLab";
export const STEAM_GAME_LAB_ON_VALUE = "on";
export const STEAM_GAME_LAB_MARK = "steam-game-lab-v1";
export const STEAM_GAME_LAB_LABEL = "試作・保存されません";

/** True when the query string asks for the lab exactly once. */
export function resolveSteamGameLabOptIn(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(STEAM_GAME_LAB_PARAM);
  return all.length === 1 && all[0] === STEAM_GAME_LAB_ON_VALUE;
}

let cachedOptIn: boolean | undefined;
export function resetSteamGameLabForTest(): void {
  cachedOptIn = undefined;
}
/** Whether the Preview / DEV query opted in. Read once per page load; never true in production. */
export function steamGameLabOptedIn(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOptIn === undefined) cachedOptIn = resolveSteamGameLabOptIn(typeof window === "undefined" ? "" : window.location.search);
    return cachedOptIn;
  }
  return false;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** How far each shell is open (0 closed .. 1 fully open): it finishes opening exactly at its steam threshold, so the 5 shells open one after another. */
export function shellOpenness(level: number): number[] {
  return STEAM_SHELL_THRESHOLDS.map((t) => clamp01((level - (t - 0.1)) / 0.1));
}

export type Rgb = readonly [number, number, number];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * clamp01(t))) as unknown as Rgb;
export const rgb = (c: Rgb): string => `rgb(${c[0]},${c[1]},${c[2]})`;
const RAW: Rgb = [233, 222, 200];
const COOKED: Rgb = [244, 160, 60];
const LIMP: Rgb = [128, 86, 58];

/**
 * What the player reads off the pot: flesh colour (pale -> orange as the steam builds, then brown as it overcooks), flesh size (plump while
 * cooking, shrinking when overcooked) and how limp the shells look. `overFrac` is overcook exposure / limit, 0..1+.
 */
export function fleshLook(level: number, overFrac: number): { color: string; scale: number; limp: number } {
  const done = clamp01(level / 0.78);
  const limp = clamp01(overFrac);
  const base = mix(RAW, COOKED, done);
  return { color: rgb(mix(base, LIMP, limp)), scale: 0.45 + 0.55 * done - 0.4 * limp, limp };
}
