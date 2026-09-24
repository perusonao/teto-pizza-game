import { CLAM_VARIANT_LABEL, clamVariantFromLocation } from "./candidates";

declare const __W1_GATE_SHA__: string;

/** Fixed label so every screenshot/video frame and every iPhone session is self-identifying as
 *  the W1 gate preview (never production): exact source SHA + the clam variant in use. */
export function PreviewRibbon() {
  const search = window.location.search;
  const clam = CLAM_VARIANT_LABEL[clamVariantFromLocation(search)];
  const legacy = new URLSearchParams(search).get("w1visual") === "emoji" ? " · 🍅/🟢 legacy" : "";
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
      W1 VISUAL GATE PREVIEW · {__W1_GATE_SHA__} · clam {clam}
      {legacy}
    </div>
  );
}
