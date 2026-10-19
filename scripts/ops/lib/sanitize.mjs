// Untrusted text (PR titles, check/job/workflow names, claim fields, GraphQL error text) is shown in a
// Markdown job summary of a "gate" document, so it must not be able to forge rows, links or HTML.
// Cc = control characters, Cf = format characters (zero-width, bidi overrides, BOM), Zl/Zp = line/paragraph separators.
const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu;

export function safe(value, max = 160) {
  let s = String(value ?? "")
    .replace(CONTROL, " ")
    .replace(/`/g, "'")
    .replace(/[<>]/g, "")
    .replace(/\|/g, "/")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/[*~!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > max) s = `${s.slice(0, max - 1)}…`;
  return s;
}
