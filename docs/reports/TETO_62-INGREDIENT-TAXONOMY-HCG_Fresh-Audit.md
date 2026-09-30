# 62 Ingredient Taxonomy / HCG Authority Completion — Fresh Audit

**Status: docs / data / tools only. The audit itself classifies nothing. §0 records the Owner Authority
given on 2026-09-29 (OD-T1..T8); the rest of the report is the audit as originally written, amended where
§0 supersedes it (marked "[superseded by §0]").** Every family value is either copied from an existing
source with its status, or is an Owner-confirmed value from §0. No classification was added by the auditor.

| Deliverable | Path |
|---|---|
| Report (this file) | `docs/reports/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.md` |
| Machine-readable companion (65 rows + summary) | `docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json` |
| Evidence snapshot | `docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Evidence-Snapshot.json`: the minimal PR #255 (`e221e36`) / #293 (`1bb4f9d`) rows the generator reads (45 + 42 rows), with source PR / SHA / purpose and a `rowsSha256` tamper check. **Audit evidence only: not a production authority, not read by `src/**`, and no classification is inferred from it.** |
| Generator / checker | `tools/ingredient_taxonomy_hcg_authority_audit.py`. `--sha 21dc0a6… [--check]` regenerates / checks from the working tree plus the committed snapshot; **no git object of PR #255 / #293 is needed** (works in fresh and shallow clones). `--refresh-snapshot` (maintainer only) is the sole path that reads those PR objects. `--check` also validates the Owner Authority (counts, 23 unique ids, UNRESOLVED = 0, families, OD-T3 vs production, mascarpone deferred, production file hashes, generator vs §0 text). Not in CI; not imported by `src/**`. |

## 0. Owner Authority record (2026-09-29): OD-T1..OD-T8

Recorded verbatim from the Owner. **Recording only:** no production taxonomy row, `src/**`, CSS, UI, save
schema, alias / reading authority, LC-R5b file or production ingredient was changed.
`ingredientTaxonomy.ts` is unchanged (22 rows). The 23 confirmed toppings are **Owner-confirmed but not
yet production rows**: each row is added to `ingredientTaxonomy.ts` in the PR that introduces that
ingredient to runtime (OD-T7).

| ID | Owner decision |
|---|---|
| **OD-T1** | The 16 #255 PROPOSED toppings are **confirmed**: vegetable = artichoke, arugula, bell-pepper, porcini, zucchini; other = breadcrumb, powdered-sugar, walnut; meat = chicken, prosciutto-crudo, speck; herb = cilantro, parsley; fruit = fig, strawberry; seafood = shrimp. `bell-pepper`, `cilantro`, `porcini`, `prosciutto-crudo` are **independent ids**, not aliased to a related ingredient. |
| **OD-T2** | The 7 NEEDS_REVIEW toppings are **confirmed as independent id + family**: french-fries = other; nduja = meat; nori = other; spicy-salami = meat; steak = meat; truffle = vegetable; wurstel = meat. **placement / timing / Technique are separate from family authority:** nduja=spread does not change meat; truffle's late / high-end finishing use does not change vegetable identity. |
| **OD-T3** | (a) Production authority kept and **individually recorded as Owner-confirmed**: garlic = herb, black-olive = vegetable, capers = spice. DH4 design §7.1 `capers = 野菜` is recorded as a **historical discrepancy**; no production change. |
| **OD-T4** | (c) `mascarpone` **deferred**; its category is Owner-confirmed at runtime introduction. |
| **OD-T5** | (b) Non-production sauce / cheese category is Owner-confirmed **per ingredient in the runtime-introduction PR**. |
| **OD-T6** | (a) The 22 production toppings are accepted as **merged authority under OD-DH4-4**; no per-ingredient re-approval (OD-T3's 3 are recorded individually above). |
| **OD-T7** | (a) A non-production ingredient's taxonomy row is added to `ingredientTaxonomy.ts` **in the same PR that introduces it to runtime**. **No second runtime taxonomy authority** holding 62 / 172 before production; pre-validation only via fixture / report. |
| **OD-T8** | (b) `ingredient_master_catalog.json` is **frozen as a historical / research artifact**. `ingredients.ts` is the only authority for production existence. The catalog is **not rewritten** for the stale `existingInGame` values or the 3 missing ids. |

**Outcome:** of the 23 UNRESOLVED toppings, **23 are now Owner-confirmed (0 UNRESOLVED remain)**: 16 by OD-T1, 7 by OD-T2.
All 23 confirmed families equal the family #255 had proposed (machine-checked: `matchesPr255Candidate = true` for every row). 3 further production rows are individually confirmed (OD-T3). **Deferred: 1** (`mascarpone`, category, OD-T4).
The machine-readable record is in the companion JSON (`ownerDecisions`, per-row `ownerDecision`, `summary`).

**Correction (Fresh Audit error).** The original text said #255 marks 2 production rows NEEDS_REVIEW.
The correct set is **3: `garlic`, `black-olive`, `capers`** (`capers` is not in the 62 catalog, so #293's 62-side count did not show it).
§4, §7 and §11 below are amended accordingly.

## 1. Audited main SHA

**`21dc0a670e586f478661a6cf54671313b2a7cb5b`** — `origin/main`, Merge PR #308 (LC-R5-a pantry availability), fetched fresh at session start.
Branch: `claude/ingredient-taxonomy-hcg-audit-qssm3i`, cut from that SHA. Known-state notes from the request were
treated as hints only; every number below was re-derived from this SHA or a pinned object.

Note: PRs #255 / #293 / #296 were cut on older mains (`5a33d85`, `86b48fd`). Between `86b48fd` and
`21dc0a6` main gained the LC-R0..R5-a and Hint 5.0 work; `src/data/ingredients.ts` (29 rows) and
`src/data/ingredientTaxonomy.ts` (22 rows) were re-read and still match those PRs' numbers.

## 2. Duplicate Gate

| Check | Result |
|---|---|
| Open PRs (all 24 read) with the same scope | **None.** Closest: **#293** (Hint 5.0 taxonomy coverage: 62 / 172, coverage tiers), **#255** (OD-TAX-1..9, 105 / 172 PROPOSED rows), **#296** (HCG Human-Review pack for the 172 F=65 recipes). All three are OPEN, docs / data / tools only, **not merged**, and self-declared "not an authority". |
| Issue search "taxonomy HCG" | 0 results. |
| Branches | `claude/172-recipe-authority-matrix` (79873c0), `claude/172-da-1-preparation-audit`, `claude/recipe172-taxonomy-hcg` (7792bc8, = #296). The remote branch of this task's own name existed but equalled `main` (no commits). |
| Overlap with this audit | #293 already counts the 23 unclassified catalog toppings; #255 already holds the PROPOSED rows; #296 covers the **172-only** blockers (F=65, 54 ids) and mostly **excludes** the 62-catalog toppings. **This audit is not a duplicate:** it re-verifies those numbers against the current main, adds the authority-boundary / evidence-source / Owner-confirmed split (Q9 / Q10), the shelf-vs-hint separation, and the 62→172 reuse structure. It supersedes no PR. |

## 3. Current authority map

| Layer | Authority (source of truth) | State on main |
|---|---|---|
| Production ingredient set | `src/data/ingredients.ts` | **29** ingredients: sauce 3, cheese 4, topping 22 |
| Category (sauce / cheese / topping) | `Ingredient.category` in `ingredients.ts` (production); `data/recipes/ingredient_master_catalog.json` for non-production (research artifact, "NOT wired into src") | production 29 only |
| **62 catalog** | `data/recipes/ingredient_master_catalog.json` (catalogVersion 2.0.0, 2026-09-19): 62 rows = sauce 10 / cheese 10 / topping 42 | **Not production.** Production ≠ 62. |
| Hint family (**ATTRIBUTE_FAMILIES**) | `src/data/ingredientTaxonomy.ts`: 7 family ids, 4 group ids, **22 topping → family rows** (OD-DH4-4; merged via DH4-1 #254). Sauce / cheese have no family. | complete for production toppings |
| Hint 5.0 display | `src/data/hintClassDisplay.ts` (`HINT_CLASS_DISPLAY`, keyed by the 7 family ids; OD-H5-C4 final) | display only |
| Hint 5.0 fail-fast | `src/logic/discovery/hint5Taxonomy.gate.test.ts` (G1 / G16 / G22–G24 …): every runtime topping has exactly one family; missing = `NOT_A_TARGET`; the 172 fixture cannot ship an unclassified topping | on main |
| **Shelf** (Large Catalog / Category Tabs) | `src/data/ingredientShelf.ts`: **composed view, no table of its own.** shelf(topping) = its family; shelf(sauce / cheese) = its category. 9 shelves: sauce, cheese, meat, seafood, vegetable, fruit, herb, spice, other. `auditShelfAuthority` reports unclassified / duplicate / orphan / non-topping rows. Fail-closed: `null` shelf → "すべて" only. | on main (LC-R1 / R4 use it) |
| 172 evidence | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`, `TETO_RECIPE_172_MECHANIC-MATRIX*` | evidence, not taxonomy authority |
| 172 recipe authority matrix | branch `claude/172-recipe-authority-matrix` @ `79873c0` (not on main): 172 rows, classes A 11 / B 17 / C 24 / D 16 / E 39 / **F 65** | reference |
| Proposed taxonomy for 105 / 172 | PR #255 @ `e221e36` (132 PROPOSED, 47 NEEDS_REVIEW, 13 UNKNOWN); OD-TAX-1..9 recorded | **PROPOSED only** (OD-TAX-7) |
| Coverage tiers | PR #293 @ `1bb4f9d` | reference |
| HCG Human-Review pack (172) | PR #296 @ `7792bc8` | reference; 31 questions, all open |
| JA search alias (LC-R5b) | branch `claude/lc-r5b-japanese-search-audit-nciqbq` @ `195494a`: OD-A1..A6 APPROVED; separate alias authority (proposed `src/data/ingredientSearchAliases.ts`) | **separate authority**, see §10 |

## 4. Classified / unresolved counts

Distinct ids audited: **65** = 62 master catalog + 3 production ids missing from it (`capers`, `clam`, `fresh-tomato`).
Full per-id rows: the companion JSON.

| State | Count | Notes |
|---|---:|---|
| Production topping, family row present (`CLASSIFIED_PRODUCTION`) | **19** | 22 production toppings minus the 3 below. Merged authority (OD-T6). |
| Production topping, family row present, **flagged NEEDS_REVIEW in #255** (`garlic`, `black-olive`, `capers`) | **3** | **[superseded by §0]** kept and Owner-confirmed individually (OD-T3). Originally recorded as 2 in error. |
| Production sauce / cheese, shelf by category | **7** | 3 sauce + 4 cheese; no family by design |
| Non-production sauce / cheese: category only from the master catalog | **12** | shelf follows category once shipped; category is research-artifact data |
| Non-production cheese with category question (`mascarpone`) | **1** | #255: cheese, or cream (`other.dairy`)? |
| **Unresolved topping, PROPOSED only** (pre-decision) | 16 | **[superseded by §0]** now Owner-confirmed (OD-T1), not yet production rows |
| **Unresolved topping, NEEDS_REVIEW** (pre-decision) | 7 | **[superseded by §0]** now Owner-confirmed (OD-T2), not yet production rows |
| **Unresolved toppings total** (pre-decision) | 23 | = 42 master toppings − 19 with a production row. Matches #293. |
| …with an Owner-confirmed source **before** the Owner Decisions | 0 | original Q9 answer |
| **Owner-confirmed pending runtime (after §0)** | **23** | **UNRESOLVED remaining: 0** |
| Deferred | **1** | `mascarpone` category (OD-T4) |

Production sanity: 22 / 22 production toppings resolve to exactly one of the 7 families; 0 orphan / duplicate / non-topping rows.
(Computed by static parse of the two source files; the vitest gates were read, not executed, in this session — `node_modules` is not installed.)

## 5. Unresolved ingredient IDs (23 toppings) and evidence

> **[superseded by §0]** All 23 below were unresolved at audit time and are now Owner-confirmed with the family the Owner stated (identical to the #255 candidate quoted here). The lists are kept as the evidence trail.

`Proposed family` is **PR #255's proposal**, quoted for traceability. It is **not** Owner-confirmed and is **not** used as authority here.

**U-A: PROPOSED only (16).** #255 marks them PROPOSED / high confidence; no Owner decision covers any of them.
`artichoke` (vegetable), `arugula` (vegetable), `bell-pepper` (vegetable; alias flag: not `pepperoni`), `breadcrumb` (other), `chicken` (meat),
`cilantro` (herb; alias flag: コリアンダー), `fig` (fruit), `parsley` (herb), `porcini` (vegetable; separate id from `mushroom`),
`powdered-sugar` (other), `prosciutto-crudo` (meat; separate id from `ham`), `shrimp` (seafood), `speck` (meat),
`strawberry` (fruit), `walnut` (other), `zucchini` (vegetable).

**U-B: NEEDS_REVIEW (7).** Even #255 does not commit.
| id | #255 candidate | Open question (from #255) |
|---|---|---|
| `french-fries` | other (`other.starch`) | vegetable.root or other.starch; prepared form |
| `nduja` | meat | identity meat, but `placement=spread` in the catalog |
| `nori` | other (`other.seaweed`), low confidence | not 魚介 in everyday Japanese; seafood / other / spice |
| `spicy-salami` | meat | near-alias of salami / `pepperoni`; separate id or alias? |
| `steak` | meat | catalog-only; may be an alias of beef |
| `truffle` | vegetable (`vegetable.mushroom`) | mushroom identity vs post-bake luxury finish (timing ≠ identity, OD-TAX-6) |
| `wurstel` | meat | relation to `sausage` / `hot-dog` (canonicalization) |

Category-level unresolved (non-topping): `mascarpone` (cheese vs cream). Not a family question.

## 6. Evidence source hierarchy (what counts as Owner-confirmed)

| Tier | Source | Confirms |
|---|---|---|
| **T0 Owner-confirmed, ingredient-level** | merged `ingredientTaxonomy.ts` rows (22, via DH4-1 under OD-DH4-4); OD-H5-C4 final (mushroom stays `vegetable`, no `mushroom` family) | the 22 production toppings only |
| T0 Owner-confirmed, structural | OD-TAX-1/2/3/5/6/7/8/9, OD-DH4-4, OD-H5-C4 (7 ids, no new family), OD-H5-T-COV (fail-fast, no silent fallback), OD-A1..A6 (alias is separate) | the rules; **no ingredient-level row outside the 22** |
| T1 Proposed (not authority) | #255 PROPOSED / NEEDS_REVIEW rows; #293 tiers; #296 questions | candidates and evidence |
| T2 Heuristic (explicitly indicative) | DH4 Fresh Design §7.2 keyword classes | none; the source itself says "indicative only" |
| T3 Name / common sense | – | **forbidden** as a basis |

**Result for Q9 (as audited, before §0):** none of the 23 unresolved toppings has an Owner-confirmed classification. Not one is classifiable "without inference" under a strict reading. The only difference between U-A and U-B is how much a #255 proposal already documents.

## 7. Conflicts / gaps

| # | Finding | Detail |
|---|---|---|
| C-1 | **[handled by OD-T8: frozen, not rewritten] Master catalog is stale vs production** | The 62 catalog says `existingInGame: true` for 22 ids; production has 29. `corn`, `eggplant`, `pineapple`, `potato` are `existingInGame:false` in the catalog but production toppings. `capers`, `clam`, `fresh-tomato` are missing from the catalog entirely (F-count 62 vs 65 distinct). The catalog's `existingInGame` / `schemaNote` "22 existing / 40 new" no longer matches. |
| C-2 | **[recorded by OD-T3 as historical discrepancy; production unchanged] `capers` design vs code** | DH4 Fresh Design §7.1 candidate table lists capers under 野菜; the merged table puts capers in `spice`. The merged code + Hint 5.0 C1-P key analysis (puttanesca "capers = 薬味") treat it as spice. The code is the authority; the design table is stale. No conflict at runtime, but any consumer of the design doc gets a different answer. |
| C-3 | **[resolved by OD-T3] Three `under review` production rows** (`garlic`, `black-olive`, `capers`; originally written as two) | `garlic` (herb vs `vegetable.allium` with onion) and `black-olive` (vegetable vs fruit / condiment). #255 asks the HCG; changing either moves its **shelf** and its **Hint 5.0 class**, and would invalidate a stored `attr:family` safe mapping (H5-0 §migration: falls to archive). Not a bug today, a decision debt. |
| C-4 | **[resolved by OD-T6] No ingredient-level Owner decision record** | The 22 rows arrived as merged code under the umbrella OD-DH4-4. There is no per-ingredient Owner-confirmation record (only mushroom is named, in OD-H5-C4). The 22 are treated as authority because they are merged, gated and pinned. |
| C-5 | **Category precedes family, but category has no HCG-grade authority for non-production ids** | The master catalog category is a research artifact; #296 shows 18 category-undecided ids in the 172 set. Sauce / cheese ids get a shelf from category alone, so a wrong category silently mis-shelves. `mascarpone` is the 62-catalog instance. |
| C-6 | **Single table drives shelf *and* Hint class by design** | `ingredientShelf` derives the topping shelf from the family. A family decision is therefore simultaneously a Hint 5.0 decision and a UI shelf decision. Correct as designed (no drift possible), but the HCG must be told both consequences. Labels stay separate (shelf 「その他」 vs Hint 「ちょっと変わった材料」; gate 4). |
| C-7 | **[resolved by OD-T2: truffle = vegetable, Owner-confirmed] #296's "confirmable from existing authority" list vs #255** | #296 HCG-27 proposes `truffle = vegetable` as confirmable from OD-TAX-6 + OD-DH4-4. #255 lists truffle NEEDS_REVIEW and OD-TAX-7 forbids deciding it by guess; neither OD-TAX-6 nor OD-DH4-4 names truffle. **This audit does not accept it as T0.** It stays U-B. |
| C-8 | **Population coupling of the fail-fast gate** | The gate (G1/G16/G22–G24) and `auditShelfAuthority` cover the *production* catalog, so adding an unclassified topping fails CI (good). They do not cover the 62 catalog itself; nothing fails when a catalog row is added to the JSON without a family. Expected, since the catalog is unwired. |
| C-9 | **Sauce / cheese have no sub-classification** | OD-TAX-9 defers sauce / cheese families. 13 non-production sauces / cheeses ship with shelf = category only. Fine for shelf; a future need would be a new authority. |
| C-10 | **Alias flags overlap classification** | 22 of the 62 carry an alias / canonicalization flag (e.g. `spicy-salami`, `steak`, `wurstel`, `prosciutto-crudo`). Identity (is it a separate id?) must be settled before family; that is the canonicalizer's job, not this audit's. |

## 8. Separation of the three authorities (requested check)

| Question | Answer |
|---|---|
| Shelf vs Hint classification | Different *labels*, one shared *id authority*. Shelf never imports `hintClassDisplay.ts` (asserted by gate 4). Shelf adds two category shelves (sauce, cheese) that Hint has no family for. A shelf label change never touches the Hint. |
| Sauce / Cheese shelf vs ATTRIBUTE_FAMILY | Sauce / cheese shelf = **category**, and they have **no family row** (asserted: `nonToppingRows` must be empty). ATTRIBUTE_FAMILIES describe toppings only. They must not be merged. |
| Hint 5.0 boundary | Hint 5.0 reads the same 22 rows, **never coarsens**, and treats a missing row as `NOT_A_TARGET`. It adds no family and no row (OD-H5-0 §11). HCG must not change a production row without the H5 safe-mapping consequence (C-3). |
| Large Catalog shelf boundary | LC only copies `ingredientShelf()` into the catalog (`shelf` field, LC-R1); it never owns membership. Unclassified → `shelf: null` → "すべて" only. Completing the taxonomy therefore *automatically* lifts an id onto a shelf tab with no LC change. |
| LC-R5b alias | Fully separate (see §10). |

## 9. 62 → 172 reuse

- **Reusable as is.** The structure is one id-keyed row table + a Map + injectable audit (`auditShelfAuthority(input)`, G16 fixture test). A 62 or 172 population needs **rows only** (no new type, no new family: #255 / #293 both report 0 new family ids needed; every family has ≥ 8 members at 172 per #255).
- **Not reusable yet:** (1) the category authority for non-production ids (C-5); (2) canonical ids for 13 unresolved 172 tokens (#293 / #296); (3) no per-ingredient Owner-confirmation record format — every future row needs an HCG record, or the table cannot show provenance.
- **Scale figures from the references** (recomputed by #293 / #296, consistent with this audit's 62-side numbers): 172 uses 169 ids of which 52 are in the 62; 96 topping ids + 8 topping tokens lack taxonomy; #296 counts 54 blocker ids for F=65 rows. This audit did not re-derive the 172-side figures (out of the 62 scope); it re-verified only the 62-side numbers.
- **Relation to the 172 authority matrix:** classes F (65) and part of B ("taxonomy rows after HCG") depend on this taxonomy. F is the *172-only* blocker set; the 23 unresolved 62-catalog toppings are the *shared* prerequisite that also lifts many B / E rows. Leaving F ≠ production-ready (#296).

## 10. LC-R5b conflict check

| Check | Result |
|---|---|
| Files changed by this audit | 3 new files only: this report, the companion JSON, the generator. No edit to any existing file. |
| Files touched by LC-R5b branches vs main (`git diff --stat origin/main...`) | `…japanese-search-audit-nciqbq`: `docs/PROJECT_HANDOFF.md` (+1) and 2 new LC-R5b docs / JSON; `…pre-audit-mbinf3`: 1 new doc; `…real-device-discovery-harness`: orphan branch (no merge base). **No overlap** with this audit's 3 files. `docs/PROJECT_HANDOFF.md` is intentionally **not** touched here. |
| `src/**`, CSS, UI, save schema, production taxonomy | Unchanged. |
| Authority separation | LC-R5b OD-A1 fixes alias = separate authority map (proposed `ingredientSearchAliases.ts`); C1 forbids aliases that equal a shelf / family / class label; OD-A4/A5 forbid guessed names / readings. This audit uses **no** alias, reading or search data as classification evidence and proposes no alias. A family label is never a search term. |
| **Verdict** | **No conflict.** |

## 11. Owner Decisions (questions as posed; **answered in §0**)

The table below is the original question set, kept for the trail. Answers are in §0. OD-T3 was posed for 2 rows and answered for 3.

| ID | Question | Scope |
|---|---|---|
| **OD-T1** | Confirm, for the 16 U-A toppings, the #255 family as production authority — one batch decision, or per id? Provide the confirmation record format (proposal: id, family, decision date, evidence link). | 16 ids |
| **OD-T2** | Decide the 7 U-B toppings individually: `french-fries`, `nduja`, `nori`, `spicy-salami`, `steak`, `truffle`, `wurstel`. Canonical-id questions (`spicy-salami`, `steak`, `wurstel`, `french-fries`) first, then family. | 7 ids |
| **OD-T3** | `garlic` (herb vs vegetable) and `black-olive` (vegetable vs fruit): keep the production rows, or change? State the accepted consequence for shelf and for the Hint 5.0 `attr:family` mapping if changed. | 2 ids |
| **OD-T4** | `mascarpone`: cheese, or another category. | 1 id |
| **OD-T5** | Are the non-production sauce / cheese categories in the master catalog (12 rows + `mascarpone`) accepted as category authority, or must each be re-confirmed at its runtime-introduction PR (recommended, same policy as OD-A5 for aliases)? | 13 ids |
| **OD-T6** | Record an ingredient-level provenance for the existing 22 rows (retro-confirm C-4), or explicitly accept "merged under OD-DH4-4" as sufficient. | 22 ids |
| **OD-T7** | Authority home for the 62 / 172 rows: extend `ingredientTaxonomy.ts` only when each ingredient enters production (recommended: ships with the ingredient, guarded by the existing gates), vs. a staged data authority holding 62 / 172 rows ahead of production. | structure |
| **OD-T8** | Refresh the master catalog (`existingInGame`, missing `capers` / `clam` / `fresh-tomato`, counts), or freeze it as a historical artifact and treat `ingredients.ts` as the only "existing" source. | C-1 |

Pack-level decisions for 172-only blockers remain in #296 (31 questions) and are not repeated here.

## 12. Recommended implementation slices (none started)

Amended for §0. S0 is done. OD-T7 forbids a second runtime taxonomy authority, so S2 is fixture / test only. All are docs / data / tools / tests unless stated.

| Slice | Content | Needs | Touches production? |
|---|---|---|---|
| **S0** | Owner answers OD-T1..T8 — **DONE (§0)** | – | no |
| **S1** | Provenance record: the companion JSON already holds the 23 + 3 confirmations; optionally split into a standalone HCG record + validator in `tools/` | S0 | no |
| **S2** | Fixture / test-only validation (NOT a second taxonomy authority, OD-T7): the 62 catalog with the Owner-confirmed rows, checked by the existing injectable `auditShelfAuthority(input)` / G16 pattern with a fixture, never imported by `src` | S1 | no (tests only) |
| **S3** | Per-ingredient runtime introduction: when an ingredient enters `ingredients.ts`, its `ingredientTaxonomy.ts` row ships in the same PR; the existing G1 / gate 1 fail CI otherwise. Human Verification policy applies if the shelf UI changes | S1 + the ingredient's own slice | **yes**, per-ingredient, later |
| **S4** | 172 extension: reuse S1 format for the 172-only ids after #296's HCG queues | #296 Owner Decisions | no until S3 |
| **S5** | Master catalog refresh / freeze (OD-T8) | OD-T8 | no |

**Do not** bundle S3 with LC-R5b work. LC-R5b is unaffected because taxonomy completion only adds rows.

## 13. Not done / limits

- The vitest gates were read, not executed (no `node_modules`); production numbers are from static parsing and match #293 / #296 and the gate tests' own claims (22 / 22, 29 ingredients).
- The 172-side figures are quoted from #255 / #293 / #296 / the authority matrix, not re-derived.
- The PR bodies and pinned files were read via GitHub; the LC-R5b branch contents were read for file scope and authority boundary only.
- No Human Verification is required: no UI / UX / gameplay change.

## 14. Final verdict

**Updated after §0: A. AUTHORITY RECORDED — no production implementation; 0 UNRESOLVED; 1 deferred (`mascarpone` category).** (Original verdict: B. OWNER DECISION REQUIRED.)

Historical text of the original verdict follows.

- Production (29 ingredients, 22 topping rows, 9 shelves) is **complete and internally consistent**; the fail-fast gates cover it. Nothing here needs a production fix.
- The 62-catalog taxonomy is **not completable without the Owner**: 23 toppings are unresolved, **0 have an Owner-confirmed source**; 16 have a documented #255 proposal, 7 are genuine judgment calls, plus 2 under-review production rows and 1 category question.
- The structure is reusable for 62 → 172 with rows only and no new family.
- **LC-R5b conflict: none.** This branch is additive docs / data / tools; PR creation is deferred to the Owner's call after reading this.
