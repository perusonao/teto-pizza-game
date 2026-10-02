# Discovery 3.0 No.27 — Candidate Decision Fresh Audit

**AUDIT ONLY. Docs-only.** No recipe, ingredient, ladder, Hint, N2, R6, Issue, PR or merge. No ranking, no
scoring, no automatic No.27 decision: this report puts the five strict candidates side by side so the Owner can
decide.

| Item | Value |
|---|---|
| Audited main SHA | `2cf7a5d75ff27e5725de543836c9c15da3c482d4` (`origin/main` after a fresh fetch; equal to the SHA given in the brief, main had not advanced) |
| Branch (docs-only) | `claude/discovery-3-no27-audit-2w9mpn` |
| Date | 2026-10-02 |
| Run | read-only Python scratch scripts over committed JSON / TS source. No Vitest, Chromium, WebKit, HV, Codex or build. `node_modules` is not installed, so the dev Progression Inspector (`src/dev/discoveryProgressionModel.ts`) was **not** run; its rules were mirrored by hand (§5.1, limits in §10). |

---

## 0. Read this first

1. **The "existing 172 Recipe Readiness Audit" is not a named file on `origin/main`.** A repo-wide search (file names,
   `readiness`, `strict`, remote branches — only `main` and this branch exist) found no such report. The audit was
   rebuilt from the committed 172 authorities it would have drawn on, and only those were used:
   `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` (rows, ledgers),
   `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` (source rows),
   `docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json` (SHIPPED_KEEP targets, historical star-model steps),
   `docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json` (family authority).
   The 172 rows were **not** re-investigated one by one; only the 5 candidate rows plus the aggregate in §6.
   If a separate readiness JSON exists on an unpushed branch, the §6 numbers should be diffed against it.
2. The five candidate ids are taken from the brief. The loose filter "READY / READY_WITH_REVIEW, FULL, ingredient-complete,
   exactly 1 id outside the 29 current ingredients, not already production" returns **22** rows that include all five
   (§9). The extra criteria that made these five "strict" are not reproducible from main and were not re-derived.
3. **Source authority and gameplay calibration are kept apart throughout.** §3 / §4 are source authority (what the 172
   evidence actually says). §8 is gameplay calibration (what the 172 evidence does not say and the Owner / Human Review must
   set). PR-4b-B (`brazilian-calabresa`) is the precedent for that split (Owner D-6).

---

## 1. Production baseline at `2cf7a5d`

| Fact | Value | Where |
|---|---|---|
| Recipes | 26 (25 W1 + `brazilian-calabresa`, No.26) | `src/data/recipes.ts` |
| Ingredients | 29 (3 starters: `tomato-sauce`, `mozzarella`, `basil`; 26 finite materials) | `src/data/ingredients.ts` |
| Ladder | W1 steps 1–24 **frozen** (LAD-1); later unlocks only appended at step 25+ via `POST_W1_APPENDED_STEPS` (currently empty) | `src/data/discoveryLadder.ts` |
| Ladder count | credited discoveries; `ladderCredit:false` recipes are not counted. Credited population = 25 (calabresa excluded). 25 credited = "step 25 reached" | `countsTowardLadder` |
| Pool rule (D-1) | exactly 1 DISCOVERABLE = auto target; 2+ with no pin / sticky / purchase = `OPEN_POOL` (no target, no count, no names); Dex shows one aggregated unknown card | `hintTarget.ts`, PR-4b-A |
| Lunch Rush (D-4) | `lunchRush:false` keeps a recipe out of the pool | `participatesInLunchRush` |
| Matcher | exact ingredient set **and** exact sauce base **and** identity dimensions; superset / subset = original pizza | `matcher.ts` |
| Hint | 25 keyed recipes + 1 key-free (`{keyFree:true}` → SAUCE, [CHEESE if any], STRUCTURE, one SUB_CLASS per topping; no KEY_TOPPING, no empty rung) | `recipeHintRoles.ts`, `hint5Ladder.ts` |
| Shop price | step 15–29 = T3: pack 100 / refill 50 Pitz; pack = 10 × k (k = largest `minCount` of the ingredient in any recipe) | `materialShop.ts` |

**Existing pool baseline (re-derived, matches PR-4b-B §3):** steps 1–11 pool 1 each; **steps 12–24 pool 2**
(`brazilian-calabresa` + that step's key recipe) for as long as calabresa is undiscovered; a player who found calabresa
first has pool 1 throughout. Steps 0–24 are the same with or without any candidate added (§5.1).

---

## 2. Reading the table

- "Current 29" = the ids in `ingredients.ts` today (includes `clam`, `fresh-tomato`, `capers`, which the older 62-catalog
  does not).
- "New ingredient" = the one id in the candidate's identity set that is not among the 29.
- Identity set = the Phase-2 SHIPPED_KEEP target `items` (base sauce included). Verified equal to the Phase-1 matrix
  `identityIngredientSet` for all five.
- Nothing in the table ranks the candidates.

---

## 3. Side-by-side comparison — source authority

| | **vongole** | **prosciutto-funghi** | **pesto-gamberi** | **pesto-trapanese** | **pesto-pollo** |
|---|---|---|---|---|---|
| canonical id (candidate) | `vongole` | `prosciutto-funghi` (**catalog twin is `prosciutto-e-funghi`**, §7) | `pesto-gamberi` | `pesto-trapanese` | `pesto-pollo` |
| evidence id / Phase-2 target id | `vongole-pizzadb` | `prosciutto-funghi-pizzadb-p11` | `pesto-gamberi-pizzadb-p11` | `pesto-trapanese-pizzadb-p11` | `pesto-pollo-pizzadb-p12` |
| display name (source `nameJa`) | ヴォンゴレピザ | プロシュットフンギ | ペストガンベリピザ | ペストトラパネーゼピザ | ペストポッロピザ |
| source authority | pizzadb.jp world-pizzas comparison table; original Phase-0B sample batch (page 1); `corroborationCount` 1; row already in canonical ids | pizzadb.jp comparison table page 11; relayed (not independently re-fetched by the evidence session); corroboration 0 | same, page 11; corroboration 0 | same, page 11; corroboration 0 | pizzadb.jp comparison table page 12; relayed; corroboration 0 |
| source ingredient list | clam, garlic, olive-oil, parsley | モッツァレラチーズ, 生ハム, マッシュルーム | エビ, トマト, にんにく | アーモンド, トマト, にんにく | チキン, トマト, モッツァレラチーズ |
| identity set (with base) | clam, garlic, olive-oil, parsley | mozzarella, mushroom, prosciutto-crudo, tomato-sauce | fresh-tomato, garlic, pesto, shrimp | almond, fresh-tomato, garlic, pesto | chicken, fresh-tomato, mozzarella, pesto |
| reusable from current 29 | clam, garlic, olive-oil (3 of 4) | mozzarella, mushroom, tomato-sauce (3 of 4) | fresh-tomato, garlic, pesto (3 of 4) | fresh-tomato, garlic, pesto (3 of 4) | fresh-tomato, mozzarella, pesto (3 of 4) |
| **new ingredient (1)** | `parsley` | `prosciutto-crudo` | `shrimp` | `almond` | `chicken` |
| quantity authority | **none** (names only) | none | none | none | none |
| bake authority | **none** (no time / temperature; method = `bake`; dough `null`) | none (dough ナポリピッツァ生地, no time) | none (same) | none (same) | none (same) |
| sauce / base — what the source says | family **ノンソース** ("explicitly no sauce"); `olive-oil` is a listed ingredient (spread layer) | family トマトソース → `tomato-sauce` (`family_derived`, not a listed ingredient) | family バジル → `pesto` (`family_derived`) | family バジル → `pesto` (`family_derived`) | family バジル → `pesto` (`family_derived`) |
| cheese | none in source | mozzarella (listed) | none in source | none in source | mozzarella (listed) |
| dough / mechanic evidence | none required; FULL; no capability; `postBakeFinish: []`; CUT optional | same | same | same | same |
| Phase-1 status | READY | READY_WITH_REVIEW (`SAME_INGREDIENT_SET_AS_CATALOG_RECIPE`, ledger class D, non-blocking) | READY | READY | READY |
| Phase-2 class | EVIDENCE_READY_TARGET | EVIDENCE_READY_TARGET | EVIDENCE_READY_TARGET | EVIDENCE_READY_TARGET | EVIDENCE_READY_TARGET |

Source-authority notes that matter:

- **Pesto sauce is derived, not listed**, for gamberi / trapanese / pollo. The matrix rule: all 11 バジル-family rows are
  ペスト dishes and the existing basil sauce is `pesto`. The shipped `pesto-caprese`, `pesto-tonno`, `pesto-patate` use the
  identical derivation, so this is an existing production pattern, not a new decision.
- **vongole is the one candidate whose sauce authority is not a straight derivation.** The source family is ノンソース
  (explicitly no sauce) while `olive-oil` is listed; production models olive-oil as a sauce-category item
  (`olive-oil` is `category: "sauce"`; profile `PAINT_TEMPORARY`, as `fugazza`, `pizza-bianca`, `quattro-formaggi`).
  `new-haven-apizza` is not an exact precedent: its source family is オイル (an explicit oil), vongole's is ノンソース.
  Modelling vongole's olive-oil as its base → SAUCE hint rung = olive-oil and matcher `sauceBase = ["olive-oil"]` while
  the source says "no sauce". Not wrong, but it is a modelling decision the Owner should see (§12 item 4).
- **Same-source-family siblings are already shipped** for the three pesto candidates (pesto-caprese / tonno / patate,
  page 11–12 of the same table).

---

## 4. Side-by-side comparison — production cost and Hint

| | **vongole** | **prosciutto-funghi** | **pesto-gamberi** | **pesto-trapanese** | **pesto-pollo** |
|---|---|---|---|---|---|
| new `ingredients.ts` row | 1 (`parsley`, topping) | 1 (`prosciutto-crudo`, topping) | 1 (`shrimp`, topping) | 1 (`almond`, topping) | 1 (`chicken`, topping) |
| new ingredient in the 62-ingredient master catalog | yes (`herb.leaf`, Owner OD-T1 confirmed) | yes (`meat.cured`, OD-T1) | yes (`seafood.shellfish`, OD-T1) | **no — absent from the 62 catalog** (only `walnut` = `other.nut-seed`) | yes (`meat.poultry`, OD-T1) |
| **Hint family of the new ingredient** | `herb` | `meat` | `seafood` | **no authority**; precedent walnut → `other`; `taxonomy` comment says nuts share `other` | `meat` |
| new family needed? | no | no | no | no (would join `other`, currently only `egg`) | no |
| family sizes before → after (22 toppings today: meat 4, seafood 3, vegetable 8, fruit 1, herb 4, spice 1, other 1) | herb 4→5 | meat 4→5 | seafood 3→4 | other 1→2 | meat 4→5 |
| visual | new emoji / `pieceVisual` needed; `🌿` already shared by `pesto`/`basil`; W1 ingredients each passed a **Human Visual Gate** | no standard emoji for cured ham (`🥓` bacon, `🍖` ham taken) → likely dedicated visual | `🦐` exists | no almond emoji (`🌰` / `🥜` are not almonds) → likely dedicated visual | `🍗` exists |
| recipe row | 1 (`requiredIngredients` + `bakeTarget` + `baseRewardPitz`) | 1 | 1 | 1 | 1 |
| sauce profile | `olive-oil` / `PAINT_TEMPORARY` (existing) | `tomato-sauce` / `PAINT` | `pesto` / `PAINT` | `pesto` / `PAINT` | `pesto` / `PAINT` |
| cheese | none (key-free: no CHEESE rung; cooking flow has no cheese step) | mozzarella (starter) | none | none | mozzarella (starter) |
| matcher identity | target id = evidence id (W1 convention); `items` = [clam, garlic, olive-oil, parsley]; `sauceBase` = [olive-oil]; default dimensions; ELIGIBLE. A Phase-2 SHIPPED_KEEP row exists, so the "identical to Phase-2" parity test applies (calabresa was exempt only because it has no Phase-2 row) | `items` = [mozzarella, mushroom, prosciutto-crudo, tomato-sauce]; `sauceBase` = [tomato-sauce] | [fresh-tomato, garlic, pesto, shrimp]; [pesto] | [almond, fresh-tomato, garlic, pesto]; [pesto] | [chicken, fresh-tomato, mozzarella, pesto]; [pesto] |
| Hint rungs, **key-free** (needs no authored Hint data) | SAUCE → STRUCTURE → SUB_CLASS ×3 (clam: seafood, garlic: herb, parsley: herb). 5 rungs, 30 Pitz | SAUCE → CHEESE → STRUCTURE → SUB_CLASS ×2 (mushroom: vegetable, prosciutto-crudo: meat). 5 rungs, 35 Pitz | SAUCE → STRUCTURE → SUB_CLASS ×3 (fresh-tomato: vegetable, garlic: herb, shrimp: seafood). 5 rungs, 30 Pitz | SAUCE → STRUCTURE → SUB_CLASS ×3 (fresh-tomato: vegetable, garlic: herb, almond: family per Q3). 5 rungs, 30 Pitz | SAUCE → CHEESE → STRUCTURE → SUB_CLASS ×2 (fresh-tomato: vegetable, chicken: meat). 5 rungs, 35 Pitz |
| Hint rungs, **keyed** alternative | needs Owner-authored `hintKeyToppingId` + `hintSubToppingOrder` (OD-H5-C1 / C1-P); no source authority for either. Adds a KEY_TOPPING rung; the SUB_CLASS count drops by one. Not chosen here | same | same | same | same |
| key-free compatibility | yes, mechanical (`{keyFree:true}`; type already allows it) | yes | yes | yes (given the almond family) | yes |
| two sub-toppings in the same family | garlic + parsley both `herb` (two identical-class answers) | no | no | no (if almond ≠ vegetable / herb) | no |
| shrimp / clam seafood adjacency | clam (seafood) already shipped | — | seafood family grows 3→4 | — | — |

Hint-price arithmetic uses OD-H5-E1: SAUCE 10, CHEESE 10, KEY_TOPPING 10, STRUCTURE 5, SUB_CLASS 5.

---

## 5. Side-by-side comparison — Discovery 3.0 impact

### 5.1 Where each candidate can become DISCOVERABLE, and the pool

Method: a hand mirror of `recipeDiscoveryState`, `selectHintTarget`, `countsTowardLadder`, the frozen W1 ladder and
`appendLadderSteps` (scratch, not committed; see §10). Walk = canonical ladder order (the same path the production-26 pool
tests and the Inspector use); materials assumed owned and stocked (the maximum-pool case).

**Under LAD-1 the new ingredient can only be appended at step 25.** Steps 1–24 are frozen and no existing step may take
it. Therefore for **all five** candidates:

- the earliest DISCOVERABLE moment is step 25 (credited count 25 = all 25 W1 recipes found), after the player has bought
  the new material (T3, §5.3);
- before that the candidate is `UNKNOWN` (its new material is not entitled), so **pool and hint target at every step
  0–24 are identical to today** (checked for each candidate: identical).

What differs is only the "all other ingredients ready by" column, which does **not** gate discovery under LAD-1 but is the
unlock window the Owner would have if the append-only rule were ever relaxed (not proposed here):

| | vongole | prosciutto-funghi | pesto-gamberi | pesto-trapanese | pesto-pollo |
|---|---|---|---|---|---|
| ladder step of each existing ingredient | clam 19, garlic 14, olive-oil 13 | mushroom 3 (mozzarella, tomato-sauce starters) | pesto 17, garlic 14, fresh-tomato 20 | pesto 17, garlic 14, fresh-tomato 20 | pesto 17, fresh-tomato 20 (mozzarella starter) |
| all existing ingredients ready by step | **19** | **3** | **20** | **20** | **20** |
| earliest DISCOVERABLE under LAD-1 | **25** (appended) | **25** | **25** | **25** | **25** |
| historical Phase-2 `reachableAtStep` (star-model, **superseded** by OD-REC04-1; reference only) | 14 | 10 | 14 | 26 | 17 |
| pool at step 25, calabresa **undiscovered** | 2 (`brazilian-calabresa` + candidate) → **OPEN_POOL** | 2 → OPEN_POOL | 2 → OPEN_POOL | 2 → OPEN_POOL | 2 → OPEN_POOL |
| pool at step 25, calabresa **discovered** | 1 → auto target (candidate) | 1 | 1 | 1 | 1 |
| new OPEN_POOL steps created at 0–24 | 0 | 0 | 0 | 0 | 0 |

**OPEN_POOL possibility, stated plainly:** the candidate is never in a pool with another *new* recipe, because it is the sole
key recipe of step 25. The only second member is `brazilian-calabresa`, which already makes steps 12–24 pool-2 for a
player who has not found it. So a candidate lengthens the existing hint-less stretch for that player from steps 12–24 to
12–25. It creates no new pool-2 case for a player who found calabresa. This is identical across the five candidates;
nothing in the pool analysis separates them. (The pool is state-derived, so an existing save that already sits at
credited count 25 gets the new step the moment the build ships.)

### 5.2 Existing W1 progression and the two flags

| | all five candidates |
|---|---|
| Frozen W1 steps 1–24 | unchanged (LAD-1). `POST_W1_APPENDED_STEPS` gains one entry `{ ingredientIds:[<new>], keyRecipeId:<candidate> }`; `discoveryLadder.appendOnly.test.ts` is the test that pins appended = rule output |
| Dex total | 26 → 27; key step 25 = price tier T3 → the candidate falls in the T3 chapter (chapter counts today 6 / 10 / 10 per PR-4b-B) |
| Players already complete (26/26) | gain one new target after update; pool 1 → normal auto-target hint; not a softlock |
| `ladderCredit` **true** (default) | final credited count 26 once found; count 26 reaches the (non-existent) step 26 → a later appended step is reachable by the normal rule |
| `ladderCredit` **false** | final credited count stays 25. **Rule-derived finding (not run through production tests):** step 26 requires count ≥ 26. If a *later* recipe needs a new material at step 26, nothing can raise the count past 25 before it is found, so that step never opens until some other credited recipe, makeable from materials ≤ step 25, is added. Calabresa could be non-credit safely only because the W1 population had one unit of slack (25 credited vs 24 steps). This candidate would be the *key recipe* of step 25, so the slack is gone. Applies equally to the five |
| `lunchRush` absent (default) | the candidate enters the Lunch Rush pool for any player who has found it and owns all its ingredients (incl. the T3 material); cookability still checks stock; LR distribution for those players changes |
| `lunchRush:false` | exactly the calabresa treatment: never ordered, never counted cookable; existing LR behaviour byte-identical |
| Two flags are independent | `ladderCredit` is read only by `countsTowardLadder`; `lunchRush` only by `participatesInLunchRush` |

### 5.3 Inventory / economy additional impact

| | vongole | prosciutto-funghi | pesto-gamberi | pesto-trapanese | pesto-pollo |
|---|---|---|---|---|---|
| new material | parsley | prosciutto-crudo | shrimp | almond | chicken |
| shop tier / price at step 25 | T3: pack **100**, refill **50** Pitz (all five) | same | same | same | same |
| new pack size | 10 × k, k = the candidate's `minCount` for the new id (**calibration**) | same | same | same | same |
| current largest `minCount` (k) of reused finite ingredients | clam 3, garlic 3, olive-oil 1 | mushroom 3 | fresh-tomato 3, garlic 3, pesto 1 | fresh-tomato 3, garlic 3, pesto 1 | fresh-tomato 3, pesto 1 |
| existing-pack impact | a `minCount` above those k values would **raise** that material's pack for every player (pack = 10 × k). Keep ≤ k to leave the existing economy untouched | same | same | same | same |
| existing finite stock the recipe consumes | clam, garlic, olive-oil | mushroom | fresh-tomato, garlic, pesto | fresh-tomato, garlic, pesto | fresh-tomato, pesto |
| reuse count of those existing finite ingredients in production today | clam 1, garlic 3, olive-oil 4 | mushroom 2 | fresh-tomato 1, garlic 3, pesto 4 | same as gamberi | fresh-tomato 1, pesto 4 |
| first-discovery Pitz | `baseRewardPitz` = 100 (PR-4b-B observed +100 / +50 first discovery) | same | same | same | same |
| catalog-count fixtures | ingredient count 29 → 30 (`ingredients.test.ts` pins `toHaveLength(29)`); recipe count 26 → 27; Dex N/27; Pizza Select, completion gate, efficiency, `w1Activation`, dinner windows (calabresa's list in PR-4b-B §2 is the template of what moves mechanically) | same | same | same | same |
| economy simulations (Hint Economy 1.0 105 runs, hint5 P-C) | rerun needed; same as PR-4b-B: not byte-identical past the candidate's discovery | same | same | same | same |

### 5.4 Matcher / collision / naming

| | vongole | prosciutto-funghi | pesto-gamberi | pesto-trapanese | pesto-pollo |
|---|---|---|---|---|---|
| exact set equal to a production recipe | no | no | no | no | no |
| exact set equal to another of the 172 | no | no (but see catalog twin) | no | no | no |
| set relation to production | nearest `new-haven-apizza` (differs by parsley↔parmigiano) | **strict superset of `funghi`** (funghi + prosciutto-crudo); matcher treats a superset as an original pizza, so no collision, but one Funghi attempt plus one extra ingredient is this recipe | nearest `pesto-caprese` (shares fresh-tomato, pesto) | nearest `pesto-caprese` | nearest `pesto-caprese` (differs by basil↔chicken only) |
| collision-ledger entries (matrix) | none | `extendedIdentitySetCollisions`: same set as catalog `prosciutto-e-funghi`, undeclared by the row; `rowsSeparatedByFullSignature: true`; no row has an identical full signature | none | none | none |
| naming collision | none in production. Catalog neighbour `frutti-di-mare` {garlic, olive-oil, parsley, shrimp} is not equal | **id decision**: evidence-derived `prosciutto-funghi` vs catalog `prosciutto-e-funghi` (プロシュート・エ・フンギ). Not yet a production name, so nothing to break; must be settled before it becomes a recipe id / Dex id | none | none | none |
| `namingClusterLedger` | not in any cluster | not in any cluster | not in any cluster | not in any cluster | not in any cluster |

Near-miss / far feedback was neutralized in the Discovery 3.0 Phase 1 (Option B), so near-set proximity (e.g. pollo ↔
pesto-caprese) does not produce player-visible feedback today.

---

## 6. Reuse of the new ingredient inside the 172 (aggregated from the existing matrix)

Counting rule: rows whose `canonicalIngredientIds` or `identityIngredientSet` contain the id. "Ready / FULL" = Phase-1
`READY` or `READY_WITH_REVIEW` **and** `currentFlowRepresentability = FULL`. "Unlocked by it alone" = identity-set rows
whose only id outside the 29 is that ingredient, not already a production recipe.

| New ingredient (candidate) | Rows containing it (all of 172) | …of which Ready / FULL | Rows unlocked by it **alone** | Further Ready / FULL rows that need it **plus exactly one other** new id | Rows containing it but blocked or not representable |
|---|---|---|---|---|---|
| `parsley` (vongole) | **8** | 3 | **1** (vongole only) | 1: `baba-ganoush-pizza` (+ `pine-nuts`) | 5 |
| `prosciutto-crudo` (prosciutto-funghi) | **6** | 3 | **1** (the candidate) | 1: `jamon-serrano-pizza` (+ `arugula`) | 3 |
| `shrimp` (pesto-gamberi) | **4** | 2 | **1** | **0** | 2 |
| `almond` (pesto-trapanese) | **1** | 1 | **1** | **0** | 0 |
| `chicken` (pesto-pollo) | **12** | 2 | **1** | 1: `frango-catupiry` (+ `catupiry`) | 10 |

Reading it:

- **Immediate payoff is 1 recipe for every candidate.** The extra reuse is only in later waves and needs a second new
  ingredient each time.
- **Occurrence is not readiness.** `chicken` appears in 12 rows but 9 are `BLOCKED_PRODUCT_DECISION` (unspecified base
  sauce, unresolved tokens, composition conflicts) and 1 is `PARTIAL`; they unlock only if those independent blockers are
  resolved. `curry-pizza-japan` lists only `chicken` outside the 29, but its ingredient list has an unresolved token, so its
  true missing set is unknown. `parsley` also appears in 4 blocked / non-representable rows (`lahmacun`, `turkish-pide`,
  `porcini-pizza`, `jerusalem-mixed-grill`).
- **PARTIAL rows** (`bbq-chicken`, `pinsa-romana`, `piadina-romagnola`, `pescatore`) need a mechanic (late addition, dough
  variant, multi-spread) on top of the ingredient.
- **Second-order links:** `prosciutto-crudo` + `arugula` would reach 3 more rows if arugula also lands (`jamon-serrano` FULL;
  `pinsa-romana` and `piadina-romagnola` PARTIAL). `shrimp` + `parsley` + `mussel` would reach `pescatore` (PARTIAL,
  MULTI_SPREAD_LAYER).
- **Taken together,** the five new ingredients unlock exactly the five candidates (the five-id union reaches no other
  Ready / FULL row); with one more ingredient each, three more rows (`baba-ganoush`, `jamon-serrano`, `frango-catupiry`).
- The old Phase-2/3-4 matrices report `recipeReuseCount` of 4 / 5 / 3 / 1 / 3 (parsley / prosciutto-crudo / shrimp / almond /
  chicken); those counted target reuse under the older star-based population and are shown only to avoid confusion.
- Wider context: among the 172, Ready / FULL non-production rows need 0 / 1 / 2 / 3 / 4 new ids in 2 / 20 / 11 / 9 / 3
  cases. Two zero-new-id rows exist (`aussie-pizzadb`, `chilean-napolitana-pizzadb`); they are outside the brief's five
  and were not analysed.

---

## 7. Is a new mechanic really unnecessary?

| | vongole | prosciutto-funghi | pesto-gamberi | pesto-trapanese | pesto-pollo |
|---|---|---|---|---|---|
| 172 evidence requires a capability | no | no | no | no | no |
| `postBakeFinish` in the evidence row | none (`[]`) | none | none | none | none |
| research catalog tag that would imply one | `frutti-di-mare` (a neighbour, not this row) tags parsley `postBakeFinishing`; the matrix **declined to apply** that tag because the row does not list parsley (`catalogTagsNotApplied`); catalog `parsley` carries `mechanicDependency: postBakeFinishing` | catalog `prosciutto-crudo` carries `mechanicDependency: postBakeFinishing` ("焼成後に乗せるのが本来"); catalog `prosciutto-e-funghi` lists it as a finishing ingredient | none | none | none |
| conclusion on source authority | **no new mechanic needed** | **no new mechanic needed by the 172 evidence** | no | no | no |
| residual question | whether real-world "parsley is added after baking" should be modelled (gameplay realism, not source) | whether "cured ham goes on after baking" should be modelled; that tag lives only in the frozen research catalog (OD-T8: ingredients.ts is the only production authority) | — | — | — |

The 172 rows carry no mechanic for any of the five, so none needs one to be a legal target. The research catalog's finishing
notes for `parsley` and `prosciutto-crudo` are not 172 evidence; adopting them would be new gameplay scope, not a
requirement.

---

## 8. Gameplay calibration (NOT source authority)

None of these is in the 172 evidence. Each is an Owner / Human-Review item, as for calabresa (PR-4b-B, D-6).

| Item | All five | Candidate-specific |
|---|---|---|
| `minCount` per ingredient (and the new ingredient's k → pack size) | required | pack size effect on existing materials if above current k (§5.3) |
| `bakeTarget` window | required | seafood windows are short in the catalog (`frutti-di-mare` 52–72) — a precedent, not authority |
| `baseRewardPitz` | 100 by default | — |
| reference placement (`getReferenceSlots` / literal) | Human Review | — |
| Hint: key-free vs keyed (+ key topping, sub order) | Owner | key-free needs no authored data |
| `ladderCredit` true / false | Owner | §5.2 |
| `lunchRush` participation | Owner | §5.2 |
| new-ingredient emoji / `pieceVisual` | Human Visual Gate (as W1's 7/7) | almond and prosciutto-crudo have no stock emoji |
| order entry in `orders.ts`, cooking-step matrix, CUT eligibility | required | CUT is allowlist opt-in, no CUT needed |
| Human Verification (390×844) | mandatory for any UI / gameplay change (CLAUDE.md, HV policy) | — |
| Pool-2 hint-less stretch (steps 12–25) tolerance | Owner / play | observation already raised in PR-4b-B; unchanged |

---

## 9. The 22-row loose superset (for traceability only)

Rows that are Ready / FULL, ingredient-complete, exactly one id outside the 29, and not production-equal. The five audited
candidates are in it; the others were not audited.

`calabresa-argentina` (salami), `vongole` (parsley), `flammkuchen` (fromage-blanc-sauce), `bacalhau` (salt-cod),
`bianca-pizzadb-row` (ricotta), `spanish-chorizo` (bell-pepper), `salsiccia-e-friarielli` (friarielli), `palmito` (palm-heart),
`pizza-overload` (hot-dog), `pizza-feta-eliniki` (feta), `brazilian-catupiry-corn` (catupiry), `full-english` (baked-beans),
`prosciutto-funghi` (prosciutto-crudo), `veggie-supreme` (green-pepper), `pesto-gamberi` (shrimp), `pesto-trapanese` (almond),
`pesto-pollo` (chicken), `polish-kielbasa` (sauerkraut), `porchetta` (pork), `tsukimi` (green-onion), plus the two
zero-new-id rows `aussie`, `chilean-napolitana`.

---

## 10. Limits of this audit

- The simulation is a Python mirror of the production rules, not the production code or the dev Inspector. When No.27 is
  implemented, run `buildInspectorModel` and the pool tests against the real data.
- `ladderCredit=false` stall (§5.2) is derived from `reachedLadderSteps` / `discoveredRecipeCount`, not executed.
- Quantities / bake windows do not exist in any source, so no number was proposed.
- Visual feasibility (emoji / dedicated glyph) was read from the catalog conventions, not tried in the UI.
- Pitz economy numbers are the Shop rule's, not an economy simulation.

## 11. Authority gaps (summary)

1. **No quantity authority** for any candidate. **No bake authority** for any candidate.
2. **`almond` has no family authority.** It is not in the 62-ingredient master catalog or the HCG taxonomy audit; the only
   nut precedent is `walnut` → `other` (`other.nut-seed`, OD-T1). OD-T7 requires the taxonomy row in the same PR that
   introduces the ingredient, so the Owner must confirm the family (and its `other` shelf placement) before pesto-trapanese.
3. **vongole sauce authority:** source says ノンソース; modelling olive-oil as the sauce base is a production convention,
   not source text (§3).
4. **prosciutto-funghi id / naming:** `prosciutto-funghi` (evidence-derived) vs `prosciutto-e-funghi` (frozen catalog,
   same ingredient set, undeclared by the row). Also evidence corroboration 0 and relayed (not re-fetched) for four of five;
   only vongole is a corroborated Phase-0B sample.
5. **Pesto sauce is family-derived** for three candidates (existing precedent; noted for completeness).
6. **No Hint authority** (key topping, sub-order) for any candidate; key-free avoids needing it.
7. **Category of the new ingredient** (topping) is catalog-derived for all five; OD-T5 asks for per-ingredient confirmation
   only for non-production sauce / cheese, so it is not an open gap for these toppings.
8. The "172 Recipe Readiness Audit" artifact referenced in the brief is not on main (§0).

## 12. Owner Decision Needed (no recommendation, no ranking)

1. **Which one candidate is No.27?** (vongole / prosciutto-funghi / pesto-gamberi / pesto-trapanese / pesto-pollo.)
2. **Placement:** accept that under LAD-1 the new ingredient is appended at step 25 and the candidate is first findable
   there (pool 2 with calabresa if calabresa is undiscovered; pool 1 otherwise) — or ask for a different mechanism (which
   would be outside this audit).
3. **`ladderCredit`:** credited (count → 26) or not. If not, accept or resolve the §5.2 stall for future appended steps.
4. **vongole only:** confirm olive-oil as the modelled base despite ノンソース; **almond only:** confirm its Hint family and
   shelf; **prosciutto-funghi only:** settle the canonical id (`prosciutto-funghi` vs `prosciutto-e-funghi`).
5. **Hint:** key-free (no authored data) or keyed (Owner authors key topping + sub order).
6. **`lunchRush`:** participate or `lunchRush:false` (calabresa precedent).
7. **Calibration owners:** who sets `minCount` / bake window / reference / visual, and the rule that `minCount` of already
   shipped finite materials stays ≤ their current k.
8. Whether the finishing-style notes in the frozen research catalog (parsley, prosciutto-crudo) are ignored for now (the
   evidence needs no mechanic).
