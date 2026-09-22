# PIZZA DB ja-172 Master Evidence Report (Issue #182 / PR #183)

**Regenerated in Phase 0B.18, consolidating Phase 0B through Phase 0B.18 — FULL COVERAGE REACHED.**
Docs/data-only artifact — NOT part of `src/**`, NOT a production SSOT, NOT a merge/threshold/price
decision. Companion machine-readable index:
`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json`.

**Purpose**: a single authoritative reference for everything this repo currently knows about the
owner-reported 172-entry PIZZA DB Japanese population (`ja-172`), so future Progression 2.0 design
work does not need to re-read 18 separate phase reports. This document narrates; the JSON is the
source of truth for per-row detail.

---

## 0. Coverage headline

**172 / 172 ja-172 recipe rows evidenced (100%) — FULL COVERAGE**, reached in Phase 0B.18 via bulk
ingestion of comparison-table pages 13-15. This is an **evidence-completeness milestone only** — it
is *not* a claim that a full-172 deadlock/reachability simulation has been run (see §7). `PR #183`
stays **OPEN, unmerged**. No `src/**` change at any point across all 18 phases. No production
`PIZZA_GAME_PROGRESSION_SSOT.md` overwrite. No unlock threshold or Pitz price finalized.

| Metric | Value |
|---|---|
| ja-172 rows evidenced | **172 / 172 (100%)** |
| — via comparison-table sample | 155 |
| — via dedicated individual profile-page fetch | 17 |
| Corroborations (re-confirmations of an already-evidenced row) | 51 |
| Rows requiring a mechanic/dough-identity distinction beyond ingredients | 41 |
| Rows with an explicit, preserved (not guess-filled) evidence gap | 2 |
| Rows corresponding to an existing game-design catalog entry (shipped or candidate) | 32 |
| EN-index-only candidates, not counted toward ja-172 | 0 (all 3 resolved — see §3) |
| ja-172 rows with zero evidence at all | 0 |

## 1. Phase 0B.18: bulk-processing pages 13-15 closes the gap

The Phase 0B.18 trigger relayed 28 rows sourced from `pizzadb.jp/compare/world-pizzas/` pages
13-15, obtained via the repository owner's own external web access (this Claude Code session's own
`pizzadb.jp` access was re-verified this Phase and remains `EGRESS_BLOCKED`, unchanged since
Phase 0B).

Running `tools/progression2_recipe_row_ingest.py --input` against the 28 relayed rows produced:
- **17 genuinely new unique rows**, including Japanese-side confirmation of both remaining EN-only
  candidates (Black Truffle Pizza, Hokkaido Cheese Pizza — see §3).
- **11 automatic exact-nameJa-match corroborations** of rows already evidenced in earlier
  individual-profile or comparison-table batches (manakish, margherita, lahmacun,
  pizza-de-lomo-saltado, wasabi-beef-pizza, sichuan-eggplant-pizza, yakiniku-pizza, natto-pizza,
  peking-duck-pizza, mentaiko-mochi-pizza, yuzu-shrimp-pizza).

This closed the entire remaining 17-row gap in a single pass. Confirmed via `--check`:
`uniqueRecipeRowsEvidencedTotal: 172`, `coveragePercent: 100.0`, `pendingRowCount: 0`.

Four new abbreviated (cheese-suffix-dropped) ingredient name forms were added to
`tools/progression2_ingredient_canonicalizer.py`'s `LIKELY_ALIAS_TABLE` (フェタ→feta, マヨ→mayo,
コティーハ→cotija, グラナパダーノ→grana-padano), each mapped to its existing canonical ingredient id.
Self-test re-verified: all 36 Phase 0B.1 names still reclassify identically.

### 1a. Full-population deadlock analysis — actually run, per the trigger's explicit instruction

The Phase 0B.18 trigger said: *"If coverage reaches 172/172, run full-population deadlock
analysis and report actual result."* Coverage reached 172/172 in this Phase, so a new tool,
`tools/progression2_full172_deadlock_analysis.py`, was written and run — reusing the existing
deterministic ingredient canonicalizer to resolve each row's canonical ingredient set (never
guessing an ambiguous one).

**Actual result: 0 deadlock states.** All resolvable pool rows are reachable from the
Progression 2.0 initial state (owned = tomato-sauce, mozzarella, basil) via 153 greedy
marginal-unlock purchase steps.

The resolvable pool is **151 / 172 (87.8%)**, not 172/172 — **21 rows are excluded** from this
ingredient-set-based simulation because they contain at least one ingredient name that
canonicalizes as `ambiguous` or `needs_review` (e.g. generic ひき肉/ground-meat, チーズ/generic-cheese,
ホワイトソース/white-sauce). Per the standing never-guess-fill discipline, these rows are **not**
assigned a guessed canonical ingredient — every excluded row and its exact unresolved
ingredient(s) is recorded in full in the output JSON's `excludedRowsWithAmbiguousIngredients`,
nothing silently dropped. All 21 rows still have full raw evidence; they are excluded from *this
simulation only*, not from the 172/172 evidence total.

**Mechanic-gating is not modeled** in this simulation — every pool recipe is treated as reachable
once ingredient-complete, matching `tools/progression2_phase0b_analysis.py`'s own combined-pool
simplification. So "reachable" here means "ingredient-complete," not "actually craftable with the
game's current baseline mechanics" — 41 of the 172 rows are independently known (§4) to need a
mechanic/dough/cooking-method distinction beyond their ingredient list.

The analysis also surfaced **5 exact-ingredient-set collision groups** across the full pool:
`new-england-bar-pizzadb` vs `fathead-pizza-keto-pizzadb`, `cauliflower-crust-pizzadb` vs
`pizza-al-taglio-romana-pizzadb`, `jamon-serrano-pizzadb` vs `pinsa-romana-pizzadb`,
`ny-style-pizzadb` vs `trenton-tomato-pie-pizzadb`, and the already-known `fugazza` vs
`fugazzetta` pair (§5). In every pair, at least one member is already an independently-flagged
mechanic-identity row — this **confirms, rather than contradicts**, the standing "recipe identity
needs more than an ingredient set" finding.

Full output: `docs/reports/data/TETO_PROGRESS2_PHASE0B18_full172-deadlock-analysis.json`.

**This is a genuine simulation result, not merely a permission-gate message** — but it still does
**not** constitute converting the 172 rows into formal, production-ready `game_design_candidate`
catalog entries in `data/recipes/pizza_master_catalog.json` (assigning real ids/mechanics/Pitz
prices, resolving the 14 composition conflicts and 7 naming clusters). That catalog-conversion
task remains separate and explicitly out of scope for this evidence-gathering effort.

## 2. The former 17-row gap — now closed

All 17 rows that were completely unevidenced as of Phase 0B.17 are now evidenced, sourced from
comparison-table pages 13-15 relayed in the Phase 0B.18 trigger. Per-row detail (nameJa, origin,
dough style, sauce family, ingredients, source URL) is recorded in
`docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json`'s `individualProfilePageRows`
array and consolidated in `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json`. Nothing about
these rows was invented or guessed — every field traces to the owner's relayed content.

## 3. EN-only candidates — all 3 now resolved

| Candidate | Resolution |
|---|---|
| **Lahmacun** | Resolved Phase 0B.16 — directly-fetched Japanese profile page. |
| **Black Truffle Pizza** | Resolved Phase 0B.18 — Japanese-language profile row relayed from comparison-table page 14, corresponds to existing `al-tartufo` candidate (see §5 for a composition conflict against it). |
| **Hokkaido Cheese Pizza** | Resolved Phase 0B.18 — Japanese-language profile row relayed from comparison-table page 15. |

Full resolution records: `docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json`'s
`en172UnconfirmedCandidatesPhase0B15` section (`schemaNote`: "ALL 3 of 3 RESOLVED").

## 4. Mechanic/identity families discovered across all 18 phases

Recipe identity has repeatedly proven to need more than an ingredient set. The following distinct
mechanic/identity axes have been found, each evidenced independently (never invented), and **none
have been implemented in gameplay** — every one is recorded as design/evidence only, per the
standing scope guard:

**Dough shape/pan mechanics**: square-pan/thick-crispy-bottom (Detroit/old-forge/Grandma/
St. Louis/Quad Cities family), two-dough-sheet stuffed enclosure (calzone/fugazzeta-rellena/
Chicago stuffed), layered-reverse-order deep-dish (Chicago deep-dish), quadrant placement
(quattro-stagioni), boat/canoe-shaped dough (Turkish pide), long-fermented square tray (pizza al
taglio romana).

**Dough composition/material substitutions** (four distinct sub-categories, none merged):
vegetable-material (cauliflower-crust), multi-grain blend (pinsa romana), cheese+nut-flour keto
(fathead pizza), cookie dough (fruit dessert pizza).

**Flatbread family** (four distinct sub-types, none merged): unleavened cracker-thin (piadina
romagnola), thick olive-oil-soaked (focaccia genovese), soft pita-like (manakish), ultra-thin
crispy (Lahmacun).

**Cooking-method-level mechanic**: fried, not baked (pizza fritta) — the first row whose identity
depends on the cooking method itself.

**Lamination**: multi-layer folded pastry (feteer meshaltet), distinct from the two-sheet stuffed
family.

**Timing/preparation mechanics**: pre-cook/prep before topping (yakiniku, Lomo Saltado's beef,
kimchi's drain/stir-fry), mid-bake late-topping (natto, tarako, unagi's eel), explicit post-bake
finishing (wasabi beef, Lomo Saltado's fries, S'mores' graham cracker, the existing Detroit sauce
stripe), and a possible fifth axis — "eating-preparation"/roll-to-eat serving behavior (Lahmacun) —
flagged but not confirmed as a distinct mechanic requirement.

**Additional mechanic-identity row found Phase 0B.18**: `montreal-style-pizza-pizzadb-p13` — flagged
for its own distinct dough/finishing identity, not yet categorized into one of the axes above.

**Design-level finding, not yet a confirmed mechanic**: an 8-row page-8 "no-sauce raw-topping"
Italian family (asparagi/carciofi/finocchi/cavolo/zucchine/cicoria/puntarelle/radicchio) sharing a
lemon-or-balsamic + olive-oil dressing pattern with no base sauce — a candidate for a future
finishing-mechanic, recorded as an observation only.

## 5. Unresolved composition conflicts and naming-ambiguity clusters

**Conflicts against already-SHIPPED production recipes** (highest severity — nothing corrected,
new evidence recorded only):
- `fugazza` (フガッサ: olive-oil+onion+oregano, no cheese) vs. PIZZA DB's フガザ row (mozzarella,
  no olive-oil) — the opposite composition.
- `breakfast-pizza` (bacon+egg+mozzarella+tomato-sauce) vs. PIZZA DB's ブレックファーストピザ row
  (adds sausage, swaps mozzarella→cheddar, tomato-sauce→white-sauce).
- `genovese` (cherry-tomato+mozzarella+pesto) vs. PIZZA DB's ペストジェノヴェーゼピザ row
  (potato+pine-nuts, no cherry-tomato).
- **[Phase 0B.18]** `marinara` (garlic+oregano+tomato-sauce) vs. PIZZA DB's マリナーラ row (uses
  olive-oil, not tomato-sauce as a listed ingredient).
- **[Phase 0B.18]** `meat-lovers` (bacon+ham+mozzarella+pepperoni+sausage+tomato-sauce) vs.
  PIZZA DB's ミートラバーズピザ row (adds beef, omits mozzarella).

**Composition conflicts against unshipped candidates**: `detroit-style` (brick-cheese vs.
mozzarella), `nutella-dessert` (banana+nuts vs. strawberry), `bismarck` (fuller ham+mushroom+egg
composition), `romana` (adds mozzarella+capers), `boscaiola` (porcini + cheese-sauce-family vs.
generic mushroom + tomato-sauce), `frutti-di-mare` (complementary, not overlapping, composition),
**[Phase 0B.18]** `ai-funghi-porcini` (vs. `porcini-pizza-pizzadb-p13`), **[Phase 0B.18]**
`al-tartufo` (vs. `black-truffle-pizza-pizzadb-p14`, the newly-resolved EN candidate — see §3),
**[Phase 0B.18]** `teriyaki-chicken` (vs. `teriyaki-chicken-pizza-pizzadb-p14`).

**UNRESOLVED naming/identity conflict**: Fugazza (フガザ) vs. Fugazzetta (フガゼッタ) — PIZZA DB's
own comparison-table data gives both rows the identical ingredient multiset (reordered), which
does not actually encode the traditional cheese-less-vs-cheese-topped distinction between the two
dishes. Kept as two separate rows, explicitly flagged as needing further evidence to disambiguate.

**Naming-ambiguity clusters** (never merged on name similarity alone, per this repo's standing
discipline): the Napoletana family (shipped `napoletana` / `chilean-napolitana` /
`argentine-napolitana`, 3-way), the Bianca family (shipped `pizza-bianca` / `ricotta-bianca` /
`bianca-pizzadb-row`, 3-way), the Sicilian family (`siciliana` / `sfincione-pizzadb` /
`bianca-pizzadb-row`-adjacent, 3-way), the Calabresa family (`calabresa-argentina` /
`brazilian-calabresa`, 2-way), `speck-e-brie` (existing candidate vs. a differently-composed
PIZZA DB row), Frutti di Mare vs. Pescatore (cross-referenced, kept separate), Chicago Deep-Dish
vs. Chicago Stuffed (two real, distinct styles).

**Explicit evidence gaps preserved, never guess-filled**:
- `pizza-a-caballo` — a Fainá (chickpea-flatbread) layer is mentioned in profile prose but absent
  from the published topping list.
- `colorado-mountain-pie-pizzadb-p3` — its own second listed ingredient is `お好みの具材`, the
  already-identified excluded "toppings of your choice" placeholder, not a real ingredient.

**[Phase 0B.18] Naming/ingredient-specificity gaps preserved, never guess-filled**: two dish rows
whose name implies a specific ingredient (nduja spreadable salami, boerewors sausage) but whose
source-published ingredient list only gives the generic term ソーセージ — kept generic, not
relabeled to the more specific implied ingredient, per the never-infer-beyond-source discipline.

**Source-data inconsistency preserved, not normalized**: `manakish`'s profile page header tags its
sauceFamily as オイル (oil) while the same page's own Q&A prose says ノンソース (no sauce) — PIZZA
DB's own internal contradiction, recorded as-is.

**Ambiguous ingredients still needing a product decision** (11 entries first flagged in Phase
0B.3, unresolved since): generic ground meat vs. taco-specific ground-beef, generic cheese, generic
meat, generic nuts, cheese-sauce (a sauce, not a topping), white-sauce vs. the specific
fromage-blanc-sauce, spicy-sausage vs. plain sausage, generic curry-sauce vs. the specific
curry-ketchup, green/red chili variants, and Provel cheese vs. provolone (a real, distinct St.
Louis cheese, commonly confused by name).

## 6. Population-tracking discipline (ja-172 vs. en-index)

Maintained without exception across all 18 phases: `ja-172` (the Japanese-language canonical
population) and PIZZA DB's English-language translated index are tracked as **separate**
populations. The English index's own size grew from 160 (Phase 0B/0B.1) to 172 (Phase 0B.15) —
recorded as a genuine size-history fact — but **size parity was never treated as membership
proof**. Every row counted toward the now-complete 172/172 ja-172 total traces to either a
Japanese-language comparison-table sample or a directly-fetched Japanese-language profile page;
EN-sourced matches are recorded as corroborations only and never increment coverage. Enforced
continuously by `tools/progression2_evidence_invariants.py`'s `population_tag_no_en160_leak`
check, which has passed on every single re-run across all 18 phases.

## 7. Implications for Progression 2.0 design (not decided here)

- **The full-population deadlock analysis was actually run (§1a) — result: 0 deadlocks.** Reaching
  172/172 flipped `tools/progression2_evidence_invariants.py`'s
  `full_deadlock_blocked_unless_172_covered` check from BLOCKED to a permission message, and per
  the trigger's explicit instruction the simulation itself was then run over the 151/172 rows
  resolvable into a deterministic canonical-ingredient set (21 rows excluded, never guessed — see
  §1a). Every resolvable row is reachable from the initial state; zero deadlock states. This is a
  genuine, reported result — not just a gate-satisfied signal. What this analysis does **not** do:
  resolve the 11 ambiguous ingredients, the 14 composition conflicts (5 against shipped recipes, 9
  against unshipped candidates), the 7 naming-ambiguity clusters (§5), or assign mechanic tags to
  the 41 rows needing one — converting all 172 rows into formal, production-ready
  `game_design_candidate` entries in `data/recipes/pizza_master_catalog.json` with those decisions
  made is a substantial **new design task, explicitly out of scope** for this evidence-gathering
  effort. **That conversion remains the clear recommended next milestone.**
- **Recipe identity needs more than an ingredient set.** 41 of 172 evidenced rows (24%) require a
  mechanic/dough/cooking-method distinction beyond their topping list — this is now a
  well-evidenced, recurring pattern (design draft §10's original finding, reinforced independently
  many times over across the full population), not a one-off.
- **At least 9 distinct new mechanic/identity axes** were found beyond the game's existing
  baseline mechanics (fold/stuff, quadrant, layered-reverse, square-pan) — 4 dough-composition
  variants, 4 flatbread variants, plus fried-cooking-method, lamination, boat-shape, and several
  timing-based (pre-cook/late-topping/post-bake) mechanics. None implemented; all flagged as
  future design candidates only.
- **14 composition conflicts** (5 against shipped recipes, 9 against unshipped candidates) are
  accumulated, unresolved product decisions — each represents a case where PIZZA DB's own
  published data diverges from this repo's existing catalog, and picking a side (or keeping both
  as distinct dishes) is an explicit product call, not something this session should decide
  unilaterally.
- **7 naming-ambiguity clusters** (2-way to 3-way) are tracked, all deliberately kept as separate
  candidate ids per this repo's never-merge-on-name-alone discipline — future design work
  disambiguating any of them should start from this report's §5, not re-derive the finding.
- **0/172 rows remain unevidenced** — the evidence-gathering phase of this effort is complete.
  Further progress now depends on a deliberate design-conversion decision, not on the repository
  owner relaying more raw PIZZA DB content.

## 8. Validators — all clean

```
$ python3 tools/validate_recipe_catalog.py
Checked 53 recipe entries, 62 ingredient entries, 11 mechanic entries.
All checks passed.

$ python3 tools/progression2_phase0_analysis.py
Viable population: 51 recipes, 62 canonical ingredients
Deadlock state count: 0

$ python3 tools/progression2_phase0b_analysis.py
PARTIAL-POOL analysis, not a full-172 result.

$ python3 tools/progression2_ingredient_canonicalizer.py
PASS: all 36 Phase 0B.1 names reclassify identically.

$ python3 tools/progression2_recipe_row_ingest.py --check
OK: stored counters match a fresh recomputation. 172/172 (100.0%).

$ python3 tools/progression2_evidence_invariants.py
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: all 172 recipe rows have evidence -- a full-population deadlock simulation may now be run
All 4 invariants passed.
```

**Plus, new this Phase, per the trigger's explicit "run it and report actual result" instruction**:

```
$ python3 tools/progression2_full172_deadlock_analysis.py
Pool: 151/172 resolvable, 21 excluded (ambiguous ingredient)
Exact-ingredient-set collision groups: 5
Deadlock state count: 0
Unreachable recipe count (ingredient-completeness only): 0 / 151
```

## 9. Scope guard (confirmed, same as every prior Phase)

- `src/**`: not modified, at any point across all 18 phases.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/mechanic/conflict/population-discipline notes, across all 18 phases.
- No merge to `main`.
- No gameplay mechanic implemented from any evidence finding.
- No ja-172 gap ever filled by invented, guessed, or EN-only-sourced content.
- Reaching 172/172 evidence coverage is explicitly **not** treated as having run a full deadlock
  simulation — see §7.

**PR #183 status: OPEN, unmerged.**
