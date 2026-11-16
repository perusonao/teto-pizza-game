import { DOUGH_SHAPE_TARGET_IDS, getDoughShapeTarget, type DoughShapeTarget, type DoughShapeTargetId } from "../doughShapeTarget";
import { checkPanShapeCompatibility } from "./compatibility";
import { legacyPanFieldsFromProfile, panProfileIdFromLegacy, type LegacyPanFields } from "./legacyAdapter";
import { getPanProfile } from "./registry";
import { PAN_PROFILE_IDS, type PanProfile, type PanProfileId } from "./types";

export interface RecipePanRuntimeInput {
  readonly panProfileId?: unknown;
  readonly doughShapeTargetId?: unknown;
  readonly panShape?: unknown;
}

export interface LegacyPanRuntimeInput {
  readonly pan?: unknown;
}

export interface EffectivePanRuntime {
  readonly profile: PanProfile;
  readonly doughShapeTarget: DoughShapeTarget;
  readonly legacy: LegacyPanFields;
  readonly source: "recipe-profile" | "legacy";
}

export type EffectivePanRuntimeFailureReason =
  | "INVALID_RECIPE"
  | "INVALID_LEGACY_PAN"
  | "UNKNOWN_PROFILE"
  | "UNKNOWN_SHAPE_TARGET"
  | "INCOMPATIBLE_PAN_SHAPE"
  | "UNSUPPORTED_PROFILE";

export type EffectivePanRuntimeResult =
  | { readonly ok: true; readonly runtime: EffectivePanRuntime }
  | { readonly ok: false; readonly reason: EffectivePanRuntimeFailureReason; readonly detail: string };

const knownProfileIds = new Set<string>(PAN_PROFILE_IDS);
const knownShapeTargetIds = new Set<string>(DOUGH_SHAPE_TARGET_IDS);

const failure = (reason: EffectivePanRuntimeFailureReason, detail: string): EffectivePanRuntimeResult => ({ ok: false, reason, detail });

/**
 * Pure P2-2 compatibility adapter. It does not mutate Recipe/PizzaState and is
 * deliberately not imported by Production runtime.
 */
export function resolveEffectivePanRuntime(
  recipe: RecipePanRuntimeInput | null | undefined,
  legacyPan: LegacyPanRuntimeInput | null | undefined,
): EffectivePanRuntimeResult {
  if (recipe !== undefined && recipe !== null && (typeof recipe !== "object" || Array.isArray(recipe))) {
    return failure("INVALID_RECIPE", "recipe must be an object when provided");
  }

  const authoredProfileId = recipe?.panProfileId;
  if (authoredProfileId !== undefined) {
    if (typeof authoredProfileId !== "string" || !knownProfileIds.has(authoredProfileId)) {
      return failure("UNKNOWN_PROFILE", `unknown pan profile ${String(authoredProfileId)}`);
    }
    return resolveKnownProfile(authoredProfileId as PanProfileId, recipe?.doughShapeTargetId, "recipe-profile");
  }

  const pan = legacyPan?.pan;
  const panShape = recipe?.panShape;
  if (pan !== undefined && pan !== null && pan !== "round" && pan !== "tray") {
    return failure("INVALID_LEGACY_PAN", `unsupported legacy pan ${String(pan)}`);
  }
  if (panShape !== undefined && panShape !== null && panShape !== "round" && panShape !== "square") {
    return failure("INVALID_LEGACY_PAN", `unsupported legacy pan shape ${String(panShape)}`);
  }

  const profileId = panProfileIdFromLegacy(
    pan as "round" | "tray" | null | undefined,
    panShape as "round" | "square" | null | undefined,
  );
  const legacyTargetId = profileId === "tray" ? "square" : "round";
  return resolveKnownProfile(profileId, recipe?.doughShapeTargetId ?? legacyTargetId, "legacy");
}

function resolveKnownProfile(
  profileId: PanProfileId,
  authoredTargetId: unknown,
  source: EffectivePanRuntime["source"],
): EffectivePanRuntimeResult {
  const profile = getPanProfile(profileId);
  const targetId = authoredTargetId ?? profile.defaultDoughShapeTargetId;
  if (typeof targetId !== "string" || !knownShapeTargetIds.has(targetId)) {
    return failure("UNKNOWN_SHAPE_TARGET", `unknown dough shape target ${String(targetId)}`);
  }
  if (!checkPanShapeCompatibility(profileId, targetId as DoughShapeTargetId).compatible) {
    return failure("INCOMPATIBLE_PAN_SHAPE", `${targetId} is incompatible with ${profileId}`);
  }

  const legacy = legacyPanFieldsFromProfile(profileId);
  if (!legacy) {
    return failure("UNSUPPORTED_PROFILE", `${profileId} has no lossless legacy runtime representation`);
  }

  return {
    ok: true,
    runtime: {
      profile,
      doughShapeTarget: getDoughShapeTarget(targetId as DoughShapeTargetId),
      legacy,
      source,
    },
  };
}
