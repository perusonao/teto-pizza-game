import { sanitizeStringArray } from "../logic/scoringV2/boundary";
import type { PizzaState, SauceDeposit } from "./pizzaState";
import { ownerOf } from "./sauceLedger";

/**
 * Sauce B2 (layered painting): which deposits each sauce laid, in the order the layers are painted -- pure, read-only,
 * rendering input only (never read by scoring, inventory or Research).
 *
 * Owner Decision on PR #494: a layer is a chronological RUN -- a maximal stretch of consecutive deposits laid by the same sauce
 * kind -- and later runs are painted over earlier ones. `sauceDeposits` is append-only and already in the order the strokes were
 * committed, so the runs are read straight off it; nothing is stored or persisted. Tomato, then pesto, then tomato again is three
 * layers, the last on top: what was painted after a switch always shows over what was painted before it, whatever its kind.
 * (Consecutive strokes of one kind share a colour, so splitting them would change nothing visible.)
 *
 * `null` means "draw it the way it has always been drawn": fewer than two sauce kinds have laid any deposit, committed or
 * in progress, so PizzaStage keeps its single heatmap exactly as before (one-sauce pizzas never take the layered path).
 */
export interface SauceLayer {
  readonly ingredientId: string;
  readonly deposits: readonly SauceDeposit[];
  /** Every deposit of the layers BELOW this one (any kind), oldest first; empty for the bottom layer. Render-only: it lets the canvas
   *  dim this layer's opacity where it overlaps earlier sauce (Owner Decision on PR #494) -- never read by scoring or the ledger. */
  readonly under: readonly SauceDeposit[];
}

/** The committed runs, oldest (bottom) first. Stable for a given `pizza.sauceDeposits`, so callers can memoize it. */
export function sauceRunsOf(pizza: Pick<PizzaState, "sauceIds" | "sauceDeposits">): SauceLayer[] {
  const ids = sanitizeStringArray(pizza.sauceIds);
  const runs: Array<{ ingredientId: string; deposits: SauceDeposit[] }> = [];
  for (const deposit of pizza.sauceDeposits) {
    const owner = ownerOf(deposit, ids);
    if (owner === "") continue;
    const last = runs[runs.length - 1];
    if (last && last.ingredientId === owner) last.deposits.push(deposit);
    else runs.push({ ingredientId: owner, deposits: [deposit] });
  }
  const earlier: SauceDeposit[] = [];
  return runs.map((run) => {
    const layer: SauceLayer = { ingredientId: run.ingredientId, deposits: run.deposits, under: [...earlier] };
    earlier.push(...run.deposits);
    return layer;
  });
}

/**
 * The runs plus the stroke in progress. `pending` belongs to `pendingIngredientId`: it extends the top run when that is the same
 * kind, otherwise it becomes a new top run (with every committed deposit under it). Earlier runs are returned as the same objects
 * (only the top one is rebuilt), so a canvas keyed on a run's `deposits` / `under` is not redrawn while a later stroke is being
 * painted. `null` when fewer than two kinds.
 */
export function layersWithPending(
  runs: readonly SauceLayer[],
  pending: readonly SauceDeposit[],
  pendingIngredientId: string | null,
): SauceLayer[] | null {
  let layers: SauceLayer[] = [...runs];
  if (pending.length > 0 && pendingIngredientId) {
    const last = layers[layers.length - 1];
    if (last && last.ingredientId === pendingIngredientId) {
      layers = [...layers.slice(0, -1), { ingredientId: last.ingredientId, deposits: [...last.deposits, ...pending], under: last.under }];
    } else {
      layers = [...layers, { ingredientId: pendingIngredientId, deposits: [...pending], under: layers.flatMap((l) => l.deposits) }];
    }
  }
  return new Set(layers.map((l) => l.ingredientId)).size >= 2 ? layers : null;
}

export function sauceLayersOf(
  pizza: Pick<PizzaState, "sauceIds" | "sauceDeposits">,
  pending: readonly SauceDeposit[],
  pendingIngredientId: string | null,
): SauceLayer[] | null {
  return layersWithPending(sauceRunsOf(pizza), pending, pendingIngredientId);
}
