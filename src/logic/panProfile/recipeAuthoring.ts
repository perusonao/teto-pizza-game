import { DOUGH_SHAPE_TARGET_IDS, type DoughShapeTargetId } from "../doughShapeTarget";
import { checkPanShapeCompatibility } from "./compatibility";
import { PAN_PROFILE_IDS, type PanProfileId } from "./types";

export type RecipePanAuthoringValidationCode =
  | "INVALID_RECIPE"
  | "INVALID_PAN_PROFILE_ID"
  | "UNKNOWN_PAN_PROFILE"
  | "INVALID_DOUGH_SHAPE_TARGET_ID"
  | "UNKNOWN_DOUGH_SHAPE_TARGET"
  | "INCOMPATIBLE_PAN_SHAPE";

export interface RecipePanAuthoringValidationIssue {
  readonly code: RecipePanAuthoringValidationCode;
  readonly field: "recipe" | "panProfileId" | "doughShapeTargetId";
  readonly detail: string;
}

const knownPanProfileIds = new Set<string>(PAN_PROFILE_IDS);
const knownDoughShapeTargetIds = new Set<string>(DOUGH_SHAPE_TARGET_IDS);

/**
 * Validates only PAN_PROFILE P2 authoring metadata. Both fields are optional so
 * every pre-P2 recipe remains valid and behaviorally unchanged.
 */
export function validateRecipePanAuthoring(recipe: unknown): readonly RecipePanAuthoringValidationIssue[] {
  if (typeof recipe !== "object" || recipe === null || Array.isArray(recipe)) {
    return [{ code: "INVALID_RECIPE", field: "recipe", detail: "recipe must be an object" }];
  }

  const value = recipe as Record<string, unknown>;
  const issues: RecipePanAuthoringValidationIssue[] = [];
  const panProfileId = value.panProfileId;
  const doughShapeTargetId = value.doughShapeTargetId;
  let knownPanProfileId: PanProfileId | undefined;
  let knownDoughShapeTargetId: DoughShapeTargetId | undefined;

  if (panProfileId !== undefined) {
    if (typeof panProfileId !== "string") {
      issues.push({ code: "INVALID_PAN_PROFILE_ID", field: "panProfileId", detail: "panProfileId must be a string" });
    } else if (!knownPanProfileIds.has(panProfileId)) {
      issues.push({ code: "UNKNOWN_PAN_PROFILE", field: "panProfileId", detail: `unknown pan profile ${panProfileId}` });
    } else {
      knownPanProfileId = panProfileId as PanProfileId;
    }
  }

  if (doughShapeTargetId !== undefined) {
    if (typeof doughShapeTargetId !== "string") {
      issues.push({ code: "INVALID_DOUGH_SHAPE_TARGET_ID", field: "doughShapeTargetId", detail: "doughShapeTargetId must be a string" });
    } else if (!knownDoughShapeTargetIds.has(doughShapeTargetId)) {
      issues.push({ code: "UNKNOWN_DOUGH_SHAPE_TARGET", field: "doughShapeTargetId", detail: `unknown dough shape target ${doughShapeTargetId}` });
    } else {
      knownDoughShapeTargetId = doughShapeTargetId as DoughShapeTargetId;
    }
  }

  if (knownPanProfileId && knownDoughShapeTargetId) {
    const compatibility = checkPanShapeCompatibility(knownPanProfileId, knownDoughShapeTargetId);
    if (!compatibility.compatible) {
      issues.push({
        code: "INCOMPATIBLE_PAN_SHAPE",
        field: "doughShapeTargetId",
        detail: compatibility.reason ?? `${knownDoughShapeTargetId} is incompatible with ${knownPanProfileId}`,
      });
    }
  }

  return issues;
}

export function isValidRecipePanAuthoring(recipe: unknown): boolean {
  return validateRecipePanAuthoring(recipe).length === 0;
}
