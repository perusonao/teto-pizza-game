import type { PanProfileId } from "./types";

export type LegacyPanValue = "round" | "tray" | null | undefined;
export type LegacyPanShapeValue = "round" | "square" | null | undefined;

/** Read-only compatibility bridge; Phase 1 never writes the legacy fields. */
export function panProfileIdFromLegacy(pan: LegacyPanValue, panShape?: LegacyPanShapeValue): PanProfileId {
  if (pan === "tray" || panShape === "square") return "tray";
  return "legacy-round";
}

export function legacyPanFromProfile(profileId: PanProfileId): "round" | "tray" | null {
  if (profileId === "legacy-round") return "round";
  if (profileId === "tray") return "tray";
  return null;
}
