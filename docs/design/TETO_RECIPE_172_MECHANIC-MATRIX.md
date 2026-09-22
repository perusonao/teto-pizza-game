# TETO Recipe 172 — Game-Design Candidate / Mechanic Matrix (Progression 2.0 Phase 1)

Issue #188. **Docs/data/tooling only**: no `src/**` change, no production SSOT overwrite, no ★
threshold / Pitz price / unlock order decided. The Phase-0 172-source evidence is read-only input
and was not modified.

| Artifact | Path |
|---|---|
| Machine-readable matrix (172 rows + ledgers) | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` |
| Generated per-row table | `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX_ROWS.md` |
| Generator + validator (deterministic) | `tools/progression2_mechanic_matrix.py` (`--check` = validate only) |

Every number below is printed by the tool from the JSON; if this text and the JSON disagree, the
JSON wins.

**The question this answers:** *what is the smallest reusable cooking-interaction system that
faithfully distinguishes the 172 evidenced pizzas?* Short answer: **11 reusable capabilities**
(§4). The first three (dough variant, extra spread layer, late addition) cover 151/172 rows'
mechanic needs. The 16 rows the current flow cannot represent at all need 9 of the 11, including
all 5 structural ones.

---

## 0. Fresh audit (done before editing)

| Check | Result |
|---|---|
| Base | `origin/main` = `5676ae9d2ade0bd3675523be351152a24508c9a5` (PR #183 merge). Branch cut from it; `git merge-base --is-ancestor` passes. |
| Duplicate scope | Open PRs: #105, #72, #46, #34, #3. None touch the mechanic matrix. Open issues: #188 (this one), #182 (parent). No duplicate. |
| Master evidence | 172 `recipeRows`, 172 unique ids. 41 `requiresMechanicIdentity`. 2 evidence gaps. 32 catalog correspondences. 25 rows are Phase-0B samples that are already canonical; 147 rows use raw `ingredientsJa`. |
| Phase-0 deadlock analysis | Pool 151/172. 21 rows excluded as ambiguous. 5 exact-set collision groups. 0 deadlocks. |
| Catalogs | `pizza_master_catalog.json`: 53 entries (15 shipped). `ingredient_master_catalog.json`: 62. `gameplay_mechanic_master.json`: 11 mechanics. `src/data/recipes.ts`: 15 recipes. `src/data/ingredients.ts`: 22 ingredients. |
| Current flow (code) | `cookingProfiles.ts` derives `DOUGH → [SAUCE] → [CHEESE] → [TOPPING]` from ingredient categories, plus CUT for 15 allowlisted round recipes. `recipeSauceProfiles.ts` allows **one** sauce ingredient per recipe. `FOLD`/`SEAL`/`EDGE_FILL`/`FINISH` are reserved `MakingStep` values with no gameplay. |
| Phase-0 validators | All green before and after this change (§9). |

The issue text's counts all match the files on main.

## 1. Method

For each of the 172 rows, `tools/progression2_mechanic_matrix.py` does the following:

1. **Ingredients.** It resolves every source token through the existing
   `progression2_ingredient_canonicalizer.classify()`. There are no new alias tables.
   - `ambiguous` / `needs_review` tokens stay verbatim in `unresolvedTokens`, and the row gets no
     identity set.
   - `お好みの具材` ("toppings of your choice") is recorded as an excluded non-ingredient. A row
     containing it is **not** ingredient-complete: its real topping set is unspecified, so it gets
     no identity set and stays out of the complete-set, same-set and collision analyses. Today
     this affects only `colorado-mountain-pie-pizzadb-p3`.
   - A `tokenTrace` mirrors the source list 1:1.
2. **Sauce base.** It maps `sauceFamily` through a fixed table.
   - When the family names exactly one existing sauce, that sauce is added to the identity set as
     `family_derived`: トマトソース→tomato-sauce, BBQ→bbq-sauce, オイル→olive-oil, サルサ→salsa,
     バジル→pesto (all 11 バジル rows are ペスト dishes).
   - Generic families (カレー, ホットソース, 甘辛だれ, デザート, ホワイト, その他) are satisfied only
     by a listed sauce item. Otherwise the base is `unspecified`, which is a content blocker.
3. **Dough.** It classifies every distinct `doughStyle` string (38 incl. null) into
   standard / variant / form, plus shape, pan, enclosure, lamination and cook method. The
   validator fails on any unclassified string.
4. **Mechanic evidence.** It reads a curated, cited table. Each entry names its Phase-0 source
   field and an evidence strength:
   - **Counted as REQUIRED:** source doughStyle field, source ingredient field, source profile
     text (mechanicIdentityNote or corroboration note), a Phase-0B sample mechanic tag, or an
     existing catalog design tag (only when the tagged finishing ingredient is present in the
     row).
   - **Kept as CANDIDATE only:** repo inference ("looks like", "plausible", open question) and
     profile text about an element that is not in the ingredient list. These are never promoted
     silently.
5. **Representability** against the current flow:
   - `FULL`: no required capability.
   - `PARTIAL`: only non-structural capabilities are missing, so the dish is playable but loses an
     evidenced dimension. A Phase-0 mechanic flag backed only by inference also lands here; it is
     never `FULL`.
   - `NOT_REPRESENTABLE`: a structural capability is missing, so the current flow would produce a
     different dish form.
6. **Ledgers and status.** It builds the collision, composition, naming and blocker ledgers, then
   assigns a product-decision status (§7).

## 2. Headline results

| Metric | Value |
|---|---|
| Matrix rows | **172 / 172**, 172 unique, order = master evidence order, 0 invented |
| **FULL** / **PARTIAL** / **NOT_REPRESENTABLE** (current flow) | **101 / 55 / 16** |
| Rows needing ≥1 required capability | 66 (the other 106 = 101 FULL + 5 PARTIAL rows whose Phase-0 mechanic flag is inference-only) |
| Phase-0 mechanic-identity rows (41) | none is FULL. 36 have source-backed required capabilities. 5 have only inference-backed ones (taco + 4 page-8 rows), so they are PARTIAL with no required capability. 10 carry a MECHANIC_INTERPRETATION blocker (8 page-8 raw-salad rows, taco, lahmacun). Eel's unresolved timing adds an 11th MECHANIC_INTERPRETATION row that Phase 0 did not flag. |
| Rows needing a capability that Phase 0 did **not** flag | 30 (mostly extra spread layers, catalog finishing tags, profile-text timing, dough variants from the doughStyle field) |
| Complete canonical identity set | **150 / 172**. Excluded: the 21 rows with unresolved tokens (the same set Phase 0 excluded, reconciled exactly) plus `colorado-mountain-pie-pizzadb-p3` (excluded placeholder お好みの具材). Phase 0's deadlock pool (151) still counts Colorado because it drops the placeholder; that Phase-0 artifact is left unchanged. |
| Canonical ingredient ids across matrix | 169, of which 148 are not yet in shipped `src/data/ingredients.ts` (content work, not mechanics) |
| Product-decision status | READY 67 · READY_WITH_REVIEW 19 · ALREADY_SHIPPED_CORROBORATED 1 · **BLOCKED_PRODUCT_DECISION 85** |
| FULL **and** decision-ready | **56 rows**. These are the immediate content-only candidate pool; the list is in `summary.fullAndDecisionReadyRowIds`. |

Representability × status:

| | READY | READY_WITH_REVIEW | SHIPPED_CORROB. | BLOCKED |
|---|---|---|---|---|
| FULL (101) | 49 | 7 | 1 | 44 |
| PARTIAL (55) | 14 | 9 | 0 | 32 |
| NOT_REPRESENTABLE (16) | 4 | 3 | 0 | 9 |

## 3. Current-flow test: `stretch → sauce → toppings → bake → optional cut`

Where the current flow runs out:

| Current-flow limit | Why it matters | Rows affected (required) |
|---|---|---|
| DOUGH has no base parameter (material, thickness, flatbread type) | 23 distinct evidenced dough variants. One Phase-0 collision pair (jamon-serrano / pinsa) differs only in dough. | 33 |
| SAUCE is one ingredient | 2+ certain spread layers, e.g. tomato + olive-oil drizzle, hot sauce + dressing, tare + mayo | 17 |
| Everything is placed before one bake | Mid-bake (natto, tarako, fries), post-bake (wasabi, graham, catalog finishing), and eel (timing unresolved) | 12 |
| The bake has no pan or tray | Deep-dish, Detroit, Sicilian, Old Forge, al taglio, Greek (NE), Montreal, bar pizza | 8 |
| The dough target is a circle, and CUT assumes a circle | Square ×4, boat ×1 | 5 |
| No cover or fold | Calzone, Chicago stuffed, fugazzeta rellena, scacciata, a caballo | 5 |
| No prep before topping | Yakiniku, lomo saltado (stir-fry), kimchi (drain/stir-fry) | 3 |
| Order fixed at sauce → cheese | Chicago deep dish, Trenton tomato pie | 2 |
| Free placement only | Quattro stagioni (quadrant) | 1 |
| Bake only | Pizza fritta (fried) | 1 |
| No lamination | Feteer meshaltet | 1 |

The 16 **NOT_REPRESENTABLE** rows are:

- calzone
- chicago-deep-dish, chicago-stuffed
- siciliana
- old-forge, detroit, al-taglio-romana
- turkish-pide
- new-england-bar, montreal, greek-style (NE pan)
- fugazzeta-rellena, scacciata-ragusana, pizza-a-caballo
- pizza-fritta
- feteer-meshaltet

## 4. Minimum reusable capability set

These are derived across all 172 rows. Merges and splits follow the evidence: the evidence never
distinguishes the gesture of merged sub-types, and it does distinguish the split ones. The cost
classes (S/M/L) are relative and grounded in the existing seams (`CookingProfile`, reserved
`MakingStep`s, `doughShape.ts`). They are not a schedule.

| # | Capability | Covers axes | Structural? | Cost | Rows required | Unlocked alone* | Candidate-only rows |
|---|---|---|---|---|---|---|---|
| 1 | `DOUGH_VARIANT`: dough composition, thickness, texture, flatbread, ferment | dough composition/type, thickness | no | S | **33** | 20 | 0 |
| 2 | `MULTI_SPREAD_LAYER`: 2nd sauce, drizzle, paste | sauce/spread placement | no | M | **17** | 13 | 10 |
| 3 | `LATE_ADDITION`: FINISH step, mode `mid_bake` or `post_bake` | post-bake finish, bake timing | no | M | **12** | 9 | 11 |
| 4 | `PAN_BAKE`: shallow, deep, sheet, tray | pan/deep, bake profile | **yes** | M | **8** | 0 | 0 |
| 5 | `DOUGH_SHAPE_TARGET`: square or boat silhouette, shape-aware CUT | shape/form, cut | **yes** | L | **5** | 0 | 0 |
| 6 | `ENCLOSE`: fold, two-sheet, layered stack, cover layer | fold/cover/layer | **yes** | L | **5** | 2 | 0 |
| 7 | `PREP_STEP`: stir-fry or drain before placing | pre-cook/prep | no | M | **3** | 2 | 0 |
| 8 | `STEP_ORDER`: cheese before sauce | topping order | no | S | **2** | 1 | 0 |
| 9 | `ZONED_PLACEMENT`: quadrant, half, centre | topping zones | no | M | **1** | 1 | 2 (centre egg) |
| 10 | `LAMINATE`: multi-layer folded dough | layer + dough | **yes** | L | **1** | 0 | 0 |
| 11 | `FRY_COOK`: fry instead of bake | fry vs bake | **yes** | L | **1** | 1 | 0 |
| — | `SERVE_FORM`: roll-to-eat, fold-to-eat | serve/eating form | no | M | **0** | 0 | 2 (candidate only) |

\*Unlocked alone = rows whose only required capability is this one.

**Merge and split decisions** (the full rationale is in `capabilityTaxonomy[*].mergeRationale`):

- **Dough.** Four composition variants, four flatbread types and all thickness variants are
  merged into one data-level dough base. The evidence never changes the player's gesture for any
  of them.
- **Shape.** Square and boat are merged into `DOUGH_SHAPE_TARGET`, because both are a non-circle
  silhouette plus a shape-aware CUT.
- **Pan.** `PAN_BAKE` is split from shape. Round pan bakes (deep dish, Montreal, bar pizza, NE
  Greek) exist without a non-round silhouette, and pide has a shape without a pan.
- **Enclosure.** Fold, two-sheet, stack and cover-layer are one `ENCLOSE` capability with a mode.
  `LAMINATE` stays separate, as Phase 0 already concluded: it folds the dough itself before any
  topping and does not cover a filling.
- **Late additions.** Mid-bake and post-bake are one `LATE_ADDITION` capability with a mode. It
  reuses the reserved `FINISH` step, and `mid_bake` adds a short re-bake. This keeps eel's
  unresolved timing a mode question rather than a capability question.
- **Serve form.** `SERVE_FORM` is not in the minimum set. Its evidence is only context text
  (lahmacun) or inference (NY), so it stays a candidate.

## 5. Recommended implementation order

This order is based on coverage gain and dependency only. No prices, ★ thresholds or unlock order
are decided.

The greedy method adds, at each step, the capability that fully satisfies the most additional
rows. Ties go to the cheaper cost class. 106 rows need no required capability.

| Step | Capability | Rows newly satisfied | Cumulative | …of which decision-ready | Note |
|---|---|---|---|---|---|
| 1 | DOUGH_VARIANT (S) | +20 | 126 | 8 | Data and visual only. Also lets 4/5 Phase-0 collision pairs start separating. |
| 2 | MULTI_SPREAD_LAYER (M) | +15 | 141 | 9 | Generalizes `RecipeSauceProfile` to a list. Also resolves the "olive-oil → DRIZZLE" TODO already in code. |
| 3 | LATE_ADDITION (M) | +10 | 151 | 3 | First real `FINISH` consumer, on the existing POST_BAKE phase. |
| 4 | ENCLOSE (L) | +5 | 156 | 3 | Uses reserved FOLD/SEAL. Must disable CUT for folded forms. |
| 5 | PREP_STEP (M) | +3 | 159 | 1 | |
| 6 | PAN_BAKE (M) | +3 | 162 | 2 | **Build before step 7.** Every DOUGH_SHAPE_TARGET row except pide (boat) also needs PAN_BAKE. |
| 7 | DOUGH_SHAPE_TARGET (L) | +5 | 167 | 1 | Needs CUT to stop assuming an ideal circle. |
| 8 | STEP_ORDER (S) | +2 | 169 | 1 | Cheap. Could be pulled forward alongside PAN_BAKE for deep dish. |
| 9 | ZONED_PLACEMENT (M) | +1 | 170 | 1 | |
| 10 | LAMINATE (L) | +1 | 171 | 0 | Scope question on feteer first (§7). |
| 11 | FRY_COOK (L) | +1 | 172 | 1 | |

Totals: 106 rows need no required capability, and the 11 capabilities cover the other 66, so all 172 are covered.
The per-step row ids are in `recommendedImplementationOrder.steps[*].newlyFullySatisfiedRowIds`.

**Recommendation:**

- **Build 1 → 2 → 3 first.** These are three non-structural capabilities on existing seams, and
  they reach 151/172 mechanic-complete rows.
- **Treat 4–11 as a later structural tier.** Each serves 1–8 rows.
- **Ship content from the 56 FULL + decision-ready rows first.** They need no mechanic at all.

## 6. Collisions and discovery identity

### 6.1 The five Phase-0 exact-set collision groups

| Group | Members | Verdict | Distinguishing dimension(s) | Needs |
|---|---|---|---|---|
| P0-COLL-1 | ny-style / trenton-tomato-pie | **DISTINGUISHED** | dough variant (thin-large-pliable) and layer order (cheese-before-sauce) | DOUGH_VARIANT, STEP_ORDER |
| P0-COLL-2 | cauliflower-crust / pizza-al-taglio-romana | **DISTINGUISHED** | dough (cauliflower vs long-ferment), shape (square), pan (tray) | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET |
| P0-COLL-3 | fathead-keto / new-england-bar | **DISTINGUISHED** | dough (keto vs thin-crisp), pan (shallow) | DOUGH_VARIANT, PAN_BAKE |
| P0-COLL-4 | jamon-serrano / pinsa-romana | **DISTINGUISHED** | dough (standard thin vs multigrain long-ferment) | DOUGH_VARIANT |
| P0-COLL-5 | fugazza / fugazzetta | **DISCOVERY_RULE_BLOCKER** | none: same doughStyle, same sauce family, no mechanic evidence | new evidence or a product decision |

So 4 groups are resolved (by evidenced dimensions, and only once those capabilities exist), and 1
is still blocked.

The fugazzeta catalog candidate's `stuffedDough` tag was deliberately **not** applied to the
fugazzetta row. Doing so would silently resolve the blocker. The enclosed dish is evidenced
separately as `fugazzeta-rellena` (`catalogTagsNotApplied`).

### 6.2 Extended check over the whole matrix

The tool computes a full discovery signature for each row: identity set, dough, shape, form,
cook/pan, order, zones, late additions, prep, and sauce family. The **only** identical-signature
group among the 150 complete rows is fugazza/fugazzetta.

Eight rows have the same identity ingredient set as a catalog recipe they are not declared to
correspond to. These are flagged `SAME_INGREDIENT_SET_AS_CATALOG_RECIPE` for review:

- cauliflower-crust = shipped margherita
- fathead-keto and new-england-bar = shipped pepperoni
- chicago-stuffed = shipped salsiccia
- ny / trenton = {mozzarella, tomato-sauce}, the same set as greek-style and stuffed-crust
  candidates

Colorado Mountain Pie previously appeared in that last group as {mozzarella, tomato-sauce}. That
was wrong: its evidence lists the placeholder お好みの具材, so its real toppings are unknown. It is
now excluded from these analyses and remains blocked only by its EVIDENCE_GAP.

Each of them is separated only by the dough/pan/order capabilities listed. **This means discovery
matching must key on (ingredient set + dough/pan/form/order), not on ingredients alone.** That is
a design constraint for Progression 2.0.

## 7. Blockers, decisions and ledgers

A row is `BLOCKED_PRODUCT_DECISION` if it has any hard blocker:

| Blocker type | Rows | Rows where it is the only blocker type |
|---|---|---|
| BASE_SAUCE_UNSPECIFIED: generic family (カレー/ホット/甘辛/デザート/ホワイト/その他) with no listed sauce | 33 | 28 |
| UNRESOLVED_INGREDIENT (§7.1) | 21 | 13 |
| COMPOSITION_CONFLICT_CANDIDATE | 18 | 14 |
| MECHANIC_INTERPRETATION: Phase-0 flag backed only by inference, or unresolved timing | 11 | 8 |
| COMPOSITION_CONFLICT_SHIPPED | 9 | 7 |
| DISCOVERY_COLLISION (fugazza/fugazzetta) | 2 | 0 |
| EVIDENCE_GAP (pizza-a-caballo Fainá, colorado placeholder) | 2 | 2 |
| SCOPE_QUESTION (focaccia-genovese: is it a pizza? feteer: dessert+savory composition) | 2 | 1 |

Soft review items (`READY_WITH_REVIEW`, not blockers):

| Review item | Rows |
|---|---|
| naming cluster | 12 |
| candidate capability | 14 |
| same set as catalog recipe | 8 |
| prepared-composite ingredient | 3 |
| name-specificity gap (nduja, boerewors) | 2 |
| source inconsistency (manakish) | 1 |

Capability dependencies are **not** product blockers. They are listed per row.

### 7.1 Remaining ingredient ambiguities

These were never guess-filled. There are 13 distinct tokens across 21 rows, and the set of rows
matches Phase 0's excluded rows exactly:

| Token | Occurrences |
|---|---|
| 唐辛子 | 5 |
| ひき肉 | 5 |
| チーズ | 3 |
| ホワイトソース | 2 |
| 赤唐辛子 | 1 |
| 青唐辛子 | 1 |
| 肉 | 1 |
| ナッツ | 1 |
| チーズソース | 1 |
| カレーソース | 1 |
| スパイシーソーセージ | 1 |
| プロヴェルチーズ | 1 |
| 青のり | 1 |

**Leverage:** two decisions unblock the most. Deciding chili (唐辛子/赤唐辛子/青唐辛子 → 7 rows)
and ground meat (ひき肉 → 5 rows) together fully clears 9 of the 21 rows' ingredient blockers.
Keema and lahmacun need both. Pide also needs チーズ.

### 7.2 Composition-decision ledger

There are 32 correspondence rows:

- **5 are IDENTICAL**, so no decision is needed: bbq-chicken, quattro-stagioni, tonno-e-cipolla
  (shipped), ny-style, hawaiian.
- **27 need a product decision.** Each has explicit options in `compositionDecisionLedger`.

**Against SHIPPED recipes: 9.** Nothing was rewritten.

| Shipped | PIZZA DB difference |
|---|---|
| fugazza | +mozzarella, −olive-oil |
| breakfast-pizza | indeterminate: ホワイトソース unresolved, adds sausage/cheddar |
| genovese | +potato +pine-nuts, −cherry-tomato |
| marinara | +olive-oil only, once the トマトソース family is applied (Phase 0 compared the list alone) |
| meat-lovers | +beef, −mozzarella |
| bismarck | +ham +mushroom. Phase 0 listed it as "candidate", but `currentGameRecipe=true`, so it is really a shipped conflict. |
| **capricciosa** (new) | +artichoke +egg, −oregano |
| **quattro-formaggi** (new) | −olive-oil |
| **margherita** (new) | +olive-oil |

**Against candidates: 18.** These are all 9 from Phase 0 plus 9 newly surfaced: calzone
(salami vs ham), greek-style, chicago-deep-dish (+pepperoni), siciliana, supreme (−mozzarella),
buffalo-chicken, speck-e-brie, diavola (indeterminate), alla-norma, and fugazzeta (−olive-oil).

The newly surfaced conflicts come from comparing the full identity set (with the family-derived
base sauce) against every correspondence, not only the ones Phase 0 prose mentioned.

### 7.3 Naming clusters

All 7 clusters from the Phase-0 report are kept, and none is merged. They are recorded in
`namingClusterLedger` and attached to 12 rows:

- Napoletana ×3
- Bianca ×3
- Sicilian ×3
- Calabresa ×2
- speck-e-brie
- Frutti di Mare / Pescatore
- Chicago deep dish / stuffed

## 8. What this does not decide

- Which composition or naming option wins. The ledgers only enumerate the options.
- Which chili, ground-meat, cheese or sauce id an ambiguous token becomes.
- Whether the page-8 raw-salad family, taco toppings, the centre egg, NY fold-to-eat or lahmacun
  roll-to-eat are real mechanics. These are candidates only.
- Whether focaccia-genovese is a pizza.
- ★ thresholds, Pitz prices, unlock order, and production catalog ids. `canonicalCandidateId` is a
  stable proposal: the evidence id without its provenance suffix, or the catalog id when the
  composition is IDENTICAL. It is not a production id.

## 9. Verification

```
$ python3 tools/progression2_mechanic_matrix.py --check
Rows: 172 (unique 172)
Current-flow representability: {'FULL': 101, 'PARTIAL': 55, 'NOT_REPRESENTABLE': 16}
...
All matrix validations passed.
```

The matrix validator enforces all of the following. Any failure exits non-zero.

- There are exactly 172 rows, and the ids are unique.
- The ids and order equal the master evidence. Nothing is invented, and nothing is missing.
- nameJa, sauceFamily and doughStyle are unaltered.
- Each token trace mirrors the source list. Every ambiguous or needs_review token keeps
  `canonicalId=null` and appears in `unresolvedTokens`.
- The unresolved-row set equals the 21 rows excluded by the Phase-0 deadlock analysis.
- A row with an unresolved **or excluded-placeholder** token has no identity set, and identity-set
  presence always equals the `complete` flag. Regression case `colorado-mountain-pie-pizzadb-p3`:
  it must keep お好みの具材 as excluded, be incomplete, have no identity set, stay out of both
  collision analyses, and carry no same-set review item. Reverting the fix makes `--check` fail
  with 7 errors.
- Every doughStyle and sauceFamily string is classified.
- Every required capability has required-strength evidence, and SERVE_FORM is never required.
- The representability rules hold, and no Phase-0 mechanic row is FULL.
- The collision ledger covers all 5 Phase-0 groups, and blocked groups are row blockers.
- The composition ledger equals the 32 correspondence rows. All 14 Phase-0 conflicts remain
  PRODUCT_DECISION_REQUIRED, and every conflict is a row blocker.
- Status and blocker consistency holds.
- The summary recounts match.
- `--check` fails if the committed JSON or MD differs from a fresh regeneration. Running it twice
  produces byte-identical output.

Existing Phase-0 validators, re-run on this branch, are unchanged and green:

- `validate_recipe_catalog.py`: 53/62/11 checks, all passed.
- `progression2_phase0_analysis.py`: 0 deadlocks.
- `progression2_phase0b_analysis.py`: 0 deadlocks.
- `progression2_ingredient_canonicalizer.py`: 36/36 self-test.
- `progression2_recipe_row_ingest.py --check`: 172/172.
- `progression2_evidence_invariants.py`: 4/4.
- `progression2_full172_deadlock_analysis.py`: 151 pool, 5 collisions, 0 deadlocks. Its output
  is byte-identical after re-running.

## 10. Next milestone

Progression 2.0 progression/economy design against this candidate population.

The suggested inputs are:

- the 56 FULL + decision-ready rows as the content-only pool;
- the capability order in §5 as the mechanic-gated tiers;
- the decision ledgers in §7 as the owner's decision backlog.

Base-sauce choice (the only blocker for 28 rows) and chili/ground-meat (9 rows) are the
highest-leverage decisions.
