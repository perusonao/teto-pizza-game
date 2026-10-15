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

const sameDeposits = (a: readonly SauceDeposit[], b: readonly SauceDeposit[]) => a.length === b.length && a.every((d, i) => d === b[i]);

/**
 * The committed runs, oldest (bottom) first. Stable for a given `pizza.sauceDeposits`, so callers can memoize it.
 *
 * `previous` (the runs this function returned for the log before the latest commit) keeps a commit cheap: the log is append-only, so
 * every run that did not change is returned as the SAME object (its `deposits` and `under` arrays included) and a canvas keyed on
 * them is not redrawn. Only the run a commit extended or added is rebuilt, so a commit costs one layer however many runs there are,
 * not one repaint per run. The result is equal in value with or without `previous`.
 */
export function sauceRunsOf(pizza: Pick<PizzaState, "sauceIds" | "sauceDeposits">, previous: readonly SauceLayer[] = []): SauceLayer[] {
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
  let earlierUnchanged = true; // every run below this one is the previous call's object, so its `under` is still right
  return runs.map((run, index) => {
    const before = previous[index];
    const reusable = earlierUnchanged && before !== undefined && before.ingredientId === run.ingredientId;
    let layer: SauceLayer;
    if (reusable && sameDeposits(before.deposits, run.deposits)) layer = before;
    else {
      earlierUnchanged = false;
      layer = { ingredientId: run.ingredientId, deposits: run.deposits, under: reusable ? before.under : [...earlier] };
    }
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

/**
 * Canvas budget (Codex P2 on PR #494): a pizza can hold up to 100 runs (the 200% cap at 0.02 per tick), and a canvas pair per run is
 * unbounded memory and repaint work. Only the newest `SAUCE_OWN_LAYERS` runs keep a canvas pair of their own; every older run is
 * flattened, in order, into at most `SAUCE_MERGED_GROUPS_MAX` shared groups, so a pizza never carries more than
 * 2 * (SAUCE_OWN_LAYERS + SAUCE_MERGED_GROUPS_MAX) sauce canvases, however many runs and however the sauces alternate.
 */
export const SAUCE_OWN_LAYERS = 8;
export const SAUCE_MERGED_GROUPS_MAX = 4;

/**
 * The budget of ONE cut piece (Codex P2 on PR #494): every piece draws its own copy of the sauce, so the pizza-wide bound is the piece
 * budget times the number of pieces. A cut pizza's sauce is final (nothing is being painted), so a piece flattens every run: no own
 * layers, and at most two groups (oil / other sauce). That is at most 4 canvases per piece, 32 for an eight-piece pizza.
 */
export const SAUCE_PIECE_OWN_LAYERS = 0;
export const SAUCE_PIECE_MERGED_GROUPS_MAX = 2;

export interface SauceCanvasBudget {
  /** how many of the newest runs keep a canvas pair of their own */
  readonly ownLayers: number;
  /** how many shared groups the older runs may use */
  readonly maxGroups: number;
}
export const SAUCE_PIZZA_BUDGET: SauceCanvasBudget = { ownLayers: SAUCE_OWN_LAYERS, maxGroups: SAUCE_MERGED_GROUPS_MAX };
export const SAUCE_PIECE_BUDGET: SauceCanvasBudget = { ownLayers: SAUCE_PIECE_OWN_LAYERS, maxGroups: SAUCE_PIECE_MERGED_GROUPS_MAX };

const isOil = (layer: SauceLayer) => layer.ingredientId === "olive-oil";

/** A stretch of consecutive OLD runs drawn on one shared canvas pair. Never contains the stroke in progress. */
export interface SauceMergedGroup {
  /** Index (in the full layer list) of the group's first run: a stable React key as newer runs age into later groups. */
  readonly firstIndex: number;
  readonly runs: readonly SauceLayer[];
  /** Every run is olive oil: the group's canvas carries the oil CSS treatment, exactly as an oil run's own canvas would. */
  readonly oil: boolean;
  /** Oil and other sauces share this group (the oldest runs of a pizza that alternates them more often than the budget allows):
   *  the group is a plain canvas and its oil runs have the oil colour look baked into their pixels. */
  readonly bakedOil: boolean;
}

export interface SauceLayerPlan {
  readonly merged: readonly SauceMergedGroup[];
  /** The newest runs, each with its own canvas pair, oldest first. */
  readonly own: readonly SauceLayer[];
  /** Index (in the full layer list) of `own[0]`. */
  readonly firstOwnIndex: number;
}

/**
 * Which runs get a canvas pair of their own and how the older ones are grouped. Pure; the groups cover the older runs exactly once, in
 * order, so a chronological stack of `merged` then `own` is the stack of all the layers. Olive oil carries its own CSS filter, so
 * consecutive runs are grouped by "oil or not"; if that alternation needs more than `budget.maxGroups` groups, the OLDEST
 * groups are folded into one plain group (their oil runs get the oil look baked in), which bounds the count for any history.
 * With `SAUCE_OWN_LAYERS` runs or fewer nothing is merged and every layer is drawn on its own, as before.
 */
export function planSauceLayers(layers: readonly SauceLayer[], budget: SauceCanvasBudget = SAUCE_PIZZA_BUDGET): SauceLayerPlan {
  const firstOwnIndex = Math.max(0, layers.length - budget.ownLayers);
  const older = layers.slice(0, firstOwnIndex);
  const own = layers.slice(firstOwnIndex);
  const segments: Array<{ firstIndex: number; runs: SauceLayer[] }> = [];
  older.forEach((layer, index) => {
    const last = segments[segments.length - 1];
    if (last && isOil(last.runs[0]) === isOil(layer)) last.runs.push(layer);
    else segments.push({ firstIndex: index, runs: [layer] });
  });
  const fold = Math.max(0, segments.length - budget.maxGroups + 1);
  const groups = fold > 1 ? [{ firstIndex: 0, runs: segments.slice(0, fold).flatMap((s) => s.runs) }, ...segments.slice(fold)] : segments;
  const merged = groups.map((group) => {
    const oilRuns = group.runs.filter(isOil).length;
    const mixed = oilRuns > 0 && oilRuns < group.runs.length;
    return { firstIndex: group.firstIndex, runs: group.runs, oil: oilRuns === group.runs.length, bakedOil: mixed };
  });
  return { merged, own, firstOwnIndex };
}
