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
];

export interface NextOrderOptions {
  /** Prefer the margherita order (used on the very first play of a session). */
  preferFirst?: boolean;
  /** Avoid repeating this recipe id when picking randomly (used on replay). */
  excludeRecipeId?: string;
  /** Recipe ids already registered in the dex; undiscovered ones are prioritized. */
  dex?: string[];
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

export function getNextOrder(options: NextOrderOptions = {}): Order {
  if (options.preferFirst) {
    return ORDERS.find((o) => o.recipeId === "margherita") ?? ORDERS[0];
  }

  const dex = options.dex ?? [];
  const undiscovered = ORDERS.filter((o) => !dex.includes(o.recipeId));
  const pool =
    undiscovered.length > 0
      ? avoidRepeat(undiscovered, options.excludeRecipeId)
      : avoidRepeat(ORDERS, options.excludeRecipeId);

  return pickRandom(pool);
}
