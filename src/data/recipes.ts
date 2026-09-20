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
  /**
   * Recipe Expansion Batch 1B-A (see docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-A_Result.md,
   * and the read-only design audit docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B_Fresh-Design.md
   * section 18's "Batch 1B-A" slice): the first 2 recipes drawn from the Fresh Recipe Master
   * Catalog's Batch 1B candidate pool -- `id`/`nameJa`/`requiredIngredients`' ingredient ids/
   * `sauce` are taken verbatim from `data/recipes/pizza_master_catalog.json` (both
   * `implementationClass: "B"` -- new ingredient data only, zero new mechanic, both existing
   * `spread`/`scatter`). Each `minCount`/`bakeTarget` is a Batch 1B-A-original decision (the
   * catalog's own entries do not fix production values for either field), sized to match the
   * existing recipes' own scatter density and bake-target span conventions. `unlockCondition`/
   * chain order continues the exact same provisional +4 minTotalStars step Batch 1A's own chain
   * established (16 -> 20 -> 24 -> 28 -> 32 -> 36); neither sets `mysteryLock` (フガッサ's "big
   * reveal" stays a one-off). `baseRewardPitz: 100` matches every other recipe (Issue #38 V1:
   * no difficulty-based reward differentiation without Human Feel evidence).
   *
   * `pizza-bianca` deliberately has no tomato-sauce requirement -- its sauce ingredient is
   * `olive-oil`, exactly like the already-shipped `fugazza` (see that recipe's own comment
   * above), which already proves the Completion Gate's sauce check (../logic/completionGate.ts's
   * `checkSauceQuantity`) reads `getReferencePizza(recipe.id).sauce.ingredientId` generically --
   * no "every recipe needs paintable tomato sauce" architecture exists in this codebase to work
   * around.
   */
  {
    id: "pizza-bianca",
    nameJa: "ピッツァ・ビアンカ",
    description:
      "トマトソースを使わない、オリーブオイルとローズマリーだけのシンプルな白いピザ。ローマ生まれの飾らない一枚。",
    requiredIngredients: [
      { ingredientId: "olive-oil", minCount: 1 },
      { ingredientId: "rosemary", minCount: 3 },
    ],
    bakeTarget: { start: 50, end: 70 },
    baseRewardPitz: 100,
    unlockCondition: { requiresRecipeId: "tonno-e-cipolla", minTotalStars: 32 },
  },
  {
    id: "breakfast-pizza",
    nameJa: "ブレックファストピザ",
    description:
      "トマトソースとモッツァレラの上に、たまごとベーコンをのせて焼き上げる、朝食にもぴったりの一枚。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "egg", minCount: 1 },
      { ingredientId: "bacon", minCount: 3 },
    ],
    bakeTarget: { start: 56, end: 76 },
    baseRewardPitz: 100,
    unlockCondition: { requiresRecipeId: "pizza-bianca", minTotalStars: 36 },
  },
  /**
   * Recipe Expansion Batch 1B-B (see docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-B_Result.md,
   * and the read-only design audit docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B_Fresh-Design.md's
   * own "Batch 1B-B" slice, on branch claude/batch-1b-design-audit-92elmc, not merged to main):
   * the 3rd recipe drawn from the Fresh Recipe Master Catalog's Batch 1B candidate pool -- `id`/
   * `nameJa`/`requiredIngredients`' ingredient ids/`sauce`/`bakeTarget` are taken verbatim from
   * `data/recipes/pizza_master_catalog.json`'s own `capricciosa` entry (`implementationClass:
   * "B"` -- new ingredient data only, zero new mechanic, existing `spread`/`scatter`; that
   * entry's own `bakeProfile` was already a fixed `{58, 78}` at audit time, unlike
   * pizza-bianca/breakfast-pizza's own null `bakeProfile` in Batch 1B-A, so this task reuses it
   * verbatim rather than authoring a new value). `minCount` starts from the Fresh Design
   * audit's own proposed composition (tomato-sauce x1, mozzarella x2, mushroom x2, oregano x1,
   * ham x2, black-olive x3) but rebalances ham/black-olive down to x1/x2 -- exactly 6
   * ingredients, at `MAX_INGREDIENT_PALETTE_SLOTS` (../data/ingredients.ts) so the Ingredient
   * Tray needs no scroll, AND exactly 8 total non-sauce pieces (2+2+1+1+2), the existing
   * ceiling `PIECE_RING_POSITIONS` (../logic/pizzaReferenceLayout.ts) already supports without
   * collision (quattro-formaggi already reaches this same 8-piece ceiling) -- the audit's own
   * un-rebalanced 10-piece proposal would silently wrap and collide in that shared 8-slot ring
   * (src/data/playerReference.ts's per-recipe layout, reused by PizzaThumbnail's card preview
   * for every recipe), which this task avoids touching rather than growing to fit one recipe.
   * `unlockCondition`/chain order continues the exact same provisional +4 minTotalStars step
   * Batch 1A's own chain established (16 -> 20 -> 24 -> 28 -> 32 -> 36 -> 40); no `mysteryLock`
   * (フガッサ's "big reveal" stays a one-off). `baseRewardPitz: 100` matches every other recipe
   * (Issue #38 V1: no difficulty-based reward differentiation without Human Feel evidence).
   */
  {
    id: "capricciosa",
    nameJa: "カプリチョーザ",
    description:
      "トマトソースとモッツァレラに、マッシュルーム・ハム・ブラックオリーブをのせた、具だくさんの一枚。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "mushroom", minCount: 2 },
      { ingredientId: "oregano", minCount: 1 },
      { ingredientId: "ham", minCount: 1 },
      { ingredientId: "black-olive", minCount: 2 },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    unlockCondition: { requiresRecipeId: "breakfast-pizza", minTotalStars: 40 },
  },
  /**
   * Recipe Expansion Batch 1B-C (see docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-C_Result.md):
   * the 4th recipe drawn from the Fresh Recipe Master Catalog's Batch 1B candidate pool --
   * `id`/`nameJa`/`requiredIngredients`' ingredient ids are taken verbatim from
   * `data/recipes/pizza_master_catalog.json`'s own `meat-lovers` entry (`implementationClass:
   * "B"` -- zero new ingredient data, zero new mechanic; every one of bacon/ham/mozzarella/
   * pepperoni/sausage/tomato-sauce already shipped in an earlier batch). `bakeProfile` was null
   * in the catalog (like pizza-bianca/breakfast-pizza before it), so `bakeTarget` is a Batch
   * 1B-C-original decision matching the existing tomato-sauce recipes' own span convention.
   * `minCount` (mozzarella x2, bacon x2, ham x1, pepperoni x1, sausage x2) is sized to exactly
   * 8 total non-sauce pieces across 5 ingredient types -- the same `PIECE_RING_POSITIONS`
   * shared 8-slot ceiling (../logic/pizzaReferenceLayout.ts) capricciosa already reaches, this
   * task's own reference-capacity gate re-confirmed safe for this composition (see the Result
   * Report's Section 2 audit) before authoring this entry. `unlockCondition`/chain order
   * continues the exact same provisional +4 minTotalStars step Batch 1A's own chain established
   * (16 -> 20 -> 24 -> 28 -> 32 -> 36 -> 40 -> 44); no `mysteryLock` (フガッサ's "big reveal"
   * stays a one-off). `baseRewardPitz: 100` matches every other recipe (Issue #38 V1: no
   * difficulty-based reward differentiation without Human Feel evidence).
   *
   * `supreme`, the catalog's other Batch 1B-C candidate, is deliberately NOT added here: it has
   * 7 non-sauce ingredient types (mozzarella/bell-pepper/black-olive/mushroom/onion/pepperoni/
   * sausage), so even a minimum minCount of 1 per type already uses 7 of the shared ring's 8
   * slots, leaving room for only one ingredient to ever exceed a single visible piece --
   * thinner than every other production recipe's 2-4-piece scatter density (capricciosa's own
   * 5-type/8-piece composition is the previous ceiling). Growing `PIECE_RING_POSITIONS` itself
   * to fit one recipe is exactly the "大規模reference redesign" this task's own gate forbids
   * doing unilaterally, so Supreme is deferred rather than shipped as an unnaturally thin
   * "one of everything" pizza -- see the Result Report's Section 2/Final Verdict for the full
   * capacity audit.
   */
  {
    id: "meat-lovers",
    nameJa: "ミートラヴァーズ",
    description:
      "トマトソースとモッツァレラに、ベーコン・ハム・ペパロニ・ソーセージをたっぷりのせた、お肉好きにはたまらない一枚。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "bacon", minCount: 2 },
      { ingredientId: "ham", minCount: 1 },
      { ingredientId: "pepperoni", minCount: 1 },
      { ingredientId: "sausage", minCount: 2 },
    ],
    bakeTarget: { start: 60, end: 80 },
    baseRewardPitz: 100,
    unlockCondition: { requiresRecipeId: "capricciosa", minTotalStars: 44 },
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
