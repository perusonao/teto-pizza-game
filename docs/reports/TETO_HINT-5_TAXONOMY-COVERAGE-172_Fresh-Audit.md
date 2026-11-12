# Hint 5.0 — Taxonomy Coverage Fresh Audit (62 ingredients / 172 recipes)

**Status: docs-only audit. NOT an authority. Not an Owner Decision.**

This audit is independent of, and parallel to, the Issue #292 **H5-0** Owner Decision Gate.
It does not change:
- production code;
- PR #291 (merged);
- the Issue #292 Owner Decisions;
- PR #255 / OD-TAX-1..9;
- TQ-1D, PR #275 or Issue #260;
- the Progression / W1 / I5b branches.

It also does not start H5-1.

- **Machine-readable snapshot:** `docs/reports/data/TETO_HINT-5_TAXONOMY-172-COVERAGE_Fresh-Audit.json`
- **Generator (docs tooling, not in CI):** `docs/reports/tools/hint5_taxonomy_172_coverage.py`
  - `--check` reports drift.
  - It reads PR #255's JSON from the pinned PR head git object and never copies it into this branch.
- **Parent issue:** #292 (Hint 5.0). There is no new issue (see §1.2).

---

## 0. Question audited

> When Hint 5.0 grows from the current 25 recipes / 29 ingredients towards the 62-ingredient
> catalog and the 172-recipe matrix, can we guarantee
> **"every hint-eligible sub-topping that reaches production resolves to a valid Hint taxonomy"**?
> And can we catch a violation *before* production (fail-fast), instead of silently
> weakening the hint to existence?

**Short answer:**
- **Yes for the runtime today.** 22 / 22 toppings have a family, and a CI test already fails if a
  new runtime topping has none.
- **Not yet for the 172 population.** 96 topping ids and 8 unresolved topping tokens have no
  production row.
  - **None** of them needs a new family id.
  - They are blocked by the OD-TAX-7 Human Classification Gate, by canonicalization, and by
    category decisions.
- **The invariant can be made fail-fast** with the gates in §8. Three gaps in today's
  code and tests must be closed first (§10, F-2 / F-3 / F-4).

### Owner direction assumed (as relayed in this task; #292 is not overwritten)

For sub-topping classification in Hint 5.0:
- no k ≥ 2 rule;
- a category with a single catalog member may still be shown;
- deducing an ingredient ≠ the game displaying its name;
- sub-topping names are not sold;
- the last unrevealed sub-topping still gets a classification;
- internal taxonomy ids are separate from UI copy and emoji;
- no conflict with PR #255 / DH4 / OD-TAX;
- a needed new family id goes back to the Owner.

This audit only measures taxonomy **coverage** under that direction. It does not decide the
direction.

---

## 1. Audited main SHA and GitHub state

### 1.1 SHA and related PR / Issue state

| Item | State (fetched 2026-09-28) |
|---|---|
| **`origin/main`** | **`86b48fd51423a8f76db5398ab88ecfd944e2ae10`** (Merge PR #291, DH4-PROD) |
| Runtime taxonomy data drift since PR #255's audit SHA `5a33d85` | **None.** `git diff 5a33d85 86b48fd` is empty for `src/data/ingredients.ts`, `src/data/ingredientTaxonomy.ts`, `src/data/recipes.ts`, `data/`, `docs/design/data/`, the canonicalizer and the 172 master evidence. PR #255's numbers are still valid at this SHA. |
| Issue #292 (Hint 5.0) | OPEN, no comments. H5-0 is pending. Its Fresh Audit is on branch `claude/hint-5-0-fresh-audit-cdgm9e` (`7f9691b`), with no PR. It was read, not changed. |
| PR #255 (172 taxonomy, OD-TAX-1..9) | OPEN, head `e221e36`. Read only. |
| PR #291 / #290 | MERGED / CLOSED. Not touched. |
| PR #272 (Large Catalog UX LC-1) | OPEN. It **injects the DH4-1 family** into a pantry filter, which makes it a second taxonomy consumer (F-10). Not touched. |
| PR #275, Issue #260, TQ-1D | Not touched. There is no TQ-1D issue yet. |
| Issue #253 / #238 | OPEN (DH4 / Hint 3.0 parents) |

### 1.2 Duplicate Gate

- **Issue search** ("hint taxonomy coverage 172 recipes sub-topping classification gate
  invariant") found only **#292**.
- **PR search** ("taxonomy hint 5") found #255 and #272 (open) and #254 / #264 / #265 / #291
  (closed). **None** of them covers 172-population coverage for Hint 5.0.
- **Decision: no new issue.** This audit is H5-0 input and belongs to #292, the same way PR #255
  belongs to #253.

---

## 2. Definitions used by this audit

| Term | Definition |
|---|---|
| **Valid Hint taxonomy (production)** | A row in `TOPPING_FAMILY_ROWS` (`src/data/ingredientTaxonomy.ts`, DH4-1), with a family id in `AttributeFamilyId` (7 ids). This is the **only** runtime authority (PR #255 §18: "the DH4-1 table remains the only runtime source"). |
| **PR #255 PROPOSED family** | A remediation candidate only. It is **not** authority until the OD-TAX-7 Human Classification Gate (HCG). |
| **Potential hint-eligible sub-topping** | An ingredient whose best-evidence category is `topping` and that appears in ≥ 1 recipe. There is **no key-topping authority** today (#292 §9), so any topping may be a sub-topping. This audit uses that worst case. |
| **Category source (best evidence)** | runtime `ingredients.ts` → catalog 62 → 172 spread-layer list → PR #255 proposal. This is the order PR #255 uses. |
| **Sub-topping count** | Two bounds: `toppings − 1` if an authored key topping exists (OD-H5-C1 option A), or `toppings` if the key is null or not a topping |

---

## 3. Authority map

| # | Concern | Authority (file) | Kind | Status |
|---|---|---|---|---|
| A1 | Runtime ingredient ids and categories | `src/data/ingredients.ts` (29) | code, production | **Authoritative** |
| A2 | Runtime topping → family | `src/data/ingredientTaxonomy.ts` `TOPPING_FAMILY_ROWS` (22 rows, 7 families, 4 groups) | code, production (DH4-1, PR #254) | **Authoritative** |
| A3 | Runtime recipes and ingredient lists | `src/data/recipes.ts` `requiredIngredients` (25) | code, production | **Authoritative** |
| A4 | Taxonomy design (L1 / L2 / L3, one fact per hint, k ≥ 2, HCG) | PR #255 OD-TAX-1..9 (`TETO_DISCOVERY-HINT-4_INGREDIENT-TAXONOMY-172_Fresh-Audit.md` §18) | Owner-approved **design direction**, not production authority | OPEN PR |
| A5 | 179-id proposed family / subfamily rows and the Human Review Queue (60) | PR #255 `TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json` | PROPOSED / NEEDS_REVIEW / UNKNOWN | OPEN PR, not authority |
| A6 | 62-ingredient catalog | `data/recipes/ingredient_master_catalog.json` (v2.1) | research artifact, "NOT wired into src/**" | Not authority for runtime |
| A7 | 172-recipe dataset and mechanic matrix | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` + `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX*.md` | "NOT a production SSOT" | Not authority |
| A8 | Aliases and canonicalization | `tools/progression2_ingredient_canonicalizer.py` (tables `LIKELY_ALIAS_TABLE` / `AMBIGUOUS_TABLE` / `GENUINELY_NEW_REGISTRY` / `TAXONOMY_FLAGS`) + `docs/design/TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md` | docs tooling; its tables are the durable record | Authoritative for **id identity** in docs data only. The runtime has **no alias layer**. |
| A9 | Recipe ingredient **role** | runtime: category only (`sauce` / `cheese` / `topping`). 172: `sauceBase.spreadLayers`, `postBakeFinish`, `placementLayering`, `requiredCapabilities`. Catalog: `mechanicDependency`. | mixed | **No runtime role authority** beyond category. By OD-TAX-6, timing and role are **not** taxonomy. |
| A10 | Key topping / sub-topping | **None.** The free key `hintKeyIngredientId` is the latest-unlocked ladder ingredient, and in 4 / 25 recipes it is not a topping (#292 §9). | – | **Missing authority.** Proposed as OD-H5-C1 (`hintKeyToppingId`, `hintSubToppingOrder`). |
| A11 | Technique identity | `src/data/techniques.ts` (`no-sauce` only), `requiredTechniquesOf` (`sauceBase.length === 0`) | code, production (TQ-1C, inert) | Authoritative. The TQ-1D contract is in `deductionProduction.gate.test.ts`. |
| A12 | k ≥ 2 / reserve-only classification | OD-DH4-3, OD-DH4-2-2, OD-TAX-4 / -5 | Owner decisions | To be superseded **for Hint 5.0 classification only** by the H5-0 Owner Decision (not here) |

**Priority, for taxonomy questions:**

A2 (runtime table) > A1 category > Owner decisions (H5-0 > OD-TAX-* > OD-DH4-*) > A5 proposals >
A6 / A7 evidence > A8 identity mapping.

Fresh runtime state outranks docs (handoff "Non-negotiable guards").

**Conflicts found:**

| Conflict | Detail | Resolution owner |
|---|---|---|
| **K1.** The taxonomy doc comment vs the new invariant | `ingredientTaxonomy.ts` says *"An ingredient without a row simply has no family (the guard answers at category level)"*. `deductionHint.ts:162` and `deductionGuard.ts` `classOf` implement that coarsening. That is exactly the **silent fallback** the Hint 5.0 invariant forbids. | H5-1 (new answer function; the DH4 path stays as it is) |
| **K2.** 62-catalog ≠ 172 population | The 172 rows use **169 ids**. Only **52** are in the 62 catalog, and **117** are outside it. 10 catalog ids are unused by 172 (§4.2). 3 runtime ids (capers, clam, fresh-tomato) are not in the 62. | Informational. The invariant must be keyed on the **production catalog**, not on a dataset (F-5). |
| **K3.** "No sauce" has two meanings | TQ-1C `requiredTechniquesOf` = **no spread layer** (30 / 172 rows). The 172 `sauceBase.status === "none"` (「ノンソース」) = **44 rows**, many of them with an olive-oil spread. Runtime quattro-formaggi has olive-oil, but its 172 row has no spread layer. | TQ-1D (F-9) |
| **K4.** Category is decided outside HCG for 51 ids | Their category comes only from PR #255's proposal (`categorySource: proposed`). The HCG list covers families, not categories. | HCG scope (F-4) |
| **K5.** Two taxonomy consumers | DH4 特徴 (production) and PR #272's pantry family filter (open). An HCG family move changes both. | HCG and LC owners (F-10) |

---

## 4. 62-ingredient taxonomy coverage

### 4.1 Totals (catalog v2.1, 62 rows: topping 42 / sauce 10 / cheese 10)

| Status | Count | Meaning |
|---|---:|---|
| `VALID_PRODUCTION` | 17 | A topping with a DH4-1 row |
| `VALID_PRODUCTION_UNDER_REVIEW` | 2 | garlic, black-olive. They have a row, but the boundary is in the HCG queue. (capers is the 3rd, but it is not in the 62.) |
| `MISSING_PROPOSED` | 16 | A topping with no production row. PR #255 PROPOSED family (data-only after HCG). |
| `MISSING_NEEDS_REVIEW` | 7 | A topping with no row. The PR #255 family is NEEDS_REVIEW: french-fries, nduja, nori, spicy-salami, steak, truffle, wurstel. |
| `NOT_SUBTOPPING_SAUCE` | 10 | Named by the sauce rung. Not a classification target. |
| `NOT_SUBTOPPING_CHEESE` | 9 | Named by the cheese rung |
| `CATEGORY_AMBIGUOUS_NON_TOPPING` | 1 | mascarpone (cheese vs dairy, in the HCG queue) |
| **Toppings with no valid taxonomy** | **23 / 42** | Matches #292 §5 |
| Alias / canonicalization flag | 22 | The catalog `aliases`, observed aliases, likely aliases, or a non-canonical status |
| Potential sub-topping in some 172 row | 36 | |
| Not used by any 172 row | 10 | breadcrumb, cherry-tomato, chili-oil, fig, mascarpone, nduja, provolone, speck, steak, teriyaki-sauce |

### 4.2 Per ingredient (62)

`fam` is the DH4-1 family for valid rows, or the PR #255 proposal (in *italics*) otherwise.
`172` is the number of 172 rows that use the ingredient.

| id | cat | status | fam | runtime | alias | mechanicDependency | 172 |
|---|---|---|---|---|---|---|---:|
| anchovy | topping | VALID_PRODUCTION | seafood | ✓ |  |  | 5 |
| artichoke | topping | MISSING_PROPOSED | *vegetable* |  |  |  | 4 |
| arugula | topping | MISSING_PROPOSED | *vegetable* |  |  | postBakeFinishing | 6 |
| bacon | topping | VALID_PRODUCTION | meat | ✓ |  |  | 11 |
| basil | topping | VALID_PRODUCTION | herb | ✓ |  |  | 8 |
| bbq-sauce | sauce | NOT_SUBTOPPING_SAUCE | – |  |  |  | 1 |
| bell-pepper | topping | MISSING_PROPOSED | *vegetable* |  | ✓ |  | 7 |
| black-olive | topping | VALID_PRODUCTION_UNDER_REVIEW | vegetable | ✓ | ✓ |  | 18 |
| breadcrumb | topping | MISSING_PROPOSED | *other* |  |  |  | 0 |
| brie | cheese | NOT_SUBTOPPING_CHEESE | – |  |  |  | 1 |
| buffalo-sauce | sauce | NOT_SUBTOPPING_SAUCE | – |  |  | postBakeFinishing | 1 |
| caciocavallo | cheese | NOT_SUBTOPPING_CHEESE | – |  | ✓ |  | 1 |
| cherry-tomato | topping | VALID_PRODUCTION | vegetable | ✓ |  |  | 0 |
| chicken | topping | MISSING_PROPOSED | *meat* |  | ✓ |  | 12 |
| chili-oil | sauce | NOT_SUBTOPPING_SAUCE | – |  |  | postBakeFinishing | 0 |
| cilantro | topping | MISSING_PROPOSED | *herb* |  | ✓ | postBakeFinishing | 6 |
| corn | topping | VALID_PRODUCTION | vegetable | ✓ |  |  | 6 |
| egg | topping | VALID_PRODUCTION | other | ✓ | ✓ |  | 9 |
| eggplant | topping | VALID_PRODUCTION | vegetable | ✓ |  |  | 13 |
| fig | topping | MISSING_PROPOSED | *fruit* |  |  |  | 0 |
| fontina | cheese | NOT_SUBTOPPING_CHEESE | – | ✓ | ✓ |  | 1 |
| french-fries | topping | MISSING_NEEDS_REVIEW | *other* |  |  | postBakeFinishing | 2 |
| garlic | topping | VALID_PRODUCTION_UNDER_REVIEW | herb | ✓ |  |  | 13 |
| gorgonzola | cheese | NOT_SUBTOPPING_CHEESE | – | ✓ | ✓ |  | 2 |
| ham | topping | VALID_PRODUCTION | meat | ✓ | ✓ |  | 12 |
| honey | sauce | NOT_SUBTOPPING_SAUCE | – |  | ✓ | postBakeFinishing | 5 |
| mascarpone | cheese | CATEGORY_AMBIGUOUS_NON_TOPPING | – |  |  |  | 0 |
| mayo | sauce | NOT_SUBTOPPING_SAUCE | – |  | ✓ | postBakeFinishing | 6 |
| mozzarella | cheese | NOT_SUBTOPPING_CHEESE | – | ✓ | ✓ |  | 117 |
| mushroom | topping | VALID_PRODUCTION | vegetable | ✓ |  |  | 7 |
| nduja | topping | MISSING_NEEDS_REVIEW | *meat* |  |  |  | 0 |
| nori | topping | MISSING_NEEDS_REVIEW | *other* |  | ✓ | postBakeFinishing | 4 |
| nutella-spread | sauce | NOT_SUBTOPPING_SAUCE | – |  | ✓ |  | 1 |
| olive-oil | sauce | NOT_SUBTOPPING_SAUCE | – | ✓ |  |  | 26 |
| onion | topping | VALID_PRODUCTION | vegetable | ✓ | ✓ |  | 37 |
| oregano | topping | VALID_PRODUCTION | herb | ✓ |  |  | 16 |
| parmigiano | cheese | NOT_SUBTOPPING_CHEESE | – | ✓ | ✓ |  | 8 |
| parsley | topping | MISSING_PROPOSED | *herb* |  |  | postBakeFinishing | 8 |
| pepperoni | topping | VALID_PRODUCTION | meat | ✓ |  |  | 9 |
| pesto | sauce | NOT_SUBTOPPING_SAUCE | – | ✓ |  |  | 11 |
| pineapple | topping | VALID_PRODUCTION | fruit | ✓ |  |  | 3 |
| porcini | topping | MISSING_PROPOSED | *vegetable* |  | ✓ |  | 2 |
| potato | topping | VALID_PRODUCTION | vegetable | ✓ |  |  | 4 |
| powdered-sugar | topping | MISSING_PROPOSED | *other* |  |  | postBakeFinishing | 1 |
| prosciutto-crudo | topping | MISSING_PROPOSED | *meat* |  | ✓ | postBakeFinishing | 6 |
| provolone | cheese | NOT_SUBTOPPING_CHEESE | – |  |  |  | 0 |
| ricotta | cheese | NOT_SUBTOPPING_CHEESE | – |  |  |  | 5 |
| ricotta-salata | cheese | NOT_SUBTOPPING_CHEESE | – |  | ✓ |  | 1 |
| rosemary | topping | VALID_PRODUCTION | herb | ✓ |  |  | 4 |
| sausage | topping | VALID_PRODUCTION | meat | ✓ |  |  | 15 |
| shrimp | topping | MISSING_PROPOSED | *seafood* |  |  |  | 4 |
| speck | topping | MISSING_PROPOSED | *meat* |  |  |  | 0 |
| spicy-salami | topping | MISSING_NEEDS_REVIEW | *meat* |  | ✓ |  | 1 |
| steak | topping | MISSING_NEEDS_REVIEW | *meat* |  |  |  | 0 |
| strawberry | topping | MISSING_PROPOSED | *fruit* |  | ✓ |  | 1 |
| teriyaki-sauce | sauce | NOT_SUBTOPPING_SAUCE | – |  |  |  | 0 |
| tomato-sauce | sauce | NOT_SUBTOPPING_SAUCE | – | ✓ | ✓ |  | 49 |
| truffle | topping | MISSING_NEEDS_REVIEW | *vegetable* |  |  | postBakeFinishing | 1 |
| tuna | topping | VALID_PRODUCTION | seafood | ✓ |  |  | 3 |
| walnut | topping | MISSING_PROPOSED | *other* |  |  |  | 4 |
| wurstel | topping | MISSING_NEEDS_REVIEW | *meat* |  |  |  | 1 |
| zucchini | topping | MISSING_PROPOSED | *vegetable* |  |  |  | 4 |

**Alias / canonicalization notes that affect the invariant:**
- **black-olive ← オリーブ (12 recipes):** a likely_alias only. It is the largest single
  confidence risk (PR #255 §4).
- **The sausage cluster** (sausage / wurstel / hot-dog / スパイシーソーセージ) and
  **beef / steak / ground-beef / ひき肉:** unresolved. A second id for the same thing creates a
  **second row** for the same ingredient, so the gate must prevent it (§8, G-ALIAS).
- **bell-pepper** is distinct from meat **pepperoni** (catalog alias note). Their names are
  close, and a label check must not confuse them.

---

## 5. 172-recipe coverage

### 5.1 Ingredient universe (169 canonical ids + 13 unresolved tokens)

| Status | Ids |
|---|---:|
| `VALID_PRODUCTION` | 18 |
| `VALID_PRODUCTION_UNDER_REVIEW` (garlic, capers, black-olive) | 3 |
| `MISSING_PROPOSED` (PR #255 PROPOSED; category from runtime or catalog) | 13 |
| `MISSING_PROPOSED_CATEGORY_UNCONFIRMED` (PROPOSED family, **and** the category is only a PR #255 proposal) | 51 |
| `MISSING_NEEDS_REVIEW` (the family needs HCG) | 32 |
| `CATEGORY_AMBIGUOUS_NON_TOPPING` (sauce or cheese today, but in the HCG "condiment vs topping vs spread" or "cheese vs dairy" queue) | 9 |
| `NOT_SUBTOPPING_SAUCE` / `_CHEESE` | 22 / 21 |
| **Topping ids with no valid taxonomy** | **96 / 117** |
| Unresolved tokens that indicate a topping (no id at all) | **8** (ひき肉, スパイシーソーセージ, ナッツ, 唐辛子, 肉, 赤唐辛子, 青のり, 青唐辛子) |
| Unresolved tokens that indicate a sauce or cheese | 5 (カレーソース, チーズ, チーズソース, プロヴェルチーズ, ホワイトソース) |
| **Proposed families outside DH4-1's 7 ids** | **0** |

### 5.2 Recipe-level distribution (172 rows)

**Coverage tier** (the worst ingredient decides):

| Tier | Recipes | Meaning |
|---|---:|---|
| `VALID_NOW` | **54** | Every topping has a production DH4-1 row. |
| `DATA_ONLY_AFTER_HCG` | **59** | Every missing topping has a PR #255 PROPOSED family. Adding rows after HCG is enough. |
| `NEEDS_HCG_DECISION` | **45** | ≥ 1 topping is NEEDS_REVIEW, or ≥ 1 ingredient is category-ambiguous |
| `UNRESOLVED_TOPPING_TOKEN` | **14** | ≥ 1 topping token has no canonical id. Canonicalization comes first. |
| *taxonomy missing* (any topping without a production row) | 116 | = DATA_ONLY + NEEDS_HCG + UNRESOLVED, minus 2 rows whose only issue is a category-ambiguous sauce or cheese |
| *authority ambiguous* (NEEDS_REVIEW, category-ambiguous, or a topping token) | 59 | = NEEDS_HCG + UNRESOLVED |

**Sub-topping count distribution:**

| Sub-toppings | If a key topping is authored (T − 1) | If there is no key (T) |
|---|---:|---:|
| 0 | **31** | 4 |
| 1 | 51 | 27 |
| 2 | 60 | 51 |
| 3+ | 30 | 90 |

The same distribution per coverage tier (key authored / no key):

| Tier | 0 | 1 | 2 | 3+ |
|---|---|---|---|---|
| VALID_NOW (54) | 21 / 4 | 18 / 17 | 12 / 18 | 3 / 15 |
| DATA_ONLY_AFTER_HCG (59) | 5 / 0 | 20 / 5 | 24 / 20 | 10 / 34 |
| NEEDS_HCG_DECISION (45) | 4 / 0 | 10 / 4 | 19 / 10 | 12 / 31 |
| UNRESOLVED_TOPPING_TOKEN (14) | 1 / 0 | 3 / 1 | 5 / 3 | 5 / 10 |

**Observations:**
- With an authored key topping, **31 / 172 (18 %)** recipes have **no** sub-topping. #292's
  OD-H5-P3 (the n−1 cap for 0 sub-toppings) is therefore not a runtime corner case (8 / 25). It
  scales with the catalog.
- 4 rows have no topping at all: `quattro-formaggi-pizzadb`, `trenton-tomato-pie-pizzadb`,
  `ny-style-pizzadb`, `colorado-mountain-pie-pizzadb-p3`.
- Cross-tab with the matrix `productDecisionStatus`:
  - READY rows: 19 VALID_NOW / 32 DATA_ONLY / 16 NEEDS_HCG;
  - every `UNRESOLVED_TOPPING_TOKEN` row is already `BLOCKED_PRODUCT_DECISION`.

The runtime-25 baseline, for comparison: topping count 0 / 1 / 2 / 3+ = 1 / 7 / 12 / 5, and
**0 recipes** have an unclassified topping.

### 5.3 Recipes with an unresolved topping token (14)

| Row | Name | Toppings | Taxonomy missing | Authority ambiguous |
|---|---|---:|---|---|
| `pizza-baiana` | ピッツァ・バイアーナ | 4 | 唐辛子 | 唐辛子 |
| `pizza-de-cancha` | ピッツァ・デ・カンチャ | 3 | 唐辛子 | 唐辛子 |
| `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | 2 | lettuce, 肉 | kebab-sauce, 肉 |
| `thai-chicken-pizza-pizzadb-p4` | タイチキンピザ | 3 | chicken, cilantro, 赤唐辛子 | 赤唐辛子 |
| `okonomiyaki-style-pizza-pizzadb-p1` | お好み焼き風ピザ | 4 | bonito-flakes, cabbage, pork, 青のり | bonito-flakes, 青のり |
| `keema-pizza-pizzadb-p2` | キーマピザ | 3 | ひき肉, 青唐辛子 | ひき肉, 青唐辛子 |
| `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | 1 | スパイシーソーセージ | スパイシーソーセージ |
| `diavola-pizza-pizzadb-p5` | ディアボラ | 2 | spicy-salami, 唐辛子 | spicy-salami, 唐辛子 |
| `turkish-pide-pizzadb-p5` | トルコピデ | 3 | parsley, ひき肉 | ひき肉 |
| `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | 3 | banana, powdered-sugar, ナッツ | ナッツ |
| `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | 4 | chicory, lemon, 唐辛子 | 唐辛子 |
| `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | 4 | ひき肉 | ひき肉 |
| `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | 2 | condensed-milk, ひき肉 | condensed-milk, melted-butter, ひき肉 |
| `lahmacun` | ラフマジュン | 5 | bell-pepper, parsley, ひき肉, 唐辛子 | ひき肉, 唐辛子 |

### 5.4 Recipes that need an HCG decision (45)

| Row | Name | Toppings | Taxonomy missing | Authority ambiguous |
|---|---|---:|---|---|
| `currywurst-pizzadb` | カリーヴルストピザ | 2 | paprika-powder, wurstel | curry-ketchup, wurstel |
| `taco-pizza-pizzadb` | タコピザ | 4 | ground-beef, lettuce, tortilla-chips | ground-beef |
| `mentaiko-cream-pizza-pizzadb-p4` | たらこクリームピザ | 3 | cod-roe, nori, shiso | nori |
| `vegan-cashew-cheese-pizza-pizzadb-p1` | ヴィーガンカシューチーズピザ | 2 | bell-pepper, zucchini | cashew-cheese |
| `eel-pizza-pizzadb-p1` | うなぎピザ | 3 | eel, green-onion, sansho-pepper | green-onion |
| `california-style-pizza-pizzadb-p2` | カリフォルニアスタイルピザ | 3 | arugula, avocado | avocado |
| `kimchi-pizza-pizzadb-p2` | キムチピザ | 3 | green-onion, kimchi, pork | green-onion, kimchi |
| `cuban-pizza-pizzadb-p2` | キューバンピザ | 3 | pickles, pork | mustard, pickles |
| `goulash-pizza-pizzadb-p3` | グヤーシュピザ | 4 | beef, paprika-powder, sour-cream | beef, sour-cream |
| `chicken-tikka-pizza-pizzadb-p5` | チキンティッカピザ | 4 | bell-pepper, chicken-tikka, cilantro | chicken-tikka |
| `nigerian-suya-pizza-pizzadb-p5` | ナイジェリアンスヤピザ | 3 | beef, green-pepper | beef |
| `nashville-hot-chicken-pizza-pizzadb-p6` | ナッシュビルホットチキンピザ | 2 | chicken, pickles | pickles |
| `banh-mi-pizza-pizzadb-p6` | バインミーピザ | 5 | carrot, cilantro, daikon, liver-pate | liver-pate |
| `jalapeno-popper-pizza-pizzadb-p7` | ハラペーニョポッパーピザ | 2 | jalapeno | jalapeno |
| `pizza-overload-pizzadb-p7` | ピザオーバーロード | 4 | hot-dog | hot-dog |
| `pizza-finocchi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・フィノッキ | 4 | fennel, mint, orange | fennel |
| `pizza-cavolo-carote-pizzadb-p8` | ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ | 4 | carrot, lemon, red-cabbage, sunflower-seeds | red-cabbage |
| `pizza-puntarelle-pizzadb-p8` | ピッツァ・コン・プンタレッレ | 3 | lemon, puntarelle | puntarelle |
| `pizza-radicchio-noci-pizzadb-p8` | ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ | 2 | radicchio, walnut | balsamic-vinegar |
| `philly-cheesesteak-pizza-pizzadb-p9` | フィリーチーズステーキピザ | 3 | beef, green-pepper | beef |
| `poutine-pizza-pizzadb-p10` | プーティンピザ | 1 | french-fries | french-fries |
| `focaccia-genovese-pizzadb-p10` | フォカッチャジェノヴェーゼ | 2 | rock-salt | rock-salt |
| `brazilian-catupiry-corn-pizza-pizzadb-p10` | ブラジリアンカトゥピリコーンピザ | 1 | – | catupiry |
| `frango-catupiry-pizzadb-p10` | フランゴ・コン・カトゥピリ | 2 | chicken | catupiry |
| `full-english-pizza-pizzadb-p10` | フルイングリッシュピザ | 4 | baked-beans | baked-beans |
| `bulgogi-pizza-pizzadb-p11` | プルコギピザ | 3 | beef, white-sesame | beef |
| `venezuelan-reina-pepiada-pizzadb-p12` | ベネズエラレイナペピアーダピザ | 3 | avocado, chicken, cilantro | avocado |
| `peruvian-aji-amarillo-pizzadb-p12` | ペルーアヒアマリージョピザ | 3 | aji-amarillo, chicken | aji-amarillo |
| `polish-kielbasa-pizzadb-p12` | ポーリッシュキエルバサピザ | 3 | sauerkraut | sauerkraut |
| `natto-pizza` | 納豆ピザ | 4 | green-onion, natto, nori, okra | green-onion, natto, nori |
| `peking-duck-pizza` | 北京ダックピザ | 3 | cucumber, green-onion, peking-duck | green-onion, peking-duck |
| `mentaiko-mochi-pizza` | 明太子もちピザ | 4 | mentaiko, mochi, nori, shiso | mentaiko, mochi, nori |
| `manakish` | マナキーシュ | 1 | zaatar | zaatar |
| `yuzu-shrimp-pizza` | 柚子えびピザ | 2 | shiso, shrimp | yuzu-kosho |
| `wasabi-beef-pizza` | わさび牛ピザ | 3 | beef, wasabi | beef, wasabi |
| `sichuan-eggplant-pizza` | 四川風ナスピザ | 3 | green-onion | green-onion |
| `yakiniku-pizza` | 焼肉ピザ | 3 | beef, white-sesame | beef |
| `pizza-de-lomo-saltado` | ロモ・サルタード・ピザ | 4 | beef, french-fries | beef, french-fries |
| `meat-lovers-pizza-pizzadb-p13` | ミートラバーズピザ | 5 | beef | beef |
| `rendang-pizza-pizzadb-p14` | ルンダンピザ | 2 | beef | beef |
| `tsukimi-pizza-pizzadb-p14` | 月見ピザ | 3 | green-onion | green-onion |
| `black-truffle-pizza-pizzadb-p14` | 黒トリュフピザ | 1 | truffle | truffle |
| `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | 3 | chicken, nori | nori |
| `south-african-boerewors-pizzadb-p14` | 南アフリカボアヴォースピザ | 2 | – | chutney |
| `ume-shiso-pizza-pizzadb-p14` | 梅しそピザ | 3 | shiso, umeboshi-paste, whitebait | umeboshi-paste |

### 5.5 Recipes that are data-only after HCG (59)

| Row | Name | Toppings | Taxonomy missing (PR #255 PROPOSED) |
|---|---|---:|---|
| `bbq-chicken-pizzadb` | BBQチキンピザ | 3 | chicken, cilantro |
| `apple-cinnamon-dessert-pizzadb` | アップルシナモンデザートピザ | 3 | apple, cinnamon, walnut |
| `calabresa-argentina-pizzadb` | アルゼンチン風カラブレーサ | 3 | salami |
| `vongole-pizzadb` | ヴォンゴレピザ | 3 | parsley |
| `capricciosa-pizzadb` | カプリチョーザ（PIZZA DB版） | 5 | artichoke |
| `calzone-pizzadb` | カルツォーネ（PIZZA DB版） | 1 | salami |
| `quattro-stagioni-pizzadb` | クアトロスタジオーニ（PIZZA DB版） | 4 | artichoke |
| `supreme-pizzadb` | スプリームピザ | 6 | bell-pepper |
| `bacalhau-pizzadb` | バカリャウピザ | 3 | salt-cod |
| `buffalo-chicken-pizzadb` | バッファローチキンピザ（PIZZA DB版） | 1 | chicken |
| `spanish-chorizo-pizza-pizzadb-p4` | スパニッシュチョリソピザ | 3 | bell-pepper |
| `spinach-artichoke-pizza-pizzadb-p4` | スピナッチアーティチョークピザ | 2 | artichoke, spinach |
| `speck-e-brie-pizzadb-p4` | スペックエブリー | 2 | prosciutto-crudo, walnut |
| `smore-dessert-pizza-pizzadb-p4` | スモアデザートピザ | 3 | chocolate, graham-cracker, marshmallow |
| `ikura-salmon-pizza-pizzadb-p1` | いくらとサーモンのピザ | 3 | salmon, salmon-roe, shiso |
| `jerusalem-mixed-grill-pizza-pizzadb-p1` | エルサレムミックスグリルピザ | 4 | chicken, cumin, parsley |
| `curry-pizza-japan-pizzadb-p2` | カレーピザ | 2 | chicken |
| `salsiccia-e-friarielli-pizzadb-p3` | サルシッチャエフリアリエッリ | 2 | friarielli |
| `jamaican-jerk-chicken-pizza-pizzadb-p3` | ジャマイカンジャークチキンピザ | 3 | chicken, green-pepper |
| `shirasu-pizza-pizzadb-p3` | しらすピザ | 3 | lemon, shiso, whitebait |
| `tandoori-paneer-pizza-pizzadb-p5` | タンドリーパニールピザ | 2 | green-pepper |
| `eggplant-tahini-pizza-pizzadb-p5` | ナスとタヒニのピザ | 3 | parsley, pomegranate |
| `eggplant-ricotta-pizza-pizzadb-p5` | ナスとリコッタのピザ | 2 | mint |
| `eggplant-dengaku-pizza-pizzadb-p6` | ナス田楽ピザ | 2 | white-sesame |
| `new-zealand-lamb-pizza-pizzadb-p6` | ニュージーランドラムピザ | 3 | lamb, sweet-potato |
| `baingan-bharta-pizza-pizzadb-p6` | バインガンバルタピザ | 4 | cilantro |
| `buffalo-cauliflower-pizza-pizzadb-p6` | バッファローカリフラワーピザ | 1 | cauliflower |
| `baba-ganoush-pizza-pizzadb-p7` | ババガヌーシュピザ | 3 | parsley, pine-nuts |
| `jamon-serrano-pizza-pizzadb-p7` | ハモンセラーノピザ | 2 | arugula, prosciutto-crudo |
| `palmitos-salsa-golf-pizzadb-p7` | パルミートス・イ・サルサ・ゴルフ | 3 | palm-heart |
| `palmito-pizza-pizzadb-p7` | パルミットピザ | 2 | palm-heart |
| `piadina-romagnola-pizzadb-p7` | ピアディーナ・ロマニョーラ | 2 | arugula, prosciutto-crudo |
| `pizza-salad-pizzadb-p7` | ピザサラダ | 3 | cucumber, lettuce |
| `pizza-alla-crudaiola-pizzadb-p8` | ピッツァ・アッラ・クルダイオーラ | 2 | arugula |
| `pizza-asparagi-limone-pizzadb-p8` | ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ | 2 | asparagus, lemon |
| `pizza-carciofi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・カルチョーフィ | 3 | artichoke, celery, lemon |
| `pizza-zucchine-menta-pizzadb-p8` | ピッツァ・コン・ズッキーネ・クルーデ・エ・メンタ | 3 | lemon, mint, zucchini |
| `pizza-fritta-pizzadb-p9` | ピッツァフリッタ | 1 | pork |
| `pizza-moscow-pizzadb-p9` | ピッツァモスクワ | 4 | salmon, sardine |
| `pinsa-romana-pizzadb-p9` | ピンサロマーナ | 2 | arugula, prosciutto-crudo |
| `fruit-dessert-pizza-pizzadb-p11` | フルーツデザートピザ | 3 | blueberry, kiwi, strawberry |
| `frutti-di-mare-pizzadb-p11` | フルッティディマーレ | 4 | mussel, shrimp, squid |
| `prosciutto-funghi-pizzadb-p11` | プロシュットフンギ | 2 | prosciutto-crudo |
| `veggie-supreme-pizza-pizzadb-p11` | ベジースプリームピザ | 5 | green-pepper |
| `pescatore-pizzadb-p11` | ペスカトーレ | 5 | mussel, parsley, shrimp |
| `pesto-gamberi-pizzadb-p11` | ペストガンベリピザ | 3 | shrimp |
| `pesto-salmone-pizzadb-p11` | ペストサーモンピザ | 2 | lemon, salmon |
| `pesto-genovese-pizza-pizzadb-p11` | ペストジェノヴェーゼピザ | 2 | pine-nuts |
| `pesto-trapanese-pizzadb-p11` | ペストトラパネーゼピザ | 3 | almond |
| `pesto-noci-pizzadb-p12` | ペストノーチピザ | 1 | walnut |
| `pesto-vegetariana-pizzadb-p12` | ペストベジタリアーナピザ | 3 | bell-pepper, zucchini |
| `pesto-pollo-pizzadb-p12` | ペストポッロピザ | 2 | chicken |
| `boscaiola-pizzadb-p12` | ボスカイオーラ | 2 | porcini |
| `porchetta-pizza-pizzadb-p12` | ポルケッタピザ | 2 | pork |
| `porcini-pizza-pizzadb-p13` | ポルチーニ茸のピザ | 3 | parsley, porcini |
| `moussaka-style-pizza-pizzadb-p13` | ムサカ風ピザ | 3 | cinnamon, lamb |
| `mexican-elote-pizza-pizzadb-p13` | メキシカンエロテピザ | 3 | chili-powder, lime |
| `ratatouille-pizza-pizzadb-p13` | ラタトゥイユピザ | 4 | bell-pepper, zucchini |
| `rucola-e-grana-pizzadb-p13` | ルーコラエグラーナピザ | 2 | arugula, prosciutto-crudo |

### 5.6 Recipes valid now (54)

`aussie-pizzadb`, `quattro-formaggi-pizzadb`, `grandma-pizza-pizzadb`, `greek-style-pizzadb`, `chicago-deep-dish-pizzadb`, `siciliana-pizzadb`, `sfincione-pizzadb`, `flammkuchen-pizzadb`, `chilean-napolitana-pizzadb`, `trenton-tomato-pie-pizzadb`, `tonno-e-cipolla-pizzadb`, `new-haven-apizza-pizzadb`, `ny-style-pizzadb`, `margherita-pizzadb-row`, `pizza-a-caballo`, `fugazzeta-rellena`, `bianca-pizzadb-row`, `hawaiian-pizzadb-row`, `scacciata-ragusana-pizzadb-p4`, `st-louis-style-pizza-pizzadb-p4`, `argentine-napolitana-pizzadb-p1`, `old-forge-style-pizza-pizzadb-p1`, `caponata-pizza-pizzadb-p2`, `cauliflower-crust-pizza-pizzadb-p2`, `colorado-mountain-pie-pizzadb-p3`, `chicago-stuffed-pizza-pizzadb-p3`, `potato-mayo-pizza-pizzadb-p3`, `detroit-style-pizza-pizzadb-p5`, `new-england-bar-pizza-pizzadb-p6`, `parmigiana-pizza-pizzadb-p7`, `bambino-pizzadb-p7`, `bismarck-pizza-pizzadb-p7`, `pizza-portuguesa-pizzadb-p9`, `pizza-romana-pizzadb-p9`, `pizza-alla-norma-pizzadb-p9`, `pizza-al-taglio-romana-pizzadb-p9`, `pizza-feta-eliniki-pizzadb-p9`, `fathead-pizza-keto-pizzadb-p9`, `fugazza-pizzadb-p10`, `fugazzetta-pizzadb-p10`, `puttanesca-pizza-pizzadb-p10`, `burrata-pizza-pizzadb-p10`, `brazilian-calabresa-pizzadb-p10`, `breakfast-pizza-pizzadb-p11`, `pesto-caprese-pizzadb-p11`, `pesto-tonno-pizzadb-p12`, `pesto-patate-pizzadb-p12`, `pesto-burrata-pizzadb-p12`, `hot-honey-pepperoni-pizzadb-p12`, `marinara-pizza-pizzadb-p13`, `melanzane-pizza-pizzadb-p13`, `montreal-style-pizza-pizzadb-p13`, `nduja-pizza-pizzadb-p14`, `hokkaido-cheese-pizza-pizzadb-p15`

**Caveat.** "Valid now" is about taxonomy only. Many of these rows are still
`BLOCKED_PRODUCT_DECISION` for other reasons (sauce base, composition conflict, mechanic), and
38 of the 54 carry a Technique or capability trigger (§9).

---

## 6. Missing and ambiguous taxonomy

This is the complete list of every ingredient that can be a hint-eligible sub-topping somewhere
in the 172 rows but has no valid production taxonomy. The full rows, with recipe ids, are in the
JSON under `missingSubToppings172`, `unresolvedTokens172` and `categoryAmbiguousNonTopping`.

### 6.1 NEEDS_REVIEW toppings (32): the family needs HCG

Format: `id` (proposed family, number of 172 rows).

aji-amarillo (spice, 1), avocado (vegetable, 2), baked-beans (vegetable, 1), **beef (meat, 9)**,
bonito-flakes (seafood, 1), chicken-tikka (meat, 1), condensed-milk (other, 1),
fennel (vegetable, 1), french-fries (other, 2), **green-onion (vegetable, 6)**,
ground-beef (meat, 1), hot-dog (meat, 1), jalapeno (spice, 1), kimchi (vegetable, 1),
liver-pate (meat, 1), mentaiko (seafood, 1), mochi (other, 1), natto (vegetable, 1),
**nori (other, 4)**, peking-duck (meat, 1), pickles (vegetable, 2), puntarelle (vegetable, 1),
red-cabbage (vegetable, 1), rock-salt (spice, 1), sauerkraut (vegetable, 1),
sour-cream (other, 1), spicy-salami (meat, 1), truffle (vegetable, 1),
umeboshi-paste (spice, 1), wasabi (spice, 1), wurstel (meat, 1), zaatar (spice, 1).

### 6.2 PROPOSED toppings (64): data-only after HCG

- **13 with a confirmed category:** artichoke, arugula, bell-pepper, chicken, cilantro, parsley,
  porcini, powdered-sugar, prosciutto-crudo, shrimp, strawberry, walnut, zucchini.
- **51 whose category is also only proposed (K4):** almond, apple, asparagus, banana,
  blueberry, cabbage, carrot, cauliflower, celery, chicory, chili-powder, chocolate, cinnamon,
  cod-roe, cucumber, cumin, daikon, eel, friarielli, graham-cracker, green-pepper, kiwi, lamb,
  lemon, lettuce, lime, marshmallow, mint, mussel, okra, orange, palm-heart, paprika-powder,
  pine-nuts, pomegranate, pork, radicchio, salami, salmon, salmon-roe, salt-cod, sansho-pepper,
  sardine, shiso, spinach, squid, sunflower-seeds, sweet-potato, tortilla-chips, white-sesame,
  whitebait.

### 6.3 Unresolved topping tokens (8): no id, so no row is possible

| Token | Indicative family | Rows |
|---|---|---:|
| ひき肉 | meat | 5 |
| 唐辛子 | spice | 5 |
| スパイシーソーセージ | meat | 1 |
| 肉 | meat (generic) | 1 |
| 赤唐辛子 / 青唐辛子 | spice | 1 / 1 |
| ナッツ | other (generic) | 1 |
| 青のり | other | 1 |

### 6.4 Category-ambiguous (9): if any becomes a topping, it needs a family

- **Sauce today:** balsamic-vinegar, chutney, curry-ketchup, kebab-sauce, melted-butter,
  mustard, yuzu-kosho.
- **Cheese today:** cashew-cheese, catupiry.
- **Also:** mascarpone (catalog only, not used by 172).

This is a **silent escape hatch**:
- a condiment categorized as `sauce` never needs a family;
- it is named by the sauce rung instead of being classified;
- so the category decision changes what the player can buy.

### 6.5 Runtime boundary rows (3): valid now, may move at HCG

garlic (herb ↔ vegetable), capers (spice ↔ vegetable.pickled), black-olive (vegetable ↔ fruit or
condiment).

A move keeps the invariant (still exactly one family). It changes answers, though, which matters
for stored facts (F-8).

---

## 7. New-family requirement

**Mechanical result:**
- **0 ingredients need a family id outside DH4-1's 7** (`proposedFamilyOutsideDh4 = 0`);
- every PR #255 proposal and every indicative family of the topping tokens is one of meat /
  seafood / vegetable / fruit / herb / spice / other;
- **no new family is added by this audit.**

There are, however, clusters where the existing taxonomy is **semantically weak**. There the
Owner may *want* a new family, or a different placement. Each goes back to the Owner and is
**not** implemented.

| # | Ingredients | Recipe usage (172 rows) | Why the existing taxonomy may be insufficient | Candidate interpretations (not decided) | Why an Owner Decision is needed |
|---|---|---|---|---|---|
| NF-1 | The **`other` bucket:** walnut, pine-nuts, almond, sunflower-seeds, white-sesame, ナッツ (nuts / seeds); chocolate, marshmallow, graham-cracker, powdered-sugar (sweets); condensed-milk, sour-cream (dairy); french-fries, tortilla-chips, mochi (starch); nori, 青のり (seaweed); runtime **egg** | 27 row-uses excluding egg (walnut 4, nori 4, white-sesame 3, …); dessert pizzas; Japanese pizzas | The family label is 「その他」. OD-TAX-8 forbids it as player copy, and the 「ちょっと変わった材料」 candidate is still pending. Under Hint 5.0 every one of these gets a classification that tells the player little. | (a) keep `other` and only relabel (OD-TAX-8); (b) split into nuts・種 / 甘いもの / 乳製品 / 海藻, which are new ids; (c) move nori to seafood | A new id changes OD-TAX-2 ("keep 7 ids") and the family-size profile (PR #255 §8: 海藻 = のり is a label ≈ name) |
| NF-2 | **Condiments:** wasabi, umeboshi-paste, yuzu-kosho, mustard, rock-salt, chutney, balsamic-vinegar, curry-ketchup, kebab-sauce | 1 row each | They are split today between `spice` (topping) and `sauce`. The DH4 spice label 「スパイス・薬味」 mixes dried spice, condiment and pickled bud (PR #255 §9 △). | (a) keep spice + sauce; (b) a 調味料 family, which is a new id; (c) decide per id through the category (topping → spice, spread → sauce) | Category and family are decided together, and a category flip changes the rung type |
| NF-3 | **Prepared / composite:** chicken-tikka, peking-duck, hot-dog, liver-pate, baked-beans, kimchi, sauerkraut, natto, pickles | 1–2 each | The identity family is clear (meat or vegetable), but the "what it is" reading is a dish, not an ingredient | (a) the family of the main ingredient (current proposal); (b) `other` | Changes the size of meat / vegetable, and the answer the player gets |
| NF-4 | **Generic tokens:** 肉, ナッツ, ひき肉 | 7 rows | The family is certain, but the id is not. A row cannot exist before canonicalization. | (a) canonicalize to an existing id; (b) a new generic id with a family row; (c) exclude the recipe | Canonicalization is an A8 table decision (OD-TAX-7) |
| NF-5 | **Runtime singleton labels:** fruit = {pineapple}, spice = {capers}, other = {egg} | runtime | With k = 1 allowed, 「果物」 effectively names pineapple, but it is not *displayed* as the name | Owner accepted: deduction ≠ disclosure. This is #292's OD-H5-P2 (a family-size floor). | Not a new family. Listed so that H5-0 records it explicitly. |

---

## 8. Production invariant and gate design

### 8.1 Invariant

> **INV-H5-TAX (hard).** Every production hint-eligible sub-topping MUST resolve to **exactly one**
> valid Hint taxonomy family.

It is decomposed so that each part is mechanically checkable **without** a key-topping authority
(the key may change, so the superset form is used):

| Id | Statement | Why |
|---|---|---|
| **INV-T1** | For every `i` in `INGREDIENTS` with `i.category === "topping"`: `familyOf(i)` is defined, and it is one of `AttributeFamilyId`. | The superset of the sub-toppings. It is independent of `hintKeyToppingId` and of the order. |
| **INV-T2** | `TOPPING_FAMILY_ROWS` ids are unique; every row id is in `INGREDIENTS`; every row id has category `topping`. | "Exactly one". No orphan rows, and no sauce or cheese rows. |
| **INV-T3** | For every production recipe `r` and every `req` in `r.requiredIngredients`: `getIngredient(req.ingredientId)` is defined. | Otherwise a recipe can carry an id that INV-T1 never sees. |
| **INV-T4** | For every production recipe `r` with ≥ 1 sub-topping (by `recipeHintRoles` once it exists), and **every** sub-topping `s`, including the last: `subToppingClass(r, s)` returns `{ family }` equal to `familyOf(s)`. | This is the Hint 5.0 statement itself. It depends on H5-1. |
| **INV-T5** | No family `labelJa` or emoji string contains, or equals, any `INGREDIENTS[*].nameJa` or id. Labels come only from the fixed family table. | Classification is not disclosure |
| **INV-T6** | Runtime unknown or missing: if `familyOf(s)` is null at runtime, the Hint 5.0 answer is `NOT_A_TARGET`: 0 Pitz, no fact stored, and a uniform line. It never coarsens to group, category or existence. The gates above guarantee that this state is **unreachable** in production. | A fail-closed fallback that is never a silent downgrade |
| **INV-T7** | Canonical uniqueness: no two runtime ingredient ids are the same ingredient (unique `nameJa`, and no id is a known alias of another id in the A8 tables). | One ingredient, one row |

### 8.2 Gate matrix

| Gate | Checks | Where / when | Fails on | Exists today? |
|---|---|---|---|---|
| **G-CAT-1** (catalog) | INV-T1 + INV-T2 | unit test, CI (`vitest`) | A new topping in `ingredients.ts` without a family row. A row for a non-topping. A duplicate. | **Partly.** `deductionHint.test.ts:53` ("every runtime topping has exactly one family; sauces and cheeses have none") covers T1 and the category half of T2. Duplicate ids: yes (`:60`). |
| **G-REC-1** (recipe) | INV-T3 | unit test, CI | A recipe with an unknown ingredient id | **Not found** by grep (no test iterates `RECIPES` × `getIngredient`). **Add in H5-1.** |
| **G-H5-SWEEP** | INV-T4 for every recipe × every sub-topping × {own ladder step, all owned} | production gate test (the `deductionProduction.gate.test.ts` style), CI | Any sub-topping answering anything other than `{family}` | No. It needs H5-1. |
| **G-LAST** | The mandatory regression (§9 AC-LAST) | production gate test | The last sub-topping gets no classification | No. H5-1. |
| **G-LABEL** | INV-T5 over family labels **and** emoji and copy | unit test | A label containing any ingredient name | **Partly.** `deductionHint.test.ts:65` checks labels against `nameJa`. Extend it to Hint 5.0 copy and emoji. |
| **G-UNKNOWN** | INV-T6 on synthetic unknown or hostile ids (`__proto__`, `""`, a future id) | unit test | Any charge, a stored fact, or a coarsened answer | No (Hint 5.0). The DH4 guard coarsens by design, and that is kept for DH4. |
| **G-ALIAS** | INV-T7: unique `nameJa`; no runtime id appears in the canonicalizer's `AMBIGUOUS_TABLE` related ids without a recorded decision | unit test (`nameJa` uniqueness) + docs tooling check in the authoring PR (the canonicalizer is not in CI) | A second id for the same ingredient | No |
| **G-FIX-172** (forward compatibility) | Runs the same pure validator `validateHintTaxonomy(catalog, recipes, table)` on a **172-shaped fixture** built from this audit's JSON, and pins the expected-violation **set** | unit test (fixture only, never production data) | The set of violations **grows**. A shrinking set is allowed, and the snapshot is regenerated. | No. H5-1 (#292 G16). |
| **G-TQ** | The TQ-1D re-audit trigger (§10) | production gate test | A technique-requiring recipe, or a new technique id, reaches production without a recorded Hint 5.0 privacy re-audit | Partly (the DH4 contract). Extend it (§10). |

**Why these gates are fail-fast:**
- G-CAT-1 / G-REC-1 / G-ALIAS fail at **CI**, before any Preview or production deploy.
- There is no runtime check that "handles" a missing family by downgrading.
- INV-T6 exists only as defense in depth, and G-H5-SWEEP asserts that it is never hit
  (`NOT_A_TARGET` count = 0 over the production sweep).

### 8.3 Future additions

| Event | Required in the **same PR** | Gate that blocks otherwise |
|---|---|---|
| A new ingredient (any category) | the `ingredients.ts` row; the category **decided through HCG** (K4); if it is a topping, a `TOPPING_FAMILY_ROWS` row from the PR #255 PROPOSED row after its HCG entry is resolved; the alias check | G-CAT-1, G-ALIAS |
| A new recipe (the 26th … the 173rd+) | all of its ingredients exist; the authored `hintKeyToppingId` / `hintSubToppingOrder` (if OD-H5-C1 = A); every sub-topping classified | G-REC-1, G-H5-SWEEP, G-LAST, the #292 G17 authored-field gate |
| A new family id (Owner only) | the `AttributeFamilyId` union; the label and emoji; a label-safety check; the size profile | G-LABEL. A TypeScript exhaustiveness check on any `switch` over families (recommended). |
| An ingredient's family moves (HCG) | an update to the row and the audit snapshot; a stored-fact impact note (F-8) | G-CAT-1 (still exactly one); G-FIX-172 snapshot |
| A recipe needing a Technique | the §10 re-audit record | G-TQ |

**No gate may pin the recipe count** (for example "25 recipes"). Gates iterate over `RECIPES`,
so the 173rd recipe is covered with no gate edit. The existing DH4-PROD gate pins `25`. That is
acceptable there, but a Hint 5.0 gate must not copy it.

---

## 9. Hint 5.0 connection: a testable Acceptance Criterion

**AC-LAST.** 「最後の1つの未解明sub-toppingでも分類ヒントが出る」.

**Setup.** For every production recipe `r` with ≥ 1 sub-topping, and for `s` = the **last**
sub-topping in `hintSubToppingOrder` (and, as a separate case, every other `s`), build a save
where:
- every other rung of `r` is owned: sauce / cheese / key names, STRUCTURE, and the
  classification of every other sub-topping. If OD-H5-C3 keeps name purchases, the names of
  every other sub-topping are owned too.
- the owned inventory is tried twice:
  - **(i)** `r`'s own ladder step (minimal);
  - **(ii)** all ingredients (maximal).
- Pitz ≥ the price.

**PASS, if all of these hold:**
1. The request returns a classification whose family = `TOPPING_FAMILY_ROWS[s]`.
2. Exactly one charge of the configured price, which is > 0. The fact `cls:<s>` is stored and
   survives a reload. A second request is `ALREADY_KNOWN` and charges 0.
3. The rendered line contains the family label (and emoji) for `familyOf(s)`.
4. **PASS even when the classification narrows the candidates to exactly one ingredient.**
   - The fixture must include at least one such case, for example a recipe whose last
     sub-topping is `pineapple` (runtime fruit = {pineapple}).
   - The test asserts that the answer is **still given**, and is not suppressed or coarsened.

**FAIL, if any of these occurs:**
1. The answer is existence, category, group, 「今はまだ…」, or `NOT_A_TARGET` for a production
   recipe.
2. **Any** surface exposes `s`'s id or `nameJa` (or any unpurchased ingredient's id or name)
   as, or inside, the classification hint. The surfaces are:
   - text; `aria-*`; `title`; `alt`; `data-*`;
   - the `HintSheet` view model (including non-rendered fields);
   - the request / result objects passed to the UI.
3. The fact id `cls:<s>` is rendered in the DOM.
   - Today `factId` is only a React `key` (`HintSheet.tsx:400`), which is not rendered.
   - A future `data-fact-id` would leak the ingredient id, so the sweep must scan for `cls:`.
4. Any recipe identity (name / id / description / image) or Technique identity appears.

The existing leak sweep (`App.hintSheet.test.tsx` and the DH4-PROD privacy sweeps) is the
template. AC-LAST adds case 4 of PASS: **narrowing to 1 is allowed; displaying is not.**

---

## 10. TQ-1D future re-audit trigger (design only; no TQ-1D work)

**Today:**
- `deductionProduction.gate.test.ts` fails when a production recipe has ≠ 1 sauce, or when
  `requiredTechniquesOf` is non-empty (the "re-run the DH4 privacy gate (TQ-1D)" message).
- It covers DH4 only, and it is keyed on the single technique `no-sauce`.

**Pressure from the 172 population (measured):**
- **30** rows have no spread layer (`NO_SAUCE`, by the TQ-1C definition);
- **44** are labeled 「ノンソース」 (K3);
- **27** are MULTI_SPREAD_LAYER, **23** are LATE_ADDITION;
- **111 / 172** carry at least one capability or Technique trigger;
- even among the 54 taxonomy-VALID_NOW rows, **38** carry one, including 9 NO_SAUCE rows
  (aussie, quattro-formaggi, chilean-napolitana, pizza-a-caballo, fugazzeta-rellena,
  argentine-napolitana, fugazza, fugazzetta, hokkaido-cheese).

**Design: a Hint Privacy Audit Manifest.** It is data only and checked in. It is **not**
implemented here.

```
HINT_PRIVACY_AUDIT = {
  auditedTechniqueIds: [],          // Technique ids whose Hint 5.0 interaction was re-audited
  auditedSauceShapes: ["exactly-one"], // e.g. later "none", "multi"
  auditedFactKinds: ["ing", "meta", "attr", "cls"],
  auditedFamilyIds: [7 DH4 ids],
  reportRef: "docs/reports/…",      // the re-audit report that justified the last change
}
```

A production gate test (same file family as DH4-PROD) fails when any of the following holds:

| Trigger | Condition | Why |
|---|---|---|
| TR-1 | A production recipe has `requiredTechniquesOf(r)` ⊄ `auditedTechniqueIds` | A Technique recipe reached production |
| TR-2 | `TECHNIQUES` gains an id not in `auditedTechniqueIds` (even if unused) | A new identity that the hint surfaces could leak |
| TR-3 | A production recipe's sauce count is 0 or ≥ 2 and that shape is not in `auditedSauceShapes` | A sauce rung / STRUCTURE on a NO_SAUCE or MULTI_SPREAD recipe can reveal a Technique (#292 §14, OD-H5-T1) |
| TR-4 | A new fact kind is stored (for example `tech:`, `finish:`), or a new family id appears | A new disclosure axis. Joint-axis k is FR-3. |
| TR-5 | A future recipe field carries timing / role (post-bake, zone, pan) and a hint module imports it | OD-TAX-6: timing must not enter taxonomy or hints unaudited |

**Rules:**
- The manifest may only be widened in a PR that also adds the re-audit report named in
  `reportRef`, so a reviewer sees the privacy argument next to the change.
- The existing `deductionProduction.gate.test.ts` assertions stay. TR-1..5 extend them to Hint
  5.0 and do not replace them.
- **No Technique identity design here.** OD-H5-T1 (how a NO_SAUCE sauce rung behaves) remains a
  TQ-1D Owner decision.

---

## 11. Findings for H5-0

| # | Finding | Evidence |
|---|---|---|
| **F-1** | The runtime invariant **already holds**: 22 / 22 toppings have a family, and 0 / 25 recipes have an unclassified topping. A new runtime topping without a row already fails CI. | JSON `counts`; `deductionHint.test.ts:53` |
| **F-2** | The current DH4 code path **silently coarsens** a missing family to category (`deductionHint.ts:162`, `deductionGuard.ts` `classOf`), and the `ingredientTaxonomy.ts` header documents that as intended. Hint 5.0 must **not** reuse it. It needs its own fail-closed answer (INV-T6) plus the CI gates, and the header comment must be amended for Hint 5.0 in H5-1. | K1 |
| **F-3** | **Gate gap:** no test asserts that every recipe ingredient id exists in `INGREDIENTS` (INV-T3). G-CAT-1 iterates the catalog, not the recipes. | grep, §8.2 |
| **F-4** | **Category is the real escape hatch.** Sub-topping eligibility is `category === "topping"`. Nine ingredients are category-ambiguous, and 51 more have only a proposed category. HCG (OD-TAX-7) must decide **category as well as family**. | §5.1, §6.4, K4 |
| **F-5** | **"62 / 172" is not a closed population.** The 172 rows use 169 ids, of which only 52 are in the 62 catalog. The invariant must be stated over the **production catalog + production recipes** at every commit, not over a dataset. | K2 |
| **F-6** | **172 coverage:** 96 topping ids and 8 topping tokens have no valid taxonomy. That is 54 VALID_NOW / 59 DATA_ONLY / 45 NEEDS_HCG / 14 UNRESOLVED recipes. **0 new family ids are required.** | §5–§7 |
| **F-7** | **The key-topping authority changes the shape.** With an authored key, 31 / 172 recipes have 0 sub-toppings (OD-H5-P3 scales). Without one, 4 do. INV-T1 is written over *all* toppings, so the taxonomy invariant does not depend on C1. | §5.2 |
| **F-8** | **Stored-fact stability.** `cls:<ingredientId>` (the #292 §7 recommendation) survives an HCG family move, because the label is looked up at render time. The existing DH4 `attr:family:<f>` facts embed the answer, so a move of garlic, capers or black-olive would make an old purchase disagree with the new classification. H5-2 must define this. | §6.5 |
| **F-9** | **TQ-1D pressure is large** (111 / 172 carry a trigger), and "no sauce" has two definitions (K3). The re-audit trigger must be data-driven (§10), not a single `expect([])`. | §10 |
| **F-10** | PR #272 makes DH4-1 families a **second consumer** (the pantry filter). Any HCG row change must run both consumers' tests. There is no conflict with this audit. | K5 |
| **F-11** | The family label 「その他」 covers 16 ids at 172 (NF-1). OD-TAX-8 copy is still undecided, and Hint 5.0 will show it far more often than DH4 did. | NF-1 |
| **F-12** | **Single source.** Keep `TOPPING_FAMILY_ROWS` as the one runtime taxonomy authority. Hint 5.0 must not add a parallel map. Moving it to a catalog field is still open (PR #255 §18). | A2 |

---

## 12. Verdict: BLOCKER / OWNER DECISION REQUIRED / SAFE FOR H5-0

### BLOCKER

None of these blocks the **H5-0 decision**. Each one blocks **production expansion or H5-1
design** as stated.

| Id | Blocks | Item |
|---|---|---|
| B-1 | Adding any of the 96 missing topping ids (116 recipes) to production | OD-TAX-7 HCG has not run. PROPOSED rows are not authority. |
| B-2 | The 14 recipes with a topping token | 8 unresolved topping tokens need canonicalization (A8) before any row can exist |
| B-3 | The recipes containing the 9 category-ambiguous ingredients (and the 51 proposed-category ids) | The category must be decided (F-4). Otherwise a condiment can escape classification as a sauce. |
| B-4 | The H5-1 design | Hint 5.0 must not reuse the DH4 silent coarsening (F-2). It needs a fail-closed answer + G-H5-SWEEP. |
| B-5 | Claiming INV-H5-TAX as proven | The G-REC-1 gap (F-3) must be closed in H5-1 |

### OWNER DECISION REQUIRED

| Id | Decision | Links |
|---|---|---|
| OD-A | Schedule the HCG, and extend its scope to **category + family + canonicalization** (not family only) | OD-TAX-7, F-4 |
| OD-B | NF-1: keep `other` with new copy, or split it (a new id → back to the Owner) | OD-TAX-2 / -8, #292 C4 |
| OD-C | NF-2: the condiment placement (spice vs sauce vs a new id) | OD-TAX-7 |
| OD-D | NF-3 / NF-4: prepared foods and generic tokens | OD-TAX-7 |
| OD-E | The runtime boundaries (garlic / capers / black-olive), **and** what happens to stored `attr:family:` facts if they move | F-8, H5-2 |
| OD-F | Confirm that the taxonomy invariant covers **all** toppings (INV-T1), independent of the key-topping authority | F-7, #292 C1 |
| OD-G | Confirm the Hint Privacy Audit Manifest approach for TQ-1D (TR-1..5), and align the two "no sauce" definitions | F-9, #292 T1 |
| OD-H | Where the family lives long term (the DH4-1 table, or a catalog field) | F-12, PR #255 §18 |

### SAFE FOR H5-0

- The runtime is **data-complete** for Hint 5.0 classification: 22 / 22 toppings and 25 / 25
  recipes (F-1).
- Removing k ≥ 2 for classification **does not change taxonomy coverage**. Coverage is a data
  property, not a guard property.
- **No new family id** is required for 62 or 172 (F-6). OD-TAX-2 holds.
- INV-H5-TAX can be enforced **fail-fast at CI** with G-CAT-1 (exists), G-REC-1, G-LABEL
  (partly exists), G-UNKNOWN, G-H5-SWEEP, G-LAST, G-ALIAS and G-FIX-172. None of them needs a
  silent runtime fallback.
- AC-LAST is testable as written in §9, including the "narrowed to 1 = PASS" case.
- The `cls:<ingredientId>` fact id is robust to HCG relabeling (F-8).
- There is no conflict with PR #255 / OD-TAX-1..9, DH4, PR #291, TQ-1C or PR #272. This audit
  only reads them.

---

## 13. Reproduction

```
git fetch origin claude/172-recipe-ingredient-audit-d33d8i   # PR #255 head e221e36 must be present
python3 docs/reports/tools/hint5_taxonomy_172_coverage.py          # writes the JSON snapshot
python3 docs/reports/tools/hint5_taxonomy_172_coverage.py --check  # OK, no drift
```

## 14. Non-goals

- No change to `src/**`, tests, CI, PR #255, PR #291, PR #272, TQ-1D, #275, #260, or any
  Progression / W1 / I5b branch.
- No H5-1 implementation. No family, category, alias or canonical id added or changed.
- No Owner Decision taken or overwritten. No merge.
- An audit-only task, so no Preview or video (Human Verification Policy exemption).
