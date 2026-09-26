#!/usr/bin/env node
// Progression 2.0 W1 I5b-5 Layout Contract summary (Design d4f96d0 §12, Preflight §9.2).
//
// Reads a Playwright JSON report, collects every `layout-evidence.json` attachment written by
// e2e/support/layoutContract.ts, and prints a Markdown summary (for $GITHUB_STEP_SUMMARY):
//   1. one verdict line (samples, P0 / P1 failures, advisory records)
//   2. the FAIL rows: invariant | profile | test / state | expected | actual | Δpx (first 50)
//   3. the L-N advisory table: dough diameter min / max per profile (OD-V-4 input)
//   4. LC-0: engine and the applied insets
//
// Usage: node scripts/ci/layout-summary.mjs --results <playwright-results.json> [--json <out.json>]
//        node scripts/ci/layout-summary.mjs --self-test
// Exit code is always 0 unless the input cannot be read: the gate is the test result itself.

import fs from "node:fs";
import path from "node:path";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function* walkSuites(suite) {
  for (const spec of suite.specs ?? []) yield spec;
  for (const child of suite.suites ?? []) yield* walkSuites(child);
}

export function collectEvidence(report, baseDir = ".") {
  const out = [];
  for (const top of report.suites ?? []) {
    for (const spec of walkSuites(top)) {
      for (const t of spec.tests ?? []) {
        for (const r of t.results ?? []) {
          for (const a of r.attachments ?? []) {
            if (a.name !== "layout-evidence.json") continue;
            let text = null;
            if (a.body) text = Buffer.from(a.body, "base64").toString("utf8");
            else if (a.path) {
              const p = path.isAbsolute(a.path) ? a.path : path.join(baseDir, a.path);
              if (fs.existsSync(p)) text = fs.readFileSync(p, "utf8");
            }
            if (text) out.push({ status: r.status, evidence: JSON.parse(text) });
          }
        }
      }
    }
  }
  return out;
}

export function summarize(items) {
  const rows = [];
  const dough = new Map();
  const insets = new Map();
  let samples = 0;
  let p0 = 0;
  let p1 = 0;
  let advisory = 0;
  let pending = 0;
  const engines = new Set();
  for (const { evidence } of items) {
    engines.add(`${evidence.project} (${evidence.engine?.name} ${evidence.engine?.version})`);
    for (const s of evidence.samples ?? []) {
      samples += 1;
      insets.set(s.profile.id, `${s.applied.sat}/${s.applied.sab}`);
      for (const r of s.results ?? []) {
        if (r.pass) continue;
        if (r.knownOwnerPending) pending += 1;
        else if (r.priority === "P0") p0 += 1;
        else if (r.priority === "P1") p1 += 1;
        rows.push({ known: r.knownOwnerPending ?? "", id: r.id, priority: r.priority, profile: s.profile.id, test: evidence.test, state: s.state.label, expected: r.expected, actual: r.actual, delta: r.deltaPx });
      }
      for (const a of s.advisory ?? []) {
        if (a.doughDiameterPx == null) continue;
        advisory += 1;
        const cur = dough.get(s.profile.id) ?? { min: Infinity, max: -Infinity, minState: "" };
        if (a.doughDiameterPx < cur.min) {
          cur.min = a.doughDiameterPx;
          cur.minState = `${evidence.test.split(":")[0]} / ${s.state.label}`;
        }
        cur.max = Math.max(cur.max, a.doughDiameterPx);
        dough.set(s.profile.id, cur);
      }
    }
  }
  rows.sort((a, b) => (a.known ? 1 : 0) - (b.known ? 1 : 0));
  return { rows, dough, insets, samples, p0, p1, pending, advisory, engines: [...engines], tests: items.length };
}

export function renderMarkdown(sum) {
  const verdict = sum.tests > 0 && sum.p0 === 0 && sum.p1 === 0 ? "PASS" : "FAIL";
  const lines = [];
  lines.push(`### Layout Contract: ${verdict} — tests ${sum.tests}, samples ${sum.samples}, P0 fail ${sum.p0}, P1 fail ${sum.p1}, P1 Owner pending ${sum.pending}, advisory ${sum.advisory}`);
  lines.push("");
  if (sum.tests === 0) lines.push("No `layout-evidence.json` attachment found (the contract did not run).", "");
  if (sum.rows.length) {
    lines.push("| invariant | profile | test / state | expected | actual | Δpx | note |", "|---|---|---|---|---|---|---|");
    for (const r of sum.rows.slice(0, 50)) {
      const esc = (v) => String(v ?? "").replace(/\|/g, "\\|");
      lines.push(`| ${r.id} (${r.priority}) | ${r.profile} | ${esc(r.test.split(":")[0])} / ${esc(r.state)} | ${esc(r.expected)} | ${esc(r.actual)} | ${r.delta ?? ""} | ${r.known ? `Owner pending: ${esc(r.known)}` : "FAIL"} |`);
    }
    if (sum.rows.length > 50) lines.push("", `… ${sum.rows.length - 50} more failure rows.`);
    lines.push("");
  }
  if (sum.dough.size) {
    lines.push("L-N advisory (OD-V-4, no floor): dough diameter px", "", "| profile | min | max | min at |", "|---|---|---|---|");
    for (const [id, d] of sum.dough) lines.push(`| ${id} | ${d.min} | ${d.max} | ${d.minState} |`);
    lines.push("");
  }
  lines.push(`LC-0 applied insets (sat/sab): ${[...sum.insets].map(([k, v]) => `${k} ${v}`).join(", ") || "—"}`);
  lines.push(`Engines: ${sum.engines.join("; ") || "—"}`);
  return { verdict, markdown: lines.join("\n") + "\n" };
}

function selfTest() {
  const sample = (profile, pass, px) => ({
    state: { label: "S" },
    profile: { id: profile },
    applied: { sat: profile.endsWith("i") ? 47 : 0, sab: profile.endsWith("i") ? 34 : 0 },
    results: [{ id: "L-B", priority: "P0", pass, expected: ">= 8", actual: pass ? "ok" : "gap=-80px", deltaPx: pass ? null : -88 }],
    advisory: [{ id: "L-N", doughDiameterPx: px, floorPx: null }],
  });
  const ev = (samples) => ({ body: Buffer.from(JSON.stringify({ test: "LC-1 FREE: x", project: "layout-chromium", engine: { name: "chromium", version: "1" }, samples })).toString("base64"), name: "layout-evidence.json" });
  const report = (samples) => ({ suites: [{ specs: [{ tests: [{ results: [{ status: "passed", attachments: [ev(samples)] }] }] }] }] });
  const cases = [
    ["all pass", report([sample("N390", true, 290), sample("E360i", true, 94)]), "PASS", 0],
    ["one P0 fail", report([sample("E360i", false, 94)]), "FAIL", 1],
    ["no evidence", { suites: [] }, "FAIL", 0],
  ];
  let failed = 0;
  for (const [name, rep, want, p0] of cases) {
    const sum = summarize(collectEvidence(rep));
    const { verdict, markdown } = renderMarkdown(sum);
    const ok = verdict === want && sum.p0 === p0 && (want !== "PASS" || markdown.includes("| E360i | 94 | 94 |"));
    console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${verdict}, P0 ${sum.p0}`);
    if (!ok) failed += 1;
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const results = arg("--results");
  if (!results || !fs.existsSync(results)) {
    console.log(`### Layout Contract: FAIL — results file not found (${results ?? "no --results"})`);
    process.exit(0);
  }
  const report = JSON.parse(fs.readFileSync(results, "utf8"));
  const sum = summarize(collectEvidence(report, path.dirname(results)));
  const { markdown } = renderMarkdown(sum);
  process.stdout.write(markdown);
  const jsonOut = arg("--json");
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ ...sum, dough: Object.fromEntries(sum.dough), insets: Object.fromEntries(sum.insets) }, null, 1));
}
