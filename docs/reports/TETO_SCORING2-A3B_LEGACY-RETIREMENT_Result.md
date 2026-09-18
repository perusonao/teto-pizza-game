# Scoring 2.0 A3b Legacy Retirement — Result

## 0. Scope and SHAs

- **Start SHA**: `12f4a4d9f3496f67679ffa8ca2c84542050fd298` (fresh `origin/main`, matches the
  task's expected SHA exactly; this is also A3a's own merge commit — `git fetch origin main &&
  git rev-parse origin/main` confirmed before any change; working tree confirmed clean before and
  after).
- **A3a confirmed in `main` by code, not just by report text**: `computeScoringV2Shadow` /
  `ScoringV2ShadowPanel` / `scoringV2Shadow` — zero matches anywhere in `src/`.
  `computeScoringV2` (renamed) is the function `gameReducer.ts`'s `CONFIRM_BAKE` calls, and
  `GameState.scoringV2Result` (renamed from `scoringV2Shadow`) is the field it's stored on —
  both re-confirmed by direct `grep`/read of `src/state/gameReducer.ts` before implementation.
- **Final SHA**: see this branch's HEAD after the commit that includes this report
  (`claude/scoring-a3b-legacy-retirement-cjq9vk`).
- **Audit verdict acted on**: **C. SPLIT A3**
  (`docs/reports/TETO_SCORING2-A3_LEGACY-CLEANUP_PreImplementation-Audit.md`) — this PR implements
  **A3b only**: deletion of legacy `scorePizza`/`scorePlacement` and their exactly-bounded
  dependent test surface. No scoring balance, weight, coefficient, threshold, or new feature is
  touched.

## 1. Deleted functions

Re-verified with a fresh, full-text search across `src/` immediately before implementation (not
merely cited from the A3 audit):

| Symbol | File | Production call sites found | Action |
|---|---|---|---|
| `scorePizza()` | `src/logic/scoring.ts` | **0** (only the definition itself, plus comment-only mentions in 9 other files describing historical lineage — see §4) | **Deleted** (function body + its own doc comment) |
| `usedIngredientIds()` (private helper, used only inside `scorePizza`'s own body) | `src/logic/scoring.ts` | 0 (private-only) | **Deleted** |
| `WEIGHT_MATCH` / `WEIGHT_INGREDIENT` / `WEIGHT_PLACEMENT` / `WEIGHT_BAKE` (private consts, used only inside `scorePizza`'s own body) | `src/logic/scoring.ts` | 0 (private-only) | **Deleted** |
| `scorePlacement()` | `src/logic/placement.ts` | **0** (its only caller was `scorePizza`'s own body, itself just deleted) | **Deleted**, in the same slice as `scorePizza`, after confirming `scorePizza`'s deletion first (per the audit's explicit ordering) |
| `PLACEMENT_CONTAINMENT_WEIGHT` / `PLACEMENT_DISTRIBUTION_WEIGHT` / `CLUSTER_DISTANCE` / `SPREAD_DISTANCE` / `DISTRIBUTION_FLOOR` / `averagePairwiseDistance()` / `clamp01()` | `src/logic/placement.ts` | 0 (all private/internal to `scorePlacement`, re-confirmed via grep — nothing outside this file imported them) | **Deleted** (whole file removed — see §2) |

## 2. `placement.ts` — whole-file deletion, and why that's consistent with the "never delete
   scoring.ts/placement.ts wholesale" guard

The task's own instruction is: judge at **function** granularity, don't take a shortcut and
delete `scoring.ts`/`placement.ts` as files just because *a* function inside them is legacy. That
guard is exactly why `scoring.ts` was **not** deleted — it has six other exports
(`ScoreBreakdown`, `QualityStars`, `starLabel`, `starsFromTotal`, `capStarsForBake`,
`countUsedIngredient`) that are genuinely still load-bearing for the authoritative Scoring 2.0
path today, and all six remain untouched, in place, in the same file (§3).

`placement.ts` is a different case, re-verified independently for this PR (not assumed from the
audit): a fresh grep for every export of `placement.ts`
(`scorePlacement`/`PLACEMENT_CONTAINMENT_WEIGHT`/`PLACEMENT_DISTRIBUTION_WEIGHT`) across all of
`src/` found **zero** production references anywhere outside the file itself and its own test —
the file's *entire* substantive content was the one function being retired in this slice, plus
private constants/helpers used only inside that function's own body. Judged function-by-function,
every symbol in the file was legacy-only; the file's removal is the *consequence* of that
judgment, not a blind "the file is old, delete it" shortcut. `scoring.ts`, by contrast, kept 6 of
7 of its exports — the guard did exactly its job there.

## 3. Retained shared primitives — re-verified, not just carried over from the audit

Every symbol on the task's own "must keep" list is still exported, unchanged, from
`src/logic/scoring.ts`:

- `starsFromTotal()` — still the one function `toLegacyScoreBreakdown.ts:57` calls to turn
  Scoring 2.0's `totalScore` into a raw star count. **Production-authoritative.**
- `capStarsForBake()` — same call site, applies the perfect-bake ★5 cap. **Production-authoritative.**
- `countUsedIngredient()` — still called from `src/logic/scoringV2/recipeComponent.ts` (Scoring
  2.0's own Recipe-correctness component) and `src/data/hints.ts` (hint-line building).
  **Production-authoritative + used by data layer.**
- `ScoreBreakdown` (interface) — still the permanent player-facing score DTO;
  `GameState.score`'s declared type, read by `ResultPanel.tsx`, `MissionServePanel.tsx`,
  `dex.ts`, `dialogue.ts`, `persistence.ts`, `toLegacyScoreBreakdown.ts`.
- `QualityStars` (type) — still used by `dex.ts`, `persistence.ts`, `pizzaSelect.ts`, and
  `scoring.ts` itself.
- `starLabel()` — still called from `DexOverlay.tsx` and `PizzaSelectScreen.tsx` to render BEST
  stars.

A fresh re-search of `main` (post-A3a) for any *other* helper/type in `scoring.ts` that
Scoring 2.0 might depend on turned up nothing beyond the six above — `STAR_THRESHOLDS` and
`MAX_STARS` are the two remaining private consts, used only by `starsFromTotal`/`starLabel`
respectively, and were left untouched (they were never candidates for deletion — only
`scorePizza`'s own body and its two private-only helpers were).

## 4. Comment/doc-string accuracy fixes (no identifier or behavior change)

One comment was **factually wrong** after this PR and had to be fixed, not just left as history:
`gameReducer.ts`'s `CONFIRM_BAKE` case previously said *"Legacy `scorePizza`
(../logic/scoring.ts) is kept callable elsewhere (Option A, not deleted at A1)"* — false as of
this PR. Reworded to state the retirement plainly (`src/state/gameReducer.ts`, the `CONFIRM_BAKE`
case's own comment block).

Two more comments claimed things "never feed `scorePizza`" as a *live* thing to avoid — still
true in spirit (nothing feeds it — it no longer exists) but confusing phrasing once the function
is gone, so they were reworded to say "never feeds `state.score`" instead (the actual invariant
being described): `src/logic/sauceEvaluation.ts`, `src/logic/referenceScoring.ts`.

**Deliberately left alone** — a handful of comments in `src/logic/scoringV2/types.ts`,
`bakeComponent.ts`, `recipeComponent.ts`, `toLegacyScoreBreakdown.ts`, and two test files
(`gameReducer.test.ts`, `gameReducer.scoringV2Authority.test.ts`) describe **historical lineage**
in past tense (e.g. "mirrors legacy `scorePizza`'s own continuous bake formula", "not legacy
`scorePizza`'s own output") — these remain accurate as design-history documentation of where a
formula came from and don't claim the function still exists or is callable. Rewriting them was
judged out of scope (cosmetic-only, no correctness risk, and touching more files than the task's
own scope needs). `src/state/persistence.test.ts`'s two comment mentions of "a save written under
legacy `scorePizza` authority" are the same kind of accurate historical narrative (describing what
a pre-cutover save fixture represents) and were left unchanged for the same reason.

## 5. Test migration table

Fresh full-text search for `scorePizza`/`scorePlacement` immediately before implementation found
exactly the same 5 files and ~13-case surface the A3 audit enumerated (no drift since the audit
was written):

| File | Classification | What happened |
|---|---|---|
| `src/logic/scoring.test.ts` — `describe("scorePizza", …)` (4 tests: 100/★5 perfect pizza, 35/15/20/30 weighted formula, raw-bake ★4 cap, burnt-bake ★4 cap) | **C. Obsolete** — fixed only `scorePizza`'s own legacy formula/weights, which no longer exist | **Deleted** |
| `src/logic/scoring.test.ts` — `describe("scorePizza -- fugazza", …)` (4 tests: fugazza ★5, onion placement fairness, raw/burnt ★4 caps) | **C. Obsolete** — same legacy-formula-only coverage, for a second recipe | **Deleted** |
| `src/logic/scoring.test.ts` — `describe("starsFromTotal", …)` (10 cases) + `describe("capStarsForBake", …)` (4 tests) | **B. Shared primitive** — these already tested `toLegacyScoreBreakdown.ts`'s own production call targets, independent of `scorePizza` | **Kept unchanged**, import line simplified to drop `scorePizza`/unused fixtures |
| `src/logic/placement.test.ts` (whole file, 6 tests: empty→100, single-inside→100, single-outside penalty, relative outside penalty, spread-vs-clustered ordering, distribution floor) | **C. Obsolete** — pinned only `scorePlacement`'s own now-deleted formula; Scoring 2.0's Pieces component (`piecesComponent.ts`) is an entirely separate implementation with its own test coverage in `scoringV2.test.ts`, untouched by this PR | **Deleted** (whole file, see §2) |
| `src/state/gameReducer.test.ts` — `"A1: authoritative score/stars are exactly what Scoring 2.0 computes -- legacy scorePizza no longer feeds state.score"` | **C. Obsolete** — the assertion it made (`state.score` differs from a live `scorePizza()` call) requires calling a function that no longer exists; the *invariant* it protected (Scoring 2.0 is sole authority) is already covered by the always-true `state.score?.total === state.scoringV2Result?.totalScore` assertions in the same describe block's other tests | **Deleted** (1 test); the block's other 5 tests (Shadow-null-before-bake, FREE/Lunch-Rush-computes-result, Shadow-resets-on-fresh-round, Dex-BEST-driven, Mission-metrics-driven) are untouched |
| `src/state/gameReducer.scoringV2Authority.test.ts` — `"legacy scorePizza is no longer authoritative -- state.score differs from legacy for a Reference-quality pizza (Sauce now matters)"` | **C. Obsolete** — same reasoning as above; this file's own 7-recipe Golden ordering/malformed/empty/FREE/Lunch-Rush/Dex-BEST regression backbone (the other 7 tests) is this file's actual value and is untouched | **Deleted** (1 test) |
| `src/state/phase4a1a.regression.test.ts` — `"scorePizza ignores PizzaState.sauceDeposits entirely"` | **C. Obsolete** — pinned a legacy-formula-specific invariant (sauceDeposits doesn't affect the old formula) that has no meaning once the formula is gone; Scoring 2.0's own Sauce component is the thing that *does* read `sauceDeposits` today, and that boundary is covered by `scoringV2.test.ts`/`gameReducer.scoringV2Authority.test.ts`, not this file | **Deleted** (1 test); the file's other 5 describe blocks (Dex/★ semantics, Mission scoring purity, non-Margherita sauce interaction ×2, invalid-transition guards ×2) are untouched. The now-single-test `describe("Regression: legacy scoring untouched by sauceDeposits", …)` block was renamed to `"Regression: PizzaState shape unaffected by sauceDeposits"` to describe its one remaining (unchanged) test accurately |
| `src/state/phase4a1b.regression.test.ts` — `"reference matching neither mutates pizza state nor changes the authoritative legacy score"` | **A. Rewrite** — the `structuredClone` mutation-purity assertion and the `placementSimilarity === 1` assertion are independent of `scorePizza` and remain a real, valuable invariant ("reference matching doesn't mutate canonical pizza state") regardless of the legacy formula's fate | **Rewritten**: dropped the two `scorePizza()` before/after comparison lines and the import; kept every other assertion; renamed the test to `"reference matching neither mutates pizza state nor changes it as a side effect"` to match what it now actually asserts. The file's second test (save-schema key list) is untouched |

**Never touched, confirmed**: `src/logic/scoringV2/scoringV2.test.ts`'s Golden Matrix describe
blocks (`perfect > good > poor > empty`, all 7 recipes) and `src/logic/scoringV2/
malformedInput.test.ts` (665 lines, doesn't import `scorePizza` at all) — zero diff against
`origin/main` for either file.

## 6. Authority invariant — full-text search evidence (fresh, run after implementation)

```
$ grep -rn "function scorePizza\|export function scorePizza" src/ | wc -l
0
$ grep -rln "scorePizza(" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
(no output — 0 production call sites)
$ grep -rn "function scorePlacement\|export function scorePlacement" src/ | wc -l
0
$ grep -rln "scorePlacement(" src/ | grep -v "\.test\."
(no output — 0 production call sites)
```

`scorePizza` and `scorePlacement` no longer exist anywhere in the codebase, as either a
definition or a call — not just "no production callers of a function that still exists" as in the
A1/A3a state, but **fully retired**.

Remaining plain-text mentions of the string `scorePizza` (9 files) are all comment-only,
historical-lineage prose (§4) — none is an import, a call, or a definition. Confirmed by
`grep -rn "scorePizza"` and manually inspecting every match.

`gameReducer.ts`'s `CONFIRM_BAKE` case, re-read directly:

```ts
const scoringV2Result = computeScoringV2(state.recipe, pizza);
const score = toLegacyScoreBreakdown(scoringV2Result, action.value, state.recipe.bakeTarget);
return { ...state, pizza, score, bakeState, scoringV2Result, phase: "RESULT" };
```

`computeScoringV2` → `toLegacyScoreBreakdown` → `state.score` is the sole path, unchanged from
A1/A3a — this PR touches none of it beyond the one comment fix in §4.

## 7. Test counts before/after

- **Before this PR** (`origin/main`, A3a's own count): **1089/1089 tests, 56/56 files**.
- **After this PR**: **1072/1072 tests, 55/55 files**.
- **Delta**: −17 tests, −1 file (`placement.test.ts` deleted). Breakdown: 8 in
  `scoring.test.ts`'s two `scorePizza` describe blocks + 6 in the deleted `placement.test.ts`
  (whole file) + 1 each in `gameReducer.test.ts`, `gameReducer.scoringV2Authority.test.ts`, and
  `phase4a1a.regression.test.ts` = 17 tests deleted outright.
  `phase4a1b.regression.test.ts`'s one `scorePizza`-touching test was **rewritten in place**
  (kept, not deleted — net zero test-count change there), consistent with §5's table. This
  matches the audit's own "~13 `scorePizza`-dependent test cases across 5 files" estimate (§E)
  once `placement.test.ts`'s own 6 `scorePlacement`-only tests — a separate file the audit's §A
  scoped alongside, not inside, that 13-case count — are added: ~13 + 6 = ~19 candidate cases
  identified, of which 17 were deleted and 1 (`phase4a1b.regression.test.ts`'s case) was
  preserved via rewrite.

## 8. `npm test` / `npx tsc -b` / `npm run build` / `npm run lint`

All four run clean at the final commit, from the existing installed `node_modules`:

- `npx tsc -b` → clean, no errors. Every deleted symbol's import/reference was mechanically
  caught by the compiler during implementation (e.g. `gameReducer.test.ts`/
  `gameReducer.scoringV2Authority.test.ts`/`phase4a1a.regression.test.ts`/
  `phase4a1b.regression.test.ts` all had their `scorePizza` import lines removed as part of this
  PR, confirmed necessary by `tsc -b` failing until each was removed).
- `npm test -- --run` → **1072/1072 passed, 55/55 test files passed**. (Pre-existing jsdom
  `HTMLCanvasElement.getContext` warnings are unrelated environment noise, present on `main` too.)
- `npm run build` (`tsc -b && vite build`) → succeeds, 80 modules transformed (was 81 pre-PR —
  `placement.ts` is one fewer module), no warnings beyond normal Vite output.
- `npm run lint` (`oxlint`) → clean, exit code 0.

## 9. Existing coverage confirmed still present (not just "tests still pass")

Re-confirmed by reading the surviving test files directly, not just trusting the pass count:

- **All 7 recipes**: `src/logic/scoringV2/scoringV2.test.ts`'s Golden Matrix and
  `src/state/gameReducer.scoringV2Authority.test.ts`'s `it.each(ALL_RECIPE_IDS)` blocks —
  untouched, zero assertion changes.
- **Golden Matrix** (`perfect > good > poor > empty`): both the Scoring-2.0-internal version
  (`scoringV2.test.ts`) and the gameReducer-integration version
  (`gameReducer.scoringV2Authority.test.ts`'s `"%s: authoritative state.score.total orders
  perfect > good > poor"`) — untouched.
- **malformed/empty safety**: `src/logic/scoringV2/malformedInput.test.ts` (665 lines, zero diff)
  and `gameReducer.scoringV2Authority.test.ts`'s `"empty pizza never throws…"` /
  `"malformed pizza…"` tests — untouched.
- **FREE**: `gameReducer.test.ts`'s Phase 4A-2 describe block's FREE-path tests — untouched (only
  the one `scorePizza`-comparison test in the same block was removed).
- **Lunch Rush**: `gameReducer.test.ts`'s Lunch Rush test and
  `gameReducer.scoringV2Authority.test.ts`'s Lunch Rush coverage — untouched.
- **Dex BEST**: `gameReducer.test.ts`'s `"A1: Dex BEST/timesMade registration…"` test and
  `gameReducer.scoringV2Authority.test.ts`'s Dex BEST monotonicity tests — untouched.
- **progression**: no file in the progression path (`progression.ts`, `mastery.ts`) was touched;
  `phase4a1a.regression.test.ts`'s `totalStars`/`registerScoreToDex` test — untouched.
- **retry/reset**: `gameReducer.test.ts`'s `PLAY_AGAIN`/`RETRY_SAME_RECIPE`
  `scoringV2Result`-resets-to-null test — untouched.
- **persistence compatibility**: `persistence.test.ts` — zero diff, all save-compatibility tests
  (including the A1-era "pre-cutover save loads unchanged" describe block) untouched.

## 10. Save compatibility

**NO SAVE MIGRATION.** `src/state/persistence.ts` — zero diff against `origin/main` (confirmed by
`git diff --stat`). Nothing in this PR changes any save field, schema version, or the *meaning* of
any stored value (`bestScore`/`bestStars` are still plain formula-agnostic numbers, unchanged
since before A1). This PR deletes dead code and rewrites/removes tests only — it was never
possible for it to need a save migration, since `scorePizza`/`scorePlacement` had already been
fully disconnected from `state.score` since A1.

## 11. Behavior change = NONE — evidence

- `git diff --stat origin/main -- src/logic/scoringV2/ src/data/` → 0 lines changed. Scoring 2.0's
  weights, coefficients, tolerance, and Reference geometry were never opened for edit.
- `git diff --stat origin/main -- src/state/persistence.ts src/state/dex.ts src/logic/mastery.ts
  src/state/progression.ts` → 0 lines changed. Save schema, Dex BEST semantics, and progression
  rules are untouched.
- Full diff against `origin/main`: **11 files changed, 12 insertions(+), 356 deletions(-)** —
  2 files deleted (`placement.ts`, `placement.test.ts`), 9 files modified. Every insertion is
  either an import-line simplification, a comment-accuracy fix, or a test-title rename; grepping
  every changed (`+`/`-`) line in the two non-test, non-deleted production files touched
  (`gameReducer.ts`, `referenceScoring.ts`, `sauceEvaluation.ts`) for a digit found only comment
  text (an "A1" version-era reference in a doc comment), never a weight/threshold/coefficient
  literal.
- `npm test` (§8): every surviving `expect(...)` assertion in every touched test file is
  byte-identical to `origin/main`'s version, except the assertions inside the test blocks that
  were themselves deleted/rewritten per §5's table (no numeric expectation elsewhere changed).

## 12. Remaining scoring debt

- **`toLegacyScoreBreakdown`'s own name** — the A3 audit's §B flagged this as a minor, deferred
  future rename candidate (the function converts a `ScoringV2Result` into the permanent
  `ScoreBreakdown` shape; "Legacy" in its name now describes the shape's *origin*, not the
  target's status). **Not renamed in this PR** — still deliberately deferred, same as A3a's own
  decision.
- **`SCORING_V2_RULESET_VERSION = "phase-4a-2-shadow-3"`** — the literal string still contains the
  word "shadow" (Preview-debug-output only, never persisted). Deliberately left for a future PR
  that naturally bumps this string alongside a real formula change, per A3a's own DEFER decision.
- **Quattro Formaggi's 4-group equal-weight Pieces averaging** — flagged as a live, non-blocking
  calibration question since A1; unaffected by A3b (A3b is dead-code/test cleanup only, no
  formula change).
- **Issue #38 (Pitz reward)** remains the next scoring-adjacent roadmap item, gated on Scoring 2.0
  Human Feel calibration (unaffected by this PR).

With A3b landed, **A3 (legacy `scorePizza`/`scorePlacement` retirement) is now fully complete**:
both the A3a rename/cleanup slice and the A3b deletion slice are done. Legacy `scorePizza` and
`scorePlacement` no longer exist in the codebase in any form (not "kept callable but
non-authoritative" — actually gone), Scoring 2.0 (`computeScoringV2` → `toLegacyScoreBreakdown`)
is the sole scoring implementation, and no residual legacy-formula code remains to accidentally
regain authority.

## 13. When is A3 COMPLETE?

A3 (both slices) can be marked **COMPLETE** once, in addition to this PR's own verification (§6-11
above):

1. This PR (A3b) passes Human/ChatGPT review and is merged (this PR is left **OPEN**, not merged,
   per the task's own instruction — see §14).
2. A3a's own PR (`docs/reports/TETO_SCORING2-A3A_SAFE-RENAME_Result.md`) is also merged, if it
   hasn't been already by the time this PR is reviewed — **check fresh GitHub state before
   declaring A3 complete**, since this report cannot see PR merge state at the time it was
   written.
3. No further review round surfaces a missed production call site or a lost test-coverage gap in
   §5/§9's tables above.

Once all three hold, `docs/PROJECT_HANDOFF.md` can drop the "A3b not yet started" language
entirely and record A3 as fully complete, with the next roadmap item being whichever of Issue #33
D3 / Issue #37 M2 / Issue #38 the fresh GitHub state indicates is next in priority.

## 14. GitHub

- Commit created on branch `claude/scoring-a3b-legacy-retirement-cjq9vk`, pushed to `origin`.
- PR opened against `main`, **left OPEN** (not merged), pending Human/ChatGPT review, per the
  task's explicit instruction.
- CI checked after push (see the PR itself for the live status).

## 15. Review Playthrough

**Not produced.** Per the task's own instruction and this repo's "Standard completion rule"
(`docs/PROJECT_HANDOFF.md`): A3b is a legacy dead-code + test-file cleanup with **zero behavior
change** — no UI, no interaction, no score numeric output changes for any recipe, FREE round, or
Lunch Rush round (§11's evidence). Per the task's own item 7 ("A3bはbehavior changeなしなので、新
しいReview Playthrough動画は原則不要") and the handoff doc's own "Audit-only tasks are exempt from
Preview deployment and video capture" precedent for zero-production-code-behavior-change work, no
new Review Playthrough was recorded. If Human/ChatGPT review of this PR's diff surfaces any
unintended UI/interaction/score-numeric change, this task's own instruction is to stop and report
— none was found by any of the verification in §6-11.

## Final verdict

**A. A3b COMPLETE — READY FOR REVIEW**

`scorePizza`/`scorePlacement` are fully deleted (definition and every production call site = 0,
re-verified by fresh full-text search). All 6 required shared primitives
(`starsFromTotal`/`capStarsForBake`/`countUsedIngredient`/`ScoreBreakdown`/`QualityStars`/
`starLabel`) remain in place, unchanged, still consumed by the authoritative Scoring 2.0 path.
The ~13-test `scorePizza`-dependent surface (plus `placement.test.ts`'s own 6
`scorePlacement`-only tests) was migrated exactly per the audit's §E table: obsolete tests
deleted, one test rewritten to keep its still-valid mutation-purity assertion, shared-primitive
tests (`starsFromTotal`/`capStarsForBake`) kept unchanged. `npm test` (1072/1072), `npx tsc -b`,
`npm run build`, and `npm run lint` are all clean. No Scoring 2.0 weight/coefficient/threshold/
Reference-geometry/save-schema file was touched (zero diff against `origin/main` for every one of
them). Golden Matrix, malformed/empty safety, FREE, Lunch Rush, Dex BEST, progression, retry/
reset, and persistence-compatibility coverage are all confirmed still present and unchanged. No
Save migration needed or made. Per the task's instruction, **the PR is left OPEN** — not merged —
pending Human/ChatGPT Review.
