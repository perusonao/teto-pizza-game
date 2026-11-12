import { DOUGH_SHAPE_TARGET_REGISTRY, type DoughShapeTargetId } from "../doughShapeTarget";
import { PAN_PROFILE_IDS, type PanProfile, type PanProfileId, type PanProfileValidationIssue } from "./types";

export type PanProfileRegistryInput = Readonly<Record<string, PanProfile>>;

export function validatePanProfileRegistry(registry: PanProfileRegistryInput): readonly PanProfileValidationIssue[] {
  const issues: PanProfileValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (const id of PAN_PROFILE_IDS) {
    if (!(id in registry)) issues.push({ code: "MISSING_PROFILE", profileId: id, detail: `registry is missing ${id}` });
  }

  for (const [key, profile] of Object.entries(registry)) {
    if (seenIds.has(profile.id)) issues.push({ code: "DUPLICATE_PROFILE_ID", profileId: profile.id, detail: `profile id ${profile.id} occurs more than once` });
    seenIds.add(profile.id);
    if (key !== profile.id) issues.push({ code: "ID_KEY_MISMATCH", profileId: profile.id, detail: `key ${key} does not match id ${profile.id}` });
    if (profile.compatibleDoughShapeTargetIds.length === 0) issues.push({ code: "EMPTY_COMPATIBILITY", profileId: profile.id, detail: "at least one shape target is required" });
    const shapes = new Set<DoughShapeTargetId>();
    for (const targetId of profile.compatibleDoughShapeTargetIds) {
      if (shapes.has(targetId)) issues.push({ code: "DUPLICATE_SHAPE_TARGET", profileId: profile.id, detail: `${targetId} occurs more than once` });
      shapes.add(targetId);
      if (!(targetId in DOUGH_SHAPE_TARGET_REGISTRY)) issues.push({ code: "UNKNOWN_SHAPE_TARGET", profileId: profile.id, detail: `unknown target ${targetId}` });
    }
    if (!shapes.has(profile.defaultDoughShapeTargetId)) issues.push({ code: "DEFAULT_NOT_COMPATIBLE", profileId: profile.id, detail: `${profile.defaultDoughShapeTargetId} is not compatible` });
    if ((profile.vessel === "none" || profile.vessel === "griddle") && profile.depth !== "none") issues.push({ code: "INVALID_DEPTH", profileId: profile.id, detail: `${profile.vessel} must have depth none` });
    if ((profile.vessel === "sheet" || profile.vessel === "round-pan") && profile.depth === "none") issues.push({ code: "INVALID_DEPTH", profileId: profile.id, detail: `${profile.vessel} must declare depth` });
  }
  return issues;
}

export function isValidPanProfileRegistry(registry: PanProfileRegistryInput): registry is Readonly<Record<PanProfileId, PanProfile>> {
  return validatePanProfileRegistry(registry).length === 0;
}
