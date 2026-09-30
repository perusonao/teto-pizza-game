#!/usr/bin/env node
/**
 * Original Pizza Recovery P3-2: hand-rolled mutation test for src/logic/discovery/discoveryMemo.ts.
 *
 * There is no Stryker in this repo, so each mutant is one targeted textual change. For every mutant
 * the Discovery Memo test files (unit, probe, boundary gate) are run; a mutant is KILLED when they fail, SURVIVED when they still
 * pass. The original source is always restored (also on error / Ctrl-C).
 *
 * Usage: node tools/discovery_memo_mutation.mjs [--out PATH]
 * Exit code 1 when any mutant survives.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "src/logic/discovery/discoveryMemo.ts");
const outArg = process.argv.indexOf("--out");
const outPath =
  outArg > -1
    ? resolve(process.argv[outArg + 1])
    : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_DISCOVERY-MEMO_Mutation.json");

const original = readFileSync(target, "utf8");

/**
 * [id, description, from, to, equivalentReason?] -- `from` must occur exactly once in the source.
 * `equivalentReason` documents a mutant that cannot change observable behaviour; such a mutant is reported
 * EQUIVALENT if it survives and does not fail the run.
 */
const MUTANTS = [
  ["M01", "card-state gate removed", "if (input.cardState !== \"DISCOVERABLE\") return null;", ""],
  ["M02", "flag gate removed", "if (input.hint5Enabled !== true) return null;", ""],
  ["M03", "presentation gate removed", "if (!isRecord(presentation)) return null;", ""],
  ["M04", "onboarding gate inverted", "if (presentation.onboarding !== false) return null;", "if (presentation.onboarding === true) return null;"],
  ["M05", "sauce may be NONE", "return kind !== \"sauce\" && ids.length === 0 ? { kind, status: \"NONE\" } : { kind, status: \"UNKNOWN\" };", "return ids.length === 0 ? { kind, status: \"NONE\" } : { kind, status: \"UNKNOWN\" };"],
  ["M06", "NONE with ids allowed", "return kind !== \"sauce\" && ids.length === 0 ?", "return kind !== \"sauce\" ?"],
  ["M07", "KNOWN with no ids allowed", "if (entry.none !== false || ids.length === 0) return", "if (entry.none !== false) return"],
  ["M08", "none flag not required to be false", "if (entry.none !== false || ids.length === 0) return", "if (ids.length === 0) return"],
  ["M09", "ingredient ids not validated", "!value.every(isId)", "false"],
  ["M10", "ingredient ids not de-duplicated", "return [...new Set(value)];", "return [...value];"],
  ["M11", "structure KNOWN without a text check", "const structureKnown = !!structureEntry && isText(structureEntry.lineJa);", "const structureKnown = !!structureEntry;"],
  ["M12", "families before STRUCTURE", "if (structureKnown && subEntries.length <= MAX_SUB_ROWS) {", "if (subEntries.length <= MAX_SUB_ROWS) {"],
  ["M13", "family not validated", "|| !DISCOVERY_MEMO_FAMILIES.includes(view.family)", ""],
  ["M14", "ordinal below 1 accepted", "(entry.ordinal as number) < 1 ||", ""],
  ["M15", "repeated ordinal accepted", "|| seen.has(entry.ordinal as number)", ""],
  ["M16", "fractional ordinal accepted", "!Number.isInteger(entry.ordinal) ||", ""],
  ["M17", "symbol not validated", "!isText(view.symbol) ||", ""],
  ["M18", "legacy names repeat shown facts", "const shown = new Set(fixed.flatMap((r) => (\"ingredientIds\" in r ? r.ingredientIds : [])));", "const shown = new Set<string>();"],
  ["M19", "legacy ids not validated", "const legacyIds = idList(legacy, MAX_LEGACY);", "const legacyIds = legacy as string[];"],
  ["M20", "complete without settled fixed rows", "const complete = completeText !== null && fixed.every(isSettled);", "const complete = completeText !== null;"],
  ["M21", "complete text not validated", "if (completeText !== null && !isText(completeText)) return null;", ""],
  ["M22", "completion flag never COMPLETE", "completion: complete ? \"COMPLETE\" : \"IN_PROGRESS\"", "completion: \"IN_PROGRESS\""],
  ["M23", "hasKnownFact always true", "hasKnownFact: rows.some((r, i) => i >= fixed.length || isSettled(r)),", "hasKnownFact: true,"],
  ["M24", "last board entry of a kind wins", "else if (!byKind.has(entry.kind)) byKind.set(entry.kind, entry);", "else byKind.set(entry.kind, entry);"],
  ["M25", "array accepted as a record", "typeof value === \"object\" && value !== null && !Array.isArray(value)", "typeof value === \"object\" && value !== null", "A record-shaped check is only reached for the input, the presentation and board entries; an array there fails the next guard (cardState / onboarding / kind must be a string), so the behaviour is identical."],
  ["M26", "family row cap removed", "subEntries.length <= MAX_SUB_ROWS) {", "true) {"],
  ["M27", "sauce row reads the cheese entry", "nameRow(\"sauce\", byKind.get(\"SAUCE\"))", "nameRow(\"sauce\", byKind.get(\"CHEESE\"))"],
  ["M28", "key topping row reads the sauce entry", "nameRow(\"keyTopping\", byKind.get(\"KEY_TOPPING\"))", "nameRow(\"keyTopping\", byKind.get(\"SAUCE\"))"],
  ["M29", "structure reads the cheese entry", "byKind.get(\"STRUCTURE\")", "byKind.get(\"CHEESE\")"],
  ["M30", "ids-per-row cap loosened", "const MAX_IDS_PER_ROW = 32;", "const MAX_IDS_PER_ROW = 3200;"],
  ["M31", "text cap loosened", "const MAX_TEXT = 200;", "const MAX_TEXT = 2000;"],
  ["M32", "legacy cap loosened", "const MAX_LEGACY = 256;", "const MAX_LEGACY = 25600;"],
  ["M33", "UNKNOWN counts as settled", "return \"status\" in row && row.status !== \"UNKNOWN\";", "return \"status\" in row;"],
  ["M34", "family row copies the ordinal only (class view dropped)", "family: view.family, symbol: view.symbol, labelJa: view.labelJa, lineJa: view.lineJa }", "family: view.family, symbol: \"\", labelJa: \"\", lineJa: \"\" }"],
  ["G01", "BOUNDARY: a recipe module value import is added", "import type { Hint5Presentation } from \"./hint5Ladder\";", "import { RECIPES } from \"../../data/recipes\";\nimport type { Hint5Presentation } from \"./hint5Ladder\";"],
  ["G02", "BOUNDARY: the next-rung offer is read", "const board = presentation.board;", "const board = presentation.board; const leakedNext = presentation.next; void leakedNext;"],
  ["G03", "BOUNDARY: a recipe id input is added", "  hint5Enabled: boolean;", "  hint5Enabled: boolean;\n  recipeId: string;"],
  ["G04", "BOUNDARY: the Hint 5.0 type import becomes a value import", "import type { Hint5Presentation } from \"./hint5Ladder\";", "import { hint5Presentation, type Hint5Presentation } from \"./hint5Ladder\";"],
  ["G05", "BOUNDARY: a Trial Notebook dependency is added", "import type { RecipeDiscoveryState } from \"../../state/recipeDiscoveryState\";", "import type { RecipeDiscoveryState } from \"../../state/recipeDiscoveryState\";\nimport \"./trialNotebook\";"],
  ["G06", "BOUNDARY: a new row kind (candidate) is added", "| { kind: \"complete\"; lineJa: string };", "| { kind: \"complete\"; lineJa: string }\n  | { kind: \"candidate\"; ingredientId: string };"],
];

function runTests() {
  const r = spawnSync("npx", ["vitest", "run", "src/logic/discovery/discoveryMemo"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
  return r.status === 0;
}

const restore = () => writeFileSync(target, original);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});

const results = [];
try {
  if (!runTests()) throw new Error("baseline tests must pass before mutating");
  for (const [id, description, from, to, equivalentReason] of MUTANTS) {
    const count = original.split(from).length - 1;
    if (count !== 1) {
      results.push({ id, description, status: "INVALID", detail: `pattern occurs ${count} times` });
      continue;
    }
    writeFileSync(target, original.replace(from, () => to));
    const passed = runTests();
    const status = !passed ? "KILLED" : equivalentReason ? "EQUIVALENT" : "SURVIVED";
    results.push({ id, description, status, ...(equivalentReason && passed ? { equivalentReason } : {}) });
    console.log(`${id} ${status.padEnd(10)} ${description}`);
  }
} finally {
  restore();
}

const killed = results.filter((r) => r.status === "KILLED").length;
const survived = results.filter((r) => r.status === "SURVIVED");
const equivalent = results.filter((r) => r.status === "EQUIVALENT").length;
const invalid = results.filter((r) => r.status === "INVALID");
const summary = {
  target: "src/logic/discovery/discoveryMemo.ts",
  tests: "src/logic/discovery/discoveryMemo*.test.ts",
  mutants: results.length,
  killed,
  equivalent,
  survived: survived.length,
  invalid: invalid.length,
  mutationScore: results.length - equivalent ? Number((killed / (results.length - equivalent)).toFixed(3)) : 0, // killed / non-equivalent
  results,
};
writeFileSync(outPath, JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify({ ...summary, results: undefined }));
process.exit(survived.length || invalid.length ? 1 : 0);
