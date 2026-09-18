# Teto Pizza Game — Economy & Progression 1.0: Matrix (SSOT candidate)

**Design only. Companion machine-readable table to
`docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`, which contains full rationale for
every value here. No production code reflects this yet — treat as a design SSOT candidate for
the implementation slices (EP0–EP8) listed in that report's §12.**

Audited `main` SHA: `d0f17d57e06a9cddaf1cbb143d1dbaba8bb8bdf3`.

---

## 1. Recipe progression matrix

| Order | `RecipeId` | Name (ja) | `unlockCondition` (new field, design) | Free 1-pizza ingredient grant on unlock | New ingredient(s) this recipe introduces | `baseRewardPitz` | Bake target |
|---|---|---|---|---|---|---|---|
| 1 | `margherita` | マルゲリータ | *(none — always unlocked)* | n/a (Starter, always owned) | tomato-sauce, mozzarella, basil (all Starter) | 100 | 60–80 |
| 2 | `funghi` | フンギ | `{ requiresRecipeId: "margherita" }` | mushroom ×3 | mushroom | 100 | 58–78 |
| 3 | `marinara` | マリナーラ | `{ requiresRecipeId: "funghi" }` | garlic ×3, oregano ×2 | garlic, oregano | 100 | 45–65 |
| 4 | `bismarck` | ビスマルク | `{ requiresRecipeId: "marinara" }` | egg ×1 | egg | 100 | 55–75 |
| 5 | `genovese` | ジェノベーゼ | `{ requiresRecipeId: "bismarck" }` | pesto ×1(use), cherry-tomato ×3 | pesto, cherry-tomato | 100 | 50–70 |
| 6 | `quattro-formaggi` | クアトロ フォルマッジ | `{ requiresRecipeId: "genovese", minTotalStars: 8 }` | olive-oil ×1(use), gorgonzola ×2, parmigiano ×2, fontina ×2 | olive-oil, gorgonzola, parmigiano, fontina | 100 | 65–85 |
| 7 | `fugazza` | フガッサ | `{ requiresRecipeId: "quattro-formaggi", minTotalStars: 12 }` | **none — real Shop purchase required (unchanged, existing `onion` mechanism)** | onion | 100 | 63–83 |

Notes:

- `unlockCondition` is a **new**, orthogonal field on `Recipe` — distinct from
  `Ingredient.unlockCondition` (already exists, ingredient-scoped). See Fresh Design §3.1.
- Recipe #7's condition/price are **unchanged from already-shipped code**
  (`src/data/ingredients.ts`'s `onion`: `unlockCondition: { minTotalStars: 12 }`,
  `pricePitz: 120`) — only the added `requiresRecipeId: "quattro-formaggi"` on the *recipe* is
  new, to guarantee sequencing (#7 never visible before #6).
- "Free 1-pizza ingredient grant" quantities equal each ingredient's own recipe `minCount`
  (`src/data/recipes.ts`, unchanged).

---

## 2. Ingredient economy matrix

| Ingredient id | Name (ja) | Category | Placement | `minCount`/pizza (home recipe) | Introduced by | Starter (unconditionally unlimited)? | Free grant on unlock | Restock batch (≈3 pizzas) | Restock price (Pitz) | Cost/pizza (restock) |
|---|---|---|---|---|---|---|---|---|---|---|
| tomato-sauce | トマトソース | sauce | spread | 1 use | margherita | **Yes** | n/a | n/a | free | 0 |
| mozzarella | モッツァレラ | cheese | scatter | 2–3 | margherita | **Yes** | n/a | n/a | free | 0 |
| basil | バジル | topping | scatter | 2 | margherita | **Yes** | n/a | n/a | free | 0 |
| mushroom | マッシュルーム | topping | scatter | 3 | funghi (#2) | No | 3 units | 9 units | 60 | ~20/pizza |
| garlic | にんにく | topping | scatter | 3 | marinara (#3) | No | 3 units | 9 units | 60 | ~20/pizza |
| oregano | オレガノ | topping | scatter | 2 (marinara) / 1 (fugazza) | marinara (#3) | No | 2 units | 6 units | 45 | ~22.5 (marinara) / ~7.5 (fugazza) |
| egg | たまご | topping | scatter | 1 | bismarck (#4) | No | 1 unit | 3 units | 45 | 15/pizza |
| pesto | ジェノベーゼソース | sauce | spread | 1 use | genovese (#5) | No | 1 use | 3 uses | 60 | 20/pizza |
| cherry-tomato | チェリートマト | topping | scatter | 3 | genovese (#5) | No | 3 units | 9 units | 60 | ~20/pizza |
| olive-oil | オリーブオイル | sauce | spread | 1 use | quattro-formaggi (#6) | No | 1 use | 3 uses | 50 | ~16.7/pizza |
| gorgonzola | ゴルゴンゾーラ | cheese | scatter | 2 | quattro-formaggi (#6) | No | 2 units | 6 units | 70 | ~23.3/pizza |
| parmigiano | パルミジャーノ | cheese | scatter | 2 | quattro-formaggi (#6) | No | 2 units | 6 units | 70 | ~23.3/pizza |
| fontina | フォンティーナ | cheese | scatter | 2 | quattro-formaggi (#6) | No | 2 units | 6 units | 70 | ~23.3/pizza |
| onion | たまねぎ | topping | scatter | 4 | fugazza (#7) | No | **None (existing real purchase)** | 12 units | **120 (existing, unchanged)** | 40/pizza |

Notes:

- **Inventory unit model** (ratifies `docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` §6,
  not newly invented): scatter ingredients consume **1 unit = 1 placed piece**; spread/sauce
  ingredients consume **1 unit = 1 pizza's use** (binary). See Fresh Design §6.1.
- `STARTER_INGREDIENT_IDS` shrinks from today's 13 to exactly **3** under this design
  (`tomato-sauce`, `mozzarella`, `basil`) — every other current ingredient gains an
  `unlockCondition` for the first time (Fresh Design §13, flagged risk).
- Restock batch size is a uniform "≈3 pizzas' worth" convention across all 11 non-Starter
  ingredients, for pricing consistency (Fresh Design §6.2 shows the derivation against
  `baseRewardPitz`/quality-multiplier Pitz income).
- `onion`'s row is **the one exception** to the "free grant" column across the whole table —
  deliberately, matching Fresh Design §4.2's hybrid recommendation.

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

## 4. Cross-reference

- Full rationale, options considered, softlock analysis, simulation, UX, RESULT integration,
  MASTER recommendation, implementation slices, risks: see
  `docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`.
- Inventory unit-consumption prerequisite (E1/E2): see
  `docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md` and
  `docs/reports/TETO_INVENTORY-E1_Implementation-Preflight.md`.
- Existing (superseded-in-part) progression SSOT: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`
  §5/§10/§12 describe the *current* "6 Starter recipes always available" model this design
  replaces — not deleted or edited here (docs-only scope), but §5/§10 of that document should be
  read as superseded by this matrix once EP1/EP2 ship.
