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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const spec = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--out");
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : undefined;
if (!spec || !outDir) {
  console.error("usage: preflight.mjs <spec.json> --out <dir>");
  process.exit(2);
}
const run = spawnSync("npx", ["vitest", "run", "--project", "default", "src/contentTrain/trainPreflight.run.test.ts"], {
  cwd: ROOT, stdio: "inherit", env: { ...process.env, TETO_TRAIN_SPEC: resolve(spec), TETO_TRAIN_OUT: resolve(outDir) },
});
if (run.status !== 0) process.exit(2);
const train = JSON.parse(readFileSync(resolve(spec), "utf8")).train;
const packet = JSON.parse(readFileSync(join(resolve(outDir), `${train}.preflight.json`), "utf8"));
for (const r of packet.recipes) console.log(`${r.verdict.padEnd(11)} ${r.id}${r.findings.length ? `  [${r.findings.map((f) => f.gate).join(", ")}]` : ""}`);
for (const f of packet.trainFindings) console.log(`${f.severity.padEnd(11)} (train) ${f.gate}: ${f.message}`);
console.log(`Research: canonical ${packet.research.canonical.length} / non-canonical ${packet.research.nonCanonical.length} shipped recipe(s). Packet: ${join(resolve(outDir), `${train}.preflight.md`)}`);
process.exit(packet.recipes.some((r) => r.verdict === "BLOCKED") || packet.trainFindings.some((f) => f.severity === "STOP") ? 1 : 0);
