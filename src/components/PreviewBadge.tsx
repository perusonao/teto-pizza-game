import { DEFAULT_CUT_SIGNIFICANCE, getCutSignificanceThresholds } from "../logic/cut/regions";
import { CUT_THRESHOLD_PREVIEW_MARK, cutThresholdBadgeLabel } from "../preview/cutThresholdPreview";
import { LC_HAND_PREVIEW_CAPACITY, LC_HAND_PREVIEW_MARK, lcHandPreviewBadgeLabel } from "../preview/lcHandPreview";

/**
 * Renders only when the build sets `VITE_PREVIEW_MODE` -- the production `vite build` (see
 * vite.config.ts) never sets it, so this component and its one caller in App.tsx compile out
 * to nothing observable in production; `import.meta.env.VITE_PREVIEW_MODE` being statically
 * false there lets Vite dead-code-eliminate the whole subtree.
 *
 * perusonao/teto-pizza-game-preview's deploy workflow is the only thing expected to set these
 * three `VITE_PREVIEW_*` build-time env vars, so a reviewer opening the preview URL can always
 * tell which source PR/commit they're looking at without it fighting for attention with the
 * game UI itself.
 *
 * #427: while a Preview URL query overrides the CUT significance thresholds (`?cutAreaPct=&cutMinWidth=`, ../preview/
 * cutThresholdPreview.ts) the badge adds `· CUT 0.20%/1.0u`, so a Human Verification video shows which pair it recorded.
 * With the defaults it adds nothing. Display only.
 *
 * LC-R6-b: an HV-only Large Catalog Hand variant adds `· HAND 9` / `· HAND 12` (from the committed variant, read here
 * only behind the same `VITE_PREVIEW_MODE` guard; an invalid value shows nothing, as it leaves Hand OFF), so a Human Verification video shows which variant it recorded. A normal
 * Preview (variant `null`) shows no HAND suffix, i.e. Hand OFF. The badge only displays; it activates nothing.
 */
export function PreviewBadge() {
  if (!import.meta.env.VITE_PREVIEW_MODE) return null;
  const pr = import.meta.env.VITE_PREVIEW_PR;
  const sha = import.meta.env.VITE_PREVIEW_SHA;
  const hand = lcHandPreviewBadgeLabel(LC_HAND_PREVIEW_CAPACITY);
  const cut = cutThresholdBadgeLabel(getCutSignificanceThresholds(), DEFAULT_CUT_SIGNIFICANCE);
  return (
    <div
      className="preview-badge"
      aria-hidden="true"
      data-lc-hand-preview={hand === null ? undefined : LC_HAND_PREVIEW_MARK}
      data-cut-threshold-preview={cut === null ? undefined : CUT_THRESHOLD_PREVIEW_MARK}
    >
      PREVIEW{pr ? ` · PR#${pr}` : ""}
      {sha ? ` · ${sha}` : ""}
      {hand === null ? "" : ` · ${hand}`}
      {cut === null ? "" : ` · ${cut}`}
    </div>
  );
}
