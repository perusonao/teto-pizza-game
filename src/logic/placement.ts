import { isInsideDough } from "./pizzaCoordinates";
import { MIN_TOPPING_DISTANCE, type PlacedTopping } from "../state/pizzaState";

/**
 * Placement quality, on the same 0-100 scale as the other ScoreBreakdown metrics
 * (scoring.ts applies its own weight on top of this). Deliberately forgiving: the goal
 * from the SSOT is "placing toppings a little more thoughtfully reads as a little better
 * pizza", not a pixel-perfect target game. See docs/design/PIZZA_GAME_PROGRESSION_SSOT.md
 * section 4 for the overall Quality formula this feeds into.
 */
export const PLACEMENT_CONTAINMENT_WEIGHT = 50;
export const PLACEMENT_DISTRIBUTION_WEIGHT = 50;

/** Average pairwise distance (dough-percent units) at or below which a set of toppings
 *  reads as one clustered blob rather than spread across the pizza. Anchored to the same
 *  minimum spacing already enforced at placement time (`findOpenSpot`), so merely obeying
 *  that anti-overlap rule isn't by itself enough to read as "spread out". */
const CLUSTER_DISTANCE = MIN_TOPPING_DISTANCE;

/** Average pairwise distance at or above which placement earns full distribution credit. */
const SPREAD_DISTANCE = 30;

/** Distribution score never drops below this floor, even for pathological clustering —
 *  placement is meant to nudge quality up a little, not tank a round on its own. */
const DISTRIBUTION_FLOOR = 20;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function averagePairwiseDistance(points: readonly { x: number; y: number }[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      sum += Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Scores how well `toppings` are placed on the pizza, 0-100. Only ever looks at
 * scatter-placed items (cheese + toppings both land in PizzaState.toppings; sauces are
 * "spread" and never appear here, so they're naturally outside this metric's scope).
 *
 * A recipe with no scatter-placed ingredients at all (or a pizza with none placed yet)
 * is never structurally penalized: it scores full marks rather than 0, so recipes without
 * placeable toppings — and single-topping recipes — can still reach a perfect Quality score.
 */
export function scorePlacement(toppings: readonly PlacedTopping[]): number {
  if (toppings.length === 0) return 100;

  const insideCount = toppings.filter((t) => isInsideDough(t.x, t.y)).length;
  const containmentScore = (insideCount / toppings.length) * PLACEMENT_CONTAINMENT_WEIGHT;

  // A single topping can't be "clustered" against anything else, so it trivially earns
  // full distribution credit — this is what keeps single-topping recipes able to hit 100.
  let distributionScore = PLACEMENT_DISTRIBUTION_WEIGHT;
  if (toppings.length >= 2) {
    const avgDistance = averagePairwiseDistance(toppings);
    const ratio = clamp01((avgDistance - CLUSTER_DISTANCE) / (SPREAD_DISTANCE - CLUSTER_DISTANCE));
    distributionScore =
      DISTRIBUTION_FLOOR + (PLACEMENT_DISTRIBUTION_WEIGHT - DISTRIBUTION_FLOOR) * ratio;
  }

  return containmentScore + distributionScore;
}
