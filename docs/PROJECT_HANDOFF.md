# Teto Pizza Game — Project Handoff / Roadmap SSOT

Updated: 2026-09-18 (**Sauce Free Boundary MERGED via PR #66**, merge commit
`cf6d414` on `main` — see `docs/reports/TETO_SAUCE-FREE-BOUNDARY_Fresh-Audit.md` and
`docs/reports/TETO_SAUCE-FREE-BOUNDARY_Result.md`: sauce painting can now visibly exceed the
ideal target area (`SAUCE_TARGET_RADIUS`, unchanged) onto the dough/crust, following the
player's actual current dough silhouette (Issue #33 D3A's 8-point `doughShape`) instead of a
fixed `DOUGH_RADIUS` circle. The Fresh Audit found the old "can't paint outside the ideal area"
limit was render-only — `sauceDeposits`/`computeSauceMetrics` already carried unclamped overflow
as continuous, conserved data (`overflowAmount`/`edgeAmount` were already first-class quantities)
— and that the same fixed circle had never once read D3A's actual dough shape at all, so sauce
rendering never followed a player's own hand-stretched or hand-shrunk dough either. New pure
functions (`isInsideDoughShape`/`doughShapeRadiusAtAngle` in `doughShape.ts`,
`isCellInsideDoughShape`/`insideDoughShapeFraction` in `sauceField.ts`) are wired only into
`PizzaStage`'s heatmap render effect via a new optional `isCellVisible` parameter on
`sauceFieldToRgbaPixels` (defaults to the old fixed-circle test, byte-identical for every other
caller) — `computeSauceMetrics`/`scoreSauceComponentV2`/`evaluateSauceForPlayer` are untouched,
so Scoring 2.0 authority, weights, and every reference fixture are unaffected (confirmed by the
full existing regression suite, including the targeted Scoring 2.0/Pitz/economy/reducer suite,
389 tests, passing unmodified). Tomato/pesto/olive oil share the one dispense/heatmap code path
unchanged, so parity is structural. 1146/1146 tests pass (14 new), typecheck/lint/build clean,
dedicated Preview deploy + 390×844 Review Playthrough done (Margherita/tomato dough+sauce
overshoot → carry-through → reset → Genovese/pesto parity). **Issue #33 D3A Reversible Dough
Shaping is MERGED via PR #65**, merge commit `ceaa78a340362d06a18700251afae9c969df96c9` on
`main` — see `docs/reports/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_Result.md`: the DOUGH gesture is now
bidirectional (stretch **and** shrink), using the same touch-position-as-desired-radius model,
by removing the D1/D2-era monotonic-only floor from `applyStretchPoint`. A new
`DOUGH_SHAPE_TECHNICAL_MAX_RADIUS` (58) is decoupled from the ideal/reference `DOUGH_RADIUS`
(48, unchanged), so a player can now stretch visibly past the guide ring instead of being
hard-clamped at it; `DOUGH_SHAPE_MIN_RADIUS` (10) prevents shrinking to a degenerate point. No
Dough scoring, Scoring 2.0/Pitz/Recipe reference changes — out of scope per the task, deferred to
D3B. **Issue #38 Pitz Reward V1 (E-P1/E-P2) MERGED via PR #64** — see
`docs/reports/TETO_ISSUE-38_PITZ-REWARD_Result.md`: a pure
`recipeBaseReward x qualityMultiplier` reward core (`src/logic/pitzReward.ts`), `Recipe.
baseRewardPitz` (100 for all 7 recipes), FREE-only exactly-once crediting via an extended
`REGISTER_TO_DEX`, a new DISCOVERED-phase Pitz summary, no Save schema change, Lunch Rush fully
unchanged/isolated. **Scoring 2.0 A3 (A3a + A3b) is now fully COMPLETE and MERGED** — PR #62 (A3a)
and PR #63 (A3b) are both merged into `main` (re-confirmed via fresh GitHub state, not just this
doc's own prior "implementation done" language): legacy `scorePizza`/`scorePlacement` and their
private-only helpers no longer exist anywhere in the codebase (definition and production call
sites = 0), `src/logic/placement.ts`/`placement.test.ts` removed entirely, the ~13-case
`scorePizza`-dependent test surface migrated, `computeScoringV2Shadow`->`computeScoringV2`/
`ScoringV2ShadowPanel`->`ScoringV2DebugPanel`/`GameState.scoringV2Shadow`->`scoringV2Result`
renamed -- no behavior change either slice, 1072/1072 tests passed at A3b's own final commit (was
1089 pre-A3b). See `docs/reports/TETO_SCORING2-A3A_SAFE-RENAME_Result.md` and
`docs/reports/TETO_SCORING2-A3B_LEGACY-RETIREMENT_Result.md`. **Scoring 2.0 A1 Authority Cutover
MERGED** — PR #60, merge commit `12666faf55ed1e479d51572f6a8e3fcfc744cf31` on `main`, Human Review
(A2) **PASS**; `state.score` is Scoring 2.0-derived for all 7 recipes/FREE/Lunch Rush, see
`docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md`. Scoring 2.0 B1 Bake component MERGED via PR
#58; B2 Reference coverage COMPLETE 7/7 via PR #57; Issue #33 Dough D1/D2 COMPLETE / Human Feel
PASS via PR #54; **Save v2 / Inventory E0 migration MERGED via PR #56** (schemaVersion 2,
`inventory` field reserved, no gameplay change yet -- E1 InventoryState is the next Save v2 step,
independent of Issue #38).)

**2026-09-18 addendum (Roadmap/SSOT Fresh Sync)** — see
`docs/reports/TETO_ROADMAP-SSOT_FRESH-SYNC_2026-09-18.md`, audited SHA `398d48443f3bd299259bb63e3c9bd717091506ea`
(current `main` HEAD, matches this document's own last update). Everything above this addendum was
already correct as of that SHA (re-verified fresh via `pull_request_read`, not just cited from
prior docs). Two things changed *after* that SHA that this document did not yet know about:

- **Cooking Time / Efficiency** (the other named candidate in Issue #37's 2026-09-18 expansion
  note) has no PR or issue evidence of any work started, audit or otherwise, as of this SHA. Safe
  phrasing: *"Cooking Time / Efficiency is the next design track under evaluation."* Do not assert
  an audit is "in progress" for this track unless a future fresh check finds one.

**2026-09-18 addendum 2 (M3A Bake Judgment implementation complete, PR #68 still OPEN)** — see
`docs/reports/TETO_M3A_BAKE-JUDGMENT_Fresh-Audit.md` and
`docs/reports/TETO_M3A_BAKE-JUDGMENT_Result.md`. Final PR head `de52b612bcd65e1990e38d0ca752b1663e4cea35`
(a merge commit bringing in 3 further docs-only `main` PRs — #69/#70/#71 — that landed while this
PR was open; zero file overlap, confirmed before merging). BAKE's Guide (target/raw/burnt gauge,
needle color, the CTA's target-zone glow, and the state-revealing Teto caption) now fades out
linearly over elapsed BAKE-phase time (`src/logic/bakeGuideFade.ts`, ~3.6s full visibility then a
~3.6s fade to fully hidden), never from needle proximity to the scoring boundary. Along the way,
the Fresh Audit found and fixed a real bug that would have silently defeated the whole feature:
the pizza's own dough/cheese/char visuals previously **snapped** discretely at the exact scoring
boundary (`classifyBake`'s raw/perfect/burnt split), because CSS cannot animate a `background`
swap — replaced with a continuous `bakeHeat` scalar (`src/logic/bakeVisual.ts`) with no seam at
the boundary. `CONFIRM_BAKE` scoring itself is completely unchanged (new regression test:
`src/state/gameReducer.bakeGuideRegression.test.ts` pins identical scores for identical taps
regardless of Guide visibility). 1188/1188 tests pass (22 new, 0 regressions), typecheck/lint/
build all clean, dedicated Preview deployed at the final head (PR #68, commit `de52b61`) and
390×844 MP4/H.264 Review Playthrough (Scenarios A underbake / B good-judgment / C overbake / D
reset-retry) recorded and delivered to the user. Scoring 2.0 weights, Pitz, Save schema, and
Recipe reference data are all confirmed unchanged (diff-verified). **Verdict: A. READY FOR HUMAN
REVIEW — PR #68 stays OPEN, not merged, pending the user's own review of the video/Preview.**

**2026-09-18 addendum 3 (RESULT 2.0 Slice 1: Completed Pizza Hero + Result Flow Foundation,
PR #75 OPEN)** — see `docs/reports/TETO_RESULT-2_Fresh-Audit.md` (Verdict **B — READY, MULTIPLE
SLICES**, audited `main` SHA `27818efb...`, confirmed still applicable at this session's own
fresh base SHA `aaf56edaea533f9efc63b3ba623bf1ae8425a6b5` — PR #68 above is now confirmed
MERGED) and `docs/reports/TETO_RESULT-2_SLICE1_Result.md`. Slice 1 merges FREE's two-phase
RESULT (score/stars, behind a "レシピ図鑑に登録する" tap) + DISCOVERED (banner/Pitz/retry CTAs)
split into one merged Hero result screen: the player's own completed pizza (`PizzaStage`,
already unconditionally rendered pre-existing) is now the visual anchor, not a reference image,
and never rebuilt between RESULT/DISCOVERED. `REGISTER_TO_DEX`'s Dex/BEST/Pitz reducer
transaction is completely unchanged (same exactly-once `state.phase !== "RESULT"` guard, zero
diff in `gameReducer.ts`) — it now fires automatically right after `CONFIRM_BAKE`
(`App.tsx`'s new `handleConfirmBake`, guarded on `!state.isMissionRound`), so a FREE round's
phase goes straight `BAKE` → `DISCOVERED` with no player-visible intermediate "score only, not
yet registered" screen, and Lunch Rush is fully unaffected (dedicated regression test added).
Scoring 2.0/Pitz formula/Dex/BEST rules: all unchanged (diff-verified, zero changes under
`src/logic/scoringV2/**`, `src/logic/pitzReward.ts`, `src/state/dex.ts`). 1198/1198 tests pass
(11 new), typecheck/lint/build clean, dedicated Preview deploy done (PR #75, head
`e5d5452a6af05e3f8329a65226a0592df2df5def`), 390×844 Review Playthrough recorded and delivered.
**Verdict: READY FOR HUMAN REVIEW — PR #75 stays OPEN, not merged, pending the user's own
review of the video/Preview.** Next open work on this track: Slice 2/3 (feedback-line
translation layer, reveal sequencing, Cooking Time scaffold) — explicitly not started this
session, per the task's own scope guard.

**2026-09-19 addendum (Gameplay UX Next: Fresh Audit, docs-only, PR open)** — see
`docs/reports/TETO_GAMEPLAY-UX-NEXT_Fresh-Audit.md`, audited `main` SHA `c3741810cf2fce96a6cc2f422e919d9aa471b1ec`
(current HEAD at the time of that audit). A READ-ONLY Fresh Audit/design pass over five requested
UX improvements — Lunch Rush continuous per-pizza progression (UX-1), Making-step tabs replacing/
augmenting the 「次へ」 CTA (UX-2), a local (GitHub-Pages-only, no backend) Lunch Rush run
ranking/history (UX-3), a single-screen Pizza Select pager replacing the scrolling card grid (UX-4),
and a confirmation-gated "achievement-only" (Dex-only) test reset (UX-5). **Verdict: A. READY FOR
IMPLEMENTATION** — all five have concrete, minimal-risk designs reusing existing architecture
(`recipeCardState`, `IngredientTray`'s already-built-but-inert `category-tabs` pattern, the
`persistProgress`-style read-patch-write schema pattern, existing `MISSION_NEXT_ORDER`/
`BEGIN_PREPARE` actions), and are confirmed file-conflict-free against **PR #83 (Economy &
Progression 1.0 EP3: Shop 2.0 restock + placement Stock Gate)**, which is itself an **active
OPEN PR** at this audit's SHA (not yet merged) — this document did not previously mention EP3 at
all; it is recorded here for the first time. The audit also found and flagged forward to EP4 (not
yet implemented) a still-open design question from `docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`:
EP4's exactly-once starter-stock grant guard must key off `ownedIngredientIds` (not `dex`/
discovery), or a future UX-5 Achievement Reset could re-arm an unlimited starter-stock grant loop —
see the audit report §6 for the full reasoning. Three old open PRs re-confirmed stale/superseded by
this audit (not closed, out of its read-only scope): **#72** (already represented by this document's
own RESULT 2.0 addendum's "PR #68 ... now confirmed MERGED" line), **#46** (Dough D0 audit,
superseded by merged D1/D2/D3A), **#34** (Issue #32 Phase 1, superseded by merged PR #45). No
production code changed this session; five implementation slices (one per UX item, each ~30min–2h)
are specified in the audit report §8, none blocking Economy 1.0's own EP3→EP4→Human-Feel sequence.

**2026-09-21 addendum (Issue #159 Cooking UI 1-Screen Polish: implementation complete, PR
OPEN)** — see `docs/reports/TETO_ISSUE-159_COOKING-UI-1SCREEN_Result.md`, audited SHA
`d0085a35c7a5f932deda11ebc5fa74b421ddc86a` (current `main` HEAD at implementation time). A
real-device Fresh Audit found: (1) the ingredient tray's old「このピザにおすすめ」/「その他」
split let a player pick a wrong-for-the-recipe sauce mid-SAUCE-step and was the single biggest
PREPARE overflow contributor; (2) the making-step nav strip only ever rendered during PREPARE,
so a cut-target recipe's own CUT step never appeared consistently; (3) the TOPPING tab's own
「トッピング」label was wide enough to push the trailing BAKE/CUT tabs toward the right edge at
361-390px; (4) `.order-card__hint` clipped several real recipe hints; (5) olive oil was still
hard to read despite Issue #32's own filter; (6) the mini 見本 thumbnail and its own popover
built two independent, disagreeing piece lists for the same recipe (margherita: 2 dots vs. the
popover's real 5). All fixed: `IngredientTray.tsx` now offers only this round's own
`recipe.requiredIngredients` (owned-gated, no heading) — a deliberate, explicitly-authorized
supersession of Issue #86's "Other"/FREE-creativity browsing, which also structurally closes the
sauce-switch gap (nothing else to switch to); `MakingStepTabs.tsx` gained `postSteps`/
`currentPhase` so the same strip now mounts through PREPARE→BAKE→POST_BAKE/CUT consistently,
recipe-aware via the existing `cookingProfiles.ts` SSOT (no new per-recipe branching); a new
`ReferenceThumbnail.tsx` renders the mini thumbnail from the exact same resolved
`pieceGroups`/sauce data the popover already reads. No scoring/economy/Firebase/Lunch
Rush/recipe-data/CI changes (diff-verified). 2088/2088 Vitest + 30/30 Playwright (both
390×844/360×800 projects, plus new explicit 361×800 checks) pass, typecheck/lint/build clean,
before/after screenshots + two Review Playthrough videos (390×844/361×800) delivered as
MP4/H.264 (re-encoded via a full `apt`-installed `ffmpeg`/`libx264` — see the Result Report §7).
**Not merged — PR open, pending the user's own review**, per this task's own explicit
"do not auto-merge" instruction.

**2026-09-21 addendum (Issue #167 Cooking UI 1-Screen 2.0 PR-B: Reference Truth, implementation
complete, PR OPEN)** — see
`docs/reports/TETO_COOKING-UI_1SCREEN-2.0_PRB_Reference-Truth_Result.md`, base `main` SHA
`0d10568175adc486deb729af5d6a8dd0a3257dc6` (PR #158, current HEAD at implementation start).
Fixes 「見本と、実際に作るPizzaStageが別物に見える」: `ReferenceThumbnail`/`ReferencePreview`/
`PlayerReferencePreview` used to each render sauce as a flat, opacity/scale-only proxy shape (no
coverage/shape signal at all) instead of PizzaStage's own real painted heatmap. A new shared
`SauceHeatmapCanvas` (`src/components/SauceHeatmapCanvas.tsx`) extracts PizzaStage's existing
`buildSauceField`→`sauceFieldToRgbaPixels` pipeline unchanged, fed by every Reference view via
the recipe's own deterministic `buildIdealSauceFixture()` deposits and an ideal circular
`doughShape` (`createIdealDoughShape`, `src/logic/doughShape.ts` — the same `DOUGH_RADIUS` the
DOUGH step's own guide ring uses); a new shared `renderPizzaVisualPieces`
(`src/components/PizzaVisualPieces.tsx`) replaces three near-duplicate piece-layout loops (one of
which, plus PizzaStage's own non-cheese topping branch, previously bypassed
`IngredientPieceVisual` entirely). Three independently-named piece-scale custom properties are
now one shared `--piece-scale`. No scoring/economy/Firebase/recipe-data changes (diff-verified);
`getReferencePizza`/`getPlayerReferencePizza`/`SAUCE_TARGET_RADIUS`/`DOUGH_RADIUS` are read-only
inputs, untouched. **Finding:** all 15 shipped recipes now have a `getReferencePizza` fixture, so
`PlayerReferencePreview`'s fallback path is currently unreachable in production (kept as a
defensive path, still fully tested). 2146/2146 Vitest (54 new) + 40/40 Playwright Chromium pass,
typecheck/lint/build clean; WebKit blocked by the same network egress policy PR-A's own Result
Report documented. Screenshots + three Human Verification videos (A: Margherita 390×844, B:
Salsiccia 390×844 — the recipe the user specifically flagged, C: Quattro Formaggi 360×800
topping-heavy regression) delivered as MP4/H.264. **Not merged — PR open, pending the user's own
review**, per this task's own explicit "do not auto-merge" instruction. PR-C (Verification
Hardening, actually running WebKit) remains the next open step on this Issue #167 track.

**2026-09-22 addendum (Pizza Cutting Phase 4B: Full Recipe Expansion, implementation complete, PR
OPEN)** — see `docs/reports/TETO_PIZZA-CUTTING_Phase4B_Full-Recipe-Expansion_Result.md` and its own
Fresh Audit `docs/reports/TETO_PIZZA-CUTTING_Phase3_Expansion_Fresh-Audit.md` (PR #163, docs-only,
re-verified against `main` SHA `4a3e6048de8a784477407a1b4f0ae26b2c36504d` — the same PR-C SHA
addendum above). CUT (`src/logic/cut/*`, Pizza Cutting 1.0) is now available on **all 15** shipped
recipes, not just margherita — `src/data/cookingProfiles.ts` gained an explicit, opt-in
`CUT_ELIGIBLE_RECIPE_IDS` allowlist (Option C from the Fresh Audit) with a pure derivation
function, instead of 14 hand-authored profile entries or baking CUT into
`DEFAULT_COOKING_PROFILE` (the latter rejected outright — it would let a future non-round recipe
silently inherit CUT). `DEFAULT_COOKING_PROFILE` itself is unchanged and never globally
CUT-enabled; a future non-round recipe (calzone, fugazzeta, mezza-e-mezza, siciliana, square pizza)
needs a deliberate allowlist addition after a human re-confirms shape compatibility.
`requestedSliceCount` stays 6 for every eligible recipe. No Scoring 2.0/Completion Gate/Pitz/
economy/Reference Truth/Cooking UI 1-Screen change (diff-verified). Every test that used a real
non-Margherita recipe (funghi/bismarck/marinara) as its "non-CUT" control was migrated to a
synthetic ineligible fixture rather than deleted. 2196/2196 Vitest + 54/54 Chromium Playwright
pass, typecheck/lint/build clean; WebKit CI result pending the PR's own Actions run (not runnable
in the implementing sandbox). Screenshots + four 390×844/360×800 Human Verification videos
(Margherita regression, Salsiccia newly-CUT-enabled, Capricciosa topping-heavy, Lunch Rush
order→CUT→serve) delivered as MP4/H.264. Dedicated Issue #172. **Not merged — PR open, pending the
user's own review**, per this task's own explicit "do not auto-merge" instruction.

**2026-09-22 addendum (Issue #188 Progression 2.0 Phase 1: 172-recipe Mechanic Matrix,
docs/data/tooling-only, PR OPEN)**. Base `main` is `5676ae9d` (the PR #183 Phase-0 merge). The
new artifacts are:

- `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md` (the report);
- `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` (the matrix);
- `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX_ROWS.md` (a generated per-row table);
- `tools/progression2_mechanic_matrix.py` (a deterministic generator and validator; `--check`
  validates only).

Results:

- **Coverage:** 172/172 rows. Under the current `DOUGH → SAUCE → CHEESE/TOPPING → BAKE → CUT`
  flow, 101 are FULL, 55 PARTIAL and 16 NOT_REPRESENTABLE.
- **Capabilities:** the minimum reusable set is 11. The recommended coverage order starts with
  DOUGH_VARIANT, then MULTI_SPREAD_LAYER, then LATE_ADDITION; those three reach 151/172.
- **Collisions:** of the 5 Phase-0 exact-set collision groups, 4 are distinguished by evidenced
  dough/pan/order dimensions. Fugazza/fugazzetta remains a discovery-rule blocker.
- **Decisions:** 27 composition decisions are listed, 9 of them against SHIPPED recipes (nothing
  rewritten). 21 ambiguous-ingredient rows are preserved, not guess-filled.
- **Status:** 85 rows are blocked on a product decision. 56 rows are FULL and decision-ready, the
  content-only pool.

No `src/**` change was made. No ★ threshold or Pitz price was set. The production Progression SSOT
was not touched. **Not merged; the PR is open and pending review.** The next milestone is
Progression 2.0 progression/economy design against this population.

**2026-09-23 addendum (Issue #190 Progression 2.0 Phase 2: discovery / unlock / economy design,
docs/data/tooling-only, PR OPEN)**. Base `main` is `2f9f28e9` (the PR #189 Phase-1 merge). The new
artifacts are:

- `docs/design/TETO_PROGRESSION2_PHASE2_DESIGN.md` (the report and SSOT candidate);
- `docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json` (the unlock/progression matrix);
- `docs/design/TETO_PROGRESSION2_PHASE2_UNLOCK-GRAPH.md` (generated tables);
- `docs/design/TETO_PROGRESSION2_PHASE2_DECISION-LEDGER.md` (generated A/B/C/D ledger);
- `tools/progression2_phase2_progression.py` (a deterministic generator, simulator and validator;
  `--check` validates only).

Results:

- **Population:** 87 evidence-ready rows plus 14 kept shipped recipes gives 101 targets, all
  reachable. The other 85 rows stay blocked, and none was guess-filled.
- **Zero-recipe start:** the first bake is a Margherita discovery only if the shipped Margherita
  composition is kept (decision A-01). Under strict evidence there is no deadlock, but the starter
  trio discovers nothing. The first bakes are Pitz-paying "original pizzas", and the first discovery
  (Melanzane) needs a purchase.
- **Recommended curve:** Hybrid ⭐ (+2 per discovery, +1 at ★3/4/5), gates at 0.6 × discoverable,
  tiered prices 60/100/140/180, stock 10 portions with +10 restock, a ★1 Pitz floor plus a +50
  discovery bonus, Teto hints, and mechanics taught one at a time every 6 discoveries from
  discovery 14. This configuration has **0 deadlocks across 12 player models**.
- **Negative controls:** the fixed ⭐ ladder and the current ★1 = ×0 reward both deadlock.
- **Phase 3:** start with P3-1, the headless free-cook discovery matcher and save v3.

No `src/**` change was made. The production Progression SSOT was not touched. **Not merged; the PR
is open and pending review.**

**2026-09-23 addendum (Issue #192 Progression 2.0 Phase 3-1: runtime signature → discovery
foundation, PR OPEN)**. Base `main` is `9c22ef2e` (the PR #191 Phase-2 merge). See
`docs/reports/TETO_PROGRESSION2_P3-1_DISCOVERY-FOUNDATION_Result.md`. Headless foundation, no
visible UI change:

- `signatureOfPizza` builds a typed runtime signature. Every Phase-2 dimension is tagged
  OBSERVED, FIXED_BY_FLOW or UNAVAILABLE; shape and zones are UNAVAILABLE.
- `matchDiscovery`/`evaluateDiscovery` is an exact-match rule with no ingredients-only fallback.
  It handles blocked rows and 0/1/many matches.
- `RECIPE_DISCOVERY_CATALOG` holds the 15 production recipes, pinned to the Phase-2 JSON.
- REGISTER_TO_DEX records the outcome in the transient `lastDiscovery`. The selected-recipe Dex
  write is unchanged, and an exact match to another undiscovered recipe is also written.

There is no save schema change. The unit suite is 2377/2377 (53 new) and Chromium E2E is 102/102.
Phase 3-2 blockers are listed in that report's §6, starting with the still-open A-01…A-05 owner
decisions and the absence of a free-cook entry point.

**2026-09-23 addendum (Issue #194 Progression 2.0 Phase 3-2: Free Cooking / owned-ingredient
selection, PR OPEN)**. Base `main` is `5cf59f94` (the PR #193 Phase-3-1 merge). See
`docs/reports/TETO_PROGRESSION2_P3-2_FREE-COOKING_Result.md`.

- HOME's new 「🎨 フリークッキング」 opens `START_FREE_COOK`, a FREE round with no recipe. It uses
  the inert `FREE_COOK_RECIPE` sentinel, has a transient `GameState.freeCook` flag, and gets the
  default 4-step profile.
- The tray lists every OWNED ingredient in the step's category, paged 6 at a time. Owned
  ingredients with 0 stock stay listed but disabled, following the existing EP3 contract. The
  recipe-guided tray is unchanged.
- `CONFIRM_BAKE` resolves the pizza. The recipe-free completion rule uses at least one item and a
  generic bake window of 58–78 (the median of the recipe windows). The pizza then goes through
  the Phase 3-1 matcher and the matched recipe's own gate:
  - a MATCHED pizza becomes that recipe's round, and the unchanged REGISTER_TO_DEX path handles
    NEW (exactly once) or KNOWN;
  - anything else is an unscored ORIGINAL result, which is not a failure and writes nothing to
    the Dex or Pitz.

There is no save schema change. The unit suite is 2406/2406 (29 new) and Chromium E2E is 106/106.
WebKit is covered by the CI job. Open follow-ups are listed in that report's §6: the ORIGINAL
Pitz reward belongs to P3-3, and onboarding and hint tiers are also pending.

> Fresh GitHub/main state always wins if this document becomes stale.

## Product goal

> See the ordered/reference pizza, recreate it physically by hand, bake it, and score higher the closer/better it is made.

Making Game 2.0 target: `DOUGH → SAUCE → CHEESE → TOPPING → BAKE → FINISH → RESULT`.

Core experience principle:

> 操作 → 見た目が変わる → その状態を次工程へ持ち越す → 完成した一枚に個性として残る

Progression target:

`choose pizza → make → improve stars/BEST → unlock/discover → Lunch Rush → earn Pitz → buy ingredients → make new pizza → Dex/mastery → replay`

Primary device: smartphone vertical. Verification baseline: 390×844.

## Current roadmap issues

- Issue #22 — overall development roadmap / session handoff SSOT.
- Issue #32 — Reference / Recipe / Interaction consistency gate before Scoring 2.0 authority. **Complete** — Recipe correctness, Interaction Consistency Fresh Audit, and the sauce-parity/olive-oil-visibility fix (PR #45) have all landed.
- **Issue #47 — Making UX Cleanup (実機レビュー導線・見本・再挑戦・操作性改善). Complete.** Fresh Audit — see `docs/reports/TETO_ISSUE-47_MAKING-UX_Fresh-Audit.md` (audited SHA `6e554918c42fc4d8ed267b715992e5ed5cf68e4f`). Verdict: **B. READY — 3 IMPLEMENTATION SLICES**. Slice A (PR #49, Findings A/B/C/D/E/K) and Slice B (PR #50, Findings F/H) are both **merged**, Human Feel **PASS**. Slice C's own findings: I (sauce repaint vs. one-way flow) confirmed already correct, no code change needed; J (Cheese/Topping drag scope) explicitly handed to **Issue #37 M2** rather than implemented here, per Issue #47's own "don't double-implement" scope guard — this hand-off is not unfinished Issue #47 work, it is Issue #47's own decision.
- **Issue #33 — Dough Shaping. D1/D2 COMPLETE** via **PR #54** (base SHA
  `2da3949de5bd642c709ca6ba343bc57d8101d03d`, merge SHA
  `c0b93504f84adbccdc1c75567677d234f832cfb1`). Making flow is now
  `DOUGH → SAUCE → CHEESE → TOPPING → BAKE`, implemented exactly per the D0 (and revalidated D0)
  design: single-finger drag-from-center-outward radial stretch, 8-point radial shape model
  (`PizzaState.doughShape`, no Save schema change), size-only ≥75% completion threshold — see
  `docs/reports/TETO_ISSUE-33_DOUGH-D1_Result.md`. Status: **D1 functional result — PASS**; a
  **D2 Human Feel Fix** (neighbor-propagation falloff + spike suppression, replacing D1's
  two-bracketing-point-only blend) was applied after a ChatGPT review of the D1 playthrough
  found a sharp single-direction-drag spike, and ChatGPT's review of the resulting 390×844
  H.264 D2 Review Playthrough MP4 returned **Human Feel verdict: PASS** — PR #54 was merged
  after that PASS. Issue #33 D1/D2 is complete; no additional real-iPhone Human Feel
  confirmation is a required gate for D3 or for Issue #37 M2. **D3A Reversible Dough Shaping is
  MERGED via PR #65**, merge commit `ceaa78a340362d06a18700251afae9c969df96c9` on `main` — see
  `docs/reports/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_Fresh-Audit.md` and
  `docs/reports/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_Result.md`: `applyStretchPoint`'s D1/D2-era
  monotonic-only floor removed so a drag toward center now shrinks the touched region (the same
  touch-position-as-desired-radius model, now bidirectional, no new gesture concept); a new
  `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS` (58) decoupled from the ideal/reference `DOUGH_RADIUS` (48,
  unchanged) lets a player stretch visibly past the guide ring instead of being hard-clamped at
  it; `DOUGH_SHAPE_MIN_RADIUS` (10) is the new shrink floor; spike suppression made symmetric and
  correctly scoped (a latent bug fix — see the Result report §3). No Dough scoring, no Scoring
  2.0/Pitz/Recipe reference changes (explicitly out of scope, deferred to D3B); `PizzaState.
  doughShape`'s own 8-point shape model is unchanged. 1132/1132 tests pass, typecheck/lint/build
  clean, dedicated Preview deploy + 390×844 Review Playthrough done.
- Issue #37 — parent roadmap for Making Game 2.0 physical pizza-making flow. Its own M0 gate is
  satisfied (Issue #32 P1 done); M1 (Dough Shaping, #33) D1/D2 are merged, D3A is open per the
  above. **Sauce Free Boundary (the issue's own 2026-09-18 Human Feel expansion note) MERGED via
  PR #66**, merge commit `cf6d414` on `main` — see `docs/reports/TETO_SAUCE-FREE-BOUNDARY_Result.md`:
  sauce painting now visibly exceeds the ideal target onto the dough/crust, following the actual
  (possibly D3A-distorted) dough silhouette instead of a fixed circle; no Scoring 2.0 change. Issue
  #47 Slice C's Finding J hand-off (Cheese/Topping drag scope) remains tracked under this issue's
  M2 checklist as the next open item, independent of and not blocked by this PR.
- **Issue #38 — Scoring 2.0-linked Pitz reward / Economy connection. E-P1/E-P2 MERGED via
  PR #64.** Fresh Audit — see
  `docs/reports/TETO_ISSUE-38_PITZ-REWARD_Fresh-Audit.md` (verdict **A. READY AFTER SCORING
  AUTHORITY**, since satisfied by A1/A2/A3). Implementation — see
  `docs/reports/TETO_ISSUE-38_PITZ-REWARD_Result.md`: `recipeBaseReward × qualityMultiplier`
  reward core (`src/logic/pitzReward.ts`), `Recipe.baseRewardPitz` (100 for all 7 recipes),
  FREE-only exactly-once crediting via an extended `REGISTER_TO_DEX`, a new DISCOVERED-phase
  Pitz summary (今回の獲得/基本報酬/出来栄え倍率/所持Pitz before→after), no Save schema change.
  Lunch Rush's existing per-run Pitz reward (`calculateMissionReward`) is unaffected and
  confirmed isolated (dedicated tests + Review Playthrough). 1113/1113 tests pass, typecheck/
  lint/build clean, dedicated Preview deploy + 390×844 Review Playthrough done. **Next: E-P3
  Human Feel / balance**, independent of and not blocking Issue #33 D3A.
- Save v2 / Inventory (P5, no dedicated issue number yet). Fresh Audit **done** — see
  `docs/reports/TETO_SAVE-V2_INVENTORY_Fresh-Audit.md` (audited SHA
  `2da3949de5bd642c709ca6ba343bc57d8101d03d`). Verdict: **B. READY WITH MINOR DESIGN DECISIONS**.
  **E0 (Save v2 migration) MERGED — PR #56.** See
  `docs/reports/TETO_SAVE-V2_E0_Result.md`. Does not change current priority (Issue #33 D3A and
  Sauce Free Boundary, PR #65/#66, are both merged; Issue #38 Pitz Reward E-P1/E-P2 is merged);
  tracked as prep work for when P5 becomes active. See P5 below for the recommended
  E0→E1→E2→E3 build order — **E1 (InventoryState) is next on this track.**
- Issue #39 — HOME/FREE navigation redesign + Pizza Select. PS1/PS2/PS3 **complete** (PR #40, PR #41, both merged into `main`); PS4 iPhone Human Feel **PASS**. Remaining HOME visual polish (see "Parallel / non-blocking" below) is tracked as future polish, not an Issue #39 blocker.
- **Issue #172 — Pizza Cutting Phase 4B: 全レシピCUT展開.** Implementation complete, PR OPEN. See the 2026-09-22 addendum above and `docs/reports/TETO_PIZZA-CUTTING_Phase4B_Full-Recipe-Expansion_Result.md`.

Scoring 2.0 Shadow has already been implemented and calibrated. It remains non-authoritative pending the A1 authority cutover (see below) — B1 and B2 are both now closed. **Scoring 2.0 Authority Fresh Audit** (original) — see `docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md` (audited SHA `2da3949de5bd642c709ca6ba343bc57d8101d03d`, verdict at the time: **D. BLOCKED BY ANOTHER SYSTEM**, on two findings: no Bake component at all, and Reference coverage for exactly 1 of 7 recipes). **Both of those blockers are now closed** — see below.

**B1 (Bake similarity component) — MERGED.** PR #58, merge commit `f464026` on `main`, see
`docs/reports/TETO_SCORING2-B1_BAKE_Result.md`. `BakeComponentV2`
(`src/logic/scoringV2/bakeComponent.ts`) reuses `classifyBake`'s thresholds and legacy
`scorePizza`'s own symmetric nearest-edge distance formula, needs no Reference fixture (so it is
real for all 7 recipes), and is wired into `totalScore` at a rescaled Sauce:Pieces:Recipe:Bake
weight of 52:16:12:20 (ruleset `phase-4a-2-shadow-3`).

**B2 (Reference coverage for the remaining 6 recipes) — MERGED, 7/7 complete.** PR #57, merge
commit `a063068` on `main` (current HEAD as of this update), see
`docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md` and
`docs/reports/TETO_SCORING2-B2_PARTC2_Result.md`. `getReferencePizza` (`src/data/referencePizza.ts`)
now returns a reviewed `ReferencePizza` (sauce target + piece-group geometry) for all 7 recipes —
margherita, marinara, funghi, genovese, fugazza, bismarck, quattro-formaggi — pinned by
`scoringV2.test.ts`'s Golden Matrix (`perfect > good > poor > empty`) for every one of them.

**A1 (authority cutover) is MERGED** — PR #60, merge commit
`12666faf55ed1e479d51572f6a8e3fcfc744cf31` on `main` (merged by `perusonao`); see
`docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md` (start SHA `7d2420a9f4d38b4b2d592257b59539c87fe5b5fb`
= the Pre-Implementation Audit's own HEAD). The Pre-Implementation Fresh Audit's verdict was **B.
READY WITH MINOR DESIGN DECISION** — see
`docs/reports/TETO_SCORING2-A1_AUTHORITY_PreImplementation-Audit.md` — and that one open design
decision (§2, Option 1: give `ResultPanel` a 4th "ソース" feedback row rather than discard or fake
Sauce) has been decided and implemented as part of A1. `gameReducer.ts`'s `CONFIRM_BAKE` now
computes `state.score` via a new pure adapter, `toLegacyScoreBreakdown` (`src/logic/scoringV2/
toLegacyScoreBreakdown.ts`), from `computeScoringV2Shadow`'s result (renamed to
`computeScoringV2` by A3a, see below) — Scoring 2.0 is authoritative for
`total`/`stars`/RESULT/Dex BEST/progression/FREE/Lunch Rush, for all 7 recipes. Legacy
`scorePizza` (`src/logic/scoring.ts`) is kept callable (Option A, not deleted) but no longer feeds
`state.score` — the two authorities never coexist (confirmed with zero production call sites of
`scorePizza(` remaining, by the A3 Fresh Audit's exhaustive grep). `ScoringV2ShadowPanel`
(Preview-only debug panel, renamed to `ScoringV2DebugPanel` by A3a) is left untouched
functionally, per the audit's §4/F recommendation. **A2 Human
Review: PASS — PR #60 merged into `main`.** No Save migration was needed or made. **A3 Legacy
Cleanup Fresh Audit** — see `docs/reports/TETO_SCORING2-A3_LEGACY-CLEANUP_PreImplementation-Audit.md`
(verdict: **C. SPLIT A3** into A3a safe cleanup/rename and A3b deeper legacy retirement). **A3a
MERGED — PR #62.** See
`docs/reports/TETO_SCORING2-A3A_SAFE-RENAME_Result.md`: `computeScoringV2Shadow`→
`computeScoringV2`, `ScoringV2ShadowPanel`→`ScoringV2DebugPanel`,
`GameState.scoringV2Shadow`→`scoringV2Result`, plus stale "SHADOW ONLY" file-header/test-title
comment fixes; no deletions, no behavior change, 1089/1089 tests pass at merge time. **A3b
MERGED — PR #63.** See
`docs/reports/TETO_SCORING2-A3B_LEGACY-RETIREMENT_Result.md`: legacy `scorePizza`/
`scorePlacement` (and `src/logic/placement.ts` in full, fully orphaned once `scorePlacement` was
retired) deleted; definition and production call sites both re-confirmed at 0; the six required
shared primitives (`starsFromTotal`/`capStarsForBake`/`countUsedIngredient`/`ScoreBreakdown`/
`QualityStars`/`starLabel`) all kept in place; ~13-case `scorePizza`-dependent test surface
migrated per the A3 audit's own table (obsolete tests deleted, one rewritten, shared-primitive
tests kept); no behavior change; 1072/1072 tests pass at merge time. **A3 (A3a + A3b) is now
fully COMPLETE** — both PRs are merged into `main` (re-confirmed via fresh GitHub state), the
exact condition the A3b Result report's own "When is A3 COMPLETE?" section named.

### Recent merges

- **PR #40** — HOME navigation + functional Pizza Select. MERGED.
- **PR #41** — HOME + Pizza Select visual reproduction. MERGED. Merge SHA: `1b1ff6c69b837ff7f0da6ab3c14df7843812d8c3`.
- **PR #45** — Issue #32 sauce parity + olive-oil visibility. MERGED.
- **PR #49** — Issue #47 Slice A (Navigation/Retry/HOME, Findings A/B/C/D/E/K). MERGED.
- **PR #50** — Issue #47 Slice B (Reference UX, Findings F/H). MERGED.
- **PR #51** — Issue #33 Dough D0 revalidation (docs-only). MERGED.
- **PR #54** — Issue #33 Dough D1/D2 (radial-stretch gesture + Human Feel Fix). MERGED after
  ChatGPT's review of the D2 Review Playthrough MP4 returned Human Feel PASS. Merge SHA:
  `c0b93504f84adbccdc1c75567677d234f832cfb1`.
- **PR #56** — Save v2 / Inventory E0 migration. MERGED.
- **PR #57** — Scoring 2.0 B2 Reference coverage 7/7. MERGED.
- **PR #58** — Scoring 2.0 B1 Bake component. MERGED.
- **PR #60** — Scoring 2.0 A1 Authority Cutover. MERGED. Merge SHA:
  `12666faf55ed1e479d51572f6a8e3fcfc744cf31`. A2 Human Review PASS.
- **PR #62** — Scoring 2.0 A3a safe rename/cleanup. MERGED.
- **PR #63** — Scoring 2.0 A3b legacy retirement (`scorePizza`/`scorePlacement` deleted). MERGED.
- **PR #64** — Issue #38 Pitz Reward E-P1/E-P2 (score-based reward core + RESULT/persistence).
  MERGED. Merge commit `2a2b9b107990e0ff8b7b2c1b30e21baac181080d`.
- **PR #65** — Issue #33 D3A Reversible Dough Shaping (bidirectional stretch/shrink +
  technical-vs-ideal boundary split). MERGED. Merge commit `ceaa78a340362d06a18700251afae9c969df96c9`.
- **PR #66** — Sauce Free Boundary (sauce painting follows the actual D3A dough silhouette past
  the old fixed circle; render-only, no Scoring 2.0 change). MERGED. Merge commit `cf6d414`.

**Both Issue #33 D3A Reversible Dough Shaping (PR #65) and Sauce Free Boundary (PR #66) are now
MERGED into `main`.** See `docs/reports/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_Result.md` and
`docs/reports/TETO_SAUCE-FREE-BOUNDARY_Result.md`. Next open, ungated tracks: Issue #38 Pitz
Reward E-P3 (Human Feel / balance), Issue #37 M2 (Cheese/Topping drag scope), Save v2 E1
(InventoryState), and D3B (Dough scoring integration, which should now build on both merged
PRs' own canonical `doughShape`/sauce boundary contracts).

## Navigation contract

HOME is the hub; do not use a redundant second FREE/Lunch Rush mode picker after 「ピザを作る」.

Target routes:

- `HOME → ピザを作る → Pizza Select → selected recipe → Making Game`
- `HOME → ランチラッシュ → Lunch Rush`
- `HOME → ピザ図鑑 → Pizza Dex`
- `HOME → ショップ → Shop`

### Pizza Select

Purpose: choose **what to make now** in FREE.

Target state semantics:

- completed recipe: name + highest stars/BEST
- unlocked but unplayed: `NEW`
- locked: `？？？` + lock

Example visual target only: マルゲリータ ⭐️⭐️⭐️⭐️⭐️ / ビスマルク 🆕 / ？？？ / ？？？.

Actual recipe availability, Bismarck data, unlock rules and References must come from current-main Fresh Audit. Never fabricate missing recipe/reference/progression data.

### Pizza Dex

Purpose: collection/record view — what has been discovered and achieved. It is distinct from Pizza Select but must reuse the same recipe/progression SSOT rather than duplicate state.

### Shop

Purpose: spend Pitz / obtain ingredients. Full functional redesign waits for Save v2 / Inventory / Economy contracts so the project does not build a decorative dead-end shop first.

## Approved visual direction

The target direction for HOME, Pizza Select, Pizza Dex and Shop is a warm rustic pizza-shop presentation: wood, brick, oven warmth, wooden signs and parchment-like cards.

Implementation rules:

- use official repository Teto/Mito/Blue assets; generated substitute dogs are not official characters
- keep text, stars, BEST, NEW, locks, counters and buttons as real HTML/CSS UI where practical rather than baking them into a single image
- adapt visual references to 390×844; do not shrink wide/four-column mockups until unreadable
- preserve touch target size, accessibility and no horizontal overflow

## Re-prioritized ordered roadmap

### P0 — HOME / FREE clarity — Issue #39

1. PS0 Fresh Audit: HOME/mode navigation, FREE recipe selection, recipe/unlock/Dex/BEST SSOT and official character assets. **Done** (merged via PR #40).
2. PS1 Navigation restructure: HOME 「ピザを作る」 → Pizza Select; HOME 「ランチラッシュ」 → Lunch Rush. **Done** (merged via PR #40).
3. PS2 Functional Pizza Select: completed / NEW / locked cards and correct selected-recipe handoff into Making Game. **Done** (merged via PR #40).
4. PS3 Visual reproduction: HOME + Pizza Select toward the approved rustic pizza-shop direction using official assets. **Done** (PR #41 — see `docs/reports/TETO_ISSUE-39_PS3_Visual-Result.md`), pending PS4 iPhone Human Feel.
5. PS4 Preview + real iPhone 390×844 Human Feel. **Done — PASS.** The user confirmed PS3 on a real iPhone at 390×844.

Issue #39's navigation/functional/visual work (PS1–PS4) is complete. Two HOME visual items remain as **non-blocking future polish** (not an Issue #39 gate, not a Human Feel failure):

- HOME's lower half has more empty space than ideal.
- Pizza thumbnail representation on cards could be strengthened further.

These are tracked under "Parallel / non-blocking" below and do not block moving on to Issue #32.

### P1 — Scoring consistency gate — Issue #32 (COMPLETE)

1. Recipe correctness Fresh Audit/pinning: missing/wrong/extra ingredient types belong to Recipe; quantity/placement belong primarily to Pieces; avoid double penalty. **Done.**
2. Interaction Consistency Fresh Audit (see `docs/reports/TETO_ISSUE-32_INTERACTION-CONSISTENCY_Fresh-Audit.md`, audited SHA `6dced18c8bc0da93276c5fd0822eafa636853201`) found golden-path sauce parity/tap-vs-drag already correct, plus two P1 defects (off-recipe sauce fallback; olive-oil heatmap visibility). **Both fixed and merged via PR #45** (see `docs/reports/TETO_ISSUE-32_SAUCE-PARITY_Result.md`). **Done.**
3. Re-calibrate only when concrete Human Feel evidence requires it; do not restart numeric coefficient tuning without a failing behavior.

### P1.5 — Making UX Cleanup — Issue #47 (COMPLETE)

Fresh Audit — see `docs/reports/TETO_ISSUE-47_MAKING-UX_Fresh-Audit.md` (audited SHA
`6e554918c42fc4d8ed267b715992e5ed5cf68e4f`). Verdict: **B. READY — 3 IMPLEMENTATION SLICES**.

1. **Slice A — Navigation/Retry/HOME** (lowest risk, no new data): HOME message-bubble z-index
   occlusion fix; Lunch Rush button flex-ratio wrap fix; remove/relabel the redundant FREE-mode
   ORDER→PREPARE gate after Pizza Select; add a same-recipe retry action + a second "別のピザを
   作る" button (今の「もう一度作る」は`excludeRecipeId`で毎回別レシピを選ぶ設計だったと判明);
   remove Shop/Pizza Dex navigation from the Making header; bump the Next CTA's touch-target
   height to match HOME's own primary CTA. **Done** (merged via PR #49 — see
   `docs/reports/TETO_ISSUE-47_SLICE-A_Result.md`). Human Feel **PASS**.
2. **Slice B — Reference UX**: a persistent mini Reference thumbnail during Making, and a
   player-facing completed-pizza reference for every playable recipe. **Done** (merged via
   PR #50 — see `docs/reports/TETO_ISSUE-47_SLICE-B_REFERENCE_Result.md`). Built as
   a deliberately separate `src/data/playerReference.ts` (generic, deterministic, generated
   purely from `Recipe.requiredIngredients`/ingredients, available for all 7 recipes) rather
   than expanding `referencePizza.ts` itself — that file remains Scoring 2.0's own
   Margherita-only authoritative target geometry, unchanged and untouched by this slice, per
   the explicit instruction not to fabricate Scoring 2.0 target coordinates. Margherita's
   existing `ReferencePreview` popover (Scoring 2.0-derived, precise bars) is unchanged and
   still used for Margherita specifically; every other recipe uses the new generic popover
   (identity + approximate placement, no numeric precision). Human Feel **PASS**.
3. **Slice C — Making controls**: sauce repaint-within-step and the one-way step guard are
   already correct (documented, no code change needed — **Done**, no PR needed). Cheese/Topping
   drag scope (today's real tray drag-and-drop is Margherita/mozzarella/basil-only; every other
   recipe/ingredient only has single-point tap/drag-release commit) is handed to **Issue #37
   M2**, which already owns this exact system — this hand-off, not an implementation, is Slice
   C's complete deliverable for Finding J.

Issue #47 is complete; Issue #33 is now the active priority (see below).

### P2 — Making Game 2.0 — Issues #33 / #37 (ACTIVE — Issue #47 Human Feel PASS gate satisfied)

1. Dough Shaping D1/D2 **COMPLETE** via **PR #54** — see
   `docs/reports/TETO_ISSUE-33_DOUGH-D1_Result.md`. D1 functional result: PASS. D2 Human Feel
   Fix (neighbor-propagation falloff + spike suppression) applied after a ChatGPT playthrough
   review; ChatGPT's review of the resulting D2 Review Playthrough MP4 returned **Human Feel
   verdict: PASS**, and PR #54 was merged after that PASS. No additional real-iPhone Human
   Feel confirmation is a required gate — item 2 below (score/visual integration, i.e. D3) and
   Issue #37 M2 may both proceed. **D3A Reversible Dough Shaping is MERGED via PR #65** — see
   `docs/reports/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_Result.md`: the gesture is now bidirectional
   (stretch and shrink), and stretching past the ideal/reference size is now allowed (a new
   technical-only ceiling, decoupled from the ideal guide-ring target) instead of hard-clamped at
   it. No Dough scoring/Scoring 2.0/Pitz/Recipe changes — deferred to D3B, which is the next open
   step on this track (a real-device Human Feel pass confirming the gesture itself is still
   recommended before D3B per the Result report §10, but is no longer a PR-open gate).
2. Preserve exact dough/sauce/cheese/topping choices into baked visual identity; avoid hidden auto-correction.
   **Sauce Free Boundary (MERGED via PR #66)** is a first slice of this: sauce painting now
   visibly follows the actual dough silhouette past the old fixed circle instead of being
   hard-clipped to it — see `docs/reports/TETO_SAUCE-FREE-BOUNDARY_Result.md`.
3. Interactive bake judgment.
4. FINISH step for post-bake basil/finishing oil where recipes require it.
5. RESULT identity: completed pizza as visual hero + descriptive traits/Teto reaction; score/stars secondary. **Slice 1 (Completed Pizza Hero + Result Flow Foundation) implemented — PR #75, OPEN pending Human Review.** See RESULT 2.0 addendum above and `docs/reports/TETO_RESULT-2_SLICE1_Result.md`. Slice 2/3 (feedback-line translation layer, reveal sequencing, Cooking Time scaffold) remain open.

### P3 — Scoring 2.0 Authority / RESULT

Original Fresh Audit — see `docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md` (audited SHA
`2da3949de5bd642c709ca6ba343bc57d8101d03d`, verdict at the time: **D. BLOCKED BY ANOTHER SYSTEM**,
on two findings: no Bake component for any recipe; Reference coverage for only 1 of 7 recipes).
**Both blockers are now closed** — see B1/B2 below. **A1 is MERGED** — see
`docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md` (the Pre-Implementation Audit's own verdict,
**B. READY WITH MINOR DESIGN DECISION**, is in
`docs/reports/TETO_SCORING2-A1_AUTHORITY_PreImplementation-Audit.md`). PR #60, merge commit
`12666faf55ed1e479d51572f6a8e3fcfc744cf31` on `main`. **A2 Human Review: PASS.**

1. Add a reviewed Bake similarity component to Scoring 2.0 (**B1** — **implemented and merged**,
   PR #58, merge commit `f464026` on `main`,
   `docs/reports/TETO_SCORING2-B1_BAKE_Result.md`; Shadow-only, real for every recipe
   regardless of B2's own Reference-coverage gate).
2. Extend Reference coverage from Margherita-only to the remaining 6 recipes (**B2** — **implemented
   and merged, 7/7 complete**, PR #57, merge commit `a063068` on `main` = current HEAD) — see
   `docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md` and
   `docs/reports/TETO_SCORING2-B2_PARTC2_Result.md`. `getReferencePizza` now returns a reviewed
   `ReferencePizza` for all 7 recipes (margherita, marinara, funghi, genovese, fugazza, bismarck,
   quattro-formaggi), pinned by `scoringV2.test.ts`'s Golden Matrix for every one of them.
3. **A1 authority adapter** (`gameReducer.ts` `CONFIRM_BAKE`): **IMPLEMENTED AND MERGED** — see
   `docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md`. `state.score` is now derived from
   Scoring 2.0 via the new `toLegacyScoreBreakdown` adapter for all 7 recipes/FREE/Lunch Rush;
   `ResultPanel` gained a 4th "ソース" feedback row (the design decision the Pre-Implementation
   Audit surfaced, now decided and implemented). Legacy `scorePizza` kept callable, not deleted,
   no longer authoritative (zero production call sites remain — only test files still call it).
   No Save migration needed. **PR #60, merge commit `12666faf55ed1e479d51572f6a8e3fcfc744cf31`
   on `main`. A2 Human Review: PASS.** (Update: `scorePizza`/`scorePlacement` were later fully
   deleted, not merely left non-authoritative, by A3b — see
   `docs/reports/TETO_SCORING2-A3B_LEGACY-RETIREMENT_Result.md`.)
4. Save v2 migration is **not required** for the cutover itself — Dex's `bestScore`/`bestStars`
   schema is already formula-agnostic, re-confirmed by the A1 audit and by A1's own
   save-compatibility regression tests.
5. **A2 (Human Feel / cutover verification) PASSED and PR #60 merged.** **A3** (legacy
   `scorePizza`/Shadow-panel cleanup) — Fresh Audit done, see
   `docs/reports/TETO_SCORING2-A3_LEGACY-CLEANUP_PreImplementation-Audit.md` (verdict: **C. SPLIT
   A3** into A3a safe cleanup/rename and A3b deeper legacy retirement). **Both A3a and A3b are
   now implementation-complete** — see `docs/reports/TETO_SCORING2-A3A_SAFE-RENAME_Result.md` and
   `docs/reports/TETO_SCORING2-A3B_LEGACY-RETIREMENT_Result.md`. Legacy `scorePizza`/
   `scorePlacement` are fully deleted (not merely non-authoritative) as of A3b.
6. Integrate stars / Dex BEST / progression without Recipe/Pieces/Dough/Bake/Finish double
   penalties — confirmed (again, independently, by the A1 audit, and now by A1's own regression
   suite) to need zero code changes at cutover beyond the `CONFIRM_BAKE` adapter itself
   (`dex.ts`/`missionScoring.ts`/`progression.ts` already only depend on `ScoreBreakdown`'s
   `.total`/`.stars`, not which formula produced them).
7. Score-based baked visual/sauce polish only after behavior and authority are stable.

### P4 — Pitz / Economy — Issue #38

1. Fresh Audit existing Pitz/save/shop contracts. **Done** — see
   `docs/reports/TETO_ISSUE-38_PITZ-REWARD_Fresh-Audit.md`. Verdict: **A. READY AFTER SCORING
   AUTHORITY**.
2. Deterministic score-based reward core (E-P1). **Implemented and MERGED via PR #64** — see
   `docs/reports/TETO_ISSUE-38_PITZ-REWARD_Result.md`:
   `src/logic/pitzReward.ts`'s `recipeBaseReward × qualityMultiplier = earnedPitz`, bands
   reusing `scoring.ts`'s existing star thresholds; exact balance values remain provisional
   until E-P3 playtesting. FREE-only; Lunch Rush's existing per-run reward is unchanged.
3. RESULT one-time credit + before→after Pitz display; prevent reload/re-entry double credit
   (E-P2). **Implemented and MERGED via PR #64** — see the same Result report: extends the
   existing `REGISTER_TO_DEX` atomic reducer transaction (no new action), `GameState.
   lastPitzCredit` transient snapshot feeds a new DISCOVERED-phase summary.
4. iPhone Human Feel / reward balance (E-P3). **Next open step** on this track — independent of
   and not blocking Issue #33 D3A.

Currency contract: **Pitz**. Do not introduce ¥/円 as the game currency.

### P5 — Save v2 / Inventory / Shop

Fresh Audit done — see `docs/reports/TETO_SAVE-V2_INVENTORY_Fresh-Audit.md` (audited SHA
`2da3949de5bd642c709ca6ba343bc57d8101d03d`). Verdict: **B. READY WITH MINOR DESIGN DECISIONS**.
Recommended build order (refines the scope list below, which described *what* this phase owns, not
a strict build order): **E0 Save v2 migration → E1 InventoryState → E2 atomic consumption at
CONFIRM_BAKE → E3 Shop 2.0 restock** — consumption is sequenced *before* restock because Starter
ingredients are unconditionally unlimited stock (first-pizza safety by construction), which makes
E2 a zero-visible-impact change validated against the one existing purchasable ingredient
(`onion`) before any new Shop UI risk lands.

**E0 implementation MERGED — PR #56.** See
`docs/reports/TETO_SAVE-V2_E0_Result.md` (branch `claude/teto-e0-save-v2-migration-ly42xe`).
`schemaVersion` bumped to 2, `PersistentSaveV2` adds `inventory:
Record<string, number>`; standalone `migrateV1toV2` carries every existing v1 field through
unchanged and backfills `inventory` for already-purchased (non-Starter) ingredients via
`DEFAULT_MIGRATION_RESTOCK_QTY = 4` (matches `fugazza`'s `onion` `minCount`); Starter ingredients
can never acquire finite stock semantics. No gameplay change — `inventory` is not read by any
reducer/UI yet (E1's job). Full suite 999/999 at merge time, typecheck/lint/build clean, CI
green, dedicated Preview deploy + 390×844 Review Playthrough done. Next recommended
implementation task on this track: **E1 (InventoryState)** — independent of Issue #38's Pitz
Reward, which stayed entirely inside the pre-existing `pitzBalance` field per its own Fresh
Audit's §6.

1. Safe v1→v2 migration before new persistent semantics.
2. Consumable inventory separate from permanent ingredient ownership.
3. Restock / Shop purchasing.
4. Atomic material consumption at the reviewed confirmation boundary.
5. Revenue / ingredient cost / profit foundation.
6. Lunch Rush economy integration.
7. Dough inventory/consumption only after Save v2; Practice remains non-consuming.
8. Apply the approved Shop visual direction once the purchase loop is functional.

### P6 — Replayability / Content

- Difficulty / Hint Policy: Practice, Normal, Challenge, Lunch Rush.
- Time Attack after quality/authority contracts stabilize.
- Recipe expansion toward 20 using reviewed References rather than fabricated targets.
- Content Catalog + Recipe/Ingredient Editor before large-scale expansion.
- Pizza Dex visual overhaul and expansion: undiscovered → discovered → BEST → MASTER.
- Progression 2.0 / post-Dex-completion motivation.
- Recover/normalize larger PIZZA DB-derived catalog only from verified source data.

### P7 — Character / Final Polish

- richer official Teto/Mito/Blue reactions coordinated with Making Game/RESULT traits
- final animation / sound / visual polish
- advanced mechanics only after making, scoring, economy and replay loops are stable

## Screen implementation timing

| Order | Screen | Timing |
|---|---|---|
| 1 | HOME | Issue #39 now |
| 2 | Pizza Select | Issue #39 now |
| 3 | Making Game | #32 (done) → #47 (done) → **#33 D1/D2 (COMPLETE, PR #54, Human Feel PASS)** → **#33 D3A (MERGED, PR #65)** → **Sauce Free Boundary (MERGED, PR #66)** → #37 |
| 4 | RESULT | Scoring 2.0 Authority / Making Game 2.0 → **RESULT 2.0 Slice 1 (Hero + Flow Foundation) implemented, PR #75 OPEN pending Human Review** |
| 5 | Pizza Dex | after score/BEST authority stabilizes, before broad recipe expansion |
| 6 | Lunch Rush | after Making Game 2.0 stabilizes |
| 7 | Pitz reward UI | Issue #38 E-P1/E-P2 MERGED via PR #64 |
| 8 | Shop | after Save v2 / Inventory |
| 9 | Achievements / final progression | Progression 2.0 |

## Parallel / non-blocking

- Issue #27 accessibility live-region follow-up.
- SSOT docs cleanup against fresh code truth.
- PIZZA DB source recovery/catalog normalization as separate research/data work.
- HOME visual polish (future, non-blocking, not an Issue #39 gate): reduce HOME's lower-half
  empty space; strengthen pizza thumbnail representation on Pizza Select cards.

## Non-negotiable guards

- preserve the playable making loop and reset/stale-pointer safety
- preserve save compatibility unless a separately reviewed migration is intentionally introduced
- Scoring 2.0 is now authoritative (A1 implemented and merged via PR #60, A2 Human Review
  PASSED); legacy `scorePizza` and Scoring 2.0 must never both hold authority at once
- do not silently change Dex BEST, stars, totalStars, Mission, Pitz, Shop or progression during navigation/visual-only work
- do not fabricate Reference targets, recipes, unlocks or catalog data
- player-made shape/placement should remain visibly identifiable through later steps; avoid silent normalization
- reasonable imperfection should remain viable
- official repository character assets are authoritative for Teto/Mito/Blue appearance
- smartphone vertical remains primary
- fresh repository state/tests outrank stale handoff text

## Preferred workflow

The detailed Human Verification requirements this section summarizes (applicability, viewports,
video/screenshot content and validation, Result Report format, Definition of Done) are formalized
in `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` — that file is the SSOT; this section stays
a summary and must not drift from it.

While Codex availability is limited:

`Fresh Audit/design → Claude Code implementation → tests/review → Preview → user iPhone Human Feel`

Use Codex for important independent reviews when available; do not block routine progress waiting for it.

Claude Code implementation tasks should generally stay around 2–3 hours where practical. Result reports belong under `docs/reports/`.

### PR CI and the WebKit Gate (Issue #201)

- `CI` (`ci.yml`): lint → full Vitest → build on every PR, unchanged. Chromium e2e projects stay
  local/manual.
- `E2E WebKit` (`e2e-webkit.yml`): `classify` → `webkit` (every `e2e/*.spec.ts` on 390×844 +
  360×800, as a 4-job matrix: each viewport × `--shard` 1/2, 2/2 — Issue #207 Phase 2A)
  → **`WebKit Gate`**. The gate passes only if every shard succeeded **and** the shard evidence
  proves every listed test ran exactly once and passed on both viewports (missing, duplicated,
  cancelled or skipped shard → FAIL). Full WebKit also runs after every merge to `main`
  (`push`), on demand (`workflow_dispatch`), and on any PR labelled `webkit-full`. WebKit is skipped only when the change cannot reach the browser:
  documentation (`docs/**`, `**/*.md` outside `src/`/`e2e/`/`public/`/`functions/`/`.github/`),
  and (Phase 2B) offline `tools/**/*.py` scripts and `src/**/*.test.ts(x)` / `src/test/**` Vitest
  files — the last two only while a repository scan proves nothing the app or `e2e/` imports them.
  It is also skipped when only such files changed since a previous head whose `WebKit Gate`
  already succeeded on the same base commit (base moved → WebKit runs). Every other or
  unknown path, and any classifier error, runs WebKit. The reason is shown as a notice and in the
  job summary.
- `WebKit Gate` always reports a result and is the check to require; it fails if WebKit was
  required and did not pass. Both PR workflows cancel superseded runs per PR (`concurrency`).
- Practical rule: land runtime changes first, let WebKit pass once, then push Result Report /
  screenshot / unit-test-only commits — those reuse the passing WebKit result instead of
  re-running it.
- Details, verification and rollback: `docs/reports/TETO_DEV-CI_WEBKIT-CONDITIONAL_A1A2_Result.md`
  (#201), `docs/reports/TETO_DEV-CI_WEBKIT-PHASE2A_Result.md` (#207 Phase 2A) and
  `docs/reports/TETO_DEV-CI_WEBKIT-PHASE2B_Result.md` (#207 Phase 2B; why affected-spec,
  single-viewport selection and duration-balanced shards were not adopted). The WebKit CI script tests run in `ci.yml` via
  `bash scripts/ci/test-webkit-ci.sh`.

### Standard completion rule (Issue #39 PS3 onward)

A change is not "改修完了" (done) until every one of these steps has actually run, in order:

`Fresh Audit/design → implementation → focused/full tests → typecheck/lint/build → commit/push → PR → CI → dedicated Preview deployment → Preview smoke test → targeted 390×844 Review Playthrough → MP4 video output → Human Feel review → merge`

Rules for this sequence:

- Do not report a task "implementation complete" before its dedicated Preview deployment has
  finished. CI green on `perusonao/teto-pizza-game` alone is not enough, since the separate
  `perusonao/teto-pizza-game-preview` pipeline (manual `deploy-from-source.yml` + `pages.yml`
  dispatch, see the Issue #39 PS1/PS2 Preview-Gate report for the exact commands) is what the
  user actually opens on a real device. If Preview deploy genuinely cannot be completed in a
  session (e.g. sandboxed network policy blocking the dispatch itself), say so explicitly as a
  blocker rather than silently skipping the step.
- The Review Playthrough is not a fixed, always-identical script — design it each time around
  the specific review question this change needs answered (what changed, what could have
  regressed, what the user needs to actually see).
- Video: 390×844 is the primary viewport. Hold 1–3 seconds on every screen/state that matters
  for review. Prefer MP4 output (convert from the capture tool's native format if needed) for
  playback compatibility.
- Never commit a large review video into the repository. `artifacts/` (including
  `artifacts/review/`) is gitignored; deliver video directly to the user instead of committing
  it.
- **Audit-only tasks are exempt from Preview deployment and video capture** — a read-only
  Fresh Audit that changes no production code has nothing to deploy or play through.

## New-session startup checklist

1. Inspect fresh GitHub `main`, open PRs, issues and Actions state.
2. Read this file, Issue #22 and the current execution issue.
3. Treat fresh GitHub state as authoritative if anything conflicts.
4. Read the latest relevant audit/result report before implementation.
5. Scoring 2.0 is now authoritative (A1 implemented and merged via PR #60; A2 Human Review
   PASSED) — do not re-open the Shadow-only question without a specific regression to justify
   it. **A3 (A3a + A3b) is fully COMPLETE and MERGED** — PR #62 (A3a) and PR #63 (A3b) are both
   merged into `main`; legacy `scorePizza`/`scorePlacement` no longer exist in the codebase in
   any form. See `docs/reports/TETO_SCORING2-A3A_SAFE-RENAME_Result.md` and
   `docs/reports/TETO_SCORING2-A3B_LEGACY-RETIREMENT_Result.md`.
6. **Issue #38 (Pitz Reward) E-P1/E-P2 is implemented and MERGED via PR #64** — see
   `docs/reports/TETO_ISSUE-38_PITZ-REWARD_Result.md`. Do not re-implement the reward core or
   re-litigate the FREE-only/Lunch-Rush-unchanged mode contract without a specific regression;
   the next open work on this track is E-P3 (Human Feel/balance).
7. **Issue #33 D3A (Reversible Dough Shaping) is MERGED via PR #65**, merge commit
   `ceaa78a340362d06a18700251afae9c969df96c9` on `main` — see
   `docs/reports/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_Result.md`. Do not re-implement the gesture or
   re-litigate the monotonic-floor removal / technical-vs-ideal boundary split without a specific
   regression; D3B (Dough scoring integration) is the next open step on this track (a real-device
   Human Feel pass is still recommended before D3B per that PR's own Result report, but is no
   longer a PR-open gate).
8. **Sauce Free Boundary is MERGED via PR #66**, merge commit `cf6d414` on `main` — see
   `docs/reports/TETO_SAUCE-FREE-BOUNDARY_Fresh-Audit.md` and
   `docs/reports/TETO_SAUCE-FREE-BOUNDARY_Result.md`. Sauce painting can now visibly exceed
   `SAUCE_TARGET_RADIUS`/the old fixed `DOUGH_RADIUS` circle onto the dough/crust, following the
   player's actual current `doughShape` silhouette; `SAUCE_TARGET_RADIUS` itself, and every
   Scoring 2.0 Sauce component/reference fixture, are unchanged. Do not re-implement this boundary
   test or re-litigate the render-only-vs-scoring split without a specific regression.
9. Whenever priority, completion status, estimates, architecture, navigation or visual direction changes, update both Issue #22 and this file.
10. **PR #68 (M3A Bake Judgment) implementation is complete and READY FOR HUMAN REVIEW** — see
    `docs/reports/TETO_M3A_BAKE-JUDGMENT_Result.md`. Final head `de52b612bcd65e1990e38d0ca752b1663e4cea35`,
    Preview deployed, Review Playthrough delivered. Still OPEN/unmerged pending the user's Human
    Review — re-check fresh GitHub state before starting any further Bake-related work rather than
    assuming it stays open or has since merged.

Issue #37 remains the parent roadmap for physical pizza-making UX. Issue #39's HOME/FREE navigation work is complete. Issue #47 (Making UX Cleanup) is complete (Slice A/B merged, Human Feel PASS; Slice C's Finding J handed to Issue #37 M2). **Issue #33 (Dough Shaping) D1/D2 are COMPLETE, Human Feel PASS** (PR #54, merge SHA `c0b93504f84adbccdc1c75567677d234f832cfb1`, see `docs/reports/TETO_ISSUE-33_DOUGH-D1_Result.md`) — ChatGPT's review of the D2 Review Playthrough MP4 returned PASS and PR #54 was merged after that. **Issue #33 D3A (reversible/free-boundary shaping) is MERGED via PR #65** — see `docs/reports/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_Result.md`. **Sauce Free Boundary is MERGED via PR #66** — see `docs/reports/TETO_SAUCE-FREE-BOUNDARY_Result.md`. Issue #37 M2 (Cheese/Topping drag scope) remains a separate, ungated Making Game 2.0 item. **Scoring 2.0 A1 Authority Cutover is MERGED** (PR #60, merge commit `12666faf55ed1e479d51572f6a8e3fcfc744cf31`, A2 Human Review PASSED) — see `docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md`; **A3 (A3a + A3b) is fully COMPLETE and MERGED** — PR #62 and PR #63 are both merged into `main` (see `docs/reports/TETO_SCORING2-A3A_SAFE-RENAME_Result.md` and `docs/reports/TETO_SCORING2-A3B_LEGACY-RETIREMENT_Result.md` — `scorePizza`/`scorePlacement` no longer exist anywhere in the codebase). **Issue #38 (Pitz Reward) E-P1/E-P2 is implemented and MERGED via PR #64** — see `docs/reports/TETO_ISSUE-38_PITZ-REWARD_Result.md`.