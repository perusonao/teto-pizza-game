# Discovery 3.0 — No.27 Candidate Audit Reconciliation

**AUDIT ONLY / docs-only.** No production code, recipe, ingredient, ladder, Hint, Issue, PR or merge. No ranking,
no scoring, **No.27 is not decided here**. N2 (#340) and Near/Far Neutralization (#338) are MERGED / COMPLETE and were not re-audited.
Both source branches were read directly (`git show origin/<branch>:<path>`); nothing was merged or cherry-picked.

## 1. Audited main SHA

| | SHA |
|---|---|
| **This audit** (fresh `git fetch`) | `064873e6f7aef471386780baf32443fd0812badb` (= the SHA in the brief; main had not advanced) |
| 172 Readiness Audit (A) — branch `claude/discovery-3-172-recipe-readiness-audit`, `cceedce` | audited `ce2c07b9001ea6d7d65d54342252678940b1a328` |
| No.27 Candidate Decision Audit (B) — branch `claude/discovery-3-no27-audit-2w9mpn`, `2877200` | audited `2cf7a5d75ff27e5725de543836c9c15da3c482d4` |

Drift between the three SHAs: `ce2c07b..064873e` changes **no** file under `src/data/`, `data/`, `docs/design/`, `docs/reports/data/`
(empty diff). `ce2c07b..2cf7a5d` and `2cf7a5d..064873e` touch only CI scripts, e2e specs, Near/Far and Trial-Notebook
code/tests/docs — none touches the recipe/ingredient/ladder/pool authority. **Both audits' premises are still true on `064873e`.**

## 2. Strict-5 predicate (Audit A — `tier == TIER1_STRICT`)

Restored from A's §4 prose and its companion JSON (`TETO_DISCOVERY-3_172-RECIPE_READINESS.json`, 172 rows), then **executed over the JSON and
re-derived independently from the matrix on `064873e`** (§7). Both give exactly the same 5 rows.

A row is strict when **all** hold (non-production row, ≤ 1 id outside the current 29 ingredients):

| # | condition | A's field |
|---|---|---|
| S1 | matrix `READY` / `READY_WITH_REVIEW`, `FULL`, no `requiredCapabilities`, no blockers | `productDecisionStatus`, `matrixRepresentability`, `matrixBlockerTypes` |
| S2 | not E (authority complete: no `SAUCE_BASE_UNSPECIFIED`, `UNRESOLVED_INGREDIENT`, `EVIDENCE_GAP`, `SCOPE_QUESTION`, placeholder) and not D (no mechanic) | `primaryClass ∈ {A,B}` |
| S3 | **no identity collision** (collisionLedger / `SAME_SET_AS_*` / namingClusterLedger / shipped composition conflict) | `identityCollisions == []` → `firstExpansionPool` |
| S4 | **has a sauce layer** (not a no-sauce recipe) | `noSauce == false` |
| S5 | **no thin-dough text** ("薄め…" in the source dough string) | `thinDoughText == false` |
| S6 | **no new sauce ingredient** (no `RecipeSauceProfile` type extension) | `newSauceIngredientNeedsSauceProfile == []` |
| S7 | **no `likely_alias` token and no taxonomy flag** | `authorityCaveats` has no `likely_alias×n` / `taxonomyFlags×n` |

S1–S3 = A's "Clean pool" (`firstExpansionPool`, 41 rows over all 172). S4–S7 = A's "Tier 1 additionally" clause. A's sentence:
"Tier 1 はさらに『sauce 材料あり・薄生地記述なし・新 sauce 材料なし・`likely_alias`/taxonomy flag なし』".
Quantities/bake/reference are *not* conditions (the 172 evidence has none; A treats them as gameplay calibration for every row).
Not conditions either (they do **not** exclude a row): `sauce_from_family_label`, `READY_WITH_REVIEW`, `corroborationCount == 0`,
`MODERATE_WITH_CAVEATS`, new-ingredient absence from the 62-catalog.

## 3. Loose-22 predicate (Audit B §0 item 2 and §9)

> "READY / READY_WITH_REVIEW, FULL, ingredient-complete, exactly 1 id outside the 29 current ingredients, not already production"
> + "the two zero-new-id rows `aussie`, `chilean-napolitana`" (so: ≤ 1 outside the 29).

= S1 + "ingredients complete" + `missingCount ≤ 1` + not production-equal. **No** collision, sauce, dough-text, alias or
taxonomy condition. B was explicit that "the extra criteria that made these five 'strict' are not reproducible from main", because
A's branch is not on main and B never saw it (B §0 item 1, 2, 8).

Executed over A's JSON **and** over the matrix on `064873e`: **22 rows, identical to B's §9 list** (22 = 20 with one new id + `aussie` + `chilean-napolitana`).

## 4. Predicate side-by-side

| condition | Strict (A) | Loose (B) |
|---|---|---|
| READY/READY_WITH_REVIEW, FULL, no capability/blocker | ✔ | ✔ |
| ingredient set complete (no unresolved token) | ✔ | ✔ |
| missing ids vs current 29 | ≤ 1 | ≤ 1 (20 rows = 1, 2 rows = 0) |
| not production-equal | ✔ | ✔ |
| no identity collision / naming cluster | **✔ required** | not applied |
| has a sauce layer (not no-sauce) | **✔ required** | not applied |
| no thin-dough text | **✔ required** | not applied |
| no new sauce ingredient | **✔ required** | not applied |
| no likely_alias / taxonomy flag | **✔ required** | not applied |
| result | **5** | **22** |

The two predicates are nested: strict ⊂ loose, and loose − strict = 22 − 5 = 17, all removed by S3–S7 (nothing else).

## 5. The 17 removed rows and why (from matrix / A-JSON fields, not inferred)

"×" = the condition that removed it (a row may fail several). Tier is A's own label.

| row | new id | A tier | identity/naming (S3) | no-sauce (S4) | thin-dough text (S5) | new sauce ingr. (S6) | likely_alias / tax flag (S7) |
|---|---|---|---|---|---|---|---|
| `calabresa-argentina-pizzadb` | salami | none (not in pool) | × NC-4-calabresa | | | | |
| `chilean-napolitana-pizzadb` | — | none | × NC-1-napoletana | × | | | |
| `bianca-pizzadb-row` | ricotta | none | × NC-2-bianca | | | | |
| `aussie-pizzadb` | — | Tier 2 | | × | | | |
| `bacalhau-pizzadb` | salt-cod | Tier 2 | | × | | | |
| `salsiccia-e-friarielli-pizzadb-p3` | friarielli | Tier 2 | | × | | | |
| `porchetta-pizza-pizzadb-p12` | pork | Tier 2 | | × | | | |
| `flammkuchen-pizzadb` | fromage-blanc-sauce | Tier 2 | | | | × | |
| `spanish-chorizo-pizza-pizzadb-p4` | bell-pepper | Tier 2 | | × | × 薄め | | |
| `brazilian-catupiry-corn-pizza-pizzadb-p10` | catupiry | Tier 2 | | × | × 薄めの生地 | | |
| `full-english-pizza-pizzadb-p10` | baked-beans | Tier 2 | | × | × 薄めの生地 | | |
| `polish-kielbasa-pizzadb-p12` | sauerkraut | Tier 2 | | × | × 薄めの生地 | | |
| `tsukimi-pizza-pizzadb-p14` | green-onion | Tier 2 | | × | × 薄めの生地 | | |
| `palmito-pizza-pizzadb-p7` | palm-heart | Tier 2 | | × | × 薄めの生地 | | × likely_alias(オリーブ) |
| `pizza-overload-pizzadb-p7` | hot-dog | Tier 2 | | | × 薄めの生地 | | × taxonomyFlag prepared_dish_composite |
| `pizza-feta-eliniki-pizzadb-p9` | feta | Tier 2 | | | × 薄めの生地 | | × likely_alias(オリーブ) |
| `veggie-supreme-pizza-pizzadb-p11` | green-pepper | Tier 2 | | | × 薄めから中厚 | | × likely_alias(オリーブ) |

Counts (a row can fail several conditions): identity/naming **3**; no-sauce **11** (incl. `chilean`); thin-dough text **9**; new sauce ingredient **1**;
likely_alias / taxonomy flag **4**. Removed by exactly one condition: **7** (no-sauce only: `aussie`, `bacalhau`, `salsiccia-e-friarielli`, `porchetta`; identity only: `calabresa-argentina`, `bianca`;
new sauce ingredient only: `flammkuchen`). Removed by two or more: **10** (`chilean`, `spanish-chorizo`, `catupiry-corn`, `full-english`, `kielbasa`, `tsukimi`, `palmito` (three), `pizza-overload`, `feta`, `veggie-supreme`).

Not one of the 17 was removed for E (authority incomplete: all 22 are E-free by the loose predicate itself), D (mechanic: all FULL, no capability), or "extra
ingredient count" (all ≤ 1 missing). **No-sauce and thin-dough text** are therefore the dominant classes. Note A's own Tier-2 reason for no-sauce
is "engine path unproven": all 26 production recipes contain a sauce-category material and `RECIPE_SAUCE_PROFILES` is a total `Record<RecipeId,…>`
over `"tomato-sauce" | "pesto" | "olive-oil"` (re-checked on `064873e`: every production recipe has one; 0 without). A states thin-dough as "thin-crust mechanic is out of scope this
time" while the matrix itself says no capability is needed — a scope fence, not a matrix blocker. Both are Owner-scope questions, not data errors.

## 6. Strict-5 re-check on `064873e`

Independent re-derivation straight from `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` + `src/data/{ingredients,recipes}.ts` (not from A's JSON):

| id | not in production | missing id | status | collision/naming | sauce layer | thin text | alias/tax flag | strict now? |
|---|---|---|---|---|---|---|---|---|
| `vongole-pizzadb` | ✔ | parsley | READY | none | ✔ (olive-oil spread; family ノンソース) | none | none | **yes** |
| `prosciutto-funghi-pizzadb-p11` | ✔ | prosciutto-crudo | READY_WITH_REVIEW | none (catalog twin `prosciutto-e-funghi`, non-blocking ledger D) | ✔ tomato-sauce (family-derived) | none | none | **yes** |
| `pesto-gamberi-pizzadb-p11` | ✔ | shrimp | READY | none | ✔ pesto (family-derived) | none | none | **yes** |
| `pesto-trapanese-pizzadb-p11` | ✔ | almond | READY | none | ✔ pesto (family-derived) | none | none | **yes** (see caveat) |
| `pesto-pollo-pizzadb-p12` | ✔ | chicken | READY | none | ✔ pesto (family-derived) | none | none | **yes** |

Result: the strict predicate returns **exactly these 5 on `064873e`**, and over all 172 rows no other row passes. Production baseline unchanged:
26 recipes / 29 ingredients / W1 ladder steps 1–24 frozen / `POST_W1_APPENDED_STEPS = []`; none of the 5 ids is in production.

**Caveat the strict predicate does not look at (relevant to the Owner, not a predicate failure):** `almond` is **not in the 62-ingredient master catalog**
(B §3/§11-2 is right; verified in `ingredient_master_catalog.json`: absent; `walnut` is the only nut). A's "category `topping`" for almond has no catalog backing
and A did not list this gap. The other four new ids (`parsley`, `prosciutto-crudo`, `shrimp`, `chicken`) are in the catalog as `topping`.
(Most of the 17 removed rows' new ids are also absent from the 62-catalog; catalog presence was never a strict condition in A.)

## 7. Step 25 pool re-check (read-only harness over production pure functions)

Harness (committed as text, not run in CI): `docs/reports/data/TETO_DISCOVERY-3_NO27_AUDIT_RECONCILIATION_STEP25_HARNESS.ts.txt`; raw output:
`…_STEP25.json`. It `vi.doMock`s `INGREDIENTS` / `RECIPES` to add one synthetic ingredient + one candidate recipe (each ingredient 1 piece; counts are irrelevant to Discovery), then calls the
**real** `buildAppendOnlyLadder` (LAD-1 rule), `resolveShopEntitlement`, `recipeDiscoveryState`, `selectHintTarget`, `countsTowardLadder`, `participatesInLunchRush`, and `buildInspectorModel`.
Ran only that one file with Vitest (no full suite / E2E / build). `node_modules` was installed with `npm ci --ignore-scripts` (gitignored, nothing committed).

Results — identical for all 5 candidates:

| check | result |
|---|---|
| rule output | LAD-1 appends exactly `25: <new ingredient> → <candidate>`; ladder length 24 → 25 |
| frozen steps 1–24 | per-step pool and classification identical to the no-candidate baseline (step 12 OPEN_POOL, 13–24 OPEN_POOL_POSSIBLE with calabresa, unchanged) |
| new ingredient unlocked at step 25 | yes (count 25); not unlocked at step 24 |
| candidate state at steps 1–24 | `UNKNOWN` at every step (never DISCOVERABLE earlier) |
| W1 25 recipes found, **calabresa undiscovered**, new ingredient **unlocked but not bought** | pool = {calabresa} → `TARGET:brazilian-calabresa` (candidate is `KNOWN_BUT_MISSING_MATERIAL`) |
| same, new ingredient **bought** (stocked) | pool = {calabresa, candidate} → **`OPEN_POOL`** (the prior audit's "step 25: candidate + calabresa = pool 2" **holds on `064873e`, after purchase**) |
| W1 25 found, **calabresa discovered**, not bought | pool = {} → `SHOP_NEW` |
| same, **bought** | pool = {candidate} → `TARGET:<candidate>` (auto-target) |
| candidate then discovered, calabresa still undiscovered | pool = {calabresa} → `TARGET:brazilian-calabresa` |
| candidate then discovered, calabresa discovered | pool = {} → `COMPLETE` |

Precision on A's wording "`brazilian-calabresa` が未発見の間 pool 2 が step 12 以降持続": true for steps 12–24 (key recipe + calabresa) and, **after the new ingredient is bought**, at step 25 (candidate + calabresa).
Between unlock and purchase at step 25 the pool is calabresa alone (pool 1, auto-target). B's table row "pool at step 25 … 2 → OPEN_POOL" is the after-purchase state. No contradiction, only a state qualifier.
`OPEN_POOL_POSSIBLE` at step 25 in the Inspector (`calabresa` carried over + `candidate` new) is the Inspector's classification of the same after-purchase state.

## 8. `ladderCredit` true vs false (same harness, hypothetical later step 26 with a synthetic material)

| | `ladderCredit` default (true) | `ladderCredit:false` |
|---|---|---|
| credited count when the 25 W1 recipes are found | 25 | 25 |
| credited count after the candidate is discovered | **26** | **25** (unchanged) |
| a hypothetical step 26 | reached (count 26) | **not reached** (count 25) |
| step 25 itself, pool at step 25 | same | same (credit does not affect discoverability) |
| calabresa discovered or not | calabresa is already `ladderCredit:false`; count 25 either way | same |

`ladderCredit:false` leaves no slack: before the candidate, the 25 credited W1 recipes reach step 25 with 0 spare; the candidate would be the key recipe of step 25, so a later appended step would be
gated until another credited recipe exists. `lunchRush` is an independent flag (`participatesInLunchRush`); absent = in the pool, `false` = out (calabresa precedent). Both are **Owner decisions, undecided**.

## 9. Which audit was wrong?

**Neither contains a factual error about the 5.** The two numbers answer different questions with different predicates:

1. **A (5)** applies S1–S7 over all 172 rows, i.e. "implementable-looking first expansion rows". **B (22)** applies only S1 + ≤1-missing, because B could not see A's S3–S7 (A's branch is not on main; B stated so and did not guess).
2. B's "strict not reproducible from main" is **correct as stated**: S4–S7 are defined only in A's report/JSON, not in any main authority.
3. A's JSON is self-consistent and reproduces 5 from its own fields; the matrix on main reproduces 5 independently.
4. Refinements, not errors: (a) A did not list that `almond` has no catalog/taxonomy entry (B did); (b) A's "pool 2 persists from step 12" omits the unlock-vs-purchase qualifier at step 25 (§7); (c) A's strict conditions S4/S5 are scope fences
   (no-sauce engine path, thin-crust mechanic out of scope), not matrix blockers — these are why 11 + 9 rows are Tier 2 rather than excluded for authority.
5. Audited SHAs differ (`ce2c07b` vs `2cf7a5d`) but no authority changed between them or to `064873e`.

## 10. Can No.27 be chosen now?

The **fact base is sufficient and consistent** for an Owner Decision among the 5. Nothing in the data distinguishes them as "ready vs not ready" except the caveats below; this audit does not pick or rank.
Per-candidate open caveats (facts only): vongole — source says ノンソース, olive-oil modelled as sauce base; prosciutto-funghi — id vs catalog twin `prosciutto-e-funghi`, `READY_WITH_REVIEW`, strict superset of `funghi`;
pesto-gamberi / pesto-pollo — pesto family-derived, new ingredient in catalog; pesto-trapanese — `almond` has no catalog/taxonomy family. Corroboration: vongole 1, the other four 0.

## 11. Remaining Owner Decisions (carried from B §12, narrowed by this audit)

1. Which one candidate is No.27.
2. Accept LAD-1 placement (key recipe of appended step 25; pool 2 with calabresa after purchase, else pool 1) — confirmed by the harness.
3. `ladderCredit` true / false (false removes slack for later appended steps).
4. `lunchRush` participate or `false`.
5. Whether the Tier-2 scope fences (no-sauce engine path, thin-crust) stay out of scope — only matters if the Owner wants any of the 17 considered.
6. Candidate-specific: vongole sauce modelling; almond Hint family (OD-T7 requires the taxonomy row in the same PR); prosciutto canonical id.
7. Hint key-free vs keyed; calibration owners (`minCount`, bake window, reference, visual); T-COV / OD-TAX-7 status for the new topping.

## 12. Limits

Read-only harness on real production pure functions with a mocked catalog, not the shipping UI; Hint rung authoring, economy simulation, visual feasibility, Human Verification and Pitz economy were not run (out of scope).
Hint family authority for new toppings was read from the catalog/taxonomy files only. Nothing here changes behaviour.
