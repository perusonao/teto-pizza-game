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
];

export function getNextOrder(): Order {
  return ORDERS[0];
}
