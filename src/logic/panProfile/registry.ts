import type { PanProfile, PanProfileId } from "./types";

export const PAN_PROFILE_REGISTRY = {
  "legacy-round": {
    id: "legacy-round", vessel: "none", depth: "none", directHeatContact: true,
    defaultDoughShapeTargetId: "round", compatibleDoughShapeTargetIds: ["round", "oval"],
  },
  tray: {
    id: "tray", vessel: "sheet", depth: "shallow", directHeatContact: true,
    defaultDoughShapeTargetId: "square", compatibleDoughShapeTargetIds: ["square", "rectangle"],
  },
  pan: {
    id: "pan", vessel: "round-pan", depth: "shallow", directHeatContact: true,
    defaultDoughShapeTargetId: "round", compatibleDoughShapeTargetIds: ["round", "square"],
  },
  "shallow-pan": {
    id: "shallow-pan", vessel: "round-pan", depth: "shallow", directHeatContact: true,
    defaultDoughShapeTargetId: "round", compatibleDoughShapeTargetIds: ["round"],
  },
  "deep-pan": {
    id: "deep-pan", vessel: "round-pan", depth: "deep", directHeatContact: true,
    defaultDoughShapeTargetId: "round", compatibleDoughShapeTargetIds: ["round"],
  },
  "steel-pan": {
    id: "steel-pan", vessel: "steel-pan", depth: "shallow", directHeatContact: true,
    defaultDoughShapeTargetId: "square", compatibleDoughShapeTargetIds: ["square", "rectangle"],
  },
} as const satisfies Record<PanProfileId, PanProfile>;

export function getPanProfile(id: PanProfileId): PanProfile {
  return PAN_PROFILE_REGISTRY[id];
}
