import { useRef, useState } from "react";
import { SAUCE_DIAG_MARK, SAUCE_DIAG_TITLE } from "./marks";
import { buildSauceDiagReport, type SauceDiagFacts } from "./sauceDiagRead";

const MAX_ROWS = 12;

/**
 * Sauce diagnostic button (Issue #524 Owner HV): a 「診断」 button on the cooking screen that prints, on the screen, what each sauce canvas holds
 * (pixels, visibility, opacity, filter, a dot fallback on screen) next to the sauce data the pizza itself holds, so a screenshot shows "the data is kept"
 * and "the screen shows it" side by side at the moment the red disappears (tomato painted / oil selected / oil painted).
 *
 * Rendered by App.tsx only behind the static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production build drops it
 * (src/preview/previewIsolation.gate.test.ts). READ-ONLY (./sauceDiagRead.ts): no canvas drawing, no storage, no network, no dispatch.
 * The button and the log box are mounted from the first render; a tap changes only the log box's text, so it never re-lays-out the game.
 * The log box does not take pointer events (taps pass through to the game).
 */
export function SauceDiag({ facts }: { facts: SauceDiagFacts }) {
  const [rows, setRows] = useState<string[]>([]);
  const seq = useRef(0);
  const snap = () => {
    seq.current += 1;
    const report = buildSauceDiagReport(document, window, seq.current, new Date(), facts);
    setRows((prev) => [...prev, ...report].slice(-MAX_ROWS));
  };
  return (
    <div className="sauce-diag" data-sauce-diag={SAUCE_DIAG_MARK} data-testid="sauce-diag" style={{ display: "contents" }}>
      <div className="sauce-diag__bar">
        <button type="button" className="sauce-diag__btn" onClick={snap} aria-label={SAUCE_DIAG_TITLE}>
          診断
        </button>
        <button type="button" className="sauce-diag__btn sauce-diag__btn--clear" onClick={() => setRows([])} aria-label={`${SAUCE_DIAG_TITLE}を消す`}>
          消
        </button>
      </div>
      <pre className="sauce-diag__log" data-testid="sauce-diag-log" aria-live="off">
        {rows.join("\n")}
      </pre>
    </div>
  );
}
