import type { DoughShapeTarget, DoughShapeTargetId } from "./types";

export const DOUGH_SHAPE_TARGET_REGISTRY = {
  round: { id: "round", family: "radial", aspectRatio: [1, 1], closed: true },
  square: { id: "square", family: "quadrilateral", aspectRatio: [1, 1], closed: true },
  rectangle: { id: "rectangle", family: "quadrilateral", aspectRatio: [1.25, 2.5], closed: true },
  oval: { id: "oval", family: "elongated", aspectRatio: [1.25, 2.5], closed: true },
  boat: { id: "boat", family: "elongated", aspectRatio: [1.5, 3], closed: true },
} as const satisfies Record<DoughShapeTargetId, DoughShapeTarget>;

export function getDoughShapeTarget(id: DoughShapeTargetId): DoughShapeTarget {
  return DOUGH_SHAPE_TARGET_REGISTRY[id];
}
