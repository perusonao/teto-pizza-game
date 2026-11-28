/**
 * B案再構成 Phase 1a (Issue #901): the feature flag that picks the progression model.
 * Design: docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md §3.2.1. Same shape as
 * ../discovery/hint5Flag.ts.
 *
 * - **Production:** `?progression=legacy` for the current page load, otherwise `PROGRESSION_MODEL_PRODUCTION_DEFAULT`.
 * - **Preview / DEV only:** `?progression=shop|legacy`, remembered in a Preview-only key (./progressionPreviewOptIn.ts).
 * - **DEV only:** `localStorage["teto.dev.progressionModel"] = "shop" | "legacy"`. Compiled out of every non-DEV build,
 *   Preview included (../../preview/previewIsolation.gate.test.ts scans for it).
 *
 * Shop selection requires a complete reputation table and curated catalog (Phase 4 switch design §2).
 */
import type { ProgressionModelId } from "./progressionModelId";
import { parseProgressionParam } from "./progressionParam";
import { resolveProgressionPreviewDecision } from "./progressionPreviewOptIn";
import { canEnableShopProgression } from "./reputationTable";

export type { ProgressionModelId } from "./progressionModelId";

export const PROGRESSION_MODEL_DEV_KEY = "teto.dev.progressionModel";

/** The production default. Phase 4 (Authority cutover) changes this one literal; setting it back is the rollback. */
const PROGRESSION_MODEL_PRODUCTION_DEFAULT: ProgressionModelId = "shop";

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
    return resolveProgressionPreviewDecision(globalThis.location?.search ?? "", globalThis.localStorage ?? null);
  } catch {
    return null;
  }
}

/** Resolve the candidate for this build, then apply the shop readiness gate. */
export function resolveProgressionModelId(defaultId: ProgressionModelId): ProgressionModelId {
  let requested = defaultId;
  try {
    if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
      requested = previewChoice() ?? devChoice() ?? defaultId;
    } else if (parseProgressionParam(globalThis.location?.search) === "legacy") {
      requested = "legacy";
    }
  } catch {
    // Plain Node imports (e.g. Playwright helpers) have no Vite environment.
  }
  return requested === "shop" && !canEnableShopProgression() ? "legacy" : requested;
}

/** Resolved once per page load (a module constant, like `HINT5_LADDER_ENABLED`). */
export const PROGRESSION_MODEL_ID: ProgressionModelId = resolveProgressionModelId(PROGRESSION_MODEL_PRODUCTION_DEFAULT);

export function progressionModelId(): ProgressionModelId {
  return PROGRESSION_MODEL_ID;
}
