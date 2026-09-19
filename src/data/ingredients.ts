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
   * Economy & Progression 1.0 EP4 (Starter Stock): `olive-oil`'s dual introducer (quattro-
   * formaggi first, fugazza later) is the concrete "additive shared-ingredient" case both the
   * MATRIX (sec. 1 note) and the Ingredient Economy Fresh Audit (sec. 4) call out -- see
   * `src/state/starterGrant.ts` for how a second recipe's unlock tops the same
   * `inventory["olive-oil"]` pool up rather than overwriting it. `minTotalStars: 8` mirrors
   * quattro-formaggi's own recipe-level gate (see the `mushroom` ingredient's doc comment
   * above for the full rationale shared by every EP4b ingredient).
   */
  {
    id: "olive-oil",
    category: "sauce",
    nameJa: "オリーブオイル",
    color: "#e9d9a0",
    emoji: "\u{1FAD2}",
    placement: "spread",
    unlockCondition: { minTotalStars: 8 },
    pricePitz: 50,
    restockQuantity: 3,
  },
  {
    id: "pesto",
    category: "sauce",
    nameJa: "ジェノベーゼソース",
    color: "#6b8e3d",
    emoji: "\u{1F33F}",
    placement: "spread",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 60,
    restockQuantity: 3,
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
    unlockCondition: { minTotalStars: 8 },
    pricePitz: 70,
    restockQuantity: 6,
  },
  {
    id: "parmigiano",
    category: "cheese",
    nameJa: "パルミジャーノ",
    color: "#f6e6a8",
    emoji: "\u{1F9C0}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 8 },
    pricePitz: 70,
    restockQuantity: 6,
  },
  {
    id: "fontina",
    category: "cheese",
    nameJa: "フォンティーナ",
    color: "#f0d9a0",
    emoji: "\u{1F9C0}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 8 },
    pricePitz: 70,
    restockQuantity: 6,
  },
  {
    id: "basil",
    category: "topping",
    nameJa: "バジル",
    color: "#3f7d3a",
    emoji: "\u{1F33F}",
    placement: "scatter",
  },
  /**
   * Economy & Progression 1.0 EP4 (Starter Stock, see
   * docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md sec. 2 and
   * docs/reports/TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md sec. 3/11 "EP4b"):
   * `garlic`/`oregano`/`egg`/`pesto`/`cherry-tomato`/`olive-oil`/`gorgonzola`/`parmigiano`/
   * `fontina`/`mushroom` gain `unlockCondition`/`pricePitz`/`restockQuantity` for the first
   * time here -- `STARTER_INGREDIENT_IDS` (below) shrinks from these 13 ids down to exactly 3
   * (`tomato-sauce`, `mozzarella`, `basil`) as a direct, intended consequence (matches the
   * MATRIX's own flagged risk). None of these 10 is ever purchased via a first-time Shop
   * unlock, though -- `src/state/starterGrant.ts`'s exactly-once transaction auto-OWNs and
   * stocks each one the instant the recipe that introduces it (see the MATRIX's "Introduced
   * by" column) first unlocks (EP1's `recipeUnlocked`), so a player is never asked to spend
   * Pitz before touching a new recipe for the first time -- see that module's own doc comment
   * for the full grant contract this field enables. `unlockCondition.minTotalStars` here only
   * matters for the (normally moot, since the starter grant already owns it first)
   * Shop-purchase path this same field also gates -- set to `0` for every ingredient whose
   * introducing recipe is chain-only (`requiresRecipeId`, no star floor: funghi/marinara/
   * bismarck/genovese) and to `8` for quattro-formaggi's own four (mirroring that recipe's own
   * `minTotalStars: 8` gate, src/data/recipes.ts), so an ingredient's *own* Shop-availability
   * threshold is never meaningfully looser than its recipe's. `pricePitz`/`restockQuantity`
   * are taken verbatim from the MATRIX's already-decided restock table (EP3's own restock
   * mechanism, unchanged by this revision) -- restock batch/price stay a *separate* number
   * from the starter-grant quantity (`STARTER_STOCK_PLAYS_CHAPTER_1`-derived), on purpose.
   */
  {
    id: "garlic",
    category: "topping",
    nameJa: "にんにく",
    color: "#f2ecd9",
    emoji: "\u{1F9C4}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 60,
    restockQuantity: 9,
  },
  {
    id: "oregano",
    category: "topping",
    nameJa: "オレガノ",
    color: "#5f7a3d",
    emoji: "\u{1F343}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 45,
    restockQuantity: 6,
  },
  {
    id: "cherry-tomato",
    category: "topping",
    nameJa: "チェリートマト",
    color: "#e2412f",
    emoji: "\u{1F345}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 60,
    restockQuantity: 9,
  },
  {
    id: "egg",
    category: "topping",
    nameJa: "たまご",
    color: "#f2c94c",
    emoji: "\u{1F95A}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 45,
    restockQuantity: 3,
  },
  {
    id: "mushroom",
    category: "topping",
    nameJa: "マッシュルーム",
    color: "#b08968",
    emoji: "\u{1F344}",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 60,
    restockQuantity: 9,
  },
  /**
   * Phase 3C-6: the first non-Starter ingredient (see
   * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md sections 6-7, 12 and
   * docs/reports/PIZZA_GAME_Phase3C-6_First-Progression_Result.md for the threshold/price
   * balancing that landed on these exact numbers, and for why this replaced an earlier
   * salami/salami-pizza draft -- onion/Fugazza matched a real-world pizza per PIZZA DB's
   * canonical data, per the project's "no invented ingredient combinations" policy,
   * `PIZZA_GAME_SSOT.md` section 1). LOCKED on a fresh save (no starter treatment); becomes
   * AVAILABLE_TO_BUY once `totalStars` (src/logic/mastery.ts) reaches 12, then OWNED via a
   * 120 Pitz Shop purchase (src/logic/economy.ts's `purchaseIngredient`). Renders with the
   * ordinary emoji-topping path (no dedicated CSS treatment needed -- 🧅 already reads clearly
   * as onion, distinct from every other topping).
   *
   * EP3 (Economy & Progression 1.0, Shop 2.0 restock): `restockQuantity: 12` is the SSOT's
   * already-confirmed "Restock batch" for onion (TETO_ECONOMY-PROGRESSION-1_MATRIX.md section
   * 2) -- 12 units for the same 120 Pitz `pricePitz` already shipped above, unchanged by this
   * revision. `onion` remains the only shipped ingredient with `unlockCondition` today; the
   * matrix's other 10 non-Starter rows (mushroom/garlic/oregano/egg/pesto/cherry-tomato/
   * olive-oil/gorgonzola/parmigiano/fontina) are EP4's own scope (the `starterStockPlays`
   * free-grant slice that first gives them `unlockCondition`/`pricePitz` at all) -- not added
   * here, per EP3's Scope Guard against inventing new locked ingredients ahead of that slice.
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
 * Economy & Progression 1.0 EP4: shrinks from the pre-EP4 13 down to exactly 3
 * (`tomato-sauce`, `mozzarella`, `basil`, margherita's own ingredients -- see
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 5 and
 * docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md sec. 5) -- always OWNED, no Mastery
 * gate, permanently unconditionally unlimited (the design's one deliberate softlock guard).
 * Every other ingredient now has an `unlockCondition` and arrives via
 * `src/state/starterGrant.ts`'s exactly-once grant the instant the recipe introducing it
 * unlocks, rather than being Starter. Derived from `unlockCondition` being absent rather than
 * a separate hand-maintained id list, so a future ingredient only needs to add an
 * `unlockCondition` to stop being treated as starter; nothing here needs to change when that
 * happens.
 */
export const STARTER_INGREDIENT_IDS: readonly string[] = INGREDIENTS.filter(
  (i) => !i.unlockCondition,
).map((i) => i.id);
