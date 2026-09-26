# Discovery Hint 3.0 — Selectable Recipe Hint: Fresh Audit / Fresh Design

**Status: design only. Nothing here is implemented.** No production code, CSS, or save schema was
changed. No PR was opened or merged. Dinner Mission (Issue #236 / PR #237) was not touched.

Deliverables:

- This report.
- `docs/reports/data/TETO_DISCOVERY-HINT-3_SELECTABLE_25-RECIPE-MATRIX.json`: the machine-readable
  25-recipe slot matrix, generated from runtime data.
- `docs/reports/data/TETO_DISCOVERY-HINT-3_SELECTABLE_SIM-TABLES.md`: the full pricing
  simulation tables (★4 / ★3 / ★1, 35 runs each, plus a per-stage table).

Verdict: **A. READY FOR OWNER DECISIONS** (§16).

---

## 1. Audited main SHA and GitHub state

- `origin/main` = **`42feec70f4e2b659c590b1c236116c0bf579200a`** (Merge PR #235, Lunch Rush
  material-shortage skip). I fetched it fresh at session start. The work branch
  `claude/discovery-hint-3-selectable-audit-w3ebl2` started at the same SHA.
- Open PRs: #237 (Dinner Mission DM-1, being handled in another session, **not touched**) plus older
  docs/audit PRs (#221, #220, #219, #218, #217, #214, #211, #209, #208, #205, #204, #105, #72, #46,
  #34, #3). None of them touches `src/logic/discovery/**`, `src/state/discoveryHint.ts`,
  `HintSheet.tsx` or `discoveryHintPurchases`.
- No issue or PR exists yet for Discovery Hint 3.0. Discovery Hint Economy 1.0 (Issue #232) is in
  production on `main`.

## 2. Current facts: Discovery Hint 2.0 + Hint Economy 1.0 (runtime truth at `42feec7`)

| Item | Runtime value | Source |
|---|---|---|
| Hint lines | H0 existence → H1 key ingredient → H2 sauce (or the coarse 「ソースはトマトじゃないみたい」; when the key *is* the sauce, H2 becomes count+cheese) → H3 「材料は全部でN種類。チーズを使う/使わない」 → H4 every remaining ingredient except the last one (several lines, **one** level) | `src/logic/discovery/hintSteps.ts` `buildHintSteps` |
| n-1 cap | At most `distinct − 1` ingredients are ever named. The only exception is the Dex-0 Margherita onboarding. | `buildHintSteps` |
| Max level | **3** for the 8 recipes with ≤ 3 distinct ingredients, **4** for the 17 with ≥ 4 | matrix `currentMaxHLevel` |
| Prices | H1 5 / H2 10 / H3 20 / H4 40 Pitz. H0 free, no H5. Full set **35** (max H3) or **75** (max H4). The 24 paid targets cost **1480** Pitz in total. | `src/logic/discovery/hintPurchase.ts` `DISCOVERY_HINT_PRICES` |
| Purchase rule | `requestedLevel === purchased + 1`, checked in the reducer (`PURCHASE_DISCOVERY_HINT`). A double tap or a stale event is rejected, levels cannot be skipped, and the balance never goes negative. | `purchaseDiscoveryHint`, `unlockNextHint` |
| Ledger | `discoveryHintPurchases: Record<recipeId, highestLevel>`, save `schemaVersion: 2`. Merged per id with `max` (never lowered). Unknown well-formed recipe ids survive through `extractForwardCompatExtras`. Levels above 4 are kept (no upper bound in the sanitizer) and clamped at read time. | `src/state/persistence.ts` |
| Onboarding | Dex 0 + Margherita is free, session-only, and never written to the ledger. `preDiscoveryFreeCookAttempts` auto-escalates the reveal. | `isHintOnboardingFree`, `autoHintIndex` |
| Target | Only a DISCOVERABLE recipe can be a target. Order: `recipeKeyStep` asc → distinct count asc → declaration index. Dex-card pin (229-D) and a sticky/purchased target are supported. | `src/logic/discovery/hintTarget.ts` |
| Near-miss | Shown on the Free Cooking RESULT only: ADD_ONE / REMOVE_ONE / SAUCE_ONLY (d=1), CLOSE (d=2), FAR_KEY_UNUSED. It never names a recipe or an ingredient. | `src/state/resultNearMiss.ts`, `src/logic/discovery/nearMiss.ts` |
| Sheet | `position: fixed` bottom sheet, `max-height: 45dvh` (380 px at 390×844, 360 px at 800 tall), scrollable step list, CTA 「🔒 次のヒントを解除 N Pitz」 + 「所持 N Pitz」 | `src/components/HintSheet.tsx`, `App.css .hint-sheet*` |
| Full Reset | `resetSave()` removes the whole save key, ledger included | `persistence.ts` |

## 3. Critical Audit 2 — what is a hint slot? (runtime identity)

The discovery identity is read from the code (`signature.ts`, `discoveryCatalog.ts`,
`matcher.ts`), not assumed:

- **Identity = the unordered ingredient set, including the one base sauce** (`items` is
  `[...new Set(ids)].sort()`, and `sauceBase` is a separate sorted subset).
- **`minCount` is not identity.** It is the Completion Gate's question (`ingredientCounts` is
  documented as "Not identity"). **Placement order is not identity** ("Order of placement never
  matters").
- The 11 Phase-2 dimensions (dough, pan, layerOrder, zones, late, prep, enclosure, shape, cook,
  laminate, spreadLayers) are all `FIXED_BY_FLOW` or `UNAVAILABLE` at their DEFAULT for all 25
  recipes. `RUNTIME_SUPPORTED_CAPABILITIES = []`.
- **CUT is not identity**. The signature doc lists CUT lines as excluded. 24/25 recipes have a CUT
  step (`new-haven-apizza` has none), always with 6 slices. The cooking profile steps
  (DOUGH/SAUCE/CHEESE/TOPPING[/CUT]) are *derived* from the ingredient categories, so they add no
  information beyond the categories themselves.

**Hint slots that exist in today's runtime:** sauce (exactly 1 per recipe for all 25), cheese
(0–4), topping (0–4), and the ingredient count. **No slot exists** for shape, cooking method,
finishing, post-bake topping, pan or CUT, because none of them is identity today. Selling a
"CUT" or "shape" hint would sell a fact that cannot distinguish any recipe. The taxonomy reserves
them for later (§13).

25-recipe shape (from the matrix; `cheeses, toppings`):

| (cheese, topping) | Recipes |
|---|---:|
| (1, 2) | 9 |
| (1, 1) | 6 (bismarck, funghi, genovese, salsiccia, pepperoni, margherita) |
| (1, 4) | 3 (capricciosa, meat-lovers, pizza-portuguesa) |
| (0, 2) | 2 (marinara, fugazza) |
| (4, 0), (0, 1), (2, 2), (0, 3), (0, 4) | 1 each: quattro-formaggi, pizza-bianca, parmigiana, pesto-tonno, puttanesca |

**5 of 25 recipes are uniquely identified by their slot shape alone.**

## 4. Critical Audit 3 — order / identity

The ingredient set is **unordered** in the identity. The only orderings in the code are:

- `requiredIngredients` declaration order: authoring order, which drives H4's line order and the
  n-1 "last one withheld".
- `hintKeyIngredientId`: the latest-unlocked ingredient of the ladder, which is H1.
- The fixed making-flow order DOUGH→SAUCE→CHEESE→TOPPING. This is a category order, not an order
  of ingredients.

A 「トッピング① / ② / ③」 UI would therefore **invent an ordering that does not exist**, and it would
also imply a slot count (§5). The design keeps three things separate:

| Concern | Design |
|---|---|
| **Slot id (persistence)** | Semantic and order-free: `ing:<ingredientId>`, `none:<category>`, `sauce:not-tomato`, `meta:ingredient-count`. It never uses a positional id like `topping-2`. |
| **Deterministic reveal order inside a row (internal)** | Key ingredient first when it is in that row, then `requiredIngredients` declaration order. This is the same key-first rule as today's H1, so the withheld ingredient stays the same (§6.2). It is never shown as ①②③. |
| **Semantic category (display)** | A row per category: ソース / チーズ / トッピング / 材料の数. Revealed ingredients show as chips inside their row. The next unrevealed one is 「＋？？？」, never 「トッピング③」. |

## 5. Critical Audit 1 — slot information leak (A / B / C / D)

Method (matrix `slotCountLeak`): for each recipe's discovery stage `k` (its `recipeKeyStep`), the
owned pool is the 3 starters plus every ladder material up to step `k`. I counted every candidate
identity (1 owned sauce × any owned cheeses × any owned toppings, 1–5 non-sauce items), then
counted how many candidates stay consistent with what each model shows **for free**. I also ran a
variant where the player uses the Shop's NEW-material notice, so the key must be included.

| Recipe (stage) | Candidates, no free info | **A** exact slot count | bits leaked by A | A′ category presence | bits A′ |
|---|---:|---:|---:|---:|---:|
| bismarck (1) | 7 | 2 | 1.81 | 3 | 1.22 |
| funghi (3) | 31 | 4 | 2.95 | 15 | 1.05 |
| salsiccia (7) | 381 | 14 | 4.77 | 259 | 0.56 |
| capricciosa (11) | 3472 | 990 | 1.81 | 1884 | 0.88 |
| genovese (18) | 49 989 | 102 | **8.94** | 21 777 | 1.20 |
| pizza-bianca (22) | 133 653 | 63 | **11.05** | 83 685 | 0.68 |
| quattro-formaggi (24) | 251 043 | **3** | **16.35** | 45 | 12.45 |

(All 25 are in the matrix. With the Shop-NEW prior, A leaks 1.7–13.9 bits.)

- **A (show real slots)**: this gives away **cheese count and topping count**. That is a strict
  superset of today's H3 line (「全部でN種類・チーズを使う」), which currently costs 20 Pitz (35
  cumulative), and it shows the information before anything is bought. It uniquely identifies 5
  recipes among the 25 and cuts late-game candidates by 2⁶–2¹⁶. **Rejected.**
- **B (generic 「具材ヒント / 追加ヒント」 slots, counts hidden)**: no free leak, but the player cannot
  choose *what* to learn ("トッピングだけ知りたい" is impossible). That fails the core goal.
  **Rejected as the primary model.**
- **A′ (show only the categories present)**: this leaks cheese yes/no (0.5–1.6 bits, and 12 bits
  for quattro-formaggi). **Rejected**: the cheese row must always render.
- **C (fixed category rows, always the same 4 rows for every recipe)**: **0 bits free**, and the
  player chooses by category. **Recommended as the base (§6).**
- **D (recommended)**: C plus a *repeatable* row. Each purchase of a row reveals "one more
  ingredient of this category, or 「使わない」". Every row always renders. Row closure is neutral
  (§6.3). This is the model specified in §6.

## 6. Recommended slot model — "Category rows + fixed reserve" (D)

### 6.1 Sellable facts per recipe (Dex ≥ 1)

```
ソース   : ing:<sauce>                        (1 fact; pizza-bianca: sauce:not-tomato, §6.2)
チーズ   : ing:<cheese>… | none:cheese         (repeatable; "使わない" is itself a fact, same price)
トッピング: ing:<topping>… | none:topping      (repeatable)
材料の数 : meta:ingredient-count               (1 fact; today's H3 count half)
```

A row with nothing left to sell closes with the same neutral copy in every case. There is **no**
"これで全部" (END) fact for sale. Sellable facts per recipe range from 3 to 6 (matrix
`proposedSelectableFacts`).

### 6.2 The n-1 cap under player choice — a finding that changes the design

First simulation (the `OPEN` variant: a global n-1 cap with the player choosing the order, plus
sold END facts): with the order in their hands, a buyer **always leaves the lowest-entropy
ingredient** (usually mozzarella) as the withheld one. Combined with END/count facts, the answer
becomes fully deducible:

| ★3 | Buy-all bakes to Dex 25 | Need-based bakes |
|---|---:|---:|
| Current H1–H4 (CUR-P4 / CUR-P2) | 199 | 338 |
| OPEN selectable (buy all / need-based) | **49** | 120 |

Example: pesto-caprese took 20 experimental bakes under current H4 and 1 under OPEN. The cap had
stopped protecting anything.

**Fix: Rule W, a fixed reserve.** The reserved ingredient is fixed per recipe: the last non-key
ingredient in declaration order of the highest-entropy category present (topping > cheese >
sauce). It is never sold at Dex ≥ 1. **It equals the ingredient current H4 withholds for 25/25
recipes** (matrix `summary.reservedEqualsCurrentWithheld = 25`), so Hint 3.0 keeps today's anti-spoiler
guarantee exactly. END facts are dropped. With Rule W, buy-all at ★4 gives 1480 Pitz / 109 bakes,
**identical to current H1–H4** (§9).

Pizza-bianca (2 ingredients: olive-oil + rosemary(key)): the reserve is the sauce, so the sauce row
sells only `sauce:not-tomato`. That is today's H2 rule.

### 6.3 Residual, accepted information

Row closure: when a row has nothing left to sell, it closes. For the topping row, closure is
ambiguous between "only the reserved one remains" and "no more toppings", so it matches today's
「ヒントはここまで」. For the cheese row, closure after one cheese tells a buyer the cheese set is
complete. That is low-entropy (22/25 recipes use only mozzarella or no cheese) and paid for (they
bought the cheese fact). The simulation conservatively gives the player no credit for closure, so
the real effect is slightly more help than modeled. → **OD-H3-6**.

### 6.4 Key ingredient

Today's H1 (the key) is almost worthless because the Shop's NEW notice already tells the player the
new material. Harness evidence: CUR-P1 buys H1 on every recipe (115 Pitz) and needs **446** bakes,
vs **438** for P0. With the key shown free (`K0` variant): 424 bakes for a non-buyer, and a
1-fact buyer drops from 332 to 280 bakes. The key stays first in its row either way, so the reserve
does not move. → **OD-H3-4** (keep it as a paid fact, or make it a free line).

## 7. Purchase model and pricing authority

### 7.1 Models compared

| Model | Rule | Bypass-proof? | Order-invariant total | Notes |
|---|---|---|---|---|
| **A** batch-size price (1=5, 2=15, 3=30, 4=50) | price depends on how many are ticked **in this tap** | **No.** 3 separate taps = 5+5+5 = 15 < 30 | No | The user's literal idea. It breaks the moment someone buys one at a time. **Rejected.** |
| **B** cumulative ladder per recipe | the k-th fact bought *for this recipe* costs `ladder[k]` | **Yes.** A batch of m = Σ of the next m rungs = the same m bought one by one | **Yes** (depends only on the count) | The CTA total still grows with how many are ticked, which keeps the user's intent. |
| **C** independent per-slot price (FLAT10 / VALUE) | fixed price per row | Yes | Yes | Needs an explicit cap to keep the 35/75 ceiling. VALUE (sauce/cheese 5, topping/count 10) is the cheapest overall (800 full). |
| **D** hybrid (category price × cumulative multiplier) | … | Yes | **No.** Buying expensive rows first at low multipliers is gameable | **Rejected**: players can game the order. |

### 7.2 Recommended pricing authority — `ESC_PARITY` (model B with a parity cap)

```
price(recipe, k) = max(0, min(LADDER[min(k,4)], CAP(recipe) − S(k−1)))
LADDER = [5, 10, 20, 40]          (the existing DISCOVERY_HINT_PRICES, unchanged)
CAP    = 35 if distinct ingredients ≤ 3 else 75   (= today's full cost of that recipe, 25/25)
S(n)   = Σ price for the first n facts
batchPrice(recipe, m) = Σ_{j=1..m} price(recipe, k0 + j)   (k0 = facts already counted)
```

- **Bypass-proof by construction**: the batch price is exactly the sum of the sequential prices.
- **Parity**: no recipe ever costs more than today, and the full set costs exactly today's 35/75.
  24-target total: **1480 = current 1480**. ESC75 without the cap would be 1600, because marinara,
  fugazza and pizza-bianca have 4 facts and would jump 35 → 75.
- The reducer is the only authority. It recomputes `k0`, the offered facts and the price from state
  and never trusts the UI's number. It is the same "pure rule, reducer only applies it" pattern as
  `purchaseDiscoveryHint`.
- Double tap and stale events: the action carries `{ rows: Row[], expectedOwnedCount }`, and any
  mismatch is rejected. The batch is all-or-nothing, and affordability is checked on the total.

## 8. Current 75-Pitz model vs candidates (full unlock, per recipe)

| Recipe group | Current | ESC_PARITY | ESC75 | FLAT10 | VALUE |
|---|---:|---:|---:|---:|---:|
| 3 facts (genovese, bismarck, funghi, salsiccia, pepperoni) | 35 | 35 | 35 | 30 | 25 |
| marinara, fugazza, pizza-bianca (≤3 ingredients, 4 facts) | 35 | **35** | 75 | 40 | 30 |
| 4 facts, ≥4 ingredients (napoletana, tonno, breakfast, melanzane, bambino, hawaiian, new-haven, pesto-caprese, pesto-patate) | 75 | 75 | 75 | 40 | 30 |
| 5 facts (parmigiana, pesto-tonno) | 75 | 75 | 75 | 50 | 35–40 |
| 6 facts (quattro-formaggi, capricciosa, meat-lovers, portuguesa, puttanesca) | 75 | 75 | 75 | 60 | 40–50 |
| **Total, 24 paid targets** | **1480** | **1480** | 1600 | 1030 | 800 |

Per-recipe values, including the key-free variants, are in the matrix `candidateFullCost`.

## 9. Economy simulation

Harness: a scratch copy of `discoveryHintEconomySim.ts` (Economy 1.0 Fresh Audit), **not
committed**. Bakes, rewards (incl. the +50 first-discovery bonus), Shop packs and refills,
inventory, the matcher and near-miss all run through the **real reducer**. Only the hint debit is
simulated. `CUR-*` reproduces the Economy 1.0 numbers exactly (Fresh Audit table ★3: P5 = 216 bakes / 1100
Pitz, P0 = 438; Result report ★4: P4 = 1480 / 109), which validates the harness. The Shop, pack sizes, rewards and ★1 burden are
unchanged.

Profiles (selectable; Dex 0 onboarding is free in every run):

- **S0**: never buys.
- **S1**: buys 1 topping fact per recipe, up front.
- **S2**: need-based, ≤ 3 facts per recipe. Up front: 1 topping, plus the sauce only when the player
  owns more than one sauce. After a failed bake, the near-miss picks the next fact: SAUCE_ONLY →
  sauce, REMOVE_ONE → count, otherwise topping.
- **S3**: buys everything sellable, up front.
- **S4**: aggressive and reactive. 1 topping up front, then 1 more fact after every failure (the
  counterpart of CUR-P5).

Headline (**★3, Q65**; full tables for ★4 / ★1 are in the SIM-TABLES file):

| Profile | Current H1–H4 | | ESC_PARITY (recommended) | | ESC_PARITY + key free | |
|---|---:|---:|---:|---:|---:|---:|
| | hint Pitz | **bakes** | hint Pitz | **bakes** | hint Pitz | **bakes** |
| No hints (P0 / S0) | 0 | 438 | 0 | 438 | 0 | 424 |
| 1 item (P1 / S1) | 115 | 446 | 120 | 332 | 40 | 280 |
| Needed items (P2 / S2) | 360 | 338 | 640 | **166** | 530 | 122 |
| All items (P4 / S3) | 1120 | 199 | 1020 | 135 | 840 | 177 |
| Aggressive (P5 / S4) | 1100 | 216 | 1090 | 166 | 730 | 132 |

★4 full buy: CUR-P4 **1480 Pitz / 109 bakes**, ESC_PARITY-S3 **1480 / 109**, identical.
★1: CUR-P5 657 bakes vs ESC_PARITY-S4 373. The ★1 Shop burden is pre-existing and unchanged. At ★1,
every profile still ends with Pitz ≥ 0 and no hard deadlock.

Other pricing at ★3, need-based S2: FLAT10 151 bakes / 590 Pitz, VALUE 147 / 475, ESC75 166 / 640.
OPEN (rejected, §6.2): 120 / 600, and buy-all 49.

Reading:

1. The same Pitz buys **much more useful information** when chosen. A need-based buyer reaches
   Dex 25 in about half the bakes (338 → 166) for 640 Pitz, less than the current aggressive
   buyer's 1100. This is the "必要な情報だけ買う" goal, now measured.
2. Shop spend falls with fewer experimental bakes (need-based: 5500 → 3600), because fewer failed
   pizzas consume stock. The Pitz sink moves partly from the Shop to hints. Ending balances are
   130–190 (★3) in all profiles, so no new wall appears.
3. Hard deadlock is 0 and min Pitz ≥ 0 in every run (all 3 qualities × 35 runs, asserted).

## 10. Persistence and migration proposal (not implemented)

### 10.1 Shape (schemaVersion **stays 2**)

```jsonc
{
  "schemaVersion": 2,
  "discoveryHintPurchases": { "funghi": 2 },            // UNCHANGED legacy ledger; new builds never write it
  "discoveryHintFacts":     { "funghi": ["ing:mushroom", "ing:tomato-sauce"],
                              "tonno-e-cipolla": ["meta:ingredient-count"] }  // NEW optional top-level key
}
```

- **schemaVersion 2 is kept.** The key is optional and additive (same as how
  `discoveryHintPurchases` was added in HE-1). Old builds keep unknown top-level keys verbatim
  (`extractForwardCompatExtras.topLevel` → `writeSave`), so an old tab cannot erase it.
- **Displayed facts** = `legacyGrant(recipe, L) ∪ facts`, where `L = discoveryHintPurchases[recipe]`.
  `legacyGrant` is a pure function that maps the old lines to facts:
  - H1 key → `ing:<key>`
  - H2 → `ing:<sauce>` or `sauce:not-tomato`
  - H3 → `meta:ingredient-count` plus `none:cheese` or a display-only `meta:uses-cheese`
  - H4 → the named `ing:*`
- **Price position** `k0 = L + |facts \ legacyGrant(L)|`, with spend-equivalent `S(k0)` on the same
  ladder and cap. A migrated player continues exactly where they would have been:
  - Old H3 on a 75-recipe (35 paid, `k0 = 3`) → the next fact costs 40, then the rest are free.
    Today H4 costs 40 and reveals everything, so this is **parity**.
  - Old H4 → everything owned, cap reached. Old H1/H2 → next rung 10/20. **No migrated player pays
    twice or loses a line they saw.**
  - Quattro-formaggi H4 has no `none:topping` legacy line. It is still granted, because the
    remaining facts cost 0 once the cap is reached.
- **Sanitizer**: a known recipe id plus an array of strings matching
  `^(ing|none|sauce|meta|tech|shape|finish|layer|pan)(:[a-z0-9-]+)+$`, deduped. It never throws.
- **Unknown recipe ids**: preserved via forward-compat extras (extend `extractForwardCompatExtras` to
  this key, exactly as for `discoveryHintPurchases`).
- **Unknown or future fact ids** on a known recipe: preserved in storage, ignored for display, **not**
  counted in `k0`. That favors the player: the next price is never higher because of a fact this
  build cannot show.
- **Merge**: per-recipe set **union**. Facts are never removed, which is the analogue of today's `max`.
- **Downgrade**: an old build shows only legacy levels, so new-only facts are invisible there but
  preserved. Mixed tabs (an old tab buying H-levels while new facts exist) can overcharge by at most
  one rung, bounded by the cap per build. This is documented as a risk (R-5), not engineered around.
- **Discovered recipes**: the ledger is never pruned on discovery (same as today).
- **Full Reset**: `resetSave()` already removes the whole key, including both ledgers.
  Test O confirms this.
- Dex-0 Margherita stays **session-only**. Nothing is written.

## 11. Discovery privacy (DOM / ARIA)

The rules carry over from #229 / HE, extended for rows:

- The view model (`HintSheetView` v3) carries only row kinds, **owned** fact values, `offerState:
  "OPEN" | "CLOSED"` (one closed state, never EXHAUSTED vs RESERVED), and prices. Unowned values are
  never in props, so they cannot reach the DOM.
- No `data-*` or `aria-*` carries an ingredient id, a recipe id, a remaining count, `aria-setsize`
  or 「あとN個」. Row identity is category-only (`data-hint-row="topping"`).
- The checkbox accessible name is 「トッピングを1つ解除」 / 「ソースを解除」, the same for every recipe.
  Owned chips are read as their ingredient name (already public to the player). 「？？？」 gets
  `aria-label="未解除"`. The CTA reads 「2つ解除 15 Pitz」.
- The row list is `role="group"` with a visible legend. Toggles are native checkboxes (44 px rows),
  so VoiceOver and TalkBack work without custom roles. The `aria-live="polite"` region announces
  only newly owned chips.
- The existing e2e whole-document sweep (`expectNoUndiscoveredIdentity`) and the 25-recipe DOM sweep
  extend to every row state (tests R and S).

## 12. Near-miss compatibility

| Channel | Today | Hint 3.0 rule |
|---|---|---|
| Purchased hint | lines by level | facts by row, owned only |
| Generic near-miss (ADD_ONE / REMOVE_ONE / CLOSE / FAR_KEY_UNUSED) | never names an ingredient or category | **unchanged**, compatible: it only says the direction ("1つ足す") |
| SAUCE_ONLY | names the *category* "ソース" after a d=1 bake | kept. It is post-bake feedback earned by baking. Accepted in Hint 2.0 and still does not name the sauce. |
| Exact near-miss (「マッシュルームが1つ足りない」) | **does not exist** | **Forbidden** unless the named ingredient is an owned fact for that target. If ever added, gate it with `nearMissDetailAllowed(target, facts)`. |
| INCOMPLETE_MATCH | 「ソースの量や焼き加減を見直してみよう」 (the set is already right) | unchanged. Once the set matches, no hint is left to protect. |
| Quantity (`minCount`) | Completion Gate, not identity | never a hint fact |

**No free duplicate of a paid fact exists today**, and the rule above keeps it that way.

## 13. Future 101 / 172 technique taxonomy (design only; nothing to implement now)

The fact id grammar is `<kind>:<value>[:<qualifier>]`, and the rows are data-driven:

| Row (display) | Fact ids | Identity axis (Phase-2 dimension) | Runtime today |
|---|---|---|---|
| ソース / ベース | `ing:<sauce>`, `none:sauce`, `sauce:not-tomato`, `ing:<sauce>:layer-2` | `sauceBase`, `spreadLayers` (multiple sauce) | 1 sauce only (FIXED) |
| チーズ | `ing:<cheese>`, `none:cheese` | ingredientSet | yes |
| トッピング | `ing:<topping>`, `none:topping` | ingredientSet | yes |
| 仕上げ (post-bake) | `finish:<ingredient>` (post-bake topping, finishing oil) | `late` | reserved (FINISH step has no gameplay) |
| 生地・形 | `shape:<fold|square|…>`, `pan:<type>`, `dough:<variant>` | `shape`, `pan`, `enclosure`, `dough`, `laminate` | UNAVAILABLE / FIXED |
| 調理法 | `tech:<layering|fold|seal|…>`, `cook:<method>` | `layerOrder`, `prep`, `cook` | FIXED |
| 材料の数 | `meta:ingredient-count` | derived | yes |

Rules for later waves:

- A row renders **for every recipe** once its mechanic exists in the runtime (fixed rows, §5 C). It
  is never shown only for the recipes that use it, because that would leak like A′.
- `none:<row>` is always a sellable fact.
- Rule W generalizes: the reserve is picked from the highest-entropy row present.
- **Material × Technique × Recipe**: a recipe's hint facts = `ingredientSet` facts ×
  capability-dimension facts, and both are derived from the discovery catalog entry
  (`items`, `sauceBase`, `identityDimensions`). No hand-authored hint data. A capability row appears
  once `RUNTIME_SUPPORTED_CAPABILITIES` includes it.
- CUT stays excluded unless a future identity dimension makes it distinguishing.

## 14. Mobile UI proposal (scratch measurement; no production CSS changed)

I built a scratch mock that loads the **real `App.css`/`index.css`**, keeps the existing
`.hint-sheet` shell, and adds 44 px checkbox rows. I measured it in Chromium. Nothing was committed.

| Viewport | 45 % limit | List area (compact) | Fresh 4 rows (188 px) | Many-slot (capricciosa, 3 chips wrap to 2 lines) | CTA inside sheet | Horizontal overflow |
|---|---:|---:|---|---|---|---|
| 390×844 | 380 | 188–210 | **fits, no scroll** | 222 px → 12 px list scroll | yes (763–811) | none |
| 360×800 | 360 | 188–190 | **fits, no scroll** | 226 px → 36 px list scroll | yes (719–767) | none |
| 360×640 (S360) | 288 | 118 | scroll 70 px | scroll | yes | none |

The compact layout uses a one-line lead (「知りたいところを選んでね（何個でもOK）」) and a 4 px row gap. The
original 2-line lead did not fit 4 rows at 360×800 (21 px short).

```
💡 ヒント                                 [閉じる]
知りたいところを選んでね（何個でもOK）
✓ ソース ……………………… 🍅 トマトソース
☐ チーズ ……………………… ？？？
☑ トッピング …… 🍄 マッシュルーム  ＋？？？
☐ 材料の数 ……………………… ？？？
[ 🔒 1つ解除  20 Pitz ]
         所持 120 Pitz
```

- Row pattern: a checkbox for the next fact, owned chips, then 「＋？？？」 while open, or
  「✓」 once closed. The per-row price is not shown; the CTA shows the batch total, because under B
  the price depends on the count, not the row. A subline under the CTA says 「次の1つ: 5 Pitz」.
- Many slots: **scroll inside the list** (the existing Economy 1.0 pattern; capricciosa already
  scrolls 7 lines) plus chip wrap. The alternatives are worse:
  - Accordion: an extra tap, and it hides owned info.
  - Category tabs: slots per tab are tiny (≤ 4), and tabs cost 40 px.
  - Progressive reveal: this is already the row behavior.
- Insufficient Pitz: the CTA turns neutral grey 「🔒 2つ 35 Pitz」 with 「たまったら解除できるよ」, as
  in HE-3. Selections stay, and nothing is red.
- The sheet keeps `max-height: 45dvh`, `position: fixed`, Escape/backdrop close, and focus return.

## 15. Margherita onboarding (Dex 0)

The same 3 rows are reused (no 「材料の数」 row, because the onboarding reveals everything anyway):

```
✨ はじめてのピザ作り
ソース …… トマトソース     (free)
チーズ …… モッツァレラ     (free)
トッピング … バジル         (free)
```

- It stays free and session-only, with no ledger write (OD-HE-5 unchanged). The CTA reads
  「見てみる（無料）」, has no price, and uses `isHintOnboardingFree` as the authority.
- The LK-6 exception is kept: all 3 are revealable, and there is no reserve at Dex 0.
- Auto-escalation maps `preDiscoveryFreeCookAttempts` 1/2/3 → rows sauce / +cheese / +topping. Today
  1 → sauce + count/cheese, 2 → mozzarella, 3 → basil; the row form is equivalent.
- It is reusable with a `free` flag on the same view model, and it is the natural first teaching of
  the selectable UI.

## 16. Test matrix (for the implementation phases)

| ID | Test | Layer |
|---|---|---|
| A | Dex0 Margherita: all rows free, nothing persisted, no Pitz change | unit + reducer |
| B | select one row → CTA total = next rung | view-model unit |
| C | non-sequential rows (topping without sauce) purchasable | reducer |
| D | purchase one: debit = price, fact appended, balance ≥ 0 | reducer |
| E | purchase multiple: batch = Σ sequential rungs (**bypass property test**: every split of the same m facts costs the same) | pure property test |
| F | already-owned fact / closed row requested → rejected, no change | reducer |
| G | insufficient Pitz for the batch total → all-or-nothing, no change | reducer + UI |
| H | double tap → second event has a stale `expectedOwnedCount` → rejected | reducer + e2e |
| I | stale event after a target change or discovery → rejected (`NOT_A_TARGET`) | reducer |
| J | reload persistence: facts survive, display = grant ∪ facts | persistence + e2e |
| K | old H1 save → `ing:<key>` shown, next price = rung 2 (10) | migration unit |
| L | old H4 save → all sellable facts owned, price 0, reserve never shown | migration unit, all 25 |
| M | unknown recipe id in `discoveryHintFacts` survives a write round-trip | persistence |
| N | unknown fact id on a known recipe: kept, not shown, not counted in `k0` | persistence + pricing |
| O | Full Reset clears both ledgers | persistence + e2e |
| P | discovered recipe keeps its facts; no longer a target | reducer |
| Q | near-miss never names an unowned ingredient or row; SAUCE_ONLY unchanged | unit sweep over 25 |
| R | no undiscovered recipe name, id or image in any state (25 × every row state) | DOM sweep |
| S | DOM / ARIA: no ingredient id, count or `aria-setsize` on unowned rows; the closed state is identical for exhausted vs reserved | DOM sweep |
| T | 390×844 Layout Contract (sheet ≤ 45dvh, CTA inside, no h-overflow) | e2e |
| U | 360×800 (+ S360 / P390i / E390i / E360i) | e2e |
| V | many-slot recipe (capricciosa / meat-lovers / portuguesa / puttanesca / quattro-formaggi) | e2e |
| W | a future row kind (`tech:*`) in the save does not break the current build | persistence |
| X | Hint Economy sim: ESC_PARITY buy-all == CUR-P4 at ★4 (1480 / 109); hard deadlock 0 at ★4/3/1 | sim test |
| Y | current H1–H4 regression: legacy ledger untouched by new builds; migration parity for every recipe × L | unit |
| Z | WebKit: checkbox rows, focus, sheet layout (conditional WebKit CI) | e2e (WebKit) |

Additional invariants:

- Rule W reserve = current withheld for 25/25 (pinned).
- Reserve never sold.
- Facts derive from `RECIPE_DISCOVERY_CATALOG` (no hand data).

## 17. Risks

| # | Risk | Mitigation |
|---|---|---|
| R-1 | Player-chosen order weakens the n-1 cap | **Rule W fixed reserve** (§6.2). Measured: parity with current. |
| R-2 | Selectable hints make discovery much faster (338 → 166 bakes for need-based) | This is the goal. Pricing is at parity per recipe. Owner may tune the ladder later (OD-H3-3). |
| R-3 | Row closure leaks cheese-set completeness | Low-entropy and paid. Accepted with an OD. |
| R-4 | Slot counts sneaking into the DOM (`aria-setsize`, test ids, pre-rendered hidden chips) | View model without unowned values; DOM sweeps R/S. |
| R-5 | Mixed old/new tabs → at most one extra rung charged | Documented. Bounded by the cap. |
| R-6 | Sheet height at 360×640 (S360) needs scroll for 4 rows | Same as today's long H4. The list scrolls and the CTA stays fixed. |
| R-7 | Shop spend falls, so the Pitz sink moves to hints | Ending balances unchanged (130–190 at ★3). ★1 burden is pre-existing, not fixed here. |
| R-8 | Scratch harness knowledge model is simplified (no closure deduction, S2 heuristic) | Relative ordering is robust across ★4/★3/★1 and 4 pricings. Re-run on the real reducer in the implementation phase. |

## 18. Owner Decisions

| ID | Decision | Recommendation |
|---|---|---|
| OD-H3-1 | Slot display model | **D: fixed category rows (ソース/チーズ/トッピング/材料の数), always rendered, repeatable rows, no ①②③** |
| OD-H3-2 | Topping-count privacy | **Hide counts.** Never show real slot counts (A leaks up to 16 bits and uniquely identifies 5/25). |
| OD-H3-3 | Pricing authority | **ESC_PARITY**: cumulative per-recipe ladder 5/10/20/40, capped at 35 (≤3 ingredients) / 75. Rejects batch-size pricing (bypass). |
| OD-H3-4 | Key ingredient | (a) keep it as the first paid fact of its row, **or** (b) make it a free line (the Shop NEW notice already reveals it; evidence §6.4). **Recommend (b)**, as a separate small slice. |
| OD-H3-5 | n-1 cap | **Rule W fixed reserve** (= current withheld, 25/25). No END facts. |
| OD-H3-6 | Accept the residual row-closure information (§6.3) | Accept |
| OD-H3-7 | 「材料の数」 row | Keep (today's H3 half; the most useful single fact for REMOVE_ONE) |
| OD-H3-8 | Persistence | New optional `discoveryHintFacts`, schemaVersion 2, legacy ledger read-only, union merge, `legacyGrant` migration |
| OD-H3-9 | Onboarding | Reuse the rows free at Dex 0, session-only |
| OD-H3-10 | Exact near-miss | Stays forbidden unless gated on owned facts |

## 19. Recommended implementation phases (not started)

1. **H3-1 pure core** (no UI, unwired): fact derivation from the catalog, Rule W, `ESC_PARITY` pricing
   + batch rule, `purchaseHintFacts` (pure, reducer-applied), `legacyGrant`. Tests A–F, K, L, X, Y, plus
   the bypass property test.
2. **H3-2 persistence**: `discoveryHintFacts` sanitizer / forward-compat / union merge / migration read.
   Tests J, M, N, O, W.
3. **H3-3 reducer + view model**: `PURCHASE_HINT_FACTS` with `expectedOwnedCount`, `HintSheetView` v3
   with no unowned values. Tests G, H, I, P.
4. **H3-4 UI**: row sheet, onboarding reuse, Layout Contract, DOM/ARIA sweeps, WebKit. Tests Q–V, Z.
   Human Verification video (390×844) + before/after screenshots per
   `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`.
5. **H3-5 (optional, OD-H3-4b)**: key ingredient as a free line.

## Appendix A — how the data was produced

- Matrix: a scratch vitest file dumped `RECIPES`, `getIngredient`, `RECIPE_DISCOVERY_CATALOG`,
  `getCookingProfile`, `buildHintSteps` (discoveredCount 1 and 0) and `DISCOVERY_LADDER` to JSON. A
  Python script derived the facts, Rule W, the costs and the leak counts. Scratch files were not
  committed.
- Simulation: a copy of `discoveryHintEconomySim.ts` with a `selectable` option (row facts, Rule W or
  OPEN, 5 pricings, key-free flag, S0–S4). `CUR-*` runs are unmodified harness runs and match the
  Economy 1.0 Result report.
- UI: a static mock loading the production `App.css`, measured with Playwright Chromium at 390×844,
  360×800 and 360×640.
