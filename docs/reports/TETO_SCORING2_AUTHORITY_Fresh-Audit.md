# Scoring 2.0 Authority — Fresh Audit

READ-ONLY / DESIGN ONLY. No production code was changed as part of this audit.

## 0. Scope and baseline

- Audited SHA: `2da3949de5bd642c709ca6ba343bc57d8101d03d` (fresh `origin/main`, confirmed identical via `git rev-parse HEAD` / `git rev-parse origin/main` — no drift to reconcile). This is the same SHA PR #51 (Issue #33 D0 revalidation) and PRs #52/#53 were audited against.
- Parallel, untouched work confirmed open at this SHA and explicitly not read for editing or modified by this audit: **PR #54** (Issue #33 D1 Dough Shaping implementation), **PR #52** (Issue #38 Pitz Reward Fresh Audit, docs-only), **PR #53** (Save v2 / Inventory Fresh Audit, docs-only). No file under Dough (`doughShape.ts`, `PizzaStage.tsx` dough gesture code), Save (`persistence.ts`), Inventory, or Economy (`economy.ts`) was edited here — `economy.ts` was read only, to confirm its current inputs.
- Also present, older and **not based on current `main`** (base SHA `6248108…`, well before Issue #32/#47's later merges): **PR #34** ("Issue #32 Phase 1: unify Reference ingredient visuals"). It is a visual-only change (physical ingredient rendering parity), not a scoring change, and does not affect this audit's readiness verdict either way. It is stale against current `main` and out of this audit's scope to reconcile.
- Read for this audit: Issue #22 (SSOT), Issue #32, Issue #38, `docs/PROJECT_HANDOFF.md`, `docs/reports/TETO_PHASE-4A-2_SCORING-2_Shadow_Result.md`, `docs/reports/TETO_PHASE-4A-2_SCORING-2_iPhone-Calibration.md`, `docs/reports/TETO_ISSUE-32_RECIPE-CORRECTNESS_Fresh-Audit.md`, plus current-main source: `src/logic/scoring.ts`, `src/logic/scoringV2/*`, `src/state/gameReducer.ts`, `src/state/dex.ts`, `src/state/progression.ts`, `src/logic/mastery.ts`, `src/logic/missionScoring.ts`, `src/logic/economy.ts`, `src/mission/lunchRush.ts`, `src/data/referencePizza.ts`, `src/data/recipes.ts`, `src/components/ScoringV2ShadowPanel.tsx`, `src/screens/GameScreen.tsx`, `src/components/DexOverlay.tsx`, `src/state/pizzaSelect.ts`.

---

## 1. Current authority map

Every one of the following is driven by exactly one field: `GameState.score` (type `ScoreBreakdown`, `src/logic/scoring.ts`), written once per round by `scorePizza(recipe, pizza)` inside `gameReducer.ts`'s `CONFIRM_BAKE` case (`gameReducer.ts:433`).

| Consumer | Authority today | Evidence |
|---|---|---|
| RESULT (FREE) | legacy `state.score` | `GameScreen.tsx:404` — `<ResultPanel score={state.score} ...>` |
| RESULT (Lunch Rush) | legacy `state.score` | `GameScreen.tsx:397` — `MissionServePanel` also receives `state.score` |
| stars | legacy `state.score.stars` (`capStarsForBake` already applied inside `scorePizza`) | `scoring.ts:111` |
| BEST (Dex) | legacy `state.score` via `registerScoreToDex` | `gameReducer.ts:450` (`REGISTER_TO_DEX`), `gameReducer.ts:508` (`MISSION_NEXT_ORDER`) both call `registerScoreToDex(dex, recipeId, state.score)`; `dex.ts:66-94` is the only place `bestScore`/`bestStars` are ever written |
| Dex records (`discovered`, `timesMade`) | legacy `state.score` (indirectly — presence of a call, not its value, drives `discovered`/`timesMade`, but the call itself requires `state.score` to exist) | `dex.ts:73-93` |
| Pizza Dex UI (`★` + `BEST N`) | Dex's `bestStars`/`bestScore` (i.e. transitively legacy) | `DexOverlay.tsx:79-80` — `starLabel(entry.bestStars)` / `BEST {Math.round(entry.bestScore)}` |
| Pizza Select UI (`★` badges) | Dex's `bestStars`/`bestScore` (i.e. transitively legacy) | `pizzaSelect.ts:14,43` — `COMPLETED` state carries `bestStars`/`bestScore` straight from the Dex entry |
| progression (ingredient unlocks / recipe availability) | `totalStars(dex)`, i.e. transitively legacy | `mastery.ts:19-21` sums `dex[].bestStars`; `progression.ts:25-33`'s `ingredientState` gates `AVAILABLE_TO_BUY` on that sum |
| mission completion / Mission Score | legacy `state.score.total` | `App.tsx:260` — `missionDispatch({ type: "SERVE", qualityTotal: state.score.total, ... })`; `lunchRush.ts:169` feeds it into `recordServe` (`missionScoring.ts:29`), whose `missionScore`/`isNewMissionBest` are the Mission-run-level authority |
| Lunch Rush (per-pizza serve metrics + per-run Mission BEST) | legacy `state.score.total`, same chain as above | same |
| Pitz (today) | **not driven by any per-pizza score at all** — `calculateMissionReward` (`economy.ts:56-63`) is a per-*run* formula over `MissionMetrics` (`servedCount`/`averageQualityScore`, itself built from legacy `state.score.total` via `recordServe`). FREE mode has no Pitz path today. | `economy.ts:22-32,56-63` |
| Save persistence | writes Dex (`bestScore`/`bestStars`/`timesMade`/`discovered`) and `pitzBalance`, both transitively legacy-derived; never writes `GameState`/`scoringV2Shadow` itself | `persistence.ts` (confirmed unmodified structure per Shadow Result report's "Save-schema evidence"; independently re-confirmed here that no `src/state/persistence.ts` edit exists at this SHA) |

**Every legacy `scorePizza()` consumer in production code, found by exhaustive grep (`scorePizza\(` across `src/`, excluding tests):**

1. `src/state/gameReducer.ts:433` — the *only* production call site. Everything above is downstream of this one call, transitively, through `state.score`.

There is no second, parallel legacy scoring path anywhere in production code (App.tsx, screens, missions) — the reducer is the single choke point.

`GameState.scoringV2Shadow` (`ScoringV2Result | null`) is computed once per round at the same `CONFIRM_BAKE` site (`gameReducer.ts:439`), immediately after `scorePizza`, from the same canonical `pizza` object. It currently feeds exactly one consumer: `ScoringV2ShadowPanel` (`GameScreen.tsx:411`), which is itself gated on `import.meta.env.VITE_PREVIEW_MODE` and renders `null` in production (`ScoringV2ShadowPanel.tsx:64`, pinned by a production-build grep test per the Shadow Result report). No Dex, Mission, Pitz, Save, or star-derived code path reads `scoringV2Shadow` today. This isolation is independently re-confirmed here, not just cited from the prior report — the grep for `scoringV2Shadow` across `src/` (production and test files) returns only `gameReducer.ts`, `GameScreen.tsx`, and their own test files.

---

## 2. Scoring 2.0 readiness

`src/logic/scoringV2/` computes `ScoringV2Result` via `computeScoringV2Shadow(recipe, pizza)` (`index.ts`), ruleset version `phase-4a-2-shadow-2` (bumped from `-shadow-1` by the iPhone-Calibration Option 1 fix, already landed on `main`).

### Component map vs. the four accepted invariants

| Invariant (as previously accepted) | Current code | Status |
|---|---|---|
| Recipe = ingredient type correctness/purity | `recipeComponent.ts` — required-type *presence* (not count), diluted by a purity multiplier for distinct extra/unspecified ingredient types (Issue #32 fix, already on `main`) | **Confirmed true**, unchanged since the Shadow Result report |
| Sauce = sauce execution quality | `sauceComponent.ts` — quantity/coverage (tolerance-band similarity vs. Reference) + evenness + edge/rim (both presence-gated), weighted 30/30/20/20 | **Confirmed true**, unchanged |
| Pieces = quantity + placement | `piecesComponent.ts` — per-group `30×quantitySimilarity + 70×placementSimilarity×overQuantityGate`, Hungarian-matched, permutation-invariant, averaged 50/50 across mozzarella/basil | **Confirmed true**, and the one known calibration defect from the iPhone-Calibration report (severe over-quantity retaining placement credit, "Case E") **has already been fixed and merged** (the asymmetric over-quantity gate, `overQuantityPlacementGate`, `piecesComponent.ts:35-41`) |
| Bake = bake quality | `BakeComponentV2 = ScoringV2Unavailable`, **unconditionally, for every recipe, always** (`index.ts:39-40,58`) | **Not true — Bake does not exist in Scoring 2.0 at all.** This is not a calibration gap, it is a missing component. See §3/§7. |

### Is Dough intentionally absent?

Yes, confirmed intentional and correctly scoped out — not a defect. `scoringV2/` has no Dough-related field, type, or component anywhere; Issue #33/#37 (Dough Shaping, PR #54, in progress in parallel) explicitly track Dough as its own future concern with its own D1→D2 roadmap, and every Dough report/PR reviewed for this audit (`TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md`'s scope guard, PR #54's own "Scope guard" section) explicitly excludes "Dough scoring" from its own deliverable. Scoring 2.0's total is a 3-component model today (Sauce/Pieces/Recipe) specifically *because* Bake was never added, not because Dough was omitted — Dough was never in scope to begin with. These are two independent gaps; conflating them would be a mistake.

### Reference coverage

`getReferencePizza` (`data/referencePizza.ts`) returns a non-null `ReferencePizza` for **`"margherita"` only** — confirmed against `recipes.ts`'s full 7-recipe list (`margherita`, `marinara`, `quattro-formaggi`, `genovese`, `bismarck`, `funghi`, `fugazza`). For every other recipe, `computeScoringV2Shadow` returns `available: false, totalScore: null` unconditionally (`index.ts:61-75`), regardless of how well the pizza was made. This is pinned by `scoringV2.test.ts:454-461` for all 6 other recipes per the Recipe-Correctness Fresh Audit's own table (independently re-confirmed here by reading `referencePizza.ts` directly, not just cited).

This means: **today, Scoring 2.0 can only ever produce a usable score for 1 of the game's 7 recipes.**

---

## 3. Shadow calibration status

- The **Shadow Result report** (PR #31) and the **iPhone-Calibration report** (PR #31 follow-up) together document: an initial 6-pizza real-iPhone calibration set, one concrete calibration defect found ("Case E" — severe topping over-quantity retaining most of its placement credit), three bounded fix options analyzed, Option 1 (asymmetric over-quantity gate inside Pieces) selected and **implemented and merged to `main`** (ruleset bumped to `phase-4a-2-shadow-2`), with full regression coverage (focused Pieces tests, Golden Matrix, malformed/adversarial suite, FREE/Lunch Rush integration, full Vitest suite, typecheck, lint, production build all green per that report's own verification table).
- Independently re-confirmed here by reading current `piecesComponent.ts` source: the gate (`overQuantityPlacementGate`) is present exactly as documented, and its rationale/tests are consistent with the report.
- One documented, explicitly-accepted calibration **nuance** (not re-litigated by this audit, per the task's "do not restart coefficient tuning merely because more tuning is possible" instruction): a full-quantity-but-badly-distributed ("concentrated dump") sauce gesture can currently outscore a well-distributed-but-under-quantity one (Sauce component only). The iPhone-Calibration report explicitly recommends treating this as a "monitored secondary calibration issue," not blocking further work, and this audit agrees — it is a **NICE-TO-HAVE**, not a blocker: it affects relative ordering within the Sauce sub-score only, does not produce nonsensical/unbounded/negative results, and does not break monotonicity of the overall Golden Matrix (`perfect > good > poor > empty` still holds).

### BLOCKER vs. NICE-TO-HAVE vs. future Dough integration

**BLOCKER** (must be resolved, or explicitly designed around, before any authority claim):
1. **Reference/Bake absence.** Scoring 2.0 has no Bake component at all, for any recipe. Legacy Bake is currently weighted 30/100 — the single heaviest legacy weight. Replacing legacy with Scoring 2.0 as-is would silently remove bake skill from the score entirely, which is a bigger behavior change than any calibration nuance and was never explicitly decided as a product choice in any read report.
2. **Reference coverage.** Scoring 2.0 is `available` for exactly 1 of 7 recipes. A literal "make Scoring 2.0 authoritative" replacement would make RESULT/stars/BEST/Dex/progression **stop working** (no score, no stars, nothing to register) for 6 of 7 recipes the moment it's wired in.

**NICE-TO-HAVE** (do not block, no action required by this audit):
1. The concentrated-dump-vs-under-quantity Sauce ordering nuance (§3 above).
2. `scorePiecesComponentV2`'s equal 50/50 mozzarella/basil weighting, already documented in-code as provisional (`piecesComponent.ts:138-141`) but not shown to produce any wrong ordering in evidence gathered so far.

**Future Dough integration** (explicitly out of this audit's design scope, tracked separately under Issue #33/#37 D2+): once Dough shaping (PR #54, in progress) lands and stabilizes, a future Dough-quality component could be added to Scoring 2.0 the same way Bake eventually needs to be — but this audit does not design that, per the task's own instruction.

---

## 4. Authority cutover design

### Where the switch belongs

The smallest, safest switch point is **exactly where legacy scoring already lives**: `gameReducer.ts`'s `CONFIRM_BAKE` case. This is already the single choke point (§1) — every RESULT/Dex/Mission/progression consumer reads `state.score`, never `scorePizza` or any UI-local computation directly. A cutover therefore only ever needs to change **what `state.score` is populated from**, not any downstream consumer, provided the replacement is shaped as a `ScoreBreakdown` (or `ScoreBreakdown` continues to be derived from it at this one point). This matches the task's own preference for "one authoritative score calculation at the domain/reducer boundary rather than UI-specific selection" — the boundary already exists and is already exclusive; nothing needs to be built to create it.

Concretely, this means an eventual authority adapter is a **pure function `ScoreBreakdown` derivable from `ScoringV2Result`** (or, if the Bake/coverage blockers below are resolved by extending `ScoringV2Result` itself, `state.score` becomes a direct read of the new authoritative computation) called from the same `CONFIRM_BAKE` line that currently calls `scorePizza`. No reducer case other than `CONFIRM_BAKE` and the shared reset (`buildOrderState`) needs to change, mirroring how `scoringV2Shadow` itself was already wired in non-invasively.

### What should happen to each piece, once the BLOCKERs in §3 are resolved

- **Legacy `scorePizza()`**: **Option A — remain diagnostic temporarily.** Do not delete it in the same slice that flips authority. `scoring.ts`'s `ScoreBreakdown`/`starsFromTotal`/`capStarsForBake`/`starLabel` are reused by multiple other modules (`dex.ts`'s type import, `DexOverlay.tsx`'s `starLabel`) independent of who computes the *numbers* — keeping the legacy computation callable (even if no longer wired into `CONFIRM_BAKE`) costs nothing and gives a one-line rollback if the cutover surfaces a regression Preview/Human-Feel catches. Removing it is a separate, later cleanup slice (Option B), only after the cutover has been confirmed stable in production use, not bundled with the cutover itself.
- **Shadow diagnostics (`ScoringV2ShadowPanel`)**: once Scoring 2.0 is authoritative, a "Shadow" panel showing the same numbers RESULT now shows natively is redundant. Recommend retiring the *panel* (not the underlying `scoringV2` module) in the cleanup slice, or repurposing it to show the *previous* (legacy) score side-by-side for one transitional release, still Preview-only, if a side-by-side comparison is wanted during rollout.
- **RESULT**: reads whatever `state.score` is populated from — no RESULT-specific code change needed beyond what `CONFIRM_BAKE` already produces, since `ResultPanel`/`MissionServePanel` already only consume `state.score`, never `scorePizza` or `scoringV2Shadow` directly.
- **stars**: unchanged mechanism (`starsFromTotal` + `capStarsForBake`), just fed by the new authoritative total/bake-state pair instead of legacy's. `capStarsForBake`'s "not baked perfectly ⇒ never ★5" rule should be preserved as a product invariant regardless of which formula computes the underlying total, since it is a presentation rule about the *bake result*, not about which scoring formula produced the number.
- **BEST / Dex**: `registerScoreToDex` already only depends on the shape of `ScoreBreakdown` (`stars`, `total`), not on which formula produced it — no change needed to `dex.ts` itself.
- **missions/progression**: `recordServe`/`missionScore`/`totalStars`/`ingredientState` all already only depend on `state.score.total`/Dex `bestStars` — no change needed to `missionScoring.ts`, `mastery.ts`, or `progression.ts` themselves.
- **Lunch Rush**: same authority swap at the same single `CONFIRM_BAKE` site serves both FREE and Lunch Rush already (confirmed in §1 and re-confirmed by the Shadow Result report's own P0-2 finding) — no Lunch-Rush-specific wiring is needed.

---

## 5. Existing save compatibility

- **Save schema is not touched by this audit, and this audit recommends none be touched for the cutover itself.** `PersistentSaveV1`'s `dex` field already stores only `{ recipeId, discovered, bestScore, bestStars, timesMade }` — plain numbers, with no formula/version tag attached to `bestScore`/`bestStars` today. This is itself a pre-existing gap (not introduced by Scoring 2.0): the save format cannot currently distinguish "this BEST was earned under formula X" from "under formula Y." That is true regardless of whether Scoring 2.0 ever becomes authoritative — the audit surfaces it because a cutover is exactly the moment this gap first matters.
- **Recommended coexistence behavior**: do **not** retroactively rewrite historical `bestScore`/`bestStars` values on cutover, and do **not** invent a schema migration to tag old vs. new records unless a concrete product requirement emerges (the task explicitly says to avoid this "unless there is a compelling requirement," and none was found in any read source). A player's existing BEST stands as their BEST; new rounds played after cutover compute against the new formula and can only ever raise `bestScore`/`bestStars` from where they are (per `isBetterQuality`'s existing "BEST never goes down" rule, `dex.ts:55-58`) — this rule requires no change and already produces sensible behavior across a formula change, since it only compares the *new* round's score against the *stored* BEST, never re-derives the stored BEST.
- One real risk to flag, not a blocker: because the two total scales are calibrated independently (legacy's 90/75/60/40 star thresholds vs. Scoring 2.0's own `starsFromTotal`-style mapping, not yet defined for a merged Recipe+Sauce+Pieces+Bake total), a player's pre-cutover BEST and post-cutover new attempts may not feel numerically comparable even though both are "out of 100." This is a Human-Feel question for the eventual cutover PR to verify (does a post-cutover ★5/perfect pizza still feel like it should, relative to a pre-cutover ★5 record the player remembers?), not something this audit can resolve by design alone.
- Old-record/new-record coexistence is otherwise a non-event: no field renames, no dual-write, no versioning needed, because the Dex schema was already formula-agnostic by construction.

---

## 6. Pitz dependency (coordinating with Issue #38)

Per Issue #38's own stated gate ("実装開始条件: 1. Issue #32のAuthority blockerを解消 2. Scoring 2.0 Human Feel calibrationを完了 3. Phase 4A-3 / Scoring 2.0 Authorityの採用ルールを確定 …"), Pitz reward implementation is explicitly blocked on Scoring 2.0 authority, not the other way around.

**Exact safe point:** Pitz Reward (Issue #38) becomes safe to implement once, and only once:
1. `state.score` (or its `ScoreBreakdown`-shaped equivalent) is populated by the finalized authoritative formula at `CONFIRM_BAKE` — i.e. after this audit's §4 cutover has landed and been Human-Feel-verified, **not** before.
2. The two BLOCKERs in §3 are resolved for every recipe Pitz is meant to reward (at minimum: Bake must contribute to the authoritative total for the reward to reflect bake skill at all; Reference coverage must exist for whichever recipes are meant to earn per-pizza Pitz — see §7's V1-scope recommendation, which narrows this).
3. A reward formula reads only the now-authoritative `state.score`/`scoringV2`-shaped total, never a Shadow-only field, and never legacy `scorePizza` output directly (Issue #38's own explicit non-negotiable: "Scoring 2.0 Shadow値を現在のauthoritative Pitzへ直接接続しない" — inverted here to the equivalent post-cutover rule: don't let a *future* reward formula quietly read the *old*, now-non-authoritative legacy score either).

This audit does not design the reward formula itself (out of scope, and PR #52 already exists as a separate, parallel Issue #38 Fresh Audit covering exactly that — not read in detail here beyond its title/existence, since it is someone else's deliverable to reconcile, not this audit's).

---

## 7. Dough relationship

Issue #33 (Dough Shaping) is being implemented separately and in parallel (PR #54, D1, open, "DO NOT MERGE" per its own gate). This audit does not touch or design Dough scoring.

**Explicit decision, as the task requests:** V1 Authority should **not** wait for Dough scoring. Dough was never part of the four accepted invariants' *scoring* model to begin with (§2) — it is a *making-flow* addition (a new physical step, `DOUGH → SAUCE → CHEESE → TOPPING → BAKE`), not a scoring gap. Blocking Scoring 2.0 Authority on Dough scoring would conflate two independent roadmap tracks that the project's own SSOT (`PROJECT_HANDOFF.md`) already keeps separate (P2 Making Game 2.0 vs. P3 Scoring 2.0 Authority).

However — and this is the one place this audit's answer differs from the task's own framing — **V1 Authority cannot actually launch with "Recipe + Sauce + Pieces + Bake" today, because Bake does not exist in Scoring 2.0 at all** (§2/§3). The task's phrasing presupposes Bake is already implemented and only Dough is missing; fresh-code verification shows the opposite is also true: Bake is missing too, and it is missing in a way that is architecturally required to close (not merely nice-to-have), because it is legacy's single heaviest weight (30/100) and its complete absence from a "score higher the closer/better it is made" system would silently stop bake skill from affecting score.

**Recommendation:** treat "add a reviewed Bake similarity primitive to Scoring 2.0" as its own small, bounded slice — parallel in spirit to how Sauce/Pieces/Recipe were each built as an isolated `scoringV2/` module — and as a genuine prerequisite slice before authority cutover, not a "V1 can launch without it" case the way Dough is. This is a scope/architecture finding, not new coefficient tuning: no Bake similarity formula is proposed here, only that one must exist before cutover.

---

## 8. Test plan (for future implementation — not run or added by this audit)

Regression coverage a future implementation slice should add/preserve, organized by the same authority map as §1:

- **Authoritative score**: a `CONFIRM_BAKE` integration test asserting `state.score` now equals the new formula's output (mirroring the existing `gameReducer.test.ts` pattern that currently asserts it equals `scorePizza(...)`), for both an `available` and (if any recipe still lacks coverage post-cutover — see the fallback question below) an unavailable case.
- **stars**: `capStarsForBake`'s "not-perfect-bake never reads ★5" invariant re-asserted against the new formula's stars, not just legacy's.
- **BEST**: `registerScoreToDex`'s "BEST never goes down" property re-run against the new formula's scores; explicit test that a lower-scoring new-formula round never overwrites a higher pre-cutover legacy BEST.
- **Dex**: `discovered`/`timesMade` behavior unchanged — these were never formula-dependent, but should be re-asserted once the call site's input changes, not assumed.
- **progression**: `totalStars`/`ingredientState`/`isRecipeAvailable` unit tests re-run unchanged (they consume Dex, not score, directly — should need zero new tests, but should be *re-run*, not skipped, to catch any accidental coupling).
- **FREE**: end-to-end FREE round produces a sensible RESULT for every one of the 7 recipes (this is exactly where the Reference-coverage BLOCKER from §3 would surface as a test failure if cutover happened today — a regression test worth adding *before* cutover, specifically to prove the blocker, not after).
- **Lunch Rush**: mirrored FREE coverage plus `recordServe`/`missionScore`/`isNewMissionBest` re-run against the new `state.score.total`.
- **existing historical records**: a persistence-level test loading a pre-cutover save (fixture `PersistentSaveV1` JSON with legacy-era `bestScore`/`bestStars`) and asserting it still loads, still displays, and is never silently rewritten by the mere act of the formula changing.
- **Shadow/legacy isolation**: inverted from today's isolation tests — once cutover lands, add a test proving legacy `scorePizza` output (if kept per §4's Option A) is *not* read by any production consumer anymore, the mirror image of today's "Shadow is not read by any production consumer" tests.
- **deterministic scoring**: same pizza + same recipe → same score, every call — already true of `computeScoringV2Shadow` (pure function, no randomness) and should remain a pinned property post-cutover.
- **Pitz-ready contract**: once cutover lands, add a test that a reward-formula-shaped pure function *could* read `state.score.total` deterministically without needing any Shadow-specific field — proves the Issue #38 dependency in §6 is actually satisfied, without implementing the reward itself.

---

## 9. Implementation slices (recommended smallest PR sequence)

Given the two BLOCKERs in §3/§7, the smallest safe sequence is **not** "flip authority now" — it is close the two blockers first, each as its own bounded slice, then cutover, then cleanup:

### B1 — Bake similarity component for Scoring 2.0
- **Likely files**: new `src/logic/scoringV2/bakeComponent.ts` (mirroring `sauceComponent.ts`'s shape), `types.ts` (widen `BakeComponentV2` from an always-`ScoringV2Unavailable` alias to a real union like the other three components), `index.ts` (wire it into `totalScore`, which requires **re-deriving the weight split** — a real calibration decision, not just plumbing, since today's 65/20/15 excludes Bake by construction).
- **Tests**: new focused `bakeComponent.test.ts`, a re-run/extension of the Golden Matrix to include Bake variation (raw/perfect/burnt at various distances from target), malformed-input coverage matching the existing `boundary.ts` pattern.
- **Risk**: medium — this is the one place genuine new calibration judgment is required (what should Bake's weight be relative to Sauce/Pieces/Recipe?). Recommend reusing `bake.ts`'s existing `classifyBake` categorical thresholds as the starting similarity shape, per the Shadow Result report's own "Known limitations" §3, rather than inventing new thresholds.
- **Dependency**: none (can start independently of B2).
- **Claude Code effort estimate**: 2–3 hours (one focused session, matching the project's own stated slice-size norm).

### B2 — Reference coverage for the remaining 6 recipes
- **Likely files**: `src/data/referencePizza.ts` (add `ReferencePizza` fixtures for marinara/quattro-formaggi/genovese/bismarck/funghi/fugazza), plus whatever reviewed-fixture-authoring process Issue #32's own P1 acceptance criterion ("Define the safe path for adding reviewed References to other recipes") specifies — **this audit does not re-derive that path**, since Issue #32 already names it as its own deliverable and PR #34 (stale, unmerged) is an existing attempt at adjacent visual-parity work worth reconciling first.
- **Tests**: extend `scoringV2.test.ts`'s per-recipe availability table (currently pinning all 6 as `available:false`) to assert `available:true` with sensible Golden-Matrix-style ordering per newly-covered recipe.
- **Risk**: high relative to B1 — authoring a *reviewed* (not fabricated) target geometry per recipe is real content work, explicitly warned against fabricating anywhere in the SSOT ("do not fabricate Reference targets"). This is likely the long pole of the whole Authority track.
- **Dependency**: none technically, but should probably follow whatever process Issue #32 already specifies for reviewed Reference authoring, rather than a fresh one invented here.
- **Claude Code effort estimate**: highly variable per recipe (likely 1–2 hours of implementation per recipe once a fixture is reviewed/approved, but the review/approval step itself is not a Claude Code estimate — it's human content review time, unbounded from this audit's perspective).

### A1 — Authority adapter / domain boundary
- **Likely files**: `gameReducer.ts`'s `CONFIRM_BAKE` case (swap/wrap the `scorePizza` call with the now-Bake-complete, now-fully-covered `computeScoringV2Shadow`-derived total), a small adapter converting `ScoringV2Result` into `ScoreBreakdown`'s shape (or `ScoreBreakdown` itself is redefined to be produced by the new module — an implementation-time choice, not designed here).
- **Tests**: the full §8 test plan.
- **Risk**: low, *given* B1/B2 are done first — the reducer boundary is already singular and already proven safe to extend (Shadow was added non-invasively at this exact site).
- **Dependency**: **hard-blocked on B1 and B2 both being complete** — this is the central finding of this audit. Attempting A1 before B1/B2 would break RESULT/stars/BEST/Dex/progression for 6 of 7 recipes and would silently drop bake skill from the score for all 7.
- **Claude Code effort estimate**: 2–3 hours.

### A2 — Result/Dex/progression cutover verification
- Likely no code changes beyond A1 (§4 already shows every downstream consumer needs zero changes) — this slice is primarily the Human-Feel/Preview verification pass the project's own Standard Completion Rule requires, plus the historical-save-compatibility spot check from §5.
- **Risk**: low.
- **Dependency**: A1.
- **Claude Code effort estimate**: 1 hour implementation-adjacent work + the project's standard Preview/Human-Feel review cycle (not a Claude Code estimate).

### A3 — Legacy cleanup
- Retire the `ScoringV2ShadowPanel` (or repurpose per §4), decide the final fate of `scorePizza`/`scoring.ts` (Option A "keep as diagnostic" from §4, revisited once cutover has proven stable — do not bundle this decision into A1).
- **Risk**: low.
- **Dependency**: A2, plus some real-world soak time before deleting the rollback path.
- **Claude Code effort estimate**: 1–2 hours.

---

## 10. Scope guard confirmation

This audit changed no production code. No coefficients were tuned. No Dough scoring was designed. No Save schema was changed. No Pitz reward was implemented. No Inventory work was touched. No Result UI was redesigned. No Making gestures were modified. The only repository changes in this PR are this report and, if the audit establishes a genuine roadmap fact, `docs/PROJECT_HANDOFF.md`/Issue #22.

---

## 11. Final verdict

**D. BLOCKED BY ANOTHER SYSTEM** — not by Dough (§7 explicitly clears that dependency), but by two findings internal to Scoring 2.0 itself that this fresh audit surfaces as blockers rather than nice-to-haves:

1. Scoring 2.0 has **no Bake component at all** (any recipe, always unavailable) — architecturally missing, not a calibration nuance, and Bake is legacy's heaviest weight.
2. Scoring 2.0 has **Reference coverage for exactly 1 of 7 recipes** — a literal authority cutover today would break RESULT/stars/BEST/Dex/progression for 6 of 7 recipes.

Everything else audited — the Recipe/Sauce/Pieces invariants, the reducer-boundary architecture, the Dex/Mission/progression consumers, the Pitz dependency chain, save compatibility — is **ready**: no further coefficient tuning is required by this audit's own evidence, no Dex/Mission/progression code needs to change at cutover, and the reducer boundary is already the single, proven-safe place to make the switch. Once B1 (Bake) and B2 (Reference coverage) close, this becomes a **B. READY WITH MINOR PRE-CUTOVER FIXES** situation for the A1/A2/A3 slices in §9 — the blockers are narrow and named, not open-ended.

### Summary

- **Audited SHA**: `2da3949de5bd642c709ca6ba343bc57d8101d03d`
- **PR**: this docs-only audit PR (branch `claude/scoring2-authority-audit-05ucfl`)
- **Current authority map**: single choke point, `gameReducer.ts`'s `CONFIRM_BAKE` → `state.score` (legacy `ScoreBreakdown`) → every RESULT/stars/BEST/Dex/progression/Mission consumer, transitively (§1)
- **Scoring 2.0 readiness**: Recipe/Sauce/Pieces invariants confirmed true and already calibrated (including the one known Pieces defect already fixed); Bake is missing entirely (§2/§3)
- **Blockers vs. nice-to-have**: 2 blockers (Bake absence, Reference coverage), 2 nice-to-haves (Sauce concentrated-dump ordering nuance, provisional Pieces group weighting) — §3
- **Historical BEST/Dex strategy**: no retroactive rewrite, no schema migration needed, "BEST never goes down" already holds across a formula change by construction — §5
- **Dough relationship**: not a blocker; Dough was never part of the scoring invariants to begin with, tracked correctly as a separate roadmap track — §7
- **Pitz unlock point**: safe only after cutover (A1/A2) has landed and both blockers are closed — §6
- **Exact implementation sequence**: B1 (Bake component) and B2 (Reference coverage) in parallel, both gating A1 (authority adapter) → A2 (cutover verification) → A3 (legacy cleanup) — §9
