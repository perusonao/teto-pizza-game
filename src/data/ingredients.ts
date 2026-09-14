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
    color: "#c73b2e",
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
 * Every current ingredient (all 13) is Starter Set (see
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 5) -- always OWNED, no Mastery gate.
 * Derived from `unlockCondition` being absent rather than a separate hand-maintained id
 * list, so a future ingredient only needs to add an `unlockCondition` to stop being
 * treated as starter; nothing here needs to change when that happens.
 */
export const STARTER_INGREDIENT_IDS: readonly string[] = INGREDIENTS.filter(
  (i) => !i.unlockCondition,
).map((i) => i.id);
