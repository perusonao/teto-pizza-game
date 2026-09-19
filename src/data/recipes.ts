export interface RecipeRequirement {
  ingredientId: string;
  minCount: number;
}

export interface BakeTarget {
  start: number;
  end: number;
}

/**
 * Economy & Progression 1.0 EP1 (see docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md
 * sec. 3.1 / docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md sec. 1): a recipe-level unlock
 * gate, orthogonal to `Ingredient.unlockCondition`/ownership (src/data/ingredients.ts,
 * src/state/inventory.ts). Both fields are AND'd together when both are present (a recipe
 * chained to a discovery threshold can still also require a score threshold, e.g.
 * quattro-formaggi). Absent on a recipe (only `margherita`) means always unlocked.
 */
export interface RecipeUnlockCondition {
  /** Unlocked once this recipe has been discovered (Dex `discovered: true`) at least once, at
   *  any quality -- an ★1 floor result still counts. */
  requiresRecipeId?: RecipeId;
  /** Additionally (AND, not OR) requires this much accumulated totalStars
   *  (src/logic/mastery.ts). */
  minTotalStars?: number;
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
  /** EP1: absent means always unlocked (margherita only). See `recipeUnlocked`
   *  (src/state/progression.ts), the sole reader of this field. */
  unlockCondition?: RecipeUnlockCondition;
  /** EP1 Pizza Select UX (Fresh Design sec. 9): when true, a LOCKED card for this recipe keeps
   *  the existing `？？？` mystery treatment (name hidden, only a progress hint shown) instead
   *  of revealing the recipe name. Absent/false is the default for every chain-unlocked recipe
   *  (#2-#6) -- only `fugazza` (#7, the deliberate "big reveal") sets this. */
  mysteryLock?: boolean;
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
    // Start recipe -- no unlockCondition, always unlocked (Economy & Progression 1.0 EP1).
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
    unlockCondition: { requiresRecipeId: "funghi" },
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
    unlockCondition: { requiresRecipeId: "genovese", minTotalStars: 8 },
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
    unlockCondition: { requiresRecipeId: "bismarck" },
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
    unlockCondition: { requiresRecipeId: "marinara" },
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
    unlockCondition: { requiresRecipeId: "margherita" },
  },
  /**
   * Phase 3C-6's first Recipe #7 (see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 12).
   * Fugazza is a real Argentine onion pizza (dough brushed with olive oil, no tomato sauce or
   * cheese, piled with onion and oregano) -- chosen to match a real-world pizza per PIZZA DB's
   * canonical data, replacing an earlier salami/salami-pizza draft. Recipe #7 in the Chapter 1
   * unlock chain (Economy & Progression 1.0 EP1) -- availability is now the two-axis AND of
   * `recipeUnlocked` (this `unlockCondition`) and `onion` being OWNED
   * (src/state/progression.ts's `isRecipeAvailable`). Keeps the mystery (`？？？`) Pizza Select
   * treatment as the one deliberate "big reveal" of Chapter 1 (`mysteryLock`).
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
    unlockCondition: { requiresRecipeId: "quattro-formaggi", minTotalStars: 12 },
    mysteryLock: true,
  },
  /**
   * Recipe Expansion Batch 1A (see docs/reports/TETO_RECIPE-EXPANSION_BATCH-1A_Implementation-Result.md):
   * the first 4 recipes drawn from the Fresh Recipe Master Catalog's own analysis-derived
   * "Batch 1" (docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md section 11) --
   * `id`/`nameJa`/`requiredIngredients`' ingredient ids/`bakeTarget` are taken verbatim from
   * `data/recipes/pizza_master_catalog.json` (the catalog's own ground-truth entries for
   * `salsiccia`/`pepperoni`/`napoletana`/`tonno-e-cipolla`, all `implementationClass: "B"` --
   * new ingredient data only, zero new mechanic, both existing `spread`/`scatter`). Each
   * `minCount` is a Batch 1A-original decision (the catalog's own 53-entry foundation does not
   * fix production `minCount` for any candidate) sized to match the existing recipes' own
   * scatter density (2-4 per topping) -- see the Result Report's minCount-rationale section.
   * `unlockCondition`/chain order is likewise a Batch 1A-original, explicitly *provisional*
   * extension of the existing #2-#7 chain (no canonical post-フガッサ order exists anywhere in
   * this repo) -- see the Result Report's own "Batch 1A暫定progression" section for the full
   * rationale; none sets `mysteryLock` (フガッサ's "big reveal" stays a one-off, not a new
   * default). `baseRewardPitz: 100` matches every other recipe (Issue #38 V1: no
   * difficulty-based reward differentiation without Human Feel evidence).
   */
  {
    id: "salsiccia",
    nameJa: "サルシッチャ",
    description:
      "トマトソースとモッツァレラの上に、ゴロッとした自家製ソーセージをのせて焼き上げる、食べ応えたっぷりの一枚。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "sausage", minCount: 3 },
    ],
    bakeTarget: { start: 62, end: 82 },
    baseRewardPitz: 100,
    unlockCondition: { requiresRecipeId: "fugazza", minTotalStars: 16 },
  },
  {
    id: "pepperoni",
    nameJa: "ペパロニ",
    description:
      "トマトソースとモッツァレラに、ピリッと香ばしいペパロニをたっぷりのせた、みんな大好き定番ピザ。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "pepperoni", minCount: 4 },
    ],
    bakeTarget: { start: 60, end: 80 },
    baseRewardPitz: 100,
    unlockCondition: { requiresRecipeId: "salsiccia", minTotalStars: 20 },
  },
  {
    id: "napoletana",
    nameJa: "ナポリ",
    description:
      "トマトソースとモッツァレラに、塩気のきいたアンチョビとオレガノを効かせた、ナポリ生まれの本格派ピザ。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "anchovy", minCount: 3 },
      { ingredientId: "oregano", minCount: 1 },
    ],
    bakeTarget: { start: 48, end: 68 },
    baseRewardPitz: 100,
    unlockCondition: { requiresRecipeId: "pepperoni", minTotalStars: 24 },
  },
  {
    id: "tonno-e-cipolla",
    nameJa: "トンノ・エ・チポッラ",
    description:
      "トマトソースとモッツァレラに、ツナとたまねぎを合わせた、さっぱり食べられる魚介のピザ。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "onion", minCount: 2 },
      { ingredientId: "tuna", minCount: 3 },
    ],
    bakeTarget: { start: 55, end: 75 },
    baseRewardPitz: 100,
    unlockCondition: { requiresRecipeId: "napoletana", minTotalStars: 28 },
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
