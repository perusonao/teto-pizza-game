/**
 * Discovery Hint 5.0 (Issue #292), H5-5: the Preview-only opt-in for the Hint 5.0 ladder, so the Owner
 * can verify it on an iPhone before any production activation. Docs: docs/reports/
 * TETO_DISCOVERY-HINT-5_H5-5_Preview-Enablement_Result.md.
 *
 * **Isolation (the same principle as `DINNER_PREVIEW_ALLOWED` in ../App.tsx).** Only
 * ./hint5Flag.ts imports this module, and it calls it only behind
 * `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE`. Vite replaces both statically, so a
 * production `vite build` (which never sets `VITE_PREVIEW_MODE`) drops this module. That is a gate:
 * ./previewIsolation.gate.test.ts builds the production bundle and scans it for `PREVIEW_HELPER_MARK`,
 * the opt-in key and the seed ids.
 *
 * The on / off choice lives in its own Preview-only localStorage key, apart from the save (which a Preview
 * build already keeps under `teto-pizza-preview-save-v1`, src/state/persistence.ts). Full Game Reset
 * clears the save only, so the opt-in survives it and the ladder stays on after a reset.
 */
import type { StorageLike } from "../state/persistence";

/** Present in this module and in ./hvSeeds.ts only. The production-bundle gate looks for it. */
export const PREVIEW_HELPER_MARK = "h5-preview-helper-v1";

export const HINT5_PREVIEW_OPT_IN_KEY = "teto-pizza-preview-hint5-optin";

export type Hint5PreviewParam = "on" | "off" | null;

/** `?hint5=1` turns the ladder on, `?hint5=0` turns it off (an explicit, remembered off), anything else leaves it as stored. */
export function parseHint5PreviewParam(search: unknown): Hint5PreviewParam {
  if (typeof search !== "string") return null;
  const value = new URLSearchParams(search).get("hint5");
  if (value === "1") return "on";
  if (value === "0") return "off";
  return null;
}

export type Hint5PreviewDecision = "on" | "off" | "none";

/**
 * What the Preview instruction says for this page load. Both directions are remembered in the Preview-only
 * key, so the choice survives a reload without the parameter: `?hint5=1` stores "1" (on), `?hint5=0` stores
 * "0" (an explicit off, distinct from "nothing stored"). With no parameter the stored value decides: "1" is
 * on, "0" is off, anything else (or nothing) is "none" and the production default applies (./hint5Flag.ts,
 * H5-6: ON). A failing storage never throws: the parameter still counts for this load, and the stored value
 * reads as "none".
 */
export function resolveHint5PreviewDecision(search: unknown, storage: StorageLike | null): Hint5PreviewDecision {
  const param = parseHint5PreviewParam(search);
  try {
    if (param === "on") {
      storage?.setItem(HINT5_PREVIEW_OPT_IN_KEY, "1");
      return "on";
    }
    if (param === "off") {
      storage?.setItem(HINT5_PREVIEW_OPT_IN_KEY, "0");
      return "off";
    }
    const stored = storage?.getItem(HINT5_PREVIEW_OPT_IN_KEY);
    if (stored === "1") return "on";
    if (stored === "0") return "off";
    return "none";
  } catch {
    return param ?? "none";
  }
}

/** Whether the Preview ladder is on for this page load (`resolveHint5PreviewDecision` is "on"). */
export function resolveHint5PreviewOptIn(search: unknown, storage: StorageLike | null): boolean {
  return resolveHint5PreviewDecision(search, storage) === "on";
}
