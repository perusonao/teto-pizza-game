/**
 * Cooking Steps 2.0 FINISH D2-0 (Issue #294): which look a placed piece gets relative to the bake. A piece placed
 * before the bake (`stage` absent / `"pre"`, every piece the game places today) is baked with the pizza; a piece
 * placed in FINISH (`stage === "post"`) went on after the oven and keeps its fresh look. Pure and not yet read by
 * `PizzaStage` (D2-1), so rendering is unchanged.
 */
import { isPostBakePiece, type PlacedTopping } from "./pizzaState";

export type PieceBakeClass = "PRE_BAKE" | "POST_BAKE";

type StagedPiece = Pick<PlacedTopping, "stage">;

export function pieceBakeClass(piece: StagedPiece): PieceBakeClass {
  return isPostBakePiece(piece) ? "POST_BAKE" : "PRE_BAKE";
}

/** Splits pieces by bake class, each side keeping placement order. */
export function partitionPiecesByBakeClass<T extends StagedPiece>(pieces: readonly T[]): { preBake: T[]; postBake: T[] } {
  const preBake: T[] = [];
  const postBake: T[] = [];
  for (const piece of pieces) (isPostBakePiece(piece) ? postBake : preBake).push(piece);
  return { preBake, postBake };
}

/**
 * The bake progress a piece is drawn with (`null` = no bake-derived styling, the same value PREPARE uses). A
 * pre-bake piece takes the pizza's value unchanged; a post-bake piece is never tinted by the bake.
 */
export function bakeProgressForPiece(piece: StagedPiece, pizzaBakeProgress: number | null): number | null {
  return isPostBakePiece(piece) ? null : pizzaBakeProgress;
}
