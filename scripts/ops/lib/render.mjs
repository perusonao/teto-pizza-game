// Markdown for the job summary. Dry-run only: nothing here writes to a PR.
// Every string that came from GitHub (titles, check/job/workflow names, claim fields, file names,
// error text) passes through safe() so it cannot forge table rows, links or HTML in this document.

import { safe } from "./sanitize.mjs";

const code = (s, n = 120) => `\`${safe(s, n)}\``;
const tag = (x) => (x.hold ? " [HOLD]" : x.draft ? " [draft]" : "");

export function renderMarkdown({ results, overlaps, claims, repo, generatedAt, repoGaps = [], dryRun = true }) {
  const L = [];
  L.push(`# Owner Gate${dryRun ? " (DRY-RUN)" : ""}`);
  L.push("");
  L.push(`Repository ${code(repo)} · ${safe(generatedAt)}`);
  L.push("");
  L.push("> Dry-run: this report is written to the job summary only. Nothing is posted to any PR or Issue; no rerun, merge or deploy is performed.");
  L.push("> A state never means merge approval or Human Verification, and required checks are not inferred (branch protection is not inspected).");
  L.push("> Anything that could not be read completely makes a PR FACTS_INCOMPLETE, never READY.");
  L.push("");
  L.push("| PR | Head | State | Checks (ok/fail/pending) | Codex | Next action |");
  L.push("|---|---|---|---|---|---|");
  for (const r of results) {
    const state = `**${safe(r.state)}**${r.hold && r.state !== "HOLD" ? " + HOLD" : ""}`;
    const reviewed = r.codex.reviewedSha ? ` (reviewed ${code(r.codex.reviewedSha.slice(0, 10), 12)})` : "";
    L.push(`| #${Number(r.pr)} ${safe(r.title, 60)} | ${code(String(r.headSha).slice(0, 10), 12)} | ${state} | ${r.checks.success}/${r.checks.failed}/${r.checks.pending} | ${safe(r.codex.status)}${reviewed} | ${safe(r.nextAction, 400)} |`);
  }
  for (const r of results.filter((x) => x.blockers.length || x.notes.length)) {
    L.push("");
    L.push(`### #${Number(r.pr)}`);
    for (const b of r.blockers) L.push(`- blocker: ${safe(b, 400)}`);
    for (const n of r.notes) L.push(`- note: ${safe(n, 500)}`);
  }
  L.push("");
  L.push("## Overlap warnings (open PRs and active claims)");
  if (overlaps.length === 0) L.push("None.");
  for (const o of overlaps) {
    L.push(`- **${o.hot.length ? "HOT" : "overlap"}** ${safe(o.a.label)}${tag(o.a)} ↔ ${safe(o.b.label)}${tag(o.b)}: ${o.files.slice(0, 8).map((f) => code(f)).join(", ")}${o.files.length > 8 ? ` … (+${o.files.length - 8})` : ""}`);
  }
  L.push("");
  L.push("## Claims");
  L.push(`active ${claims.active.length} · expired ${claims.expired.length} · released ${claims.released.length} · invalid ${claims.invalid.length}`);
  for (const c of claims.active) L.push(`- ${safe(c.session, 80)} → Issue #${Number(c.issue)}${c.pr ? ` / PR #${Number(c.pr)}` : ""}: ${c.files.map((f) => code(f)).join(", ")} (until ${new Date(c.expiresAt).toISOString()})`);
  for (const i of claims.invalid) L.push(`- invalid claim ignored: ${safe(i.error, 200)}${i.url ? ` (${safe(i.url, 200)})` : ""}`);
  if (repoGaps.length) {
    L.push("");
    L.push("## Data gaps (overlap / claims may be incomplete)");
    for (const g of repoGaps) L.push(`- ${safe(g, 300)}`);
  }
  L.push("");
  return L.join("\n");
}
