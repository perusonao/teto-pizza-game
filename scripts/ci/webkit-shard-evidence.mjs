#!/usr/bin/env node
// Issue #207 Phase 2A: shard evidence for the Full WebKit matrix (.github/workflows/e2e-webkit.yml).
//
// A green matrix job only proves that `playwright test --shard=i/N` exited 0 -- not that the
// shards together ran the whole suite (a mis-numbered or dropped shard, an empty selection, or a
// test that silently never ran all still exit 0). Each shard therefore records evidence, and
// WebKit Gate verifies the union before it may report PASS.
//
//   collect  -- in each shard job: reads the `--list` JSON of the project's FULL planned selection
//               (no --shard) and the JSON reporter output of the shard's own run, and writes one
//               evidence file { project, shard, total, runAttempt, listed[], executed{} }.
//   verify   -- in WebKit Gate: reads every evidence file and FAILS unless, for exactly the
//               required projects: shard indices are exactly 1..N (no missing/duplicate shard),
//               every shard saw the same listed set, every listed test ran in exactly one shard,
//               nothing unlisted ran, no test failed/flaked or was skipped unintentionally, and
//               every project listed the same tests (every spec runs at every viewport).
//
// Re-runs: "Re-run failed jobs" re-runs only the failed shards; the other shards' evidence stays
// from the earlier attempt, and the earlier attempt's evidence of a re-run shard is NOT removed.
// Artifact names therefore carry the attempt (webkit-evidence-<project>-shard<i>-attempt<n>) and
// verify keeps, per (project, shard), only the evidence of the highest runAttempt -- the attempt
// whose job result `needs.webkit.result` reflects. Superseded evidence is reported, never counted.
// (Before this, both attempts uploaded the same artifact name and download-artifact kept an
// arbitrary one of the two -- on PR #221 run 36019302842 the stale failed attempt-1 evidence.)
//
// Usage:
//   node scripts/ci/webkit-shard-evidence.mjs collect --project P --shard I --total N --attempt A \
//        --list list.json --results results.json --out evidence.json
//   node scripts/ci/webkit-shard-evidence.mjs verify --dir DIR --projects "P1 P2"
//   node scripts/ci/webkit-shard-evidence.mjs --self-test

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA = "webkit-shard-evidence/v3"; // v3: + install_status / test_status (S2); v2: + runAttempt
const ACCEPTED_SCHEMAS = new Set([SCHEMA, "webkit-shard-evidence/v2"]); // v2 = install_status "unknown"

// S2 failure taxonomy. Both are FAIL (fail-closed) -- the class only says WHERE to look.
//   install_status (from scripts/ci/install-with-retry.sh): ok | failed | timeout | incomplete | unknown
//   test_status    (derived from the Playwright results):   passed | failed | not_run
const BAD_INSTALL = new Set(["failed", "timeout", "incomplete"]);
export const FAIL_INFRA = "FAIL-INFRA";
export const FAIL_TEST = "FAIL-TEST";
export const FAIL_EVIDENCE = "FAIL-EVIDENCE"; // structure/coverage of the evidence itself, no infra cause found

/** Flattens a Playwright JSON report into [{ key, name, status, expectedStatus }] for `project`. */
export function testsOf(report, project) {
  const out = [];
  const walk = (suite, titles) => {
    const here = suite.title && !suite.title.endsWith(".ts") ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.projectName !== project) continue;
        const titlePath = [...here, spec.title].join(" › ");
        out.push({
          // Project-independent and line-independent: Playwright's spec.id differs per project, and
          // Playwright rejects duplicate titles within a file, so file + title path is unique.
          key: `${spec.file} › ${titlePath}`,
          name: `${spec.file}:${spec.line} › ${titlePath}`,
          status: test.status,
          expectedStatus: test.expectedStatus,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report?.suites ?? []) walk(suite, []);
  return out;
}

/** Tests of other projects in a report (a shard must only ever run its own project). */
function foreignProjects(report, project) {
  const seen = new Set();
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) if (test.projectName !== project) seen.add(test.projectName);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report?.suites ?? []) walk(suite);
  return [...seen];
}

function readJson(path) {
  try {
    return { value: JSON.parse(readFileSync(path, "utf8")) };
  } catch (error) {
    return { error: `${path}: ${error.message}` };
  }
}

/** Parses the key=value status file written by install-with-retry.sh. Missing -> "unknown". */
export function parseInstallStatus(text) {
  const kv = Object.fromEntries(
    String(text ?? "").split("\n").map((l) => l.trim().split("=")).filter((p) => p.length === 2),
  );
  const status = ["ok", "failed", "timeout", "incomplete"].includes(kv.install_status) ? kv.install_status : "unknown";
  const attempts = Number.parseInt(kv.install_attempts ?? "", 10);
  return { installStatus: status, installAttempts: Number.isInteger(attempts) ? attempts : 0 };
}

export function collect({ project, shard, total, runAttempt, listReport, resultsReport, errors = [], installStatus = "unknown", installAttempts = 0 }) {
  const listed = listReport ? testsOf(listReport, project) : [];
  const executed = {};
  const names = {};
  for (const t of listed) names[t.key] = t.name;
  if (resultsReport) {
    for (const t of testsOf(resultsReport, project)) {
      executed[t.key] = { status: t.status, expectedStatus: t.expectedStatus };
      names[t.key] ??= t.name;
    }
    const foreign = foreignProjects(resultsReport, project);
    if (foreign.length > 0) errors.push(`results contain other projects: ${foreign.join(", ")}`);
  }
  // test_status only describes the Playwright run: no results file -> not_run (an install/setup
  // problem or crash, never a passing run); any non-passing, non-intentionally-skipped test -> failed.
  let testStatus = "not_run";
  if (resultsReport) {
    const bad = Object.values(executed).some(
      (r) => !(r.status === "expected" || (r.status === "skipped" && r.expectedStatus === "skipped")),
    );
    testStatus = bad ? "failed" : "passed";
  }
  return {
    schema: SCHEMA,
    project,
    shard: Number(shard),
    total: Number(total),
    runAttempt: Number(runAttempt),
    install_status: installStatus,
    install_attempts: installAttempts,
    test_status: testStatus,
    listed: listed.map((t) => t.key).sort(),
    executed,
    names,
    errors,
  };
}

/**
 * Keeps, per (project, shard), only the evidence of the highest runAttempt. Evidence of the same
 * shard from the SAME attempt is kept in full, so a genuinely duplicated shard still fails verify.
 * @returns {{ selected: object[], superseded: object[] }}
 */
export function selectLatestAttempt(evidences) {
  const latest = new Map();
  for (const ev of evidences) {
    const key = `${ev.project}\u0000${ev.shard}`;
    latest.set(key, Math.max(latest.get(key) ?? -Infinity, ev.runAttempt));
  }
  const selected = [];
  const superseded = [];
  for (const ev of evidences) {
    (ev.runAttempt === latest.get(`${ev.project}\u0000${ev.shard}`) ? selected : superseded).push(ev);
  }
  return { selected, superseded };
}

/**
 * @param {object[]} evidences parsed evidence files
 * @param {string[]} requiredProjects
 * @returns {{ ok: boolean, problems: string[], rows: object[], totals: Record<string, number> }}
 */
export function verify(evidences, requiredProjects) {
  const problems = [];
  const classes = new Set(); // FAIL_INFRA / FAIL_TEST -- both still mean the evidence did not verify
  const add = (message, cls = FAIL_EVIDENCE) => {
    problems.push(message);
    classes.add(cls);
  };
  const rows = [];
  const totals = {};
  const byProject = new Map();
  const infraProjects = new Set(); // projects with an install-failed shard or a missing shard

  if (requiredProjects.length === 0) add("no required projects given");
  const valid = [];
  for (const ev of evidences) {
    if (!ACCEPTED_SCHEMAS.has(ev?.schema)) {
      add(`evidence with unknown schema: ${JSON.stringify(ev?.schema)}`);
      continue;
    }
    if (!Number.isInteger(ev.runAttempt) || ev.runAttempt < 1) {
      add(`${ev.project} shard ${ev.shard}: invalid runAttempt ${JSON.stringify(ev.runAttempt)}`);
      continue;
    }
    valid.push(ev);
  }
  const { selected, superseded } = selectLatestAttempt(valid);
  for (const ev of selected) {
    if (!requiredProjects.includes(ev.project)) {
      add(`evidence for unexpected project '${ev.project}'`);
      continue;
    }
    // S2: an install/setup that did not finish is infrastructure, whatever else it left behind
    // (a missing results file, tests that never ran). Both classes stay FAIL.
    const installBad = BAD_INSTALL.has(ev.install_status);
    if (installBad) {
      infraProjects.add(ev.project);
      add(`${ev.project} shard ${ev.shard}: install_status=${ev.install_status} (after ${ev.install_attempts ?? 0} attempt(s))`, FAIL_INFRA);
    }
    for (const e of ev.errors ?? []) add(`${ev.project} shard ${ev.shard}: ${e}`, installBad ? FAIL_INFRA : FAIL_EVIDENCE);
    if (!byProject.has(ev.project)) byProject.set(ev.project, []);
    byProject.get(ev.project).push(ev);
  }

  let referenceListed = null;
  for (const project of requiredProjects) {
    const shards = byProject.get(project) ?? [];
    if (shards.length === 0) {
      add(`${project}: no shard evidence at all (missing/cancelled/skipped shard job?)`, FAIL_INFRA);
      continue;
    }
    const totalsSeen = [...new Set(shards.map((s) => s.total))];
    if (totalsSeen.length !== 1 || !Number.isInteger(totalsSeen[0]) || totalsSeen[0] < 1) {
      add(`${project}: inconsistent shard totals ${JSON.stringify(totalsSeen)}`);
      continue;
    }
    const total = totalsSeen[0];
    // coverage gaps that follow from an infra failure in this project are infra too
    const consequence = () => (infraProjects.has(project) ? FAIL_INFRA : FAIL_EVIDENCE);
    const indices = shards.map((s) => s.shard).sort((a, b) => a - b);
    for (let i = 1; i <= total; i++) {
      const n = indices.filter((x) => x === i).length;
      if (n === 0) {
        infraProjects.add(project);
        add(`${project}: shard ${i}/${total} evidence missing`, FAIL_INFRA);
      }
      if (n > 1) add(`${project}: shard ${i}/${total} reported ${n} times`);
    }
    for (const x of indices) {
      if (!Number.isInteger(x) || x < 1 || x > total) add(`${project}: shard index ${x} outside 1..${total}`);
    }

    const listed = shards[0].listed;
    if (listed.length === 0) add(`${project}: listed selection is empty`, consequence());
    if (new Set(listed).size !== listed.length) add(`${project}: listed selection has duplicate test keys`);
    for (const s of shards.slice(1)) {
      if (JSON.stringify(s.listed) !== JSON.stringify(listed)) {
        add(`${project}: shard ${s.shard} listed a different selection than shard ${shards[0].shard}`, consequence());
      }
    }
    if (referenceListed === null) {
      referenceListed = { project, listed };
    } else if (JSON.stringify(referenceListed.listed) !== JSON.stringify(listed)) {
      add(`${project}: listed tests differ from ${referenceListed.project} (every spec must run at every viewport)`, consequence());
    }

    const listedSet = new Set(listed);
    const ranIn = new Map();
    for (const s of shards) {
      let passed = 0;
      let intentionallySkipped = 0;
      let bad = 0;
      for (const [key, r] of Object.entries(s.executed)) {
        const label = s.names?.[key] ?? key;
        if (!listedSet.has(key)) add(`${project} shard ${s.shard}: ran a test that is not in the listed selection: ${label}`);
        ranIn.set(key, [...(ranIn.get(key) ?? []), s.shard]);
        if (r.status === "expected") passed++;
        else if (r.status === "skipped" && r.expectedStatus === "skipped") intentionallySkipped++;
        else {
          bad++;
          add(`${project} shard ${s.shard}: ${label} -> ${r.status}`, FAIL_TEST);
        }
      }
      rows.push({ project, shard: s.shard, total: s.total, runAttempt: s.runAttempt, installStatus: s.install_status ?? "unknown", installAttempts: s.install_attempts ?? 0, testStatus: s.test_status ?? "unknown", listed: s.listed.length, executed: Object.keys(s.executed).length, passed, intentionallySkipped, bad });
    }
    for (const key of listed) {
      const where = ranIn.get(key) ?? [];
      const label = shards.find((s) => s.names?.[key])?.names[key] ?? key;
      if (where.length === 0) add(`${project}: listed test never ran in any shard: ${label}`, infraProjects.has(project) ? FAIL_INFRA : FAIL_EVIDENCE);
      if (where.length > 1) add(`${project}: test ran in more than one shard (${where.join(", ")}): ${label}`);
    }
    const executedTotal = shards.reduce((n, s) => n + Object.keys(s.executed).length, 0);
    if (executedTotal !== listed.length) {
      add(`${project}: executed ${executedTotal} test(s) across shards, listed ${listed.length}`, consequence());
    }
    totals[project] = executedTotal;
  }
  rows.sort((a, b) => requiredProjects.indexOf(a.project) - requiredProjects.indexOf(b.project) || a.shard - b.shard);
  const supersededRows = superseded
    .map((s) => ({ project: s.project, shard: s.shard, total: s.total, runAttempt: s.runAttempt }))
    .sort((a, b) => String(a.project).localeCompare(String(b.project)) || a.shard - b.shard || a.runAttempt - b.runAttempt);
  return { ok: problems.length === 0, classification: classify(problems.length === 0, classes), problems, rows, totals, superseded: supersededRows };
}

/** "PASS", or the sorted "+"-joined failure classes. Any class is still a FAIL. */
export function classify(ok, classes) {
  if (ok) return "PASS";
  const order = [FAIL_INFRA, FAIL_TEST, FAIL_EVIDENCE];
  return order.filter((c) => classes.has(c)).join("+") || FAIL_EVIDENCE;
}

export function formatSummary({ ok, classification = ok ? "PASS" : FAIL_EVIDENCE, problems, rows, totals, superseded = [] }) {
  const lines = [
    "| project | shard | attempt | install_status | test_status | listed (full selection) | executed | passed | intentionally skipped | failed/flaky/not run |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.project} | ${r.shard}/${r.total} | ${r.runAttempt} | ${r.installStatus}${r.installAttempts > 1 ? ` (x${r.installAttempts})` : ""} | ${r.testStatus} | ${r.listed} | ${r.executed} | ${r.passed} | ${r.intentionallySkipped} | ${r.bad} |`),
    "",
    `Executed per project: ${Object.entries(totals).map(([p, n]) => `${p}=${n}`).join(", ") || "none"}; ` +
      `grand total ${Object.values(totals).reduce((a, b) => a + b, 0)}.`,
    "",
    ok ? "Coverage verification: **OK** -- every listed test ran exactly once and passed." : "Coverage verification: **FAILED**",
    // Machine-readable (webkit-gate.sh greps this line). FAIL-INFRA / FAIL-TEST are both FAIL.
    `Classification: ${classification}`,
  ];
  if (superseded.length > 0) {
    lines.push(
      "",
      `Superseded by a later re-run attempt (ignored): ${superseded.map((r) => `${r.project} shard ${r.shard}/${r.total} attempt ${r.runAttempt}`).join(", ")}.`,
    );
  }
  if (!ok) lines.push("", ...problems.slice(0, 50).map((p) => `- ${p}`), problems.length > 50 ? `- ... (+${problems.length - 50} more)` : "");
  return lines.join("\n");
}

function findJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...findJsonFiles(path));
    else if (entry.endsWith(".json")) out.push(path);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Self-test: synthetic Playwright reports / evidence covering every failure mode verify() guards.

function fakeReport(project, entries) {
  // entries: [id, status, expectedStatus?]
  return {
    suites: [
      {
        title: "a.spec.ts",
        file: "a.spec.ts",
        specs: [],
        suites: [
          {
            title: "group",
            specs: entries.map(([id, status, expectedStatus = "passed"]) => ({
              id: `x-${id}`,
              title: id,
              file: "a.spec.ts",
              line: 1,
              tests: [{ projectName: project, status, expectedStatus }],
            })),
          },
        ],
      },
    ],
  };
}

function fullSuite(ids, projects = ["p390", "p360"], total = 2, mutate = () => {}, runAttempt = 1) {
  const evidences = [];
  for (const project of projects) {
    const listReport = fakeReport(project, ids.map((id) => [id, "skipped"]));
    for (let shard = 1; shard <= total; shard++) {
      const mine = ids.filter((_, i) => i % total === shard - 1);
      const resultsReport = fakeReport(project, mine.map((id) => [id, "expected"]));
      evidences.push(collect({ project, shard, total, runAttempt, listReport, resultsReport }));
    }
  }
  mutate(evidences);
  return evidences;
}

/** One shard's evidence at `runAttempt`, optionally with its first test failed. */
function shardEvidence(project, shard, runAttempt, { failFirst = false } = {}, ids = IDS, total = 2) {
  const mine = ids.filter((_, i) => i % total === shard - 1);
  return collect({
    project,
    shard,
    total,
    runAttempt,
    listReport: fakeReport(project, ids.map((id) => [id, "skipped"])),
    resultsReport: fakeReport(project, mine.map((id, i) => [id, failFirst && i === 0 ? "unexpected" : "expected"])),
  });
}

/** "Re-run failed jobs": attempt 1 of p390 shard 1 failed; only that shard ran again as `rerun`. */
function rerun(rerunOpts, extra = []) {
  const e = fullSuite(IDS);
  e[0] = shardEvidence("p390", 1, 1, { failFirst: true });
  return [...e, shardEvidence("p390", 1, 2, rerunOpts), ...extra];
}

const IDS = ["t1", "t2", "t3", "t4", "t5"];
const K = (id) => `a.spec.ts › group › ${id}`;
const P = ["p390", "p360"];
const SELF_TEST_CASES = [
  ["all shards complete and passing", () => fullSuite(IDS), true],
  ["shard missing", () => fullSuite(IDS, P, 2, (e) => e.splice(1, 1)), false],
  ["whole project missing", () => fullSuite(IDS, ["p390"]), false],
  ["shard duplicated instead of 2/2 (1/2 twice)", () => fullSuite(IDS, P, 2, (e) => { e[1] = { ...e[0] }; }), false],
  ["test ran in two shards", () => fullSuite(IDS, P, 2, (e) => { e[1].executed[K("t1")] = { status: "expected", expectedStatus: "passed" }; }), false],
  ["listed test never ran", () => fullSuite(IDS, P, 2, (e) => { delete e[0].executed[K("t1")]; }), false],
  ["unlisted test ran", () => fullSuite(IDS, P, 2, (e) => { e[0].executed[K("zz")] = { status: "expected", expectedStatus: "passed" }; }), false],
  ["failed test", () => fullSuite(IDS, P, 2, (e) => { e[0].executed[K("t1")].status = "unexpected"; }), false],
  ["flaky test", () => fullSuite(IDS, P, 2, (e) => { e[0].executed[K("t1")].status = "flaky"; }), false],
  ["test skipped without test.skip (did not run)", () => fullSuite(IDS, P, 2, (e) => { e[0].executed[K("t1")].status = "skipped"; }), false],
  ["intentional test.skip is allowed", () => fullSuite(IDS, P, 2, (e) => { for (const ev of e) if (ev.executed[K("t1")]) ev.executed[K("t1")] = { status: "skipped", expectedStatus: "skipped" }; }), true],
  ["empty selection", () => fullSuite([]), false],
  ["viewports listed different tests", () => fullSuite(IDS, P, 2, (e) => { for (const ev of e) if (ev.project === "p360") ev.listed = ev.listed.slice(1); }), false],
  ["shards disagree on the listed selection", () => fullSuite(IDS, P, 2, (e) => { e[1].listed = [...e[1].listed, K("t9")].sort(); }), false],
  ["inconsistent shard totals", () => fullSuite(IDS, P, 2, (e) => { e[1].total = 3; }), false],
  ["shard index out of range", () => fullSuite(IDS, P, 2, (e) => { e[1].shard = 3; }), false],
  ["unexpected extra project", () => [...fullSuite(IDS), ...fullSuite(IDS, ["chromium"], 1)], false],
  ["unknown schema", () => fullSuite(IDS, P, 2, (e) => { e[0].schema = "v0"; }), false],
  ["collect-time error recorded", () => fullSuite(IDS, P, 2, (e) => { e[0].errors = ["results.json: missing"]; }), false],
  ["no evidence at all", () => [], false],
  ["three shards, complete", () => fullSuite(IDS, P, 3), true],
  // Re-run evidence (PR #221 run 36019302842): the stale failed attempt must never be adopted.
  ["rerun: failed attempt 1 superseded by passing attempt 2", () => rerun({}), true],
  ["rerun: stale failed attempt listed AFTER the passing one", () => { const e = rerun({}); return [e.pop(), ...e]; }, true],
  ["rerun: the re-run attempt failed again", () => rerun({ failFirst: true }), false],
  ["rerun: newer attempt failed, older passed (never fall back)", () => { const e = fullSuite(IDS); return [...e, shardEvidence("p390", 1, 2, { failFirst: true })]; }, false],
  ["rerun: shard duplicated within the latest attempt", () => rerun({}, [shardEvidence("p390", 1, 2)]), false],
  ["rerun: second rerun (attempt 3) passes after attempt 2 failed", () => rerun({ failFirst: true }, [shardEvidence("p390", 1, 3)]), true],
  ["re-run all jobs: every shard at attempt 2 over a failed attempt 1", () => [...rerun({}).slice(0, 4), ...fullSuite(IDS, P, 2, () => {}, 2)], true],
  ["missing runAttempt", () => fullSuite(IDS, P, 2, (e) => { delete e[0].runAttempt; }), false],
  ["runAttempt 0", () => fullSuite(IDS, P, 2, () => {}, 0), false],
];

// S2: [name, evidences, expected classification]. Every non-PASS class is still ok=false (FAIL).
const CLASSIFICATION_CASES = [
  ["install ok + tests pass -> PASS", () => fullSuite(IDS), "PASS"],
  ["install ok after a retry + tests pass -> PASS", () => fullSuite(IDS, P, 2, (e) => { e[0].install_attempts = 2; }), "PASS"],
  ["v2 evidence (no install_status) + tests pass -> PASS", () => fullSuite(IDS, P, 2, (e) => { for (const ev of e) { ev.schema = "webkit-shard-evidence/v2"; delete ev.install_status; delete ev.install_attempts; delete ev.test_status; } }), "PASS"],
  [
    "install failed (no results, nothing ran) -> FAIL-INFRA",
    () => fullSuite(IDS, P, 2, (e) => { Object.assign(e[0], { install_status: "failed", test_status: "not_run", executed: {}, errors: ["results.json: missing"] }); }),
    FAIL_INFRA,
  ],
  [
    "install timeout -> FAIL-INFRA",
    () => fullSuite(IDS, P, 2, (e) => { Object.assign(e[1], { install_status: "timeout", test_status: "not_run", executed: {} }); }),
    FAIL_INFRA,
  ],
  [
    "install incomplete (step killed by the job timeout) -> FAIL-INFRA",
    () => fullSuite(IDS, P, 2, (e) => { Object.assign(e[0], { install_status: "incomplete", test_status: "not_run", executed: {} }); }),
    FAIL_INFRA,
  ],
  ["shard evidence missing (job cancelled/timed out) -> FAIL-INFRA", () => fullSuite(IDS, P, 2, (e) => e.splice(1, 1)), FAIL_INFRA],
  ["install ok + Playwright assertion failure -> FAIL-TEST", () => fullSuite(IDS, P, 2, (e) => { e[0].executed[K("t1")].status = "unexpected"; e[0].test_status = "failed"; }), FAIL_TEST],
  ["install ok + flaky test -> FAIL-TEST", () => fullSuite(IDS, P, 2, (e) => { e[0].executed[K("t1")].status = "flaky"; e[0].test_status = "failed"; }), FAIL_TEST],
  [
    "one shard install failed + another shard test failure -> both classes, never hidden",
    () => fullSuite(IDS, P, 2, (e) => { Object.assign(e[0], { install_status: "timeout", test_status: "not_run", executed: {} }); e[2].executed[K("t1")].status = "unexpected"; }),
    `${FAIL_INFRA}+${FAIL_TEST}`,
  ],
  ["install ok but a listed test never ran -> FAIL-EVIDENCE (not infra, not green)", () => fullSuite(IDS, P, 2, (e) => { delete e[0].executed[K("t1")]; }), FAIL_EVIDENCE],
];

function selfTest() {
  let failed = 0;
  for (const [name, build, expected] of CLASSIFICATION_CASES) {
    const result = verify(build(), P);
    const ok = result.classification === expected && result.ok === (expected === "PASS");
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} classification: ${name} -> ${result.classification}`);
  }
  const parsed = parseInstallStatus("install_status=timeout\ninstall_attempts=2\ninstall_last_exit=124\n");
  const parsedOk = parsed.installStatus === "timeout" && parsed.installAttempts === 2 && parseInstallStatus(undefined).installStatus === "unknown" && parseInstallStatus("install_status=bogus").installStatus === "unknown";
  if (!parsedOk) failed++;
  console.log(`${parsedOk ? "PASS" : "FAIL"} parseInstallStatus`);
  for (const [name, build, expected] of SELF_TEST_CASES) {
    const result = verify(build(), P);
    const ok = result.ok === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name} -> ok=${result.ok}${result.ok ? "" : ` (${result.problems[0]})`}`);
  }
  // collect(): a shard whose results contain another project must be flagged.
  const mixed = collect({
    project: "p390",
    shard: 1,
    total: 1,
    runAttempt: 1,
    listReport: fakeReport("p390", [["t1", "skipped"]]),
    resultsReport: { suites: [...fakeReport("p390", [["t1", "expected"]]).suites, ...fakeReport("p360", [["t1", "expected"]]).suites] },
  });
  const mixedOk = mixed.errors.length === 1;
  if (!mixedOk) failed++;
  console.log(`${mixedOk ? "PASS" : "FAIL"} collect flags foreign-project results`);
  const count = SELF_TEST_CASES.length + CLASSIFICATION_CASES.length + 2;
  console.log(`${count - failed}/${count} shard-evidence cases passed`);
  return failed === 0;
}

// ---------------------------------------------------------------------------------------------

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const mode = process.argv[2];
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest() ? 0 : 1);
  } else if (mode === "collect") {
    const errors = [];
    const load = (path, what) => {
      if (!path) {
        errors.push(`no --${what} path given`);
        return null;
      }
      const { value, error } = readJson(path);
      if (error) errors.push(error);
      return value ?? null;
    };
    const listReport = load(arg("list"), "list");
    let installInfo = { installStatus: "unknown", installAttempts: 0 };
    if (arg("install-status")) {
      try {
        installInfo = parseInstallStatus(readFileSync(arg("install-status"), "utf8"));
      } catch {
        // missing status file == the install step never started/finished -> "unknown"
      }
    }
    const resultsReport = load(arg("results"), "results");
    if (!arg("attempt")) errors.push("no --attempt given");
    const evidence = collect({
      project: arg("project"),
      shard: arg("shard"),
      total: arg("total"),
      runAttempt: arg("attempt"),
      listReport,
      resultsReport,
      errors,
      ...installInfo,
    });
    const out = arg("out");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(
      `${evidence.project} shard ${evidence.shard}/${evidence.total} attempt ${evidence.runAttempt}: listed ${evidence.listed.length}, ` +
        `executed ${Object.keys(evidence.executed).length}${errors.length ? `, errors: ${errors.join("; ")}` : ""}`,
    );
  } else if (mode === "verify") {
    const files = findJsonFiles(arg("dir") ?? "");
    const evidences = [];
    const problems = [];
    for (const file of files) {
      const { value, error } = readJson(file);
      if (error) problems.push(error);
      else evidences.push(value);
    }
    const projects = (arg("projects") ?? "").split(/\s+/).filter(Boolean);
    const result = verify(evidences, projects);
    result.problems.unshift(...problems);
    result.ok = result.problems.length === 0;
    // unreadable evidence files are a pipeline problem, not a test result
    if (problems.length > 0) result.classification = result.classification === "PASS" ? FAIL_EVIDENCE : `${result.classification}+${FAIL_EVIDENCE}`;
    console.log(formatSummary(result));
    process.exit(result.ok ? 0 : 1);
  } else {
    console.error("usage: webkit-shard-evidence.mjs collect|verify ... | --self-test");
    process.exit(2);
  }
}
