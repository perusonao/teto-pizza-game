/**
 * CUT-S2 Owner Human Verification (Issue #288): the Preview-only opt-in for the CUT shadow-evaluation
 * page. Same isolation principle as ./hint5PreviewOptIn.ts: only ../main.tsx reaches this module, and
 * only behind `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE`, which Vite replaces statically,
 * so a production `vite build` drops the import and the whole page with it. ./cutHvIsolation.gate.test.ts
 * builds the production bundle and scans it for `CUT_HV_PREVIEW_MARK`.
 *
 * Fail-closed: nothing but the explicit query value `cuthv=1` on this page load turns it on. There is no
 * localStorage activation (the page keeps only its own trial records, which never switch anything on).
 */
export const CUT_HV_PREVIEW_MARK = "cut-hv-preview-v1";

export function isCutHvRequested(search: unknown): boolean {
  if (typeof search !== "string") return false;
  try {
    return new URLSearchParams(search).get("cuthv") === "1";
  } catch {
    return false;
  }
}
