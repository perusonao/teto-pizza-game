# TETO Recipe Master Catalog — Fresh Analysis: 53-Entry Foundation for 160-Scale Expansion (READ-ONLY, data-first)

**v1.1 — Fresh Gate follow-up.** This revision fixes a provenance/framing issue flagged
against the original version of this report: it conflated "the `main` SHA audited at session
start" with "the PR's base SHA," and its "160" framing could be misread as describing the
current catalog size rather than a target scale. Both are corrected below; see the
"Provenance (SHA) integrity" subsection of §2 and the "53 entries vs. the 160-scale target"
framing used throughout. No catalog content (recipe/ingredient/mechanic entries or counts)
changed in this revision — only provenance labeling and framing text.

**Formal position: this is a Fresh Recipe Master Catalog — a 53-entry foundation for
160-scale expansion, not a 160-entry catalog.** "160" is an illustrative target scale/
architecture, never a current count.

**Scope:** docs/data-only. No `src/**` change. No Recipe production implementation, Inventory,
Shop, Save, Pitz, Scoring, RESULT, or EP2 change. No production deploy. No `main` merge.
**Companion catalog/schema:** `docs/design/TETO_RECIPE-MASTER-CATALOG.md`
**Companion data:** `data/recipes/pizza_master_catalog.json`,
`data/recipes/ingredient_master_catalog.json`, `data/recipes/gameplay_mechanic_master.json`
**Companion validator:** `tools/validate_recipe_catalog.py` — re-run for this follow-up,
all checks pass against the committed JSON (duplicate id, orphan reference,
`usedByRecipeCount` consistency, mechanic reference consistency, missing required fields,
etc.).
**Predecessor (not deleted, cross-referenced):** `docs/design/TETO_RECIPE-EXPANSION-20.md`

All counts in this report are copied verbatim from a Python analysis script's direct
computation over the same data structures that produced the committed JSON — not hand-tallied
— to keep the numbers internally consistent and re-derivable.

---

## 1. Why this report exists / what changed mid-task

This task began as "design the next 20 recipes" (Chapter 2). Partway through, the task's own
owner changed the primary goal to **data-first**: build the fullest honest Recipe Master
Catalog possible, analyze ingredient/mechanic reuse across the whole set, and let that
analysis — not up-front design judgment — determine implementation order. Nothing from the
20-recipe pass was discarded: all 16 of its recipe candidates (13 originally "selected" + 3
"deferred") are present in this catalog with their original reasoning intact, now joined by
30 additional candidates and 2 explicit rejected-duplicate examples, for **53 total catalog
entries**.

## 2. Source access, verification limitations, and provenance (SHA) integrity

### 2.1 Provenance — three distinct SHAs, never conflated

| Label | SHA | What it means |
|---|---|---|
| `initialAuditedMainSha` | `8918fe4bd93816b0acefe4a35106fa1a4e8653e2` | The `main` SHA this catalog's recipe/ingredient *content* was actually read and audited against, at this task's session start (before Economy & Progression 1.0 EP1 merged). |
| `prBaseShaAtCreation` | `b784cd3164f412252d6e6b1d70b52a5ec665553b` | PR #81's `base.sha` as reported by GitHub at PR-creation time (this had already advanced past `initialAuditedMainSha` because EP1 merged as PR #80 between this session starting and the PR being opened — GitHub's `base` is a floating branch ref, not a fixed commit, so it reflects `main`'s state at query time). |
| `latestMainShaAtFollowUp` (== `prBaseShaAtFollowUp`) | `b784cd3164f412252d6e6b1d70b52a5ec665553b` | `main`'s current SHA, reconfirmed via `git fetch origin` at this Fresh Gate follow-up. Identical to `prBaseShaAtCreation` in this case (no further commits landed on `main` between PR creation and this follow-up). |

**What was and wasn't re-audited at this follow-up**: `git fetch origin` was run and `main`'s
current tip was confirmed directly (not assumed). A full re-audit of everything that changed
between `initialAuditedMainSha` and `latestMainShaAtFollowUp` was **not** performed — that
would mean re-reading the entire EP1 (PR #80) diff, which is out of this task's read-only
recipe-catalog scope. Instead, a **targeted, honest check** was run: a `git diff` of exactly
the two files this catalog's content baseline depends on,
`src/data/recipes.ts` and `src/data/ingredients.ts`, between the two SHAs. Result:

- `src/data/ingredients.ts`: **byte-identical** between the two SHAs (confirmed via
  `git diff --stat`, zero output).
- `src/data/recipes.ts`: **38 insertions, 4 deletions**, entirely accounted for by EP1 adding
  a new `RecipeUnlockCondition` interface and per-recipe `unlockCondition`/`mysteryLock`
  **gating metadata** (which recipe requires which prior recipe/star threshold to unlock, and
  whether a locked card shows "？？？"). EP1 did **not** change any recipe's `id`, `nameJa`,
  `requiredIngredients`, or `bakeTarget`, and did not add or remove any recipe (still exactly
  7). The full diff was read and is reproduced in this report's git history for anyone who
  wants to re-check it directly.

**Conclusion**: this catalog's `verified_internal` (7 recipes) content — ids, ingredient
sets, bake ranges — remains accurate as of `latestMainShaAtFollowUp`. This is a narrow,
verifiable claim about two specific files, not a claim that the full `main` tree at
`b784cd3164f412252d6e6b1d70b52a5ec665553b` was comprehensively re-audited.

### 2.2 External source access

- **This session's own direct test**: a `WebFetch` to `en.wikipedia.org` returned
  `EGRESS_BLOCKED`. This reconfirms PR #79's finding (pizzadb.jp and every other domain
  tested were blocked at the network-proxy level, not by robots.txt/ToS) using this session's
  own evidence rather than citing PR #79 alone. (This test was performed once, earlier in the
  same session that produced the original catalog; it was not re-run at this follow-up, which
  made no new external-access attempt.)
- Consequently, **no recipe or ingredient in this catalog is marked as verified against an
  external source.** `verified_internal` is used only for the 7 recipes already shipped in
  `src/data/recipes.ts`, and means **implementation-correspondence verified** (matches the
  production source exactly) — **not** that the recipe's real-world culinary facts were
  checked against pizzadb.jp or any other external cooking reference. `game_design_candidate`
  and `verification_pending` are, despite their names, **also not externally verified** —
  both mean "general culinary knowledge, unverified against any external source this
  session." **Externally verified recipe count: 0.** See
  `docs/design/TETO_RECIPE-MASTER-CATALOG.md` §5 for the exact per-status definitions.
- PIZZA DB (pizzadb.jp) was treated strictly as it's defined in `PIZZA_GAME_SSOT.md` §1:
  inspiration/reference only. No PIZZA DB text, image, or structured data was copied — none
  was even reachable this session.
- This did **not** block the game-design/data-structuring work. Mechanic classification,
  ingredient deduplication, implementation-class judgment, and the full efficiency analysis
  below are all independent of external source access and are complete for this pass.

## 3. 53 entries vs. the 160-scale target — stated honestly, not padded

**Formal position, restated for absolute clarity: this is a Fresh Recipe Master Catalog —
a 53-entry foundation for 160-scale expansion.** "160" names an architecture/target scale
this catalog's schema and analysis method are designed to grow toward; it is never the
current entry count, and nothing in this report should be read as claiming a 160-entry
(or 160-verified) catalog exists.

| Metric | Value |
|---|---|
| Illustrative target scale (architecture, not a count) | 160 (unchanged historical reference point, never re-verified) |
| **Total catalog entries produced this session** | **53** |
| Viable entries (excludes rejected-duplicates) | 51 |
| Rejected-duplicate entries (explicit anti-padding examples) | 2 |

**53 is not 160, and this report does not pretend otherwise.** The gap (~107 entries short of
the illustrative ceiling) exists because this pass deliberately stopped adding candidates once
it could no longer defend a recipe as a real, distinct, independently-corroborated dish
without either (a) external source access to check an increasingly obscure regional variant,
or (b) risking the exact padding/duplication problem the task explicitly prohibited (see §7 of
the design doc for two recipes — `bufalina`, `contadina` — caught and rejected during this
pass for exactly that reason). Closing the remaining gap is future work, not a shortfall to be
papered over now; see §11.

## 4. Full status breakdown

| `verificationStatus` | Count |
|---|---|
| `verified_internal` (Chapter 1, shipped) | 7 |
| `game_design_candidate` | 21 |
| `verification_pending` | 18 |
| `deferred` | 5 |
| `rejected_duplicate` | 2 |
| **Total catalog entries** | **53** |

Current canonical (production) recipe count: **7**. Proposed total catalog size (viable,
non-rejected): **51**.

## 5. Ingredient counts

| Metric | Value |
|---|---|
| Unique ingredient count (existing + new) | 62 |
| Existing ingredients (`src/data/ingredients.ts`, unchanged) | 14 |
| New candidate ingredients | 48 |
| Recipes buildable with the existing 14 ingredients only | **5** — `mezza-e-mezza`, `fugazzeta`, `stuffed-crust`, `ny-style`, `greek-style` (all need a new *mechanic*, not a new ingredient) |
| Recipes needing exactly +1 new ingredient | **17** |
| Recipes needing exactly +2 new ingredients | **10** |
| Recipes needing +3 or more new ingredients | **12** |

(Existing-only / +1 / +2 / +3 counts are computed from each recipe's full ingredient set minus
the existing 14 — **not** from which recipe happened to introduce an ingredient first — so a
recipe reusing an already-catalogued new ingredient still counts that ingredient as "needed.")

## 6. Ingredient usage ranking (Top 20, within the current 53-entry dataset)

**All counts below are computed within the current 53-entry (51-viable) candidate dataset
only.** They are not, and cannot yet be, a claim about usage at full 160-scale — no dataset
of that size exists. Treat this ranking as a signal from the sample built so far, to be
re-run as the catalog grows.

| Rank | Ingredient | Recipe count | Existing/New |
|---|---|---|---|
| 1 | mozzarella | 38 | existing |
| 2 | tomato-sauce | 33 | existing |
| 3 | olive-oil | 12 | existing |
| 4 | onion | 9 | existing |
| 5 | oregano | 7 | existing |
| 6 | mushroom | 6 | existing |
| 7 | ham | 5 | **new** |
| 7 | sausage | 5 | **new** |
| 9 | garlic | 4 | existing |
| 9 | pepperoni | 4 | **new** |
| 11 | anchovy | 3 | **new** |
| 11 | bell-pepper | 3 | **new** |
| 11 | black-olive | 3 | **new** |
| 11 | chicken | 3 | **new** |
| 11 | bacon | 3 | **new** |
| 11 | mayo | 3 | **new** |
| 17 | basil | 2 | existing |
| 17 | gorgonzola | 2 | existing |
| 17 | fontina | 2 | existing |
| 17 | parmigiano | 2 | existing |

The 3 Chapter-1 Starter ingredients (`tomato-sauce`, `mozzarella`, `olive-oil`'s sauce-family
peers) remain the most-reused ingredients even across a 51-recipe catalog — validating
Chapter 1's original ingredient choices independent of this analysis.

## 7. Highest-value new ingredients (greedy incremental-unlock efficiency, within the current dataset)

**This is a within-dataset ranking, not a full-160-scale claim.** Greedy set-cover over the
44 new (non-Chapter-1) viable candidates *currently catalogued*: at each step, which single
not-yet-added ingredient unlocks the most additional, not-yet-buildable recipes (accounting
for recipes that need *combinations* of new ingredients, not just single ones)?

| Step | + Ingredient | New recipes unlocked | Recipes |
|---|---|---|---|
| 1 | `sausage` | **+3** | salsiccia, boscaiola, chicago-deep-dish |
| 2 | `anchovy` | +2 | napoletana, romana |
| 3 | `pepperoni` | +2 | pepperoni, detroit-style |
| 4 | `ricotta` | +2 | calzone, ricotta-bianca |
| 5 | `artichoke` | +2 | quattro-stagioni, ai-carciofi |
| 6–20 | breadcrumb, bacon, caciocavallo, rosemary, porcini, nduja, truffle, ham, black-olive, pineapple, tuna, prosciutto-crudo, arugula, bell-pepper, zucchini | +1 each | (single-recipe unlock each) |

**`sausage` is the single highest-value new ingredient** — it unlocks 3 recipes (a simple
Early-tier `salsiccia`, a Mid-tier `boscaiola`, and — combined with the `specialShapePan`/
`layeredReverseOrder` mechanics — the Master-tier `chicago-deep-dish`) for one ingredient-data
addition. `ricotta` and `artichoke` are notable for resolving their own §"cost warning" status
from the 20-recipe pass: once added, they stop being single-recipe-bound.

## 8. Gameplay mechanic analysis (within the current 53-entry dataset)

**Every recipe count below is measured within the current 53-entry candidate dataset.** It is
not a claim about mechanic ROI at full 160-scale — that would require a 160-entry dataset,
which does not exist yet. "`postBakeFinishing` = 15 recipes" means exactly that: 15 of the 51
viable recipes *currently catalogued* need it, not "15 out of a 160-recipe universe" and not
"the best mechanic at any possible future scale." Re-run this analysis as the catalog grows.

| Mechanic | Recipe count | Status |
|---|---|---|
| `spread` / `scatter` (baseline, shipped) | 51 (all) | existing |
| **`postBakeFinishing`** | **15** | new_required (Class D) |
| `specialShapePan` | 4 | new_required (Class D) |
| `quadrantPlacement` | 1 | new_required (Class D) |
| `halfAndHalfSplit` | 1 | new_required (Class D) |
| `foldDough` | 1 | new_required (Class D) |
| `stuffedDough` | 1 | new_required (Class D) |
| `layeredReverseOrder` | 1 | new_required (Class D) |
| `ringPlacement` | 1 | new_required (Class C — smaller than a full fold) |
| `centerPlacement` (`eggCenter`) | 0 (retrofit-only) | gap — not needed by any new candidate; recommended Bismarck retrofit instead of a duplicate new recipe (see `TETO_RECIPE-EXPANSION-20.md` §6.5) |

- **Recipes buildable with baseline mechanics only (no new mechanic at all):** 28 of 51 viable
  (55%).
- **Recipes needing at least one new mechanic:** 23 of 51.
- **Within the current 53-entry dataset, `postBakeFinishing` is overwhelmingly the
  highest-value single mechanic investment** (not a claim about the eventual 160-scale
  catalog, which doesn't exist yet to measure): one
  subsystem (a new post-BAKE, pre-RESULT phase supporting scatter/drizzle/dusting/shaving
  sub-placements, gated by a `finishingOnly` ingredient flag — see
  `TETO_RECIPE-EXPANSION-20.md` §6.1 for the engineering sketch, which reused existing
  `spread`/`scatter` primitives and needed no new coordinate math) unlocks **15 recipes**,
  more than triple the next-highest mechanic (`specialShapePan`, 4 recipes).
- Every other new mechanic (`quadrantPlacement`, `halfAndHalfSplit`, `foldDough`,
  `stuffedDough`, `layeredReverseOrder`, `ringPlacement`) unlocks exactly **1** recipe each in
  this catalog — each is a large, bespoke engineering investment for a single payoff. This is
  the single clearest efficiency signal in the whole analysis: build `postBakeFinishing`
  early; treat the six single-payoff mechanics as expensive, low-urgency, Master-tier content
  to be spaced out rather than batched.

## 9. Implementation Class distribution (51 viable entries)

| Class | Count | Meaning |
|---|---|---|
| A | 7 | Zero new ingredient, zero new mechanic (the 7 shipped Chapter-1 recipes, exactly — no candidate qualifies for free). |
| B | 19 | New ingredient(s) only, existing `spread`/`scatter` mechanics. |
| C | 1 | Small scoped extension (`stuffed-crust`'s ring-only stuffing). |
| D | 21 | Genuinely new operation required. |
| E | 3 | Deferred/rejected for design (naming-identity) reasons, independent of build cost — `romana`, `ny-style`, `greek-style` are all technically Class-B-cheap but parked on identity grounds. |

(2 additional `rejected_duplicate` entries — `bufalina`, `contadina` — are excluded from this
table; they were never assigned a production implementation class since they were rejected
outright.)

## 10. Progression tier distribution (51 viable entries, per-recipe design judgment)

| Tier | Count |
|---|---|
| starter | 2 (Chapter 1: margherita, marinara) |
| early | 9 |
| mid | 13 |
| late | 17 |
| master | 10 |

## 11. Derived implementation roadmap (the primary output of this analysis)

Ranking every non-deferred, non-Chapter-1 viable candidate (39 recipes) by
`(new-mechanic-count, new-ingredient-count)` — cheapest first — produces three natural,
**analysis-derived** batches, not pre-assigned ones:

### Batch 1 — pure ingredient-data investment (proposed Chapter 2)

- **19 recipes**, **0 new mechanics**, **20 new ingredients total**.
- `ai-carciofi`, `ai-funghi-porcini`, `alla-norma`, `boscaiola`, `breakfast-pizza`,
  `calabrese`, `capricciosa`, `hawaiian`, `meat-lovers`, `napoletana`, `ortolana`,
  `pepperoni`, `philly-cheesesteak`, `pizza-bianca`, `pugliese`, `ricotta-bianca`,
  `salsiccia`, `supreme`, `tonno-e-cipolla`.
- New ingredients needed: `anchovy`, `artichoke`, `bacon`, `bell-pepper`, `black-olive`,
  `breadcrumb`, `eggplant`, `ham`, `nduja`, `pepperoni`, `pineapple`, `porcini`, `provolone`,
  `ricotta`, `ricotta-salata`, `rosemary`, `sausage`, `steak`, `tuna`, `zucchini`.
- **Zero engineering beyond data authoring.** This is the highest-ROI batch in the entire
  catalog: 19 new recipes for the cost of 20 ingredient rows and no game-logic changes.
  Running total after Batch 1: **26 recipes** (7 shipped + 19).

### Batch 2 — one mechanic investment, 13 recipes (proposed Chapter 3)

- **13 recipes**, **1 new mechanic (`postBakeFinishing`)**, **27 additional new ingredients**.
- `al-tartufo`, `bbq-chicken`, `buffalo-chicken`, `diavola`, `frutti-di-mare`, `honey-fig`,
  `nutella-dessert`, `potato-bacon`, `prosciutto`, `shrimp-mayo`, `speck-e-brie`,
  `teriyaki-chicken`, `wurstel-e-patatine`.
- This is where building `postBakeFinishing` pays for itself 13 times over. Running total
  after Batch 2: **39 recipes**.

### Batch 3 — remaining structural mechanics, 7 recipes (proposed Chapter 4 / Master-tier spread)

- **7 recipes**, **6 distinct additional mechanics** (`quadrantPlacement`, `halfAndHalfSplit`,
  `foldDough`, `specialShapePan`, `layeredReverseOrder`, `ringPlacement`), only **1 additional
  new ingredient** (`caciocavallo` — everything else this batch needs was already introduced
  by Batch 1/2).
- `quattro-stagioni`, `mezza-e-mezza`, `calzone`, `siciliana`, `chicago-deep-dish`,
  `detroit-style`, `stuffed-crust`.
- Each recipe here pays for its own bespoke mechanic — the opposite economics of Batch 2.
  Recommended treatment: **don't batch this as one implementation slice**; space these across
  Master-tier content over time, prioritized by mechanic cost (`stuffed-crust`'s
  `ringPlacement` is Class C, cheapest; `chicago-deep-dish`'s combined
  `layeredReverseOrder`+`specialShapePan` is the most expensive for a single recipe payoff).
  Running total after Batch 3: **46 recipes** (all non-deferred viable candidates exhausted).

### Not yet in any batch: 5 deferred candidates

`prosciutto-e-funghi`, `romana`, `fugazzeta`, `ny-style`, `greek-style` remain `deferred` —
real dishes, held back for design-identity reasons (§6 of the design doc), not technical cost.
Revisit once their naming/mechanic-redundancy questions have a product answer, or once the
40/80/160-tier batches need low-cost filler content (`romana`/`ny-style` are technically
Class-B-cheap whenever their identity question is resolved).

**7 (Chapter 1) + 19 (Batch 1) + 13 (Batch 2) + 7 (Batch 3) + 5 (deferred) = 51 viable
entries.**

## 12. 20 → 40 → 80 → 160 expansion strategy (unchanged principles, now data-grounded)

The classification axes from the predecessor design (`TETO_RECIPE-EXPANSION-20.md` §10) are
carried forward, now demonstrated concretely by this pass rather than asserted in the
abstract:

1. **Mechanic-subsystem-first sequencing** — proven directly by Batch 2 vs. Batch 3's
   economics above (1 subsystem → 13 recipes vs. 6 subsystems → 7 recipes). Future batches
   should keep hunting for the next mechanic that clusters multiple recipes before reaching
   for single-payoff mechanics.
2. **Ingredient-reuse-first budget** — this pass's ratio is 48 new ingredients / 44 new
   recipes ≈ 1.09, pulled down specifically by Batch 1's high internal reuse (ham, ricotta,
   artichoke, black-olive, bell-pepper, sausage, pepperoni all serve 2+ recipes within this
   pass). Future batches should track this ratio per-batch, not just cumulatively.
3. **Naming-ambiguity ledger** — extended, not restarted (§6 of the design doc now has 12+
   entries vs. the predecessor's 7).
4. **Tier ceiling per batch** — Master tier, introduced by the predecessor pass, is not
   re-invented here; Batch 3 fills it out rather than adding a 6th tier.
5. **Duplicate-prevention validation** — now an actual running script
   (`tools/validate_recipe_catalog.py`), not just a written policy; it passes today and should
   be re-run after every future catalog edit.

Reaching 80–160 will require either (a) external source access to responsibly extend past
general-knowledge-defensible entries, or (b) accepting a slower cadence of additional
general-knowledge research passes like this one, each explicitly re-running the
rejected-duplicate check before adding entries. Neither path is blocked by anything in this
catalog's structure.

## 13. PR #79 disposition recommendation

**Status of this recommendation: PR #79 is NOT being closed now, and this report does not ask
anyone to close it now.** Per this Fresh Gate follow-up's explicit instruction, PR #79 stays
open and untouched until PR #81 itself has passed Fresh Gate review and has actually been
adopted as SSOT.

PR #79 (`claude/recipe-master-catalog-1j9jrb`, open, base SHA
`5d28c5dc996c0ea76aa6428f158a766165477213`, not modified by this session) catalogued the same
7 shipped recipes using a closely-related schema (this catalog's schema is a direct, compatible
descendant of it — same `sourceUrl`/`researchStatus` concept, renamed/extended here to
`sourceReferences`/`verificationStatus`). This catalog's 53-entry, cross-referenced,
validated dataset is a strict superset of PR #79's scope and depth.

**Planned/conditional recommendation (future action, contingent on PR #81's own adoption —
not an action to take today):** once PR #81 passes Fresh Gate review and is adopted as SSOT,
close PR #79 as **superseded** by PR #81, rather than updating PR #79 in place or maintaining
both as parallel "Recipe Master Catalog" SSOT candidates indefinitely. Rationale for that
future step, recorded now so it doesn't need to be re-derived later:

- The user's own instruction is explicit: **do not maintain two Master Catalogs for the same
  purpose long-term** ("同じ目的のMaster Catalogを複数作らないこと").
- PR #79's branch (`claude/recipe-master-catalog-1j9jrb`) is based on an older `main` SHA
  (`5d28c5dc99...`) than this catalog's — rebasing PR #79 forward and reconciling its 4-file,
  7-recipe-only content with this session's 53-entry catalog field-by-field would cost more
  than the merged history already living in PR #81.
- This catalog already incorporates every substantive finding from PR #79 (the same 7-recipe
  baseline, the same 4 naming-ambiguity notes, the same `eggCenter` implementation gap on
  Bismarck) — nothing in PR #79 would be lost by closing it once PR #81 is adopted, provided
  PR #81's link is referenced in the closing comment.
- **Neither this session nor this report closes PR #79.** That decision belongs to the
  repository owner/reviewer, and only after PR #81 itself clears review — not before.

If the reviewer prefers **not** to close PR #79 even after PR #81 is adopted (e.g. for
external review-thread continuity), the second-best option, recorded for that scenario: merge
PR #79 first (to its own already-stale base), then rebase PR #81 on top and note the schema
migration (`sourceUrl`→`sourceReferences`, `researchStatus`→`verificationStatus`) explicitly
in the description. This is a strictly worse path (two SSOT-adjacent PRs open simultaneously
in the interim) and is **not** the recommended path.

## 14. Scope creep check

- No `src/**` file was read for modification purposes (only read for context: `ingredients.ts`,
  `recipes.ts`, `pizzaCoordinates.ts` — all read-only, to ground mechanic-cost judgments in
  the actual existing coordinate/placement system). At this Fresh Gate follow-up, the only
  additional `src/**` interaction was a read-only `git diff` of `recipes.ts`/`ingredients.ts`
  between the two audited SHAs (§2.1) — no file was edited.
- EP1 (Economy & Progression 1.0's Recipe Unlock foundation) merged to `main` as PR #80
  between this session's start and this follow-up. It is not touched, rebased onto, or
  reimplemented by this PR. No Inventory, Shop, Save, Pitz, Scoring, or RESULT code was
  touched. No new recipe was added to reach any particular count.
- The task's mid-session pivot (20-recipe-first → 160-scale data-first) was treated as an
  explicit in-scope redirection by the task owner, not scope creep by this session — the
  original 20-recipe document was preserved, not replaced, exactly as instructed.
- One voluntary scope addition: `tools/validate_recipe_catalog.py`. Not explicitly requested
  by exact filename, but the task explicitly asked for "validation scriptも設計してください"
  — this is that script, kept outside `src/**` as instructed.

## 15. Unresolved product decisions (carried forward + new)

All 5 unresolved decisions from `TETO_RECIPE-EXPANSION-20.md` §11 still stand (Mezza e Mezza's
pairing rule, Chapter unlock-chain shape, `postBakeFinishing` UX feel, `quadrantPlacement`
tolerance, Vegetariana's own-entry question). New from this pass:

6. **Whether to actually build Batch 1 as literally "Chapter 2"** — this report recommends it
   on efficiency grounds, but the product owner may prefer a smaller, more curated Chapter 2
   (e.g. reusing the original 13-recipe pass's hand-picked mechanic-diversity set) over the
   raw 19-recipe cheapest-first batch. Both are valid; this report surfaces the data, not a
   final call.
7. **Whether `postBakeFinishing`'s 4 sub-styles (scatter/drizzle/dusting/shaving) should ship
   together or incrementally** — bundling them is what produces the 13-recipe Batch 2 payoff,
   but a smaller first slice (just scatter+drizzle) is a legitimate incremental alternative.
8. **PR #79's closure** — recommended in §13, but explicitly left to the reviewer.

---

## 16. Final base sync (PR #81, second follow-up)

Per a third follow-up request, this branch was synced to the latest `main` a second time,
after Economy & Progression 1.0 EP2 (Inventory atomic consumption, PR #82) merged:

- `git fetch origin` confirmed `main`'s tip at `397ad41c1e7e6dcd02ee300bf1a06712d4a0c019`
  (matches the SHA supplied in the request; not taken on faith — verified directly against
  `origin/main`).
- `src/data/recipes.ts` and `src/data/ingredients.ts` were diffed between the previous
  `prBaseShaAtFollowUp` (`b784cd316...`) and this new SHA: **byte-identical**. EP2 touched
  only `src/state/inventory.ts`, `src/state/gameReducer.ts`, and their own tests — nothing
  this catalog's content depends on.
- `git merge origin/main` (merge commit `cd4f80730e1d5f6e0ce8fa79ba5c5b03beb0ce6b`) — **clean,
  zero conflicts**. This branch's own files (`data/recipes/*.json`,
  `docs/design/TETO_RECIPE-EXPANSION-20.md`, `docs/design/TETO_RECIPE-MASTER-CATALOG.md`,
  `docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md`,
  `tools/validate_recipe_catalog.py`) are byte-identical before and after the merge (verified
  by diff).
- Post-merge, `git diff 397ad41... HEAD --stat -- src/ tests/` is **empty** — this PR carries
  no `src/**` or test diff of its own; every `src/**`/test file the merge brought in came from
  `main` itself.
- `initialAuditedMainSha` (`8918fe4b...`) is **not** rewritten anywhere — a new field,
  `finalPrBaseSyncMainSha` (`397ad41...`), was added alongside it in all three JSON catalogs
  and this report, keeping every provenance SHA distinct and traceable.
- `tools/validate_recipe_catalog.py` re-run post-merge: 53 recipes / 62 ingredients / 11
  mechanics, all checks pass. `catalogEntryCount`/`viableEntryCount` (53/51) and every
  recipe/ingredient/mechanic entry are byte-identical to pre-sync — confirmed programmatically,
  not just asserted.

---

## Final Report (updated: final base sync)

- **Latest `main` SHA (confirmed via `git fetch origin` at the final base sync):**
  `397ad41c1e7e6dcd02ee300bf1a06712d4a0c019` (EP2, PR #82)
- **Initial audited `main` SHA (session start, content baseline — never rewritten):**
  `8918fe4bd93816b0acefe4a35106fa1a4e8653e2`
- **PR #81 base SHA at this final sync (floating `main` ref):**
  `397ad41c1e7e6dcd02ee300bf1a06712d4a0c019` — matches latest `main` exactly, since this
  branch was just merged up to it (§16). See §2.1/§16 for why every provenance SHA label is
  kept distinct and what was/wasn't re-audited at each one.
- **Branch HEAD SHA (merge commit, final base sync):**
  `cd4f80730e1d5f6e0ce8fa79ba5c5b03beb0ce6b` — a clean merge of `origin/main` into this
  branch, zero conflicts, this branch's own 5 files byte-identical before/after (§16). (One
  trailing doc-only commit, updating this Final Report section itself with the sync's own
  SHAs, lands on top of this merge commit — check PR #81's commit list for the branch's exact
  current tip, expected to be one commit ahead of this SHA for that reason alone.)
- **Mergeability: clean, no conflicts.** Verified by actually performing the merge
  (`git merge origin/main`, §16), not by a passive "mergeable_state" read alone — the merge
  completed with the `ort` strategy and no conflict markers.
- *(Earlier Fresh Gate follow-up HEAD, superseded by the merge commit above:
  `ad1ec4364124b6982a7145ee897e635fc5948341`.)*
- **Catalog count:** 53 total entries (51 viable, 2 `rejected_duplicate`) — **not** 160; see
  §3. This has not changed since the original version of this report; only provenance/framing
  text changed in this follow-up.
- **Externally verified recipe count: 0.** No recipe or ingredient in this catalog has been
  checked against an external culinary source (pizzadb.jp and all other domains tested remain
  network-blocked — §2.2).
- **Internal implementation-verified count (`verified_internal`): 7** — the 7 Chapter-1
  recipes, meaning their id/ingredients/bakeProfile match `src/data/recipes.ts` exactly (§2.1
  confirms this is still true as of the latest `main` SHA). This is a code-correspondence
  check, not a culinary-fact verification — see §2.2.
- **Pending/candidate/deferred/rejected counts:** `game_design_candidate` 21,
  `verification_pending` 18, `deferred` 5, `rejected_duplicate` 2 (see §4 for the full
  breakdown table).
- **Validator result:** `python3 tools/validate_recipe_catalog.py` — re-run at this
  follow-up, checked 53 recipe / 62 ingredient / 11 mechanic entries, **all checks passed**
  (duplicate ids, orphan references, `usedByRecipeCount` consistency, mechanic reference
  consistency, required fields, rejected-duplicate pointer presence).
- **CI:** checked via GitHub at push time — the `build` check run was `queued`
  (id `105810073153`, not yet completed as of this report). This report does not claim a
  final CI result it hasn't observed — check PR #81's checks tab directly for the completed
  status. `src/**` is unmodified, so the repository's existing `npm ci`/lint/build/test suite
  has no reason to be affected, but that expectation is not a substitute for the actual
  completed run.
- **Unique ingredient count:** 62 (existing 14 + new 48) — unchanged by this follow-up.
- **Recipes buildable with existing 14 ingredients only:** 5. **+1 new ingredient:** 17.
  **+2 new ingredients:** 10. (unchanged by this follow-up; see §5)
- **Ingredient usage Top 20 (within the current 53-entry dataset):** see §6 (mozzarella 38,
  tomato-sauce 33, olive-oil 12, onion 9, oregano 7, mushroom 6, ham 5, sausage 5, …)
- **Highest-value new ingredients (within the current dataset):** `sausage` (+3 recipes), then
  `anchovy`/`pepperoni`/`ricotta`/`artichoke` (+2 each) — see §7
- **Mechanic counts (within the current dataset):** see §8 (`postBakeFinishing` 15,
  `specialShapePan` 4, six others at 1 each)
- **Recipes buildable with current mechanics only (`spread`/`scatter`):** 28 of 51
- **Highest-value new mechanic (within the current dataset, not a 160-scale claim):**
  `postBakeFinishing` (15 of the 51 currently-catalogued recipes need it — by far the best
  within-dataset ROI; re-measure once the catalog grows)
- **Implementation Class A/B/C/D/E counts:** A=7, B=19, C=1, D=21, E=3
- **Most efficient first addition batch (within the current dataset):** Batch 1 — 19 recipes,
  0 new mechanics (see §11)
- **New materials needed for that batch:** 20 new ingredients (see §11's full list)
- **New mechanics needed for that batch:** 0
- **160-scale expansion roadmap:** see §12 — mechanic-subsystem-first sequencing,
  ingredient-reuse budget tracking, naming-ambiguity ledger, capped tier proliferation,
  running validation script. Restated: this is an *architecture/method* for reaching 160, not
  a claim that 160 entries exist.
- **Source limitations:** pizzadb.jp and all other external domains tested remain
  network-blocked (re-confirmed directly this session, not just cited from PR #79); nothing
  in this catalog is, or has ever been, claimed as externally verified — see §2.2.
- **PR #79 disposition:** **not closed now.** Planned/conditional recommendation only, to be
  acted on after PR #81 itself passes Fresh Gate review and is adopted as SSOT: close PR #79
  as superseded at that point, not before. See §13 for full reasoning.
- **Changed files (this session, cumulative across both follow-ups + final sync):**
  `data/recipes/pizza_master_catalog.json` (provenance fields + schemaNote updated, twice —
  once for the provenance/framing follow-up, once for `finalPrBaseSyncMainSha`),
  `data/recipes/ingredient_master_catalog.json` (same), `data/recipes/gameplay_mechanic_master.json`
  (same), `docs/design/TETO_RECIPE-MASTER-CATALOG.md` (provenance/framing/verification-status
  clarifications), `docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` (this
  file). Plus, from the final base sync's merge commit only: every `src/**`/test/docs file
  EP1 (PR #80) and EP2 (PR #82) added to `main` — all of it came from `main` itself via the
  merge, none of it is this PR's own authored diff (confirmed empty in §16). No
  recipe/ingredient/mechanic *entry* in this catalog was added, removed, or recounted at any
  point across either follow-up — catalog content is unchanged from the original version of
  this PR.
- **Branch:** `claude/teto-recipe-expansion-20-0x9ykd`
- **PR:** [#81](https://github.com/perusonao/teto-pizza-game/pull/81) — OPEN, not merged.
- **Scope creep:** none. Beyond the provenance/framing text fixes (3 JSON files' top-level
  metadata, 2 markdown docs' text) and the explicitly-requested base-sync merge itself, no
  `src/**` diff, test diff, or EP2/Inventory/Shop/Save/Pitz/Scoring/RESULT file is authored by
  this PR — everything `src/**`-shaped in the diff came from the merge, not from new work
  (§16). No new recipe was added to inflate any count (§14).
- **Unresolved product decisions:** 8 items, unchanged by this follow-up, see §15.

**FINAL VERDICT: A. 53-ENTRY MASTER FOUNDATION READY FOR SSOT REVIEW**

Rationale: the catalog's *content* (53 entries, 51 viable, internally consistent, fully
validated) was already sound and remains unchanged by this follow-up. What this follow-up
fixed was **provenance labeling and framing precision**, not substance: the initial-audit SHA
vs. PR-base SHA conflation is resolved (§2.1), "160" is now unambiguously framed as a target
scale rather than a current count throughout (§3 and elsewhere), `verified_internal`'s actual
meaning (implementation-correspondence, not culinary-fact verification) is now explicit
everywhere it's used (§2.2, design doc §5), every within-dataset ranking/ROI claim now says so
explicitly (§6–§8), and PR #79's disposition is now correctly framed as a future, conditional
action rather than something to execute today (§13). **This PR is not merged** — it remains
open for SSOT review, exactly as instructed, whether the reviewer's verdict lands on A, B, or
C.
