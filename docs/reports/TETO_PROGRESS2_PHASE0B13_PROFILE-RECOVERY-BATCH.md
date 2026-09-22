# Progression 2.0 — Phase 0B.13: Individual-Profile Recovery Batch (Pages 13-15 Gap) (Issue #182 / PR #183)

Status: **Phase 0B.13 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 145/172 to **152/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5780920500](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5780920500)
("Phase 0B.13 trigger — Fresh individual-profile recovery batch (pages 13–15 gap)"), posted by the
repository owner (`perusonao`, `author_association: OWNER`). Comparison-table pages 13-15 remain
inaccessible even to the owner's own relaying process; this Phase instead recovered evidence via
ingredient-tag pages → individual pizza profiles. Started from Phase 0B.12's confirmed **145/172**.

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/pizzas/unagi-pizza/` re-attempted: **`EGRESS_BLOCKED`**, unchanged.
All 8 relayed rows remain owner-relayed, not independently fetched by this session.

## 1. Pre-ingestion cross-check found 1 expected duplicate

Cross-checked all 8 relayed dish names against all 145 already-evidenced rows before ingesting.
`うなぎピザ` exactly matches the already-evidenced `eel-pizza-pizzadb-p1` (from Phase 0B.7) — both
by `nameJa` and by ingredient set:

| Field | Existing (Phase 0B.7) | This Phase's relay |
|---|---|---|
| Ingredients | うなぎ, 山椒, モッツァレラチーズ, 青ねぎ | うなぎ, 山椒, モッツァレラチーズ, 青ねぎ |
| Origin / dough / sauce | 日本/各地, 薄め, 甘辛だれ | 日本/各地, 薄めの生地, 甘辛だれ |

Identical. Correctly recorded as an automatic exact-`nameJa`-match corroboration, not double-counted.
The other 7 relayed dishes are genuinely new — confirmed, not assumed.

## 2. Ingestion results

**7 new unique rows**, **1 corroboration** (automatic):

```
Ingested 7 new row(s), recorded 1 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 152 / 172
```

`individual_profile_page`-origin rows now total **14** (was 7) — this Phase doubled the session's
deepest-evidence-tier coverage, since every row this Phase came from a dedicated per-dish profile
fetch rather than an aggregate comparison-table scrape.

### 2.1 Three late/post-bake topping mechanic findings

Reinforcing the existing `postBakeFinishing` mechanic family with three independently-sourced
examples:

- **`natto-pizza`**: profile text states natto is added a few minutes *before* the bake finishes
  (mid-bake timing) — distinct from a fully-post-bake addition, a new timing sub-category.
- **`wasabi-beef-pizza`**: profile text **explicitly** states wasabi is added *after* the bake
  finishes (焼き上がり後に添える) — the cleanest single-source confirmation of this mechanic
  family yet.
- **`eel-pizza-pizzadb-p1`** (this Phase's corroboration): the re-fetched profile carried a new
  detail — eel is also added at finishing — folded into the corroboration note rather than
  discarded.

All three recorded as evidence/notes only; no mechanic implemented or changed.

### 2.2 New flatbread-family mechanic axis: Manakish

`manakish`'s explicit soft, pita-like flatbread dough is a **third** distinct flatbread-family
dough, alongside `piadina-romagnola`'s unleavened cracker-thin flatbread (Phase 0B.10) and
`focaccia-genovese`'s thick olive-oil flatbread (Phase 0B.11) — distinct from both, not merged
into either.

### 2.3 Source-data inconsistency preserved, not normalized: Manakish's sauceFamily

PIZZA DB's own profile page header tags `manakish`'s sauce family as **オイル** (oil) while the
same page's own Q&A prose describes it as **ノンソース** (no sauce) — a genuine internal
contradiction in the source data itself, not something this session introduced or should resolve.
Recorded using the header's オイル value, per the trigger comment's explicit instruction, with the
contradiction itself flagged as a new open item rather than silently normalized in either
direction.

### 2.4 Ingredient canonicalization: zero new table entries needed

All 24 ingredient names named across this Phase's 8 relayed rows classified deterministically with
zero `needs_review` using the **existing** tables (natto, peking-duck, sweet-bean-sauce, mentaiko,
mochi, zaatar, halloumi, yuzu-kosho, wasabi, soy-sauce, doubanjiang — all previously-registered
`genuinely_new` ids; plus 大葉→shiso `likely_alias` and 海苔 exact via the existing
`ORTHOGRAPHIC_EQUIVALENTS` entry). Third consecutive Phase (after 0B.11, 0B.12) where the
accumulated canonical set fully covered a new batch without any table extension.

## 3. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (152
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 152/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 4. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **152 / 172** (88.4%) |
| New unique rows this Phase | 7 |
| Corroborations this Phase | 1 (automatic) |
| Corroborations total (cumulative, Phase 0B.5–0B.13) | 35 |
| `individual_profile_page`-origin rows (cumulative) | 14 (was 7) |
| Rows requiring mechanic/dough identity (this Phase) | 3 (`natto-pizza`, `manakish`, `wasabi-beef-pizza`) |
| Rows requiring mechanic identity (cumulative) | 32 |
| Source-data inconsistencies preserved (this Phase) | 1 (`manakish`'s sauceFamily header vs. Q&A contradiction) |
| New ingredient-table entries (this Phase) | 0 |
| Pending rows | 20 |

## 5. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/ambiguity/corroboration/mechanic notes.
- No merge to `main`.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` (self-test),
  `progression2_recipe_row_ingest.py --check`, `progression2_evidence_invariants.py` — all run
  clean.

## 6. Final Report (Phase 0B.13)

- **1 expected duplicate correctly caught**: `うなぎピザ` matches the already-evidenced
  `eel-pizza-pizzadb-p1` (Phase 0B.7) with an identical ingredient set — recorded as an automatic
  corroboration, new detail (late-topping timing) folded in, not double-counted.
- **7 new unique rows** — recipe rows evidenced: 145 → **152 / 172** (88.4%).
- **Recovery path validated**: pages 13-15 remain inaccessible via comparison-table pagination
  even to the owner's own relaying process, but individual-profile-page recovery (via
  ingredient-tag pages) successfully added 7 more dishes — `individual_profile_page`-origin rows
  doubled from 7 to 14.
- **3 late/post-bake topping mechanic findings**, including the cleanest single-source
  post-bake-finishing confirmation yet (`wasabi-beef-pizza`'s explicit "added after the bake
  finishes" text).
- **1 new flatbread-family mechanic axis** (`manakish`'s soft pita-like dough) — a third distinct
  flatbread sub-type, not merged with the other two.
- **1 source-data inconsistency preserved, not normalized**: `manakish`'s sauceFamily header
  (オイル) contradicts its own Q&A prose (ノンソース) — flagged as a new open item, recorded using
  the header value per the trigger's explicit instruction.
- **Ingredient canonicalization**: 24 names, zero new table entries needed — third consecutive
  Phase where the existing tables fully covered a new batch.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 152/172
  coverage, 88.4%).
- **Pending**: 20 of 172 recipe rows remain with zero evidence; all prior unresolved items (Phase
  0B.3's 11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap, `bianca-pizzadb-row`'s
  three-way cluster, `speck-e-brie`'s composition variant, the Napolitana-family three-way
  cluster, `chicago-stuffed` vs. `chicago-deep-dish`, `colorado-mountain-pie`'s placeholder gap,
  `detroit-style` brick-cheese vs. mozzarella, `nutella-dessert` banana vs. strawberry,
  `bismarck`'s composition mismatch, the page-8 no-sauce finishing-mechanic design finding, the
  Fugazza/`fugazza`-shipped-recipe conflict, `pizza-romana`'s composition variant,
  `focaccia-genovese`'s catalog-scope question, `breakfast-pizza`/`genovese` shipped-recipe
  conflicts, `boscaiola`'s composition mismatch) still stand, plus `manakish`'s sauceFamily
  inconsistency.
- **PR #183 status**: **OPEN, unmerged.**
