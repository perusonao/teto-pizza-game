# Teto Pizza Game — Ingredient Economy & UI Scalability: Fresh Audit

**Design/data audit only. No production code, recipe data, ingredient prices, `restockQuantity`,
Recipe Unlock, Save schema, Inventory, Shop, or UI implementation were touched in this session.**
Purpose: before EP4 (Starter Stock) implementation begins, machine-aggregate the actual
53-recipe / 62-ingredient Fresh Recipe/Ingredient Master foundation and use it — not assumption —
as the evidence base for Shop unit design, Inventory UI, Ingredient Tray, and Recipe Select
scalability.

---

## 1. Audited state

- **`origin/main` SHA (this session, `git fetch origin` at session start)**:
  `29ccc65146d8750fc229b9f1fa9b745c4bf9e541` — "Economy & Progression 1.0 EP3: Shop 2.0 restock +
  placement Stock Gate (#83)". This is newer than the task's reference SHA
  (`29ccc65146d8750fc229b9f1fa9b745c4bf9e541` — identical; the reference SHA and the actual latest
  `main` are the same commit, no drift).
- **Branch**: `claude/ingredient-economy-audit-k62r2r`, created from this exact SHA (0 commits
  ahead of `main` at session start).

### 1.1 Source datasets read

| File | Role | Machine-verified counts |
|---|---|---|
| `src/data/ingredients.ts` | **Production** ingredient data (shipped, live) | 14 ingredients |
| `src/data/recipes.ts` | **Production** recipe data (shipped, live) | 7 recipes |
| `data/recipes/ingredient_master_catalog.json` (v2.0.0) | **Fresh Ingredient Master foundation** — design/research artifact, not wired into `src/**` | 62 ingredients (`totalIngredientCount`), self-consistent with the actual `ingredients` array length |
| `data/recipes/pizza_master_catalog.json` (v2.1) | **Fresh Recipe Master foundation** — design/research artifact, not wired into `src/**` | 53 entries (`catalogEntryCount`), 51 viable, 2 `rejected_duplicate` |
| `data/recipes/gameplay_mechanic_master.json` (v1.1) | Mechanic-coverage research artifact | 12 mechanics tracked against the 53-entry set only |
| `docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md` | Existing EP4 design SSOT candidate (`starterStockPlays = 10`, restock batch table) — **not yet implemented**, cited for continuity, not re-derived here | — |
| `docs/reports/TETO_ECONOMY-PROGRESSION_EP3_Shop-Restock_Result.md` | EP3 result — confirms only `onion` has `unlockCondition`/`pricePitz`/`restockQuantity` in shipped data today | — |
| `src/components/IngredientTray.tsx`, `src/components/ShopOverlay.tsx`, `src/screens/PizzaSelectScreen.tsx` | Current production UI, read directly to ground every "current state" claim below | — |

**Both master catalog files carry their own internal audit-SHA provenance**
(`initialAuditedMainSha: 8918fe4...`, `prBaseShaAtFollowUp: b784cd3...`) — both predate today's
`29ccc65`, but a diff of `recipes.ts`/`ingredients.ts` between those SHAs and today's `main` (done
as part of this audit) shows **zero drift**: EP1–EP3 added gating/economy fields
(`unlockCondition`, `restockQuantity`) to existing rows only — no recipe id, ingredient id,
`bakeTarget`, or the 7/14 counts changed. The two catalogs' recipe/ingredient **content** is still
accurate as of `29ccc65`.

**Hard constraint honored throughout this report**: the 53/62 foundation is treated strictly as
what it says it is — *"a foundation for 160-scale, not a 160-entry catalog."* Every number below
that comes from these two files is labeled **[53/62 foundation]**, never extrapolated to "160
recipes / 181 ingredients" (that figure's source data was never recovered — see
`docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md`, cited, not re-litigated here).

---

## 2. AUDIT 1 — Ingredient count aggregation

### 2.1 Production (shipped, `src/data/ingredients.ts` + `src/data/recipes.ts`)

| Metric | Value |
|---|---|
| Total ingredients | **14** |
| Total recipes | **7** |
| Category | sauce 3, cheese 4, topping 7 |
| `placement` | spread 3, scatter 11 |
| Finite (`unlockCondition`) | 1 (`onion`) — 13 unconditionally unlimited |
| Shop-eligible (has `pricePitz`) | 1 (`onion`, 120 Pitz / restock +12) |
| inventoryUnit (derived: spread→"use", scatter→"piece", per `src/state/inventory.ts`'s consumption model) | use 3, piece 11 |

**Recipe → ingredient count (production, exact `minCount` known):**

| Recipe | Ingredients (id×minCount) | Unique count |
|---|---|---|
| margherita | tomato-sauce×1, mozzarella×3, basil×2 | 3 |
| marinara | tomato-sauce×1, garlic×3, oregano×2 | 3 |
| quattro-formaggi | olive-oil×1, mozzarella×2, gorgonzola×2, parmigiano×2, fontina×2 | 5 |
| genovese | pesto×1, mozzarella×2, cherry-tomato×3 | 3 |
| bismarck | tomato-sauce×1, mozzarella×3, egg×1 | 3 |
| funghi | tomato-sauce×1, mozzarella×2, mushroom×3 | 3 |
| fugazza | olive-oil×1, onion×4, oregano×1 | 3 |

Average 3.29 ingredients/recipe, max 5 (quattro-formaggi). **Already-visible shared-ingredient
quantity variance**: `oregano` is ×2 in marinara but ×1 in fugazza — the concrete real case for
Audit 3 §5.2 below.

### 2.2 [53/62 foundation] — Ingredient Master Catalog

| Metric | Value | Source |
|---|---|---|
| Total ingredients | **62** | catalog field + array length, consistent |
| Existing (already shipped) | **14** | matches §2.1 exactly |
| New (candidate) | **48** | — |

**Category distribution:**

| Category | Count | Existing | New |
|---|---|---|---|
| sauce | 10 | 3 | 7 |
| cheese | 10 | 4 | 6 |
| topping | 42 | 7 | 35 |
| **Total** | **62** | **14** | **48** |

**placementType distribution:** spread 11, scatter 51.
**inventoryUnit distribution:** use 11, piece 51 (1:1 with placementType, confirming
`inventoryUnit` is fully derived from `placementType`, not an independent axis).

**usedByRecipeCount distribution** (how many of the 53 recipes reference each ingredient):

| Used by N recipes | Number of ingredients |
|---|---|
| 1 | 31 |
| 2 | 15 |
| 3 | 6 |
| 4 | 2 |
| 5 | 2 |
| 6 | 1 |
| 7 | 1 |
| 9 | 1 |
| 12 | 1 |
| 33 | 1 |
| 38 | 1 |

**Top ingredients by usage:**

| Ingredient | Category/placement/unit | Used by N recipes | Existing |
|---|---|---|---|
| mozzarella | cheese/scatter/piece | 38 | Yes |
| tomato-sauce | sauce/spread/use | 33 | Yes |
| olive-oil | sauce/spread/use | 12 | Yes |
| onion | topping/scatter/piece | 9 | Yes |
| oregano | topping/scatter/piece | 7 | Yes |
| mushroom | topping/scatter/piece | 6 | Yes |
| ham | topping/scatter/piece | 5 | No |
| sausage | topping/scatter/piece | 5 | No |
| garlic | topping/scatter/piece | 4 | Yes |
| pepperoni | topping/scatter/piece | 4 | No |

**31 of 62 ingredients (50%) are used by exactly 1 recipe** — a long tail, e.g. `truffle`,
`nutella-spread`, `nori`, `honey`, `fig`. This matters directly for Audit 2/3: single-recipe
ingredients have zero shared-quantity ambiguity by construction.

**Shared vs. single-recipe, by placementType** (machine-counted):

| Group | Count | scatter | spread |
|---|---|---|---|
| Used by ≥2 recipes ("shared") | 31 | 28 | 3 |
| Used by exactly 1 recipe | 31 | 23 | 8 |
| All `use`-type (spread/sauce) ingredients | 11 | — | 11 (3 shared, 8 single) |
| All `piece`-type (scatter) ingredients | 51 | 51 (28 shared, 23 single) | — |

**Key finding**: the shared-ingredient quantity-ambiguity problem (Audit 3) concentrates almost
entirely on `piece` ingredients — 28 of 31 shared ingredients are scatter/piece. `use`-type
ingredients are structurally immune: by the existing inventory model
(`docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md` §2 note, already ratified), a spread/sauce
ingredient always consumes **exactly 1 use per pizza**, regardless of which recipe applies it —
there is no "×2 vs. ×1" variance to reconcile for `use` ingredients, ever.

### 2.3 [53/62 foundation] — Recipe-side stats

| Metric | Value |
|---|---|
| Required ingredients/recipe | min 0, max 8, avg 3.96 |
| All ingredient fields/recipe (required+optional+finishing) | min 0, max 9, avg 4.28 |
| Recipe with max required ingredients | `supreme` (8: bell-pepper, black-olive, mozzarella, mushroom, onion, pepperoni, sausage, tomato-sauce) |
| Recipe with max all-fields | `teriyaki-chicken` (7 required + 2 finishing = 9) |
| Recipe with 0 required ingredients | `mezza-e-mezza` — a half-and-half combo recipe (depends on `halfAndHalfSplit` mechanic, composes two other recipes' ingredients rather than listing its own) |

**Required-ingredient-count distribution:**

| Count | Recipes |
|---|---|
| 0 | 1 |
| 2 | 4 |
| 3 | 16 |
| 4 | 15 |
| 5 | 11 |
| 6 | 4 |
| 7 | 1 |
| 8 | 1 |

Unique ingredient ids actually referenced by any recipe field: **62** — every catalog ingredient
is used by at least one recipe, and no recipe references an ingredient outside the catalog (fully
cross-consistent, 0 orphans either direction).

### 2.4 [53/62 foundation] — Tier ("Chapter/Tier") data

The catalog has no literal "Chapter" field; `progressionTier` (`starter`/`early`/`mid`/`late`/
`master`) is the closest analog and is used here. (`docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md`
§4 uses "Chapter 1" to mean today's 7-recipe production scope — a coarser wrapper around this
tier axis, not a separate field in the 53-entry data.)

| Tier | Recipes | New ingredients introduced (from `newIngredientsIntroduced`) | Cumulative unique ingredients through this tier |
|---|---|---|---|
| starter | 3 | 0 | 5 |
| early | 9 | 6 (anchovy, ham, pepperoni, pineapple, rosemary, sausage) | 17 |
| mid | 14 | 9 (bacon, bell-pepper, black-olive, breadcrumb, french-fries, ham, tuna, wurstel, zucchini) | 30 |
| late | 17 | 23 (arugula, bbq-sauce, brie, buffalo-sauce, caciocavallo, chicken, chili-oil, cilantro, corn, eggplant, mayo, nduja, parsley, porcini, potato, prosciutto-crudo, provolone, ricotta-salata, shrimp, speck, spicy-salami, steak, walnut) | 53 |
| master | 10 | 11 (artichoke, fig, honey, mascarpone, nori, nutella-spread, powdered-sugar, ricotta, strawberry, teriyaki-sauce, truffle) | 62 |

**Player simultaneous-ownership implication**: a player who has cleared every tier through "late"
could plausibly own up to **53 distinct ingredients** simultaneously (cumulative), before ever
reaching "master" — this is the number a Shop/Inventory/Tray UI must remain usable at well before
the full 62 is reached, not just at the final 62.

**Important caveat**: `newIngredientsIntroduced` is a per-recipe *design-candidate* annotation
(which recipe would first introduce which ingredient in a 160-scale unlock chain), not a
persisted-game unlock order — it is a reasonable proxy for "roughly what a player would own by
tier N," not a guarantee, since no actual unlock-chain/tier gating exists yet for recipes #8+.

---

## 3. AUDIT 2 — Shop restock unit: Option A/B/C comparison

### 3.0 What's already decided vs. what's newly proposed

`docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md` §2 (a design SSOT candidate, **not yet
implemented** except for `onion`) already specifies, per-ingredient:

- **Starter grant on recipe unlock** = `minCount × starterStockPlays` (`starterStockPlays = 10`
  today) — e.g. mushroom (minCount 3) → 30, egg (minCount 1) → 10, onion (minCount 4) → 40.
- **Restock batch** ≈ `minCount × 3` (labeled "≈3 pizzas") — e.g. mushroom → 9, egg → 3, onion →
  12 (already shipped, EP3).

This is functionally **Option C** (a fixed, individually-set pack size per ingredient) already,
just derived by a formula (`minCount × N`) rather than hand-picked per row. The user's new
proposal in this task (Option A, flat "+10 units regardless of ingredient") is evaluated below
against this existing baseline, using the 62-ingredient data to see whether it generalizes.

### 3.1 Option A — flat `+10` units per purchase, same for every ingredient

| Dimension | Assessment |
|---|---|
| Player understanding | Simple to state ("+10" is the same everywhere), but **the meaning of "10" varies wildly per ingredient** once minCount varies (production minCount ranges 1–4; the 62-set's `usedByRecipeCount` distribution implies even wider real per-recipe variance is likely at scale). |
| UI display | Trivial — one line of copy works for all ingredients. |
| Economy balancing | **Breaks down**: 10 units of onion (minCount 4) = 2.5 pizzas; 10 units of egg (minCount 1) = 10 pizzas. A flat price would then have to vary 4× just to keep "cost per pizza" comparable — defeats the "simple" premise. |
| Recipe quantity differences | Not accounted for at all — actively penalizes high-minCount ingredients. |
| Scaling to 62 ingredients | Gets **worse**, not better: 51 of 62 are `piece`-type with their own minCount, and shared ones (28) can have per-recipe variance on top. |
| Data maintenance | Lowest — one constant, no per-ingredient field needed. |
| Shop pricing | Would need per-ingredient price tuning anyway to compensate for the "pizzas per purchase" variance — the complexity just moves from batch size to price. |
| Consistency with Starter Stock | Directly conflicts with the already-decided `minCount ×`-based Starter Stock grant (§2 in MATRIX) — two different mental models for the same "how much do I get" question. |
| Inventory display | Simple numbers, but "in stock: 10" doesn't tell the player "how many pizzas" without also knowing that ingredient's minCount. |
| Lunch Rush | No differential impact — Lunch Rush doesn't restock mid-round today. |
| FREE | Same. |

### 3.2 Option B — flat "~10 pizzas' worth" (`minCount × 10`, same concept as `starterStockPlays`)

| Dimension | Assessment |
|---|---|
| Player understanding | Strong mental model ("one purchase ≈ 10 pizzas of this ingredient") — matches the already-decided Starter Stock grant exactly. |
| UI display | Needs the multiplication done once at data-authoring time (already true for Starter Stock); display is still just a number. |
| Economy balancing | Consistent "pizzas per grant" ratio across every ingredient — but as a **restock** batch (not a one-time unlock grant), 10-pizzas'-worth per purchase is a very large, infrequent purchase — good for reducing shop-visit friction, bad for giving the Shop a sense of an ongoing spend loop (few purchases ever needed again after the first one or two). |
| Recipe quantity differences | Solved by construction (`minCount` is baked into the batch size). |
| Scaling to 62 ingredients | Works uniformly — no per-ingredient special-casing needed, same formula as Starter Stock. |
| Data maintenance | Low — one shared constant (`starterStockPlays`) reused for both purposes, or a second named constant if restock should differ from the unlock-grant size. |
| Shop pricing | A big single-purchase batch makes per-purchase price feel expensive even if cost/pizza is reasonable — larger sticker shock. |
| Consistency with Starter Stock | **Perfect** — the two are the same number/formula. But this also **erases the distinction** between "free starter grant" and "a Shop purchase" — losing an opportunity to make restock feel like a smaller, more frequent, more game-y purchase loop. |
| Inventory display | Same "need minCount to interpret" caveat as Option A, just larger numbers. |
| Lunch Rush / FREE | No differential impact. |

### 3.3 Option C — fixed per-ingredient pack size (`minCount × N`, N ≠ starter-grant N) — **matches already-shipped `onion` behavior**

| Dimension | Assessment |
|---|---|
| Player understanding | Good once the player internalizes "restock buys a few pizzas' worth, unlock grants ~10" — two related but distinct concepts, slightly more to learn than Option B, but still simpler than raw arbitrary numbers. |
| UI display | Same as A/B — just a number; can be labeled "+12 (~3 pizzas)" if desired. |
| Economy balancing | **Best balance control**: N can be tuned per-ingredient-tier independent of the unlock-grant multiplier, giving designers a second economy lever (e.g. rare/expensive ingredients could use a smaller N without touching the unlock-grant formula). |
| Recipe quantity differences | Solved by construction, same as B. |
| Scaling to 62 ingredients | Confirmed working today — the shipped `onion` row (minCount 4 × N=3 → 12) already validates the formula generalizes; no new mechanism needed for the other 61. |
| Data maintenance | Same complexity as B (one formula, one constant) — **not actually more hand-authored per-row work** than B, contrary to the naive read of "Option C = manual pack sizes." The MATRIX's existing table is already generated this way, not hand-picked. |
| Shop pricing | Smaller batch → smaller, more frequent purchases → a more legible ongoing Shop loop (buy a little, bake a few more, come back) — better for a mobile session-length game. |
| Consistency with Starter Stock | Deliberately **different scale, same formula shape** (`minCount × N`) — Starter Stock (`N=10`) is "enough to not think about it for a while," restock (`N=3`) is "a normal top-up." This is a coherent two-tier mental model, not an inconsistency. |
| Inventory display | Same caveat as A/B. |
| Lunch Rush / FREE | No differential impact. |

### 3.4 Recommendation

**Keep Option C, generalized exactly as the MATRIX already specifies it** —
`restockQuantity = minCount × N_restock` (currently `N_restock = 3`), independent from
`starterGrant = minCount × N_starter` (`N_starter = starterStockPlays = 10`). This is not a new
decision this audit is inventing: it is confirming the already-designed, already-partially-shipped
(`onion`) model scales correctly to the 62-ingredient foundation, and recommending **against**
adopting the newly proposed flat Option A, which would actively regress the "pizzas per purchase"
consistency the existing design already achieves.

One refinement worth flagging for EP4/EP5 scope (not a change to make now): since `use`-type
ingredients (11 of 62) have no quantity-variance problem at all (§2.2), their restock/starter
formulas could in principle collapse to a flatter, simpler rule (`N` uses directly, no `minCount`
multiplication needed since minCount is always effectively 1) — this is already implicitly true
today (pesto/olive-oil rows in the MATRIX use "10 uses" / "3 uses" directly, not "1×10"/"1×3").
No further formula unification is needed; the existing "uses" vs. "units" split is already correct
and sufficient.

---

## 4. AUDIT 3 — Starter Stock ↔ Shop Restock unification, and the shared-ingredient problem

### 4.1 The concrete shared-ingredient case (production data, real, not hypothetical)

`oregano`: marinara requires ×2, fugazza requires ×1. Both consume from the same
`inventory.oregano` pool. **This case already exists in shipped data** and is exactly the pattern
Audit 3 asks to resolve before EP4 scales it to dozens of ingredients.

### 4.2 Why "10 recipes' worth" cannot mean a single number for a shared ingredient

If `starterStockPlays = 10` is defined as "10 plays of *the recipe that unlocked it*", a shared
ingredient's grant is unambiguous **per unlock event** (marinara's unlock grants oregano based on
marinara's own minCount=2 → 20 units) — the MATRIX already resolves this exactly this way (§1
note: "Shared ingredients... receive **additive** top-ups when a second recipe using them unlocks
later"). The ambiguity the task worries about — "which recipe's minCount is the '10 plays'
based on?" — **does not actually arise** under the already-decided additive-top-up model, because
each unlock event grants strictly according to *its own* recipe's minCount, and grants stack
rather than overwrite. fugazza's later unlock adds `1 × 10 = 10` more oregano on top of marinara's
already-granted `2 × 10 = 20`, landing at 30 total — never a contested "whose 10 is authoritative"
question.

**Where real ambiguity would still exist**: a *restock* purchase (not an unlock grant) is a
Shop-initiated top-up disconnected from any specific recipe context — the player buys "more
oregano," not "more oregano for marinara." Here, `restockQuantity` must be **one fixed number per
ingredient**, not per-recipe. The existing design already resolves this too, implicitly: the
MATRIX's restock batch column picks **one recipe's minCount** to drive `N_restock` (oregano's
restock batch of 6 = `2 × 3`, i.e. anchored to marinara's minCount, its higher/first-introducing
recipe) — not an average or a per-recipe-varying number. This is the "standard restock batch"
approach the task explicitly allows as an alternative, and it is what's already shipped.

### 4.3 Recommended rule (confirming, not changing, the existing design)

- **Starter Stock grant**: always `thisRecipe.minCount × starterStockPlays`, additive per unlock
  event, keyed to the unlocking recipe's own minCount. No cross-recipe ambiguity — already correct.
- **Shop restock batch**: one fixed `restockQuantity` per ingredient, anchored to the
  **introducing recipe's** minCount (the recipe in `newIngredientsIntroduced` / the MATRIX's
  "Introduced by" column) × `N_restock`. A later recipe using a *smaller* amount of the same
  ingredient (fugazza's oregano ×1 vs. marinara's ×2) simply benefits from a batch sized for the
  larger consumer — never a shortfall, only a mild "more than strictly needed for the small
  recipe" surplus, which is the safe direction for an economy (never soft-locks a player).
- Formalize this anchor rule as **"introducing-recipe minCount"**, explicitly documented, rather
  than left implicit — this is the one place this audit recommends a small SSOT clarification (see
  §12 unresolved decisions), even though the underlying number for `onion` (already shipped) and
  the illustrative values for the other 10 rows are unaffected.

### 4.4 Data gap this audit surfaces

**The 53/62 foundation has no `minCount` field at all** — `pizza_master_catalog.json` records
which ingredients a recipe uses, never how many. This audit's shared-ingredient analysis above
(§4.1–4.3) is therefore grounded entirely in the **7-recipe production sample** (the only place
`minCount` is machine-readable), extrapolated qualitatively to the 53/62 foundation. This is a
**genuine, explicit data gap**, not an oversight this session can close (adding `minCount` to
53 candidate recipes is itself a content-authoring task, out of this audit's read-only scope) —
flagged as an unresolved decision (§12) and a likely prerequisite before any of the 10 EP4
ingredients beyond `onion` get real `restockQuantity`/starter-grant values.

---

## 5. AUDIT 4 — Inventory UI scale evaluation

### 5.1 Current state

There is no dedicated "Inventory screen" in production today — `ShopOverlay.tsx` shows stock
(`在庫 N`) only inline, next to each Shop restock row, only for the 1 currently-restockable
ingredient (`onion`). `IngredientTray.tsx` shows no stock number at all, only ownership.

### 5.2 Evaluating the five candidate approaches at each scale

| Approach | 14 (production) | 62 (foundation) | 100+ (future) |
|---|---|---|---|
| A. Full grid, no grouping | Works — 14 items fit one screen | Marginal — 62 flat tiles needs scrolling but is still scannable if grouped visually by color/category even without tabs | Fails — no findability, pure scroll wall |
| B. Category tabs + grid | Works, but overkill at 14 (sauce 3/cheese 4/topping 7 all fit without tabs) | **Recommended minimum** — topping alone is 42 of 62; tabs make each tab's grid small again | Marginal — a 42+-item "topping" tab is itself a scroll wall; needs a second axis (subcategory) |
| C. Category + search/filter | Overkill at 14 | Works well, esp. once a topping subcategory exists (see §6.4) | **Recommended** |
| D. Finite ingredients only | Not meaningful at 14 (only 1 finite) | Becomes meaningful once EP4 gives ~11 ingredients finite state, but hides unlimited ingredients entirely — a player can't check margherita's toppings are still ∞ | Same limitation, worse as more ingredients become finite over time |
| E. Owned ingredients only | Redundant at 14 (all but 1 are always owned) | Increasingly useful — most of the 62 won't be owned by a given player at once (§2.4: up to 53 simultaneously at "late" tier, meaningfully less earlier) | Necessary as a default filter, not sufficient alone |

**Recommendation**: **D and E are refinement filters layered on top of B/C, not replacements for
them.** A workable Inventory screen at 62+ scale is "category tabs (or category+search once >80),
defaulted to owned-only, with an optional 'show ∞ ingredients too' toggle" — combining B/C with E
as the default state and D as an opt-in view, not a standalone screen mode.

### 5.3 Display format

The proposed format (emoji + name + `在庫 N` / `∞`) is sound and already partially proven by
`ShopOverlay`'s existing restock row. The "あと約○枚分" ("~N pizzas left") idea is **not
recommended as a default display** for shared ingredients: mozzarella is used by 38 of 53 recipes
— "~N pizzas left" would have to pick *one* recipe's minCount to compute against, silently wrong
for the other 37. It is safe and useful only for an ingredient's **single dominant/introducing
recipe context** (e.g. shown on that recipe's own selection card: "onion in stock: enough for 2
more フガッサ"), never as a general Inventory-screen figure. This mirrors §4.3's anchor-recipe
resolution exactly — the same rule, applied to display instead of restock sizing.

---

## 6. AUDIT 5 — Pizza Making Ingredient Tray (most critical)

### 6.1 Current implementation (read directly, `src/components/IngredientTray.tsx`)

This is more advanced than the task's framing assumes — **making-step tabs and ingredient
filtering are already the same mechanism in production**, not two things to merge:

- `CATEGORY_ORDER = ["sauce", "cheese", "topping"]` drives both the visible tab row *and* the
  filter — `ingredientsByCategory(activeCategory)` shows only the active category's owned items.
- Tabs are gated one-way by `makingStep` (`disabled={!isActive}`) — a step before the current one
  shows `✓ 完了`, a step after is locked — this **is** "工程タブ", already wired to filtering, for
  exactly the 3 categories that exist today.
- A **fixed 3×2 grid (`MAX_INGREDIENT_PALETTE_SLOTS = 6`)** with pagination (`◀ 1/N ▶`) is the
  existing answer to "what if a category has more than 6 owned items" — proven to work today only
  because every category currently has ≤7 owned ingredients (6 toppings + a purchased onion).

### 6.2 Does this survive 62 ingredients?

**No, not as-is, and the exact failure point is now measurable**: at the 62-ingredient category
distribution (§2.2), the `topping` tab alone would hold **up to 42 items** for a player who owns
everything, or up to a plausible ~20–30 for a mid-progress player (§2.4's tier cumulative counts,
topping-only subset would be smaller but still far past 6). At `MAX_INGREDIENT_PALETTE_SLOTS = 6`,
that is **7+ pages of `◀ ▶` pagination** just for one making step — the exact failure mode
Independent Review P1 already flagged once at a much smaller scale (a 7th onion triggering
pagination at all was treated as a UX risk worth a dedicated fix). Sauce (10 total, 3 shipped) and
cheese (10 total, 4 shipped) stay tractable far longer — **topping is the one category that
breaks first and worst**, exactly matching its outsized share of the ingredient space (42 of 62,
68%).

### 6.3 Comparing the four candidate designs, grounded in the measured topping-tab problem

| Design | Assessment against the actual 42-item topping tail |
|---|---|
| 案1 Step filter only (current, unmodified) | Fails alone — filtering by *step* (sauce/cheese/topping) does nothing once one step's own bucket is itself 40+ items. Necessary but not sufficient. |
| 案2 Recipe Recommended only | Works well for Lunch Rush (recipe is fixed) and reduces the visible set to exactly what's needed (2–8 items per §2.3), but as the *only* mode it blocks free exploration/substitution in FREE mode — a player wanting to add an unlisted topping has no path. |
| 案3 Recommended + Other (expandable) | **Best fit** — combines 案1's step scoping (already shipped) with 案2's small default surface, and keeps free exploration one tap away via "ほかの材料" grouped by a secondary axis. This *is* implementable as a refinement of the current component (same `activeCategory` step filter, plus a new "recommended subset" computed from the active recipe, plus an expand toggle) rather than a rewrite. |
| 案4 Search/filter | Correctly scoped as a *last-resort* addition — only worth the input-method cost (keyboard on mobile) once category+recommended alone can't narrow fast enough, i.e. only relevant once topping's owned count is itself large (§ Ingredient UI Scale Gates below), not at 62 in general. |

**Recommendation**: **案3 (Recommended + Other), layered on the already-shipped step-tab
filter, not replacing it.** This directly answers the task's "統合可能か" question: yes — Making
Navigation (step tabs) and Ingredient Filtering (recommended/other) are one system already, and
should stay one system, adding exactly one more filtering layer (recipe-recommended subset) inside
each step's existing bucket, rather than inventing a parallel navigation model.

### 6.4 A gap this audit surfaces: no subcategory for `topping`

`ingredient_master_catalog.json` has only the coarse `category` field (sauce/cheese/topping) —
**no meat/vegetable/seafood/herb/other subcategory field exists today**, even though several
`notes` fields informally hint at exactly that grouping (e.g. porcini/truffle as "高級品種",
parsley/cilantro/arugula as "フレッシュハーブ、焼成後仕上げ"). The task's own 案3 "ほかの材料"
expansion (肉/野菜/魚介/ハーブ/その他) **cannot be built from current catalog data** — a
subcategory taxonomy is a prerequisite content-authoring task, not a UI-only change. Flagged as an
unresolved decision (§12) and its own implementation slice (§13).

---

## 7. FREE vs. Lunch Rush behavior

| Mode | Recommended default | Rationale |
|---|---|---|
| FREE | Recipe-recommended subset first, "ほかの材料" always available, expanded by owned-ingredient category | Matches the existing FREE design intent (free arrangement) — 案3 already supports this without extra modes. |
| Lunch Rush | Recommended-only by default, "ほかの材料" optionally reachable but not encouraged (e.g. a smaller/less prominent affordance) | Task explicitly prioritizes tempo — Lunch Rush already has a fixed target recipe per round (per existing `isMissionRound`/order data), so the recommended subset is deterministic and small; minimizing ingredient search time directly serves the stated goal ("材料探索でLunch Rushのテンポを落とさないことを優先"). |

No production code changes are implied by this — the same `IngredientTray`/step-filter mechanism
serves both modes today (`ownedIngredientIds` filtering is mode-agnostic); the difference is only
in which default subset (recommended vs. full-category) is shown first, and how prominent the
expansion affordance is.

---

## 8. Making Step Tabs integration

Already answered structurally in §6.1/6.3: this is not two systems to merge, it is one system
(`activeCategory`/`makingStep`-driven tabs) that should grow **one more filtering dimension**
(recipe-recommended subset within the active step), not a second parallel UI. The task's
"次へ" vs. "工程タブ" framing is moot in production today — there is no "次へ"-centric flow in
`IngredientTray`/`GameScreen` to replace; the step tabs already are the primary navigation
(`onChangeCategory`), confirmed by direct read of `IngredientTray.tsx`'s `category-tabs` block.
The only real open question is scoped to §6.4 (subcategory data) and to whether a `postBakeFinishing`
step tab needs to be added eventually (`gameplay_mechanic_master.json` flags 15 of 53 candidate
recipes needing this mechanic, currently `gap_not_covered`/`new_required` — out of scope for this
audit and for EP4, cited for the roadmap in §13).

---

## 9. Recipe Select scalability and scale gates

### 9.1 Current state (read directly, `src/screens/PizzaSelectScreen.tsx`)

Production Recipe Select is **already a full grid of all 7 `RECIPES`** (`role="list"`, one card
per recipe, no pagination, no prev/next carousel) — not the "1 recipe/screen + 前へ/次へ" pattern
the task describes as "currently under consideration." That carousel pattern does not exist in
this codebase today; this audit evaluates it only as a hypothetical the task asks to be scoped,
not as something currently shipping or regressing.

### 9.2 Scale gate assessment

| Scale | Full grid (current) | 1-recipe/screen carousel (hypothetical) |
|---|---|---|
| 7 (production) | Works well — fits one screen, no scrolling at 390×844 in practice (already shipped, unflagged) | Also works, but adds a tap-per-recipe cost the grid doesn't have — strictly worse at this scale |
| 53 (foundation ceiling for tier-gated content) | Needs grouping (by `progressionTier`, already a real field) or it becomes a long unstructured scroll | Fails outright — 53 sequential "next" taps to browse is not viable |
| 100+ / 160-scale (future) | Needs tier/chapter sectioning **and** a favorites/recently-used/search layer | Fails regardless of scale — a carousel gets strictly worse as the set grows, never better |

**Recommendation (evaluation only, no code change per Scope Guard)**: grid-based browsing scales
far better than a carousel at every size in this dataset — the carousel model should not be
pursued for Recipe Select as the set grows. If a "focus on one recipe" moment is wanted, it belongs
as a **detail view reached by tapping a grid card** (i.e., grid for browsing + a
committed/detail step per recipe), not as a replacement navigation model for browsing all recipes.

---

## 10. UI Scale Gates

### 10.1 Ingredient Tray / Ingredient UI scale gates (grounded in §2.2/§6.2's measured category skew)

| Owned ingredients (per active making step, worst case = topping) | Recommended UI |
|---|---|
| ≤ 6 | Simple fixed grid, no pagination (today's production state, unmodified) |
| 7–15 | Step filter (existing) + pagination (existing) — no new mechanism needed yet |
| 16–40 | Step filter + **Recommended-first** (案3), "ほかの材料" expansion required |
| 41–80 | Step filter + Recommended + subcategory grouping inside "ほかの材料" (requires the §6.4 taxonomy gap to be closed first) |
| 80+ | Add search/filter (案4) on top of the above — category+recommended alone stops being fast enough |

Applying this to the actual data: production topping (7 owned) sits in the "7–15" band already;
the 62-foundation's full topping category (42) sits in the "16–40" band, meaning **案3 is the
correct target now**, not a future-only concern — the 42 number already crosses the "step filter
alone is enough" threshold today, at the foundation's full ceiling.

### 10.2 Recipe Select scale gates

| Recipes | Recommended UI |
|---|---|
| ≤ 10 | Flat grid, no sectioning (today's production state, unmodified) |
| 11–30 | Flat grid + tier/chapter section headers (no separate screen/tab needed) |
| 31–80 | Tier tabs (or collapsible sections) + a "recently played"/favorites shortcut |
| 80+ | Tier tabs + search/filter, since 53's own data already shows tier sizes up to 17 (late) — a single scroll of 5 tiers × ~15 recipes each stops being scannable well before 80 |

Applying this to the actual data: the 53-entry foundation's tier sizes (3/9/14/17/10) already
justify the "11–30" gate's section-header treatment the moment recipe count crosses ~10 — i.e.
recipe #8 onward (any expansion past today's Chapter 1) should ship with tier sections from day
one, not retrofit them later.

---

## 11. EP3 Onion re-assessment

Given §3.4's recommendation (Option C, unchanged), **the shipped `onion.restockQuantity = 12`
(minCount 4 × N_restock 3) is already correct and should not change.** It is internally consistent
with the MATRIX's own restock-batch formula, already validated as the one real, shipped data point
that proves the formula generalizes (§3.3). Neither flat `+10` nor `+40` (the Starter Stock number,
a different transaction entirely — see §4.3) should replace it. **No change recommended before
EP4.**

---

## 12. Unresolved decisions

1. **No `minCount` field in the 53-recipe foundation** (§4.4) — blocks computing real
   `restockQuantity`/starter-grant numbers for any of the 10 non-onion EP4 ingredients from the
   foundation data directly; today's MATRIX values for those 10 are illustrative, sourced from the
   original hand-authored design, not derived from this catalog. Authoring `minCount` for at least
   the Chapter-2-candidate recipes is a prerequisite content task, separate from EP4's mechanism
   work.
2. **"Introducing-recipe minCount" anchor rule (§4.3) is implicit today, not written down as an
   explicit SSOT rule** — worth one small addition to `TETO_ECONOMY-PROGRESSION-1_MATRIX.md`
   (docs-only) before EP4 needs to apply it to a second shared ingredient beyond oregano.
3. **No topping subcategory taxonomy** (§6.4) — required before 案3's "ほかの材料" grouping
   (肉/野菜/魚介/ハーブ/その他) can be built; currently only free-text `notes` hint at it.
4. **`postBakeFinishing` mechanic gap** (15 of 53 candidate recipes need it, `gameplay_mechanic_master.json`)
   interacts with any future making-step-tab expansion (a finishing step would need its own tab) —
   noted for roadmap sequencing (§13), not an EP4 blocker.
5. Whether `starterStockPlays` should stay a single Chapter-1 constant (`10`) or move to the
   MATRIX §4's own "illustrative" tier-scoped table (10/10/5/3/0–3) is explicitly deferred there
   already as "not a Chapter 1 decision" — this audit does not re-open it, only flags that the
   53-foundation's tier sizes (§2.4) are the right input whenever that future session happens.

---

## 13. Implementation slices and roadmap

Ordered by dependency; each sized to avoid one giant PR, per Scope Guard.

| # | Slice | Product goal | Depends on | Est. Claude Code time | Likely files | Tests | Mobile verification | Parallelizable? |
|---|---|---|---|---|---|---|---|---|
| 1 | EP4 Starter Stock (mechanism only, `onion`'s 10 siblings excluded until #2) | Free `minCount × 10` grant on recipe unlock, additive per shared ingredient | This audit | 1 session | `economyConfig.ts` (new), `gameReducer.ts`, `progression.ts`, tests | Unit: grant math, additive stacking (oregano case), atomicity | Verify a fresh unlock chain grants correctly at 390×844 | No — foundational |
| 2 | EP4b: give the other 10 SSOT ingredients `unlockCondition`/`pricePitz`/`restockQuantity` | Make mushroom/garlic/oregano/egg/pesto/cherry-tomato/olive-oil/gorgonzola/parmigiano/fontina real Shop/Starter-Stock participants | #1 | 0.5 session | `ingredients.ts` only | Extend existing Shop/restock/inventory suites | Full unlock-chain walkthrough | After #1 |
| 3 | SSOT doc update: "introducing-recipe minCount" anchor rule (docs-only) | Close unresolved decision #2 | none | 0.25 session | `TETO_ECONOMY-PROGRESSION-1_MATRIX.md` | n/a (docs) | n/a | Yes, anytime |
| 4 | Ingredient Tray: Recommended + Other (案3) inside existing step filter | Keep the topping step usable past 6 owned items | #2 (more owned toppings to test against) helpful but not required — testable today with onion alone | 1–1.5 sessions | `IngredientTray.tsx`, new recommended-subset selector, CSS | Component tests for recommended subset + expand toggle; regression on existing pagination | Full PREPARE walkthrough at 390×844, FREE and Lunch Rush | After #1, independent of #5/#6 |
| 5 | Inventory screen (new) | Give players a place to see stock across owned ingredients, category+owned-only default | #2 (otherwise only onion has anything to show) | 1 session | New `InventoryScreen.tsx`/route, reuse `CATEGORY_ORDER` | Component tests per §5.2 filter combination | New-screen walkthrough | Parallel with #4 |
| 6 | Topping subcategory taxonomy (content + schema) | Unblock 案3's "ほかの材料" grouping and any future Inventory subcategory tabs | none (data-only, can start immediately) | 0.5–1 session (data authoring) + 0.5 (schema) | `ingredient_master_catalog.json` (design artifact only, or a new `topping-subcategories.json` if promoted toward production) | Schema/consistency test if promoted to production data | n/a until consumed by #4/#5 | Yes, fully parallel |
| 7 | Recipe Select tier sections | Keep Recipe Select scannable past ~10 recipes | Any recipe #8+ content work (not EP4 itself) | 0.5 session | `PizzaSelectScreen.tsx`, `pizzaSelect.ts` | Section-header rendering tests | Grid walkthrough at 390×844 | Independent of all above — only needed once recipe count grows |

**Recommended order**: 1 → 2 → (3 anytime) → 4 and 5 in parallel → 6 in parallel from the start →
7 whenever recipe content actually grows past Chapter 1 (not blocking EP4 itself).

---

## 14. FINAL VERDICT

**B. READY WITH MINOR PRODUCT DECISIONS**

The core economy mechanism (Option C, `minCount`-anchored per-ingredient batch sizing for both
Starter Stock and restock) is already correctly designed and partially shipped (`onion`); this
audit confirms it generalizes cleanly across the full 62-ingredient foundation and finds no reason
to adopt the newly proposed flat Option A. The Ingredient Tray's step-tab-as-filter architecture
is sound and just needs one additive layer (案3) to survive the topping category's real 42-item
scale. The two items keeping this from an unqualified **A** are genuinely product/content
decisions, not open engineering questions: (1) authoring `minCount` and a topping subcategory
taxonomy for the 53/62 foundation is content work outside this audit's scope, and (2) the
"introducing-recipe minCount" anchor rule, while already implicitly correct, should be written
down in the SSOT before a second shared-ingredient case (beyond oregano) needs it. **EP4 Starter
Stock can begin now** using the existing MATRIX formula — these two items are prerequisites for
the *other 10* EP4 ingredients and for the Ingredient Tray follow-on work, not for EP4's own
mechanism slice (#1 above).
