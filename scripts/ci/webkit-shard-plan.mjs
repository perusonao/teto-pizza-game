#!/usr/bin/env node
// Issue #207 Phase 2B: time-balanced Full WebKit shards (.github/workflows/e2e-webkit.yml).
//
// Phase 2A split each project with Playwright's `--shard i/N`, which cuts the file-ordered test
// list by COUNT. The first half holds the long full-round specs, so shard 1/2 carried ~65% of the
// test-seconds and set the workflow's wall-clock (run 35946070881: 390x844 241 s vs 130 s).
// This script instead assigns whole spec files to shards by measured duration (deterministic
// longest-processing-time-first over scripts/ci/webkit-spec-weights.json) and prints the
// Playwright file filters for one shard.
//
// Coverage is NOT decided here. Each shard still lists its project's FULL selection, and WebKit
// Gate's evidence check (webkit-shard-evidence.mjs verify) still fails unless every listed test
// ran in exactly one shard and passed. A bad or stale plan can therefore only turn the gate red,
// never green. Weights only affect balance; an unknown spec gets
// defaultPerTestSeconds x its test count, so a new spec is still assigned (and run).
//
// Usage:
//   node scripts/ci/webkit-shard-plan.mjs --list LIST.json --project P --shard I --total N \
//        --weights scripts/ci/webkit-spec-weights.json --out ARGS.txt
//     -> writes one Playwright file-filter argument per line (an anchored absolute-path regex, so
//        it matches exactly that file). Exits non-zero if the shard would be empty: running
//        Playwright with no file filter would run the whole suite.
//   node scripts/ci/webkit-shard-plan.mjs --self-test

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Spec files of `project` in a Playwright JSON (--list) report: [{ file, tests }]. */
export function filesOf(report, project) {
  const counts = new Map();
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.projectName !== project) continue;
        const f = spec.file ?? file;
        counts.set(f, (counts.get(f) ?? 0) + 1);
      }
    }
    for (const child of suite.suites ?? []) walk(child, child.file ?? file);
  };
  for (const suite of report?.suites ?? []) walk(suite, suite.file);
  return [...counts].map(([file, tests]) => ({ file, tests })).sort((a, b) => (a.file < b.file ? -1 : 1));
}

/**
 * Deterministic LPT: heaviest file first (ties by name) onto the lightest bin (ties by lowest
 * index). Every job computes the same plan from the same list + weights.
 * @returns {{ file: string, tests: number, weight: number, estimated: boolean }[][]}
 */
export function plan(files, total, weights) {
  if (!Number.isInteger(total) || total < 1) throw new Error(`invalid shard total ${total}`);
  const perTest = Number(weights?.defaultPerTestSeconds) > 0 ? Number(weights.defaultPerTestSeconds) : 7;
  const items = files.map(({ file, tests }) => {
    const known = Number(weights?.files?.[file]);
    const estimated = !(known > 0);
    return { file, tests, weight: estimated ? tests * perTest : known, estimated };
  });
  items.sort((a, b) => b.weight - a.weight || (a.file < b.file ? -1 : 1));
  const bins = Array.from({ length: total }, () => ({ load: 0, items: [] }));
  for (const item of items) {
    let best = 0;
    for (let i = 1; i < total; i++) if (bins[i].load < bins[best].load) best = i;
    bins[best].items.push(item);
    bins[best].load += item.weight;
  }
  return bins.map((b) => b.items.sort((x, y) => (x.file < y.file ? -1 : 1)));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Playwright file filter matching exactly `rootDir/file` (Playwright tests it against the absolute path). */
export function fileFilter(rootDir, file) {
  return `/^${escapeRe(`${rootDir.replace(/\/+$/, "")}/${file}`)}$/`;
}

export function shardArgs({ report, project, shard, total, weights }) {
  const files = filesOf(report, project);
  if (files.length === 0) throw new Error(`no spec files listed for project '${project}'`);
  const rootDir = report?.config?.rootDir;
  if (typeof rootDir !== "string" || !rootDir.startsWith("/")) throw new Error(`list report has no absolute config.rootDir`);
  const bins = plan(files, total, weights);
  if (!Number.isInteger(shard) || shard < 1 || shard > total) throw new Error(`shard ${shard} outside 1..${total}`);
  const mine = bins[shard - 1];
  if (mine.length === 0) throw new Error(`shard ${shard}/${total} would be empty (${files.length} spec file(s) for ${total} shards)`);
  return { args: mine.map((i) => fileFilter(rootDir, i.file)), bins };
}

// ---------------------------------------------------------------------------------------------
// Self-test.

const fakeList = (rootDir, project, files) => ({
  config: { rootDir },
  suites: files.map(([file, n]) => ({
    title: file,
    file,
    specs: [],
    suites: [{ title: "g", file, specs: Array.from({ length: n }, (_, i) => ({ title: `t${i}`, file, line: i + 1, tests: [{ projectName: project }] })) }],
  })),
});

function selfTest() {
  let failed = 0;
  let count = 0;
  const check = (name, ok, detail = "") => {
    count++;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  };
  const weights = JSON.parse(readFileSync(new URL("./webkit-spec-weights.json", import.meta.url), "utf8"));
  const real = Object.keys(weights.files).map((f) => [f, 4]);
  const report = fakeList("/w/e2e", "webkit-390x844", real);

  for (const total of [1, 2, 3, 4]) {
    const bins = plan(filesOf(report, "webkit-390x844"), total, weights);
    const all = bins.flat().map((i) => i.file);
    const complete = all.length === real.length && new Set(all).size === all.length && real.every(([f]) => all.includes(f));
    check(`total=${total}: every file in exactly one shard`, complete);
    check(`total=${total}: deterministic`, JSON.stringify(bins) === JSON.stringify(plan(filesOf(report, "webkit-390x844"), total, weights)));
  }
  const loads = plan(filesOf(report, "webkit-390x844"), 2, weights).map((b) => b.reduce((n, i) => n + i.weight, 0));
  const sum = loads[0] + loads[1];
  check("measured weights: 2 shards within 10% of an even split", Math.max(...loads) <= 0.55 * sum, loads.map((l) => l.toFixed(1)).join(" / "));
  const withNew = plan(filesOf(fakeList("/w/e2e", "p", [...real, ["brand-new.spec.ts", 3]]), "p"), 2, weights);
  const newItem = withNew.flat().find((i) => i.file === "brand-new.spec.ts");
  check("unknown spec is still assigned, with a default weight", newItem?.estimated === true && newItem.weight === 3 * weights.defaultPerTestSeconds);
  check("other projects' tests are ignored", filesOf(report, "webkit-360x800").length === 0);

  const { args } = shardArgs({ report, project: "webkit-390x844", shard: 1, total: 2, weights });
  const re = (arg) => new RegExp(arg.slice(1, -1));
  check("filters are anchored /.../ regexes", args.every((a) => a.startsWith("/^") && a.endsWith("$/")));
  const one = re(fileFilter("/w/e2e", "viewport-1screen.spec.ts"));
  check("filter matches its own file", one.test("/w/e2e/viewport-1screen.spec.ts"));
  check("filter does not match a prefixed name", !one.test("/w/e2e/x-viewport-1screen.spec.ts"));
  check("filter does not match another directory", !one.test("/w/e2e/sub/viewport-1screen.spec.ts") && !one.test("/v/e2e/viewport-1screen.spec.ts"));
  check("filter escapes '.' (no wildcard match)", !re(fileFilter("/w/e2e", "a.spec.ts")).test("/w/e2e/aXspec.ts"));
  const throws = (fn) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };
  check("empty shard is an error", throws(() => shardArgs({ report: fakeList("/w/e2e", "p", [["a.spec.ts", 1]]), project: "p", shard: 2, total: 2, weights })));
  check("no listed files is an error", throws(() => shardArgs({ report: fakeList("/w/e2e", "p", []), project: "p", shard: 1, total: 2, weights })));
  check("shard out of range is an error", throws(() => shardArgs({ report, project: "webkit-390x844", shard: 3, total: 2, weights })));
  check("relative rootDir is an error", throws(() => shardArgs({ report: fakeList("e2e", "webkit-390x844", real), project: "webkit-390x844", shard: 1, total: 2, weights })));
  console.log(`${count - failed}/${count} shard-plan cases passed`);
  return failed === 0;
}

// ---------------------------------------------------------------------------------------------

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  if (process.argv.includes("--self-test")) process.exit(selfTest() ? 0 : 1);
  try {
    const report = JSON.parse(readFileSync(arg("list"), "utf8"));
    const weights = JSON.parse(readFileSync(arg("weights"), "utf8"));
    const project = arg("project");
    const shard = Number(arg("shard"));
    const total = Number(arg("total"));
    const { args, bins } = shardArgs({ report, project, shard, total, weights });
    const out = arg("out");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${args.join("\n")}\n`);
    bins.forEach((b, i) => {
      const load = b.reduce((n, x) => n + x.weight, 0).toFixed(1);
      const tests = b.reduce((n, x) => n + x.tests, 0);
      const names = b.map((x) => `${x.file}${x.estimated ? " (no weight: estimated)" : ""}`).join(", ");
      console.log(`${i + 1 === shard ? "*" : " "} shard ${i + 1}/${total}: ~${load}s, ${tests} test(s): ${names}`);
    });
    for (const x of bins.flat()) {
      if (x.estimated) console.log(`::warning title=WebKit shard plan::${x.file} has no entry in the weights file; balance is estimated`);
    }
  } catch (error) {
    console.error(`::error title=WebKit shard plan::${error.message}`);
    process.exit(1);
  }
}
