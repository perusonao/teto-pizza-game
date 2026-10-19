// Gather the facts evaluateGate() needs from the GitHub API -- READ ONLY.
// The api object exposes GET requests and GraphQL *queries* only; there is no code path that writes,
// reruns, merges or deploys. Everything fetched from GitHub (titles, bodies, comments, job names) is
// untrusted text: it is parsed as data and never executed or interpolated into a shell.

import { CODEX_LOGIN, isCodexAuthor } from "./lib/trust.mjs";
import { parseClaims, parseDependsOn } from "./lib/claims.mjs";

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
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return res.json();
  }
  async function restAll(path, key, maxPages = 10) {
    const sep = path.includes("?") ? "&" : "?";
    const all = [];
    for (let page = 1; page <= maxPages; page++) {
      const body = await rest(`${path}${sep}per_page=100&page=${page}`);
      const items = key ? body[key] : body;
      all.push(...items);
      if (items.length < 100) break;
    }
    return all;
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
  return null; // unreasonably many threads: report as unknown rather than guess
}

function parseCodex(comments) {
  const receipts = [];
  const requests = [];
  let summary = null;
  for (const c of comments) {
    if (isCodexAuthor(c)) {
      const r = c.body.match(/Reviewed commit:\*\*\s*`([0-9a-f]{7,40})`/i);
      if (c.body.includes("codex-review-receipt:v1") && r) receipts.push({ sha: r[1].toLowerCase(), at: c.created_at });
      const s = c.body.match(/codex-review-state:v1\s*(\{.*?\})\s*-->/s);
      if (s) {
        try {
          const st = JSON.parse(s[1]).code_review;
          if (st?.commit_sha) summary = { sha: String(st.commit_sha).toLowerCase(), status: st.status ?? null, hasUnresolved: st.has_unresolved_findings === true };
        } catch {
          /* unreadable state block: ignored, the Gate then falls back to NEEDED */
        }
      }
    } else if (/@codex\s+review\b/i.test(c.body ?? "") && ["OWNER", "MEMBER", "COLLABORATOR"].includes(c.author_association)) {
      requests.push({ at: c.created_at });
    }
  }
  return { receipts, summary, requests };
}

async function readDependency(api, repo, n) {
  const issue = await api.rest(`/repos/${repo}/issues/${n}`);
  if (issue.pull_request) {
    const pr = await api.rest(`/repos/${repo}/pulls/${n}`);
    return { ref: `#${n}`, kind: "pr", state: pr.state, merged: pr.merged === true };
  }
  return { ref: `#${n}`, kind: "issue", state: issue.state, merged: false };
}

export async function collectPrFacts(api, repo, number, { claimDeps = [] } = {}) {
  const pr = await api.rest(`/repos/${repo}/pulls/${number}`);
  const head = pr.head.sha;
  const [commit, checkBody, runs, comments, threads] = await Promise.all([
    api.rest(`/repos/${repo}/commits/${head}`),
    api.rest(`/repos/${repo}/commits/${head}/check-runs?per_page=100`),
    api.rest(`/repos/${repo}/actions/runs?head_sha=${head}&per_page=100`),
    api.restAll(`/repos/${repo}/issues/${number}/comments`),
    readThreads(api, repo, number).catch(() => null),
  ]);

  const runFacts = [];
  for (const r of runs.workflow_runs) {
    const attempts = [];
    for (let a = 1; a < r.run_attempt; a++) {
      const jobs = await api.rest(`/repos/${repo}/actions/runs/${r.id}/attempts/${a}/jobs?per_page=100`);
      const failed = jobs.jobs.filter((j) => j.conclusion && j.conclusion !== "success" && j.conclusion !== "skipped").map((j) => j.name);
      attempts.push({ attempt: a, conclusion: failed.length ? "failure" : "success", failedJobs: failed });
    }
    runFacts.push({ id: r.id, name: r.name, runAttempt: r.run_attempt, conclusion: r.conclusion, headSha: r.head_sha, attempts });
  }

  const depNums = [...new Set([...parseDependsOn(pr.body), ...claimDeps])].filter((n) => n !== number);
  const dependencies = await Promise.all(depNums.map((n) => readDependency(api, repo, n)));

  return {
    pr: {
      number,
      state: pr.state,
      merged: pr.merged === true,
      draft: pr.draft === true,
      title: pr.title,
      body: pr.body ?? "",
      headSha: head,
      headDate: commit.commit?.committer?.date ?? null,
      mergeableState: pr.mergeable_state ?? null,
    },
    checks: checkBody.check_runs.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion, headSha: head })),
    runs: runFacts,
    codex: parseCodex(comments),
    threads,
    dependencies,
  };
}

export async function collectRepoFacts(api, repo, { only = null, now = Date.now(), sinceDays = 14 } = {}) {
  const open = (await api.restAll(`/repos/${repo}/pulls?state=open`)).map((p) => p.number);
  const targets = only ? open.filter((n) => n === only) : open;
  if (only && targets.length === 0) throw new Error(`PR #${only} is not open`);

  const since = new Date(now - sinceDays * 86400 * 1000).toISOString();
  const repoComments = await api.restAll(`/repos/${repo}/issues/comments?since=${encodeURIComponent(since)}&sort=created&direction=desc`, null, 5);

  const prFacts = [];
  const prFiles = [];
  const claimBodies = [];
  for (const n of open) {
    const files = (await api.restAll(`/repos/${repo}/pulls/${n}/files`)).map((f) => f.filename);
    const pr = await api.rest(`/repos/${repo}/pulls/${n}`);
    prFiles.push({ number: n, title: pr.title, draft: pr.draft === true, hold: /\bHOLD\b|マージ禁止/.test(pr.title ?? ""), files });
    claimBodies.push({ body: pr.body ?? "", created_at: pr.created_at, html_url: pr.html_url, author_association: pr.author_association, user: pr.user });
  }
  const claims = parseClaims([...claimBodies, ...repoComments], now);
  for (const n of targets) prFacts.push(await collectPrFacts(api, repo, n, { claimDeps: claims.active.filter((c) => c.pr === n).flatMap((c) => c.dependsOn) }));
  return { prFacts, prFiles, claims, codexLogin: CODEX_LOGIN };
}
