/**
 * Train Kit (R-1): mutation evidence that the composed expectations lose no regression-detection power.
 *
 * A "mutation" is a small, realistic regression applied to a catalog source file (a swapped ladder step, a changed floor, a dropped step, a moved family ...).
 * For every mutation the SAME mutation is applied to two checkouts that differ only in their tests:
 *   OLD tree: the tests as they were (hand-pinned numbers)       NEW tree: the tests after R-1 (composed expectations + catalogComposition.test.ts)
 * and the tests of the converted files are run in each. The claim to prove is  detected(OLD)  implies  detected(NEW)  for every mutation (new >= old).
 * An unmutated control run must pass in both trees first.
 *
 *   node tools/train-kit/cli.mjs mutation --old <tree> --new <tree> --files "<space separated test files>" --out <result.json> [--mutations <file>]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ROOT } from "./cli.mjs";

const countOf = (text, needle) => (needle === "" ? 0 : text.split(needle).length - 1);

/** Pure: apply a mutation's operations to the text of one file. Every operation must match exactly once (a mutation that no longer applies is a stale mutation, not a pass). */
export function applyOps(text, ops) {
  let out = text;
  for (const op of ops) {
    if (op.type === "replace") {
      if (countOf(out, op.from) !== 1) throw new Error(`replace: ${JSON.stringify(op.from.slice(0, 70))} matches ${countOf(out, op.from)}x (need exactly 1)`);
      out = out.replace(op.from, () => op.to);
    } else if (op.type === "deleteLine" || op.type === "swapLines") {
      const lines = out.split("\n");
      const find = (line) => {
        const at = lines.flatMap((l, i) => (l === line ? [i] : []));
        if (at.length !== 1) throw new Error(`${op.type}: line ${JSON.stringify(line.slice(0, 70))} matches ${at.length}x (need exactly 1)`);
        return at[0];
      };
      if (op.type === "deleteLine") lines.splice(find(op.line), 1);
      else {
        const [i, j] = [find(op.a), find(op.b)];
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      out = lines.join("\n");
    } else throw new Error(`unknown operation ${op.type}`);
  }
  return out;
}

/**
 * Pure: classify one test run into exactly one OUTCOME (fail-closed).
 *   pass      exit code 0                                                  -> the tests did not notice (for a mutation: MISSED)
 *   detected  exit code != 0 and at least one failure that is not a timeout (or a crash / suite-level error with nothing parsed) -> the tests noticed
 *   timeout   exit code != 0 and every parsed failure is a timeout         -> load noise: NOT a detection and NOT a miss, i.e. indeterminate
 * `messages` are the parsed failed assertions ({file, message}); `suiteFailed` is true when a test FILE failed without any failed assertion (a suite-level error).
 */
export function classifyRun({ code, messages, suiteFailed = false }) {
  if (code === 0) return "pass";
  const real = messages.filter((m) => !/timed out/i.test(m.message));
  if (messages.length > 0 && real.length === 0 && !suiteFailed) return "timeout";
  return "detected";
}

function runVitest(tree, files) {
  return new Promise((done) => {
    const outFile = join(mkdtempSync(join(tmpdir(), "train-kit-mut-")), "r.json");
    const child = spawn("npx", ["vitest", "run", "--project", "default", "--bail=1", "--reporter=json", `--outputFile=${outFile}`, ...files], { cwd: tree, stdio: "ignore" });
    child.on("close", (code) => {
      let json = null;
      try { json = JSON.parse(readFileSync(outFile, "utf8")); } catch { /* crashed before writing */ }
      const failedFiles = json?.testResults?.filter((f) => f.assertionResults.some((a) => a.status === "failed")) ?? [];
      const messages = failedFiles.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => ({ file: f.name.replace(`${tree}/`, ""), message: String(a.failureMessages?.[0] ?? "").split("\n")[0].slice(0, 160) })));
      const suiteFailed = (json?.testResults ?? []).some((f) => f.status === "failed" && !f.assertionResults.some((a) => a.status === "failed"));
      const outcome = classifyRun({ code, messages, suiteFailed });
      const real = messages.filter((m) => !/timed out/i.test(m.message));
      done({
        outcome, // "pass" | "detected" | "timeout"
        detected: outcome === "detected",
        timeoutOnly: outcome === "timeout",
        exitCode: code,
        failedTests: json?.numFailedTests ?? null,
        firstFailingFile: (real[0] ?? messages[0])?.file ?? null,
        firstMessage: (real[0] ?? messages[0])?.message ?? (outcome === "detected" ? "(non-zero exit; no assertion parsed)" : null),
      });
    });
  });
}

async function withMutation(run, tree, mutation, files) {
  const path = join(tree, mutation.file);
  const original = readFileSync(path, "utf8");
  try {
    writeFileSync(path, applyOps(original, mutation.ops));
    let result = await run(tree, files);
    if (result.outcome === "timeout") result = { ...(await run(tree, files)), retriedAfterTimeoutOnly: true }; // load noise: once more; a second timeout stays "timeout" (indeterminate)
    return result;
  } finally {
    writeFileSync(path, original);
  }
}

/** Pure: the label of one side of a row, with the three outcomes kept apart. */
export const labelOf = (r) => (r.outcome === "detected" ? "DETECTED" : r.outcome === "timeout" ? "TIMEOUT(indeterminate)" : "missed");

/**
 * Pure: judge the finished rows. FAIL-CLOSED: the run passes only when no side is indeterminate and no detection was lost.
 * `lost` is only computed from determinate outcomes; a timeout on either side makes the row indeterminate (never a miss, never a loss that can be ruled out).
 */
export function judge(rows, control) {
  const indeterminate = rows.filter((r) => r.old.outcome === "timeout" || r.new.outcome === "timeout").map((r) => r.id);
  const lost = rows.filter((r) => r.lost).map((r) => r.id);
  const controlBad = control.filter(([, r]) => r.outcome !== "pass").map(([k]) => k);
  return { controlBad, indeterminate, lost, verdict: controlBad.length === 0 && indeterminate.length === 0 && lost.length === 0 ? "PASS" : "FAIL" };
}

export async function mutation(flags, deps = {}) {
  for (const f of ["old", "new", "files", "out"]) if (typeof flags[f] !== "string") throw new Error(`mutation needs --${f}`);
  const run = deps.run ?? runVitest;
  const mutations = JSON.parse(readFileSync(resolve(flags.mutations ?? join(ROOT, "tools", "train-kit", "mutations.json")), "utf8")).mutations;
  const trees = { old: resolve(flags.old), new: resolve(flags.new) };
  const files = flags.files.split(/\s+/).filter(Boolean);
  const filesFor = (tree) => files.filter((f) => existsSync(join(tree, f))); // catalogComposition.test.ts exists only in the NEW tree
  const control = [];
  for (const [k, t] of Object.entries(trees)) control.push([k, await run(t, filesFor(t))]);
  console.log(`control (no mutation): old ${control[0][1].outcome}, new ${control[1][1].outcome}`);
  // The control must EXIT 0. A failing control (any failure) and a timeout-only control are both FAIL: nothing can be compared against a tree that does not pass.
  const badControl = control.filter(([, r]) => r.outcome !== "pass");
  if (badControl.length > 0) throw new Error(`the unmutated control run did not pass (${badControl.map(([k, r]) => `${k}: ${r.outcome === "timeout" ? "timeout-only, indeterminate" : "failed"}`).join("; ")}); fix the trees / the load and rerun before comparing`);
  const rows = [];
  for (const m of mutations) {
    // Sequential by default: two vitest processes on one machine (one node_modules, one cache) are the main source of load noise. `--parallel` trades certainty for time.
    const [o, n] = flags.parallel
      ? await Promise.all([withMutation(run, trees.old, m, filesFor(trees.old)), withMutation(run, trees.new, m, filesFor(trees.new))])
      : [await withMutation(run, trees.old, m, filesFor(trees.old)), await withMutation(run, trees.new, m, filesFor(trees.new))];
    const determinate = o.outcome !== "timeout" && n.outcome !== "timeout";
    const row = { id: m.id, description: m.description, file: m.file, old: o, new: n, indeterminate: !determinate, lost: determinate && o.detected && !n.detected, gained: determinate && !o.detected && n.detected };
    rows.push(row);
    console.log(`${m.id}: old ${labelOf(o)} (${o.firstFailingFile ?? "-"}) / new ${labelOf(n)} (${n.firstFailingFile ?? "-"})${row.lost ? "  <-- LOST" : ""}${row.gained ? "  (gained)" : ""}${row.indeterminate ? "  <-- INDETERMINATE (FAIL)" : ""}`);
  }
  const j = judge(rows, control);
  const count = (side, outcome) => rows.filter((r) => r[side].outcome === outcome).length;
  const summary = {
    verdict: j.verdict,
    mutations: rows.length,
    detectedOld: count("old", "detected"), detectedNew: count("new", "detected"),
    missedOld: count("old", "pass"), missedNew: count("new", "pass"),
    timeoutOld: count("old", "timeout"), timeoutNew: count("new", "timeout"),
    indeterminate: j.indeterminate, lost: j.lost, gained: rows.filter((r) => r.gained).map((r) => r.id), files,
  };
  writeFileSync(resolve(flags.out), `${JSON.stringify({ summary, rows }, null, 1)}\n`);
  console.log(`detected: old ${summary.detectedOld}/${summary.mutations}, new ${summary.detectedNew}/${summary.mutations}; missed: old ${summary.missedOld}, new ${summary.missedNew}; timeout: old ${summary.timeoutOld}, new ${summary.timeoutNew}; lost ${summary.lost.length}; indeterminate ${summary.indeterminate.length}; gained ${summary.gained.length}; verdict ${summary.verdict}`);
  return summary.verdict === "PASS" ? 0 : 1;
}
