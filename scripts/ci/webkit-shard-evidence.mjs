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

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = "webkit-shard-evidence/v3"; // v3: + install_status / test_status (S2); v2: + runAttempt
const ACCEPTED_SCHEMAS = new Set([SCHEMA, "webkit-shard-evidence/v2"]); // v2 = install_status "unknown"

// S2 failure taxonomy. Both are FAIL (fail-closed) -- the class only says WHERE to look.
//   install_status (from scripts/ci/install-with-retry.sh): ok | failed | timeout | incomplete | unknown
//   test_status    (derived from the Playwright results):   passed | failed | not_run
const BAD_INSTALL = new Set(["failed", "timeout", "incomplete"]);
export const FAIL_INFRA = "FAIL-INFRA";
export const FAIL_TEST = "FAIL-TEST";
export const FAIL_EVIDENCE = "FAIL-EVIDENCE"; // structure/coverage of the evidence itself, no infra cause found

/**
 * #394 Phase 2 (D4): the timing facts of one Playwright JSON test -- all optional, informational, and never read by `verify`.
 *  - `durationMs`: the sum of the test's results (retries are 0 in this repo, so one result);
 *  - `timeoutMs`: the test's EFFECTIVE timeout. Playwright's JSON reporter writes `test.timeout`, which the runner overwrites with the `testInfo.timeout`
 *    the worker reports when the test ends (playwright/lib/runner/dispatcher.js `test.timeout = params.timeout`), so an explicit
 *    `test.setTimeout(N)` -- at file level OR inside the test body -- and `test.slow()` are already in it; nothing is guessed from the source;
 *  - `workerIndex` and `startTime` of the run, to tell workers and the shard's wall time apart from the sum of test times.
 * A value that is not a finite number is left out rather than guessed.
 */
export function timingOf(test) {
  const results = Array.isArray(test?.results) ? test.results : [];
  const out = {};
  if (results.length > 0 && results.every((r) => Number.isFinite(r?.duration) && r.duration >= 0)) {
    out.durationMs = Math.round(results.reduce((n, r) => n + r.duration, 0));
  }
  if (Number.isFinite(test?.timeout) && test.timeout > 0) out.timeoutMs = test.timeout;
  const last = results[results.length - 1];
  if (Number.isInteger(last?.workerIndex)) out.workerIndex = last.workerIndex;
  if (typeof results[0]?.startTime === "string" && Number.isFinite(Date.parse(results[0].startTime))) out.startTime = results[0].startTime;
  return out;
}

/** Flattens a Playwright JSON report into [{ key, name, status, expectedStatus, timing }] for `project`. */
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
          timing: timingOf(test),
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

/** Install/setup did not finish for this shard (see verify): its list/results are not trustworthy. */
function setupFailed(ev) {
  return BAD_INSTALL.has(ev.install_status) || (ev.install_status === "unknown" && ev.test_status === "not_run");
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
      executed[t.key] = { status: t.status, expectedStatus: t.expectedStatus, ...t.timing };
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
    // Setup that failed BEFORE the install helper ran (npm ci, checkout, cache...) leaves no status
    // file (install_status "unknown") and no results (test_status "not_run"): also infra. An
    // "unknown" install with tests that did run (v2 / layout evidence) is not.
    const preInstallSetupFailed = ev.install_status === "unknown" && ev.test_status === "not_run";
    const installBad = setupFailed(ev);
    if (installBad) {
      infraProjects.add(ev.project);
      add(
        preInstallSetupFailed
          ? `${ev.project} shard ${ev.shard}: setup failed before the install step finished (no install status, tests not run)`
          : `${ev.project} shard ${ev.shard}: install_status=${ev.install_status} (after ${ev.install_attempts ?? 0} attempt(s))`,
        FAIL_INFRA,
      );
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

    // A shard whose setup failed has no trustworthy list: take the reference selection from a shard
    // that did get going, and do not compare the broken shard's (empty) list against it.
    const trusted = shards.filter((s) => !setupFailed(s));
    const refShard = trusted[0] ?? shards[0];
    const listed = refShard.listed;
    if (listed.length === 0) add(`${project}: listed selection is empty`, consequence());
    if (new Set(listed).size !== listed.length) add(`${project}: listed selection has duplicate test keys`);
    for (const s of trusted.filter((x) => x !== refShard)) {
      if (JSON.stringify(s.listed) !== JSON.stringify(listed)) {
        add(`${project}: shard ${s.shard} listed a different selection than shard ${refShard.shard}`, consequence());
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
// Timing report (#394 Phase 2, D4). INFORMATIONAL: it is computed from the evidence AFTER `verify` has decided, printed below the verdict, and can neither
// change the verdict, the exit code nor the `Classification:` line (webkit-gate.sh reads only those). A failure here prints one "unavailable" line.

/** A test that used at least this share of its (effective) timeout is flagged: a runner ~1.5x slower (seen on 2026-11-03) would not leave it room. */
export const LOW_MARGIN_RATIO = 0.8;

const minutes = (ms) => `${(ms / 60000).toFixed(1)} min`;
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

/**
 * @param {object[]} evidences parsed evidence files (any schema; those without timing facts are counted but contribute nothing)
 * @returns {{ available: boolean, shards: object[], projects: object[], margins: object[], lowMargin: number, timed: number, defaultTimeoutMs: number|null }}
 */
export function timingReport(evidences, { top = 10 } = {}) {
  const usable = (evidences ?? []).filter((ev) => ACCEPTED_SCHEMAS.has(ev?.schema) && ev.executed && typeof ev.executed === "object");
  const { selected } = selectLatestAttempt(usable.filter((ev) => Number.isInteger(ev.runAttempt) && ev.runAttempt >= 1));
  const shards = [];
  const all = [];
  for (const ev of selected) {
    const timed = [];
    for (const [key, r] of Object.entries(ev.executed)) {
      if (r?.status === "skipped" || !Number.isFinite(r?.durationMs)) continue;
      timed.push({
        project: ev.project,
        shard: ev.shard,
        key,
        name: ev.names?.[key] ?? key,
        status: r.status,
        durationMs: r.durationMs,
        timeoutMs: Number.isFinite(r.timeoutMs) ? r.timeoutMs : null,
        workerIndex: Number.isInteger(r.workerIndex) ? r.workerIndex : null,
        startMs: typeof r.startTime === "string" ? Date.parse(r.startTime) : NaN,
      });
    }
    if (timed.length === 0) continue;
    const sum = timed.reduce((n, x) => n + x.durationMs, 0);
    const starts = timed.filter((x) => Number.isFinite(x.startMs));
    const wallMs = starts.length > 0 ? Math.max(...starts.map((x) => x.startMs + x.durationMs)) - Math.min(...starts.map((x) => x.startMs)) : null;
    const longest = timed.reduce((a, b) => (b.durationMs > a.durationMs ? b : a));
    shards.push({
      project: ev.project,
      shard: ev.shard,
      total: ev.total,
      runAttempt: ev.runAttempt,
      tests: timed.length,
      sumMs: sum,
      wallMs,
      workers: new Set(timed.map((x) => x.workerIndex).filter((w) => w !== null)).size,
      longest: { name: longest.name, durationMs: longest.durationMs, timeoutMs: longest.timeoutMs },
    });
    all.push(...timed);
  }
  shards.sort((a, b) => String(a.project).localeCompare(String(b.project)) || a.shard - b.shard);

  const projects = [];
  for (const project of [...new Set(shards.map((s) => s.project))]) {
    const mine = shards.filter((s) => s.project === project);
    const mean = mine.reduce((n, s) => n + s.sumMs, 0) / mine.length;
    projects.push({ project, shards: mine.length, meanSumMs: mean, maxSumMs: Math.max(...mine.map((s) => s.sumMs)), maxOverMean: mean > 0 ? Math.max(...mine.map((s) => s.sumMs)) / mean : null });
  }

  // The effective timeout that most tests have is "the default"; any other value is an explicit override (setTimeout / slow) and is shown as such.
  const counts = new Map();
  for (const x of all) if (x.timeoutMs !== null) counts.set(x.timeoutMs, (counts.get(x.timeoutMs) ?? 0) + 1);
  const defaultTimeoutMs = counts.size === 0 ? null : [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  const margins = all
    .filter((x) => x.timeoutMs !== null)
    .map((x) => ({ ...x, ratio: x.durationMs / x.timeoutMs, marginMs: x.timeoutMs - x.durationMs, override: x.timeoutMs !== defaultTimeoutMs }))
    .sort((a, b) => b.ratio - a.ratio || a.name.localeCompare(b.name));
  return {
    available: all.length > 0,
    shards,
    projects,
    margins: margins.slice(0, top),
    lowMargin: margins.filter((m) => m.ratio >= LOW_MARGIN_RATIO).length,
    timed: all.length,
    withTimeout: margins.length,
    defaultTimeoutMs,
  };
}

export function formatTimingReport(report) {
  if (!report?.available) {
    return "Test timing: no timing data in this evidence (it was recorded before the timing fields existed, or no test produced a duration).";
  }
  const lines = [
    "### Test timing (informational -- never part of the Gate verdict)",
    "",
    "| project | shard | attempt | tests timed | sum of test times | wall (first start to last end) | workers | longest test |",
    "|---|---|---|---|---|---|---|---|",
    ...report.shards.map(
      (s) =>
        `| ${s.project} | ${s.shard}/${s.total} | ${s.runAttempt} | ${s.tests} | ${minutes(s.sumMs)} | ${s.wallMs === null ? "n/a" : minutes(s.wallMs)} | ${s.workers || "n/a"} | ${secs(s.longest.durationMs)}${s.longest.timeoutMs ? ` of ${secs(s.longest.timeoutMs)}` : ""}: ${s.longest.name} |`,
    ),
    "",
    `Shard balance (sum of test times, max / mean per project): ${report.projects.map((p) => `${p.project} ${p.maxOverMean === null ? "n/a" : p.maxOverMean.toFixed(2)} (max ${minutes(p.maxSumMs)}, mean ${minutes(p.meanSumMs)})`).join("; ")}.`,
    "",
    `Timeout margin: ${report.withTimeout} of ${report.timed} timed tests carry an effective timeout (default ${report.defaultTimeoutMs === null ? "n/a" : secs(report.defaultTimeoutMs)}; any other value is an explicit override and is marked \`override\`). ` +
      `${report.lowMargin} used at least ${Math.round(LOW_MARGIN_RATIO * 100)}% of it. Highest use first:`,
    "",
    "| use of timeout | duration | effective timeout | margin | project / shard | test |",
    "|---|---|---|---|---|---|",
    ...report.margins.map(
      (m) =>
        `| ${(m.ratio * 100).toFixed(0)}%${m.ratio >= LOW_MARGIN_RATIO ? " LOW" : ""} | ${secs(m.durationMs)} | ${secs(m.timeoutMs)}${m.override ? " override" : ""} | ${secs(m.marginMs)} | ${m.project} ${m.shard} | ${m.name}${m.status === "expected" ? "" : ` (${m.status})`} |`,
    ),
  ];
  return lines.join("\n");
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
  // Issue #512: the matrix is 3 shards per project; every total=2 case above stays, these mirror the failure modes for total=3.
  ["three shards: shard 3/3 missing", () => fullSuite(IDS, P, 3, (e) => e.splice(2, 1)), false],
  ["three shards: shard 3/3 duplicated instead of 3/3 once", () => fullSuite(IDS, P, 3, (e) => { e[1] = { ...e[2] }; }), false],
  ["three shards: test ran in two shards", () => fullSuite(IDS, P, 3, (e) => { e[2].executed[K("t1")] = { status: "expected", expectedStatus: "passed" }; }), false],
  ["three shards: listed test never ran", () => fullSuite(IDS, P, 3, (e) => { delete e[2].executed[K("t3")]; }), false],
  ["three shards: failed test in shard 3/3", () => fullSuite(IDS, P, 3, (e) => { e[2].executed[K("t3")].status = "unexpected"; }), false],
  ["three shards: shard index 4 out of range", () => fullSuite(IDS, P, 3, (e) => { e[2].shard = 4; }), false],
  ["three shards: totals disagree (2 vs 3)", () => fullSuite(IDS, P, 3, (e) => { e[2].total = 2; }), false],
  ["three shards: totals are per project (390 at 3, 360 at 2) -- coverage is still verified per project", () => [...fullSuite(IDS, ["p390"], 3), ...fullSuite(IDS, ["p360"], 2)], true],
  ["three shards: failed shard 3 re-run passes (attempt 2 supersedes attempt 1)", () => [...fullSuite(IDS, P, 3, (e) => { e[2] = shardEvidence("p390", 3, 1, { failFirst: true }, IDS, 3); }), shardEvidence("p390", 3, 2, {}, IDS, 3)], true],
  ["three shards: failed shard 3 re-run fails again", () => [...fullSuite(IDS, P, 3, (e) => { e[2] = shardEvidence("p390", 3, 1, { failFirst: true }, IDS, 3); }), shardEvidence("p390", 3, 2, { failFirst: true }, IDS, 3)], false],
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
  [
    "setup failed before the install helper ran (status unknown, not_run, missing list/results) -> FAIL-INFRA",
    () => fullSuite(IDS, P, 2, (e) => { Object.assign(e[0], { install_status: "unknown", test_status: "not_run", listed: [], executed: {}, errors: ["list.json: missing", "results.json: missing"] }); }),
    FAIL_INFRA,
  ],
  ["install ok but Playwright produced no results (not_run) -> not infra: FAIL-EVIDENCE", () => fullSuite(IDS, P, 2, (e) => { Object.assign(e[0], { install_status: "ok", test_status: "not_run", executed: {}, errors: ["results.json: missing"] }); }), FAIL_EVIDENCE],
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

/** A Playwright JSON report whose tests carry timing: entries are [id, status, durationMs, timeoutMs, workerIndex, startOffsetMs]. */
function fakeTimedReport(project, entries) {
  const base = Date.parse("2026-11-04T00:00:00Z");
  return {
    suites: [
      {
        title: "a.spec.ts",
        file: "a.spec.ts",
        specs: [],
        suites: [
          {
            title: "group",
            specs: entries.map(([id, status, durationMs, timeoutMs, workerIndex = 0, offset = 0]) => ({
              id: `x-${id}`,
              title: id,
              file: "a.spec.ts",
              line: 1,
              tests: [
                {
                  projectName: project,
                  status,
                  expectedStatus: status === "skipped" ? "skipped" : "passed",
                  timeout: timeoutMs,
                  results: [{ duration: durationMs, workerIndex, startTime: new Date(base + offset).toISOString(), status }],
                },
              ],
            })),
          },
        ],
      },
    ],
  };
}

const stripTiming = (evidences) =>
  evidences.map((ev) => ({ ...ev, executed: Object.fromEntries(Object.entries(ev.executed).map(([k, r]) => [k, { status: r.status, expectedStatus: r.expectedStatus }])) }));

/** D4 checks: [name, ok]. The point of most of them is what timing must NOT do to the verdict. */
function timingChecks() {
  const out = [];
  const check = (name, fn) => {
    let ok = false;
    try {
      ok = fn() === true;
    } catch {
      ok = false;
    }
    out.push([name, ok]);
  };
  const evidenceFor = (project, shard, entries, total = 2, listIds = IDS) =>
    collect({ project, shard, total, runAttempt: 1, listReport: fakeReport(project, listIds.map((id) => [id, "skipped"])), resultsReport: fakeTimedReport(project, entries) });
  const suite = (timed) => {
    const e = [];
    for (const project of P) {
      e.push(evidenceFor(project, 1, [["t1", "expected", timed.t1 ?? 1000, 30000, 0, 0], ["t3", "expected", 2000, 30000, 1, 500], ["t5", "expected", 3000, 30000, 0, 1500]]));
      e.push(evidenceFor(project, 2, [["t2", "expected", 4000, 30000, 0, 0], ["t4", "expected", 5000, 30000, 1, 0]]));
    }
    return e;
  };

  check("collect records durationMs / timeoutMs / workerIndex / startTime per test", () => {
    const ev = evidenceFor("p390", 1, [["t1", "expected", 1234.4, 30000, 1, 250]]);
    const r = ev.executed[K("t1")];
    return r.durationMs === 1234 && r.timeoutMs === 30000 && r.workerIndex === 1 && r.startTime === "2026-11-04T00:00:00.250Z" && r.status === "expected";
  });
  check("an explicit timeout override (setTimeout / slow) is used as the effective timeout, not the default", () => {
    const ev = evidenceFor("p390", 1, [["t1", "expected", 27000, 30000], ["t2", "expected", 40000, 480000], ["t3", "expected", 20000, 77000], ["t4", "expected", 1000, 30000]], 1);
    const rep = timingReport([ev], { top: 10 });
    const byName = Object.fromEntries(rep.margins.map((m) => [m.name.split(" › ").pop(), m]));
    return (
      rep.defaultTimeoutMs === 30000 &&
      byName.t1.ratio === 0.9 && byName.t1.override === false &&
      byName.t2.override === true && byName.t2.marginMs === 440000 &&
      byName.t3.override === true && byName.t3.marginMs === 57000 &&
      rep.margins[0].name.endsWith("t1") && rep.lowMargin === 1
    );
  });
  check("real Playwright 1.56.1 JSON (measured 2026-11-04): in-body setTimeout, slow(), describe configure and their combinations arrive as the effective timeout", () => {
    // Values copied from a real `--reporter=json` run of a throwaway spec; the shape (test.timeout, results[].duration / workerIndex / startTime) is Playwright's own.
    const real = (title, timeout, duration) => ({
      title,
      file: "probe.spec.ts",
      line: 1,
      tests: [{ projectName: "p390", status: "expected", expectedStatus: "passed", timeout, results: [{ duration, workerIndex: 1, parallelIndex: 1, retry: 0, status: "passed", startTime: "2026-11-04T01:26:18.328Z", errors: [], attachments: [] }] }],
    });
    const report = { suites: [{ title: "probe.spec.ts", file: "probe.spec.ts", specs: [], suites: [{ title: "g", specs: [
      real("default timeout", 30000, 9), real("setTimeout in the body", 77000, 11), real("slow in the body", 90000, 1), real("setTimeout then slow in the body", 60000, 2),
      real("inherits the describe timeout", 55000, 2), real("body override on top of describe", 66000, 6), real("inherits describe setTimeout", 45000, 2),
    ] }] }] };
    const ev = collect({ project: "p390", shard: 1, total: 1, runAttempt: 1, listReport: report, resultsReport: report });
    const got = Object.values(ev.executed).map((r) => r.timeoutMs).join(",");
    const rep = timingReport([ev]);
    return got === "30000,77000,90000,60000,55000,66000,45000" && rep.defaultTimeoutMs === 30000 && rep.margins.filter((m) => m.override).length === 6;
  });
  check("an override is never measured against the default: 40 s of 480 s is not LOW although 40 s > 30 s", () => {
    const rep = timingReport([evidenceFor("p390", 1, [["t1", "expected", 40000, 480000], ["t2", "expected", 1000, 30000]], 1)]);
    return rep.lowMargin === 0 && rep.margins.find((m) => m.name.endsWith("t1")).ratio < 0.1;
  });
  check("skipped tests are not timed; a test without a timeout is timed but has no margin", () => {
    const ev = evidenceFor("p390", 1, [["t1", "skipped", 0, 30000], ["t2", "expected", 5000, undefined]], 1);
    const rep = timingReport([ev]);
    return rep.timed === 1 && rep.withTimeout === 0 && rep.margins.length === 0;
  });
  check("shard balance: sum of test times per shard and max / mean per project", () => {
    const e = [
      evidenceFor("p390", 1, [["t1", "expected", 10 * 60000, 900000]], 2, ["t1", "t2"]),
      evidenceFor("p390", 2, [["t2", "expected", 20 * 60000, 1800000]], 2, ["t1", "t2"]),
    ];
    const rep = timingReport(e);
    const p = rep.projects[0];
    return rep.shards.length === 2 && Math.abs(p.maxOverMean - 20 / 15) < 1e-9 && p.maxSumMs === 20 * 60000;
  });
  check("only the latest attempt of a shard is timed (a superseded attempt is ignored, as in verify)", () => {
    const first = { ...evidenceFor("p390", 1, [["t1", "expected", 99000, 30000]], 1), runAttempt: 1 };
    const second = { ...evidenceFor("p390", 1, [["t1", "expected", 1000, 30000]], 1), runAttempt: 2 };
    const rep = timingReport([first, second]);
    return rep.shards.length === 1 && rep.shards[0].runAttempt === 2 && rep.shards[0].sumMs === 1000;
  });
  check("evidence without timing fields: no timing data, and verify is unaffected", () => {
    const old = stripTiming(suite({}));
    return timingReport(old).available === false && formatTimingReport(timingReport(old)).includes("no timing data") && verify(old, P).ok === true;
  });
  check("malformed timing fields are ignored, never thrown on, and never change verify", () => {
    const e = suite({});
    e[0].executed[K("t1")].durationMs = "slow";
    e[0].executed[K("t3")].timeoutMs = Number.NaN;
    e[1].executed[K("t2")].startTime = "not a date";
    e[1].executed[K("t4")].workerIndex = "w";
    const rep = timingReport(e);
    return rep.available === true && formatTimingReport(rep).length > 0 && verify(e, P).ok === true;
  });
  check("verify gives the SAME result with and without timing fields (ok, classification, problems, rows, totals) -- passing and failing evidence", () => {
    const strip = (r) => JSON.stringify({ ok: r.ok, classification: r.classification, problems: r.problems, rows: r.rows, totals: r.totals, superseded: r.superseded });
    const good = suite({});
    const bad = suite({});
    bad[0].executed[K("t1")].status = "unexpected";
    bad[0].test_status = "failed";
    return strip(verify(good, P)) === strip(verify(stripTiming(good), P)) && strip(verify(bad, P)) === strip(verify(stripTiming(bad), P)) && verify(bad, P).ok === false;
  });
  check("the formatted report is markdown with the shard table, the balance line and the margin table", () => {
    const text = formatTimingReport(timingReport(suite({})));
    return text.includes("### Test timing (informational") && text.includes("| project | shard | attempt |") && text.includes("Shard balance") && text.includes("| use of timeout |") && !text.includes("Classification:");
  });
  check("CLI collect: prints this shard's timing to stdout (the shard job's log) and writes the evidence, exit 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "webkit-collect-"));
    try {
      const self = fileURLToPath(import.meta.url);
      const list = fakeReport("p390", IDS.map((id) => [id, "skipped"]));
      const results = fakeTimedReport("p390", [["t1", "expected", 1500, 30000, 0, 0], ["t2", "expected", 27000, 30000, 1, 100]]);
      writeFileSync(join(dir, "list.json"), JSON.stringify(list));
      writeFileSync(join(dir, "results.json"), JSON.stringify(results));
      const out = join(dir, "evidence", "evidence.json");
      const r = spawnSync(process.execPath, [self, "collect", "--project", "p390", "--shard", "1", "--total", "2", "--attempt", "1", "--list", join(dir, "list.json"), "--results", join(dir, "results.json"), "--out", out], { encoding: "utf8" });
      const ev = JSON.parse(readFileSync(out, "utf8"));
      return (
        r.status === 0 &&
        r.stdout.includes("p390 shard 1/2 attempt 1: listed 5, executed 2") &&
        r.stdout.includes("### Test timing (informational") &&
        r.stdout.includes("90% LOW") &&
        ev.executed[K("t2")].durationMs === 27000 && ev.executed[K("t2")].timeoutMs === 30000 && ev.test_status === "passed"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  check("CLI collect with a missing results file still exits 0 and records the error (timing: no data); the evidence is not affected by the timing section", () => {
    const dir = mkdtempSync(join(tmpdir(), "webkit-collect-"));
    try {
      const self = fileURLToPath(import.meta.url);
      writeFileSync(join(dir, "list.json"), JSON.stringify(fakeReport("p390", IDS.map((id) => [id, "skipped"]))));
      const out = join(dir, "evidence.json");
      const r = spawnSync(process.execPath, [self, "collect", "--project", "p390", "--shard", "1", "--total", "2", "--attempt", "1", "--list", join(dir, "list.json"), "--results", join(dir, "missing.json"), "--out", out], { encoding: "utf8" });
      const ev = JSON.parse(readFileSync(out, "utf8"));
      return r.status === 0 && ev.test_status === "not_run" && ev.errors.length === 1 && r.stdout.includes("no timing data");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  check("CLI verify: timing is printed below the verdict; exit code and the single Classification line are the verdict's, passing and failing", () => {
    const dir = mkdtempSync(join(tmpdir(), "webkit-evidence-"));
    try {
      const self = fileURLToPath(import.meta.url);
      const run = (evidences) => {
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
        evidences.forEach((ev, i) => writeFileSync(join(dir, `e${i}.json`), JSON.stringify(ev)));
        const r = spawnSync(process.execPath, [self, "verify", "--dir", dir, "--projects", P.join(" ")], { encoding: "utf8" });
        return { code: r.status, out: r.stdout, cls: r.stdout.split("\n").filter((l) => l.startsWith("Classification: ")) };
      };
      const good = suite({});
      const bad = suite({});
      bad[0].executed[K("t1")].status = "unexpected";
      bad[0].test_status = "failed";
      const g = run(good);
      const gOld = run(stripTiming(good));
      const b = run(bad);
      const bOld = run(stripTiming(bad));
      return (
        g.code === 0 && g.cls.length === 1 && g.cls[0] === "Classification: PASS" && g.out.includes("Test timing") && g.out.indexOf("Classification:") < g.out.indexOf("Test timing") &&
        gOld.code === 0 && gOld.cls[0] === "Classification: PASS" && gOld.out.includes("no timing data") &&
        b.code === 1 && b.cls.length === 1 && b.cls[0] === bOld.cls[0] && bOld.code === 1
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  return out;
}

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
  const timing = timingChecks();
  for (const [name, ok] of timing) {
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} timing: ${name}`);
  }
  const count = SELF_TEST_CASES.length + CLASSIFICATION_CASES.length + 2 + timing.length;
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
    // D4: this shard's timing, in THIS step's stdout = the shard job's log (readable through the job-log API). The Gate's own copy of the report goes to the
    // run's step summary (webkit-gate.sh writes the verify output there), which the job-log API does not return. Informational: any trouble is one line.
    try {
      console.log("");
      console.log(formatTimingReport(timingReport([evidence])));
    } catch (error) {
      console.log(`Test timing: unavailable (${String(error?.message ?? error).split("\n")[0].slice(0, 120)})`);
    }
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
    // D4: timing is printed BELOW the verdict, after it was decided; any trouble here is one line, never an exit code or a classification.
    try {
      console.log("");
      console.log(formatTimingReport(timingReport(evidences)));
    } catch (error) {
      console.log(`Test timing: unavailable (${String(error?.message ?? error).split("\n")[0].slice(0, 120)})`);
    }
    process.exit(result.ok ? 0 : 1);
  } else if (mode === "timing") {
    // Offline analysis of downloaded evidence files: `timing --dir DIR [--top N]`. Prints only the timing report.
    const files = findJsonFiles(arg("dir") ?? "");
    const evidences = files.map((file) => readJson(file).value).filter(Boolean);
    const top = Number.parseInt(arg("top") ?? "10", 10);
    console.log(formatTimingReport(timingReport(evidences, { top: Number.isInteger(top) && top > 0 ? top : 10 })));
    process.exit(0);
  } else {
    console.error("usage: webkit-shard-evidence.mjs collect|verify|timing ... | --self-test");
    process.exit(2);
  }
}
