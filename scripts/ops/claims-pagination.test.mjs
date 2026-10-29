// Owner Gate: the claims are read from the repo-wide comment list of the last 14 days. That list is paged (100 per page); it used to stop at
// 5 pages and throw away what it had read, so a busy fortnight (749 comments on 2026-10-29) made every claim read as "none".
// These tests drive the real createApi / collectRepoFacts with a fake fetch (no network).
import test from "node:test";
import assert from "node:assert/strict";
import { collectRepoFacts, createApi, CLAIM_COMMENT_MAX_PAGES, TruncatedError } from "./collect-facts.mjs";
import { evaluateGate } from "./lib/gate-state.mjs";

const NOW = Date.parse("2026-10-29T12:00:00Z");
const HEAD = "a".repeat(40);

const claim = (o) => `<!-- teto-claim:v1 ${JSON.stringify({ session: "s", issue: 1, files: ["src/a.ts"], expires: "2026-11-05T00:00:00Z", ...o })} -->`;
const comment = (i, body = "chatter") => ({
  id: i,
  body,
  created_at: new Date(NOW - 3600_000 - i * 1000).toISOString(),
  html_url: `https://example.test/c/${i}`,
  author_association: "OWNER",
  user: { login: "owner", type: "User" },
});
/** `total` comments, newest first (the order the collector asks for); `placed` = { index: body } puts claims at chosen positions. */
function thread(total, placed = {}) {
  return Array.from({ length: total }, (_, i) => comment(i, placed[i] ?? "chatter"));
}

/** A whole fake GitHub: one open PR (#1) with clean facts, and a paged /issues/comments list. */
function fakeGithub({ comments, failComments = null, always100 = false }) {
  const calls = { commentPages: [] };
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const p = u.pathname;
    if (p === "/graphql") return json({ data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } } } } } });
    if (p.endsWith("/issues/comments")) {
      const page = Number(u.searchParams.get("page"));
      calls.commentPages.push(page);
      if (failComments && page === failComments.page) return json({ message: failComments.message ?? "boom" }, failComments.status ?? 500);
      if (always100) return json(Array.from({ length: 100 }, (_, i) => comment(page * 1000 + i)));
      return json(comments.slice((page - 1) * 100, page * 100));
    }
    if (p.endsWith("/pulls") && u.searchParams.get("state") === "open") return json(u.searchParams.get("page") === "1" ? [{ number: 1 }] : []);
    if (p.endsWith("/pulls/1")) return json({ number: 1, state: "open", merged: false, draft: false, title: "t", body: "", labels: [], head: { sha: HEAD }, mergeable_state: "clean", created_at: "2026-10-28T00:00:00Z", html_url: "u1", author_association: "OWNER", user: {} });
    if (p.endsWith("/pulls/1/files")) return json([{ filename: "src/a.ts" }]);
    if (/\/commits\/[0-9a-f]{40}$/.test(p)) return json({ commit: { committer: { date: "2026-10-28T00:00:00Z" } } });
    if (p.endsWith("/check-runs")) return json({ check_runs: [] });
    if (p.endsWith("/statuses")) return json([]);
    if (p.endsWith("/actions/runs")) return json({ workflow_runs: [] });
    if (p.endsWith("/issues/1/comments")) return json([]);
    return json({ message: `unrouted ${p}` }, 404);
  };
  return { api: createApi({ token: "t", fetchImpl }), calls };
}

const run = (gh) => collectRepoFacts(gh.api, "o/r", { now: NOW });
const claimsGapOf = (out) => out.repoGaps.filter((g) => g.startsWith("claims:"));

// The claim sits at the very END (oldest comment), so it is found only when every page is read.
for (const n of [499, 500, 501, 749]) {
  test(`${n} comments: every page is read, the oldest claim is found, no data gap`, async () => {
    const gh = fakeGithub({ comments: thread(n, { [n - 1]: claim({ issue: 7, session: "old" }) }) });
    const out = await run(gh);
    assert.equal(out.claims.active.length, 1, "the claim in the last comment is live");
    assert.equal(out.claims.active[0].issue, 7);
    assert.deepEqual(claimsGapOf(out), []);
    assert.deepEqual(gh.calls.commentPages, Array.from({ length: Math.floor(n / 100) + 1 }, (_, i) => i + 1), "pages 1..ceil((n+1)/100), in order, nothing skipped");
    const r = evaluateGate(out.prFacts[0]);
    assert.ok(!r.blockers.some((b) => b.startsWith("FACTS_INCOMPLETE")), "a complete read is not FACTS_INCOMPLETE");
  });
}

test("a page that fails part-way: the pages already read still count, the gap is reported, and no PR can be READY", async () => {
  // 749 comments; page 4 fails -> 300 newest read. One claim in the newest 300, one older (not reachable).
  const gh = fakeGithub({ comments: thread(749, { 10: claim({ issue: 5, session: "new" }), 600: claim({ issue: 6, session: "old" }) }), failComments: { page: 4, status: 502 } });
  const out = await run(gh);
  assert.deepEqual(out.claims.active.map((c) => c.issue), [5], "the newest claim is kept; the unreachable one is not invented");
  const gaps = claimsGapOf(out);
  assert.equal(gaps.length, 1);
  assert.match(gaps[0], /502/);
  assert.match(gaps[0], /300 newest comment/);
  const r = evaluateGate(out.prFacts[0]);
  assert.equal(r.state, "FACTS_INCOMPLETE");
  assert.ok(r.blockers.some((b) => b.startsWith("FACTS_INCOMPLETE") && b.includes("claims:")));
});

test("an API limit (403 / 429) on a later page is a gap, not an empty claim list", async () => {
  for (const status of [403, 429]) {
    const gh = fakeGithub({ comments: thread(450, { 5: claim({ issue: 8, session: "x" }) }), failComments: { page: 3, status } });
    const out = await run(gh);
    assert.deepEqual(out.claims.active.map((c) => c.issue), [8]);
    assert.equal(claimsGapOf(out).length, 1);
    assert.equal(evaluateGate(out.prFacts[0]).state, "FACTS_INCOMPLETE");
  }
});

test("a failure on the very first page: no claims, the gap is reported, the PR is FACTS_INCOMPLETE", async () => {
  const gh = fakeGithub({ comments: thread(10), failComments: { page: 1, status: 500 } });
  const out = await run(gh);
  assert.equal(out.claims.active.length, 0);
  assert.equal(claimsGapOf(out).length, 1);
  assert.equal(evaluateGate(out.prFacts[0]).state, "FACTS_INCOMPLETE");
});

test("the loop is bounded: an API that never ends stops at the page cap and reports a gap", async () => {
  const gh = fakeGithub({ comments: [], always100: true });
  const out = await run(gh);
  assert.equal(gh.calls.commentPages.length, CLAIM_COMMENT_MAX_PAGES, "exactly the cap, then it stops");
  assert.equal(gh.calls.commentPages.at(-1), CLAIM_COMMENT_MAX_PAGES);
  const gaps = claimsGapOf(out);
  assert.equal(gaps.length, 1);
  assert.match(gaps[0], new RegExp(`more than ${CLAIM_COMMENT_MAX_PAGES * 100} items`));
  assert.equal(evaluateGate(out.prFacts[0]).state, "FACTS_INCOMPLETE");
});

test("just under the cap is read completely; a full last page at the cap cannot be proven complete, so it is a gap (fail closed)", async () => {
  const under = fakeGithub({ comments: thread(CLAIM_COMMENT_MAX_PAGES * 100 - 1) });
  assert.deepEqual(claimsGapOf(await run(under)), []);
  // cap * 100 comments: the last allowed page is full and the collector does not ask for one more, so it cannot know the list ended.
  for (const n of [CLAIM_COMMENT_MAX_PAGES * 100, CLAIM_COMMENT_MAX_PAGES * 100 + 1]) {
    const out = await run(fakeGithub({ comments: thread(n) }));
    assert.equal(claimsGapOf(out).length, 1, `${n} comments`);
    assert.equal(evaluateGate(out.prFacts[0]).state, "FACTS_INCOMPLETE");
  }
});

test("restAll hands back what it read on a failure (partial) and rejects a non-list page", async () => {
  const page = (n) => Array.from({ length: 100 }, (_, i) => n * 1000 + i);
  const api = createApi({ token: "t", fetchImpl: async (u) => { const pg = Number(new URL(u).searchParams.get("page")); return pg === 3 ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => page(pg) }; } });
  await assert.rejects(() => api.restAll("/repos/o/r/x", null, 10), (e) => e.partial.length === 200 && /500/.test(e.message));
  const trunc = createApi({ token: "t", fetchImpl: async (u) => ({ ok: true, status: 200, json: async () => page(Number(new URL(u).searchParams.get("page"))) }) });
  await assert.rejects(() => trunc.restAll("/repos/o/r/x", null, 2), (e) => e instanceof TruncatedError && e.partial.length === 200);
  const bad = createApi({ token: "t", fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ not: "a list" }) }) });
  await assert.rejects(() => bad.restAll("/repos/o/r/x"), /non-list/);
});

// ---- parseClaims keeps its meaning across pages --------------------------------------------------
test("duplicate claims across pages: the newest block of a (session, issue) wins, wherever it is", async () => {
  // index 5 (page 1, newest) is the renewed claim; index 640 (page 7) is the older one for the same (session, issue).
  const gh = fakeGithub({ comments: thread(749, { 5: claim({ issue: 9, session: "dup", files: ["src/new.ts"] }), 640: claim({ issue: 9, session: "dup", files: ["src/old.ts"] }) }) });
  const out = await run(gh);
  assert.equal(out.claims.active.length, 1);
  assert.deepEqual(out.claims.active[0].files, ["src/new.ts"]);
});

test("released claim across pages: a newer release removes the older live claim, an older release does not remove a newer claim", async () => {
  const released = await run(fakeGithub({ comments: thread(749, { 3: claim({ issue: 4, session: "r", released: true, files: [] }), 700: claim({ issue: 4, session: "r" }) }) }));
  assert.equal(released.claims.active.length, 0);
  assert.equal(released.claims.released.length, 1);
  const renewed = await run(fakeGithub({ comments: thread(749, { 3: claim({ issue: 4, session: "r" }), 700: claim({ issue: 4, session: "r", released: true, files: [] }) }) }));
  assert.equal(renewed.claims.active.length, 1, "a claim posted after an old release is live again");
});

test("invalid claim blocks are reported as invalid, not live, and do not abort the read", async () => {
  const gh = fakeGithub({
    comments: thread(749, {
      2: claim({ session: undefined, issue: 11 }), // session missing
      300: "<!-- teto-claim:v1 {not json} -->", // does not parse
      500: claim({ issue: 12, session: "ok" }), // a valid one on page 6
      700: "```\n" + claim({ issue: 13, session: "fenced" }) + "\n```", // documentation, not a claim
    }),
  });
  const out = await run(gh);
  assert.deepEqual(out.claims.active.map((c) => c.issue), [12]);
  assert.equal(out.claims.invalid.length, 2);
  assert.deepEqual(claimsGapOf(out), []);
});

test("a claim by an untrusted author on a late page is invalid, never live", async () => {
  const comments = thread(749);
  comments[650] = { ...comment(650, claim({ issue: 14, session: "mallory" })), author_association: "NONE", user: { login: "mallory", type: "User" } };
  const out = await run(fakeGithub({ comments }));
  assert.equal(out.claims.active.length, 0);
  assert.equal(out.claims.invalid.length, 1);
});
