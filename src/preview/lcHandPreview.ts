/**
 * Large Catalog UX LC-R6-b: the Preview-only Hand activation variant (OD-R6a-1 = A2). PREVIEW ONLY.
 *
 * `LC_HAND_PREVIEW_CAPACITY` is a COMMITTED constant, never a runtime switch:
 * - **main / every PR head: `null`** (the only value that may ever be merged). A normal Preview of any PR is
 *   therefore Hand OFF, exactly like production, and does not leak Large Catalog Hand into other features' Preview.
 * - **HV-only disposable commit: `9` or `12`** (a one-line change, deployed by exact SHA through the existing
 *   Preview pipeline; NEVER merged, never a PR head). The Owner compares 9 vs 12 on real devices in R6-d; this file
 *   does not decide the capacity.
 *
 * It is read ONLY by `../logic/catalog/handPolicy.ts` (the policy) and `../components/PreviewBadge.tsx` (display
 * only), and only behind `import.meta.env.VITE_PREVIEW_MODE` (set by
 * the Preview build pipeline alone; no production workflow sets it). A production build replaces that condition with
 * `undefined`, so this module is tree-shaken out and even a `9` / `12` committed here leaves production Hand OFF.
 * There is deliberately no query parameter, localStorage, sessionStorage, global or other runtime reader anywhere.
 * ./lcHandPreview.gate.test.ts (source / workflow) and ./lcHandPreview.bundle.gate.test.ts (real builds) prove it.
 */
export type LcHandPreviewCapacity = 9 | 12 | null;

/** Present in a Preview bundle only (the bundle gate scans production for it). */
export const LC_HAND_PREVIEW_MARK = "lc-hand-preview-v1";

export const LC_HAND_PREVIEW_CAPACITY: LcHandPreviewCapacity = 12;

/** The Preview badge suffix that identifies the variant on a Human Verification video. `null` = Hand OFF (no suffix). */
export function lcHandPreviewBadgeLabel(capacity: unknown): string | null {
  return capacity === 9 || capacity === 12 ? `HAND ${capacity}` : null;
}
