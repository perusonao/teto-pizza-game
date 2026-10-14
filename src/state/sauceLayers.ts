import { sanitizeStringArray } from "../logic/scoringV2/boundary";
import type { PizzaState, SauceDeposit } from "./pizzaState";
import { ownerOf } from "./sauceLedger";

/**
 * Sauce B2 (layered painting): which deposits each sauce kind laid, in the order the layers are painted -- pure, read-only,
 * rendering input only (never read by scoring, inventory or Research).
 *
 * `null` means "draw it the way it has always been drawn": fewer than two sauce kinds have laid any deposit, committed or
 * in progress, so PizzaStage keeps its single heatmap exactly as before (one-sauce pizzas never take the layered path).
 */
export interface SauceLayer {
  readonly ingredientId: string;
  readonly deposits: readonly SauceDeposit[];
}

/**
 * Layers in first-use order (the first sauce laid is the bottom layer; a sauce laid later sits on top). `pending` is the
 * stroke in progress; it belongs to `pendingIngredientId` and joins that kind's layer (a new kind goes on top). A deposit's
 * kind is its own `ingredientId` stamp, else the only sauce recorded before a second kind appeared (see `ownerOf`).
 * A kind that has laid nothing (e.g. a one-shot sauce) has no layer.
 */
export function sauceLayersOf(
  pizza: Pick<PizzaState, "sauceIds" | "sauceDeposits">,
  pending: readonly SauceDeposit[],
  pendingIngredientId: string | null,
): SauceLayer[] | null {
  const ids = sanitizeStringArray(pizza.sauceIds);
  const byKind = new Map<string, SauceDeposit[]>();
  for (const id of ids) byKind.set(id, []);
  for (const deposit of pizza.sauceDeposits) {
    const owner = ownerOf(deposit, ids);
    if (owner === "") continue;
    const list = byKind.get(owner);
    if (list) list.push(deposit);
    else byKind.set(owner, [deposit]);
  }
  if (pending.length > 0 && pendingIngredientId) {
    const list = byKind.get(pendingIngredientId);
    if (list) list.push(...pending);
    else byKind.set(pendingIngredientId, [...pending]);
  }
  const layers = [...byKind.entries()]
    .filter(([, deposits]) => deposits.length > 0)
    .map(([ingredientId, deposits]) => ({ ingredientId, deposits }));
  return layers.length >= 2 ? layers : null;
}
