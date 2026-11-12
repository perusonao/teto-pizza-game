import type { DoughShapeTargetId } from "../doughShapeTarget";

export const PAN_PROFILE_IDS = ["legacy-round", "tray", "pan", "shallow-pan", "deep-pan", "steel-pan"] as const;

export type PanProfileId = (typeof PAN_PROFILE_IDS)[number];
export type PanVessel = "none" | "sheet" | "round-pan" | "steel-pan";
export type PanDepth = "none" | "shallow" | "deep";

/** Pure M-PAN authoring contract. It is intentionally not part of Recipe, PizzaState or persistence. */
export interface PanProfile {
  readonly id: PanProfileId;
  readonly vessel: PanVessel;
  readonly depth: PanDepth;
  readonly directHeatContact: boolean;
  readonly defaultDoughShapeTargetId: DoughShapeTargetId;
  readonly compatibleDoughShapeTargetIds: readonly DoughShapeTargetId[];
}

export type PanProfileValidationCode =
  | "DUPLICATE_PROFILE_ID"
  | "INVALID_REGISTRY"
  | "MISSING_PROFILE"
  | "UNKNOWN_PROFILE"
  | "ID_KEY_MISMATCH"
  | "INVALID_FIELD"
  | "EMPTY_COMPATIBILITY"
  | "DUPLICATE_SHAPE_TARGET"
  | "DEFAULT_NOT_COMPATIBLE"
  | "UNKNOWN_DEFAULT_SHAPE_TARGET"
  | "UNKNOWN_SHAPE_TARGET"
  | "INVALID_DEPTH";

export interface PanProfileValidationIssue {
  readonly code: PanProfileValidationCode;
  readonly profileId: string;
  readonly detail: string;
}
