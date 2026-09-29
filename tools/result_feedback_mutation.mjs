#!/usr/bin/env node
/**
 * Original Pizza Recovery P2: focused hand-rolled mutation test for the RESULT feedback hardening
 * (there is no Stryker in this repo). One targeted textual change per mutant, over the four files
 * P2 touched. A mutant is KILLED when the focused test files fail, SURVIVED when they still pass.
 * `equivalent` documents a mutant that cannot change behaviour. Every file is restored, also on
 * error / Ctrl-C.
 *
 * Usage: node tools/result_feedback_mutation.mjs [--out PATH]   (exit 1 on an unexpected survivor)
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outPath =
  outArg > -1
    ? resolve(process.argv[outArg + 1])
    : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P2_RESULT-FEEDBACK_Mutation.json");

const NM = "src/logic/discovery/nearMiss.ts";
const RNM = "src/state/resultNearMiss.ts";
const OC = "src/state/originalResultCopy.ts";
const RP = "src/components/ResultPanel.tsx";

/** [id, file, description, from, to, equivalentReason?] -- `from` must occur exactly once. */
const MUTANTS = [
  ["N01", NM, "collision skip removed", "if (colliding.has(identityKey(target))) continue; // unreachable: the matcher says AMBIGUOUS", ""],
  ["N02", NM, "collision detection never fires", "if (seen.has(key)) colliding.add(key);", ""],
  ["N03", NM, "identity key ignores the sauce base", "[...(t.sauceBase ?? [])].sort()", "[]"],
  ["N04", NM, "sauce step is always CHANGE", 'pizzaSauces.length === 0 ? "ADD" : sauceBase.length === 0 ? "REMOVE" : "CHANGE"', '"CHANGE"'],
  ["N05", NM, "sauce step ADD / REMOVE swapped", 'pizzaSauces.length === 0 ? "ADD" : sauceBase.length === 0 ? "REMOVE" : "CHANGE"', 'pizzaSauces.length === 0 ? "REMOVE" : sauceBase.length === 0 ? "ADD" : "CHANGE"'],
  ["N06", NM, "sauce step not returned", 'if (kind === "SAUCE_ONLY") return { kind, distance: best.d.total, sauceStep: best.d.sauceStep };', ""],
  ["N07", NM, "CLOSE window widened", 'd.total === 2 ? "CLOSE"', 'd.total <= 3 ? "CLOSE"'],
  ["N08", NM, "exact match no longer means no statement", "if (d.total === 0) return null;", ""],
  ["N09", NM, "identity key items not sorted", "[[...t.items].sort(),", "[[...t.items],", "Catalog items and the synthetic test catalogs are already sorted, so sorting here never changes a key."],
  ["R01", RNM, "no sauce-step wording (REMOVE reads as change-the-sauce)", 'nearMiss.kind === "SAUCE_ONLY" && nearMiss.sauceStep === "REMOVE"', "false"],
  ["R02", RNM, "REMOVE step reads as ADD_ONE", 'return { kind: "REMOVE_ONE", textJa: NEAR_MISS_COPY.REMOVE_ONE };', 'return { kind: "ADD_ONE", textJa: NEAR_MISS_COPY.ADD_ONE };'],
  ["R03", RNM, "generic FAR ignores the option", "(options.farGeneric ?? RESULT_FAR_GENERIC_ENABLED)", "true"],
  ["R04", RNM, "generic FAR ON in production", "export const RESULT_FAR_GENERIC_ENABLED = false;", "export const RESULT_FAR_GENERIC_ENABLED = true;"],
  ["R05", RNM, "a known pizza gets a FAR line", "if (known) return null;", ""],
  ["R06", RNM, "key-unused nudge dropped", 'if (nearMiss.keyUnused) return { kind: "FAR", textJa: NEAR_MISS_COPY.FAR_KEY_UNUSED };', ""],
  ["R07", RNM, "known pizza gets a d>1 line", "if (known && nearMiss.distance !== 1) return null;", ""],
  ["R08", RNM, "guided rounds not excluded", "!input.freeCook || ", ""],
  ["R09", RNM, "FAILED rounds not excluded", 'input.completion?.status === "FAILED"', "false"],
  ["C01", OC, "AMBIGUOUS copy diverges from ordinary", "AMBIGUOUS: ORDINARY_LEAD,", 'AMBIGUOUS: "この組み合わせは登録できないよ",'],
  ["C02", OC, "AMBIGUOUS kind not detected", 'if (discovery?.kind === "AMBIGUOUS") return "AMBIGUOUS";', ""],
  ["C03", OC, "INCOMPLETE_MATCH kind not detected", 'if (discovery?.kind === "INCOMPLETE_MATCH") return "INCOMPLETE_MATCH";', ""],
  ["C04", OC, "AMBIGUOUS decision flag flipped", "export const AMBIGUOUS_COPY_DECIDED = false;", "export const AMBIGUOUS_COPY_DECIDED = true;"],
  ["P01", RP, "ResultPanel ignores the kind", "ORIGINAL_LEAD_COPY[originalResultKind(discovery)]", "ORIGINAL_LEAD_COPY.ORDINARY"],
];

const TESTS = [
  "src/logic/discovery/nearMiss",
  "src/state/resultNearMiss",
  "src/state/originalResultCopy",
  "src/state/resultFeedback.gate",
  "src/components/ResultPanel",
];

function runTests() {
  const r = spawnSync("npx", ["vitest", "run", ...TESTS], { cwd: root, encoding: "utf8", env: { ...process.env, CI: "1" } });
  return r.status === 0;
}

const originals = new Map();
const read = (f) => {
  if (!originals.has(f)) originals.set(f, readFileSync(resolve(root, f), "utf8"));
  return originals.get(f);
};
const restore = () => {
  for (const [f, text] of originals) writeFileSync(resolve(root, f), text);
};
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});

const results = [];
try {
  for (const f of [NM, RNM, OC, RP]) read(f);
  if (!runTests()) throw new Error("baseline tests must pass before mutating");
  for (const [id, file, description, from, to, equivalentReason] of MUTANTS) {
    const original = read(file);
    const count = original.split(from).length - 1;
    if (count !== 1) {
      results.push({ id, file, description, status: "INVALID", detail: `pattern occurs ${count} times` });
      console.log(`${id} INVALID    ${description} (${count} matches)`);
      continue;
    }
    writeFileSync(resolve(root, file), original.replace(from, () => to));
    const passed = runTests();
    writeFileSync(resolve(root, file), original);
    const status = !passed ? "KILLED" : equivalentReason ? "EQUIVALENT" : "SURVIVED";
    results.push({ id, file, description, status, ...(equivalentReason && passed ? { equivalentReason } : {}) });
    console.log(`${id} ${status.padEnd(10)} ${description}`);
  }
} finally {
  restore();
}

const count = (s) => results.filter((r) => r.status === s).length;
const summary = {
  tests: TESTS,
  mutants: results.length,
  killed: count("KILLED"),
  equivalent: count("EQUIVALENT"),
  survived: count("SURVIVED"),
  invalid: count("INVALID"),
  mutationScore: results.length - count("EQUIVALENT") ? Number((count("KILLED") / (results.length - count("EQUIVALENT"))).toFixed(3)) : 0,
  results,
};
writeFileSync(outPath, JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify({ ...summary, results: undefined }));
process.exit(summary.survived || summary.invalid ? 1 : 0);
