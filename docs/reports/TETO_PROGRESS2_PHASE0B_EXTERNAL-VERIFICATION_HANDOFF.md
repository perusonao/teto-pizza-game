# Progression 2.0 — Phase 0B: External-Verification Handoff (Issue #182 / PR #183 follow-up)

Status: **Phase 0B — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
**This Phase is explicitly NOT marked complete** — the full 172-entry PIZZA DB population has
not been independently substantiated (see §1), so per this task's own instruction, Phase 0B
stops here, open, rather than being reported as done.

Companion Phase 0A audit (retained, unchanged content, relabeled only):
`docs/reports/TETO_PROGRESS2_PHASE0_FULL-CATALOG_FRESH-AUDIT.md`
Companion design draft (extended with §10): `docs/design/TETO_RECIPE-DISCOVERY-PROGRESSION_2.0.md`
Companion Phase 0B staging data: `docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json`
Companion Phase 0B analysis output: `docs/reports/data/TETO_PROGRESS2_PHASE0B_analysis-output.json`
Companion tooling: `tools/progression2_phase0b_analysis.py`

---

## 0. Trigger for this Phase

PR #183 comment [#5774563418](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5774563418),
posted by the repository owner (`perusonao`, `author_association: OWNER`), relayed a claim that a
ChatGPT Codex session's own external web access successfully fetched `pizzadb.jp`'s "世界のピザを
比較" comparison table, reporting **172 registered pizzas across 15 pagination pages**, and
included 25 sample dish names + main-ingredient lists drawn from pages 1–6.

## 1. Source / Provenance Gate — this session's own re-check

- **This session's own direct fetch attempts, repeated at this Phase 0B follow-up**:
  `WebFetch https://pizzadb.jp/` and `WebFetch https://pizzadb.jp/compare/world-pizzas/` both
  returned **`EGRESS_BLOCKED`** again — identical result to Phase 0A and every prior session.
  **This Claude Code session still cannot independently fetch pizzadb.jp.** The relayed comment's
  own explanation ("実行環境差" — a different execution environment) is plausible (the relaying
  agent runs in a different sandbox with different network policy) but is **not something this
  session verified**; it is recorded as the relayed claim's own stated reasoning, not confirmed
  fact.
- **Trust model applied**: the PR comment's *author* (repository owner) is a trusted instruction
  channel — this Phase 0B proceeds on their explicit direction. The comment's *content* (the
  specific PIZZA DB facts within it) is treated as **external, relayed, unverified-by-this-
  session evidence** — recorded, cross-referenced, and used, but never silently upgraded to
  "independently confirmed" anywhere in this Phase 0B's output. Every entry derived from it
  carries `verificationStatus: "external_relayed_pending_independent_verification"`
  (`docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json`'s own schema note),
  a status distinct from every existing enum value in `TETO_RECIPE-MASTER-CATALOG.md` §5 — never
  conflated with `verified_internal` or `game_design_candidate`.
- **No PIZZA DB text, image, or site structure is copied into this repository.** Only dish names
  (treated as facts about real-world dish existence, the same practice the existing 53-entry
  catalog already uses for e.g. `hawaiian`/`supreme`/`chicago-deep-dish`) and an **independently
  authored** ingredient-id mapping and cross-reference commentary are recorded. No PIZZA DB
  description text or table layout is reproduced verbatim.

### 1.1 Coverage: what fraction of the claimed 172 this Phase 0B actually has evidence for

| | Count | % of claimed 172 |
|---|---|---|
| Pages sampled in the relayed comment | 6 of 15 | 40% of pages |
| Individual dish samples provided | 25 | **14.5%** of 172 |
| Pages with zero evidence (7–15) | 9 of 15 | ~108 entries (**~63%** of 172) entirely unaccounted for |

**This is a sample, not a census.** Per the task's own instruction, this Phase 0B does not
guess-fill the remaining ~108–147 entries (172 minus the 25 sampled, allowing that some of the 6
sampled pages may not have been 100%-exhaustively relayed either — the comment does not state an
exact per-page count, only that "少なくとも page 1〜6 はFresh取得して内容確認済み"). See §7 for
the explicit gap list.

## 2. Machine-readable schema for the 172-scale target (established this Phase)

Rather than fork a second, competing Master Catalog (forbidden by the repository owner's own
standing instruction, `TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` §13), Phase 0B
introduces one new **provenance-tier field concept**, layered on top of the existing
`data/recipes/pizza_master_catalog.json` schema (`TETO_RECIPE-MASTER-CATALOG.md` §3) without
modifying that file:

| Field (conceptual, not yet written into the shared JSON) | Values | Purpose |
|---|---|---|
| `sourceVerificationTier` | `internal_production` \| `game_design_judgement` \| `external_relayed_pending_independent_verification` \| `external_verified_by_claude_session` (none yet) | Separates the 3 provenance buckets Issue #182 §1 requires, generalized to also carry a 172-scale external-source tier without collapsing it into the existing `verificationStatus` enum (which is about culinary/implementation correspondence, a different axis). |
| `externalSourceUrl` / `externalSourceFetchedBy` / `externalSourceFetchedDate` | free text | Only present when `sourceVerificationTier` is one of the two `external_*` values. Never present on a `game_design_judgement` entry (no source to cite). |

**Migration approach**: once entries reach `external_verified_by_claude_session` (this session,
or a future session with working egress, independently re-fetches and confirms an entry), or
once a `external_relayed_*` entry has been manually reviewed and accepted by the repository
owner, that entry graduates from the Phase 0B staging file
(`TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json`) into
`data/recipes/pizza_master_catalog.json` proper, gaining a normal `verificationStatus`
(`game_design_candidate`/`verification_pending`, matching the existing catalog's own discipline)
**and** the new `sourceVerificationTier`/`externalSourceUrl` fields, exactly as
`tools/validate_recipe_catalog.py` already enforces required fields for every other entry. **No
entry is migrated by this Phase 0B** — the staging file stays separate until that review happens
(see §7's explicit "not yet done" list).

## 3. Phase 0A retained as baseline (per explicit instruction)

`docs/reports/TETO_PROGRESS2_PHASE0_FULL-CATALOG_FRESH-AUDIT.md` and
`docs/design/TETO_RECIPE-DISCOVERY-PROGRESSION_2.0.md` §1–§9 are **unchanged in substance** —
only a status header was added to each, explicitly relabeling them "Phase 0A / existing-repo
working population" and cross-linking to this document. **Every number in Phase 0A (0 deadlock
states, 0 unreachable ingredients/recipes, the 51-recipe/62-ingredient population) remains
scoped to that existing-repo working population and is never represented as a full-172 result**,
per this Phase 0B's explicit instruction.

## 4. Sample classification — 25 relayed samples

`tools/progression2_phase0b_analysis.py` classifies every sample into exactly one bucket (no
sample counted twice):

| Bucket | Count | Meaning |
|---|---|---|
| **Confirmation** | 6 | Exact ingredient-set match to an already-catalogued Phase 0A entry — external corroboration, not added as a new pool member. (`bbq-chicken-pizzadb`→`bbq-chicken`, `quattro-stagioni-pizzadb`→`quattro-stagioni`, `quattro-formaggi-pizzadb`→`quattro-formaggi`, `supreme-pizzadb`→`supreme`, `tonno-e-cipolla-pizzadb`→`tonno-e-cipolla`, `ny-style-pizzadb`→`ny-style`) |
| **Variant (not added)** | 6 | Same name/identity as an existing entry, but a **different** ingredient composition — recorded as divergence evidence, not added as a new near-duplicate recipe (matching the existing catalog's own anti-padding discipline, e.g. how `bufalina`/`contadina` were rejected rather than added). (`capricciosa-pizzadb`, `calzone-pizzadb`, `chicago-deep-dish-pizzadb`, `siciliana-pizzadb`, `greek-style-pizzadb`, `buffalo-chicken-pizzadb`) |
| **Genuinely new candidate** | 13 | No existing catalogued match — added to the Phase 0B combined pool. (`apple-cinnamon-dessert-pizzadb`, `calabresa-argentina-pizzadb`, `vongole-pizzadb`, `aussie-pizzadb`, `currywurst-pizzadb`, `grandma-pizza-pizzadb`, `sfincione-pizzadb`, `taco-pizza-pizzadb`, `flammkuchen-pizzadb`, `chilean-napolitana-pizzadb`, `trenton-tomato-pie-pizzadb`, `new-haven-apizza-pizzadb`, `bacalhau-pizzadb`) |

Full per-sample cross-reference notes (naming-ambiguity flags, ingredient mapping, mechanic
notes): `TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json`.

### 4.1 New naming-ambiguity findings (added to the existing ledger, none merged)

| New pair/group | Risk | Disposition |
|---|---|---|
| `calabresa-argentina-pizzadb` vs. existing `calabrese` (Italy/Calabria, nduja) | Name-similar, different dish/region | Kept as two separate ids |
| `chilean-napolitana-pizzadb` vs. **shipped** `napoletana` | Name-similar (ナポリ/ナポリターナ), different composition (no anchovy, cheese-family not tomato-family) | Kept separate; shipped recipe untouched |
| `siciliana-pizzadb` vs. existing candidate `siciliana` vs. `sfincione-pizzadb` | **Three-way** — all real, differently-composed "Sicilian-style" dishes | All three kept distinct, none merged |
| `greek-style-pizzadb` (feta+olive) vs. existing deferred `greek-style` (feta withheld) | External evidence the real dish's identity does depend on `feta` — see §5 | Not un-deferred by this Phase; recorded as decision-input only |

### 4.2 New canonical ingredients introduced by the 13 new candidates (not yet in production or the Phase 0A catalog)

`apple`, `cinnamon`, `cream-cheese`, `salami` (kept distinct from existing `spicy-salami` — same
ambiguity-preservation discipline as `ham`/`prosciutto-crudo`/`speck`), `clam`, `curry-ketchup`,
`paprika-powder`, `ground-beef`, `salsa`, `cheddar`, `lettuce`, `fresh-tomato`, `tortilla-chips`,
`fromage-blanc-sauce`, `salt-cod` — **15 new ingredients**. (`feta` and `blue-cheese-dressing`
appear only in a *confirmation*/*variant* sample, not a *new-candidate* one, so they are **not**
added to the working pool's canonical ingredient set by this Phase — consistent with the existing
catalog's own anti-speculative-bloat principle for `feta`, §4.1.)

## 5. Combined-pool analysis (Phase 0A + Phase 0B new candidates)

**Pool size: 64 of the claimed 172 (37.2% coverage) — 51 Phase 0A + 13 Phase 0B new.**
**Every result in this section is explicitly scoped to this 64-recipe partial pool.**

| Metric | Value |
|---|---|
| Combined pool recipes | 64 (51 Phase 0A + 13 Phase 0B new) |
| Combined canonical ingredients | 77 (62 Phase 0A + 15 Phase 0B new) |
| Exact-ingredient-set collision groups, Phase 0A-only | 3 |
| Exact-ingredient-set collision groups, combined pool | 3 (unchanged count — `trenton-tomato-pie-pizzadb` joined an existing group rather than creating a new one) |
| Combined-pool deadlock states (ingredient-graph only, mechanic gate not separately modeled here — see caveat below) | **0** |
| Combined-pool unreachable recipes | **0** |
| Combined-pool unreachable ingredients | **0** |

**Caveat on the combined-pool deadlock result**: unlike Phase 0A's script (which explicitly
separated baseline-mechanic recipes from mechanic-gated ones), this Phase 0B combined-pool
script treats "ingredient-complete" as "reachable" without a mechanic-gate pass, since the 13 new
Phase 0B candidates were not run through `gameplay_mechanic_master.json`'s tagging pipeline (no
authoritative mechanic classification exists for them yet — their `mechanicNote` fields in the
staging JSON are this session's own qualitative judgment, not a validated catalog tag). **"0
unreachable" here means "the ingredient dependency graph has no dead end," not "every recipe is
playable without a new mechanic build"** — the same distinction Phase 0A drew explicitly (23
mechanic-gated recipes there), just not re-run mechanically for the 13 new entries. Treat this as
a lower-confidence version of the same finding, not a stronger one.

### 5.1 Exact-ingredient-set collisions (full detail — see design draft §10 for the design implication)

| Ingredient set | Colliding recipe ids |
|---|---|
| `{mozzarella, pepperoni, tomato-sauce}` | `pepperoni` (shipped), `detroit-style` |
| `{mozzarella, sausage, tomato-sauce}` | `salsiccia` (shipped), `chicago-deep-dish` |
| `{mozzarella, tomato-sauce}` | `stuffed-crust`, `ny-style`, `greek-style`, `trenton-tomato-pie-pizzadb` |

**Two of three groups already include a shipped production recipe** colliding with a candidate's
exact ingredient set. See the design draft's new §10 for the full analysis and conclusion:
recipe identity needs at least a mechanic/shape signal, not ingredient set alone — every
collision above is disambiguated by mechanic/shape already tracked in the game (no sauce/dough/
bake-profile/finishing-order signal was needed for any of these 3 groups; flagged as a
"watch-list," not added speculatively).

## 6. Items 1–10 — status against the Phase 0B request

| # | Item | Status |
|---|---|---|
| 1 | PIZZA DB 172件 → game canonical recipe候補 | **Partial**: 25 of 172 (14.5%) processed into candidates/confirmations/variants (§4). 147 remain unprocessed (no data). |
| 2 | canonical ingredient normalization | **Done for the 25 samples**: 15 new ids introduced, 2 deliberately withheld (`feta`, `blue-cheese-dressing`) pending identity decisions (§4.2). |
| 3 | existing 53 catalogとの対応 | **Done for the 25 samples**: 6 confirmations, 6 variants, 13 new (§4). |
| 4 | recipe × ingredient dependency matrix | **Done for the 64-recipe combined pool** (`TETO_PROGRESS2_PHASE0B_analysis-output.json`'s `combinedPoolRecipeReach`) — not for the full 172. |
| 5 | recipeReach | **Done for the 64-recipe combined pool** (same file). |
| 6 | marginal unlock | **Done for the 64-recipe combined pool** (deadlock-simulation trace in the same file). |
| 7 | mechanic dependency | **Partial**: qualitative per-sample notes only (§4, `mechanicNote` fields) — not run through the formal `gameplay_mechanic_master.json` classification pipeline. |
| 8 | initial OWNED = tomato-sauce/mozzarella/basil | **Unchanged from Phase 0A** — reused as-is, still valid. |
| 9 | recipe known at start = 0 | **Unchanged from Phase 0A** — reused as-is, still valid. |
| 10 | full progression deadlock simulation (全172件) | **NOT DONE.** Only a 64-of-172 (37.2%) partial-pool simulation exists (§5). Per this task's own explicit instruction, this is not represented as, or substituted for, a full-172 result. |

## 7. Explicit gap list — what Phase 0B still lacks

- **Pages 7–15 of the claimed PIZZA DB comparison table (9 of 15 pages, an estimated ~108–147
  entries)**: zero data. Not sampled by the relayed comment, not independently fetchable by this
  Claude Code session (still `EGRESS_BLOCKED`, §1).
- **Independent re-verification of the 25 already-sampled entries**: this session has not
  confirmed any of them against the live site itself (still blocked). They remain
  `external_relayed_pending_independent_verification`, not `external_verified_by_claude_session`.
- **Formal mechanic classification** for the 13 new Phase 0B candidates (item 7 above) — only
  qualitative notes exist, not a `gameplay_mechanic_master.json`-grade tag.
- **A full 172-entry deadlock/reachability simulation** (item 10) — blocked on the two gaps
  above.
- **Migration of any Phase 0B entry into `data/recipes/pizza_master_catalog.json` proper** (§2) —
  deliberately not done this Phase; staging file kept separate until reviewed.

**Given this gap, Phase 0B is not marked complete. PR #183 stays OPEN / unmerged**, per this
task's explicit instruction that an incomplete 172-population basis must not be reported as done.

## 8. Scope guard (confirmed, same as Phase 0A)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB text/image/site-structure copied (§1).
- No merge to `main`.

## 9. Final Report (Phase 0B)

- **Changes since Phase 0A**: (a) Phase 0A's audit/design docs relabeled "Phase 0A," content
  otherwise unchanged; (b) new Phase 0B staging dataset (25 externally-relayed samples,
  classified into 6 confirmations / 6 variants / 13 new candidates); (c) new combined-pool
  (64-recipe) analysis script and output; (d) new design-draft §10 on recipe-identity collisions;
  (e) 3 new naming-ambiguity ledger entries (§4.1).
- **Of the 172, entries with Fresh evidence**: **25** (14.5%) — all relayed, none independently
  re-verified by this Claude session.
- **Entries with zero evidence**: **~147** (pages 7–15 entirely unsampled; the exact count within
  the 6 sampled pages that might exist beyond the 25 relayed is also unknown).
- **Canonicalized recipe count (combined pool)**: **64** (51 Phase 0A + 13 Phase 0B new).
- **Canonical ingredient count (combined pool)**: **77** (62 Phase 0A + 15 Phase 0B new).
- **Exact ingredient-set collision count**: **3 groups** (both Phase-0A-only and combined pool;
  one group grew from 3 to 4 members). 2 of 3 groups already include a shipped production recipe.
- **Mechanic-gated recipe count**: unchanged from Phase 0A (23, `postBakeFinishing`-heavy);
  Phase 0B's 13 new candidates are not yet formally mechanic-classified (§7).
- **Deadlock result**: **0 deadlocks in the 64-recipe (37.2% of 172) combined pool only — NOT a
  full-172 result.** Full-172 simulation not performed (§6 item 10, §7).
- **Unresolved items**: the full §7 gap list, plus design draft §9 items 1–6 and new item 7.
- **PR #183 new HEAD SHA**: recorded in the commit that accompanies this report (see PR #183
  itself / the accompanying commit for the exact SHA — this document is committed in the same
  commit that updates the HEAD, so quoting a SHA inside this file would immediately go stale;
  the PR page is the source of truth).
- **PR #183 status**: **OPEN, unmerged.**
