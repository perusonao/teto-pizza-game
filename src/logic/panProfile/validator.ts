import { DOUGH_SHAPE_TARGET_REGISTRY, type DoughShapeTargetId } from "../doughShapeTarget";
import { PAN_PROFILE_IDS, type PanProfile, type PanProfileId, type PanProfileValidationIssue } from "./types";

export type PanProfileRegistryInput = unknown;

const knownProfileIds = new Set<string>(PAN_PROFILE_IDS);
const knownVessels = new Set(["none", "sheet", "round-pan", "steel-pan"]);
const knownDepths = new Set(["none", "shallow", "deep"]);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function validatePanProfileRegistry(registry: PanProfileRegistryInput): readonly PanProfileValidationIssue[] {
  const issues: PanProfileValidationIssue[] = [];
  if (!isRecord(registry)) return [{ code: "INVALID_REGISTRY", profileId: "<registry>", detail: "registry must be an object" }];
  const seenIds = new Set<string>();

  for (const id of PAN_PROFILE_IDS) {
    if (!(id in registry)) issues.push({ code: "MISSING_PROFILE", profileId: id, detail: `registry is missing ${id}` });
  }

  for (const [key, value] of Object.entries(registry)) {
    if (!isRecord(value)) {
      issues.push({ code: "INVALID_FIELD", profileId: key, detail: "profile must be an object" });
      continue;
    }
    const profile = value;
    const hasValidId = typeof profile.id === "string";
    const id = hasValidId ? profile.id as string : key;
    if (!hasValidId) issues.push({ code: "INVALID_FIELD", profileId: key, detail: "id must be a string" });
    if (!knownProfileIds.has(key) || !knownProfileIds.has(id)) issues.push({ code: "UNKNOWN_PROFILE", profileId: id, detail: `unknown profile key/id ${key}/${id}` });
    if (seenIds.has(id)) issues.push({ code: "DUPLICATE_PROFILE_ID", profileId: id, detail: `profile id ${id} occurs more than once` });
    seenIds.add(id);
    if (key !== id) issues.push({ code: "ID_KEY_MISMATCH", profileId: id, detail: `key ${key} does not match id ${id}` });
    if (!knownVessels.has(String(profile.vessel)) || !knownDepths.has(String(profile.depth)) || typeof profile.directHeatContact !== "boolean") {
      issues.push({ code: "INVALID_FIELD", profileId: id, detail: "vessel, depth or directHeatContact is invalid" });
    }
    const compatible = Array.isArray(profile.compatibleDoughShapeTargetIds) ? profile.compatibleDoughShapeTargetIds : null;
    if (!compatible) {
      issues.push({ code: "INVALID_FIELD", profileId: id, detail: "compatibleDoughShapeTargetIds must be an array" });
      continue;
    }
    if (compatible.length === 0) issues.push({ code: "EMPTY_COMPATIBILITY", profileId: id, detail: "at least one shape target is required" });
    const shapes = new Set<DoughShapeTargetId>();
    for (const targetId of compatible) {
      if (typeof targetId !== "string") {
        issues.push({ code: "INVALID_FIELD", profileId: id, detail: "shape target ids must be strings" });
        continue;
      }
      if (shapes.has(targetId as DoughShapeTargetId)) issues.push({ code: "DUPLICATE_SHAPE_TARGET", profileId: id, detail: `${targetId} occurs more than once` });
      shapes.add(targetId as DoughShapeTargetId);
      if (!(targetId in DOUGH_SHAPE_TARGET_REGISTRY)) issues.push({ code: "UNKNOWN_SHAPE_TARGET", profileId: id, detail: `unknown target ${targetId}` });
    }
    const defaultId = profile.defaultDoughShapeTargetId;
    if (typeof defaultId !== "string" || !(defaultId in DOUGH_SHAPE_TARGET_REGISTRY)) issues.push({ code: "UNKNOWN_DEFAULT_SHAPE_TARGET", profileId: id, detail: `unknown default target ${String(defaultId)}` });
    if (typeof defaultId === "string" && !shapes.has(defaultId as DoughShapeTargetId)) issues.push({ code: "DEFAULT_NOT_COMPATIBLE", profileId: id, detail: `${defaultId} is not compatible` });
    if (profile.vessel === "none" && profile.depth !== "none") issues.push({ code: "INVALID_DEPTH", profileId: id, detail: `${profile.vessel} must have depth none` });
    if ((profile.vessel === "sheet" || profile.vessel === "round-pan" || profile.vessel === "steel-pan") && profile.depth === "none") issues.push({ code: "INVALID_DEPTH", profileId: id, detail: `${profile.vessel} must declare depth` });
  }
  return issues;
}

export function isValidPanProfileRegistry(registry: PanProfileRegistryInput): registry is Readonly<Record<PanProfileId, PanProfile>> {
  return validatePanProfileRegistry(registry).length === 0;
}
