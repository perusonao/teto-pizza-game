export interface RecipeRequirement {
  ingredientId: string;
  minCount: number;
}

export interface BakeTarget {
  start: number;
  end: number;
}

export interface Recipe {
  id: RecipeId;
  nameJa: string;
  description: string;
  requiredIngredients: readonly RecipeRequirement[];
  bakeTarget: BakeTarget;
}

/** `as const` on the whole array (not per-id) keeps every id a string literal
 *  automatically, so RecipeId always reflects RECIPES with no hand-maintained
 *  id list and no per-entry annotation to remember when adding a recipe. */
export const RECIPES = [
  {
    id: "margherita",
    nameJa: "マルゲリータ",
    description:
      "トマトソース・モッツァレラ・バジルだけで作る、いちばんシンプルで奥が深いピザ。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 3 },
      { ingredientId: "basil", minCount: 2 },
    ],
    bakeTarget: { start: 60, end: 80 },
  },
  {
    id: "marinara",
    nameJa: "マリナーラ",
    description:
      "トマトソースとにんにく、オレガノだけ。チーズを使わない、ナポリ生まれの下町ピザ。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "garlic", minCount: 3 },
      { ingredientId: "oregano", minCount: 2 },
    ],
    bakeTarget: { start: 45, end: 65 },
  },
  {
    id: "quattro-formaggi",
    nameJa: "クアトロ フォルマッジ",
    description:
      "モッツァレラ・ゴルゴンゾーラ・パルミジャーノ・フォンティーナ、4種のチーズが溶け合う濃厚な一枚。",
    requiredIngredients: [
      { ingredientId: "olive-oil", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "gorgonzola", minCount: 2 },
      { ingredientId: "parmigiano", minCount: 2 },
      { ingredientId: "fontina", minCount: 2 },
    ],
    bakeTarget: { start: 65, end: 85 },
  },
  {
    id: "genovese",
    nameJa: "ジェノベーゼ",
    description:
      "バジル香る緑のジェノベーゼソースに、モッツァレラとチェリートマトを合わせた、彩り鮮やかな一枚。",
    requiredIngredients: [
      { ingredientId: "pesto", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "cherry-tomato", minCount: 3 },
    ],
    bakeTarget: { start: 50, end: 70 },
  },
  {
    id: "bismarck",
    nameJa: "ビスマルク",
    description:
      "トマトソースとモッツァレラの上に卵をのせて焼き上げる、まんなかがとろ〜り輝くピザ。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 3 },
      { ingredientId: "egg", minCount: 1 },
    ],
    bakeTarget: { start: 55, end: 75 },
  },
  {
    id: "funghi",
    nameJa: "フンギ",
    description:
      "トマトソースとモッツァレラに、香り豊かなマッシュルームをたっぷりのせたきのこ好きのための一枚。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "mushroom", minCount: 3 },
    ],
    bakeTarget: { start: 58, end: 78 },
  },
  /**
   * Phase 3C-6's first Recipe #7 (see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 12):
   * the same "tomato + mozzarella + one topping" family as bismarck/funghi, but its
   * `salami` requirement means it is never available until that ingredient is purchased
   * (src/state/progression.ts's `isRecipeAvailable` -- there is no separate `recipeUnlocked`
   * flag; availability derives purely from `requiredIngredients` being OWNED).
   */
  {
    id: "salami-pizza",
    nameJa: "サラミピザ",
    description:
      "トマトソースとモッツァレラの上に、ピリッと香ばしいサラミをたっぷりのせた食べ応えのある一枚。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "salami", minCount: 3 },
    ],
    bakeTarget: { start: 62, end: 82 },
  },
] as const;

/** Derived from RECIPES above so this union can never drift out of sync with
 *  the actual recipe data. */
export type RecipeId = (typeof RECIPES)[number]["id"];

export function getRecipe(id: RecipeId): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** Stable 0-based position of a recipe within RECIPES, used to deterministically
 *  rotate between dialogue variants without any extra play-history state. */
export function getRecipeIndex(id: RecipeId): number {
  return RECIPES.findIndex((r) => r.id === id);
}
