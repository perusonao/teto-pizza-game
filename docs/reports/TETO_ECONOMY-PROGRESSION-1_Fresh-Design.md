# Teto Pizza Game — Economy & Progression 1.0 (Fresh Design)

**Scope: read-only design. No production code (`src/**`, tests, scoring, Pitz formula, Save
schema, Recipe data, Shop/RESULT production UI) was touched in this session. Docs only.**

- **Audited `origin/main` SHA**: `d0f17d57e06a9cddaf1cbb143d1dbaba8bb8bdf3` ("docs: RESULT 2.0
  Slice 2 Player Feedback Preflight (read-only) (#74)"). Fetched fresh via `git fetch origin` at
  session start.
- **PR #75 (RESULT 2.0 Slice 1)**: confirmed **OPEN**, base `aaf56edaea533f9efc63b3ba623bf1ae8425a6b5`,
  head `e5d5452a6af05e3f8329a65226a0592df2df5def`, not merged, "Human Review待ち" per its own PR
  body ("stays OPEN pending dedicated Preview deployment, Review Playthrough video, and Human
  Review"). **Not read beyond its PR metadata, not built on, not touched.** This design was done
  entirely against `main` as of the SHA above, which is a few commits ahead of PR #75's base
  (`398d4844`→`aaf56ed` lineage) but does not include PR #75's own diff.
- Other open PRs on this repo (`#72`, `#46`, `#34`, `#3`) are stale/docs-only/unrelated — none
  touch economy, Shop, Save schema, or recipe data.

---

## 0. Executive summary

The user's fixed decision for this design: **only Margherita is makeable at game start; the
other 6 recipes are locked and unlock progressively through play.** This is a genuine reversal of
the currently-shipped model — today (`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md` §5,
re-confirmed against `src/state/progression.ts`/`src/data/ingredients.ts` on this SHA) all 6
"Starter Set" recipes (margherita/marinara/quattro-formaggi/genovese/bismarck/funghi) are
**always available from the very first launch**, with zero unlock condition; only the 7th recipe
(フガッサ/fugazza, gated on the `onion` ingredient) has ever had a lock. Sections 1-11 below design
the full replacement system: which 6 of `RECIPES` unlock in what order, on what conditions,
what ingredients accompany each unlock and how the player acquires them, how in-game material
stock and pricing work, and how this connects to Pitz, Shop, Dex/BEST, RESULT and MASTER.

**Core design choices, stated up front (justified in the sections that follow):**

1. **Recommended unlock order**: マルゲリータ(start) → フンギ → マリナーラ → ビスマルク →
   ジェノベーゼ → クアトロフォルマッジ → フガッサ(last, unchanged from today's already-shipped
   onion gate).
2. **Unlock mechanism**: a new, explicit `Recipe.unlockCondition` — orthogonal to ingredient
   ownership — primarily "the previous recipe has been discovered" (any quality, ★1 floor is
   enough) for recipes #2–#5, plus a light `totalStars` signal only for the last two slots (#6,
   #7). No recipe before #6 ever requires a minimum score.
3. **Unlock ≠ purchase**: for recipes #2–#6, the new ingredient(s) that recipe needs are
   **auto-granted for free, exactly one pizza's worth**, the instant the recipe unlocks — so a
   player is never told "new recipe!" and then blocked by an empty tray. Recipe #7 (フガッサ)
   keeps its **existing, unchanged, real Shop purchase** (`onion`, 120 Pitz) — the one deliberate
   "now really spend your Pitz" milestone.
4. **Inventory unit model**: category-specific — scatter ingredients (cheese/topping) consume by
   **placed-piece count**; spread ingredients (sauce) consume as a **binary 1-use-per-pizza**.
   This is not invented here; it is the model the existing, already-merged Inventory E1 Fresh
   Audit (`docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` §6) already worked out and
   explicitly left for "E2/a later design step" to ratify. This document ratifies it.
5. **Starter inventory**: Margherita's 3 ingredients stay **permanently, unconditionally
   unlimited** — unchanged from today's already-shipped Starter policy. This is the single
   biggest lever against softlocks (§8) and is not renegotiated here.
6. **Progression length**: recommend **FAST** (~6–9 plays to unlock and first-make all 7
   recipes) over NORMAL/SLOW alternatives (§7 "TARGET"), because the 7-recipe set is documented
   project-wide as the *first chapter* before a future 20-recipe catalog (`PROJECT_HANDOFF.md`
   P6), and because every existing precedent in this codebase (onion/fugazza's own tuning
   history) already aims for "a few plays," not a long grind.

Final verdict: **B. READY — NEEDS ONE PRODUCT DECISION** (§ Final Verdict).

---

## 1. STEP 1 — Current content matrix

Read directly from `src/data/recipes.ts`, `src/data/ingredients.ts`, `src/data/referencePizza.ts`,
`src/state/progression.ts`, `src/logic/economy.ts`, `src/logic/pitzReward.ts` on the audited SHA.
No values below are inferred or guessed.

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
the fact that has to change for the user's fixed decision (§2).

`isRecipeAvailable` (`src/state/progression.ts`) derives a recipe's makeability **purely** from
whether every required ingredient is `OWNED` — there is no separate "recipe unlocked" flag
anywhere in the codebase today (explicit design comment on the function itself). `recipeCardState`
(`src/state/pizzaSelect.ts`) already renders a `LOCKED` card with an optional text hint
(`unlockHintFor`, sourced only from `Ingredient.unlockCondition`) — today this only ever fires for
フガッサ, since it is the only recipe with a non-Starter ingredient.

---

## 2. STEP 2 — Difficulty / teaching order

Evaluated on: sauce operation, topping count/types, placement difficulty, bake difficulty,
recipe recognition, ingredients newly introduced, and continuity from the previous recipe
(re-using an already-learned gesture/ingredient lowers the learning delta; introducing a brand
new spread-sauce color or a brand new placement pattern raises it).

| Order | Recipe | New vs. prior step | Why this position |
|---|---|---|---|
| 1 | **マルゲリータ** (start) | everything | Teaches spread-sauce (tomato) + scatter placement (2 types) + one bake zone. Simplest, most iconic, zero prerequisite. |
| 2 | **フンギ** | +1 ingredient (mushroom) | Reuses tomato-sauce + mozzarella verbatim (same piece count/shape as #1) and adds exactly one new topping. Bake zone (58–80) nearly overlaps #1's — the lowest possible learning delta for "second pizza," so it reinforces the just-learned mechanic instead of introducing a new one. |
| 3 | **マリナーラ** | +2 ingredients (garlic, oregano), −cheese | Still tomato-sauce (zero new sauce mechanic) but removes cheese entirely — the first "not every pizza needs cheese" recognition lesson. Same piece total as #1/#2. Bake zone (45–65) is meaningfully different from #1/#2 — first real "learn a new bake window" moment. |
| 4 | **ビスマルク** | +1 ingredient (egg) | Reuses tomato-sauce + mozzarella again (zero new base mechanic) but introduces a single, precisely-placed centerpiece instead of scattered pieces — a genuinely new placement skill, and the clearest "read the pizza, not the clock" bake-recognition cue (egg white/yolk state) of any of the 7. Lowest total piece count (5) keeps this step's overall load light even though it's conceptually new. |
| 5 | **ジェノベーゼ** | +2 ingredients (cherry-tomato), +1 new sauce (pesto) | First alternate spread sauce — a new color/texture to paint, but the same underlying "spread" gesture as tomato-sauce, so the *motor* skill transfers even though the *visual* target is new. |
| 6 | **クアトロ フォルマッジ** | +3 cheeses (gorgonzola/parmigiano/fontina), +1 new sauce (olive-oil) | The recognition/sorting capstone: a second alternate spread sauce (olive-oil is pale/translucent — genuinely harder to read coverage on than tomato/pesto) **and** three brand-new cheeses that must be told apart from mozzarella and each other, at the highest piece count (9) and highest ingredient-type count (5) of any recipe. Deliberately placed second-to-last, not earlier, so it never has to double as a "your very first new sauce" moment. |
| 7 | **フガッサ** (last) | +1 ingredient (onion), reuses olive-oil + oregano | Nothing mechanically new (both its ingredients were already learned in #3/#6) — it demands *mastery* of everything learned so far: oil-painting, the highest single-ingredient scatter count of any recipe (onion×4), and the least visually forgiving presentation (no sauce-red, no cheese-melt — bake state reads purely off dough/oil/onion char). A fitting "graduation" recipe, and it is **already the existing implemented unlock slot** (onion/Shop-gated) — keeping it last preserves that precedent instead of fighting it. |

---

## 3. STEP 3 — Unlock conditions

**Principle (per the user's fixed decision): no skill wall early. The first new recipe unlocks
fast. Only the last one or two slots may carry a light skill signal.**

### 3.1 New architecture: `Recipe.unlockCondition` (orthogonal to ingredient ownership)

Today, `isRecipeAvailable` derives availability **only** from ingredient ownership — there is no
recipe-level lock at all (explicit in the code's own comments). That is precisely what has to
change. The recommended model adds a small, new, explicit field:

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
— exactly the "Recipe unlocked ≠ Ingredient purchased" separation the task requires (§4). This is
a deliberate, explicit new concept, not a reuse of the ingredient `unlockCondition` mechanism —
reusing that would conflate two things the fixed decision asks to keep separate (an ingredient's
`minTotalStars` gate answers "is this ingredient in the Shop yet," not "is this recipe visible
yet").

### 3.2 Concrete conditions, all 7 recipes

| # | Recipe | `unlockCondition` | Rationale |
|---|---|---|---|
| 1 | margherita | *(none — always unlocked)* | Start. |
| 2 | funghi | `{ requiresRecipeId: "margherita" }` | Unlocks the instant Margherita is completed once, **any quality** (★1 floor still counts as "discovered"). Matches "早く解禁"/"もう1枚作りたいタイミングで次の目標" directly. |
| 3 | marinara | `{ requiresRecipeId: "funghi" }` | Same pattern — chained, one recipe at a time. |
| 4 | bismarck | `{ requiresRecipeId: "marinara" }` | Same pattern. |
| 5 | genovese | `{ requiresRecipeId: "bismarck" }` | Same pattern. |
| 6 | quattro-formaggi | `{ requiresRecipeId: "genovese", minTotalStars: 8 }` | First light skill signal. By this point 5 recipes are discoverable; even at the ★1 floor per recipe, `totalStars` is already 5 — reaching 8 needs only a modest average (~1.6★/recipe), comfortably inside the task's own "beginner" band (quality 50–65 ⇒ mostly ★2–★3). Not a wall: it asks for "keep playing normally," not "get good." |
| 7 | fugazza | `{ requiresRecipeId: "quattro-formaggi", minTotalStars: 12 }` | **Unchanged value** — this is `onion`'s existing, already-shipped, already-simulated `minTotalStars: 12` (`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md` §12: *"上手3枚目/普通4枚目/初心者5枚目で到達"*). Reusing the exact number that has already been play-tested (even if under the old "all 6 available at once" model) is the lowest-risk choice — it does not need to be re-derived from scratch, and §7's simulation below re-validates it under the *new* sequential-unlock model too. The added `requiresRecipeId: "quattro-formaggi"` is new — it guarantees recipe #7 never becomes visible before #6, closing a gap the bare `minTotalStars: 12` alone would not (both numbers could theoretically be reached in either order). |

No recipe before #6 has any score/star requirement at all — completing the previous recipe even
at the worst possible quality (★1, i.e. `total < 40`) is sufficient. This is a deliberate,
literal implementation of the task's own listed candidate, "前レシピを1回完成."

---

## 4. STEP 4 — Unlock ≠ Purchase: the four concepts, and the recommended option

Per the task's framing, four concepts are kept explicitly distinct:

- **A. Recipe unlocked** — `Recipe.unlockCondition` satisfied (§3). Purely a visibility/eligibility
  flag; flips a Pizza Select card from `LOCKED` toward `NEW`.
- **B. Ingredient unlocked** — the ingredient becomes *eligible to own* (today: `AVAILABLE_TO_BUY`
  via `Ingredient.unlockCondition`). Under this design, **derived from Recipe unlock**, not the
  other way around (a reversal of today's dependency direction — today ingredient state drives
  recipe availability; from now on, recipe unlock drives which ingredients become eligible).
- **C. Ingredient purchased** — the ingredient becomes `OWNED` (Pitz spent, or auto-granted — see
  below).
- **D. Ingredient inventory** — how many consumable units are currently in stock (§ Step 5/6).

### 4.1 Option comparison (as the task requests)

| Option | Description | Verdict |
|---|---|---|
| A. Free 1-pizza gift on unlock | The moment a recipe unlocks, its new ingredient(s) are auto-granted `OWNED` + exactly one pizza's worth of inventory stock, at zero Pitz cost. | **Recommended for recipes #2–#6.** |
| B. Pitz reward on unlock | Unlock grants a flat Pitz bonus instead of ingredients directly. | Rejected as the *sole* mechanism — still requires a second trip through the Shop before the new recipe is actually makeable, reintroducing the "unlocked but can't play it yet" gap the task explicitly flags as bad UX. Fine as a *minor addendum* (see RESULT integration, §10) but not a substitute for A. |
| C. First-play consumption-free | The new ingredients are free to use but only for the *very first* completion of that recipe, tracked separately from stock. | Functionally near-identical to A once A's "grant exactly 1 pizza's worth of stock" is chosen — A is simpler (no new "used the free pass yet?" flag; it's just an inventory value that reaches 0 like any other) and reuses ordinary inventory decrement logic instead of a special case. |
| D. Shop purchase required | No free grant; the player must buy before making the recipe at all. | **Recommended, unchanged, for recipe #7 (フガッサ/onion) only** — this is what's already shipped and already tuned (120 Pitz, §12 of the existing SSOT). Keeping exactly one deliberate "go spend Pitz for real" milestone gives the Shop a genuine purpose without making every unlock feel gated behind money. |

### 4.2 Recommended model

**Hybrid A + D**, split cleanly by recipe:

- Recipes **#2–#6** (funghi, marinara, bismarck, genovese, quattro-formaggi): the instant the
  recipe's `unlockCondition` is met, its new ingredient(s) are auto-added to
  `ownedIngredientIds` **and** granted inventory stock equal to exactly one pizza's requirement
  (§6 table, "Free 1-pizza grant" column) — no Shop trip needed to try the recipe for the first
  time. A **second** attempt at that recipe (to improve BEST, or just because it was fun)
  consumes that stock and, once exhausted, requires an ordinary priced Shop restock (§6).
- Recipe **#7** (フガッサ): **unchanged** from today's shipped behavior — `onion` stays a real,
  priced (120 Pitz), no-free-grant Shop purchase. This is deliberately the one "graduation"
  moment in the whole 7-recipe arc that requires the player to have actually earned and spent
  Pitz before playing it, consistent with its position as the hardest/last recipe (§2) and with
  how the existing codebase's own design history already treats it (`PIZZA_GAME_Phase3C-6_
  First-Progression_Result.md`).

This directly resolves the task's own flagged bad case ("新レシピ解禁！→材料不足なので遊べません")
for 6 of 7 recipes, while keeping exactly one real "spend Pitz to unlock a pizza" moment intact
and untouched.

---

## 5. STEP 5 — Starter inventory

**Margherita's 3 ingredients (`tomato-sauce`, `mozzarella`, `basil`) stay permanently,
unconditionally unlimited — unchanged from the already-shipped Starter policy.** This directly
answers the task's "3枚/5枚/無限" question: **無限 (unlimited)**, not a numeric cap, because:

- It is already implemented and tested (`hasStock`'s design in
  `docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` §5: "Starter ingredients... unconditionally exempt from the stock
  check entirely," not merely "a large default number").
- It is the single load-bearing softlock guard (§8): as long as Margherita's own ingredients can
  never run out, the player always has *some* recipe they can make and *some* way to earn Pitz
  (per-pizza FREE-mode credit, confirmed live in `src/logic/pitzReward.ts`/
  `docs/reports/TETO_ISSUE-38_PITZ-REWARD_Result.md` — FREE mode credits Pitz on every completed
  round, not only Lunch Rush, and not only on first discovery).
- Introducing an artificial starter cap (3 or 5) would add a brand-new failure mode ("ran out of
  dough on your first try") that does not exist today, for no design benefit — nothing in the
  task's own goals calls for scarcity on the very first recipe.

No other recipe needs its own "starter inventory" — its first playable copy is the free 1-pizza
grant from §4, sized exactly to that recipe's own `minCount`s (table in §6).

---

## 6. STEP 6 — Material prices

### 6.1 Inventory unit model (STEP 4 in the task's own numbering — "material stock unit")

**Recommended: Option C, category-specific units** — not "1 unit = 1 pizza" uniformly (Option A
in the task's phrasing) and not raw UI piece count for everything (Option B). This is not
invented fresh here; it is the exact model the existing, merged **Inventory E1 Fresh Audit**
(`docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` §6) already derived from the real
`gameReducer.ts`/`pizzaState.ts` shapes and explicitly deferred to "E2's decision" — this design
ratifies it as that decision:

- **Scatter ingredients** (every cheese/topping, `placement: "scatter"`): **1 unit = 1 placed
  piece**. `state.pizza.toppings.filter(t => t.ingredientId === id).length` is already a real,
  directly-readable number — no new tracked state needed. A recipe's `minCount` is its baseline
  consumption per pizza (a player who places more than `minCount` consumes more).
- **Spread/sauce ingredients** (`placement: "spread"`): **1 unit = 1 pizza's use**, binary
  (`sauceIds.includes(id) ? 1 : 0`) — there is no "how much area" quantity in any current recipe
  (every sauce requirement is `minCount: 1`), and painted coverage is a scoring concept
  (`SauceComponentV2`), not an inventory one. Treating it as anything other than binary would
  invent a metric nothing else in the codebase uses.

This single rule applies uniformly to all 14 ingredients, including the 3 that stay Starter
(which are simply exempt from the stock check entirely, not "unit = ∞").

### 6.2 Price table

All 7 recipe base rewards are `baseRewardPitz: 100` (recipes.ts, unchanged, not re-tuned here —
out of scope). A single pizza's Pitz payout is one of `{0, 50, 80, 100, 120}` depending on stars
(§1). **Pricing target**: a full 3-pizza restock batch should cost roughly one NORMAL-tier
pizza's own reward (≈80–100 Pitz) for an ordinary topping, scaling up modestly for
higher-piece-count or thematically "special" ingredients — restocking should always cost
noticeably less than what the pizza it enables can earn back, never break-even or negative.

| Ingredient | Category/placement | `minCount`/pizza (home recipe) | Unlocks with | Free 1-pizza grant on unlock | Restock batch (≈3 pizzas) | Restock price (Pitz) | Cost/pizza (restock) |
|---|---|---|---|---|---|---|---|
| tomato-sauce | sauce/spread | 1 use | Margherita (Starter) | n/a — permanently unlimited | n/a | free | 0 |
| mozzarella | cheese/scatter | 2–3 | Margherita (Starter) | n/a — permanently unlimited | n/a | free | 0 |
| basil | topping/scatter | 2 | Margherita (Starter) | n/a — permanently unlimited | n/a | free | 0 |
| mushroom | topping/scatter | 3 | フンギ (#2) | Yes, 3 units | 9 units | 60 Pitz | ~20/pizza |
| garlic | topping/scatter | 3 | マリナーラ (#3) | Yes, 3 units | 9 units | 60 Pitz | ~20/pizza |
| oregano | topping/scatter | 2 (also used 1/pizza by フガッサ) | マリナーラ (#3) | Yes, 2 units | 6 units | 45 Pitz | ~22.5/pizza (マリナーラ) / ~7.5 (フガッサ) |
| egg | topping/scatter | 1 | ビスマルク (#4) | Yes, 1 unit | 3 units | 45 Pitz | 15/pizza |
| pesto | sauce/spread | 1 use | ジェノベーゼ (#5) | Yes, 1 use | 3 uses | 60 Pitz | 20/pizza |
| cherry-tomato | topping/scatter | 3 | ジェノベーゼ (#5) | Yes, 3 units | 9 units | 60 Pitz | ~20/pizza |
| olive-oil | sauce/spread | 1 use (also used by フガッサ) | クアトロ フォルマッジ (#6) | Yes, 1 use | 3 uses | 50 Pitz | ~16.7/pizza |
| gorgonzola | cheese/scatter | 2 | クアトロ フォルマッジ (#6) | Yes, 2 units | 6 units | 70 Pitz | ~23.3/pizza |
| parmigiano | cheese/scatter | 2 | クアトロ フォルマッジ (#6) | Yes, 2 units | 6 units | 70 Pitz | ~23.3/pizza |
| fontina | cheese/scatter | 2 | クアトロ フォルマッジ (#6) | Yes, 2 units | 6 units | 70 Pitz | ~23.3/pizza |
| onion | topping/scatter | 4 | フガッサ (#7) | **No — existing real purchase, unchanged** | 12 units | **120 Pitz (existing, unchanged)** | 40/pizza |

Sanity check: fully restocking クアトロ フォルマッジ 3× costs `50+70+70+70=260` Pitz for 3 pizzas
(~86.7/pizza) — comfortably under one NORMAL-tier pizza's own ~90–100 Pitz reward, i.e. the
recipe "pays for its own upkeep" even at moderate skill, appropriately for the most
ingredient-heavy recipe in the set. フガッサ's 40/pizza-equivalent is deliberately the highest,
matching its "graduation" position (§2).

---

## 7. STEP 7 — Economy simulation

Three player types, START → all 7 recipes discovered and makeable at least once, using §3's
conditions and §1's Pitz table. `STAR_THRESHOLDS`: `<40→★1(×0)`, `40–59→★2(×0.5)`,
`60–74→★3(×0.8)`, `75–89→★4(×1.0)`, `≥90→★5(×1.2)`.

| | Player A (beginner, quality ~50–65) | Player B (normal, quality ~70–85) | Player C (skilled, quality ~90+) |
|---|---|---|---|
| Typical stars/play | mostly ★2–★3 (avg ≈2.5) | mostly ★3–★4 (avg ≈3.7) | mostly ★5, occasional ★4 if bake missed (avg ≈4.8) |
| Typical Pitz/play | ~50–80 (avg ≈65) | ~80–100 (avg ≈90) | ~115–120 (avg ≈115) |
| Plays to discover #1–#6 (1 attempt each, chained unlock) | 6 | 6 | 6 |
| `totalStars` after 6 discoveries | ≈6×2.5 ≈ 15 | ≈6×3.7 ≈ 22 | ≈6×4.8 ≈ 29 |
| Cumulative Pitz after 6 discovery plays (no restocks yet) | ≈6×65 ≈ 390 | ≈6×90 ≈ 540 | ≈6×115 ≈ 690 |
| `minTotalStars: 8` (recipe #6 gate) met? | Yes, already at discovery #4–5 | Yes, already at discovery #3–4 | Yes, already at discovery #2–3 |
| `minTotalStars: 12` (recipe #7 gate) met? | Yes, by discovery #5–6 | Yes, by discovery #4–5 | Yes, by discovery #3–4 |
| Can afford onion (120 Pitz) once eligible? | Yes — 390 Pitz banked well exceeds 120 | Yes — 540 Pitz banked | Yes — 690 Pitz banked |
| **Plays to unlock + first-make all 7** | **~6–8** (6 discovery plays + 1–2 buffer for a below-★2 attempt needing a retry, or immediate) | **~6–7** | **~6–7** |

**Reading this simulation**: because recipes #2–#6 unlock on bare completion (★1 floor already
counts) and grant their ingredients free, the *sequencing* gates are satisfied almost
immediately for every skill tier — the design deliberately does not use skill to pace the first
five unlocks. The only place skill tier visibly matters is *how many spare Pitz* a player has
banked by the time フガッサ becomes eligible (§3 row 7) — all three tiers clear the 120 Pitz bar
comfortably, because `baseRewardPitz: 100` is large relative to `onion`'s price by design
(consistent with the existing SSOT's own §12 calibration note). No player type is at risk of
reaching recipe #7's *conditions* without also having the Pitz to act on them.

---

## 7b. TARGET — FAST / NORMAL / SLOW progression length

The task asks for three explicit *design* variants (not player skill tiers — §7 already covers
that), compared against what the current game's own time/reward scale actually supports, with one
recommended.

| Variant | Structure | Approx. plays to unlock all 7 |
|---|---|---|
| **FAST** (recommended) | Exactly as designed in §3: chained completion-only gates for #2–#5, light `totalStars` (8/12) for #6/#7. | **~6–9** |
| NORMAL | Same chain, but each of #3–#6 additionally requires the *previous* recipe to have been made **twice** (not once), and #6/#7 thresholds raised to 10/16. | **~12–18** |
| SLOW | Adds a real BEST-quality floor (e.g. `total ≥ 50` on the previous recipe, not just "discovered") to #4–#7, on top of NORMAL's replay requirement. | **~25–35** |

**Recommendation: FAST.** Reasons:

- It is the only variant consistent with the task's repeated, explicit instruction not to place a
  skill wall early and to unlock the next goal quickly ("もう1枚作りたいと思うタイミングで次の
  目標を提示する").
- `PROJECT_HANDOFF.md` P6 already documents these 7 recipes as the *first chapter* — "Recipe
  expansion toward 20 using reviewed References" is explicitly future work. Gating the onboarding
  arc itself with NORMAL/SLOW-style grinding would work against that roadmap, not for it: better
  to get players through the starter menu quickly and into replay/Lunch Rush/mastery territory
  (where NORMAL/SLOW-style depth belongs) than to slow down content they haven't even seen yet.
- The one existing, already-play-tested precedent in this codebase (`onion`'s `minTotalStars: 12`
  under the *old* all-6-at-once model) was itself explicitly tuned to be reached by "the 3rd–5th
  pizza," i.e. a FAST-style pace — §7's simulation shows the same number, reused unchanged, still
  lands at a comparable pace under the new sequential model. Choosing NORMAL/SLOW here would mean
  discarding the only real playtesting data this project has, not building on it.
- NORMAL/SLOW-style pacing is exactly where MASTER (§11) and a future 20-recipe catalog should
  live, not the first 7 recipes.

---

## 8. STEP 8 — Softlock analysis

| Case | Risk under this design | Why |
|---|---|---|
| Pitz = 0 | **None.** | Margherita is always makeable (unlimited Starter stock) and always pays Pitz per completion (even ★1 pays 0, but any real attempt above quality 40 pays ≥50) — the player can always return to it to earn more. Recipes #2–#6's *first* play never requires Pitz at all (§4 free grant). |
| Inventory = 0 (ran out of a purchased ingredient) | **None for recipes #1–#6's first play.** Possible-but-recoverable for a *repeat* play of #2–#6, or for フガッサ at any point. | A depleted non-Starter ingredient simply removes that one tile from the tray (per the existing `hasStock` design) — it never blocks Margherita, never blocks trying a newly-unlocked recipe for the first time, and is always resolved by playing Margherita (or any already-owned recipe) to earn Pitz, then restocking. |
| All materials short | **None.** | Same as above — Margherita's own materials cannot be short by construction. |
| Immediately after a new recipe unlocks | **None.** | This is precisely what §4's free 1-pizza grant exists to prevent — a freshly-unlocked recipe is guaranteed makeable at least once, at zero Pitz cost, the instant it appears. |
| Low score streak | **None.** | Recipes #2–#5 need only a completion (★1 floor), not a score. #6/#7's `totalStars` thresholds are reachable even at floor-level play once enough recipes are discovered (§7). A player stuck at ★1–★2 forever *does* progress slower toward #6/#7, but never below zero progress, and Margherita remains playable throughout. |
| Shop purchase mistake (bought the "wrong" thing) | **Low.** | All Shop purchases here are additive stock, never destructive (no sell-back, no ingredient loss) — a "wrong" purchase just means a different ingredient got restocked; nothing is lost, and Pitz can always be earned again via Margherita. |
| Save migration user (existing player, mid-progression) | **Needs an explicit migration rule — see below.** | Not a softlock by design, but requires a one-time decision at implementation time. |
| Lunch Rush-only play | **None.** | Lunch Rush's own order pool (`getNextOrder`'s `availableRecipeIds` parameter, already present in `src/data/orders.ts`) should be restricted to *unlocked* recipes exactly the same way FREE's Pizza Select is — this already has a designed extension point (`availableRecipeIds`), so Lunch Rush automatically respects the new lock state without inventing a second gate. A Lunch-Rush-only player still earns Pitz per served pizza and still discovers recipes via Mission serves, so `totalStars`/Dex progress the same way regardless of which mode is played. |

**Migration rule (needed once, at implementation time, not resolved further in this design
session)**: an existing save today has all 6 Starter recipes already `discovered` in most real
play. Two options: (a) grandfather every already-discovered recipe as unlocked-and-owned
regardless of the new chain (no regression for existing players — matches this project's
long-standing "existing players are never punished by a new system" principle, e.g.
`PIZZA_GAME_PROGRESSION_SSOT.md` §1's own "既存プレイヤーに不利益を与えない"), or (b) apply the
new chain retroactively from their existing Dex state (a player who already discovered 4 of 6
would simply already satisfy #2–#4's `requiresRecipeId` chain, landing them at whatever unlock
position their existing Dex naturally implies). **Recommend (b)**: it requires no special-casing
in the reducer (the same `recipeUnlocked` derivation just runs against their existing Dex, same
as a fresh save), and in practice produces the same "no regression" result as (a) for any player
who has ever completed multiple recipes, since the chain conditions are so low a bar. Only a
brand-new save with `dex.length === 0` actually starts at "Margherita only" — exactly the
intended new-player experience.

**Conclusion: no unrecoverable "nothing can be made" state exists under this design**, for the
same structural reason the existing E1 audit already established for Starter ingredients: the
guarantee holds "by construction," not by a chosen buffer size.

---

## 9. STEP 9 — Pizza Select locked-state UX

The existing `RecipeCardState`/`recipeCardState` (`src/state/pizzaSelect.ts`) and
`PizzaSelectScreen`/`RecipeSelectCard` (`src/screens/PizzaSelectScreen.tsx`) already render a
`LOCKED` card as a `🔒 ？？？` silhouette with an optional text hint
(`unlockHintFor`, currently only ever fires for フガッサ). This design recommends **two different
treatments for two different unlock stages**, directly answering the task's own comparison:

- **Recipes #2–#6 (chain-unlocked)**: show the **recipe name**, not `？？？` — e.g.
  `🔒 フンギ / マルゲリータを1枚完成させると解禁`. Rationale: these unlocks are near-immediate
  and teaching-focused; showing the name maintains curiosity and gives a concrete, one-step-away
  goal ("just one more pizza") rather than mystery. This is a deliberate UI change from today's
  uniform `？？？` treatment, scoped to this stage only.
- **Recipe #7 (フガッサ)**: keep the **existing** `？？？` + ingredient/star hint behavior
  unchanged (`🔒 ？？？ / たまねぎを解放（★12）で作れます`, already implemented, already
  correct). Rationale: this is the one deliberate "mystery capstone" reveal in the whole arc —
  its late position (§2) and real-purchase requirement (§4) both support keeping it a genuine
  surprise rather than a foregone one-step-away goal.

This gives every player, at every stage, a clear, truthful answer to "what do I do next" (per the
task's own explicit goal), while reserving exactly one moment of "？？？" mystery for the finale.

---

## 10. STEP 10 — RESULT integration (design only — PR #75 not touched)

**No code change proposed or made here.** PR #75 (RESULT 2.0 Slice 1) stays untouched, per
instruction. This section is forward-looking design for whichever slice eventually wires
progression feedback into RESULT/DISCOVERED, once that surface stabilizes.

Two complementary signals, both derivable purely from state this design already defines (no new
scoring/formula work):

1. **"How close to the next unlock" progress line**, shown on a round that does *not* itself
   trigger a new unlock — e.g. `次のレシピまで、あと1枚！` (chain-gate case, recipes #2–#5) or
   `次のレシピまで ★8 / あと3！`（totalStars case, recipes #6/#7). This slots naturally into the
   RESULT 2.0 Fresh Audit's own proposed hierarchy item 7 ("NEW BEST / Dex") — it is the same
   kind of "payoff, not a formula dump" signal that audit already recommends surfacing on the
   merged screen, not a new concept.
2. **"New recipe unlocked!" banner**, shown on the round that crosses a threshold — e.g.
   `🎉 NEW RECIPE ビスマルク解禁！` — paired with the free-1-pizza-grant note if applicable
   (`卵を1個プレゼントされました！`), mirroring `ShopOverlay`'s existing purchase-feedback pattern
   (`「たまねぎを仕入れました！→新しいピザが作れます！」`) rather than inventing a new copy
   style.

Both are additive display concerns over state this design already produces
(`recipeUnlocked`/`totalStars`/the free-grant event) — **no interaction with Scoring 2.0, Pitz
formula, or Save schema**, consistent with the scope guard.

---

## 11. STEP 11 — MASTER recommendation

No `MASTER` concept exists in code today — it appears only as a future roadmap term
(`PROJECT_HANDOFF.md` P6: *"Pizza Dex visual overhaul and expansion: undiscovered → discovered →
BEST → MASTER"*). **Recommendation: MASTER must not gate any of the 7 base-recipe unlocks
designed here.** It belongs to:

- **Optional mastery / late-game**: a Dex-completion cosmetic tier (e.g. "achieved ★5 on this
  recipe" badge), unlocked *after* a recipe is already makeable, never a precondition for making
  it.
- **Cosmetic/reward**: title, sticker, or Dex-card visual treatment — not a currency, not a gate.
- **Advanced/future recipe unlock**: the natural home for NORMAL/SLOW-style pacing (§7b) that
  this design deliberately keeps out of the first 7 recipes — e.g. a future 8th+ recipe (the P6
  20-recipe catalog) could reasonably require MASTER on 2–3 earlier recipes, once the base loop
  is established and grinding is no longer "the tutorial."

MASTER is explicitly **not** suited to "optional mastery + late-game + cosmetic" being mutually
exclusive — it can be all three at once for the 7-recipe set (cosmetic reward now, precondition
for content that doesn't exist yet), just never a wall between a new player and the base 7.

---

## 12. Implementation slices

Ordered for minimal risk, each independently shippable/testable, sequenced against the existing
Inventory E1/E2 track (`docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md`,
`docs/reports/TETO_INVENTORY-E1_Implementation-Preflight.md`) rather than duplicating it.

| Slice | Scope | Depends on |
|---|---|---|
| **EP0** | **Land Inventory E1 first** (already fully scoped/audited, "under 1.5 hours," verdict A — see the Preflight report). Not part of this design, but every slice below assumes `InventoryState`/`hasStock`/`remainingStock` exist. | Nothing new from this design. |
| **EP1** | `Recipe.unlockCondition` type + data (§3.1/3.2) + `recipeUnlocked()` pure function + `isRecipeAvailable` becomes the two-axis AND (§4). Pure logic + unit tests, no UI change yet. | EP0 not required (orthogonal). |
| **EP2** | Pizza Select: differentiated LOCKED rendering (§9) — recipe name + hint for #2–#6, unchanged `？？？` for #7. `recipeCardState` gains the new axis. | EP1. |
| **EP3** | Free 1-pizza grant on recipe unlock (§4.2, §6 table's "Free grant" column) — auto-`OWNED` + auto-stock for the newly-required ingredient(s), fired once per unlock crossing (needs a stored "already granted" guard, exactly-once, same pattern as `REGISTER_TO_DEX`'s existing exactly-once guard). | EP0 (writes to `InventoryState`), EP1. |
| **EP4** | Inventory **consumption** at `CONFIRM_BAKE` (§6.1 unit model: scatter=placed-piece-count, sauce=binary) — this is Inventory **E2**, not newly invented here; this design ratifies its unit-semantics open question. Must add the `phase !== "BAKE"` guard the E1 audit already flagged as a pre-existing defect. | EP0. |
| **EP5** | Shop 2.0 restock UI + pricing (§6.2 table) — extends `purchaseIngredient`/`ShopOverlay` from "grant ownership once" to "credit `inventory[id]` by a batch quantity, repeatable." This is Inventory **E3**, sequenced after E4 exists (a restock UI with nothing consuming stock yet sells nothing meaningful). | EP4. |
| **EP6** | Lunch Rush order pool restricted to unlocked recipes (§8 table, "Lunch Rush-only play" row) — wire `getNextOrder`'s existing `availableRecipeIds` parameter to the new `recipeUnlocked` axis, mirroring how FREE's Pizza Select already will. | EP1. |
| **EP7** | RESULT progression feedback (§10) — progress line + unlock banner. Explicitly deferred until RESULT 2.0 (PR #75 and its Slice 2 successor) has landed and stabilized; must not touch PR #75 itself. | EP1, EP3, and RESULT 2.0 merged (external dependency, not owned by this track). |
| **EP8** | Save v1→v2-era migration rule (§8, "Save migration user") — apply the new chain retroactively against existing Dex state; add a regression test asserting no existing player regresses. | EP1. |

Each slice fits the project's own "~2–3 hours" Claude Code sizing convention
(`PROJECT_HANDOFF.md` "Preferred workflow"). EP0 (Inventory E1) is not re-scoped here — it is
already fully designed and ready independently of this document.

---

## 13. Risks

- **Reversing today's "6 Starter recipes always available" model is a real behavior change**,
  not an additive one — any existing player's very next launch will suddenly see 5 recipes they
  could previously make shown as locked, unless EP8's migration rule (§8) ships in the same
  release as EP1/EP2. This is the single highest-risk item in the whole design: shipping EP1/EP2
  without EP8 would be a genuine regression for existing players, directly against this project's
  own "no incumbent-player harm" principle.
- **`STARTER_INGREDIENT_IDS` shrinks from 13 to 3** (only `tomato-sauce`/`mozzarella`/`basil`
  remain unconditionally Starter) — every other ingredient gains an `unlockCondition` for the
  first time. This touches `src/data/ingredients.ts` broadly (10 of 14 entries), even though each
  individual edit is small and mechanical (adding one field, no new type).
  `MAX_INGREDIENT_PALETTE_SLOTS` (6) is not at risk — クアトロ still needs only 5 ingredient
  types, unchanged.
- **Two independent "unlocked" concepts (Recipe vs. Ingredient) must never drift out of sync.**
  §3.1's two-axis AND (`recipeUnlocked && ingredientsOwned`) is the safeguard; a future
  implementer must not shortcut this back into single-axis logic (which is exactly today's bug,
  just inverted).
- **The free-grant mechanism (EP3) needs an exactly-once guard.** Without one, re-satisfying an
  already-granted condition (e.g. via a save reload, or a Mission-mode registration) could
  re-grant free stock repeatedly — the same class of risk `REGISTER_TO_DEX`'s existing
  `phase !== "RESULT"` guard already solves for Pitz/BEST/Dex; EP3 should copy that pattern, not
  invent a new one.
- **Price/threshold numbers in §6/§3 are derived, not simulator-verified against live code** —
  this session is docs-only and did not run the game. The derivation is shown explicitly (§6.2,
  §7) so an implementer can sanity-check against real playtesting before treating any single
  number as final, exactly as the existing onion/fugazza numbers were themselves adjusted once
  (`minTotalStars: 18 → 12`) after a first simulation pass proved too strict.
- **RESULT integration (§10, EP7) has an external dependency** (PR #75/RESULT 2.0 landing) this
  design does not control and must not be rushed to unblock.

---

## 14. Unresolved design decisions

1. **Migration policy exact mechanics (§8)** — this design recommends "apply the new chain
   retroactively against existing Dex" but the exact reducer-level implementation (a one-time
   backfill vs. a purely-derived check with no persisted migration step at all) should be decided
   at EP8 implementation time, informed by how `migrateV1toV2`'s existing precedent handles
   similar backfills.
2. **Exact free-grant guard mechanism (EP3)** — whether "already granted" is tracked as a new
   persisted set (`grantedUnlockIds: string[]`) or derived implicitly from "is the ingredient
   already OWNED" (simpler, but subtly different if a player could otherwise lose ownership,
   which nothing today allows) is an implementation-time call, not resolved here.
3. **Whether `oregano`'s and `olive-oil`'s dual role** (used by two different recipes at
   different `minCount`s) should have one shared inventory pool or should the price table's
   "cost per pizza" column vary by which recipe consumes it — this design treats them as one
   shared pool (simplest, matches `InventoryState`'s flat `Record<id, number>` shape) but flags
   it explicitly since the two `minCount`s differ.
4. **Exact FAST-variant numbers (§7b) are a recommendation, not a locked spec** — an implementer
   with real playtest data may find `minTotalStars: 8`/`12` want a small adjustment, the same way
   the existing onion threshold was itself adjusted once from an initial candidate.

---

## Final verdict

**B. READY — NEEDS ONE PRODUCT DECISION.**

Everything in this design derives from real, currently-shipped code and the existing,
already-play-tested onion/fugazza precedent — no scoring/Pitz-formula/Save-schema work is
required to begin implementation, and Inventory E1 (the one true prerequisite) is independently
already fully audited and ready (verdict A in its own Preflight). The one genuine open product
decision, not resolvable from code alone, is:

> **Should recipes #2–#6 truly receive a free first-pizza ingredient grant (§4.2's recommended
> Option A), or should every unlock require an explicit Shop purchase like フガッサ does today
> (Option D for all 7)?**

This design recommends the hybrid (A for #2–#6, D unchanged for #7) because it is the only option
that satisfies both "never unlock-then-block" and "keep the Shop meaningful" simultaneously — but
it is a genuine product/tone choice (a more "commerce-forward" design could reasonably prefer D
for all 7, accepting the UX risk the task itself flagged), not something this audit can settle
unilaterally.

## Report summary

- **Audited SHA**: `d0f17d57e06a9cddaf1cbb143d1dbaba8bb8bdf3` (`main`).
- **PR #75**: OPEN, not touched, not built on.
- **Recommended 7-recipe unlock order**: マルゲリータ(start) → フンギ → マリナーラ → ビスマルク →
  ジェノベーゼ → クアトロフォルマッジ → フガッサ.
- **Recommended progression length**: FAST, ~6–9 plays to unlock and first-make all 7.
- **Inventory model**: category-specific — scatter=placed-piece count, sauce=binary 1-use/pizza
  (ratifies the existing Inventory E1 audit's own open question).
- **Starter policy**: Margherita's 3 ingredients stay permanently unlimited, unchanged.
- **Softlock policy**: no unrecoverable "nothing makeable" state, by construction (Margherita
  always playable + always pays Pitz + free 1-pizza grant on every new unlock except フガッサ).
- **Major unresolved decision**: free-grant (Option A) vs. universal Shop purchase (Option D) for
  recipes #2–#6 (§ Final Verdict).
- **Next production slice**: **EP0 (Inventory E1)**, already independently ready, followed by
  **EP1** (`Recipe.unlockCondition` + two-axis availability).
- **Final verdict**: **B. READY — NEEDS ONE PRODUCT DECISION.**
