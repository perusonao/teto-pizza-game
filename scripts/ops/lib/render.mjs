// Markdown for the job summary. Dry-run only: nothing here writes to a PR.

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderMarkdown({ results, overlaps, claims, repo, generatedAt, dryRun = true }) {
  const L = [];
  L.push(`# Owner Gate${dryRun ? " (DRY-RUN)" : ""}`);
  L.push("");
  L.push(`Repository \`${repo}\` · ${generatedAt}`);
  L.push("");
  L.push("> Dry-run: this report is written to the job summary only. Nothing is posted to any PR or Issue; no rerun, merge or deploy is performed.");
  L.push("> A state never means merge approval or Human Verification, and required checks are not inferred (branch protection is not inspected).");
  L.push("");
  L.push("| PR | Head | State | Checks (ok/fail/pending) | Codex | Next action |");
  L.push("|---|---|---|---|---|---|");
  for (const r of results) {
    L.push(`| #${r.pr} ${cell(r.title).slice(0, 60)} | \`${r.headSha.slice(0, 10)}\` | **${r.state}** | ${r.checks.success}/${r.checks.failed}/${r.checks.pending} | ${r.codex.status}${r.codex.reviewedSha ? ` (reviewed \`${r.codex.reviewedSha.slice(0, 10)}\`)` : ""} | ${cell(r.nextAction)} |`);
  }
  for (const r of results.filter((x) => x.blockers.length || x.notes.length)) {
    L.push("");
    L.push(`### #${r.pr}`);
    for (const b of r.blockers) L.push(`- blocker: ${b}`);
    for (const n of r.notes) L.push(`- note: ${n}`);
  }
  L.push("");
  L.push("## Overlap warnings (open PRs and active claims)");
  if (overlaps.length === 0) L.push("None.");
  for (const o of overlaps) {
    const tag = o.hot.length ? "HOT" : "overlap";
    L.push(`- **${tag}** ${o.a.label}${o.a.hold ? " [HOLD]" : o.a.draft ? " [draft]" : ""} ↔ ${o.b.label}${o.b.hold ? " [HOLD]" : o.b.draft ? " [draft]" : ""}: ${o.files.slice(0, 8).map((f) => `\`${f}\``).join(", ")}${o.files.length > 8 ? ` … (+${o.files.length - 8})` : ""}`);
  }
  L.push("");
  L.push("## Claims");
  L.push(`active ${claims.active.length} · expired ${claims.expired.length} · released ${claims.released.length} · invalid ${claims.invalid.length}`);
  for (const c of claims.active) L.push(`- ${c.session} → Issue #${c.issue}${c.pr ? ` / PR #${c.pr}` : ""}: ${c.files.map((f) => `\`${f}\``).join(", ")} (until ${new Date(c.expiresAt).toISOString()})`);
  for (const i of claims.invalid) L.push(`- invalid claim ignored: ${i.error}${i.url ? ` (${i.url})` : ""}`);
  L.push("");
  return L.join("\n");
}
