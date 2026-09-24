# Progression 2.0 — Ingredient Canonicalization Rules (Issue #182 / PR #183, Phase 0B.2)

Status: **Design/tooling artifact — audit only. No `src/**` change. Not wired into CI.**
Defines the deterministic procedure `tools/progression2_ingredient_canonicalizer.py`
implements, so that a future owner-provided ingredient name (e.g. the occurrence-tier 4/3/2/1
long tail, once relayed) can be classified **reproducibly**, without re-deriving judgment calls
from scratch each time, and without silently drifting from the disposition calls Phase 0B/0B.1
already made.

## Why this exists

Phase 0B and Phase 0B.1 each classified externally-relayed ingredient/recipe names into
`exact_alias` / `likely_alias` / `genuinely_new` / `ambiguous` by direct reasoning, entry by
entry. That reasoning is sound but **not yet a reusable procedure** — a future session ingesting
the occurrence-tier 4/3/2/1 long tail (once the owner relays it) would otherwise have to
re-derive the same judgment calls from nothing, risking inconsistent results (e.g. classifying
`coriander` as `genuinely_new` in one pass and `likely_alias` to `cilantro` in another). This
document fixes the procedure; the script applies it mechanically.

## Rule order (applied top to bottom, first match wins)

Given a candidate ingredient `(nameJa, nameEnHint?)`:

1. **`exact_alias`** — `nameJa` is byte-identical to an existing canonical ingredient's `nameJa`
   field (`data/recipes/ingredient_master_catalog.json`, or a Phase 0B/0B.1-introduced id's
   `nameJa` in the staging files), **or** byte-identical to an entry in that ingredient's
   `aliases` array. No judgment call — pure lookup.
2. **`likely_alias`** — `nameJa` matches an entry in the **curated synonym table**
   (`LIKELY_ALIAS_TABLE` in the script) — a maintained, versioned, human-reviewed list of
   known same-ingredient/different-common-name pairs (e.g. コリアンダー↔cilantro, the same plant
   under two common names). Every entry in this table must carry a one-line justification
   comment in the script — no synonym is added without one. **Not** a fuzzy-string-match
   algorithm (deliberately — fuzzy matching risks merging genuinely distinct ingredients that
   happen to share characters, which is exactly what the naming-ambiguity ledger exists to
   prevent).
3. **`ambiguous`** — `nameJa` matches an entry in the **curated ambiguity table**
   (`AMBIGUOUS_TABLE` in the script) — pairs/groups already identified as having an unresolved
   relationship to an existing or other-candidate id (e.g. `ground-meat` vs. `ground-beef`,
   `chili` vs. `chili-oil`, `beef` vs. `steak`/`ground-beef`). Never silently resolved by the
   script — always surfaces for a human product decision.
4. **`genuinely_new`** — `nameJa` matches an entry in the **registry of already-confirmed new
   ingredients** (`GENUINELY_NEW_REGISTRY` — the 6 ids Phase 0B.1 already established: `beef`,
   `lemon`, `green-pepper`, `green-onion`, `shiso`, `pork`), so a repeat sighting of the same
   ingredient in a later relayed batch is recognized as the *same* new id, not registered twice
   under a second id.
5. **`needs_review`** (not one of the 4 Phase 0B/0B.1 disposition values — a 5th, script-only
   status) — none of the above matched. This is the **only** case where the script does not
   auto-classify; it is queued for a human/future-session judgment call, and **must not** be
   auto-promoted to `genuinely_new` without that review (a candidate might be a genuine new
   ingredient, or might be an unrecognized synonym/ambiguity the curated tables haven't caught up
   with yet).

## Non-goals

- This procedure does **not** decide whether a `genuinely_new`/`ambiguous` entry should be added
  to `data/recipes/ingredient_master_catalog.json` proper — that remains a separate, explicit
  migration step (Phase 0B §2's staging-file discipline), owner-reviewed, not automatic.
- This procedure does **not** fetch or invent data. It only classifies names that are already
  given to it.
- No fuzzy/similarity-score matching — every non-exact classification traces to a named,
  justified table entry, so the classification is auditable (a reviewer can see *why* a name was
  called `likely_alias` rather than trusting an opaque score).

## Maintenance

When a future relayed batch contains a name that lands in `needs_review`, and a human/session
decides its disposition, the resolution must be added to the appropriate table
(`LIKELY_ALIAS_TABLE` / `AMBIGUOUS_TABLE` / `GENUINELY_NEW_REGISTRY`) in
`tools/progression2_ingredient_canonicalizer.py` **with a justification comment**, so the next
run of the script reflects the decision — the tables are the durable record, not this document's
prose alone.

## Game normalization decisions (Owner Decision layer, 2026-09-24)

The tables above record **PIZZA DB evidence dispositions**. How the *game* represents a
`likely_alias` token is a separate, owner-decided layer and is **not** written back into these
tables: the token keeps its `likely_alias` disposition, and no new PIZZA DB fact is recorded.

| rule | token | game canonical id | owner decision | evidence disposition (unchanged) |
|---|---|---|---|---|
| GCR-OLIVE-01 | `オリーブ` (exact token; not `オリーブオイル`, not a colour-specified olive) | `black-olive` | OD-OLIVE = BLACK_OLIVE_CANONICAL | `likely_alias` — PIZZA DB states no olive colour |
| GCR-PARM-01 | `パルミジャーノチーズ` | `parmigiano` | OD-PARM = PARMIGIANO_CANONICAL | `likely_alias` — not promoted to `ORTHOGRAPHIC_EQUIVALENTS` |

Machine record and invariants: `docs/reports/data/TETO_PROGRESS2_W1_OWNER_DECISIONS.json`,
generated and validated by `tools/progression2_w1_evidence_resolution.py` (`--check`,
`--self-test`). A rule may only map a token to the id the canonicalizer already proposes, and must
leave the canonicalizer's disposition as `likely_alias`.
