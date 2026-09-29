/**
 * Discovery Hint 5.0 (Issue #292), H5-2 / H5-3: the runtime switch for the Sub-topping Classification
 * Ladder.
 *
 * **OFF by default in every build, production included.** With the flag off, the reducer and the
 * hint sheet behave exactly as before H5-2:
 * - PURCHASE_HINT5_RUNG is a no-op;
 * - the 材料 / 構成 / 特徴 sheet is unchanged.
 *
 * With the flag on (unit tests and DEV-only experiments), the H5-1 ladder authority (./hint5Ladder.ts)
 * serves every Hint 5.0 target and the sheet renders the ladder. The 材料 / 構成 / 特徴 purchases are
 * then refused, so sub-topping names are never sold (OD-H5-C3, OD-H5-RETIRE). OD-H5-M2 = all 25
 * (round 6): the flag-ON target set is every production recipe, with no per-recipe list. H5-4 keeps
 * the flag OFF; turning it on in production is a separate Owner decision.
 *
 * **DEV-only opt-in (H5-3, for E2E and Human Verification recordings).** In a DEV server
 * (`import.meta.env.DEV`), setting `localStorage["teto.dev.hint5Ladder"] = "1"` before the app loads
 * turns the flag on. A production / Preview build is not DEV, so this is always `false` there. A
 * failing storage read is `false`.
 *
 * **Preview opt-in (H5-5, for the Owner's iPhone Human Verification).** In a Preview build
 * (`VITE_PREVIEW_MODE`, or a DEV server) `?hint5=1` turns the ladder on and remembers it in a Preview-only
 * key; `?hint5=0` turns it off. Production builds have none of it.
 *
 * ../../state/gameReducer.hint5.flagOff.test.ts pins the flag-off parity.
 */
import { resolveHint5PreviewOptIn } from "../../preview/hint5PreviewOptIn";

export const HINT5_DEV_OPT_IN_KEY = "teto.dev.hint5Ladder";

function devOptIn(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return globalThis.localStorage?.getItem(HINT5_DEV_OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * H5-5 (Preview only): the URL / stored opt-in of ../../preview/hint5PreviewOptIn.ts. It is reachable
 * only behind `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE` (the same principle as
 * `DINNER_PREVIEW_ALLOWED` in ../../App.tsx). Vite replaces both statically, so a production build
 * (which never sets `VITE_PREVIEW_MODE`) drops the helper, its key and the URL parser
 * (../../preview/previewIsolation.gate.test.ts scans the production bundle for them).
 */
function previewOptIn(): boolean {
  if (!(import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE)) return false;
  try {
    return resolveHint5PreviewOptIn(globalThis.location?.search ?? "", globalThis.localStorage ?? null);
  } catch {
    return false;
  }
}

export const HINT5_LADDER_ENABLED: boolean = devOptIn() || previewOptIn();
