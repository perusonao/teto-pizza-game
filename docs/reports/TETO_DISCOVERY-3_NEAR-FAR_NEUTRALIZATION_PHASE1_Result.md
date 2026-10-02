# Discovery 3.0 — Near/Far Neutralization Phase 1 — Result

- Base: `origin/main` `0303ea1ac330000ba5c641de73ce78cf32297fa8` (fresh fetch; no open PR/Issue duplicated this work).
- Authority: Owner Decision = Option B of `TETO_DISCOVERY-3_NEAR-FAR_AUTHORITY_FRESH_AUDIT.md`.

## Removed player-facing oracle
ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE / FAR key-unused ("新しく入荷した材料は使ってみた？") and the ALREADY_DISCOVERED d=1 line are no
longer produced for the player. `resultNearMiss` no longer reads the DISCOVERABLE pool, distance, tie-break winner or key material.
The pre-existing classifier stays internally (`nearMiss.ts`, `nearMissLine`, `legacyResultNearMiss`) with no production caller (gated by
tests); it is used only by the economy simulator and the walk/ladder unit tests.

## RESULT behaviour
Free Cooking, non-FAILED, outcome ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH → the single existing generic copy
`NEAR_MISS_FAR_GENERIC_COPY` (「🧪 別の組み合わせも試してみよう！」, kind `NEUTRAL`), whatever the pool. ALREADY_DISCOVERED, NEW_DISCOVERY,
FAILED and non-free rounds: no line (unchanged for the latter three). No new copy.

## Retained execution feedback
`SAUCE_THIN_ADVICE_JA` (`executionAdviceJa`) is untouched, still computed from the pizza only, and shown separately from the neutral line.

## Notebook behaviour
`recordTrialAttempt` stores `feedback: null` for every new record (attempt #n, sauce, toppings, duplicate/retry facts unchanged). It no
longer calls `resultNearMiss`; the sheet renders stored text only and never recomputes. No save migration (session-only; old in-memory
rows cannot exist across sessions). N2 diff not implemented.

## OPEN_POOL anti-leak
The line is a function of the outcome kind only: pool=1 with different hidden recipes, and pool=2+ with reordered ownership/inventory, give
byte-identical output; an empty pool gives the same line. Tie-break (`kind`/`keyUnused`) can no longer reach the player.

## Unchanged
Matcher, Discovery success condition, `recipeDiscoveryState`, Completion Gate, scoring, Dex, ladder, economy, save schema (no diff).

## Tests
- New `src/state/resultNearMiss.neutral.test.ts` (items 1–10: pool=1, pool=2+ order, d=1, d=2, sauce-only, FAR/key-unused, execution feedback, Notebook record, NEW/ALREADY flows, success unchanged).
- Updated: `resultNearMiss.test.ts` / `.p2.test.ts` (now pin `legacyResultNearMiss`), `oracleNeutralization.test.tsx`, `gameReducer.trialNotebook.test.ts`, `trialRecord.gate.test.ts`, `resultFeedback.gate.test.ts`; e2e expectations in `discovery-near-miss-result` and `original-result-duplicate-notice`.
- Local: `tsc --noEmit` clean, oxlint clean, full vitest 302 files / 5650 tests green. No CSS change → no Human Verification video; no local WebKit run (CI is authority).

## Deferred
N2 Trial Notebook diff, IP-2 Hint→Pantry, R6, No.27, 172-recipe production, Hint price, classifier S3+, CUT, Lunch Rush.
