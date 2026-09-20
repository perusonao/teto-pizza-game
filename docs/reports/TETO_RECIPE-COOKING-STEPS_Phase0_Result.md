# TETO Recipe Cooking Steps 1.0 — Phase 0 Result Report

**Audited SHA:** `bdc0be38e4b61cbd955c02b930342617c42eda32` (`origin/main`, fetched and
fast-forwarded onto this branch before any audit work started).

**SSOT design document:** `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` (companion to this
report — full detail for every claim summarized below lives there).

## 1. Duplicate Gate #1 — result

`git fetch origin` (all remote branches, including several newly-visible ones) followed by a
targeted PR/branch search found:

- **No PR or branch named/matching** "Pizza Cutting", "cutting", "cutter", "cooking steps",
  "cooking flow", "calzone", "stuffed crust", or "finishing" — open or closed, anywhere in the
  repo's history of merged/open PRs. "Pizza Cutting 1.0" does not exist as a PR or branch today.
- **5 open PRs total** at audit time (#105 dev-automation, #72/#46/#34/#3 — none overlap this
  task's scope; none touch recipe cooking flow, cutting, scoring, Firebase, or economy).
- Firebase Ranking, Economy Tuning, and Recipe Expansion are **all fully merged** (Firebase
  Ranking through Phase 2A/#118; Economy Tuning through #119/#120; Recipe Expansion through Batch
  1B-C/#117) — nothing in-flight to conflict with.
- No existing PR for this branch (`claude/teto-recipe-cooking-steps-audit-caq0tq`).

**Verdict: clear to proceed.** No duplicate or conflicting work found.

## 2. Files audited

Core state/flow: `src/state/gameReducer.ts`, `src/state/pizzaState.ts`, `src/components/
MakingStepTabs.tsx`, `src/screens/GameScreen.tsx` (structure), `src/logic/completionGate.ts`,
`src/logic/scoringV2/index.ts`. Data/schema: `src/data/recipes.ts`, `src/data/ingredients.ts`,
`src/data/referencePizza.ts`, `src/logic/pizzaReferenceLayout.ts`, `src/data/orders.ts`. Save/
server: `src/state/persistence.ts`, `src/firebase/submitLunchRushScore.ts`, `functions/src/
submitLunchRushScore.ts`, `src/shared/lunchRushScoring.ts`. Prior design docs: `docs/reports/
TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md`, `docs/design/TETO_RECIPE-EXPANSION-20.md`,
`data/recipes/pizza_master_catalog.json` (53-entry ground truth, parsed programmatically for the
capability matrix rather than hand-transcribed). Repo-wide search confirmed zero existing
cut/fold/calzone/stuffed/deep-dish/detroit gameplay code in `src/`.

## 3. Current blockers (why this can't just be a recipe-data PR today)

1. `MakingStep`/`MAKING_STEP_ORDER` (`gameReducer.ts:50-57`) is a hardcoded 4-value union +
   module-level array — no per-recipe variation possible without widening it.
2. `MakingStepTabs.tsx`'s own `STEP_ORDER` is a *second*, independent hardcoding of the same 4
   steps at the UI layer.
3. `GamePhase` has no phase between BAKE and RESULT — nowhere to hang a post-bake step (CUT,
   FINISH) today.
4. `Recipe` (`recipes.ts`) has zero fields describing "how" a dish is made — only composition.
5. `Ingredient` has no application-phase concept (`placement: "spread" | "scatter"` only).
6. Scoring's 4 weights (52/16/12/20) are fixed and iPhone-calibrated — any 5th component needs a
   deliberate weight decision, not just new code.
7. `CompletionFailureReason` is a closed 5-literal union with no slot for "the fold wasn't sealed."

## 4. Architecture recommendation (summary — full rationale in the SSOT doc)

- **Data model:** a new, separate `CookingProfile` map keyed by `recipeId`
  (`getCookingProfile(recipeId)`, default profile for any absent entry), modeled directly on the
  already-proven `referencePizza.ts` `REFERENCE_PIZZAS` Map pattern. **Zero changes to any of the
  15 existing `RECIPES` entries.**
- **State machine:** `GamePhase` gains one new phase, `POST_BAKE` (between BAKE and RESULT), for
  steps that must happen after baking (CUT, FINISH). `MakingStep` widens; `MAKING_STEP_ORDER`
  becomes a per-round value read from the active recipe's `CookingProfile.steps` instead of a
  global constant.
- **UI:** the existing `MakingStepTabs` component's completed/active/next-only rendering logic
  already scales to any step count — extend it to read its tab array from the profile and collapse
  non-adjacent tabs into compact chips past 4, rather than building a new navigation pattern.
- **Scoring:** Core score (today's unchanged 52/16/12/20 formula) + optional per-step bonus/
  penalty, added only for recipes whose profile declares a new step, clamped to 100. Zero score
  change for any of the 15 existing recipes, by construction.
- **Completion Gate:** additive new failure reasons, checked only for profile-declared steps
  marked `requiredForCompletion`. Zero behavior change for existing recipes.
- **Ingredient usage:** application phase (`PRE_BAKE`/`POST_BAKE`/`EDGE_FILL`) belongs on the
  **recipe's own ingredient requirement** (`RecipeRequirement`), not on `Ingredient` itself — the
  same ingredient (e.g. olive oil) can be pre-bake in one recipe and post-bake in another, so a
  global `Ingredient` flag would be wrong by construction.
- **Guidance:** extend `ReferencePizza` with new optional per-step guide fields, same per-recipe
  Map/lookup pattern, same "absent = doesn't render" contract already used for `pieceGroups`.
- **Migration path:** land the data model + state machine widening + UI generalization *before*
  any new step's gameplay code — provably a zero-behavior-change step for all 15 recipes, checked
  before any new mechanic starts shipping.

## 5. First new step recommendation

**CUT**, built as the first real consumer of the `CookingProfile`/`POST_BAKE` foundation (not
hardcoded ahead of it) — see design doc §20 for why. No "Pizza Cutting 1.0" work exists yet to
build on or avoid duplicating (§1 above), so this is a fresh recommendation, not a conflict
resolution.

## 6. Schema / save / scoring / UI impact summary

| Area | Impact this phase | Impact of the *recommended* future design |
|---|---|---|
| Recipe schema | none (docs only) | new sibling file (`CookingProfile` map); zero change to `Recipe` itself |
| Ingredient schema | none | new optional field on `RecipeRequirement`, not on `Ingredient` |
| Save schema | none | **none** — cooking state is already fully transient (`PersistentSaveV2` never serializes `GameState`/`PizzaState`) |
| Scoring | none | additive optional per-step bonus layer; core formula for existing recipes provably unchanged |
| Completion Gate | none | additive failure reasons, gated per profile; unchanged for existing recipes |
| UI navigation | none | generalize existing `MakingStepTabs` component; no new component family |
| Lunch Rush | none | no change proposed; future step-scoring inherits today's existing (already-imperfect) trust posture, not a regression |
| Firebase | none | no change proposed |

## 7. 53-recipe capability summary

Full per-recipe matrix in the SSOT doc §19 (generated programmatically from
`data/recipes/pizza_master_catalog.json`, not hand-transcribed). Headline numbers, straight from
that catalog's own fields:

- 15 shipped (Class A/B, baseline mechanics only — already true today).
- 28 of 51 viable candidates need **no new mechanic at all** (pure ingredient-data additions).
- `postBakeFinishing` (→ this design's **FINISH** step) is needed by **15** candidates — by far
  the single highest-leverage new step.
- Every other new mechanic (`quadrantPlacement`/**REGION**, `halfAndHalfSplit`/**HALF**,
  `foldDough`/**FOLD+SEAL**, `stuffedDough`, `layeredReverseOrder`/**REVERSE_LAYER**,
  `ringPlacement`/**EDGE_FILL**) is needed by exactly **1** recipe each — expensive, single-payoff,
  correctly treated as Master-tier content to space out, not batch (matches the Master Catalog's
  own §11 recommendation).
- No catalog mechanic maps to CUT — it's cross-cutting (near-universal), not a per-recipe
  differentiator, so it isn't and shouldn't be "discovered" from this matrix.

## 8. Recommended next implementation

**Phase 1A — Cooking Step Foundation** (per the SSOT doc §21): `CookingProfile` data model +
`MakingStep`/`GamePhase` widening (incl. `POST_BAKE`) + `MakingStepTabs` generalization. Explicitly
*not* CUT itself yet — this slice should ship provably behavior-identical for all 15 existing
recipes, verified by the existing test suite plus new regression coverage, before any new gameplay
mechanic is built on top of it.

## 9. Risks

- **Scope creep risk:** the temptation to build CUT (or any step) directly into a "foundation"
  slice rather than as a strictly separate follow-up. Mitigated by making Phase 1A's own
  completion criterion "zero behavior change for all 15 recipes," which is falsifiable and
  testable independent of any new mechanic.
- **Modifier/step boundary drift:** future contributors adding a new capability as a `steps[]`
  entry when it's actually a modifier (inflating the step count and UI complexity unnecessarily).
  Mitigated by the explicit test in the SSOT doc §4 ("distinct gesture + distinct completion
  condition" vs. "changes an existing gesture's ruleset") and by modifiers being structurally
  impossible to add to `steps[]` in the recommended data shape (§7 of the design doc).
- **Reference-ring capacity:** the existing 8-slot `PIECE_RING_POSITIONS` ceiling is already a
  real constraint (it's why `supreme` is deferred today) and will need a per-recipe check for any
  future high-density FINISH-heavy recipe — flagged, not solved, here.
- **Product decisions still open:** `mezza-e-mezza`'s recipe-pairing rule (which two recipes may
  combine) has no answer yet — flagged by `TETO_RECIPE-EXPANSION-20.md` already, not resolved by
  this document either. HALF/REGION implementation cannot start until it is.

## Final Verdict

**A. READY FOR STEP FOUNDATION.**

The architecture question this task set out to answer has an internally-consistent, low-risk
answer (`CookingProfile` map + `POST_BAKE` phase + generalized step-order/tabs) that requires zero
migration of the 15 existing recipes and reuses two patterns already proven correct in this
codebase (`referencePizza.ts`'s per-recipe Map; the already-scaffolded but dormant
`InteractionFamily` variants). Phase 1A (the foundation slice itself) can begin as a follow-up
implementation task with a concrete, testable zero-regression bar. No blocking open product
decisions exist for Phase 1A specifically (they exist only for later step-specific slices — HALF/
REGION's recipe-pairing question, most notably — and are already flagged as such, not silently
assumed).
