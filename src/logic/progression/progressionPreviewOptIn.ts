/**
 * B案再構成 Phase 1a (Issue #901): the Preview / DEV-only instruction for the progression model
 * (`?progression=shop|legacy`). Design: docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md §3.2.1.
 *
 * **Isolation (the same principle as ../../preview/hint5PreviewOptIn.ts).** Only ./progressionModelFlag.ts imports
 * this module, and it calls it only behind `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE`. Vite replaces both
 * statically, so a production `vite build` drops this module and its key
 * (../../preview/previewIsolation.gate.test.ts scans the production bundle for the key).
 *
 * The choice is remembered in its own Preview-only localStorage key, apart from the save, so it survives a reload without
 * the parameter. A failing storage never throws: the parameter still counts for this page load.
 */
import type { StorageLike } from "../../state/persistence";
import type { ProgressionModelId } from "./progressionModelId";
import { parseProgressionParam } from "./progressionParam";

export const PROGRESSION_PREVIEW_KEY = "teto-pizza-preview-progression-model";

/**
 * What the Preview instruction says for this page load: the URL parameter (stored), else the stored value, else `null`
 * (the production default applies).
 */
export function resolveProgressionPreviewDecision(search: unknown, storage: StorageLike | null): ProgressionModelId | null {
  const param = parseProgressionParam(search);
  try {
    if (param !== null) {
      storage?.setItem(PROGRESSION_PREVIEW_KEY, param);
      return param;
    }
    const stored = storage?.getItem(PROGRESSION_PREVIEW_KEY);
    return stored === "shop" || stored === "legacy" ? stored : null;
  } catch {
    return param;
  }
}
