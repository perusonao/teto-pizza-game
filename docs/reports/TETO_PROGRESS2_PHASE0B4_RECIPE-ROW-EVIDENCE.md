# Progression 2.0 — Phase 0B.4: Recipe-Row Evidence Ledger + First Individual-Profile Rows (Issue #182 / PR #183)

Status: **Phase 0B.4 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advanced from 25/172 to **29/172** — still far short of the full population.
**Full-population deadlock simulation remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5775202410](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5775202410)
("Phase 0B.4 — Fresh recipe-row evidence: access-path correction + first new rows"), posted by
the repository owner (`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (new
ledger), `docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated)
Companion tooling: `tools/progression2_recipe_row_ingest.py` (new — deterministic dedup/ingest)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/pizzas/margherita/` (one of the exact individual-profile URLs the
relayed comment cites) re-attempted this turn: **`EGRESS_BLOCKED`**, unchanged. All 4 relayed
rows are treated as owner-relayed, **not independently re-verified by this Claude session** —
this holds regardless of whether the relaying agent's own fetch method was a comparison-table
scrape or an individual profile-page fetch (`individual_profile_page` in the ledger describes
*the relaying agent's* method, not this session's own verification depth — made explicit in the
ledger's `independentSessionFetchStatus` field specifically to prevent that reading).

## 1. New tooling: recipe-row evidence ledger + deterministic dedup ingest

Per the trigger comment's own request ("extend the recipe evidence ledger/schema so individual
profile rows can be appended deterministically and deduplicated by stable id/source URL/name"):

- **`docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json`**: references the
  existing 25 comparison-table sample rows by count (not duplicating their content — they still
  live in `TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json`), plus the 4 new
  individually-evidenced rows in full detail.
- **`tools/progression2_recipe_row_ingest.py`**: dedups a new candidate row against *both* the
  25 existing samples *and* every row already in the ledger, by exact `id` or exact `nameJa`
  match (never fuzzy, matching the ingredient canonicalizer's own discipline) — a near-miss name
  is not silently merged. Recomputes every counter from the actual stored rows on each run;
  `--check` verifies stored counters haven't drifted from a fresh recomputation (catches
  manual-edit mistakes). Tested this Phase with a synthetic duplicate (correctly rejected) before
  being used on the real 4 rows.

## 2. The 4 new rows

| id | Dish | Origin | Correspondence |
|---|---|---|---|
| `margherita-pizzadb-row` | マルゲリータ | Italy/Naples | **Already shipped** as `margherita` in `src/data/recipes.ts` and `verified_internal` in the Phase 0A catalog. First individual-profile evidence that this dish is itemized in the ja-172 population (it wasn't among the 25 comparison-table samples) — counted as a newly-evidenced *population row*, tracked separately from genuinely-new candidates since it adds zero new game-design content. |
| `pizza-baiana` | ピッツァ・バイアーナ | Brazil/Bahia | New candidate, not in any existing catalog under any name. |
| `pizza-a-caballo` | ピッツァ・ア・カバージョ | Argentina/Buenos Aires | New candidate. **Evidence gap**: profile prose mentions a Fainá (chickpea-flatbread) layer, but the profile's own published ingredient list omits it. **Not filled in** — recorded as an open question, Fainá is explicitly not added as a canonical ingredient (§3). |
| `fugazzeta-rellena` | フガゼッタ・レジェーナ | Argentina/Buenos Aires | Related to, but kept distinct from, the existing `fugazzeta` (deferred) candidate — a stuffed, two-dough-layer variant, not the same dish (§3). |

Programmatic dedup check (not just asserted — actually run): none of the 4 match any of the 25
existing rows by `id` or `nameJa`; `margherita-pizzadb-row` does match the Phase 0A catalog's
`margherita` by `nameJa` (expected and recorded).

## 3. Evidence gaps and mechanic-identity notes — preserved, not filled in

- **`pizza-a-caballo`'s Fainá gap**: this is a gap *in the source evidence itself* (the relayed
  profile's own prose and ingredient list disagree with each other), not something this session
  is completing. Recorded as `evidenceGaps` on the row, and as a new open item in the evidence
  ledger requesting a corrected/confirmed ingredient list — Fainá is **not** added as a canonical
  topping under any disposition.
- **`fugazzeta-rellena` vs. `fugazzeta`**: real-world, these are related dishes (a "stuffed"
  variant of the same family), but their ingredient/mechanic profiles differ meaningfully (two
  dough layers enclosing cheese+ham, vs. a single onion-topped layer) — kept as separate
  candidate ids, cross-referenced, never silently merged, matching this repo's standing
  naming-ambiguity discipline (`TETO_RECIPE-MASTER-CATALOG.md` §6/§8's "never merge on name
  similarity alone" rule, applied here to a name-*relationship* rather than name-similarity).
- **Design-draft cross-reference**: both `pizza-a-caballo` and `fugazzeta-rellena` independently
  reinforce the design draft's §10 conclusion (recipe identity needs a mechanic/shape signal, not
  ingredient set alone) from a second, independent source outside the Phase 0A/0B collision
  analysis — a short cross-reference note was added to §10 (`docs/design/
  TETO_RECIPE-DISCOVERY-PROGRESSION_2.0.md`), not a new conclusion.

## 4. Access-path note (recorded, not treated as newly-unblocked)

The trigger comment reports that direct pagination URLs
(`/compare/world-pizzas/page/7` etc.) fail for the relaying agent, while individual
`/pizzas/<slug>/` profile pages remain fetchable via search. This is recorded as a viable
**alternate evidence path for future batches** (`individualProfilePageAccessNote` in the
ledger) — it does **not** mean pagination is newly blocked in some different way than before, and
it does **not** change this Claude Code session's own access, which remains `EGRESS_BLOCKED`
regardless of URL shape (§0).

## 5. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **29 / 172** (16.9%) |
| — via comparison-table sample | 25 |
| — via individual profile page | 4 |
| Duplicate corroborations (this batch) | 0 |
| Rows requiring mechanic identity beyond ingredient set | 2 (`pizza-a-caballo`, `fugazzeta-rellena`) |
| Rows with an open evidence gap | 1 (`pizza-a-caballo`) |
| Rows corresponding to an existing shipped game recipe | 1 (`margherita-pizzadb-row`) |
| Pending rows | 143 |

## 6. Full deadlock — still correctly blocked

`tools/progression2_evidence_invariants.py` re-run after updating the master evidence ledger's
`recipeRowEvidence.evidencedCount` (25→29):

```
[PASS] sauce_family_sum_172: sauce-family categories sum to 172 == 172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (29
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak: en-160 is explicitly marked non-usable for ja-172
completeness; all evidenced sections are tagged ja-172
[PASS] full_deadlock_blocked_unless_172_covered: full-population deadlock simulation correctly
BLOCKED: only 29/172 recipe rows have evidence -- any deadlock result must stay scoped to a
partial pool

All 4 invariants passed.
```

No deadlock claim, full or partial, is made or changed by this Phase.

## 7. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields (name, origin, dough style,
  sauce family, ingredient list) and this session's own evidence-gap/mechanic-identity notes.
- No merge to `main`.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` — all still run
  clean, unaffected by this Phase.

## 8. Final Report (Phase 0B.4)

- **New tooling**: recipe-row evidence ledger + `tools/progression2_recipe_row_ingest.py`
  (deterministic id/nameJa dedup, tested with a synthetic duplicate before real use, `--check`
  mode catches counter drift).
- **4 new rows ingested**, 0 duplicates against the existing 25.
- **Recipe rows evidenced**: 25 → **29 / 172** (16.9%).
- **1 row** (`margherita-pizzadb-row`) corresponds to an already-shipped game recipe — tracked as
  population-row evidence, not game-design novelty.
- **2 rows** (`pizza-a-caballo`, `fugazzeta-rellena`) require a mechanic/shape identity signal
  beyond ingredient set — independently reinforces the design draft's §10 conclusion.
- **1 open evidence gap** (`pizza-a-caballo`'s Fainá layer) preserved, not filled in.
- **Access-path note** recorded for future batches (individual profile pages as an alternate
  evidence source to pagination) — does not change this session's own `EGRESS_BLOCKED` status.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 29/172
  coverage).
- **Pending**: 143 of 172 recipe rows remain with zero evidence; 11 Phase 0B.3 ambiguous
  ingredient entries remain unresolved; `pizza-a-caballo`'s evidence gap remains open.
- **PR #183 status**: **OPEN, unmerged.**
