/**
 * Issue #356 (Discovery 3.1) Slice 2: the single switch for Correct Ingredient Identification.
 *
 * The same shape as the Hint 5.0 flag (./hint5Flag.ts) but without a new Preview module: a Production build
 * (`import.meta.env.DEV` and `VITE_PREVIEW_MODE` both absent) is OFF; dev / Preview builds are ON, with a dev-only
 * opt-out (`localStorage["teto.dev.researchIdentify"] = "0"`) so a layout baseline without the feature can be taken.
 * OFF means the existing Production behavior: no selector, no picker, no RESULT line, and `SET_RESEARCH_TEST` is a
 * no-op, so no declaration can exist. Rollback is a one-line change of the default below.
 */
export const RESEARCH_IDENTIFY_DEV_OPT_OUT_KEY = "teto.dev.researchIdentify";

/** Production default (#356 Rollout: ships OFF; enabled only after the Preview Human Playtest). */
const RESEARCH_IDENTIFY_PRODUCTION_DEFAULT = false;

function resolveFlag(): boolean {
  if (!(import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE)) return RESEARCH_IDENTIFY_PRODUCTION_DEFAULT;
  try {
    return globalThis.localStorage?.getItem(RESEARCH_IDENTIFY_DEV_OPT_OUT_KEY) !== "0";
  } catch {
    return true;
  }
}

export const RESEARCH_IDENTIFY_ENABLED: boolean = resolveFlag();
