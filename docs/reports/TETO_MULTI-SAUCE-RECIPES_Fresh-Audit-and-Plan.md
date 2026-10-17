# Multi-Sauce Recipes — Fresh Audit & Implementation Plan

Status: **read-only audit + design.** No `src/**`, recipe data, or ingredient data was changed. No PR merge, no deploy.
Audit base: `origin/main` = `d69e43e` (PR #517). Audit-only → exempt from Human Verification video / screenshots
(`docs/PROJECT_HANDOFF.md`, "Audit-only tasks are exempt").
Out of scope / untouched: #503, #517, #518, #520 (and #468, #478).

## 0. Source limits (read first)

- **pizzadb.jp could not be re-fetched in this session** (proxy returns 403 on CONNECT). Everything below about PIZZA DB comes from the
  repo's own recorded evidence: `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` (172 rows, relayed by the Owner's web
  access in Phase 0B) and the derived `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`. It was **not** independently
  re-verified against the live site.
- That evidence records, per recipe: `sauceFamily` + an **ingredient list**. It does **not** record *when* an ingredient is applied
  (before bake vs. finishing) or *how much*. So "olive oil is only a finish" **cannot be proven or disproven from the repo evidence**; where I
  label a row below, the label is a classification of evidence strength, not a culinary fact.
- `data/recipes/pizza_master_catalog.json` entries other than the shipped ones are "general culinary knowledge (unverified)" by that file's
  own `schemaNote`; they are not used as evidence of any real recipe here.
- #519 was **not independently re-run in a browser**; the repro result quoted below is the issue's own (Chromium 390×844) and I confirmed the
  mechanism by reading the code.

## 1. Actual counts (fresh)

| Item | Value |
|---|---|
| Shipped recipes (`RECIPES`) | **57** (the "53" in the brief is stale) |
| Shipped ingredients | **64**; only **3** have `category: "sauce"`: `tomato-sauce`, `olive-oil`, `pesto` |
| Shipped recipes requiring **2+ sauce ingredients** | **0** |
| PIZZA DB evidence rows | 172 |
| Rows with ≥2 spread-layer candidates (matrix `spreadLayerCount ≥ 2`) | **26** |
| …of which both layers literally appear in the row's ingredient list | **4** (grandma, buffalo-chicken, okonomiyaki, radicchio-noci) |
| …of which one layer is only inferred from `sauceFamily` | 22 |
| …of which need **no new ingredient** | **5** (grandma, sfincione, + 3 that collide with shipped recipes / have an unresolved token: margherita-row, marinara-p13, pizza-de-cancha) |

**Headline finding:** across all 172 rows there is **no pizza whose evidence shows two independent pre-bake *base* sauces** (e.g. tomato + pesto).
Every "multi-source" row is *base sauce + one of* olive oil / honey / mayo / dressing / chutney / balsamic. The real question is therefore not
"can the game hold two sauces" (it already can — see §4) but "which of these second sauces deserve to be a required, scored, discoverable part
of a recipe".

## 2. Candidate table (all 26 rows, by evidence strength)

Legend — **Both listed**: both spread items are in the PIZZA DB ingredient list. **Derived**: base inferred from `sauceFamily` only (matrix
`family_derived`), second item is listed. **Unspec.**: family names a generic base (ホットソース/ホワイトソース/甘辛だれ/デザート) with no concrete sauce item →
blocked on a content decision. "New" = ingredients not in `src/data/ingredients.ts`.

### 2a. Playable with existing ingredients only

| Recipe (evidence id) | Sauce combination | Other ingredients | New | Evidence | Shipped overlap | Matrix status |
|---|---|---|---|---|---|---|
| グランマピザ (`grandma-pizza-pizzadb`) | tomato-sauce + olive-oil — **Both listed** | mozzarella, garlic | none | comparison table p-orig | none | READY |
| スフィンチョーネ (`sfincione-pizzadb`) | tomato-sauce (**Derived**) + olive-oil | onion, anchovy, oregano; no cheese | none | comparison table | none (superset of `fugazza` {olive-oil, onion, oregano}; differs from `napoletana`) | READY_WITH_REVIEW |
| マルゲリータ (`margherita-pizzadb-row`) | tomato (Derived) + olive-oil | mozzarella, basil | none | profile page | **= shipped `margherita` + oil (PIZZADB_SUPERSET)** | BLOCKED |
| マリナーラ (`marinara-pizza-pizzadb-p13`) | tomato (Derived) + olive-oil | garlic, oregano | none | comparison table | **= shipped `marinara` + oil** | BLOCKED |
| ピッツァ・デ・カンチャ (`pizza-de-cancha`) | tomato (Derived) + olive-oil | garlic, oregano, 唐辛子 | — | profile page | unresolved `唐辛子` token | BLOCKED |

The two BLOCKED shipped-overlap rows must **not** be "fixed" by adding olive-oil to the shipped recipes: that changes their Discovery identity
(`sauceBase` is an exact-match axis) and would orphan existing Dex entries / hint ladders.

### 2b. One new ingredient

| Recipe | Sauces | New | Notes |
|---|---|---|---|
| ブラータピザ (`burrata-pizza-pizzadb-p10`) | tomato (Derived) + olive-oil | burrata | READY |
| ピッツァ・アッラ・クルダイオーラ (`…crudaiola-p8`) | tomato (Derived) + olive-oil | burrata | READY |
| ペストブラータピザ (`pesto-burrata-pizzadb-p12`) | pesto (Derived) + olive-oil | burrata | READY; only candidate exercising green-on-pale-oil |
| ペスカトーレ (`pescatore-pizzadb-p11`) | tomato (Derived) + olive-oil | mussel | READY_WITH_REVIEW; 7 non-sauce ingredients |
| ペストノーチピザ (`pesto-noci-pizzadb-p12`) | pesto (Derived) + honey | honey, walnut | honey is a new *sauce-class* item |
| ホットハニーペパロニ (`hot-honey-pepperoni-pizzadb-p12`) | tomato (Derived) + honey | honey | catalog design tag says honey is post-bake → FINISH-dependent |
| ンドゥイヤピザ (`nduja-pizza-pizzadb-p14`) | ホットソース (**Unspec.**) + honey | honey | BLOCKED (base undefined) |
| ナッシュビルホットチキン (`…p6`) | ホットソース (Unspec.) + honey | honey, pickles | BLOCKED |
| 南アフリカ ボアヴォース (`…boerewors-p14`) | 甘辛だれ (Unspec.) + chutney | chutney | BLOCKED |

### 2c. Two or more new ingredients, or blocked for other reasons

| Recipe | Sauces | New / blocker |
|---|---|---|
| バッファローチキン PIZZA DB版 | buffalo-sauce + blue-cheese-dressing — **Both listed** | 2 new sauces; DIVERGENT vs. catalog `buffalo-chicken`; dressing is a catalog post-bake tag |
| お好み焼き風ピザ | okonomiyaki-sauce + mayo — **Both listed** | 4 new (cabbage, bonito-flakes, 2 sauces) + unresolved `青のり` |
| ピザサラダ | tomato (Derived) + yogurt-sauce | 3 new (yogurt-sauce, lettuce, cucumber); thin-bake "salad" dish |
| ラディッキオ・ノーチ | balsamic + olive-oil — **Both listed**, ノンソース family | 3 new; family says *no sauce* → conflicts with TQ NO_SAUCE; MECHANIC_INTERPRETATION blocker |
| バッファローカリフラワー / じゃがマヨ / レイナペピアーダ / 明太子もち / エロテ / 照り焼きチキン / ケバブ | generic base (Unspec.) + mayo/dressing/kebab-sauce | base sauce undefined (BASE_SAUCE_UNSPECIFIED) |
| フェテイール・メシャルテル | dessert base + honey + butter | NOT_REPRESENTABLE (lamination), SCOPE_QUESTION |

### 2d. "Required second sauce" vs. "finish-only oil" classification

| Class | Meaning (evidence-based) | Rows |
|---|---|---|
| **R — required 2nd sauce, evidenced** | Both sauces listed in the PIZZA DB ingredient list **and** no catalog post-bake tag on either | grandma (tomato+oil), okonomiyaki (sauce+mayo*), radicchio-noci (balsamic+oil**) |
| **F — finish-tagged** | The repo's catalog design tag marks the 2nd item post-bake | buffalo-chicken (sauce, dressing), hot-honey-pepperoni (honey), teriyaki-chicken (mayo, nori) |
| **D — derived base + listed oil/honey** | Base is inferred from `sauceFamily`; the 2nd item's timing is not recorded | sfincione, burrata, crudaiola, pescatore, pesto-burrata, pesto-noci, pizza-salad, margherita/marinara rows, de-cancha |
| **U — base undefined** | Generic family with no concrete sauce | 10 rows (§2c) |

\* mayo in a Japanese-style dish is commonly a drizzle, but the repo evidence does not say. \** blocked by the NO_SAUCE family conflict.

**Honest reading:** *only grandma is both "needs two spread items" by the listing and playable today.* Whether PIZZA DB's olive oil there is a
pre-bake coat or a finishing drizzle is **not recorded**. The game already treats olive oil as a pre-bake `PAINT_TEMPORARY` sauce in 9
shipped recipes (fugazza, pizza-bianca, vongole, …), so modelling grandma/sfincione as "tomato layer + olive-oil layer, both pre-bake" is
consistent with existing precedent and needs no FINISH. Owner confirmation against the live PIZZA DB pages is recommended before shipping (§8).

## 3. Engine audit — what is already multi-sauce-safe (verified by reading `main`)

| Area | Finding |
|---|---|
| Pizza state | `sauceIds: string[]` + append-only `sauceDeposits` with per-deposit `ingredientId` stamps (B1 #498, `state/sauceLedger.ts`). `COMMIT_SAUCE_DISPENSE` appends instead of replacing (`gameReducer.ts:~972`). |
| Caps | Per-kind 100% (`SAUCE_MAX_QUANTITY=1.0`) and pizza-wide 200% (`SAUCE_TOTAL_MAX_QUANTITY=2.0`). Two kinds can never hit the total cap before their own caps. |
| Stock | `canPlaceIngredient` gates a *new* kind; `consumePizzaInventory` charges one unit per distinct sauce id. |
| Discovery | `RECIPE_DISCOVERY_CATALOG` derives `items` and `sauceBase` (an **array**) from `requiredIngredients`; `matcher` compares `sauceBase` as an exact sorted list; `signatureOfPizza` observes all sauce ids. `spreadLayers` axis is deliberately `FIXED_BY_FLOW`. A 2-sauce recipe needs no matcher change. |
| Hint 5.0 | SAUCE rung is "every sauce" (`hint5Ladder.ts` `inCategory("sauce")`), so a 2-sauce recipe gets one rung naming both. |
| Research | `researchResultRows` and `sauceKinds.research.test.ts` already cover several kinds. |
| Cooking steps | `deriveCoreSteps` adds one SAUCE step if any non-POST_BAKE sauce requirement exists; both sauces are painted in that one step. |
| Rendering | B2/#494: chronological runs, later runs over earlier, ×0.7 dimming of the upper run where it overlaps, bounded canvas budget (≤24 on pizza, ≤44 cut). |
| Save | `PersistentSave` has no `sauceIds`/`sauceDeposits` (pizza state is not persisted). A new recipe id is additive (Batch 7a precedent: no migration). |

## 4. Engine audit — real single-sauce assumptions (obstacles)

| # | Where | Assumption | Effect on a 2-sauce recipe | Size |
|---|---|---|---|---|
| T1 | `data/recipeSauceProfiles.ts` | one `RecipeSauceProfile` per recipe (`ingredientId` union of the 3 sauces) | profile = the **primary** sauce only; no per-sauce interaction for the 2nd | none if "primary = reference sauce" is kept |
| T2 | `data/referencePizza.ts` `ReferencePizza.sauce: ReferenceSauce \| null` | one reference sauce (quantity/coverage) | 2nd sauce has **no target**; scoring and the Completion Gate judge only the primary (`scoringV2/index.ts` "judged by the reference sauce's OWN deposits"; `completionGate.checkSauceQuantity`). | none if presence-only is accepted; M if per-sauce targets wanted |
| T3 | Completion Gate / Recipe component | 2nd sauce counts by **presence** (`countUsedIngredient ≥ minCount(1)`) | one stray tick of oil passes; missing oil costs 1/N of the Recipe component and fails the Gate `MISSING_REQUIRED_INGREDIENT` | by design; flag to Owner |
| **T4** | `data/hints.ts` `buildHintLine` | `recipe.requiredIngredients.find(category === "sauce")` — **first sauce only**; the `missingReq` loop then **skips every sauce** | if the 2nd sauce is missing the tray hint falls through to "いい感じ！「焼く！」を押してみよう" — a false "ready" | S (small, local, needs tests) — **the one real bug-class item** |
| T5 | `state/executionAdvice.ts` | "thin sauce" advice uses **pooled** deposits vs. the generic reference | with two kinds, a thin primary can be masked by the other kind's deposits | S; advice only (not scoring) |
| T6 | `data/referencePizza.ts` | each recipe needs a hand-authored Reference (pieceGroups) | per-recipe content cost, same as any recipe (~40–130 lines) | per recipe |
| T7 | `App.tsx:759` `handleTapPizza` → `APPLY_SAUCE` | legacy one-shot **replaces** `sauceIds`/`sauceDeposits` | unreachable from touch UI (paint mode); keyboard path guarded (`PizzaStage.tsx:944`). Latent hole, same as #519 note 2 | S defensive |
| T8 | Ladder / ownership | `olive-oil` is owned only from ladder step 13 (`fugazza`), garlic step 14 (**corrected in Design Lock**; first draft said step 10) | grandma/sfincione must unlock after step 14 (garlic) or the reducer rejects the oil (`ownedIngredientIds` guard) | content wiring |
| T9 | CUT | `CUT_ELIGIBLE_RECIPE_IDS` is opt-in, so new recipes don't get CUT | multi-sauce + CUT renders per piece (component-tested only, 4 pieces × 3 runs); #467 reports Android CUT piece breakage | keep CUT **off** at first |
| T10 | FINISH engine | `PostBakePiece` / `applicationPhase` handle **pieces** only; SAUCE step is skipped for POST_BAKE sauce reqs | a post-bake drizzle (honey, dressing, mayo) is not representable. Depends on #518 / D2-2 and still wouldn't cover liquids | L — out of scope here |
| T11 | Golden/ledger tests | counts pinned (recipes 57, ladder 53, hint5 ladders, consume-hash "58-id finite set") | each addition updates fixtures (7a precedent: ~30 files) | per batch |

## 5. #519 and #502 vs. the candidates

**#519** ("earlier sauce disappears"): the issue itself reports **no repro on `d69e43e`** (B1/B2 landed; Chromium 390×844, Free + Research,
tomato→pesto through RESULT keeps both layers' pixels; `sauce-layers-b2.spec.ts` 8/8). I agree from the code: `planSauceCommit` appends,
`sauceRunsOf` builds one run per kind-switch. Impact on candidates:

- Real *data* loss: none on the touch path (T7 is latent only).
- *Perceived* loss: possible when the player paints **oil first, tomato second** — the later run is drawn on top and dims the lower layer ×0.7
  where they overlap, and pale oil under red is hard to see. Scoring is order-agnostic, so this is cosmetic, but a recipe whose *required*
  second sauce is oil will make it the common case. Mitigation without changing rules: authoring order in hints ("先にトマト、あとからオイル").
- Therefore "resolving #519" for these recipes means: (a) get the Owner's repro conditions (device, PWA cache, mode, order, video), and
  (b) pin the multi-sauce **recipe** path with an E2E, not a rendering rewrite. I did not find a defect to fix.

**#502** (dot-fallback loses the baked oil colour): the issue is still open, but `SauceMergedCanvas.tsx:111` on `main` already applies
`bakedOil && ingredientId === "olive-oil" ? bakeOilHex(...)` in the merged-heatmap fallback — i.e. the issue's proposed one-line fix
(the overflow canvas has the same expression at `:141` and `:160`). I could not run tests here (no `node_modules`), so I did not confirm a
covering test for the *heatmap* fallback branch specifically. Recommendation: verify, add the one missing test if absent, and close #502.
Candidate impact: reachable only with >~12 alternating runs **and** a canvas failure; none of the recommended recipes gets near that.

## 6. Rendering requirements (SAUCE → BAKE → CUT → RESULT)

| Stage | Requirement | Status |
|---|---|---|
| SAUCE (painting) | each sauce is its own run/layer; switching sauces never clears; overlap dims upper run | **done** (B2/#494) |
| Layering order | tomato→oil (oil on top) is the natural read; oil→tomato hides the oil | done; add hint wording, no engine change |
| BAKE | merged/own layers carry `pizza-sauce-heatmap--<bakeState>` classes; oil group keeps oil CSS only when oil-only, otherwise baked colour | done |
| 焼成後 (post-bake) | not needed for the recommended recipes (all pre-bake) | **n/a**; FINISH/#518 independent |
| CUT | keep recipes out of `CUT_ELIGIBLE_RECIPE_IDS` in Phase A; enabling later needs Android check (#467) and Owner opt-in | deferred |
| RESULT | same `PizzaStage` path at 0.75 scale; need a Result screenshot with both layers visible | verify in HV |

## 7. Phase 2 — Implementation plan

### 7.1 Selection (1–3, existing ingredients first)

1. **グランマピザ** `grandma-pizza` — tomato-sauce (primary / Reference sauce) + olive-oil (secondary), mozzarella, garlic. *Why:* both sauces
   listed; zero new ingredients; zero overlap with shipped identities; READY in the matrix.
2. **スフィンチョーネ** `sfincione` — tomato-sauce + olive-oil, onion, anchovy, oregano (no cheese). *Why:* zero new ingredients; **conditional**
   on Owner confirming the PIZZA DB page (tomato is `family_derived`) and accepting that pizzadb's dough style is unrecorded (no thick-dough model).
3. **(Hold — not in Phase A)** **ペストブラータ** `pesto-burrata` — pesto + olive-oil, burrata, fresh-tomato. The only candidate that tests a
   second colour pair (green on pale oil), but needs `burrata` (new ingredient + icon + taxonomy OD), so it should wait for the icon track.

Not recommended now: anything needing honey/mayo/dressing (new *sauce-class* ingredient ⇒ taxonomy, colour, paint behaviour, `RecipeSauceProfile`
union, tray palette, and a post-bake question) or any row in U/F.

### 7.2 Staged plan (spec change minimised)

| Stage | Scope | Touches | Does NOT touch |
|---|---|---|---|
| **S0 Owner gate** | decisions in §8; verify grandma/sfincione pages on pizzadb.jp | docs | code |
| **S1 Hint fix (T4)** | `buildHintLine`: evaluate **all** sauce requirements; "missing sauce" line names the first absent one. Add unit tests incl. a synthetic 2-sauce recipe fixture. Behaviour for the 57 shipped single-sauce recipes must be byte-identical (golden). | `data/hints.ts` (+tests) | scoring, reducer, Discovery |
| **S2 Guard tests** | fixture-based tests proving a 2-sauce recipe: Discovery match + sauceBase exact match, Hint 5 SAUCE rung lists both, completion gate (missing 2nd ⇒ MISSING_REQUIRED_INGREDIENT), scoring unchanged for primary, inventory charges per kind, `deriveCoreSteps` ⇒ one SAUCE step. Optional defensive `APPLY_SAUCE` ledger fix (T7), separate micro-PR. | tests; optionally `gameReducer.ts` | recipe data |
| **S3 Recipe 1 (grandma)** | `recipes.ts` entry, `RECIPE_SAUCE_PROFILES` (primary tomato-sauce/PAINT), Reference fixture, discovery target id, ladder/unlock (`ladderCredit:false` since no new material — Owner decision), `recipeHintRoles`, orders/size-class entries, ledger/golden updates, E2E: paint tomato→oil→cheese→bake→RESULT with both layers visible. HV video 390×844 + before/after screenshots (UI/gameplay ⇒ HV policy). | data + tests | scoring weights, CUT allowlist |
| **S4 Recipe 2 (sfincione)** | same checklist; extra check that fugazza/napoletana Discovery/near-miss text is not confused (superset/subset). | data + tests | — |
| **S5 (later)** | optional per-sauce Reference targets (T2) / presence-only quantity floor for the secondary sauce; Lunch Rush inclusion; CUT opt-in after #467. | design first | — |

Scoring/Discovery/hint **spec changes in Phase A: one** (S1, a bug-class fix). Everything else is data + tests.

### 7.3 Parallelism

| Track | Overlap with this work | Verdict |
|---|---|---|
| **FINISH D2-2 / #518** (bake filter on `.pizza-dough`, PostBakePiece, `finishD2Inert.test.ts`) | no recommended recipe uses `applicationPhase: "POST_BAKE"`; `deriveCoreSteps` unchanged; no CSS bake-filter edits | **Parallel-safe** if S1–S4 avoid `App.css` bake-filter blocks and `PizzaStage.tsx`. Keep the `finishD2Inert` guard green. |
| **SVG Pilot A / #503** (hot-dog, sausage, feta, ricotta; touches `ingredients.ts`, `IngredientGlyph`, `IngredientPieceVisual`, `IngredientTray`, `InventoryOverlay`, `App.css` cheese rules, `rt01ReferenceRegression.test.tsx`) | grandma/sfincione add **no ingredient** and touch none of those files | **Parallel-safe** for S1–S4. Textual-conflict risk only in shared test lists (`recipes.test.ts`, `catalogLedger.test.ts`, goldens); rebase after #503 merges. pesto-burrata (needs `ingredients.ts` + icon) should be **sequenced after** the icon track. |
| #520 (bake gauge 5-level) / #468 / #478 | not touched | independent |

### 7.4 Existing-issue overlap

- Searched open issues/PRs for: multi-sauce / 複数ソース / 二つのソース / olive-oil+tomato / grandma / sfincione / per-kind ledger.
  **No open issue tracks multi-sauce *recipes*.** Related but not duplicates: #489 (ledger/gauge — landed via #498/#494/#500, issue still open),
  #519 (render report), #502 (fallback colour), #182 (Progression 2.0 parent), #294 / #518 (FINISH), #320 (CUT-skip on sauce shortage, unrelated).
- Created a dedicated tracking Issue (linked at the end of this file).

## 8. Owner decisions needed

1. **Scope of "multiple sources":** accept that no 172-row shows two independent base sauces, and that Phase A means *base + olive-oil coat* (pre-bake)?
2. **Verify against live PIZZA DB** (this session cannot): grandma-pizza and sfincione pages — are tomato/oil both part of the base, and is the oil a coat or a finish?
3. **Secondary-sauce rules:** presence-only (recommended for Phase A) vs. per-sauce Reference target / minimum amount.
4. **Ladder/Dex credit:** `ladderCredit:false` (no new material) for both recipes? Lunch Rush participation (`lunchRush:false` default recommended until balance is checked)? Which shipped recipe gates their unlock (grandma: makeable from ladder step 14)?
5. **sfincione:** go / hold (tomato is family-derived; dough style unrecorded).
6. **CUT:** keep both recipes without CUT in Phase A (recommended).
7. **#519:** request the Owner's repro conditions or close as not reproducible; approve the small `APPLY_SAUCE` defensive fix as a separate PR?
8. **#502:** verify and close, or keep for the test gap?
9. **Honey/mayo/dressing family (F/U classes):** defer until FINISH supports liquids and a sauce-class taxonomy is decided?
10. Naming: grandma id `grandma-pizza` / display グランマピザ; sfincione id `sfincione` / スフィンチョーネ — confirm.

## 9. Recommended order

S0 (Owner gate) → S1 (hint fix, tiny) → S2 (guard tests; optional T7 micro-PR) → S3 grandma → S4 sfincione (if approved) → later: pesto-burrata after icon track, per-sauce targets, CUT.

---
Tracking issue: #521

> **Update (Design Lock):** see `TETO_MULTI-SAUCE-RECIPES_Design-Lock.md` — #519 is reproducible for tomato → olive oil (§3), the unlock step is 14 not 10, and the DH4 privacy gate must be re-run for the first 2-sauce recipe (§5.4).
