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

> **Update (Owner Decisions confirmed):** the Owner confirmed OD-H3-1..12 (§20, Owner Authority).
> The mandatory pre-implementation check of OD-H3-6 then found conflicts between the confirmed
> decisions (§21). The Owner resolved them with OD-H3-13..16 (§22). The restart-gate privacy
> recheck passed (§23), and H3-1 (pure logic, unwired) was implemented. The Owner then decided
> C-1 with OD-H3-17 (§24). See `docs/reports/TETO_DISCOVERY-HINT-3_H3-1_Result.md`.

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

---

## 20. Owner Decisions — confirmed (Owner Authority)

Confirmed by the Owner after Fresh Design commit `7dfd95e`. These supersede the recommendations in
§18 wherever they differ. Recorded verbatim.

**OD-H3-1:** Discovery Hint 3.0はSelectable Hint方式を採用する。一本道の H1 → H2 → H3 → H4 ではなく、
「プレイヤーが知りたい情報カテゴリを選んで購入する」方式へ移行する。

**OD-H3-2:** 未発見recipeについて、実際のトッピング数 / ingredient slot数は表示しない。全recipeで同じ
カテゴリ構造を基本表示し、slot数そのものをrecipe identity hintにしない。

**OD-H3-3:** 「トッピング① / ② / ③」のような、recipe dataに存在しない順番をUI authorityにしない。
ingredient identityはunordered setとして扱う。内部のstable fact idとUI表示順序は分離する。

**OD-H3-4:** pricing authorityは ESC_PARITY を採用する。そのrecipeに対して購入する有料factの段階に
応じて 1段目 5 / 2段目 10 / 3段目 20 / 4段目 40 Pitz を基本とする。複数同時購入でも、1個ずつ購入
した場合と総額を必ず同じにする（例: 3段分をまとめて購入 = 5 + 10 + 20 = 35 Pitz、1個ずつ3回購入
しても35 Pitz）。購入操作の分割によるprice bypassを禁止する。既存Economyとのparity capを維持:
現行でfull hint cost 35のrecipe → selectableでも最大35、現行でfull hint cost 75のrecipe →
selectableでも最大75。有料対象24recipeのfull unlock総額1480 Pitzを維持する。

**OD-H3-5:** Rule Wを採用する。recipeごとに「最後まで直接開示しないreserved ingredient」を
deterministicに固定する。プレイヤー自身にreserved ingredientを選ばせない。現在のH4が伏せている
ingredientと同じauthorityを維持する。n-1 protectionを壊さない。

**OD-H3-6:** key ingredientは無料情報にする方向で採用する。ShopのNEW等ですでに実質的に得られる情報に
Pitzを要求しない。ただし実装前に、現在の24 paid recipesすべてについて「無料key factがDiscovery
privacyを追加で破壊しない」ことをテストでpinする。問題が見つかったrecipeは勝手に例外化せずSTOPする。

**OD-H3-7:** チーズ / topping等について、「これで全部」「他には使わない」というnegative factは原則
無料でも有料でも開示しない。購入したpositive factだけを表示する。absence / exact slot count自体を
recipe identity leakにしない。Fresh Designで見つかった5 recipeのslot-count identity leakを閉じる。

**OD-H3-8:** Dex0 Margherita onboardingは引き続き無料。Pitzを消費しない。purchase persistenceにも
書かない。

**OD-H3-9:** 既存Hint Economy購入者を不利にしない。旧 discoveryHintPurchases から新selectable facts
へのmigrationでは、すでに購入済みだった情報を失わせない。同じ情報への再課金を禁止する。次の価格段階を
巻き戻さない。schemaVersion 2維持可能性をH3-2で正式検証する。

**OD-H3-10:** near-missは未購入factを無料で特定しない。ingredient名等のexact informationは、そのfact
がすでに公開可能な場合だけ表示可能。generic near-missは維持可能。

**OD-H3-11:** 25-recipe段階では、Fresh Designで確認されたDiscovery高速化を許容する。「必要な分だけ
購入」profileが★3で338 → 166 bakesになったことを理由に今回Shop価格・reward・pack size・Hint価格を
追加調整しない。Human Verificationと実プレイ後に再評価する。既知の★1 economy burdenも今回修正しない。

**OD-H3-12:** 将来の101/172対応を考慮し、fact taxonomyは将来 `ing:` / `none:` / `finish:` /
`shape:` / `pan:` / `tech:` / `cook:` 等へ拡張可能にする。ただし現在runtimeに存在しないmechanicを
Hint 3.0で先行実装しない。

Consequences for the §6 model (mechanical, no new choice):

- OD-H3-7 removes every non-positive fact from sale: `none:cheese`, `none:topping`,
  `sauce:not-tomato` (a "not X" fact), and `meta:ingredient-count` (an exact slot count).
- OD-H3-6 removes the key from sale (it becomes a free positive fact).
- So the sellable set per recipe (Dex ≥ 1) = every distinct ingredient **except** the key and
  the Rule W reserve = `distinct − 2` positive `ing:` facts.

## 21. H3-1 Pre-implementation Gate (OD-H3-6 check) — **BLOCKED**

Base: `origin/main` = `f59b5ed` (PR #237 merged since the Fresh Design; merged into this branch, no
Dinner Mission file touched). The check was run on the committed matrix
(`keyIngredient`, `reservedIngredient_RuleW`, `sauceSlot` / `cheeseSlots` / `toppingSlots`) with
the §20 consequences applied. No production code was written.

### 21.1 Sellable positive facts per paid recipe (free key + Rule W + positive-only)

| Recipe | distinct | free key | reserved (W) | sellable: sauce / cheese / topping | n | full cost (ESC_PARITY) | current |
|---|---:|---|---|---|---:|---:|---:|
| **pizza-bianca** | 2 | rosemary | olive-oil | **0 / 0 / 0** | **0** | **0** | 35 |
| marinara | 3 | garlic | oregano | 1 / 0 / 0 | 1 | 5 | 35 |
| genovese, bismarck, funghi, salsiccia, pepperoni | 3 | (topping) | mozzarella | 1 / 0 / 0 | 1 | 5 | 35 |
| fugazza | 3 | olive-oil | oregano | 0 / 0 / 1 | 1 | 5 | 35 |
| napoletana, tonno-e-cipolla, breakfast, melanzane, bambino, hawaiian, new-haven, pesto-caprese, pesto-patate | 4 | | | 1 / 1 / 0 | 2 | 15 | 75 |
| pesto-tonno | 4 | pesto | onion | 0 / 0 / 2 | 2 | 15 | 75 |
| quattro-formaggi | 5 | gorgonzola | fontina | 1 / 2 / 0 | 3 | 35 | 75 |
| parmigiana-pizza | 5 | parmigiano | basil | 1 / 1 / 1 | 3 | 35 | 75 |
| **puttanesca-pizza** | 5 | capers | garlic | 1 / 0 / 2 | 3 | 35 | 75 |
| capricciosa, meat-lovers, pizza-portuguesa | 6 | | | 1 / 1 / 2 | 4 | 75 | 75 |
| **24-recipe total** | | | | | | **515** | **1480** |

### 21.2 Findings

**F-1: pizza-bianca has zero purchasable facts. This is a free identity leak, and the recipe is one
of the 5 that OD-H3-7 requires to close.**

After the free key (rosemary) and the Rule W reserve (olive-oil), nothing positive is left to sell.
Its sheet would offer nothing from the first open, so a player learns for free "this target is a
2-ingredient recipe with rosemary". That leaves about 3 candidates (one of the owned sauces). With
the key paid (the Fresh Design), the same recipe had a sellable fact.

So the free key is what creates this leak. Per OD-H3-6 this is a problem recipe, and I did **not**
make it an exception.

**F-2: category choice + positive-only makes category availability observable.**

A selected category with no sellable fact must either be shown as unavailable or be rejected on
purchase. Either way the absence becomes observable, before or at the purchase, at no cost.
Availability patterns (sauce / cheese / topping) split the 24 recipes into 6 classes:
(T,T,F) 10 · (T,F,F) 6 · (T,T,T) 4 · (F,F,T) 2 · **(F,F,F) 1 = pizza-bianca** ·
**(T,F,T) 1 = puttanesca**.

That uniquely identifies 2 of the 5 leak recipes named in OD-H3-7, so OD-H3-1 (choose a category)
and OD-H3-7 (no absence leak) cannot both be met with a presentation that exposes or rejects per
category.

**F-3: exhaustion reveals the exact ingredient count cheaply.**

Once the last sellable fact is bought, "nothing more to buy" is observable, and `n = distinct − 2`
gives the exact count. For the 7 three-ingredient recipes (n = 1) this costs 5 Pitz, while today
it costs 35 cumulative via H3. That conflicts with OD-H3-7's "exact slot count" clause.

**F-4: OD-H3-4's 1480 total is arithmetically unreachable under OD-H3-6 and OD-H3-7.**

- With the fixed 5/10/20/40 ladder (OD-H3-11: no price change), the per-recipe caps 35 / 75 still
  hold as maxima.
- The full-unlock total is **515**. Even with a paid key it would be 910.
- 1480 needs the count and negative facts that OD-H3-7 forbids, or a different ladder that
  OD-H3-11 forbids.

### 21.3 Owner Decisions needed before H3-1 (proposed; not decided here)

| ID | Question | Options | Recommendation |
|---|---|---|---|
| **OD-H3-13** | pizza-bianca (F-1) | (a) key stays paid for any recipe where the free key would leave 0 sellable facts (pizza-bianca only today) · (b) keep the free key and accept the leak · (c) another reserve rule for 2-ingredient recipes (breaks n-1: both named = full answer; not viable) | **(a)**, stated as a general rule rather than a hand-made exception. Residual: after paying 5, exhaustion shows the recipe has 2 ingredients (F-3 class). |
| **OD-H3-14** | category availability (F-2) | (a) **category preference with deterministic fallback**: the player picks categories, each purchase returns the next sellable fact of that category or else the next one in a fixed order (sauce → cheese → topping), always a positive fact and always paid; the presentation exposes no per-category availability · (b) show or reject unavailable categories (leaks F-2) · (c) no category choice (contradicts OD-H3-1) | **(a)**. Only positive facts are ever shown; absence can be inferred only indirectly, and only after paying. |
| **OD-H3-15** | exhaustion and the 1480 target (F-3, F-4) | (a) read OD-H3-4's 1480 as the ceiling: per-recipe caps 35/75 kept as maxima, real total 515; accept that exhaustion is observable (as with today's 「ヒントはここまで」) · (b) keep 1480 by changing the ladder (conflicts with OD-H3-11) · (c) re-admit `meta:ingredient-count` as a paid fact (conflicts with OD-H3-7) | **(a)**. Re-evaluate prices after Human Verification, as OD-H3-11 already plans. |

Once these three are decided, H3-1 can proceed exactly as scoped (pure logic, unwired). The fact
generation, Rule W, ESC pricing / batch parity and the validation design in §6–§7 are unaffected.
Only the sellable set, fallback rule and parity expectation change.

## 22. Owner Decisions — blocker resolution (Owner Authority)

Confirmed by the Owner after the §21 BLOCKED report (branch HEAD `cf63a27`). Recorded verbatim.
These replace the §21.3 proposals.

**OD-H3-13:** 「無料key factが0 purchasable factsを作るrecipeだけkeyを有料化する」案は採用しない。
key ingredientは全対象recipeで無料というOD-H3-6の一貫したルールを維持する。pizza-biancaを個別例外に
しない。pizza-biancaで有料ingredient factが0になること自体は許容する。ただし、「有料factが0だから
ingredient数が2だ」と購入前に分かるpresentationは禁止する。

**OD-H3-14:** Selectable Hintのカテゴリは「そのカテゴリに購入可能factが存在すること」を意味しない。
カテゴリはプレイヤーが「どの方向の情報を知りたいか」を指定する preference として扱う（例: ソースに
ついて / チーズについて / トッピングについて）。選択カテゴリにprivacy-safeな未公開positive factが
あれば、それを優先して返す。存在しない場合は、deterministicなfallback orderで別カテゴリの未公開
positive factを返してよい。fallback authority候補: sauce → cheese → topping。ただし実データを使って
deterministicかつprivacy-safeであることをテストする。購入前UIでは以下を絶対に公開しない:
categoryごとの残りfact数 / category complete / category empty / exact ingredient slot count /
exact topping count / exact cheese count / 「このカテゴリには使わない」。UI copyも、「チーズを1つ解除」
のように結果を保証する表現ではなく、「チーズを中心にヒントを探す」のようにpreferenceであることが
分かる設計をH3-4で検討する。H3-1ではpresentation modelまで。最終copy/CSSは実装しない。

**OD-H3-15:** Hint 2.0の有料対象24recipe総額1480 Pitzとの完全parityをHint 3.0の絶対条件から外す。
Selectable Hintは旧H1-H4と販売する情報単位が異なるため、1480を維持するためだけに material count /
absence fact / exact slot count / unnecessary duplicate information を販売してはいけない。Fresh Audit
で算出された515 Pitzも最終authorityにはしない。H3-1では現在決定済みの 5 / 10 / 20 / 40 ESC
progression および 旧35-cap recipe → max 35 / 旧75-cap recipe → max 75 をpure pricing authority
として維持する。実際の25recipe総額はmeasurementとしてResult Reportに記録する。最終的なHint 3.0
economy tuningは、UI/Human Verificationとsimulation後に再判断する。Shop価格、pack size、reward
economy、既知の★1 economy burdenは今回変更しない。

**OD-H3-16:** 「すべての購入可能positive factを購入した結果、プレイヤーがingredient数等を推論できる」
ことは許容する。ただし区別する: FREE LEAK: 購入前に構造からrecipe情報が分かる → 禁止。
PAID INFERENCE: 十分なPitzを支払ってpositive factsを取得した結果、残りを推論できる → 許容。
したがって、購入前の row数 / disabled state / category availability / category complete表示 /
remaining count からingredient数を漏らしてはいけない。一方、購入済みpositive factsからプレイヤー
自身が推理することはHint gameplayの一部として許容する。

## 23. H3-1 restart gate — privacy recheck (before code): **PASS**

Base: `origin/main` = `4bf098f` (PR #240 DM-2 merged since §21; merged into this branch). DM-2
touched no hint, discovery, recipe, ingredient or ladder file.

I enumerated what a pre-purchase presentation could possibly depend on per recipe, using the
committed matrix plus §20/§22:

| Candidate recipe-dependent quantity | Decision | Result |
|---|---|---|
| Rows | 3 fixed category rows (sauce / cheese / topping) for every recipe | identical for all 24 |
| Preferences | all 3 always selectable; no availability, empty, complete or remaining count (OD-H3-14) | identical for all 24 |
| Next price | a function of the paid-fact count only (0 → 5). The 35/75 cap **never binds before exhaustion** on any runtime recipe (checked for every reachable paid count), so the displayed price never reveals the cap. | identical for all 24 (5) |
| Free key chip | the key ingredient, shown in its own category row (OD-H3-6) | the only difference; its category (topping 20, cheese 2, sauce 2) is a property of the public ingredient, not hidden structure |
| Purchasable fact count | never part of the pre-purchase presentation | not exposed |

With the key chip stripped, all 24 paid recipes have **one identical pre-purchase structure**.

1. pizza-bianca is not identified by pre-purchase structure: PASS.
2. puttanesca is not identified by pre-purchase structure: PASS.
3. The 5 slot-count leak recipes (quattro-formaggi, pizza-bianca, parmigiana, pesto-tonno,
   puttanesca) are not identified by pre-purchase structure: PASS.
4. Category availability leaks nothing, because it is not exposed: PASS.
5. The free key leaks no hidden structure beyond the key itself: PASS.

The gate passed, so H3-1 proceeded. It pins all five as tests on the real module.

One condition carried forward (not a pre-purchase structure item; raised for the Owner in the H3-1
Result Report, C-1): pizza-bianca has 0 paid facts, so its **first** purchase attempt resolves to
"nothing to reveal" at 0 Pitz. That is a zero-cost signal at the first action.

## 24. OD-H3-17 — zero purchasable fact (Owner Authority)

Confirmed by the Owner on the H3-1 review of PR #241 (HEAD `be665cf`), resolving C-1. Recorded verbatim.

**OD-H3-17 — ZERO PURCHASABLE FACT.** C-1は (a) を採用します。pizza-biancaのように、
free key factは存在する / Rule W reserved ingredientは存在する / purchasable positive factが0
となるrecipeを許容します。recipe個別例外は作りません。key factをpizza-biancaだけ有料化しません。
absence / negative factも作りません。

**ZERO-FACT REQUEST SEMANTICS.** purchasable positive factが0の状態でプレイヤーが追加hintを要求
した場合: Pitz消費 = 0 / purchase countを進めない / paid progressを進めない / purchased factを追加
しない / persistence mutationなし / recipe-specific special caseなし。結果はprivacy-safeなgeneric
guidanceとする。禁止copy / semantic: 「材料はこれで全部」 / 「追加の材料はありません」 /
「トッピングはありません」 / 「チーズはありません」 / 「残り0個」 / exact ingredient count /
exact category absence / reserved ingredient identity。つまり、zero purchasable factをnegative
recipe factとして直接公開しない。

**PAID INFERENCE AUTHORITY.** この操作結果からプレイヤー自身が「もう追加情報がないのかもしれない」
と推測することは許容する。これはOD-H3-16のPAID INFERENCEと同じ考え方で扱う。ただしPitzを実際には
消費しないため、より正確には: INTERACTION INFERENCE としてResult Reportへ区別して記録する。
購入前structureから無料で漏れるFREE LEAKは禁止のまま。

**UI COPY.** 最終文言はH3-4で決める。候補の方向性:「このピザは、今わかっているヒントを手がかりに
考えてみよう！」のようなgeneric guidance。H3-1ではproduction UI/CSSを変更しない。privacy-safe
presentation modelとしてgeneric result/statusだけ定義してよい。

Implementation (H3-1, pure only):

- A request that resolves to no fact returns
  `{ success: false, reason: "GUIDANCE_ONLY", guidance: "THINK_WITH_KNOWN_HINTS", price: 0 }`.
- The same answer applies to every recipe and every exhausted target.
- The answer carries no new ids, no balance and no `persist` flag, so the caller has nothing to
  record and no counter moves.
- `NOTHING_TO_REVEAL` no longer exists.
