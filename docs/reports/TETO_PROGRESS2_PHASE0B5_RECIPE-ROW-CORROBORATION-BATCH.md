# Progression 2.0 — Phase 0B.5: Recipe-Row Batch + Corroboration Tracking (Issue #182 / PR #183)

Status: **Phase 0B.5 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 29/172 to **32/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5775364697](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5775364697)
("Phase 0B.5 — Fresh recipe batch + independent corroborations"), posted by the repository owner
(`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)
Companion tooling: `tools/progression2_recipe_row_ingest.py` (extended — corroboration tracking
+ `--manual-corroborate`)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/pizzas/bianca/` re-attempted: **`EGRESS_BLOCKED`**, unchanged. All 6
relayed items (5 new rows + 1 explicit re-confirmation) remain owner-relayed, not independently
verified by this session.

## 1. Careful dedup analysis before ingesting (not just trusting the automated tool blindly)

Before running anything through `tools/progression2_recipe_row_ingest.py`, this Phase manually
cross-checked all 5 relayed rows against **both** the 25 existing comparison-table samples
**and** the Phase 0A catalog (`data/recipes/pizza_master_catalog.json`), because the automated
tool only dedups against the recipe-row evidence ledger, not the separate Phase 0A catalog:

| Relayed row | Manual finding |
|---|---|
| `bianca` | No match anywhere — genuinely new, but see §2's naming-ambiguity flag |
| `pizza-de-cancha` | No match anywhere — genuinely new |
| `pizza-calabresa-argentina` | **Exact nameJa match** to Phase 0B's existing `calabresa-argentina-pizzadb` sample (identical ingredient set too) — expected to be auto-rejected |
| `hawaiian` | No match in the 25 samples, but **ingredient-set match** to the Phase 0A catalog's already-catalogued `hawaiian` candidate (not yet shipped) — new *row* evidence, zero new *game-design* content |
| `chicago-deep-dish` | **Ingredient-set match** to Phase 0B's existing `chicago-deep-dish-pizzadb` sample, but **nameJa does NOT match** (`シカゴディープディッシュ` vs. the sample's `シカゴディープディッシュ（PIZZA DB版）` — this session's own earlier disambiguating-suffix convention) — automated exact-match dedup would **miss** this; handled manually (§3) |
| `pizza-baiana` (explicit re-confirmation) | **Exact id match** to Phase 0B.4's own `pizza-baiana` row — expected to be auto-rejected |

This manual pass caught the one case (`chicago-deep-dish`) the automated tool's exact-match
discipline structurally cannot catch — confirming why that discipline (no fuzzy matching) needs
a human review step for cases like this, rather than silently missing a duplicate.

## 2. New tooling: corroboration tracking

`tools/progression2_recipe_row_ingest.py` extended per the trigger comment's request ("existing
29行との重複はtool側で判定し、重複は independent corroboration として数え、unique countを二重
加算しないでください"):

- Every automatic exact-match duplicate is now **recorded**, not just printed-and-discarded — a
  `corroborations` entry captures the new source URL/date against the row it matches
  (`matchType: automatic_exact_match`).
- A new `--manual-corroborate` mode records a corroboration found by human review instead of
  exact matching (`matchType: manual_review`) — used for the `chicago-deep-dish` case above.
- `duplicateCorroborationsCount` in the ledger's counters is now derived from the actual
  persisted list, not a hand-maintained number.

## 3. Ingestion results

**3 new unique rows** ingested (`bianca-pizzadb-row`, `pizza-de-cancha`, `hawaiian-pizzadb-row`),
**3 corroborations** recorded (2 automatic: `pizza-calabresa-argentina`→`calabresa-argentina-pizzadb`,
`pizza-baiana`→`pizza-baiana`; 1 manual: `chicago-deep-dish`→`chicago-deep-dish-pizzadb`, adding
new mechanic-identity detail — deep pan/shape, cheese-before-sauce reverse layering — to the
existing sample's evidence trail).

```
Ingested 3 new row(s), recorded 2 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 32 / 172
Recorded 1 manual corroboration(s). Total corroborations: 3.
```

### 3.1 `hawaiian-pizzadb-row` — new row evidence, zero new design content

Matches the Phase 0A catalog's already-catalogued `hawaiian` `game_design_candidate`
(`ham,mozzarella,pineapple,tomato-sauce`) by ingredient set. This individual-profile fetch is new
**population-row evidence** (this specific dish wasn't previously itemized in the 25
comparison-table samples), so it correctly increments `uniqueRecipeRowsEvidencedTotal`, while
`correspondsToExistingCatalogId: "hawaiian"` records that it adds nothing new to the game-design
candidate pool — same pattern as Phase 0B.4's `margherita-pizzadb-row`, generalized: this
correspondence field is set whether the matched catalog entry is shipped (`margherita`) or still
an unshipped candidate (`hawaiian`) — the ledger's counter note now says so explicitly.

### 3.2 `bianca-pizzadb-row` — new three-way naming-ambiguity cluster

| Entry | Ingredients | Status |
|---|---|---|
| `pizza-bianca` | olive-oil + rosemary (no cheese) | **Shipped** (Roman sauceless style) |
| `ricotta-bianca` | garlic + mozzarella + olive-oil + ricotta (no rosemary) | Existing candidate (American "white pizza") |
| `bianca-pizzadb-row` (this Phase) | mozzarella + ricotta + olive-oil + rosemary | New — combines elements of both, matches neither exactly |

Recorded as its own distinct id, cross-referenced to both existing entries, **never merged** —
matching this repo's standing "never merge on name similarity alone" discipline
(`TETO_RECIPE-MASTER-CATALOG.md` §6/§8), now extended to a genuine three-way case found from
external evidence rather than internal candidate design. Added as a new open item in the
evidence ledger (a product decision, not resolved here).

## 4. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (32
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 32/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 5. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **32 / 172** (18.6%) |
| New unique rows this Phase | 3 |
| Corroborations this Phase | 3 (2 automatic, 1 manual) |
| Rows requiring mechanic identity | 2 (unchanged from Phase 0B.4) |
| Rows corresponding to an existing catalog entry | 2 (`margherita-pizzadb-row`, `hawaiian-pizzadb-row`) |
| Catalog-name/id conflicts found | 1 new (`bianca-pizzadb-row`'s three-way cluster, §3.2) |
| Pending rows | 140 |

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

## 7. Final Report (Phase 0B.5)

- **Manual cross-check before automation**: found 1 duplicate (`chicago-deep-dish`) the automated
  exact-match tool structurally could not catch (nameJa-suffix mismatch from this session's own
  earlier convention) — handled via a new `--manual-corroborate` path rather than silently
  mis-counted.
- **New tooling**: corroboration tracking persisted to the ledger (not just printed), covering
  both automatic and manual duplicate findings.
- **3 new unique rows**, **3 corroborations** — recipe rows evidenced: 29 → **32 / 172** (18.6%).
- **1 new naming-ambiguity cluster** found (`bianca-pizzadb-row` vs. `pizza-bianca`/
  `ricotta-bianca`, three-way, none merged).
- **1 row** (`hawaiian-pizzadb-row`) adds new population-row evidence with zero new game-design
  content (matches an existing unshipped candidate).
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 32/172
  coverage, 18.6%).
- **Pending**: 140 of 172 recipe rows remain with zero evidence; 11 Phase 0B.3 ambiguous
  ingredient entries and `pizza-a-caballo`'s evidence gap remain unresolved; new open item added
  for the `bianca-pizzadb-row` naming cluster.
- **PR #183 status**: **OPEN, unmerged.**
