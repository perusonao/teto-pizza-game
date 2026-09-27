# Discovery Hint 4.0 — DH4-2 Runtime + U3 UI: Pre-Implementation Fresh Audit

> **Status:** Fresh Audit, docs only (Issue #253).
>
> - No production code, test, CSS, reducer, persistence, pricing or save-schema change.
> - PR #254 (DH4-1) and PR #252 (DM-3R-2) are not touched. PR #251 and PR #243 are not touched. Dinner is not touched.
> - Nothing here is authority until the Owner decides §19.
> - Machine-readable output: `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_PRE-AUDIT.json`. It is produced by `tools/dh4_2_topping_count_audit.py` from `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_RUNTIME-SNAPSHOT.json`.
> - Hint Sheet vertical space (Owner Finding HV-5, §8A): `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_HINT-SHEET-VSPACE.json`, with baseline screenshots in `docs/reports/screenshots/dh4-2-pre-audit/`.
>
> **Verdict: A. DH4-2 DESIGN READY FOR OWNER DECISIONS** (§21)

## 1. Audited main SHA

| Item | Value |
|---|---|
| `origin/main` at session start | `22658f7` (Merge PR #251, H3-4) |
| **`origin/main` at audit close (authority)** | **`5a33d85`** (Merge PR #254, DH4-1), merged at 10:28Z while this audit was running |
| Effect of the move | `5a33d85` adds only the 7 DH4-1 files. Its tree is identical to PR #254's head `057e387`, which this audit had already read. `src/data/recipes.ts`, `ingredients.ts`, `discoveryLadder.ts`, `selectableHint.ts`, `HintSheet.tsx`, `App.css` and `src/state/*` are unchanged between `22658f7` and `5a33d85`. |
| Runtime data | 25 recipes, 29 ingredients, the 24-step W1 Discovery Ladder, the free key and the Rule W reserve per recipe (`buildSelectableHintModel`). They were dumped by a throw-away Vitest probe, which was deleted afterwards (`git status` clean). The snapshot is committed as the audit input. |
| DH4-1 check | The audit tool re-implements `reserveAttributeAnswer` so combinations can be measured. A second throw-away probe compared it with the merged module for 24 targets × {ladder-owned, all-owned}: **48 / 48 identical**. |
| 172 data | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` (172 rows) and `data/recipes/ingredient_master_catalog.json` (62 authored ingredients) |

## 2. GitHub state (fresh)

| Item | State | Used as |
|---|---|---|
| Issue #253 | OPEN. Its slice table still reads 「PR #254 OPEN」 and has no comments. It carries OD-DH4-1…10. | Authority for the DH4 decisions |
| PR #254 (DH4-1) | **MERGED** as `5a33d85`. This session did not touch it. | Authority (pure layer, unwired) |
| PR #252 (DM-3R-2) | OPEN against base `726b0ac`. It is not read beyond its description and is not touched. | Dinner boundary only (§18) |
| PR #251 (H3-4) | MERGED as `22658f7` | Authority for the current sheet copy |
| Pages deploy | Run 194 (`22658f7`) and run 195 (`5a33d85`) succeeded | — |
| Firebase production deploy | `workflow_dispatch` only. The last successful run is **2026-09-21** (`7e5692f`), which predates Hint 3.0 H3-3 and H3-4. | §3 |

## 3. iPhone Human Verification findings

### 3.1 The Owner's four points

| # | Finding | Root cause on `5a33d85` | Addressed in |
|---|---|---|---|
| HV-1 | The player wants to know how many toppings are needed | Only the whole-recipe total exists (`meta:ingredient-total`, OD-DH4-2). No per-category count exists. | §4–§7 |
| HV-2 | At the end, the player wants a kind or attribute, not the name | Already solved in the pure layer (DH4-1 `attr:`), but not wired. §5.4 adds a privacy finding. | §5.4, §15 |
| HV-3 | 「category choice + 0 Pitz CTA」 reads as a guaranteed new fact | The preference radio plus a price-0 CTA promise a category fact | §8–§11 |
| HV-4 | GUIDANCE_ONLY does not match the expectation | The request can end in guidance, but nothing before the tap says so | §12 |
| **HV-5** (Owner Finding, added) | The known-information area is too small. The topping row fades out mid-read. The 知りたいジャンル buttons, the CTA and the Pitz line take more height than the hints themselves. U3 would make this worse. | Measured (§8A): at 390×844 with safe area the known area is **138 px, 36 % of the sheet**. The fixed footer is 132 px plus a 46 px bottom padding. The 2-chip topping row shows 40 of 52 px. At 360×640 with safe area the known area is 46 px and **no row is visible**. | **§8A**, OD-DH4-2-12 |

### 3.2 Which build was verified

The copy described from the iPhone images is:

- legend 「どれのヒントがほしい？」;
- CTA 「ヒントを1つ解除 0 Pitz」.

That is the **H3-3** copy (`d4d558d`). H3-4 (`9b3db21`, merged in `22658f7`) replaced it with:

- 「知りたいジャンル（ないときは別のジャンルから1つ）」;
- 「ヒントを1つもらう {n} Pitz」;
- at price 0: 「ヒントをたずねる」 + 「支払いずみ」, with 「Pitzはヒントが出たときだけ使うよ」;
- after GUIDANCE_ONLY: 「今あるヒントはここまで」.

The H3-4 Fresh Audit had already filed the same problem as **F-1 (High)** and **F-5**.

The Firebase production site was last deployed on 2026-09-21, so it still serves pre-Hint-3.0 or H3-3-era code. The images therefore most likely come from production, or from a cached Preview/PWA, not from `main`.

**Consequence:**

- HV-3 and HV-4 are **partly fixed on `main` already** (H3-4).
- The remaining gap is structural: the category choice still reads as a slot, and the U3 families will multiply this. It is handled in §10–§12.
- Before the DH4-2 UI copy is frozen, the Owner should re-check the sheet on a build at or after `22658f7`: the Pages URL, or a fresh Preview (OD-DH4-2-11).

## 4. Topping-count matrix: 25 runtime recipes

**Notation:**

- **N** = total ingredients.
- **T** = topping total.
- **Hyps** = the reserve candidates a smart player still has at the endgame (key plus every sellable fact known), with the ladder-owned inventory.
- **A** = the DH4-1 attribute answer.
- The last column is the mean information value of T, given N, over every reachable mid-game state.

| # | Recipe | N | T | Cheese | Key | Rule W reserve | Hyps: N → N+T | N+A → N+T+A | N+T names the reserve? | Mid-game bits T\|N |
|---:|---|---:|---:|---:|---|---|---|---|---|---:|
| 1 | ビスマルク | 3 | 1 | 1 | たまご | モッツァレラ（チーズ） | 2 → 1 | 2 → 1 | **YES** (ladder) | 1.0 |
| 2 | ブレックファストピザ | 4 | 2 | 1 | ベーコン | たまご（トッピング） | 2 → 2 | 2 → 2 | no | 0.39 |
| 3 | フンギ | 3 | 1 | 1 | マッシュルーム | モッツァレラ（チーズ） | 4 → 1 | 4 → 1 | **YES** (ladder) | 2.0 |
| 4 | メランザーネピザ | 4 | 2 | 1 | ナス | バジル（トッピング） | 4 → 4 | 4 → 4 | no | 0.88 |
| 5 | パルミジャーナピザ | 5 | 2 | 2 | パルミジャーノ | バジル（トッピング） | 4 → 4 | 4 → 4 | no | 0.66 |
| 6 | ペパロニ | 3 | 1 | 1 | ペパロニ | モッツァレラ（チーズ） | 7 → 2 | 2 → 2 | no | 1.81 |
| 7 | サルシッチャ | 3 | 1 | 1 | ソーセージ | モッツァレラ（チーズ） | 8 → 2 | 2 → 2 | no | 2.0 |
| 8 | ミートラヴァーズ | 6 | 4 | 1 | ハム | ソーセージ（トッピング） | 6 → 5 | 5 → 5 | no | 0.75 |
| 9 | バンビーノ | 4 | 2 | 1 | コーン | ハム（トッピング） | 9 → 8 | 4 → 4 | no | 1.05 |
| 10 | ハワイアンピザ | 4 | 2 | 1 | パイナップル | ハム（トッピング） | 10 → 9 | 4 → 4 | no | 1.12 |
| 11 | カプリチョーザ | 6 | 4 | 1 | オレガノ | ブラックオリーブ（トッピング） | 10 → 9 | 3 → 3 | no | 0.87 |
| 12 | ピッツァ・ポルトゲーザ | 6 | 4 | 1 | たまねぎ | ブラックオリーブ（トッピング） | 11 → 10 | 4 → 4 | no | 0.91 |
| 13 | フガッサ | 3 | 2 | 0 | オリーブオイル | オレガノ（トッピング） | 14 → 12 | 2 → 2 | no | 0.43 |
| 14 | マリナーラ | 3 | 2 | 0 | にんにく | オレガノ（トッピング） | 15 → 13 | 2 → 2 | no | 0.21 |
| 15 | ナポリ | 4 | 2 | 1 | アンチョビ | オレガノ（トッピング） | 15 → 14 | 3 → 3 | no | 1.43 |
| 16 | トンノ・エ・チポッラ | 4 | 2 | 1 | ツナ | たまねぎ（トッピング） | 16 → 15 | 5 → 5 | no | 1.48 |
| 17 | ペストトンノピザ | 4 | 3 | 0 | ジェノベーゼソース | たまねぎ（トッピング） | 16 → 14 | 4 → 4 | no | 0.46 |
| 18 | ジェノベーゼ | 3 | 1 | 1 | チェリートマト | モッツァレラ（チーズ） | 18 → 2 | 2 → 2 | no | 3.17 |
| 19 | ニューヘイブンアピッツァ | 4 | 2 | 1 | あさり | にんにく（トッピング） | 18 → 17 | 3 → 3 | no | 1.58 |
| 20 | ペストカプレーゼピザ | 4 | 2 | 1 | トマト | バジル（トッピング） | 19 → 18 | 3 → 3 | no | 1.63 |
| 21 | ペストパターテピザ | 4 | 2 | 1 | じゃがいも | ベーコン（トッピング） | 20 → 19 | 4 → 4 | no | 1.67 |
| 22 | ピッツァ・ビアンカ | 2 | 1 | 0 | ローズマリー | オリーブオイル（ソース） | 3 → 3 | 3 → 3 | no | — (no mid-game state) |
| 23 | プッタネスカ | 5 | 4 | 0 | ケッパー | にんにく（トッピング） | 21 → 19 | 4 → 4 | no | 0.3 |
| 24 | クアトロ フォルマッジ | 5 | **0** | 4 | ゴルゴンゾーラ | フォンティーナ（チーズ） | 23 → **1** | 23 → **1** | **YES** (ladder **and** all owned) | 8.62 |

### 4.1 Distributions (JSON `distributions`)

**Topping total T over the 25 recipes:**

| T | Recipes |
|---:|---:|
| 0 | 1 (quattro-formaggi) |
| 1 | 7 |
| 2 | 12 |
| 3 | 1 |
| 4 | 4 |

**Total and structure:**

- N: 2 → 1 · 3 → 8 · 4 → 10 · 5 → 3 · 6 → 3.
- **Every recipe has exactly one sauce.** So 「のせる材料」 (cheese + topping) = N − 1: no new information (§7).
- Cheese = 0 in 5 recipes. Those are the recipes where a per-category count would be a negative fact.

**Recipes by (N, T):**

| (N, T) | Recipes |
|---|---|
| (2, 1) | pizza-bianca |
| (3, 1) | margherita, bismarck, funghi, pepperoni, salsiccia, genovese |
| (3, 2) | fugazza, marinara |
| (4, 2) | 9 recipes |
| (4, 3) | pesto-tonno |
| (5, 0) | quattro-formaggi |
| (5, 2) | parmigiana-pizza |
| (5, 4) | puttanesca |
| (6, 4) | meat-lovers, capricciosa, pizza-portuguesa |

**Recipe candidates (24 targets):**

- N alone gives 5 classes: the largest holds 10 and 1 is unique.
- N + T gives 9 classes: the largest holds 9 and 5 are unique.
- The free key alone is already unique for all 24 targets, and with the deterministic ladder the makeable-undiscovered count is 1 at every step (JSON `makeableCandidatesFresh`).
- **Recipe identity is therefore not the live risk.** The risk is at the ingredient level, as the Fresh Design §5 found.

### 4.2 Combination audit: which facts name something (JSON `combinationSummary`)

**Player model (worst case):**

- The player knows the free key and the facts they bought.
- They assume "exactly one sauce", which holds for all 25 and is visible in the Dex.
- An ingredient is **named** when it lies in every hypothesis consistent with the facts.
- **N stands for "N bought, or near-miss ADD_ONE seen on a pizza made of exactly the known facts".** The two give the same closure, and ADD_ONE is free (§17).

Every reachable purchase state was enumerated: each per-category prefix of the sellable facts, 1–12 states per recipe.

| Facts held | The Rule W reserve becomes named (ladder owned) | Same (all 29 owned) | An unbought material fact becomes newly named |
|---|---|---|---|
| none / N / A / N+A | 0 | 0 | 0 |
| T | 0 | 0 | 0 |
| **N+T** | **3: bismarck, funghi, quattro-formaggi** | **1: quattro-formaggi** | 4: breakfast, melanzane, parmigiana (mozzarella), quattro |
| **T+A** | 3 (the same) | 1 | 0 |
| N+T+A | 3 | 1 | 4 |

**How to read it:**

- The baseline (no hint) already names the sauce in 12 recipes, because tomato sauce is the only owned sauce until step 13. That is not a hint effect and is excluded from the "newly" column.
- **N+T breaks Rule W** in exactly the 3 recipes where DH4-1 deliberately answered only `existence`, because the reserve's category held one owned ingredient. The topping total reveals the reserve's category (topping vs not) through closure. That bypasses the k ≥ 2 guard DH4-1 was built for.
- quattro-formaggi is broken at **every** inventory: the runtime catalog has only 4 cheeses, all in that recipe.
- The 「mozzarella newly named」 cases are PAID INFERENCE that stands in for an unbought material fact. That is an economy concern (a cheaper route to a starter), not a privacy one.

### 4.3 Information value (JSON `informationValue`)

| Measure | Endgame (only the reserve unknown) | Mid-game (every other reachable state) |
|---|---:|---:|
| T given N | 0.69 bits (all from the 3 leaking recipes) | **1.50 bits** (1.18 without quattro's T=0 outlier) |
| A given N | 1.44 bits | 1.14 bits |
| T given N + A | **0 bits, except 1.0 / 2.0 / 4.52 in the 3 leaking recipes** | 1.29 bits |

**Key result:**

- **At the endgame (the Owner's "last hint" moment), a topping count adds nothing over total + attribute, except where it names the reserve.**
- Its real value is in the **mid-game**: how many toppings are still missing. That is exactly HV-1.

## 5. Topping-count privacy analysis

### 5.1 The candidate facts

| | A 「トッピングは全部で○種類」 | B 「トッピングを○種類使う」 | C 「具材を○種類使う」 | D the total only (today) |
|---|---|---|---|---|
| Information | T | T | Ambiguous: T, or cheese + topping (= N − 1 at runtime, §7) | N |
| T = 0 (quattro-formaggi 1/24; 5/172) | 「全部で0種類」: an **explicit negative**, forbidden by OD-DH4-2 | 「0種類使う」: unnatural, and still negative | Same as A if it means toppings | never 0 |
| Names the reserve (N+T or T+A) | 3/24 ladder, 1/24 all owned | same | same if it means toppings | 0 |
| FREE LEAK if 0 is withheld | Yes: offering the fact only for T ≥ 1 marks quattro-formaggi before payment | same | same | none (uniform) |
| As a second 構成 fact (N then T) | For T = 0, the second request would end in GUIDANCE_ONLY: a **free** negative | same | same | — |

**No raw form (A, B or C) is acceptable.** Each one sells a negative for T = 0, or leaks it for free, and each names the reserve in 3 recipes.

### 5.2 TC-G: a guarded topping count (proposal)

**The answer:**

- One **構成** answer per recipe: 「このピザは全部で○種類の材料を使うよ。トッピングは○種類だよ」.
- The topping clause is present **only when the TC-G guard passes**. Otherwise the answer is the total alone.

**The guard (inversion-safe, the same idea as §5.4):**

- Let W = the reserve + every **owned** ingredient not in the recipe (the DH4-1 privacy worst case).
- The guard passes iff T ≥ 1 **and** every category side present in W (topping / cheese / sauce under the one-sauce prior) holds at least 2 members of W.
- W is the same set for every hypothetical reserve, so the fallback itself says nothing about which unknown it is.

**Results (JSON `inversionSafeProposal`):**

| Inventory | Guard passes | Falls back |
|---|---|---|
| Ladder-owned | 11 / 24 | the rest |
| All owned (the Owner's late-game case) | **23 / 24** | only quattro-formaggi |

**Leak check:**

- Name-equivalent cases after a guard-aware inversion: **0**, at both inventories.
- T = 0 is never stated.
- Uniform before payment: the 構成 control is the same for every target and is single-shot.

**Monotonic:** W only grows with ownership, so a passed guard stays passed.

**Cost:**

- Early in the ladder, the Owner's topping number is often withheld: cheese-side singletons, since mozzarella is the only cheese until step 5 and parmigiano the only decoy after that.
- This is the same structural early-inventory limit as the Fresh Design §8. **Not a bug; the price of never naming the reserve.**

### 5.3 FREE LEAK vs PAID INFERENCE (topping count)

| Mechanism | Class | Verdict |
|---|---|---|
| A 構成 control shown for every target, single-shot, at a uniform price | — | OK |
| Topping clause shown or absent after payment (TC-G) | PAID INFERENCE. The level is inversion-safe. | OK |
| A 「0種類」 statement | Sold negative | Forbidden (OD-DH4-2) |
| Topping fact offered only when T ≥ 1 | FREE LEAK | Forbidden |
| The second 構成 request ends in GUIDANCE_ONLY only for T = 0 | Free negative (interaction) | Forbidden |
| Closure 「全部で5・トッピング2・チップ2」 ⇒ no more toppings | PAID INFERENCE | Allowed (OD-H3-16) |
| Near-miss ADD_ONE (free) + T (paid) ⇒ N+T | PAID INFERENCE, but it gives the N+T leak for free-plus-T | Why the guard must assume N is known |

### 5.4 A new finding about the merged DH4-1: the answer *level* can be inverted

The merged DH4-1 guard picks the level from the reserve's own class:

- family, then group, then category, then existence;
- the first level whose class holds at least 2 owned ingredients outside the recipe.

A player who knows this rule, and who holds N (or has seen a free ADD_ONE), can test each remaining owned ingredient: "if it were the reserve, would the answer have been this level?"

JSON `guardAwareNameEquivalent_A`: the reserve is then **named** in:

| Recipe | Inventory | Observed answer | Why |
|---|---|---|---|
| funghi | ladder | `existence` | Every topping candidate would have produced `category:topping`, so only mozzarella fits |
| quattro-formaggi | ladder, all owned | `existence` | Only fontina fits |
| breakfast-pizza | all owned | `category:topping` | Only たまご has singleton family *and* group (その他) |
| meat-lovers | all owned | `group:protein` | Only a meat whose family is exhausted fits: ソーセージ |

**Classification:**

- This is PAID INFERENCE, but it produces a **name**, which OD-DH4-3 rules out ("never its name").
- OD-DH4-10 accepted the visible level on the premise that "the level is a function of the player's own inventory". The level is in fact also a function of **the reserve's class**, which is what makes it invertible.
- DH4-1 is merged and this audit does not change it. It is an Owner decision (OD-DH4-2-2).

**Proposed fix, "level before value" (the strict rule, JSON `safe_attribute_answer`):**

1. Choose the level from W alone: the finest level at which **every** member of W sits in a class of at least 2. Classes are total: an ingredient without a family is classed by its category.
2. Then answer the reserve's class at that level.
3. The level is identical for every hypothetical reserve, so nothing can be inverted.

**Results:**

| Rule | Levels, ladder owned | Levels, all owned | Named after inversion |
|---|---|---|---|
| DH4-1 as merged | family 13 · category 8 · existence 3 | family 15 · category 7 · group 1 · existence 1 | **5** |
| Strict, DH4-1 taxonomy | category 11 · existence 13 | category 22 · group 1 · existence 1 | **0** |
| **Strict + merge the runtime singleton families** (果物 pineapple and スパイス capers into その他) | family 3 · group 1 · category 7 · existence 13 | **family 16** · category 6 · group 1 · existence 1 | **0** |

**Recommendation:**

- Strict rule + that runtime merge. The late game keeps family answers (16 / 24), and nothing is ever named.
- The early game is weak (existence 13 / 24). An optional Dex gate for 特徴 (OD-DH4-2-9) keeps players from buying empty answers early.
- The merge only concerns the 25-recipe runtime. At 172 maturity the 果物 and スパイス families are expected to have ≥ 5 members (Fresh Design §7.2), so the merge can be undone by data once the class-size test passes.

## 6. 172-recipe scalability (JSON `scalability172`)

**Evidence quality:**

- 120 / 172 rows have a complete ingredient list.
- Categories exist for the 29 runtime and 62 catalog ingredients only.
- 97 rows contain at least one ingredient whose category had to be guessed: 135 default-topping guesses and 23 name guesses.
- 33 rows have an unresolved (placeholder) base sauce.
- **Every number below is indicative. The evidence gaps are listed in §6.2 and were not filled in by guessing.**

| Measure | Value |
|---|---|
| T distribution (all rows) | 0: 5 · 1: 29 · 2: 51 · 3: 61 · 4: 20 · 5: 5 · 6: 1 |
| T distribution (complete rows only) | 0: 3 · 1: 21 · 2: 42 · 3: 37 · 4: 12 · 5: 4 · 6: 1 |
| T = 0 rows | 5: quattro-formaggi (PIZZA DB), trenton-tomato-pie, ny-style, quad-cities, colorado-mountain-pie. All are cheese-only pizzas, and their categories are runtime-proven. |
| (N, T) classes | 19. The largest holds 33 and 6 are unique. |
| No spread sauce (sauce = 0) | 30 rows. **The one-sauce prior breaks at 172.** |
| ≥ 2 spread layers | 26 rows (17 carry MULTI_SPREAD_LAYER) |
| Late additions | 14 rows (mid-bake or post-bake) |
| Non-round or enclosed forms | 11 rows: square 4, boat 1, enclosed 5, laminated 1 |

### 6.1 Does 「トッピング数」 still read naturally?

| Case (evidence) | Tray category count "T" | 「トッピングを○種類使う」 | 「のせる材料」 | 「仕上げを除く具材」 |
|---|---|---|---|---|
| Post-bake or finishing (14 rows; e.g. BBQチキン: cilantro, 黒トリュフ: truffle) | Unchanged | Natural. The finishing item is still a topping. | Natural | **Breaks**: black-truffle drops to 0 (a negative), and excluding late items reveals LATE_ADDITION (a technique fact) |
| Late **sauces** (buffalo-sauce, Detroit tomato sauce, hot honey) | Not toppings | Natural | — | 「仕上げ」 ≠ category: incoherent |
| No sauce (30 rows; aussie, piadina, black-truffle…) | Unchanged | Natural | = N: tells "no sauce" (a **negative**) | — |
| Pizza bianca (runtime: olive oil + rosemary; 172 row: + mozzarella and ricotta) | 1 | Natural | = N − 1 | — |
| Pan / square (4), boat (pide) | Unchanged | Natural | Natural | — |
| Enclosed (calzone, stuffed, two-sheet) | Unchanged | Natural with 「使う」 | **Unnatural**: fillings are inside, not on top | — |
| Piadina (flatbread, no sauce) | 2 | Natural | = N: no-sauce negative | — |
| Multi-spread (honey, balsamic, olive-oil drizzles) | **Depends on catalog authoring** (sauce vs topping) | Natural | Varies | — |
| Unusual cheese (cheese-before-sauce Trenton, cheese-base Aussie, 4-cheese) | T = 0 in 5 rows | Only with the TC-G guard (never 「0種類」) | — | — |

### 6.2 Evidence gaps (recorded, not filled)

1. The category of ~117 ingredient ids has not been authored for the 172 set. The T values above use a default-topping heuristic for 135 occurrences.
2. Spread-layer items (honey, balsamic, chili oil, mayo drizzles) have no category decision. **The value of T depends on it.**
3. Mid-bake vs post-bake is unresolved for at least one row (eel).
4. The family taxonomy is authored only for the 22 runtime toppings. The inversion-safe level distribution at 172 cannot be computed until it exists.
5. Family-derived base sauces (57 rows) are not in the canonical ingredient lists. N at 172 is computed with the sauce layers added and is still uncertain for 33 rows.

## 7. Terminology recommendation

- The game's category label is **トッピング**, with ソース / チーズ / トッピング on the tray tabs and in the hint rows. **Use it, and only as the tray category**: an ingredient counts if its catalog category is `topping`, whatever its timing or technique.
- **Verb 「使う」, not 「のせる」**. 「のせる」 is wrong for enclosed pizzas and for late additions. 「使う」 also matches DH4-1's total line (「全部で○種類の材料を使うよ」).
- **Reject 「具材」.** In everyday Japanese it often includes cheese, and if it is read as cheese + topping it equals N − 1 at runtime (zero information).
- **Reject 「のせる材料」.** It equals N − (sauce count): zero information at runtime, and at 172 it gives away no-sauce (30 rows) as a negative.
- **Reject 「仕上げ材料を除く具材数」.** It sells a technique fact (LATE_ADDITION) inside a structure hint, it turns black-truffle into 0, and it is incoherent with late sauces. Finishing belongs to a future **技法ヒント** (`finish:`), not to 構成.
- **Proposed copy:** 「このピザは全部で○種類の材料を使うよ。トッピングは○種類だよ」. When the TC-G guard falls back, the second sentence is absent.

## 8. U3 UI alternatives

**Vertical budget:**

- The sheet is capped at 45dvh: 380 / 360 / 299 / 288 px.
- H3-4 measured a header of about 76 px and a footer of 132 px, so today's body is 172 / 152 / 91 / 80 px.
- The U3 heights below are **estimates** from the same CSS primitives (44 px controls). They are not measured. OD-DH4-6 requires a measured prototype before authority.

| | **U3-A** 「ヒントをもらう」 → inline chooser 材料 / 構成 / 特徴 | **U3-B** one 「ヒントをもらう」; the system picks the family | **U3-C** 「わかっていること」 first → 「ヒントをもらう」 opens family cards |
|---|---|---|---|
| **Flow** | Board + a footer with one CTA. Tapping it swaps the footer for a chooser: 3 family segments, a material preference row when 材料 is picked, and a price CTA. | Board + one CTA with a price. Fixed order: 構成 (if not owned) → 材料 until exhausted → 特徴. | Board + one CTA. Tapping it opens an in-sheet panel of 3 cards (title, one-line "what it tells", status, a price button), plus 「もどる」. |
| **Body, board state (390×844 / 360×800 / 390×664 / 360×640)** | ~216 / 196 / 135 / 124 (footer ~88) | ~216 / 196 / 135 / 124 | ~216 / 196 / 135 / 124 |
| **Chooser state** | Footer ~180 → body 124 / 104 / 43 / **32** (the knowledge is almost hidden while choosing) | — | Panel ~216 of 304 / 284 / 223 / **212** available: fits; **tight** at 360×640 (cards ≤ 54 px) |
| **Taps from an open sheet** | 3 (CTA, family, price CTA); 4 with a preference | **1** | 2 (CTA, card button); 3 with a preference |
| **Information density** | High on the board, low while choosing | Highest | High on the board; the cards explain each family |
| **First-time clarity** | Medium: three bare words (構成 is abstract) | Low: the player does not know what they will get | **High**: each card says what it tells |
| **0 Pitz clarity** | Medium: one shared price CTA | Low | **High**: every card shows 「たずねる 支払いずみ」 and the guidance promise |
| **GUIDANCE_ONLY clarity** | Medium | **Poor**: exhausting 材料 silently switches family, and the player pays for a family they did not choose | **High**: single-shot families show 「もらいずみ」, and only 材料 can end in guidance, which its card announces |
| **Privacy** | Uniform | **Risk**: the switch 材料 → 特徴 reveals exhaustion *on a charged request*; the charged family depends on recipe state | Uniform: every card for every target, and 「もらいずみ」 comes from the player's own ledger only |
| **172 scalability** | Good | Good | Good (the board grows; the cards stay 3) |
| **Technique Hint (D)** | +1 segment (4 at 360 px ≈ 80 px each) | +1 in the fixed order | **+1 card** (the panel scrolls; the cleanest) |
| **Fit with OD-DH4-6** (「ヒントをもらう → 材料/構成/特徴」, one 「わかっていること」 area) | Literal | Violates it (no choice) | Literal, with the explanation added |

U3-B is rejected: it has a charged-exhaustion leak and makes the player pay for a family they did not pick.

The heights in this table are estimates inside today's 45dvh sheet. §8A replaces them with measured values and shows that 45dvh is itself the constraint.

## 8A. Hint Sheet vertical-space audit (Owner Finding HV-5)

**Method:**

- Measured on `5a33d85` (the H3-4 sheet, unchanged) in local Chromium.
- The layout-contract profiles were used, including the CDP safe-area override (top 47 / bottom 34, as on a notched iPhone).
- A throw-away Playwright spec seeded 3 sheet states and was deleted afterwards (`git status` clean):
  - **F**: fresh, key only;
  - **K**: every sellable fact owned (the late-game case);
  - **L**: legacy + every fact + GUIDANCE_ONLY (the longest).
- Raw data: `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_HINT-SHEET-VSPACE.json`.
- Baseline screenshots: `docs/reports/screenshots/dh4-2-pre-audit/before-*.png`. They are **before** images for DH4-2c. No UI was changed.

### 8A.1 Measured heights (px, state K, body scrolled to the top)

| Region | 390×844 | 360×800 | 390×664 | 360×640 | 390×844 + safe area | 390×664 + SA | 360×640 + SA |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sheet (cap 45dvh) | 379 | 360 | 299 | 288 | 380 | 299 | 288 |
| Top padding + **header** (💡 ヒント / 閉じる) + gap | 12 + **36** + 8 | same | same | same | same | same | same |
| **Guidance message** (H0 「今の材料で…」, inside the body) | 36 | **55** (wraps) | 36 | 55 | 36 | 36 | 55 |
| **Known information** visible (body viewport, H0 included) | **171** | **152** | **91** | **80** | **138** | **57** | **46** |
| Known-information content height | 171 | 190 | 171 | 190 | 171 | 171 | 190 |
| Rows fully visible (ソース / チーズ / トッピング) | 3 / 3 | 2 / 3 (topping 35 of 52) | 1 / 3 | **0 / 3** | **2 / 3 (topping 40 of 52)** | **0 / 3** | **0 / 3** |
| Gap + **selector** (legend 17 + 3 radios 44) | 8 + **63** | same | same | same | same | same | same |
| **CTA** | 44 | 44 | 44 | 44 | 44 | 44 | 44 |
| **Pitz explanation** (所持… ・ 注意文) | 17 | 17 | 17 | 17 | 17 | 17 | 17 |
| Footer total | 132 | 132 | 132 | 132 | 132 | 132 | 132 |
| Bottom padding (12 + **safe area**) | 12 | 12 | 12 | 12 | **46** | **46** | **46** |
| **Known info ÷ sheet** | 45 % | 42 % | 30 % | 28 % | **36 %** | **19 %** | **16 %** |
| Controls (footer) ÷ known info | 0.8 | 0.9 | 1.5 | 1.7 | **1.0** (1.3 with the safe area) | **2.3** | **2.9** |

**What the numbers show:**

- The measurement reproduces the Owner's photo: see `before-K-all-facts_P390i.png`. The 2-chip トッピング row is cut under the fade, and the ▾ is a 14 px glyph at the far right.
- On every short or safe-area profile, **the controls are larger than the hints**.
- At 360×640 with the safe area, the known area (46 px) is smaller than the H0 line (55 px), so no fact is on screen when the sheet opens (`before-K-all-facts_E360i.png`).
- In the longest state (L), the content is 309–328 px against the same 46–172 px viewport.

**Estimated DH4-2 board (U3-R, §9, 390 px wide), built from the measured parts:**

| Part | Height (px) |
|---|---:|
| H0 | 36 |
| 材料 rows | 108 |
| 「？」 legend | 15 |
| 3 section labels | ~54 |
| 構成 (2 lines) | ~44 |
| 特徴 (2 lines) | ~44 |
| Gaps | ~36 |
| **Typical late-game board** | **≈ 330** |
| Longest (+ guidance 52 + legacy 72) | ≈ 470 |

Today's sheet shows 138 px of that on an iPhone: about 2–3 lines of known information. The Owner rules this out.

### 8A.2 Layouts compared (known-information viewport, px)

Every number is computed from the measured parts:

- 12 px top padding, the 36 px header, two 8 px gaps, the footer, and 12 px + the safe area at the bottom.
- The formula reproduces all 7 measured "today" values exactly.

**The three layouts:**

- **A**: today's structure (footer 132 px, 3 radios), with the sheet raised from 45dvh to 70dvh.
- **B**: header and footer fixed, only 「わかっていること」 scrolls, at today's 45dvh. With today's footer this *is* the current H3-4 structure, so it is shown with the compact U3-R footer (one CTA + one Pitz line = 65 px).
- **C**: a near-full-height sheet (max-height `100dvh − safe-area-top − 56 px`, so the app header stays visible), fixed header, scrolling known information, and a compact footer (65 px; **C′** = 44 px with the balance moved into the header).

| Profile | Today (45dvh, footer 132) | A (70dvh, footer 132) | B (45dvh, footer 65) | **C** (near-full, footer 65) | C′ (footer 44) |
|---|---:|---:|---:|---:|---:|
| 390×844 | 172 | 383 | 239 | **647** | 668 |
| 360×800 | 152 | 352 | 219 | **603** | 624 |
| 390×664 | 91 | 257 | 158 | **467** | 488 |
| 360×640 | 80 | 240 | 147 | **443** | 464 |
| 390×844 + safe area | **138** | 349 | 205 | **566** | 587 |
| 390×664 + SA | 57 | 223 | 124 | **386** | 407 |
| 360×640 + SA | **46** | 206 | 113 | **362** | 383 |

| Criterion | A (taller, same UI) | B (45dvh, scroll only the middle) | **C (near-full, compact footer)** |
|---|---|---|---|
| CAP-1: 390×844 + SA shows the typical DH4-2 board (≈ 330) without scrolling | 349: just, with no margin | ✗ 205 | ✓ 566 (the longest ≈ 470 fits too) |
| CAP-2: 360×640 + SA, CTA visible, known area ≥ 150 px (≈ 6 rows) | ✓ 206 | ✗ 113 | ✓ 362 |
| CAP-3: known area ≥ the controls on every profile (the §13 principle) | ✓, but the 132 px footer and 3 radios stay | Marginal (113 vs 65 + 46) | ✓ |
| Keeps the ソース / チーズ / トッピング radios as a persistent control | Yes (the Owner asks not to assume this) | No | No: preference lives in the 材料 card (§9) |
| The U3-R family panel (3 cards ≈ 216 px + back) | Fits | **Does not fit** at 360×640 + SA | Fits everywhere (≥ 362 px) |
| Context | Covers 70 % of the cooking screen | Keeps the stage visible | Covers the stage, keeps the app header. The sheet is a modal read-then-close step (the backdrop already blocks the stage). |
| Safe area | Kept (padding) | Kept | Kept on both edges (`env(safe-area-inset-top/bottom)`) |
| Re-opens a decision | OD-H3-4-7 (45dvh) | none | OD-H3-4-7 (45dvh) |

**Recommendation: C (C′ if the Owner accepts the balance in the header).**

- A buys height but keeps the controls-first ratio and the three radios.
- B cannot meet CAP-1 or CAP-2, because the whole problem at 45dvh is that the sheet is too short for any footer.

### 8A.3 Selector height (U3)

- Today's selector costs 63 px, and it is always on screen.
- In U3-R the persistent footer holds **only** 「ヒントをもらう」 (+ the Pitz line). The 材料 / 構成 / 特徴 choice and the 材料 preference (おまかせ / ソース / チーズ / トッピング) appear only in the transient family panel.
- **The footer shrinks from 132 to 65 px (or 44 px with C′), a saving of 67–88 px on every profile.**
- The three category radios are **not** kept as a persistent control. Their 44 px tap-target height is kept inside the 材料 card (the H3-4 e2e contract).

### 8A.4 Is the fade enough to show that the body scrolls?

**No.** Evidence from `before-K-all-facts_P390i.png` and `before-L-legacy-guidance_P390i.png`:

- The 18 px bottom fade sits right above the selector legend, so the cut reads as a layout clip, not as "more below".
- The ▾ cue is a 14 px orange glyph at the right edge with no text. iOS shows no scrollbar until the user scrolls.
- In state L, 137–282 px of content (guidance and the 「以前のヒント」 archive) is below the fold with only that cue.

**Proposal for DH4-2c:**

1. Make scrolling rare: layout C fits the typical board with no scroll at 390×844.
2. When the body does scroll, keep the fade and add a **labelled cue pill** at the bottom centre of the known area: 「▾ 下にもヒントがあるよ」. It is ≥ 24 px, it is removed when scrolled to the end, and it is `aria-hidden` (the list stays readable to assistive tech).
3. Put **section labels** (材料 / 構成 / 特徴 / 以前のヒント) at the start of each block, so a partly visible next label also signals more content.
4. Keep H3-4's "scroll the newest fact into view" after a purchase.

**Privacy:** whether the cue shows depends only on content the player already owns (their facts, legacy lines and guidance), as in H3-4. It never depends on what is left to sell.

### 8A.5 H0 line and balance placement (height savings, optional)

| Item | Today | Option | Saving |
|---|---|---|---|
| H0 「今の材料で、まだ見つけていないピザが作れそう！」 | 36 px (55 px at 360, 2 lines) | A one-line caption under the title, or a shorter text | 18–37 px |
| Pitz line | 17 px in the footer | 「所持 999 Pitz」 in the header row, next to 閉じる (C′) | 21 px |

Both are presentation-only and uniform for every target.

## 9. Recommended U3 flow ("U3-R" = the U3-A entry with U3-C cards)

```
[Sheet opens]  💡 ヒント                          [閉じる]
┌ わかっていること ───────────────────────────────┐
│ (H0) 今の材料で、まだ見つけていないピザが作れそう！ │
│ 材料  ソース  トマトソース                        │
│       チーズ  ？                                  │
│       トッピング 🥚たまご                          │
│       ？＝まだわからない（使わないジャンルもあるよ） │
│ 構成  まだ聞いていないよ                          │
│ 特徴  まだ聞いていないよ                          │
│ ┄ 以前のヒント（前のヒント方式のメモ）┄ (legacy only) │
└──────────────────────────────────────────────────┘
[ ヒントをもらう ]              所持 120 Pitz

→ tap 「ヒントをもらう」 (panel replaces the body + footer; 「もどる」 returns)

┌ 材料ヒント   材料の名前を1つ教えるよ ─────────────┐
│ [おまかせ][ソース][チーズ][トッピング]              │
│ もう教えられる材料がないときは、Pitzは使わないよ    │
│                           [ たずねる   5 Pitz ]    │
├ 構成ヒント   材料の数を教えるよ ──────────────────┤
│                           [ たずねる   5 Pitz ]    │  (owned → ✓ もらいずみ)
├ 特徴ヒント   まだわからない材料の「なかま」を教えるよ ┤
│                           [ たずねる   5 Pitz ]    │  (owned → ✓ もらいずみ)
└ [もどる]                        所持 120 Pitz ───┘
```

**Layout:**

- Layout **C** from §8A: a near-full-height sheet with a fixed header, a scrolling 「わかっていること」, and a compact footer holding only 「ヒントをもらう」 and the Pitz line.
- The family panel opens inside the same sheet (≥ 362 px everywhere), so the cards never need the 54 px squeeze.
- Measured targets are CAP-1…3 (§8A.2).

**Rules:**

- **All three cards are shown for every target.** The price shown is the same for all three and depends only on the paid count (it is a placeholder until DH4-ECON, OD-DH4-2-6).
- **構成 and 特徴 are single-shot per recipe.** One answer each, never re-sold, including when the inventory grows later. 「✓ もらいずみ」 therefore comes from the player's own ledger and is the same for every target: no leak.
- **After a successful answer**, the sheet returns to the board and the new line gets the H3-4 highlight.
- **Double-tap safety:** each card button keeps the H3-4 latch (450 ms) and the `expectedPaidCount` stale guard.
- **360×640 + safe area:** with layout C the panel has ≥ 362 px, so all three cards fit at full size. If it ever scrolls, the labelled cue from §8A.4 applies. Every button stays reachable (e2e geometry contract).
- **Dex-0 Margherita onboarding:** stays on the free TARGET flow. No U3 (OD-H3-4-8).

## 10. CTA wording

| Candidate | New fact implied? | At 0 Pitz | With GUIDANCE_ONLY | Verdict |
|---|---|---|---|---|
| ヒントを1つ解除 (H3-3) | Yes: "unlock one" | 「解除 0 Pitz」 reads as a free fact | Contradicts it | Retired (H3-4 F-1) |
| ヒントを1つもらう (H3-4) | Yes: "one" | Replaced by 「たずねる」 at 0 | Acceptable | Drop 「1つ」 |
| **ヒントをもらう** | Mild. It is the Owner's U3 entry. | Neutral (it opens the panel; no price on it) | Nothing is charged at the entry | **Entry CTA** |
| ヒントを聞く / **たずねる** | **No**: asking may get "that's all" | Natural (H3-4 already uses 「たずねる」 at 0) | Matches the answer | **Card buttons** |
| もう1つヒント | Yes: "one more" | Misleading | Contradicts it | Reject |
| ヒントを見る | Implies something already exists (and is free) | Misleading when paid | — | Keep only on the Dex entry, which just opens the sheet |
| 手がかりをもらう | Yes | — | — | A new term; no gain |

**Pitz display:** keep the H3-4 pattern of label + price badge on the button: 「たずねる ｜ 5 Pitz」, or 「たずねる ｜ 支払いずみ」 at 0.

Do not use 「5 Pitzでヒントをもらう」:

- it puts money first;
- it reads badly as 「0 Pitzで」 or 「支払いずみでヒントを」;
- it breaks the one-component pattern.

The entry CTA 「ヒントをもらう」 carries **no price**: the price lives on the cards, where the choice is made. No price authority changes.

## 11. 0 Pitz behavior

- **Price 0 means "the per-recipe cap is already paid"** (H3-4 OD-H3-4-1). It is shown as 「支払いずみ」, never as 「0 Pitz」.
- **Each card at price 0 reads 「たずねる ｜ 支払いずみ」 and stays enabled.** A legacy buyer can still get a real fact there, so the view must not tell the two cases apart before the request.
- **Fixed line on the 材料 card:** 「もう教えられる材料がないときは、Pitzは使わないよ」. It is identical for every target and replaces H3-4's 「Pitzはヒントが出たときだけ使うよ」 in the family panel.
- **Open economy question:** whether 構成 and 特徴 spend the same per-recipe cap (so they become 「支払いずみ」 once the cap is reached) is DH4-ECON (OD-DH4-9). Until then DH4-2 ships behind a Preview flag (OD-DH4-2-6).

## 12. GUIDANCE_ONLY UX

| Family | Can end in GUIDANCE_ONLY? | Pre-request copy | After |
|---|---|---|---|
| 材料 | Yes: exhausted after `distinct − 2` facts. pizza-bianca sells none. The exhaustion point varies by recipe, which is the existing, accepted INTERACTION INFERENCE (OD-H3-17). | 「もう教えられる材料がないときは、Pitzは使わないよ」 on the card, before any tap | The card reads 「材料ヒントはここまで」 and 「今回はPitzを使っていないよ」. Its button is disabled for this sheet session (H3-4 semantics). A uniform suggestion follows: 「構成・特徴のヒントもあるよ」, shown only when those are not owned by the player's own ledger. |
| 構成 | **Never.** Every target has exactly one answer (TC-G falls back, it never withholds). | — | 「✓ もらいずみ」 |
| 特徴 | **Never.** Every target has exactly one answer (existence at worst). | — | 「✓ もらいずみ」 |

This resolves HV-4:

- The only family that can say "nothing more" says so **before** the tap.
- The other two families can always answer.
- The legacy exception, where a legacy 「材料は全部で○種類」 line already owns 構成 (OD-DH4-8), shows 「✓ もらいずみ」, not guidance.

## 13. Known Information (「わかっていること」) design

**Information-design principle (Owner, HV-5): ヒント本文を操作UIより優先する.**

- The sheet exists to read hints. On every profile, the known-information viewport must be at least as tall as the persistent controls (footer + bottom safe area): CAP-3 in §8A.
- The persistent footer carries at most one primary CTA row and one Pitz line.
- Choices (family, 材料 preference) live in a transient step, never permanently on screen.

| Section | Shows | Never shows |
|---|---|---|
| **材料** | The three H3-4 rows (ソース / チーズ / トッピング) with chips, 「？」 for an empty row, and the fixed 「？」 legend | Remaining counts, per-row availability, 「なし」 |
| **構成** | The owned total. With TC-G, the topping clause when it was told. Otherwise the uniform 「まだ聞いていないよ」. | 「残り○個」, 「あと○種類」, 0, per-category totals |
| **特徴** | The owned attribute line (e.g. 「まだわかっていない材料に、肉の仲間があるよ」). Otherwise 「まだ聞いていないよ」. | The answer level as a label, candidate counts, 「?」 slots per class |
| **以前のヒント** | The player's own Economy 1.0 lines verbatim, in the H3-4 dashed muted archive box at the end, titled 「前のヒント方式で買ったメモ」 | Prices, step pills, being counted as a new fact |

**Visual distinction:**

- Hint 4.0 facts use solid chips (材料) and solid text rows (構成 / 特徴).
- Legacy lines stay inside the dashed box. The negative 「チーズは使わないみたい」 lives **only** in that box, never in a 材料 row or as a 構成 fact.

**Why the unowned placeholder is safe:** 「まだ聞いていないよ」 on an unowned 構成 or 特徴 row is uniform, because every target has exactly one such answer.

**No 「?」 slots:** there is no 「?」 per unknown ingredient and no 「残り○個」. With N owned, the gap is the player's PAID INFERENCE; the UI never draws it.

## 14. Legacy presentation

- **grandfatheredSteps** are unchanged and display-only (OD-H3-4-4, OD-DH4-8).
- **A legacy count line** (`COUNT_CHEESE` axis) means `ingredientTotalOwned` = true:
  - the 構成 card shows 「✓ もらいずみ」;
  - the 構成 row shows the total with a small 「以前のヒント」 tag (a derived display; nothing is written to the ledger). **OD-DH4-2-8.**
- **If TC-G is adopted:** a legacy owner of N has not been told the topping clause. The 構成 card then stays requestable once, for the topping clause only. If the guard falls back, that request is GUIDANCE_ONLY. The guard is inversion-safe, so this reveals nothing (§5.2). **OD-DH4-2-8.**
- **Legacy price rungs** (`LegacyHintProgress.paidRungs`) are unchanged. Whether new families advance the rung is DH4-ECON.

## 15. Runtime integration map (DH4-2)

The principle: **one pure authority decides; the reducer applies; the sheet renders fact ids through fixed copy.** The UI never computes answers, levels, guards or availability.

| Boundary | `5a33d85` today | DH4-2 proposal |
|---|---|---|
| Pure authority | DH4-1 `structureTotalFact`, `reserveAttributeAnswer`, `ingredientTotalOwned`, `deductionHintTextJa` (provisional copy). All unwired. | New `purchaseDeductionHint(input)` in `logic/discovery/`, next to `purchaseSelectableHint`. It follows the same contract: re-derive everything → STALE / INSUFFICIENT_PITZ decided on the request → answer or GUIDANCE_ONLY → price. It composes the existing material authority for `family: "material"`. Strict-guard and TC-G changes, if chosen, land in `deductionHint.ts` first (slice DH4-2a). |
| Reducer action | `PURCHASE_SELECTABLE_HINT { preference, expectedPaidCount }` | **Extend the same action** with `family: "material" \| "structure" \| "attribute"` (default `material`). It is already Free Cooking PREPARE + sheet-open only, and **already in `DINNER_BLOCKED_ACTIONS`**, so no Dinner file changes. |
| Purchase request | The sheet sends `(preference, paidCount)` | The sheet sends `(family, preference?, paidCount)`. The latch and stale guard are kept. |
| Pitz charge | `purchaseSelectableHintFact` debits and extends the ledger in one patch | The same single patch for every family. It never debits without recording. |
| Paid count / rung | `ownedPurchasedFacts` counts `ing:` facts only | Needs a family-aware paid count (**OD-DH4-2-6**, economy). No price numbers change. |
| Persistence | `discoveryHintFacts[recipeId]` keeps any `<kind>:<value>[:<q>]` id verbatim (`HINT_FACT_ID_PATTERN`) | Store `meta:ingredient-total`, `meta:topping-total` (TC-G, only when told) and the **answered** `attr:<level>:<value>` id. No schema bump (schemaVersion 2). The stored attribute is what was told and is never re-derived (§16). |
| View model | `HintSheetView.SELECTABLE` carries the presentation, H0, grandfatheredSteps and outcome | Add `deduction: { structure: textId \| null, attribute: textId \| null, legacyStructure: boolean }` and a per-family `outcome`. **No availability, level, count or candidate field.** |
| HintSheet | H3-4 SELECTABLE body | The U3-R board + family panel (§9). The copy table lives in the component; fact → text comes from the pure layer's fixed map. |
| Dex | 「💡 ヒントを見る」 on DISCOVERABLE cards → `SHOW_HINT { pinnedRecipeId }` | Unchanged. The pinned target works the same for every family. |
| Free Cooking | The only mode that opens the sheet | Unchanged |
| Near-miss | `resultNearMiss`: fixed copy, reads no hint ledger | Unchanged (OD-DH4-7). A test pins that it never reads `meta:` / `attr:`. |
| Onboarding | Dex-0 Margherita → the TARGET view | Unchanged |
| Legacy save | `legacyHintMapping`, `ingredientTotalOwned` | Read-only, as today |
| Dinner | `PURCHASE_SELECTABLE_HINT` blocked; `SHOW_HINT` **not** blocked on main (PR #252 adds it) | Nothing to add when the action is extended. If a new action type were chosen instead, it would have to join `DINNER_BLOCKED_ACTIONS`, the same set PR #252 edits (conflict risk). |

## 16. Persistence implications

- **No save-schema change.** New ids fit `HINT_FACT_ID_PATTERN`, for example:
  - `meta:ingredient-total`
  - `meta:topping-total`
  - `attr:family:meat`
  - `attr:category:topping`
  - `attr:existence`
- **Older and newer builds.** H3-2 already keeps unknown ids verbatim, and `unionHintFacts` merges them.
- **Cap.** 64 ids per recipe is far above the ~7 possible.
- **The attribute is state-dependent.** The **answered** id is stored and shown as told.
  - A later, finer answer (the inventory grew) is **not** re-sold: the family is single-shot (**OD-DH4-2-7**).
  - This keeps monotonic safety: under both the DH4-1 rule and the strict rule, a stored answer stays k ≥ 2.
- **TC-G.** `meta:topping-total` is written only when the clause was told. A fallback answer writes `meta:ingredient-total` alone (no marker of the fallback is stored).
- **Full Reset** clears the ledgers as today. The Preview flag must not leak into the production save key (the H3-4 HV-seed pattern).

## 17. Near-miss implications

- **ADD_ONE is free closure.**
  - When the player bakes exactly their known facts and sees 「材料をあと1つ足すと…」, they learn N = |known| + 1 without paying.
  - Every privacy check in this audit therefore assumes N is known.
  - This is why raw T (N+T) and the DH4-1 level inversion (§5.4) leak even when N was never bought.
- **The copy stays fixed and attribute-free (OD-DH4-7).** No 「肉系が足りない」.
- **Near-miss never reads `meta:` or `attr:`.** DH4-2 adds that pin test.
- **No combined line** such as 「あと1つ。買ったヒント：肉系」 in DH4-2. It would restate paid facts only, but it adds UI and review cost for no new information.

## 18. Dinner isolation

- DH4-2 changes **no Dinner file**, does not rely on PR #252, and does not touch PR #243.
- **Blocking:** extending `PURCHASE_SELECTABLE_HINT` inherits the existing Dinner block. On `main`, `SHOW_HINT` is not blocked during Dinner, but the sheet itself only opens in Free Cooking PREPARE (`isHintSheetVisible`). PR #252 adds the explicit block.
- **Merge order:** if PR #252 merges first, DH4-2 rebases onto it. Its reducer diff should touch only the hint cases, not the Dinner sets.
- **A test to add:** during a Dinner run, a `family: "structure" | "attribute"` request leaves the state byte-identical.

## 19. Owner Decisions required

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **OD-DH4-2-1** | Topping count (HV-1) | (a) keep the total only · (b) raw 「トッピングは全部で○種類」 · (c) **TC-G**: the topping clause inside the 構成 answer, behind the inversion-safe guard | **(c)**, with the wording in §7. (b) is rejected: it sells 「0種類」 and names the reserve in 3/24. It re-opens OD-DH4-2 for a positive, guarded clause only. |
| **OD-DH4-2-2** | The DH4-1 level-inversion finding (§5.4) | (a) accept as PAID INFERENCE · (b) **strict "level before value"** rule · (c) (b) + merge the runtime singleton families (果物, スパイス → その他) | **(c)**: 0 named in both inventories, family answers 16/24 in the late game. It amends DH4-1 in slice DH4-2a. |
| **OD-DH4-2-3** | UI model | U3-A / U3-B / U3-C / **U3-R** | **U3-R** (§9). A measured 4-viewport prototype comes before authority. |
| **OD-DH4-2-4** | CTA wording | §10 | The entry reads 「ヒントをもらう」 (no price). Card buttons read 「たずねる ｜ n Pitz」 or 「たずねる ｜ 支払いずみ」. |
| **OD-DH4-2-5** | 材料 preference | Keep the 3 categories · **add 「おまかせ」 as the default** | Add おまかせ. It maps to the existing fallback order (sauce → cheese → topping), so there is no authority change. |
| **OD-DH4-2-6** | Economy of 構成 and 特徴 in DH4-2 | (a) **Preview-only flag until DH4-ECON** · (b) the shared ESC rung and cap now | **(a)**. Prices stay with DH4-ECON (OD-DH4-9). The prototype uses the shared rung, labelled provisional. |
| **OD-DH4-2-7** | Single-shot families | 構成 and 特徴 are answered once per recipe and never re-sold | **Yes** |
| **OD-DH4-2-8** | Legacy count line | Show the derived total in the 構成 row with a 「以前のヒント」 tag. With TC-G, allow one topping-clause request. | Yes and yes |
| **OD-DH4-2-9** | Early-game 特徴 | (a) no gate · (b) a Dex gate (e.g. Dex ≥ 8), uniform | Owner call. Under the strict rule, 13/24 ladder answers are 「まだわかっていない材料があるよ」. |
| **OD-DH4-2-10** | Family labels | 材料 / 構成 / 特徴 (OD-DH4-6) · plain alternatives 材料 / かず / なかま | Keep the Owner's labels, with the one-line description on each card |
| **OD-DH4-2-12** | **Hint Sheet visible-content capacity** (HV-5, §8A) | (a) today's 45dvh with the U3 footer (layout B) · (b) 70dvh with today's footer (layout A) · (c) **near-full-height sheet, fixed header, scrolling 「わかっていること」, compact footer** (layout C; C′ = the balance in the header) | **(c)**. It adopts CAP-1 (390×844 + SA shows the typical DH4-2 board, ≈ 330 px, without scrolling), CAP-2 (360×640 + SA: CTA visible and ≥ 150 px of known info), CAP-3 (known info ≥ controls everywhere) and the §13 principle. It retires the persistent ソース / チーズ / トッピング radios (the preference moves into the 材料 card), adds the labelled scroll cue (§8A.4) and keeps the safe area on both edges. It **re-opens OD-H3-4-7** (the 45dvh cap). Optional: shorten H0 (§8A.5). |
| **OD-DH4-2-11** | Re-verify HV-3 / HV-4 | On a build at or after `22658f7` (H3-4 copy) before freezing the DH4-2 copy | **Yes.** The images match the H3-3 copy; production was last deployed on 2026-09-21. |

## 20. Recommended DH4-2 slices

| Slice | Scope | Gate |
|---|---|---|
| **DH4-2a**: pure amendments + purchase authority (unwired) | Strict level rule + runtime taxonomy merge (if OD-DH4-2-2 (b)/(c)); TC-G (if OD-DH4-2-1 (c)); `purchaseDeductionHint`; single-shot semantics; mechanical tests: inversion (this tool's model), no 0, no FREE LEAK, monotonic, near-miss + N assumed, legacy | Vitest, tsc, oxlint, mutants |
| **DH4-2b**: runtime wiring behind a Preview flag | Extend `PURCHASE_SELECTABLE_HINT` with `family`; one patch per charge; ledger ids; view-model fields; Dinner byte-identity test; near-miss never reads the new ledger | Unit + App tests, full Vitest; production unchanged while the flag is off |
| **DH4-2c**: U3-R sheet | `HintSheet` board + family panel in the layout OD-DH4-2-12 picks, `.hint-sheet*` CSS. The e2e geometry contract gains CAP-1…3 on all 7 profiles, the labelled scroll cue, and safe-area checks. After-screenshots are paired with `docs/reports/screenshots/dh4-2-pre-audit/before-*`. | HV policy: 390×844 video delivered directly, before/after screenshots under `docs/reports/screenshots/<task>/` |
| **DH4-ECON** | Prices and cap for the new families; turning on production | Owner |

## 21. Final verdict

**A. DH4-2 DESIGN READY FOR OWNER DECISIONS.**

**What is measured:**

- The topping-count question is measured on all 25 runtime recipes and every reachable state.
- Raw topping counts sell a negative (1/24) and name the Rule W reserve (3/24 early; 1/24 in the late game).
- A guarded, inversion-safe topping clause (TC-G) keeps the mid-game value (about 1.2–1.5 bits) with 0 named cases.

**A new finding on the merged DH4-1:**

- Its fallback level can be inverted to name the reserve in 5 inventory cases.
- The proposed "level before value" rule removes that at no loss of late-game family answers, if the runtime singleton families are merged.

**Owner Finding HV-5 is measured:**

- On an iPhone (390×844 + safe area), today's sheet shows 138 px of known information (36 %) under 178 px of controls and safe area.
- At 360×640 + safe area it shows none.
- A near-full-height sheet with a compact U3 footer (layout C) gives 566 / 362 px and meets every proposed capacity bar. It is Owner Decision **OD-DH4-2-12 (Hint Sheet visible-content capacity)**.

**What stays open:**

- At 172, categories and taxonomy are indicative only, and the evidence gaps are recorded in §6.2.
- These gaps belong to catalog authoring. They do not block DH4-2 on the 25-recipe runtime.

Nothing here was implemented. PR #254 was already merged by the Owner during the audit and was not touched. Nothing was merged by this session.
