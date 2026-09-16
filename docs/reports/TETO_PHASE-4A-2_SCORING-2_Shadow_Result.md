# Phase 4A-2 — Scoring 2.0 Shadow Prototype — Result Report

## Baseline / SHA

- Audited/expected main SHA: `a80698487bd4f56585a9a1572e0025d726631716` — confirmed identical to `origin/main` at implementation start (`git log origin/main -1` returned the same SHA). No drift to reconcile.
- Implementation branch: `claude/teto-scoring-2-shadow-2qlzz6`
- Original implementation HEAD SHA: `d3d2ce734c2efa4a587804c837ccfa3e13d14bf1` (PR #31, Codex broad-review target).
- Codex P1 blocker fix HEAD SHA: see the commit this report ships in (second commit on this branch) — see "Codex P1 Blocker Fix" section below.

### Fresh Audit document

`docs/reports/TETO_PHASE-4A-2_SCORING-2_Fresh-Audit.md`, named as this task's SSOT, **does not exist in the repository** at the audited SHA (confirmed via `find`/`git log --follow`, and Issue #22's own Phase 4A-2 checklist still shows "Fresh audit current main" as an *unchecked* gate item, i.e. not yet landed). Issue #30 corroborates: it asks for a fresh audit "before implementation" but was itself only just opened.

Rather than fabricate or guess at a missing document's contents, this implementation:

1. Treated the **P0/P1 contracts embedded directly in the task instructions** (Reference availability, canonical bake-time computation, tolerance-band validation, PAINT/PAINT_TEMPORARY parity, evenness/edge thresholds, the 65/20/15 calibration split) as the authoritative spec, since they read as the audit's own findings passed through.
2. Independently re-verified every one of those claims against the actual current-main source (`getReferencePizza`, `App.tsx`'s live-preview `useMemo`, `gameReducer.ts`'s `CONFIRM_BAKE`, `recipeSauceProfiles.ts`, `sauceField.ts`) before writing any code — see "Fresh Audit P0/P1 Resolution" below for what was actually found at each site.
3. Did not create the missing audit file itself — this PR's own deliverable is the Shadow Result report, not a retroactive audit authored after the implementation it should have preceded.

## Architecture

New, isolated module: **`src/logic/scoringV2/`**

```
src/logic/scoringV2/
  types.ts             ScoringV2Result / component types (all Shadow-only, see file header)
  tolerance.ts          P1-1: validated tolerance-band similarity (safeToleranceSimilarity, safeUnit)
  sauceComponent.ts      Sauce: quantity, coverage, evenness, edge/rim control
  piecesComponent.ts     Pieces: mozzarella/basil placement (Hungarian-matched, permutation-invariant)
  recipeComponent.ts     Recipe correctness: required-ingredient *type* presence only
  index.ts               computeScoringV2Shadow(recipe, pizza) -- the one public entry point
  scoringV2.test.ts      30 focused unit tests
```

`GameState.scoringV2Shadow: ScoringV2Result | null` (`src/state/gameReducer.ts`) is the single additive field carrying the Shadow result at runtime. It is:

- **Never persisted** — `src/state/persistence.ts` never serializes `GameState` at all (confirmed pre-existing; this phase changes nothing there). See "Save-schema evidence" below.
- **Computed exactly once per round**, inside the `CONFIRM_BAKE` reducer case, from the same canonical `pizza` object `scorePizza` (legacy) scores in the very next line.
- **Reset to `null`** at the start of every fresh round (`buildOrderState`, shared by `PLAY_AGAIN`/`MISSION_RESET_ORDER`/`MISSION_NEXT_ORDER`/initial state), so a stale previous round's Shadow can never leak into a new PREPARE/BAKE.

### Scoring formula / components

`ScoringV2Result`:

```ts
{
  rulesetVersion: "phase-4a-2-shadow-1",
  recipeId: string,
  available: boolean,        // false whenever no Reference Pizza exists for this recipe
  unavailableReason: string | null,
  totalScore: number | null, // 0-100, finite, or null when unavailable
  components: { sauce, pieces, recipe, bake }
}
```

**Sauce** (available only for Margherita — see P0-1):

| Sub-metric | Source | Method |
|---|---|---|
| quantity | `SauceMetrics.quantity` vs `ReferenceSauce.quantity` | tolerance-band similarity, `full=0.08`, `zero=0.4` (normalized units) |
| coverage | `SauceMetrics.coverage` vs `ReferenceSauce.coverage` | same tolerance-band shape, `full=0.08`, `zero=0.4` |
| evenness | `SauceMetrics.evenness` | self-normalized 0-1, read directly (no Reference needed) |
| edge/rim | `SauceMetrics.edgeRatio` | tolerance-band similarity against `EDGE_GREAT`/`EDGE_POOR` (0.03/0.12) — **the exact same thresholds** the player-facing ふち tier already uses (`sauceEvaluation.ts`), now exported and reused rather than re-tuned |

Both evenness and edge are gated by a **presence floor** (`quantity >= 0.05` for full credit) so an empty/near-empty pizza's placeholder `evenness=1`/`edgeRatio=0` (defined in `sauceField.ts`'s `emptySauceMetrics` as "nothing deposited, neutral") can never read as free credit for sauce that was never applied. Weighted `30/30/20/20` (quantity/coverage/evenness/edge) → 0-100.

**Pieces** (available only for Margherita): each of mozzarella/basil scored via `scorePieceGroup` (`referenceMatching.ts`'s reviewed Hungarian assignment + `distanceSimilarity`, reused verbatim, not reimplemented), weighted `30` quantity-similarity / `70` placement-similarity per group, then averaged 50/50 across the two groups (provisional, documented as not a permanent per-ingredient weighting).

**Recipe correctness** (always computable, but gated to `available:false` alongside everything else when no Reference exists — see below): required ingredient *type presence* only (`countUsedIngredient(...) >= 1`), reusing the exact primitive `scoring.ts`'s legacy `matchScore` already uses. Deliberately **not** `minCount`-based — count/placement quality is Pieces' job, not Recipe correctness's. Pinned by three dedicated tests (`recipeComponent` describe block) including one that shows 1 mozzarella piece and 3 mozzarella pieces score *identically* on Recipe correctness while differing on Pieces' own `quantitySimilarity`.

**Bake**: `{ available: false, reason: "..." }`, unconditionally, every recipe, this phase. No reviewed Scoring 2.0 Bake similarity primitive exists yet (`bake.ts` only has the categorical `classifyBake`; the continuous formula lives inline inside legacy `scoring.ts`'s `scorePizza` and was not extracted/repurposed, per the Fresh Audit's own Bake scope guard). Legacy Bake scoring is untouched.

**Total**: `Sauce×65 + Pieces×20 + Recipe×15`, over 100 — mirrors the task's own cited "Fresh Audit's Margherita-only 65/20/15 calibration split", mapped Sauce/Pieces/Recipe. Bake is excluded from the total (provisional, not yet scoreable) rather than silently redistributed into the other three's weights. Explicitly documented in `index.ts` as **not** the permanent four-category (Recipe/Sauce/Pieces/Bake) global weighting.

### Reused primitives (not reimplemented)

- `referenceMatching.ts`: `scorePieceGroup`, `distanceSimilarity`, and (newly exported, no behavior change) `clamp01`/`smoothstep`.
- `sauceField.ts`: `computeSauceMetrics` (the only place `SauceMetrics` is derived from raw deposits).
- `sauceEvaluation.ts`: `EDGE_GREAT`/`EDGE_POOR` (newly exported, no behavior change) — the player-facing ふち tier and Shadow's edge sub-score now provably agree, not just coincidentally.
- `scoring.ts`: `countUsedIngredient`.

Two small, additive, behavior-preserving export changes were made to unlock this reuse (verified via full test suite + typecheck both before and after): `referenceMatching.ts` exports `clamp01`/`smoothstep`; `sauceEvaluation.ts` exports its six tier-threshold constants. Neither changes any existing runtime behavior.

## Fresh Audit P0/P1 Resolution

**P0-1 (Reference availability)** — Confirmed: `data/referencePizza.ts`'s `getReferencePizza` returns non-null only for `"margherita"`, `null` for every other `RecipeId` (including unknown ids), pinned by its own pre-existing test (`referencePizza.test.ts`). `computeScoringV2Shadow` checks this first and returns `available:false, totalScore:null` with every Reference-dependent component `{available:false, reason}` for every other recipe — never a fabricated number. Verified for all 6 non-Margherita recipes (`scoringV2.test.ts`).

**P0-2 (Canonical bake-time computation)** — Confirmed the risk: `App.tsx`'s `sauceMetrics`/`sauceShadowScore`/`pieceShadowMetrics` `useMemo`s (lines ~356-376 pre-PR) read `pendingSauceDeposits` (uncommitted, live-preview-only state) and are gated by `referenceModeEnabled = referencePizza !== null && !isMissionActive` — i.e. explicitly off during any Mission round. Scoring 2.0 Shadow is instead computed **exactly once**, inside `gameReducer.ts`'s `CONFIRM_BAKE` case, from the `pizza` object that was just assembled with the confirmed `bakeResult` — the same object `scorePizza` (legacy) scores one line later. `CONFIRM_BAKE` is the one action both FREE and Lunch Rush dispatch (no separate Mission scoring path exists in the reducer), so this is correct for both by construction, not by parallel wiring that could drift.

**P1-1 (Tolerance-band validation)** — `tolerance.ts`'s `safeToleranceSimilarity`/`isValidToleranceBand` reject `zero <= full`, non-finite bounds, and negative radii, returning exactly `0` (finite) rather than propagating into `distanceSimilarity`'s own unguarded smoothstep division. Applied at both the Sauce and Pieces component level. Pieces additionally validates `group.matching`'s radii before calling the reused Hungarian matcher — see "Known limitations" for what this specifically guards against.

**P1-2 (PAINT_TEMPORARY parity)** — Verified in `PizzaStage.tsx`: the dispense session gate (`wantsProfileDispense`) is keyed only on `sauceInteractionProfile.ingredientId`, never on `interaction: "PAINT" | "PAINT_TEMPORARY"` — both profiles commit through the identical `COMMIT_SAUCE_DISPENSE` → `sauceDeposits` path. Pinned with a dedicated test showing the Sauce component produces identical output for the same deposit shape regardless of which profile it notionally came from (the component never receives the interaction kind at all — by construction, not by assumption).

**P1-3 (Evenness/edge without new Reference fields)** — No new field was added to `ReferencePizza`/`ReferenceSauce`. Evenness reads `SauceMetrics.evenness` directly (already self-normalized). Edge reuses the exact `EDGE_GREAT`/`EDGE_POOR` absolute thresholds the existing player-facing ふち tier already defines.

## Golden Matrix

All rows: Margherita, `computeScoringV2Shadow`, exact numbers from a live test run (`src/logic/scoringV2/scoringV2.test.ts`'s fixtures).

| Case | Total | Sauce | Pieces | Recipe | Why |
|---|---:|---:|---:|---:|---|
| **perfect** (exact Reference sauce fixture + exact Reference piece positions) | **99.4** | 99.1 | 100 | 100 | Reference-exact by construction — the ceiling case. |
| **concentrated dump** (same total sauce quantity as the fixture, all 46 ticks at one point; Reference-exact pieces) | 76.0 | 63.1 | 100 | 100 | Right *amount*, wrong *distribution* — quantitySimilarity stays 1, but coverage (0) and evenness (0.65) both crater. |
| **good** (broad ring, ~half the fixture's total quantity; slightly-off-reference piece positions) | 63.2 | 43.4 | 100 | 100 | Under-delivers on quantity (0 similarity) but the spread that *was* applied is reasonably even and inside the rim. |
| **too little** (a single light 2-dab stroke; Reference-exact pieces) | 52.5 | 27.0 | 100 | 100 | Both quantity and coverage read as "missed the target" almost entirely. |
| **edge/overflow** (ring painted at radius 44, beyond the target rim but still on the dough; Reference-exact pieces) | 46.9 | 18.3 | 100 | 100 | Edge sub-score collapses to 0 — "touched the ear" is treated as seriously as missing the pizza. |
| **poor** (10-tick off-center dump; mozzarella/basil both badly displaced, one placed each) | 40.0 | 33.1 | 17.5 | 100 | Badly wrong on *both* Sauce and Pieces simultaneously. |
| **empty** (nothing placed at all) | **0** | 0 | 0 | 0 | Presence gates + zero-distance tolerance bands drive every sub-metric to exactly 0 — not a placeholder-propped-up partial credit. |

**Ordering assertion actually pinned by tests**: `perfect (99.4) > good (63.2) > poor (40.0) > empty (0)`, all finite — exactly the Fresh Audit's minimum ordering requirement.

**Known calibration nuance** (documented honestly, not hidden): `concentrated` (76.0) currently outscores `good` (63.2) even though a "dumped in one spot" gesture reads as the more obviously wrong mistake to a human. This is a direct, explainable consequence of the 30/30/20/20 sauce sub-weights: `concentrated` gets *full* quantity credit (the right total amount was dispensed, just badly distributed), while `good`'s quantity is genuinely short of target. Both are real, distinct mistakes; this calibration currently weighs "wrong total amount" more heavily than "right amount, bad distribution". See "Recommended next calibration step".

## Reused-primitive robustness finding (fixed defensively, not by editing the primitive)

While building the "Infinity/NaN cannot escape the public API" test, a pathological pizza (non-finite topping coordinates) fed into `referenceMatching.ts`'s existing Hungarian-assignment matcher (`minimumCostColumns`, from Phase 4A-1B) **hung indefinitely** — a NaN/Infinity cost breaks the algorithm's termination invariant, and a synchronous infinite loop in JS cannot be preempted by a test timeout. This is a pre-existing latent gap in a reviewed primitive, not something this PR introduced.

Fix applied at the Scoring 2.0 boundary only (`piecesComponent.ts`'s `scorePieceGroupV2`): toppings with non-finite `x`/`y` are filtered out *before* they ever reach the Hungarian matcher, rather than "sanitized" into some substitute finite value. In real gameplay this can never actually trigger — `PLACE_TOPPING` (`gameReducer.ts`) already rejects non-finite coordinates before they reach canonical state — so this is defense-in-depth, not a fix for an observed gameplay bug. The underlying primitive itself was **not modified** (out of this PR's scope — it's Phase 4A-1B reviewed code, and Live-preview `referenceScoring.ts` also calls it with data that's always already reducer-validated). Flagged below as a recommended follow-up.

## Integration

- `src/state/gameReducer.ts`: `GameState.scoringV2Shadow` field + one `computeScoringV2Shadow(state.recipe, pizza)` call site, inside `CONFIRM_BAKE`, right after the existing `scorePizza`/`classifyBake` calls. No other reducer case touches it except the shared `buildOrderState` reset.
- `src/screens/GameScreen.tsx`: renders `<ScoringV2ShadowPanel result={state.scoringV2Shadow} />` whenever `state.phase === "RESULT"` — deliberately **not** gated on `isMissionActive`, so it shows for both FREE's `ResultPanel` and Lunch Rush's `MissionServePanel`/`MissionResultOverlay` paths alike.
- `src/components/ScoringV2ShadowPanel.tsx`: the panel itself, internally gated on `import.meta.env.VITE_PREVIEW_MODE` (the project's existing Preview/Production SSOT — same mechanism as `PreviewBadge.tsx`/`SauceMetricsPanel.tsx`), so nothing about its call site needs its own gate.

## FREE result

Live end-to-end browser run (see "Mobile check" below), Preview build, Margherita, hand-painted sauce (a rough circular drag, not the ideal fixture) + 3 mozzarella + 2 basil:

- Legacy RESULT: ★4, **89**, 焼き加減: 生焼け (under-baked — bake bar 62%, matches the deliberately-undercooked test gesture).
- Scoring 2.0 Shadow: **Total: 58 / 100** — Sauce 35, Pieces 100, Recipe 100, Bake N/A. Sub-detail: 量 0%, 被覆 0%, 均一性 77%, ふち 100%.
- Legacy and Shadow numbers are visibly on different scales/formulas, as intended — no confusion between the two in the UI (the Shadow panel is a separate box, explicitly labeled, below the legacy `ResultPanel`/register button).

## Lunch Rush result

Deterministic integration test (`gameReducer.test.ts`, `"Lunch Rush: CONFIRM_BAKE computes the Shadow result..."`): with `ownedIngredientIds` restricted to exactly Margherita's requirements (so Mission's own recipe rotation has nothing else to pick), `MISSION_RESET_ORDER` → `BEGIN_PREPARE` → `COMMIT_SAUCE_DISPENSE` (ideal fixture) → `PLACE_TOPPING` × 5 (exact Reference positions) → `START_BAKE` → `CONFIRM_BAKE` produces `state.isMissionRound === true`, `state.scoringV2Shadow.available === true`, `state.scoringV2Shadow.totalScore > 90`.

Live browser run: Lunch Rush's own "never repeat the just-active recipe" rule (`pickMissionOrder`, pre-existing Phase 3C-4 behavior) means a Mission started fresh from FREE-mode Margherita can never draw Margherita as its *first* order — confirmed by 8 consecutive live attempts, none landing on Margherita for round 1 (フンギ/マリナーラ/ジェノベーゼ/クアトロ フォルマッジ, in rotation). The browser run instead exercises and confirms the **Reference-unavailable path** for Lunch Rush (Marinara): Shadow panel renders "Reference unavailable" cleanly inside the Mission `MissionServePanel` layout, no crash, no console error, no overflow at 390×844. Combined with the deterministic unit test above (which *does* force Margherita), both the "available" and "unavailable" Lunch Rush Shadow paths are verified — one at the unit level, one live in-browser.

## Legacy-isolation evidence

- `gameReducer.test.ts`: `state.score` after `CONFIRM_BAKE` is asserted `toEqual` a fresh direct call to `scorePizza(state.recipe, state.pizza)` — byte-for-byte identical, proving `scoringV2Shadow`'s computation runs alongside, not instead of, legacy scoring.
- Dex BEST/timesMade (`REGISTER_TO_DEX`): asserted driven only by `state.score.total`/`.stars`, with an explicit assertion that the registered `bestScore` is *not* the Shadow total (different scale, would only coincide by accident if they were confused).
- Mission serve metrics (`recordServe`): asserted driven only by `state.score.total`, never `scoringV2Shadow.totalScore`.
- All 518 pre-existing tests still pass unmodified (no assertion in the pre-existing suite was weakened or removed to make this land) — see Test totals below.

## Save-schema evidence

- `src/state/persistence.ts` was **not modified** in this PR. `PersistentSaveV1`'s shape (`schemaVersion`, `dex`, `pitzBalance`, `ownedIngredientIds`, `missionBest`) is unchanged.
- New tests (`persistence.test.ts`, "Save schema unaffected by Scoring 2.0 Shadow"): `createDefaultSave()`'s key set is exactly the pre-existing five; `persistProgress`'s written JSON is asserted to never contain `/scoringV2/i` or `/shadow/i`; `loadSave` round-trips the same key set regardless of what `GameState.scoringV2Shadow` the in-progress round currently holds (which was already true before this PR — `GameState` itself has never been serialized).

## Production debug-gating evidence

- `npx vite build` (no `VITE_PREVIEW_MODE`): `grep -c "Scoring 2.0 Shadow" dist/assets/*.js` → **0**. `grep -c "scoring-v2-panel"` → **0** (CSS class also absent). The *computation* itself (`rulesetVersion`/`phase-4a-2-shadow-1` string) is present once, by design — only the debug **UI** is gated, the Shadow computation always runs at `CONFIRM_BAKE` in every build (cheap, invisible, harmless).
- `VITE_PREVIEW_MODE=true npx vite build`: both strings present in the bundle, confirming the gate isn't simply "always off".
- Live browser confirmation (production `vite preview`, no env var): 0 occurrences of "Scoring 2.0 Shadow" text, 0 occurrences of the `PREVIEW` badge, 0 console errors, clean RESULT screen through a full FREE Margherita round.

## Browser verification (390×844, Chromium)

All flows run against a real dev/build server with a real headless Chromium at exactly 390×844.

| Flow | Preview build | Production build |
|---|---|---|
| HOME → FREE → Margherita → make pizza → BAKE → RESULT | Shadow panel visible, Total shown, no overflow | Shadow panel absent, clean RESULT |
| Lunch Rush → (Marinara, per Mission's own anti-repeat rule) → BAKE | Shadow panel visible, "Reference unavailable" shown, MissionServePanel unaffected | *(same gate as FREE — production build only tested once for the shared code path; both screens render through the identical internally-gated component)* |
| Lunch Rush → Margherita → CONFIRM_BAKE | *(not reproducible live in one session — see above)* verified deterministically via `gameReducer.test.ts` instead | — |

Console errors across every run: **0**. No horizontal overflow at 390px in any screenshot. RESULT screens do scroll vertically in Preview mode once the Shadow panel is appended below the existing legacy panel/button — this is the panel's own additional content, only ever present in Preview builds, and does not affect the Production layout at all (verified: Production RESULT screen is pixel-identical in structure to pre-PR, just without the panel).

## Codex P1 Blocker Fix

**Original blocker** (Codex broad review, PR #31, reviewed HEAD `d3d2ce734c2efa4a587804c837ccfa3e13d14bf1`, verdict "B. FIX BLOCKERS THEN VERIFY"): *Malformed array containers/elements can still throw instead of Scoring 2.0 failing closed.* No `docs/reports/TETO_PR-31_SCORING-2_Shadow_Codex-Review.md` was present in the working tree, so this was independently reproduced from the blocker description before any fix was written.

**Root cause.** Every original Scoring 2.0 component function assumed its `pizza`/`reference` collection arguments were genuinely well-formed arrays of well-formed elements — true for every real caller (`gameReducer.ts`'s `CONFIRM_BAKE` always passes a canonical, reducer-validated `PizzaState`; `referencePizza.ts`'s `ReferencePizza` is static authored config), but each function is independently exported/public, so nothing enforced that at the module boundary itself. Three concrete throw sites were confirmed by reproduction before any fix:

1. `scorePieceGroupV2`'s own pre-existing `isFinitePoint(point)` guard (added for the original P0/P1 pass) itself read `point.x`/`point.y` unconditionally — a `null` array element (`toppings: [null]`) threw *inside the guard meant to protect against exactly this class of bad data*.
2. A non-array `toppings`/`groups`/`sauceIds` container (`null`, `undefined`, an object, a string) reaching any `.filter`/`.map`/`for...of` in `piecesComponent.ts`, `recipeComponent.ts`, or `../scoring.ts`'s `countUsedIngredient` (called from `recipeComponent.ts`) threw a `TypeError` immediately.
3. **Unvalidated Reference positions.** `group.positions` was never sanitized before reaching `../referenceMatching.ts`'s Hungarian assignment (`minimumCostColumns`) — a malformed/non-finite Reference position (not just a malformed *player* topping, which the original P0/P1 pass already guarded) reproduces the exact NaN-cost-matrix hang documented in this report's "Reused-primitive robustness finding" section, this time from the Reference side rather than the player side.

Any of these, reached from `computeScoringV2Shadow` (the one call site inside `gameReducer.ts`'s `CONFIRM_BAKE` case), would either crash the reducer (breaking the whole round, not just the Shadow number) or hang the tab.

**Normalization/validation approach.** New module `src/logic/scoringV2/boundary.ts`: a small set of pure sanitizers (`toSafeArray`, `isFiniteCoordinate`, `sanitizeCoordinates`, `sanitizeSauceDeposits`, `sanitizeToppings`, `sanitizeStringArray`, `sanitizeObjectArray`) that normalize `unknown` input into a clean, always-well-formed array — a non-array container becomes `[]`, a malformed/null/primitive element is *dropped* (never coerced into a substitute value that could read as real data), and every coordinate is required to be a finite number (`Number.isFinite` rejects NaN and both signs of Infinity). Applied at every public Scoring 2.0 boundary that consumes a collection:

- `index.ts`: `pizza` itself falls back to `createEmptyPizza()` if it isn't a non-null object; `pizza.sauceDeposits` is sanitized before `computeSauceMetrics` (legacy `../sauceField.ts`, not modified).
- `piecesComponent.ts`: `scorePieceGroupV2` now treats *both* its `toppings` and `group` arguments as `unknown` internally (real callers keep the typed signature) — `group.positions` is sanitized via `sanitizeCoordinates` before ever reaching `scorePieceGroup`'s Hungarian matcher, `group.matching`'s radii are read defensively (missing/wrong-typed → `NaN` → already fails `isValidToleranceBand`), and `toppings` goes through `sanitizeToppings`. `scorePiecesComponentV2`'s `groups` container is normalized via `toSafeArray` before `.map`.
- `recipeComponent.ts`: `recipe.requiredIngredients` is normalized and element-validated before use; `pizza.sauceIds`/`pizza.toppings` are sanitized into a minimal stand-in *before* being handed to `../scoring.ts`'s `countUsedIngredient` — that legacy primitive itself was **not modified** (out of scope, and modifying it would touch authoritative `scorePizza` too).

**Adversarial cases added** (`src/logic/scoringV2/malformedInput.test.ts`, new file, 136 tests): null/undefined/object/string/number/boolean containers (`MALFORMED_CONTAINERS`, 6 shapes × every sanitizer + every consuming function); null/undefined/primitive/missing-field/wrong-type/NaN/+Infinity/-Infinity elements (`MALFORMED_ELEMENTS`, 14 shapes); malformed Reference positions (mixed valid+invalid, feeding the Hungarian matcher); malformed `group.matching` (missing entirely, wrong-typed radii); mixed valid+invalid elements in the same array (pinning that a good element survives alongside dropped bad ones, in order); an "everything malformed at once" case across every collection on the pizza simultaneously; empty arrays; and a `pizza` argument that is itself `null`/`undefined`. Every case asserts `not.toThrow()` and a finite result; the Reference-position and full Hungarian-matcher paths are additionally run under the same `timeout 60 npx vitest run` hard-timeout discipline used to catch the original hang, confirming none of these cases hang either.

**Exact tests.** New file `src/logic/scoringV2/malformedInput.test.ts`: **136 tests**, all passing. Combined with the rest of the suite: see updated Test totals below.

**Valid-input Golden Matrix confirmed unchanged.** `malformedInput.test.ts`'s own "Permutation invariance and Golden Matrix survive the boundary fix unchanged" block re-asserts piece-permutation invariance and `perfect > empty` (`empty.totalScore === 0`) post-fix; every pre-existing test in `scoringV2.test.ts` (30 tests, including the full perfect/good/poor/empty Golden Matrix ordering) still passes unmodified — no assertion was weakened or loosened to accommodate the fix.

**Legacy authority / save isolation confirmed unchanged.** No file under `../scoring.ts`, `../bake.ts`, `../missionScoring.ts`, `src/state/dex.ts`, `src/state/persistence.ts`, or `src/mission/lunchRush.ts` was touched by this fix. `gameReducer.test.ts`'s pre-existing legacy-isolation tests (score/stars/Dex BEST/Mission-serve assertions) and `persistence.test.ts`'s save-schema tests all still pass unmodified.

## Test totals

- Before PR #31 (baseline, confirmed at audited main SHA): **39 test files, 518 tests, all passing**.
- After PR #31's original implementation (`d3d2ce7`): **41 test files, 563 tests, all passing**.
- After the Codex P1 blocker fix (this update): **42 test files, 699 tests, all passing** (+1 file, +136 tests: `malformedInput.test.ts`, all adversarial regression cases; 0 tests weakened or removed anywhere in the suite).
- `npx tsc -b`: clean, no errors.
- `npx oxlint`: clean, no warnings.
- `npx vite build`: succeeds, production bundle confirmed free of Shadow debug UI (see above; re-confirmed after this fix).
- `git diff --check`: clean, no whitespace errors.

## Known limitations

1. **`docs/reports/TETO_PHASE-4A-2_SCORING-2_Fresh-Audit.md` does not exist in the repo.** This implementation worked from the P0/P1 contracts embedded in the task instructions, independently re-verified against current-main source (see "Fresh Audit P0/P1 Resolution"). A real audit document should still be authored and reconciled against this report before Phase 4A-3 planning.
2. ~~**Hungarian-matcher NaN/Infinity hang**~~ — **addressed at the Scoring 2.0 boundary by the Codex P1 blocker fix above**, for both the player-topping side (original P0/P1 pass) and the Reference-position side (this fix). `../referenceMatching.ts`'s `minimumCostColumns` primitive itself is still unfixed at its source — a malformed cost could still hang it if some *other*, non-Scoring-2.0 caller ever fed it unsanitized data directly (currently only `referenceScoring.ts`'s live-preview path calls it, always with reducer-validated `PizzaState` data). Recommend a small, isolated follow-up PR to harden the primitive itself so every caller benefits, not just Scoring 2.0's own boundary.
3. **Bake is fully unavailable this phase** — no reviewed Scoring 2.0 Bake similarity primitive exists; `totalScore` is a 3-component (Sauce/Pieces/Recipe) weighted sum, not yet the full four-category model the architecture is designed for.
4. **Calibration nuance**: a full-quantity-but-badly-distributed sauce dump can currently outscore a well-distributed-but-under-quantity spread (see Golden Matrix). Both are legitimate distinct mistakes; the 30/30/20/20 sauce sub-weights simply favor correcting quantity over distribution right now.
5. **Lunch Rush → Margherita was not reproducible live in a single browser session** due to Mission's own pre-existing "never repeat the just-active recipe" rule combined with the session always starting on Margherita in FREE mode; covered instead by a deterministic reducer-level integration test, plus a live run against Lunch Rush's Reference-unavailable path (Marinara) exercising the exact same rendering code.
6. **`scorePiecesComponentV2`'s equal 50/50 weighting** across mozzarella/basil groups is provisional — documented in-code as not a claim that every future ingredient type should weigh the same.

## Recommended next calibration step

Before any Phase 4A-3 integration decision: run the iPhone Human Feel calibration gate from Issue #30 (good balanced recreation / too little sauce / too much sauce / concentrated-uneven / rim overflow / clustered toppings / well-distributed toppings) against this exact Shadow formula, specifically probing the "concentrated dump vs. good-but-under-quantity" ordering nuance above — if a real player's intuition disagrees with it, retune the Sauce sub-weights (or split "quantity" into a two-sided over/under tolerance rather than one symmetric band) before locking anything into Phase 4A-3's authoritative formula. Author the missing Fresh Audit document (or formally retire the reference to it) as part of that same follow-up, so future phases have a real SSOT to build from instead of this report's own reconstruction.
