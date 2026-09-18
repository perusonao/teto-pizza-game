# Scoring 2.0 A3 Legacy Cleanup — Fresh Pre-Implementation Audit

READ-ONLY / DESIGN ONLY. No production code was changed as part of this audit. This report,
and the `docs/PROJECT_HANDOFF.md` staleness fixes described in §0, are the only repository
changes in this PR.

## 0. Scope, baseline, and authority proof

- **Audited SHA**: `12666faf55ed1e479d51572f6a8e3fcfc744cf31` (fresh `origin/main`, confirmed via
  `git fetch origin main && git rev-parse origin/main` — matches the task's expected SHA
  exactly). Working tree confirmed clean before and after this audit (`git status`).
- **PR #60 (A1 Authority Cutover) independently re-confirmed MERGED via the GitHub API**, not
  just from `docs/PROJECT_HANDOFF.md`'s own text: `pull_request_read` on
  `perusonao/teto-pizza-game#60` returns `state: "closed"`, `merged: true`,
  `merged_by: "perusonao"`, `merged_at: 2026-09-18T07:07:19Z`, base `main`@`7d2420a9…`, head
  `claude/scoring-2-a1-authority-o0qlp6`@`2ddbdb35…`. `git log --oneline -5` on `origin/main`
  shows `12666fa` ("Scoring 2.0 A1 Authority Cutover: make Scoring 2.0 authoritative (#60)") as
  `HEAD`, with `7d2420a` (A1's own Pre-Implementation Audit) directly beneath it — i.e. PR #60 is
  the tip of `main`, not a stale/unmerged branch. This confirms the task's stated "A1 Human
  Review: PASS" — the PR's own body text ("left OPEN, not merged, pending Human Review (A2)")
  is what the PR *said at creation time*; the actual merge (by the repo owner, after review) is
  what settles the question, and GitHub's own `merged`/`merged_by`/`merged_at` fields are that
  settlement.
- **`docs/PROJECT_HANDOFF.md` stale-text audit**: as the task anticipated, the file contained
  seven separate "PR open / DO NOT MERGE pending Human Review (A2)" statements about PR #60,
  left over from A1's own implementation report (which was accurate *at the time it was
  written*, before the human merge decision). All seven have been corrected in this same PR to
  state PR #60 MERGED / A2 PASS / Scoring 2.0 authoritative (see the diff). The *only* remaining
  "DO NOT MERGE" text in the file is about the unrelated Save v2 (PR #56) work, correctly left
  untouched — confirmed by a full-file grep before and after the edit.
- **Current authority — re-proven independently for this audit, not merely cited from A1's own
  report** (task item D): an exhaustive `scorePizza(` grep across `src/` (excluding `.test.`
  files) returns exactly **one** match: the function's own definition,
  `src/logic/scoring.ts:75`. **Zero production call sites remain.** Every place that used to call
  it (`gameReducer.ts`'s `CONFIRM_BAKE`) now calls `computeScoringV2Shadow` +
  `toLegacyScoreBreakdown` instead (`src/state/gameReducer.ts:488-489`, read directly). The five
  files that still import `scorePizza` are all test files (`scoring.test.ts`,
  `gameReducer.test.ts`, `gameReducer.scoringV2Authority.test.ts`,
  `phase4a1a.regression.test.ts`, `phase4a1b.regression.test.ts`) — see §D below for exactly
  which tests in each. `dex.ts`, `missionScoring.ts`, `mastery.ts`, `progression.ts`,
  `persistence.ts`, and `dialogue.ts` were each re-read directly for this audit and confirmed to
  consume only `ScoreBreakdown.total`/`.stars` (or `DexState` derived from them) — none re-derive
  a score from `scorePizza` or any other legacy path. There is no second, parallel route back to
  legacy authority anywhere in production code.

## A. Legacy `scorePizza` and surrounding primitives

`src/logic/scoring.ts` is not one dead file — it is one dead *function* (`scorePizza` itself,
plus its own private helpers) sitting inside a file whose *other* exports are genuinely still
load-bearing for the current, authoritative Scoring 2.0 path. Conflating the two would be exactly
the "delete a shared primitive by accident" mistake the task warns about.

| Symbol (`src/logic/scoring.ts`) | Production callers today | Classification |
|---|---|---|
| `scorePizza()` (the big function, lines 75-114) | **None.** Grep-confirmed zero non-test call sites. | **DELETE** candidate (A3b) |
| `WEIGHT_MATCH`/`WEIGHT_INGREDIENT`/`WEIGHT_PLACEMENT`/`WEIGHT_BAKE` (private consts) | Only inside `scorePizza`'s own body | **DELETE together with `scorePizza`** (A3b) |
| `usedIngredientIds()` (private helper) | Only inside `scorePizza`'s own body | **DELETE together with `scorePizza`** (A3b) |
| `countUsedIngredient()` | `scorePizza` itself, **and** `src/logic/scoringV2/recipeComponent.ts:28,108` (Scoring 2.0's own Recipe-correctness component — production, authoritative today), **and** `src/data/hints.ts:3,110` (hint-line building — production) | **KEEP** — actively shared by the current authoritative path |
| `QualityStars` (type) | `dex.ts`, `persistence.ts`, `pizzaSelect.ts`, `scoring.ts` itself | **KEEP** |
| `starLabel()` | `DexOverlay.tsx:79`, `PizzaSelectScreen.tsx:74` | **KEEP** — renders BEST stars on Dex/Pizza Select |
| `ScoreBreakdown` (interface) | `dex.ts`, `dialogue.ts`, `gameReducer.ts` (`GameState.score`'s type), `ResultPanel.tsx`, `MissionServePanel.tsx`, `toLegacyScoreBreakdown.ts`, `missionScoring.ts` (doc references) | **KEEP** — the permanent player-facing score DTO; see §B |
| `STAR_THRESHOLDS` (private const) | Only inside `starsFromTotal` | **KEEP** (used by the function below) |
| `starsFromTotal()` | `toLegacyScoreBreakdown.ts:57` (**production, authoritative** — this is how every post-cutover round's stars are computed), plus `scorePizza`'s own body | **KEEP** — actively part of the current authoritative path, not just legacy |
| `capStarsForBake()` | `toLegacyScoreBreakdown.ts:57` (**production, authoritative**), plus `scorePizza`'s own body | **KEEP** — same as above |
| `MAX_STARS` (private const) | `starLabel()` | **KEEP** |

**The single most important finding in this section**: `starsFromTotal` and `capStarsForBake` —
both physically defined inside "legacy" `scoring.ts` — are not legacy at all anymore. They are
called today, in production, from `toLegacyScoreBreakdown.ts:57`, which is the one function that
computes every post-cutover round's `stars`. Deleting them (or moving them without updating every
import) would break the *current* authoritative scoring path, not just remove dead legacy code.
Any A3 implementation must delete/rename only `scorePizza`'s own body and its two private-only
helpers (`usedIngredientIds`, the four `WEIGHT_*` consts) — never the six other exports above.

`src/logic/placement.ts`'s `scorePlacement()` is the one other file entirely orphaned by
`scorePizza`'s removal: it has exactly one production caller (`scoring.ts:88`, inside
`scorePizza`'s own body) and no other production reference anywhere (confirmed by grep — Scoring
2.0's own placement-like similarity, in `piecesComponent.ts`/`referenceMatching.ts`, is a
completely separate Hungarian-matching implementation, not a caller of `placement.ts`). It is a
**DELETE** candidate in the same slice as `scorePizza` itself, never before it (it would be a
false-positive "unused" report while `scorePizza` still calls it).

## B. `ScoreBreakdown` compatibility adapter — decision

**Verdict: `ScoreBreakdown` is the permanent player-facing score DTO, not a temporary migration
bridge, and should not be renamed as part of A3.**

Evidence: `ScoreBreakdown` is read, formula-agnostically (via `.total`/`.stars`, plus the four
named fields for `ResultPanel`'s detail bars), by at least eight production files today —
`dex.ts` (`isBetterQuality`/`registerScoreToDex`), `dialogue.ts` (`classifyBlueBand`),
`gameReducer.ts` (`GameState.score`'s declared type), `ResultPanel.tsx` (all four feedback rows),
`MissionServePanel.tsx`, `missionScoring.ts` (referenced in its own doc comments as the type its
`qualityTotal` parameter always ultimately comes from), `persistence.ts` (`isValidBestStars`
against `QualityStars`, the type `ScoreBreakdown.stars` is built from), and
`toLegacyScoreBreakdown.ts` itself (its return type). This is exactly the "shared, formula-
agnostic DTO" shape the original Authority Fresh Audit (`TETO_SCORING2_AUTHORITY_Fresh-Audit.md`
§4) predicted would need zero downstream changes at cutover — and that prediction held. Renaming
it now would touch all eight files above for zero behavior change and zero clarity gain (the name
was never "Legacy*Breakdown" to begin with — it's just `ScoreBreakdown`, which reads correctly
either way).

The one place the "Legacy" word actually appears is the *adapter function's own name*,
`toLegacyScoreBreakdown` (`src/logic/scoringV2/toLegacyScoreBreakdown.ts`). This is a real,
if minor, naming mismatch worth flagging for a **future** slice (not this one): the function
converts a `ScoringV2Result` into the (permanent, not-actually-legacy) `ScoreBreakdown` shape —
"Legacy" in its name describes the *shape's origin*, not the *target's current status*, which
reads oddly now that the shape is the permanent DTO. A future rename to something like
`toScoreBreakdown` (dropping "Legacy") is a reasonable candidate, exactly the kind of "future
rename plan, not implemented now" the task asks for — flagged here, not executed.

**Should the `matchScore`/`ingredientScore`/`placementScore`/`bakeScore` field names themselves
ever be renamed** (e.g. to reflect that they're now populated from Scoring 2.0 signals, not the
legacy formula's own values — see `toLegacyScoreBreakdown.ts`'s own file-header mapping table)?
**No, not recommended, even in a future slice.** The field *names* (`matchScore` = required-
ingredient presence, `ingredientScore` = purity, `placementScore` = quantity+placement,
`bakeScore` = bake closeness) still describe the right *concept* — only *which formula*
populates them changed, exactly the kind of formula-agnostic indirection the whole DTO exists to
provide. Renaming them would suggest a bigger semantic change happened than actually did.

## C. Shadow naming / debug panel

Two genuinely distinct "shadow" systems exist in this codebase. Conflating them would be a real
mistake — only one of them is in scope for A3.

### C.1 — Scoring 2.0's own "Shadow" naming (in scope for A3)

| Symbol | Current role | Classification |
|---|---|---|
| `computeScoringV2Shadow()` (`scoringV2/index.ts:52`) | **Production scoring core** — the one function that computes the authoritative total for every `CONFIRM_BAKE`, called from `gameReducer.ts:488` | Name is misleading (implies "just a shadow, not real"); **RENAME candidate for A3a** (e.g. `computeScoringV2`), pure mechanical rename, no behavior change. Touches ~8 files (`index.ts`, `gameReducer.ts`, and every test file that calls it directly — `scoringV2.test.ts`, `malformedInput.test.ts`, `gameReducer.test.ts`, `gameReducer.scoringV2Authority.test.ts`, `ScoringV2ShadowPanel.test.tsx`) but is bounded and low-risk (a global rename, not a logic change). |
| `ScoringV2ShadowPanel` (`components/ScoringV2ShadowPanel.tsx`) | **Preview-only debug/comparison UI** — gated on `VITE_PREVIEW_MODE`, renders raw per-component numbers (Sauce/Pieces/Recipe/Bake chips, ruleset version, per-piece-group detail) that `ResultPanel` deliberately does *not* show in full (`ResultPanel` shows only total + 4 feedback bars, no ruleset version, no raw component breakdown) | Retains genuine debugging value distinct from RESULT — **RENAME, not delete** (A3a). Matches the task's own suggestion: rename to something like `ScoringV2DebugPanel`, and change its own heading text from "🧪 Scoring 2.0 Shadow（開発用・…）" to "🧪 Scoring 2.0 Debug（開発用・…）". |
| `GameState.scoringV2Shadow` field (`gameReducer.ts:68`) | The exact value `toLegacyScoreBreakdown` derives `state.score` from at `CONFIRM_BAKE` (`gameReducer.ts:488-489`) — i.e. the authoritative computation's own intermediate result, not a side channel | Field's own doc comment (`gameReducer.ts:59-68`) is **stale/false** today — it explicitly says "never read by anything that feeds `score`/`bakeState`/Dex/Mission/Pitz/progression", directly contradicted three lines later in the same file. **RENAME candidate** (e.g. `scoringV2Result`) **+ mandatory comment fix regardless of whether the rename happens** (A3a). Touches `gameReducer.ts` (declaration, `buildOrderState`'s reset, `CONFIRM_BAKE`'s assignment), `GameScreen.tsx` (2 read sites), and ~6 test files that reference the field name directly. |
| `scoringV2/index.ts`'s own file header (lines 1-15) | Says "SHADOW ONLY: … must never touch (legacy `ScoreBreakdown`, Dex BEST/★, Mission scoring, Pitz, save schema)" | **Stale/false** — directly contradicted by `toLegacyScoreBreakdown` being exported from this exact file (`index.ts:174`) and being the one thing that *does* now touch `ScoreBreakdown`. **Comment fix required (A3a)**, mechanical, no code change. |
| `scoringV2/types.ts`'s own file header (lines 1-18) | Same "SHADOW ONLY … nothing in this module … feeds `../scoring.ts`'s `ScoreBreakdown`" claim | Same staleness, same fix (A3a). |
| `SCORING_V2_RULESET_VERSION = "phase-4a-2-shadow-3"` (`scoringV2/index.ts:28`) | Internal version tag string, Preview-debug-output-only, **never persisted** (re-confirmed: `GameState.scoringV2Shadow` is never serialized by `persistence.ts`) | **DEFER** — the literal word "shadow" in the string is a cosmetic residue, not a coefficient (safe to touch per the task's own scope guard, since it carries no weight/threshold), but there is no forcing function to bump it now (the task's scope guard says not to change weights, and this string only conventionally bumps *when* weights change). Leave as-is until a real formula change naturally bumps it. |
| `scoringV2.test.ts:1071`'s test title | `"Scoring 2.0 stays non-authoritative for the newly-covered recipes too -- computeScoringV2Shadow has no side effects on state.score/Dex/Mission"` | **Stale claim in the title/comment** — Scoring 2.0 *is* authoritative today; the test's actual assertion (calling the pure function twice with the same input gives an equal result — determinism) is still valid and worth keeping. **Title/comment-only fix (A3a)**: rename to something like `"computeScoringV2Shadow is a deterministic pure function — same input, same output, for the newly-covered recipes too"`, no assertion change. |

### C.2 — The *other* "shadow" system: `referenceScoring.ts` / `SauceMetricsPanel`'s `shadowScore` (out of scope — do not touch)

`src/logic/referenceScoring.ts` (`SauceReferenceShadowScore`, `scoreSauceAgainstReference`,
`scorePiecesAgainstReference`) and `SauceMetricsPanel.tsx`'s `shadowScore` prop are a **different,
older Phase 4A-1A/4A-1B system**: a live, in-progress comparison shown *during* Making (not at
RESULT), feeding the always-visible (not Preview-gated) 広さ/均一さ/ふち player-facing tiers plus
an optional Preview-only "Prototype Metrics" raw-numbers detail. It genuinely still never feeds
`scorePizza`/`ScoreBreakdown`/Dex/Mission (re-confirmed: `App.tsx` and `GameScreen.tsx` only pass
it into `SauceMetricsPanel`, never into `gameReducer`), so its own "Shadow" naming and file-header
claims remain **accurate**, unlike §C.1's stale claims. The task's own item C names
`computeScoringV2Shadow`/`ScoringV2ShadowPanel`/`shadowScore` together as possibly-stale — but
this `shadowScore` (the `SauceMetricsPanel` prop) is the *unrelated* one. **Recommendation: leave
`referenceScoring.ts` and `SauceMetricsPanel`'s naming untouched.** Renaming it to match §C.1's
cleanup would incorrectly imply it's part of the same system, creating exactly the kind of
confusion a naming cleanup is supposed to remove.

## D. Legacy authority proof (exhaustive)

Re-verified independently for this audit (not merely cited from A1's own Result report):

1. `scorePizza(` — grep across all of `src/`, non-test files: **1 match**, the definition itself
   (`scoring.ts:75`). **0 production call sites.**
2. `gameReducer.ts`'s `CONFIRM_BAKE` case (the sole historical call site) — read directly, current
   `main`: computes `scoringV2Shadow = computeScoringV2Shadow(...)` then
   `score = toLegacyScoreBreakdown(scoringV2Shadow, ...)`. No `scorePizza` reference anywhere in
   the file outside its own (now-unused-in-this-file) `ScoreBreakdown` type import.
3. `dex.ts` — `registerScoreToDex`/`isBetterQuality` read only `score.total`/`score.stars` off
   whatever `ScoreBreakdown` they're handed; no dependency on which formula produced it.
4. `missionScoring.ts` — `recordServe`/`missionScore`/`averageQualityScore` operate on a plain
   `qualityTotal: number` parameter, sourced by the caller (`App.tsx`) from `state.score.total`.
   No formula awareness at all.
5. `mastery.ts` — `totalStars` sums `DexEntry.bestStars` only; no score/formula dependency.
6. `progression.ts` — `ingredientState`/`isRecipeAvailable`/`availableRecipeIds` consume
   `totalStars`/`ownedIngredientIds` only; no score dependency whatsoever.
7. `persistence.ts` — validates/stores plain `bestScore`/`bestStars` numbers with no formula tag;
   never calls any scoring function itself.
8. `dialogue.ts` — `classifyBlueBand` reads `score.stars` only, formula-agnostic.

**Conclusion: no path exists today for legacy `scorePizza` to reach `state.score`, RESULT, Dex,
Mission, or progression.** This matches the task's stated confirmed state exactly, and this audit
independently re-derives it rather than trusting the prior report's claim alone.

## E. Test cleanup classification

Precisely enumerated by direct inspection of every file that imports `scorePizza` (5 files total,
~4,050 combined lines across the scoring-adjacent test suite) — the `scorePizza`-dependent
surface is small and exactly bounded, not vague:

| File | `scorePizza`-dependent tests | Rest of the file | A3 handling |
|---|---|---|---|
| `src/logic/scoring.test.ts` (171 lines) | `describe("scorePizza", …)` (4 tests) + `describe("scorePizza -- fugazza", …)` (4 tests) = 8 tests, lines 65-171 | `describe("starsFromTotal", …)` (10 cases) + `describe("capStarsForBake", …)` (4 tests), lines 24-63 — **already fully independent of `scorePizza`**, testing the two functions `toLegacyScoreBreakdown.ts` actually calls in production today | **A3b**: delete the two `scorePizza` describe blocks; keep the other two unchanged (just drop `scorePizza` from the import line) |
| `src/state/gameReducer.test.ts` (706 lines) | One test, `"A1: authoritative score/stars are exactly what Scoring 2.0 computes -- legacy scorePizza no longer feeds state.score"` (lines 678-685) | The rest of the "Phase 4A-2 Scoring 2.0 / A1 Authority Cutover" describe block (lines 592-706: Shadow-null-before-bake, Shadow-resets-on-fresh-round, FREE/Lunch-Rush-available/>90, Dex-BEST-driven-by-Shadow, Mission-metrics-driven-by-Shadow) — **none call `scorePizza`** | **A3b**: delete that one test; keep the rest |
| `src/state/gameReducer.scoringV2Authority.test.ts` (263 lines, A1's own new suite) | One test, `"legacy scorePizza is no longer authoritative -- state.score differs from legacy for a Reference-quality pizza (Sauce now matters)"` (line 150) | The other 7 tests (7-recipe golden ordering, FREE/Lunch Rush parity, Dex BEST monotonicity, progression, retry reset, malformed/empty safety) — **none call `scorePizza`**, this is the file's actual regression backbone | **A3b**: delete that one test; keep the rest (this file is the main "authority" regression suite and must survive intact) |
| `src/state/phase4a1a.regression.test.ts` (146 lines) | One test, `"scorePizza ignores PizzaState.sauceDeposits entirely"` (lines 27-41) | 5 other describe blocks (Dex/★ semantics, Mission scoring purity, non-Margherita sauce interaction ×2, invalid-transition guards ×2) — **none call `scorePizza`** | **A3b**: delete that one test; keep the rest |
| `src/state/phase4a1b.regression.test.ts` (50 lines) | Part of one test — `"reference matching neither mutates pizza state nor changes the authoritative legacy score"` (lines 10-36) uses `scorePizza` only for its before/after comparison (lines 26, 35); the pizza-mutation-purity assertion (`structuredClone` snapshot equality, lines 22, 34) and the `placementSimilarity` assertion (line 33) are independent of it | The second test (save-schema key list, lines 38-49) is fully independent | **A3b**: **rewrite** (not delete) the one test — drop the two `scorePizza` comparison lines, keep the mutation-purity check, since "reference matching doesn't mutate canonical pizza state" remains a real, valuable invariant regardless of `scorePizza`'s fate |

**Total scorePizza-dependent surface if A3b proceeds: ~13 individual test cases across 5 files**,
out of a 1089-test suite (per PR #60's own reported count) — small and exactly bounded, not an
open-ended migration.

**Never touch, regardless of A3a/A3b** (explicitly re-confirmed, per the task's own instruction
not to delete Golden Matrix / malformed-safety coverage):
- `src/logic/scoringV2/scoringV2.test.ts`'s Golden ordering describe blocks (`perfect > good >
  poor > empty`, all 7 recipes) — only the one stale test *title* at line 1071 needs a wording
  fix (§C.1); zero assertions change.
- `src/logic/scoringV2/malformedInput.test.ts` (665 lines) — does not import `scorePizza` at all
  (confirmed by grep); entirely about `scoringV2/`'s own boundary/fail-closed sanitization. Fully
  out of scope for A3 in either slice.
- `src/components/ScoringV2ShadowPanel.test.tsx` (72 lines) — if the panel/function are renamed
  per §C.1, this file's imports and `screen.getByText(/Scoring 2.0 Shadow/)` assertions need a
  find-and-replace to match the new name/heading text, but no test is deleted or weakened.

## F. Save compatibility

**NO SAVE MIGRATION.** Confirmed by direct re-reading of `src/state/persistence.ts` (all 552
lines) for this audit: `PersistentSaveV2`'s `dex` field stores only plain
`{ recipeId, discovered, bestScore, bestStars, timesMade }` numbers — no formula/version tag on
`bestScore`/`bestStars`, unchanged since before A1. Nothing proposed anywhere in this audit
(§A-C) changes any scoring *value*, *weight*, *threshold*, or *save field* — A3 (in either slice)
is a rename/dead-code/comment cleanup exercise over code that already stopped affecting
`state.score`'s actual numbers back at A1. This is an even more clear-cut "no save migration"
case than A1's own (which at least changed *which formula* computed the number) — A3 changes
nothing numeric at all, only names and dead code.

## G. Scope guards — explicitly confirmed unaffected

Every item in the task's scope-guard list was checked against every finding in §A-E above and
confirmed untouched by any recommendation in this audit: Scoring 2.0 weights/coefficients
(`SAUCE_WEIGHT`/`PIECES_WEIGHT`/`RECIPE_WEIGHT`/`BAKE_WEIGHT` in `scoringV2/index.ts`, all four
read-only in this audit), tolerance (`scoringV2/tolerance.ts`, not opened), Reference geometry
(`data/referencePizza.ts`, not opened), Bake thresholds (`bake.ts`'s `classifyBake`, read only to
confirm its production callers — §A), Quattro Formaggi's equal-weight piece-group averaging
(`piecesComponent.ts`, not opened), Dough scoring (no Dough-scoring file touched or read), Pitz
rewards (`economy.ts`, read only to confirm it does *not* yet depend on any `scoring.ts` export —
see §A's note on `STAR_THRESHOLDS` staying available for Issue #38's future band design),
Inventory (`persistence.ts`'s `inventory` field, read only for §F), progression rules
(`progression.ts`, read only for §D), Making interactions (`gameReducer.ts`'s
`APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`/`PLACE_TOPPING`/`COMMIT_DOUGH_STRETCH`/
`CONFIRM_MAKING_STEP` cases, read only to confirm `CONFIRM_BAKE` is the sole relevant case).

## H. Implementation estimate and recommended slice

**Verdict on "one 2-3 hour PR": no — recommend splitting**, primarily because A3b's test-file
surgery (§E) touches 5 test files' worth of `scorePizza`-dependent assertions plus 2 production
files' worth of deletions (`scoring.ts`'s function body, `placement.ts` in full), while A3a is a
pure, mechanical, zero-deletion rename+comment pass that can land safely on its own and give the
project a clean checkpoint before the riskier A3b.

### A3a — Safe cleanup / rename (no deletions, no test removals)
- Rename `computeScoringV2Shadow` → `computeScoringV2` (or similar), update all callers/tests.
- Rename `ScoringV2ShadowPanel` → `ScoringV2DebugPanel` (or similar) + its own heading text
  ("Shadow" → "Debug"), update `GameScreen.tsx`'s import/usage and the component's own test file.
- Rename `GameState.scoringV2Shadow` field → `scoringV2Result` (or similar); fix its now-false
  doc comment regardless of whether the rename happens.
- Fix the two stale "SHADOW ONLY / must never touch ScoreBreakdown" file-header comments in
  `scoringV2/index.ts` and `scoringV2/types.ts`.
- Fix `scoringV2.test.ts:1071`'s stale test title/comment (no assertion change).
- **Files touched**: ~10-12, all renames/comments, zero logic changes, zero test deletions.
- **Risk**: low — compiler/typecheck catches any missed rename site immediately.
- **Claude Code effort estimate**: 1-2 hours.

### A3b — Deeper legacy retirement (deletions)
- Delete `scorePizza()`'s body + its two private-only helpers (`usedIngredientIds`, the four
  `WEIGHT_*` consts) from `scoring.ts`; keep every other export (`ScoreBreakdown`, `QualityStars`,
  `starLabel`, `starsFromTotal`, `capStarsForBake`, `countUsedIngredient`) untouched in place.
- Delete `placement.ts`'s `scorePlacement()` (now fully orphaned) and its own test file
  (`placement.test.ts`), in the same slice as `scorePizza` (never before it).
- Handle the exactly-enumerated ~13 `scorePizza`-dependent tests per §E's table: delete 4 whole
  describe/test blocks (`scoring.test.ts` ×2, `gameReducer.test.ts` ×1,
  `gameReducer.scoringV2Authority.test.ts` ×1, `phase4a1a.regression.test.ts` ×1) and rewrite 1
  (`phase4a1b.regression.test.ts`'s mutation-purity test, dropping only its `scorePizza`
  comparison lines).
- Decide, and note in the Result report, whether `toLegacyScoreBreakdown` itself should be
  renamed (§B's flagged future candidate) — optional for this slice, not required.
- **Files touched**: `scoring.ts`, `placement.ts` (deleted), `placement.test.ts` (deleted), plus
  the 5 test files in §E's table.
- **Risk**: medium — the value of `scorePizza` as a standing "legacy comparison oracle" in
  several tests needs to be consciously retired, not silently lost; §E's table exists precisely
  so this isn't an open-ended search each time.
- **Dependency**: should follow A3a (renames land first, so A3b's deletions are against final
  names, not names about to be renamed again).
- **Claude Code effort estimate**: 1.5-2.5 hours.

Combined, A3a+A3b together are within the project's own "generally 2-3 hours" per-slice norm if
done as two separate PRs; attempting both in one PR risks exceeding it once test-file rewrites
(§E) are included alongside the renames (§C).

## Final verdict

**C. SPLIT A3** — into **A3a** (safe rename/comment cleanup, no deletions, ~1-2 hours, low risk)
and **A3b** (delete `scorePizza`/`scorePlacement` and their exactly-bounded ~13-test dependent
surface, ~1.5-2.5 hours, medium risk). Neither slice touches weights, thresholds, Reference
geometry, save schema, or any of the task's other scope guards. `docs/PROJECT_HANDOFF.md`'s
seven stale "PR open / DO NOT MERGE (A2)" statements about PR #60 have been corrected in this
same audit PR to reflect its confirmed merge.

### Summary

- **Audited SHA**: `12666faf55ed1e479d51572f6a8e3fcfc744cf31` (current `origin/main`, PR #60's
  own merge commit)
- **Current authority proof**: zero production call sites of `scorePizza(` remain; every
  RESULT/Dex/Mission/progression consumer reads `state.score` (`ScoreBreakdown`), which
  `CONFIRM_BAKE` now derives exclusively from `computeScoringV2Shadow` +
  `toLegacyScoreBreakdown` — independently re-verified by this audit, not merely cited (§D)
- **Legacy symbol inventory**: `scorePizza` + 2 private helpers + `scorePlacement`
  (`placement.ts`) are dead; `ScoreBreakdown`/`QualityStars`/`starLabel`/`starsFromTotal`/
  `capStarsForBake`/`countUsedIngredient` are all still actively shared by the current
  authoritative path and must never be deleted (§A)
- **DELETE / KEEP / RENAME / DEFER**: full table in §A; Shadow-naming table in §C.1
- **Adapter decision**: `ScoreBreakdown` is the permanent player-facing DTO, not a migration
  bridge — no rename now; `toLegacyScoreBreakdown`'s own name is a minor, deferred future rename
  candidate (§B)
- **Shadow terminology decision**: `computeScoringV2Shadow`/`ScoringV2ShadowPanel`/
  `GameState.scoringV2Shadow` naming and 3 stale file-header/test comments are in scope for A3a;
  `referenceScoring.ts`'s unrelated, still-accurate `shadowScore` system is explicitly out of
  scope (§C.2)
- **Test migration plan**: exactly 5 files, ~13 test cases depend on `scorePizza` directly (§E);
  Golden Matrix and malformed-safety coverage are untouched
- **Save compatibility**: NO SAVE MIGRATION (§F)
- **Implementation estimate**: A3a 1-2h, A3b 1.5-2.5h (§H)
- **Recommended A3 slice order**: A3a first, then A3b
- **Final verdict**: **C. SPLIT A3**
