// Regression tests for the independent review of PR #572 (findings F1-F10 and P3).
// Each test reproduces the reviewer's scenario; the READY outcome the review found must no longer occur.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGate } from "./lib/gate-state.mjs";
import { isHold, stripFences } from "./lib/hold.mjs";
import { parseClaims, parseDependsOnDetailed } from "./lib/claims.mjs";
import { findOverlaps, matchesGlob } from "./lib/overlap.mjs";
import { renderMarkdown } from "./lib/render.mjs";
import { safe } from "./lib/sanitize.mjs";
import { collectPrFacts, collectRepoFacts, createApi, parseCodex, TruncatedError } from "./collect-facts.mjs";
import { buildReport } from "./owner-gate.mjs";

const HEAD = "6b2f68d49f569942e6c293cef9f3ea181c5176fb";
const headDate = "2026-10-19T12:40:00Z";
const ok = (n = 11) => Array.from({ length: n }, (_, i) => ({ name: `job${i}`, status: "completed", conclusion: "success", headSha: HEAD }));
const receipt = (over = {}) => ({ sha: HEAD.slice(0, 10), at: "2026-10-19T12:46:01Z", clean: true, ...over });
const run = (over = {}) => ({ id: 1, name: "E2E WebKit", status: "completed", runAttempt: 1, conclusion: "success", headSha: HEAD, attempts: [], ...over });
function facts(over = {}) {
  return {
    pr: { number: 572, state: "open", merged: false, draft: false, title: "feat: x", body: "", labels: [], headSha: HEAD, headDate, mergeableState: "clean", ...over.pr },
    checks: over.checks ?? ok(),
    runs: over.runs ?? [run()],
    codex: over.codex ?? { receipts: [receipt()], summary: null, requests: [], other: [] },
    threads: "threads" in over ? over.threads : { unresolved: 0, total: 0 },
    dependencies: over.dependencies ?? [],
    gaps: over.gaps ?? [],
  };
}
const gate = (o) => evaluateGate(facts(o));
const state = (o) => gate(o).state;
const READY = "READY_FOR_OWNER_REVIEW";

test("baseline: the fixture itself is READY (so every test below isolates one cause)", () => assert.equal(state(), READY));

// ---- F1: run-level failures / in-flight runs ---------------------------------------------------
test("F1: a failed or startup-failed workflow run of the head blocks even when all check runs are green", () => {
  assert.equal(state({ runs: [run({ conclusion: "failure" })] }), "CI_FAILED");
  assert.equal(state({ runs: [run({ conclusion: "startup_failure" })] }), "CI_FAILED");
  assert.equal(state({ runs: [run({ conclusion: "cancelled" })] }), "CI_FAILED");
});
test("F1: a queued / in-progress run with no check run yet is pending, not ready", () => {
  assert.equal(state({ runs: [run({ status: "queued", conclusion: null })] }), "CI_PENDING");
  assert.equal(state({ runs: [run({ status: "in_progress", conclusion: null })] }), "CI_PENDING");
  assert.equal(state({ runs: [run({ status: undefined, conclusion: "success" })] }), "CI_PENDING", "unknown run status is not trusted");
});
test("F1: a run from another head, or a skipped run, does not block", () => {
  assert.equal(state({ runs: [run({ headSha: "a".repeat(40), conclusion: "failure" })] }), READY);
  assert.equal(state({ runs: [run({ conclusion: "skipped" })] }), READY);
});

// ---- F2: mergeable_state / draft ---------------------------------------------------------------
test("F2: draft PRs are never READY", () => {
  assert.equal(state({ pr: { draft: true } }), "DRAFT");
  assert.equal(state({ pr: { mergeableState: "draft" } }), "DRAFT");
});
test("F2: behind is a blocker; blocked / unstable are visible notes; unknown values fail closed", () => {
  assert.equal(state({ pr: { mergeableState: "behind" } }), "BEHIND_BASE");
  const blocked = gate({ pr: { mergeableState: "blocked" } });
  assert.equal(blocked.state, READY, "'blocked' alone is normal while an approval is pending; it must be visible, not a blocker");
  assert.ok(blocked.notes.some((n) => n.includes("'blocked'")));
  assert.ok(gate({ pr: { mergeableState: "unstable" } }).notes.some((n) => n.includes("'unstable'")));
  assert.equal(state({ pr: { mergeableState: "something_new" } }), "FACTS_INCOMPLETE");
  assert.equal(state({ pr: { mergeableState: "has_hooks" } }), READY);
});

// ---- F3: HOLD ----------------------------------------------------------------------------------
test("F3: ordinary prose does not hold a PR", () => {
  assert.equal(state({ pr: { body: "Click and hold the corner to stretch the dough." } }), READY);
  assert.equal(state({ pr: { body: "- [ ] do not merge until HV is done (checklist)" } }), READY);
  assert.equal(state({ pr: { title: "feat(pan): hold-to-stretch gesture" } }), READY);
  assert.equal(isHold({ title: "on hold", body: "" }), false, "an unbracketed word is not a marker");
});
test("F3: real markers hold: bracketed title, label, line-start body marker; fenced examples do not", () => {
  assert.equal(isHold({ title: "[HOLD / Draft・マージ禁止] feat(recipes): grandma" }), true);
  assert.equal(isHold({ title: "【保留】x" }), true);
  assert.equal(isHold({ title: "x [merge禁止]" }), true);
  assert.equal(isHold({ title: "x", labels: ["hold"] }), true);
  assert.equal(isHold({ title: "x", body: "intro\nHOLD: waiting for #12\n" }), true);
  assert.equal(isHold({ title: "x", body: "```\nHOLD: example\n```" }), false);
  assert.equal(state({ pr: { title: "[HOLD] x" } }), "HOLD");
});
test("F3: HOLD never hides another blocker", () => {
  const r = gate({ pr: { title: "[HOLD] x" }, checks: [...ok(10), { name: "WebKit Gate", status: "completed", conclusion: "failure", headSha: HEAD }] });
  assert.equal(r.state, "CI_FAILED");
  assert.equal(r.hold, true);
  assert.ok(r.blockers.some((b) => b.startsWith("HOLD:")) && r.blockers.some((b) => b.startsWith("CI_FAILED:")));
  const md = renderMarkdown({ results: [r], overlaps: [], claims: { active: [], expired: [], released: [], invalid: [] }, repo: "o/r", generatedAt: "t" });
  assert.match(md, /\*\*CI_FAILED\*\* \+ HOLD/);
});
test("F3: the overlap [HOLD] tag and the Gate use the same definition (collector path)", async () => {
  const api = repoApi({ prs: [{ n: 540, title: "[HOLD / Draft・マージ禁止] x", body: "hold the line", labels: [] }, { n: 541, title: "x", body: "click and hold", labels: [] }] });
  const out = await collectRepoFacts(api, "o/r", { only: null, now: Date.parse("2026-10-20T00:00:00Z") });
  assert.deepEqual(out.prFiles.map((p) => [p.number, p.hold]), [[540, true], [541, false]]);
});

// ---- F4: Codex receipt content -----------------------------------------------------------------
const botComment = (body, at = "2026-10-19T12:46:00Z", extra = {}) => ({ id: Math.random(), user: { login: "chatgpt-codex-connector[bot]", type: "Bot" }, author_association: "NONE", created_at: at, body, ...extra });
const owner = (body, at) => ({ id: Math.random(), user: { login: "perusonao", type: "User" }, author_association: "OWNER", created_at: at, body });
const codexState = (c) => gate({ codex: parseCodex(c) });

test("F4: a receipt that does not say 'no major issues' is not a pass", () => {
  const withFindings = botComment(`<!-- codex-review-receipt:v1 -->\nHere are some automated review suggestions for this pull request.\n**P1** data loss in reset\n\n**Reviewed commit:** \`${HEAD.slice(0, 10)}\``);
  const r = codexState([withFindings]);
  assert.equal(r.state, "CODEX_ERROR");
  assert.equal(r.codex.status, "UNCLEAR");
});
test("F4: the real clean receipt wording passes (straight and curly apostrophes)", () => {
  for (const apo of ["'", "’"]) {
    const c = botComment(`<!-- codex-review-receipt:v1 -->\n\nCodex Review: Didn${apo}t find any major issues. Keep it up!\n\n**Reviewed commit:** \`${HEAD.slice(0, 10)}\``);
    assert.equal(codexState([c]).state, READY);
  }
});
test("F4: a summary state without an explicit has_unresolved_findings:false is not clean", () => {
  const s = (v) => botComment(`<!-- codex-review-state:v1 {"code_review":{"commit_sha":"${HEAD}","status":"completed",${v}},"security_review":{}} -->`);
  assert.equal(codexState([s('"has_unresolved_findings":false')]).state, READY);
  assert.equal(codexState([s('"has_unresolved_findings":null')]).state, "CODEX_ERROR");
  assert.equal(codexState([s('"x":1')]).state, "CODEX_ERROR");
  assert.equal(codexState([s('"has_unresolved_findings":true')]).state, "CODEX_FINDINGS");
});

// ---- F5: Codex errors never wait forever / never pass -----------------------------------------
const ENV_MSG = "To use Codex here, [create an environment for this repo](https://chatgpt.com/codex/cloud/settings/environments).";
test("F5: the 'create an environment' comment is CODEX_ERROR, not NEEDED/PENDING/READY", () => {
  const r = codexState([botComment(ENV_MSG, "2026-10-19T14:20:04Z")]);
  assert.equal(r.state, "CODEX_ERROR");
  assert.match(r.blockers.find((b) => b.startsWith("CODEX_ERROR")), /environment/);
});
test("F5: an @codex review request followed by the error is an error, not 'pending forever'", () => {
  const r = codexState([owner("@codex review", "2026-10-19T12:44:00Z"), botComment(ENV_MSG, "2026-10-19T12:45:00Z")]);
  assert.equal(r.state, "CODEX_ERROR");
});
test("F5: a newer request after the error is pending; a later clean receipt clears it", () => {
  const err = botComment(ENV_MSG, "2026-10-19T12:45:00Z");
  assert.equal(codexState([err, owner("@codex review", "2026-10-19T12:50:00Z")]).state, "CODEX_PENDING");
  const clean = botComment(`<!-- codex-review-receipt:v1 -->\nDidn't find any major issues.\n**Reviewed commit:** \`${HEAD.slice(0, 10)}\``, "2026-10-19T12:55:00Z");
  assert.equal(codexState([err, owner("@codex review", "2026-10-19T12:50:00Z"), clean]).state, READY);
});
test("F5: an error AFTER a clean receipt is not ignored", () => {
  const clean = botComment(`<!-- codex-review-receipt:v1 -->\nDidn't find any major issues.\n**Reviewed commit:** \`${HEAD.slice(0, 10)}\``, "2026-10-19T12:46:00Z");
  assert.equal(codexState([clean, botComment("Something went wrong running the review.", "2026-10-19T12:50:00Z")]).state, "CODEX_ERROR");
});
test("F5: summary status failed -> error; running -> pending; comments from before the head are ignored", () => {
  const s = (status) => botComment(`<!-- codex-review-state:v1 {"code_review":{"commit_sha":"${HEAD}","status":"${status}","has_unresolved_findings":false},"security_review":{}} -->`);
  assert.equal(codexState([s("failed")]).state, "CODEX_ERROR");
  assert.equal(codexState([s("in_progress")]).state, "CODEX_PENDING");
  assert.equal(codexState([botComment(ENV_MSG, "2026-10-19T10:00:00Z")]).state, "CODEX_NEEDED", "an old error is not about this head");
});
test("F5: only the Codex bot can create an error or a receipt (an outsider's copy is ignored)", () => {
  const fake = { id: 1, user: { login: "mallory", type: "User" }, author_association: "NONE", created_at: "2026-10-19T12:50:00Z", body: ENV_MSG };
  assert.equal(codexState([fake]).state, "CODEX_NEEDED");
});

// ---- F6 / P3: fetch failures and truncation fail closed -----------------------------------------
function fakeFetch(handler) {
  return async (url) => {
    const r = await handler(new URL(url));
    return { ok: r.status === undefined || r.status < 400, status: r.status ?? 200, json: async () => r.body };
  };
}
test("F6: a list that fills its last page is a TruncatedError, never a silently short list", async () => {
  const api = createApi({ token: "t", fetchImpl: fakeFetch(() => ({ body: Array.from({ length: 100 }, (_, i) => i) })) });
  await assert.rejects(() => api.restAll("/repos/o/r/issues/1/comments", null, 3), TruncatedError);
  const short = createApi({ token: "t", fetchImpl: fakeFetch(() => ({ body: [1, 2] })) });
  assert.deepEqual(await short.restAll("/repos/o/r/x"), [1, 2]);
});
test("F6: unreadable check runs / runs / comments / threads become gaps -> FACTS_INCOMPLETE (not 'nothing found')", async () => {
  const api = prApi({ failing: [/check-runs/, /actions\/runs\?head_sha/, /issues\/572\/comments/] });
  const f = await collectPrFacts(api, "o/r", 572);
  assert.ok(f.gaps.some((g) => g.startsWith("check runs")) && f.gaps.some((g) => g.startsWith("workflow runs")) && f.gaps.some((g) => g.startsWith("PR comments")));
  const r = evaluateGate(f);
  assert.notEqual(r.state, READY);
  assert.ok(r.blockers.some((b) => b.startsWith("FACTS_INCOMPLETE") && b.includes("check runs")));
});
test("F6: a failing attempt-jobs request is a gap and the rerun note is not silently dropped", async () => {
  const api = prApi({ runs: [{ id: 7, name: "E2E", status: "completed", run_attempt: 2, conclusion: "success", head_sha: HEAD }], failing: [/attempts\/1\/jobs/] });
  const f = await collectPrFacts(api, "o/r", 572);
  assert.ok(f.gaps.some((g) => g.includes("attempt 1 jobs of run 7")));
  assert.equal(evaluateGate(f).blockers.some((b) => b.startsWith("FACTS_INCOMPLETE")), true);
});
test("F6: one unreadable PR is a FACTS_INCOMPLETE row; it does not abort the report", async () => {
  const api = repoApi({ prs: [{ n: 1, title: "a", body: "" }, { n: 2, title: "b", body: "" }], failingPr: 2 });
  const out = await collectRepoFacts(api, "o/r", { now: Date.parse("2026-10-20T00:00:00Z") });
  const results = out.prFacts.map((f) => evaluateGate(f));
  assert.equal(results.length, 2);
  assert.equal(results.find((r) => r.pr === 2).state, "FACTS_INCOMPLETE");
  assert.ok(out.repoGaps.some((g) => g.includes("PR #2")));
});
test("F6: truncated claim comments / PR files are reported as gaps in the output", async () => {
  const api = repoApi({ prs: [{ n: 1, title: "a", body: "" }], truncateComments: true, truncateFiles: true });
  const out = await collectRepoFacts(api, "o/r", { now: Date.parse("2026-10-20T00:00:00Z") });
  assert.ok(out.repoGaps.some((g) => g.startsWith("claims:")));
  assert.ok(out.repoGaps.some((g) => g.includes("changed files")));
  const rep = buildReport({ ...out, repo: "o/r", now: 0 });
  assert.match(rep.md, /Data gaps/);
});
test("P3: legacy commit statuses are read (failure blocks, pending waits)", async () => {
  const fail = await collectPrFacts(prApi({ statuses: [{ context: "ci/legacy", state: "failure" }] }), "o/r", 572);
  assert.equal(evaluateGate(fail).state, "CI_FAILED");
  const pend = await collectPrFacts(prApi({ statuses: [{ context: "ci/legacy", state: "pending" }] }), "o/r", 572);
  assert.equal(evaluateGate(pend).state, "CI_PENDING");
});

// ---- F7 ---------------------------------------------------------------------------------------
test("F7: the report says failure history covers the current head only", () => {
  assert.ok(gate().notes.some((n) => n.includes("CURRENT head only")));
});

// ---- F8: Markdown / HTML injection -------------------------------------------------------------
test("F8: hostile check, job and claim names cannot forge rows, links or HTML", () => {
  const evil = "evil\r\n\r\n| #999 fake | `deadbeef00` | **READY_FOR_OWNER_REVIEW** | 9/0/0 | x | y |\n<img src=//x onerror=1>[click](http://evil.example) `code` *bold*";
  const r = gate({ checks: [...ok(10), { name: evil, status: "completed", conclusion: "failure", headSha: HEAD }], runs: [run({ name: evil, runAttempt: 2, attempts: [{ attempt: 1, conclusion: "failure", failedJobs: [evil] }] })], pr: { title: evil } });
  const claims = { active: [{ session: evil, issue: 1, pr: null, files: [evil], dependsOn: [], expiresAt: 1, released: false }], expired: [], released: [], invalid: [{ error: evil, url: evil }] };
  const md = renderMarkdown({ results: [r], overlaps: [{ a: { label: evil }, b: { label: evil }, files: [evil], hot: [evil] }], claims, repo: evil, generatedAt: "t", repoGaps: [evil] });
  assert.ok(!/^\| #999/m.test(md), "no forged table row");
  assert.ok(!/<img|onerror=1>|\]\(http/.test(md), "no HTML or link");
  assert.ok(!md.includes("\r"));
  assert.equal(md.split("\n").filter((l) => l.startsWith("| #")).length, 1, "exactly the one real row");
  assert.equal(safe("a\u0000b‮c"), "a b c");
  assert.ok(safe("x".repeat(500)).length <= 160);
});

// ---- F9: directory claims -----------------------------------------------------------------------
test("F9: a claim on a directory (with or without trailing slash) overlaps files under it", () => {
  assert.ok(matchesGlob("src/components/square/A.tsx", "src/components/square/"));
  assert.ok(matchesGlob("src/components/square/A.tsx", "src/components/square"));
  assert.ok(!matchesGlob("src/components/squares/A.tsx", "src/components/square"));
  assert.ok(matchesGlob("Makefile", "Makefile"));
  const o = findOverlaps({
    prs: [{ number: 1, title: "a", draft: false, hold: false, files: ["src/components/square/A.tsx"] }],
    claims: [{ session: "s", issue: 9, pr: null, files: ["src/components/square/", "src/state"], dependsOn: [], expiresAt: 1, released: false }],
    hotFiles: [],
  });
  assert.equal(o.length, 1);
});

// ---- F10: Depends-on -----------------------------------------------------------------------------
test("F10: bullet, quote and bold forms of Depends-on are read", () => {
  const body = ["- Depends-on: #5", "**Depends-on:** #6", "> Depends-on: #8", "* **Depends on**: #9, #10", "Depends-on: #11"].join("\n");
  assert.deepEqual(parseDependsOnDetailed(body).numbers, [5, 6, 8, 9, 10, 11]);
  assert.deepEqual(parseDependsOnDetailed(body).problems, []);
});
test("F10: cross-repo refs and empty lines are problems, never mis-read as this repo's number", () => {
  const d = parseDependsOnDetailed("Depends on: org/other#7\nDepends-on: https://github.com/o/r/pull/3\nDepends-on:\nDepends-on: #4");
  assert.deepEqual(d.numbers, [4]);
  assert.equal(d.problems.length, 3);
  assert.deepEqual(parseDependsOnDetailed("```\nDepends-on: #99\n```").numbers, [], "fenced examples are ignored");
});
test("F10: an unreadable Depends-on line makes the PR FACTS_INCOMPLETE", async () => {
  const f = await collectPrFacts(prApi({ body: "Depends on: org/other#7" }), "o/r", 572);
  assert.ok(f.gaps.some((g) => g.includes("Depends-on")));
  assert.equal(evaluateGate(f).blockers.some((b) => b.startsWith("FACTS_INCOMPLETE")), true);
});

// ---- P3 -----------------------------------------------------------------------------------------
test("P3: a claim example inside a code fence is documentation, not a claim", () => {
  const block = '<!-- teto-claim:v1 {"session":"session_01ABC","issue":537,"files":["src/a.ts"]} -->';
  const c = (body) => ({ body, created_at: "2026-10-19T00:00:00Z", author_association: "OWNER", html_url: "u" });
  const now = Date.parse("2026-10-19T01:00:00Z");
  assert.equal(parseClaims([c("```\n" + block + "\n```")], now).active.length, 0);
  assert.equal(parseClaims([c("~~~\n" + block + "\n~~~")], now).active.length, 0);
  assert.equal(parseClaims([c(block)], now).active.length, 1);
  assert.equal(stripFences("a\n```\nb\n```\nc").includes("b"), false);
});
test("P3: a Codex-bot comment with a null body does not abort collection", () => {
  assert.doesNotThrow(() => parseCodex([botComment(null), { user: { login: "x" }, body: null }]));
  assert.equal(codexState([botComment(null)]).codex.status, "ERROR");
});
test("P3: renamed files contribute their old path too (conflicts on the old path are visible)", async () => {
  const api = repoApi({ prs: [{ n: 1, title: "a", body: "" }], files: [{ filename: "src/new.ts", previous_filename: "src/old.ts" }] });
  const out = await collectRepoFacts(api, "o/r", { now: Date.parse("2026-10-20T00:00:00Z") });
  assert.deepEqual(out.prFiles[0].files, ["src/new.ts", "src/old.ts"]);
});

// ---- the review's headline scenario, end to end --------------------------------------------------
test("the Codex 'environment not configured' comment on the live PR shape is never read as a passed review", async () => {
  const api = prApi({ comments: [botComment(ENV_MSG, "2026-10-19T14:20:04Z")], headDate: "2026-10-19T14:19:00Z" });
  const f = await collectPrFacts(api, "o/r", 572);
  const r = evaluateGate(f);
  assert.equal(r.state, "CODEX_ERROR");
  assert.notEqual(r.codex.status, "COMPLETED_FOR_HEAD");
});

// ---- fake APIs ---------------------------------------------------------------------------------
function prApi({ failing = [], runs = [], statuses = [], comments = [], body = "", headDate: hd = headDate } = {}) {
  const routes = [
    [/\/pulls\/572$/, { number: 572, state: "open", merged: false, draft: false, title: "t", body, labels: [], head: { sha: HEAD }, mergeable_state: "clean" }],
    [/\/commits\/[0-9a-f]{40}$/, { commit: { committer: { date: hd } } }],
    [/check-runs/, { check_runs: [{ name: "build", status: "completed", conclusion: "success" }] }],
    [/\/status$/, { statuses }],
    [/actions\/runs\?head_sha/, { workflow_runs: runs }],
    [/attempts\/\d+\/jobs/, { jobs: [{ name: "j", conclusion: "failure" }] }],
    [/issues\/572\/comments/, comments],
  ];
  return fake(routes, failing);
}
function fake(routes, failing = [], threads = { nodes: [], pageInfo: { hasNextPage: false } }) {
  const rest = async (p) => {
    if (failing.some((re) => re.test(p))) throw new Error(`GET ${p.split("?")[0]} -> 500`);
    for (const [re, b] of routes) if (re.test(p)) return b;
    throw new Error(`unrouted ${p}`);
  };
  return { rest, restAll: async (p, key) => { const b = await rest(p); return key ? b[key] : b; }, graphql: async () => ({ repository: { pullRequest: { reviewThreads: threads } } }) };
}
function repoApi({ prs, failingPr = null, truncateComments = false, truncateFiles = false, files = [{ filename: "src/a.ts" }] }) {
  const get = (n) => prs.find((p) => p.n === n);
  const rest = async (p) => {
    let m;
    if ((m = p.match(/\/pulls\/(\d+)$/))) {
      const n = Number(m[1]);
      if (n === failingPr) throw new Error(`GET /repos/o/r/pulls/${n} -> 500`);
      const x = get(n);
      return { number: n, state: "open", merged: false, draft: false, title: x.title, body: x.body, labels: (x.labels ?? []).map((name) => ({ name })), head: { sha: HEAD }, mergeable_state: "clean", created_at: "2026-10-19T00:00:00Z", html_url: `u${n}`, author_association: "OWNER", user: {} };
    }
    if (/\/commits\/[0-9a-f]{40}$/.test(p)) return { commit: { committer: { date: headDate } } };
    if (/check-runs/.test(p)) return { check_runs: [] };
    if (/\/status$/.test(p)) return { statuses: [] };
    if (/actions\/runs/.test(p)) return { workflow_runs: [] };
    if (/issues\/\d+\/comments/.test(p)) return [];
    throw new Error(`unrouted ${p}`);
  };
  return {
    rest,
    restAll: async (p, key) => {
      if (/\/pulls\?state=open/.test(p)) return prs.map((x) => ({ number: x.n }));
      if (/issues\/comments\?since/.test(p)) {
        if (truncateComments) throw new TruncatedError("comments");
        return [];
      }
      if (/\/pulls\/\d+\/files/.test(p)) {
        if (truncateFiles) throw new TruncatedError("files");
        return files;
      }
      const b = await rest(p);
      return key ? b[key] : b;
    },
    graphql: async () => ({ repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } } } } }),
  };
}
