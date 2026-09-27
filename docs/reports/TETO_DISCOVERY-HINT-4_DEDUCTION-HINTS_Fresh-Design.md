# Discovery Hint 4.0 — Deduction Hints (材料 / 構成 / 特徴): Fresh Design

> **Status:** Fresh Design only. Docs only.
>
> - No production code, test, authority, pricing, persistence or UI change.
> - Nothing here is authority until the Owner decides §17.
> - PR #251 (H3-4) keeps its scope and is not merged.
> - DM-3R-2 / PR #252, Dinner and PR #243 are not touched.
>
> **Verdict: A. FRESH DESIGN READY FOR OWNER DECISIONS** (§20)

## 1. Audited main

| Item | Value |
|---|---|
| `origin/main` (fresh check) | `726b0ac` (Merge PR #249, DM-3R-1). It has not moved since H3-4 started. |
| PR #251 (H3-4) | OPEN, `mergeable_state: clean`, HEAD `5dc5f47`. Not merged. |
| PR #252 (DM-3R-2) | OPEN in another session. Not read beyond its title, not touched. |
| Runtime data used | `src/data/recipes.ts` (25 recipes), `src/data/ingredients.ts` (29 ingredients), and the H3-1 pure layer (`buildSelectableHintModel`, `hintKeyIngredientId`, Rule W) at `726b0ac`. Dumped by a throw-away Vitest probe, which was deleted afterwards (`git status` clean). |
| 172 data used | `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` (172 rows; 181 names after a simple normalization) |
| Audit output | `docs/reports/data/TETO_DISCOVERY-HINT-4_25-RECIPE-INFO-AUDIT.json` |

## 2. Boundary with PR #251 / H3-4

H3-4 (PR #251) stays exactly as reviewed:

- the Selectable sheet copy and layout (OD-H3-4-1…10);
- code HEAD `5dc5f47`, with CI / WebKit green on the same code;
- Preview deployed (`teto-pizza-game-preview` `109fe28`).

Its Result Report records the Owner Finding (§3) in §13, and **nothing from this design goes into PR #251**.

The ideas below touch authorities that H3-1…H3-4 fixed:

- **OD-H3-2:** hide counts.
- **OD-H3-7:** no negative or count facts on sale.
- **OD-H3-15 (a):** the 515 total, with counts not re-admitted.
- **OD-H3-5 (Rule W):** the reserve is never revealed.

This design therefore proposes a **new phase** and states each re-opening as an explicit Owner decision (§17). Nothing is changed silently.

## 3. iPhone Human Verification finding (Owner, PR #251 Preview, HEAD `5dc5f47`)

- Today the sheet sells positive material facts per category (ソース / チーズ / トッピング).
- In late-game search the player also wants two things:
  1. **How many toppings** are needed (「トッピングは全部で2種類」).
  2. **A last hint that is not the name.** It should give the kind, attribute or family of what is still unknown (「残りの材料には肉系があるよ」, 「野菜系の材料が含まれているよ」, 「香草系を使うよ」).
- Selling the last ingredient by name (「残りはペパロニ」) is to be avoided. The player buys **deduction material**, not the answer, and must still experiment to discover the pizza.

## 4. The three hint families (proposal)

| Family | What it tells | Fact ids (OD-H3-12 grammar `<kind>:<value>`) | Today |
|---|---|---|---|
| **A. 材料ヒント** (material) | One positive ingredient of a category | `ing:<id>` | Hint 3.0 (H3-1…H3-4) |
| **B. 構成ヒント** (structure) | A static total: ingredient total, topping total, … | `meta:ingredient-total`, `meta:topping-total` (candidate) | Forbidden by OD-H3-2 / OD-H3-7 |
| **C. 特徴ヒント** (attribute) | The **family** of one still-unknown ingredient, never its name | `attr:<class>` (candidate) | New |

A future **D. 技法ヒント** (technique: `tech:`, `shape:`, `finish:`) plugs into the same frame (§14).

## 5. 25-recipe information audit

**Definitions:**

- **Owned set:** the starter set (tomato sauce, mozzarella, basil) plus the discovery-ladder materials up to and including the target's step. This is the same ladder the e2e specs and the runtime deterministic target order use.
- **E (endgame):** the key plus every sellable fact is owned, so only the Rule W reserve is unknown. This is exactly the Owner's late-game situation.
- **E base:** owned ingredients not yet known, i.e. the candidates for "what is missing" with no further hint.
- **+cat count:** the candidates once the category of the missing ingredient is known. The category follows from the per-category counts.
- **+attr T7:** the candidates once the T7 attribute of the missing ingredient is known (taxonomy §7).
- **both:** category + attribute. **Bold 1 = name-equivalent:** the hint alone pins the ingredient.
- **F one-attr:** fresh state (only the key known), then one T7 attribute hint about one unrevealed topping. The minimum candidate count is shown; **1** marks a single cheap hint that names an ingredient.
- **k≥2 answer level:** the level a k-anonymity rule would answer at (§10.3).

| # | Recipe | Signature (sauce · cheese · topping) | N | Top | Key (free) | Sellable positive facts | Rule W reserve (T7) | E base | +cat count | +attr T7 | both | F one-attr | k≥2 answer level |
|---:|---|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---|
| 0 | マルゲリータ | トマトソース · モッツァレラ · バジル | 3 | 1 | — (onboarding: all free) | — | — | — | — | — | — | — | — |
| 1 | ビスマルク | トマトソース · モッツァレラ · たまご | 3 | 1 | たまご | トマトソース | モッツァレラ（チーズ） | 2 | 1 | 1 | **1** | — | existence |
| 2 | ブレックファストピザ | トマトソース · モッツァレラ · たまご · ベーコン | 4 | 2 | ベーコン | トマトソース, モッツァレラ | たまご（たまご） | 2 | 2 | 1 | **1** | **1** (たまご) | category |
| 3 | フンギ | トマトソース · モッツァレラ · マッシュルーム | 3 | 1 | マッシュルーム | トマトソース | モッツァレラ（チーズ） | 4 | 1 | 1 | **1** | — | existence |
| 4 | メランザーネピザ | トマトソース · モッツァレラ · ナス · バジル | 4 | 2 | ナス | トマトソース, モッツァレラ | バジル（ハーブ・香味） | 4 | 4 | 1 | **1** | **1** (バジル) | category |
| 5 | パルミジャーナピザ | トマトソース · モッツァレラ · ナス · パルミジャーノ · バジル | 5 | 2 | パルミジャーノ | トマトソース, モッツァレラ, ナス | バジル（ハーブ・香味） | 4 | 4 | 1 | **1** | **1** (ナス, バジル) | category |
| 6 | ペパロニ | トマトソース · モッツァレラ · ペパロニ | 3 | 1 | ペパロニ | トマトソース | モッツァレラ（チーズ） | 7 | 2 | 2 | 2 | — | T7 |
| 7 | サルシッチャ | トマトソース · モッツァレラ · ソーセージ | 3 | 1 | ソーセージ | トマトソース | モッツァレラ（チーズ） | 8 | 2 | 2 | 2 | — | T7 |
| 8 | ミートラヴァーズ | トマトソース · モッツァレラ · ベーコン · ハム · ペパロニ · ソーセージ | 6 | 4 | ハム | トマトソース, モッツァレラ, ベーコン, ペパロニ | ソーセージ（肉） | 6 | 5 | 1 | **1** | 3 | category |
| 9 | バンビーノ | トマトソース · モッツァレラ · ハム · コーン | 4 | 2 | コーン | トマトソース, モッツァレラ | ハム（肉） | 9 | 8 | 4 | 4 | 4 | T7 |
| 10 | ハワイアンピザ | トマトソース · モッツァレラ · ハム · パイナップル | 4 | 2 | パイナップル | トマトソース, モッツァレラ | ハム（肉） | 10 | 9 | 4 | 4 | 4 | T7 |
| 11 | カプリチョーザ | トマトソース · モッツァレラ · マッシュルーム · オレガノ · ハム · ブラックオリーブ | 6 | 4 | オレガノ | トマトソース, モッツァレラ, マッシュルーム, ハム | ブラックオリーブ（野菜） | 10 | 9 | 3 | 3 | **1** (マッシュルーム) | T7 |
| 12 | ピッツァ・ポルトゲーザ | トマトソース · モッツァレラ · ハム · たまご · たまねぎ · ブラックオリーブ | 6 | 4 | たまねぎ | トマトソース, モッツァレラ, ハム, たまご | ブラックオリーブ（野菜） | 11 | 10 | 3 | 3 | **1** (たまご) | T7 |
| 13 | フガッサ | オリーブオイル · たまねぎ · オレガノ | 3 | 2 | オリーブオイル | たまねぎ | オレガノ（ハーブ・香味） | 15 | 12 | 2 | 2 | 2 | T7 |
| 14 | マリナーラ | トマトソース · にんにく · オレガノ | 3 | 2 | にんにく | トマトソース | オレガノ（ハーブ・香味） | 16 | 13 | 2 | 2 | 2 | T7 |
| 15 | ナポリ | トマトソース · モッツァレラ · アンチョビ · オレガノ | 4 | 2 | アンチョビ | トマトソース, モッツァレラ | オレガノ（ハーブ・香味） | 16 | 14 | 3 | 3 | 3 | T7 |
| 16 | トンノ・エ・チポッラ | トマトソース · モッツァレラ · たまねぎ · ツナ | 4 | 2 | ツナ | トマトソース, モッツァレラ | たまねぎ（野菜） | 17 | 15 | 4 | 4 | 4 | T7 |
| 17 | ペストトンノピザ | ジェノベーゼソース · ツナ · ブラックオリーブ · たまねぎ | 4 | 3 | ジェノベーゼソース | ツナ, ブラックオリーブ | たまねぎ（野菜） | 18 | 14 | 3 | 3 | 2 | T7 |
| 18 | ジェノベーゼ | ジェノベーゼソース · モッツァレラ · チェリートマト | 3 | 1 | チェリートマト | ジェノベーゼソース | モッツァレラ（チーズ） | 20 | 2 | 2 | 2 | — | T7 |
| 19 | ニューヘイブンアピッツァ | オリーブオイル · パルミジャーノ · あさり · にんにく | 4 | 2 | あさり | オリーブオイル, パルミジャーノ | にんにく（ハーブ・香味） | 20 | 17 | 3 | 3 | 3 | T7 |
| 20 | ペストカプレーゼピザ | ジェノベーゼソース · モッツァレラ · トマト · バジル | 4 | 2 | トマト | ジェノベーゼソース, モッツァレラ | バジル（ハーブ・香味） | 21 | 18 | 3 | 3 | 3 | T7 |
| 21 | ペストパターテピザ | ジェノベーゼソース · モッツァレラ · じゃがいも · ベーコン | 4 | 2 | じゃがいも | ジェノベーゼソース, モッツァレラ | ベーコン（肉） | 22 | 19 | 4 | 4 | 4 | T7 |
| 22 | ピッツァ・ビアンカ | オリーブオイル · ローズマリー | 2 | 1 | ローズマリー | (none) | オリーブオイル（ソース） | 25 | 3 | 3 | 3 | — | T7 |
| 23 | プッタネスカ | トマトソース · アンチョビ · ブラックオリーブ · ケッパー · にんにく | 5 | 4 | ケッパー | トマトソース, アンチョビ, ブラックオリーブ | にんにく（ハーブ・香味） | 23 | 19 | 4 | 4 | 3 | T7 |
| 24 | クアトロ フォルマッジ | オリーブオイル · モッツァレラ · ゴルゴンゾーラ · パルミジャーノ · フォンティーナ | 5 | 0 | ゴルゴンゾーラ | オリーブオイル, モッツァレラ, パルミジャーノ | フォンティーナ（チーズ） | 25 | 1 | 1 | **1** | — | existence |

**Signature collisions among the 25:**

- **Structure** (N, topping count): 9 classes. The largest holds 9 recipes, and 5 recipes are unique.
- **T7 taxonomy multiset:** 21 classes, 17 unique.
- **Key + structure:** identifies the recipe for 22 / 25. The exceptions are margherita (no key), breakfast-pizza (2) and meat-lovers (3).

Recipe-level identification is **not the live risk** in the runtime. With the deterministic ladder, `recipes_makeable_undiscovered` is 1 at every step, so the player already knows there is exactly one target. **The meaningful risk is ingredient-level:** can the hint name the missing ingredient?

## 6. Structure hints: total vs remaining counts

### 6.1 Data (25)

| Measure | Distribution |
|---|---|
| Total ingredients N | 2: 1 · 3: 8 · 4: 10 · 5: 3 · 6: 3 |
| Topping total | 0: 1 · 1: 7 · 2: 12 · 3: 1 · 4: 4 |
| Cheese total = 0 | 5 recipes (fugazza, marinara, pesto-tonno, pizza-bianca, puttanesca-pizza) |
| Topping total = 0 | 1 recipe (quattro-formaggi) |
| Rule W reserve category | topping 17 · cheese 6 · sauce 1 |

### 6.2 Findings

- **A per-category total of 0 is a negative fact.** 「チーズは0種類」 is exactly `none:cheese`, which OD-H3-7 forbids. It happens in 6 / 25 recipes (5 cheese, 1 topping). Any per-category total must either never be sold when it is 0 (and a uniform refusal would itself leak) or be accepted as a negative fact by the Owner.
- **Counts give closure, not identity.** With the owned chips, a total says when the list is complete (「トッピングは2種類」 + 2 topping chips ⇒ no more toppings). That is negative inference by construction.
  - It never names an ingredient. On its own, a category count moves the endgame candidates from E base to +cat count: an average of **0.88 bits**, against 3.38 bits for a name.
  - It pins the missing ingredient only when the owned pool of that category is 1: bismarck, funghi (cheese), quattro-formaggi (cheese).
- **The whole-recipe total N is never 0** (min 2). It gives closure only for the recipe as a whole. It is the least risky structure fact.
- **The 172 scale:** structure identifies recipes only weakly. There are 19 structure classes over 172; the largest holds 40 recipes and only 2 are unique.

### 6.3 Total vs remaining

| | 「全部で2種類」 (total) | 「あと1種類」 (remaining) |
|---|---|---|
| Information, given the owned chips | Identical: remaining = total − known | Identical |
| Static? | Yes. A per-recipe fact, cacheable, persists as one id, never stale. | No. It changes with every purchase, so it must be recomputed. It is a *state* answer, not a fact. |
| Can it state 0? | Only per category (§6.2) | Yes at every level: 「あと0種類」 is an explicit "that's all", forbidden by OD-H3-7 / OD-H3-17 wording |
| Rule W | After all sellable facts, total − chips = 1 reveals the reserve's existence (paid inference) | 「あと1種類」 states the reserve's existence directly, every time |
| Near-miss overlap | None | Duplicates ADD_ONE / REMOVE_ONE (free, §11) and would make them redundant |

**Recommendation:** if counts are re-admitted at all, sell **totals, never remaining counts**, and prefer the **whole-recipe total** (`meta:ingredient-total`) over per-category totals. Per-category totals need the Owner to accept `…=0` as a negative fact (§17 OD-DH4-2).

## 7. Taxonomy candidate design (not authority)

### 7.1 Candidate classes

These are attribute classes for **toppings**. Sauce and cheese are already categories.

| T7 (runtime) | Runtime members (29 catalog) | T4 (coarse) |
|---|---|---|
| 肉 | sausage, pepperoni, bacon, ham | 肉・魚介 |
| 魚介 | anchovy, tuna, clam | 肉・魚介 |
| きのこ | mushroom | 野菜・果物 |
| ハーブ・香味 | basil, oregano, rosemary, garlic | ハーブ・香味 |
| 野菜 | cherry tomato, onion, black olive, capers, corn, eggplant, fresh tomato, potato | 野菜・果物 |
| 果物 | pineapple | 野菜・果物 |
| たまご | egg | その他 |

### 7.2 The 172 universe

This uses a keyword heuristic over the 181 normalized names. It is indicative only, and its categories and classes need an authored catalog.

| Class | Distinct ingredients |
|---|---:|
| sauce | 31 |
| cheese | 25 |
| 肉 | 20 |
| スパイス・薬味 | 18 |
| 魚介 | 17 |
| ハーブ・香味 | 11 |
| 果物 | 11 |
| ナッツ・種 | 6 |
| 甘味 | 6 |
| きのこ | 3 |
| たまご | 1 |
| 野菜・その他 (unmatched default) | 32 |

- Topping count per recipe, over 172: 0: 3 · 1: 25 · 2: 52 · 3: 62 · 4: 23 · 5: 6 · 6: 1.

### 7.3 Design rules for the taxonomy

1. **No class smaller than ~5 members** in the mature (172) universe. A 1-member class (たまご) or a 3-member class (きのこ) turns an attribute into a name, now or later. Merge them:
   - きのこ into **野菜・きのこ**;
   - たまご, ナッツ・種 and 甘味 into **その他**.
2. **A single level for the player**, about 7 classes: 肉 / 魚介 / 野菜・きのこ / ハーブ・香味 / 果物 / スパイス・薬味 / その他.
3. **Tags such as `cured`, `spicy`, `finishing` are not player-facing classes** in the first slice. They overlap (pepperoni = 肉 + cured + spicy) and multiply the leak surface.
   - `finishing` belongs to the future `finish:` technique row (Fresh Design §13), not to an attribute.
4. **Data-driven:** the class is a field on the ingredient catalog entry. It is authored once, validated by a test ("every class has ≥ N members at 172"), and never inferred at runtime.
5. **Sauce and cheese get no attribute class in the first slice.** Their category already is the attribute. Cheese subclasses (hard / blue / fresh) are a later option once there are ~25 cheeses.

## 8. Attribute-hint analysis

**Endgame (the Owner's case: only the reserve unknown), T7:**

- **7 / 24 recipes are name-equivalent**: bismarck, breakfast-pizza, funghi, melanzane-pizza, parmigiana-pizza, meat-lovers, quattro-formaggi.
- T4 gives the **same 7**. Coarser classes do not help early, because the owned pool is tiny.

**Fresh state, one attribute hint:**

- With T7, **5 / 24** recipes have a topping whose attribute alone names it: breakfast-pizza (たまご), melanzane-pizza (バジル), parmigiana-pizza (ナス, バジル), capricciosa (マッシュルーム), pizza-portuguesa (たまご).
- With T4, **4 / 24**.

**Information value (endgame, runtime average):**

| Hint | Bits |
|---|---:|
| Material name | 3.38 |
| Attribute (T7) | 2.29 |
| Category count | 0.88 |

The attribute is a real "deduction" hint: it removes about two thirds of a name's information.

**Root cause:** the name-equivalence comes from **inventory size**, not from taxonomy granularity. Early on the ladder the player owns 4–8 ingredients, so almost any true statement about the missing one pins it.

- At 172 maturity, the median attribute class has k ≈ 20 candidates. Only ~2 % of topping instances fall in a class of size < 2 under the heuristic.
- **The danger is concentrated in the first ~8 ladder steps.**

## 9. Rule W interaction

Rule W (OD-H3-5) keeps one reserve per recipe that is never revealed. The Owner's "last hint" is by construction a statement about the reserve, so three options exist:

| Option | Rule | Owner's "last hint" | Name-equivalent risk |
|---|---|---|---|
| **W-strict** | Attributes only for *sellable* facts (a cheaper partial reveal before the name). The reserve is never described at all. | ✗ (not about the last one) | None for the reserve |
| **W-attr (recommended)** | The reserve may be described by its attribute, **answered at the finest level with ≥ 2 owned candidates** (T7 → category → existence) | ✓ | None at purchase time (§10.3) |
| W-open | The reserve's attribute is always told (T7) | ✓ | 7 / 24 name-equivalent. **Rejected.** |

## 10. FREE LEAK vs PAID INFERENCE

### 10.1 Classification

- **FREE LEAK (forbidden):** anything derivable **before paying** from the UI structure. Examples:
  - a 構成/特徴 control shown for some recipes only;
  - a disabled button when nothing is left;
  - a price that depends on availability;
  - near-miss text naming an attribute.
- **PAID INFERENCE (allowed, OD-H3-16):** what the player deduces from facts they paid for, including closure from a bought total.
- **NAME-EQUIVALENT PURCHASE (flagged):** a single high-level hint (an attribute or a count) whose answer leaves exactly one owned candidate. It is paid, but it is equivalent to selling the name.
  - W-open would be name-equivalent for 7 / 24 recipes at the endgame (§8).
  - A single fresh-state attribute would be name-equivalent for 5 / 24.

### 10.2 Structure (B) under the same lens

- A per-category total with value 0 is a direct negative fact. It is neither FREE LEAK nor PAID INFERENCE: it is **a sold negative fact** (OD-H3-7).
- Totals ≥ 1 give PAID INFERENCE closure.
- The reserve category is name-equivalent for 3 / 24 recipes (bismarck, funghi, quattro-formaggi), where the owned pool of that category is 1.

### 10.3 Proposed k-anonymity rule for attribute answers (W-attr)

1. The answer is computed **at request time** from the owned inventory, which the player knows.
2. The finest level whose class has **≥ 2 owned, not-yet-known candidates** in the same category is answered:
   - T7 (「肉系の材料があるよ」);
   - else the category (「トッピングがまだあるよ」);
   - else existence only (「まだ使う材料があるよ」).

**Runtime result (24 recipes):** T7 17, category 4, existence 3. **No purchase is name-equivalent at the moment of purchase.**

**Properties:**

- **Monotone safe:** buying more materials only grows the pool, so an answer never becomes name-equivalent later by itself.
- **The answer level is a function of the owned inventory**, so it leaks nothing the player cannot compute.
- **Uniform before purchase:** the 特徴 control is shown for every target, at a price that does not depend on availability.
- **Existence** 「まだ使う材料があるよ」 is a positive fact. It is never "that's all", so OD-H3-17 wording holds.
- **Open point:** the fallback wording itself hints at the pool size ("only the category was told"). This is PAID INFERENCE; the Owner confirms it is acceptable (OD-DH4-3).

## 11. Near-miss interaction

**Today** (`resultNearMiss`, unchanged by H3-3 / H3-4):

- The fixed copies are ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE / FAR_KEY_UNUSED.
- They are computed from the **player's own pizza** against DISCOVERABLE candidates. They name no ingredient and read no hint ledger.

**ADD_ONE is already a free "remaining count = 1" relative to the player's pizza.** That is legitimate experimental feedback: the player built that pizza. It means:

- a *remaining count* hint would be redundant with near-miss (§6.3);
- combining ADD_ONE (free) with a paid attribute gives the §5 "both" numbers:
  - with W-open, name-equivalent for 7 / 24;
  - with W-attr, never below 2 candidates.

**Rules proposed:**

1. Near-miss copy stays **fixed and attribute-free**. It never says 「肉系が足りない」 (that would be a FREE LEAK).
2. Near-miss never reads the attribute or structure ledgers (the same as today for `discoveryHintFacts`).
3. A future "combined" line (near-miss + an owned attribute fact) may only restate facts the player already paid for, e.g. 「あと1つ。買ったヒント：肉系」. This is an Owner decision (OD-DH4-7), not needed for the first slice.

**Example asked by the Owner:** near-miss 「あと1種類」 + hint 「肉系の材料が関係ありそう」.

- For bambino and hawaiian (reserve ham) the T7 pool is 4 (≥ 2) → PAID INFERENCE, fine.
- For meat-lovers the T7 pool of 肉 is 1 → W-attr answers at the category level (「トッピングがまだあるよ」) instead of naming 肉.

## 12. UI alternatives (the iPhone vertical budget)

**Budget today** (H3-4 measured): the sheet is ≤ 45dvh.

| Viewport | Sheet | Body | Footer |
|---|---:|---:|---:|
| 390×844 | 380 px | 143–172 px | 132 px |
| 360×640 | 288 px | 80 px | 132 px |

Row additions do not fit at 360×640, so each alternative switches or folds. The heights below are estimates (the same CSS primitives as H3-4); they are not measured.

| | **U1. Tabs** [材料][構成][特徴] at the top of the body | **U2. One board + 2-level picker in the footer** | **U3. Ask menu** (the CTA opens a small chooser) | U4. Staged kinds (unlock in order) |
|---|---|---|---|---|
| Layout | A tab bar (~36 px) replaces the H0 line. Each tab shows its own rows (material chips / count badges / attribute tags) and its own picker. | The board shows everything known in one place: chips, a count badge on the row label, attribute tags on 「？」 slots (「？ 肉系」). The footer picker has a kind segment plus a category segment. | The board as in U2. The footer has one CTA, 「ヒントをもらう」 → an action sheet: 材料 (ソース/チーズ/トッピング) · 構成 · 特徴 → the price shown in the sheet → confirm. | The 特徴 / 構成 kinds appear only after a stage (Dex N or all materials bought) |
| 390×844 | OK | OK (+44 px footer) | OK (footer −44 px) | OK |
| 360×800 | OK | Tight (body ~108 px) | Best | OK |
| 390×664 / 360×640 | Body ~44–55 px. The rows of one tab only; other tabs' knowledge is hidden. | Body ~36–47 px. **Too tight.** | Body ~124 px. **Best.** | — |
| Taps per purchase | 2 (tab, CTA) + choice | 2–3 | 3 (CTA, kind, confirm) | 2 |
| Information density | Split: never shows all knowledge at once | **Highest:** all knowledge on one board | High (U2 board, compact footer) | Medium |
| First-time clarity | Good. Tabs are familiar. | Medium: two segments to read | **Good:** one button, then a plain choice | Good |
| Privacy | Safe if every tab renders for every target, uniform | Safe (uniform) | Safe (the menu is uniform) | **Risky:** "all materials bought" as an unlock trigger leaks exhaustion. It is only safe with a Dex / time gate. |
| 172 / 105+ scalability | Rows grow per tab | The board grows | The board grows, the menu stays small | — |
| Future Technique (D) | +1 tab (4 tabs at 360 px ≈ 80 px each, OK) | +1 segment (crowded) | +1 menu item (**easiest**) | +1 stage |

**Recommendation:**

- **U3 (ask menu) on the U2 board.** Everything the player knows stays visible in one place, the purchase path gets a plain chooser, the footer becomes smaller than today (this helps 360×640), and Technique Hints add a menu item rather than more layout.
- U1 is the runner-up. It is familiar, but at 360×640 it hides knowledge behind tabs.
- U4 only as an additional Dex gate (e.g. 特徴 from Dex 8+), never as an availability gate.

## 13. 172-recipe scalability

- **Recipe identity.** Selling a recipe's **full** taxonomy multiset would identify 105 / 172 (126 classes, 105 unique).
  - **Rule:** attributes are sold **one unknown at a time**, never as a signature.
  - The same rule applies to structure. Selling (N, topping total) together is weakly identifying (19 classes), but combined with material facts it narrows fast. Price and cap it with material facts (economy phase).
- **Class sizes at maturity:** the median k ≈ 20. The 1–3-member classes (たまご, きのこ) must be merged (§7.3).
- **Inventory-driven risk:** early-ladder name-equivalence stays a structural property at any recipe count. That is why the k-anonymity rule (§10.3) is recommended over any fixed granularity.
- **Catalog work:** each of ~181 ingredients needs a category + class authored in the ingredient catalog, validated by tests. The heuristic here left 32 names in a default bucket.
- **Performance:** answers are O(owned inventory) per request. That is trivial.

## 14. Relation to Recipe Discovery / Technique Discovery

- The OD-H3-12 fact grammar (`ing:` / `none:` / `finish:` / `shape:` / `pan:` / `tech:` / `cook:`, Fresh Design §13) already anticipates technique rows.
- This design adds `meta:` (structure) and `attr:` (attribute) as **new kinds**. Rows and families are data-driven, so a **D. 技法ヒント** family can reuse:
  - the same ask-menu entry (U3);
  - the same uniform-presentation rule (a family is offered for every target once its mechanic exists in the runtime);
  - the same Rule W generalization (the reserve is picked from the highest-entropy row present);
  - the same k-anonymity rule. A technique attribute such as 「生地を折る工程があるよ」 is answered only if ≥ 2 owned techniques fit.
- Recipe Discovery stays the only way to *get* a recipe. No hint family ever sells a recipe (principle 1).

## 15. Economy implications (no number changes)

- ESC 5 / 10 / 20 / 40 and the caps 35 / 75 are **unchanged**. No price is proposed here.
- **Relative information value** (§8), as input for the economy phase:
  - a material name ≈ 3.4 bits;
  - an attribute ≈ 2.3 bits;
  - a category count ≈ 0.9 bits;
  - a whole-recipe total is below that (it only closes the list).

  A fair economy would price attribute < material and structure ≤ attribute. Whether they share the ESC ladder (one rung per hint of any family) or have their own is an Owner decision for **H3-ECON-1 / DH4-ECON**.
- **Cap interaction:** if new families spend the same per-recipe cap, a player could exhaust the cap on cheap attributes and then get names at 「支払いずみ」 (the H3-4 0-Pitz semantics). The economy phase must decide whether new families consume the cap.

## 16. Migration / legacy implications

- **grandfatheredSteps** stay verbatim (the existing right, OD-H3-4-4). A legacy H2/H3 line 「材料は全部で4種類。チーズを使うみたい」 already *is* `meta:ingredient-total` (+ uses cheese).
  - **Proposal:** a player holding that legacy line is treated as owning `meta:ingredient-total` (never resold). This is derived like `grantedFactIds`, never written.
  - 「チーズは使わないみたい」 is a legacy negative line and is **not** turned into any fact.
- **The new ledger:** new kinds live in the same `discoveryHintFacts` list as ids (`meta:…`, `attr:…`). H3-2 already keeps unknown and future ids verbatim, and H3-1 already ignores kinds it cannot show.
  - schemaVersion 2 can stay.
  - **Caveat:** an attribute answer is state-dependent (k-anonymity level), so the stored id must be the answered value (`attr:topping:肉`, `attr:topping:any`), not a pointer to an ingredient.
- **Legacy price rung** (`LegacyHintProgress`): unaffected unless the economy phase makes new families spend rungs.
- **Onboarding (Dex-0 Margherita):** unaffected (OD-H3-4-8).

## 17. Owner Decisions required

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **OD-DH4-1** | Name and tracking | (a) **Discovery Hint 4.0 — Deduction Hints** under a new issue · (b) H3-5 Structure & Attribute Hints under #238 | **(a).** It re-opens OD-H3-2 / 7 / 15 and Rule W and adds new fact kinds and a new UI model, which is beyond a 3.x slice. #238 is expected to close once H3-4 (its last listed slice) merges. |
| **OD-DH4-2** | Structure (B) | (a) whole-recipe total only (`meta:ingredient-total`, never 0) · (b) + topping total (accept 「0種類」 for quattro-formaggi as a sold negative) · (c) + all per-category totals (accept `none:` negatives for 6 / 25) · (d) keep forbidden | **(a)** first; (b) only if the Owner accepts one negative case. **Never remaining counts.** |
| **OD-DH4-3** | The attribute of the Rule W reserve | W-strict / **W-attr (k ≥ 2 fallback)** / W-open | **W-attr.** W-open is name-equivalent for 7 / 24. |
| **OD-DH4-4** | Taxonomy | The ~7-class merged set (§7.3) · T4 · other | **The ~7-class merged set**, toppings only, catalog-authored, a class-size test |
| **OD-DH4-5** | Who picks the attribute target | (a) **the system** (the next unknown by the category preference + fixed order, as material facts) · (b) the player asks a yes/no question (「肉系ある？」) | **(a).** (b) makes "no" answers negative facts. |
| **OD-DH4-6** | UI model | U1 / U2 / **U3 on the U2 board** / U4 | **U3 + U2 board**, with a scratch prototype measured at 4 viewports before authority |
| **OD-DH4-7** | Near-miss | (a) **unchanged, fixed** · (b) may restate owned attribute facts | **(a)** for the first slice |
| **OD-DH4-8** | Legacy count lines | Treat as owned `meta:ingredient-total` / no | **Yes** (derived, never written) |
| **OD-DH4-9** | Economy | New families on the ESC ladder / a separate ladder / outside the cap | **Decide in H3-ECON-1 / DH4-ECON**, after the pure audit. **No numbers now.** |
| **OD-DH4-10** | The attribute answer's fallback wording is visible | Accept as PAID INFERENCE / hide the level | **Accept.** The level is a function of the player's own inventory. |

## 18. Recommended next implementation slice (after the Owner decisions)

**DH4-1 — pure layer, unwired** (the same pattern as H3-1):

1. The ingredient catalog gets an `attributeClass` field for the 29 runtime toppings. A test enforces the class list and the minimum class size against the 172 catalog plan.
2. A pure `structureFacts(recipe)` gives `meta:ingredient-total` (and `meta:topping-total` if OD-DH4-2 (b)).
3. A pure `attributeAnswer(model, owned, known)` implements the k ≥ 2 fallback (T-class → category → existence). It is deterministic and never names an ingredient.
4. A mechanical audit test over the 25 (this report's numbers) asserts:
   - no purchase is name-equivalent at purchase time;
   - no per-category 0 is sold unless OD-DH4-2 allows it;
   - the presentation is uniform for every target.
5. No reducer, persistence, UI or pricing change.

DH4-2 (runtime + UI prototype per OD-DH4-6) and DH4-ECON follow. H3-4 (PR #251) should be merged first; it is independent.

## 19. Non-goals (this Fresh Design)

- Any production code, test, CSS, reducer, persistence, pricing or authority change.
- Any change to PR #251 beyond its docs addendum (Owner Finding, Preview record).
- Selling recipes, or selling the Rule W reserve by name.
- Remaining-count hints; yes/no attribute questions; attribute-bearing near-miss copy.
- Tags (`cured`, `spicy`, `finishing`) as player-facing classes in the first slice.
- Technique Hint implementation (only the compatibility of the frame).
- Economy numbers (H3-ECON-1 / DH4-ECON).
- DM-3R-2 / PR #252, Dinner, PR #243.

## 20. Verdict

**A. FRESH DESIGN READY FOR OWNER DECISIONS.**

The mechanical audit is complete for the 25 runtime recipes and indicative for the 172. The risks are quantified:

- name-equivalence 7 / 24 (endgame, attribute of the reserve) and 5 / 24 (fresh, one attribute);
- a sold negative for per-category 0 in 6 / 25;
- counts at 0.88 bits against 3.38 bits for a name.

A rule that keeps every purchase non-name-equivalent is proposed (the k ≥ 2 fallback). OD-DH4-1…10 decide the phase.

**More audit is needed only for the 172 catalog authoring** (the 32 unclassified names). That belongs in DH4-1's catalog work, not before the decisions.
