// Owner Gate: repo-wide comment pagination (claims). Regression for run 40879496988 (main 3bc4ba6), where a 14-day window
// holding more than 500 comments ended as a data gap AND the comments already read were thrown away, so the report said
// "active 0". Every case here drives the real createApi / collectRepoFacts through a fake fetch (no network).
import test from "node:test";
import assert from "node:assert/strict";
import { applyRepoGaps, evaluateGate } from "./lib/gate-state.mjs";
import { renderMarkdown } from "./lib/render.mjs";
import { collectRepoFacts, createApi, REPO_COMMENT_MAX_PAGES, TruncatedError } from "./collect-facts.mjs";
import { buildReport } from "./owner-gate.mjs";

const HEAD = "6b2f68d49f569942e6c293cef9f3ea181c5176fb";
const NOW = Date.parse("2026-10-29T13:00:00Z");
const READY = "READY_FOR_OWNER_REVIEW";

const claimBlock = (o) => `<!-- teto-claim:v1 ${JSON.stringify({ issue: 611, files: ["src/a.ts"], expires: "2026-11-03T00:00:00Z", ...o })} -->`;
// Newest first, like the API call (sort=created&direction=desc). `claims` maps a 0-based index to the claim body at that position.
function comments(n, claims = {}, over = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: 1_000_000 - i,
    body: claims[i] ?? "just talking",
    created_at: new Date(NOW - (i + 1) * 60_000).toISOString(),
    html_url: `https://example.test/c/${i}`,
    author_association: "OWNER",
    user: { login: "perusonao", type: "User" },
    ...over,
  }));
}

/** A fake GitHub: one open PR (#1), the given repo comments, optional per-page failure. */
function fakeGithub({ all, failPage = null, calls = [] }) {
  return async (url, init) => {
    const u = new URL(url);
    const p = u.pathname;
    calls.push(`${init?.method ?? "GET"} ${p}${u.searchParams.has("page") ? `?page=${u.searchParams.get("page")}` : ""}`);
    const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (p === "/graphql") return json({ data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] } } } } });
    if (p === "/repos/o/r/pulls" ) return json(u.searchParams.get("page") === "1" ? [{ number: 1 }] : []);
    if (p === "/repos/o/r/pulls/1") return json({ number: 1, state: "open", merged: false, draft: false, title: "t", body: "", labels: [], head: { sha: HEAD }, mergeable_state: "clean", created_at: "2026-10-28T00:00:00Z", html_url: "https://example.test/pr/1", author_association: "OWNER", user: {} });
    if (p === "/repos/o/r/pulls/1/files") return json(u.searchParams.get("page") === "1" ? [{ filename: "src/b.ts" }] : []);
    if (p === "/repos/o/r/issues/comments") {
      const page = Number(u.searchParams.get("page"));
      if (failPage === page) return json({ message: "boom" }, 500);
      return json(all.slice((page - 1) * 100, page * 100));
    }
    if (p === `/repos/o/r/commits/${HEAD}`) return json({ commit: { committer: { date: "2026-10-28T00:00:00Z" } } });
    if (p.endsWith("/check-runs")) return json({ check_runs: [] });
    if (p.endsWith("/statuses")) return json([]);
    if (p === "/repos/o/r/actions/runs") return json({ workflow_runs: [] });
    if (p === "/repos/o/r/issues/1/comments") return json([]);
    return json({ message: `unrouted ${p}` }, 404);
  };
}
const collect = (all, opts = {}, fetchOpts = {}) =>
  collectRepoFacts(createApi({ token: "t", fetchImpl: fakeGithub({ all, ...fetchOpts }) }), "o/r", { now: NOW, ...opts });
const claimsGap = (out) => out.repoGaps.filter((g) => g.startsWith("claims:"));

// A PR that is otherwise READY, so a downgrade can only come from the repo-level gaps.
function readyFacts() {
  return {
    pr: { number: 1, state: "open", merged: false, draft: false, title: "t", body: "", labels: [], headSha: HEAD, headDate: "2026-10-28T00:00:00Z", mergeableState: "clean" },
    checks: Array.from({ length: 3 }, (_, i) => ({ name: `j${i}`, status: "completed", conclusion: "success", headSha: HEAD })),
    runs: [],
    codex: { receipts: [{ sha: HEAD.slice(0, 10), at: "2026-10-28T01:00:00Z", clean: true }], summary: null, requests: [], other: [] },
    threads: { unresolved: 0, total: 0 },
    dependencies: [],
    gaps: [],
  };
}
const claim = (session = "session_A") => claimBlock({ session });

// ---- page boundaries: the claim sits at the OLDEST position, so it is seen only if every page was read ----
for (const n of [499, 500, 501, 749]) {
  test(`${n} comments, default cap: complete read, the oldest claim is found, no gap`, async () => {
    const calls = [];
    const out = await collect(comments(n, { [n - 1]: claim() }), {}, { calls });
    assert.deepEqual(claimsGap(out), []);
    assert.equal(out.claims.active.length, 1);
    assert.equal(out.claims.active[0].session, "session_A");
    const pages = calls.filter((c) => c.includes("/issues/comments")).length;
    assert.equal(pages, Math.floor(n / 100) + 1, "reads until a short page (an exact multiple needs one empty probe page)");
  });
}

test("cap boundary (5 pages = 500): 499 and exactly 500 are complete; 501 and 749 are a gap", async () => {
  for (const n of [499, 500]) {
    const out = await collect(comments(n, { [n - 1]: claim() }), { commentMaxPages: 5 });
    assert.deepEqual(claimsGap(out), [], `${n} comments`);
    assert.equal(out.claims.active.length, 1, `${n} comments`);
  }
  for (const n of [501, 749]) {
    const out = await collect(comments(n, { 0: claim("session_new"), [n - 1]: claim("session_old") }), { commentMaxPages: 5 });
    assert.equal(claimsGap(out).length, 1, `${n} comments`);
    assert.match(claimsGap(out)[0], /500 newest comment\(s\) were read, older claims may be missing/);
    // what was read is kept (the newest claim), what was not read is not invented
    assert.deepEqual(out.claims.active.map((c) => c.session), ["session_new"]);
  }
});

test("the default cap is 3000 comments; one more is a gap, never a silently short list", async () => {
  assert.equal(REPO_COMMENT_MAX_PAGES, 30);
  const ok = await collect(comments(3000, { 2999: claim() }));
  assert.deepEqual(claimsGap(ok), []);
  assert.equal(ok.claims.active.length, 1);
  const over = await collect(comments(3001, { 3000: claim() }));
  assert.equal(claimsGap(over).length, 1);
  assert.equal(over.claims.active.length, 0, "the claim beyond the cap is unknown, and the report says so");
});

// ---- failures ----------------------------------------------------------------------------------------
test("a page that fails midway is a gap; comments read before the failure are kept", async () => {
  const out = await collect(comments(450, { 5: claim("session_new"), 420: claim("session_old") }), {}, { failPage: 3 });
  assert.equal(claimsGap(out).length, 1);
  assert.match(claimsGap(out)[0], /-> 500/);
  assert.match(claimsGap(out)[0], /200 newest comment\(s\) were read/);
  assert.deepEqual(out.claims.active.map((c) => c.session), ["session_new"]);
});

test("the very first page failing leaves no claims and a gap (not 'nothing found')", async () => {
  const out = await collect(comments(10, { 0: claim() }), {}, { failPage: 1 });
  assert.equal(claimsGap(out).length, 1);
  assert.match(claimsGap(out)[0], /0 newest comment\(s\) were read/);
  assert.equal(out.claims.active.length, 0);
});

test("a response that is not a list is an error with a gap, not an empty page", async () => {
  const api = createApi({ token: "t", fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ message: "not a list" }) }) });
  await assert.rejects(() => api.restAll("/repos/o/r/issues/comments"), /unexpected response shape/);
});

test("restAll: exactly maxPages*100 items complete; one more throws TruncatedError carrying what was read", async () => {
  const mk = (n) => createApi({ token: "t", fetchImpl: async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    return { ok: true, status: 200, json: async () => Array.from({ length: n }, (_, i) => i).slice((page - 1) * 100, page * 100) };
  } });
  assert.equal((await mk(300).restAll("/repos/o/r/x", null, 3)).length, 300);
  await assert.rejects(() => mk(301).restAll("/repos/o/r/x", null, 3), (e) => e instanceof TruncatedError && e.partial.length === 300);
});

// ---- claim semantics through the paginated path (parseClaims is unchanged) -----------------------------
test("released: a later release block (even on another page) removes the claim from active", async () => {
  const out = await collect(comments(250, { 10: claimBlock({ session: "session_A", released: true, files: [] }), 240: claim("session_A") }));
  assert.deepEqual(claimsGap(out), []);
  assert.equal(out.claims.active.length, 0);
  assert.equal(out.claims.released.length, 1);
});

test("invalid: a claim without session, or from an untrusted author, is invalid and never active", async () => {
  const noSession = claimBlock({}); // no session
  const all = [...comments(150, { 120: noSession }), ...comments(1, { 0: claim("session_evil") }, { id: 5, author_association: "NONE", user: { login: "mallory", type: "User" } })];
  const out = await collect(all);
  assert.deepEqual(claimsGap(out), []);
  assert.equal(out.claims.active.length, 0);
  assert.equal(out.claims.invalid.length, 2);
});

test("duplicates: the same comment on two pages counts once; the newest block per (session, issue) wins", async () => {
  // index 99 is an invalid claim sitting on the page boundary: if it is returned twice and not de-duplicated it is counted twice
  const base = comments(220, { 150: claimBlock({ session: "session_A", files: ["src/old.ts"] }), 3: claimBlock({ session: "session_A", files: ["src/new.ts"] }), 99: claimBlock({}) });
  // the list shifted while paging: the comment at the page boundary is returned twice
  const dup = [...base.slice(0, 100), base[99], ...base.slice(100)];
  const out = await collect(dup);
  assert.deepEqual(claimsGap(out), []);
  assert.equal(out.claims.active.length, 1);
  assert.deepEqual(out.claims.active[0].files, ["src/new.ts"]);
  assert.equal(out.claims.invalid.length, 1, "the duplicated invalid comment is counted once");
  const two = await collect(comments(30, { 1: claim("session_A"), 2: claim("session_B") }));
  assert.deepEqual(two.claims.active.map((c) => c.session).sort(), ["session_A", "session_B"]);
});

// ---- a gap must never leave a PR READY -----------------------------------------------------------------
test("a repo-level gap downgrades READY to FACTS_INCOMPLETE; other states are untouched; no gap changes nothing", () => {
  const ready = evaluateGate(readyFacts());
  assert.equal(ready.state, READY);
  assert.deepEqual(applyRepoGaps([ready], []), [ready]);
  const [down] = applyRepoGaps([ready], ["claims: x"]);
  assert.equal(down.state, "FACTS_INCOMPLETE");
  assert.ok(down.blockers.some((b) => b.startsWith("FACTS_INCOMPLETE:")));
  assert.match(down.nextAction, /do not treat this PR as ready/);
  const dirty = evaluateGate({ ...readyFacts(), pr: { ...readyFacts().pr, mergeableState: "dirty" } });
  assert.equal(applyRepoGaps([dirty], ["claims: x"])[0].state, "CONFLICT");
});

test("end to end: a truncated claim read makes the report non-READY and says 'active 0' is not 'no claims'", async () => {
  const out = await collect(comments(749, { 748: claim() }), { commentMaxPages: 5 });
  const rep = buildReport({ ...out, prFacts: [readyFacts()], repo: "o/r", now: NOW });
  assert.equal(rep.results[0].state, "FACTS_INCOMPLETE");
  assert.match(rep.md, /Data gaps/);
  assert.match(rep.md, /INCOMPLETE:\*\* the claim comments were not read completely/);
  assert.match(rep.md, /active 0/);
  // the same facts with a complete read are READY
  const full = await collect(comments(749, { 748: claim() }));
  const ok = buildReport({ ...full, prFacts: [readyFacts()], repo: "o/r", now: NOW });
  assert.equal(ok.results[0].state, READY);
  assert.ok(!/INCOMPLETE:\*\*/.test(ok.md));
});

test("render: the incomplete-claims warning appears only for a claims gap", () => {
  const claims = { active: [], expired: [], released: [], invalid: [] };
  const base = { results: [], overlaps: [], claims, repo: "o/r", generatedAt: "t" };
  assert.ok(!renderMarkdown({ ...base, repoGaps: ["PR #2: could not be read (x)"] }).includes("INCOMPLETE:"));
  assert.ok(renderMarkdown({ ...base, repoGaps: ["claims: y"] }).includes("INCOMPLETE:"));
});
