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
  /** Issue #38 E-P1: static per-recipe base for the Pitz reward formula
   *  (`recipeBaseReward x qualityMultiplier`, see ../logic/pitzReward.ts). Never persisted --
   *  authored data on `Recipe` itself, identical in shape to `Ingredient.pricePitz`. V1
   *  deliberately gives every recipe the same value (no difficulty-based differentiation without
   *  Human Feel evidence, per Issue #38's own Fresh Audit sec. 2). */
  baseRewardPitz: number;
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
    baseRewardPitz: 100,
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
    baseRewardPitz: 100,
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
    baseRewardPitz: 100,
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
    baseRewardPitz: 100,
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
    baseRewardPitz: 100,
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
    baseRewardPitz: 100,
  },
  /**
   * Phase 3C-6's first Recipe #7 (see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 12).
   * Fugazza is a real Argentine onion pizza (dough brushed with olive oil, no tomato sauce or
   * cheese, piled with onion and oregano) -- chosen to match a real-world pizza per PIZZA DB's
   * canonical data, replacing an earlier salami/salami-pizza draft. Its `onion` requirement
   * means it is never available until that ingredient is purchased (src/state/progression.ts's
   * `isRecipeAvailable` -- there is no separate `recipeUnlocked` flag; availability derives
   * purely from `requiredIngredients` being OWNED).
   */
  {
    id: "fugazza",
    nameJa: "フガッサ",
    description:
      "オリーブオイルを塗った生地に、たまねぎとオレガノをたっぷりのせて焼き上げる、アルゼンチン生まれの香ばしい一枚。",
    requiredIngredients: [
      { ingredientId: "olive-oil", minCount: 1 },
      { ingredientId: "onion", minCount: 4 },
      { ingredientId: "oregano", minCount: 1 },
    ],
    bakeTarget: { start: 63, end: 83 },
    baseRewardPitz: 100,
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
