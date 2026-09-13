export type IngredientCategory = "sauce" | "cheese" | "topping";

export interface Ingredient {
  id: string;
  category: IngredientCategory;
  nameJa: string;
  color: string;
  emoji: string;
  /** "spread" covers the whole pizza in one tap; "scatter" is placed point by point. */
  placement: "spread" | "scatter";
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
