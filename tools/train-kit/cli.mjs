#!/usr/bin/env node
/**
 * Train Kit CLI (Issue #780). One entry point for the spec-driven content train. See tools/train-kit/README.md.
 *
 *   node tools/train-kit/cli.mjs scaffold <approval-spec.json> --tag t --label "..." --out impl-spec.json   (skeleton; authored values = TODO)
 *   node tools/train-kit/cli.mjs extract  --ids a,b --train T --tag t --label "Expansion Batch N" [--issue 780] --out spec.json
 *   node tools/train-kit/cli.mjs apply    <spec.json> [--dry-run] [--out report.json]
 *   node tools/train-kit/cli.mjs e2e      <spec.json> --out e2e/<name>.spec.ts   (regenerate the E2E only)
 *   node tools/train-kit/cli.mjs coverage --out coverage.json
 *   node tools/train-kit/cli.mjs replay   --base <commit> --target <commit> --ids a,b --tag t --label "..." --out <dir> [--tsc]
 *   node tools/train-kit/cli.mjs sweep    [--min 2] [--no-tsc]             (after apply: the follow-up worklist in existing tests)
 *   node tools/train-kit/cli.mjs freeze   --at <commit> --out <file>      (record the frozen baseline the composed test expectations start from)
 *   node tools/train-kit/cli.mjs mutation --old <tree> --new <tree> --files "<tests>" --out <json>   (regression-detection parity of old vs composed tests)
 *   node tools/train-kit/cli.mjs pins     --commits <sha,...>              (re-learn the pin list from shipped batch commits)
 *   node tools/train-kit/cli.mjs plan     <spec.json> --out <dir>          (verification packet: gates, E2E, HV checklist)
 *   node tools/train-kit/cli.mjs claims   --files <a,b|@report.json> --claims <comments.json> [--prs <prs.json>] [--session <id>]
 *   node tools/train-kit/cli.mjs progress [--out <dir>]
 *
 * Exit code: 0 ok / 1 a finding (replay difference, claim overlap) / 2 the run itself failed.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUNNER = "src/trainKit/trainKit.run.test.ts";

export function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) rest.push(a);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) flags[a.slice(2)] = argv[(i += 1)];
    else flags[a.slice(2)] = true;
  }
  return { flags, rest };
}

/** Runs the Vitest-hosted runner in `cwd` with the given mode; returns true on success. */
export function runner(mode, env, cwd = ROOT, quiet = false) {
  const run = spawnSync("npx", ["vitest", "run", "--project", "default", RUNNER], { cwd, encoding: "utf8", env: { ...process.env, TETO_KIT_MODE: mode, ...env } });
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  if (run.status !== 0) {
    process.stderr.write(out);
    return false;
  }
  if (!quiet) for (const line of out.split("\n")) if (/^(extracted|NOT EXPRESSIBLE|DRY RUN|edited|generated|\{)/.test(line.trim())) console.log(line.trim());
  return true;
}

/** Order-insensitive for object keys, ordered for arrays. Returns the paths that differ. */
export function deepDiff(a, b, path = "", out = []) {
  if (out.length >= 50) return out;
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object" || Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${path || "(root)"}: ${JSON.stringify(a)?.slice(0, 80)} != ${JSON.stringify(b)?.slice(0, 80)}`);
    return out;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) out.push(`${path}: length ${a.length} != ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) deepDiff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) deepDiff(a[k], b[k], path ? `${path}.${k}` : k, out);
  return out;
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\s+/g, " ").trim();

export function git(args, cwd = ROOT) {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout.trim();
}

/** A detached worktree of `commit` at `tree`, with this checkout's kit copied in (the commits being replayed / frozen predate it; the kit's own gates and landed specs are not copied). */
export function prepareTree(commit, tree) {
  git(["worktree", "add", "--detach", tree, commit]);
  symlinkSync(join(ROOT, "node_modules"), join(tree, "node_modules"), "dir");
  for (const dir of ["src/trainKit", "src/contentTrain", "tools/train-kit"]) {
    rmSync(join(tree, dir), { recursive: true, force: true });
    cpSync(join(ROOT, dir), join(tree, dir), { recursive: true, filter: (src) => !/trainKit\/landed|trainContract\.test|codegen\.anchors\.test|trainSpec\.test|roundtrip\.test|codegen\.test/.test(src.replace(/\\/g, "/")) });
  }
}

export function removeTree(tree) {
  spawnSync("git", ["worktree", "remove", "--force", tree], { cwd: ROOT });
}

/**
 * Equivalence replay: re-create a batch that already shipped. The spec is extracted from the TARGET commit, applied by the
 * generator to the BASE commit, and the resulting catalog (the real modules, evaluated) must equal the target's.
 */
function replay(flags) {
  for (const f of ["base", "target", "ids", "tag", "label", "out"]) if (typeof flags[f] !== "string") throw new Error(`replay needs --${f}`);
  if (!/^[a-z][a-z0-9]*$/.test(flags.tag)) throw new Error(`--tag "${flags.tag}" must match [a-z][a-z0-9]* (it becomes a file name)`);
  for (const f of ["base", "target"]) if (flags[f].startsWith("-")) throw new Error(`--${f} must be a commit, not an option`);
  const outDir = resolve(flags.out);
  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "train-kit-replay-"));
  const trees = { base: join(work, "base"), target: join(work, "target") };
  const meta = { TETO_KIT_IDS: flags.ids, TETO_KIT_TRAIN: `replay-${flags.tag}`, TETO_KIT_TAG: flags.tag, TETO_KIT_LABEL: flags.label, TETO_KIT_ISSUE: String(flags.issue ?? 780) };
  const result = { base: git(["rev-parse", flags.base]), target: git(["rev-parse", flags.target]), ids: flags.ids.split(","), catalogDifferences: [], hvSeedsWiringIdentical: null, previewGateIdentical: null, tsc: "not run", unsupported: [] };
  try {
    for (const [name, tree] of Object.entries(trees)) prepareTree(flags[name], tree);
    const spec = join(outDir, `${flags.tag}.replay.spec.json`);
    if (!runner("extract", { ...meta, TETO_KIT_OUT: spec }, trees.target)) throw new Error("extract failed on the target commit");
    if (!runner("dump", { TETO_KIT_OUT: join(work, "target.json") }, trees.target, true)) throw new Error("dump failed on the target commit");
    // Files the batch generated by hand at the target are removed from the base copy only if they exist there (they never do: base predates them).
    if (!runner("apply", { TETO_KIT_SPEC: spec, TETO_KIT_SKIP_GLYPH_DISPATCH: flags["skip-glyph-dispatch"] ? "1" : "", TETO_KIT_OUT: join(outDir, `${flags.tag}.replay.apply.json`) }, trees.base)) throw new Error("apply failed on the base commit");
    if (!runner("dump", { TETO_KIT_OUT: join(work, "applied.json") }, trees.base, true)) throw new Error("dump failed after apply");
    result.catalogDifferences = deepDiff(JSON.parse(readFileSync(join(work, "applied.json"), "utf8")), JSON.parse(readFileSync(join(work, "target.json"), "utf8")));
    const same = (rel) => (existsSync(join(trees.target, rel)) ? stripComments(readFileSync(join(trees.base, rel), "utf8")) === stripComments(readFileSync(join(trees.target, rel), "utf8")) : null);
    result.hvSeedsWiringIdentical = same("src/preview/hvSeeds.ts");
    result.previewGateIdentical = same("src/preview/previewIsolation.gate.test.ts");
    if (flags.tsc) {
      const tsc = spawnSync("npx", ["tsc", "-b"], { cwd: trees.base, encoding: "utf8" });
      // A type error in an EXISTING test (a table keyed by recipe id that needs the new row) is the batch's follow-up work, not a generator defect; anything else is.
      const files = [...new Set((tsc.stdout ?? "").split("\n").map((l) => /^(\S+?)\(\d+,\d+\): error/.exec(l)?.[1]).filter(Boolean))];
      const generated = JSON.parse(readFileSync(join(outDir, `${flags.tag}.replay.apply.json`), "utf8"));
      const mine = files.filter((f) => !/\.test\.tsx?$/.test(f) || generated.generated.includes(f));
      result.typeFollowUps = files.filter((f) => !mine.includes(f));
      result.tsc = tsc.status === 0 ? "0 errors" : mine.length === 0 ? `0 errors in generated / edited code; ${result.typeFollowUps.length} existing test file(s) need a row for the new id (follow-up)` : `FAILED in ${mine.join(", ")}\n${(tsc.stdout ?? "").split("\n").slice(0, 20).join("\n")}`;
    }
  } finally {
    for (const tree of Object.values(trees)) spawnSync("git", ["worktree", "remove", "--force", tree], { cwd: ROOT });
    rmSync(work, { recursive: true, force: true });
  }
  writeFileSync(join(outDir, `${flags.tag}.replay.result.json`), `${JSON.stringify(result, null, 1)}\n`);
  const ok = result.catalogDifferences.length === 0 && result.hvSeedsWiringIdentical !== false && result.previewGateIdentical !== false && !String(result.tsc).startsWith("FAILED");
  console.log(`replay ${flags.tag}: catalog differences ${result.catalogDifferences.length}; hvSeeds.ts identical (comments ignored): ${result.hvSeedsWiringIdentical}; previewIsolation gate identical: ${result.previewGateIdentical}; tsc: ${String(result.tsc).split("\n")[0]}`);
  for (const d of result.catalogDifferences.slice(0, 20)) console.log(`  DIFF ${d}`);
  return ok ? 0 : 1;
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const { flags, rest } = parseArgs(argv);
  const abs = (p) => (typeof p === "string" ? resolve(p) : "");
  switch (command) {
    case "extract":
      return runner("extract", { TETO_KIT_IDS: String(flags.ids ?? ""), TETO_KIT_TRAIN: String(flags.train ?? "extracted"), TETO_KIT_TAG: String(flags.tag ?? "extracted"), TETO_KIT_LABEL: String(flags.label ?? "Extracted"), TETO_KIT_ISSUE: String(flags.issue ?? 780), TETO_KIT_OUT: abs(flags.out) }) ? 0 : 2;
    case "apply":
      if (!rest[0]) throw new Error("apply needs <spec.json>");
      return runner("apply", { TETO_KIT_SPEC: abs(rest[0]), TETO_KIT_DRY: flags["dry-run"] ? "1" : "", TETO_KIT_SKIP_GLYPH_DISPATCH: flags["skip-glyph-dispatch"] ? "1" : "", TETO_KIT_OUT: abs(flags.out) }) ? 0 : 2;
    case "scaffold":
      if (!rest[0] || !flags.out || !flags.tag || !flags.label) throw new Error("scaffold needs <approval-spec.json> --tag t24 --label \"Expansion Batch 24\" --out <impl-spec.json>");
      return runner("scaffold", { TETO_KIT_SPEC: abs(rest[0]), TETO_KIT_TAG: String(flags.tag), TETO_KIT_LABEL: String(flags.label), TETO_KIT_ISSUE: String(flags.issue ?? 780), TETO_KIT_OUT: abs(flags.out) }) ? 0 : 2;
    case "e2e":
      if (!rest[0] || !flags.out) throw new Error("e2e needs <spec.json> --out <e2e/name.spec.ts>");
      return runner("e2e", { TETO_KIT_SPEC: abs(rest[0]), TETO_KIT_OUT: abs(flags.out) }) ? 0 : 2;
    case "coverage":
      return runner("coverage", { TETO_KIT_OUT: abs(flags.out ?? "coverage.json") }) ? 0 : 2;
    case "replay":
      return replay(flags);
    case "freeze":
      return (await import("./freeze.mjs")).freeze(flags);
    case "mutation":
      return (await import("./mutation.mjs")).mutation(flags);
    case "pins":
      return (await import("./sweep.mjs")).pins(flags);
    case "sweep":
      return (await import("./sweep.mjs")).sweep(flags);
    case "plan":
      return (await import("./plan.mjs")).plan(rest[0], flags);
    case "claims":
      return (await import("./claims.mjs")).claims(flags);
    case "progress":
      return (await import("./progress.mjs")).progress(flags);
    default:
      console.error(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 21).join("\n"));
      return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (error) => {
    console.error(String(error?.message ?? error));
    process.exit(2);
  });
}
