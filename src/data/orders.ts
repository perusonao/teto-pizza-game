import type { RecipeId } from "./recipes";

export interface Order {
  id: string;
  recipeId: RecipeId;
  requestedBy: "mito";
  lineJa: string;
}

export const ORDERS: Order[] = [
  {
    id: "order-margherita",
    recipeId: "margherita",
    requestedBy: "mito",
    lineJa: "マルゲリータが食べたいな！おすすめを教えてテト！",
  },
  {
    id: "order-marinara",
    recipeId: "marinara",
    requestedBy: "mito",
    lineJa: "今日はシンプルにマリナーラの気分！トマトとにんにくの香りが恋しいな。",
  },
  {
    id: "order-quattro-formaggi",
    recipeId: "quattro-formaggi",
    requestedBy: "mito",
    lineJa: "チーズたっぷりのクアトロ フォルマッジが食べたい！とろとろにしてね！",
  },
  {
    id: "order-genovese",
    recipeId: "genovese",
    requestedBy: "mito",
    lineJa: "緑のソースのピザ、気になるな〜！ジェノベーゼを作ってみて！",
  },
  {
    id: "order-bismarck",
    recipeId: "bismarck",
    requestedBy: "mito",
    lineJa: "まんなかに卵がのったピザって見たことある？ビスマルクを食べてみたいな！",
  },
  {
    id: "order-funghi",
    recipeId: "funghi",
    requestedBy: "mito",
    lineJa: "きのこたっぷりのフンギが食べたい気分！マッシュルームの香りが恋しいな。",
  },
  {
    id: "order-fugazza",
    recipeId: "fugazza",
    requestedBy: "mito",
    lineJa: "たまねぎが仕入れられたんだって！アルゼンチン風のフガッサを作ってみてほしいな！",
  },
];

export interface NextOrderOptions {
  /** Prefer the margherita order (used on the very first play of a session). */
  preferFirst?: boolean;
  /** Avoid repeating this recipe id when picking randomly (used on replay). */
  excludeRecipeId?: string;
  /** Recipe ids already registered in the dex; undiscovered ones are prioritized. */
  dex?: string[];
  /** Recipe ids the player can currently make (see src/state/progression.ts's
   *  `availableRecipeIds`). When provided, only orders for these recipes are considered --
   *  undiscovered-priority below still applies within that subset. Omit (or pass every
   *  recipe id) to consider all recipes, which is what every existing call site does today
   *  since all 6 current recipes are always available (Starter Set). */
  availableRecipeIds?: string[];
}

function pickRandom(pool: Order[]): Order {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Narrows `pool` to entries that don't repeat `excludeRecipeId`, unless that would empty it. */
function avoidRepeat(pool: Order[], excludeRecipeId: string | undefined): Order[] {
  if (!excludeRecipeId) return pool;
  const withoutRepeat = pool.filter((o) => o.recipeId !== excludeRecipeId);
  return withoutRepeat.length > 0 ? withoutRepeat : pool;
}

/** Narrows `ORDERS` to `availableRecipeIds` when given. Falls back to every order instead of
 *  an empty pool -- an order phase must never have zero candidates to pick from, even if
 *  availability data is unexpectedly empty (e.g. a corrupt/future ownership list). */
function availableOrders(availableRecipeIds: string[] | undefined): Order[] {
  if (!availableRecipeIds) return ORDERS;
  const filtered = ORDERS.filter((o) => availableRecipeIds.includes(o.recipeId));
  return filtered.length > 0 ? filtered : ORDERS;
}

export function getNextOrder(options: NextOrderOptions = {}): Order {
  const pool = availableOrders(options.availableRecipeIds);

  if (options.preferFirst) {
    return pool.find((o) => o.recipeId === "margherita") ?? pool[0];
  }

  const dex = options.dex ?? [];
  const undiscovered = pool.filter((o) => !dex.includes(o.recipeId));
  const finalPool =
    undiscovered.length > 0
      ? avoidRepeat(undiscovered, options.excludeRecipeId)
      : avoidRepeat(pool, options.excludeRecipeId);

  return pickRandom(finalPool);
}
