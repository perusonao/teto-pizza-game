/**
 * Train Kit (R-1): record the FROZEN BASELINE the composed test expectations start from.
 *
 * The expectation of every "how many / which step / which floor" test is  FROZEN BASELINE (+) the landed train specs  -- never a number read
 * from the code under test. The baseline is the shipped catalog at ONE historical commit, recorded once and committed
 * (src/logic/catalog/testSupport/frozenBaseline.json). It is history, not a measurement of the current build: re-recording it at a later
 * commit is a deliberate act (a reviewer sees the JSON diff) and is only needed if a shipped batch is changed after the fact.
 *
 *   node tools/train-kit/cli.mjs freeze --at 577dcfd~1 --out src/logic/catalog/testSupport/frozenBaseline.json
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { git, prepareTree, removeTree, runner } from "./cli.mjs";

/** dump (lib/extract.ts `catalogDump`) -> the compact, ordered baseline. Pure, so it is unit-tested. */
export function baselineFromDump(dump, commit) {
  const lateRecipeIds = new Set(dump.lateRecipeIds);
  const lateIngredientIds = new Set(dump.lateIngredientIds);
  const lateKeys = new Set(dump.lateLadder.map((s) => s.keyRecipeId));
  const ladder = dump.ladder.map((s) => ({ ingredientIds: s.ingredientIds, keyRecipeId: s.keyRecipeId, ...(s.starGates ? { starGates: s.starGates } : {}) }));
  return {
    _comment: "FROZEN BASELINE: the shipped catalog at `commit`, recorded by `node tools/train-kit/cli.mjs freeze`. History, not a measurement of the current build. Do not edit by hand.",
    commit,
    recipes: dump.recipes.map((r) => ({ id: r.id, credited: r.ladderCredit !== false, late: lateRecipeIds.has(r.id) })),
    ingredients: dump.ingredients.map((i) => ({ id: i.id, category: i.category, family: dump.families[i.id] ?? null, late: lateIngredientIds.has(i.id) })),
    ordinaryLadder: ladder.filter((s) => !lateKeys.has(s.keyRecipeId)),
    lateLadder: ladder.filter((s) => lateKeys.has(s.keyRecipeId)),
    floors: dump.floors,
    chapterSizes: dump.chapterSizes,
    lunchRushPool: dump.lunchRushPool,
  };
}

export function freeze(flags) {
  if (typeof flags.at !== "string" || typeof flags.out !== "string") throw new Error("freeze needs --at <commit> --out <file>");
  if (flags.at.startsWith("-")) throw new Error("--at must be a commit, not an option");
  const commit = git(["rev-parse", flags.at]);
  const work = mkdtempSync(join(tmpdir(), "train-kit-freeze-"));
  const tree = join(work, "tree");
  let baseline;
  try {
    prepareTree(commit, tree);
    if (!runner("dump", { TETO_KIT_OUT: join(work, "dump.json") }, tree, true)) throw new Error(`dump failed at ${commit}`);
    baseline = baselineFromDump(JSON.parse(readFileSync(join(work, "dump.json"), "utf8")), commit);
  } finally {
    removeTree(tree);
    rmSync(work, { recursive: true, force: true });
  }
  mkdirSync(dirname(resolve(flags.out)), { recursive: true });
  writeFileSync(resolve(flags.out), `${JSON.stringify(baseline, null, 1)}\n`);
  console.log(`${resolve(flags.out)}: ${baseline.recipes.length} recipes, ${baseline.ingredients.length} ingredients, ${baseline.ordinaryLadder.length} ordinary + ${baseline.lateLadder.length} late ladder steps, ${Object.keys(baseline.floors).length} floors, commit ${commit.slice(0, 8)}`);
  return 0;
}
