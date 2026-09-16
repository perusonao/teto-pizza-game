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
  /** Shop price in Pitz (Phase 3C-5, see src/logic/economy.ts's `purchaseIngredient` and
   *  docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 9). Only meaningful for an
   *  AVAILABLE_TO_BUY ingredient (one with `unlockCondition`) -- absent for every current
   *  Starter Set ingredient, since those are always OWNED and never for sale. A future
   *  ingredient must set this to a positive integer to actually be purchasable; anything
   *  else (absent, zero, negative, fractional, NaN) reads as "not for sale"
   *  (`purchaseIngredient`'s `NOT_FOR_SALE` reason). */
  pricePitz?: number;
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
  {
    id: "olive-oil",
    category: "sauce",
    nameJa: "オリーブオイル",
    color: "#e9d9a0",
    emoji: "\u{1FAD2}",
    placement: "spread",
  },
  {
    id: "pesto",
    category: "sauce",
    nameJa: "ジェノベーゼソース",
    color: "#6b8e3d",
    emoji: "\u{1F33F}",
    placement: "spread",
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
  },
  {
    id: "parmigiano",
    category: "cheese",
    nameJa: "パルミジャーノ",
    color: "#f6e6a8",
    emoji: "\u{1F9C0}",
    placement: "scatter",
  },
  {
    id: "fontina",
    category: "cheese",
    nameJa: "フォンティーナ",
    color: "#f0d9a0",
    emoji: "\u{1F9C0}",
    placement: "scatter",
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
  },
  {
    id: "oregano",
    category: "topping",
    nameJa: "オレガノ",
    color: "#5f7a3d",
    emoji: "\u{1F343}",
    placement: "scatter",
  },
  {
    id: "cherry-tomato",
    category: "topping",
    nameJa: "チェリートマト",
    color: "#e2412f",
    emoji: "\u{1F345}",
    placement: "scatter",
  },
  {
    id: "egg",
    category: "topping",
    nameJa: "たまご",
    color: "#f2c94c",
    emoji: "\u{1F95A}",
    placement: "scatter",
  },
  {
    id: "mushroom",
    category: "topping",
    nameJa: "マッシュルーム",
    color: "#b08968",
    emoji: "\u{1F344}",
    placement: "scatter",
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
 * Every current ingredient (all 13) is Starter Set (see
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 5) -- always OWNED, no Mastery gate.
 * Derived from `unlockCondition` being absent rather than a separate hand-maintained id
 * list, so a future ingredient only needs to add an `unlockCondition` to stop being
 * treated as starter; nothing here needs to change when that happens.
 */
export const STARTER_INGREDIENT_IDS: readonly string[] = INGREDIENTS.filter(
  (i) => !i.unlockCondition,
).map((i) => i.id);
