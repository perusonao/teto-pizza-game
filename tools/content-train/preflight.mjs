#!/usr/bin/env node
/**
 * Content Train preflight (Issue #780; read-only tool -- it edits no catalog file).
 *
 *   node tools/content-train/preflight.mjs <spec.json> --out <dir>
 *
 * Runs `src/contentTrain/trainPreflight.run.test.ts` on the spec and prints the verdicts. Exit code: 0 = no STOP finding,
 * 1 = at least one recipe is BLOCKED or a train-level STOP exists, 2 = the run itself failed (bad spec / unsound rule).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, runnerInvocation, USAGE } from "./launch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const parsed = parseArgs(process.argv.slice(2));
if (!parsed) {
  console.error(USAGE);
  process.exit(2);
}
const { spec, outDir } = parsed;
let invocation;
try {
  invocation = runnerInvocation({ root: ROOT, spec, outDir });
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const run = spawnSync(invocation.command, invocation.args, invocation.options);
if (run.error) {
  console.error(`could not start the runner (${invocation.command}): ${run.error.message}`);
  process.exit(2);
}
if (run.status !== 0) process.exit(2);
const train = JSON.parse(readFileSync(resolve(spec), "utf8")).train;
const packet = JSON.parse(readFileSync(join(resolve(outDir), `${train}.preflight.json`), "utf8"));
for (const r of packet.recipes) console.log(`${r.verdict.padEnd(11)} ${r.id}${r.findings.length ? `  [${r.findings.map((f) => f.gate).join(", ")}]` : ""}`);
for (const f of packet.trainFindings) console.log(`${f.severity.padEnd(11)} (train) ${f.gate}: ${f.message}`);
console.log(`Research: canonical ${packet.research.canonical.length} / non-canonical ${packet.research.nonCanonical.length} shipped recipe(s). Packet: ${join(resolve(outDir), `${train}.preflight.md`)}`);
process.exit(packet.recipes.some((r) => r.verdict === "BLOCKED") || packet.trainFindings.some((f) => f.severity === "STOP") ? 1 : 0);
