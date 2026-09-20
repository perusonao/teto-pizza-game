# TETO Recipe Cooking Steps 1.0 — Phase 0 Fresh Architecture Audit (READ-ONLY, docs-only)

**Audited `origin/main` SHA:** `bdc0be38e4b61cbd955c02b930342617c42eda32` (fast-forwarded onto this
branch before this document was written — this branch had zero prior commits beyond that point).

**Scope:** design-only. No production code, Recipe/Ingredient schema, Scoring, Completion Gate,
Lunch Rush, Firebase, or save-schema change ships in this task. Every recommendation below is a
proposal for a *future* implementation slice, not something this PR builds.

**Duplicate Gate #1 result (before this audit started):** `git fetch origin` plus a search of
every open PR and every remote branch found no in-flight "Pizza Cutting 1.0" work (no PR or
branch by that name, or matching `cut`/`cutter`/`calzone`/`stuffed crust`/`finishing` exists,
open or closed) and no open PR for Firebase Ranking, Economy Tuning, or Recipe Expansion (all
three families are fully merged — Firebase Ranking through Phase 2A/#118, Economy Tuning through
#119/#120, Recipe Expansion through Batch 1B-C/#117). This branch itself had no existing PR. Full
detail: `docs/reports/TETO_RECIPE-COOKING-STEPS_Phase0_Result.md` §1.

---

## 1. Problem statement

Every one of the 15 shipped recipes (`src/data/recipes.ts`) runs through the exact same fixed
operation sequence — only *ingredients* differ, never *what the player does*. This document
designs an architecture that lets a future recipe declare a different **sequence of operations**
(cut, fold, seal, finish, stuff a crust edge, split into two halves …) without rewriting the core
game loop per recipe and without migrating the 15 recipes that don't need any of it.

The two Master Catalog documents already audited *which* new operations the next 38 candidate
recipes need and in what order to build them cheaply
(`docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` §8/§11,
`docs/design/TETO_RECIPE-EXPANSION-20.md` §6). This document does not repeat that recipe-selection
work — it answers the architecture question those reports both flag but explicitly defer: *how*
does the engine represent "this recipe's operations are different" without becoming a per-recipe
`switch` that grows forever, and without a from-scratch generic Step Engine that this task's own
brief (§7) forbids building ahead of need.

## 2. Current architecture (verified against `bdc0be3`)

### 2.1 State machine, exactly as coded today

```
GamePhase (src/state/gameReducer.ts:42, fixed 5-value union):
  ORDER -> PREPARE -> BAKE -> RESULT -> DISCOVERED

Within PREPARE, MakingStep (gameReducer.ts:50, fixed 4-value union):
  DOUGH -> SAUCE -> CHEESE -> TOPPING
  (MAKING_STEP_ORDER, gameReducer.ts:52, a module-level array; nextMakingStep() walks it
   forward-only, gameReducer.ts:54-57)
```

Full flow a player experiences: `ORDER` (dialogue/order intro) → `PREPARE` (DOUGH → SAUCE →
CHEESE → TOPPING, gated by `CONFIRM_MAKING_STEP`) → `BAKE` (needle-tap minigame, one phase, no
sub-steps) → `RESULT` (scoring, Dex, Pitz, mission serve) → `DISCOVERED` (post-RESULT recipe-book
state). Every recipe, without exception, walks this identical five-phase / four-substep path.

### 2.2 Where the flow is hardcoded (the actual migration surface)

| Location | What's fixed | Why it matters here |
|---|---|---|
| `gameReducer.ts:50` `MakingStep` union | 4 literal strings | Adding CUT/FOLD/… means widening this union |
| `gameReducer.ts:52` `MAKING_STEP_ORDER` | one module-level `const` array | The *only* place step order lives — not per-recipe |
| `gameReducer.ts:54-57` `nextMakingStep()` | walks the module constant | Would need to walk a per-round array instead |
| `gameReducer.ts:42` `GamePhase` | 5 literal strings, PREPARE/BAKE adjacent | No phase exists between BAKE and RESULT today — nowhere to hang a post-bake FINISH/CUT step |
| `components/MakingStepTabs.tsx:33` `STEP_ORDER` | hardcoded 4-tab array + hardcoded label map | UI tabs are a second, independent hardcoding of the same 4 steps |
| `data/recipes.ts` `Recipe` interface | flat `requiredIngredients`/`bakeTarget`, no step/mechanic field at all | Recipe data has no concept of "which operations this dish needs" |
| `data/ingredients.ts` `Ingredient` interface | `placement: "spread" \| "scatter"` only | No third placement kind, no application-phase concept |
| `logic/scoringV2/index.ts:48-51` | 4 fixed weights (Sauce 52 / Pieces 16 / Recipe 12 / Bake 20) summing to exactly 100, iPhone-calibrated | Any 5th component needs a weight decision, not just new code |
| `logic/completionGate.ts:23-28` `CompletionFailureReason` | 5 fixed literal reasons | A new step's own "did the player actually finish it" question has nowhere to register today |
| `data/referencePizza.ts` `ReferencePizza`/`ReferencePieceGroup` | per-recipe `Map`, 8-slot shared `PIECE_RING_POSITIONS` (`logic/pizzaReferenceLayout.ts:11`), `MAX_INGREDIENT_PALETTE_SLOTS = 6` (`data/ingredients.ts:506`) | Existing hard capacity ceilings a high-density recipe (e.g. `supreme`, deferred for exactly this reason — see `recipes.ts:362-371`) already collides with |

### 2.3 What's already *not* fixed, and already points the way

Three details already exist in the codebase that this design leans on directly rather than
inventing from scratch:

1. **`data/referencePizza.ts`'s `REFERENCE_PIZZAS` Map** (`recipeId -> ReferencePizza`, default
   `null` for an absent id) is already the exact "per-recipe optional profile, absent = no
   special data" pattern §8 below proposes reusing for cooking steps.
2. **`InteractionFamily`** (`referencePizza.ts:41-48`) already declares
   `"SPREAD" | "HOLD_SCATTER" | "TAP_PLACE" | "SPRINKLE" | "DRIZZLE" | "SPECIAL" |
   "NON_INTERACTIVE"` — SPRINKLE/DRIZZLE/SPECIAL/NON_INTERACTIVE have **no real consumer today**.
   This type was scaffolded ahead of the mechanics that would use it; FINISH (drizzle/sprinkle)
   is its first real consumer, not a new invention.
3. **Lunch Rush's server-authoritative trust boundary** (`functions/src/submitLunchRushScore.ts`)
   already establishes the pattern a future CUT/FOLD/FINISH score contribution should follow: the
   server never trusts a client-supplied *aggregate*, only recomputes it from a compact,
   replayable log (`LunchRushServeRecord[]`). See §12.

### 2.4 Recipe data today (15 recipes, all Implementation Class A/B)

Every recipe in `data/recipes.ts` is `{ id, nameJa, description, requiredIngredients[], bakeTarget,
baseRewardPitz, unlockCondition?, mysteryLock? }`. No recipe has any field describing *how* it's
made — composition (`requiredIngredients`) is the only per-recipe variable today. Cross-checked
against the Master Catalog (`data/recipes/pizza_master_catalog.json`), all 15 are
`implementationClass: "A"` (7) or `"B"` (8) — zero new mechanic, `spread`/`scatter` only. No
`cut`/`fold`/`calzone`/`stuffed`/`finish` gameplay code exists anywhere in `src/` today (verified
by repo-wide search) — the entire cooking-steps concept is greenfield.

## 3. Step taxonomy

Two distinct kinds of "new thing a recipe can need," which must not be conflated (§6 makes the
test explicit):

### 3.1 CORE (existing, universal)

`DOUGH → SAUCE → TOPPING → BAKE → RESULT` (code additionally splits SAUCE/TOPPING into
SAUCE/CHEESE/TOPPING — a UI-level ingredient-category split, not a distinct cooking operation;
kept as-is, not touched by this design).

### 3.2 NEW STEPS (a distinct interaction moment, its own completion condition)

| Step | Where it sits | Gesture | First recipe need |
|---|---|---|---|
| `CUT` | POST_BAKE, before RESULT | swipe | universal (see §8's non-goal note — cutting applies to nearly every dish, not a differentiator) |
| `FOLD` | end of PREPARE, before BAKE | drag | `calzone` |
| `SEAL` | immediately after FOLD | trace | `calzone` |
| `EDGE_FILL` | start of PREPARE, before DOUGH shaping settles | place around perimeter | `stuffed-crust` (ring only), `fugazzeta` (full stuff — deferred) |
| `FINISH` | POST_BAKE, before RESULT | drizzle / scatter / place | 15 catalog candidates (`postBakeFinishing`, Batch 2) — the single highest-value new step (§11) |

### 3.3 CAPABILITY / MODIFIER (changes an existing step's rules, not a new interaction moment)

`HALF`, `REGION` (quadrant), `MULTI_SAUCE`, `SPECIAL_SHAPE` — see §6 for why these are modifiers,
not steps, in this design.

## 4. Step vs. Modifier — the actual test, applied

**Test:** *if the player must complete a distinct interaction gesture with its own start/commit
and its own completion condition, it is a STEP (a new entry in the per-recipe step sequence). If
it only changes the geometry/ruleset of a gesture the player is already doing inside an existing
step, it is a MODIFIER (a config object attached to that step).*

Applying it to every candidate the brief names:

- **HALF** (`mezza-e-mezza`, catalog `halfAndHalfSplit`) — the player is still doing SAUCE and
  still doing TOPPING; only the *canvas* changes (split into two independently-recipe'd regions).
  **Modifier** on SAUCE/TOPPING (`regions: "half"` config), not an independent step. This also
  matches `TETO_RECIPE-EXPANSION-20.md` §6.3's own framing ("a split-canvas PREPARE UI," not a new
  phase).
- **REGION / MULTI_SAUCE** (`quattro-stagioni`, catalog `quadrantPlacement`) — same test, same
  answer: still SAUCE/TOPPING, just quadrant-restricted placement + quadrant-aware scoring.
  **Modifier**, generalizes to the same `regions` config HALF uses (`"half" | "quadrant"`), not a
  second mechanism.
- **SPECIAL_SHAPE** (`chicago-deep-dish`/`detroit-style`/`siciliana`, catalog `specialShapePan`) —
  the player is still doing DOUGH (stretch/press); only the target shape/pan changes.
  **Modifier** on DOUGH (`shape: "round" | "square" | "deep-pan"`), reusing
  `logic/doughShape.ts`'s existing shape-validation seam rather than a new step.
- **REVERSE_LAYER** (`chicago-deep-dish`, catalog `layeredReverseOrder`) — same SAUCE/TOPPING
  gestures, reversed order. **Modifier**, not a step (flagged here even though the brief doesn't
  name it — the catalog's own §8 lists it as a 5th D-subsystem worth tracking).
- **CUT** — genuinely new gesture (swipe), new completion condition (N pieces, evenness), no
  existing step covers it. **Step.**
- **FOLD / SEAL** (`calzone`) — genuinely new gestures (drag the dough closed; trace the seam) with
  their own commit and their own failure mode (an open calzone). **Step**, and *two* steps, not
  one — see §5's operation-definition table for why FOLD (geometry) and SEAL (quality-of-closure)
  are worth separating even though the catalog currently bundles both under one `foldDough`
  mechanic entry (recorded here as a Phase 0 refinement proposal, flagged
  `verification-needed` in §19's matrix, not yet catalog-confirmed).
- **EDGE_FILL** (`stuffed-crust`) — a placement gesture around the dough perimeter before the
  center is topped; distinct enough (different valid zone, different completion condition — ring
  coverage, not center coverage) to be its own step rather than a TOPPING modifier. Matches the
  catalog's own `ringPlacement` being a distinct mechanic (Class C) from `stuffedDough` (Class D,
  `fugazzeta`, deferred).
- **FINISH** — genuinely new phase timing (after BAKE) even when it reuses TOPPING's own
  scatter/spread gestures (`TETO_RECIPE-EXPANSION-20.md` §6.1 already makes this exact point:
  "reuses the existing scatter placement UI, just gated to fire after BAKE"). **Step**, because
  the *timing gate* is the new thing, not the gesture.

## 5. Concrete recipe walkthroughs (verified against Master Catalog + `TETO_RECIPE-EXPANSION-20.md`)

| Recipe | Step sequence (this design) | Modifiers | Catalog class |
|---|---|---|---|
| Margherita (shipped) | DOUGH → SAUCE → TOPPING → BAKE → RESULT | none | A |
| + Pizza Cutting 1.0 (future, any recipe) | …→ BAKE → **CUT** → RESULT | none | n/a — cross-cutting, not catalog-tracked (§8) |
| Calzone | DOUGH → SAUCE → TOPPING → **FOLD** → **SEAL** → BAKE → RESULT | none | D |
| Stuffed Crust | **EDGE_FILL** → DOUGH → SAUCE → TOPPING → BAKE → CUT → RESULT | none | C |
| Mezza e Mezza | DOUGH → SAUCE → TOPPING → BAKE → CUT → RESULT | `regions: "half"` on SAUCE+TOPPING | D |
| Prosciutto / Diavola / Frutti di Mare (post-bake finishing) | DOUGH → SAUCE → TOPPING → BAKE → **FINISH** → CUT → RESULT | none | D |
| Chicago Deep Dish | DOUGH → SAUCE → TOPPING → BAKE → RESULT | `shape: "deep-pan"` on DOUGH, `layerOrder: "reversed"` on SAUCE/TOPPING | D |
| Detroit Style | DOUGH → SAUCE → TOPPING → BAKE → **FINISH** → CUT → RESULT | `shape: "square"` on DOUGH | D |
| Quattro Stagioni | DOUGH → SAUCE → TOPPING → BAKE → CUT → RESULT | `regions: "quadrant"` on SAUCE+TOPPING | D |

**Calzone does not need CUT** — a closed, folded pizza is served whole; adding CUT to its
sequence would be wrong, not merely optional, which is exactly why CUT must be a per-recipe
sequence entry (opt-in via the profile) rather than a phase every recipe passes through
unconditionally. **Stuffed Crust needs only one step (EDGE_FILL), not two** — `EDGE_FOLD` from
the brief's own sketch is folded into EDGE_FILL's own completion condition (press the ring closed
around the cheese as part of the same gesture) rather than a second step, since the catalog
itself scopes `stuffed-crust` to "ring-only stuffing," smaller than Calzone's full fold
(`pizza_master_catalog.json`'s own `stuffed-crust` `descriptionShort`).

## 6. Operation definitions (input / interaction / completion / scoring / failure / undo / visual)

| Step | Input | Interaction | Completion condition | Scoring signal | Can fail completion? | Undo? | Visual state |
|---|---|---|---|---|---|---|---|
| CUT | tap or hold on dough | swipe across baked pizza | ≥1 cut line drawn | evenness of piece sizes vs. target slice count | No (§10 — degrades score only) | yes, pre-commit (like sauce dispense) | slice-line overlay, pieces visually separated |
| FOLD | placed toppings + shaped dough | drag one dough edge to meet the opposite edge | dough overlaps itself within tolerance | closure completeness | Yes — an unfolded calzone isn't a calzone | yes, pre-commit | dough visually half-covers itself, interior toppings hidden |
| SEAL | folded (uncommitted) dough | trace along the open seam | seam traced within tolerance, endpoint-to-endpoint | seam evenness | Yes — an unsealed fold leaks in bake, same failure family as FOLD | yes, pre-commit | crimped-edge visual, egg-wash-style sheen |
| EDGE_FILL | shaped dough, perimeter zone | drag ingredient from tray to the ring zone | ring coverage ≥ threshold | ring evenness | Yes — an unstuffed "stuffed crust" isn't the dish | yes, remove-before-DOUGH-confirm | visible cheese ring inside the raw crust |
| FINISH | baked pizza | drizzle (reuse `sauceField.ts` paint) / scatter (reuse existing scatter) / place | reference-comparable application present | coverage/placement vs. Reference, same family as existing Sauce/Pieces components | No (degrades score only — a thin drizzle is still a real dish) | yes, pre-commit | glossy drizzle streaks / scattered garnish on the already-baked surface |

## 7. Recommended data model

Three options, weighed against the brief's own constraint ("existing 15 recipes migrate for
free," §11 of the brief):

**A. `cookingSteps: Step[]` field directly on `Recipe`.** Explicit and easy to read, but every
one of the 15 existing `RECIPES` entries would need the field added (even if to the same default
value) to keep `Recipe.cookingSteps` non-optional, or the field becomes optional everywhere and
every *reader* needs an `?? DEFAULT_STEPS` fallback scattered across the codebase. Also conflates
"recipe identity/unlock data" (`recipes.ts`'s existing job) with "how it's cooked."

**B. Fully derived configuration** — no explicit `steps[]` at all; a recipe "has FOLD" purely
because it has a `foldConfig` object, and the engine infers order from which config keys are
present. Zero fields to add to existing recipes, but step *order* becomes implicit and
fragile — two config blocks present at once (e.g. `foldConfig` and `finishConfig`) gives no
single place that says which happens first, which matters a lot here (FOLD must precede BAKE,
FINISH must follow it).

**C. Separate cooking-profile map, keyed by `recipeId`, modeled on the existing
`referencePizza.ts` `REFERENCE_PIZZAS` Map pattern — recommended.**

```ts
// New file, e.g. src/data/cookingProfiles.ts — NOT a change to recipes.ts
interface CookingProfile {
  /** Explicit, ordered — same clarity as option A, but lives off Recipe entirely. */
  steps: readonly MakingStep[]; // widened union, see §8
  doughConfig?: { shape?: "round" | "square" | "deep-pan" };
  sauceConfig?: { regions?: "half" | "quadrant"; layerOrder?: "normal" | "reversed" };
  toppingConfig?: { regions?: "half" | "quadrant"; layerOrder?: "normal" | "reversed" };
  cutConfig?: { targetPieces?: number };
  foldConfig?: { closureToleranceRatio?: number };
  edgeFillConfig?: { ingredientId?: string; ringWidthRatio?: number };
  finishConfig?: { ingredientIds?: readonly string[] };
}

const DEFAULT_COOKING_PROFILE: CookingProfile = {
  steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "BAKE"], // exactly today's fixed flow
};

function getCookingProfile(recipeId: RecipeId): CookingProfile {
  return COOKING_PROFILES.get(recipeId) ?? DEFAULT_COOKING_PROFILE;
}
```

This is **recommended** because it:

1. Requires **zero changes to any of the 15 existing `RECIPES` entries** — the exact migration
   path the brief requires, achieved by construction (an absent map entry silently resolves to
   `DEFAULT_COOKING_PROFILE`, identical to how `getReferencePizza` already resolves an absent
   entry to `null` and callers already handle that).
2. Reuses a pattern already proven correct in this codebase for exactly this
   "per-recipe-optional-extra-data" shape (`referencePizza.ts`), rather than inventing a second
   one.
3. Combines A's readability (`steps` is explicit and orderable, trivial to render as UI tabs) with
   B's non-invasiveness (nothing on `Recipe` itself changes).
4. Keeps modifiers (§4) attached to the *step config they alter* (`sauceConfig.regions`,
   `doughConfig.shape`) rather than floating as independent top-level flags — directly encodes the
   step-vs-modifier distinction in the data shape itself, so a future engineer can't accidentally
   promote a modifier to a step by adding it to `steps[]`.

## 8. State machine extension

`GamePhase` stays a small, fixed, top-level union — it does **not** grow per recipe (this is the
one place a truly universal "does this recipe need this whole extra top-level state" question
lives, and the answer is almost always no). The one addition: a `POST_BAKE` phase between `BAKE`
and `RESULT`, hosting any step whose profile position is after BAKE (`CUT`, `FINISH`):

```
ORDER -> PREPARE -> BAKE -> POST_BAKE -> RESULT -> DISCOVERED
           |                    |
   makingStep walks the      makingStep walks the
   profile's pre-BAKE        profile's post-BAKE
   steps (DOUGH/SAUCE/       steps (CUT/FINISH),
   CHEESE/TOPPING/FOLD/      same CONFIRM_MAKING_STEP
   SEAL/EDGE_FILL)           mechanism, same one-way gate
```

`POST_BAKE` is skipped entirely (falls straight through to `RESULT`) whenever a recipe's profile
declares no post-BAKE steps — every one of the 15 shipped recipes today, so this is a zero-visible
-change addition for them. `MakingStep` widens to the full step union
(`"DOUGH" | "SAUCE" | "CHEESE" | "TOPPING" | "FOLD" | "SEAL" | "EDGE_FILL" | "CUT" | "FINISH"`),
and `MAKING_STEP_ORDER` (today a module constant) becomes `state.cookingProfile.steps` — a value
snapshotted onto `GameState` once at `SELECT_RECIPE`/`BEGIN_PREPARE` time (mirroring how `recipe`
itself is already snapshotted onto `GameState`), so `nextMakingStep()` walks the *active round's*
profile instead of one global constant. This is a mechanical widening of an already-generic
function (`nextMakingStep` already takes its order array as a parameter internally), not a
rewrite.

## 9. UI navigation

`MakingStepTabs.tsx` is already structurally ready for this: `STEP_ORDER` is a local array the
component maps over, and only three tab states are ever visually distinguished (completed /
active / immediate-next; everything else renders identically `disabled`+`locked`) — that
three-state rendering scales to any step count without new logic, only a longer array. The actual
risk is layout at 390px width (this repo's own authority, `App.css:21`): 4 full-width tabs already
nearly fill it; naively rendering 7 would overflow or shrink illegibly.

Recommended: **keep the existing horizontal-tab component**, but past a small fixed threshold
(e.g. >4 visible tabs), collapse every non-active/non-next/non-completed tab into a compact
icon-only chip (locked tabs carry no interactive affordance today anyway — `disabled`,
non-tappable — so shrinking them costs nothing functionally) while keeping the active+next tabs
full-width and labeled. This is a bounded change to `MakingStepTabs.tsx`'s own render logic, not a
new navigation paradigm (rejects "step progress indicator" and "current + prev/next only" as
separate components — both would duplicate the one component's existing completed/active/next
state logic under a different name for no functional gain). `POST_BAKE`'s own steps (CUT/FINISH)
get their own instance of the same tab component, scoped to `POST_BAKE`'s own sub-sequence, mirroring
how BAKE already renders as a distinct non-interactive trailing indicator today.

## 10. Scoring architecture

Three options (brief §9):

**A. Fixed 100pt weight, re-split per recipe.** Rejected — breaks Dex BEST /
Lunch Rush ranking / Pitz reward comparability (a score under recipe X's "generous" split isn't
the same currency as one under recipe Y's "strict" split), and requires hand-tuning weights for
every one of 53+ recipes forever — the opposite of the YAGNI posture §7 of the brief demands.

**B. Raw per-step quality aggregated, then normalized to 100.** Rejected for Phase 0 — it would
change the *meaning* of the already iPhone-calibrated 52/16/12/20 split
(`logic/scoringV2/index.ts:48-51`, see that file's own weight-derivation comment) even for
recipes that touch **no** new step, since adding a 5th/6th component to a shared normalization
denominator dilutes every existing recipe's weight distribution as a side effect of an unrelated
recipe shipping. Unacceptable regression risk for the 15 already-tuned recipes.

**C. Core score (unchanged) + optional per-step bonus — recommended.** The existing 4-component
formula (Sauce/Pieces/Recipe/Bake, 52/16/12/20, `computeScoringV2`) stays byte-for-byte identical
for every recipe, new or old. A recipe whose `CookingProfile.steps` includes a new step
(CUT/FOLD/SEAL/EDGE_FILL/FINISH) additionally gets that step's own small bonus/penalty component,
computed independently and applied *after* the existing 0-100 total is computed, clamped so the
combined score never exceeds 100. Concretely:

```
totalScore = clamp(coreScoreV2(...) + sum(stepBonus[s] for s in profile.newSteps), 0, 100)
```

This is recommended because it: (1) is a strict superset — the 15 existing recipes' scores are
mathematically unchanged, verified by construction (their profile has zero new steps, so the sum
term is always 0); (2) lets each new step ship its own scoring component exactly when that step
ships (no speculative weight reservation for FOLD before FOLD exists), matching §7's YAGNI
instruction; (3) keeps the shared 0-100 scale's cross-recipe meaning stable for Dex/Pitz/Ranking,
since the *core* floor (what every recipe, however complex, is graded on) never moves. The actual
per-step bonus formulas are themselves future-slice work, explicitly out of scope here (§20).

## 11. Completion Gate integration

`completionGate.ts`'s `CompletionFailureReason` union (currently 5 fixed literals) gains new
reasons additively, one per structural step that can fail completion (§6's table already marks
which): e.g. `"UNCLOSED_FOLD"`, `"MISSING_EDGE_FILL"`. A profile-declared step is checked only if
`CookingProfile` marks it `requiredForCompletion` (default `true` for FOLD/SEAL/EDGE_FILL, `false`
for CUT/FINISH, matching §6's failure-possibility column) — mirroring the *existing* separation
this file already documents in its own header ("is this a finished dish" vs. "how well was it
made," completely independent of Scoring 2.0). Zero behavior change for the 15 shipped recipes:
their profile declares no new steps, so no new `CompletionFailureReason` can ever fire for them —
the exact same "additive union, empty for existing data" pattern as §10's scoring recommendation.

## 12. Ingredient usage model

**Recipe-ingredient-usage property, not a global `Ingredient` field — recommended.** The brief's
own example (olive oil applied pre-bake in one recipe, post-bake in another) is a real
counterexample to putting `applicationPhase` on `Ingredient` itself: the same ingredient row would
need two contradictory phase values simultaneously depending on which recipe uses it. Instead,
extend the already-recipe-scoped `RecipeRequirement` (`recipes.ts:1-4`, already has a
per-recipe-per-ingredient `minCount`) with an optional `applicationPhase?: "PRE_BAKE" | "POST_BAKE"
| "EDGE_FILL"`, absent meaning `PRE_BAKE` — exactly what every current requirement already means
implicitly. Zero migration for the 15 existing recipes (every current requirement is implicitly
`PRE_BAKE`, and stays so with the field simply absent). `Ingredient` itself is untouched — it stays
presentation/economy data (`category`/`color`/`emoji`/`placement`/`pricePitz`), never "when in the
cooking flow can this be used," which is a property of a specific dish's recipe, not of the
ingredient as a commodity.

## 13. Reference / guidance architecture

Extend `ReferencePizza` (already a per-recipe `Map`, `data/referencePizza.ts`) with new optional
guide fields — `cutGuide?`, `foldGuide?`, `edgeFillGuide?`, `finishGuide?` — using the exact same
lookup (`getReferencePizza(recipeId)`) and the exact same "absent = that guide simply doesn't
render" contract the existing 8-slot `pieceGroups` ring already follows. No new lookup mechanism,
no new guidance-component family: this is the first real consumer of `InteractionFamily`'s
already-declared-but-dormant `SPRINKLE`/`DRIZZLE`/`SPECIAL`/`NON_INTERACTIVE` variants (§2.3) —
completing scaffolding already in the codebase rather than adding a new concept to it. The
existing 8-slot `PIECE_RING_POSITIONS` ceiling (already the reason `supreme` is deferred,
`recipes.ts:362-371`) is untouched by this proposal and remains a real constraint any future
high-density recipe (including a FINISH-heavy one, if finishing ingredients also render in that
same ring) must be checked against per-recipe, exactly as Batch 1B-C's own Result Report already
does.

## 14. Lunch Rush / Firebase considerations (unchanged this phase)

No change to Lunch Rush or Firebase code in this task. For a *future* slice that lets CUT/FOLD/
FINISH quality feed Lunch Rush's competitive score: today's own trust model
(`functions/src/submitLunchRushScore.ts`) already establishes the precedent to extend — the server
never trusts a client-supplied aggregate, only recomputes the *mission* total from a compact,
replayable per-serve log (`LunchRushServeRecord[]`, `shared/lunchRushScoring.ts:28-34`). Note
honestly: today that per-serve log carries an already-client-computed `qualityTotal`, not raw
geometry — the *pizza-level* score itself is not currently server-recomputed from primitives
either (only the mission-level aggregate is). Extending scoring with new step components (§10)
inherits this exact same, already-existing trust posture — neither better nor worse than today's
Sauce/Pieces/Recipe/Bake components. A true "recompute CUT quality server-side from normalized cut
coordinates" capability is a pre-existing gap for the *whole* scoring system, not something this
design regresses, and is explicitly out of scope for Phase 0 or any near-term step-addition slice.

## 15. Save / persistence impact

**No save-schema bump required.** `PersistentSaveV2` (`state/persistence.ts:114-135`) persists only
progression-level state (Dex, Pitz balance, owned ingredients, mission best, inventory, starter
grant ledger) — never `GameState`/`PizzaState` itself (`persistence.ts` has no serializer for
either). Every new step's working data (fold geometry, cut lines, finish placements) lives
entirely in the same transient `GameState`/`PizzaState` shape mid-round data already does today,
and is discarded exactly like `sauceDeposits`/`toppings` already are at round end. Nothing about
this design touches what gets written to `localStorage`.

## 16. Unlock / tutorial roadmap (corroborated by the Master Catalog's own `progressionTier` data)

The Master Catalog already independently assigned a `progressionTier` to every candidate
(`starter`/`early`/`mid`/`late`/`master`) — cross-referencing it against §3's step taxonomy
produces a roadmap that agrees with, rather than invents, that existing judgment:

| Tier | New operation introduced | Representative recipes (catalog `progressionTier`) |
|---|---|---|
| early (shipped) | none — standard pizza only | 15 shipped, Class A/B |
| mid | CUT | first cross-cutting step; no single recipe "needs" it, so it's the natural first op to teach broadly rather than gated to one recipe |
| mid–late | FINISH | `prosciutto`/`diavola`/`frutti-di-mare` (catalog `progressionTier: "late"`) — highest recipe payoff (§17) |
| late | HALF/REGION | `mezza-e-mezza`/`quattro-stagioni` (catalog `progressionTier: "master"`) |
| master | FOLD/SEAL | `calzone` (catalog `progressionTier: "master"`, `difficulty: 5`) |
| master | EDGE_FILL | `stuffed-crust` (catalog `progressionTier: "master"`) |
| master | SPECIAL_SHAPE/REVERSE_LAYER | `chicago-deep-dish`/`detroit-style`/`siciliana` (all catalog `progressionTier: "late"`/`"master"`) |

## 17. Lunch Rush order-condition compatibility (informational — no Lunch Rush change this phase)

`data/orders.ts`'s `Order` is already just `{ id, recipeId, requestedBy, lineJa }` — a future
"6等分で" / "半分ずつ違う味で" order condition would be an additive field on `Order` (e.g.
`requiredCutPieces?: number`) read against `CookingProfile`'s own `cutConfig`, not a structural
change to the order/mission flow. Recorded here only as evidence the architecture doesn't paint
Lunch Rush into a corner — no design work for it is performed in this task.

## 18. Migration strategy

1. Land `CookingProfile`/`getCookingProfile` (§7) as a new, empty-by-default file. Zero behavior
   change — every recipe resolves to `DEFAULT_COOKING_PROFILE`, byte-identical to today's fixed
   flow.
2. Widen `MakingStep`/`GamePhase` (§8) and swap `MAKING_STEP_ORDER` for
   `state.cookingProfile.steps`. Still zero behavior change for existing recipes (their profile's
   `steps` value is defined to equal today's constant exactly).
3. Generalize `MakingStepTabs` (§9) to read its tab array from props instead of its own module
   constant. Still zero visible change at 4 tabs.
4. Only *then* does a step-specific slice (CUT first, per §20) add real interaction code, a real
   `CookingProfile` entry for its first recipe, and its own scoring/completion additions (§10/§11)
   — each addition independently regression-tested against the other 14+ recipes whose profile
   doesn't reference it.

This ordering means steps 1-3 (the "foundation") are provably behavior-preserving for all 15
recipes *before* any new gameplay ships, which is the property the brief's "production behavior
unchanged" gate for *this* PR foreshadows for the *next* one.

## 19. Recipe capability matrix (all 53 Master Catalog entries)

Derived directly from `data/recipes/pizza_master_catalog.json`'s own `mechanics`/
`verificationStatus` fields (not re-guessed) — `confidence` reflects that file's own
`verificationStatus`, not a new judgment call made here.

| # | recipe id | 名称 | class | new capability (proposed step/modifier) | confidence |
|---|---|---|---|---|---|
| 1 | `margherita` | マルゲリータ | A | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 2 | `marinara` | マリナーラ | A | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 3 | `quattro-formaggi` | クアトロ フォルマッジ | A | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 4 | `genovese` | ジェノベーゼ | A | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 5 | `bismarck` | ビスマルク | A | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 6 | `funghi` | フンギ | A | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 7 | `fugazza` | フガッサ | A | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 8 | `pepperoni` | ペパロニ | B | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 9 | `napoletana` | ナポリ | B | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 10 | `hawaiian` | ハワイアン | B | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | catalog-derived |
| 11 | `salsiccia` | サルシッチャ | B | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 12 | `tonno-e-cipolla` | トンノ・エ・チポッラ | B | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 13 | `ortolana` | オルトラーナ | B | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | catalog-derived |
| 14 | `capricciosa` | カプリチョーザ | B | (baseline: DOUGH/SAUCE/TOPPING/BAKE only) | confirmed (shipped) |
| 15 | `prosciutto` | プロシュート | D | FINISH | catalog-derived |
| 16 | `diavola` | ディアボラ | D | FINISH | catalog-derived |
| 17 | `frutti-di-mare` | フルッティ・ディ・マーレ | D | FINISH | catalog-derived |
| 18 | `quattro-stagioni` | クアトロ・スタジオーニ | D | REGION (modifier) | catalog-derived |
| 19 | `mezza-e-mezza` | メッザ・エ・メッザ | D | HALF (modifier) | catalog-derived |
| 20 | `calzone` | カルツォーネ | D | FOLD+SEAL | catalog-derived |
| 21 | `prosciutto-e-funghi` | プロシュート・エ・フンギ | D | FINISH | verification-needed (deferred) |
| 22 | `romana` | ロマーナ | E | (baseline) | verification-needed (deferred) |
| 23 | `fugazzeta` | フガゼータ | D | EDGE_FILL/STUFF | verification-needed (deferred) |
| 24 | `boscaiola` | ボスカイオーラ | B | (baseline) | catalog-derived |
| 25 | `pugliese` | プリエーゼ | B | (baseline) | verification-needed |
| 26 | `siciliana` | シチリアーナ | D | SPECIAL_SHAPE (modifier) | verification-needed |
| 27 | `calabrese` | カラブレーゼ | B | (baseline) | verification-needed |
| 28 | `ai-carciofi` | アーティチョークのピザ | B | (baseline) | catalog-derived |
| 29 | `alla-norma` | アッラ・ノルマ風 | B | (baseline) | verification-needed |
| 30 | `contadina` | コンタディーナ | E | (baseline) | rejected (excluded from viable set) |
| 31 | `ai-funghi-porcini` | ポルチーニのピザ | B | (baseline) | verification-needed |
| 32 | `al-tartufo` | トリュフのピザ | D | FINISH | verification-needed |
| 33 | `speck-e-brie` | スペック・エ・ブリー | D | FINISH | verification-needed |
| 34 | `wurstel-e-patatine` | ウインナー・エ・ポテト | D | FINISH | verification-needed |
| 35 | `pizza-bianca` | ピッツァ・ビアンカ | B | (baseline) | confirmed (shipped) |
| 36 | `bbq-chicken` | BBQチキン | D | FINISH | verification-needed |
| 37 | `buffalo-chicken` | バッファローチキン | D | FINISH | verification-needed |
| 38 | `meat-lovers` | ミートラヴァーズ | B | (baseline) | confirmed (shipped) |
| 39 | `supreme` | スプリーム | B | (baseline — deferred for 8-slot ring capacity, unrelated to steps) | catalog-derived |
| 40 | `ricotta-bianca` | リコッタ・ビアンカ | B | (baseline) | catalog-derived |
| 41 | `philly-cheesesteak` | フィリーチーズステーキ | B | (baseline) | verification-needed |
| 42 | `breakfast-pizza` | ブレックファストピザ | B | (baseline) | confirmed (shipped) |
| 43 | `chicago-deep-dish` | シカゴ・ディープディッシュ | D | REVERSE_LAYER (modifier), SPECIAL_SHAPE (modifier) | verification-needed |
| 44 | `detroit-style` | デトロイト・スタイル | D | FINISH, SPECIAL_SHAPE (modifier) | verification-needed |
| 45 | `stuffed-crust` | スタッフドクラスト | C | EDGE_FILL | catalog-derived |
| 46 | `shrimp-mayo` | エビマヨ | D | FINISH | verification-needed |
| 47 | `teriyaki-chicken` | テリヤキチキン | D | FINISH | verification-needed |
| 48 | `potato-bacon` | ポテト・ベーコン | D | FINISH | verification-needed |
| 49 | `nutella-dessert` | ヌテラ・デザートピザ | D | FINISH | verification-needed |
| 50 | `honey-fig` | はちみつ・いちじくのデザートピザ | D | FINISH | verification-needed |
| 51 | `bufalina` | ブファリーナ | E | (baseline) | rejected (excluded from viable set) |
| 52 | `ny-style` | ニューヨーク・スタイル | E | (baseline) | verification-needed (deferred) |
| 53 | `greek-style` | ギリシャ・スタイル | E | SPECIAL_SHAPE (modifier) | verification-needed (deferred) |

**Note on CUT:** no catalog `mechanics` entry lists a cutting mechanic at all — the catalog's own
axis tracks *differentiating* mechanics per recipe, and cutting is (per the brief) a near-universal
finishing action, not a per-recipe differentiator. This design treats CUT as the first step built
on the foundation (§20), independent of which recipe "needs" it, rather than deriving its
necessity from this matrix.

## 20. Relationship to Pizza Cutting 1.0

Duplicate Gate #1 (repo-wide PR/branch search, see the Result Report §1) found **no existing "Pizza
Cutting 1.0" branch or PR** — nothing to avoid duplicating today. This document's own CUT step
design (§3, §6, §20 roadmap Phase 1B) is therefore the first concrete architecture proposal for
whatever a future "Pizza Cutting 1.0" slice builds. The explicit recommendation: **that future
slice should build CUT as the first real consumer of the `CookingProfile`/`POST_BAKE` foundation
(§7/§8) this document proposes, not as a one-off hardcoded post-BAKE phase** — building CUT
hardcoded first and generalizing later would recreate exactly the fixed-flow problem this audit
exists to prevent.

## 21. Implementation roadmap (2-3 hour slices, sequenced by the Master Catalog's own cost ranking)

| Slice | Scope | Depends on |
|---|---|---|
| **Phase 1A — Cooking Step Foundation** | `CookingProfile`/`getCookingProfile` (§7), `MakingStep`/`GamePhase` widening + `POST_BAKE` (§8), `MakingStepTabs` generalization (§9). Zero new recipes, zero visible behavior change — regression-tested against all 15 existing recipes. | none |
| **Phase 1B — CUT integration** | First real POST_BAKE step: swipe gesture, completion (non-gating), basic scoring bonus (§10). This is "Pizza Cutting 1.0"'s likely scope — see §20. | 1A |
| **Phase 1C — CUT human-feel** | Tuning pass on 1B's gesture/visual feedback (matches this repo's own established "human-feel fix" pattern, e.g. `PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix*` series). | 1B |
| **Phase 2A — FINISH / `postBakeFinishing`** | Highest ROI per Master Catalog §8 (unlocks 13-15 recipes for one subsystem). Reuses existing scatter/spread gestures, gated to POST_BAKE. Ingredient-usage model (§12) ships here. | 1A |
| **Phase 2B — HALF/REGION modifier** | `mezza-e-mezza`/`quattro-stagioni`. Needs its own product decision first (which recipes can pair — `TETO_RECIPE-EXPANSION-20.md` §6.3 already flags this as unresolved). | 1A |
| **Phase 3A — FOLD/SEAL (Calzone)** | Two new steps, one new completion-gate failure family (§11). | 1A |
| **Phase 3B — EDGE_FILL (Stuffed Crust)** | Cheapest remaining Class-C structural mechanic per catalog §11. | 1A |
| **Phase 4 — SPECIAL_SHAPE / REVERSE_LAYER** | Deep Dish / Detroit / Siciliana. Catalog §11 explicitly recommends *not* batching these — space across Master-tier content. | 1A |

Scoring-component and Completion-Gate work for each step ships alongside that step's own slice
(§10/§11's "additive, empty until built" design), never spent speculatively ahead of it.

## 22. Explicit non-goals (this document and any near-term follow-up)

- No production code, Recipe/Ingredient schema change, Scoring formula change, Completion Gate
  change, Lunch Rush change, Firebase change, or save-schema bump in this PR.
- No generic plugin/Step-Engine abstraction — `CookingProfile` is a typed data shape read by a
  small number of call sites, not a registration/plugin framework (brief §7's own instruction).
- No resolution of `supreme`'s 8-slot reference-ring capacity gap (pre-existing, unrelated to
  cooking steps — tracked in `recipes.ts:362-371`).
- No resolution of `mezza-e-mezza`'s recipe-pairing product decision (which two recipes may
  combine, player-chosen vs. order-randomized) — flagged, not decided, exactly as
  `TETO_RECIPE-EXPANSION-20.md` §6.3 already left it.
- No new recipes added to `RECIPES` beyond the current 15.
- No server-side recompute of per-pizza (as opposed to per-mission) score — a pre-existing gap
  (§14), not something this design is scoped to close.
