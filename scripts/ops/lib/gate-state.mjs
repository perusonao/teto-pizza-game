// Owner Gate: turn observed facts about ONE pull request into a state and a recommended next action.
//
// Pure function over a facts object (see collect-facts.mjs for how the facts are gathered), so every
// rule is tested with fixtures and no network. What this module deliberately does NOT do:
//   - it never says "merge it", "HV passed" or "required checks satisfied" (branch protection is not
//     inspected; HV and merge approval are Owner decisions) -- those fields are always NOT_ASSESSED;
//   - it never hides a failure: a rerun that passed keeps the earlier failed attempt in `notes`;
//   - it only counts evidence that belongs to the CURRENT head SHA; anything else is reported as stale;
//   - it fails CLOSED: anything it could not read, or does not recognise, is FACTS_INCOMPLETE / CODEX_ERROR,
//     never READY.
//
// facts = {
//   pr:    { number, state, merged, draft, title, body, labels, headSha, headDate, mergeableState },
//   checks:[{ name, status, conclusion, headSha }],                      // check runs + commit statuses of the head
//   runs:  [{ id, name, status, runAttempt, conclusion, headSha, attempts: [{ attempt, conclusion, failedJobs }] }],
//   codex: { receipts: [{ sha, at, clean }], summary: { sha, status, hasUnresolved: true|false|null } | null,
//            requests: [{ at }], other: [{ at, excerpt }] },             // other = Codex bot comments that are no review
//   threads: { unresolved, total } | null,
//   dependencies: [{ ref, kind, state, merged }],
//   gaps: [string],                                                      // data that could not be read completely
// }

import { isHold } from "./hold.mjs";

export const STATES = [
  "CLOSED",
  "CONFLICT",
  "BEHIND_BASE",
  "WAIT_DEPENDENCY",
  "CI_FAILED",
  "FACTS_INCOMPLETE",
  "CI_PENDING",
  "DRAFT",
  "CODEX_FINDINGS",
  "CODEX_ERROR",
  "CODEX_NEEDED",
  "CODEX_PENDING",
  "THREADS_OPEN",
  "HOLD",
];
const READY = "READY_FOR_OWNER_REVIEW";

const GREEN = new Set(["success", "neutral", "skipped"]);
const RED = new Set(["failure", "timed_out", "action_required", "startup_failure", "cancelled", "stale"]);
const CODEX_RUNNING = new Set(["in_progress", "running", "queued", "pending", "requested"]);
const MERGEABLE_KNOWN = new Set(["clean", "dirty", "blocked", "behind", "unstable", "has_hooks", "draft", "unknown"]);

const shaMatches = (reviewed, head) => typeof reviewed === "string" && reviewed.length >= 7 && typeof head === "string" && head.length >= 7 && head.startsWith(reviewed.toLowerCase());
const ms = (iso) => (iso ? Date.parse(iso) : NaN);

function withDefaults(f) {
  return {
    ...f,
    pr: { number: 0, state: "open", merged: false, draft: false, title: "", body: "", labels: [], headSha: "", headDate: null, mergeableState: null, ...f.pr },
    checks: f.checks ?? [],
    runs: f.runs ?? [],
    codex: { receipts: [], summary: null, requests: [], other: [], ...f.codex },
    threads: f.threads === undefined ? null : f.threads,
    dependencies: f.dependencies ?? [],
    gaps: f.gaps ?? [],
  };
}

function evaluateCi(facts) {
  const head = facts.pr.headSha;
  const res = { observed: 0, success: 0, failed: [], pending: [], stale: 0 };
  for (const c of facts.checks) {
    if (c.headSha !== head) {
      res.stale++;
      continue;
    }
    res.observed++;
    if (c.status !== "completed") res.pending.push(c.name);
    else if (GREEN.has(c.conclusion)) res.success++;
    else if (RED.has(c.conclusion)) res.failed.push(`${c.name} (${c.conclusion})`);
    else res.pending.push(`${c.name} (${c.conclusion ?? "no conclusion"})`);
  }
  // Workflow runs of the head are judged too: a startup failure creates no check run, and a run whose
  // jobs do not exist yet has no check run to be pending.
  for (const r of facts.runs) {
    if (r.headSha !== head) continue;
    if (r.status !== "completed") res.pending.push(`run "${r.name}" (${r.status ?? "status unknown"})`);
    else if (RED.has(r.conclusion)) res.failed.push(`run "${r.name}" (${r.conclusion})`);
    else if (!GREEN.has(r.conclusion)) res.pending.push(`run "${r.name}" (${r.conclusion ?? "no conclusion"})`);
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
  notes.push("Failure history covers the CURRENT head only; failures on earlier heads of this PR are not listed.");
  return notes;
}

function evaluateCodex(facts) {
  const { codex, pr } = facts;
  const head = pr.headSha;
  const headAt = ms(pr.headDate);
  const newestReceipt = [...codex.receipts].filter((r) => shaMatches(r.sha, head)).sort((a, b) => ms(b.at) - ms(a.at))[0] ?? null;
  const summary = codex.summary && shaMatches(codex.summary.sha, head) ? codex.summary : null;
  const anyReviewed = [...codex.receipts].sort((a, b) => ms(b.at) - ms(a.at))[0]?.sha ?? codex.summary?.sha ?? null;
  const requestAfterHead = codex.requests.some((q) => !Number.isNaN(headAt) && ms(q.at) >= headAt);

  // Codex bot comments that are not a review (e.g. "create an environment for this repo", an error, or
  // free-text suggestions). They count when posted after the current head and not followed by a newer request.
  const errorsAfter = (cutoff) =>
    codex.other.filter((o) => ms(o.at) >= cutoff && !codex.requests.some((q) => ms(q.at) > ms(o.at)));
  const hasError = (cutoff) => errorsAfter(Number.isNaN(cutoff) ? -Infinity : cutoff).length > 0;

  let status;
  let detail = null;
  if (summary?.hasUnresolved === true) status = "FINDINGS";
  else if (newestReceipt && newestReceipt.clean !== true) {
    status = "UNCLEAR";
    detail = "a Codex receipt for the head does not say 'Didn't find any major issues'; the Owner must read it";
  } else if (newestReceipt) {
    status = hasError(ms(newestReceipt.at)) ? "ERROR" : "COMPLETED_FOR_HEAD";
    if (status === "ERROR") detail = "a Codex bot comment without a review was posted after the receipt";
  } else if (summary && summary.status === "completed") {
    if (summary.hasUnresolved === false) {
      // Measured from when Codex last wrote the summary, not from the (forgeable, skewable) commit date.
      const summaryAt = ms(summary.at);
      status = hasError(Number.isNaN(summaryAt) ? headAt : summaryAt) ? "ERROR" : "COMPLETED_FOR_HEAD";
      if (status === "ERROR") detail = "a Codex bot comment without a review was posted after the summary";
    } else {
      status = "UNCLEAR";
      detail = "the Codex summary does not state whether findings are unresolved";
    }
  } else if (summary && summary.status && !CODEX_RUNNING.has(summary.status)) {
    status = "ERROR";
    detail = `Codex review state is '${summary.status}'`;
  } else if (hasError(headAt)) {
    status = "ERROR";
    detail = "Codex replied without reviewing (for example the repository has no Codex environment yet)";
  } else if ((summary && CODEX_RUNNING.has(summary.status)) || requestAfterHead) status = "PENDING";
  else status = "NEEDED";

  return { status, detail, reviewedSha: anyReviewed, reviewedIsHead: status === "COMPLETED_FOR_HEAD" || status === "FINDINGS" };
}

const NEXT = {
  CLOSED: "Nothing to do: the PR is closed or merged.",
  CONFLICT: "Merge the base branch into the PR branch and resolve the conflict (never rewrite the author's history). Push once, then wait for CI and Codex on the new head.",
  BEHIND_BASE: "The base moved and GitHub requires the branch to be up to date. Merge the base into the branch (one push), then wait for CI and Codex on the new head.",
  WAIT_DEPENDENCY: "Wait for the PRs/Issues listed under Depends-on to merge or close; do not start the dependent work on top of an unmerged base.",
  CI_FAILED: "Open the failed job, record the failing test and the run URL. Fix the cause. A failed-jobs-only rerun is a session/Owner decision, and a pass after rerun still needs the first failure recorded. Do not retry or loosen timeouts to hide it.",
  CI_PENDING: "Wait. Do not push again unless needed: a new push cancels the running CI and restarts the ~13-17 minute WebKit run.",
  DRAFT: "Draft PR. Mark it ready for review (Owner/author decision) before it can be reviewed for merge.",
  CODEX_FINDINGS: "Address the Codex findings on the current head, resolve the threads, then request a review of the new head.",
  CODEX_ERROR: "Codex answered with an error, an unrecognised message or an unclear receipt. This is NOT a passed review: the Owner reads the Codex comment, fixes the Codex setup, or decides on an alternative review.",
  CODEX_NEEDED: "No Codex review covers the current head. Request one for this head (the Owner/session decides; the Gate does not post it).",
  CODEX_PENDING: "A Codex review of the current head is in progress or requested. Wait for its receipt; if nothing arrives, check the Codex comment for an error.",
  THREADS_OPEN: "Resolve or answer the open review threads.",
  FACTS_INCOMPLETE: "Some facts could not be read completely (see blockers). Re-run the Gate; do not treat this PR as ready.",
  HOLD: "HOLD / merge-prohibited PR. Leave it as is; the Owner decides when it resumes.",
  [READY]: "Observed signals are clean for the current head. This is NOT merge approval and NOT Human Verification: the Owner reviews the diff, confirms HV when the change needs it, and decides the merge.",
};

export function evaluateGate(input) {
  const facts = withDefaults(input);
  const { pr } = facts;
  const blockers = [];
  const notes = [];
  const ci = evaluateCi(facts);
  const codex = evaluateCodex(facts);
  notes.push(...evaluateHistory(facts));
  if (ci.stale > 0) notes.push(`${ci.stale} check result(s) belong to an older head and were ignored.`);
  if (codex.reviewedSha && !codex.reviewedIsHead && codex.status !== "ERROR") notes.push(`Codex last reviewed ${codex.reviewedSha.slice(0, 10)}, which is not the current head ${pr.headSha.slice(0, 10)}.`);

  const closed = pr.state !== "open" || pr.merged;
  const hold = isHold(pr);
  const mergeable = pr.mergeableState ?? "unknown";
  const unresolvedDeps = facts.dependencies.filter((d) => !(d.state === "closed" && (d.kind !== "pr" || d.merged)));

  if (mergeable === "dirty") blockers.push("CONFLICT: the PR conflicts with its base.");
  if (mergeable === "behind") blockers.push("BEHIND_BASE: the branch is behind its base and GitHub requires it to be up to date.");
  if (unresolvedDeps.length) blockers.push(`WAIT_DEPENDENCY: ${unresolvedDeps.map((d) => `${d.ref} (${d.state}${d.kind === "pr" && d.state === "closed" ? ", not merged" : ""})`).join(", ")}`);
  if (ci.failed.length) blockers.push(`CI_FAILED: ${ci.failed.join("; ")}`);
  if (ci.pending.length || ci.observed === 0) blockers.push(`CI_PENDING: ${ci.observed === 0 && !ci.pending.length ? "no check results reported for the current head yet" : ci.pending.join("; ")}`);
  if (pr.draft || mergeable === "draft") blockers.push("DRAFT: the PR is a draft.");
  if (codex.status === "FINDINGS") blockers.push("CODEX_FINDINGS: Codex reported unresolved findings on the current head.");
  if (codex.status === "ERROR" || codex.status === "UNCLEAR") blockers.push(`CODEX_ERROR: ${codex.detail}.`);
  if (codex.status === "NEEDED") blockers.push("CODEX_NEEDED: no Codex review covers the current head.");
  if (codex.status === "PENDING") blockers.push("CODEX_PENDING: a Codex review of the current head is not complete.");
  if (facts.threads && facts.threads.unresolved > 0) blockers.push(`THREADS_OPEN: ${facts.threads.unresolved} unresolved review thread(s).`);
  const incomplete = [...facts.gaps];
  if (!facts.threads) incomplete.push("review threads could not be read");
  if (mergeable === "unknown") incomplete.push("mergeability is still being computed");
  else if (!MERGEABLE_KNOWN.has(mergeable)) incomplete.push(`unrecognised mergeable_state '${mergeable}'`);
  if (!pr.headSha) incomplete.push("head SHA is unknown");
  if (incomplete.length) blockers.push(`FACTS_INCOMPLETE: ${incomplete.join("; ")}`);
  if (hold) blockers.push("HOLD: the PR is marked HOLD / merge-prohibited.");

  if (mergeable === "blocked") notes.push("GitHub reports mergeable_state 'blocked' (for example a required review or check is outstanding). The Gate does not infer which.");
  if (mergeable === "unstable") notes.push("GitHub reports mergeable_state 'unstable' (a non-required check is failing).");
  if (pr.draft) notes.push("Draft PR.");

  let state;
  if (closed) state = "CLOSED";
  else state = STATES.find((s) => blockers.some((b) => b.startsWith(`${s}:`))) ?? READY;
  // CODEX_ERROR is produced by two statuses; keep the first-match order intact.
  return {
    pr: pr.number,
    title: pr.title,
    headSha: pr.headSha,
    state,
    hold,
    blockers,
    notes,
    nextAction: NEXT[state],
    checks: { observed: ci.observed, success: ci.success, failed: ci.failed.length, pending: ci.pending.length },
    codex,
    // Always unassessed: CI/Codex signals never imply these.
    humanVerification: "NOT_ASSESSED",
    mergeApproval: "NOT_ASSESSED",
    requiredChecks: "UNKNOWN (branch protection / rulesets are not inspected)",
  };
}

/**
 * Repository-level data gaps (claims, overlap, an unreadable PR) are facts the Gate could not read. They are
 * not tied to one PR's row, so they can hide an overlapping claim from any of them: no PR may be READY while
 * one exists. Only READY is downgraded; every other state already is a blocker of its own.
 */
export function applyRepoGaps(results, repoGaps = []) {
  if (!repoGaps.length) return results;
  return results.map((r) =>
    r.state !== READY
      ? r
      : {
          ...r,
          state: "FACTS_INCOMPLETE",
          blockers: [...r.blockers, `FACTS_INCOMPLETE: repository-level data gaps (${repoGaps.length}); see "Data gaps" in the report`],
          nextAction: NEXT.FACTS_INCOMPLETE,
        },
  );
}
