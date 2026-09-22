# Progression 2.0 — Phase 0B.7: Page-1 Comparison-Table Batch (12 rows) (Issue #182 / PR #183)

Status: **Phase 0B.7 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 41/172 to **48/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5775887099](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5775887099)
("Phase 0B.7 — Fresh recipe batch from comparison page 1"), posted by the repository owner
(`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/compare/world-pizzas/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. All 12 relayed rows remain owner-relayed, not independently verified by this session.

## 1. Pre-ingestion cross-check found 5 expected duplicates

This batch is drawn from comparison-table **page 1** — the same page Phase 0B's *original* 25
samples partially covered. Cross-checking all 12 against the existing 25 samples before ingesting
found 5 exact `nameJa` matches, verified against the stored `nameJa`/ingredient data directly
(not assumed):

| Relayed row | Matches |
|---|---|
| `BBQチキンピザ` | `bbq-chicken-pizzadb` (identical ingredient set) |
| `アップルシナモンデザートピザ` | `apple-cinnamon-dessert-pizzadb` (identical ingredient set) |
| `アルゼンチン風カラブレーサ` | `calabresa-argentina-pizzadb` — **corroborated a second time** (also corroborated once already in Phase 0B.5) |
| `ヴォンゴレピザ` | `vongole-pizzadb` (identical ingredient set) |
| `オージーピザ` | `aussie-pizzadb` (identical ingredient set) |

All 5 correctly auto-rejected and recorded as corroborations — exactly matching the trigger
comment's own cross-check note that `アルゼンチン風カラブレーサ` was already independently
Fresh-verified earlier.

## 2. Ingestion results

**7 new unique rows**, **5 corroborations**:

```
Ingested 7 new row(s), recorded 5 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 48 / 172
```

### 2.1 Strong ingredient-corroboration signal

**6 of the 7 new rows needed zero new ingredient ids** — every ingredient they use was already
canonical from Phase 0B/0B.3/0B.6's own prior work:

- `いくらとサーモンのピザ`: salmon-roe, salmon (Phase 0B.3), cream-cheese (Phase 0B), 大葉→shiso
  (Phase 0B.6 alias)
- `ヴィーガンカシューチーズピザ`: cashew-cheese (Phase 0B.3), zucchini (Phase 0A), bell-pepper/
  パプリカ (existing exact)
- `うなぎピザ`: eel, sansho-pepper, green-onion (all Phase 0B.3)
- `エルサレムミックスグリルピザ`: corroborates 鶏肉→chicken (Phase 0B.6 likely_alias) in a real
  named dish; cumin (Phase 0B.3), parsley (existing)
- `お好み焼き風ピザ`: cabbage, pork, okonomiyaki-sauce, aonori/青のり (all Phase 0B.3),
  mayo/bonito-flakes (existing) — **6 ingredients, all already canonical**, the strongest single-row
  corroboration density so far this Phase 0B sequence

This is a useful signal: the canonical ingredient set accumulated across Phase 0B.1–0B.6 is
already covering a large share of real, recurring PIZZA DB ingredients — new rows are
increasingly adding *recipe* coverage without needing proportionally as many new *ingredient*
ids.

### 2.2 New naming-ambiguity cluster: a third "Napolitana"

`argentine-napolitana-pizzadb-p1` (アルゼンチン風ナポリターナ: mozzarella + fresh-tomato +
garlic + oregano + parmigiano, cheese-family sauce) is a **third**, distinctly-composed member of
the existing Napoletana-family naming cluster:

| Entry | Ingredients | Status |
|---|---|---|
| `napoletana` | anchovy + mozzarella + oregano + tomato-sauce | **Shipped** |
| `chilean-napolitana-pizzadb` (Phase 0B) | fresh-tomato + mozzarella + oregano | Existing candidate, cheese-family sauce, no anchovy |
| `argentine-napolitana-pizzadb-p1` (this Phase) | mozzarella + fresh-tomato + garlic + oregano + parmigiano | New — adds garlic + parmigiano, no anchovy |

All three real, differently-composed regional dishes sharing a name family — kept as three
distinct ids, **none merged**, extending the naming-ambiguity ledger's existing
Napoletana/Romana-pattern discipline to a genuine three-way case. New open item added.

### 2.3 `old-forge-style-pizza-pizzadb-p1` — mechanic identity + generic ingredient

Carries explicit shape/dough identity evidence from the source (square sheet-pan bake,
medium-thick — akin to the existing `specialShapePan` mechanic family already used for
Chicago/Detroit/Sicilian-style entries). Its ingredient list also includes the generic `チーズ`
(cheese, unspecified variety) term — kept unresolved per the existing ambiguous-entry discipline
(Phase 0B.3), **not** silently mapped to mozzarella or any specific cheese, per the trigger
comment's own explicit instruction.

## 3. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (48
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 48/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 4. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **48 / 172** (27.9%) |
| New unique rows this Phase | 7 |
| Corroborations this Phase | 5 (all automatic exact-match) |
| Corroborations total (cumulative, Phase 0B.5–0B.7) | 11 |
| Rows requiring mechanic/dough identity (this Phase) | 1 (`old-forge-style-pizza-pizzadb-p1`) |
| Rows requiring mechanic identity (cumulative) | 5 |
| Catalog-name/id conflicts found | 1 new (`argentine-napolitana-pizzadb-p1`, three-way cluster) |
| Pending rows | 124 |

## 5. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/ambiguity/corroboration notes.
- No merge to `main`.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` — all still run
  clean.

## 6. Final Report (Phase 0B.7)

- **Pre-ingestion cross-check** correctly anticipated and confirmed 5 of 12 relayed rows as
  duplicates of Phase 0B's *original* page-1 samples, exactly matching the trigger comment's own
  cross-check note.
- **7 new unique rows**, **5 corroborations** — recipe rows evidenced: 41 → **48 / 172** (27.9%).
- **6 of 7 new rows needed zero new ingredient ids** — strong evidence the accumulated canonical
  ingredient set already covers a large share of real recurring PIZZA DB ingredients.
- **1 new naming-ambiguity cluster** found (`argentine-napolitana-pizzadb-p1`, a third distinctly-
  composed "Napolitana"-family dish) — none merged, new open item.
- **1 new mechanic-identity row** (`old-forge-style-pizza-pizzadb-p1`, square-pan shape) plus a
  generic-`チーズ` ingredient correctly kept unresolved.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 48/172
  coverage, 27.9%).
- **Pending**: 124 of 172 recipe rows remain with zero evidence; all prior unresolved items
  (Phase 0B.3's 11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap,
  `bianca-pizzadb-row`'s three-way cluster, `speck-e-brie`'s composition variant) still stand,
  plus the new Napolitana-family item.
- **PR #183 status**: **OPEN, unmerged.**
