# Research FAILED UX (Issue #472) — Result

Base: main `41efe27`. Scope: tests + one fixed sentence on the FAILED RESULT card. No judgement logic, inventory,
economy, save or Research Target change; Anti-Oracle Contract 2.1 kept; #393 (inert) and #468 / #469 untouched.

## What changed

| Area | Change |
|---|---|
| Copy | `RESEARCH_UX_COPY.failedKept` = 「使った材料の○×は残ったよ」 (`researchUxCopy.ts`). One string for every target, outcome and pool size. |
| UI | `ResultPanel` FAILED branch: the sentence (`data-testid="research-failed-kept"`) sits under the ○× panel. Small `.result-panel__research-kept` rule in `App.css`. |
| Condition | Shown only when `failedResearch` (Research label + rows) **and** the ○× panel draws at least one chip (`researchRowsHaveChips`). |
| Unit | `gameReducer.failedResearch.test.ts`: FAILED reason line is one of three fixed sentences for ingredients/raw, ingredients/burnt, empty/raw, empty/burnt; no `ingredientId` anywhere in `completion`; identical to a targetless Free Cook of the same pizza. New `ResultPanel.researchFailed.test.tsx`: presence/absence matrix, byte-identical note, no hidden recipe name / id on the card. |
| e2e | `research-failed-trial.spec.ts`: asserts the reason line, the note position under the panel and a text/DOM sweep for the hidden recipe; new test for the empty-pizza FAILED (no panel, no note). |

## Condition check (item 4)

The sentence is absent when no ○× is disclosed, which keeps the existing behaviour (empty pizza: no rows, no ledger, no
Notebook entry): empty pizza, a Research Target not valid at the round's start (rows null), a panel with no chips (no rows;
or only the 4+ topping cap note), no Research label (targetless FREE), and any non-FAILED card. Verified by unit and e2e.

Note (unchanged, not in scope): the empty-pizza FAILED card of a Research round shows no 「研究中」 line.

## Why the reason line cannot leak

Free Cook is gated against the recipe-free sentinel (`requiredIngredients: []`, `freeCook.ts` / `data/freeCook.ts`), so the
only reasons are `MISSING_REQUIRED_INGREDIENT` (empty pizza, no `ingredientId` -> 「材料が入っていません」), `UNDERBAKED` and
`OVERBAKED`. The new tests pin this structurally. The public Research label 「？？？ピザ（チキン）」 may name the unlock
ingredient (INV-B7), so the e2e sweep uses a hidden-recipe ingredient that is neither used nor the label (pesto).

## Verification

- `tsc -b` clean; `oxlint` 0 errors (pre-existing warnings only); full Vitest 382 files / 7011 passed, 1 skipped.
- e2e (Chromium, 390×844 and 360×800): `research-failed-trial`, `discovery-research-result`, `discovery-research-rows`,
  `research-ux-phase1`, `research-stable-identity`, `completion-gate-partial-quantity` — 30 passed.
- WebKit: not run locally (CI is the authority).

## Human Verification

Screenshots: `docs/reports/screenshots/research-failed-ux-472/` (before / after, 390×844 and 360×800; plus the empty-pizza
FAILED card).

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| research-failed-472-390x844.mp4 | 390×844 | 26.2 s | 0.43 MB | PASS (frames checked at the FAILED card and the empty-pizza card) |

Download: delivered directly in the session (not committed).

Video Verification: PASS

What to check in the video:
- FAILED Research trial (eggplant, raw bake): reason 「生焼けで提供できません」, the ○× panel, then 「使った材料の○×は残ったよ」 under it.
- 試作ノート opens and closes; 「もう一度試す」 works.
- Empty-pizza FAILED: 「材料が入っていません」, no ○× panel and no note.
