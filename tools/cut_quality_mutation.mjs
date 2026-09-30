#!/usr/bin/env node
/**
 * CUT-S1 (Issue #288): hand-rolled mutation test for src/logic/cut/quality.ts (no Stryker in this
 * repo). Each mutant is one or more [from, to] textual replacements; every `from` must occur exactly
 * once. KILLED = quality.test.ts fails, SURVIVED = it passes. The file is restored afterwards (also
 * on error / Ctrl-C).
 *
 * Usage: node tools/cut_quality_mutation.mjs [--out PATH]     Exit code 1 when any mutant survives.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outPath = outArg > -1 ? resolve(process.argv[outArg + 1]) : null;
const FILE = "src/logic/cut/quality.ts";
const original = readFileSync(resolve(root, FILE), "utf8");

const MUTANTS = [
  ["Q01", "creditBetween: full-credit boundary is exclusive", [["if (value <= full) return 1;", "if (value < full) return 1;"]], "equal input gives 1 either way (linear branch also yields 1 at the boundary)"],
  ["Q02", "creditBetween: zero-credit boundary is exclusive", [["if (value >= zero) return 0;", "if (value > zero) return 0;"]], "equal input gives 0 either way (linear branch also yields 0 at the boundary)"],
  ["Q03", "creditBetween: slope inverted", [["return (zero - value) / (zero - full);", "return (value - full) / (zero - full);"]]],
  ["Q04", "clamp01 lets values above 1 through", [["return value < 0 ? 0 : value > 1 ? 1 : value;", "return value < 0 ? 0 : value;"]], "defensive: every argument is already <= 1 (credit/ratio), unreachable"],
  ["Q05", "clamp01 lets negatives through", [["return value < 0 ? 0 : value > 1 ? 1 : value;", "return value > 1 ? 1 : value;"]], "defensive: every argument is already >= 0, unreachable"],
  ["Q06", "clamp01 lets NaN through", [["if (!Number.isFinite(value)) return 0;\n  return value < 0", "return value < 0"]], "defensive: NaN can only arise from 0/0 or invalid input, both guarded earlier"],
  ["Q07", "non-finite line accepted", [["if (!isFinitePoint(line.start) || !isFinitePoint(line.end)) return false;", ""]], "redundant guard: a NaN coordinate also fails the endpoint-distance check"],
  ["Q08", "min chord length check dropped", [["if (Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) < tolerance.minChordLength) return false;", ""]]],
  ["Q10", "endpoint margin ignored", [["const limit = DOUGH_RADIUS + tolerance.endpointMargin;", "const limit = Infinity;"]]],
  ["Q11", "endpoint margin boundary exclusive", [["Math.hypot(line.start.x - DOUGH_CENTER, line.start.y - DOUGH_CENTER) <= limit", "Math.hypot(line.start.x - DOUGH_CENTER, line.start.y - DOUGH_CENTER) < limit"]]],
  ["Q12", "only the start endpoint is checked", [["Math.hypot(line.end.x - DOUGH_CENTER, line.end.y - DOUGH_CENTER) <= limit", "true"]]],
  ["Q13", "distinct orientation gap boundary exclusive", [["if (angles[i] - angles[i - 1] >= minSeparation) clusters++;", "if (angles[i] - angles[i - 1] > minSeparation) clusters++;"]]],
  ["Q14", "orientation clusters not sorted (order dependent)", [[".map(cutLineOrientationRadians).sort((a, b) => a - b)", ".map(cutLineOrientationRadians)"]]],
  ["Q15", "0/pi wrap-around merge dropped", [["if (clusters > 1 && angles[0] + Math.PI - angles[angles.length - 1] < minSeparation) clusters--;", ""]]],
  ["Q16", "wrap-around merge applied even with a single cluster", [["if (clusters > 1 && angles[0]", "if (angles[0]"]]],
  ["Q17", "lineValidity divides by valid lines instead of all lines", [["distinctLineCount / lines.length", "distinctLineCount / Math.max(1, validLines.length)"]]],
  ["Q18", "lineValidity for no lines is 1", [["lines.length === 0 ? 0 :", "lines.length === 0 ? 1 :"]]],
  ["Q19", "slice count fit ignores requested count", [["Math.abs(actualPieceCount - requestedSliceCount) / requestedSliceCount", "Math.abs(actualPieceCount - 6) / 6"]]],
  ["Q20", "slice count fit not capped", [["1 - Math.min(1, Math.abs(actualPieceCount - requestedSliceCount) / requestedSliceCount)", "1 - Math.abs(actualPieceCount - requestedSliceCount) / requestedSliceCount"]], "the uncapped value is negative and clamp01 restores 0"],
  ["Q21", "centre accuracy uses the worst line instead of the mean", [["sum += creditBetween(", "sum = Math.max(sum, 0) + 0 * creditBetween("], ["centerAccuracy = clamp01(sum / validLines.length);", "centerAccuracy = 1;"]]],
  ["Q22", "centre accuracy averages over all lines (invalid ones included)", [["centerAccuracy = clamp01(sum / validLines.length);", "centerAccuracy = clamp01(sum / lines.length);"]]],
  ["Q23", "centre credit ignores the full-credit dead zone", [["tol.centerFullCreditDistance,\n        tol.centerZeroCreditDistance,", "0,\n        tol.centerZeroCreditDistance,"]]],
  ["Q24", "uniformity ideal area uses a fixed 6", [["const ideal = CIRCLE_AREA / requestedSliceCount;", "const ideal = CIRCLE_AREA / 6;"]]],
  ["Q25", "uniformity measured on all regions (slivers included)", [["const measuredAreas = significantAreas.length > 0 ? significantAreas : pieceAreas;", "const measuredAreas = pieceAreas;"]]],
  ["Q26", "sliver threshold ignores the ideal area", [["area >= tol.sliverAreaFraction * ideal", "area >= tol.sliverAreaFraction"]]],
  ["Q27", "sliver threshold boundary exclusive", [["area >= tol.sliverAreaFraction * ideal", "area > tol.sliverAreaFraction * ideal"]], "area == threshold exactly is not reachable with a sampled grid"],
  ["Q28", "all-sliver fallback removed", [["significantAreas.length > 0 ? significantAreas : pieceAreas", "significantAreas"]]],
  ["Q29", "geometry uses every line, not only valid ones", [["computePieceAreas(validLines)", "computePieceAreas(lines)"]]],
  ["Q30", "centre accuracy reads every line, not only valid ones", [["for (const line of validLines) {\n      sum +=", "for (const line of lines) {\n      sum +="]]],
  ["Q31", "requiredLineCount hard-coded", [["requiredLineCount: requiredCutCount(requestedSliceCount),", "requiredLineCount: 3,"]]],
  ["Q32", "weights not normalised", [["/\n      total,\n  );", "/\n      1,\n  );"]]],
  ["Q33", "negative weights accepted", [["Number.isFinite(x) && x > 0 ? x : 0", "Number.isFinite(x) ? x : 0"]]],
  ["Q34", "zero total weight not guarded", [["if (total === 0) return 0;", ""]], "0/0 gives NaN and clamp01 turns it into 0"],
  ["Q35", "mis-ordered centre tolerance accepted", [["if (centerZero <= centerFull) {", "if (false) {"]]],
  ["Q36", "mis-ordered uniformity tolerance accepted", [["if (uniZero <= uniFull) {", "if (false) {"]]],
  ["Q37", "negative tolerance accepted", [["Number.isFinite(v) && v >= 0 ? v : fallback", "Number.isFinite(v) ? v : fallback"]]],
  ["Q38", "sliver fraction of 1 or more accepted", [["v >= 0 && v < 1 ? v", "v >= 0 ? v"]]],
  ["Q39", "a completeness bonus is added back", [["overall: combine(signals, weights),", "overall: combine({ ...signals, lineValidity: Math.min(1, lines.length / requiredCutCount(requestedSliceCount)) }, weights),"]]],
  ["Q40", "quality.ts learns about scoring (scope guard)", [['import { requiredCutCount } from "./evaluation";', 'import { requiredCutCount } from "./evaluation";\nimport "../scoringV2";']]],
];

function run() {
  const r = spawnSync("npx", ["vitest", "run", "src/logic/cut/quality.test.ts"], { cwd: root, encoding: "utf8" });
  return r.status === 0;
}

const results = [];
const restore = () => writeFileSync(resolve(root, FILE), original);
process.on("SIGINT", () => { restore(); process.exit(130); });
try {
  if (!run()) { console.error("baseline is red"); process.exitCode = 2; }
  else {
    for (const [id, description, edits, equivalent] of MUTANTS) {
      let mutated = original;
      let ok = true;
      for (const [from, to] of edits) {
        const n = mutated.split(from).length - 1;
        if (n !== 1) { ok = false; console.error(`${id}: 'from' occurs ${n}x`); break; }
        mutated = mutated.replace(from, () => to);
      }
      if (!ok) { results.push({ id, description, status: "INVALID" }); continue; }
      writeFileSync(resolve(root, FILE), mutated);
      const survived = run();
      results.push({ id, description, status: survived ? (equivalent ? "EQUIVALENT" : "SURVIVED") : "KILLED", ...(equivalent ? { reason: equivalent } : {}) });
      console.log(`${id} ${survived ? (equivalent ? "equivalent" : "SURVIVED") : "killed"} - ${description}`);
      restore();
    }
  }
} finally { restore(); }

const killed = results.filter((r) => r.status === "KILLED").length;
const bad = results.filter((r) => r.status !== "KILLED" && r.status !== "EQUIVALENT");
const equivalents = results.filter((r) => r.status === "EQUIVALENT");
console.log(`\n${killed}/${results.length} killed; ${equivalents.length} equivalent (documented); ${bad.length} survived`);
for (const b of bad) console.log(`  ${b.id} ${b.status}: ${b.description}`);
if (outPath) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, JSON.stringify({ file: FILE, results }, null, 2) + "\n"); }
if (bad.length > 0) process.exitCode = 1;
