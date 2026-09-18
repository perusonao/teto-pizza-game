# Scoring 2.0 A1 Authority Cutover — Pre-Implementation Fresh Audit

READ-ONLY / DESIGN ONLY. No production code was changed as part of this audit (only this
report and `docs/PROJECT_HANDOFF.md`'s stale-state correction).

## 0. Scope and baseline

- **Audited SHA**: `a063068abdfcdbcee6450c2b0dd43e174236c291` (fresh `origin/main`, confirmed
  via `git fetch origin && git rev-parse origin/main` — matches the expected SHA given for this
  task exactly). Working tree confirmed clean (`git status` → "nothing to commit, working tree
  clean") before any read.
- This audit supersedes `docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md` (audited SHA
  `2da3949…`, verdict **D. BLOCKED**) wherever the two disagree — that audit predates both B1 and
  B2 landing on `main`. Its architecture analysis (§1/§4 authority map, cutover design) is still
  correct and is re-confirmed, not redone, below; this report focuses on what changed since
  (B1/B2 closure) and one new finding that audit did not surface (§4.4 below).
- **B1/B2 closure, confirmed by commit history on `main`** (not by re-reading the stale
  `docs/PROJECT_HANDOFF.md`, which is corrected in §9):
  - `f464026` — "Scoring 2.0 B1: add real Bake similarity component (Shadow-only) (#58)"
  - `a063068` (**HEAD**) — "Scoring 2.0 B2: Reference coverage complete (7/7) — all recipes have
    reviewed geometry (#57)"
  - Both are ancestors of/equal to the audited HEAD; `git merge-base HEAD origin/main` ==
    `origin/main` == the expected SHA, so no drift to reconcile.
- **Verification run at this exact SHA** (not merely cited from a prior report):
  - `npm test` (`vitest run`): **1061/1061 tests passed, 54/54 files**.
  - `npx tsc -b`: clean, exit 0.
  - `npx oxlint`: clean, exit 0.
- Files read for this audit: `src/state/gameReducer.ts`, `src/logic/scoring.ts`,
  `src/logic/scoringV2/{index,boundary,types,bakeComponent,sauceComponent,piecesComponent,recipeComponent}.ts`,
  `src/data/referencePizza.ts`, `src/data/recipes.ts`, `src/state/dex.ts`, `src/state/progression.ts`,
  `src/state/persistence.ts`, `src/logic/doughShape.ts`, `src/logic/missionScoring.ts`,
  `src/components/{ResultPanel,MissionServePanel,ScoringV2ShadowPanel}.tsx`, `src/screens/GameScreen.tsx`,
  `src/App.tsx`, `src/data/dialogue.ts`, `src/logic/scoringV2/scoringV2.test.ts`,
  `docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md`, `docs/PROJECT_HANDOFF.md`.

---

## 1. Current authority data flow (re-confirmed on this SHA)

Unchanged from the prior audit's §1 finding — re-verified directly against current source, not
assumed:

```
gameReducer.ts CONFIRM_BAKE
  └─ scorePizza(recipe, pizza)              [src/logic/scoring.ts]
       └─ state.score: ScoreBreakdown       { matchScore, ingredientScore, placementScore,
                                               bakeScore, total, stars }
            ├─ ResultPanel (FREE RESULT)         — GameScreen.tsx:438
            ├─ MissionServePanel (Lunch Rush)     — GameScreen.tsx:431 (reads only .stars/.total)
            ├─ dialogue.ts classifyBlueBand       — reads only .stars
            ├─ registerScoreToDex → Dex BEST/★    — gameReducer.ts REGISTER_TO_DEX / MISSION_NEXT_ORDER
            │     └─ DexOverlay (★/BEST) , pizzaSelect.ts (COMPLETED card ★/BEST)
            │     └─ mastery.ts totalStars(dex) → progression.ts ingredientState (AVAILABLE_TO_BUY gate)
            └─ App.tsx missionDispatch({ type: "SERVE", qualityTotal: state.score.total })
                  └─ missionScoring.ts recordServe/missionScore/isNewMissionBest
                        └─ persistence.ts persistMissionBest (Mission BEST)
```

The **same** `CONFIRM_BAKE` case also computes `scoringV2Shadow` unconditionally, from the exact
same canonical `pizza`/`recipe`:

```
gameReducer.ts CONFIRM_BAKE
  └─ computeScoringV2Shadow(recipe, pizza)  [src/logic/scoringV2/index.ts]
       └─ state.scoringV2Shadow: ScoringV2Result   { available, totalScore, components:
                                                       { sauce, pieces, recipe, bake } }
            └─ ScoringV2ShadowPanel (GameScreen.tsx:445) — ONLY consumer, and it renders `null`
               unless `import.meta.env.VITE_PREVIEW_MODE` (statically false in production build,
               dead-code-eliminated — pinned by scoringV2.test.ts's production-build assertion)
```

**Isolation re-confirmed**: a repo-wide grep for `scoringV2Shadow` outside test files returns only
`gameReducer.ts`, `GameScreen.tsx`, and `ScoringV2ShadowPanel.tsx`. No Dex/Mission/Pitz/save code
path reads it. There is exactly one production call site of `scorePizza` (`gameReducer.ts`'s
`CONFIRM_BAKE`), confirmed by grep — no second/parallel legacy scoring path exists anywhere.

**Reference coverage, re-confirmed by direct read of `data/referencePizza.ts`**: `getReferencePizza`
returns a non-null `ReferencePizza` for all 7 recipes — margherita, marinara, funghi, genovese,
fugazza, bismarck, quattro-formaggi (`REFERENCE_PIZZAS` map, `referencePizza.ts:497-505`). Pinned
by `scoringV2.test.ts`'s `it.each([...7 recipes...])("%s: perfect (Reference-exact) > good > poor >
empty")` Golden Matrix, which passes for all 7 today.

**Bake component, re-confirmed by direct read of `bakeComponent.ts`**: computed unconditionally for
every recipe (needs no Reference fixture — only `Recipe.bakeTarget`, static authored data for all 7
recipes), wired into `totalScore` at weight 20/100 (`SAUCE_WEIGHT=52, PIECES_WEIGHT=16,
RECIPE_WEIGHT=12, BAKE_WEIGHT=20`, ruleset `phase-4a-2-shadow-3`).

**Both of the prior audit's two named BLOCKERs are therefore closed.** No other blocker was found
in this pass of the authority chain itself.

---

## 2. Proposed authority data flow (design, not implemented here)

Minimal-diff cutover, at the exact same reducer boundary the prior audit identified as the single
safe choke point (unchanged conclusion):

```
gameReducer.ts CONFIRM_BAKE
  └─ computeScoringV2Shadow(recipe, pizza)   [already computed today, unconditionally]
       └─ toScoreBreakdown(scoringV2Result, pizza.bakeResult, recipe.bakeTarget)   [NEW adapter]
            └─ state.score: ScoreBreakdown   ← now Scoring 2.0-derived
       └─ state.scoringV2Shadow  ← same field, now redundant with state.score for Preview
          diagnostics only; kept as-is per §4's "keep legacy diagnostic, don't delete in the
          same slice" recommendation, still Shadow/Preview-only, no downstream change
```

`legacy scorePizza(recipe, pizza)` is **not removed** at A1 — kept callable (Option A from the
prior audit, re-affirmed): a fallback exists on the *same commit* in case Preview/Human-Feel
surfaces a regression, and `A3` (legacy cleanup) is deliberately a later, separate slice.

Every downstream consumer keeps reading `state.score`/`state.score.stars`/`state.score.total`
exactly as today — nothing below `CONFIRM_BAKE`'s own case body changes, confirmed component by
component in §5.

### The one open design question: what does `toScoreBreakdown` actually compute?

`ScoreBreakdown` and `ScoringV2Result.components` are **not structurally parallel** — this is the
one place A1 needs a real (small) design decision, not just plumbing:

| `ScoreBreakdown` field | Legacy meaning | Nearest `ScoringV2Result` source |
|---|---|---|
| `matchScore` | required-ingredient-type presence only (`minCount` met) | `components.recipe.score` is the *closest* concept, but already folds in purity (see below) — not a 1:1 rename |
| `ingredientScore` | purity (extra-ingredient penalty) | already multiplied into `components.recipe.score` (`recipeComponent.ts`'s `purityMultiplier`) — there is no separate purity number to pull out |
| `placementScore` | topping placement quality only | `components.pieces.score` mixes 30% quantity + 70% placement per group — not placement-only |
| `bakeScore` | bake-zone distance | `components.bake.score` — same concept, different (but compatible) formula shape |
| *(no legacy field)* | — | `components.sauce.score` — **new dimension**, 52/100 of the total, the single heaviest Scoring 2.0 component, with **no legacy `ScoreBreakdown` field to hold it** |

`total`/`stars` are trivially safe (`total` = `scoringV2Result.totalScore`, `stars` =
`starsFromTotal(total)` + `capStarsForBake`, unchanged mechanism) — **every non-UI consumer
(`dex.ts`, `missionScoring.ts`, `mastery.ts`, `progression.ts`, `MissionServePanel`,
`dialogue.ts`) only ever reads `.total`/`.stars`**, confirmed by an exhaustive grep for
`\.matchScore|\.ingredientScore|\.placementScore|\.bakeScore` across `src/`: the **only**
production match is `src/components/ResultPanel.tsx`.

`ResultPanel.tsx`'s three feedback bars (`具材`/`配置`/`焼き`, `FEEDBACK_ROWS` +
`ingredientFeedbackScore`) are therefore the **only** place this mismatch is user-visible. Two
honest options, neither of which this audit chooses on its own:

- **Option 1 (recommended)**: extend `ResultPanel`'s feedback rows to 4, one per Scoring 2.0
  component (`ソース`/`具材`/`配置`/`焼き` ← `sauce.score`/`recipe.score`/`pieces.score`/
  `bake.score`), retiring `matchScore`/`ingredientScore`/`placementScore` from `ScoreBreakdown`'s
  shape (or keeping them as legacy-only diagnostic fields nothing reads). This is the only option
  that doesn't hide the heaviest-weighted new dimension (Sauce) from the player entirely.
- **Option 2**: keep `ResultPanel`'s existing 3-row shape unchanged and fold `sauce.score` into
  one of the existing rows (e.g. average into `具材`). Rejected as the default: it fabricates a
  number that doesn't mean what its label says, and silently discards Sauce feedback from the
  player-facing UI even though it drives over half the score underneath.

This is exactly the kind of small, product-facing judgment call the previous audit's §4 ("RESULT:
no RESULT-specific code change needed") did not surface, because it only checked *that* `ResultPanel`
consumes `state.score`, not *which fields* of it. Recommendation: **Option 1**, decided before or
during A1 implementation (not deferred to A2/A3) since it is part of what "RESULT reflects
Scoring 2.0" means, not a cleanup-later cosmetic.

---

## 3. Exact files/functions requiring change for A1

| File | Change |
|---|---|
| `src/state/gameReducer.ts` | `CONFIRM_BAKE` case: after computing `scoringV2Shadow` (already there), replace the `score` assignment from `scorePizza(state.recipe, pizza)` to the new adapter's output. No other case changes. |
| New: `src/logic/scoringV2/toLegacyScoreBreakdown.ts` (or similar name) | Pure function `(result: ScoringV2Result, bakeResult: number \| null, bakeTarget: BakeTarget) => ScoreBreakdown`, handling the `available: false` fallback explicitly (see §7 — should not happen post-B2, but must not throw if it somehow does). |
| `src/components/ResultPanel.tsx` | If Option 1 (§2) is taken: add the 4th `ソース` feedback row, sourced from the new adapter's retained/exposed component scores (or from `state.scoringV2Shadow.components.sauce.score` directly, since it's already computed at the same `CONFIRM_BAKE` site and available on `state`). |
| Tests (per §8 below) | `gameReducer.test.ts` (CONFIRM_BAKE now asserts against the new formula), a new `toLegacyScoreBreakdown.test.ts`, `ResultPanel` component test update if its markup changes. |

## 4. Files explicitly NOT requiring change

Re-confirmed by direct reading (not just citing the prior audit) at this SHA:

- `src/state/dex.ts` — `registerScoreToDex`/`isBetterQuality` only read `score.stars`/`score.total`.
- `src/state/progression.ts` — reads only `totalStars(dex)`, never `score` directly.
- `src/logic/mastery.ts` — sums `dex[].bestStars`, formula-agnostic.
- `src/logic/missionScoring.ts` — `recordServe`/`missionScore`/`isNewMissionBest` all take a bare
  `number` (`qualityTotal`), never `ScoreBreakdown` itself.
- `src/state/persistence.ts` — `PersistentSaveV2.dex` stores plain `{ bestScore, bestStars,
  discovered, timesMade }` numbers with no formula tag; unaffected either way (see §6).
- `src/components/MissionServePanel.tsx` / `src/data/dialogue.ts` — read only `.stars`/`.total`.
- `src/mission/lunchRush.ts`, `src/App.tsx`'s `SERVE` dispatch — pass `state.score.total` through
  unchanged; both FREE and Lunch Rush already share the one `CONFIRM_BAKE` site.
- `src/logic/scoring.ts` itself — kept as-is (Option A, not deleted at A1; still exported/typed,
  still the source of `ScoreBreakdown`/`starsFromTotal`/`capStarsForBake`/`starLabel` other modules
  import).
- `src/logic/referenceScoring.ts` / `src/components/SauceMetricsPanel.tsx` — a separate, unrelated
  UI-only *live-preview* diagnostic (reads uncommitted in-progress sauce state during PREPARE, not
  `state.score`); untouched by this cutover either way.

---

## 5. Per-consumer verification (§ letters from the task)

### A. Authority boundary

- `gameReducer.ts CONFIRM_BAKE` — the one and only place to change (§2/§3).
- `legacy scorePizza` — kept callable, not deleted at A1 (Option A).
- `Scoring V2 calculation` (`computeScoringV2Shadow`) — already computed at this exact site,
  unconditionally, for every recipe; becomes the actual source of `state.score` post-adapter.
- `ScoreBreakdown` — kept as the downstream **shape** every consumer expects; its *contents* come
  from the adapter instead of `scorePizza` once cut over. Not deleted.
- `RESULT`'s score — `ResultPanel`/`MissionServePanel` read `state.score` unchanged; only
  `ResultPanel`'s 3→4 row question (§2) is a real UI decision.
- `stars` — mechanism (`starsFromTotal` + `capStarsForBake`) unchanged, fed by the new total.
- `Dex BEST` — `registerScoreToDex` unchanged, formula-agnostic by construction.
- `progression` — `totalStars`/`ingredientState`/`isRecipeAvailable` unchanged, Dex-derived only.
- `FREE` / `Lunch Rush` — both dispatch the same `CONFIRM_BAKE` action; one adapter serves both,
  confirmed no Mission-specific score path exists (`missionScoring.ts` takes a bare number).

**Minimum change to make Scoring 2.0 authoritative**: one adapter function + one line in
`CONFIRM_BAKE` + (recommended) one UI row in `ResultPanel`. Nothing else in the authority chain
needs to move.

### B. Compatibility (formula-agnostic re-check on this SHA)

- Dex `bestScore`/`bestStars` — plain numbers, no formula tag, confirmed still true in
  `src/state/dex.ts`/`persistence.ts` at this SHA. **Formula-agnostic.**
- `bestStars` — same struct, same file. **Formula-agnostic.**
- mission/progression — confirmed above, bare-number interfaces. **Formula-agnostic.**
- save schema (`PersistentSaveV2`, schema version 2 as of the E0 Save v2 migration merged
  separately) — `dex`/`pitzBalance`/`ownedIngredientIds`/`missionBest`/`inventory`, none of which
  encode which scoring formula produced a `bestScore`. **No migration needed for A1** — re-confirmed
  by reading `persistence.ts`'s current `PersistentSaveV2`/`sanitizeSave` in full; nothing there
  changes shape because of which formula computed a score.
- `REGISTER_TO_DEX` — unchanged reducer case, only its *input* (`state.score`) changes upstream.
- retry/reload — `RETRY_SAME_RECIPE`/`PLAY_AGAIN`/`buildOrderState` reset `score`/`scoringV2Shadow`
  to `null` for every fresh round identically regardless of which computes the eventual value;
  unaffected by this cutover.
- Lunch Rush — same `CONFIRM_BAKE` site, no separate Mission scoring path (re-confirmed above).

**No Save migration is needed or recommended for A1.** (Confirms and does not change the prior
audit's §5 conclusion.)

### C. Double-scoring / double-penalty

Re-confirmed by direct reading of `scoringV2/index.ts` + all four component files: there is
exactly **one** authoritative score once cut over — `scorePizza`'s legacy output is simply no
longer read by `CONFIRM_BAKE` after the adapter lands (still computable, just unused for
authority). Recipe/Pieces/Sauce/Bake responsibility boundaries inside Scoring 2.0 itself are
already non-overlapping by explicit design and in-code documentation:

- `recipeComponent.ts` — ingredient *type* presence + purity only, explicitly documented (and
  pinned by tests) to never penalize quantity/placement (Pieces' job) or vice versa.
- `piecesComponent.ts` — quantity + placement of specific topping groups only, never type
  correctness.
- `sauceComponent.ts` — sauce execution quality only (quantity/coverage/evenness/edge), disjoint
  from toppings/recipe/bake.
- `bakeComponent.ts` — bake-zone distance only.

No two components read the same underlying signal for the same judgment. **No double-penalty risk
found** — this was already true pre-A1 and is unaffected by the cutover itself, since the cutover
only changes *which single formula* is authoritative, not how many formulas run simultaneously as
authority.

### D. Quattro Formaggi concern (4-group equal-weight averaging)

Confirmed directly in `piecesComponent.ts:154-176` (`scorePiecesComponentV2`): `score = mean(group
scores)` — **unconditionally equal weight per group**, regardless of group count. For
quattro-formaggi specifically (`referencePizza.ts:434-495`), all 4 groups (mozzarella, gorgonzola,
parmigiano, fontina, each `minCount: 2` per `recipes.ts:52-58`) use the identical 8/22 tolerance
band and are explicitly documented in-code as deliberately *not* rigid-quadrant, each pair
diametrically opposite within its own ring.

**Is this a real cutover blocker, or a future calibration concern?** — **Future calibration
concern only, not a blocker.** Reasoning:
1. The averaging is *internally consistent* — every recipe with N piece groups (margherita/2,
   marinara/2, funghi/2, genovese/2, fugazza/2, bismarck/2, quattro-formaggi/4) uses the same
   equal-weight-per-group rule; quattro-formaggi is not a special case that breaks differently
   from the other 6, it simply has more groups than most.
2. The equal-weight choice is already explicitly documented in-code (`piecesComponent.ts:137-141`)
   as "a provisional Phase 4A-2 shadow choice, not a claim that every ingredient type should always
   weigh the same" — i.e. already flagged as a live calibration question by the people who wrote
   it, not a newly-discovered defect.
3. No test, Golden Matrix run, or prior Human-Feel report (iPhone-Calibration report) identifies
   quattro-formaggi producing a nonsensical, inverted, or unbounded ordering because of this —
   `scoringV2.test.ts`'s Golden Matrix (`perfect > good > poor > empty`) passes for
   quattro-formaggi identically to every other recipe today.
4. This audit's own instruction is explicit: do not change the weighting here. Per that
   instruction and the evidence above, this is correctly classified as the prior audit's own
   "NICE-TO-HAVE" bucket (§3 of that report), carried forward unchanged: monitor, don't block.

### E. Dough (Issue #33 D1/D2)

Confirmed by a repo-wide grep for `doughShape` across `src/logic/scoringV2/` and
`src/logic/scoring.ts`: **zero references**. `PizzaState.doughShape` (`src/logic/doughShape.ts`,
Issue #33 D1/D2, merged via PR #54) is not read by either the legacy `scorePizza` or any
`scoringV2/` component, confirmed independently of the previous audit's own citation of this fact.

**Is this a blocker for A1, or addable later as D3?** — **Not a blocker; correctly deferred to a
future D3 slice.** This audit does not add Dough scoring (per the task's explicit instruction not
to). The reasoning is unchanged from the prior audit's §7 and re-confirmed here: Dough was never
part of either scoring model's (legacy or Scoring 2.0) accepted invariants to begin with — it is a
*making-flow* addition (D1/D2's new physical step), tracked on its own Issue #33/#37 roadmap track,
independent of the scoring-authority track. A1 cutting Scoring 2.0 over to authoritative status
changes *which formula computes Sauce/Pieces/Recipe/Bake*; it says nothing about whether Dough
should ever become a fifth component, and does not need to for either formula to be internally
consistent today.

### F. Preview Shadow UI

`ScoringV2ShadowPanel` (Preview-only, dead-code-eliminated from production builds) currently shows
the *same* numbers that would become `state.score` post-cutover — it would become redundant with
RESULT's own display once A1 lands (`ResultPanel` and `ScoringV2ShadowPanel` would show numbers
derived from the same computation). Per this task's explicit instruction, **A1 should not
preemptively strip or repurpose it** (that is an A3 legacy-cleanup decision, per the prior audit's
§4 recommendation, unchanged here): keeping it available in Preview for one transitional release —
optionally showing the *previous* legacy score side-by-side for comparison during rollout — costs
nothing and gives a debug/compare surface during the cutover's own Human-Feel verification (A2).
**Recommendation for A1 itself: leave `ScoringV2ShadowPanel` untouched.** Decide its fate (retire vs.
repurpose as a legacy-vs-new comparison tool) explicitly in A3, not implicitly by omission during A1.

### G. Regression matrix

Minimum matrix for the A1 implementation slice (extends, does not replace, the prior audit's §8):

| Axis | Cases | Status today (pre-A1) |
|---|---|---|
| Recipes | all 7 (margherita, marinara, funghi, genovese, fugazza, bismarck, quattro-formaggi) | ✅ already pinned `available:true` + Golden Matrix in `scoringV2.test.ts` |
| Mode | FREE, Lunch Rush | both share `CONFIRM_BAKE`; need one integration test each asserting `state.score` now equals the adapter's output, not `scorePizza`'s |
| Quality tiers | perfect / good / poor (per recipe) | ✅ Golden Matrix already covers this for the Scoring 2.0 side; needs a `gameReducer.test.ts`-level assertion once wired to `state.score` |
| stars | `capStarsForBake` "not-perfect-bake ⇒ never ★5" | needs re-assertion against the new formula's stars specifically (mechanism unchanged, but must be tested against the new number, not assumed) |
| Dex BEST update | a better round raises BEST | `isBetterQuality`/`registerScoreToDex` unchanged — existing tests should pass unmodified; re-run, don't skip |
| Dex BEST non-update | a worse round never lowers BEST | same as above |
| progression | `totalStars`/`ingredientState`/`isRecipeAvailable` unaffected | unchanged code path — re-run existing suite, expect zero new failures |
| retry | `RETRY_SAME_RECIPE`/`PLAY_AGAIN` reset `score`/`scoringV2Shadow` to null for a fresh round | unchanged reset path (`buildOrderState`) — re-run existing suite |
| malformed/empty safety | empty pizza, malformed `PizzaState` (already covered by `scoringV2/malformedInput.test.ts` and `boundary.ts`'s fail-closed contract) | ✅ already exhaustively tested Shadow-side; the new adapter itself needs its own malformed-input test (e.g. `available: false` fallback path, which should not occur in real gameplay post-B2 but must not throw) |
| save compatibility | a pre-cutover save (legacy-era `bestScore`/`bestStars`) still loads, still displays, is never rewritten by the formula change alone | needs one persistence-level test with a fixture `PersistentSaveV2` JSON, per the prior audit's §8 — not yet added anywhere in the current suite (confirmed by grep: no such fixture-based cutover test exists today) |

---

## 6. Save compatibility (re-confirmed)

No change from the prior audit's conclusion, re-verified against the current `persistence.ts`
(now schema v2, post-E0 migration, unrelated to Scoring 2.0): `PersistentSaveV2.dex` entries are
`{ recipeId, discovered, bestScore, bestStars, timesMade }` — plain numbers, no formula/version
tag. `isBetterQuality` (`dex.ts`) only ever compares a *new* round's score against the *stored*
BEST, never re-derives history, so "BEST never goes down" holds unchanged across the formula
switch by construction. **No Save migration required or recommended for A1.**

---

## 7. Estimated implementation size

Broadly re-affirms the prior audit's own A1 estimate, adjusted slightly upward for the newly
surfaced ResultPanel decision (§2):

- Adapter function + `CONFIRM_BAKE` wiring: ~1 hour.
- `ResultPanel` 4th row (Option 1, recommended): ~30–45 minutes including its own component test
  update.
- Regression suite (§5.G matrix, mostly new integration-level assertions over already-tested
  Scoring 2.0 internals — not new scoring logic): ~1.5–2 hours.
- Typecheck/lint/build/full-suite verification pass: ~15–30 minutes (already green today, so this
  is a re-run, not a fix-up).

**Total: ~3–4 hours**, one focused Claude Code session, consistent with the project's own stated
2–3 hour slice norm plus the extra ~30–60 minutes the ResultPanel decision adds over a pure-plumbing
estimate.

---

## 8. Blockers

**None found that prevent starting A1.** Both of the prior audit's named blockers (no Bake
component; Reference coverage 1/7) are closed. The one item this audit surfaces that the prior
audit did not — the `ScoreBreakdown` ↔ `ScoringV2Result.components` shape mismatch and its
`ResultPanel` consequence (§2) — is a **minor design decision**, not a blocker: it has a clear
recommended answer (Option 1: add a 4th feedback row), does not require new scoring logic or
calibration, and does not gate whether A1 can be implemented, only how `ResultPanel` should look
immediately after it lands.

---

## 9. `docs/PROJECT_HANDOFF.md` staleness identified and corrected

The following statements in `docs/PROJECT_HANDOFF.md` (pre-audit) were stale against fresh
`origin/main` and have been corrected in the same commit as this report:

1. "**B1 (Bake similarity component) is now implemented** — see PR #58 … **not yet merged**" —
   stale. PR #58 **is merged** (commit `f464026`, ancestor of HEAD).
2. "B2 is still open" / "Reference coverage is 3/7" / "quattro-formaggi and bismarck still have no
   candidate at all" — stale. B2 **is merged** (PR #57, commit `a063068` = current HEAD);
   Reference coverage is **7/7**, confirmed directly against `referencePizza.ts`.
3. The overall Scoring 2.0 Authority verdict "**D. BLOCKED BY ANOTHER SYSTEM**" — stale. Both
   named blockers are closed; see §11 below for this audit's updated verdict.
4. Recommended next-priority text pointing at "B1/B2 in parallel" as the active work — stale; that
   work is done, and A1 (this audit's own subject) is the correct next item.

---

## 10. Summary of confirmations

- Audited SHA `a063068abdfcdbcee6450c2b0dd43e174236c291` == expected SHA == `origin/main` == clean
  working tree.
- B1 (`f464026`, PR #58) and B2 (`a063068`, PR #57) both confirmed merged into `main` by commit
  history, not by doc citation.
- Full suite (1061/1061), typecheck, and lint all green on this exact SHA.
- Reference coverage 7/7, Bake component real for all 7 recipes, both re-confirmed by direct source
  read and by the existing `scoringV2.test.ts` Golden Matrix.
- Single authority choke point (`gameReducer.ts` `CONFIRM_BAKE`) re-confirmed; every downstream
  consumer (`dex.ts`, `progression.ts`, `mastery.ts`, `missionScoring.ts`, `persistence.ts`,
  `MissionServePanel`, `dialogue.ts`) confirmed formula-agnostic (reads only `.total`/`.stars`).
- One real, narrow, non-blocking design decision surfaced: how `ResultPanel`'s 3 legacy feedback
  rows should become 4 to represent Sauce, Scoring 2.0's heaviest (52/100) component, which has no
  legacy `ScoreBreakdown` field today.
- Quattro Formaggi's 4-group equal-weight averaging: confirmed internally consistent, already
  self-documented as provisional, no evidence of a broken ordering — future calibration concern,
  not a cutover blocker.
- Dough (`doughShape`): confirmed absent from both scoring formulas by grep; correctly out of
  scope for A1, addable later as an independent D3 slice.
- No Save migration required.
- `docs/PROJECT_HANDOFF.md` stale B1/B2/verdict text identified and corrected in this same change.

---

## 11. Final verdict

**B. READY WITH MINOR DESIGN DECISION**

Both hard blockers from the prior Fresh Audit (no Bake component; Reference coverage 1/7) are
closed and independently re-verified on fresh `main` at the exact expected SHA, with a full green
test/typecheck/lint baseline. The reducer boundary, Dex/Mission/progression/save consumers, and the
Recipe/Sauce/Pieces/Bake internal responsibility split are all confirmed formula-agnostic and
non-overlapping — A1 is a small, well-scoped change centered on one reducer case plus one new pure
adapter function.

The one thing standing between this audit and an unqualified **A. READY** is a genuinely
product-facing (not merely technical) decision: whether/how `ResultPanel`'s player-facing feedback
breakdown should be extended to represent Sauce — Scoring 2.0's single heaviest component — which
has no equivalent slot in today's legacy `ScoreBreakdown` shape. This audit recommends Option 1
(§2: add a 4th "ソース" row) but does not implement it, per this task's explicit instruction to
stop at Fresh Audit and not begin A1 production implementation.

Fresh Audit only, per instruction — no A1 implementation performed in this task.
