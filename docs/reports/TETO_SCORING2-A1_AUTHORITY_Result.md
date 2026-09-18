# Scoring 2.0 A1 Authority Cutover — Result

Implementation of the A1 slice scoped by
`docs/reports/TETO_SCORING2-A1_AUTHORITY_PreImplementation-Audit.md` (verdict **B. READY WITH
MINOR DESIGN DECISION**). This report is the SSOT for what actually landed.

## 0. SHAs

- **Start SHA**: `7d2420a9f4d38b4b2d592257b59539c87fe5b5fb` (`origin/main`, matches the Pre-
  Implementation Audit's own HEAD and the task's expected SHA exactly — `git fetch origin main &&
  git rev-parse origin/main` re-confirmed before any change).
- **Final SHA**: `e56a1a1da6b6d7ce0c269ca4f16d19f735943361` (branch
  `claude/scoring-2-a1-authority-o0qlp6`, single commit on top of the start SHA above — no
  rebase/force-push used).

## 1. Authority: before → after

| | Before (Shadow-only) | After (A1) |
|---|---|---|
| `state.score` source | `scorePizza(recipe, pizza)` (`src/logic/scoring.ts`) | `toLegacyScoreBreakdown(scoringV2Shadow, bakeResult, bakeTarget)` — Scoring 2.0-derived |
| `state.scoringV2Shadow` | Computed unconditionally, read only by the Preview-only `ScoringV2ShadowPanel` | Unchanged: still computed the same way, at the same site, still the same debug/compare surface (per the audit's §4/F recommendation, left untouched at A1) |
| `total`/`stars` (Dex BEST, progression, FREE RESULT, Lunch Rush) | Legacy formula | Scoring 2.0's `totalScore`, same `starsFromTotal`/`capStarsForBake` mechanism |
| Legacy `scorePizza` | Sole authority | Still exported/callable (Option A, not deleted) — no longer read by `CONFIRM_BAKE`; the two formulas never both hold authority at once (confirmed by the "legacy authority no longer present" tests in §7) |
| `ResultPanel` | 3 feedback rows (具材/配置/焼き), no Sauce | 4 rows: **ソース (new)** /具材/配置/焼き |

## 2. Changed files / functions

| File | Change |
|---|---|
| `src/logic/scoringV2/toLegacyScoreBreakdown.ts` (**new**) | `toLegacyScoreBreakdown(result, bakeResult, bakeTarget): ScoreBreakdown` — the one new adapter function. Pure, fail-closed (never throws on `available: false`). |
| `src/logic/scoringV2/index.ts` | Re-exports `toLegacyScoreBreakdown` from the `scoringV2` barrel. |
| `src/state/gameReducer.ts` | `CONFIRM_BAKE`: replaced `scorePizza(state.recipe, pizza)` with `toLegacyScoreBreakdown(scoringV2Shadow, action.value, state.recipe.bakeTarget)`. Removed the now-unused `scorePizza` import (kept the `ScoreBreakdown` type import). No other case changed. |
| `src/components/ResultPanel.tsx` | Added `sauceScore: number | null` prop and a 4th "ソース" feedback row, rendered first, omitted (not faked) when `null`. |
| `src/screens/GameScreen.tsx` | Passes `sauceScore={state.scoringV2Shadow?.components.sauce.available ? state.scoringV2Shadow.components.sauce.score : null}` into `ResultPanel`. |
| `src/state/gameReducer.test.ts` | Rewrote the "Phase 4A-2 Scoring 2.0 Shadow" describe block's 3 authority-boundary assertions (previously asserting Shadow ≠ authority) to assert the new invariant: `state.score.total === state.scoringV2Shadow.totalScore`. |
| `src/state/gameReducer.scoringV2Authority.test.ts` (**new**) | Full A1 regression suite — see §6/§7. |
| `src/components/ResultPanel.test.tsx` (**new**) | Component tests for the new Sauce row (present/omitted/doesn't fabricate a number). |
| `src/state/persistence.test.ts` | Added a "Save compatibility across the A1 Authority Cutover" describe block — a pre-cutover-era save fixture round-trips unchanged, and `registerScoreToDex` against a pre-cutover BEST only raises it when actually better under the new formula. |
| `docs/PROJECT_HANDOFF.md` | Updated to reflect A1 implemented (PR open, DO NOT MERGE pending A2). |

No other files changed. In particular, per the task's scope guards: Scoring 2.0's weights/
coefficients/tolerance, Reference geometry, Bake thresholds, Quattro Formaggi's equal-weight
piece-group averaging, Dough scoring, Pitz reward, Save schema, inventory, and progression rules
themselves are all untouched — confirmed by the diff itself (`git diff --stat` against
`origin/main`, see §0) touching only the files listed above.

## 3. `ScoreBreakdown` mapping (the audit's §2 design decision)

`toLegacyScoreBreakdown` populates each legacy field with the closest real Scoring 2.0 signal —
never the legacy formula's own value, never a fabricated stand-in:

- **`matchScore`** ← `components.recipe`'s required-ingredient-*type* presence ratio
  (`requiredTypesPresent / requiredTypesTotal * 100`, before purity) — `100` when a recipe has no
  required ingredients (mirrors `recipeComponent.ts`'s own empty-requirements branch).
- **`ingredientScore`** ← `components.recipe.purityMultiplier * 100` — the purity term
  `matchScore` above deliberately excludes.
- **`placementScore`** ← `components.pieces.score` directly (quantity 30% + placement 70% per
  group, averaged across groups) — Scoring 2.0 has no separate placement-only number to pull out
  (re-confirmed from the audit's own table).
- **`bakeScore`** ← `components.bake.score` directly — same concept as legacy, different (already
  reviewed, B1) formula.
- **`total`** ← `result.totalScore` (or `0` iff `result.available` is false).
- **`stars`** ← `capStarsForBake(starsFromTotal(total), classifyBake(bakeResult, bakeTarget))` —
  unchanged mechanism, fed by the new total.

Each of the four fields above falls back to `0` (not `null`/`undefined`, not a throw) if its own
component came back `{ available: false }` — this should not happen for any of the 7 shipped
recipes today (re-confirmed by this PR's own regression suite, §6), but the adapter never trusts
that as a precondition.

## 4. Sauce RESULT implementation (the audit's Option 1)

Per the audit's recommended Option 1: **Sauce is not folded into any of the four fields above.**
It has no legacy `ScoreBreakdown` slot to hold it (52/100 of the total, the single heaviest
Scoring 2.0 component), so hiding it would mean RESULT never explaining over half the score.
Instead:

- `ResultPanel` gained a `sauceScore: number | null` prop and a 4th "ソース" row, rendered above
  the existing 具材/配置/焼き rows.
- `GameScreen.tsx` supplies it straight from `state.scoringV2Shadow.components.sauce.score` — the
  exact same computation already available on `state` at the same `CONFIRM_BAKE` site, not a
  second computation.
- When Sauce is unavailable (`null`), the row is **omitted**, never rendered as a fabricated `0`
  or placeholder — pinned by `ResultPanel.test.tsx`.
- `MissionServePanel` (Lunch Rush's compressed RESULT stand-in) is unchanged — it only ever read
  `.total`/`.stars`, confirmed by the audit and re-confirmed by this PR's own reading of the file;
  no new Sauce row was added there since the task's scope was `ResultPanel`/RESULT specifically,
  and Lunch Rush's own compressed panel intentionally has no per-component feedback at all today
  (not this PR's decision to change).

## 5. `npm test` / `npx tsc -b` / `npm run build` / `npm run lint`

All four run clean at the final commit:

- `npm test` (vitest): **1089/1089 tests passed, 56/56 files** (was 1061/1061 pre-A1 per the
  audit; +28 net new tests: the two new test files plus `persistence.test.ts` additions).
- `npx tsc -b`: clean, exit 0.
- `npm run build` (`tsc -b && vite build`): clean, `dist/` produced.
- `npm run lint` (`oxlint`): clean, exit 0.

(`node_modules` was not present at session start in this sandbox; `npm install` was run once,
first, before any of the above — no `package.json`/lockfile changes.)

## 6. 7/7 recipe regression

`src/state/gameReducer.scoringV2Authority.test.ts` drives `CONFIRM_BAKE` directly (via
`SELECT_RECIPE` → swap in a fixture `PizzaState` → `START_BAKE` → `CONFIRM_BAKE`, bypassing only
the making-flow UI replay, never the reducer's own scoring logic) for all 7 recipes
(margherita, marinara, quattro-formaggi, genovese, bismarck, funghi, fugazza):

- **`it.each` over all 7 recipes**: `state.score.total === state.scoringV2Shadow.totalScore`
  exactly, `Number.isFinite(state.score.total)`, `stars` in `[1,5]` — all pass.
- **`it.each` over all 7 recipes**: perfect > good > poor on the *authoritative* `state.score.total`
  (not just Shadow's, which `scoringV2.test.ts` already covered pre-A1) — all pass.

## 7. FREE / Lunch Rush / Dex / progression / retry / malformed / save — evidence

All in `gameReducer.scoringV2Authority.test.ts` unless noted:

- **Legacy authority no longer present**: for a Reference-quality Margherita pizza,
  `state.score.total !== scorePizza(recipe, pizza).total` (Sauce, 52/100, is exactly the
  dimension legacy is blind to — legacy never reads `sauceDeposits`), while
  `state.score.total === state.scoringV2Shadow.totalScore` exactly.
- **Empty pizza / malformed pizza** (`null` toppings, non-array `sauceDeposits`): never throws;
  Sauce/Pieces/Recipe all fail closed to `0`, Bake alone still contributes (it needs no pizza
  content) — total is finite and low (`20` for Margherita baked inside its own perfect zone), not
  `NaN`/`undefined`.
- **FREE**: `state.isMissionRound === false`, `state.score.total === state.scoringV2Shadow.totalScore`.
- **Lunch Rush**: same `CONFIRM_BAKE` path, `state.isMissionRound === true`,
  `state.score.total === state.scoringV2Shadow.totalScore`, finite.
- **Dex BEST**: a better replay (perfect pizza) raises `bestScore`/`bestStars`; a worse replay
  (poor pizza) registered afterward never lowers them; `timesMade` still increments every round.
- **progression**: `registerScoreToDex`'s output (`bestStars`) is what `mastery.ts`/`progression.ts`
  would consume — untouched code path, re-confirmed by direct assertion, zero new failures in the
  full suite.
- **retry**: `RETRY_SAME_RECIPE` and `PLAY_AGAIN` both reset `score`/`scoringV2Shadow` to `null` —
  unchanged reset path, re-verified against the new authority.
- **Existing "Phase 4A-2 Scoring 2.0 Shadow" suite** (`gameReducer.test.ts`): rewritten to assert
  the new invariant everywhere it previously asserted the old "Shadow ≠ authority" one (Dex
  registration, Mission serve metrics, and the direct legacy-vs-authoritative comparison).
- **Save compatibility** (`persistence.test.ts`, new describe block): a fixture `PersistentSaveV2`
  with `bestScore`/`bestStars` as they would have been written under legacy authority loads back
  byte-for-byte unchanged (`loadSave` round-trip) post-cutover — no migration is triggered by the
  formula switch, confirming the Pre-Implementation Audit's §6 conclusion in code, not just by
  citation. A second test confirms `registerScoreToDex` against such a pre-cutover BEST only
  raises it when the new (Scoring-2.0-derived) score is actually better.

## 8. Review Playthrough (390×844)

Delivered directly to the user (not committed — `artifacts/` is gitignored, per this repo's own
"never commit a large review video" rule):
`artifacts/review/TETO_SCORING2-A1_AUTHORITY_Review-Playthrough.mp4` (~47s, H.264/mp4, 390×844).

Driven with Playwright + Chromium against a local `vite` dev server (`VITE_PREVIEW_MODE=true`, so
the Shadow debug panel renders for side-by-side comparison), covering:

1. **Margherita** (FREE): dough stretch → sauce paint → 3 mozzarella + 2 basil → bake in the
   perfect zone → RESULT. `96 / ★★★★★`; rows ソース 99 / 具材 100 / 配置 80 / 焼き 100 — exactly
   matching the Shadow panel's `Total: 96 / 100`, `Sauce 99 / Pieces 80 / Recipe 100 / Bake 100`.
2. **Quattro Formaggi** (FREE): 8 cheese placements (2 each of mozzarella/gorgonzola/parmigiano/
   fontina, no basil/topping step) → RESULT. `90 / ★★★★☆`; ソース 99 / 具材 100 / 配置 38 / 焼き
   100 — matching Shadow's `Total: 90`, `Sauce 99 / Pieces 38 / Recipe 100 / Bake 100` (the low
   Pieces score reflects deliberately generic, non-Reference-matched placement in this scripted
   run, not a scoring defect — see §9's note on the equal-weight averaging).
3. **Bismarck** (FREE): 3 mozzarella + 1 egg → RESULT. `97 / ★★★★★`; ソース 99 / 具材 100 / 配置
   82 / 焼き 100.
4. **Lunch Rush** (1 round, `?missionDuration=90` dev-only override per `App.tsx`'s existing
   `resolveMissionConfig`, unrelated to scoring): the mission happened to draw Quattro Formaggi;
   `MissionServePanel` showed `90点 / ★★★★☆`, again exactly matching Shadow's `Total: 90`.

Checked at every recorded checkpoint (home, Pizza Select, each PREPARE step, each RESULT/Mission-
serve screen, Lunch Rush intro):

- **No horizontal overflow**: `document.documentElement.scrollWidth === clientWidth === 390` at
  all 8 checkpoints (`overflow-report.json`, all `false`).
- **No console errors**: zero `console.error`/`pageerror` events across the entire run
  (`console-errors.json`, empty array).
- **RESULT ↔ Shadow relationship is legible**: in every recipe, RESULT's total/stars/component
  rows are numerically identical to the Shadow panel's own numbers shown directly beneath it on
  the same screen — this is the intended post-cutover relationship (both now read from the same
  computation), not a coincidence to explain away.

## 9. Remaining risks / non-blocking observations

- **Quattro Formaggi's 4-group equal-weight Pieces averaging** (already flagged as a live,
  non-blocking calibration question by the Pre-Implementation Audit's §D and by
  `piecesComponent.ts`'s own in-code comment) is unchanged by A1 — A1 only changes *which*
  formula is authoritative, not its internals. The Review Playthrough's Quattro Formaggi Pieces
  score (38, from generic scripted placement, not real per-group Reference matching) illustrates
  this component being sensitive to placement accuracy exactly as designed; it is not a new
  finding.
- **`ResultPanel`'s 具材/配置/焼き rows** are still fed through the legacy `ScoreBreakdown`
  4-field shape (matchScore/ingredientScore/placementScore/bakeScore), per the audit's explicit
  "don't break existing consumers unnecessarily" instruction and Option 1's own wording — only
  Sauce needed (and got) a genuinely new slot. `matchScore`/`ingredientScore` no longer mean
  exactly what their pre-A1 legacy values meant (presence-with-mincount vs. presence-only, see §3)
  — this is disclosed in-code (the adapter's own file header) and in this report, not hidden.
- **`ScoringV2ShadowPanel`** is now showing numbers that are redundant with `ResultPanel`'s own
  (both derive from the same computation) — left untouched per the audit's explicit A1 scope
  guard; its fate (retire vs. repurpose as an explicit legacy-vs-new comparison) is an A3 decision,
  not made here.
- **Legacy `scorePizza`** is still exported and still has its own direct unit tests
  (`scoring.test.ts`, `phase4a1a.regression.test.ts`, `phase4a1b.regression.test.ts`) — all still
  pass unchanged, since that function's own behavior was never touched. Its removal is A3's job.

## 10. What A2 should confirm

- Human Feel: does Scoring 2.0's Sauce-heavy (52/100) weighting *feel* right across a real
  playthrough on an iPhone at 390×844, now that it is what the player actually sees as their score
  (not just a Shadow number nobody's quality depended on)?
- Does the new "ソース" row's position/wording/visual weight read clearly relative to the other
  three rows, especially for a first-time player who has never seen the Shadow panel?
- Quattro Formaggi's Pieces-component behavior under *real* (not scripted) placement — does the
  equal-weight 4-group averaging produce a score that feels fair for a real attempt?
- Any Dex/BEST/star discontinuity a real player might notice on their *first* post-cutover round
  for a recipe they'd already discovered pre-cutover (their stored BEST was legacy-derived; a new
  round is Scoring-2.0-derived — both this report's §7 and the Pre-Implementation Audit confirm
  BEST still only ever moves up, never down, across the switch, but the *absolute number* a
  returning player sees may jump either direction the first time they replay a recipe).
- Whether A3 (legacy `scorePizza` deletion, `ScoringV2ShadowPanel` retirement/repurposing) should
  follow immediately or wait for further Human Feel signal.

## 11. Final verdict

**A. A1 IMPLEMENTED — READY FOR HUMAN REVIEW**

All planned regression axes pass (7/7 recipes, FREE, Lunch Rush, Dex BEST monotonicity,
progression, retry, malformed/empty safety, save compatibility, legacy-authority absence);
`npm test`/`npx tsc -b`/`npm run build`/`npm run lint` are all clean; the 390×844 Review
Playthrough shows no console errors and no horizontal overflow across Margherita, Quattro
Formaggi, Bismarck, and one Lunch Rush round, with RESULT's authoritative score legibly matching
the Scoring 2.0 Shadow panel shown alongside it. Per the task's instruction, **the PR is left
OPEN** — not merged — pending Human Review (A2).
