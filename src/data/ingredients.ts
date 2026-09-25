import { SAUCE_TOMATO_HEX } from "../logic/sauceField";

export type IngredientCategory = "sauce" | "cheese" | "topping";

/**
 * Data-driven gate for a future (non-starter) ingredient's LOCKED -> AVAILABLE_TO_BUY
 * transition (see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 6-7 and
 * src/state/progression.ts). `minTotalStars` is compared against the sum of Dex BEST
 * stars across every recipe (src/logic/mastery.ts's `totalStars`) -- deliberately a
 * single flat number rather than a rule engine, since that's all Phase 3C-3 needs.
 */
export interface IngredientUnlockCondition {
  minTotalStars: number;
}

/**
 * Production Visual P1 (docs/reports/TETO_PROGRESS2_W1_VISUAL_PRODUCTION_PLAN.md): the only
 * dedicated (non-emoji) piece drawings the game knows, each one Human-approved by the W1
 * Ingredient Visual Gate (docs/reports/data/TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION.json:
 * fresh-tomato B / capers / clam B). Drawn by ../components/IngredientGlyph.tsx.
 */
export type DedicatedIngredientVisual = "tomato-slice" | "caper-cluster" | "clam-valve";

export interface Ingredient {
  id: string;
  category: IngredientCategory;
  nameJa: string;
  color: string;
  emoji: string;
  /** "spread" covers the whole pizza in one tap; "scatter" is placed point by point. */
  placement: "spread" | "scatter";
  /** Absent for every current (Starter Set) ingredient -- a starter ingredient has no
   *  Mastery gate and is always OWNED (see src/state/progression.ts). Only a future
   *  ingredient added after Phase 3C-3 would set this. */
  unlockCondition?: IngredientUnlockCondition;
  /** Shop price in Pitz -- doubles as both the one-time unlock purchase price
   *  (`purchaseIngredient`, Phase 3C-5) and the Economy & Progression 1.0 EP3 restock price
   *  (`restockIngredient`, src/logic/economy.ts), per
   *  docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md section 2 ("Restock price (Pitz)" is the
   *  same number as the original unlock price, unchanged by EP3). Only meaningful for an
   *  ingredient with `unlockCondition` -- absent for every current Starter Set ingredient,
   *  since those are always OWNED, unconditionally unlimited, and never for sale. A future
   *  ingredient must set this to a positive integer to actually be purchasable/restockable;
   *  anything else (absent, zero, negative, fractional, NaN) reads as "not for sale"
   *  (`purchaseIngredient`/`restockIngredient`'s shared `NOT_FOR_SALE` reason). */
  pricePitz?: number;
  /** EP3: how many units (scatter) or uses (spread/sauce) one restock purchase grants, per
   *  docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md section 2's "Restock batch" column.
   *  Only meaningful alongside `pricePitz` on a finite (`unlockCondition`-bearing) ingredient --
   *  `restockIngredient` treats anything else (absent, zero, negative, fractional, NaN) as
   *  "not for sale", exactly like an invalid `pricePitz`. Deliberately a separate field from
   *  `pricePitz` rather than reusing it, since the two numbers are independent (SSOT: batch
   *  size and price both vary per ingredient, not derived from one another). */
  restockQuantity?: number;
  /** Economy & Progression 1.0 EP4 (see the EP4 Result report's finalized product decision,
   *  §7): true for a finite (`unlockCondition`-bearing) ingredient whose *initial* OWNED status
   *  is granted for free by its governing recipe's Starter Grant (see ../state/starterStock.ts)
   *  rather than a manual Shop purchase -- the player never spends Pitz to first obtain it, only
   *  to restock it later. Still finite/restockable exactly like every other ingredient here --
   *  the Stock Gate (`hasStock`/`canPlaceIngredient`/`consumePizzaInventory`,
   *  ../state/inventory.ts) and Shop restock (`restockIngredient`, ../logic/economy.ts) key
   *  purely on `unlockCondition`'s presence, unaffected by this flag. This flag exists only to
   *  suppress the *initial-unlock* LOCKED/AVAILABLE_TO_BUY purchase UI/transaction
   *  (ShopOverlay's product list, `purchaseIngredient`) for an ingredient that was never meant
   *  to be independently bought before its recipe unlocks -- `unlockCondition.minTotalStars` is
   *  otherwise unused/inert on every ingredient that sets this. `onion` sets this too: its old
   *  Phase 3C-6 manual-purchase path (buyable once `totalStars` alone reached 12, independent of
   *  `fugazza`'s own unlock) is retired -- Starter Grant is now the only way `onion` is ever
   *  first obtained, exactly like the other 10 EP4-added rows below it. */
  starterGrantOnly?: boolean;
  /** Gameplay UX PR-E (Finished Pizza Visual 2.0): true for a green herb whose bake-time roast
   *  tint (../logic/bakeVisual.ts's `toppingVisualFrame`) must stay far gentler than the default
   *  topping curve, so it reads as a lightly-cooked herb rather than turning the same brown as
   *  every other topping and becoming unidentifiable (the task's own explicit constraint). Data-
   *  driven per ingredient, not derived from `color`/`category` (both already mean something
   *  else) and not a recipe-ID branch -- absent/false on every ingredient whose own color isn't
   *  green. */
  bakeRoastResistant?: boolean;
  /** Production Visual P1: draw this ingredient's non-cheese piece with a dedicated inline
   *  visual instead of `emoji` (../components/IngredientGlyph.tsx). Absent = the emoji, exactly as
   *  before -- every current ingredient leaves it unset. Presentation only: never part of identity
   *  (discovery matches ids), never serialized into the save (persistence stores ids and stock),
   *  and `emoji` stays required as the text fallback. */
  pieceVisual?: DedicatedIngredientVisual;
}

export const INGREDIENTS: Ingredient[] = [
  {
    id: "tomato-sauce",
    category: "sauce",
    nameJa: "トマトソース",
    // Human Feel Fix 4: SSOT'd with the painted/baked sauce heatmap's own color -- see
    // SAUCE_TOMATO_HEX's doc comment (../logic/sauceField.ts) for why.
    color: SAUCE_TOMATO_HEX,
    emoji: "\u{1F345}",
    placement: "spread",
  },
  /**
   * Economy & Progression 1.0 EP4 (see docs/reports/TETO_ECONOMY-PROGRESSION_EP4_Starter-Stock_Result.md):
   * 9 of the matrix's 10 non-Starter rows other than `onion` itself (mushroom/garlic/oregano/
   * egg/pesto/cherry-tomato/gorgonzola/parmigiano/fontina share this same treatment; `onion`
   * gets the identical treatment further below, alongside its own recipe/PIZZA DB provenance
   * comment). Each gains `unlockCondition` (so the Stock Gate/`consumePizzaInventory`
   * -- ../state/inventory.ts -- start tracking it as finite, exactly like `onion`) plus
   * `pricePitz`/`restockQuantity` (so Shop restock, ../logic/economy.ts's `restockIngredient`,
   * has a valid transaction once its Starter Grant stock runs out) and `starterGrantOnly: true`
   * (so Shop never shows a LOCKED/AVAILABLE_TO_BUY row for it -- its *first* unit ever is always
   * free, via its governing recipe's Starter Grant, ../state/starterStock.ts -- restock is the
   * only Shop transaction that ever applies to it). `minTotalStars: 0` is otherwise inert: with
   * `starterGrantOnly` suppressing both the Shop row and `purchaseIngredient` itself for it, this
   * ingredient's LOCKED/AVAILABLE_TO_BUY state (from `ingredientState`) is never read or acted on
   * before ownership actually lands via the grant. `restockQuantity`/`pricePitz` are exactly
   * `docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md` section 2's already-decided "Restock
   * batch"/"Restock price (Pitz)" columns for each of these rows -- a pre-existing design SSOT,
   * not a value invented in this revision (every `restockQuantity` here already matched the
   * matrix's own `minCount x 3` sizing; only `pricePitz` needed correcting to the matrix's own
   * non-uniform per-ingredient prices, see the EP4 Result report's Fresh Audit correction note).
   * Economy Tuning 1 (docs/reports/TETO_ECONOMY-TUNING-1_Implementation-Result.md) retunes every
   * one of these `pricePitz` values again to that task's own TARGET price table (`restockQuantity`
   * untouched throughout) -- see each ingredient's own inline comment below for its exact number.
   */
  {
    id: "olive-oil",
    category: "sauce",
    nameJa: "オリーブオイル",
    color: "#e9d9a0",
    emoji: "\u{1FAD2}",
    placement: "spread",
    unlockCondition: { minTotalStars: 0 },
    // Economy Tuning 1 (docs/reports/TETO_ECONOMY-TUNING-1_Implementation-Result.md): restock
    // price only, per the task's TARGET price table -- restockQuantity is unchanged.
    pricePitz: 65,
    restockQuantity: 3,
    starterGrantOnly: true,
  },
  {
    id: "pesto",
    category: "sauce",
    nameJa: "ジェノベーゼソース",
    color: "#6b8e3d",
    emoji: "\u{1F33F}",
    placement: "spread",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 90,
    restockQuantity: 3,
    starterGrantOnly: true,
  },
  {
    id: "mozzarella",
    category: "cheese",
    nameJa: "モッツァレラ",
    color: "#fdf6e3",
    emoji: "\u{1F9C0}",
    placement: "scatter",
  },
  {
    id: "gorgonzola",
    category: "cheese",
    nameJa: "ゴルゴンゾーラ",
    color: "#e8e0c8",
    emoji: "\u{1F9C0}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 90,
    restockQuantity: 6,
    starterGrantOnly: true,
  },
  {
    id: "parmigiano",
    category: "cheese",
    nameJa: "パルミジャーノ",
    color: "#f6e6a8",
    emoji: "\u{1F9C0}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 90,
    restockQuantity: 6,
    starterGrantOnly: true,
  },
  {
    id: "fontina",
    category: "cheese",
    nameJa: "フォンティーナ",
    color: "#f0d9a0",
    emoji: "\u{1F9C0}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 90,
    restockQuantity: 6,
    starterGrantOnly: true,
  },
  {
    id: "basil",
    category: "topping",
    nameJa: "バジル",
    color: "#3f7d3a",
    emoji: "\u{1F33F}",
    placement: "scatter",
    bakeRoastResistant: true,
  },
  {
    id: "garlic",
    category: "topping",
    nameJa: "にんにく",
    color: "#f2ecd9",
    emoji: "\u{1F9C4}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 90,
    restockQuantity: 9,
    starterGrantOnly: true,
  },
  {
    id: "oregano",
    category: "topping",
    nameJa: "オレガノ",
    color: "#5f7a3d",
    emoji: "\u{1F343}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 55,
    restockQuantity: 6,
    starterGrantOnly: true,
    bakeRoastResistant: true,
  },
  {
    id: "cherry-tomato",
    category: "topping",
    nameJa: "チェリートマト",
    color: "#e2412f",
    emoji: "\u{1F345}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 55,
    restockQuantity: 9,
    starterGrantOnly: true,
  },
  {
    id: "egg",
    category: "topping",
    nameJa: "たまご",
    color: "#f2c94c",
    emoji: "\u{1F95A}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 105,
    restockQuantity: 3,
    starterGrantOnly: true,
  },
  {
    id: "mushroom",
    category: "topping",
    nameJa: "マッシュルーム",
    color: "#b08968",
    emoji: "\u{1F344}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 150,
    restockQuantity: 9,
    starterGrantOnly: true,
  },
  /**
   * Phase 3C-6: the first non-Starter ingredient (see
   * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md sections 6-7, 12 and
   * docs/reports/PIZZA_GAME_Phase3C-6_First-Progression_Result.md for the threshold/price
   * balancing that landed on these exact numbers, and for why this replaced an earlier
   * salami/salami-pizza draft -- onion/Fugazza matched a real-world pizza per PIZZA DB's
   * canonical data, per the project's "no invented ingredient combinations" policy,
   * `PIZZA_GAME_SSOT.md` section 1). Renders with the ordinary emoji-topping path (no dedicated
   * CSS treatment needed -- 🧅 already reads clearly as onion, distinct from every other
   * topping).
   *
   * EP3 (Economy & Progression 1.0, Shop 2.0 restock): `restockQuantity: 12` is the SSOT's
   * already-confirmed "Restock batch" for onion (TETO_ECONOMY-PROGRESSION-1_MATRIX.md section
   * 2) -- 12 units for the same 120 Pitz `pricePitz` already shipped above, unchanged since.
   *
   * EP4 (Economy & Progression 1.0, Starter Stock): the original Phase 3C-6 manual-purchase
   * path -- onion's *initial* ownership required a manual 120 Pitz Shop purchase once
   * `totalStars` reached 12 (`AVAILABLE_TO_BUY`), independently of whether `fugazza` itself was
   * anywhere near unlocked -- is retired. `onion` now sets `starterGrantOnly: true`, exactly
   * like the matrix's other 10 non-Starter rows above: Shop never shows a LOCKED/AVAILABLE_TO_BUY
   * row for it and `purchaseIngredient` rejects a direct `PURCHASE_INGREDIENT` the same
   * defensive way (see ../logic/economy.ts), so `unlockCondition.minTotalStars` below is now
   * inert, kept only as the original production value rather than renumbered to 0. `onion`'s
   * *only* path to its first unit is its free Starter Grant (../state/starterStock.ts), paid out
   * the moment `fugazza` itself unlocks: 4 onion x 10 plays = 40 units, credited to `inventory`
   * alongside `ownedIngredientIds` in the same step, exactly like every other EP4 Starter Grant
   * ingredient. `restockQuantity` below is unchanged -- still 12 units per restock, completely
   * independent from (never compounding with) the one-time 40-unit Starter Grant. See the EP4
   * Result report §7 for the finalized product decision retiring the old manual-purchase path.
   *
   * Economy Tuning 1 (docs/reports/TETO_ECONOMY-TUNING-1_Implementation-Result.md): `pricePitz`
   * raised from 120 to 170 (the task's TARGET price table) -- restock price only, never
   * compounding with the free 40-unit Starter Grant above, and `restockQuantity`/
   * `unlockCondition` are untouched.
   */
  {
    id: "onion",
    category: "topping",
    nameJa: "たまねぎ",
    color: "#e8d9a8",
    emoji: "\u{1F9C5}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 12 },
    pricePitz: 170,
    restockQuantity: 12,
    starterGrantOnly: true,
  },
  /**
   * Recipe Expansion Batch 1A (see docs/reports/TETO_RECIPE-EXPANSION_BATCH-1A_Implementation-Result.md):
   * 4 new topping rows, one per new recipe (../data/recipes.ts's salsiccia/pepperoni/napoletana/
   * tonno-e-cipolla), each `newIngredientsIntroduced` per the Fresh Recipe Master Catalog
   * (data/recipes/pizza_master_catalog.json). Follows the exact same EP4/starterGrantOnly
   * pattern as every ingredient above: `unlockCondition: { minTotalStars: 0 }` (inert -- the
   * Shop row is suppressed entirely by `starterGrantOnly` regardless, matching the majority
   * convention of every EP4 row except `onion`'s own pre-EP4 legacy value), `starterGrantOnly:
   * true` (first unit always free via the governing recipe's Starter Grant, never a manual
   * purchase), `restockQuantity` = that recipe's own `minCount x 3` (the same "~3 recommended
   * plays" sizing every existing finite topping already uses -- mushroom/garlic/cherry-tomato/
   * onion). `pricePitz` has no ingredient-specific formula anywhere in this codebase (Economy
   * Tuning 1's own TARGET table was hand-tuned per ingredient, not derived) -- these four are
   * priced in the same upper-middle tier as the other "premium" flavor toppings (mushroom 150,
   * onion 170), since introducing meat/fish toppings is the same kind of catalog-expanding
   * event as those two were; see the Result Report's pricing-rationale section for the full
   * per-ingredient reasoning. Emoji: no exact Unicode glyph exists for any of these foods, so
   * each reuses the closest distinct existing glyph from the platform's food/animal set,
   * exactly like `pesto`/`basil` already sharing the herb emoji -- `IngredientPieceVisual`
   * only ever renders the emoji for a non-cheese ingredient, never a claim about visual realism.
   */
  {
    id: "sausage",
    category: "topping",
    nameJa: "ソーセージ",
    color: "#8b4a3f",
    emoji: "\u{1F32D}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 140,
    restockQuantity: 9,
    starterGrantOnly: true,
  },
  {
    id: "pepperoni",
    category: "topping",
    nameJa: "ペパロニ",
    color: "#c1272d",
    emoji: "\u{1F534}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 130,
    restockQuantity: 12,
    starterGrantOnly: true,
  },
  {
    id: "anchovy",
    category: "topping",
    nameJa: "アンチョビ",
    color: "#8ba3b8",
    emoji: "\u{1F41F}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 110,
    restockQuantity: 9,
    starterGrantOnly: true,
  },
  {
    id: "tuna",
    category: "topping",
    nameJa: "ツナ",
    color: "#5b7c99",
    emoji: "\u{1F420}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 120,
    restockQuantity: 9,
    starterGrantOnly: true,
  },
  /**
   * Recipe Expansion Batch 1B-A (see docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-A_Result.md):
   * 2 new topping rows, one per new recipe (../data/recipes.ts's pizza-bianca/breakfast-pizza),
   * per the Fresh Recipe Master Catalog (data/recipes/pizza_master_catalog.json /
   * ingredient_master_catalog.json). Follows the exact same EP4/starterGrantOnly pattern as
   * every Batch 1A row above: `unlockCondition: { minTotalStars: 0 }` (inert -- the Shop row is
   * suppressed by `starterGrantOnly` regardless), `starterGrantOnly: true` (first unit always
   * free via the governing recipe's Starter Grant), `restockQuantity` = that recipe's own
   * `minCount x 3`. `pricePitz` reuses the existing tier convention (no new formula):
   * `rosemary` matches `oregano`'s herb tier (55), `bacon` matches `sausage`'s premium-meat tier
   * (140). Emoji: `bacon` uses the real Unicode bacon glyph (no existing ingredient needed a
   * substitute); `rosemary` reuses a sprig-like glyph distinct from `basil`/`pesto`'s 🌿 and
   * `oregano`'s 🍃, matching the "closest distinct existing glyph" convention `IngredientPieceVisual`
   * already relies on for every non-cheese ingredient.
   */
  {
    id: "rosemary",
    category: "topping",
    nameJa: "ローズマリー",
    color: "#7c8f5e",
    emoji: "\u{1F331}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 55,
    restockQuantity: 9,
    starterGrantOnly: true,
    bakeRoastResistant: true,
  },
  {
    id: "bacon",
    category: "topping",
    nameJa: "ベーコン",
    color: "#c26b4e",
    emoji: "\u{1F953}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 140,
    restockQuantity: 9,
    starterGrantOnly: true,
  },
  /**
   * Recipe Expansion Batch 1B-B (see docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-B_Result.md):
   * 2 new topping rows for `capricciosa` (../data/recipes.ts), per the Fresh Recipe Master
   * Catalog (data/recipes/pizza_master_catalog.json / ingredient_master_catalog.json). Follows
   * the exact same EP4/starterGrantOnly pattern as every Batch 1A/1B-A row above:
   * `unlockCondition: { minTotalStars: 0 }` (inert -- the Shop row is suppressed by
   * `starterGrantOnly` regardless), `starterGrantOnly: true` (first unit always free via
   * capricciosa's own Starter Grant), `restockQuantity` = capricciosa's own `minCount x 3`.
   * `pricePitz` reuses the existing tier convention (no new formula): `ham` matches
   * `sausage`/`bacon`'s premium-meat tier (140); `black-olive` matches `garlic`/`gorgonzola`'s
   * mid-tier flavor topping tier (90). `restockQuantity` uses capricciosa's own actually-shipped
   * `minCount` (ham x1, black-olive x2 -- see ../data/recipes.ts's own comment for why this
   * rebalances the Fresh Design audit's original x2/x3 proposal down to fit the existing
   * 8-slot player-reference ring ceiling), not the audit's pre-rebalance numbers. Emoji: no
   * exact Unicode glyph exists for either food, so
   * each reuses the closest distinct existing glyph convention `IngredientPieceVisual` already
   * relies on for every non-cheese ingredient -- `ham` uses the generic meat-on-bone glyph
   * (distinct from `bacon`'s strip glyph and `sausage`'s link glyph); `black-olive` reuses the
   * plain-shape-emoji convention `pepperoni` already established (a small round olive has no
   * dedicated glyph either, and `olive-oil` already owns the literal olive emoji), so it uses a
   * black circle -- a small, dark, round piece, distinct in color from `pepperoni`'s red circle.
   */
  {
    id: "ham",
    category: "topping",
    nameJa: "ハム",
    color: "#e0a3a0",
    emoji: "\u{1F356}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 140,
    restockQuantity: 3,
    starterGrantOnly: true,
  },
  {
    id: "black-olive",
    category: "topping",
    nameJa: "ブラックオリーブ",
    color: "#2f2a22",
    emoji: "⚫",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 90,
    restockQuantity: 6,
    starterGrantOnly: true,
  },
  /**
   * Progression 2.0 W1 Integration I5a (docs/reports/TETO_PROGRESS2_W1_I5A_Result.md): the 7 W1
   * materials, registered in the catalog only. Appended last so the existing tray order and paging
   * are untouched.
   *
   * - Finite materials (`unlockCondition` present, so never an unlimited starter), sold only by
   *   the REC-04 material Shop (../logic/materialShop.ts). No legacy `pricePitz`/`restockQuantity`/
   *   `starterGrantOnly`: prices and packs come from the Discovery Ladder tier and k, never from
   *   these rows.
   * - Not obtainable yet: no shipped recipe uses them (k = 0) and the current Discovery Ladder
   *   does not contain them, so `materialOffer` is null -- no Shop row, no unlock notice, no
   *   entitlement. They become reachable when the W1 recipes and their ladder ship together.
   * - Visuals are the W1 Human Visual Gate authority (7/7 HUMAN_PASS): capers / clam /
   *   fresh-tomato draw their dedicated `pieceVisual` (their `emoji` is only the required text
   *   fallback and is never drawn); corn / eggplant / pineapple / potato use their emoji.
   * - `fresh-tomato` is its own id (a slice), never an alias of `cherry-tomato` or `tomato-sauce`.
   */
  {
    id: "capers",
    category: "topping",
    nameJa: "ケッパー",
    color: "#6f7f35",
    emoji: "\u{1F7E2}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pieceVisual: "caper-cluster",
  },
  {
    id: "clam",
    category: "topping",
    nameJa: "あさり",
    color: "#c9b89a",
    emoji: "\u{1F9AA}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pieceVisual: "clam-valve",
  },
  {
    id: "corn",
    category: "topping",
    nameJa: "コーン",
    color: "#f5cf3a",
    emoji: "\u{1F33D}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
  },
  {
    id: "eggplant",
    category: "topping",
    nameJa: "ナス",
    color: "#62407b",
    emoji: "\u{1F346}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
  },
  {
    id: "fresh-tomato",
    category: "topping",
    nameJa: "トマト",
    color: "#d9432f",
    emoji: "\u{1F345}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pieceVisual: "tomato-slice",
  },
  {
    id: "pineapple",
    category: "topping",
    nameJa: "パイナップル",
    color: "#f3c623",
    emoji: "\u{1F34D}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
  },
  {
    id: "potato",
    category: "topping",
    nameJa: "じゃがいも",
    color: "#d9b77e",
    emoji: "\u{1F954}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
  },
];

export const CATEGORY_ORDER: IngredientCategory[] = ["sauce", "cheese", "topping"];

export const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  sauce: "ソース",
  cheese: "チーズ",
  topping: "トッピング",
};

/**
 * Visual Polish 1C: the "すべて + カテゴリ" tab set shared by any category-filtered ingredient
 * list (Inventory's own `InventoryOverlay.tsx` already established this exact ALL+category
 * shape; Shop's `ShopOverlay.tsx` reuses these two constants rather than redefining its own
 * copy). Derived from `CATEGORY_ORDER`/`CATEGORY_LABEL` above, so a future ingredient category
 * needs no change here.
 */
export type CategoryTab = "ALL" | IngredientCategory;

export const CATEGORY_TAB_ORDER: readonly CategoryTab[] = ["ALL", ...CATEGORY_ORDER];

export const CATEGORY_TAB_LABEL: Record<CategoryTab, string> = {
  ALL: "すべて",
  ...CATEGORY_LABEL,
};

// Progression 2.0 I4b-4: `EARLY_GAME_HINT_THRESHOLD` (the Shop's old "レシピを解放すると…" hint
// cutoff) was removed -- the Shop now shows the Discovery Ladder progress line instead
// (../logic/materialShop.ts's `nextMaterialHint`).

export function getIngredient(id: string): Ingredient | undefined {
  return INGREDIENTS.find((i) => i.id === id);
}

export function ingredientsByCategory(category: IngredientCategory): Ingredient[] {
  return INGREDIENTS.filter((i) => i.category === category);
}

/**
 * Phase 4A-1B Human Feel Fix 2: the Ingredient Palette (`IngredientTray.tsx`) is a fixed
 * 3x2 grid with no scrolling -- scrolling the tray and dragging a piece onto the pizza were
 * two touch gestures competing for the same swipe, which iPhone testing pinned as the actual
 * cause of "feels unresponsive" (not the drag tuning Fix 1 already shipped). Every category
 * today owns <=6 ingredients so this cap is a no-op in practice, but it's enforced
 * unconditionally so a future category (or the 7th `onion`-style unlock) can't silently
 * regress back into needing scroll. This is also the constant a future "seat at most N
 * ingredients on the countertop" loadout feature (see
 * docs/design/PIZZA_GAME_Phase4A-1B_Ingredient-Palette-Fixed-Grid_Design.md) is expected to
 * reuse for its own cap, rather than inventing a second one.
 */
export const MAX_INGREDIENT_PALETTE_SLOTS = 6;

/**
 * EP4 (Economy & Progression 1.0, Starter Stock): only `tomato-sauce`/`mozzarella`/`basil`
 * remain Starter Set now -- Margherita's own three ingredients, permanently unlimited by design
 * (see docs/reports/TETO_ECONOMY-PROGRESSION_EP4_Starter-Stock_Result.md), never touched by this
 * revision even though several of them (`tomato-sauce`, `mozzarella`) are also required by other,
 * lockable recipes. Every other pre-EP4 Starter ingredient (mushroom/garlic/oregano/egg/pesto/
 * cherry-tomato/olive-oil/gorgonzola/parmigiano/fontina) now has its own `unlockCondition` and is
 * OWNED only via its governing recipe's Starter Grant (../state/starterStock.ts), not
 * unconditionally. Still derived from `unlockCondition` being absent rather than a
 * hand-maintained id list, so this set shrinks/grows automatically as ingredient data changes --
 * nothing here needed to change for EP4 itself, only the ingredient data above did.
 */
export const STARTER_INGREDIENT_IDS: readonly string[] = INGREDIENTS.filter(
  (i) => !i.unlockCondition,
).map((i) => i.id);
