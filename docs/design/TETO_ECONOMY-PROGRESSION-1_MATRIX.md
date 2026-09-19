# Teto Pizza Game — Economy & Progression 1.0: Matrix (SSOT candidate)

**Design only. Companion machine-readable table to
`docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`, which contains full rationale for
every value here. No production code reflects this yet — treat as a design SSOT candidate for
the implementation slices (EP0–EP4 + Human Feel/balance) listed in that report's §12.**

Audited `main` SHA (original design): `d0f17d57e06a9cddaf1cbb143d1dbaba8bb8bdf3`.
Audited `main` SHA (this product-decision-finalization revision):
`5d28c5dc996c0ea76aa6428f158a766165477213`.

**Revision note**: the "material grant on unlock" question this matrix originally left as an
open product decision (Option A vs. Option D, フガッサ excepted) is **resolved** — see Fresh
Design §4. Decision: **Option A-10 ("Unlock Starter Stock")** — every recipe unlock (#2–#7)
grants a free starter stock sized to `starterStockPlays = 10` pizzas' worth of its new
ingredient(s), **uniformly, including フガッサ/`onion`** (the previous "real 120-Pitz purchase
required" exception is removed). All quantities below are updated accordingly.

---

## 1. Recipe progression matrix

| Order | `RecipeId` | Name (ja) | `unlockCondition` (new field, design) | Starter grant on unlock (`starterStockPlays = 10`) | New ingredient(s) this recipe introduces | `baseRewardPitz` | Bake target |
|---|---|---|---|---|---|---|---|
| 1 | `margherita` | マルゲリータ | *(none — always unlocked)* | n/a — permanently unlimited (not governed by `starterStockPlays`) | tomato-sauce, mozzarella, basil (all Starter) | 100 | 60–80 |
| 2 | `funghi` | フンギ | `{ requiresRecipeId: "margherita" }` | mushroom ×30 | mushroom | 100 | 58–78 |
| 3 | `marinara` | マリナーラ | `{ requiresRecipeId: "funghi" }` | garlic ×30, oregano ×20 | garlic, oregano | 100 | 45–65 |
| 4 | `bismarck` | ビスマルク | `{ requiresRecipeId: "marinara" }` | egg ×10 | egg | 100 | 55–75 |
| 5 | `genovese` | ジェノベーゼ | `{ requiresRecipeId: "bismarck" }` | pesto ×10(uses), cherry-tomato ×30 | pesto, cherry-tomato | 100 | 50–70 |
| 6 | `quattro-formaggi` | クアトロ フォルマッジ | `{ requiresRecipeId: "genovese", minTotalStars: 8 }` | olive-oil ×10(uses), gorgonzola ×20, parmigiano ×20, fontina ×20 | olive-oil, gorgonzola, parmigiano, fontina | 100 | 65–85 |
| 7 | `fugazza` | フガッサ | `{ requiresRecipeId: "quattro-formaggi", minTotalStars: 12 }` | **onion ×40 — same rule as every other recipe, no exception** | onion | 100 | 63–83 |

Notes:

- `unlockCondition` is a **new**, orthogonal field on `Recipe` — distinct from
  `Ingredient.unlockCondition` (already exists, ingredient-scoped). See Fresh Design §3.1.
- Recipe #7's *unlock condition* (`requiresRecipeId`/`minTotalStars: 12`) is unchanged from the
  original design and reuses `onion`'s existing, already-shipped `minTotalStars: 12`. **What is
  new in this revision is only the acquisition method once that condition is met**: a free
  40-unit grant, not a purchase.
- Starter grant quantities = `minCount × 10` for scatter ingredients, `10` uses for spread/sauce
  ingredients (Fresh Design §4.4/§6.2). `10` is the named constant `starterStockPlays`
  (Chapter-1 value) — see §5 below; never an inlined literal in implementation.
- Shared ingredients (`oregano`, `olive-oil`) receive **additive** top-ups when a second recipe
  using them unlocks later (e.g. マリナーラ's oregano grant + フガッサ's later oregano grant both
  add to the same `inventory["oregano"]` pool, not overwritten).

---

## 2. Ingredient economy matrix

| Ingredient id | Name (ja) | Category | Placement | `minCount`/pizza (home recipe) | Introduced by | Starter (unconditionally unlimited)? | Starter grant on unlock (`×10`) | Restock batch (≈3 pizzas) | Restock price (Pitz) | Cost/pizza (restock) |
|---|---|---|---|---|---|---|---|---|---|---|
| tomato-sauce | トマトソース | sauce | spread | 1 use | margherita | **Yes** | n/a | n/a | free | 0 |
| mozzarella | モッツァレラ | cheese | scatter | 2–3 | margherita | **Yes** | n/a | n/a | free | 0 |
| basil | バジル | topping | scatter | 2 | margherita | **Yes** | n/a | n/a | free | 0 |
| mushroom | マッシュルーム | topping | scatter | 3 | funghi (#2) | No | **30 units** | 9 units | 60 | ~20/pizza |
| garlic | にんにく | topping | scatter | 3 | marinara (#3) | No | **30 units** | 9 units | 60 | ~20/pizza |
| oregano | オレガノ | topping | scatter | 2 (marinara) / 1 (fugazza) | marinara (#3) | No | **20 units** (+ additive top-up when フガッサ later unlocks) | 6 units | 45 | ~22.5 (marinara) / ~7.5 (fugazza) |
| egg | たまご | topping | scatter | 1 | bismarck (#4) | No | **10 units** | 3 units | 45 | 15/pizza |
| pesto | ジェノベーゼソース | sauce | spread | 1 use | genovese (#5) | No | **10 uses** | 3 uses | 60 | 20/pizza |
| cherry-tomato | チェリートマト | topping | scatter | 3 | genovese (#5) | No | **30 units** | 9 units | 60 | ~20/pizza |
| olive-oil | オリーブオイル | sauce | spread | 1 use | quattro-formaggi (#6) | No | **10 uses** (+ additive top-up when フガッサ later unlocks) | 3 uses | 50 | ~16.7/pizza |
| gorgonzola | ゴルゴンゾーラ | cheese | scatter | 2 | quattro-formaggi (#6) | No | **20 units** | 6 units | 70 | ~23.3/pizza |
| parmigiano | パルミジャーノ | cheese | scatter | 2 | quattro-formaggi (#6) | No | **20 units** | 6 units | 70 | ~23.3/pizza |
| fontina | フォンティーナ | cheese | scatter | 2 | quattro-formaggi (#6) | No | **20 units** | 6 units | 70 | ~23.3/pizza |
| onion | たまねぎ | topping | scatter | 4 | fugazza (#7) | No | **40 units — no exception, same rule as every other row** | 12 units | 120 (unchanged restock price) | 40/pizza |

Notes:

- **Inventory unit model** (ratifies `docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` §6,
  not newly invented): scatter ingredients consume **1 unit = 1 placed piece**; spread/sauce
  ingredients consume **1 unit = 1 pizza's use** (binary). See Fresh Design §6.1.
- `STARTER_INGREDIENT_IDS` shrinks from today's 13 to exactly **3** under this design
  (`tomato-sauce`, `mozzarella`, `basil`) — every other current ingredient gains an
  `unlockCondition` for the first time (Fresh Design §13, flagged risk).
- **Restock** batch size/price columns are **unchanged from the original design** — this revision
  only changed the *starter grant* column. `onion`'s restock price (120 Pitz / 12 units) is the
  same number that used to be its mandatory unlock price; it now applies only to its 11th-play-
  onward refills.
- There is now **no exception row** in the "starter grant" column — every non-Starter ingredient
  receives a `minCount × 10` (or `10` uses) grant the instant its recipe unlocks.

---

## 3. Pitz reward reference (unchanged, cited for pricing derivation)

| Quality total | Stars | Multiplier | Pitz (base 100) |
|---|---|---|---|
| ≥90 | ★5 | ×1.2 | 120 |
| 75–89 | ★4 | ×1.0 | 100 |
| 60–74 | ★3 | ×0.8 | 80 |
| 40–59 | ★2 | ×0.5 | 50 |
| <40 | ★1 | ×0 | 0 |

Source: `src/logic/pitzReward.ts` (`QUALITY_MULTIPLIER_BANDS`), byte-identical to
`src/logic/scoring.ts`'s `STAR_THRESHOLDS`. Unchanged by this design.

---

## 4. `starterStockPlays` — Economy tuning parameter (new in this revision)

**Chapter 1 value: `starterStockPlays = 10`, uniform across all six unlockable recipes (#2–#7).**
Must be implemented as a single named constant (e.g. `STARTER_STOCK_PLAYS_CHAPTER_1` in a design-
level `src/data/economyConfig.ts`), never inlined as a literal `10` at any call site — see Fresh
Design §4.3 for the full rationale.

**Forward note only — not a Chapter 1 decision, not to be implemented ahead of a future
catalog-expansion design session.** Once the catalog grows past Chapter 1 (the 160-class catalog
referenced in `docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md`, verdict D), the same
parameter is expected to become tier-scoped rather than a single global value:

| Tier | `starterStockPlays` (illustrative) |
|---|---|
| starter | 10 |
| early | 10 |
| mid | 5 |
| late | 3 |
| master | 0–3 |

Chapter 1 itself does **not** use this tiering — every one of recipes #2–#7 uses the same `10`.

---

## 5. Cross-reference

- Full rationale, the resolved unlock-vs-purchase product decision, softlock analysis,
  simulation, UX, RESULT integration, MASTER recommendation, implementation slices, risks: see
  `docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`.
- Inventory unit-consumption prerequisite (E1/E2): see
  `docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` and
  `docs/reports/TETO_INVENTORY-E1_Implementation-Preflight.md`.
- Existing (superseded-in-part) progression SSOT: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`
  §5/§10/§12 describe the *current* "6 Starter recipes always available" model this design
  replaces — not deleted or edited here (docs-only scope), but §5/§10 of that document should be
  read as superseded by this matrix once EP1/EP2 ship.
