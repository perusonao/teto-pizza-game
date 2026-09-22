# Progression 2.0 — Phase 0B.8: Comparison-Table Pages 2-3 Batch (17 rows) (Issue #182 / PR #183)

Status: **Phase 0B.8 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 48/172 to **63/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5776088566](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5776088566)
("Phase 0B.8 — Fresh recipe batch from comparison pages 2-3"), posted by the repository owner
(`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/compare/world-pizzas/page/2/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. All 17 relayed rows remain owner-relayed, not independently verified by this session.

## 1. Pre-ingestion cross-check found 9 expected duplicates — including 7 suffix-hidden ones

This batch spans comparison-table **pages 2 and 3**, overlapping several dishes already evidenced
under this session's own earlier `（PIZZA DB版）`-suffixed `nameJa` convention (used in Phase 0B
to disambiguate PIZZA DB rows from same-named existing catalog candidates). That suffix convention
means the automated exact-`nameJa`-match dedup in `tools/progression2_recipe_row_ingest.py`
**cannot** catch a newly-relayed row using the dish's plain (unsuffixed) name, even when the
ingredient set matches exactly — a bug class first discovered in Phase 0B.5.

Following that lesson, every potentially-overlapping row in this batch was **proactively
cross-checked by ingredient set before ingesting** (fetching each candidate's stored `nameJa` and
ingredients directly via a Bash/Python snippet, not assumed):

| Relayed row | Matched existing row | Detection |
|---|---|---|
| `カリーヴルストピザ` | `currywurst-pizza-pizzadb-p2` (identical, no suffix used) | automatic exact match |
| `グランマピザ` | `grandma-pizza-pizzadb-p3` (identical, no suffix used) | automatic exact match |
| `カプリチョーザ` | `capricciosa-pizzadb` (suffix `（PIZZA DB版）` hid it) | **manual review** |
| `カルツォーネ` | `calzone-pizzadb` (suffix hid it) | **manual review** |
| `クアトロスタジオーニ` | `quattro-stagioni-pizzadb` (suffix hid it) | **manual review** |
| `クアトロフォルマッジ` | `quattro-formaggi-pizzadb` (suffix hid it) | **manual review** |
| `グリークスタイルピザ` | `greek-style-pizzadb` (suffix hid it) | **manual review** |
| `シカゴディープディッシュ` | `chicago-deep-dish-pizzadb` (suffix hid it — **3rd** corroboration) | **manual review** |
| `シチリアンピザ` | `siciliana-pizzadb` (suffix hid it) | **manual review** |

All 9 correctly recorded as corroborations — new source URL, note, and `matchType` each — and
**not** double-counted toward unique rows. This is the largest single-Phase manual-corroboration
catch so far, and directly validates the Phase 0B.5-derived discipline of never trusting automatic
exact-match dedup alone when a session's own naming conventions could mask a duplicate.

## 2. Ingestion results

**15 new unique rows**, **9 corroborations** (2 automatic, 7 manual):

```
Ingested 15 new row(s), recorded 9 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 63 / 172
```

### 2.1 New identity axis: dough MATERIAL, not just shape/mechanic

`cauliflower-crust-pizza-pizzadb-p2` (カリフラワークラストピザ) introduces a genuinely **new**
identity axis not seen in any prior Phase: the crust's base **material** (cauliflower) rather than
its shape or layering mechanic. Every prior `requiresMechanicIdentity` row (Chicago/Detroit/
Sicilian/old-forge/scacciata-ragusana/st-louis-style/quad-cities) varied by pan shape, stacking, or
crust thickness — never by what the dough itself is made of. Recorded as
`requiresMechanicIdentity` with a note distinguishing this new axis; not merged into any existing
mechanic family.

### 2.2 New naming-ambiguity / product-decision item: Chicago deep-dish vs. Chicago stuffed

`chicago-stuffed-pizza-pizzadb-p3` (シカゴスタッフドピザ) has a near-identical ingredient set to
the existing `chicago-deep-dish-pizzadb` candidate (mozzarella, sausage, pepperoni, tomato-sauce)
but is a real, distinct Chicago pizza style — stuffed pizza uses a **double crust** with a top
dough layer sealing the filling before the sauce is added on top, whereas deep-dish is a single
thick crust with sauce on top of the cheese/toppings. Kept as a **separate row, not merged** — new
open item added asking the repo owner for a product decision on whether both ship as distinct
catalog entries.

### 2.3 New evidence gap: `colorado-mountain-pie-pizzadb-p3`'s placeholder ingredient

The relayed row's own ingredient list includes `お好みの具材` — the already-identified
**EXCLUDED non-ingredient placeholder** (Phase 0B.3, literally "toppings of your choice") — as its
second listed item. This dish's real topping set is therefore genuinely unspecified by the source
itself, not merely unresolved by this session. Preserved as an explicit `evidenceGaps` entry
rather than guess-filled with an invented topping; new open item added asking the repo owner to
confirm or correct the source's own listing.

### 2.4 Manual corroborations added new detail, not just re-confirmation

Two of the 7 manual corroborations carried genuinely new information beyond a bare
re-confirmation:

- `greek-style-pizzadb`: new origin/dough detail — "アメリカ／ニューイングランド" /
  "オリーブオイルを多く使う、ふんわりとした鍋焼き生地" — identifying this specifically as the
  American "New England Greek pizza" pan-dough style, relevant context for the still-open
  greek-style un-defer decision carried since Phase 0A/0B.
- `siciliana-pizzadb`: new dough-shape detail — "厚みのある四角い生地（スポンジのような食感）"
  (thick square, sponge-like texture) — reinforcing the existing three-way Sicilian-style naming
  ambiguity (`siciliana` / this row / `sfincione-pizzadb`) with a concrete dough-shape signal for a
  future disambiguation pass.

Both were folded into the corroboration record's `note` field rather than discarded.

## 3. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (63
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 63/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 4. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **63 / 172** (36.6%) |
| New unique rows this Phase | 15 |
| Corroborations this Phase | 9 (2 automatic, 7 manual) |
| Corroborations total (cumulative, Phase 0B.5–0B.8) | 20 |
| Rows requiring mechanic/dough identity (this Phase) | 4 (`cauliflower-crust`, `quad-cities-style`, `colorado-mountain-pie`, `chicago-stuffed`) |
| Rows requiring mechanic identity (cumulative) | 9 |
| Rows with an explicit evidence gap (this Phase) | 1 (`colorado-mountain-pie-pizzadb-p3`) |
| Catalog-name/id conflicts found | 1 new (`chicago-stuffed-pizza-pizzadb-p3` vs. `chicago-deep-dish-pizzadb`) |
| Pending rows | 109 |

## 5. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/ambiguity/corroboration notes.
- No merge to `main`.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py`,
  `progression2_recipe_row_ingest.py --check`, `progression2_evidence_invariants.py` — all run
  clean.

## 6. Final Report (Phase 0B.8)

- **Pre-ingestion cross-check** proactively caught 9 of 17 relayed rows as duplicates — 2 via
  automatic exact-match, and **7 via manual ingredient-set review** that would otherwise have
  slipped past automation due to this session's own earlier `（PIZZA DB版）` suffix convention.
  This is the largest manual-corroboration catch of the Phase 0B sequence so far.
- **15 new unique rows**, **9 corroborations** — recipe rows evidenced: 48 → **63 / 172** (36.6%).
- **1 new identity axis** found (`cauliflower-crust-pizza-pizzadb-p2` — dough *material*, not
  shape/mechanic) — a genuinely new category, not merged into any existing mechanic family.
- **1 new naming-ambiguity/product-decision item** (`chicago-stuffed-pizza-pizzadb-p3` vs.
  `chicago-deep-dish-pizzadb`) — near-identical ingredients, real distinct styles, not merged.
- **1 new evidence gap** (`colorado-mountain-pie-pizzadb-p3`'s second ingredient is the excluded
  `お好みの具材` placeholder) — preserved, not guess-filled.
- **2 manual corroborations carried new detail** beyond re-confirmation (`greek-style-pizzadb`'s
  New England origin/dough detail; `siciliana-pizzadb`'s dough-shape detail reinforcing its
  existing three-way naming cluster).
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 63/172
  coverage, 36.6%).
- **Pending**: 109 of 172 recipe rows remain with zero evidence; all prior unresolved items
  (Phase 0B.3's 11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap,
  `bianca-pizzadb-row`'s three-way cluster, `speck-e-brie`'s composition variant, the
  Napolitana-family three-way cluster) still stand, plus the two new items above.
- **PR #183 status**: **OPEN, unmerged.**
