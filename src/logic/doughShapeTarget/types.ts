export const DOUGH_SHAPE_TARGET_IDS = ["round", "square", "rectangle", "oval", "boat"] as const;

export type DoughShapeTargetId = (typeof DOUGH_SHAPE_TARGET_IDS)[number];

export type DoughShapeFamily = "radial" | "quadrilateral" | "elongated";

/** Pure authoring data. Phase 1 deliberately has no scoring or PizzaState representation. */
export interface DoughShapeTarget {
  readonly id: DoughShapeTargetId;
  readonly family: DoughShapeFamily;
  readonly aspectRatio: readonly [min: number, max: number];
  readonly closed: boolean;
}
