/**
 * Discovery Hint 5.0 (Issue #292), H5-6: the runtime switch for the Sub-topping Classification Ladder.
 *
 * **ON in production (OD-H5-ACTIVATION, after the Owner's iPhone Human Verification A to G).** With the
 * flag on, the H5-1 ladder authority (./hint5Ladder.ts) serves every Hint 5.0 target and the sheet renders
 * the ladder. The 材料 / 構成 / 特徴 purchases are refused, so sub-topping names are never sold
 * (OD-H5-C3, OD-H5-RETIRE). OD-H5-M2 = all 25: the target set is every production recipe. Bought facts
 * stay; there is no save migration.
 *
 * **Rollback.** Set `HINT5_LADDER_PRODUCTION_DEFAULT` back to `false`: the reducer and the sheet then
 * behave exactly as before H5-2 (../../state/gameReducer.hint5.flagOff.test.ts pins that).
 *
 * **Preview / DEV only (H5-5).** In a Preview build (`VITE_PREVIEW_MODE`) or a DEV server, `?hint5=0`
 * turns the ladder off and `?hint5=1` turns it on; each choice is remembered in a Preview-only key, so it
 * survives a reload without the parameter. Production
 * builds have none of it.
 *
 * **DEV-only opt-OUT (tests).** In a DEV server, `localStorage["teto.dev.hint5Ladder"] = "0"` turns the
 * ladder off, so the e2e suites of the pre-Hint-5.0 purchase path (the rollback path) can still run. The
 * old DEV opt-IN (`"1"`) is gone and does nothing: the flag is on by default. A production / Preview build is
 * not DEV, so this key is compiled out of it (../../preview/previewIsolation.gate.test.ts scans for it).
 */
import { resolveHint5PreviewDecision, type Hint5PreviewDecision } from "../../preview/hint5PreviewOptIn";

export const HINT5_DEV_OPT_IN_KEY = "teto.dev.hint5Ladder";

/** DEV server only: the stored value "0" turns the ladder off (see the header). Anything else is ignored. */
function devOptOut(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return globalThis.localStorage?.getItem(HINT5_DEV_OPT_IN_KEY) === "0";
  } catch {
    return false;
  }
}

/** The production default. `false` is the rollback (the pre-H5-2 sheet). */
const HINT5_LADDER_PRODUCTION_DEFAULT = true;

/**
 * H5-5 (Preview only): the URL / stored opt-in of ../../preview/hint5PreviewOptIn.ts. It is reachable
 * only behind `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE` (the same principle as
 * `DINNER_PREVIEW_ALLOWED` in ../../App.tsx). Vite replaces both statically, so a production build
 * (which never sets `VITE_PREVIEW_MODE`) drops the helper, its key and the URL parser
 * (../../preview/previewIsolation.gate.test.ts scans the production bundle for them).
 */
function previewDecision(): Hint5PreviewDecision {
  if (!(import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE)) return "none";
  try {
    return resolveHint5PreviewDecision(globalThis.location?.search ?? "", globalThis.localStorage ?? null);
  } catch {
    return "none";
  }
}

/**
 * The Preview instruction, when there is one, wins (`?hint5=0` is a Preview / DEV kill switch that
 * production builds never see); otherwise the production default applies.
 */
function resolveFlag(): boolean {
  const decision = previewDecision();
  if (decision === "on") return true;
  if (decision === "off") return false;
  if (devOptOut()) return false;
  return HINT5_LADDER_PRODUCTION_DEFAULT;
}

export const HINT5_LADDER_ENABLED: boolean = resolveFlag();
