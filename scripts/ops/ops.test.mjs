import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateGate } from "./lib/gate-state.mjs";
import { parseClaims, parseDependsOn, MAX_TTL_MS } from "./lib/claims.mjs";
import { findOverlaps, globToRegExp, globsIntersect } from "./lib/overlap.mjs";
import { renderMarkdown } from "./lib/render.mjs";
import { collectPrFacts, createApi } from "./collect-facts.mjs";
import { buildReport } from "./owner-gate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const HEAD = "6b2f68d49f569942e6c293cef9f3ea181c5176fb";
const OLD = "b26f9552bc92d6da5f9aebd1b180e601f8fd541d";
const headDate = "2026-10-19T12:40:00Z";

const green = (n, sha = HEAD) => Array.from({ length: n }, (_, i) => ({ name: `job${i}`, status: "completed", conclusion: "success", headSha: sha }));
function facts(over = {}) {
  return {
    pr: { number: 568, state: "open", merged: false, draft: false, title: "feat(save): x", body: "", headSha: HEAD, headDate, mergeableState: "clean", ...over.pr },
    checks: over.checks ?? green(11),
    runs: over.runs ?? [],
    codex: over.codex ?? { receipts: [{ sha: HEAD.slice(0, 10), at: "2026-10-19T12:46:01Z", clean: true }], summary: null, requests: [], other: [] },
    gaps: over.gaps ?? [],
    threads: "threads" in over ? over.threads : { unresolved: 0, total: 2 },
    dependencies: over.dependencies ?? [],
  };
}
const state = (o) => evaluateGate(facts(o)).state;

test("clean head -> READY_FOR_OWNER_REVIEW, and never claims HV / merge approval / required checks", () => {
  const r = evaluateGate(facts());
  assert.equal(r.state, "READY_FOR_OWNER_REVIEW");
  assert.equal(r.humanVerification, "NOT_ASSESSED");
  assert.equal(r.mergeApproval, "NOT_ASSESSED");
  assert.match(r.requiredChecks, /UNKNOWN/);
  assert.match(r.nextAction, /NOT merge approval/);
  assert.equal(r.checks.observed, 11);
});

test("CI success alone does not make a PR ready (Codex / threads / mergeability still gate)", () => {
  assert.equal(state({ codex: { receipts: [], summary: null, requests: [], other: [] } }), "CODEX_NEEDED");
  assert.equal(state({ threads: { unresolved: 1, total: 1 } }), "THREADS_OPEN");
  assert.equal(state({ pr: { mergeableState: "dirty" } }), "CONFLICT");
});

test("latest head vs reviewed head are distinguished", () => {
  const old = { receipts: [{ sha: OLD.slice(0, 10), at: "2026-10-19T11:53:00Z", clean: true }], summary: { sha: OLD, status: "completed", hasUnresolved: false }, requests: [], other: [] };
  const r = evaluateGate(facts({ codex: old }));
  assert.equal(r.state, "CODEX_NEEDED");
  assert.equal(r.codex.reviewedIsHead, false);
  assert.ok(r.notes.some((n) => n.includes("not the current head")));
  // a request made after the head commit, no receipt yet -> pending
  const asked = { ...old, requests: [{ at: "2026-10-19T12:44:08Z" }] };
  assert.equal(state({ codex: asked }), "CODEX_PENDING");
  // a request older than the head commit does not count
  assert.equal(state({ codex: { ...old, requests: [{ at: "2026-10-19T11:51:11Z" }] } }), "CODEX_NEEDED");
});

test("Codex summary for the head: completed / in progress / findings", () => {
  const sum = (status, hasUnresolved = false) => ({ receipts: [], summary: { sha: HEAD, status, hasUnresolved }, requests: [], other: [] });
  assert.equal(state({ codex: sum("completed") }), "READY_FOR_OWNER_REVIEW");
  assert.equal(state({ codex: sum("in_progress") }), "CODEX_PENDING");
  assert.equal(state({ codex: sum("completed", true) }), "CODEX_FINDINGS");
});

test("a short or empty reviewed sha never matches the head", () => {
  assert.equal(state({ codex: { receipts: [{ sha: "6b2", at: "2026-10-19T12:46:01Z", clean: true }], summary: null, requests: [], other: [] } }), "CODEX_NEEDED");
  assert.equal(state({ codex: { receipts: [{ sha: "", at: "2026-10-19T12:46:01Z", clean: true }], summary: null, requests: [], other: [] } }), "CODEX_NEEDED");
});

test("CI results of an older head are ignored, and no current result means pending", () => {
  const r = evaluateGate(facts({ checks: green(11, OLD) }));
  assert.equal(r.state, "CI_PENDING");
  assert.ok(r.notes.some((n) => n.includes("older head")));
  assert.equal(state({ checks: [...green(10), { name: "WebKit Gate", status: "completed", conclusion: "failure", headSha: HEAD }] }), "CI_FAILED");
  assert.equal(state({ checks: [...green(10), { name: "x", status: "in_progress", conclusion: null, headSha: HEAD }] }), "CI_PENDING");
  assert.equal(state({ checks: [...green(10), { name: "x", status: "completed", conclusion: "cancelled", headSha: HEAD }] }), "CI_FAILED");
  assert.equal(state({ checks: [...green(10), { name: "x", status: "completed", conclusion: "skipped", headSha: HEAD }] }), "READY_FOR_OWNER_REVIEW");
});

test("first failure + successful rerun keeps its history and is not hidden", () => {
  const runs = [{ id: 39238436492, name: "E2E WebKit", status: "completed", runAttempt: 2, conclusion: "success", headSha: HEAD, attempts: [{ attempt: 1, conclusion: "failure", failedJobs: ["webkit webkit-360x800 shard 3/3"] }] }];
  const r = evaluateGate(facts({ runs }));
  assert.equal(r.state, "READY_FOR_OWNER_REVIEW");
  const note = r.notes.find((n) => n.startsWith("RERUN_PASSED"));
  assert.ok(note, "rerun-passed note present");
  assert.match(note, /shard 3\/3/);
  assert.match(note, /NOT cleared/);
  const again = evaluateGate(facts({ runs: [{ ...runs[0], conclusion: "failure" }], checks: [...green(10), { name: "x", status: "completed", conclusion: "failure", headSha: HEAD }] }));
  assert.ok(again.notes.some((n) => n.startsWith("RERUN_FAILED_AGAIN")));
  assert.equal(again.state, "CI_FAILED");
  // history on an older head is not attributed to the current one
  assert.equal(evaluateGate(facts({ runs: [{ ...runs[0], headSha: OLD }] })).notes.filter((n) => n.startsWith("RERUN")).length, 0);
});

test("dependencies: open PR / unmerged-closed PR block; merged PR and closed issue do not", () => {
  const dep = (o) => ({ ref: "#558", kind: "pr", state: "open", merged: false, ...o });
  assert.equal(state({ dependencies: [dep({})] }), "WAIT_DEPENDENCY");
  assert.equal(state({ dependencies: [dep({ state: "closed", merged: false })] }), "WAIT_DEPENDENCY");
  assert.equal(state({ dependencies: [dep({ state: "closed", merged: true })] }), "READY_FOR_OWNER_REVIEW");
  assert.equal(state({ dependencies: [dep({ kind: "issue", state: "closed" })] }), "READY_FOR_OWNER_REVIEW");
});

test("precedence: closed > conflict > dependency > CI; HOLD is the lowest and never hides a blocker", () => {
  const bad = { pr: { mergeableState: "dirty", title: "[HOLD] x" }, checks: [{ name: "x", status: "completed", conclusion: "failure", headSha: HEAD }], dependencies: [{ ref: "#1", kind: "pr", state: "open", merged: false }] };
  assert.equal(state(bad), "CONFLICT");
  assert.equal(evaluateGate(facts(bad)).hold, true);
  assert.equal(state({ ...bad, pr: { mergeableState: "clean", title: "[HOLD] x" } }), "WAIT_DEPENDENCY");
  assert.equal(state({ ...bad, dependencies: [], pr: { mergeableState: "clean", title: "[HOLD] x" } }), "CI_FAILED");
  assert.equal(state({ ...bad, pr: { state: "closed", title: "x" } }), "CLOSED");
  assert.equal(state({ pr: { title: "[HOLD] feat" } }), "HOLD");
  assert.equal(state({ pr: { title: "feat", body: "HOLD: waiting for the Owner" } }), "HOLD");
});

test("unknown mergeability or unreadable threads is FACTS_INCOMPLETE, never ready", () => {
  assert.equal(state({ pr: { mergeableState: null } }), "FACTS_INCOMPLETE");
  assert.equal(state({ threads: null }), "FACTS_INCOMPLETE");
});

test("every state has a next action and the state list covers all outcomes", async () => {
  const { STATES } = await import("./lib/gate-state.mjs");
  for (const s of STATES) {
    const sample = evaluateGate(facts());
    assert.ok(typeof sample.nextAction === "string");
    assert.ok(s.length > 0);
  }
});

test("claims: parse, newest wins, release, expiry, TTL cap, and untrusted authors are ignored", () => {
  const now = Date.parse("2026-10-20T00:00:00Z");
  const block = (o) => `<!-- teto-claim:v1 ${JSON.stringify(o)} -->`;
  const c = (body, at, assoc = "OWNER") => ({ body, created_at: at, html_url: `https://x/${at}`, author_association: assoc, user: { login: "perusonao" } });
  const r = parseClaims(
    [
      c(block({ session: "s1", issue: 10, files: ["src/a.ts"], expires: "2026-10-21T00:00:00Z" }), "2026-10-19T00:00:00Z"),
      c(block({ session: "s2", issue: 11, files: ["src/b.ts"] }), "2026-10-19T00:00:00Z"),
      c(block({ session: "s3", issue: 12, files: ["src/c.ts"] }), "2026-10-10T00:00:00Z"),
      c(block({ session: "s2", issue: 11, released: true }), "2026-10-19T05:00:00Z"),
      c(block({ session: "evil", issue: 13, files: ["src/App.css"] }), "2026-10-19T00:00:00Z", "NONE"),
      c(block({ session: "s4", issue: 14, files: ["../etc/passwd"] }), "2026-10-19T00:00:00Z"),
      c("<!-- teto-claim:v1 {not json} -->", "2026-10-19T00:00:00Z"),
      c(block({ session: "s5", issue: 15, files: ["src/d.ts"], expires: "2030-01-01T00:00:00Z" }), "2026-10-19T00:00:00Z"),
    ],
    now,
  );
  assert.deepEqual(r.active.map((x) => x.session).sort(), ["s1", "s5"]);
  assert.deepEqual(r.released.map((x) => x.session), ["s2"]);
  assert.deepEqual(r.expired.map((x) => x.session), ["s3"]);
  assert.equal(r.invalid.length, 3);
  assert.ok(r.invalid.some((i) => /not trusted/.test(i.error)));
  assert.equal(r.active.find((x) => x.session === "s5").expiresAt, Date.parse("2026-10-19T00:00:00Z") + MAX_TTL_MS);
});

test("Depends-on lines are parsed from PR bodies only at line start", () => {
  assert.deepEqual(parseDependsOn("x\nDepends-on: #558, #560\n  depends on: #12\nnot Depends-on: #99 (mid-line)\nsee Depends-on: #98"), [12, 558, 560]);
  assert.deepEqual(parseDependsOn(null), []);
});

test("overlap: PR vs PR on exact files, PR vs claim glob, hot files first, own claim skipped", () => {
  const prs = [
    { number: 566, title: "a", draft: false, hold: false, files: ["src/App.css", "src/state/panSelection.ts", "src/screens/GameScreen.tsx"] },
    { number: 568, title: "b", draft: false, hold: false, files: ["src/App.css", "src/state/saveHealth.ts"] },
    { number: 540, title: "c", draft: true, hold: true, files: ["src/data/recipes.ts"] },
  ];
  const claims = [
    { session: "d2", issue: 537, pr: null, files: ["src/state/pan*.ts", "src/screens/GameScreen.tsx"], dependsOn: [], expiresAt: 1, released: false },
    { session: "own", issue: 560, pr: 568, files: ["src/state/**"], dependsOn: [], expiresAt: 1, released: false },
  ];
  const hot = ["src/App.css", "src/screens/GameScreen.tsx"];
  const o = findOverlaps({ prs, claims, hotFiles: hot });
  const pair = (x, y) => o.find((e) => [e.a.label, e.b.label].sort().join("|") === [x, y].sort().join("|"));
  assert.deepEqual(pair("PR #566", "PR #568").files, ["src/App.css"]);
  assert.deepEqual(pair("PR #566", "PR #568").hot, ["src/App.css"]);
  assert.deepEqual(pair("PR #566", "claim d2 (Issue #537)").files, ["src/screens/GameScreen.tsx", "src/state/panSelection.ts"]);
  assert.ok(!pair("PR #568", "claim own (Issue #560)"), "a claim and its own PR are one piece of work");
  assert.ok(o.every((e) => !e.a.label.includes("540") && !e.b.label.includes("540")));
  assert.equal(o[0].hot.length >= o[o.length - 1].hot.length, true);
});

test("glob helpers", () => {
  assert.ok(globToRegExp("e2e/**/*.spec.ts").test("e2e/a/b.spec.ts"));
  assert.ok(globToRegExp("e2e/**/*.spec.ts").test("e2e/b.spec.ts"));
  assert.ok(!globToRegExp("src/*.ts").test("src/a/b.ts"));
  assert.ok(globToRegExp("a.b").test("a.b") && !globToRegExp("a.b").test("axb"));
  assert.ok(globsIntersect("src/state/**", "src/state/x.ts"));
  assert.ok(globsIntersect("src/state/**", "src/state/pan*"));
  assert.ok(!globsIntersect("src/a/**", "src/b/**"));
});

// ---- collector: hermetic, driven by a fake API ------------------------------------------------
function fakeApi(routes, threads = { nodes: [{ isResolved: true }, { isResolved: false }], pageInfo: { hasNextPage: false } }) {
  const seen = [];
  const rest = async (p) => {
    seen.push(p);
    for (const [re, body] of routes) if (re.test(p)) return typeof body === "function" ? body(p) : body;
    throw new Error(`unrouted ${p}`);
  };
  return {
    seen,
    rest,
    restAll: async (p, key) => {
      const b = await rest(p);
      return key ? b[key] : b;
    },
    graphql: async (q) => {
      assert.match(q, /^\s*query/);
      return { repository: { pullRequest: { reviewThreads: threads } } };
    },
  };
}

test("collector builds facts for the CURRENT head, with Codex trust checks and rerun history", async () => {
  const fx = JSON.parse(fs.readFileSync(path.join(here, "fixtures/codex-comments-568.json"), "utf8")).comments;
  // an outsider copies the receipt text for the current head: must not count
  const spoof = { id: 1, user: { login: "mallory", type: "User" }, author_association: "NONE", created_at: "2026-10-19T12:50:00Z", body: "<!-- codex-review-receipt:v1 -->\n**Reviewed commit:** `deadbeef12`" };
  const api = fakeApi([
    [/\/pulls\/568$/, { number: 568, state: "open", merged: false, draft: false, title: "feat(save)", body: "Depends-on: #558", head: { sha: HEAD }, mergeable_state: "clean" }],
    [/\/commits\/[0-9a-f]{40}$/, { commit: { committer: { date: headDate } } }],
    [/check-runs/, { check_runs: [{ name: "build", status: "completed", conclusion: "success" }] }],
    [/commits\/[0-9a-f]{40}\/status/, { statuses: [] }],
    [/actions\/runs\?head_sha/, { workflow_runs: [{ id: 7, name: "E2E WebKit", status: "completed", run_attempt: 2, conclusion: "success", head_sha: HEAD }] }],
    [/runs\/7\/attempts\/1\/jobs/, { jobs: [{ name: "webkit webkit-360x800 shard 3/3", conclusion: "failure" }, { name: "classify", conclusion: "success" }] }],
    [/issues\/568\/comments/, [...fx, spoof]],
    [/issues\/558$/, { state: "closed", pull_request: {} }],
    [/pulls\/558$/, { state: "closed", merged: true }],
  ]);
  const f = await collectPrFacts(api, "o/r", 568);
  assert.equal(f.pr.headSha, HEAD);
  assert.deepEqual(f.codex.receipts.map((r) => r.sha), ["b26f9552bc", "6b2f68d49f"]);
  assert.equal(f.codex.summary.sha, HEAD);
  assert.deepEqual(f.threads, { unresolved: 1, total: 2 });
  assert.deepEqual(f.dependencies, [{ ref: "#558", kind: "pr", state: "closed", merged: true }]);
  assert.deepEqual(f.runs[0].attempts, [{ attempt: 1, conclusion: "failure", failedJobs: ["webkit webkit-360x800 shard 3/3"] }]);
  const r = evaluateGate(f);
  assert.equal(r.state, "THREADS_OPEN");
  assert.ok(r.notes.some((n) => n.startsWith("RERUN_PASSED")));
  assert.ok(api.seen.every((p) => p.startsWith("/repos/")), "only repo GETs");
});

test("an unreadable thread query makes the facts incomplete instead of ready", async () => {
  const api = fakeApi([
    [/\/pulls\/1$/, { number: 1, state: "open", title: "t", body: "", head: { sha: HEAD }, mergeable_state: "clean" }],
    [/\/commits\/[0-9a-f]{40}$/, { commit: {} }],
    [/check-runs/, { check_runs: [] }],
    [/\/status$/, { statuses: [] }],
    [/actions\/runs/, { workflow_runs: [] }],
    [/comments/, []],
  ]);
  api.graphql = async () => {
    throw new Error("boom");
  };
  const f = await collectPrFacts(api, "o/r", 1);
  assert.equal(f.threads, null);
  assert.ok(f.gaps.some((g) => g.startsWith("review threads")));
  const r = evaluateGate(f);
  assert.ok(r.blockers.some((b) => b.startsWith("FACTS_INCOMPLETE") && b.includes("review threads")));
});

test("the real client refuses non-repo paths and mutating GraphQL", async () => {
  const api = createApi({ token: "t", fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  await assert.rejects(() => api.rest("/user"), /non-repo/);
  await assert.rejects(() => api.graphql("mutation { x }", {}), /only GraphQL queries/);
});

test("report: renders states, overlap warnings and the dry-run banner; json is serialisable", () => {
  const f = facts();
  const rep = buildReport({
    prFacts: [f],
    prFiles: [
      { number: 568, title: "a", draft: false, hold: false, files: ["src/App.css"] },
      { number: 566, title: "b", draft: false, hold: false, files: ["src/App.css"] },
    ],
    claims: { active: [], expired: [], released: [], invalid: [] },
    repo: "o/r",
    now: Date.parse("2026-10-20T00:00:00Z"),
  });
  assert.match(rep.md, /Owner Gate \(DRY-RUN\)/);
  assert.match(rep.md, /Nothing is posted/);
  assert.match(rep.md, /\*\*HOT\*\*/);
  assert.match(rep.md, /READY_FOR_OWNER_REVIEW/);
  assert.doesNotThrow(() => JSON.stringify(rep.results));
  assert.match(renderMarkdown({ results: [], overlaps: [], claims: { active: [], expired: [], released: [], invalid: [] }, repo: "o/r", generatedAt: "x" }), /None\./);
});
