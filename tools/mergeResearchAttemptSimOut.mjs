#!/usr/bin/env node
/**
 * T9 (#784): research-attempt simulation JSON compatibility helper.
 *
 * `src/logic/researchAttempt.sim.test.ts` used to write ONE JSON file when `RESEARCH_ATTEMPT_SIM_OUT=<path>` was set (the Gate C report's tables come from it).
 * The test is now four files running in parallel workers, so each writes its own slice: `<path>` with `.mainFull`, `.mainOne`, `.sweepFull` or `.sweepOne`
 * inserted before the extension (e.g. out.json -> out.mainFull.json). This script reassembles the original single file, byte-for-byte equivalent to what the
 * old single test file wrote (same keys, same array order: `runs` = main FULL walks, main ONE walks, lower bound FULL, lower bound ONE; `baseline`; `sweep` = FULL then ONE).
 *
 *   node tools/mergeResearchAttemptSimOut.mjs <path>        # reads <path-without-ext>.<part><ext> x4, writes <path>
 *
 * Exits non-zero (and writes nothing) when a part is missing or its shape is not the expected one. Pure Node, no dependencies, never touches the repository.
 */
import { readFileSync, writeFileSync } from "node:fs";

const out = process.argv[2];
if (!out) {
  console.error("usage: node tools/mergeResearchAttemptSimOut.mjs <path>");
  process.exit(2);
}
const part = (name) => out.replace(/(\.[^./\\]+)?$/, `.${name}$1`);
const read = (name) => {
  const data = JSON.parse(readFileSync(part(name), "utf8"));
  for (const key of ["runs", "baseline", "sweep"]) {
    if (!Array.isArray(data[key])) throw new Error(`${part(name)}: "${key}" is not an array`);
  }
  return data;
};
try {
  const mainFull = read("mainFull");
  const mainOne = read("mainOne");
  const sweepFull = read("sweepFull");
  const sweepOne = read("sweepOne");
  // Each main part holds 18 walks followed by its one lower-bound run (the original single file pushed all 36 walks first, then both lower bounds).
  const WALKS = 18;
  if (mainFull.runs.length !== WALKS + 1 || mainOne.runs.length !== WALKS + 1) {
    throw new Error(`unexpected run counts: mainFull ${mainFull.runs.length}, mainOne ${mainOne.runs.length} (expected ${WALKS + 1} each)`);
  }
  const merged = {
    runs: [...mainFull.runs.slice(0, WALKS), ...mainOne.runs.slice(0, WALKS), ...mainFull.runs.slice(WALKS), ...mainOne.runs.slice(WALKS)],
    baseline: mainOne.baseline,
    sweep: [...sweepFull.sweep, ...sweepOne.sweep],
  };
  writeFileSync(out, JSON.stringify(merged, null, 1));
  console.log(`wrote ${out}: runs ${merged.runs.length}, baseline ${merged.baseline.length}, sweep ${merged.sweep.length}`);
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
