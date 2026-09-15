import type { ReferencePieceGroup } from "../data/referencePizza";
import type { PlacedTopping } from "../state/pizzaState";

export interface ReferenceMatch {
  playerIndex: number;
  referenceIndex: number;
  distance: number;
  similarity: number;
}

export interface PieceReferenceMetrics {
  ingredientId: string;
  targetCount: number;
  playerCount: number;
  quantitySimilarity: number;
  placementSimilarity: number | null;
  matches: readonly ReferenceMatch[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function distanceSimilarity(distance: number, full: number, zero: number): number {
  if (!Number.isFinite(distance) || distance >= zero) return 0;
  if (distance <= full) return 1;
  return 1 - smoothstep((distance - full) / (zero - full));
}

/** Hungarian assignment for rows <= columns. Returns the selected column for each row. */
function minimumCostColumns(cost: readonly (readonly number[])[]): number[] {
  const rowCount = cost.length;
  if (rowCount === 0) return [];
  const columnCount = cost[0].length;
  const u = new Array<number>(rowCount + 1).fill(0);
  const v = new Array<number>(columnCount + 1).fill(0);
  const p = new Array<number>(columnCount + 1).fill(0);
  const way = new Array<number>(columnCount + 1).fill(0);

  for (let row = 1; row <= rowCount; row += 1) {
    p[0] = row;
    let column0 = 0;
    const minValue = new Array<number>(columnCount + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array<boolean>(columnCount + 1).fill(false);
    do {
      used[column0] = true;
      const row0 = p[column0];
      let delta = Number.POSITIVE_INFINITY;
      let column1 = 0;
      for (let column = 1; column <= columnCount; column += 1) {
        if (used[column]) continue;
        const current = cost[row0 - 1][column - 1] - u[row0] - v[column];
        if (current < minValue[column]) {
          minValue[column] = current;
          way[column] = column0;
        }
        if (minValue[column] < delta) {
          delta = minValue[column];
          column1 = column;
        }
      }
      for (let column = 0; column <= columnCount; column += 1) {
        if (used[column]) {
          u[p[column]] += delta;
          v[column] -= delta;
        } else {
          minValue[column] -= delta;
        }
      }
      column0 = column1;
    } while (p[column0] !== 0);

    do {
      const column1 = way[column0];
      p[column0] = p[column1];
      column0 = column1;
    } while (column0 !== 0);
  }

  const result = new Array<number>(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    if (p[column] > 0) result[p[column] - 1] = column - 1;
  }
  return result;
}

export function matchReferencePositions(
  player: readonly { x: number; y: number }[],
  reference: readonly { x: number; y: number }[],
  fullCreditRadius: number,
  zeroCreditRadius: number,
): ReferenceMatch[] {
  if (player.length === 0 || reference.length === 0) return [];
  const playerIsRows = player.length <= reference.length;
  const rows = playerIsRows ? player : reference;
  const columns = playerIsRows ? reference : player;
  const costs = rows.map((row) => columns.map((column) => Math.hypot(row.x - column.x, row.y - column.y)));
  const assigned = minimumCostColumns(costs);
  return assigned.map((columnIndex, rowIndex) => {
    const playerIndex = playerIsRows ? rowIndex : columnIndex;
    const referenceIndex = playerIsRows ? columnIndex : rowIndex;
    const distance = Math.hypot(
      player[playerIndex].x - reference[referenceIndex].x,
      player[playerIndex].y - reference[referenceIndex].y,
    );
    return {
      playerIndex,
      referenceIndex,
      distance,
      similarity: distanceSimilarity(distance, fullCreditRadius, zeroCreditRadius),
    };
  });
}

export function scorePieceGroup(
  toppings: readonly PlacedTopping[],
  group: ReferencePieceGroup,
): PieceReferenceMetrics {
  const player = toppings.filter((topping) => topping.ingredientId === group.ingredientId);
  const targetCount = group.positions.length;
  const playerCount = player.length;
  const quantitySimilarity =
    playerCount === 0
      ? 0
      : clamp01(1 - Math.abs(playerCount - targetCount) / (targetCount + 1));
  const matches = matchReferencePositions(
    player,
    group.positions,
    group.matching.fullCreditRadius,
    group.matching.zeroCreditRadius,
  );
  return {
    ingredientId: group.ingredientId,
    targetCount,
    playerCount,
    quantitySimilarity,
    placementSimilarity:
      matches.length === 0
        ? null
        : matches.reduce((sum, match) => sum + match.similarity, 0) / matches.length,
    matches,
  };
}

export function scorePieceGroups(
  toppings: readonly PlacedTopping[],
  groups: readonly ReferencePieceGroup[],
): PieceReferenceMetrics[] {
  return groups.map((group) => scorePieceGroup(toppings, group));
}
