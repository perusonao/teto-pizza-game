# Teto Pizza Game — Scoring 2.0 B2 (Reference Coverage) — Fresh Audit + Bounded Result

**Type:** Fresh Audit + bounded implementation (safe mechanical infrastructure only). Does
**not** close B2 — see Final Verdict.

- **Audited/base main SHA:** `142a18252db56d9ee4c236cc80062673d5e68c80` (Merge PR #55: Scoring
  2.0 Authority Fresh Audit, docs-only). Confirmed via `git fetch origin main && git rev-parse
  origin/main` — matches the task's expected SHA exactly, no drift.
- **Branch:** `claude/scoring-2-reference-coverage-b2-ytp9ay`.
- **Read for this task:** `docs/PROJECT_HANDOFF.md`, `docs/reports/
  TETO_SCORING2_AUTHORITY_Fresh-Audit.md`, Issue #32 (GitHub, live state), `docs/reports/
  TETO_ISSUE-32_RECIPE-CORRECTNESS_Fresh-Audit.md`, `src/data/referencePizza.ts`, `src/data/
  playerReference.ts`, `src/data/recipes.ts`, `src/data/recipeSauceProfiles.ts`, `src/logic/
  scoringV2/*` (all 8 files), `src/logic/referenceMatching.ts`, `src/data/referencePizza.test.ts`.

---

## 1. What Issue #32 actually approved (and what it didn't)

Issue #32 ("Phase 4A-2.1 — Human Feel findings / Making Game consistency") is **still open** on
GitHub. Its P1 "Reference coverage and visual consistency" section has four acceptance items;
the third is the one this task's authoring path depends on:

> - [ ] Define the safe path for adding reviewed References to other recipes.

This checkbox is **unchecked**. No later report, PR, or issue found in the repository closes it.
The one existing attempt at adjacent work, **PR #34** ("Issue #32 Phase 1: unify Reference
ingredient visuals"), is open, stale (based on a pre-#32 commit per the Scoring 2.0 Authority
Fresh Audit's own finding), and is a **visual rendering** change (making the Reference popover's
mozzarella/basil icons match the player's physical ingredients), not a scoring-target-authoring
process. **No approved, reviewed method for authoring new recipes' scoring-target piece
geometry exists in this repository today.**

This is the load-bearing fact for everything below: it means the CRITICAL RULE in this task
("do not fabricate six arbitrary target geometries") is not just a general caution here — it
describes a gap this project's own gating issue has explicitly flagged as still open and has
not yet resolved.

---

## 2. What Margherita's existing Reference actually is (precedent, read carefully)

`MARGHERITA_REFERENCE` (`src/data/referencePizza.ts`) has two independently-sourced parts, and
conflating them was the exact risk this task's CRITICAL RULE warns against:

1. **Sauce `quantity`/`coverage` — mechanically derived, not authored.** `IDEAL_MARGHERITA_
   SAUCE_FIXTURE` is a concrete, literally-paintable deposit sequence (concentric rings on the
   dough, leaving a bare rim margin) run through the same `computeSauceMetrics` primitive every
   other sauce measurement in the game uses. The target *is* that fixture's own computed
   output, not an independently chosen pair of numbers — reachability is true by construction,
   pinned by `referencePizza.test.ts`'s existing "Reference fixture reachability" suite. Nothing
   about this fixture's geometry mentions tomato sauce specifically — it is pure dough-space
   coordinates plus a generic per-tick amount.
2. **Piece target positions (`pieceGroups`) — explicitly game-authored, not derived.** The file's
   own comment calls this "Phase 4A-1B game-authored prototype layout; never a PIZZA DB quantity
   claim." These seven `(x, y)` coordinates and two tolerance radii were a human spatial design
   decision, not computed from any measurable source. No PIZZA DB or other repository evidence
   exists for placement geometry (the project's own file comments confirm PIZZA DB "has no
   quantity evidence for any ingredient" — no grams/ml, no volume, and by the same evidence gap,
   no positions).

**Conclusion carried into this task:** (1) generalizes safely to every recipe — it depends only
on dough geometry, never on which recipe or which sauce ingredient. (2) does not generalize
mechanically at all — it was a one-time human design act for Margherita specifically, and Issue
#32 has not yet defined a repeatable, reviewed way to repeat it for other recipes.

The player-facing `src/data/playerReference.ts` (Issue #47 Slice B) is explicitly **not** a
substitute source for (2): its own header comment says it is "a generic, explicitly-labeled
'spread evenly' placement guide," reusing `PizzaThumbnail.tsx`'s decorative ring-slot table,
"never a claim about the real dish's researched appearance, and never hand-authored per
recipe." Copying its coordinates into `referencePizza.ts` would be exactly the "treat
approximate player guidance as scoring ground truth" mistake this task's CRITICAL RULE
prohibits — confirmed by reading the file, not assumed from its name.

---

## 3. Code-level confirmation: what's actually needed per recipe

Read `src/logic/scoringV2/piecesComponent.ts`, `src/logic/referenceMatching.ts`, `src/logic/
scoringV2/recipeComponent.ts`, `src/logic/scoringV2/sauceComponent.ts`, `src/logic/scoringV2/
index.ts` directly (not inferred):

- `scorePieceGroup` (`referenceMatching.ts:122-150`) takes `targetCount = group.positions.length`
  **directly from however many positions a `ReferencePieceGroup` is authored with** — it is not
  independently sourced from `recipe.requiredIngredients[].minCount`. This means: once positions
  exist, the *count* they imply must be authored to equal the recipe's own `minCount` (a
  mechanical constraint, not a free choice) — but the positions themselves are still a spatial
  design decision.
- `scorePiecesComponentV2`/`scorePieceGroupV2` are already **fully generic** — they iterate
  `readonly ReferencePieceGroup[]` with no code-level hardcoding to mozzarella/basil (only a
  narrower *type* did, see §4). The scoring math does not need to change to support more groups.
- `scoreRecipeComponentV2` (Recipe/type-correctness + Issue #32 purity) is **already fully
  generic today** — it reads `recipe.requiredIngredients` directly and needs no Reference data
  at all. It already scores correctly, for every recipe, with zero changes.
- `computeScoringV2Shadow` requires **both** a non-null `getReferencePizza(recipe.id)` sauce
  target **and** a non-empty, valid `pieceGroups` set that actually reflects the recipe's
  required toppings for the result to be meaningful `available: true` — a `ReferencePizza` with
  `pieceGroups: []` would technically flip `available` to `true` (an empty groups array is a
  valid "no piece groups" case per `scorePiecesComponentV2`'s own doc comment) but would silently
  give every player free full marks on that axis regardless of how toppings were placed. That is
  not fabrication of a false geometry, but it *is* a fabricated product behavior (quietly
  deciding "topping placement doesn't count for this recipe") with no more approval behind it
  than making up coordinates would have — so this task does not do that either.

**This means B2's real bottleneck is exactly what §1/§2 already identified: reviewed piece
positions + tolerance radii, nothing else.** Sauce targets and piece *counts* are both
mechanically derivable today.

---

## 4. What was implemented (safe, mechanical, generalized infrastructure only)

All changes are in `src/data/referencePizza.ts` (+ its test file). No scoring coefficients,
weights, `gameReducer.ts`, `dex.ts`, `missionScoring.ts`, or authority wiring were touched.

1. **Type widening (mechanical, zero new data):**
   - `ReferencePizza.recipeId`: `"margherita"` literal → `RecipeId` (from `./recipes`).
   - `ReferencePieceGroup.ingredientId`: `"mozzarella" | "basil"` → `string`.
   These are prerequisites for any future recipe's `ReferencePizza` to type-check at all; they
   add no data and do not change `getReferencePizza`'s runtime behavior (still Margherita-only).

2. **Generalized the sauce-fixture derivation** (previously Margherita-named, but never
   Margherita-specific geometry):
   - `buildIdealSauceFixture()` — the same concentric-ring geometry, exposed under a
     recipe-agnostic name. `buildIdealMargheritaSauceFixture()` is now a byte-identical thin
     alias (kept for existing callers/tests; still exported unchanged).
   - `computeMechanicalSauceReference(recipeId: RecipeId): ReferenceSauce` — derives a real,
     reachable `ReferenceSauce` for **any** recipe from that recipe's own `RecipeSauceProfile`
     (`recipeSauceProfiles.ts`) plus the shared ideal-fixture metrics. `MARGHERITA_REFERENCE.sauce`
     is now defined *in terms of* this same function (`computeMechanicalSauceReference
     ("margherita")`), so Margherita's already-accepted numbers (`0.92`/`0.72`) can never
     silently drift from what every other recipe's derivation produces — pinned by a new
     regression test (§5).
   - **`getReferencePizza` itself is unchanged** — still returns non-null for Margherita only.
     No recipe's coverage changed. This is intentional per §1-§3: adding entries for the 6 target
     recipes with mechanically-correct sauce numbers but no piece geometry would have produced a
     `ReferencePizza` this task cannot honestly call reviewed, and per §3, `pieceGroups: []`
     would silently exempt whichever recipe's toppings from being scored at all.

3. Every new export is additive (`buildIdealSauceFixture`, `computeMechanicalSauceReference`) —
   no existing export's signature, name, or return value changed.

### Why this is "meaningful safe implementation," not a no-op

Once reviewed piece geometry exists for a recipe (§6), authoring its `ReferencePizza.sauce`
field becomes a one-line `computeMechanicalSauceReference("marinara")` call instead of
re-deriving fixture metrics by hand — the mechanical half of B2's remaining work for all 6
recipes is now done and tested, leaving only the genuinely non-mechanical half (§6) for a human
review pass.

---

## 5. Tests added

`src/data/referencePizza.test.ts`:

- `getReferencePizza` still returns `null` for all 6 B2 target recipes (explicit regression pin,
  named to the recipe IDs this task targets, so a future accidental partial registration is
  caught immediately).
- `buildIdealSauceFixture()` is geometry-identical to the (now-aliased) `
  buildIdealMargheritaSauceFixture()` and to `IDEAL_MARGHERITA_SAUCE_FIXTURE`.
- `computeMechanicalSauceReference("margherita")` reproduces `MARGHERITA_REFERENCE.sauce`
  exactly — proves the generalization is consistent with the already-accepted Margherita target,
  not a new/different formula.
- For **every one of the 7 recipes** (`RECIPES.map(r => r.id)`): the derived sauce target uses
  that recipe's real sauce ingredient (from `recipeSauceProfiles.ts`, never a fabricated
  stand-in), lands in a sane non-degenerate `(0.1, 1)` range, and — reusing the exact same
  reachability standard as Margherita's own pinned test — the fixture that produced it scores
  `> 0.95` shadow similarity against its own derived target.
- A closing assertion that the full set of sauce ingredients seen across all 7 derived targets
  is exactly `{tomato-sauce, pesto, olive-oil}` (`recipeSauceProfiles.ts`'s real catalog), never
  an invented id.

**Full verification (this session, on this branch):**

| Check | Result |
|---|---|
| Focused (`referencePizza.test.ts`, `playerReference.test.ts`, `scoringV2/*`) | 263 passed |
| Full suite (`npm test`) | **990 passed**, 54 files, 0 failed |
| Typecheck + build (`npm run build` = `tsc -b && vite build`) | ✅ clean, `dist/` produced |
| Lint (`npm run lint` = `oxlint`) | ✅ 0 findings |

---

## 6. Reference-authoring proposal/template for the 6 target recipes

For each recipe: sauce target is **ready now** (mechanical, no review needed beyond confirming
the ingredient/interaction mapping already in `recipeSauceProfiles.ts` is correct). Piece groups
list the ingredient + target **count** (mechanically fixed to `minCount` — not a free choice)
with positions/radii as the **explicit open slot** a human/design reviewer must fill in, in the
same `{x, y}` (0–100 dough-space) + `{fullCreditRadius, zeroCreditRadius}` shape Margherita
already uses.

| Recipe | Sauce (ready via `computeMechanicalSauceReference`) | Piece groups needed (ingredient × target count) | Positions/radii |
|---|---|---|---|
| marinara | tomato-sauce, quantity 0.92, coverage 0.72 | garlic × 3, oregano × 2 | **NEEDS REVIEW** |
| quattro-formaggi | olive-oil, quantity 0.92, coverage 0.72 | mozzarella × 2, gorgonzola × 2, parmigiano × 2, fontina × 2 | **NEEDS REVIEW** |
| genovese | pesto, quantity 0.92, coverage 0.72 | mozzarella × 2, cherry-tomato × 3 | **NEEDS REVIEW** |
| bismarck | tomato-sauce, quantity 0.92, coverage 0.72 | mozzarella × 3, egg × 1 | **NEEDS REVIEW** |
| funghi | tomato-sauce, quantity 0.92, coverage 0.72 | mozzarella × 2, mushroom × 3 | **NEEDS REVIEW** |
| fugazza | olive-oil, quantity 0.92, coverage 0.72 | onion × 4, oregano × 1 | **NEEDS REVIEW** |

(All six share the same sauce numbers because the geometry standard — "painted evenly, rim
left bare" — is one physical quality bar applied identically regardless of sauce ingredient;
this is expected, not a bug, and is exactly what §4's derivation is designed to produce.)

### Recommended authoring process (proposal, not yet approved)

1. For each recipe, a human reviewer picks `positions` for each piece group directly on a
   100×100 dough-space grid (matching Margherita's own coordinate system), the same way
   Margherita's own layout was chosen (visual/product judgment, not measurement) — ideally
   sanity-checked by rendering the candidate positions through the existing `ReferencePreview`
   popover component before committing them, so the reviewer sees exactly what the player will
   see.
2. Default `fullCreditRadius: 8, zeroCreditRadius: 22` (Margherita's own values) as the starting
   tolerance band for ordinary scattered toppings, adjusted per recipe only with a stated reason
   (see structurally-different notes below) — reuse before reinvent.
3. Add one `scoringV2.test.ts` "recipe availability" case per newly-covered recipe (mirroring the
   existing pinned "all 6 unavailable" table this audit's own tests extend) once real geometry is
   approved, asserting `available: true` and a sensible Golden-Matrix-style ordering
   (perfect > good > poor > empty), matching the standard already applied to Margherita.
4. Wire the recipe into `getReferencePizza` (a `Record<RecipeId, ReferencePizza | undefined>` or
   equivalent lookup) only once its `pieceGroups` have been reviewed — never partially.

### Structurally different recipes that need explicit reviewer attention, not a copy-paste of Margherita's shape

- **quattro-formaggi** (4 cheese groups: mozzarella, gorgonzola, parmigiano, fontina, 2 each) —
  a real quattro formaggi is typically quartered or visually blended zones of melted cheese, not
  8 non-overlapping discrete dots the way Margherita's 3 mozzarella + 2 basil are. The reviewer
  needs to decide whether the 4 groups should occupy genuinely separate quadrant-like regions
  (in which case Margherita's model works unmodified) or whether some visual/scoring
  accommodation for overlapping/adjacent placement is wanted — a product decision, not a coding
  one, since `piecesComponent.ts` already scores arbitrarily many groups without change.
- **bismarck** (egg × 1) — a single large fried egg is categorically different from a scattered
  multi-piece topping: one big object, most naturally centered, not "3 mozzarella pieces spread
  around." The existing `TAP_PLACE`/Hungarian-matching model still technically works for a
  1-position group, but the tolerance radii likely should not default to Margherita's 8/22
  (chosen for small scattered pieces) without the reviewer explicitly re-deciding what "close
  enough" means for one large centered object.
- **fugazza** (onion × 4, oregano × 1, no cheese at all, olive-oil instead of tomato sauce) — the
  first target recipe with no cheese anchor and a topping-dominant, no-sauce-paint-color
  visual base; worth the reviewer's explicit check that 4 onion positions plus 1 oregano
  position still reads as a sensible, visually distinct target layout against olive oil's
  different visual field, not just Margherita's tomato-red layout with different labels.
- **genovese** (mozzarella × 2, cherry-tomato × 3) — first target recipe mixing two visually
  different discrete "solid" piece shapes (round cherry tomatoes vs. mozzarella disks) rather
  than Margherita's disk+leaf pairing; a reasonable starting case for reusing the standard model
  as-is, flagged here only so the reviewer treats it as a fresh layout, not a re-skin.
- **marinara** and **funghi** are the closest in shape to Margherita's existing 2-group model
  (garlic/oregano and mozzarella/mushroom respectively) and are the lowest-risk starting points
  for a reviewer building confidence with the process before tackling quattro-formaggi/bismarck.

---

## 7. Acceptance target status

- [ ] All 7 recipes can eventually return Scoring 2.0 `available: true` — **not yet**; sauce
  half is mechanically solved for all 7, piece geometry for 6 is not.
- [x] Same-type permutation invariance preserved — untouched (`piecesComponent.ts`/
  `referenceMatching.ts` not modified; existing Hungarian-matching tests still pass unchanged).
- [x] No scoring coefficient changes — confirmed, no file under `scoringV2/` weights/thresholds
  was touched.
- [x] No authority cutover — `gameReducer.ts`, `dex.ts`, `missionScoring.ts`, `economy.ts` not
  touched.
- [x] No Player Reference / Scoring Reference conflation — `playerReference.ts` was read but not
  modified, and no coordinate from it was copied into `referencePizza.ts`.
- [x] No PIZZA DB content copied without permission — no PIZZA DB source was read or copied by
  this task; the recipe/ingredient catalog used was already on `main`.

---

## 8. Final verdict

**STOP BEFORE FABRICATION — B2 REMAINS BLOCKED ON REVIEWED PIECE GEOMETRY, MECHANICAL HALF DONE.**

Per this task's own explicit instruction ("If exact scoring target geometry cannot be justified
from existing approved repository evidence: STOP before fabricating it"): Issue #32's own
Reference-authoring acceptance item is unresolved, and this project's only PIZZA DB-adjacent
evidence for piece placement is "there is none" (confirmed by the file's own header comments,
not assumed). Fabricating six recipes' `(x, y)` piece positions here would have been exactly the
CRITICAL RULE violation the task warned against, and would not have been a small, reversible
choice — Scoring 2.0 target geometry is exactly the kind of "content" decision this project's
non-negotiable guards reserve for explicit human review.

What **is** done and safe to build on: the sauce-target half of B2 is now genuinely mechanical
for all 7 recipes (tested, reachable, consistent with Margherita's own accepted numbers), the
type system no longer blocks adding other recipes' Reference data, and a concrete per-recipe
template (§6) exists so a future reviewed-geometry pass is a data-entry task against a known
shape, not a from-scratch design exercise.

**Exact remaining human/content decision:** for each of marinara, quattro-formaggi, genovese,
bismarck, funghi, fugazza — reviewed `(x, y)` target positions and tolerance radii per required
piece group (§6's table), following (or replacing) the proposed authoring process in §6, with
particular design attention on quattro-formaggi (4 overlapping cheese groups), bismarck (single
large egg vs. scattered pieces), and fugazza (no-cheese, olive-oil base) as called out above.
