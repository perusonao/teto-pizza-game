// The repo-wide recent-comments read (where claims live) must walk every page: 499 / 500 / 501 / 749 comments
// all arrive, a failure part-way is a data gap (never "no claims"), and a gap never yields READY.
import test from "node:test";
import assert from "node:assert/strict";
import { collectRepoFacts, createApi, REPO_COMMENT_MAX_PAGES } from "./collect-facts.mjs";
import { buildReport } from "./owner-gate.mjs";

const NOW = Date.parse("2026-10-29T00:00:00Z");
const HEAD = "6b2f68d49f569942e6c293cef9f3ea181c5176fb";

const claimBody = (o) => `claim\n<!-- teto-claim:v1 ${JSON.stringify(o)} -->`;
let seq = 0;
const comment = (body, minutesAgo) => ({
  id: ++seq,
  body,
  created_at: new Date(NOW - minutesAgo * 60000).toISOString(),
  html_url: `https://example.test/c/${seq}`,
  author_association: "OWNER",
  user: { login: "owner", type: "User" },
});
const filler = (n, startMinutes = 1) => Array.from({ length: n }, (_, i) => comment("chatter", startMinutes + i));

/** newest-first, as the real endpoint returns with sort=created&direction=desc */
function commentsApi(all, { failOnPage = null, prs = [] } = {}) {
  const sorted = [...all].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const respond = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (u.pathname === "/repos/o/r/pulls" && u.searchParams.get("state") === "open") return respond(prs);
    if (u.pathname === "/repos/o/r/issues/comments") {
      const page = Number(u.searchParams.get("page"));
      if (failOnPage === page) return respond({}, 502);
      return respond(sorted.slice((page - 1) * 100, page * 100));
    }
    return respond({}, 404);
  };
  return createApi({ token: "t", fetchImpl });
}

const oldestActive = (ago = 5000) => comment(claimBody({ session: "s-oldest", issue: 11, files: ["src/a.ts"], expires: "2026-11-05T00:00:00Z" }), ago);

for (const n of [499, 500, 501, 749]) {
  test(`${n} comments: every page is read, the oldest claim is found, no data gap`, async () => {
    const all = [...filler(n - 1), oldestActive()];
    assert.equal(all.length, n);
    const out = await collectRepoFacts(commentsApi(all), "o/r", { now: NOW, sinceDays: 365 });
    assert.deepEqual(out.repoGaps, []);
    assert.deepEqual(out.claims.active.map((c) => c.session), ["s-oldest"]);
  });
}

test("the page budget covers 10000 comments; one more is reported as a gap and the partial read is kept", async () => {
  assert.equal(REPO_COMMENT_MAX_PAGES, 100);
  const all = [...filler(10000), oldestActive(20000)];
  const out = await collectRepoFacts(commentsApi(all), "o/r", { now: NOW, sinceDays: 365 });
  assert.equal(out.repoGaps.length, 1);
  assert.match(out.repoGaps[0], /^claims: recent comments could not be read completely/);
  assert.match(out.repoGaps[0], /10000 read/);
  assert.equal(out.claims.active.length, 0, "the oldest claim is beyond the budget, and the gap says so");
});

test("released, invalid and duplicate claims keep parseClaims' rules across pages", async () => {
  const all = [
    ...filler(650),
    // oldest first in time: active, then released (same session+issue) -> released wins as the newer block
    comment(claimBody({ session: "s-rel", issue: 1, files: ["src/a.ts"], expires: "2026-11-05T00:00:00Z" }), 9000),
    comment(claimBody({ session: "s-rel", issue: 1, files: [], released: true }), 8000),
    // no session -> invalid
    comment(claimBody({ issue: 2, files: ["src/b.ts"] }), 7000),
    // duplicate (session, issue): the newer block replaces the older, only one entry results
    comment(claimBody({ session: "s-dup", issue: 3, files: ["src/old.ts"], expires: "2026-11-05T00:00:00Z" }), 6000),
    comment(claimBody({ session: "s-dup", issue: 3, files: ["src/new.ts"], expires: "2026-11-05T00:00:00Z" }), 5000),
  ];
  const out = await collectRepoFacts(commentsApi(all), "o/r", { now: NOW, sinceDays: 365 });
  assert.deepEqual(out.repoGaps, []);
  assert.deepEqual(out.claims.released.map((c) => c.session), ["s-rel"]);
  assert.equal(out.claims.invalid.length, 1);
  assert.match(out.claims.invalid[0].error, /session missing/);
  assert.deepEqual(out.claims.active.map((c) => [c.session, c.files]), [["s-dup", ["src/new.ts"]]]);
});

test("a failure part-way is a data gap: pages already read are kept, nothing is silently 'no claims'", async () => {
  const all = [comment(claimBody({ session: "s-new", issue: 7, files: ["src/n.ts"], expires: "2026-11-05T00:00:00Z" }), 1), ...filler(299, 2)];
  const out = await collectRepoFacts(commentsApi(all, { failOnPage: 3 }), "o/r", { now: NOW, sinceDays: 365 });
  assert.equal(out.repoGaps.length, 1);
  assert.match(out.repoGaps[0], /502/);
  assert.match(out.repoGaps[0], /200 read/);
  assert.deepEqual(out.claims.active.map((c) => c.session), ["s-new"]);
});

test("a repository-level data gap never yields READY_FOR_OWNER_REVIEW", () => {
  const ok = Array.from({ length: 3 }, (_, i) => ({ name: `j${i}`, status: "completed", conclusion: "success", headSha: HEAD }));
  const prFact = {
    pr: { number: 1, state: "open", merged: false, draft: false, title: "t", body: "", labels: [], headSha: HEAD, headDate: "2026-10-19T12:40:00Z", mergeableState: "clean" },
    checks: ok,
    runs: [],
    codex: { receipts: [{ sha: HEAD.slice(0, 10), at: "2026-10-19T12:46:01Z", clean: true }], summary: null, requests: [], other: [] },
    threads: { unresolved: 0, total: 0 },
    dependencies: [],
    gaps: [],
  };
  const base = { prFacts: [prFact], prFiles: [], claims: { active: [], expired: [], released: [], invalid: [] }, repo: "o/r", now: NOW };
  assert.equal(buildReport({ ...base, repoGaps: [] }).results[0].state, "READY_FOR_OWNER_REVIEW");
  const gapped = buildReport({ ...base, repoGaps: ["claims: recent comments could not be read completely (x)"] });
  assert.equal(gapped.results[0].state, "FACTS_INCOMPLETE");
  assert.match(gapped.md, /FACTS_INCOMPLETE/);
  assert.match(gapped.md, /Data gaps/);
});
