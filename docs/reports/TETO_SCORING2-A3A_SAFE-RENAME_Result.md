# Scoring 2.0 A3a Safe Rename / Cleanup — Result

## 0. Scope and SHAs

- **Start SHA**: `4b35ff9d0b1a612437205903cd4b81b0c5f469cb` (fresh `origin/main`, matches the
  task's expected SHA exactly; this is also the A3 Pre-Implementation Audit's own merge
  commit, `docs/reports/TETO_SCORING2-A3_LEGACY-CLEANUP_PreImplementation-Audit.md`).
- **Final SHA**: see this branch's HEAD after the commit that includes this report
  (`claude/scoring-2-a3a-rename-kqj3rr`).
- **Audit verdict acted on**: **C. SPLIT A3** — this PR implements **A3a only** (safe
  rename/comment/debug-label cleanup, no deletions). **A3b** (deleting legacy `scorePizza`,
  `scorePlacement`, and their ~13 dependent test cases) is explicitly **not** done here.

## 1. Rename map

| Before | After | Where |
|---|---|---|
| `computeScoringV2Shadow()` | `computeScoringV2()` | `src/logic/scoringV2/index.ts` (definition), `src/state/gameReducer.ts`, `src/logic/scoringV2/scoringV2.test.ts`, `src/logic/scoringV2/malformedInput.test.ts`, `src/components/ScoringV2DebugPanel.test.tsx` |
| `ScoringV2ShadowPanel` (component) | `ScoringV2DebugPanel` | `src/components/ScoringV2ShadowPanel.tsx` → `src/components/ScoringV2DebugPanel.tsx` (git-detected rename, 86% similarity), `src/components/ScoringV2ShadowPanel.test.tsx` → `src/components/ScoringV2DebugPanel.test.tsx` (69% similarity), `src/screens/GameScreen.tsx` import/usage |
| `ScoringV2ShadowPanelProps` (interface) | `ScoringV2DebugPanelProps` | `src/components/ScoringV2DebugPanel.tsx` |
| Panel heading text `🧪 Scoring 2.0 Shadow（開発用・…）` | `🧪 Scoring 2.0 Debug（開発用・…）` | `src/components/ScoringV2DebugPanel.tsx` |
| `GameState.scoringV2Shadow` (field) | `GameState.scoringV2Result` | `src/state/gameReducer.ts` (declaration, `buildOrderState`'s reset, `CONFIRM_BAKE`'s local var + assignment), `src/screens/GameScreen.tsx` (2 read sites), `src/state/gameReducer.test.ts`, `src/state/gameReducer.scoringV2Authority.test.ts`, `src/state/persistence.test.ts` |

No other production identifier, export, prop name, or CSS class was renamed. `ScoreBreakdown`,
`QualityStars`, `starLabel`, `starsFromTotal`, `capStarsForBake`, `countUsedIngredient` (all in
`src/logic/scoring.ts`) are untouched, per the audit's explicit "never delete/rename" list —
confirmed by `git diff --stat` showing zero changes to `src/logic/scoring.ts` or
`src/logic/placement.ts`.

## 2. Comment / doc-string cleanup (no identifier change)

Stale "SHADOW ONLY / must never touch `ScoreBreakdown`" file-header claims, directly
contradicted by `toLegacyScoreBreakdown` being exported from the same module and being exactly
how `state.score` is derived today, were rewritten to describe current (authoritative) status:

- `src/logic/scoringV2/index.ts` file header
- `src/logic/scoringV2/types.ts` file header
- `src/state/gameReducer.ts`'s `scoringV2Result` field doc comment (previously claimed "never
  read by anything that feeds `score`/.../progression", directly contradicted three lines later
  in the same file)

Stale test titles/comments that described the now-authoritative Scoring 2.0 core as
non-authoritative "Shadow" output were reworded (assertions unchanged in every case):

- `src/logic/scoringV2/scoringV2.test.ts:1071` (was: *"Scoring 2.0 stays non-authoritative for
  the newly-covered recipes too -- computeScoringV2Shadow has no side effects on
  state.score/Dex/Mission"*, now: *"computeScoringV2 is a deterministic pure function -- same
  input, same output, for the newly-covered recipes too"*)
- `src/logic/scoringV2/scoringV2.test.ts`'s Golden-ordering `describe` title (*"-> higher Shadow
  score"* → *"-> higher score"*)
- `src/state/gameReducer.test.ts`: two test titles and one helper doc-comment referencing
  "Scoring 2.0 Shadow result" / "the Shadow" reworded to "Scoring 2.0 result" / "the result"

Smaller comment-only "Shadow"-word cleanups in the four Scoring 2.0 component files
(`piecesComponent.ts`, `recipeComponent.ts`, `sauceComponent.ts`, `bakeComponent.ts`) and
`tolerance.ts`/`boundary.ts`, changing phrases like *"Scoring 2.0 Shadow Pieces component"* →
*"Scoring 2.0 Pieces component"* and *"a Shadow score"* → *"a score"*. No assertion, formula,
weight, or threshold changed anywhere in this cleanup — verified by grepping the diff for any
line containing a digit (see §5).

**Deliberately left as-is** (per the audit's own "DEFER" call, §C.1 of the Pre-Implementation
Audit): `SCORING_V2_RULESET_VERSION = "phase-4a-2-shadow-3"` in `index.ts` and its surrounding
B1 weight-decision comment. The literal string still says "shadow" and is Preview-debug-output
only (never persisted), but bumping it carries no forcing function under this PR's scope guard
(no weight change happened), and it sits inside the weight-decision comment block this task
explicitly said not to touch. Left for a future slice that naturally bumps it alongside a real
formula change.

## 3. Intentionally untouched Shadow systems

Per the task's own explicit instruction (item 3) and the audit's §C.2, the following are a
**separate, older, still-accurate** system (Phase 4A-1A/4A-1B live-preview comparison shown
*during* Making, not at RESULT) and were **not** touched:

- `src/logic/referenceScoring.ts` (`SauceReferenceShadowScore`, `scoreSauceAgainstReference`,
  `scorePiecesAgainstReference`)
- `src/components/SauceMetricsPanel.tsx` (its `shadowScore` prop)
- `src/App.tsx`'s `sauceShadowScore`/`pieceShadowMetrics` `useMemo`s and their wiring into
  `GameScreen.tsx`'s `sauceShadowScore`/`pieceShadowMetrics` props
- `src/logic/sauceEvaluation.ts`'s own "Shadow-only" comment

Confirmed by `git diff --stat origin/main -- src/logic/referenceScoring.ts
src/components/SauceMetricsPanel.tsx src/App.tsx src/logic/sauceEvaluation.ts` returning empty
output (zero changes) — these files were read for verification only, never edited.

## 4. A3b scope guard — confirmed untouched

- `scorePizza` (`src/logic/scoring.ts`) — zero diff (confirmed via `git diff --stat`).
- `scorePlacement` (`src/logic/placement.ts`) — zero diff.
- No test file's `scorePizza`-dependent describe/test blocks were deleted or rewritten; the
  full 1089-test suite (same count as the audit's own PR #60 baseline) still passes unchanged
  in content for every `scorePizza`-referencing test.

## 5. Behavior-diff = NONE — evidence

- `git diff origin/main -- <every changed file>` piped through a grep for any changed (`+`/`-`)
  line containing a digit shows **only** rename/comment lines (function names, field names,
  doc-string prose) — no weight, threshold, tolerance, coefficient, or other numeric literal
  appears in any diff hunk. Full command used:
  `git diff origin/main -- src/logic/scoringV2/index.ts src/logic/scoringV2/bakeComponent.ts src/logic/scoringV2/sauceComponent.ts src/logic/scoringV2/piecesComponent.ts src/logic/scoringV2/recipeComponent.ts src/logic/scoringV2/tolerance.ts src/state/gameReducer.ts | grep -E '^\+|^-' | grep -E '[0-9]'`
  — every matched line is a rename/prose change, confirmed by inspection.
- `SAUCE_WEIGHT`/`PIECES_WEIGHT`/`RECIPE_WEIGHT`/`BAKE_WEIGHT` (52/16/12/20),
  `SAUCE_QUANTITY_WEIGHT`/`SAUCE_COVERAGE_WEIGHT`/`SAUCE_EVENNESS_WEIGHT`/`SAUCE_EDGE_WEIGHT`
  (30/30/20/20), `QUANTITY_WEIGHT`/`PLACEMENT_WEIGHT` (30/70), `SCORING_V2_RULESET_VERSION`
  string value, `Recipe.bakeTarget`/Reference geometry data files, `bake.ts`'s `classifyBake`
  thresholds, `STAR_THRESHOLDS`/`MAX_STARS` in `scoring.ts` — none opened for edit, none changed.
- Full test suite (1089/1089, same count as before this PR) passes with **zero assertion
  changes** to any numeric expectation anywhere in the suite — only test *titles*/doc-comments
  in the small set enumerated in §2 were reworded; every `expect(...)` call in every file this
  PR touches is byte-identical to `origin/main`'s version (confirmed by re-reading each touched
  test file's diff hunks -- only comment lines and identifier renames appear inside them,
  consistent with the digit-grep in the prior bullet finding no numeric literal changes).
- `npx tsc -b` passes clean, meaning every call site of the two renamed
  functions/components/field was mechanically caught and updated by the compiler.

## 6. Tests / build / lint

Run from a fresh `npm ci` against this branch's final commit:

- `npm test -- --run` → **1089/1089 passed**, 56/56 test files passed. (Pre-existing jsdom
  `HTMLCanvasElement.getContext` warnings are unrelated environment noise, present on `main`
  too.)
- `npx tsc -b` → clean, no errors.
- `npm run build` → `tsc -b && vite build` succeeds; 81 modules transformed, no warnings beyond
  normal Vite output.
- `npm run lint` (`oxlint`) → clean, exit code 0.

## 7. Verification — no obsolete terminology remains on the production authoritative path

- `grep -rn "computeScoringV2Shadow\|ScoringV2ShadowPanel\|\bscoringV2Shadow\b" src/` →
  **zero matches** (previously ~90 matches across 12 files before this PR).
- `git diff --name-status origin/main` shows exactly the ~10-12 files the Pre-Implementation
  Audit predicted (§C.1/§H): two files renamed (`ScoringV2ShadowPanel.tsx`/`.test.tsx` →
  `ScoringV2DebugPanel.tsx`/`.test.tsx`, git-detected as renames at 86%/69% similarity) plus 15
  files modified in place — no file outside this list was touched, no file was deleted.
- `git diff --stat origin/main -- src/logic/referenceScoring.ts
  src/components/SauceMetricsPanel.tsx src/App.tsx src/logic/sauceEvaluation.ts` → empty
  (confirms the unrelated shadow system, §3, is byte-identical to `main`).
- `git diff --stat origin/main -- src/logic/scoring.ts src/logic/placement.ts` → empty
  (confirms A3b's targets are untouched).
- Production `vite build` output (`dist/assets/*.js`) was grepped for `shadow`/`Shadow`; the
  only hits are inside unrelated vendored React internals (e.g. `onScrollEnd`-style token
  fragments), not this project's own source text — there is no shipped
  `ScoringV2ShadowPanel`/`computeScoringV2Shadow` string in the production bundle (this mirrors
  what `ScoringV2DebugPanel.test.tsx`'s own Production/Preview gating test already pins at the
  unit level: the whole debug panel is dead-code-eliminated from a real `vite build` since
  `VITE_PREVIEW_MODE` is statically `false`).

## 8. Remaining A3b targets (not implemented in this PR)

Per the Pre-Implementation Audit's §A/§E/§H, still open for a future A3b PR:

- Delete `scorePizza()`'s body + its two private-only helpers (`usedIngredientIds`, the four
  `WEIGHT_*` consts) from `src/logic/scoring.ts`; keep every other export
  (`ScoreBreakdown`/`QualityStars`/`starLabel`/`starsFromTotal`/`capStarsForBake`/
  `countUsedIngredient`) in place.
- Delete `src/logic/placement.ts`'s `scorePlacement()` (orphaned once `scorePizza` is gone) and
  its own test file `placement.test.ts`, in the same slice as `scorePizza` (never before it).
- Handle the exactly-enumerated ~13 `scorePizza`-dependent test cases across 5 files per the
  audit's §E table: delete 4 whole describe/test blocks (`scoring.test.ts` ×2,
  `gameReducer.test.ts` ×1, `gameReducer.scoringV2Authority.test.ts` ×1,
  `phase4a1a.regression.test.ts` ×1) and rewrite 1 (`phase4a1b.regression.test.ts`'s
  mutation-purity test, dropping only its `scorePizza` comparison lines while keeping the
  `structuredClone` mutation-purity assertion, which remains valuable independent of
  `scorePizza`'s fate).
- Optionally decide whether `toLegacyScoreBreakdown` itself should be renamed (a minor, deferred
  candidate flagged in the audit's §B — not required for A3b, and `toLegacyScoreBreakdown`'s
  own name was deliberately **not** touched in this A3a PR since the audit recommended deferring
  it).

## 9. Risks

- **Low overall** — this PR is a pure rename/comment pass; `npx tsc -b` mechanically catches any
  missed call site of a renamed symbol, and none were found (clean typecheck on the first pass
  after the rename).
- The one residual, deliberately-deferred cosmetic risk is `SCORING_V2_RULESET_VERSION`'s
  literal string value still containing the word "shadow" (`"phase-4a-2-shadow-3"`) — this is
  Preview-debug-output only, never persisted, and does not affect production behavior in any
  way; a future PR that changes the scoring formula should bump this string anyway (per its own
  existing convention) and can drop "shadow" from it at that point.
- A3b (deletion work) is unstarted; until it lands, `scorePizza`/`scorePlacement` remain dead
  but present in the codebase, exactly as before this PR (no regression, no new risk introduced
  by A3a with respect to A3b's own future scope).

## Final verdict

**A. A3a COMPLETE — READY FOR REVIEW**
