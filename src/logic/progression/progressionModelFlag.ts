/**
 * B案再構成 Phase 1a (Issue #901): the feature flag that picks the progression model.
 * Design: docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md §3.2.1. Same shape as
 * ../discovery/hint5Flag.ts.
 *
 * - **Production:** `PROGRESSION_MODEL_PRODUCTION_DEFAULT` (`"legacy"`), the one place the default is written. Production
 *   builds have no other input.
 * - **Preview / DEV only:** `?progression=shop|legacy`, remembered in a Preview-only key (./progressionPreviewOptIn.ts).
 * - **DEV only:** `localStorage["teto.dev.progressionModel"] = "shop" | "legacy"`. Compiled out of every non-DEV build,
 *   Preview included (../../preview/previewIsolation.gate.test.ts scans for it).
 *
 * The flag is per build / page load, never per save (design §3.2.1). In Phase 1a `"shop"` selects a placeholder that
 * returns the legacy outputs (./progressionModel.ts `SHOP_PROGRESSION`), and nothing in the UI reads the flag.
 */
import type { ProgressionModelId } from "./progressionModelId";
import { resolveProgressionPreviewDecision } from "./progressionPreviewOptIn";

export type { ProgressionModelId } from "./progressionModelId";

export const PROGRESSION_MODEL_DEV_KEY = "teto.dev.progressionModel";

/** The production default. Phase 4 (Authority cutover) changes this one literal; setting it back is the rollback. */
const PROGRESSION_MODEL_PRODUCTION_DEFAULT: ProgressionModelId = "legacy";

// The env checks sit inside `try`: Vite replaces them statically (a production build folds them and drops the rest), and
// plain Node -- Playwright specs that import game modules -- has no `import.meta.env`, so it lands on the production default.
function devChoice(): ProgressionModelId | null {
  try {
    if (!import.meta.env.DEV) return null;
    const stored = globalThis.localStorage?.getItem(PROGRESSION_MODEL_DEV_KEY);
    return stored === "shop" || stored === "legacy" ? stored : null;
  } catch {
    return null;
  }
}

function previewChoice(): ProgressionModelId | null {
  try {
    if (!(import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE)) return null;
    return resolveProgressionPreviewDecision(globalThis.location?.search ?? "", globalThis.localStorage ?? null);
  } catch {
    return null;
  }
}

/** The Preview instruction wins, then the DEV key, then the production default. */
function resolveProgressionModelId(): ProgressionModelId {
  return previewChoice() ?? devChoice() ?? PROGRESSION_MODEL_PRODUCTION_DEFAULT;
}

/** Resolved once per page load (a module constant, like `HINT5_LADDER_ENABLED`). */
export const PROGRESSION_MODEL_ID: ProgressionModelId = resolveProgressionModelId();

export function progressionModelId(): ProgressionModelId {
  return PROGRESSION_MODEL_ID;
}
