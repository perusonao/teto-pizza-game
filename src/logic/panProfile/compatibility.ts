import type { DoughShapeTargetId } from "../doughShapeTarget";
import { getPanProfile } from "./registry";
import type { PanProfileId } from "./types";

export type PanShapeCompatibility =
  | { readonly compatible: true }
  | { readonly compatible: false; readonly reason: "SHAPE_NOT_SUPPORTED" };

/** The only Phase-1 relationship between the two independent registries. No inference in either direction. */
export function checkPanShapeCompatibility(profileId: PanProfileId, targetId: DoughShapeTargetId): PanShapeCompatibility {
  return getPanProfile(profileId).compatibleDoughShapeTargetIds.includes(targetId)
    ? { compatible: true }
    : { compatible: false, reason: "SHAPE_NOT_SUPPORTED" };
}
