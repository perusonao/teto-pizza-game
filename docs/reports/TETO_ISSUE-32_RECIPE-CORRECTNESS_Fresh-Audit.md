# Teto Pizza Game — Issue #32 Recipe Correctness — Fresh Audit

**Type:** READ-ONLY audit. No production code was changed to produce this report. A temporary
scratch test file (`src/logic/scoringV2/_audit_scratch.test.ts`) was created to compute the
double-penalty matrix's representative scores directly from current-main scoring code, then
deleted before commit — it never entered git history.

**Audited main SHA:** `1b1ff6c69b837ff7f0da6ab3c14df7843812d8c3` (Merge PR #41: HOME + Pizza
Select visual reproduction). Confirmed via `git fetch origin && git log origin/main -1`
immediately before this audit — matches the task's expected SHA exactly. This audit branch
(`claude/issue-32-recipe-audit-8rte8s`) was created from this exact commit.

---

## 1. Scope guard compliance

No changes were made to: production scoring code, coefficients, scoring authority, save,
recipe data, Reference fixtures, Pizza Select, HOME, Dough, Making mechanics, Pitz, Shop, or
Lunch Rush rules. Only `docs/PROJECT_HANDOFF.md` and this new report were touched, plus (in a
separate concern) Issue #22 on GitHub.

---

## 2. Scoring architecture (current main)

There are **two independent scoring systems** on current main, never merged:

| | Legacy (`src/logic/scoring.ts`) | Scoring 2.0 Shadow (`src/logic/scoringV2/`) |
|---|---|---|
| Function | `scorePizza(recipe, pizza) -> ScoreBreakdown` | `computeScoringV2Shadow(recipe, pizza) -> ScoringV2Result` |
| Components | matchScore (35%), ingredientScore/"Purity" (15%), placementScore (20%), bakeScore (30%) | Sauce (65%), Pieces (20%), Recipe (15%); Bake always unavailable this phase |
| Recipe availability | every recipe (all 7) | **Margherita only** — every other recipe returns `available:false` (P0-1 Reference gate) |
| Feeds | Dex BEST/★, Mission Score, Pitz reward, RESULT UI, save data (via Dex) | Nothing gameplay-facing — see §9 |
| Called from | `gameReducer.ts`'s `CONFIRM_BAKE` (`src/state/gameReducer.ts:398`) | Same `CONFIRM_BAKE` case, same `pizza`, immediately after (`gameReducer.ts:404`) |

Both are computed **once, at the same `CONFIRM_BAKE` action**, for both FREE and Lunch Rush
alike (there is exactly one call site for each; Mission and FREE dispatch the identical
action). There is no FREE vs. Lunch Rush divergence in either scoring system.

`computeScoringV2Shadow`'s result (`state.scoringV2Shadow`) is stored on `GameState` but the
only consumer found is `ScoringV2ShadowPanel.tsx`, itself gated behind
`import.meta.env.VITE_PREVIEW_MODE` (statically `false` in production builds, dead-code
eliminated by Vite). `registerScoreToDex` (Dex/BEST), Mission scoring
(`missionScoring.ts`'s `recordServe`), and Pitz reward calculation all read `state.score`
(legacy `ScoreBreakdown`) exclusively — grepped and confirmed no other reference to
`scoringV2Shadow` exists outside the reducer field, its type, and the debug panel.

---

## 3. Recipe formula (both systems)

### Legacy `matchScore` (`src/logic/scoring.ts:75-80`)

```
satisfiedCount = |{ req in recipe.requiredIngredients : countUsedIngredient(pizza, req.ingredientId) >= req.minCount }|
matchScore = required.length === 0 ? 100 : (satisfiedCount / required.length) * 100
```

`countUsedIngredient` returns 1 for a sauce id present in `pizza.sauceIds`, or the topping
count for any other id. So Legacy's Recipe axis is **count-aware** (a required topping must
meet its own `minCount`, not just be present at all).

Legacy also has a second, distinct component that reacts to *extra* ingredients — **Purity**
(`ingredientScore`, `scoring.ts:82-86`):

```
used = distinct ids across sauceIds + toppings
extraCount = |{ id in used : id not in requiredIds }|
ingredientScore = used.length === 0 ? 0 : max(0, 100 - (extraCount / used.length) * 100)
```

This is Legacy's only signal for "wrong/extra ingredient" — it is weighted 15% of `total`,
and is diluted by `used.length` (one wrong topping among many correct ones costs proportionally
less than the same wrong topping on an otherwise-sparse pizza).

### Shadow V2 `scoreRecipeComponentV2` (`src/logic/scoringV2/recipeComponent.ts:60-85`)

```
required = recipe.requiredIngredients   (strictly validated; malformed -> available:false)
if required.length === 0: score = 100
requiredTypesPresent = |{ req in required : countUsedIngredient(safePizza, req.ingredientId) >= 1 }|
score = (requiredTypesPresent / required.length) * 100
```

This reuses the same `countUsedIngredient` primitive as Legacy, but the threshold is hard-coded
to `>= 1`, **never `req.minCount`** — the file's own header comment is explicit that this is
deliberate: "did the player use tomato sauce / mozzarella / basil *at all*", never "how much".
Quantity is entirely Pieces' concern (§4).

**Critical finding: Shadow V2's Recipe component has no purity/extra-ingredient concept
whatsoever.** It only ever iterates `recipe.requiredIngredients` looking for presence; it never
inspects what else is on the pizza. An extra, unspecified, or flatly wrong ingredient (e.g.
pepperoni on a Margherita) is invisible to this function — see §6 case G/F for the measured
consequence. This is the single largest gap relative to Issue #32's stated mandate ("wrong
ingredient type / unspecified ingredient / ... extra ingredient" must be tracked as Recipe
concerns).

---

## 4. Pieces formula (Shadow V2 only — Legacy has no Pieces-equivalent)

`scorePieceGroupV2` (`src/logic/scoringV2/piecesComponent.ts:68-135`), for one ingredient group
(mozzarella or basil for Margherita):

```
quantitySimilarity = playerCount === 0 ? 0 : clamp01(1 - |playerCount - targetCount| / (targetCount + 1))     [referenceMatching.ts scorePieceGroup]
matches            = Hungarian-assignment(player positions, reference positions, fullCreditRadius=8, zeroCreditRadius=22)
placementSimilarity = matches.length === 0 ? null : mean(match.similarity for match in matches)
                      where similarity = distanceSimilarity(distance, full, zero)   [smoothstep-interpolated, 1 at <=full, 0 at >=zero]

placementGate = playerCount <= targetCount ? 1 : quantitySimilarity      <- PR #31 asymmetric over-quantity gate

groupScore = quantitySimilarity * 30 + (placementSimilarity ?? 0) * 70 * placementGate
```

**Confirmed present on current main**: the PR #31 asymmetric over-quantity gate
(`overQuantityPlacementGate`, `piecesComponent.ts:35-41`) exists exactly as the task describes
— placement is fully credited at or under the target count, and gated by `quantitySimilarity`
only when the player count exceeds the target. This is what makes severe over-placement (§6
case C) actually cost points in Shadow, where Legacy has no equivalent mechanism at all.

`scorePiecesComponentV2` averages `groupScore` equally across every group (currently
mozzarella + basil, 50/50 — a stated provisional choice, not a general N-group formula).

---

## 5. Double-penalty matrix

All rows use the Margherita recipe (`tomato-sauce×1, mozzarella×3, basil×2`) with a perfect
bake (`bakeResult=70`, inside `[60,80]`) unless noted, and a near-Reference-exact sauce paint
(measured Shadow Sauce ≈ 99.1, not exactly 100 — the fixture used for this audit approximates
but does not bit-for-bit replicate `IDEAL_MARGHERITA_SAUCE_FIXTURE`). Scores below are **actual
values computed from current-main code** (`scorePizza` / `computeScoringV2Shadow`), not
estimates.

| Case | Description | Legacy total (★) | Shadow total | Recipe (V2) | Pieces (V2) | Sauce (V2) | Double-penalized? | Intended? | Severity |
|---|---|---|---|---|---|---|---|---|---|
| A | correct type / correct count / good placement | 100.0 (★5) | 99.4 | 100.0 | 100.0 | 99.1 | No | Yes (baseline) | none |
| B | correct type / under count (1 mozzarella of 3) | 88.3 (★4) | 97.9 | 100.0 | 92.5 | 99.1 | No — Recipe stays 100, only Pieces reflects the shortfall | Yes, matches the pinned test (`scoringV2.test.ts:407`) | low (Shadow) / moderate (Legacy, via 35%-weighted matchScore) |
| C | correct type / severe over count (9 mozzarella vs. target 3) | 99.5 (★5) | 89.4 | 100.0 | 50.0 (mozzarella group = **0.0**) | 99.1 | No | Yes for Shadow (PR #31 gate working as designed) — but **Legacy has no over-quantity penalty at all** (99.5 vs. 100) | Legacy gap: high; Shadow: none |
| D | correct type / correct count / poor placement (far from Reference spots) | 92.0 (★5) | 85.4 | 100.0 | 30.0 (both groups placement=0) | 99.1 | No | Yes for Shadow. Legacy's `placementScore` is Reference-agnostic (containment+dispersion only), so it barely reacts (100→60 on the placement sub-score, diluted to 20% weight) to placement that is objectively wrong vs. the Reference layout | Legacy under-detects; Shadow correctly detects |
| E | required type missing entirely (no mozzarella) | 88.3 (★4) | 84.4 | 66.7 | 50.0 (mozzarella group = 0.0) | 99.1 | **Partial — both Recipe and Pieces drop for the same missing ingredient** | Arguably yes: Recipe measures identity ("is this even the right pizza"), Pieces measures construction quality of that specific group (0 quantity is a true fact); but it is a real compounding effect, not purely additive double-counting | moderate — see §11 discussion |
| F | wrong type instead of required (pepperoni instead of basil) | **83.3 (★4)** | 84.4 | 66.7 | 50.0 (basil group = 0.0) | 99.1 | **Yes, in Legacy**: matchScore drops (basil unsatisfied) *and* ingredientScore drops (pepperoni counted as extra) for the same single mistake. **Shadow scores this identically to case E (84.4 = 84.4)** — pepperoni is invisible to both Recipe and Pieces | **No — this is the clearest confirmed double penalty in the audit**, and it is asymmetric with severity: Legacy scores a *wrong substitution* worse than *plain omission* (83.3 < 88.3), which is backwards from a "reasonable imperfection" standpoint | **high** — primary Issue #32 finding |
| G | extra unspecified ingredient on an otherwise-perfect pizza (mushroom added) | 95.6 (★5) | **99.4 (identical to case A)** | 100.0 | 100.0 | 99.1 | No in Shadow (nothing detects it) / mild in Legacy (Purity, 15% weight, diluted) | **No — Shadow has zero purity signal; an extra wrong ingredient is completely free** | high — this is the other primary Issue #32 finding |
| H | correct required + extra wrong ingredient | same as G | same as G | same as G | same as G | same as G | same as G | same as G | same as G |
| I | duplicate same ingredient (6 mozzarella vs. target 3) | 99.7 (★5) | 91.9 | 100.0 | 62.3 (mozzarella group = 24.6) | 99.1 | No | Yes for Shadow (gated by quantitySimilarity=0.25); Legacy again nearly blind (99.7) | Legacy gap: moderate; Shadow: none |
| J | empty pizza | 20.0 (★1) | 0.0 | 0.0 | 0.0 | 0.0 | No | Legacy's `placementScore=100` "no toppings, not structurally penalized" rule (`placement.ts:53`) still hands an empty pizza 20 of its 100 points from a component meant to reward *placement quality*, not absence. Shadow gives a clean 0 | Legacy scoring artifact worth flagging, not a double penalty |
| K | sauce only (no toppings at all) | 76.7 (★4) | 69.4 | 33.3 | 0.0 | 99.1 | No | Legacy still yields ★4 despite 2 of 3 required types being completely absent, because the structural "no toppings = 100 placement" rule (§J) plus a perfect bake dominate the other 65% of weight. Shadow's heavy Sauce weighting (65%) produces a similar magnitude via a completely different mechanism | Both systems currently let a good bake+sauce mask missing toppings; flagged, not this issue's scope to fix |
| L | topping only (no sauce at all) | 88.3 (★4) | **30.0** | 66.7 | 100.0 | 0.0 | No | **Stark divergence**: Legacy rates a sauceless pizza ★4/88.3 (bake+placement dominate, sauce is only ~11.7 of the 35%-weighted matchScore's three-way split); Shadow rates it 30.0 (Sauce is 65% of Total and scores 0 for no sauce at all). This is exactly the kind of Legacy/Shadow disagreement PROJECT_HANDOFF.md's authority gate exists to catch | Not an Issue #32 defect — a pre-existing, already-documented Sauce-dominance calibration note (see `TETO_PHASE-4A-2_SCORING-2_iPhone-Calibration.md`) |

### Reading the matrix

The two genuinely actionable findings for Issue #32 are **F** and **G/H**:

1. **F (wrong type instead of required)** is Legacy's one clear double penalty: the same
   mistake (using the wrong ingredient) is charged against both `matchScore` (required type
   absent) and `ingredientScore` (extra/wrong id present), and the compounding makes a *wrong
   substitution* score worse than *doing nothing at all* (E). Since Legacy remains authoritative
   for stars/BEST/Pitz today, this is a live, user-facing inconsistency, not just a Shadow
   calibration note.
2. **G/H (extra or wrong ingredient added)** is Shadow's one clear *under*-penalty: Recipe (V2)
   is presence-only and Pieces (V2) only ever looks at the recipe's own two reference groups, so
   an unrelated extra ingredient is invisible to Scoring 2.0 end-to-end — a pizza with a stray
   pepperoni scores identically to one without it.

Every other row (B, C, D, I) confirms the intended separation is holding in Shadow: Recipe
never reacts to quantity/placement/over-count, and Pieces (with the PR #31 gate) is the only
place those reactions show up, each contributing once.

---

## 6. Recipe catalog audit

`src/data/recipes.ts` — 7 recipes total, unchanged from current main:

| recipeId | Required ingredients (id: minCount) | Bake target | Scoring 2.0 Reference | Sauce profile (`recipeSauceProfiles.ts`) |
|---|---|---|---|---|
| margherita | tomato-sauce:1, mozzarella:3, basil:2 | 60–80 | **Yes** (only recipe with one) | tomato-sauce, PAINT |
| marinara | tomato-sauce:1, garlic:3, oregano:2 | 45–65 | No | tomato-sauce, PAINT |
| quattro-formaggi | olive-oil:1, mozzarella:2, gorgonzola:2, parmigiano:2, fontina:2 | 65–85 | No | olive-oil, PAINT_TEMPORARY |
| genovese | pesto:1, mozzarella:2, cherry-tomato:3 | 50–70 | No | pesto, PAINT |
| **bismarck** | tomato-sauce:1, mozzarella:3, egg:1 | 55–75 | **No** | tomato-sauce, PAINT |
| funghi | tomato-sauce:1, mozzarella:2, mushroom:3 | 58–78 | No | tomato-sauce, PAINT |
| fugazza | olive-oil:1, onion:4, oregano:1 | 63–83 | No | olive-oil, PAINT_TEMPORARY |

`requiredIngredients`' `minCount` is a Legacy-only concept — Shadow's Recipe component ignores
it entirely (§3). "Unspecified ingredient behavior" is identical across all 7 recipes in both
systems: Legacy dilutes it into Purity, Shadow ignores it completely (§3, §5).

### Margherita — detailed

The only recipe with a `ReferencePizza` fixture (`src/data/referencePizza.ts:120-158`):
sauce target `{ingredientId: "tomato-sauce", quantity: 0.92, coverage: 0.72}` (derived from a
concrete, literally-paintable concentric-ring fixture, not an independently chosen number —
see the file's own comment and `referencePizza.test.ts`'s reachability test), plus two piece
groups (mozzarella ×3, basil ×2) with authored target positions and an 8/22 tolerance band.
This is why every Shadow-available number in this report is a Margherita number — every other
recipe returns `available:false` before any component is even computed
(`scoringV2.test.ts:454-461` pins this for all 6 other recipes).

### Bismarck — detailed

**Confirmed fact, not an inference**: `getReferencePizza("bismarck")` returns `null`
(`referencePizza.ts:162-164`'s only truthy branch is `recipeId === "margherita"`). Calling
`computeScoringV2Shadow(bismarckRecipe, anyPizza)` therefore always returns
`{available:false, totalScore:null, unavailableReason: "この料理はまだ Reference Pizza（お手本データ）がありません。Phase 4A-2時点ではマルゲリータのみ対応しています。"}`
regardless of how the pizza is made. Bismarck's `egg` requirement also has no piece-group or
placement concept anywhere in the codebase — Legacy scores it exactly like any other required
topping (count-only via `countUsedIngredient`, generic `placementScore`). No Reference fixture
was added or fabricated for Bismarck by this audit, per the scope guard.

---

## 7. Existing test coverage

Confirmed by reading `src/logic/scoring.test.ts`, `src/logic/scoringV2/scoringV2.test.ts`,
`src/logic/scoringV2/malformedInput.test.ts`, `src/logic/referenceScoring.test.ts`,
`src/data/recipes.test.ts`, `src/data/recipeSauceProfiles.test.ts`.

**Covered:**
- Legacy: star thresholds, bake-cap-to-★4 (raw/burnt), the 35/15/20/30 weighted formula (one
  case: 1-of-2 required present, zero extras), fugazza-specific placement/bake-cap cases.
- Shadow Recipe: all-types-present → 100; one missing type → proportional score; the specific
  quantity-shortfall non-double-penalty guarantee (1 vs. 3 mozzarella pieces, §5 pinned test).
- Shadow Pieces: Reference-exact / displaced / missing / extra-piece / permutation-invariance;
  the PR #31 asymmetric over-quantity gate at exact-count, moderate-over, and severe-over
  levels, including a "Hungarian matching still finds a great subset" adversarial case.
- Shadow Sauce: fixture-near-perfect, empty, too-little, concentrated-dump-vs-fixture,
  broad-but-uneven, edge/overflow, PAINT vs. PAINT_TEMPORARY parity.
- Reference availability: Margherita available; every one of the other 6 recipes unavailable;
  Bake always unavailable this phase.
- Malformed-input fail-closed behavior: 136 tests across every sanitizer/validator boundary
  (`malformedInput.test.ts`), covering non-array containers, null/primitive/NaN/±Infinity
  elements, mixed valid+invalid Reference data, and the specific Codex-found "corrupted-down
  target trivially completable" exploit shape, now closed.
- Recipe catalog integrity: exactly 7 recipes, fugazza's exact requirements, order↔recipe 1:1
  integrity, availability gating on owned ingredients.

**Not covered (gaps this audit surfaces, none added — task is audit-only):**
1. **Wrong-type substitution** (a non-required ingredient placed *instead of* a required one)
   — neither Legacy's `ingredientScore` extra-penalty nor Shadow's Recipe component has a
   dedicated test for this combined scenario (case F above); Legacy's own extra-ingredient
   penalty (`ingredientScore` < 100) has **no test at all** exercising `extraCount > 0`.
2. **Extra/unspecified ingredient added on top of an otherwise-fully-correct pizza** (case
   G/H) — not tested for either system; this is exactly the gap that let the Shadow
   under-penalty in §5 go unnoticed.
3. **Duplicate/over-quantity of a required ingredient in Legacy** — no test confirms Legacy's
   near-total blindness to over-quantity (case C/I); only Shadow's response is tested.
4. **Empty pizza** end-to-end via `scorePizza` (Legacy) — no direct test of the `used.length
   === 0` branches or the resulting 20-point floor (case J); Shadow's empty-pizza path is
   implicitly covered by `referenceLikePizza()`-style fixtures but not a literal "nothing
   placed at all" case run through `computeScoringV2Shadow`.
5. **Sauce-only / topping-only** combinations (cases K/L) — not tested in either system;
   these are exactly where Legacy and Shadow diverge most (§5).
6. **FREE vs. Lunch Rush scoring parity** — there is no test asserting `scorePizza`/
   `computeScoringV2Shadow` are invoked identically for both modes; the "single `CONFIRM_BAKE`
   call site" guarantee is currently a code-reading fact (§2), not a pinned regression test.
7. **Bismarck** (or any non-Margherita recipe) has no test exercising a *fully correct*
   Bismarck pizza through Legacy `scorePizza` with its real `bakeTarget`/`requiredIngredients`
   — `recipes.test.ts` checks catalog shape, not scoring behavior, for Bismarck specifically.

No tests were added in this session (audit-only, per task instruction §9).

---

## 8. Shadow/Legacy authority boundary

Confirmed unchanged and intact:

- `computeScoringV2Shadow`'s only production call site is `gameReducer.ts`'s `CONFIRM_BAKE`
  case, writing to `state.scoringV2Shadow` — a field never read by `registerScoreToDex`,
  `missionScoring.ts`, `economy.ts`'s Pitz calculation, or `persistence.ts`.
- `ScoringV2ShadowPanel.tsx` is the only renderer of `scoringV2Shadow`, and is unconditionally
  `null` unless `import.meta.env.VITE_PREVIEW_MODE` is true (statically eliminated from
  production `vite build`, per the component's own file header and
  `scoringV2.test.ts`'s production-build assertion).
- Dex BEST, ★ stars, `totalStars`, Mission Score, and Pitz reward all derive from `state.score`
  (Legacy `ScoreBreakdown`) exclusively — grep-confirmed, no exceptions found.
- This audit did not change any of the above.

---

## 9. Recommended responsibility contract

The intended separation — **Recipe = ingredient type correctness, Pieces = quantity +
placement** — is real, deliberate, and mostly holding in the current Shadow implementation
(confirmed by §5 rows B, C, D, I: quantity and placement mistakes never move Recipe). It is
**incomplete**, not wrong: Recipe's scope needs to also cover *purity* (no wrong/extra
ingredient types), which is a type-correctness question, not a quantity/placement one, and so
belongs in Recipe under the contract's own stated logic — it simply hasn't been implemented
yet.

Proposed explicit contract (still type-correctness only, no changes to Pieces' quantity/
placement domain):

- **Recipe correctness** = for every required ingredient type: is it present at all (existing
  behavior, keep) — **plus** a new purity check: is every ingredient actually used on the pizza
  either a required type or an explicitly allowed optional/unspecified type for that recipe (a
  concept that does not exist yet and would need a small, explicit per-recipe allow-list or a
  single global "anything not required is impure" rule — the latter matches Legacy's existing
  Purity semantics and is the smaller change).
- **Pieces** = unchanged: quantity similarity + Hungarian-matched placement similarity per
  required piece-group, including the PR #31 asymmetric over-quantity gate. Never made aware of
  "is this the right ingredient" — that stays Recipe's question, keeping the existing
  non-double-penalty guarantee for quantity/placement intact.
- The E-row compounding (missing type drops both Recipe and Pieces) should be treated as
  **acceptable and intended**, not a bug: Recipe answers "is this still recognizably the right
  pizza" and Pieces answers "how well was this specific group constructed" — when a type is
  fully absent, both questions correctly and independently read as failing, at their own
  (different, non-overlapping) weights. This is not the same failure mode as F's genuine double
  penalty, and should not be "fixed" by making Recipe or Pieces ignore missing types.

This does not require any change to Pieces' matching, weights, or the over-quantity gate.

---

## 10. Implementation files (for the next slice)

- `src/logic/scoringV2/recipeComponent.ts` — add the purity check inside
  `scoreRecipeComponentV2`; likely reshapes `RecipeComponentV2` to add a
  `purityPenalty`/similar field, or blends it into the existing `score` per a documented
  formula (needs a product decision on relative weight — see Risks).
  `types.ts` (`RecipeComponentV2` interface) would need the corresponding field added.
- `src/logic/scoringV2/scoringV2.test.ts` — new `describe` block(s) for wrong-type substitution
  and extra-ingredient cases (mirroring the existing "presence-only, no overlap with Pieces"
  block's style).
- **Legacy `src/logic/scoring.ts` is explicitly out of scope for this slice** — Legacy's
  `ingredientScore` already has *a* purity signal (case F's true problem is that it's summed
  with `matchScore`'s independent penalty for the same mistake, not that it's absent). Fixing
  Legacy's F-row double penalty, if desired, is a **separate, authority-sensitive decision**
  (Legacy is what stars/BEST/Pitz currently pay out from) and should not be bundled into a
  Shadow-only Recipe purity addition without an explicit go-ahead, per PROJECT_HANDOFF.md's
  non-negotiable guard against silently changing Dex BEST/stars/Pitz.
- No changes needed to `src/logic/scoringV2/piecesComponent.ts`, `referenceMatching.ts`,
  `boundary.ts`, or `tolerance.ts` — Pieces' contract is already correct per §9.

---

## 11. Next implementation slice (2–3 hour Claude Code task)

**Title:** Issue #32 — Add purity (wrong/extra ingredient type) detection to Scoring 2.0
Shadow's Recipe component.

**Files:** `src/logic/scoringV2/recipeComponent.ts`, `src/logic/scoringV2/types.ts`,
`src/logic/scoringV2/scoringV2.test.ts`.

**Proposed behavior:**
1. `scoreRecipeComponentV2` computes, in addition to the existing `requiredTypesPresent`/
   `requiredTypesTotal`, a `usedIds` set (reusing the same `sauceIds`/`toppings` already read)
   and an `extraCount` = ids used that are not in `recipe.requiredIngredients`.
2. Blend a purity term into `score` using the *same style* as the existing presence formula
   (a plain 0–100 term, not a new top-level weight in `index.ts` — keep Recipe's own internal
   composition simple and self-contained). A defensible first cut: `score =
   presenceScore * purityMultiplier`, where `purityMultiplier = 1 - min(1, extraCount /
   max(1, requiredTypesTotal))`, but the exact formula is a product decision, not something to
   lock in silently — flag it for explicit confirmation before implementing, since it changes
   what a Shadow-perfect pizza looks like for the first time since Phase 4A-2 shipped.
3. Do not touch `PiecesComponentV2` or `SauceComponentV2` at all.
4. `RecipeComponentV2` (types.ts) gains fields to make the purity contribution visible/
   debuggable (e.g. `extraIngredientCount`, mirroring `requiredTypesPresent`'s transparency).

**Tests to add:**
- All-required-present, zero extras → unchanged 100 (regression pin).
- All-required-present, one extra/wrong ingredient → score below 100, `Pieces` and `Sauce`
  unaffected (new non-double-penalty pin, mirroring the existing quantity-shortfall test's
  style at `scoringV2.test.ts:407`).
- Missing required type *and* an extra ingredient simultaneously → both effects present, still
  finite/bounded.
- Malformed-input regression: extend `malformedInput.test.ts` if the new logic reads any
  container not already sanitized (it should not — it reuses `safePizzaForRecipeCheck`'s
  existing sanitized `sauceIds`/`toppings`).

**Regression risks:**
- Any existing test asserting Recipe `score === 100` for a pizza that (incidentally) also has
  an extra ingredient would need re-checking — a scan of current tests found none, but this
  must be re-verified once the change lands.
- `computeScoringV2Shadow`'s `totalScore` for every existing Shadow test fixture will shift
  slightly wherever a fixture pizza has an "extra" ingredient the test didn't intend as
  significant — re-run the full Shadow suite, not just the new tests.

**Scoring authority guard:** this slice must not touch `gameReducer.ts`, `dex.ts`,
`missionScoring.ts`, `economy.ts`, or anything `state.score`-derived. Shadow remains
non-authoritative; only its own internal numbers change.

**FREE/Lunch Rush guard:** no reducer changes means no behavior divergence risk between modes;
still worth a smoke assertion that `computeScoringV2Shadow` is called identically for both
(§7 gap #6) alongside this slice if time allows, though it is not required for the purity fix
itself.

**Preview review scenario** (once implemented — this audit itself needs none, per §Scope):
1. Careful Margherita (all required, good quantity/placement) — expect Shadow ≈ unchanged from
   today's ~99.
2. Same Margherita, add one extra topping not in the recipe — expect Shadow to now visibly
   drop (today: no visible change, per case G).
3. Missing basil, no substitute — expect Shadow ≈ same as today (~84).
4. Missing basil, wrong substitute placed instead (pepperoni) — expect Shadow to now read
   *at or below* case 3, not identical to it (today: identical, per case F/E parity).
5. Bismarck — confirm still `available:false`, unaffected by the Margherita-only change.
6. RESULT/Shadow panel comparison (Preview/dev-mode only) — visually confirm the new purity
   number is legible and doesn't get confused with the player-facing score.

---

## 12. Risks / blockers

- **No blocker to auditing.** The codebase, tests, and reports needed for this audit were all
  present and readable on current main.
- **Risk for the next slice**: the exact purity formula (weight, whether it's multiplicative or
  additive, whether it should differ from Legacy's dilution-by-used-count shape) is a product
  decision this audit deliberately does not lock in (per the task's own instruction not to
  pre-decide "Recipeだけ直せばよい"). Implementing without that decision risks a second
  calibration pass, the same pattern PR #31's iPhone-Calibration report already had to work
  through once for Pieces.
- **Legacy's F-row double penalty is real and user-facing today** (Legacy is authoritative),
  but fixing it is out of this slice's scope per §10 — flagged here so it isn't lost, not
  because it's unimportant.

---

## Final Verdict

**A. READY — RECIPE RESPONSIBILITY FIX ONLY**

The Recipe/Pieces responsibility split (type correctness vs. quantity+placement) is sound and
already correctly enforced for every quantity/placement scenario tested (§5 rows B/C/D/I, §9).
The one real gap is squarely inside Recipe's own domain: it currently has no purity/extra-
ingredient-type detection at all, which is a type-correctness question by the contract's own
definition, not a Pieces concern. No Pieces matching/weighting change is needed. Legacy's
separate, real double-penalty (case F) is flagged but intentionally left out of this slice's
scope, since Legacy is today's stars/BEST/Pitz authority and changing it needs its own explicit
decision, not a bundle-in with a Shadow-only fix.
