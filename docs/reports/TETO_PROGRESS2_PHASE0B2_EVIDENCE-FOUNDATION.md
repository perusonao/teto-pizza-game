# Progression 2.0 — Phase 0B.2: Evidence-Driven Ingestion Foundation (Issue #182 / PR #183)

Status: **Phase 0B.2 — audit / tooling only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Per the trigger comment's own instruction, this Phase builds **infrastructure only** — it does
not fetch, and explicitly does not invent, any new PIZZA DB content. **PR #183 stays OPEN /
unmerged.**

Trigger: PR #183 comment
[#5774835400](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5774835400)
("Phase 0B.2 — next gate: complete long-tail ingredient universe"), posted by the repository
owner (`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json`
Companion design doc: `docs/design/TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md`
Companion tooling: `tools/progression2_ingredient_canonicalizer.py`,
`tools/progression2_evidence_invariants.py`

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/` was re-attempted at the start of this Phase: **`EGRESS_BLOCKED`**,
unchanged from every prior check this session. No new external fetch was attempted beyond this
single confirmation — per the trigger comment's own instruction, this Phase's job is to build the
ingestion/validation foundation, not to keep re-probing a block already established 3 times this
session (Phase 0A, Phase 0B, Phase 0B.1).

## 1. Deliverable 1: machine-readable evidence-status ledger

`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` is the new single source of
truth for "how much of the owner-reported 172-entry population does this repo actually have
evidence for." It makes the current coverage explicit, as requested:

| Category | Status | Count |
|---|---|---|
| Ingredient occurrence, tier ≥5 (named individually) | **evidenced** | 36 |
| Ingredient occurrence, tier 4 | **pending** | 0 named (tier confirmed to exist, no names relayed) |
| Ingredient occurrence, tier 3 | **pending** | 0 named |
| Ingredient occurrence, tier 2 | **pending** | 0 named |
| Ingredient occurrence, tier 1 | **pending** | 0 named |
| Recipe rows (pages 1–6) | **evidenced** | 25 |
| Recipe rows (pages 7–15) | **pending** | 0 (unnamed; ~147 entries unaccounted for) |
| Sauce-family categories (11) | **evidenced** | sums to 172 exactly |

**No name, count, or recipe row anywhere in this ledger is invented.** Every `pending` entry has
literally zero content — its only job is to record that the tier/page *exists* (per the relayed
comment) and that this repo has *nothing* for it yet, so future evidence has a clearly-labeled
slot to land in rather than needing to be freshly modeled from scratch.

## 2. Deliverable 2: deterministic canonicalization rules

`docs/design/TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md` documents a 5-rule, top-to-
bottom procedure (exact_alias → likely_alias → ambiguous → genuinely_new → needs_review), and
`tools/progression2_ingredient_canonicalizer.py` implements it as a reusable function
`classify(nameJa, ...)`, backed by three curated, justified lookup tables
(`LIKELY_ALIAS_TABLE`, `AMBIGUOUS_TABLE`, `GENUINELY_NEW_REGISTRY`) plus an orthographic-
equivalence table for kanji/kana spelling variants (e.g. 玉ねぎ/たまねぎ) and common
abbreviations (e.g. リコッタ/リコッタチーズ) — deliberately **not** a fuzzy-matching algorithm,
so every non-exact classification traces to a named, auditable, human-reviewed table entry rather
than an opaque similarity score.

**Self-test (determinism proof)**: running the script with no `--input` re-classifies all 36 of
Phase 0B.1's own named ingredients and diffs the result against Phase 0B.1's recorded
dispositions.

```
$ python3 tools/progression2_ingredient_canonicalizer.py
No --input given: running determinism self-test against Phase 0B.1's 36 recorded dispositions...
PASS: all 36 Phase 0B.1 names reclassify identically. Tables are consistent with prior findings.
```

Fixing this self-test to pass surfaced and corrected 3 small data-hygiene issues in Phase 0B.1's
own JSON (not classification errors, just inconsistent `nameJa` transcription): the
`prosciutto-crudo` row used a compound "生ハム/プロシュート" string instead of the catalog's exact
stored `生ハム`; the `green-onion` row used a compound "青ねぎ/万能ねぎ" string instead of a single
primary reading. Both were corrected to their single canonical Japanese reading (the alternate
reading is still noted in each row's `note` field, just not stored as if it were the literal
`nameJa` value). No disposition changed — only the transcription was tightened once a
machine-checkable self-test existed to catch it.

**Once a future relayed batch supplies real names for occurrence tiers 4/3/2/1**, running
`python3 tools/progression2_ingredient_canonicalizer.py --input <that batch's JSON>` classifies
every name deterministically and flags anything the curated tables don't yet cover as
`needs_review` (never silently auto-resolved).

## 3. Deliverable 3: validation invariants

`tools/progression2_evidence_invariants.py` implements the 4 invariants the trigger comment
named, each as an independently-callable, independently-testable check:

```
$ python3 tools/progression2_evidence_invariants.py
[PASS] sauce_family_sum_172: sauce-family categories sum to 172 == 172
[PASS] occurrence_not_recipe_rows: ingredient occurrence (36 named) and recipe rows (25 evidenced) are tracked as distinct, non-equal metrics
[PASS] population_tag_no_en160_leak: en-160 is explicitly marked non-usable for ja-172 completeness; all evidenced sections are tagged ja-172
[PASS] full_deadlock_blocked_unless_172_covered: full-population deadlock simulation correctly BLOCKED: only 25/172 recipe rows have evidence -- any deadlock result must stay scoped to a partial pool

All 4 invariants passed.
```

| Invariant | What it guards against |
|---|---|
| `sauce_family_sum_172` | The 11-category sauce-family breakdown silently drifting from summing to 172 (e.g. if a future edit adds/removes a category without updating the total) |
| `occurrence_not_recipe_rows` | An ingredient-occurrence count (how many recipes use an ingredient) ever being read as if it were a recipe-row count (how many recipes exist) — these are structurally different metrics over the same population and must never be conflated |
| `population_tag_no_en160_leak` | Any English-160-subset-sourced count/name being used to mark a Japanese-172 gap as filled — every evidenced section must explicitly carry `population: "ja-172"` |
| `full_deadlock_blocked_unless_172_covered` | A "full population deadlock = 0" claim being made before all 172 recipe rows have evidence — currently correctly **blocked** at 25/172 |

This is a reusable guard: any future script that wants to claim a full-172-population
deadlock/reachability result must call (or be checked against) this invariant first, exactly the
way `tools/validate_recipe_catalog.py` already gates the recipe/ingredient master catalog's own
internal consistency.

## 4. Stop condition — reached, as instructed

Per the trigger comment's explicit stop condition: **the actual long-tail ingredient names
(occurrence tiers 4/3/2/1) and the remaining ~147 recipe rows (pages 7–15) are not available
inside this Claude Code session** (§0 — `EGRESS_BLOCKED`, unchanged). This Phase therefore stops
here, having built the ingestion/validation foundation, and reports exactly what external
evidence is still required (§5) rather than inferring or fabricating any of it.

## 5. Explicit list of external evidence still required

1. **Occurrence-tier 4/3/2/1 ingredient names + exact counts** (ja-172 population) — format:
   name (Japanese), occurrence count, source page/URL. Feeds directly into
   `tools/progression2_ingredient_canonicalizer.py --input`.
2. **Recipe rows for PIZZA DB compare pages 7–15** (ja-172 population) — format: dish name,
   sauce family, main ingredients, source page number. Same format Phase 0B's 25 samples already
   used.
3. **Independent re-verification of everything already relayed** (25 recipe samples + 36
   ingredient names) — requires this Claude Code session's own `pizzadb.jp` access to become
   unblocked, or an owner-side confirmation pass.

None of the above is fabricated or estimated in this Phase. The evidence ledger (§1) records each
as an explicit, zero-content `pending` slot.

## 6. Scope guard (confirmed, same as Phase 0A/0B/0B.1)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB text/image/site-structure copied — only ingredient/dish names and this session's
  own independently-authored classification logic and commentary.
- No merge to `main`.
- `python3 tools/validate_recipe_catalog.py` — still all-pass, unaffected by this Phase.
- `python3 tools/progression2_phase0_analysis.py` / `progression2_phase0b_analysis.py` — both
  still run clean, unaffected by this Phase (this Phase added no new recipe rows).

## 7. Final Report (Phase 0B.2)

- **New artifacts**: evidence-status ledger (JSON), canonicalization rules (design doc),
  deterministic classifier (script, self-test passing), validation invariants (script, 4/4
  passing).
- **Coverage made explicit**: 36/unknown ingredient names (tier ≥5 evidenced, tiers 4/3/2/1
  pending with zero invented content); 25/172 recipe rows evidenced (147 pending).
- **Data-hygiene fixes**: 2 `nameJa` transcription corrections in Phase 0B.1's JSON, surfaced by
  the new self-test; no disposition changed.
- **Invariants**: 4/4 passing, including the one that currently and correctly **blocks** any
  full-172-population deadlock claim.
- **Stop condition reached**: no new external evidence available in this session; exact gap list
  above (§5) is what's needed to proceed.
- **PR #183 status**: **OPEN, unmerged.**
