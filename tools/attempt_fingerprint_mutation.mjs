#!/usr/bin/env node
/**
 * Original Pizza Recovery P1: hand-rolled mutation test for src/logic/discovery/attemptFingerprint.ts.
 *
 * There is no Stryker in this repo, so each mutant is one targeted textual change. For every mutant
 * the fingerprint test files are run; a mutant is KILLED when they fail, SURVIVED when they still
 * pass. The original source is always restored (also on error / Ctrl-C).
 *
 * Usage: node tools/attempt_fingerprint_mutation.mjs [--out PATH]
 * Exit code 1 when any mutant survives.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "src/logic/discovery/attemptFingerprint.ts");
const outArg = process.argv.indexOf("--out");
const outPath =
  outArg > -1
    ? resolve(process.argv[outArg + 1])
    : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P1_ATTEMPT-FINGERPRINT_Mutation.json");

const original = readFileSync(target, "utf8");

/**
 * [id, description, from, to, equivalentReason?] -- `from` must occur exactly once in the source.
 * `equivalentReason` documents a mutant that cannot change observable behaviour: the early guard it
 * removes is redundant with parse's final round-trip check (re-serialising the parts must reproduce
 * the input string), which rejects the same inputs. Such a mutant is reported EQUIVALENT if it
 * survives; it does not fail the run.
 */
const MUTANTS = [
  ["M01", "canonicalIds: drop the sort", "[...new Set(ids)].sort()", "[...new Set(ids)]"],
  ["M02", "canonicalIds: drop the de-duplication", "[...new Set(ids)].sort()", "[...ids].sort()"],
  ["M03", "serialize: sauceBase omitted", "[[...parts.sauceBase], [...parts.ingredientSet]]", "[[], [...parts.ingredientSet]]"],
  ["M04", "serialize: ingredientSet omitted", "[[...parts.sauceBase], [...parts.ingredientSet]]", "[[...parts.sauceBase], []]"],
  ["M05", "version constant bumped", "export const ATTEMPT_FINGERPRINT_VERSION = 1;", "export const ATTEMPT_FINGERPRINT_VERSION = 2;"],
  ["M06", "extension: UNAVAILABLE/FIXED axes leak in", 'axis.status === "OBSERVED" && !sameJson', "!sameJson"],
  ["M07", "extension: default-valued axes are included", 'axis.status === "OBSERVED" && !sameJson(axis.value, DEFAULT_IDENTITY_DIMENSIONS[key])', 'axis.status === "OBSERVED"'],
  ["M08", "extension: OBSERVED axes are never included", 'axis.status === "OBSERVED" && !sameJson', 'axis.status === "NEVER" && !sameJson'],
  ["M09", "serialize: empty extension is always written", "if (Object.keys(ordered).length > 0) payload.push(ordered);", "payload.push(ordered);"],
  ["M10", "serialize: extension key order follows insertion, not IDENTITY_DIMENSION_KEYS", "for (const key of IDENTITY_DIMENSION_KEYS) {\n    if (Object.prototype.hasOwnProperty.call(parts.ext, key)) ordered[key] = parts.ext[key];\n  }", "for (const key of Object.keys(parts.ext)) {\n    ordered[key] = (parts.ext as Record<string, unknown>)[key];\n  }"],
  ["M11", "OfSignature: sauceBase not canonicalised", "sauceBase: canonicalIds(signature.sauceBase.value),", "sauceBase: [...signature.sauceBase.value],"],
  ["M12", "OfSignature: ingredientSet not canonicalised", "ingredientSet: canonicalIds(signature.ingredientSet.value),", "ingredientSet: [...signature.ingredientSet.value],"],
  ["M13", "isSameAttempt inverted", "return attemptFingerprintOfSignature(a) === attemptFingerprintOfSignature(b);", "return attemptFingerprintOfSignature(a) !== attemptFingerprintOfSignature(b);"],
  ["M14", "version pattern accepts fp0", "/^fp([1-9][0-9]{0,5}):/", "/^fp([0-9][0-9]{0,5}):/"],
  ["M15", "version reader ignores the prefix", "return match ? Number(match[1]) : null;", "return Number(match?.[1] ?? 1);"],
  ["M16", "parse: version prefix not required", '!raw.startsWith(PREFIX)', "false", "Redundant with the round-trip check in parseAttemptFingerprint (re-serialising must reproduce the input)."],
  ["M17", "parse: canonical (sorted/unique) check removed", "if (!isCanonical(sauceBase) || !isCanonical(ingredientSet)) return null;", ""],
  ["M18", "parse: sauceBase-subset-of-set check removed", "if (!sauceBase.every((id) => ingredientSet.includes(id))) return null;", ""],
  ["M19", "parse: extension slot always rejected", "(payload.length !== 2 && payload.length !== 3)", "payload.length !== 2"],
  ["M20", "parse: any payload length accepted", "(payload.length !== 2 && payload.length !== 3)", "false", "Redundant with the round-trip check in parseAttemptFingerprint (re-serialising must reproduce the input)."],
  ["M21", "parse: unknown extension key accepted", "if (!(IDENTITY_DIMENSION_KEYS as readonly string[]).includes(key)) return null;", "", "Redundant with the round-trip check in parseAttemptFingerprint (re-serialising must reproduce the input)."],
  ["M22", "parse: default-valued extension accepted", "if (sameJson((ext as Record<string, unknown>)[key], DEFAULT_IDENTITY_DIMENSIONS[key as IdentityDimensionKey])) return null;", ""],
  ["M23", "parse: round-trip check removed", "return serialize(parts) === raw ? parts : null;", "return parts;"],
  ["M24", "parse: ext may be an array", "typeof ext !== \"object\" || ext === null || Array.isArray(ext)", 'typeof ext !== "object" || ext === null', "Redundant with the round-trip check in parseAttemptFingerprint (re-serialising must reproduce the input)."],
  ["M25", "parse: non-string ids accepted", "Array.isArray(value) && value.every((v) => typeof v === \"string\")", "Array.isArray(value)"],
  ["M26", "extension equality: compares by reference-ish (always different)", "return JSON.stringify(a) === JSON.stringify(b);", "return false;"],
];

function runTests() {
  const r = spawnSync("npx", ["vitest", "run", "src/logic/discovery/attemptFingerprint"], {
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
  target: "src/logic/discovery/attemptFingerprint.ts",
  tests: "src/logic/discovery/attemptFingerprint*.test.ts",
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
