# Progression 2.0 — Phase 0 Full-Catalog Fresh Audit (Issue #182)

Status: **Phase 0 — audit / design only. No `src/**` change. No production Progression SSOT
overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**

Audited `origin/main` SHA (via `git fetch origin` at session start): `70d85b4034f3b69f8902cce5e2cf319e9bca274d`
(latest `main` commit: PR #181, "Gameplay UX PR-D: RESULT 1-Screen 2.0").

Companion Draft design doc: `docs/design/TETO_RECIPE-DISCOVERY-PROGRESSION_2.0.md`
Companion machine-readable output: `docs/reports/data/TETO_PROGRESS2_PHASE0_analysis-output.json`
Companion tooling: `tools/progression2_phase0_analysis.py` (docs/data-only, not wired into CI,
not referenced by `src/**`)

---

## 0. Duplicate Gate

Checked before starting: `mcp__github__list_pull_requests` (open, all) and
`mcp__github__list_issues` (open, all 17) for this repository. No open PR or open issue
duplicates Issue #182's Progression 2.0 / full-catalog scope. The closest-related prior work
(PR #81, `docs/design/TETO_RECIPE-MASTER-CATALOG.md` and its 53-entry catalog / Fresh-Analysis
report) is **read as input**, not duplicated — see §2.

## 1. Source / Provenance Gate

### 1.1 PIZZA DB (pizzadb.jp) fresh-access attempt — this session

This session ran its own independent network test (not a citation of a prior session's
result):

- `WebFetch https://pizzadb.jp/` → **`EGRESS_BLOCKED`** ("Access to pizzadb.jp is blocked by
  the network egress proxy").
- Control test, `WebFetch https://en.wikipedia.org/wiki/Pizza` → **`EGRESS_BLOCKED`** as well
  (same proxy-level block, not a pizzadb.jp-specific restriction).

This reconfirms, with this session's own evidence, the exact same network-egress block every
prior session touching this catalog has hit (PR #79, PR #81 / `TETO_RECIPE-MASTER-CATALOG_160_
Fresh-Analysis.md` §2.2). **This session did not, and could not, independently fetch or
re-verify PIZZA DB's current listing.**

### 1.2 The "172" figure — attribution, not independent verification

Issue #182's body states (dated 2026-09-22, the issue's own creation date): "PIZZA DB トップは
現在172種類掲載と表示" — a **fresh, first-hand observation by the repository owner**, made from
their own browser session, external to this sandboxed environment's network block. This audit:

- **Treats "172" as an owner-reported external fact, recorded as-is**, not as something this
  session's tooling independently fetched, scraped, or re-counted.
- **Does not guess-fill** the actual 172 pizza names/regions/ingredients — per Issue #182's own
  explicit instruction ("サイトが取得できない場合は推測で穴埋めしない"), no entry in this audit's
  working population is fabricated to "reach 172."
- Uses the existing, already-reviewed `docs/design/TETO_RECIPE-MASTER-CATALOG.md` / `data/
  recipes/*.json` **51-viable-recipe Fresh Recipe Master Catalog** as this Phase 0's working
  population instead (see §2) — every entry in that catalog is independently defensible against
  general, widely-corroborated culinary knowledge (not copied from PIZZA DB, which was equally
  unreachable when that catalog was built) and was never claimed to equal PIZZA DB's own count.
- **Verification-state fields stay honest throughout this audit**: `external_verification`
  (PIZZA DB or another external culinary source, actually fetched this session) = **0 entries**;
  `internal_existing` (already shipped in `src/data/recipes.ts`/`ingredients.ts`, confirmed
  against the actual source file) = the counts in §3; `game_design_judgement` (defensible
  general knowledge, not independently source-checked this session) = the remainder. These three
  buckets are never conflated (this is the same three-way separation Issue #182 §1 requires).

**Consequence for this audit's population**: Phase 0's dependency graph, marginal-unlock
analysis, and deadlock simulation (§5–§6) run over the **51-viable-recipe / 62-ingredient**
working population (the existing Fresh Recipe Master Catalog), not over a fabricated 172-entry
set. The gap between 51 and the owner-reported 172 is stated honestly as **open, unresolved
population-expansion work**, not filled in this Phase 0 — see §8.

### 1.3 No PIZZA DB asset copied

No PIZZA DB text, image, or structured data is present anywhere in this Phase 0's output (none
was reachable to copy even if that were desired). Every recipe/ingredient fact used here is
either (a) read directly from this repository's own `src/**`/`data/**` (internal, verified by
direct file read), or (b) general, independently-corroborated culinary knowledge, exactly as
`docs/design/TETO_RECIPE-MASTER-CATALOG.md` §2/§5 already established and this audit inherits.

## 2. Duplicate-Master-Catalog check

Per the repository owner's own standing instruction (quoted in
`TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` §13): "同じ目的の Master Catalog を複数作ら
ないこと." This audit **does not create a second, competing recipe/ingredient master catalog**.
`data/recipes/pizza_master_catalog.json` / `ingredient_master_catalog.json` /
`gameplay_mechanic_master.json` remain the one SSOT-track catalog; this Phase 0 **reads** them,
cross-references them against current production, and layers a Progression-2.0-specific
analysis on top (§5–§7) — it does not fork or duplicate the catalog itself.

**Freshness check on the catalog data itself**: `data/recipes/ingredient_master_catalog.json`'s
`existingInGame: true` ingredients (22) match `src/data/ingredients.ts`'s actual 22 shipped
ingredients **exactly** (0 production ingredients missing from the catalog). Likewise, all 15
`currentGameRecipe: true` / `verified_internal` catalog recipes match `src/data/recipes.ts`'s
actual 15 shipped recipes **exactly** (0 production recipes missing from the catalog) — see
`crossReferenceExisting53VsProduction.productionRecipeIdsNotInCatalog` /
`productionIngredientIdsNotInCatalog` in the JSON output, both empty arrays. **The catalog JSON
data has been kept in sync with production as recipes shipped (7→15) even though the narrative
prose in `TETO_RECIPE-MASTER-CATALOG.md` / the Fresh-Analysis report still describes the
7-recipe/14-ingredient baseline from PR #81's own session — that prose is stale on this one
point and is not corrected by this Phase 0 (out of this task's scope; noted here so a future
session doesn't re-derive this confusion).**

## 3. Existing-53-catalog ↔ production cross-reference

| Disposition | Count | Meaning |
|---|---|---|
| `existing_in_production` | 15 | Already shipped in `src/data/recipes.ts` (matches catalog's `verified_internal`/`currentGameRecipe: true`). |
| `new_candidate_not_yet_shipped` | 31 | In the catalog (`game_design_candidate` or `verification_pending`), not yet in production. |
| `deferred_candidate` | 5 | Explicitly parked for design-identity reasons (`prosciutto-e-funghi`, `romana`, `fugazzeta`, `ny-style`, `greek-style`) — not a technical-cost deferral. |
| `rejected_duplicate` | 2 | `bufalina`, `contadina` — considered and explicitly rejected as near-duplicates, kept as a record, not deleted. |
| **Total catalog entries** | **53** | 15 + 31 + 5 + 2 |

Full per-recipe disposition table: `crossReferenceExisting53VsProduction.perRecipeDisposition`
in the JSON output (53 rows).

**Ambiguous candidates carried forward, not silently resolved** (from
`TETO_RECIPE-MASTER-CATALOG.md` §6, unchanged by this audit): Marinara/pasta-sauce naming,
Genovese/ragù, Quattro Formaggi/Quattro Stagioni, Napoletana/Romana, Vegetariana/Ortolana,
prosciutto crudo/cotto, Fugazza/Fugazzeta, Diavola/Pepperoni visual closeness, ham/prosciutto-
crudo/speck, ricotta/ricotta-salata, mushroom/porcini, chili-oil/buffalo-sauce, bell-pepper
naming, Pizza Bianca/Ricotta Bianca. None of these are re-litigated by this Phase 0; they remain
open per the design doc.

## 4. Canonical ingredient set

**Canonical ingredient count in the working population: 62** (22 existing/shipped + 40 new
candidates), from `data/recipes/ingredient_master_catalog.json`. Zero orphan references (every
ingredient id every viable recipe uses resolves to a canonical entry —
`orphanIngredientReferences` in the JSON output is empty).

### 4.1 Top recipeReach (within the 51-viable population)

`recipeReach` = number of viable catalogued recipes that use this ingredient (a raw usage
count — **not** the same as marginal-unlock-on-purchase, see §5).

| Rank | Ingredient | recipeReach | Existing in game |
|---|---|---|---|
| 1 | mozzarella | 38 | yes |
| 2 | tomato-sauce | 33 | yes |
| 3 | olive-oil | 12 | yes |
| 4 | onion | 9 | yes |
| 5 | oregano | 7 | yes |
| 6 | mushroom | 6 | yes |
| 7 | ham | 5 | yes |
| 7 | sausage | 5 | yes |
| 9 | garlic | 4 | yes |
| 9 | pepperoni | 4 | yes |

Full 62-row ranking: `ingredientRecipeReach` in the JSON output.

### 4.2 Reuse tier distribution (within the working population)

| Tier | recipeReach | Count |
|---|---|---|
| high | ≥5 | 8 (mozzarella, tomato-sauce, olive-oil, onion, oregano, mushroom, ham, sausage — all 8 already shipped) |
| medium | 2–4 | 23 |
| low | =1 | 31 |

All 8 `high`-tier ingredients are already shipped, confirming (independent of this audit) that
Chapter 1/Batch 1–1B's own ingredient choices already captured the highest-reuse items in this
population. The `low`-tier 31 (half the canonical set) are, by construction, single-recipe-bound
within this dataset — expected for regionally-specific or Master-tier candidates, and exactly
the pool Issue #182 asks to place late/last.

## 5. Marginal unlock (distinct from recipeReach)

**Marginal unlock ≠ recipeReach.** `recipeReach` counts total usage across the whole
population; `marginalUnlockCount` counts only recipes that become newly fully-craftable **the
instant this one ingredient is added**, given what's already owned. A high-reach ingredient
used by many recipes that also each need several *other* still-missing ingredients can have a
**low** marginal unlock at a given state, and vice versa.

### 5.1 At the Progression 2.0 initial state (owned = tomato-sauce, mozzarella, basil)

Immediately-craftable recipes (ingredient-complete against the starting 3, **before** any
mechanic gate is applied): `margherita`, `mezza-e-mezza`, `stuffed-crust`, `ny-style`,
`greek-style`.

**This is a real Phase-0 finding, not a simulation artifact — flagged for the Draft design
doc's unlock-tree section:**

- `margherita` (basil + mozzarella + tomato-sauce) is the only one of these five that is a
  clean, unambiguous 3-ingredient match — exactly the intended "first discoverable recipe."
- `mezza-e-mezza` has an **empty** `ingredients` array in the catalog by design (it's a
  composite of two whole other recipes via the not-yet-built `halfAndHalfSplit` mechanic, not a
  fixed ingredient set) — it is **mechanic-gated** (see §6) and never actually reachable before
  that mechanic ships, regardless of what this ingredient-only check shows.
- `stuffed-crust` (`mozzarella` + `tomato-sauce` only, ingredient-wise) is also
  **mechanic-gated** (`ringPlacement`, Class C) — same caveat.
- `ny-style` and `greek-style` are both catalogued `deferred` for **naming-identity ambiguity**
  (§3/§6 of the design doc) and both resolve to the *exact same two-ingredient set*
  (`mozzarella` + `tomato-sauce`) as several other already-shipped recipes' partial subsets.
  **This is a genuine recipe-identity collision risk**: if Progression 2.0's discovery matching
  is "placed ingredients ⊇ recipe's required set" without an *exact-set* (or best-match)
  disambiguation rule, a player's very first plain cheese-and-sauce pizza would ambiguously
  satisfy `ny-style` and `greek-style` simultaneously. This is exactly why the existing catalog
  already marks both `deferred` rather than `game_design_candidate` — this audit's simulation
  reconfirms that call was correct and should stay deferred until a disambiguation answer
  exists (see the Draft doc's Unresolved Decisions).

### 5.2 Initial marginal-unlock ranking (top candidates)

| Ingredient | marginalUnlockCount (all recipes) | …baseline-mechanic-only | Unlocks |
|---|---|---|---|
| pepperoni | 2 | 1 | pepperoni, detroit-style |
| sausage | 2 | 1 | salsiccia, chicago-deep-dish |
| egg | 1 | 1 | bismarck |
| mushroom | 1 | 1 | funghi |
| nduja | 1 | 1 | calabrese |
| porcini | 1 | 1 | ai-funghi-porcini |

Full ranking (62 rows): `initialState.marginalUnlockTable` in the JSON output.

## 6. Deadlock simulation

Simulation: starting at `{tomato-sauce, mozzarella, basil}` / 0 discovered recipes, repeatedly
(a) discover every currently ingredient-complete **and** baseline-mechanic (`spread`/`scatter`
only — Phase 0 ships no new mechanic) recipe, then (b) "purchase" the single not-yet-owned
ingredient with the highest marginal-unlock count, until either the full 62-ingredient canonical
set is owned or no forward move exists (a deadlock state).

**Result: zero deadlock states.** The walk completes in 60 steps (59 purchases + the initial
state) with strictly non-increasing `stillBlockedRecipeCount` and no step where both (i) no
recipe newly discovers and (ii) the best next ingredient purchase's marginal unlock is 0 *for
every remaining ingredient* (the actual trip condition checked by the script — ties at
marginal-unlock 0 still register forward progress via mechanic-gated-but-ingredient-ready
tracking, and none of those ties ever actually stalled the walk here).

| Metric | Value |
|---|---|
| Deadlock state count | **0** |
| Unreachable ingredient count | **0** (all 62 canonical ingredients get owned by the walk's end) |
| Unreachable baseline-mechanic recipe count | **0** (all 28 baseline-only recipes get discovered) |
| Recipes reachable by ingredients but gated on a not-yet-built mechanic | **23** — correctly *not* counted as "unreachable" or "deadlocked"; they are out of Phase 0's build scope by design (Issue #182 explicitly forbids implementation here) and become reachable the moment their mechanic ships. See `deadlockSimulation.mechanicGatedRecipeIds` for the full list and `gameplay_mechanic_master.json` for each mechanic's own recipe count. |
| Final discovered (baseline-reachable) | 28 / 51 viable |

**Interpretation for the Draft doc's Unlock Tree**: the ingredient dependency graph itself has
**no structural deadlock** — every ingredient contributes to unlocking at least one recipe by
construction (recipeReach ≥ 1 for all 62), and the greedy walk never stalls. The 23
mechanic-gated recipes (`postBakeFinishing` ×15, `specialShapePan` ×4, and six 1-recipe-each
mechanics, per `gameplay_mechanic_master.json`) are a **separate, orthogonal gate** — a future
Progression 2.0 implementation phase must sequence *mechanic builds*, not just *ingredient
purchases*, to eventually reach the full population. This mirrors the existing catalog's own
Batch 1/2/3 finding (§11 of the Fresh-Analysis report) and this audit reconfirms it under the
Progression-2.0 "0 recipes at start" framing specifically.

First 10 greedy-walk steps (illustrative — full 60-step trace in the JSON output):

| Step | Ingredient purchased | Marginal unlock | Newly discovered this step |
|---|---|---|---|
| 0 | egg | 1 | margherita, ny-style |
| 1 | bacon | 1 | bismarck |
| 2 | mushroom | 1 | breakfast-pizza |
| 3 | sausage | 2 | funghi |
| 4 | nduja | 1 | salsiccia, boscaiola |
| 5 | pepperoni | 1 | calabrese |
| 6 | ham | 1 | pepperoni |
| 7 | pineapple | 1 | meat-lovers |
| 8 | porcini | 1 | hawaiian |
| 9 | anchovy | 0 | ai-funghi-porcini |

(Step *N*'s "newly discovered" reflects ingredients owned *before* step *N*'s own purchase —
i.e. the payoff of the *previous* step's purchase; `ny-style` appearing at step 0 is the same
identity-collision caveat flagged in §5.1, carried through mechanically by the simulation and
not specially suppressed, exactly so this kind of finding surfaces rather than being hidden.)

## 7. UX impact — material-selection UI for 390×844 / 360×800

**Not implemented in this Phase 0** — comparison only, per Issue #182 §7.

Current production (`IngredientTray.tsx`) already committed to a **fixed 3×2, no-scroll grid**
per category (`MAX_INGREDIENT_PALETTE_SLOTS = 6`, `src/data/ingredients.ts`), specifically
because Phase 4A-1B's iPhone Human Feel testing found scroll-vs-drag gesture conflict caused
"feels unresponsive" reports. **Any Progression 2.0 UI plan must not regress this finding** — a
100+-ingredient OWNED set cannot go back to an unbounded scroll list without re-introducing the
same conflict.

| Option | Fit for 100+ OWNED ingredients | Conflict with existing no-scroll-grid finding | Recommendation |
|---|---|---|---|
| **Category tabs (existing pattern, extended)** — sauce/cheese/topping, each internally paginated | Good — bounds each screen's ingredient count | None — this *is* the existing pattern, just needs pagination added within a category once it exceeds ~6 | **Primary building block.** Reuse `CATEGORY_TAB_ORDER`/`CATEGORY_LABEL` (`src/data/ingredients.ts`) as-is. |
| **Horizontal paging within a category** (swipe left/right through pages of 6) | Good — same gesture family as existing drag-to-place, but on a *different* axis (horizontal swipe vs. vertical drag), avoiding the original scroll-vs-drag conflict (which was a *vertical* scroll competing with vertical/free drag) | Low — needs a horizontal-swipe zone that doesn't overlap the pizza's own drag-drop target area | **Recommended for within-category overflow** once a category exceeds 6 items (topping category will, at 40+ new candidate toppings alone). |
| **Search / text filter** | Good for power users, poor for a mobile 390px keyboard-heavy flow mid-cooking | Adds a keyboard overlay that competes with the pizza-making canvas' limited vertical space | **Secondary, optional** — recommend only as an entry point from a full-screen "all ingredients" browse/Dex-adjacent view, never inline in the PREPARE tray itself. |
| **Recent / favorite shortcut row** | Good — most players repeat a handful of ingredients per session | None | **Recommended as a small persistent strip** above the category tabs, sized to not shrink the pizza's own screen share (SSOT §7 "中央のピザが常に画面最大の視覚要素" must hold). |
| **Bottom sheet / drawer (full ingredient browse, separate from the always-visible tray)** | Good for the rare "I want to browse everything" case | None — this is a *new*, opt-in overlay, not a replacement for the always-visible tray | **Recommended for a dedicated "全材料" browse mode** (e.g. reachable from the existing Shop/Inventory overlay pattern already shipped), not for the moment-to-moment PREPARE tray. |
| **Unbounded vertical scroll list (naive)** | Fits any count | **Directly regresses the Phase 4A-1B finding** | **Rejected.** |

**Recommended combined shape** (comparison only, not implemented): keep the existing
category-tab + fixed-slot-grid tray as the moment-to-moment PREPARE surface (never scroll it);
add horizontal paging within a category once it exceeds `MAX_INGREDIENT_PALETTE_SLOTS`; add a
small recent/favorite strip; push full-catalog search/browse into a separate overlay (reusing
the already-shipped Shop/Inventory overlay pattern) rather than the inline tray. This keeps
390×844 and 360×800 both viable without inventing a new interaction primitive, and does not
regress the one concrete Human-Feel finding already on record for this exact UI area.

## 8. Final Report

- **Audited `main` SHA:** `70d85b4034f3b69f8902cce5e2cf319e9bca274d` (confirmed via
  `git fetch origin main` at session start; the branch for this PR was created from this exact
  commit — `git merge-base HEAD origin/main` == this SHA).
- **PIZZA DB confirmation result and population count:** pizzadb.jp and en.wikipedia.org both
  returned `EGRESS_BLOCKED` on direct fetch attempts this session (§1.1) — **not independently
  re-verified**. The "172" figure is recorded as an owner-reported, dated (2026-09-22)
  first-hand observation (Issue #182's own body), not fetched or fabricated by this session
  (§1.2). **Working population for all graph/simulation analysis in this Phase 0: the existing
  51-viable-recipe / 62-canonical-ingredient Fresh Recipe Master Catalog** (`data/recipes/
  pizza_master_catalog.json`), not a reconstructed 172-entry set. Closing the 51→172 gap
  responsibly requires either PIZZA DB access becoming reachable, or further general-culinary-
  knowledge research passes following the exact same no-copying/no-padding discipline already
  established — this is future work, explicitly not attempted here (see §1.2, §2).
- **Existing-53 ↔ new/ambiguous/duplicate counts:** 15 `existing_in_production`, 31
  `new_candidate_not_yet_shipped`, 5 `deferred_candidate` (naming-ambiguity, not cost), 2
  `rejected_duplicate` (§3).
- **Canonical ingredient total:** 62 (22 existing/shipped + 40 new candidate) (§4).
- **Top recipeReach ingredients:** mozzarella 38, tomato-sauce 33, olive-oil 12, onion 9,
  oregano 7, mushroom 6, ham 5, sausage 5 (§4.1).
- **Recipes discoverable from the initial 3 ingredients alone:** `margherita` (clean, intended
  first discovery) plus `mezza-e-mezza`/`stuffed-crust` (both mechanic-gated, not actually
  reachable pre-mechanic) and `ny-style`/`greek-style` (both already `deferred` for
  naming-identity collision — this audit's own simulation reconfirms why) (§5.1).
- **Marginal-unlock top candidates:** `pepperoni` and `sausage` (+2 each), then `egg`/
  `mushroom`/`nduja`/`porcini` (+1 each) at the initial state (§5.2).
- **Deadlock / unreachable results:** 0 deadlock states, 0 unreachable ingredients, 0
  unreachable baseline-mechanic recipes; 23 recipes remain correctly mechanic-gated (not
  deadlocked, not unreachable — orthogonal to the ingredient graph) pending future mechanic
  builds outside this Phase 0's scope (§6).
- **Recommended Progression skeleton:** see `docs/design/TETO_RECIPE-DISCOVERY-PROGRESSION_2.0.md`
  §6 (Draft — no thresholds/prices finalized, per Issue #182's explicit prohibition).
- **PR:** created by this session, docs/data/tooling-only, **left OPEN and unmerged** per
  Issue #182's Stop/Review Gate — see the session's final report comment on Issue #182 for the
  exact URL.

## 9. Scope guard (confirmed)

- **No `src/**` file was modified.** Only read (`src/data/recipes.ts`, `src/data/ingredients.ts`)
  for the cross-reference in §2–§3.
- **No existing Progression SSOT was overwritten.** `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`
  is unchanged; this audit's own Draft (`TETO_RECIPE-DISCOVERY-PROGRESSION_2.0.md`) is a new,
  separate, explicitly-Draft document, not a replacement.
- **No unlock threshold or Pitz price is finalized anywhere in this change.** Every number in
  the Draft doc is a *candidate/comparison*, matching Issue #182's explicit prohibition.
- **No merge to `main`.** This PR is opened and left open per the Stop/Review Gate.
