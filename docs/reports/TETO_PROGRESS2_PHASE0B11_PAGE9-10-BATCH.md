# Progression 2.0 — Phase 0B.11: Comparison-Table Pages 9-10 Batch (24 rows) (Issue #182 / PR #183)

Status: **Phase 0B.11 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 100/172 to **121/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5780337054](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5780337054)
("Phase 0B.11 trigger — Fresh PIZZA DB comparison pages 9–10"), posted by the repository owner
(`perusonao`, `author_association: OWNER`). Per the trigger's own sequential-gate instruction,
this Phase started only after Phase 0B.10 was committed and handed off, using its confirmed
**100/172** counters as the base — not any earlier or assumed figure.

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/compare/world-pizzas/page/9/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. All 24 relayed rows remain owner-relayed, not independently fetched by this session.

## 1. Pre-ingestion cross-check found 3 expected duplicates

The trigger comment explicitly flagged `ピッツァ・バイアーナ`, `ピッツァビアンカ`, and
`フガゼッタ・レジェーナ` as rows with prior Fresh evidence. Each was verified by ingredient-set
equality against the existing stored evidence before accepting the match:

| Relayed row | Matched existing row | Ingredient-set check |
|---|---|---|
| `ピッツァ・バイアーナ` | `pizza-baiana` | Identical: {sausage, egg, onion, chili, mozzarella} |
| `ピッツァビアンカ` | `bianca-pizzadb-row` | Identical: {mozzarella, ricotta, olive-oil, rosemary} |
| `フガゼッタ・レジェーナ` | `fugazzeta-rellena` | Identical: {mozzarella, ham, onion, oregano} |

All 3 correctly recorded as automatic exact-nameJa-match corroborations — no suffix-mismatch cases
this Phase.

## 2. Ingestion results

**21 new unique rows**, **3 corroborations** (all automatic):

```
Ingested 21 new row(s), recorded 3 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 121 / 172
```

### 2.1 Investigated: Fugazza vs. Fugazzetta — a genuine, unresolved naming conflict

Per the trigger's explicit instruction not to collapse solely from ingredient-set equality, both
rows were checked carefully:

- `fugazza-pizzadb-p10` (フガザ): onion, mozzarella, oregano
- `fugazzetta-pizzadb-p10` (フガゼッタ): mozzarella, onion, oregano

**Identical ingredient multiset, just reordered.** Argentine culinary tradition distinguishes
"fugazza" (a cheese-less onion flatbread) from "fugazzeta" (the cheese-topped version) — but
PIZZA DB's own comparison-table data does **not** actually encode that distinction here; both rows
list cheese. Kept as two separate rows (never merge on name or ingredient-set alone), but flagged
as an **unresolved** open item requiring further evidence (e.g. individual profile pages per dish)
to properly disambiguate.

This connects to a more significant finding: `fugazza-pizzadb-p10` directly **conflicts** with the
already-**SHIPPED** production recipe `fugazza` (nameJa フガッサ: olive-oil + onion + oregano,
explicitly **no cheese**, per the traditional distinction). PIZZA DB's row lists mozzarella
instead of olive-oil — the opposite composition. Recorded as new evidence only; the shipped
recipe was **not** touched (no `src/**` or recipe-composition edits — out of this session's
scope). New open item added for a product decision.

`fugazzetta-pizzadb-p10` is separately close to the existing deferred candidate `fugazzeta`
(nameJa フガゼータ: mozzarella + olive-oil + onion + oregano) — matches 3 of 4 ingredients,
missing olive-oil. Recorded as new evidence, not used to change the existing candidate.

### 2.2 New mechanic axis: fried cooking method

`pizza-fritta-pizzadb-p9`'s explicit deep-fried (揚げ) preparation is the **first** row whose
identity depends on the cooking method itself rather than dough shape, material, or composition —
every prior mechanic-identity row assumed a baked pizza. Genuinely new axis, not merged into any
existing mechanic family.

### 2.3 Two further dough-composition sub-axes

- `pinsa-romana-pizzadb-p9`: multi-grain (wheat/rice/soy) blended, long-fermented dough.
- `fathead-pizza-keto-pizzadb-p9`: mozzarella + almond-flour keto dough (no wheat at all).

Alongside `cauliflower-crust-pizza-pizzadb-p2`'s vegetable-material substitution (Phase 0B.8),
this brings the tracked count of distinct low-carb/alternative-dough sub-categories to three —
vegetable-material, grain-blend, and cheese+nut-flour — none merged into each other.

### 2.4 New lamination/layering mechanic axis

`feteer-meshaltet-pizzadb-p10`'s explicit multi-layer folded pastry dough (層状に折り込んだ多層生地,
Egyptian) is a laminated many-layer technique (phyllo/puff-pastry-like), genuinely distinct from
the existing two-dough-sheet stuffed/enclosure mechanic (`calzone`/`fugazzeta-rellena`/
`chicago-stuffed`). New axis, not merged. This single row's own ingredient list also spans both
dessert (honey, condensed milk) and savory (ground meat) categories simultaneously — an unusual
composition flagged, not resolved or split.

### 2.5 Two product-decision / scope-fit items

- `pizza-romana-pizzadb-p9` adds mozzarella + capers to the existing `romana` candidate's plain
  3-ingredient composition — new evidence, not merged, new open item.
- `focaccia-genovese-pizzadb-p10` is a plain olive-oil/rock-salt/rosemary flatbread with **no**
  cheese or sauce topping at all — flagged as an open question on whether this qualifies as a
  "pizza" catalog entry within the game's scope, or is better modeled as a distinct bread item.
  Not decided here.

### 2.6 Ingredient canonicalization: zero new table entries needed

All 41 ingredient names named across this Phase's 24 relayed rows classified deterministically
with zero `needs_review` using the **existing** tables — no canonicalizer changes required this
Phase, a sign the accumulated canonical set now covers the large majority of real recurring
PIZZA DB ingredients.

## 3. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (121
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 121/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 4. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **121 / 172** (70.3%) |
| New unique rows this Phase | 21 |
| Corroborations this Phase | 3 (all automatic) |
| Corroborations total (cumulative, Phase 0B.5–0B.11) | 34 |
| Rows requiring mechanic/dough identity (this Phase) | 7 (`pizza-romana`, `pizza-al-taglio-romana`, `pizza-fritta`, `pinsa-romana`, `fathead-pizza-keto`, `feteer-meshaltet`, `focaccia-genovese`) |
| Rows requiring mechanic identity (cumulative) | 28 |
| Rows corresponding to an existing catalog entry (this Phase) | 4 (`romana`, `alla-norma`, `fugazza` [SHIPPED], `fugazzeta`) |
| Rows corresponding to an existing catalog entry (cumulative) | 11 |
| Naming/identity conflicts found (this Phase) | 1 unresolved (Fugazza vs. Fugazzetta) |
| Composition conflicts vs. a SHIPPED recipe (this Phase) | 1 (`fugazza`) |
| New ingredient-table entries (this Phase) | 0 |
| Pending rows | 51 |

## 5. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/ambiguity/corroboration/mechanic notes.
- No merge to `main`. No recipe-composition edits (the `fugazza` shipped-recipe conflict is
  recorded as evidence only, not corrected).
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` (self-test),
  `progression2_recipe_row_ingest.py --check`, `progression2_evidence_invariants.py` — all run
  clean.

## 6. Final Report (Phase 0B.11)

- **Sequential gate honored**: started only after Phase 0B.10's commit/handoff, using its
  confirmed 100/172 as the base, per the trigger's explicit instruction.
- **Pre-ingestion cross-check** correctly verified all 3 rows the trigger comment flagged
  (`ピッツァ・バイアーナ`, `ピッツァビアンカ`, `フガゼッタ・レジェーナ`) by ingredient-set equality
  before accepting as automatic corroborations.
- **21 new unique rows**, **3 corroborations** — recipe rows evidenced: 100 → **121 / 172** (70.3%).
- **Fugazza vs. Fugazzetta investigated and left explicitly UNRESOLVED**, per the trigger's own
  instruction not to collapse on ingredient-set equality — PIZZA DB's own table data cannot
  distinguish the two dishes here. A related, more significant finding: `fugazza-pizzadb-p10`
  directly conflicts with the SHIPPED `fugazza` recipe's cheese-less composition — new evidence
  only, nothing corrected, new open item.
- **4 new mechanic axes found this Phase**: fried cooking method, multi-grain blended dough,
  keto cheese+almond-flour dough, and laminated multi-layer pastry — none merged into any existing
  mechanic family.
- **2 new product-decision/scope items**: `pizza-romana`'s composition variant vs. the existing
  `romana` candidate; `focaccia-genovese`'s fit as a "pizza" catalog entry at all.
- **Ingredient canonicalization**: 41 names, zero new table entries needed — existing tables
  already cover this batch entirely.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 121/172
  coverage, 70.3%).
- **Pending**: 51 of 172 recipe rows remain with zero evidence; all prior unresolved items (Phase
  0B.3's 11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap, `bianca-pizzadb-row`'s
  three-way cluster, `speck-e-brie`'s composition variant, the Napolitana-family three-way
  cluster, `chicago-stuffed` vs. `chicago-deep-dish`, `colorado-mountain-pie`'s placeholder gap,
  `detroit-style` brick-cheese vs. mozzarella, `nutella-dessert` banana vs. strawberry,
  `bismarck`'s composition mismatch, the page-8 no-sauce finishing-mechanic design finding) still
  stand, plus the new items above.
- **PR #183 status**: **OPEN, unmerged.**
