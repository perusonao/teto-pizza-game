import type { PanProfileId } from "./types";

export type LegacyPanValue = "round" | "tray" | null | undefined;
export type LegacyPanShapeValue = "round" | "square" | null | undefined;

/** Read-only compatibility bridge; Phase 1 never writes the legacy fields. */
export function panProfileIdFromLegacy(pan: LegacyPanValue, panShape?: LegacyPanShapeValue): PanProfileId {
  if (pan === "tray" || panShape === "square") return "tray";
  return "legacy-round";
}

export interface LegacyPanFields {
  readonly pan: "tray" | null;
  readonly panShape: "round" | "square";
}

export function legacyPanFieldsFromProfile(profileId: PanProfileId): LegacyPanFields | null {
  if (profileId === "legacy-round") return { pan: null, panShape: "round" };
  if (profileId === "tray") return { pan: "tray", panShape: "square" };
  return null;
}
