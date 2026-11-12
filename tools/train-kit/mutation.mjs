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

function runVitest(tree, files) {
  return new Promise((done) => {
    const outFile = join(mkdtempSync(join(tmpdir(), "train-kit-mut-")), "r.json");
    const child = spawn("npx", ["vitest", "run", "--project", "default", "--bail=1", "--reporter=json", `--outputFile=${outFile}`, ...files], { cwd: tree, stdio: "ignore" });
    child.on("close", (code) => {
      let json = null;
      try { json = JSON.parse(readFileSync(outFile, "utf8")); } catch { /* crashed before writing */ }
      const failedFiles = json?.testResults?.filter((f) => f.assertionResults.some((a) => a.status === "failed")) ?? [];
      const messages = failedFiles.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => ({ file: f.name.replace(`${tree}/`, ""), message: String(a.failureMessages?.[0] ?? "").split("\n")[0].slice(0, 160) })));
      // A failure that is ONLY a timeout is load noise, not a detection (the caller repeats it alone). Any other non-zero exit IS a detection, even if no assertion could be parsed
      // (a suite-level error, a crash): "exit code != 0 and not timeout-only" can never be reported as a miss.
      const real = messages.filter((m) => !/timed out/i.test(m.message));
      const timeoutOnly = code !== 0 && messages.length > 0 && real.length === 0 && (json?.testResults ?? []).every((f) => f.status !== "failed" || f.assertionResults.some((a) => a.status === "failed"));
      done({ detected: code !== 0 && !timeoutOnly, exitCode: code, failedTests: json?.numFailedTests ?? null, firstFailingFile: (real[0] ?? messages[0])?.file ?? null, firstMessage: (real[0] ?? messages[0])?.message ?? (code !== 0 && !timeoutOnly ? "(non-zero exit; no assertion parsed)" : null), timeoutOnly });
    });
  });
}

async function withMutation(tree, mutation, files) {
  const path = join(tree, mutation.file);
  const original = readFileSync(path, "utf8");
  try {
    writeFileSync(path, applyOps(original, mutation.ops));
    let result = await runVitest(tree, files);
    if (result.timeoutOnly) result = { ...(await runVitest(tree, files)), retriedAfterTimeoutOnly: true }; // load noise: once more
    return result;
  } finally {
    writeFileSync(path, original);
  }
}

export async function mutation(flags) {
  for (const f of ["old", "new", "files", "out"]) if (typeof flags[f] !== "string") throw new Error(`mutation needs --${f}`);
  const mutations = JSON.parse(readFileSync(resolve(flags.mutations ?? join(ROOT, "tools", "train-kit", "mutations.json")), "utf8")).mutations;
  const trees = { old: resolve(flags.old), new: resolve(flags.new) };
  const files = flags.files.split(/\s+/).filter(Boolean);
  const filesFor = (tree) => files.filter((f) => existsSync(join(tree, f))); // catalogComposition.test.ts exists only in the NEW tree
  const control = [];
  for (const [k, t] of Object.entries(trees)) control.push([k, await runVitest(t, filesFor(t))]);
  const controlOk = control.every(([, r]) => !r.detected);
  console.log(`control (no mutation): old ${control[0][1].detected ? "FAIL" : "pass"}, new ${control[1][1].detected ? "FAIL" : "pass"}`);
  if (!controlOk) throw new Error("the unmutated control run fails; fix the trees before comparing");
  const rows = [];
  for (const m of mutations) {
    // Sequential by default: two vitest processes on one machine (one node_modules, one cache) are the main source of load noise. `--parallel` trades certainty for time.
    const [o, n] = flags.parallel
      ? await Promise.all([withMutation(trees.old, m, filesFor(trees.old)), withMutation(trees.new, m, filesFor(trees.new))])
      : [await withMutation(trees.old, m, filesFor(trees.old)), await withMutation(trees.new, m, filesFor(trees.new))];
    const row = { id: m.id, description: m.description, file: m.file, old: o, new: n, lost: o.detected && !n.detected, gained: !o.detected && n.detected };
    rows.push(row);
    console.log(`${m.id}: old ${o.detected ? "DETECTED" : o.timeoutOnly ? "timeout-only" : "missed"} (${o.firstFailingFile ?? "-"}) / new ${n.detected ? "DETECTED" : n.timeoutOnly ? "timeout-only" : "missed"} (${n.firstFailingFile ?? "-"})${row.lost ? "  <-- LOST" : ""}${row.gained ? "  (gained)" : ""}`);
  }
  const summary = { mutations: rows.length, detectedOld: rows.filter((r) => r.old.detected).length, detectedNew: rows.filter((r) => r.new.detected).length, lost: rows.filter((r) => r.lost).map((r) => r.id), gained: rows.filter((r) => r.gained).map((r) => r.id), files };
  writeFileSync(resolve(flags.out), `${JSON.stringify({ summary, rows }, null, 1)}\n`);
  console.log(`detected: old ${summary.detectedOld}/${summary.mutations}, new ${summary.detectedNew}/${summary.mutations}; lost ${summary.lost.length}; gained ${summary.gained.length}`);
  return summary.lost.length === 0 ? 0 : 1;
}
