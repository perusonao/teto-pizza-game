# 172 Recipe Taxonomy / HCG — Fresh Audit (Human Review authority pack)

**Status: docs/data/tools only. NOT an authority, and no Owner Decision is made here.**
Every HCG item below is a **question** for the Owner and the Human Classification Gate (OD-TAX-7),
never an answer.

**Nothing changes in:**
- production data, `src/**` or e2e;
- the taxonomy rows or the 7 families;
- Hint 5.0, TQ or Cooking Steps;
- PR #255, PR #293 or the 172 Authority Matrix branch.

| Deliverable | Path |
|---|---|
| Report (this file) | `docs/reports/TETO_RECIPE-172_TAXONOMY-HCG_FRESH-AUDIT.md` |
| Machine-readable pack | `docs/reports/data/TETO_RECIPE-172_TAXONOMY-HCG.json`, with these sections:<br>- `items` (54 blocker ingredients);<br>- `decisions` (31 HCG questions);<br>- `fRows` (65);<br>- `greedy`;<br>- `summary`. |
| Generator / checker | `tools/recipe172_taxonomy_hcg.py`. It reads **pinned git objects only**, so it is deterministic. `--check` reports drift. It is not in CI and not wired to production. |

---

## 1. Fresh Check

| Source | Pin | State (fetched 2026-09-28) |
|---|---|---|
| `origin/main` | **`86b48fd51423a8f76db5398ab88ecfd944e2ae10`** (Merge PR #291) | Unchanged since PR #293 and since the Matrix. No diff in `src/data/**`, `data/**`, `docs/design/data/**` or the canonicalizer. |
| PR #293 (Taxonomy Coverage) | `1bb4f9d` | OPEN. Read-only reference. Its numbers were **recomputed**, not copied (§2). |
| PR #255 (OD-TAX-1..9) | `e221e36` | OPEN. PROPOSED / NEEDS_REVIEW rows and the Human Review Queue are read only. |
| 172 Authority Matrix | `claude/172-recipe-authority-matrix` @ **`79873c0`** | Read only. It gives F = 65. |
| Hint 5.0 | H5-3 HEAD `1ec4253` (reported). The H5-2 branch `abce62a` carries `hintClassDisplay.ts` and the T-COV gates. | **Not touched.** Its display table and gates use the same 7 family ids. |
| Runtime catalog | `src/data/ingredients.ts` @ main | 29 ingredients (sauce 3 / cheese 4 / topping 22) |
| Taxonomy (production) | `src/data/ingredientTaxonomy.ts` @ main | **7 families** (meat, seafood, vegetable, herb, spice, fruit, other), 22 rows. The generator fails if the ids change. |
| Alias / canonicalization authority | `tools/progression2_ingredient_canonicalizer.py` @ main | Its `LIKELY_ALIAS_TABLE`, `AMBIGUOUS_TABLE`, `GENUINELY_NEW_REGISTRY` and `TAXONOMY_FLAGS` are parsed with `ast`, and are not executed |
| 62 catalog | `data/recipes/ingredient_master_catalog.json` @ main | 62 rows |

**Branch decision.**
- PR #293 is a coverage audit. This work is the next phase: the HCG pack.
- Mixing it into PR #293 would change that PR's scope, so it is on a **new branch from `main`**:
  `claude/recipe172-taxonomy-hcg`.
- It does not touch any open PR.

## 2. How F was recomputed (and what the Matrix under-reports)

The Matrix defines F as:
- an unresolved ingredient token; or
- a PR #293 tier of NEEDS_HCG_DECISION.

This pack **recomputes F independently** from the 172 evidence, PR #255 and the production taxonomy. A row is F when it contains either of these:
- (a) an unresolved token; or
- (b) a PR #255 NEEDS_REVIEW id that has no production row and is either a topping or in the Human Review Queue.

**Result:**
- **The same 65 rows** as the Matrix. The generator asserts that the two sets are equal.
- For every row, the Matrix's blocker list is a subset of the recomputed list.
- **In 4 rows the Matrix under-reports.** The Matrix lists PR #293's `authorityAmbiguous` only for NEEDS_HCG rows, so an ambiguous id inside an UNRESOLVED_TOKEN row is missing:

| Row | Matrix lists | Also blocking |
|---|---|---|
| `diavola-pizza-pizzadb-p5` | 唐辛子 | spicy-salami |
| `feteer-meshaltet-pizzadb-p10` | ひき肉 | condensed-milk, melted-butter |
| `okonomiyaki-style-pizza-pizzadb-p1` | 青のり | bonito-flakes |
| `swedish-kebab-pizza-pizzadb-p4` | 肉 | kebab-sauce |

So the **real root-cause set is 54 ingredients**, not the 49 names the Matrix lists. Resolving only the Matrix's items would leave these 4 rows in F.

## 3. Resolution order (normative for this pack)

```
raw label (PIZZA DB ingredientsJa)
  → canonical ingredient ID   (canonicalizer tables; never fuzzy)
    → category                (sauce | cheese | topping)
      → taxonomy family       (one of the 7; toppings only)
```

- **A later step is never decided before an earlier one.**
- An item whose category is still open has its family candidate **withheld** in the JSON (`familyCandidate: null`, with a note).
- Sauces and cheeses carry no hint family (DH4-1 / Hint 5.0 H5-INV-7 apply to toppings).

## 4. Required counts (A–H)

| # | Measure | Count | Items / note |
|---|---|---:|---|
| **A** | F rows / root-cause ingredients | **65 / 54** | Blockers per row: 48 rows have 1, 14 have 2, 3 have 3. 33 of the 65 rows are also class E. |
| **B** | Canonical ID missing (raw token, no id) | **13** | 唐辛子, 赤唐辛子, 青唐辛子, ひき肉, 肉, チーズ, チーズソース, ホワイトソース, カレーソース, プロヴェルチーズ, スパイシーソーセージ, ナッツ, 青のり |
| **C** | Category undecided | **18** | the condiments (mustard, yuzu-kosho, balsamic-vinegar, chutney, curry-ketchup, umeboshi-paste, wasabi, melted-butter); the dairy (catupiry, cashew-cheese, sour-cream, condensed-milk); the prepared foods (chicken-tikka, peking-duck, hot-dog, liver-pate, baked-beans); カレーソース |
| **D** | Taxonomy family undecided (category already topping) | **19** | green-onion, nori, 青のり, the chili set (唐辛子 ×3, jalapeno, aji-amarillo), pickles, kimchi, sauerkraut, avocado, french-fries, mochi, natto, fennel, rock-salt, zaatar, bonito-flakes |
| **E** | Resolvable by an **alias alone** (an existing id is a valid target; category and family are not in question) | **12** | ground-beef, ひき肉, 肉, wurstel, スパイシーソーセージ, spicy-salami, mentaiko, red-cabbage, puntarelle, チーズ, ナッツ, ホワイトソース. Also チーズソース, which is ID-only but needs a **new** id. |
| **F** | Human Review required | **50** | = 54 − G |
| **G** | Safely resolvable by **existing authority alone** (HCG confirms, no judgment) | **4** | beef, truffle, provel (プロヴェルチーズ), kebab-sauce. Together they release **7 rows** (F 65 → 58). |
| **H** | Rows released by the top 10 decisions | **39** | F 65 → **26**. The 10 decisions are 1 confirm + 9 Owner decisions (§7). |

**New family required: 0.** Every item has at least one option inside the 7 families.
- 5 decisions carry **new-family pressure**: HCG-07 seaweed, HCG-15 condiments, HCG-16 dairy, HCG-20 starch and HCG-25 seasoning.
- If the Owner rejects every in-7 option for one of them, that is a **STOP → Owner Decision** (§8). Nothing is added here.

## 5. Blocker ingredients (impact order)

The table is sorted by **F rows released if this item alone is resolved** (the sole blocker), then by F rows touched. The JSON `items[]` holds the full fields:
- raw names; canonical candidate; id existence (runtime / catalog / registry / PR #255);
- 172 usage; category candidate and source; family candidate (withheld while the category is open);
- aliases, ambiguity text and review bucket; the taxonomy flag;
- confidence; existing authority; decisions; blocker types; Human Review; the row ids.

Column key:
- **172 use** = 172 rows that use the item.
- **F rows** = F rows it blocks.
- **Sole** = F rows released by resolving this item alone.
- **HR** = Human Review needed.
- For a raw token, the canonical id is **none**. The ids an AMBIGUOUS_TABLE entry relates it to are in `relatedIdsFromAmbiguityTable`; they are **not** candidates (for example, 唐辛子 is explicitly not chili-oil).

| # | Item | Raw name | Canonical id | Id exists | 172 use | F rows | Sole | Category candidate | Family candidate (not authority) | Existing alias target | Blocker type | HR | Decisions |
|---:|---|---|---|---|---:|---:|---:|---|---|---|---|---|---|
| 1 | `beef` | 牛肉 | beef | canonicalizer registry | 9 | 9 | **5** | topping | meat | – | confirm only | no (confirm) | HCG-01 |
| 2 | `green-onion` | 青ねぎ | green-onion | canonicalizer registry | 6 | 6 | **3** | topping | vegetable | – | family undecided | yes | HCG-04 |
| 3 | `唐辛子` | 唐辛子 | **none** | **none** | 5 | 5 | **3** | topping | spice | – | canonical id missing, family undecided | yes | HCG-05, HCG-06 |
| 4 | `nori` | 海苔 | nori | catalog 62 | 4 | 4 | **2** | topping | other | – | family undecided | yes | HCG-07 |
| 5 | `チーズ` | チーズ | **none** | **none** | 3 | 3 | **2** | cheese | – | mozzarella, cheddar, parmigiano | canonical id missing | yes | HCG-09 |
| 6 | `avocado` | アボカド | avocado | canonicalizer registry | 2 | 2 | **2** | topping | vegetable | – | family undecided | yes | HCG-21 |
| 7 | `catupiry` | カトゥピリチーズ | catupiry | canonicalizer registry | 2 | 2 | **2** | cheese (open) | – | – | category undecided | yes | HCG-16 |
| 8 | `ホワイトソース` | ホワイトソース | **none** | **none** | 2 | 2 | **2** | sauce | – | fromage-blanc-sauce | canonical id missing | yes | HCG-10 |
| 9 | `ひき肉` | ひき肉 | **none** | **none** | 5 | 5 | **1** | topping | meat | ground-beef | canonical id missing | yes | HCG-02 |
| 10 | `french-fries` | フライドポテト | french-fries | catalog 62 | 2 | 2 | **1** | topping | other | – | family undecided | yes | HCG-20 |
| 11 | `pickles` | ピクルス | pickles | canonicalizer registry | 2 | 2 | **1** | topping | vegetable | – | family undecided | yes | HCG-17 |
| 12 | `aji-amarillo` | アヒアマリージョ | aji-amarillo | canonicalizer registry | 1 | 1 | **1** | topping | spice | – | family undecided | yes | HCG-06 |
| 13 | `baked-beans` | ベイクドビーンズ | baked-beans | canonicalizer registry | 1 | 1 | **1** | topping (open) | vegetable | – | alias or id relation, category undecided | yes | HCG-18, HCG-19 |
| 14 | `balsamic-vinegar` | バルサミコ酢 | balsamic-vinegar | canonicalizer registry | 1 | 1 | **1** | sauce (open) | – | – | category undecided | yes | HCG-15 |
| 15 | `cashew-cheese` | カシューナッツチーズ | cashew-cheese | canonicalizer registry | 1 | 1 | **1** | cheese (open) | – | – | category undecided | yes | HCG-16 |
| 16 | `chicken-tikka` | チキンティッカ | chicken-tikka | canonicalizer registry | 1 | 1 | **1** | topping (open) | meat | – | alias or id relation, category undecided | yes | HCG-18 |
| 17 | `chutney` | チャツネ | chutney | canonicalizer registry | 1 | 1 | **1** | sauce (open) | – | – | category undecided | yes | HCG-15 |
| 18 | `fennel` | フェンネル | fennel | canonicalizer registry | 1 | 1 | **1** | topping | vegetable | – | alias or id relation, family undecided | yes | HCG-24 |
| 19 | `ground-beef` | ground-beef | ground-beef | PR #255 row only | 1 | 1 | **1** | topping | meat | beef | alias or id relation | yes | HCG-02 |
| 20 | `hot-dog` | ホットドッグ | hot-dog | canonicalizer registry | 1 | 1 | **1** | topping (open) | meat | – | alias or id relation, category undecided | yes | HCG-18 |
| 21 | `jalapeno` | ハラペーニョ | jalapeno | canonicalizer registry | 1 | 1 | **1** | topping | spice | – | family undecided | yes | HCG-06 |
| 22 | `liver-pate` | レバーパテ | liver-pate | canonicalizer registry | 1 | 1 | **1** | topping (open) | meat | – | alias or id relation, category undecided | yes | HCG-18 |
| 23 | `puntarelle` | プンタレッレ | puntarelle | canonicalizer registry | 1 | 1 | **1** | topping | vegetable | chicory | alias or id relation | yes | HCG-23 |
| 24 | `red-cabbage` | 紫キャベツ | red-cabbage | canonicalizer registry | 1 | 1 | **1** | topping | vegetable | cabbage | alias or id relation | yes | HCG-22 |
| 25 | `rock-salt` | 岩塩 | rock-salt | canonicalizer registry | 1 | 1 | **1** | topping | spice | – | family undecided | yes | HCG-25 |
| 26 | `sauerkraut` | ザワークラウト | sauerkraut | canonicalizer registry | 1 | 1 | **1** | topping | vegetable | – | family undecided | yes | HCG-17 |
| 27 | `truffle` | トリュフ | truffle | catalog 62 | 1 | 1 | **1** | topping | vegetable | – | confirm only | no (confirm) | HCG-27 |
| 28 | `umeboshi-paste` | 梅肉 | umeboshi-paste | canonicalizer registry | 1 | 1 | **1** | topping (open) | spice | – | category undecided | yes | HCG-15 |
| 29 | `yuzu-kosho` | 柚子胡椒 | yuzu-kosho | canonicalizer registry | 1 | 1 | **1** | sauce (open) | – | – | category undecided | yes | HCG-15 |
| 30 | `zaatar` | ザアタル | zaatar | canonicalizer registry | 1 | 1 | **1** | topping | spice | – | family undecided | yes | HCG-25 |
| 31 | `カレーソース` | カレーソース | **none** | **none** | 1 | 1 | **1** | sauce (open) | – | – | canonical id missing, category undecided | yes | HCG-11 |
| 32 | `スパイシーソーセージ` | スパイシーソーセージ | **none** | **none** | 1 | 1 | **1** | topping | meat | sausage | canonical id missing | yes | HCG-14 |
| 33 | `ナッツ` | ナッツ | **none** | **none** | 1 | 1 | **1** | topping | other | walnut, almond | canonical id missing | yes | HCG-28 |
| 34 | `プロヴェルチーズ` | プロヴェルチーズ | **none** | **none** | 1 | 1 | **1** | cheese | – | – | canonical id missing, confirm only | no (confirm) | HCG-13 |
| 35 | `赤唐辛子` | 赤唐辛子 | **none** | **none** | 1 | 1 | **1** | topping | spice | – | canonical id missing, family undecided | yes | HCG-05, HCG-06 |
| 36 | `bonito-flakes` | かつお節 | bonito-flakes | canonicalizer registry | 1 | 1 | **0** | topping | seafood | – | family undecided | yes | HCG-29 |
| 37 | `condensed-milk` | コンデンスミルク | condensed-milk | canonicalizer registry | 1 | 1 | **0** | topping (open) | other | – | category undecided | yes | HCG-16 |
| 38 | `curry-ketchup` | curry-ketchup | curry-ketchup | PR #255 row only | 1 | 1 | **0** | sauce (open) | – | – | alias or id relation, category undecided | yes | HCG-11, HCG-15 |
| 39 | `kebab-sauce` | ケバブソース | kebab-sauce | canonicalizer registry | 1 | 1 | **0** | sauce | – | – | confirm only | no (confirm) | HCG-30 |
| 40 | `kimchi` | キムチ | kimchi | canonicalizer registry | 1 | 1 | **0** | topping | vegetable | – | family undecided | yes | HCG-17 |
| 41 | `melted-butter` | 溶かしバター | melted-butter | canonicalizer registry | 1 | 1 | **0** | sauce (open) | – | – | category undecided | yes | HCG-15 |
| 42 | `mentaiko` | 明太子 | mentaiko | canonicalizer registry | 1 | 1 | **0** | topping | seafood | cod-roe | alias or id relation | yes | HCG-26 |
| 43 | `mochi` | もち | mochi | canonicalizer registry | 1 | 1 | **0** | topping | other | – | family undecided | yes | HCG-20 |
| 44 | `mustard` | マスタード | mustard | canonicalizer registry | 1 | 1 | **0** | sauce (open) | – | – | category undecided | yes | HCG-15 |
| 45 | `natto` | 納豆 | natto | canonicalizer registry | 1 | 1 | **0** | topping | vegetable | – | family undecided | yes | HCG-19 |
| 46 | `peking-duck` | 北京ダック | peking-duck | canonicalizer registry | 1 | 1 | **0** | topping (open) | meat | – | alias or id relation, category undecided | yes | HCG-18 |
| 47 | `sour-cream` | サワークリーム | sour-cream | canonicalizer registry | 1 | 1 | **0** | topping (open) | other | – | category undecided | yes | HCG-16 |
| 48 | `spicy-salami` | サラミピカンテ | spicy-salami | catalog 62 | 1 | 1 | **0** | topping | meat | salami | alias or id relation | yes | HCG-31 |
| 49 | `wasabi` | わさび | wasabi | canonicalizer registry | 1 | 1 | **0** | topping (open) | spice | – | category undecided | yes | HCG-15 |
| 50 | `wurstel` | wurstel | wurstel | catalog 62 | 1 | 1 | **0** | topping | meat | sausage | alias or id relation | yes | HCG-14 |
| 51 | `チーズソース` | チーズソース | **none** | **none** | 1 | 1 | **0** | sauce | – | – | canonical id missing | yes | HCG-12 |
| 52 | `肉` | 肉 | **none** | **none** | 1 | 1 | **0** | topping | meat | beef, pork, chicken, lamb | canonical id missing | yes | HCG-03 |
| 53 | `青のり` | 青のり | **none** | **none** | 1 | 1 | **0** | topping | other | – | canonical id missing, family undecided | yes | HCG-07, HCG-08 |
| 54 | `青唐辛子` | 青唐辛子 | **none** | **none** | 1 | 1 | **0** | topping | spice | – | canonical id missing, family undecided | yes | HCG-05, HCG-06 |

**Checked specifically (per request):**

| Item | Rows | Sole | Status |
|---|---:|---:|---|
| beef family | beef 9 / 5; ひき肉 5 / 1; ground-beef 1 / 1; 肉 1 / 0 | | beef is **CONFIRM** (registry 牛肉→beef, and every related id is meat). ひき肉 and ground-beef are one ID question (HCG-02). 肉 is a separate generic question (HCG-03). |
| green-onion | 6 | 3 | FAMILY (vegetable vs spice). This is the single highest-impact **Owner** item after the confirms. |
| 唐辛子 family | 唐辛子 5 / 3; 赤 1 / 1; 青 1 / 0 | | **2 decisions are needed together:** ID (HCG-05) + FAMILY (HCG-06). Alone, HCG-05 releases 0 rows. Together they release 8 (with jalapeno and aji-amarillo). |
| nori | 4 | 2 | FAMILY (seafood / spice / other). This decision has new-family pressure (海藻). |

The Matrix's list ranks these as the top causes by frequency. **Measured by the release effect**, beef (confirm) is first, and the condiment and dairy category decisions come ahead of green-onion, the chili set, ひき肉 and nori (§6).

## 6. HCG decisions (release effect)

Column key:
- **Touched** = F rows that contain one of the decision's items.
- **Alone** = F rows the decision releases by itself.
- **NF** = new-family pressure.

| Id | Kind | Items | Touched | Alone | Owner Decision | NF | Question |
|---|---|---|---:|---:|---|---|---|
| HCG-01 | CONFIRM | beef | 9 | **5** | no (existing authority) |  | Confirm beef (牛肉) as its own topping id, family meat. |
| HCG-15 | CATEGORY | mustard, yuzu-kosho, balsamic-vinegar, chutney, curry-ketchup, umeboshi-paste, wasabi, melted-butter | 8 | **4** | yes | ⚠ | Condiments: spread sauce, or topping (then family spice)? Decide category first. |
| HCG-04 | FAMILY | green-onion | 6 | **3** | yes |  | green-onion (青ねぎ / 万能ねぎ): vegetable or spice (薬味)? |
| HCG-16 | CATEGORY | catupiry, cashew-cheese, sour-cream, condensed-milk | 5 | **3** | yes | ⚠ | Creamy dairy: cheese (no hint family) or topping? sour-cream / condensed-milk may also be a spread sauce. |
| HCG-18 | ID | chicken-tikka, peking-duck, hot-dog, liver-pate, baked-beans | 5 | **3** | yes |  | Prepared / composite foods: accept as ingredient ids (family of the main ingredient), re-canonicalize, or exclude? |
| HCG-06 | FAMILY | 唐辛子, 赤唐辛子, 青唐辛子, jalapeno, aji-amarillo | 9 | **2** | yes |  | Fresh chili peppers (唐辛子 tokens, jalapeno, aji-amarillo): spice or vegetable? |
| HCG-02 | ID | ひき肉, ground-beef | 6 | **2** | yes |  | ひき肉 → ground-beef, or a new generic ground-meat id? (ground-beef has no Japanese name evidence of its own.) |
| HCG-07 | FAMILY | nori, 青のり | 5 | **2** | yes | ⚠ | Seaweed (nori, and 青のり if it becomes an id): seafood, spice (薬味) or other? |
| HCG-17 | FAMILY | pickles, kimchi, sauerkraut | 4 | **2** | yes |  | Pickled / fermented vegetables: vegetable or spice (薬味)? |
| HCG-09 | ID | チーズ | 3 | **2** | yes |  | Generic チーズ (3 rows): which cheese id per row? |
| HCG-10 | ID | ホワイトソース | 2 | **2** | yes |  | ホワイトソース → fromage-blanc-sauce, or a new white-sauce id? |
| HCG-21 | FAMILY | avocado | 2 | **2** | yes |  | avocado: vegetable or fruit? |
| HCG-25 | FAMILY | rock-salt, zaatar | 2 | **2** | yes | ⚠ | Seasonings: rock-salt and zaatar → spice or herb? (「スパイス・薬味」 reads oddly for salt.) |
| HCG-20 | FAMILY | french-fries, mochi | 3 | **1** | yes | ⚠ | Starches (french-fries, mochi): vegetable or other? |
| HCG-11 | ID | カレーソース, curry-ketchup | 2 | **1** | yes |  | カレーソース vs curry-ketchup: one sauce id or two? Is curry-ketchup a spread sauce? |
| HCG-14 | ALIAS | wurstel, スパイシーソーセージ | 2 | **1** | yes |  | Sausage cluster: wurstel (ウインナー) and スパイシーソーセージ → sausage, or own ids? |
| HCG-13 | CONFIRM | プロヴェルチーズ | 1 | **1** | no (existing authority) |  | Register provel as its own cheese id (not provolone). |
| HCG-22 | ALIAS | red-cabbage | 1 | **1** | yes |  | red-cabbage (紫キャベツ): own id or alias of cabbage? |
| HCG-23 | ALIAS | puntarelle | 1 | **1** | yes |  | puntarelle: own id or alias of chicory? |
| HCG-24 | ID | fennel | 1 | **1** | yes |  | フェンネル: bulb (vegetable) or seed / frond (spice / herb)? |
| HCG-27 | CONFIRM | truffle | 1 | **1** | no (existing authority) |  | Confirm truffle = vegetable (mushroom identity); its post-bake use is timing, not taxonomy. |
| HCG-28 | ID | ナッツ | 1 | **1** | yes |  | Generic ナッツ (nutella dessert): which id? (family other is DH4-1's rule for nuts) |
| HCG-05 | ID | 唐辛子, 赤唐辛子, 青唐辛子 | 7 | **0** | yes |  | 唐辛子 / 赤唐辛子 / 青唐辛子 → one new chili-pepper id, or colour variants? (Never chili-oil.) |
| HCG-19 | FAMILY | natto, baked-beans | 2 | **0** | yes |  | Legumes (natto, baked-beans): vegetable or other? |
| HCG-03 | ID | 肉 | 1 | **0** | yes |  | Generic 肉 in swedish-kebab-pizza: which meat id? |
| HCG-08 | ALIAS | 青のり | 1 | **0** | yes |  | 青のり → nori (alias), or its own id? |
| HCG-12 | ID | チーズソース | 1 | **0** | yes |  | チーズソース: register a new cheese-sauce id (category sauce)? |
| HCG-26 | ALIAS | mentaiko | 1 | **0** | yes |  | mentaiko (明太子) vs cod-roe (たらこ): two ids or one? |
| HCG-29 | FAMILY | bonito-flakes | 1 | **0** | yes |  | bonito-flakes (かつお節): seafood or spice (薬味)? |
| HCG-30 | CONFIRM | kebab-sauce | 1 | **0** | no (existing authority) |  | Confirm kebab-sauce = sauce (no hint family). |
| HCG-31 | ALIAS | spicy-salami | 1 | **0** | yes |  | spicy-salami (サラミピカンテ): own id, or a variant of salami? |

The options, the existing authority and the new-family notes are listed in Appendix A.

## 7. The minimal Owner Decision set and the F forecast

Method:
- The 4 CONFIRM items are taken first; they need no Owner judgment.
- Then a greedy search runs, with pair lookahead, so that an ID + FAMILY pair such as HCG-05 + HCG-06 counts as one bundle.
- Each step picks the Owner decision (or bundle) that releases the most F rows per decision.

| Owner decisions | Added | F remaining |
|---:|---|---:|
| 0 | HCG-01, HCG-13, HCG-27, HCG-30 | 58 |
| 1 | HCG-15 | 53 |
| 2 | HCG-16 | 49 |
| 3 | HCG-04 (bundle HCG-04 + HCG-18) | 46 |
| 4 | HCG-18 (bundle HCG-04 + HCG-18) | 42 |
| 5 | HCG-17 | 38 |
| 6 | HCG-02 | 35 |
| 7 | HCG-05 (bundle HCG-05 + HCG-06) | 35 |
| 8 | HCG-06 (bundle HCG-05 + HCG-06) | 27 |
| 9 | HCG-09 | 24 |
| 10 | HCG-25 | 22 |
| 11 | HCG-21 | 20 |
| 12 | HCG-20 | 18 |
| 13 | HCG-10 | 16 |
| 14 | HCG-07 | 14 |
| 15 | HCG-19 | 12 |
| 16 | HCG-11 (bundle HCG-11 + HCG-14) | 11 |
| 17 | HCG-14 (bundle HCG-11 + HCG-14) | 9 |
| 18 | HCG-31 | 8 |
| 19 | HCG-28 | 7 |
| 20 | HCG-26 | 6 |
| 21 | HCG-24 | 5 |
| 22 | HCG-23 | 4 |
| 23 | HCG-22 | 3 |
| 24 | HCG-12 | 2 |
| 25 | HCG-03 | 1 |
| 26 | HCG-08 (bundle HCG-08 + HCG-29) | 1 |
| 27 | HCG-29 (bundle HCG-08 + HCG-29) | 0 |

**Reading:**
- **0 Owner decisions (confirm only): F 65 → 58.**
- **5 Owner decisions** (HCG-15 condiments, HCG-16 dairy, HCG-04 green-onion, HCG-18 prepared, HCG-17 pickled): **F → 38**.
- **9 Owner decisions** (+ HCG-02 ひき肉, HCG-05 + 06 chili, HCG-09 generic チーズ): **F → 24**, a 63 % reduction.
- **15 Owner decisions: F → 12.**
- Clearing F completely needs **27 Owner decisions + 4 confirms**. The long tail is single-row items.

The Matrix-style "top 10 decisions" (confirm HCG-01 + 9 Owner decisions) gives **F 65 → 26** (39 released).

**Leaving F is not the same as shipping.**
- Of the 39 rows released by the top 10, the next primary class is **E 19 / D 4 / C 7 / B 9**.
- If all 65 F rows clear: **E 33 / D 6 / C 14 / B 12**.
- Most rows then wait on OD-AM-2 / 3 (sauce base, composition), not on taxonomy.

## 8. Owner Decision queue and STOP conditions

Every non-CONFIRM decision is an Owner / HCG decision (27). They are grouped by what they settle:
- **ID / alias (the canonicalizer tables):** HCG-02, 03, 05, 08, 09, 10, 11, 12, 14, 18, 22, 23, 24, 26, 28, 31.
- **Category first (a family only afterwards):** HCG-15 condiments and HCG-16 dairy.
  - HCG-18 prepared foods also settles category.
- **Family (inside the 7):** HCG-04, 06, 07, 17, 19, 20, 21, 25, 29.

**The confirms (existing authority; HCG signs off):**
- HCG-01 beef = meat (registry);
- HCG-13 provel = its own cheese (AMBIGUOUS_TABLE says "explicitly NOT the same cheese");
- HCG-27 truffle = vegetable (OD-TAX-6 + OD-DH4-4);
- HCG-30 kebab-sauce = sauce (TAXONOMY_FLAGS `sauce_not_topping`).

**STOP → Owner Decision (a new family)** applies **only** if the Owner rejects every in-7 option of HCG-07 (海藻), HCG-15 (調味料), HCG-16 (乳製品), HCG-20 (でんぷん) or HCG-25 (調味料). This pack does **not** find such a need. Each of these has a coherent in-7 option.

**Guard against "その他 laundering":**
- `other` appears as an option only in these cases:
  - where DH4-1's own header already places that kind of ingredient there (nuts, sweets);
  - as one **explicit** option among several (seaweed, starch, legume, dairy).
- No item defaults to `other`.
- A family never unblocks an item whose category is open. HCG-15 / 16 / 18 must settle the category first.

**Not this lane's to decide (recorded only):**
- recipe key topping, sub-topping order, Cooking Steps and Technique enablement;
- OD-AM-1..5 and OD-AM-7..9.

## 9. Production eligibility gate: input specification

A taxonomy row may enter production (`src/data/ingredientTaxonomy.ts` plus `src/data/ingredients.ts`) **only** through a PR whose HCG record, per ingredient, carries:

| Field | Required value |
|---|---|
| `rawLabels[]` | Every PIZZA DB label that maps to the id, via canonicalizer table entries (with their justification comments), never fuzzy matching |
| `canonicalId` | Unique. Not an alias of another runtime id (INV-T7). |
| `category` | Decided and recorded **before** the family |
| `family` | Exactly one of the 7 (toppings only). `null` for a sauce or cheese. |
| `hcgDecision` | The HCG-xx id + the Owner decision date, or `CONFIRM` + the authority cited |
| `newFamily` | Always `false`. `true` is impossible without an Owner Decision amending OD-TAX-2. |

**The gates that consume it** already exist or are designed:
- G1 / INV-T1 (every topping has a family);
- G24 / INV-T2 (unique rows, toppings only);
- G22 / INV-T3 (recipe ids exist);
- G18 (the emoji / label safety check);
- the 172 fixture gate (G16).

A row is **never** added with a PROPOSED family that no HCG has decided. A missing row fails CI; it is never coarsened to existence, category, group or `other`.

## 10. Effect on DA-1

DA-1 (the Matrix §11) is the authority pack for the **17 B-primary rows**.
- **None of those 17 rows is in F**, so DA-1 does not wait on this HCG.
- DA-1's taxonomy input is "taxonomy rows after HCG" (PROPOSED families, B class), which is a separate queue from the 54 F items here.
- **If this HCG runs, DA-1 can grow.**
  - The top 10 decisions move **9 more rows to B-primary**: cuban, peking-duck, baiana, chilena, overload, sichuan-eggplant, thai-chicken, vegan-cashew-cheese and yuzu-shrimp.
  - Clearing all of F moves **12** (the 9 above + curry-pizza-japan, currywurst and moussaka-style).
  - These would be a **DA-1b** follow-up, not a change to DA-1's current scope.

## 11. Next Taxonomy phase (recommended)

1. **HCG-0 (confirm pass, no Owner judgment):** sign off HCG-01 / 13 / 27 / 30 → F 58.
2. **HCG-1 (Owner, 9 decisions, the top of §7):** HCG-15, 16, 04, 18, 17, 02, 05 + 06, 09 → F 24.
   - Record the answers in the canonicalizer tables and in a new HCG ledger (docs).
   - They still do not go into production rows.
3. **HCG-2 (tail, 18 decisions)** → F 0.
4. **Production rows** only when a recipe that needs them is authored (DA-1 / DA-1b / waves), in the same PR, and through the §9 record and the T-COV gates.

## Appendix A — Decision options and authority

| Id | Question | Options (none chosen) | Existing authority | New-family note |
|---|---|---|---|---|
| HCG-01 | Confirm beef (牛肉) as its own topping id, family meat. | beef = own id, meat (canonicalizer GENUINELY_NEW_REGISTRY 牛肉→beef, Phase 0B.1) | GENUINELY_NEW_REGISTRY['牛肉']='beef'; every related id (steak, ground-beef) is meat, so the steak / ground-beef relation cannot change the family | – |
| HCG-02 | ひき肉 → ground-beef, or a new generic ground-meat id? (ground-beef has no Japanese name evidence of its own.) | ひき肉 = ground-beef (gives ground-beef its name evidence)<br>new id ground-meat (pork / mixed allowed); ground-beef stays taco-only | AMBIGUOUS_TABLE['ひき肉'] (never auto-resolved); family meat either way | – |
| HCG-03 | Generic 肉 in swedish-kebab-pizza: which meat id? | an existing id (beef / pork / chicken / lamb)<br>new id kebab-meat<br>leave the row blocked | AMBIGUOUS_TABLE['肉'] generic_unspecified; family meat either way | – |
| HCG-04 | green-onion (青ねぎ / 万能ねぎ): vegetable or spice (薬味)? | vegetable (PR #255 proposal, vegetable.allium)<br>spice (スパイス・薬味, as a garnish) | PR #255 NEEDS_REVIEW; related runtime boundary: garlic (herb) is also OD-TAX-7 | – |
| HCG-05 | 唐辛子 / 赤唐辛子 / 青唐辛子 → one new chili-pepper id, or colour variants? (Never chili-oil.) | one id chili-pepper (colour is presentation)<br>two ids red-chili / green-chili (+ 唐辛子 = red-chili) | AMBIGUOUS_TABLE keeps all three distinct from chili-oil (a sauce) | – |
| HCG-06 | Fresh chili peppers (唐辛子 tokens, jalapeno, aji-amarillo): spice or vegetable? | spice (PR #255 proposal spice.chili)<br>vegetable (sliced fresh pepper) | PR #255 NEEDS_REVIEW (jalapeno, aji-amarillo); the tokens' indicative family is spice | – |
| HCG-07 | Seaweed (nori, and 青のり if it becomes an id): seafood, spice (薬味) or other? | seafood<br>spice (as a garnish)<br>other (PR #255 proposal other.seaweed) | PR #255 NEEDS_REVIEW (low): 'Seaweed is not 魚介 in everyday Japanese' | A 海藻 family would be a label ≈ name (のり) (PR #255 §8). If none of the 3 options is acceptable → STOP, Owner Decision (new family). |
| HCG-08 | 青のり → nori (alias), or its own id? | alias of nori<br>own id aonori (same family as nori, HCG-07) | AMBIGUOUS_TABLE['青のり'] ('related but distinct'); family follows HCG-07 either way | – |
| HCG-09 | Generic チーズ (3 rows): which cheese id per row? | per row, an existing cheese id (mozzarella is NOT a default)<br>leave the rows blocked | AMBIGUOUS_TABLE['チーズ'] generic_unspecified; category cheese, so no hint family is needed | – |
| HCG-10 | ホワイトソース → fromage-blanc-sauce, or a new white-sauce id? | fromage-blanc-sauce<br>new id white-sauce (béchamel) | AMBIGUOUS_TABLE['ホワイトソース'] (sauce_not_topping); category sauce, no hint family | – |
| HCG-11 | カレーソース vs curry-ketchup: one sauce id or two? Is curry-ketchup a spread sauce? | カレーソース = curry-ketchup (sauce)<br>new id curry-sauce; curry-ketchup stays (sauce) | AMBIGUOUS_TABLE['カレーソース']; TAXONOMY_FLAGS カレーケチャップソース = sauce_not_topping | – |
| HCG-12 | チーズソース: register a new cheese-sauce id (category sauce)? | new id cheese-sauce (sauce)<br>leave the row blocked | AMBIGUOUS_TABLE['チーズソース'] says: a SAUCE, not merged into any cheese id | – |
| HCG-13 | Register provel as its own cheese id (not provolone). | provel = own id, category cheese | AMBIGUOUS_TABLE['プロヴェルチーズ']: 'explicitly NOT the same cheese, kept separate' | – |
| HCG-14 | Sausage cluster: wurstel (ウインナー) and スパイシーソーセージ → sausage, or own ids? | both alias sausage (runtime id, already meat)<br>wurstel own id; スパイシーソーセージ → sausage<br>both own ids (meat) | AMBIGUOUS_TABLE['スパイシーソーセージ']; PR #255 NEEDS_REVIEW wurstel; family meat either way | – |
| HCG-15 | Condiments: spread sauce, or topping (then family spice)? Decide category first. | sauce (spread; no hint family)<br>topping → spice (スパイス・薬味) | TAXONOMY_FLAGS sauce_or_condiment (mustard, yuzu-kosho, balsamic, chutney, 溶かしバター); false_friend_not_meat (梅肉); PR #255 NEEDS_REVIEW | A 調味料 family would be new (PR #293 NF-2). If neither option is acceptable → STOP. |
| HCG-16 | Creamy dairy: cheese (no hint family) or topping? sour-cream / condensed-milk may also be a spread sauce. | catupiry, cashew-cheese = cheese; sour-cream = sauce<br>sour-cream = topping → other (dairy, explicit)<br>cashew-cheese = topping → other (nut-seed, explicit) | PR #255 NEEDS_REVIEW (cheese vs dairy) | 乳製品 is not one of the 7 (PR #255 §9: 'do not use'). A topping outcome must pick `other` explicitly, not by default. |
| HCG-17 | Pickled / fermented vegetables: vegetable or spice (薬味)? | vegetable (PR #255 proposal vegetable.pickled)<br>spice | PR #255 NEEDS_REVIEW | – |
| HCG-18 | Prepared / composite foods: accept as ingredient ids (family of the main ingredient), re-canonicalize, or exclude? | accept: chicken-tikka / peking-duck / hot-dog / liver-pate = meat, baked-beans = vegetable<br>re-canonicalize (e.g. hot-dog → sausage, peking-duck → duck)<br>liver-pate = spread sauce | TAXONOMY_FLAGS prepared_dish_composite (chicken-tikka, hot-dog, peking-duck); PR #255 NEEDS_REVIEW | – |
| HCG-19 | Legumes (natto, baked-beans): vegetable or other? | vegetable (PR #255 proposal vegetable.legume)<br>other (explicit) | PR #255 NEEDS_REVIEW | – |
| HCG-20 | Starches (french-fries, mochi): vegetable or other? | french-fries = vegetable (potato is vegetable at runtime)<br>other (explicit; DH4-1 puts sweets in other) | PR #255 NEEDS_REVIEW (other.starch proposal); runtime potato = vegetable | A 主食・でんぷん family would be new. If neither option is acceptable → STOP. |
| HCG-21 | avocado: vegetable or fruit? | vegetable (PR #255 proposal)<br>fruit | PR #255 NEEDS_REVIEW | – |
| HCG-22 | red-cabbage (紫キャベツ): own id or alias of cabbage? | own id<br>alias of cabbage | PR #255 NEEDS_REVIEW; vegetable either way | – |
| HCG-23 | puntarelle: own id or alias of chicory? | own id<br>alias of chicory | PR #255 NEEDS_REVIEW; vegetable either way | – |
| HCG-24 | フェンネル: bulb (vegetable) or seed / frond (spice / herb)? | fennel bulb, vegetable<br>fennel seed, spice<br>fennel frond, herb | PR #255 NEEDS_REVIEW (the evidence names only フェンネル) | – |
| HCG-25 | Seasonings: rock-salt and zaatar → spice or herb? (「スパイス・薬味」 reads oddly for salt.) | both spice<br>zaatar herb, rock-salt spice | PR #255 NEEDS_REVIEW | A 調味料 family would be new. Label copy is OD-H5-C4b's, not a family question. |
| HCG-26 | mentaiko (明太子) vs cod-roe (たらこ): two ids or one? | two ids (seafood)<br>mentaiko alias of cod-roe | PR #255 NEEDS_REVIEW; seafood either way | – |
| HCG-27 | Confirm truffle = vegetable (mushroom identity); its post-bake use is timing, not taxonomy. | vegetable | OD-TAX-6 (identity ≠ timing) + OD-DH4-4 (mushrooms fold into vegetable); catalog category topping | – |
| HCG-28 | Generic ナッツ (nutella dessert): which id? (family other is DH4-1's rule for nuts) | an existing nut id (walnut / almond)<br>new id hazelnut<br>new generic id nuts | AMBIGUOUS_TABLE['ナッツ'] generic_unspecified; DH4-1 header: nuts share `other` | – |
| HCG-29 | bonito-flakes (かつお節): seafood or spice (薬味)? | seafood (PR #255 proposal)<br>spice (as a garnish) | PR #255 NEEDS_REVIEW (seafood / seaweed bucket) | – |
| HCG-30 | Confirm kebab-sauce = sauce (no hint family). | sauce | TAXONOMY_FLAGS['ケバブソース'] = sauce_not_topping; 172 spread-layer list | – |
| HCG-31 | spicy-salami (サラミピカンテ): own id, or a variant of salami? | own id (catalog, used by diavola)<br>alias of salami | LIKELY_ALIAS_TABLE['サラミピカンテ']='spicy-salami' (distinct from plain salami); meat either way | – |

## Appendix B — The 65 F rows

Column key:
- **Other classes** = the row's other Matrix classes.
- **Next** = the primary class once F clears.

| Row | Name | F blockers | Decisions needed | Other classes | Next |
|---|---|---|---|---|---|
| `banh-mi-pizza-pizzadb-p6` | バインミーピザ | liver-pate | HCG-18 | EB | E |
| `black-truffle-pizza-pizzadb-p14` | 黒トリュフピザ | truffle | HCG-27 | ECB | E |
| `brazilian-catupiry-corn-pizza-pizzadb-p10` | ブラジリアンカトゥピリコーンピザ | catupiry | HCG-16 | CB | C |
| `breakfast-pizza-pizzadb-p11` | ブレックファーストピザ | ホワイトソース | HCG-10 | EB | E |
| `bulgogi-pizza-pizzadb-p11` | プルコギピザ | beef | HCG-01 | EB | E |
| `california-style-pizza-pizzadb-p2` | カリフォルニアスタイルピザ | avocado | HCG-21 | CB | C |
| `chicken-tikka-pizza-pizzadb-p5` | チキンティッカピザ | chicken-tikka | HCG-18 | EB | E |
| `cuban-pizza-pizzadb-p2` | キューバンピザ | mustard, pickles | HCG-15, HCG-17 | B | B |
| `curry-pizza-japan-pizzadb-p2` | カレーピザ | カレーソース | HCG-11 | B | B |
| `currywurst-pizzadb` | カリーヴルストピザ | curry-ketchup, wurstel | HCG-11, HCG-14, HCG-15 | B | B |
| `diavola-pizza-pizzadb-p5` | ディアボラ | spicy-salami, 唐辛子 | HCG-05, HCG-06, HCG-31 | EB | E |
| `eel-pizza-pizzadb-p1` | うなぎピザ | green-onion | HCG-04 | EB | E |
| `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | condensed-milk, melted-butter, ひき肉 | HCG-02, HCG-15, HCG-16 | EDB | E |
| `focaccia-genovese-pizzadb-p10` | フォカッチャジェノヴェーゼ | rock-salt | HCG-25 | ECB | E |
| `frango-catupiry-pizzadb-p10` | フランゴ・コン・カトゥピリ | catupiry | HCG-16 | CB | C |
| `full-english-pizza-pizzadb-p10` | フルイングリッシュピザ | baked-beans | HCG-18, HCG-19 | CB | C |
| `goulash-pizza-pizzadb-p3` | グヤーシュピザ | beef, sour-cream | HCG-01, HCG-16 | EB | E |
| `hokkaido-cheese-pizza-pizzadb-p15` | 北海道チーズピザ | チーズ | HCG-09 | CB | C |
| `jalapeno-popper-pizza-pizzadb-p7` | ハラペーニョポッパーピザ | jalapeno | HCG-06 | CB | C |
| `keema-pizza-pizzadb-p2` | キーマピザ | ひき肉, 青唐辛子 | HCG-02, HCG-05, HCG-06 | EB | E |
| `kimchi-pizza-pizzadb-p2` | キムチピザ | green-onion, kimchi | HCG-04, HCG-17 | EDB | E |
| `lahmacun` | ラフマジュン | ひき肉, 唐辛子 | HCG-02, HCG-05, HCG-06 | EDCB | E |
| `manakish` | マナキーシュ | zaatar | HCG-25 | CB | C |
| `meat-lovers-pizza-pizzadb-p13` | ミートラバーズピザ | beef | HCG-01 | EB | E |
| `mentaiko-cream-pizza-pizzadb-p4` | たらこクリームピザ | nori | HCG-07 | DB | D |
| `mentaiko-mochi-pizza` | 明太子もちピザ | mentaiko, mochi, nori | HCG-07, HCG-20, HCG-26 | EB | E |
| `moussaka-style-pizza-pizzadb-p13` | ムサカ風ピザ | ホワイトソース | HCG-10 | B | B |
| `nashville-hot-chicken-pizza-pizzadb-p6` | ナッシュビルホットチキンピザ | pickles | HCG-17 | EB | E |
| `natto-pizza` | 納豆ピザ | green-onion, natto, nori | HCG-04, HCG-07, HCG-19 | EDB | E |
| `nigerian-suya-pizza-pizzadb-p5` | ナイジェリアンスヤピザ | beef | HCG-01 | EB | E |
| `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | ナッツ | HCG-28 | ECB | E |
| `okonomiyaki-style-pizza-pizzadb-p1` | お好み焼き風ピザ | bonito-flakes, 青のり | HCG-07, HCG-08, HCG-29 | DB | D |
| `old-forge-style-pizza-pizzadb-p1` | オールドフォージスタイルピザ | チーズ | HCG-09 | DCB | D |
| `peking-duck-pizza` | 北京ダックピザ | green-onion, peking-duck | HCG-04, HCG-18 | B | B |
| `peruvian-aji-amarillo-pizzadb-p12` | ペルーアヒアマリージョピザ | aji-amarillo | HCG-06 | EB | E |
| `philly-cheesesteak-pizza-pizzadb-p9` | フィリーチーズステーキピザ | beef, チーズソース | HCG-01, HCG-12 | CB | C |
| `pizza-baiana` | ピッツァ・バイアーナ | 唐辛子 | HCG-05, HCG-06 | B | B |
| `pizza-cavolo-carote-pizzadb-p8` | ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ | red-cabbage | HCG-22 | ECB | E |
| `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | ひき肉 | HCG-02 | B | B |
| `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | 唐辛子 | HCG-05, HCG-06 | ECB | E |
| `pizza-de-cancha` | ピッツァ・デ・カンチャ | 唐辛子 | HCG-05, HCG-06 | DCB | D |
| `pizza-de-lomo-saltado` | ロモ・サルタード・ピザ | beef, french-fries | HCG-01, HCG-20 | EDB | E |
| `pizza-finocchi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・フィノッキ | fennel | HCG-24 | ECB | E |
| `pizza-overload-pizzadb-p7` | ピザオーバーロード | hot-dog | HCG-18 | B | B |
| `pizza-puntarelle-pizzadb-p8` | ピッツァ・コン・プンタレッレ | puntarelle | HCG-23 | ECB | E |
| `pizza-radicchio-noci-pizzadb-p8` | ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ | balsamic-vinegar | HCG-15 | EDCB | E |
| `polish-kielbasa-pizzadb-p12` | ポーリッシュキエルバサピザ | sauerkraut | HCG-17 | CB | C |
| `poutine-pizza-pizzadb-p10` | プーティンピザ | french-fries | HCG-20 | CB | C |
| `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | スパイシーソーセージ | HCG-14 | CB | C |
| `rendang-pizza-pizzadb-p14` | ルンダンピザ | beef | HCG-01 | EB | E |
| `sichuan-eggplant-pizza` | 四川風ナスピザ | green-onion | HCG-04 | B | B |
| `south-african-boerewors-pizzadb-p14` | 南アフリカボアヴォースピザ | chutney | HCG-15 | EB | E |
| `st-louis-style-pizza-pizzadb-p4` | セントルイススタイルピザ | プロヴェルチーズ | HCG-13 | CB | C |
| `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | kebab-sauce, 肉 | HCG-03, HCG-30 | EB | E |
| `taco-pizza-pizzadb` | タコピザ | ground-beef | HCG-02 | EB | E |
| `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | nori | HCG-07 | ECB | E |
| `thai-chicken-pizza-pizzadb-p4` | タイチキンピザ | 赤唐辛子 | HCG-05, HCG-06 | B | B |
| `tsukimi-pizza-pizzadb-p14` | 月見ピザ | green-onion | HCG-04 | CB | C |
| `turkish-pide-pizzadb-p5` | トルコピデ | ひき肉, チーズ | HCG-02, HCG-09 | DCB | D |
| `ume-shiso-pizza-pizzadb-p14` | 梅しそピザ | umeboshi-paste | HCG-15 | EB | E |
| `vegan-cashew-cheese-pizza-pizzadb-p1` | ヴィーガンカシューチーズピザ | cashew-cheese | HCG-16 | B | B |
| `venezuelan-reina-pepiada-pizzadb-p12` | ベネズエラレイナペピアーダピザ | avocado | HCG-21 | EB | E |
| `wasabi-beef-pizza` | わさび牛ピザ | beef, wasabi | HCG-01, HCG-15 | CB | C |
| `yakiniku-pizza` | 焼肉ピザ | beef | HCG-01 | DB | D |
| `yuzu-shrimp-pizza` | 柚子えびピザ | yuzu-kosho | HCG-15 | B | B |

## Reproduction

```
git fetch origin main claude/172-recipe-ingredient-audit-d33d8i claude/172-recipe-authority-matrix
python3 tools/recipe172_taxonomy_hcg.py          # writes the JSON
python3 tools/recipe172_taxonomy_hcg.py --check  # OK, no drift
```

## Non-goals

This pack makes **none** of these changes:
- to `src/**`, e2e, production ingredients or taxonomy rows;
- a new family;
- to Hint 5.0, TQ or Cooking Steps;
- to PR #255, #293 or #295, or the Matrix branch;
- a merge.

It also makes no Owner Decision.
