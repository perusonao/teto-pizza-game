# Progression 2.0 — Phase 0B.16: Japanese-Side Confirmation of Lahmacun (Issue #182 / PR #183)

Status: **Phase 0B.16 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 154/172 to **155/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5781227447](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5781227447)
("Phase 0B.16 trigger — Japanese-side confirmation of EN-only candidate"), posted by the
repository owner (`perusonao`, `author_association: OWNER`). Started from Phase 0B.15's confirmed
**154/172**, commit `fdc1cfa`, with 3 EN-only candidates awaiting Japanese-side confirmation.

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated — Lahmacun's
`en172UnconfirmedCandidatesPhase0B15` entry marked resolved, not deleted, preserving the audit
trail)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/pizzas/lahmacun/` re-attempted: **`EGRESS_BLOCKED`**, unchanged.

## 1. One of three EN-only candidates converted to genuine ja-172 evidence

Phase 0B.15 left three EN-index-only candidates unconfirmed (Black Truffle, Hokkaido Cheese,
Lahmacun), explicitly excluded from the ja-172 count pending a Japanese-language profile fetch.
This Phase's trigger relayed exactly that for one of them:

- **Lahmacun**: nameJa **ラフマジュン**, directly-fetched Japanese profile
  (`https://pizzadb.jp/pizzas/lahmacun/`), and cross-listed on the Japanese ingredient-tag page
  `/toppings/ground-meat/` (one of 6 ひき肉-tagged pizzas) — a second, independent confirmation
  path beyond the profile page itself.

Checked against all 154 existing rows by name — confirmed genuinely new (absent from both the
individually-tracked ledger and the original 25 comparison-table samples). Ingested:

```
Ingested 1 new row(s), recorded 0 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 155 / 172
```

**Black Truffle Pizza and Hokkaido Cheese Pizza remain EN-only, unconfirmed** — per the trigger's
explicit instruction, coverage was not incremented for either.

## 2. Mechanic/identity evidence preserved, no ingredient invented

Lahmacun's ultra-thin, crispy flatbread dough is a **fourth** distinct flatbread-family dough,
alongside `piadina-romagnola` (unleavened, Phase 0B.10), `focaccia-genovese` (thick olive-oil,
Phase 0B.11), and `manakish` (soft pita-like, Phase 0B.13) — all four kept distinct, none merged.

Per the trigger's explicit caution, the profile's finishing/serving description — ground-meat
paste spread before baking; lemon squeezed on **after** baking; the dish eaten rolled with fresh
vegetables — was recorded as mechanic/context evidence only. **Lemon and fresh vegetables were
NOT added to the canonical ingredient list**: the source's own published topping list is exactly
the 5 ingredients recorded (ground-meat, fresh-tomato, bell-pepper, parsley, chili-ambiguous).

All 5 ingredient names classified deterministically with **zero** `needs_review` using the
existing tables — sixth consecutive Phase (0B.11 through 0B.15) where the accumulated canonical
set fully covered a new batch without a table extension.

## 3. Audit trail preserved, not overwritten

Lahmacun's entry in `en172UnconfirmedCandidatesPhase0B15` was **not deleted** on conversion — a
new `resolvedInPhase0B16` field was added documenting exactly how it moved from EN-only candidate
to genuine ja-172 evidence, so the record of the Phase 0B.15 discipline (never trust size parity
alone) and its Phase 0B.16 resolution (a real Japanese-side fetch closed the gap) both remain
visible.

## 4. Re-confirmed: EN evidence still cannot leak into ja-172 coverage

Per the trigger's explicit re-check request, `population_tag_no_en160_leak` was specifically
re-verified after this Phase's changes: `populations.en-160` (`claimedTotal` now 172, from Phase
0B.15) keeps `usableForJa172Completeness` and `isCanonicalPopulationForIssue182` both unchanged,
explicitly `false`. Lahmacun's `evidencedCount` increment traces entirely to its Japanese-language
profile fetch, not its earlier EN-only sighting.

## 5. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (155
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak: en-160 is explicitly marked non-usable for ja-172
completeness; all evidenced sections are tagged ja-172
[PASS] full_deadlock_blocked_unless_172_covered: only 155/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

## 6. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **155 / 172** (90.1%) |
| New unique rows this Phase | 1 (`lahmacun`, JA-profile-sourced) |
| Corroborations this Phase | 0 |
| Corroborations total (cumulative, Phase 0B.5–0B.16) | 40 |
| `individual_profile_page`-origin rows (cumulative) | 17 (was 16) |
| EN-only candidates resolved this Phase | 1 of 3 (Lahmacun) |
| EN-only candidates still unconfirmed | 2 (Black Truffle, Hokkaido Cheese) |
| Rows requiring mechanic/dough identity (this Phase) | 1 (`lahmacun`) |
| Rows requiring mechanic identity (cumulative) | 35 |
| New ingredient-table entries (this Phase) | 0 |
| Pending rows | 17 |

## 7. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/mechanic/population-discipline notes.
- No merge to `main`. No gameplay mechanic implemented. No ingredient invented beyond the
  source's own published topping list.
- No EN-only evidence used to mark a ja-172 gap as filled — re-verified this Phase.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` (self-test),
  `progression2_recipe_row_ingest.py --check`, `progression2_evidence_invariants.py` — all run
  clean.

## 8. Final Report (Phase 0B.16)

- **1 of Phase 0B.15's 3 EN-only candidates resolved**: Lahmacun cleared the Japanese-side
  confirmation bar via a directly-fetched profile plus an independent ingredient-tag-page listing.
  Checked against all 154 existing rows before ingesting — confirmed genuinely new.
- **1 new unique row** — recipe rows evidenced: 154 → **155 / 172** (90.1%).
- **A fourth distinct flatbread-family dough** confirmed (Lahmacun's ultra-thin crispy dough),
  kept separate from the three prior flatbread findings.
- **No ingredient invented**: lemon/fresh-vegetable finishing details preserved as mechanic/context
  evidence only, not added to the canonical ingredient list, per the trigger's explicit caution.
- **Audit trail preserved**: the resolved candidate's entry stays in
  `en172UnconfirmedCandidatesPhase0B15` with a new field documenting its conversion, rather than
  being deleted.
- **`population_tag_no_en160_leak` re-verified**: EN evidence still cannot leak into ja-172
  coverage; Lahmacun's increment traces entirely to its Japanese-side fetch.
- **Ingredient canonicalization**: 5 names, zero new table entries needed — sixth consecutive
  Phase the existing tables fully covered a new batch.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 155/172
  coverage, 90.1%).
- **Pending**: 17 of 172 recipe rows remain with zero ja-172 evidence, plus 2 EN-only candidates
  (Black Truffle, Hokkaido Cheese) still awaiting Japanese-side confirmation; all prior unresolved
  items still stand.
- **PR #183 status**: **OPEN, unmerged.**
