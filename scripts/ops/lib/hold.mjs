// HOLD / merge-prohibited marker. ONE definition shared by the Gate state and the overlap report.
// Deliberately narrow: ordinary prose such as "click and hold the corner" or a checklist line
// "do not merge until ..." must NOT hold a PR. Accepted markers:
//   - a bracketed marker in the TITLE: "[HOLD ...]" / "【保留】" / "[... マージ禁止 ...]" / "[merge禁止]"
//   - a label named "hold" (or "do-not-merge")
//   - a line of the BODY that starts with "HOLD:" (the Owner/session states it on purpose)
const OPEN = "[\\[【(（]";
const CLOSE = "[\\]】)）]";
const TITLE_HOLD = new RegExp(`${OPEN}\\s*(?:HOLD|保留)(?![A-Za-z0-9_])[^\\]】)）]*${CLOSE}`, "i");
const TITLE_PROHIBIT = new RegExp(`${OPEN}[^\\]】)）]*(?:マージ禁止|merge禁止|do not merge)[^\\]】)）]*${CLOSE}`, "i");
const BODY_HOLD = /^[ \t]*HOLD[ \t]*:/m;

export function isHold({ title = "", body = "", labels = [] } = {}) {
  if (TITLE_HOLD.test(title) || TITLE_PROHIBIT.test(title)) return true;
  if (labels.some((l) => /^(?:hold|do[- ]not[- ]merge)$/i.test(String(l)))) return true;
  return BODY_HOLD.test(stripFences(body));
}

/** Remove fenced code blocks (``` or ~~~) so quoted examples are never treated as live markers. */
export function stripFences(text) {
  return String(text ?? "").replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, "");
}
