# Teto Pizza Game — Scoring 2.0 B2 (Reference Coverage) — Fresh Audit + Bounded Result

**Type:** Fresh Audit + bounded implementation (§4, mechanical infra) + design-only candidates
(§9, marinara/funghi) + **PART A implementation of the approved marinara/funghi geometry (§10,
coverage now 3/7)** + **PART B design-only candidates for genovese/fugazza (§11, not yet
approved)**. Does **not** close B2 — see §10.5/§11.5 verdicts.

- **Audited/base main SHA:** `142a18252db56d9ee4c236cc80062673d5e68c80` (Merge PR #55: Scoring
  2.0 Authority Fresh Audit, docs-only). Confirmed via `git fetch origin main && git rev-parse
  origin/main` — matches the task's expected SHA exactly, no drift.
- **Branch:** `claude/scoring-2-reference-coverage-b2-ytp9ay`.
- **Read for this task:** `docs/PROJECT_HANDOFF.md`, `docs/reports/
  TETO_SCORING2_AUTHORITY_Fresh-Audit.md`, Issue #32 (GitHub, live state), `docs/reports/
  TETO_ISSUE-32_RECIPE-CORRECTNESS_Fresh-Audit.md`, `src/data/referencePizza.ts`, `src/data/
  playerReference.ts`, `src/data/recipes.ts`, `src/data/recipeSauceProfiles.ts`, `src/logic/
  scoringV2/*` (all 8 files), `src/logic/referenceMatching.ts`, `src/data/referencePizza.test.ts`.

### Status matrix (current, this HEAD)

| Recipe | Status | Notes |
|---|---|---|
| Margherita | **EXISTING** | Unaffected by this task; still the original Phase 4A-1B Reference. |
| Marinara | **APPROVED / IMPLEMENTED** | §10 — ChatGPT-approved geometry, registered in `getReferencePizza`. |
| Funghi | **APPROVED / IMPLEMENTED** | §10 — ChatGPT-approved geometry, registered in `getReferencePizza`. |
| Genovese | **CANDIDATE / NOT APPROVED** | §11.1 — design-only, no code implements it. |
| Fugazza | **CANDIDATE / NOT APPROVED** | §11.2 — design-only, no code implements it; tolerance explicitly reconsidered. |
| Bismarck | **NOT AUTHORED** | Explicitly out of scope this pass (single-egg tolerance question unresolved). |
| Quattro Formaggi | **NOT AUTHORED** | Explicitly out of scope this pass (4 overlapping cheese groups unresolved). |

**Overall B2: OPEN, coverage 3/7.**

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

---

## 9. Candidate geometry — Marinara / Funghi design pass

> **Status update:** ChatGPT reviewed this section's candidates and **approved both**
> (marinara's geometry, funghi's geometry, and the 8/22 tolerance **for these two recipes
> specifically, not as a universal rule**). §10 below implements them verbatim. This section's
> own content is left unchanged below as the historical design record; do not re-derive these
> numbers from scratch — the coordinates that shipped in §10 are copied byte-for-byte from
> here.

**Follow-up to §8, same PR #57.** PR #57's bounded mechanical implementation (§4) was accepted
as-is, not merged. This section is a design-only pass exercising §6's proposed authoring
process on the two lowest-risk recipes (marinara, funghi) before scaling it to the remaining
four. **No code in this repository implements the coordinates below.** They are a proposal for
human/ChatGPT review, following exactly the same constraints as §1–§3: not derived from
`playerReference.ts`, not copied from PIZZA DB, no coefficient changes, no authority cutover.

### 9.1 Method used

For each recipe: piece **counts** come directly from `recipes.ts`'s `requiredIngredients`
(mechanical, not a choice — see §3). Piece **positions** were hand-placed on the same 0–100
dough-space coordinate system Margherita's own `pieceGroups` already use, following the pattern
Margherita's own (game-authored, not measured) layout already establishes: a loose, intentionally
non-symmetric spread, each same-ingredient pair kept comfortably above `zeroCreditRadius` (22)
apart so the tolerance bands never create ambiguous overlap, and every point kept well inside
`DOUGH_RADIUS` (48) with margin comparable to Margherita's own (roughly 24–32 units of clearance
to the rim, vs. Margherita's 25.5–32). Tolerance radii reuse Margherita's `fullCreditRadius: 8,
zeroCreditRadius: 22` unchanged — no concrete reason to differ was found (see §9.4).

### 9.2 Candidate: マリナーラ (marinara) — `tomato-sauce`, `garlic × 3`, `oregano × 2`

| Group | # | x | y | Distance from center | Full / Zero |
|---|---|---|---|---|---|
| garlic | 1 | 33 | 41 | 19.2 | 8 / 22 |
| garlic | 2 | 69 | 43 | 20.2 | 8 / 22 |
| garlic | 3 | 50 | 68 | 18.0 | 8 / 22 |
| oregano | 1 | 38 | 63 | 17.7 | 8 / 22 |
| oregano | 2 | 64 | 60 | 17.2 | 8 / 22 |

Same-group spacing: garlic 31.4–36.1 apart (Margherita mozzarella: 30.0–34.4); oregano 26.2 apart
(Margherita basil: 38.0). Rim clearance: 27.8–30.8 units for every point (Margherita: 25.5–32.0).

**Rationale:** marinara has no cheese at all, so garlic (×3) takes over mozzarella's "anchor
triangle spread across the dough" role, at a distance-from-center band (18.0–20.2) matching
Margherita's own mozzarella band (16.0–21.2) — a real, roughly-even hand-placed triangle should
score well without needing to be exact. Oregano (×2) takes basil's lower-middle accent role.
Positions are deliberately not mirror-symmetric (33/69 rather than 33/67; 41/43 rather than an
exact 41/41), matching how Margherita's own 35/65, 35/36 mozzarella pair also isn't a perfect
mirror — a rigid symmetric target would otherwise mark an equally reasonable, slightly uneven
real placement as wrong, which the task's own "avoid punishing reasonable handmade placement"
requirement specifically warns against.

### 9.3 Candidate: フンギ (funghi) — `tomato-sauce`, `mozzarella × 2`, `mushroom × 3`

| Group | # | x | y | Distance from center | Full / Zero |
|---|---|---|---|---|---|
| mozzarella | 1 | 36 | 38 | 18.4 | 8 / 22 |
| mozzarella | 2 | 66 | 40 | 18.9 | 8 / 22 |
| mushroom | 1 | 50 | 30 | 20.0 | 8 / 22 |
| mushroom | 2 | 30 | 62 | 23.3 | 8 / 22 |
| mushroom | 3 | 70 | 64 | 24.4 | 8 / 22 |

Same-group spacing: mozzarella 30.1 apart (Margherita basil: 38.0); mushroom 37.7–40.0 apart
(Margherita mozzarella: 30.0–34.4, spread slightly wider on purpose — see rationale). Rim
clearance: 23.6–29.6 units (Margherita: 25.5–32.0, comparable, funghi's mushroom group runs
closest to the rim of anything proposed here but still clears it by >23 units).

**Rationale:** funghi's counts invert Margherita's (2 cheese / 3 topping instead of 3/2), so the
*roles* invert too: mozzarella (×2) takes basil's compact upper-middle accent role; mushroom
(×3) takes mozzarella's wide-triangle role, but spread further apart (top-center plus two lower
corners) than Margherita's own mozzarella triangle, so it reads as "mushrooms scattered across
the whole pizza" — matching funghi's real identity as a topping-forward dish rather than
Margherita's cheese-forward one. Distance-from-center for every point in this pass (18.0–24.4
across both recipes) stays inside one consistent band, so neither candidate reads as unusually
cramped or unusually rim-hugging relative to Margherita or to each other.

### 9.4 Concern discovered about the current piece-scoring model (design-pass finding, no code changed)

Read `piecesComponent.ts`/`referenceMatching.ts` again specifically while choosing these
tolerance radii (not previously flagged in §3): **`fullCreditRadius`/`zeroCreditRadius` have no
source of truth to derive from at all.** No file in the codebase defines a per-ingredient
physical footprint (pixel size, hitbox radius, or similar) that a tolerance band could be
computed from — every scatter ingredient (mozzarella's CSS blob included) renders through the
same generic sizing path regardless of the ingredient's real-world size, and `scorePieceGroupV2`
takes `fullCreditRadius`/`zeroCreditRadius` as opaque authored numbers with no validation beyond
"is this a valid band" (`isValidToleranceBand`). Reusing Margherita's `8/22` for marinara/funghi
here is therefore a **judgment call by analogy** ("these pieces aren't obviously bigger or
smaller than mozzarella/basil"), not a measurement — and the same will be true for every future
recipe's tolerance radii unless a future slice adds an actual size-derivation mechanism. This
does not block the current two candidates (nothing here suggested 8/22 is wrong for them), but
a reviewer evaluating bismarck's single large egg (§6) in particular should not assume the same
default transfers without a deliberate check, since egg is the first target ingredient
plausibly large enough that the analogy breaks down.

Two smaller observations, not blockers: (1) nothing in the scoring code checks for accidental
overlap *between different groups'* target positions (Hungarian matching only ever compares
same-ingredient positions) — verified by eye for both candidates above, but a recipe with more
groups (quattro-formaggi's four) will need the same manual check, or a future lint helper, since
nothing today would catch it automatically. (2) pieces have no rim-margin concept analogous to
sauce's `SAUCE_TARGET_RADIUS` — any `(x, y)` in `[0, 100]` is technically a valid target,
including flush against the dough edge; both candidates above were kept well clear of this by
manual choice, not by any code-enforced constraint.

### 9.5 Visual artifacts produced (design review only, no implementation)

- **Shareable review link (ChatGPT/human):** https://claude.ai/artifact/Bquy5fF4bc4Rur8Wm42tft
  — interactive page, real ingredient emoji/CSS shapes, 390px-width primary layout, light/dark
  themed, shows Margherita (existing/approved) alongside both candidates with full/zero-credit
  tolerance rings drawn to scale and the same rationale text as above.
- **Committed static screenshots** (same visual content, for durable in-repo reference):
  - `docs/reports/screenshots/scoring2-b2-reference-design/00-overview-390w.png` — full page,
    390×844-equivalent width (updated in §10/§11 below to include all 5 recipes covered by
    then; see those sections for the current version's exact contents).
  - `docs/reports/screenshots/scoring2-b2-reference-design/01-margherita-existing.png`
  - `docs/reports/screenshots/scoring2-b2-reference-design/02-marinara-implemented.png` — kept
    at this path name even though marinara moved from "candidate" to "implemented" in §10, to
    avoid rewriting this section's own historical filenames; the image content itself was
    updated to the "implemented" tag.
  - `docs/reports/screenshots/scoring2-b2-reference-design/03-funghi-implemented.png` — same
    note as marinara above.

### 9.6 Scope guard for this design pass

No production code was changed in this pass (only this report and the screenshots above were
added — `git status` confirms no `.ts`/`.tsx` diff). `getReferencePizza` still returns non-null
for Margherita only; marinara and funghi are **not** registered. No scoring coefficients,
weights, or authority wiring were touched. No Preview deployment was performed (per the task's
own "no Preview deployment required if this remains design-only" instruction) — nothing
user-reachable changed. **PR #57 remains unmerged**, and this design-pass content lives in the
same PR as an additional commit, not implementation.

### 9.7 Verdict for this pass

**CANDIDATE GEOMETRY PROPOSED — NOT YET APPROVED.** Marinara and funghi now have concrete,
reasoned `(x, y)` + tolerance-radius proposals ready for human/ChatGPT review, following the
authoring process §6 proposed. Pending that review's outcome (approve as-is, request
adjustments, or reject the approach), the same method is intended to scale to genovese,
bismarck, quattro-formaggi, and fugazza — with bismarck and quattro-formaggi flagged in §6 and
§9.4 as needing the most reviewer attention (single large egg; four overlapping cheese groups)
before this exact 8/22-reuse-by-analogy pattern should be assumed to transfer unchanged.

---

## 10. PART A — Implemented: Marinara / Funghi Reference geometry (APPROVED)

**Base for this slice:** rebased onto fresh `origin/main` at `556376c4fa966ae95ca9056c20b3ab49c1ad6ae8`
(Save v2 E0, PR #56, merged) at the start of this pass; main advanced again mid-pass to
`f4640266df8fca321a1cc6001855cae9d3b63636` (**B1 — Bake similarity component**, PR #58, merged)
and this branch was rebased onto that too before implementing. See §10.1 for exactly what each
rebase touched and how conflicts were resolved.

ChatGPT reviewed §9's candidates and returned: **APPROVED** — marinara's geometry, funghi's
geometry, and `fullCreditRadius: 8, zeroCreditRadius: 22` **for these two recipes specifically,
not as a universal rule** (explicitly not to be auto-applied to bismarck's egg). This section
implements exactly what was approved, verbatim — no coordinate was re-derived or adjusted at
implementation time.

### 10.1 Rebase / conflict resolution

Two rebases were needed in this pass, both clean fast-forwards of this branch onto a newer
`main`, no lost work in either direction:

1. **Onto `556376c` (Save v2 E0, PR #56):** `git rebase origin/main` succeeded with **zero
   conflicts**. E0 touched `src/state/persistence.ts` and its own tests plus
   `docs/PROJECT_HANDOFF.md`; this branch's only overlapping file was
   `docs/PROJECT_HANDOFF.md`, and the two edits landed in different sections (E0: the Save v2
   roadmap bullet; this branch: the Scoring 2.0 Authority / B2 bullet), so git merged them
   automatically. Verified post-rebase: `docs/PROJECT_HANDOFF.md` still contains both E0's "PR
   #56 open, DO NOT MERGE pending review" status line (left as-is per the task's own "take
   fresh state as given, don't revert it" instruction — not this task's place to correct) and
   this report's own B2 status line.
2. **Onto `f464026` (B1 Bake component, PR #58):** discovered mid-pass — `main` advanced again
   while PART A's implementation commit was already prepared. `git rebase origin/main` hit
   **one real conflict**, in `src/logic/scoringV2/scoringV2.test.ts`: both this branch and B1
   appended new `describe` blocks at the end of the same file. Resolved by keeping this
   branch's own added block (the "unavailable Reference recipe" example switched from marinara
   to bismarck, since marinara is no longer unavailable) and updating its `bake.available`
   assertions to match B1's new, correct behavior (`true`, not `false` — Bake needs no
   Reference fixture at all per `bakeComponent.ts`'s own file header, so it's real for every
   recipe regardless of B2's own Reference-coverage gate). `malformedInput.test.ts` and every
   other file auto-merged with no conflicts. Full suite re-run and green after resolution (see
   §10.3) — nothing from either PR was silently dropped.

**Net effect of B1 landing first:** `computeScoringV2Shadow`'s weights changed
(`SAUCE_WEIGHT`/`PIECES_WEIGHT`/`RECIPE_WEIGHT` rescaled 65/20/15 → 52/16/12, `BAKE_WEIGHT: 20`
added) and `Bake` is now a real, non-placeholder component for every recipe, Reference or not.
This is a B1 concern, not re-litigated here — B2's own tests were written weight-agnostic
(relative ordering / reachability thresholds, never a hardcoded total) specifically so they
would not need updating for an unrelated calibration change, and none did except the two
`bake.available` assertions the conflict itself surfaced.

### 10.2 What was implemented

`src/data/referencePizza.ts`:

- `MARINARA_REFERENCE`: `sauce: computeMechanicalSauceReference("marinara")`, `pieceGroups`:
  `garlic` at `(33,41), (69,43), (50,68)` and `oregano` at `(38,63), (64,60)`, both
  `{ fullCreditRadius: 8, zeroCreditRadius: 22 }` — byte-identical to §9.2's proposal.
- `FUNGHI_REFERENCE`: `sauce: computeMechanicalSauceReference("funghi")`, `pieceGroups`:
  `mozzarella` at `(36,38), (66,40)` and `mushroom` at `(50,30), (30,62), (70,64)`, same
  tolerance — byte-identical to §9.3's proposal.
- `getReferencePizza` is now a small `Map<RecipeId, ReferencePizza>` lookup (previously a single
  equality check against Margherita) covering all three implemented recipes; still returns
  `null` for quattro-formaggi, genovese, bismarck, fugazza.
- No change to `computeMechanicalSauceReference`, `buildIdealSauceFixture`, or any exported
  type beyond what §4 already introduced.

**Files touched:** `src/data/referencePizza.ts`, `src/data/referencePizza.test.ts`,
`src/logic/scoringV2/scoringV2.test.ts`, `src/logic/scoringV2/malformedInput.test.ts`,
`src/data/playerReference.test.ts`, `src/components/ScoringV2ShadowPanel.test.tsx`. The last
three needed updating only because they had hardcoded **marinara** as an example of an
*unavailable* recipe (now legitimately available) — each switched to **bismarck**, which still
has none, so each test keeps exercising a genuinely unavailable case rather than becoming a
stale, silently-wrong pin.

**Not touched:** `gameReducer.ts`, `dex.ts`, `missionScoring.ts`, `economy.ts`,
`piecesComponent.ts`, `referenceMatching.ts`, `sauceComponent.ts`, `recipeComponent.ts`, any
scoring weight/coefficient, `playerReference.ts`'s own data (only its test's example recipe
changed).

### 10.3 Tests added / updated

- Availability: `marinara`/`funghi` now `available: true` with every component (`sauce`,
  `pieces`, `recipe`) `available: true` (Bake already was, per B1, independent of B2).
- Golden Matrix, parameterized across `margherita`/`marinara`/`funghi`: perfect (Reference-exact)
  > good (slightly imperfect) > poor (concentrated/badly placed) > empty, reusing generalized
  `referenceLikePizzaForRecipe`/`goodPizzaForRecipe`/`poorPizzaForRecipe` helpers built from
  each recipe's own `getReferencePizza(...)` output rather than hardcoded per-recipe literals.
- Permutation invariance, explicitly re-pinned for the two new recipes' own piece groups
  (shuffled `toppings` array order produces an identical `totalScore`) — on top of the existing
  generic `referenceMatching.test.ts`/`piecesComponent.ts` permutation coverage, which already
  covered this mechanically since neither file was touched.
- Regression: `getReferencePizza` still `null` for the 4 recipes PART A didn't implement;
  `MARINARA_REFERENCE`/`FUNGHI_REFERENCE` pin the exact approved coordinates/tolerance so a
  future accidental edit fails immediately, the same guarantee Margherita's own geometry has
  had since Phase 4A-1B.
- Determinism: two `computeScoringV2Shadow` calls with identical input for marinara produce an
  identical result (no hidden state/side effects — the Shadow-only contract holds for the newly
  covered recipes too, not just Margherita).

**Full verification (this session):**

| Check | Result |
|---|---|
| Full suite (`npm test`) | **1039 passed**, 54 files, 0 failed |
| Typecheck + build (`tsc -b && vite build`) | ✅ clean |
| Lint (`oxlint`) | ✅ 0 findings |
| CI (`build` check, PR #57 HEAD `fdf727885b3d138c659249f257d65f44d8353b7d`) | ✅ success |

### 10.4 Preview / Review Playthrough

- **Preview deploy:** `perusonao/teto-pizza-game-preview`, `deploy-from-source.yml` with
  `ref=fdf727885b3d138c659249f257d65f44d8353b7d, pr_number=57` → success, then `pages.yml` →
  success. Live at https://perusonao.github.io/teto-pizza-game-preview/, badge confirmed
  `PREVIEW · PR#57 · fdf7278` (this session's sandboxed network policy blocks a direct fetch to
  `perusonao.github.io` itself, same caveat as every prior Preview-Gate report in this repo —
  verified instead via the GitHub Actions API showing both workflows succeeded against this
  exact commit, plus a byte-identical local rebuild with the same `VITE_PREVIEW_MODE=1
  VITE_PREVIEW_PR=57 VITE_PREVIEW_SHA=fdf7278` command, served locally and driven with real
  headless-Chromium gestures below).
- **Review Playthrough (390×844, real pointer gestures, no shortcuts/dev hooks):** for each of
  Margherita, marinara, funghi — stretch the dough (8-direction radial drag to completion),
  paint the sauce (real hold-and-drag PAINT gesture, not a synthetic deposit), place cheese
  (where required) and toppings by tapping the tray then the exact approved Reference
  coordinates, start and confirm BAKE (waited for the real oscillating gauge, clicked
  取り出す！only once it read "perfect" for funghi; marinara/margherita landed just outside the
  window on this run, "生焼け", which is left in the video as an honest, non-cherry-picked
  result). Video: `artifacts/review/TETO_SCORING2-B2_PARTA_Review-Playthrough.mp4` (gitignored,
  delivered directly to the user, not committed — matches this project's own "never commit a
  large review video" rule).
- **What the video shows, per the review's own requirements:**
  1. Margherita reaches RESULT with its Shadow panel still `available:true` — unaffected by
     PART A, proving no regression to Scoring 2.0's original recipe.
  2. Marinara reaches RESULT with Shadow `Total: 99/100` (Sauce 99, Pieces 100, Recipe 100,
     Bake 98) — **newly `available:true`**, a real score for a real well-made pizza.
  3. Funghi reaches RESULT with Shadow `Total: 100/100` (Sauce 99, Pieces 100, Recipe 100,
     Bake 100) — **newly `available:true`**.
  4. In every case, the player-facing ★ stars/number (e.g. Marinara's legacy `★★★★☆ 99`, Funghi's
     `★★★★★ 100`) come from a visually and numerically separate panel above the Shadow section;
     the Shadow panel is explicitly labeled "🧪 Scoring 2.0 Shadow（開発用・phase-4a-2-shadow-3）"
     ("development use") and only renders at all under `VITE_PREVIEW_MODE` — the same isolation
     every prior Scoring 2.0 report has verified, re-confirmed here by simply reading what the
     live Preview build actually renders, not re-testing the isolation mechanism itself (already
     covered by existing pinned tests).
- **No merge.** PR #57 remains open/draft.

### 10.5 B2 status after PART A

**Scoring 2.0 Reference coverage: 3/7 (margherita, marinara, funghi).** Sauce/Pieces/Recipe all
available and producing sensible, non-fabricated scores for all three. Bake is available for
every recipe (B1, independent of B2). Remaining: quattro-formaggi, genovese, bismarck, fugazza
— see §11 for genovese/fugazza's own design-only candidates.

---

## 11. PART B — Candidate geometry: Genovese / Fugazza

**Design-only, same as §9 — no code implements the coordinates below.** `getReferencePizza`
does not return genovese or fugazza. Do not scale this pattern to bismarck or quattro-formaggi
yet — both are explicitly out of scope for this pass per the task's own instruction, and §6/§9.4
already flag them as needing more reviewer attention than a straightforward extension of this
method (bismarck's single large egg; quattro-formaggi's four overlapping cheese groups).

### 11.1 Genovese — `pesto`, `mozzarella × 2`, `cherry-tomato × 3` (its own composition, not a Margherita/Funghi reskin)

| Group | # | x | y | Distance from center | Full / Zero |
|---|---|---|---|---|---|
| mozzarella | 1 | 33 | 42 | 12.8 | 8 / 22 |
| mozzarella | 2 | 59 | 65 | 14.3 | 8 / 22 |
| cherry-tomato | 1 | 48 | 32 | 18.8 | 8 / 22 |
| cherry-tomato | 2 | 40 | 70 | 21.0 | 8 / 22 |
| cherry-tomato | 3 | 70 | 47 | 24.8 | 8 / 22 |

Same-group spacing: mozzarella 26.9 apart; cherry-tomato 34.8–38.6 apart, both comfortably above
the 22-unit tolerance. Rim clearance: 23.2–35.2 units.

**Rationale — explicitly not a reskin.** Every recipe covered so far (margherita, marinara,
funghi) places one ingredient in an "upper" cluster and the other "lower" — a real reskin risk
if genovese repeated that shape with cherry-tomato standing in for basil/mushroom. A real
genovese isn't two zones: mozzarella knobs and cherry-tomato halves scatter together across the
same pesto field. So this candidate interleaves the two ingredients around one ring (mozzarella
at roughly 162°/306° from center, cherry-tomato at 90°/234°/18°, each nudged off a perfect
pentagon so it isn't rigidly symmetric) rather than clustering by type — a genuinely different
composition, not the same shape with new labels. Tolerance stays 8/22: mozzarella is the
identical physical piece as every other recipe's, and cherry-tomato has exactly as much (i.e.
as little) rendered-size evidence as garlic/oregano/mushroom did (§9.4) — no new information to
justify a different number.

### 11.2 Fugazza — `olive-oil`, `onion × 4`, `oregano × 1` (no cheese, no tomato base)

| Group | # | x | y | Distance from center | Full / Zero |
|---|---|---|---|---|---|
| onion | 1 | 30 | 36 | 24.4 | 8 / 22 |
| onion | 2 | 69 | 35 | 24.2 | 8 / 22 |
| onion | 3 | 33 | 67 | 24.0 | 8 / 22 |
| onion | 4 | 67 | 63 | 21.4 | 8 / 22 |
| oregano | 1 | 51 | 46 | 4.1 | 8 / 22 |

Onion pairwise spacing: 28.1–48.2 apart (every pair clears 22 comfortably, including the two
closest corners). Rim clearance: 23.6–26.6 units for onion, 43.9 for the near-center oregano.

**Rationale.** Onion (×4) is the most pieces of any recipe covered so far — placed at
21.4–24.4 units from center (the upper end of every prior recipe's band) specifically to give
four points room to clear 22-unit spacing without crowding or hugging the rim. Corners are
deliberately uneven (not a square) for the same "don't punish reasonable asymmetry" reason as
every prior proposal. Oregano's single required piece sits near-center as an interior accent
among the onions, unlike every prior recipe's edge-accent placement — fugazza has no cheese
anchor and no second accent point to balance against, so "one sprinkle among the onions" reads
more naturally than forcing a paired, symmetric position that doesn't exist for a single piece.

**Tolerance — explicitly reconsidered per the task's own instruction, kept at 8/22 pending
review, not assumed.** Onion pieces (wedges) plausibly read as physically larger than a garlic
clove or basil leaf, which is exactly why this needed checking rather than copy-pasting 8/22
again. Checked against the actual rendering code (not assumed): `ingredients.ts`'s own comment
on `onion` confirms it "renders with the ordinary emoji-topping path (no dedicated CSS treatment
needed)" — it draws at the exact same generic size as garlic/oregano/mushroom, with nothing in
the codebase differentiating it. With no rendered-size evidence to diverge on, and the 4-point
spacing above already comfortable at 22, this candidate keeps 8/22 by the same "no concrete
reason to differ" standard §9's marinara/funghi proposals used — but this is flagged explicitly
as a reviewer decision point, not a default carried over silently, since fugazza is the first
recipe where a real-world size difference is plausible even without code evidence for it.

### 11.3 Visual artifacts (updated, same links as §9.5)

- **Shareable review link:** https://claude.ai/artifact/Bquy5fF4bc4Rur8Wm42tft (republished —
  same URL, now shows all 5 recipes: margherita/marinara/funghi tagged "Approved · implemented
  (main)", genovese/fugazza tagged "Candidate · not yet approved", with genovese/fugazza's own
  rationale and the tolerance-reconsideration note above rendered on the page itself).
- **Committed screenshots:**
  `docs/reports/screenshots/scoring2-b2-reference-design/00-overview-390w.png` (all 5, full
  page), `04-genovese-candidate.png`, `05-fugazza-candidate.png` (new); `01`–`03` updated in
  place to reflect marinara/funghi's new "implemented" status.

### 11.4 New scoring-model concern discovered in this pass

No new mechanism-level concern beyond §9.4 (tolerance radii have no rendered-size source of
truth to derive from) — fugazza's explicit tolerance re-check (§11.2) confirmed the same gap
applies again, rather than surfacing a new one. One genuinely new observation: **this is the
first recipe (fugazza) where the single-piece-group case (`oregano × 1`) has no "pair" to be
symmetric or asymmetric relative to** — every prior single-or-multi-piece group had at least one
other point in its own group to reason about spacing against. Placing a lone required piece is
a slightly different design question (where does *one* accent go, with nothing to balance it
against within its own group) than the "avoid rigid symmetry between multiple points" question
every prior group faced. Not a code concern — `scorePieceGroupV2` handles a 1-position group
identically to any other size — just a design note worth carrying into bismarck's own future
pass, since bismarck's `egg × 1` is the same shape (a lone required piece) and will face the
exact same question, on top of its already-flagged large-object-tolerance concern (§6/§9.4).

### 11.5 Verdict for PART B

**CANDIDATE GEOMETRY PROPOSED — NOT YET APPROVED.** Genovese and fugazza now have concrete,
reasoned proposals (§11.1/§11.2) ready for review, each addressing the specific instruction it
was given (genovese as its own composition; fugazza's tolerance explicitly reconsidered, not
assumed). B2 overall remains **OPEN at 3/7** — quattro-formaggi and bismarck still have no
candidate at all, by the task's own explicit instruction not to design them yet.
