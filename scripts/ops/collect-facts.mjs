// Gather the facts evaluateGate() needs from the GitHub API -- READ ONLY.
// The api object exposes GET requests and GraphQL *queries* only; there is no code path that writes,
// reruns, merges or deploys. Everything fetched from GitHub (titles, bodies, comments, job names) is
// untrusted text: it is parsed as data and never executed or interpolated into a shell.
//
// Fail closed: a request that fails, or a list that may be longer than what was read, never becomes
// "nothing found". It is recorded in facts.gaps and the Gate reports FACTS_INCOMPLETE for that PR.

import { isCodexAuthor } from "./lib/trust.mjs";
import { parseClaims, parseDependsOnDetailed } from "./lib/claims.mjs";
import { isHold } from "./lib/hold.mjs";

export class TruncatedError extends Error {}

export function createApi({ token, fetchImpl = fetch, apiUrl = "https://api.github.com" }) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "teto-owner-gate-dry-run",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  async function rest(path) {
    if (!path.startsWith("/repos/")) throw new Error(`refusing non-repo path: ${path}`);
    const res = await fetchImpl(`${apiUrl}${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path.split("?")[0]} -> ${res.status}`);
    return res.json();
  }
  /** Reads every page; throws TruncatedError instead of returning a list that may be cut off. */
  async function restAll(path, key, maxPages = 10) {
    const sep = path.includes("?") ? "&" : "?";
    const all = [];
    for (let page = 1; page <= maxPages; page++) {
      const body = await rest(`${path}${sep}per_page=100&page=${page}`);
      const items = key ? body[key] : body;
      all.push(...items);
      if (items.length < 100) return all;
    }
    throw new TruncatedError(`${path.split("?")[0]} has more than ${maxPages * 100} items`);
  }
  async function graphql(query, variables) {
    if (!/^\s*query\b/.test(query)) throw new Error("only GraphQL queries are allowed");
    const res = await fetchImpl(`${apiUrl}/graphql`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
    if (!res.ok) throw new Error(`graphql -> ${res.status}`);
    const body = await res.json();
    if (body.errors) throw new Error(`graphql errors: ${JSON.stringify(body.errors).slice(0, 300)}`);
    return body.data;
  }
  return { rest, restAll, graphql };
}

const THREADS_QUERY = `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$after){pageInfo{hasNextPage endCursor}nodes{isResolved}}}}}`;

async function readThreads(api, repo, number) {
  const [owner, name] = repo.split("/");
  let after = null;
  let total = 0;
  let unresolved = 0;
  for (let i = 0; i < 20; i++) {
    const d = await api.graphql(THREADS_QUERY, { owner, name, number, after });
    const t = d.repository.pullRequest.reviewThreads;
    for (const n of t.nodes) {
      total++;
      if (!n.isResolved) unresolved++;
    }
    if (!t.pageInfo.hasNextPage) return { unresolved, total };
    after = t.pageInfo.endCursor;
  }
  throw new TruncatedError("more than 2000 review threads");
}

const CLEAN_RECEIPT = /didn['’]t find any major issues/i;
const TRUSTED_REQUESTER = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/** Sorts Codex bot comments into receipts / the summary state / "other" (anything that is not a review). */
export function parseCodex(comments) {
  const receipts = [];
  const requests = [];
  const other = [];
  let summary = null;
  let summaryAt = -Infinity;
  for (const c of comments) {
    const body = typeof c?.body === "string" ? c.body : "";
    if (isCodexAuthor(c)) {
      const sha = body.match(/Reviewed commit:\*\*\s*`([0-9a-f]{7,40})`/i);
      const state = body.match(/codex-review-state:v1\s*(\{.*?\})\s*-->/s);
      if (body.includes("codex-review-receipt:v1") && sha) {
        receipts.push({ sha: sha[1].toLowerCase(), at: c.created_at, clean: CLEAN_RECEIPT.test(body) });
      } else if (state) {
        try {
          const st = JSON.parse(state[1]).code_review;
          const at = Date.parse(c.updated_at ?? c.created_at);
          if (st?.commit_sha && at >= summaryAt) {
            summaryAt = at;
            summary = {
              sha: String(st.commit_sha).toLowerCase(),
              status: typeof st.status === "string" ? st.status : null,
              hasUnresolved: typeof st.has_unresolved_findings === "boolean" ? st.has_unresolved_findings : null,
            };
          }
        } catch {
          other.push({ at: c.created_at, excerpt: "unreadable Codex state block" });
        }
      } else {
        other.push({ at: c.created_at, excerpt: body.replace(/\s+/g, " ").slice(0, 120) });
      }
    } else if (/@codex\s+review\b/i.test(body) && TRUSTED_REQUESTER.has(c?.author_association)) {
      requests.push({ at: c.created_at });
    }
  }
  return { receipts, summary, requests, other };
}

async function readDependency(api, repo, n) {
  const issue = await api.rest(`/repos/${repo}/issues/${n}`);
  if (issue.pull_request) {
    const pr = await api.rest(`/repos/${repo}/pulls/${n}`);
    return { ref: `#${n}`, kind: "pr", state: pr.state, merged: pr.merged === true };
  }
  return { ref: `#${n}`, kind: "issue", state: issue.state, merged: false };
}

const STATUS_TO_CHECK = { success: "success", pending: null, failure: "failure", error: "failure" };

export async function collectPrFacts(api, repo, number, { claimDeps = [] } = {}) {
  const gaps = [];
  const soft = async (label, fn, fallback) => {
    try {
      return await fn();
    } catch (e) {
      gaps.push(`${label}: ${e.message}`);
      return fallback;
    }
  };

  const pr = await api.rest(`/repos/${repo}/pulls/${number}`);
  const head = pr.head.sha;
  const [commit, checkRuns, statuses, runs, comments, threads] = await Promise.all([
    soft("head commit", () => api.rest(`/repos/${repo}/commits/${head}`), null),
    soft("check runs", () => api.restAll(`/repos/${repo}/commits/${head}/check-runs`, "check_runs"), null),
    soft("commit statuses", () => api.rest(`/repos/${repo}/commits/${head}/status`), null),
    soft("workflow runs", () => api.restAll(`/repos/${repo}/actions/runs?head_sha=${head}`, "workflow_runs"), null),
    soft("PR comments", () => api.restAll(`/repos/${repo}/issues/${number}/comments`, null, 30), []),
    soft("review threads", () => readThreads(api, repo, number), null),
  ]);

  const checks = [];
  for (const c of checkRuns ?? []) checks.push({ name: c.name, status: c.status, conclusion: c.conclusion, headSha: head });
  // Legacy commit statuses (integrations that do not use check runs). An empty list means none exist.
  for (const s of statuses?.statuses ?? []) {
    const conclusion = STATUS_TO_CHECK[s.state];
    checks.push({ name: `status ${s.context}`, status: conclusion === null ? "in_progress" : "completed", conclusion, headSha: head });
  }

  const runFacts = [];
  for (const r of runs ?? []) {
    const attempts = [];
    for (let a = 1; a < r.run_attempt; a++) {
      const jobs = await soft(`attempt ${a} jobs of run ${r.id}`, () => api.restAll(`/repos/${repo}/actions/runs/${r.id}/attempts/${a}/jobs`, "jobs"), null);
      if (!jobs) continue;
      const failed = jobs.filter((j) => j.conclusion && j.conclusion !== "success" && j.conclusion !== "skipped").map((j) => j.name);
      attempts.push({ attempt: a, conclusion: failed.length ? "failure" : "success", failedJobs: failed });
    }
    runFacts.push({ id: r.id, name: r.name, status: r.status, runAttempt: r.run_attempt, conclusion: r.conclusion, headSha: r.head_sha, attempts });
  }

  const depInfo = parseDependsOnDetailed(pr.body ?? "");
  gaps.push(...depInfo.problems);
  const depNums = [...new Set([...depInfo.numbers, ...claimDeps])].filter((n) => n !== number);
  const dependencies = [];
  for (const n of depNums) {
    const d = await soft(`dependency #${n}`, () => readDependency(api, repo, n), null);
    if (d) dependencies.push(d);
  }

  return {
    pr: {
      number,
      state: pr.state,
      merged: pr.merged === true,
      draft: pr.draft === true,
      title: pr.title,
      body: pr.body ?? "",
      labels: (pr.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)),
      headSha: head,
      headDate: commit?.commit?.committer?.date ?? null,
      mergeableState: pr.mergeable_state ?? null,
    },
    checks,
    runs: runFacts,
    codex: parseCodex(comments),
    threads,
    dependencies,
    gaps,
  };
}

/** Facts for a PR whose own data could not be read at all: the row is FACTS_INCOMPLETE, never missing. */
function failedPrFacts(number, error) {
  return { pr: { number, title: "(could not be read)", headSha: "", state: "open" }, gaps: [`PR #${number}: ${error.message}`] };
}

export async function collectRepoFacts(api, repo, { only = null, now = Date.now(), sinceDays = 14 } = {}) {
  const open = (await api.restAll(`/repos/${repo}/pulls?state=open`, null, 30)).map((p) => p.number);
  const targets = only ? open.filter((n) => n === only) : open;
  if (only && targets.length === 0) throw new Error(`PR #${only} is not open`);

  const repoGaps = [];
  const since = new Date(now - sinceDays * 86400 * 1000).toISOString();
  let repoComments = [];
  try {
    repoComments = await api.restAll(`/repos/${repo}/issues/comments?since=${encodeURIComponent(since)}&sort=created&direction=desc`, null, 5);
  } catch (e) {
    repoGaps.push(`claims: recent comments could not be read completely (${e.message}); older claims may be missing`);
  }

  const prFiles = [];
  const claimBodies = [];
  for (const n of open) {
    try {
      const pr = await api.rest(`/repos/${repo}/pulls/${n}`);
      let files = [];
      try {
        const raw = await api.restAll(`/repos/${repo}/pulls/${n}/files`, null, 30);
        files = raw.flatMap((f) => (f.previous_filename ? [f.filename, f.previous_filename] : [f.filename]));
        if (raw.length >= 3000) repoGaps.push(`PR #${n}: GitHub lists at most 3000 changed files; overlap for this PR may be incomplete`);
      } catch (e) {
        repoGaps.push(`PR #${n}: changed files could not be read completely (${e.message}); overlap for this PR may be incomplete`);
      }
      prFiles.push({ number: n, title: pr.title, draft: pr.draft === true, hold: isHold({ title: pr.title, body: pr.body ?? "", labels: (pr.labels ?? []).map((l) => l.name) }), files });
      claimBodies.push({ body: pr.body ?? "", created_at: pr.created_at, html_url: pr.html_url, author_association: pr.author_association, user: pr.user });
    } catch (e) {
      repoGaps.push(`PR #${n}: could not be read (${e.message})`);
    }
  }
  const claims = parseClaims([...claimBodies, ...repoComments], now);

  const prFacts = [];
  for (const n of targets) {
    try {
      prFacts.push(await collectPrFacts(api, repo, n, { claimDeps: claims.active.filter((c) => c.pr === n).flatMap((c) => c.dependsOn) }));
    } catch (e) {
      prFacts.push(failedPrFacts(n, e));
    }
  }
  return { prFacts, prFiles, claims, repoGaps };
}
