# Progression 2.0 — Phase 0B.12: Comparison-Table Pages 11-12 Batch (24 rows) (Issue #182 / PR #183)

Status: **Phase 0B.12 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 121/172 to **145/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5780368657](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5780368657)
("Phase 0B.12 trigger — Fresh PIZZA DB comparison pages 11–12"), posted by the repository owner
(`perusonao`, `author_association: OWNER`). Per the trigger's own sequential-gate instruction,
this Phase started using Phase 0B.11's confirmed **121/172** as the base.

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/compare/world-pizzas/page/11/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. All 24 relayed rows remain owner-relayed, not independently fetched by this session.

## 1. Pre-ingestion cross-check: zero duplicates this Phase

Unlike Phases 0B.9–0B.11, no dish name in this batch matched any of the 121 already-evidenced
rows (checked against both the original 25 comparison-table samples and all 96
individually-tracked ledger rows). **All 24 relayed rows are genuinely new** — confirmed before
ingesting, not assumed.

## 2. Ingestion results

**24 new unique rows**, **0 corroborations**:

```
Ingested 24 new row(s), recorded 0 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 145 / 172
```

### 2.1 Pesto-family discovery/matching stress test — passed

Per the trigger's explicit instruction, 11 of this batch's rows share `sauceFamily: バジル` and
`doughStyle: ナポリピッツァ生地` (pesto-caprese, pesto-gamberi, pesto-salmone, pesto-genovese-pizza,
pesto-trapanese, pesto-tonno, pesto-noci, pesto-patate, pesto-burrata, pesto-vegetariana,
pesto-pollo). Each was verified pairwise-distinct by its own ingredient set **before** ingesting —
none collapsed solely because sauce+dough matched. All 11 ingested as separate rows. The ingest
tool's dedup logic (exact `id`/`nameJa` match only, never sauce+dough) never put these at risk of
conflation in the first place, but the manual pre-check confirms the discipline held in practice.

### 2.2 Seafood-family cross-reference — Frutti di Mare vs. Pescatore

Per the trigger's explicit instruction, reviewed side by side:

| Row | Ingredients |
|---|---|
| `frutti-di-mare-pizzadb-p11` | shrimp, squid, mussel, clam (no aromatics, no cheese) |
| `pescatore-pizzadb-p11` | mozzarella, shrimp, mussel, clam, garlic, parsley, olive-oil (no squid) |

Genuinely distinct, real Italian seafood-pizza traditions despite overlapping shrimp/mussel/clam.
Kept as two separate rows, cross-referenced to each other, not merged.

`frutti-di-mare-pizzadb-p11` is additionally a composition variant of the existing game-design
candidate `frutti-di-mare` (garlic+olive-oil+parsley+shrimp only, missing squid/mussel/clam) — the
two compositions are essentially complementary rather than overlapping. New open item added.

### 2.3 MAJOR composition conflict: `breakfast-pizza-pizzadb-p11` vs. the SHIPPED recipe

The shipped `breakfast-pizza` (nameJa ブレックファストピザ) is bacon + egg + mozzarella +
tomato-sauce. PIZZA DB's row (nameJa ブレックファーストピザ — note the differing long-vowel mark,
which is why automated exact-`nameJa` dedup correctly did **not** treat these as the same evidence
unit) instead lists egg + bacon + **sausage** (new) + **cheddar** (not mozzarella) +
**white-sauce** (not tomato-sauce) — a substantially different composition on 3 of 4 shared
dimensions. Recorded as new evidence only; the shipped recipe was **not** touched. Same severity
class as the Phase 0B.11 `fugazza`-vs-shipped conflict — new open item.

### 2.4 Composition/sauce-family conflict: `boscaiola-pizzadb-p12`

The existing `boscaiola` candidate is mozzarella + mushroom + sausage + tomato-sauce. PIZZA DB's
row uses **porcini** (a specific mushroom variety, already a registered ingredient) instead of
generic mushroom, adds olive-oil, and — most notably — tags `sauceFamily` as **チーズ (cheese)**,
not トマトソース (tomato-sauce): a sauce-family-level conflict, not just an ingredient swap.
Recorded as new evidence only, not merged. New open item.

### 2.5 Composition variant: `pesto-genovese-pizza-pizzadb-p11` vs. the SHIPPED `genovese`

The shipped `genovese` recipe is cherry-tomato + mozzarella + **pesto** (the game's own distinct
ingredient id, nameJa ジェノベーゼソース, separate from the `basil` ingredient). PIZZA DB's row
instead lists potato + pine-nuts, no cherry-tomato, and uses バジル only as its `sauceFamily` tag
(not as a "pesto" ingredient). Naming-adjacent, not merged or used to change the shipped recipe.
New open item.

### 2.6 New dough-composition sub-axis: cookie dough

`fruit-dessert-pizza-pizzadb-p11`'s explicit cookie-dough base is a **fourth** distinct
dough-composition sub-axis — alongside `cauliflower-crust`'s vegetable material (Phase 0B.8),
`pinsa-romana`'s grain blend, and `fathead-pizza-keto`'s cheese+nut-flour (both Phase 0B.11). Per
the trigger's explicit instruction, kept as a mechanic candidate, not merged into any existing
family.

### 2.7 Ingredient canonicalization: zero new table entries needed

All 49 ingredient names named across this Phase's 24 relayed rows classified deterministically
with zero `needs_review` using the **existing** tables — the second consecutive Phase (after Phase
0B.11) where the accumulated canonical set fully covered a new 24-row batch without any table
extension.

## 3. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (145
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 145/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 4. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **145 / 172** (84.3%) |
| New unique rows this Phase | 24 |
| Corroborations this Phase | 0 |
| Corroborations total (cumulative, Phase 0B.5–0B.12) | 34 |
| Rows requiring mechanic/dough identity (this Phase) | 1 (`fruit-dessert-pizza-pizzadb-p11`) |
| Rows requiring mechanic identity (cumulative) | 29 |
| Rows corresponding to an existing catalog entry (this Phase) | 4 (`frutti-di-mare`, `breakfast-pizza` [SHIPPED], `genovese` [SHIPPED], `boscaiola`) |
| Rows corresponding to an existing catalog entry (cumulative) | 15 |
| Composition conflicts vs. a SHIPPED recipe (this Phase) | 2 (`breakfast-pizza`, `genovese`) |
| New ingredient-table entries (this Phase) | 0 |
| Pending rows | 27 |

## 5. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/ambiguity/corroboration/mechanic notes.
- No merge to `main`. No recipe-composition edits (both SHIPPED-recipe conflicts are recorded as
  evidence only, not corrected).
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` (self-test),
  `progression2_recipe_row_ingest.py --check`, `progression2_evidence_invariants.py` — all run
  clean.

## 6. Final Report (Phase 0B.12)

- **Zero duplicates this Phase** — all 24 relayed rows confirmed genuinely new before ingesting.
- **24 new unique rows**, **0 corroborations** — recipe rows evidenced: 121 → **145 / 172** (84.3%).
- **Pesto-family stress test passed**: 11 same-sauce-family, same-dough rows verified
  pairwise-distinct by ingredient set and correctly kept as 11 separate rows, per the trigger's
  explicit instruction not to collapse on sauce+dough alone.
- **Frutti di Mare vs. Pescatore investigated**: two genuinely distinct seafood-pizza traditions,
  kept separate, cross-referenced.
- **2 MAJOR composition conflicts vs. SHIPPED recipes** found: `breakfast-pizza-pizzadb-p11`
  (adds sausage, swaps mozzarella→cheddar and tomato-sauce→white-sauce) and
  `pesto-genovese-pizza-pizzadb-p11` (potato+pine-nuts vs. cherry-tomato+pesto) — both recorded as
  evidence only, neither shipped recipe touched, both new open items.
- **1 further composition/sauce-family conflict**: `boscaiola-pizzadb-p12` vs. the existing
  `boscaiola` candidate (porcini not generic mushroom; cheese sauce family, not tomato) — new open
  item.
- **1 new dough-composition sub-axis** (`fruit-dessert-pizza-pizzadb-p11`'s cookie dough) — a
  fourth distinct low-carb/alternative-dough category, not merged.
- **Ingredient canonicalization**: 49 names, zero new table entries needed — second consecutive
  Phase where the existing tables fully covered a new batch.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 145/172
  coverage, 84.3%).
- **Pending**: 27 of 172 recipe rows remain with zero evidence; all prior unresolved items (Phase
  0B.3's 11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap, `bianca-pizzadb-row`'s
  three-way cluster, `speck-e-brie`'s composition variant, the Napolitana-family three-way
  cluster, `chicago-stuffed` vs. `chicago-deep-dish`, `colorado-mountain-pie`'s placeholder gap,
  `detroit-style` brick-cheese vs. mozzarella, `nutella-dessert` banana vs. strawberry,
  `bismarck`'s composition mismatch, the page-8 no-sauce finishing-mechanic design finding, the
  Fugazza/`fugazza`-shipped-recipe conflict, `pizza-romana`'s composition variant,
  `focaccia-genovese`'s catalog-scope question) still stand, plus the new items above.
- **PR #183 status**: **OPEN, unmerged.**
