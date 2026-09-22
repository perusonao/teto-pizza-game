# PIZZA DB ja-172 Master Evidence Report (Issue #182 / PR #183)

**Generated in Phase 0B.17 ("FINAL BULK RECOVERY"), consolidating Phase 0B through Phase 0B.16.**
Docs/data-only artifact — NOT part of `src/**`, NOT a production SSOT, NOT a merge/threshold/price
decision. Companion machine-readable index:
`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json`.

**Purpose**: a single authoritative reference for everything this repo currently knows about the
owner-reported 172-entry PIZZA DB Japanese population (`ja-172`), so future Progression 2.0 design
work does not need to re-read 17 separate phase reports. This document narrates; the JSON is the
source of truth for per-row detail.

---

## 0. Coverage headline

**155 / 172 ja-172 recipe rows evidenced (90.1%)**, as of commit `da66eeb` (Phase 0B.16) plus this
Phase's consolidation pass. **Full-population deadlock simulation remains correctly BLOCKED** —
17 rows have zero evidence, and 2 further candidates are EN-only/unconfirmed. `PR #183` stays
**OPEN, unmerged**. No `src/**` change at any point across all 17 phases. No production
`PIZZA_GAME_PROGRESSION_SSOT.md` overwrite. No unlock threshold or Pitz price finalized.

| Metric | Value |
|---|---|
| ja-172 rows evidenced | **155 / 172 (90.1%)** |
| — via comparison-table sample | 138 |
| — via dedicated individual profile-page fetch | 17 |
| Corroborations (re-confirmations of an already-evidenced row) | 40 |
| Rows requiring a mechanic/dough-identity distinction beyond ingredients | 40 |
| Rows with an explicit, preserved (not guess-filled) evidence gap | 2 |
| Rows corresponding to an existing game-design catalog entry (shipped or candidate) | 27 |
| EN-index-only candidates, not counted toward ja-172 | 2 (Black Truffle Pizza, Hokkaido Cheese Pizza) |
| ja-172 rows with zero evidence at all | 17 |

## 1. Phase 0B.17: bulk-recovery attempt and its blocker

The Phase 0B.17 trigger comment
([#5781285429](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5781285429))
authorized one sustained bulk-recovery pass and asked this session to use PIZZA DB's Japanese
topping/tag/profile pages as a reverse index to close as much of the remaining 17-row gap as
possible in a single Phase, then produce this consolidated artifact.

**This session's own network access to `pizzadb.jp` was re-verified this Phase and remains
`EGRESS_BLOCKED`** — the same result returned on every single check across all 17 phases,
without exception. This is the operative blocker: the trigger's "bulk algorithm" requires actively
browsing and fetching PIZZA DB pages to discover new candidates, which this session cannot do.

Every one of the 155 rows evidenced so far came from the repository owner's own externally-relayed
content (fetched via their own outside web access, since PIZZA DB has been inaccessible to this
session from Phase 0B onward), posted verbatim — full row data (name/origin/dough/sauce/
ingredients/source URL) — directly in each trigger comment. This Phase's trigger, uniquely among
all 17 issued so far, contains a search strategy and a list of candidate ingredient names as hints
for where new rows *might* be found, but **no actual new PIZZA DB row content** this session could
deterministically dedup and ingest.

Per the standing, repeatedly-reinforced discipline of this entire task — never invent or
guess-fill missing PIZZA DB content — this session did **not** fabricate search results or
simulate having browsed pages it cannot reach. **Coverage is unchanged this Phase: still 155/172.
Zero new rows, zero corroborations.**

What *was* completed in full this Phase: the consolidated master-evidence artifact requirement
(this report plus the companion JSON), built entirely from the existing 155-row evidence base.

**Recommended next step**: the repository owner relays a fresh batch of new PIZZA DB row content
for one or more of the 17 remaining gap dishes, or independently confirms the 2 EN-only
candidates, the same way every prior Phase (0B through 0B.16) supplied new rows — this session
will then deterministically dedup and ingest it in a subsequent Phase, exactly as before.

## 2. The 17 remaining ja-172 gap rows

**Their names, ingredients, and any other detail are unknown to this session** — PIZZA DB exposes
no accessible index this session can browse (EGRESS_BLOCKED), and no trigger comment across 17
Phases has relayed content for these specific 17 dishes. They cannot be listed by name; only their
count (172 total − 155 evidenced = 17) is known, from the owner's own repeatedly-reconfirmed
population total. **Nothing about these 17 rows is invented or guessed here.**

The 2 EN-only candidates are, by contrast, at least partially known (see §3) — they are *not*
counted among these 17, since they have some evidence (English-language only), just not evidence
that clears the ja-172 bar.

## 3. EN-only candidates, still unconfirmed for ja-172

| Candidate | Source | Blocker |
|---|---|---|
| **Black Truffle Pizza** | `https://pizzadb.jp/en/pizzas/black-truffle/` | EN-only. No Japanese-language profile page fetched. The Phase 0B.17 trigger separately noted the Japanese root's own topping census independently confirms トリュフ (truffle) occurs exactly once in ja-172 — a strong signal this dish is real and singular, but that census entry alone is not itself a Japanese profile fetch. |
| **Hokkaido Cheese Pizza** | `https://pizzadb.jp/en/pizzas/hokkaido-cheese/` | EN-only. No Japanese-language profile page fetched, despite its own Japan/Hokkaido origin. |

(A third EN-only candidate, **Lahmacun**, was resolved in Phase 0B.16 via a directly-fetched
Japanese profile and is now counted among the 155 — see
`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json`'s
`en172UnconfirmedCandidatesPhase0B15` section for its full resolution record.)

## 4. Mechanic/identity families discovered across all 17 phases

Recipe identity has repeatedly proven to need more than an ingredient set. The following distinct
mechanic/identity axes have been found, each evidenced independently (never invented), and **none
have been implemented in gameplay** — every one is recorded as design/evidence only, per the
standing scope guard:

**Dough shape/pan mechanics**: square-pan/thick-crispy-bottom (Detroit/old-forge/Grandma/
St. Louis/Quad Cities family), two-dough-sheet stuffed enclosure (calzone/fugazzeta-rellena/
Chicago stuffed), layered-reverse-order deep-dish (Chicago deep-dish), quadrant placement
(quattro-stagioni), boat/canoe-shaped dough (Turkish pide), long-fermented square tray (pizza al
taglio romana).

**Dough composition/material substitutions** (four distinct sub-categories, none merged):
vegetable-material (cauliflower-crust), multi-grain blend (pinsa romana), cheese+nut-flour keto
(fathead pizza), cookie dough (fruit dessert pizza).

**Flatbread family** (four distinct sub-types, none merged): unleavened cracker-thin (piadina
romagnola), thick olive-oil-soaked (focaccia genovese), soft pita-like (manakish), ultra-thin
crispy (Lahmacun).

**Cooking-method-level mechanic**: fried, not baked (pizza fritta) — the first row whose identity
depends on the cooking method itself.

**Lamination**: multi-layer folded pastry (feteer meshaltet), distinct from the two-sheet stuffed
family.

**Timing/preparation mechanics**: pre-cook/prep before topping (yakiniku, Lomo Saltado's beef,
kimchi's drain/stir-fry), mid-bake late-topping (natto, tarako, unagi's eel), explicit post-bake
finishing (wasabi beef, Lomo Saltado's fries, S'mores' graham cracker, the existing Detroit sauce
stripe), and a possible fifth axis — "eating-preparation"/roll-to-eat serving behavior (Lahmacun) —
flagged but not confirmed as a distinct mechanic requirement.

**Design-level finding, not yet a confirmed mechanic**: an 8-row page-8 "no-sauce raw-topping"
Italian family (asparagi/carciofi/finocchi/cavolo/zucchine/cicoria/puntarelle/radicchio) sharing a
lemon-or-balsamic + olive-oil dressing pattern with no base sauce — a candidate for a future
finishing-mechanic, recorded as an observation only.

## 5. Unresolved composition conflicts and naming-ambiguity clusters

**Conflicts against already-SHIPPED production recipes** (highest severity — nothing corrected,
new evidence recorded only):
- `fugazza` (フガッサ: olive-oil+onion+oregano, no cheese) vs. PIZZA DB's フガザ row (mozzarella,
  no olive-oil) — the opposite composition.
- `breakfast-pizza` (bacon+egg+mozzarella+tomato-sauce) vs. PIZZA DB's ブレックファーストピザ row
  (adds sausage, swaps mozzarella→cheddar, tomato-sauce→white-sauce).
- `genovese` (cherry-tomato+mozzarella+pesto) vs. PIZZA DB's ペストジェノヴェーゼピザ row
  (potato+pine-nuts, no cherry-tomato).

**Composition conflicts against unshipped candidates**: `detroit-style` (brick-cheese vs.
mozzarella), `nutella-dessert` (banana+nuts vs. strawberry), `bismarck` (fuller ham+mushroom+egg
composition), `romana` (adds mozzarella+capers), `boscaiola` (porcini + cheese-sauce-family vs.
generic mushroom + tomato-sauce), `frutti-di-mare` (complementary, not overlapping, composition).

**UNRESOLVED naming/identity conflict**: Fugazza (フガザ) vs. Fugazzetta (フガゼッタ) — PIZZA DB's
own comparison-table data gives both rows the identical ingredient multiset (reordered), which
does not actually encode the traditional cheese-less-vs-cheese-topped distinction between the two
dishes. Kept as two separate rows, explicitly flagged as needing further evidence to disambiguate.

**Naming-ambiguity clusters** (never merged on name similarity alone, per this repo's standing
discipline): the Napoletana family (shipped `napoletana` / `chilean-napolitana` /
`argentine-napolitana`, 3-way), the Bianca family (shipped `pizza-bianca` / `ricotta-bianca` /
`bianca-pizzadb-row`, 3-way), the Sicilian family (`siciliana` / `sfincione-pizzadb` /
`bianca-pizzadb-row`-adjacent, 3-way), the Calabresa family (`calabresa-argentina` /
`brazilian-calabresa`, 2-way), `speck-e-brie` (existing candidate vs. a differently-composed
PIZZA DB row), Frutti di Mare vs. Pescatore (cross-referenced, kept separate), Chicago Deep-Dish
vs. Chicago Stuffed (two real, distinct styles).

**Explicit evidence gaps preserved, never guess-filled**:
- `pizza-a-caballo` — a Fainá (chickpea-flatbread) layer is mentioned in profile prose but absent
  from the published topping list.
- `colorado-mountain-pie-pizzadb-p3` — its own second listed ingredient is `お好みの具材`, the
  already-identified excluded "toppings of your choice" placeholder, not a real ingredient.

**Source-data inconsistency preserved, not normalized**: `manakish`'s profile page header tags its
sauceFamily as オイル (oil) while the same page's own Q&A prose says ノンソース (no sauce) — PIZZA
DB's own internal contradiction, recorded as-is.

**Ambiguous ingredients still needing a product decision** (11 entries first flagged in Phase
0B.3, unresolved since): generic ground meat vs. taco-specific ground-beef, generic cheese, generic
meat, generic nuts, cheese-sauce (a sauce, not a topping), white-sauce vs. the specific
fromage-blanc-sauce, spicy-sausage vs. plain sausage, generic curry-sauce vs. the specific
curry-ketchup, green/red chili variants, and Provel cheese vs. provolone (a real, distinct St.
Louis cheese, commonly confused by name).

## 6. Population-tracking discipline (ja-172 vs. en-index)

Maintained without exception across all 17 phases: `ja-172` (the Japanese-language canonical
population) and PIZZA DB's English-language translated index are tracked as **separate**
populations. The English index's own size grew from 160 (Phase 0B/0B.1) to 172 (Phase 0B.15) —
recorded as a genuine size-history fact — but **size parity was never treated as membership
proof**. Every row counted toward the 155/172 ja-172 total traces to either a Japanese-language
comparison-table sample or a directly-fetched Japanese-language profile page; EN-sourced matches
are recorded as corroborations only (e.g. "Egg Pizza" vs. `breakfast-pizza-pizzadb-p11`) and never
increment coverage. Enforced continuously by `tools/progression2_evidence_invariants.py`'s
`population_tag_no_en160_leak` check, which has passed on every single re-run across all 17
phases.

## 7. Implications for Progression 2.0 design (not decided here)

- **Recipe identity needs more than an ingredient set.** 40 of 155 evidenced rows (26%) require a
  mechanic/dough/cooking-method distinction beyond their topping list — this is now a
  well-evidenced, recurring pattern (design draft §10's original finding, reinforced independently
  many times over), not a one-off.
- **At least 9 distinct new mechanic/identity axes** were found beyond the game's existing
  baseline mechanics (fold/stuff, quadrant, layered-reverse, square-pan) — 4 dough-composition
  variants, 4 flatbread variants, plus fried-cooking-method, lamination, boat-shape, and several
  timing-based (pre-cook/late-topping/post-bake) mechanics. None implemented; all flagged as
  future design candidates only.
- **9 composition conflicts** (3 against shipped recipes, 6 against unshipped candidates) are
  accumulated, unresolved product decisions — each represents a case where PIZZA DB's own
  published data diverges from this repo's existing catalog, and picking a side (or keeping both
  as distinct dishes) is an explicit product call, not something this session should decide
  unilaterally.
- **7 naming-ambiguity clusters** (2-way to 3-way) are tracked, all deliberately kept as separate
  candidate ids per this repo's never-merge-on-name-alone discipline — future design work
  disambiguating any of them should start from this report's §5, not re-derive the finding.
- **17/172 rows remain completely unevidenced**, and this session has no independent means to
  close that gap — further progress is gated on the repository owner relaying more PIZZA DB
  content, exactly as in every prior phase.

## 8. Validators — all clean

```
$ python3 tools/validate_recipe_catalog.py
Checked 53 recipe entries, 62 ingredient entries, 11 mechanic entries.
All checks passed.

$ python3 tools/progression2_phase0_analysis.py
Viable population: 51 recipes, 62 canonical ingredients
Deadlock state count: 0

$ python3 tools/progression2_phase0b_analysis.py
PARTIAL-POOL analysis, not a full-172 result.

$ python3 tools/progression2_ingredient_canonicalizer.py
PASS: all 36 Phase 0B.1 names reclassify identically.

$ python3 tools/progression2_recipe_row_ingest.py --check
OK: stored counters match a fresh recomputation. 155/172 (90.1%).

$ python3 tools/progression2_evidence_invariants.py
[PASS] sauce_family_sum_172
[PASS] occurrence_not_recipe_rows
[PASS] population_tag_no_en160_leak
[PASS] full_deadlock_blocked_unless_172_covered: only 155/172 recipe rows have evidence
All 4 invariants passed.
```

## 9. Scope guard (confirmed, same as every prior Phase)

- `src/**`: not modified, at any point across all 17 phases.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB descriptive prose copied — only factual row fields and this session's own
  dedup/mechanic/conflict/population-discipline notes, across all 17 phases.
- No merge to `main`.
- No gameplay mechanic implemented from any evidence finding.
- No ja-172 gap ever filled by invented, guessed, or EN-only-sourced content.

**PR #183 status: OPEN, unmerged.**
