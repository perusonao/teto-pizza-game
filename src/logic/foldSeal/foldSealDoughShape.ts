import { doughShapeRadiusAtAngle, type DoughShape } from "../doughShape";
import type { FoldSealGeometry } from "./foldSealGeometry";

/** Adapts the player's hand-stretched dough (8 control radii) to the machine's silhouette. Read-only use of an existing pure function. */
export function geometryFromDoughShape(shape: DoughShape): FoldSealGeometry {
  return { radiusAt: (angle) => doughShapeRadiusAtAngle(shape, angle) };
}
