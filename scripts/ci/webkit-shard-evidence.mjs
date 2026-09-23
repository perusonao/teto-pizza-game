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
//               evidence file { project, shard, total, listed[], executed{} }.
//   verify   -- in WebKit Gate: reads every evidence file and FAILS unless, for exactly the
//               required projects: shard indices are exactly 1..N (no missing/duplicate shard),
//               every shard saw the same listed set, every listed test ran in exactly one shard,
//               nothing unlisted ran, no test failed/flaked or was skipped unintentionally, and
//               every project listed the same tests (every spec runs at every viewport).
//
// Usage:
//   node scripts/ci/webkit-shard-evidence.mjs collect --project P --shard I --total N \
//        --list list.json --results results.json --out evidence.json
//   node scripts/ci/webkit-shard-evidence.mjs verify --dir DIR --projects "P1 P2"
//   node scripts/ci/webkit-shard-evidence.mjs --self-test

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA = "webkit-shard-evidence/v1";

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

export function collect({ project, shard, total, listReport, resultsReport, errors = [] }) {
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
  return {
    schema: SCHEMA,
    project,
    shard: Number(shard),
    total: Number(total),
    listed: listed.map((t) => t.key).sort(),
    executed,
    names,
    errors,
  };
}

/**
 * @param {object[]} evidences parsed evidence files
 * @param {string[]} requiredProjects
 * @returns {{ ok: boolean, problems: string[], rows: object[], totals: Record<string, number> }}
 */
export function verify(evidences, requiredProjects) {
  const problems = [];
  const rows = [];
  const totals = {};
  const byProject = new Map();

  if (requiredProjects.length === 0) problems.push("no required projects given");
  for (const ev of evidences) {
    if (ev?.schema !== SCHEMA) {
      problems.push(`evidence with unknown schema: ${JSON.stringify(ev?.schema)}`);
      continue;
    }
    for (const e of ev.errors ?? []) problems.push(`${ev.project} shard ${ev.shard}: ${e}`);
    if (!requiredProjects.includes(ev.project)) {
      problems.push(`evidence for unexpected project '${ev.project}'`);
      continue;
    }
    if (!byProject.has(ev.project)) byProject.set(ev.project, []);
    byProject.get(ev.project).push(ev);
  }

  let referenceListed = null;
  for (const project of requiredProjects) {
    const shards = byProject.get(project) ?? [];
    if (shards.length === 0) {
      problems.push(`${project}: no shard evidence at all (missing/cancelled/skipped shard job?)`);
      continue;
    }
    const totalsSeen = [...new Set(shards.map((s) => s.total))];
    if (totalsSeen.length !== 1 || !Number.isInteger(totalsSeen[0]) || totalsSeen[0] < 1) {
      problems.push(`${project}: inconsistent shard totals ${JSON.stringify(totalsSeen)}`);
      continue;
    }
    const total = totalsSeen[0];
    const indices = shards.map((s) => s.shard).sort((a, b) => a - b);
    for (let i = 1; i <= total; i++) {
      const n = indices.filter((x) => x === i).length;
      if (n === 0) problems.push(`${project}: shard ${i}/${total} evidence missing`);
      if (n > 1) problems.push(`${project}: shard ${i}/${total} reported ${n} times`);
    }
    for (const x of indices) {
      if (!Number.isInteger(x) || x < 1 || x > total) problems.push(`${project}: shard index ${x} outside 1..${total}`);
    }

    const listed = shards[0].listed;
    if (listed.length === 0) problems.push(`${project}: listed selection is empty`);
    if (new Set(listed).size !== listed.length) problems.push(`${project}: listed selection has duplicate test keys`);
    for (const s of shards.slice(1)) {
      if (JSON.stringify(s.listed) !== JSON.stringify(listed)) {
        problems.push(`${project}: shard ${s.shard} listed a different selection than shard ${shards[0].shard}`);
      }
    }
    if (referenceListed === null) {
      referenceListed = { project, listed };
    } else if (JSON.stringify(referenceListed.listed) !== JSON.stringify(listed)) {
      problems.push(`${project}: listed tests differ from ${referenceListed.project} (every spec must run at every viewport)`);
    }

    const listedSet = new Set(listed);
    const ranIn = new Map();
    for (const s of shards) {
      let passed = 0;
      let intentionallySkipped = 0;
      let bad = 0;
      for (const [key, r] of Object.entries(s.executed)) {
        const label = s.names?.[key] ?? key;
        if (!listedSet.has(key)) problems.push(`${project} shard ${s.shard}: ran a test that is not in the listed selection: ${label}`);
        ranIn.set(key, [...(ranIn.get(key) ?? []), s.shard]);
        if (r.status === "expected") passed++;
        else if (r.status === "skipped" && r.expectedStatus === "skipped") intentionallySkipped++;
        else {
          bad++;
          problems.push(`${project} shard ${s.shard}: ${label} -> ${r.status}`);
        }
      }
      rows.push({ project, shard: s.shard, total: s.total, listed: s.listed.length, executed: Object.keys(s.executed).length, passed, intentionallySkipped, bad });
    }
    for (const key of listed) {
      const where = ranIn.get(key) ?? [];
      const label = shards.find((s) => s.names?.[key])?.names[key] ?? key;
      if (where.length === 0) problems.push(`${project}: listed test never ran in any shard: ${label}`);
      if (where.length > 1) problems.push(`${project}: test ran in more than one shard (${where.join(", ")}): ${label}`);
    }
    const executedTotal = shards.reduce((n, s) => n + Object.keys(s.executed).length, 0);
    if (executedTotal !== listed.length) {
      problems.push(`${project}: executed ${executedTotal} test(s) across shards, listed ${listed.length}`);
    }
    totals[project] = executedTotal;
  }
  rows.sort((a, b) => requiredProjects.indexOf(a.project) - requiredProjects.indexOf(b.project) || a.shard - b.shard);
  return { ok: problems.length === 0, problems, rows, totals };
}

export function formatSummary({ ok, problems, rows, totals }) {
  const lines = [
    "| project | shard | listed (full selection) | executed | passed | intentionally skipped | failed/flaky/not run |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.project} | ${r.shard}/${r.total} | ${r.listed} | ${r.executed} | ${r.passed} | ${r.intentionallySkipped} | ${r.bad} |`),
    "",
    `Executed per project: ${Object.entries(totals).map(([p, n]) => `${p}=${n}`).join(", ") || "none"}; ` +
      `grand total ${Object.values(totals).reduce((a, b) => a + b, 0)}.`,
    "",
    ok ? "Coverage verification: **OK** -- every listed test ran exactly once and passed." : "Coverage verification: **FAILED**",
  ];
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

function fullSuite(ids, projects = ["p390", "p360"], total = 2, mutate = () => {}) {
  const evidences = [];
  for (const project of projects) {
    const listReport = fakeReport(project, ids.map((id) => [id, "skipped"]));
    for (let shard = 1; shard <= total; shard++) {
      const mine = ids.filter((_, i) => i % total === shard - 1);
      const resultsReport = fakeReport(project, mine.map((id) => [id, "expected"]));
      evidences.push(collect({ project, shard, total, listReport, resultsReport }));
    }
  }
  mutate(evidences);
  return evidences;
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
];

function selfTest() {
  let failed = 0;
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
    listReport: fakeReport("p390", [["t1", "skipped"]]),
    resultsReport: { suites: [...fakeReport("p390", [["t1", "expected"]]).suites, ...fakeReport("p360", [["t1", "expected"]]).suites] },
  });
  const mixedOk = mixed.errors.length === 1;
  if (!mixedOk) failed++;
  console.log(`${mixedOk ? "PASS" : "FAIL"} collect flags foreign-project results`);
  const count = SELF_TEST_CASES.length + 1;
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
    const resultsReport = load(arg("results"), "results");
    const evidence = collect({ project: arg("project"), shard: arg("shard"), total: arg("total"), listReport, resultsReport, errors });
    const out = arg("out");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(
      `${evidence.project} shard ${evidence.shard}/${evidence.total}: listed ${evidence.listed.length}, ` +
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
    console.log(formatSummary(result));
    process.exit(result.ok ? 0 : 1);
  } else {
    console.error("usage: webkit-shard-evidence.mjs collect|verify ... | --self-test");
    process.exit(2);
  }
}
