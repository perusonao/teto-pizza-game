export interface PlacedTopping {
  id: string;
  ingredientId: string;
  x: number;
  y: number;
}

export interface PizzaState {
  sauceIds: string[];
  toppings: PlacedTopping[];
  bakeResult: number | null;
}

export function createEmptyPizza(): PizzaState {
  return { sauceIds: [], toppings: [], bakeResult: null };
}
