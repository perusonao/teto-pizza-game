#!/usr/bin/env node
/**
 * Original Pizza Recovery P3-1: hand-rolled mutation test for src/logic/discovery/trialNotebook.ts.
 *
 * There is no Stryker in this repo, so each mutant is one targeted textual change. For every mutant
 * the Trial Notebook test files are run; a mutant is KILLED when they fail, SURVIVED when they still
 * pass. The original source is always restored (also on error / Ctrl-C).
 *
 * Usage: node tools/trial_notebook_mutation.mjs [--out PATH]
 * Exit code 1 when any mutant survives.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "src/logic/discovery/trialNotebook.ts");
const outArg = process.argv.indexOf("--out");
const outPath =
  outArg > -1
    ? resolve(process.argv[outArg + 1])
    : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-1_TRIAL-NOTEBOOK_Mutation.json");

const original = readFileSync(target, "utf8");

/**
 * [id, description, from, to, equivalentReason?] -- `from` must occur exactly once in the source.
 * `equivalentReason` documents a mutant that cannot change observable behaviour; such a mutant is reported
 * EQUIVALENT if it survives and does not fail the run.
 */
const MUTANTS = [
  ["T01", "retry: retryCount not incremented", "retryCount: known.retryCount + 1", "retryCount: known.retryCount"],
  ["T02", "retry: the attempt number changes", "const updated: IdentityRecord = { fp, number: known.number,", "const updated: IdentityRecord = { fp, number: notebook.nextNumber,"],
  ["T03", "NEW: the counter is not advanced", "nextNumber: number + 1", "nextNumber: number"],
  ["T04", "retry: identity keeps its old position (not newest activity)", "const identities = [...notebook.identities.slice(0, at), ...notebook.identities.slice(at + 1), updated];", "const identities = [...notebook.identities.slice(0, at), updated, ...notebook.identities.slice(at + 1)];"],
  ["T05", "identity limit off by one", "while (identities.length > notebook.limits.identity) {", "while (identities.length >= notebook.limits.identity) {"],
  ["T06", "eviction drops the newest identity instead of the oldest", "const evicted = identities[0].fp;\n      identities = identities.slice(1);", "const evicted = identities[identities.length - 1].fp;\n      identities = identities.slice(0, -1);"],
  ["T07", "eviction leaves the evicted identity's display row", "display = display.filter((r) => r.fp !== evicted);", "display = display;", "Defensive: display and identity order agree on the displayed rows, display is full whenever the identity index is (display <= identity), so the evicted row is always the last display row and the same insertion slices it off. The filter only keeps display ⊆ identities independent of that argument (trialNotebookViolations checks it in every fuzz step)."],
  ["T08", "display limit off by one (NEW)", "display = [{ ...row, number }, ...display].slice(0, notebook.limits.display);", "display = [{ ...row, number }, ...display].slice(0, notebook.limits.display + 1);"],
  ["T09", "display limit not applied (retry)", ".filter((r) => r.fp !== fp)].slice(0, notebook.limits.display);", ".filter((r) => r.fp !== fp)];"],
  ["T12", "retry keeps the stale feedback", "display = [{ ...row, number: known.number }, ...notebook.display.filter((r) => r.fp !== fp)]", "display = [{ ...(notebook.display.find((r) => r.fp === fp) ?? row), number: known.number }, ...notebook.display.filter((r) => r.fp !== fp)]"],
  ["T13", "retry does not move the row to the top", "display = [{ ...row, number: known.number }, ...notebook.display.filter((r) => r.fp !== fp)]", "display = [...notebook.display.filter((r) => r.fp !== fp), { ...row, number: known.number }]"],
  ["T14", "a rejected fingerprint is not rejected", "if (!parsed.ok) return rejected(notebook, parsed.reason);", ""],
  ["T15", "another version is reported as malformed", 'version !== null && version !== 1 ? "UNSUPPORTED_VERSION" : "MALFORMED"', '"MALFORMED"'],
  ["T16", "feedback: extra keys allowed", 'if (keys.length !== 2 || !keys.includes("kind") || !keys.includes("textJa")) return { ok: false };', 'if (!keys.includes("kind") || !keys.includes("textJa")) return { ok: false };'],
  ["T17", "feedback: any kind accepted", "const KIND_PATTERN = /^[A-Z][A-Z0-9_]{0,31}$/;", "const KIND_PATTERN = /^[\\s\\S]*$/;"],
  ["T18", "feedback: text length cap loosened", "textJa.length > MAX_FEEDBACK_TEXT)", "textJa.length > MAX_FEEDBACK_TEXT + 1000)"],
  ["T19", "feedback: empty text accepted", "textJa.length === 0 ||", ""],
  ["T20", "feedback: stored by reference, not copied", "return { ok: true, value: { kind, textJa } };", "return { ok: true, value: raw as ShownFeedback };"],
  ["T21", "view shares the combination arrays", "combination: { sauceBase: [...r.combination.sauceBase], ingredientSet: [...r.combination.ingredientSet] },", "combination: r.combination,"],
  ["T22", "lookup always reports a detail row", "hasDetail: notebook.display.some((r) => r.fp === parsed.fp) };", "hasDetail: true };"],
  ["T23", "view retry count always 0", "retries.get(r.fp) ?? 0", "0"],
  ["T24", "limits: display > identity accepted", "|| limits.display > limits.identity)", "|| false)"],
  ["T25", "limits: display not validated", "!isPositiveInteger(limits.display) ||", "false ||"],
  ["T26", "outcome: revived is always false", "const revived = !notebook.display.some((r) => r.fp === fp);", "const revived = false;"],
  ["T27", "outcome: duplicate reports the next number", 'outcome: { kind: "DUPLICATE", number: known.number,', 'outcome: { kind: "DUPLICATE", number: notebook.nextNumber,'],
  ["T28", "NEW row carries number 0", "display = [{ ...row, number }, ...display]", "display = [row, ...display]"],
  ["T29", "a rejected feedback is not rejected", 'if (!feedback.ok) return rejected(notebook, "INVALID_FEEDBACK");', ""],
  ["T10", "a retry no longer revives a row that left the display", "const display = [{ ...row, number: known.number }, ...notebook.display.filter((r) => r.fp !== fp)].slice(0, notebook.limits.display);", "const display = notebook.display.some((r) => r.fp === fp) ? [{ ...row, number: known.number }, ...notebook.display.filter((r) => r.fp !== fp)].slice(0, notebook.limits.display) : notebook.display;"],
  ["T11", "outcome: revived flag inverted", "const revived = !notebook.display.some((r) => r.fp === fp);", "const revived = notebook.display.some((r) => r.fp === fp);"],
  ["T30", "identity index stores fingerprint of a different attempt", "let identities = [...notebook.identities, { fp, number, retryCount: 0 }];", "let identities = [...notebook.identities, { fp, number, retryCount: 1 }];"],
];

function runTests() {
  const r = spawnSync("npx", ["vitest", "run", "src/logic/discovery/trialNotebook"], {
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
  target: "src/logic/discovery/trialNotebook.ts",
  tests: "src/logic/discovery/trialNotebook*.test.ts",
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
