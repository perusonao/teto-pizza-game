#!/usr/bin/env node
/**
 * Original Pizza Recovery P3-3b: hand-rolled mutation test for the RESULT duplicate notice
 * (ResultPanel / GameScreen / originalResultCopy). No Stryker in this repo, so each mutant is one
 * targeted textual change (one or more [from, to] pairs in one file). For every mutant the wiring tests run;
 * KILLED = they fail, SURVIVED = they pass. Every touched file is restored afterwards (also on error / Ctrl-C).
 *
 * Usage: node tools/duplicate_notice_mutation.mjs [--out PATH]      Exit code 1 when any mutant survives.
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
    : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-3b_DUPLICATE-NOTICE_Mutation.json");

const PANEL = "src/components/ResultPanel.tsx";
const SCREEN = "src/screens/GameScreen.tsx";
const COPY = "src/state/originalResultCopy.ts";
const FILES = [PANEL, SCREEN, COPY];
const originals = new Map(FILES.map((f) => [f, readFileSync(resolve(root, f), "utf8")]));

const RELAY = 'trialNoticeNumber={state.freeCook && state.lastTrialAttempt?.kind === "DUPLICATE" ? state.lastTrialAttempt.number : null}';
const NOTICE_P = '{freeCook && trialNoticeText && <p className="original-pizza__trial-notice">{trialNoticeText}</p>}';
const HINT_ROW = "{freeCook && hintRow(nearMiss, true)}";
const NOTE = '<p className="original-pizza__note">';

/** [id, description, file, [[from, to], ...], equivalentReason?] -- every `from` must occur exactly once. */
const MUTANTS = [
  ["N01", "the notice is always shown (falls back to #1 without a record result)", PANEL, [[NOTICE_P, '{freeCook && <p className="original-pizza__trial-notice">{trialNoticeText ?? duplicateTrialNoticeJa(1)}</p>}']]],
  ["N02", "the shown number is off by one", SCREEN, [["state.lastTrialAttempt.number : null}", "state.lastTrialAttempt.number + 1 : null}"]]],
  ["N03", "a NEW attempt also shows the notice", SCREEN, [['state.freeCook && state.lastTrialAttempt?.kind === "DUPLICATE" ?', "state.freeCook && state.lastTrialAttempt ?"]]],
  ["N04", "the notice ignores the free-cook guard in GameScreen", SCREEN, [['state.freeCook && state.lastTrialAttempt?.kind === "DUPLICATE" ?', 'state.lastTrialAttempt?.kind === "DUPLICATE" ?']]],
  ["N05", "the notice ignores the free-cook guard in the panel", PANEL, [[NOTICE_P, '{trialNoticeText && <p className="original-pizza__trial-notice">{trialNoticeText}</p>}']]],
  ["N06", "the number is re-derived from the notebook at render time", SCREEN, [[RELAY, 'trialNoticeNumber={state.freeCook && state.lastTrialAttempt?.kind === "DUPLICATE" ? state.trialNotebook.nextNumber - 1 : null}']]],
  ["N07", "the retry count appears in the copy", COPY, [["（試作#${number}）", "（試作#${number}・${number}回目）"]]],
  ["N08", "the copy claims the same result", COPY, [["前にも同じ材料の組み合わせで作ったよ", "前にも同じ結果で作ったよ"]]],
  ["N09", "attempt number 0 is accepted", COPY, [["|| number < 1) return null;", "|| number < 0) return null;"]]],
  ["N10", "a non-integer number is accepted", COPY, [["!Number.isInteger(number) ||", ""]]],
  ["N11", "the notice gets a live region", PANEL, [[NOTICE_P, '{freeCook && trialNoticeText && <p className="original-pizza__trial-notice" aria-live="polite">{trialNoticeText}</p>}']]],
  ["N12", "the notice gets a status role", PANEL, [[NOTICE_P, '{freeCook && trialNoticeText && <p className="original-pizza__trial-notice" role="status">{trialNoticeText}</p>}']]],
  ["N13", "the notice is placed before the P2 row", PANEL, [[HINT_ROW + "\n        " + NOTICE_P, NOTICE_P + "\n        " + HINT_ROW]]],
  ["N14", "the notice is placed after the note", PANEL, [[NOTICE_P + "\n        " + NOTE + "\n          図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。\n        </p>", NOTE + "\n          図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。\n        </p>\n        " + NOTICE_P]]],
  ["N15", "the notice also renders on the known-pizza card", PANEL, [['{freeCookMatch === "ALREADY_DISCOVERED" && nearMiss && hintRow(nearMiss, true)}', '{freeCookMatch === "ALREADY_DISCOVERED" && nearMiss && hintRow(nearMiss, true)}\n      {freeCook && trialNoticeText && <p className="original-pizza__trial-notice">{trialNoticeText}</p>}']]],
  ["N16", "the panel learns about the notebook", PANEL, [['import type { ScoreBreakdown } from "../logic/scoring";', '// notebook\nimport type { ScoreBreakdown } from "../logic/scoring";']]],
  ["N17", "GameScreen reads the notebook", SCREEN, [[RELAY, RELAY + "\n          data-notebook={String(state.trialNotebook)}"]]],
  ["N18", "the notice is computed with a clock / randomness", PANEL, [['const trialNoticeText = duplicateTrialNoticeJa(trialNoticeNumber);', 'const trialNoticeText = Math.random() > 2 ? null : duplicateTrialNoticeJa(trialNoticeNumber);']]],
  ["N19", "the P2 row text is changed by the notice", PANEL, [['<p className="result-near-miss__text" aria-live="polite">\n            {line.textJa}', '<p className="result-near-miss__text" aria-live="polite">\n            {line.textJa}{trialNoticeNumber ? "！" : ""}']]],
  ["N20", "the notice is rendered inside a second paragraph of the P2 live region", PANEL, [['<div className="result-near-miss">', '<div className="result-near-miss" aria-live="polite">']]],
];

const TESTS = [
  "src/screens/GameScreen.duplicateNotice",
  "src/state/duplicateTrialNotice",
  "src/state/trialRecord.gate",
  "src/logic/discovery/trialNotebook.gate",
  "src/state/resultFeedback.gate",
  "src/components/ResultPanel",
  "src/components/FreeCook.ui",
];

function runTests() {
  const r = spawnSync("npx", ["vitest", "run", ...TESTS], { cwd: root, encoding: "utf8", env: { ...process.env, CI: "1" } });
  return r.status === 0;
}

const restore = () => {
  for (const [f, text] of originals) writeFileSync(resolve(root, f), text);
};
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});

const results = [];
try {
  if (!runTests()) throw new Error("baseline tests must pass before mutating");
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(",")) : null;
  for (const [id, description, file, pairs, equivalentReason] of MUTANTS) {
    if (only && !only.has(id)) continue;
    let text = originals.get(file);
    const all = pairs;
    let invalid = null;
    for (const [from, to] of all) {
      const count = text.split(from).length - 1;
      if (count !== 1) {
        invalid = `pattern occurs ${count} times: ${from.slice(0, 60)}`;
        break;
      }
      text = text.replace(from, () => to);
    }
    if (invalid) {
      results.push({ id, description, status: "INVALID", detail: invalid });
      console.log(`${id} INVALID    ${invalid}`);
      continue;
    }
    writeFileSync(resolve(root, file), text);
    const passed = runTests();
    restore();
    const status = !passed ? "KILLED" : equivalentReason ? "EQUIVALENT" : "SURVIVED";
    results.push({ id, description, file, status, ...(equivalentReason && passed ? { equivalentReason } : {}) });
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
  target: [PANEL, SCREEN, COPY],
  tests: TESTS,
  mutants: results.length,
  killed,
  equivalent,
  survived: survived.length,
  invalid: invalid.length,
  mutationScore: results.length - equivalent ? Number((killed / (results.length - equivalent)).toFixed(3)) : 0,
  results,
};
writeFileSync(outPath, JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify({ ...summary, results: undefined }));
process.exit(survived.length || invalid.length ? 1 : 0);
