import { CLAM_GLYPH_CANDIDATES, clamVariantFromLocation } from "./candidates";

/** Tiny fixed label so every screenshot/video frame is self-identifying as the W1 gate preview
 *  (never production) and names the clam glyph variant in use. Pointer-events off. */
export function PreviewRibbon() {
  const clam = CLAM_GLYPH_CANDIDATES[clamVariantFromLocation(window.location.search)];
  return (
    <div
      data-testid="w1-preview-ribbon"
      style={{
        position: "fixed",
        left: 0,
        bottom: 0,
        padding: "1px 4px",
        font: "9px/1.2 system-ui, sans-serif",
        color: "#fff",
        background: "rgba(120, 0, 120, 0.72)",
        pointerEvents: "none",
        zIndex: 99999,
      }}
    >
      W1 VISUAL GATE PREVIEW · clam={clam.emoji} {clam.unicodeName}
    </div>
  );
}
