# Teto Pizza Game — Economy & Progression 1.0 (Fresh Design)

**Scope: read-only design. No production code (`src/**`, tests, scoring, Pitz formula, Save
schema, Recipe data, Shop/RESULT production UI) was touched in this session. Docs only.**

- **Audited `origin/main` SHA (original design)**: `d0f17d57e06a9cddaf1cbb143d1dbaba8bb8bdf3`.
- **Audited `origin/main` SHA (this product-decision-finalization revision)**:
  `5d28c5dc996c0ea76aa6428f158a766165477213` ("docs: Pizza DB 160 catalog recovery audit
  (read-only, verdict D) (#76)"). Fetched fresh via `git fetch origin` at the start of this
  revision. Two PRs landed on `main` since the original design: **PR #75 (RESULT 2.0 Slice 1)
  merged** (`70f8485`) and **PR #76 (Pizza DB 160 catalog recovery audit, docs-only, verdict D)
  merged** (`5d28c5d`). Neither touches economy/Shop/Save/Recipe data — re-confirmed by diffing
  `d0f17d5..5d28c5d`: PR #75's file list is `App.tsx`/`ResultPanel.tsx`/`GameScreen.tsx`/CSS/tests
  (RESULT UI only) plus its own Result report; PR #76 is a single new docs file plus a
  `PROJECT_HANDOFF.md` update. Neither changes anything this design depends on. PR #77 (this
  design's own PR) reports `mergeable_state: "clean"` against the new `main` tip.
- **PR #77 (this design)**: confirmed **OPEN**, not merged, per instruction. This revision updates
  it in place — no new PR was created.

---

## 0. Executive summary

The user's fixed decision for this design: **only Margherita is makeable at game start; the
other 6 recipes are locked and unlock progressively through play.** This is a genuine reversal of
the currently-shipped model — today (`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md` §5,
re-confirmed against `src/state/progression.ts`/`src/data/ingredients.ts`) all 6 "Starter Set"
recipes (margherita/marinara/quattro-formaggi/genovese/bismarck/funghi) are **always available
from the very first launch**, with zero unlock condition; only the 7th recipe (フガッサ/fugazza,
gated on the `onion` ingredient) has ever had a lock. Sections 1-11 below design the full
replacement system.

**Core design choices, stated up front (justified in the sections that follow):**

1. **Recommended unlock order**: マルゲリータ(start) → フンギ → マリナーラ → ビスマルク →
   ジェノベーゼ → クアトロフォルマッジ → フガッサ.
2. **Unlock mechanism**: a new, explicit `Recipe.unlockCondition` — orthogonal to ingredient
   ownership — primarily "the previous recipe has been discovered" (any quality, ★1 floor is
   enough) for recipes #2–#5, plus a light `totalStars` signal only for the last two slots (#6,
   #7). No recipe before #6 ever requires a minimum score.
3. **Unlock ≠ purchase — DECIDED: Option A-10 (Unlock Starter Stock), applied uniformly to
   recipes #2–#7.** The instant a recipe unlocks, every new ingredient it needs is granted for
   free at a quantity of **`starterStockPlays = 10`** pizzas' worth — enough to practice the
   recipe roughly ten times, chase a BEST, and get comfortable with its new mechanic, before ever
   needing to touch the Shop. **This now includes フガッサ/`onion`** — the previous design's
   "keep onion's existing real 120-Pitz purchase, no free grant" exception is **removed**; Chapter
   1 uses one uniform acquisition rule across all six unlockable recipes. Shop purchases become
   relevant only as *restocking*, starting from each recipe's 11th play. See §4 (fully rewritten
   in this revision) for the full rationale and the `starterStockPlays` tuning-parameter design.
4. **Inventory unit model**: category-specific — scatter ingredients (cheese/topping) consume by
   **placed-piece count**; spread ingredients (sauce) consume as a **binary 1-use-per-pizza**.
   Unchanged from the original design; ratifies the existing Inventory E1 Fresh Audit
   (`docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` §6).
5. **Starter inventory (Margherita only)**: Margherita's 3 ingredients stay **permanently,
   unconditionally unlimited** — unchanged from today's already-shipped Starter policy, and
   structurally distinct from `starterStockPlays` (§5 explains the difference explicitly). This
   is the single biggest lever against softlocks (§8).
6. **Progression length**: recommend **FAST** (§7b) — unchanged reasoning, now reinforced by the
   fact that no recipe (including フガッサ) requires banked Pitz before its first play.

**Final verdict: A. READY — ECONOMY & PROGRESSION 1.0 DESIGN APPROVED.** The previous revision's
one open product decision (free-grant vs. universal-Shop-purchase for recipes #2–#6, with フガッサ
as a standing exception) has been resolved by explicit product decision: **Option A-10 for all of
#2–#7, no exception.** No other blocker was found while making this revision (§ Final Verdict
below states this explicitly, per instruction not to upgrade the verdict silently if a real
blocker existed).

---

## 1. STEP 1 — Current content matrix

**This section describes today's *shipped* code, not this design's target state.** Read directly
from `src/data/recipes.ts`, `src/data/ingredients.ts`, `src/data/referencePizza.ts`,
`src/state/progression.ts`, `src/logic/economy.ts`, `src/logic/pitzReward.ts`. Unchanged since the
original design (re-confirmed: PR #75/#76 did not touch any of these files).

| # | Recipe id | Name | Sauce (placement) | Required ingredients (`minCount`) | Piece total | Reference fixture | Bake target | Current unlock state | Current Shop dependency | Current Pitz reward |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `margherita` | マルゲリータ | tomato-sauce (spread) | mozzarella×3, basil×2 | 6 | `MARGHERITA_REFERENCE` ✓ | 60–80 | Starter — always available | none | `baseRewardPitz`=100 × quality multiplier |
| 2 | `marinara` | マリナーラ | tomato-sauce (spread, reused) | garlic×3, oregano×2 | 6 | `MARINARA_REFERENCE` ✓ | 45–65 | Starter — always available | none | 100 × mult |
| 3 | `quattro-formaggi` | クアトロ フォルマッジ | olive-oil (spread) | mozzarella×2, gorgonzola×2, parmigiano×2, fontina×2 | 9 | `QUATTRO_FORMAGGI_REFERENCE` ✓ | 65–85 | Starter — always available | none | 100 × mult |
| 4 | `genovese` | ジェノベーゼ | pesto (spread) | mozzarella×2, cherry-tomato×3 | 6 | `GENOVESE_REFERENCE` ✓ | 50–70 | Starter — always available | none | 100 × mult |
| 5 | `bismarck` | ビスマルク | tomato-sauce (reused) | mozzarella×3, egg×1 | 5 | `BISMARCK_REFERENCE` ✓ | 55–75 | Starter — always available | none | 100 × mult |
| 6 | `funghi` | フンギ | tomato-sauce (reused) | mozzarella×2, mushroom×3 | 6 | `FUNGHI_REFERENCE` ✓ | 58–78 | Starter — always available | none | 100 × mult |
| 7 | `fugazza` | フガッサ | olive-oil (reused) | onion×4, oregano×1 | 6 | `FUGAZZA_REFERENCE` ✓ | 63–83 | **LOCKED** until `onion` OWNED | `onion`, `unlockCondition: {minTotalStars: 12}`, `pricePitz: 120` | 100 × mult |

Quality multiplier (`src/logic/pitzReward.ts`, byte-identical to `scoring.ts`'s `STAR_THRESHOLDS`):
`total≥90→×1.2 (★5)`, `≥75→×1.0 (★4)`, `≥60→×0.8 (★3)`, `≥40→×0.5 (★2)`, `<40→×0 (★1)`. So a single
pizza's Pitz payout is one of **{0, 50, 80, 100, 120}** Pitz, deterministically tied to its star
rating — the same table this design reuses for every Pitz calculation below.

Every current ingredient except `onion` has **no `unlockCondition`** — all 13 are Starter, always
`OWNED`, never for sale (`STARTER_INGREDIENT_IDS` in `src/data/ingredients.ts`). This is exactly
the fact that has to change for the user's fixed decision (§2). **Today's `onion`/`pricePitz: 120`
real-purchase-required flow is the one thing this revision explicitly removes as an exception
(§4)** — the code cited in this row still describes what is shipped right now, not the target.

---

## 2. STEP 2 — Difficulty / teaching order

Unchanged from the original design. Evaluated on: sauce operation, topping count/types,
placement difficulty, bake difficulty, recipe recognition, ingredients newly introduced, and
continuity from the previous recipe.

| Order | Recipe | New vs. prior step | Why this position |
|---|---|---|---|
| 1 | **マルゲリータ** (start) | everything | Teaches spread-sauce (tomato) + scatter placement (2 types) + one bake zone. Simplest, most iconic, zero prerequisite. |
| 2 | **フンギ** | +1 ingredient (mushroom) | Reuses tomato-sauce + mozzarella verbatim (same piece count/shape as #1) and adds exactly one new topping. Bake zone (58–80) nearly overlaps #1's — the lowest possible learning delta for "second pizza." |
| 3 | **マリナーラ** | +2 ingredients (garlic, oregano), −cheese | Still tomato-sauce (zero new sauce mechanic) but removes cheese entirely — the first "not every pizza needs cheese" recognition lesson. Bake zone (45–65) is the first real "learn a new bake window" moment. |
| 4 | **ビスマルク** | +1 ingredient (egg) | Reuses tomato-sauce + mozzarella again but introduces a single, precisely-placed centerpiece instead of scattered pieces — a genuinely new placement skill and the clearest bake-recognition cue (egg white/yolk state) of any of the 7. Lowest total piece count (5). |
| 5 | **ジェノベーゼ** | +2 ingredients (cherry-tomato), +1 new sauce (pesto) | First alternate spread sauce — new color/texture to paint, same "spread" gesture as tomato-sauce, so the motor skill transfers even though the visual target is new. |
| 6 | **クアトロ フォルマッジ** | +3 cheeses (gorgonzola/parmigiano/fontina), +1 new sauce (olive-oil) | The recognition/sorting capstone: a second alternate spread sauce (olive-oil is pale/translucent — genuinely harder to read coverage on) **and** three brand-new cheeses that must be told apart from mozzarella and each other, at the highest piece count (9) and highest ingredient-type count (5) of any recipe. |
| 7 | **フガッサ** (last) | +1 ingredient (onion), reuses olive-oil + oregano | Nothing mechanically new (both its ingredients were already learned in #3/#6) — it demands *mastery* of everything learned so far: oil-painting, the highest single-ingredient scatter count of any recipe (onion×4), and the least visually forgiving presentation (no sauce-red, no cheese-melt). A fitting "graduation" recipe by content difficulty alone — its position no longer depends on being the one recipe with a real-purchase requirement (§4 removes that distinction), it earns last place purely on §2's own difficulty axes. |

---

## 3. STEP 3 — Unlock conditions

**Principle (per the user's fixed decision): no skill wall early. The first new recipe unlocks
fast. Only the last one or two slots may carry a light skill signal.** Unchanged from the
original design — this revision only changes *what materials arrive with* an unlock (§4), not
*when* a recipe becomes visible/eligible.

### 3.1 New architecture: `Recipe.unlockCondition` (orthogonal to ingredient ownership)

Today, `isRecipeAvailable` derives availability **only** from ingredient ownership — there is no
recipe-level lock at all. The recommended model adds a small, new, explicit field:

```ts
// src/data/recipes.ts (design — not implemented in this session)
export interface RecipeUnlockCondition {
  /** This recipe becomes unlocked once `requiresRecipeId` has been discovered
   *  (dex entry `discovered: true`) at least once, at any quality. */
  requiresRecipeId?: RecipeId;
  /** Additionally (AND, not OR) requires this much accumulated totalStars. */
  minTotalStars?: number;
}

export interface Recipe {
  // ...existing fields unchanged...
  unlockCondition?: RecipeUnlockCondition; // absent = always unlocked (Margherita only, today)
}
```

`isRecipeAvailable` becomes a **two-axis AND**: `recipeUnlocked(recipe) && ingredientsOwned(recipe)`
— the "Recipe unlocked ≠ Ingredient acquired" separation the task requires (§4).

### 3.2 Concrete conditions, all 7 recipes

| # | Recipe | `unlockCondition` | Rationale |
|---|---|---|---|
| 1 | margherita | *(none — always unlocked)* | Start. |
| 2 | funghi | `{ requiresRecipeId: "margherita" }` | Unlocks the instant Margherita is completed once, **any quality** (★1 floor still counts as "discovered"). |
| 3 | marinara | `{ requiresRecipeId: "funghi" }` | Same pattern — chained, one recipe at a time. |
| 4 | bismarck | `{ requiresRecipeId: "marinara" }` | Same pattern. |
| 5 | genovese | `{ requiresRecipeId: "bismarck" }` | Same pattern. |
| 6 | quattro-formaggi | `{ requiresRecipeId: "genovese", minTotalStars: 8 }` | First light skill signal. By this point 5 recipes are discoverable; even at the ★1 floor per recipe, `totalStars` is already 5 — reaching 8 needs only a modest average (~1.6★/recipe). |
| 7 | fugazza | `{ requiresRecipeId: "quattro-formaggi", minTotalStars: 12 }` | Recipe-level *visibility/sequencing* condition — unchanged value, reusing `onion`'s existing, already-shipped, already-simulated `minTotalStars: 12`. **What changes in this revision is not this condition, but what happens once it is met** (§4): `onion` is now free-granted like every other new ingredient, not purchased. |

No recipe before #6 has any score/star requirement at all. This is unchanged from the original
design and is **not** what this revision resolves — the resolved item is acquisition method
(§4), not unlock timing.

---

## 4. STEP 4 — Unlock ≠ Purchase: DECIDED — Option A-10 (Unlock Starter Stock)

*(Fully rewritten in this revision. The original design's "Option A vs. Option D, hybrid,
フガッサ excepted" framing is superseded by the product decision below.)*

### 4.1 The decision

> **Every recipe unlock (#2–#7) grants a free starter stock of every new ingredient that recipe
> needs, sized to `starterStockPlays = 10` pizzas' worth. フガッサ/`onion` is included — no
> exception.**

Basic loop, as specified:

```
新レシピ解禁
→ 10回分スターター材料獲得
→ 練習
→ 上達/BEST更新
→ 在庫減少
→ Shopで補充
→ 再挑戦
```

Purpose (as specified, retained verbatim as the design rationale):

- Enough material to genuinely practice a new recipe, not just try it once.
- Room to fail and re-attempt the new operation/mechanic without fear of running out mid-way.
- No forced Shop trip immediately after unlocking.
- Enough headroom to chase a BEST/quality improvement, not just a single pass/fail attempt.
- A natural, un-forced glide into Shop/Inventory once the free stock is actually exhausted (by
  the recipe's 11th attempt).

### 4.2 Why this supersedes the original "Option A vs. D" split

The original design kept フガッサ/`onion` on the existing, already-shipped "real 120-Pitz
purchase, no free grant" path, specifically to preserve one deliberate "now really spend your
Pitz" milestone and minimize implementation risk (reusing already-tested code unchanged). The
product decision explicitly removes that exception: **Chapter 1's rule is uniform across all 6
unlockable recipes.** The Shop's role is not eliminated — it is *relocated*: instead of being the
gate for a recipe's very first play, it becomes the natural mechanism for a recipe's **11th
play onward** for every one of #2–#7, including フガッサ. This is arguably a stronger, more
consistent design than the original hybrid: a player who has played a recipe ten times and wants
an eleventh has clearly demonstrated interest in it, which is a better-earned moment to introduce
"now spend Pitz to keep going" than a first-unlock cliff ever was.

### 4.3 `starterStockPlays`: an Economy tuning parameter, not a magic number

**`starterStockPlays = 10` is a Chapter-1-scoped balance constant, not a value to be inlined
anywhere in implementation code.** Design requirement for whichever slice implements this
(§12 EP4):

```ts
// src/data/economyConfig.ts (design — not implemented in this session)
/** How many pizzas' worth of a newly-unlocked recipe's new ingredient(s) are granted for free,
 *  the instant that recipe's unlockCondition is satisfied. A single named constant, never an
 *  inlined literal at any call site, precisely so a future catalog tier (see below) can override
 *  it per-recipe without a call-site edit. */
export const STARTER_STOCK_PLAYS_CHAPTER_1 = 10;
```

This must **not** be hand-copied as a literal `10` into `gameReducer.ts`, `economy.ts`, or
anywhere else — every computation of a starter-grant quantity (`minCount × starterStockPlays`
for scatter, `starterStockPlays` uses for spread) must read this one constant.

**Future scaling (explicitly out of scope to design further here, recorded only as a forward
note per instruction)**: once the catalog grows beyond Chapter 1's 7 recipes (the 160-class
catalog referenced in `docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md`, verdict D — not
otherwise read or relied on by this design), `starterStockPlays` should become **tier-scoped**,
not a single global constant:

| Tier | `starterStockPlays` (illustrative, not decided here) |
|---|---|
| starter | 10 |
| early | 10 |
| mid | 5 |
| late | 3 |
| master | 0–3 |

**Chapter 1 itself uses exactly one value, `10`, uniformly for recipes #2–#7 — no tiering within
Chapter 1.** The table above is a forward design note for a future catalog-expansion design
session, not a Chapter-1 decision, and must not be implemented ahead of that future session.

### 4.4 Starter-grant quantities (derivation)

Per §6.1's unit model (unchanged): scatter ingredients grant `minCount × 10` pieces; spread/sauce
ingredients grant `10` uses. Full table in §6.2 (revised) and in the companion MATRIX doc.

### 4.5 What remains true from the original design

- **A/B/C/D framing retained for the record**: Option A (free grant, now specifically "A-10")
  is the decided mechanism; Option B (flat Pitz bonus on unlock) remains rejected as a
  *substitute* for A-10, for the same reason as before — it still requires a Shop trip before the
  recipe is actually playable, which A-10 is specifically designed to avoid. Option C
  (first-play-free, tracked separately from stock) is subsumed by A-10 — a 10-play stock value
  *is* the "first N plays free" mechanism, just sized generously rather than to exactly one play.
  **Option D (Shop purchase required, no free grant) is no longer used anywhere in Chapter 1**,
  including フガッサ — this is the one concrete change this revision makes to the option
  landscape.

---

## 5. STEP 5 — Starter inventory

**Margherita's 3 ingredients (`tomato-sauce`, `mozzarella`, `basil`) stay permanently,
unconditionally unlimited — unchanged from the already-shipped Starter policy, and unaffected by
this revision.** This directly answers the task's "3枚/5枚/無限" question: **無限 (unlimited)**,
not a numeric cap.

**Explicit distinction from `starterStockPlays` (§4), to avoid confusion between two
similarly-named but structurally different guarantees:**

| | Margherita's own 3 ingredients | Every other recipe's new ingredient(s) |
|---|---|---|
| Mechanism | Permanently exempt from stock tracking entirely (`hasStock` returns `true` unconditionally) | Finite stock, initialized to `minCount × starterStockPlays` (or `starterStockPlays` uses, for sauce) on unlock |
| Can ever reach 0? | No — never tracked as a countable quantity | Yes — after 10 plays' worth of consumption, exactly as intended (§4.1's loop) |
| Why | Softlock guard (§8) — must never be capable of running out | Practice buffer — *meant* to eventually run out, at a generous size, so Shop restocking becomes relevant |

Reasons for keeping Margherita's own policy unchanged (unaffected by this revision):

- It is already implemented and tested (`hasStock`'s design in the Inventory E1 Fresh Audit §5).
- It is the single load-bearing softlock guard (§8): as long as Margherita's own ingredients can
  never run out, the player always has *some* recipe they can make and *some* way to earn Pitz.
- No other recipe needs a *separate* "starter inventory" concept beyond §4's uniform 10-play
  grant — Margherita is the sole permanently-unlimited case, by design, not merely the first one
  to receive a large grant.

---

## 6. STEP 6 — Material prices

### 6.1 Inventory unit model

Unchanged from the original design — ratifies the existing Inventory E1 Fresh Audit
(`docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` §6), not renegotiated in this revision:

- **Scatter ingredients** (every cheese/topping, `placement: "scatter"`): **1 unit = 1 placed
  piece**. A recipe's `minCount` is its baseline consumption per pizza.
- **Spread/sauce ingredients** (`placement: "spread"`): **1 unit = 1 pizza's use**, binary.

### 6.2 Price table (revised — starter grants now ×10, フガッサ/onion included)

All 7 recipe base rewards are `baseRewardPitz: 100`, unchanged. A single pizza's Pitz payout is
one of `{0, 50, 80, 100, 120}` depending on stars. **Restock pricing target is unchanged from the
original design**: a full 3-pizza restock batch should cost roughly one NORMAL-tier pizza's own
reward (≈80–100 Pitz) for an ordinary topping, scaling up modestly for higher-piece-count or
thematically "special" ingredients. **Only the "starter grant" column changes in this revision**
(×10 instead of ×1, and フガッサ/onion now has a grant instead of "none").

| Ingredient | Category/placement | `minCount`/pizza (home recipe) | Unlocks with | **Starter grant on unlock (`starterStockPlays = 10`)** | Restock batch (≈3 pizzas) | Restock price (Pitz) | Cost/pizza (restock) |
|---|---|---|---|---|---|---|---|
| tomato-sauce | sauce/spread | 1 use | Margherita (Starter) | n/a — permanently unlimited | n/a | free | 0 |
| mozzarella | cheese/scatter | 2–3 | Margherita (Starter) | n/a — permanently unlimited | n/a | free | 0 |
| basil | topping/scatter | 2 | Margherita (Starter) | n/a — permanently unlimited | n/a | free | 0 |
| mushroom | topping/scatter | 3 | フンギ (#2) | **30 units** (3 × 10) | 9 units | 60 Pitz | ~20/pizza |
| garlic | topping/scatter | 3 | マリナーラ (#3) | **30 units** | 9 units | 60 Pitz | ~20/pizza |
| oregano | topping/scatter | 2 (also used 1/pizza by フガッサ) | マリナーラ (#3) | **20 units** (2 × 10) | 6 units | 45 Pitz | ~22.5/pizza (マリナーラ) / ~7.5 (フガッサ) |
| egg | topping/scatter | 1 | ビスマルク (#4) | **10 units** | 3 units | 45 Pitz | 15/pizza |
| pesto | sauce/spread | 1 use | ジェノベーゼ (#5) | **10 uses** | 3 uses | 60 Pitz | 20/pizza |
| cherry-tomato | topping/scatter | 3 | ジェノベーゼ (#5) | **30 units** | 9 units | 60 Pitz | ~20/pizza |
| olive-oil | sauce/spread | 1 use (also used by フガッサ) | クアトロ フォルマッジ (#6) | **10 uses** | 3 uses | 50 Pitz | ~16.7/pizza |
| gorgonzola | cheese/scatter | 2 | クアトロ フォルマッジ (#6) | **20 units** | 6 units | 70 Pitz | ~23.3/pizza |
| parmigiano | cheese/scatter | 2 | クアトロ フォルマッジ (#6) | **20 units** | 6 units | 70 Pitz | ~23.3/pizza |
| fontina | cheese/scatter | 2 | クアトロ フォルマッジ (#6) | **20 units** | 6 units | 70 Pitz | ~23.3/pizza |
| onion | topping/scatter | 4 | フガッサ (#7) | **40 units** (4 × 10) — **no exception, same rule as every other recipe** | 12 units | 120 Pitz (unchanged restock price) | 40/pizza |

Onion's restock batch/price (12 units / 120 Pitz for the 11th-play-onward refill) is **unchanged**
from the original design — only the *initial* acquisition changes (free 40-unit grant instead of
a mandatory purchase). Shared ingredients (`oregano`, `olive-oil`) top up the same
`inventory[id]` pool additively when a second recipe that uses them unlocks later (per the task's
explicit "同一材料が複数レシピで共有される場合は、inventoryへ通常加算する" instruction) — e.g. a
player who unlocks マリナーラ then later フガッサ ends up with `oregano` stock from *two* separate
10-play grants added together, not overwritten.

Sanity check (unchanged from original): fully restocking クアトロ フォルマッジ 3× still costs 260
Pitz for 3 pizzas (~86.7/pizza) — comfortably under one NORMAL-tier pizza's own ~90–100 Pitz
reward. This math is unaffected by the starter-grant-size change, since restock batch/pricing is
a separate, unchanged parameter from the starter grant.

---

## 7. STEP 7 — Economy simulation (revised)

Three player types, START → all 7 recipes discovered and makeable at least once, using §3's
unlock conditions and §4's uniform 10-play starter grant (now including フガッサ). `STAR_
THRESHOLDS`: `<40→★1(×0)`, `40–59→★2(×0.5)`, `60–74→★3(×0.8)`, `75–89→★4(×1.0)`, `≥90→★5(×1.2)`.

| | Player A (beginner, quality ~50–65) | Player B (normal, quality ~70–85) | Player C (skilled, quality ~90+) |
|---|---|---|---|
| Typical stars/play | mostly ★2–★3 (avg ≈2.5) | mostly ★3–★4 (avg ≈3.7) | mostly ★5, occasional ★4 (avg ≈4.8) |
| Typical Pitz/play | ~50–80 (avg ≈65) | ~80–100 (avg ≈90) | ~115–120 (avg ≈115) |
| Plays to discover #1–#6 (1 attempt each, chained unlock) | 6 | 6 | 6 |
| `totalStars` after 6 discoveries | ≈15 | ≈22 | ≈29 |
| `minTotalStars: 8` (recipe #6 gate) met? | Yes, by discovery #4–5 | Yes, by discovery #3–4 | Yes, by discovery #2–3 |
| `minTotalStars: 12` (recipe #7 gate) met? | Yes, by discovery #5–6 | Yes, by discovery #4–5 | Yes, by discovery #3–4 |
| **Pitz needed to first-make フガッサ once eligible** | **0 — free 40-unit onion grant, no purchase check** | **0** | **0** |
| **Plays to unlock + first-make all 7** | **~6–7** | **~6–7** | **~6–7** |

**What changed vs. the original simulation**: the original table included a "can afford onion
(120 Pitz)?" affordability check as part of reaching "all 7 unlocked and makeable." **That check
no longer exists** — フガッサ's first play, like every other unlockable recipe's first play, costs
zero Pitz once its `unlockCondition` is met (§4). All three player tiers now reach "all 7
unlocked and makeable at least once" in essentially the same ~6–7 plays, purely gated by
`totalStars`/completion sequencing, never by banked currency. Pitz's role is now **exclusively**
about *replaying* a recipe past its free 10-play allowance (§4.1's loop, "在庫減少→Shopで補充"),
which happens well after the "all 7 unlocked" milestone for every simulated tier, since 10 plays
of headroom per recipe is generous relative to a first playthrough.

---

## 7b. TARGET — FAST / NORMAL / SLOW progression length (unaffected, reconfirmed)

| Variant | Structure | Approx. plays to unlock all 7 |
|---|---|---|
| **FAST** (recommended) | Exactly as designed in §3: chained completion-only gates for #2–#5, light `totalStars` (8/12) for #6/#7. | **~6–7** (revised down slightly from ~6–9, since フガッサ no longer has a separate Pitz-affordability step) |
| NORMAL | Same chain, but each of #3–#6 additionally requires the previous recipe to have been made twice, and #6/#7 thresholds raised to 10/16. | **~12–18** |
| SLOW | Adds a real BEST-quality floor to #4–#7 on top of NORMAL's replay requirement. | **~25–35** |

**Recommendation: FAST — unchanged.** The reasoning from the original design holds and is
slightly strengthened: removing フガッサ's Pitz-purchase requirement removes the *one* place the
original FAST estimate had any currency dependency at all — the revised FAST path is now purely
skill/completion-paced from start to finish, which is the cleanest possible realization of "don't
put a skill or money wall in the onboarding chapter."

---

## 8. STEP 8 — Softlock analysis (revised)

| Case | Risk under this design | Why |
|---|---|---|
| Pitz = 0 | **None, for any of the 7 recipes' first play, including フガッサ.** | Margherita is always makeable (unlimited Starter stock) and always pays Pitz per completion. Recipes #2–#7's *first ten* plays never require Pitz at all (§4's uniform 10-play grant) — this is a **strengthening** vs. the original design, which still had one Pitz-gated recipe (フガッサ). |
| Inventory = 0 (ran out of a granted/purchased ingredient) | **None for any recipe's first 10 plays.** Possible-but-recoverable beyond that (any recipe's 11th+ play). | A depleted ingredient simply removes that one tile from the tray — it never blocks Margherita, never blocks a newly-unlocked recipe's practice window, and is always resolved by playing Margherita (or any already-stocked recipe) to earn Pitz, then restocking. |
| All materials short | **None.** | Same as above — Margherita's own materials cannot be short by construction, and every other recipe starts with a 10-play buffer. |
| Immediately after a new recipe unlocks | **None — strengthened.** | §4's uniform starter grant guarantees not just "makeable once" (the original design's Option A) but "makeable roughly ten times" — a materially larger practice buffer than the original design provided, for every recipe including フガッサ. |
| Low score streak | **None.** | Unchanged from original — recipes #2–#5 need only a completion (★1 floor), not a score. |
| Shop purchase mistake | **Low, and now applies uniformly, including フガッサ.** | All Shop purchases are additive stock, never destructive. The original design's one asymmetric case (a player could "mis-plan" around needing exactly 120 Pitz for onion with no free alternative) no longer exists — every recipe, フガッサ included, has the same 10-play grace window before any purchase decision matters at all. |
| Save migration user | **Unchanged — still needs an explicit migration rule at implementation time (§8 of the original design, retained).** | Not resolved further in this revision; the recommended rule (retroactive chain application against existing Dex state) is unaffected by the starter-grant change. |
| Lunch Rush-only play | **None.** | Unchanged from original — `getNextOrder`'s existing `availableRecipeIds` parameter already provides the extension point. |

**Conclusion: no unrecoverable "nothing can be made" state exists under this design, and this
revision closes the one place the original design's softlock analysis carried a (still very low,
but non-zero) currency dependency — フガッサ's first play.**

---

## 9. STEP 9 — Pizza Select locked-state UX (rationale adjusted, treatment unchanged)

The differentiated treatment recommended in the original design is **retained**:

- **Recipes #2–#6 (chain-unlocked)**: show the **recipe name**, not `？？？` — e.g.
  `🔒 フンギ / マルゲリータを1枚完成させると解禁`.
- **Recipe #7 (フガッサ)**: keep the existing `？？？` + star hint (`🔒 ？？？ / あと★◯で解禁`).

**What changes in this revision is only the justification for #7's continued mystery
treatment**, since the original rationale partly cited its real-purchase requirement (now
removed, §4). The mystery-reveal treatment for フガッサ is retained on presentation grounds alone:
its late position (§2, hardest/last by content difficulty) and its status as the single largest
starter grant (40 onion units, §6.2) both support keeping it the one deliberate "big reveal"
moment in the arc, independent of how its ingredients are acquired. This is a presentation
choice, not a re-derivation of the acquisition mechanic itself.

---

## 10. STEP 10 — RESULT integration (design only — PR #75 now merged, still not touched by this design)

**No code change proposed or made here.** PR #75 (RESULT 2.0 Slice 1) merged into `main` since
the original design revision (§ audited SHA note above) — this design still does not read its
diff beyond what was already public in its merged Result report title, and proposes no change to
its shipped code. This section remains forward-looking design for whichever future slice wires
progression feedback into RESULT/DISCOVERED.

Two complementary signals, both derivable purely from state this design already defines:

1. **"How close to the next unlock" progress line** — e.g. `次のレシピまで、あと1枚！` (chain-gate
   case) or `次のレシピまで ★8 / あと3！`（totalStars case).
2. **"New recipe unlocked!" banner**, paired with the **starter-grant note** (revised wording) —
   e.g. `🎉 NEW RECIPE ビスマルク解禁！たまごを10個プレゼントされました！` (was "1個" in the
   original design; now reflects the 10-play grant), mirroring `ShopOverlay`'s existing
   purchase-feedback copy pattern.

No interaction with Scoring 2.0, Pitz formula, or Save schema, consistent with the scope guard.

---

## 11. STEP 11 — MASTER recommendation (unaffected)

Unchanged from the original design. No `MASTER` concept exists in code today. **MASTER must not
gate any of the 7 base-recipe unlocks designed here** — it belongs to optional late-game
mastery/cosmetic reward, and to a future advanced-recipe unlock (the 20-recipe / 160-class
catalog expansion — see `docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md`, verdict D, not
otherwise relied on here), where the tiered `starterStockPlays` table sketched in §4.3 would also
live.

---

## 12. Implementation slices (revised order and content, per this revision's instruction)

Sequenced against the existing Inventory E1/E2 track, in the exact top-level order specified for
this revision:

| Slice | Scope | Depends on |
|---|---|---|
| **EP0 — Inventory E1 foundation** | Land the already-fully-scoped, already-audited Inventory E1 slice (`InventoryState`/`hasStock`/`remainingStock`, carry-through into `GameState`/persistence) — see `docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` and its Preflight, verdict A, "under 1.5 hours." Not part of this design; every slice below assumes it exists. | Nothing new from this design. |
| **EP1 — Recipe Unlock foundation** | `Recipe.unlockCondition` type + data (§3.1/3.2) + `recipeUnlocked()` pure function + `isRecipeAvailable` becomes the two-axis AND (§4). Pizza Select's differentiated LOCKED rendering (§9). Lunch Rush order pool restricted to unlocked recipes via the existing `availableRecipeIds` extension point. Pure logic + unit tests, no Inventory dependency yet. | EP0 not required (orthogonal). |
| **EP2 — Inventory E2 atomic consumption** | Inventory consumption at `CONFIRM_BAKE` (§6.1 unit model: scatter=placed-piece-count, sauce=binary). This is Inventory **E2**, not newly invented here; this design ratifies its unit-semantics open question. Must add the `phase !== "BAKE"` guard the E1 audit already flagged as a pre-existing defect. | EP0. |
| **EP3 — Shop 2.0 restock/purchase** | Extends `purchaseIngredient`/`ShopOverlay` from "grant ownership once" to "credit `inventory[id]` by a batch quantity, repeatable" (§6.2 restock table). Applies uniformly to all 11 non-Starter ingredients, `onion` included — no special-cased purchase-gate logic for フガッサ needs to be written or preserved. | EP2. |
| **EP4 — Chapter 1 economy integration** | Wires EP1's recipe-unlock event to a new, exactly-once "grant starter stock" transaction: on `recipeUnlocked` crossing false→true, auto-`OWNED` the recipe's new ingredient(s) and credit `inventory[id]` by `minCount × STARTER_STOCK_PLAYS_CHAPTER_1` (scatter) or `STARTER_STOCK_PLAYS_CHAPTER_1` uses (spread) — reading the named constant (§4.3), never an inlined `10`. Needs an exactly-once guard, same pattern as `REGISTER_TO_DEX`'s existing `phase !== "RESULT"` guard (§13 risk). Shared ingredients (`oregano`/`olive-oil`) additively top up existing stock, per §6.2. Save v1→v2-era migration rule (§8) ships in this slice, not before it. | EP1, EP2, EP3. |
| **Human Feel / balance** | Real playtesting pass against §7's simulation and §6.2's price table — confirm `starterStockPlays = 10`, the two `totalStars` thresholds (8/12), and restock prices feel right in actual play, adjusting the named constants (never inlining a replacement) if evidence calls for it — mirroring how `onion`'s own threshold was adjusted once (18→12) after an earlier simulation pass. | EP4. |

RESULT integration (§10) remains explicitly **deferred** until RESULT 2.0's own follow-up slices
stabilize independently of this track — it is not one of the numbered EPs above, consistent with
it having an external dependency this design does not control.

---

## 13. Risks (revised)

- **Reversing today's "6 Starter recipes always available" model is still a real behavior
  change** — unaffected by this revision. EP4's migration rule must ship in the same release as
  EP1, or existing players regress (unchanged risk from the original design, now explicitly
  folded into EP4 rather than a separate EP8).
- **`STARTER_INGREDIENT_IDS` still shrinks from 13 to 3** — unaffected by this revision.
- **The starter-grant mechanism (EP4) needs an exactly-once guard** — unaffected in kind, but
  now larger in blast radius if it fails: a re-triggerable grant bug would over-grant **10 plays'
  worth** of stock per accidental re-fire (vs. 1 pizza's worth in the original design), making
  this guard's correctness more consequential to get right, not just as important. Copy
  `REGISTER_TO_DEX`'s existing exactly-once pattern rather than inventing a new one.
- **`starterStockPlays` must be a single named constant, never inlined** (§4.3) — this is a new,
  explicit requirement of this revision. A future tiered-catalog expansion (§4.3's forward table)
  depends on every call site reading one constant rather than a scattered literal `10`; failing
  to enforce this now would make that future migration a much larger find-and-replace exercise
  than it needs to be.
- **The removed フガッサ/`onion` purchase-requirement exception simplifies EP3/EP4's logic** (one
  fewer special case to implement and test), which **reduces** implementation risk relative to
  the original design's hybrid — noted here as a risk reduction, not a new risk.
- **Price/threshold numbers in §6/§3 remain derived, not simulator-verified against live code** —
  unaffected by this revision; still flagged for Human Feel validation (§12's final row).
- **RESULT integration (§10) still has an external dependency** on RESULT 2.0's own follow-up
  work, now that PR #75 (its first slice) has merged — unaffected in kind, timing updated.

---

## 14. Unresolved design decisions (revised — one item resolved and removed)

~~1. Free-grant (Option A) vs. universal Shop purchase (Option D) for recipes #2–#6, with フガッサ
as a standing exception.~~ **RESOLVED by this revision — see §4. Option A-10, uniform across
#2–#7, no exception.**

Remaining, unaffected by this revision:

1. **Migration policy exact mechanics (§8)** — the recommended "apply the new chain retroactively
   against existing Dex" is a design-level recommendation; the exact reducer-level implementation
   should be decided at EP4 implementation time.
2. **Exact starter-grant guard mechanism (EP4)** — whether "already granted" is tracked as a new
   persisted set or derived implicitly from "is the ingredient already OWNED" is an
   implementation-time call.
3. **Whether `oregano`'s and `olive-oil`'s dual role** (used by two different recipes, additively
   topped up per §6.2) should have one shared inventory pool (as designed) or separate per-recipe
   pools — this design treats them as one shared pool (simplest, matches `InventoryState`'s flat
   `Record<id, number>` shape) but flags it explicitly.
4. **Exact FAST-variant numbers (§7b) are a recommendation, not a locked spec** — subject to the
   Human Feel pass in §12's final row.

None of these four is a product-level blocker — each is an ordinary implementation-time detail,
consistent with how every other "READY" verdict in this project's own audit history (e.g. the
Inventory E1 Fresh Audit's own verdict A) still lists comparable open implementation notes
without that preventing a READY verdict.

---

## Final verdict

**A. READY — ECONOMY & PROGRESSION 1.0 DESIGN APPROVED.**

The previous revision's one genuine open product decision — free-grant vs. universal-Shop-purchase
for recipes #2–#6, with フガッサ as a standing exception — has been resolved by explicit product
decision (§4: **Option A-10, `starterStockPlays = 10`, applied uniformly to recipes #2–#7, no
exception**). This revision re-checked the rest of the design against the new `main` tip
(`5d28c5d`, two merged PRs since the original audit) and found **no other blocker**: neither PR #75
(RESULT 2.0 Slice 1, merged) nor PR #76 (Pizza DB 160 catalog audit, docs-only, verdict D) touches
anything this design depends on, and PR #77 itself reports a clean, conflict-free merge state
against the new base. The four items in §14 are ordinary implementation-time details, not
product-level blockers, and do not prevent this verdict.

## Report summary

- **Audited SHA**: `5d28c5dc996c0ea76aa6428f158a766165477213` (`main`, this revision) —
  `d0f17d57e06a9cddaf1cbb143d1dbaba8bb8bdf3` (`main`, original design).
- **PR #75**: merged since the original design; not touched, not built on beyond its public title.
- **PR #77** (this design): OPEN, updated in place by this revision, not merged.
- **Recommended 7-recipe unlock order**: マルゲリータ(start) → フンギ → マリナーラ → ビスマルク →
  ジェノベーゼ → クアトロフォルマッジ → フガッサ. Unchanged.
- **`starterStockPlays`**: **10**, Chapter-1-scoped named constant, applied uniformly to recipes
  #2–#7.
- **Margherita policy**: permanently, unconditionally unlimited ingredients + normal Pitz earning
  — unchanged, the core softlock guard, structurally distinct from `starterStockPlays`.
- **Recipes #2–#7 policy**: unlock condition unchanged from the original design (§3); acquisition
  method is now uniformly "10-play free starter grant," Shop relevant only from the 11th play.
- **フガッサ exception removed**: **Yes** — `onion` now receives the same 10-play free grant
  (40 units) as every other newly-unlocked ingredient; its existing 120-Pitz/12-unit *restock*
  price is unchanged and applies only to its 11th-play-onward refills.
- **Unresolved decisions remaining**: 4 ordinary implementation-time details (§14), none
  product-blocking.
- **CI status**: N/A — docs-only change, no code path affected, no CI-relevant file touched.
- **Final verdict**: **A. READY — ECONOMY & PROGRESSION 1.0 DESIGN APPROVED.**
