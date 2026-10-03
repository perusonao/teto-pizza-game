/**
 * The single switch for RESULT-based identification (Anti-Oracle Contract 2.1; originally added for #356, and reused
 * as Contract 2.1's flag, OD-RB-16).
 *
 * The same shape as the Hint 5.0 flag (./hint5Flag.ts) but without a new Preview module: a Production build
 * (`import.meta.env.DEV` and `VITE_PREVIEW_MODE` both absent) follows `RESEARCH_IDENTIFY_PRODUCTION_DEFAULT` (ON) and has no opt-out; dev / Preview builds are ON, with a dev-only
 * opt-out (`localStorage["teto.dev.researchIdentify"] = "0"`) so a layout baseline without the feature can be taken.
 * OFF means the existing Production behavior: no RESULT membership rows, no `ing:` facts from an attempt and no
 * RESEARCH_ROWS Notebook line. Rollback is a one-line change of the default below.
 */
export const RESEARCH_IDENTIFY_DEV_OPT_OUT_KEY = "teto.dev.researchIdentify";

/** Production default. ON since the Contract 2.1 Production Activation (Gate C READY = YES, Owner Preview HV PASS). Rollback = set this back to false. */
const RESEARCH_IDENTIFY_PRODUCTION_DEFAULT = true;

function resolveFlag(): boolean {
  if (!(import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE)) return RESEARCH_IDENTIFY_PRODUCTION_DEFAULT;
  try {
    return globalThis.localStorage?.getItem(RESEARCH_IDENTIFY_DEV_OPT_OUT_KEY) !== "0";
  } catch {
    return true;
  }
}

export const RESEARCH_IDENTIFY_ENABLED: boolean = resolveFlag();
