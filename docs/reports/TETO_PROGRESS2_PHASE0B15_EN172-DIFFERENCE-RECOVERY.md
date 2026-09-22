# Progression 2.0 — Phase 0B.15: EN-172 Difference Recovery (Issue #182 / PR #183)

Status: **Phase 0B.15 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Recipe-row evidence advances from 153/172 to **154/172**. **Full-population deadlock simulation
remains correctly blocked. PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5781132555](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5781132555)
("Phase 0B.15 trigger — 153-row difference recovery via newly-complete EN-172 index"), posted by
the repository owner (`perusonao`, `author_association: OWNER`). Started from Phase 0B.14's
confirmed **153/172**, commit `bf1ae71`.

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json` (extended),
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` (updated — new
`en172UnconfirmedCandidatesPhase0B15` section, `populations.en-160` size-history update)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/pizzas/pizza-de-lomo-saltado/` re-attempted: **`EGRESS_BLOCKED`**,
unchanged. All relayed rows remain owner-relayed, not independently fetched by this session.

## 1. Central finding: EN index now reports 172, but size parity ≠ membership proof

The trigger comment relayed genuinely new evidence: PIZZA DB's English-language pizza index now
itself reports **172** translated profiles, up from the previously-observed 160. This is real,
recorded Fresh evidence and has been captured (see §4), but the trigger was explicit that this
size coincidence must **not** be silently treated as proof that the EN population's *membership*
now equals ja-172's — and this session applied that discipline consistently across all four
candidates:

- **3 of 4 candidates** (Black Truffle, Hokkaido Cheese, Lahmacun) have **only** an English-profile
  source relayed. No Japanese-language profile page was fetched for any of them. Per the standing
  `population_tag_no_en160_leak` invariant (`tools/progression2_evidence_invariants.py`) and the
  trigger's own explicit instruction, these are **NOT** ingested into the counted ja-172 ledger.
  They are tracked separately — see §3.
- **1 of 4** (Lomo Saltado) has a **directly-fetched Japanese-language profile**
  (`https://pizzadb.jp/pizzas/pizza-de-lomo-saltado/`) — this clears the bar for genuine ja-172
  evidence and **is** ingested normally (§2).

## 2. Pre-ingestion cross-check and ingestion: Lomo Saltado

`ロモ・サルタード・ピザ` was checked against all 153 existing rows by both plausible transliterations
— no match found, confirmed genuinely new. Ingested as a new `individual_profile_page`-origin row:

```
Ingested 1 new row(s), recorded 0 corroboration(s) (duplicates, not counted as new).
Unique recipe rows evidenced: 154 / 172
```

Its profile carries **two** distinct mechanic-evidence findings on one dish: beef and vegetables
are stir-fried first (pre-cook/prep, same category as Phase 0B.14's `yakiniku-pizza`), and the
fries are added just before the bake finishes (late-topping/timing, same category as Phase
0B.13/0B.14's natto/unagi/tarako findings). Both recorded as evidence only.

All 5 ingredient names (beef, onion, fresh-tomato, french-fries, mozzarella) classified
deterministically with **zero** `needs_review` using the existing tables — fifth consecutive Phase
(0B.11 through 0B.14) where the accumulated canonical set fully covered a new batch without a
table extension.

### 2.1 Control/dedup case: "Egg Pizza" — EN-sourced corroboration, not new coverage

The trigger's own control case: PIZZA DB's EN "Egg Pizza" profile
(`https://pizzadb.jp/en/pizzas/breakfast-pizza/`) has an **identical** ingredient set (egg, bacon,
sausage, cheddar, white sauce) to the already-JA-evidenced `breakfast-pizza-pizzadb-p11` (Phase
0B.12). Recorded as a **manual corroboration** — provenance kept explicit as EN-sourced, not
rewritten as Japanese-page evidence, and **not** counted toward ja-172 coverage, per the trigger's
explicit instruction.

## 3. Three EN-only candidates: recorded, deliberately not counted

`Black Truffle Pizza`, `Hokkaido Cheese Pizza`, and `Lahmacun` are recorded in a new
`en172UnconfirmedCandidatesPhase0B15` section of the evidence-status ledger, with full field
detail, mechanic notes (Black Truffle's post-bake truffle-shaving finish; Hokkaido Cheese's
pre-cook parboiled potatoes; Lahmacun's spread + post-bake finish + roll-to-eat identity — a
possible new "eating-preparation" mechanic axis), and an explicit per-candidate blocker: *EN-only,
no Japanese-language profile page fetched.* None of the three touch
`recipeRowEvidence.evidencedCount` or the counted `individualProfilePageRows` array. New open item
added asking for Japanese-side confirmation of each.

## 4. `populations.en-160` updated with a size-history record, not a membership claim

- `claimedTotal`: 160 → **172** (the Fresh-observed current value).
- New `sizeHistory` array documents both observations (160 at Phase 0B/0B.1; 172 as of this
  Phase), with an explicit note that the size match is *not* evidence of per-item correspondence —
  concretely demonstrated by §3's three unconfirmed candidates.
- `usableForJa172Completeness` and `isCanonicalPopulationForIssue182` both remain **unchanged**,
  explicitly `false`.
- The JSON key itself stays `"en-160"` (not renamed to `"en-172"`) — it is the stable identifier
  `tools/progression2_evidence_invariants.py`'s `population_tag_no_en160_leak` check targets by
  name; renaming it would be a tooling change outside this Phase's scope. The label field notes
  this explicitly.

## 5. Full deadlock — still correctly blocked

```
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (181 named) and recipe rows (154
evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak: en-160 is explicitly marked non-usable for ja-172
completeness; all evidenced sections are tagged ja-172
[PASS] full_deadlock_blocked_unless_172_covered: only 154/172 recipe rows have evidence -- any
deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

The `population_tag_no_en160_leak` pass here is the load-bearing check for this Phase's central
finding — it confirms the en-160→en-172 size update did **not** leak any EN-only evidence into the
counted ja-172 total.

## 6. Counters (per the trigger comment's explicit request)

| Counter | Value |
|---|---|
| Unique recipe rows evidenced / claimed total | **154 / 172** (89.5%) |
| New unique rows this Phase | 1 (`pizza-de-lomo-saltado`, JA-profile-sourced) |
| Corroborations this Phase | 1 (manual, EN-sourced "Egg Pizza") |
| Corroborations total (cumulative, Phase 0B.5–0B.15) | 40 |
| `individual_profile_page`-origin rows (cumulative) | 16 (was 15) |
| EN-only candidates recorded but NOT counted (this Phase) | 3 (Black Truffle, Hokkaido Cheese, Lahmacun) |
| Rows requiring mechanic/dough identity (this Phase) | 1 (`pizza-de-lomo-saltado`) |
| Rows requiring mechanic identity (cumulative) | 34 |
| New ingredient-table entries (this Phase) | 0 |
| Pending rows | 18 |

## 7. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/mechanic/population-discipline notes.
- No merge to `main`. No gameplay mechanic implemented.
- No EN-only evidence used to mark a ja-172 gap as filled.
- `python3 tools/validate_recipe_catalog.py`, `progression2_phase0_analysis.py`,
  `progression2_phase0b_analysis.py`, `progression2_ingredient_canonicalizer.py` (self-test),
  `progression2_recipe_row_ingest.py --check`, `progression2_evidence_invariants.py` — all run
  clean.

## 8. Final Report (Phase 0B.15)

- **Central discipline applied and held**: PIZZA DB's EN index now reports 172 profiles, the same
  size as ja-172 — but size parity was explicitly treated as a candidate/difference locator only,
  never as proof of membership equivalence. 3 of 4 relayed candidates were EN-only and correctly
  **not** counted; only the 1 candidate with genuine Japanese-side confirmation was ingested.
- **1 new unique row** — recipe rows evidenced: 153 → **154 / 172** (89.5%).
- **1 EN-sourced manual corroboration** ("Egg Pizza" vs. `breakfast-pizza-pizzadb-p11`) — recorded
  with explicit EN provenance, not counted as new coverage.
- **3 EN-only candidates recorded but excluded from the count**, each with a precise blocker
  statement (no Japanese-language profile page fetched) — new open items for Japanese-side
  confirmation.
- **`populations.en-160` updated** with a genuine size-history fact (160 → 172) while its
  `usableForJa172Completeness`/`isCanonicalPopulationForIssue182` flags stay unchanged, `false`.
- **2 new mechanic-evidence findings on `pizza-de-lomo-saltado`** (pre-cook stir-fry + late-topping
  fries) plus 3 further candidate mechanic notes recorded on the unconfirmed EN-only rows —
  including a possible new "eating-preparation" axis (Lahmacun's roll-to-eat identity).
- **Ingredient canonicalization**: 5 names, zero new table entries needed — fifth consecutive
  Phase the existing tables fully covered a new batch.
- **Full-population deadlock**: still correctly **blocked** (4/4 invariants passing, 154/172
  coverage, 89.5%) — the `population_tag_no_en160_leak` pass is the direct confirmation this
  Phase's EN-172 finding did not leak into the ja-172 count.
- **Pending**: 18 of 172 recipe rows remain with zero ja-172 evidence (plus 3 further EN-only
  candidates pending Japanese-side confirmation before they can even be considered for that count);
  all prior unresolved items still stand.
- **PR #183 status**: **OPEN, unmerged.**
