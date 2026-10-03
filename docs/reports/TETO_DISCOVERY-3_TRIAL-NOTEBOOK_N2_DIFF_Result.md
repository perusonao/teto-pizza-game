# Discovery 3.0 N2 — Trial Notebook Diff — Result

Base: `origin/main` `2cf7a5d75ff27e5725de543836c9c15da3c482d4` (PR #338 Near/Far Neutralization Phase 1 merged). Duplicate Gate: no open Issue/PR about a Trial Notebook diff.

## Diff spec
- Each notebook row (except the oldest displayed) shows `前回からの変更`: `＋ <added topping>`, `− <removed topping>`, and `ソース：<before> → <after>` only when the sauce set changed. Nothing is shown when nothing changed (no blank rows, no "変更なし").
- "前回" = the row displayed directly beneath (the distinct combination worked on just before this row's latest activity). Purely derived from the player's own rows in the existing newest-activity-first view; the model, `#n`, order and storage are unchanged.
- Code: `src/logic/discovery/trialNotebookDiff.ts` (pure; input = two `TrialCombination`s), rendered in `TrialNotebookSheet`.

## Duplicate behaviour
A retry keeps `#n`, `retryCount` and moves to the top (unchanged N1 rule). Its diff is against the distinct try beneath it (A, B, A → A vs B). The same combination can never be compared with itself, so no wrong diff appears; retrying the top row again changes nothing.

## Anti-leak
The diff module and sheet import no recipe / pool / hint / matcher / scoring module (pinned by test); the function receives only player combinations, so hidden recipe, candidate-pool order, Hint target and distance cannot influence it (test: same diff regardless of recorded feedback kind). Output is asserted free of 近づ/遠ざ/あと◯つ/正解/距離/類似/候補/Near/Far wording. Near/Far neutralization untouched. Session-only, reload-clear and save schema v2: no changes (no reducer/save files touched).

## Tests
`src/logic/discovery/trialNotebookDiff.test.tsx` (new); gate tests `trialNotebook.gate` and `resultFeedback.gate` extended to allow the diff helper. Focused + `src/state` + `src/logic/discovery` + sheet tests pass; `tsc -b` and lint clean.

## Human verification
390×844 screenshots: `docs/reports/screenshots/trial-notebook-n2-diff/{before,after}.png` (component harness render, not a full gameplay flow). The Human Verification video cannot be recorded/delivered from this cloud session; flagged for the Owner.
