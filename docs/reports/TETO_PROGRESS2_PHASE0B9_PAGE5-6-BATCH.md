# Progression 2.0 — Phase 0B.9: Comparison-Table Pages 5-6 Batch (24 rows) (Issue #182 / PR #183)

Status: **Phase 0B.9 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 63/172 to **79/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5780084016](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5780084016)
("Phase 0B.9 trigger — Fresh PIZZA DB comparison pages 5–6"), posted by the repository owner
(`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)
Companion tooling: `tools/progression2_ingredient_canonicalizer.py` (2 new orthographic entries, 1
new ambiguous entry, plus a pre-existing gap fixed)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/compare/world-pizzas/page/5/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. All 24 relayed rows remain owner-relayed, not independently fetched by this session.

## 1. Pre-ingestion cross-check found 8 expected duplicates

Pages 5 and 6 were **also** sampled in Phase 0B's very first relay comment, so this batch was
cross-checked against ALL existing evidence (not just this batch's own page) before ingesting,
exactly matching the trigger comment's own explicit caution ("Do not assume all 24 are new"):

| Relayed row | Matched existing row | Detection |
|---|---|---|
| `タルトフランベ` | `flammkuchen-pizzadb` (identical, no suffix) | automatic exact match |
| `チリアンナポリターナ` | `chilean-napolitana-pizzadb` (identical, no suffix) | automatic exact match |
| `トレントントマトパイ` | `trenton-tomato-pie-pizzadb` (identical, no suffix) | automatic exact match |
| `ニューヘイブンアピッツァ` | `new-haven-apizza-pizzadb` (identical, no suffix) | automatic exact match |
| `バカリャウピザ` | `bacalhau-pizzadb` (identical, no suffix) | automatic exact match |
| `トンノエチポッラ` | `tonno-e-cipolla-pizzadb` (suffix `（PIZZA DB版）` hid it) | **manual review** |
| `ニューヨークスタイルピザ` | `ny-style-pizzadb` (suffix hid it) | **manual review** |
| `バッファローチキンピザ` | `buffalo-chicken-pizzadb` (suffix hid it) | **manual review** |

All 8 correctly recorded as corroborations — new source URL, note, and `matchType` each — and
**not** double-counted toward unique rows. The 3 manual cases reconfirm the same suffix-mismatch
class first caught in Phase 0B.5 and again in Phase 0B.8: this session's own earlier
`（PIZZA DB版）` disambiguating convention on several Phase 0B sample rows hides them from
automated exact-`nameJa` dedup whenever a later relay uses the plain (unsuffixed) name.

Per the trigger comment's explicit request, `トレントントマトパイ` vs. `ニューヨークスタイルピザ`
was checked with extra care (both list only mozzarella in the topping column) — both remain
correctly attributed to their own already-separate Phase 0B ids, not collapsed into one.

## 2. Ingestion results

**16 new unique rows**, **8 corroborations** (5 automatic, 3 manual):

```
Ingested 16 new row(s), recorded 5 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 79 / 172
```

(3 further manual corroborations recorded in a second pass, bringing this Phase's total to 8.)

### 2.1 Two rows correspond to existing game-design catalog candidates — with a mismatch worth flagging

- **`detroit-style-pizza-pizzadb-p5`**: matches the existing `detroit-style` game_design_candidate
  (mozzarella, pepperoni, tomato-sauce) by dish identity, but explicitly lists **ブリックチーズ**
  (brick-cheese, an already-registered ingredient id) instead of mozzarella. Real Detroit-style
  pizza is historically defined by Wisconsin brick cheese — this is new evidence that could refine
  the existing candidate's ingredient list, but **not changed here**. New open item added for a
  product decision.
- **`nutella-dessert-pizza-pizzadb-p6`**: matches the existing `nutella-dessert` candidate by name
  family, but uses **banana + generic nuts** where the existing candidate uses **strawberry** — a
  composition variant, same treatment as the `speck-e-brie` precedent (Phase 0B.6). Kept separate,
  not merged, new open item added.
- `diavola-pizza-pizzadb-p5` also corresponds to the existing `diavola` candidate, but with no
  mismatch beyond the already-known 唐辛子/chili-oil ambiguity (see 2.3) — recorded as a
  straightforward correspondence.

### 2.2 New mechanic/shape identity axis: boat-shaped dough

`turkish-pide-pizzadb-p5`'s explicit **舟形** (boat/canoe-shaped) dough is a genuinely **new**
shape-identity axis — every prior mechanic-identity row varied by pan shape, cracker thinness,
deep-dish stacking, double-crust stuffing, or dough material (cauliflower), never by an
elongated boat/canoe form. Not merged into any existing mechanic family.

`new-england-bar-pizza-pizzadb-p6`'s thin, crispy pan-baked dough reinforces (not newly conflicts
with) the design doc's already-documented "Pan-style family" collision-risk cluster — its
ingredient set ({mozzarella, pepperoni, tomato-sauce}) is identical to the shipped `pepperoni`
recipe and to `detroit-style`/`old-forge-style`/`st-louis-style`, disambiguated only by mechanic.

### 2.3 Ingredient canonicalization: 1 new ambiguous entry, 1 new alias, 1 pre-existing gap fixed

- **`唐辛子`** (plain chili pepper, color/type unspecified) added to `AMBIGUOUS_TABLE`, extending
  the existing チリ/青唐辛子/赤唐辛子 chili-oil ambiguity group (found via `diavola-pizza-pizzadb-p5`).
- **`蜂蜜`→`はちみつ`** added to `ORTHOGRAPHIC_EQUIVALENTS` (kanji/kana variant of the already-
  registered `honey`, found via `nashville-hot-chicken-pizza-pizzadb-p6`).
- **Pre-existing gap found and fixed**: `モッツァレラチーズ` and `ナス` — used as raw `ingredientsJa`
  strings across ~20+ rows already ingested since Phase 0B.4 — were never actually covered by the
  canonicalizer's exact/orthographic tables (the catalog's own stored forms are `モッツァレラ` and
  `なす`), so both silently classified as `needs_review` whenever run through the tool. Fixed by
  adding both as ORTHOGRAPHIC_EQUIVALENTS entries (plain suffix/script variants, no identity
  ambiguity — same treatment as the existing 玉ねぎ→たまねぎ / リコッタ→リコッタチーズ entries).

Self-test re-verified passing after every addition (36/36 Phase 0B.1 names still reclassify
identically). All 40 ingredient names named across this Phase's 24 relayed rows now classify with
**zero** `needs_review` results.

## 3. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (79
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 79/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 4. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **79 / 172** (45.9%) |
| New unique rows this Phase | 16 |
| Corroborations this Phase | 8 (5 automatic, 3 manual) |
| Corroborations total (cumulative, Phase 0B.5–0B.9) | 28 |
| Rows requiring mechanic/shape identity (this Phase) | 3 (`detroit-style-pizza-pizzadb-p5`, `turkish-pide-pizzadb-p5`, `new-england-bar-pizza-pizzadb-p6`) |
| Rows requiring mechanic identity (cumulative) | 12 |
| Rows corresponding to an existing catalog entry (this Phase) | 3 (`diavola`, `detroit-style`, `nutella-dessert`) |
| Rows corresponding to an existing catalog entry (cumulative) | 6 |
| New ingredient-table entries (this Phase) | 3 (1 ambiguous, 2 orthographic — 1 new finding, 1 pre-existing gap fixed) |
| Catalog-composition conflicts found | 2 new (`detroit-style` brick-cheese vs. mozzarella; `nutella-dessert` banana vs. strawberry) |
| Pending rows | 93 |

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

## 6. Final Report (Phase 0B.9)

- **Pre-ingestion cross-check** correctly caught 8 of 24 relayed rows as duplicates (5 automatic,
  3 manual suffix-hidden), per the trigger comment's own caution and the recurring Phase 0B.5/0B.8
  suffix-mismatch lesson. `トレントントマトパイ` vs. `ニューヨークスタイルピザ` (both mozzarella-only)
  were explicitly re-verified as distinct, per the trigger's own request.
- **16 new unique rows**, **8 corroborations** — recipe rows evidenced: 63 → **79 / 172** (45.9%).
- **2 new catalog-composition conflicts** found (`detroit-style` brick-cheese vs. mozzarella;
  `nutella-dessert` banana vs. strawberry) — both new evidence only, not merged or auto-corrected,
  new open items for product decisions.
- **1 new mechanic/shape identity axis** (`turkish-pide-pizzadb-p5`'s boat-shaped dough) — a
  genuinely new category, not merged into any existing mechanic family.
- **Ingredient canonicalization**: 1 new ambiguous entry (唐辛子), 1 new alias (蜂蜜→はちみつ), and
  1 pre-existing gap fixed (モッツァレラチーズ/ナス, silently uncovered since Phase 0B.4) — all 40
  ingredient names in this Phase's 24 rows now classify deterministically with zero
  `needs_review`. Self-test re-verified passing throughout.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 79/172
  coverage, 45.9%).
- **Pending**: 93 of 172 recipe rows remain with zero evidence; all prior unresolved items (Phase
  0B.3's 11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap, `bianca-pizzadb-row`'s
  three-way cluster, `speck-e-brie`'s composition variant, the Napolitana-family three-way
  cluster, `chicago-stuffed` vs. `chicago-deep-dish`, `colorado-mountain-pie`'s placeholder gap)
  still stand, plus the two new items above.
- **PR #183 status**: **OPEN, unmerged.**
