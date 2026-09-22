# Progression 2.0 — Phase 0B.18: Pages 13-15 Bulk Batch, 172/172 FULL COVERAGE (Issue #182 / PR #183)

Status: **Phase 0B.18 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 155/172 to **172/172 (100%) — FULL COVERAGE**. A genuine
full-population deadlock analysis was run per the trigger's explicit instruction (result: **0
deadlocks**). **PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5781435283](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5781435283)
("Phase 0B.18 trigger — JA pages 13–15 bulk relay"), posted by the repository owner
(`perusonao`, `author_association: OWNER`). Started from Phase 0B.17's confirmed **155/172**,
commit `ebbf65a`, with 17 rows pending and 2 EN-only candidates unconfirmed.

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (172 rows,
51 corroborations), `docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated),
`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` (regenerated for 172/172),
`docs/reports/TETO_PIZZADB_172_MASTER-REPORT.md` (regenerated),
`docs/reports/data/TETO_PROGRESS2_PHASE0B18_full172-deadlock-analysis.json` (new)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/compare/world-pizzas/page/13/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. This session's own access to `pizzadb.jp` remains blocked on every domain tested this
Phase (see `thisSessionsOwnFetchStatus`). All 28 relayed rows came from the repository owner's own
external tooling, which traversed the Japanese comparison-table pagination through page 15/15.

## 1. Bulk ingestion of the 28-row tail batch — gap closed in one pass

The trigger relayed the complete content of comparison-table pages 13-15 (28 rows total) and
asked for a single bulk ingest/dedup pass, not a stop-after-one-row cadence. Cross-checked against
all 155 existing rows (not just the prior batch) via
`tools/progression2_recipe_row_ingest.py --input`:

```
Ingested 17 new row(s), recorded 11 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 172 / 172
```

The 11 corroborations (automatic exact-nameJa match) re-confirmed: manakish, margherita,
lahmacun, pizza-de-lomo-saltado, wasabi-beef-pizza, sichuan-eggplant-pizza, yakiniku-pizza,
natto-pizza, peking-duck-pizza, mentaiko-mochi-pizza, yuzu-shrimp-pizza — each already evidenced
via an earlier individual-profile or comparison-table batch (Phase 0B.13-0B.16), confirming
PIZZA DB's own pages 13-15 re-list several dishes whose deepest evidence had come from an earlier
profile fetch.

`--check` confirmed: `uniqueRecipeRowsEvidencedTotal: 172`, `coveragePercent: 100.0`,
`pendingRowCount: 0`. **This closes the entire remaining 17-row gap in a single pass.**

## 2. Both remaining EN-only candidates resolved

Page 14 relayed 黒トリュフピザ (Black Truffle) and page 15 relayed 北海道チーズピザ (Hokkaido
Cheese) — both now have confirmed Japanese-side profile rows. Combined with Lahmacun (resolved
Phase 0B.16), **all 3 of the Phase 0B.15-flagged EN-only candidates are now resolved**. Their
entries in `en172UnconfirmedCandidatesPhase0B15` were not deleted, only extended with
`resolvedInPhase0B18` fields, preserving the full audit trail.

Black Truffle Pizza corresponds to the existing unshipped `al-tartufo` candidate — with a
composition conflict (§4).

## 3. Ingredient canonicalization — 4 new abbreviated-form aliases

Pages 13-15 introduced several チーズ-suffix-dropped abbreviated forms: フェタ→feta, マヨ→mayo,
コティーハ→cotija, グラナパダーノ→grana-padano — each added to `LIKELY_ALIAS_TABLE` with a
justification tracing back to the already-registered longer nameJa form. Self-test re-verified:
all 36 Phase 0B.1 names still reclassify identically — determinism preserved.

## 4. New composition conflicts and naming/specificity gaps — preserved, not resolved

**Against SHIPPED recipes** (highest severity):
- `marinara` (garlic+oregano+tomato-sauce) vs. relayed マリナーラ (uses olive-oil, not
  tomato-sauce as a listed ingredient).
- `meat-lovers` (bacon+ham+mozzarella+pepperoni+sausage+tomato-sauce) vs. relayed
  ミートラバーズピザ (adds beef, omits mozzarella).

**Against unshipped `game_design_candidate` entries**:
- `ai-funghi-porcini` vs. relayed `porcini-pizza-pizzadb-p13`.
- `al-tartufo` vs. relayed `black-truffle-pizza-pizzadb-p14` (the newly-resolved EN candidate).
- `teriyaki-chicken` vs. relayed `teriyaki-chicken-pizza-pizzadb-p14`.

**Naming/ingredient-specificity gaps** (name implies a specific ingredient, source's own
published list only gives a generic term — kept generic, never relabeled): nduja (ンドゥイヤピザ,
ingredient list only says ソーセージ), boerewors (南アフリカボアヴォースピザ, same generic
ソーセージ).

None of these were auto-corrected. Resolving any of them is a future, separate product decision.

## 5. Full-population deadlock analysis — actually run, actual result reported

The trigger explicitly said: *"If coverage reaches 172/172, run full-population deadlock analysis
and report actual result."* Since coverage reached 172/172 in this same Phase, a new tool,
`tools/progression2_full172_deadlock_analysis.py`, was written and run — it reuses the existing
deterministic ingredient canonicalizer (never guessing an ambiguous ingredient) to build a
canonical-ingredient-set pool from all 172 evidenced rows, then runs the same
greedy marginal-unlock/deadlock simulation `tools/progression2_phase0b_analysis.py` already runs
over its partial pool.

**Actual result:**

```
Pool: 151/172 resolvable, 21 excluded (ambiguous ingredient)
Exact-ingredient-set collision groups: 5
Deadlock state count: 0
Unreachable recipe count (ingredient-completeness only): 0 / 151
```

- **0 deadlock states.** All 151 resolvable-pool rows are reachable from the Progression 2.0
  initial state (owned = tomato-sauce, mozzarella, basil) in 153 greedy purchase steps.
- **151/172 (87.8%), not 172/172**, because 21 rows contain at least one ingredient name that
  canonicalizes as `ambiguous`/`needs_review` (generic ひき肉/ground-meat, チーズ/generic-cheese,
  ホワイトソース/white-sauce, etc.) — per the standing never-guess-fill discipline these rows are
  **excluded from this simulation**, not assigned a guessed ingredient. All 21 are listed by name
  and exact unresolved ingredient in the output's `excludedRowsWithAmbiguousIngredients` — nothing
  silently dropped. They remain fully evidenced in the 172/172 total; only this ingredient-set-
  based reachability graph excludes them.
- **Mechanic-gating is not modeled** — every pool row is treated as reachable once
  ingredient-complete, matching `tools/progression2_phase0b_analysis.py`'s own simplification. 41
  of the 172 rows independently need a mechanic/dough/cooking-method distinction beyond their
  ingredient list, so "reachable" here means "ingredient-complete," not "actually craftable with
  the game's current baseline mechanics."
- **5 exact-ingredient-set collision groups** found: `new-england-bar-pizzadb` /
  `fathead-pizza-keto-pizzadb`; `cauliflower-crust-pizzadb` / `pizza-al-taglio-romana-pizzadb`;
  `jamon-serrano-pizzadb` / `pinsa-romana-pizzadb`; `ny-style-pizzadb` /
  `trenton-tomato-pie-pizzadb`; and the already-known `fugazza`/`fugazzetta` pair. In every pair,
  at least one member is already an independently-flagged mechanic-identity row — this
  **confirms**, rather than contradicts, the standing "recipe identity needs more than an
  ingredient set" finding.

Full output: `docs/reports/data/TETO_PROGRESS2_PHASE0B18_full172-deadlock-analysis.json`.

**This is a genuine simulation result, not merely a permission-gate message.** It still does
**not** constitute converting the 172 rows into formal, production-ready `game_design_candidate`
catalog entries (assigning real ids/mechanics/Pitz prices, resolving the 14 composition conflicts
and 7 naming clusters) — that catalog-conversion task remains separate and out of scope.

## 6. Master artifacts regenerated for the 172/172 state

`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` and
`docs/reports/TETO_PIZZADB_172_MASTER-REPORT.md` both regenerated: coverage headline now
172/172 (100%), all 3 EN-only candidates marked resolved, the 5 new composition conflicts and 2
naming/specificity gaps added to §5, and §1a/§7 rewritten to report the deadlock analysis's actual
result rather than deferring it.

## 7. Validators — all clean (6 standard + 1 new)

```
[1] validate_recipe_catalog.py       -- 53 recipes, 62 ingredients, 11 mechanics, all checks passed
[2] progression2_phase0_analysis.py  -- 51 viable recipes, deadlock count 0 (unchanged, Phase 0A scope)
[3] progression2_phase0b_analysis.py -- PARTIAL-POOL (64/172), unchanged scope, deadlock count 0
[4] progression2_ingredient_canonicalizer.py -- PASS, 36/36 self-test
[5] progression2_recipe_row_ingest.py --check -- OK, 172/172 (100.0%)
[6] progression2_evidence_invariants.py -- 4/4 PASS, full_deadlock_blocked_unless_172_covered now
    reports "all 172 recipe rows have evidence -- a full-population deadlock simulation may now
    be run"
[7] progression2_full172_deadlock_analysis.py (NEW, this Phase) -- 151/172 pool, 0 deadlocks,
    5 collision groups, 21 rows excluded (ambiguous ingredient, never guessed)
```

## 8. Counters

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **172 / 172 (100%)** |
| New unique rows this Phase | 17 |
| Corroborations this Phase | 11 |
| Corroborations total (cumulative) | 51 |
| `individual_profile_page`-origin rows (cumulative) | 17 |
| EN-only candidates resolved this Phase | 2 of 2 remaining (Black Truffle, Hokkaido Cheese) — all 3 of 3 now resolved |
| New ingredient-table entries (this Phase) | 4 (フェタ, マヨ, コティーハ, グラナパダーノ) |
| New composition conflicts found this Phase | 5 (2 vs. shipped, 3 vs. unshipped candidates) |
| New naming/specificity gaps found this Phase | 2 (nduja, boerewors) |
| Pending recipe rows | **0** |
| Full-population deadlock analysis pool / result | 151/172 resolvable, **0 deadlocks** |
| Exact-ingredient-set collision groups (full pool) | 5 |

## 9. Scope guard (confirmed, same as every prior Phase)

- `src/**`: not modified, at any point across all 18 phases.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/mechanic/conflict/population-discipline notes.
- No merge to `main`. No gameplay mechanic implemented. No ingredient invented beyond the source's
  own published topping list.
- No EN-only evidence used to mark a ja-172 gap as filled.
- No ambiguous ingredient guess-resolved to build the deadlock-analysis pool — 21 rows explicitly
  excluded and listed instead.
- No naming-similar-but-differently-composed dish merged (the 5 new collision-group pairs kept
  distinct, per standing discipline).
- `tools/progression2_full172_deadlock_analysis.py` is new tooling this Phase (docs/data-only,
  same as every other `tools/progression2_*` script) — not wired into CI, not referenced by
  production code.

## 10. Final Report (Phase 0B.18)

- **17 new unique rows + 11 corroborations ingested** from the pages 13-15 bulk relay — recipe
  rows evidenced: 155 → **172 / 172 (100%) — FULL COVERAGE**, closing the entire remaining gap in
  one pass.
- **All 3 EN-only candidates now resolved** (Lahmacun Phase 0B.16; Black Truffle and Hokkaido
  Cheese this Phase), each via a genuine Japanese-language source row, never via EN-index size
  parity alone.
- **4 new ingredient aliases**, 0 new `needs_review` entries — self-test still passes.
- **5 new composition conflicts + 2 naming/specificity gaps** found and preserved unresolved, per
  the never-invent/never-auto-correct discipline.
- **Full-population deadlock analysis actually run, per the trigger's explicit instruction —
  actual result: 0 deadlock states** across the 151/172 rows resolvable into a deterministic
  ingredient set (21 rows excluded, never guessed; full list in the output JSON). 5
  exact-ingredient-set collision groups found, all consistent with existing mechanic-identity
  findings.
- **Master artifacts (JSON + report) regenerated** for the complete 172/172 state.
- **All 6 standard validators clean, plus the new 7th (full-172 deadlock analysis) clean.**
- **Nothing left pending in this evidence-gathering effort at the row level.** The clear next
  milestone is the separate, out-of-scope design-conversion task: converting the 172 raw evidenced
  rows into formal `game_design_candidate` catalog entries (resolving ambiguous ingredients,
  composition conflicts, and naming clusters; assigning mechanic tags).
- **PR #183 status**: **OPEN, unmerged.**
