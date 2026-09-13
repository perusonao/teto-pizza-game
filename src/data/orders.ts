export interface Order {
  id: string;
  recipeId: string;
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
}

export function getNextOrder(options: NextOrderOptions = {}): Order {
  if (options.preferFirst) {
    return ORDERS.find((o) => o.recipeId === "margherita") ?? ORDERS[0];
  }

  const candidates = options.excludeRecipeId
    ? ORDERS.filter((o) => o.recipeId !== options.excludeRecipeId)
    : ORDERS;
  const pool = candidates.length > 0 ? candidates : ORDERS;
  return pool[Math.floor(Math.random() * pool.length)];
}
