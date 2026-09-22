# Progression 2.0 — Phase 0B.14: Rare-Ingredient Profile Recovery Batch (Issue #182 / PR #183)

Status: **Phase 0B.14 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 152/172 to **153/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5781018604](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5781018604)
("Phase 0B.14 trigger — Fresh rare-ingredient profile recovery"), posted by the repository owner
(`perusonao`, `author_association: OWNER`). Started from Phase 0B.13's confirmed **152/172**,
commit `ba61264`.

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/pizzas/tarako-cream/` re-attempted: **`EGRESS_BLOCKED`**, unchanged.
All 5 relayed rows remain owner-relayed, not independently fetched by this session.

## 1. Pre-ingestion cross-check found 4 of 5 rows were deep-profile corroborations

The trigger comment explicitly warned that some of these names likely appeared in earlier
comparison-page batches ("notably Thai Chicken / S'mores"). Cross-checking all 5 against the
existing 152 rows found **4 exact matches**, each independently verified by ingredient-set
equality before accepting:

| Relayed row | Matched existing row | Ingredient-set check |
|---|---|---|
| `たらこクリームピザ` | `mentaiko-cream-pizza-pizzadb-p4` | Identical: {cod-roe, fresh-cream-sauce, mozzarella, nori, shiso} |
| `キムチピザ` | `kimchi-pizza-pizzadb-p2` | Identical: {kimchi, pork, mozzarella, green-onion} |
| `タイチキンピザ` | `thai-chicken-pizza-pizzadb-p4` | Identical: {chicken, peanut-sauce, cilantro, mozzarella, red-chili} |
| `スモアデザートピザ` | `smore-dessert-pizza-pizzadb-p4` | Identical: {marshmallow, chocolate, graham-cracker} |

All 4 correctly recorded as automatic exact-`nameJa`-match corroborations — the trigger's own
anticipation of duplicate risk was confirmed across a wider set than named (all 4 of 5, not just
Thai Chicken/S'mores). Only `焼肉ピザ` (Yakiniku pizza) is genuinely new.

## 2. Ingestion results

**1 new unique row**, **4 corroborations** (all automatic):

```
Ingested 1 new row(s), recorded 4 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 153 / 172
```

`individual_profile_page`-origin rows now total **15** (was 14).

### 2.1 New timing/mechanic details captured on the 4 corroborated rows

Rather than discard the deeper profile evidence on already-evidenced rows, each corroboration's
new detail was folded into its corroboration note:

- **`たらこクリームピザ`**: tarako added in the final few minutes — late-topping/timing, same class
  as Phase 0B.13's `natto-pizza`/`unagi-pizza` findings.
- **`キムチピザ`**: kimchi drained/lightly stir-fried before topping — a pre-cook/prep evidence
  candidate, recorded as evidence only per the trigger's explicit instruction not to prematurely
  create a mechanic from it.
- **`タイチキンピザ`**: peanut sauce spread before baking — a base-sauce application detail,
  consistent with its existing sauceFamily.
- **`スモアデザートピザ`**: **two** distinct timings on one dish — marshmallow added just before
  baking, crushed graham cracker added as a post-bake finish — the most granular
  timing+post-bake-finishing finding yet.

### 2.2 New pre-cook/prep mechanic-evidence category: Yakiniku Pizza

`yakiniku-pizza`'s profile states the beef is lightly seasoned and stir-fried **before** topping —
a genuinely new pre-cook/prep evidence category, distinct from both the late-topping (during bake)
and post-bake-finishing (after bake) families already tracked, since this preparation happens
before the bake even starts. Recorded as evidence only, per the trigger's explicit instruction not
to prematurely expand gameplay from a single data point — same treatment given to `キムチピザ`'s
kimchi-prep finding this Phase.

### 2.3 Ingredient canonicalization: zero new table entries needed

All 5 ingredient names in `yakiniku-pizza` (beef, yakiniku-sauce, onion, mozzarella, white-sesame)
classified deterministically with zero `needs_review` using the **existing** tables — fourth
consecutive Phase (after 0B.11, 0B.12, 0B.13) where the accumulated canonical set fully covered a
new batch without any table extension.

## 3. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (153
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 153/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 4. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **153 / 172** (89.0%) |
| New unique rows this Phase | 1 |
| Corroborations this Phase | 4 (all automatic) |
| Corroborations total (cumulative, Phase 0B.5–0B.14) | 39 |
| `individual_profile_page`-origin rows (cumulative) | 15 (was 14) |
| Rows requiring mechanic/dough identity (this Phase) | 1 (`yakiniku-pizza`) |
| Rows requiring mechanic identity (cumulative) | 33 |
| New pre-cook/prep mechanic-evidence findings (this Phase) | 2 (`yakiniku-pizza`, `キムチピザ` corroboration) |
| New timing/finishing mechanic details on corroborations (this Phase) | 3 |
| New ingredient-table entries (this Phase) | 0 |
| Pending rows | 19 |

## 5. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/mechanic notes.
- No merge to `main`. No gameplay mechanic implemented from any single-source pre-cook/prep or
  timing finding.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` (self-test),
  `progression2_recipe_row_ingest.py --check`, `progression2_evidence_invariants.py` — all run
  clean.

## 6. Final Report (Phase 0B.14)

- **Duplicate-risk anticipation confirmed and exceeded**: the trigger flagged Thai Chicken/S'mores
  as likely duplicates; cross-checking found 4 of 5 relayed rows were deep-profile corroborations
  of already-evidenced dishes (also including Tarako Cream and Kimchi), each independently
  verified by exact ingredient-set match before accepting.
- **1 new unique row**, **4 corroborations** — recipe rows evidenced: 152 → **153 / 172** (89.0%).
- **3 new timing/mechanic details** captured on the corroborated rows rather than discarded,
  including the most granular finding yet (S'mores' two separate marshmallow/graham-cracker
  timings on one dish).
- **1 new pre-cook/prep mechanic-evidence category**: `yakiniku-pizza`'s beef is stir-fried before
  topping — a genuinely new evidence class (before-bake preparation), recorded as evidence only.
- **Ingredient canonicalization**: 5 names, zero new table entries needed — fourth consecutive
  Phase the existing tables fully covered a new batch.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 153/172
  coverage, 89.0%).
- **Pending**: 19 of 172 recipe rows remain with zero evidence; all prior unresolved items (Phase
  0B.3's 11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap, `bianca-pizzadb-row`'s
  three-way cluster, `speck-e-brie`'s composition variant, the Napolitana-family three-way
  cluster, `chicago-stuffed` vs. `chicago-deep-dish`, `colorado-mountain-pie`'s placeholder gap,
  `detroit-style` brick-cheese vs. mozzarella, `nutella-dessert` banana vs. strawberry,
  `bismarck`'s composition mismatch, the page-8 no-sauce finishing-mechanic design finding, the
  Fugazza/`fugazza`-shipped-recipe conflict, `pizza-romana`'s composition variant,
  `focaccia-genovese`'s catalog-scope question, `breakfast-pizza`/`genovese` shipped-recipe
  conflicts, `boscaiola`'s composition mismatch, `manakish`'s sauceFamily inconsistency) still
  stand.
- **PR #183 status**: **OPEN, unmerged.**
