/**
 * MID_BAKE Lab entry (Issue #795, stage C-2): a standalone Preview / DEV-only screen opened with `?cookMidBakeHv=1` (exactly once).
 *
 * It exercises the MID_BAKE engine and the Lab clock (src/logic/midBake/labClock.ts) with NO link to the game: no reducer, no inventory,
 * no save, no storage, no normal BAKE, no Production gate. Everything is in memory and gone on reload.
 *
 * Isolation: ../main.tsx reaches the Lab only behind `import.meta.env.DEV || VITE_PREVIEW_MODE` (a production build replaces both statically and
 * drops the query names and the lazily imported chunk; ./midBakeLab.gate.test.ts scans a real build). Any other value, a repeat or none: off.
 * The Lab also stands aside whenever another dev / HV entry is asked for, so it can never run next to a seed or a disposable save.
 */

export const MID_BAKE_LAB_PARAM = "cookMidBakeHv";
export const MID_BAKE_LAB_ON_VALUE = "1";
export const MID_BAKE_LAB_MARK = "mid-bake-lab-v1";
export const MID_BAKE_LAB_LABEL = "MID_BAKE Lab（試作・保存されません）";
/** Optional Lab-only knobs (PROVISIONAL values for the Lab, not a Production specification). */
export const MID_BAKE_LAB_HOLD_MS_PARAM = "cookMidBakeHoldMs";
export const MID_BAKE_LAB_STOCK_PARAM = "cookMidBakeStock";

/** Query names of the other entries that seed or swap the save; the Lab never runs together with any of them. */
const OTHER_ENTRY_PARAMS = ["hv", "cookPrepHv", "cookSearHv", "cookSteamHv", "inspector", "dev", "drizzleLab"] as const;

const HOLD_MS_RANGE = { min: 100, max: 60000 } as const;
const STOCK_RANGE = { min: 1, max: 9 } as const;
export const MID_BAKE_LAB_DEFAULT_STOCK = 3;

/** True when the query asks for the Lab exactly once with the value 1 and no other dev / HV entry is asked for. */
export function resolveMidBakeLabOptIn(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const params = new URLSearchParams(search);
  const all = params.getAll(MID_BAKE_LAB_PARAM);
  if (all.length !== 1 || all[0] !== MID_BAKE_LAB_ON_VALUE) return false;
  return OTHER_ENTRY_PARAMS.every((name) => !params.has(name));
}

function integerParam(search: unknown, name: string, min: number, max: number): number | null {
  if (typeof search !== "string") return null;
  const all = new URLSearchParams(search).getAll(name);
  if (all.length !== 1 || !/^\d+$/.test(all[0])) return null;
  const value = Number(all[0]);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

/** The Lab's hold timeout override in ms (PROVISIONAL Lab value), or `null` for the default. */
export function resolveMidBakeLabHoldMs(search: unknown): number | null {
  return integerParam(search, MID_BAKE_LAB_HOLD_MS_PARAM, HOLD_MS_RANGE.min, HOLD_MS_RANGE.max);
}

/** The Lab's stand-in stock for the natto chip, or the default when absent or out of range. */
export function resolveMidBakeLabStock(search: unknown): number {
  return integerParam(search, MID_BAKE_LAB_STOCK_PARAM, STOCK_RANGE.min, STOCK_RANGE.max) ?? MID_BAKE_LAB_DEFAULT_STOCK;
}

let cachedOptIn: boolean | undefined;

/** Test seam: forget the cached page-load value. */
export function resetMidBakeLabForTest(): void {
  cachedOptIn = undefined;
}

/** Whether the Preview / DEV query opted in to the Lab. Read once per page load; never true in production. */
export function midBakeLabOptedIn(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOptIn === undefined) cachedOptIn = resolveMidBakeLabOptIn(typeof window === "undefined" ? "" : window.location.search);
    return cachedOptIn;
  }
  return false;
}
