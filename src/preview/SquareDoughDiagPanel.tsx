/**
 * #535 B2 on-device diagnostics (TEMPORARY): the overlay of ./squareDoughDiag.ts. See that file for what it shows and why it is safe.
 */
import { useEffect, useState } from "react";
import { describeEnvironment, type SquareDoughDiag } from "./squareDoughDiag";

const PANEL_POLL_MS = 200;

/** The overlay. `pointer-events: none` (it can never take a touch) and fixed to the bottom; it redraws from a 5 Hz poll, never from the handlers. */
export function SquareDoughDiagPanel({ diag }: { diag: SquareDoughDiag }) {
  const [text, setText] = useState(() => diag.snapshot(describeEnvironment()));
  useEffect(() => {
    let seen = -1;
    const environment = describeEnvironment();
    const id = window.setInterval(() => {
      if (diag.version === seen) return;
      seen = diag.version;
      setText(diag.snapshot(environment));
    }, PANEL_POLL_MS);
    return () => window.clearInterval(id);
  }, [diag]);
  return (
    <pre
      data-testid="square-dough-diag"
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        padding: "4px 6px calc(4px + env(safe-area-inset-bottom))",
        maxHeight: "30vh",
        overflow: "hidden",
        zIndex: 2147483000,
        pointerEvents: "none",
        background: "rgba(0,0,0,0.78)",
        color: "#b6ffb6",
        font: "8px/1.2 ui-monospace, Menlo, monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {text}
    </pre>
  );
}
