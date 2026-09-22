# Progression 2.0 — Phase 0B.10: Comparison-Table Pages 7-8 Batch (24 rows) (Issue #182 / PR #183)

Status: **Phase 0B.10 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 79/172 to **100/172** — the first Phase to cross the halfway
mark. **Full-population deadlock simulation remains correctly blocked. PR #183 stays OPEN /
unmerged.**

Trigger: PR #183 comment
[#5780240545](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5780240545)
("Phase 0B.10 trigger — Fresh PIZZA DB comparison pages 7–8"), posted by the repository owner
(`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)
Companion tooling: `tools/progression2_ingredient_canonicalizer.py` (2 new table entries)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/compare/world-pizzas/page/7/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. All 24 relayed rows remain owner-relayed, not independently fetched by this session.

## 1. Pre-ingestion cross-check found 3 expected duplicates

The trigger comment explicitly flagged three names as likely re-appearances: `ハワイアンピザ`,
`ピッツァ・ア・カバージョ`, and `ピッツァ・デ・カンチャ`. Each was verified — not just trusted by
name — by comparing the relayed row's own ingredient set against the already-stored evidence
before accepting the match:

| Relayed row | Matched existing row | Ingredient-set check |
|---|---|---|
| `ハワイアンピザ` | `hawaiian-pizzadb-row` | Identical: {mozzarella, pineapple, ham} |
| `ピッツァ・ア・カバージョ` | `pizza-a-caballo` | Identical: {mozzarella, olive, oregano} |
| `ピッツァ・デ・カンチャ` | `pizza-de-cancha` | Identical: {garlic, oregano, chili, olive-oil} |

All 3 correctly recorded as automatic exact-nameJa-match corroborations — no suffix-mismatch
cases this Phase, since none of the 24 relayed names correspond to a `（PIZZA DB版）`-suffixed id.

`pizza-a-caballo`'s existing evidence gap (Fainá layer mentioned in profile prose but absent from
the published topping list — flagged since Phase 0B.4) is untouched by this corroboration, per the
trigger comment's own explicit instruction not to invent Fainá as a topping from the comparison
table's continued omission of it.

## 2. Ingestion results

**21 new unique rows**, **3 corroborations** (all automatic):

```
Ingested 21 new row(s), recorded 3 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 100 / 172
```

### 2.1 New composition-mismatch item: `bismarck-pizza-pizzadb-p7`

Matches the existing `bismarck` game_design_candidate (egg, mozzarella, tomato-sauce) by name and
egg-topped identity, but this PIZZA DB row is a fuller composition — adds ham and mushroom (a
"capricciosa-plus-egg" style) where the existing candidate is a plain egg+mozzarella pizza.
Recorded as new evidence, **not** used to silently change the existing candidate — new open item
added for a product decision, same treatment as the Phase 0B.9 `detroit-style`/`nutella-dessert`
findings.

### 2.2 New mechanic/dough identity axis: unleavened flatbread

`piadina-romagnola-pizzadb-p7`'s explicit **無発酵** (unleavened), thin flatbread dough is a
genuinely new dough-identity axis — distinct from every prior mechanic-identity row (pan shape,
cracker thinness, deep-dish stacking, double-crust stuffing, cauliflower dough material,
boat-shaped dough). Not merged into any existing mechanic family.

### 2.3 New design-level finding: page-8 no-sauce raw-topping pizza family

8 of this Phase's rows (`pizza-asparagi-limone`, `pizza-carciofi-salad`, `pizza-finocchi-salad`,
`pizza-cavolo-carote`, `pizza-zucchine-menta`, `pizza-cicoria-limone`, `pizza-puntarelle`,
`pizza-radicchio-noci`, all `-pizzadb-p8`) share a consistent pattern:

- `sauceFamily`: **ノンソース** (no base sauce) for all 8
- A raw ("crudo"/"crudi") vegetable or salad topping
- A lemon (or, in one case, balsamic vinegar) + olive-oil dressing as the only "sauce"-like element

This looks like a genuinely distinct **finishing mechanic** — a raw salad topping added post-bake
and dressed, rather than baked in with a sauce — worth a future design-level mechanic candidate.
The existing `postBakeFinishing` mechanic (used by `detroit-style`'s sauce stripe) is the closest
analog but was defined for a drizzle, not a whole raw-salad topping set. **Recorded here as a
design FINDING only**, per the trigger comment's explicit instruction not to invent gameplay
behavior — no mechanic implemented, new open item added for the repo owner.

One row in this family, `pizza-carciofi-salad-pizzadb-p8`, is naming-adjacent to the existing
`ai-carciofi` catalog candidate (artichoke, garlic, mozzarella, tomato-sauce) but structurally
different — no-sauce raw artichoke salad (celery, parmigiano, lemon, olive-oil, no garlic, no
tomato-sauce) vs. a baked garlic/tomato-sauce artichoke pizza. **Not** merged or flagged as a
correspondence.

`pizza-alla-crudaiola-pizzadb-p8` (page 8, item 14) shares the "raw-style" naming root but uses
`sauceFamily: トマトソース` — kept outside this no-sauce cluster, noted as naming-adjacent only.

### 2.4 Ingredient canonicalization: 2 new table entries

- **`パルミジャーノチーズ`** (チーズ suffix variant of existing `parmigiano`'s stored `パルミジャーノ`)
  added to `LIKELY_ALIAS_TABLE`, following the same pattern as prior チーズ-suffix additions
  (gorgonzola, cheddar, caciocavallo, fontina, ricotta-salata).
- **`卵`** (kanji variant of existing `egg`'s stored hiragana form `たまご`) added to
  `ORTHOGRAPHIC_EQUIVALENTS`.

Self-test re-verified passing after each addition (36/36 Phase 0B.1 names still reclassify
identically). All 49 ingredient names named across this Phase's 24 relayed rows now classify with
**zero** `needs_review` results.

## 3. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (100
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 100/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 4. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **100 / 172** (58.1%) |
| New unique rows this Phase | 21 |
| Corroborations this Phase | 3 (all automatic) |
| Corroborations total (cumulative, Phase 0B.5–0B.10) | 31 |
| Rows requiring mechanic/dough identity (this Phase) | 9 (`piadina-romagnola-pizzadb-p7` + 8 page-8 no-sauce family rows) |
| Rows requiring mechanic identity (cumulative) | 21 |
| Rows corresponding to an existing catalog entry (this Phase) | 1 (`bismarck`) |
| Rows corresponding to an existing catalog entry (cumulative) | 7 |
| New ingredient-table entries (this Phase) | 2 (パルミジャーノチーズ, 卵) |
| New design findings (this Phase) | 1 (page-8 no-sauce raw-topping finishing-mechanic candidate) |
| Pending rows | 72 |

## 5. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/ambiguity/corroboration/mechanic/design-finding notes.
- No merge to `main`.
- No gameplay mechanic implemented — the page-8 raw-topping finding is recorded as a design
  observation only.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` (self-test),
  `progression2_recipe_row_ingest.py --check`, `progression2_evidence_invariants.py` — all run
  clean.

## 6. Final Report (Phase 0B.10)

- **Pre-ingestion cross-check** correctly caught all 3 rows the trigger comment flagged
  (`ハワイアンピザ`, `ピッツァ・ア・カバージョ`, `ピッツァ・デ・カンチャ`) — each verified by
  ingredient-set equality, not just trusted by name, before recording as automatic corroborations.
- **21 new unique rows**, **3 corroborations** — recipe rows evidenced: 79 → **100 / 172** (58.1%),
  the first Phase to cross the halfway mark.
- **`pizza-a-caballo`'s Fainá evidence gap explicitly re-confirmed, not filled** — the relayed
  row's ingredient set matches the existing gap-flagged evidence exactly; the gap stands untouched.
- **1 new composition-mismatch item** (`bismarck-pizza-pizzadb-p7` vs. the existing `bismarck`
  candidate) — new evidence only, not merged, new open item for a product decision.
- **1 new mechanic/dough identity axis** (`piadina-romagnola-pizzadb-p7`'s unleavened flatbread) —
  a genuinely new category, not merged into any existing mechanic family.
- **1 new design-level finding**: an 8-row page-8 "no-sauce raw-topping" family sharing a
  lemon/balsamic + olive-oil finishing pattern — recorded as a design observation for a possible
  future finishing-mechanic candidate, **no gameplay behavior invented**, new open item.
- **Ingredient canonicalization**: 2 new table entries (パルミジャーノチーズ likely-alias, 卵
  orthographic) — all 49 ingredient names in this Phase's 24 rows now classify deterministically
  with zero `needs_review`. Self-test re-verified passing.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 100/172
  coverage, 58.1%).
- **Pending**: 72 of 172 recipe rows remain with zero evidence; all prior unresolved items (Phase
  0B.3's 11 ambiguous ingredients, `pizza-a-caballo`'s evidence gap, `bianca-pizzadb-row`'s
  three-way cluster, `speck-e-brie`'s composition variant, the Napolitana-family three-way
  cluster, `chicago-stuffed` vs. `chicago-deep-dish`, `colorado-mountain-pie`'s placeholder gap,
  `detroit-style` brick-cheese vs. mozzarella, `nutella-dessert` banana vs. strawberry) still
  stand, plus the two new items above.
- **PR #183 status**: **OPEN, unmerged.**
