// Owner Gate: turn observed facts about ONE pull request into a state and a recommended next action.
//
// Pure function over a facts object (see collect-facts.mjs for how the facts are gathered), so every
// rule is tested with fixtures and no network. What this module deliberately does NOT do:
//   - it never says "merge it", "HV passed" or "required checks satisfied" (branch protection is not
//     inspected; HV and merge approval are Owner decisions) -- those fields are always NOT_ASSESSED;
//   - it never hides a failure: a rerun that passed keeps the earlier failed attempt in `notes`;
//   - it only counts evidence that belongs to the CURRENT head SHA; anything else is reported as stale.
//
// facts = {
//   pr:    { number, state: "open"|"closed", merged, draft, title, body, headSha, headDate, mergeableState },
//   checks:[{ name, status, conclusion, headSha }],
//   runs:  [{ id, name, runAttempt, conclusion, headSha, attempts: [{ attempt, conclusion, failedJobs: [] }] }],
//   codex: { receipts: [{ sha, at }], summary: { sha, status, hasUnresolved } | null, requests: [{ at }] },
//   threads: { unresolved, total } | null,
//   dependencies: [{ ref, kind, state, merged }],
// }

export const STATES = [
  "CLOSED",
  "HOLD",
  "CONFLICT",
  "WAIT_DEPENDENCY",
  "CI_FAILED",
  "CI_PENDING",
  "CODEX_FINDINGS",
  "CODEX_NEEDED",
  "CODEX_PENDING",
  "THREADS_OPEN",
  "FACTS_INCOMPLETE",
  "READY_FOR_OWNER_REVIEW",
];

const GREEN = new Set(["success", "neutral", "skipped"]);
const RED = new Set(["failure", "timed_out", "action_required", "startup_failure", "cancelled", "stale"]);
const HOLD_RE = /\bHOLD\b|マージ禁止|merge禁止|do not merge/i;

const shaMatches = (reviewed, head) => typeof reviewed === "string" && reviewed.length >= 7 && typeof head === "string" && head.startsWith(reviewed.toLowerCase());

function evaluateChecks(facts) {
  const head = facts.pr.headSha;
  const current = facts.checks.filter((c) => c.headSha === head);
  const stale = facts.checks.length - current.length;
  const res = { total: current.length, success: 0, failed: [], pending: [], stale };
  for (const c of current) {
    if (c.status !== "completed") res.pending.push(c.name);
    else if (GREEN.has(c.conclusion)) res.success++;
    else if (RED.has(c.conclusion)) res.failed.push(`${c.name} (${c.conclusion})`);
    else res.pending.push(`${c.name} (${c.conclusion ?? "no conclusion"})`);
  }
  return res;
}

function evaluateHistory(facts) {
  const notes = [];
  for (const r of facts.runs.filter((x) => x.headSha === facts.pr.headSha && x.runAttempt > 1)) {
    const failedBefore = (r.attempts ?? []).filter((a) => a.attempt < r.runAttempt && a.conclusion !== "success");
    if (failedBefore.length === 0) continue;
    const first = failedBefore[0];
    const jobs = first.failedJobs?.length ? first.failedJobs.join(", ") : "failed job names not recorded";
    const verdict = r.conclusion === "success" ? "RERUN_PASSED" : r.conclusion ? "RERUN_FAILED_AGAIN" : "RERUN_IN_PROGRESS";
    notes.push(`${verdict}: "${r.name}" (run ${r.id}) attempt ${first.attempt} ${first.conclusion} [${jobs}] -> attempt ${r.runAttempt} ${r.conclusion ?? "running"}. The first failure is NOT cleared; it needs its own record (existing flake Issue or a new one).`);
  }
  return notes;
}

function evaluateCodex(facts) {
  const { codex, pr } = facts;
  const receipt = codex.receipts.find((r) => shaMatches(r.sha, pr.headSha)) ?? null;
  const summary = codex.summary;
  const summaryIsHead = summary && shaMatches(summary.sha, pr.headSha) ? summary : null;
  const newestReceipt = [...codex.receipts].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const latestReviewed = newestReceipt?.sha ?? summary?.sha ?? null;
  const pendingRequest = codex.requests.some((q) => pr.headDate && Date.parse(q.at) >= Date.parse(pr.headDate));
  let status;
  if (summaryIsHead?.hasUnresolved) status = "FINDINGS";
  else if (receipt || (summaryIsHead && summaryIsHead.status === "completed")) status = "COMPLETED_FOR_HEAD";
  else if ((summaryIsHead && summaryIsHead.status && summaryIsHead.status !== "completed") || pendingRequest) status = "PENDING";
  else status = "NEEDED";
  return { status, reviewedSha: latestReviewed, reviewedIsHead: status === "COMPLETED_FOR_HEAD" || status === "FINDINGS" };
}

const NEXT = {
  CLOSED: "Nothing to do: the PR is closed or merged.",
  HOLD: "HOLD / merge-prohibited PR. Leave it as is; the Owner decides when it resumes.",
  CONFLICT: "Merge the base branch into the PR branch and resolve the conflict (never rewrite the author's history). Push once, then wait for CI and Codex on the new head.",
  WAIT_DEPENDENCY: "Wait for the PRs/Issues listed under Depends-on to merge or close; do not start the dependent work on top of an unmerged base.",
  CI_FAILED: "Open the failed job, record the failing test and the run URL. Fix the cause. A failed-jobs-only rerun is a session/Owner decision, and a pass after rerun still needs the first failure recorded. Do not retry or loosen timeouts to hide it.",
  CI_PENDING: "Wait. Do not push again unless needed: a new push cancels the running CI and restarts the ~13-17 minute WebKit run.",
  CODEX_FINDINGS: "Address the Codex findings on the current head, resolve the threads, then request a review of the new head.",
  CODEX_NEEDED: "No Codex review covers the current head. Request one for this head (the Owner/session decides; the Gate does not post it).",
  CODEX_PENDING: "A Codex review of the current head is in progress or requested. Wait for its receipt.",
  THREADS_OPEN: "Resolve or answer the open review threads.",
  FACTS_INCOMPLETE: "Some facts could not be read (see blockers). Re-run the Gate; do not treat this PR as ready.",
  READY_FOR_OWNER_REVIEW: "Observed signals are clean for the current head. This is NOT merge approval and NOT Human Verification: the Owner reviews the diff, confirms HV when the change needs it, and decides the merge.",
};

export function evaluateGate(facts) {
  const { pr } = facts;
  const blockers = [];
  const notes = [];
  const checks = evaluateChecks(facts);
  const codex = evaluateCodex(facts);
  notes.push(...evaluateHistory(facts));
  if (checks.stale > 0) notes.push(`${checks.stale} check result(s) belong to an older head and were ignored.`);
  if (codex.reviewedSha && !codex.reviewedIsHead) notes.push(`Codex last reviewed ${codex.reviewedSha.slice(0, 10)}, which is not the current head ${pr.headSha.slice(0, 10)}.`);
  if (pr.draft) notes.push("Draft PR.");

  const closed = pr.state !== "open" || pr.merged;
  const hold = HOLD_RE.test(pr.title ?? "") || HOLD_RE.test(pr.body ?? "");
  const mergeable = pr.mergeableState ?? "unknown";
  const unresolvedDeps = facts.dependencies.filter((d) => !(d.state === "closed" && (d.kind !== "pr" || d.merged)));

  if (mergeable === "dirty") blockers.push("CONFLICT: the PR conflicts with its base.");
  if (unresolvedDeps.length) blockers.push(`WAIT_DEPENDENCY: ${unresolvedDeps.map((d) => `${d.ref} (${d.state}${d.kind === "pr" && d.state === "closed" ? ", not merged" : ""})`).join(", ")}`);
  if (checks.failed.length) blockers.push(`CI_FAILED: ${checks.failed.join("; ")}`);
  if (checks.pending.length || checks.total === 0) blockers.push(`CI_PENDING: ${checks.total === 0 ? "no check results reported for the current head yet" : checks.pending.join("; ")}`);
  if (codex.status === "FINDINGS") blockers.push("CODEX_FINDINGS: Codex reported unresolved findings on the current head.");
  if (codex.status === "NEEDED") blockers.push("CODEX_NEEDED: no Codex review covers the current head.");
  if (codex.status === "PENDING") blockers.push("CODEX_PENDING: a Codex review of the current head is not complete.");
  if (facts.threads && facts.threads.unresolved > 0) blockers.push(`THREADS_OPEN: ${facts.threads.unresolved} unresolved review thread(s).`);
  const incomplete = [];
  if (!facts.threads) incomplete.push("review threads could not be read");
  if (mergeable === "unknown") incomplete.push("mergeability is still being computed");
  if (incomplete.length) blockers.push(`FACTS_INCOMPLETE: ${incomplete.join("; ")}`);

  let state;
  if (closed) state = "CLOSED";
  else if (hold) state = "HOLD";
  else state = STATES.find((s) => blockers.some((b) => b.startsWith(`${s}:`))) ?? "READY_FOR_OWNER_REVIEW";

  return {
    pr: pr.number,
    title: pr.title,
    headSha: pr.headSha,
    state,
    blockers,
    notes,
    nextAction: NEXT[state],
    checks: { observed: checks.total, success: checks.success, failed: checks.failed.length, pending: checks.pending.length },
    codex,
    // Always unassessed: CI/Codex signals never imply these.
    humanVerification: "NOT_ASSESSED",
    mergeApproval: "NOT_ASSESSED",
    requiredChecks: "UNKNOWN (branch protection / rulesets are not inspected)",
  };
}
