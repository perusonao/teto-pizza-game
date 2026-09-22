# Progression 2.0 — Phase 0B.6: Comparison-Table Batch (12 rows) + Counter Fix (Issue #182 / PR #183)

Status: **Phase 0B.6 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 32/172 to **41/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5775538933](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5775538933)
("Phase 0B.6 — Fresh comparison-table batch (12 rows)"), posted by the repository owner
(`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)
Companion tooling: `tools/progression2_recipe_row_ingest.py` (counter-accuracy fix),
`tools/progression2_ingredient_canonicalizer.py` (1 new alias)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/compare/world-pizzas/page/4/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. All 12 relayed rows remain owner-relayed, not independently verified by this session.

## 1. Pre-ingestion cross-check found 3 expected duplicates

This batch is drawn from comparison-table **page 4** — the same page Phase 0B's *original* 25
samples partially covered. Cross-checking all 12 against the existing 25 samples before ingesting
found 3 exact `nameJa` matches:

| Relayed row | Matches |
|---|---|
| `スフィンチョーネ` | Phase 0B's `sfincione-pizzadb` (identical ingredient set: onion, anchovy, oregano, olive-oil) |
| `スプリームピザ` | Phase 0B's `supreme-pizzadb` (same dish; this batch's ingredient wording used ピーマン where the original used a bell-pepper mapping — a transcription-level detail, not a different dish) |
| `タコピザ` | Phase 0B's `taco-pizza-pizzadb` (identical ingredient set) |

All 3 correctly auto-rejected by `tools/progression2_recipe_row_ingest.py`'s existing exact
id/nameJa dedup and recorded as corroborations — exactly the "some may be corroborations from
earlier relayed samples; do not assume all 12 are new" caution the trigger comment itself raised.

## 2. Tooling fix: per-row evidenceOrigin, not array-wide assumption

Before ingesting, this Phase's rows introduced a case the counter logic hadn't accounted for:
`individualProfilePageRows` (the ledger's array, named after Phase 0B.4 when every row in it
*was* an individual-profile fetch) now also receives `comparison_table_sample`-origin rows (this
second, later comparison-table batch, distinct from Phase 0B's original 25). The
`independentlyFreshVerifiedRows`/`relayedOnlyRows` counters previously assumed every row in that
array was `individual_profile_page`-origin, which would have **overcounted** "independently
fresh verified" rows once this batch landed. Fixed to split by each row's own `evidenceOrigin`
field before ingesting — re-verified the fix didn't change any *prior* counter (all 7 pre-existing
rows are correctly still attributed to `individual_profile_page`) before applying it to real data.

## 3. Ingestion results

**9 new unique rows**, **3 corroborations** (all automatic exact-match, all re-confirming
original Phase 0B page-4 samples):

```
Ingested 9 new row(s), recorded 3 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 41 / 172
```

### 3.1 Notable rows

- **`scacciata-ragusana-pizzadb-p4`** and **`st-louis-style-pizza-pizzadb-p4`**: both carry
  explicit dough/mechanic identity evidence from the source itself (layered stacking; yeastless
  ultra-thin cracker crust) — preserved as `requiresMechanicIdentity`/`mechanicIdentityNote`
  fields, not merged into the ingredient list.
- **`speck-e-brie-pizzadb-p4`**: same name family as the existing Phase 0A catalog candidate
  `speck-e-brie` (nameJa スペック・エ・ブリー) but a **different composition**
  (prosciutto-crudo+brie+mozzarella+walnut vs. the existing candidate's
  arugula+brie+olive-oil+speck+walnut) — kept as a separate row, cross-referenced, not merged.
  New open item added to the evidence ledger.
- **`swedish-kebab-pizza-pizzadb-p4`**: contains the generic `肉` (meat, unspecified) ingredient —
  kept unresolved per Phase 0B.3's existing ambiguous-entry discipline, **not** silently mapped
  to beef/pork/chicken, per the trigger comment's own explicit instruction.
- **`st-louis-style-pizza-pizzadb-p4`**: corroborates Phase 0B.3's `プロヴェルチーズ` ambiguous
  finding (vs. `provolone`) — now seen used in a real, named regional style, reinforcing that
  Provel is a real, distinct cheese rather than a transcription variant.
- 4 rows (`spinach-artichoke-pizza`, `smore-dessert-pizza`, `thai-chicken-pizza`, and partially
  `mentaiko-cream-pizza`) use **zero or one** new ingredient — every other ingredient they need
  was already canonical from Phase 0B/0B.3's own prior work, a useful cross-check that the
  existing canonical set is already covering real recurring PIZZA DB ingredients well.

### 3.2 New ingredient-alias finding

`mentaiko-cream-pizza-pizzadb-p4`'s ingredient list includes `大葉` (ooba), the common culinary
name for shiso leaf — the same plant as Phase 0B.3's already-registered `shiso` (nameJa しそ,
the more general/botanical name). Added to `tools/progression2_ingredient_canonicalizer.py`'s
`LIKELY_ALIAS_TABLE` with justification; self-test re-verified passing (36/36 Phase 0B.1 names
still reclassify identically).

## 4. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (41
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 41/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 5. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **41 / 172** (23.8%) |
| New unique rows this Phase | 9 |
| Corroborations this Phase | 3 (all automatic exact-match) |
| Corroborations total (cumulative, Phase 0B.5+0B.6) | 6 |
| Rows requiring mechanic/dough identity (this Phase) | 2 (`scacciata-ragusana`, `st-louis-style`) |
| Rows requiring mechanic identity (cumulative) | 4 |
| Catalog-name/id conflicts found | 1 new (`speck-e-brie-pizzadb-p4`, composition variant) |
| Pending rows | 131 |

## 6. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/ambiguity/corroboration notes.
- No merge to `main`.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` — all still run
  clean.

## 7. Final Report (Phase 0B.6)

- **Pre-ingestion cross-check** correctly anticipated and confirmed 3 of 12 relayed rows as
  duplicates of Phase 0B's *original* page-4 samples, matching the trigger comment's own caution.
- **Counter-accuracy fix**: `independentlyFreshVerifiedRows`/`relayedOnlyRows` now split by each
  row's own `evidenceOrigin`, preventing overcounting now that the ledger's row array holds a mix
  of `individual_profile_page` and `comparison_table_sample` origins.
- **9 new unique rows**, **3 corroborations** — recipe rows evidenced: 32 → **41 / 172** (23.8%).
- **1 new naming/composition conflict** found (`speck-e-brie-pizzadb-p4` vs. the existing
  candidate `speck-e-brie`) — not merged, new open item.
- **1 new ingredient-alias finding** (`大葉`→`shiso`), added with justification, self-test
  re-verified.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 41/172
  coverage, 23.8%).
- **Pending**: 131 of 172 recipe rows remain with zero evidence; unresolved items from Phase
  0B.3-0B.5 (11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap, `bianca-pizzadb-row`'s
  three-way cluster) still stand, plus the new `speck-e-brie` item.
- **PR #183 status**: **OPEN, unmerged.**
