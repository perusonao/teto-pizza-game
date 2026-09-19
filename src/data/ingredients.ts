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
  /** Economy & Progression 1.0 EP4: true for a finite (`unlockCondition`-bearing) ingredient
   *  whose *initial* OWNED status is granted for free by its governing recipe's Starter Grant
   *  (see ../state/starterStock.ts) rather than a manual Shop purchase -- the player never
   *  spends Pitz to first obtain it, only to restock it later. Still finite/restockable exactly
   *  like `onion` -- the Stock Gate (`hasStock`/`canPlaceIngredient`/`consumePizzaInventory`,
   *  ../state/inventory.ts) and Shop restock (`restockIngredient`, ../logic/economy.ts) key
   *  purely on `unlockCondition`'s presence, unaffected by this flag. This flag exists only to
   *  suppress the *initial-unlock* LOCKED/AVAILABLE_TO_BUY purchase UI/transaction
   *  (ShopOverlay's product list, `purchaseIngredient`) for an ingredient that was never meant
   *  to be independently bought before its recipe unlocks -- see the EP4 Result report for why
   *  `unlockCondition.minTotalStars` is otherwise unused/inert on every ingredient that sets
   *  this. `onion` does NOT set this: it keeps its original Phase 3C-6 manual-purchase path
   *  unchanged, with EP4's Starter Grant layered on top of (never replacing) it. */
  starterGrantOnly?: boolean;
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
   * the first 9 of the matrix's 10 non-Starter rows referenced by `onion`'s own EP3 comment
   * below (mushroom/garlic/oregano/egg/pesto/cherry-tomato/gorgonzola/parmigiano/fontina share
   * this same treatment). Each gains `unlockCondition` (so the Stock Gate/`consumePizzaInventory`
   * -- ../state/inventory.ts -- start tracking it as finite, exactly like `onion`) plus
   * `pricePitz`/`restockQuantity` (so Shop restock, ../logic/economy.ts's `restockIngredient`,
   * has a valid transaction once its Starter Grant stock runs out) and `starterGrantOnly: true`
   * (so Shop never shows a LOCKED/AVAILABLE_TO_BUY row for it -- its *first* unit ever is always
   * free, via its governing recipe's Starter Grant, ../state/starterStock.ts -- restock is the
   * only Shop transaction that ever applies to it). `minTotalStars: 0` is otherwise inert: with
   * `starterGrantOnly` suppressing both the Shop row and `purchaseIngredient` itself for it, this
   * ingredient's LOCKED/AVAILABLE_TO_BUY state (from `ingredientState`) is never read or acted on
   * before ownership actually lands via the grant. `restockQuantity`/`pricePitz` follow the same
   * 3-plays-per-restock, 10-Pitz-per-unit ratio `onion`'s own EP3 numbers already established
   * (120 Pitz / 12 units = 10 Pitz/unit, 12 units / 4-per-pizza = 3 plays) applied to this
   * ingredient's own largest per-recipe `minCount` across every recipe requiring it (see
   * src/data/recipes.ts) -- a deliberate, consistent extrapolation, not a value from any existing
   * SSOT table (flagged as a product decision in the EP4 Result report, not silently invented).
   */
  {
    id: "olive-oil",
    category: "sauce",
    nameJa: "オリーブオイル",
    color: "#e9d9a0",
    emoji: "\u{1FAD2}",
    placement: "spread",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 30,
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
    pricePitz: 30,
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
    pricePitz: 60,
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
    pricePitz: 60,
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
    pricePitz: 60,
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
    pricePitz: 60,
    restockQuantity: 6,
    starterGrantOnly: true,
  },
  {
    id: "cherry-tomato",
    category: "topping",
    nameJa: "チェリートマト",
    color: "#e2412f",
    emoji: "\u{1F345}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 90,
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
    pricePitz: 30,
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
    pricePitz: 90,
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
   * EP4 (Economy & Progression 1.0, Starter Stock): the original Phase 3C-6 exception --
   * onion's *initial* ownership required a manual 120 Pitz Shop purchase once `totalStars`
   * reached 12 (`AVAILABLE_TO_BUY`), the only ingredient in the game that ever worked that way
   * -- is retired. `onion` now ALSO receives a free Starter Grant (../state/starterStock.ts) the
   * moment `fugazza` itself unlocks: 4 onion x 10 plays = 40 units, credited to `inventory`
   * alongside `ownedIngredientIds`, exactly like every other EP4 Starter Grant ingredient. This
   * is additive, not a replacement: `unlockCondition`/`pricePitz`/`restockQuantity` below are
   * left completely unchanged (still 12/120/unlockCondition unlockable at 12 stars), so the
   * original manual-purchase path still technically works if a player happens to reach 12
   * totalStars before fugazza's own chain/stars gate -- see the EP4 Result report for why this
   * vestigial path was deliberately left in place rather than removed (a product decision, not
   * an oversight). `onion` deliberately does NOT set `starterGrantOnly` for this reason -- unlike
   * the matrix's other 10 non-Starter rows (mushroom/garlic/oregano/egg/pesto/cherry-tomato/
   * olive-oil/gorgonzola/parmigiano/fontina, all EP4-added above), it keeps a real, working
   * AVAILABLE_TO_BUY path.
   */
  {
    id: "onion",
    category: "topping",
    nameJa: "たまねぎ",
    color: "#e8d9a8",
    emoji: "\u{1F9C5}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 12 },
    pricePitz: 120,
    restockQuantity: 12,
  },
];

export const CATEGORY_ORDER: IngredientCategory[] = ["sauce", "cheese", "topping"];

export const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  sauce: "ソース",
  cheese: "チーズ",
  topping: "トッピング",
};

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
