import { DEFAULT_LAB_SCENARIO_ID } from "../components/midBakeLab/labIngredients";

/**
 * MID_BAKE Lab entry (Issue #795, stage C-2). A DEV / Preview-only, independent screen opened with `?dev=midbake`
 * (src/main.tsx, the same static env gate as `?dev=postlayer`). It never loads <App />, the real save or any HOT file, so a
 * production build drops it together with the dynamically imported Lab chunk (src/preview/previewIsolation.gate.test.ts).
 *
 * Query parameters (Lab only):
 * - `scenario=<id>`: which ingredient to verify (default natto).
 * - `hold=<ms>`: hold-timeout override for quick checks, clamped to [500, 60000]. The default is the PROVISIONAL Lab value
 *   (6 s, `LAB_HOLD_TIMEOUT_MS_PROVISIONAL`), not a Production specification.
 */
export const MID_BAKE_LAB_MARK = "mid-bake-lab-v1";

export interface MidBakeLabParams {
  readonly scenarioId: string;
  readonly holdTimeoutMs: number | undefined;
}

export const MID_BAKE_LAB_MIN_HOLD_MS = 500;
export const MID_BAKE_LAB_MAX_HOLD_MS = 60_000;

export function parseMidBakeLabSearch(search: string): MidBakeLabParams {
  const params = new URLSearchParams(search);
  const raw = params.get("hold");
  const parsed = raw === null || raw.trim() === "" ? NaN : Number(raw);
  return {
    scenarioId: params.get("scenario") || DEFAULT_LAB_SCENARIO_ID,
    holdTimeoutMs: Number.isFinite(parsed) ? Math.min(MID_BAKE_LAB_MAX_HOLD_MS, Math.max(MID_BAKE_LAB_MIN_HOLD_MS, parsed)) : undefined,
  };
}
