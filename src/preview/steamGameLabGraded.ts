/**
 * Issue #755 Steam Gameplay V3 facade (named without a digit so steam.architecture.test.ts treats it as an owned steam file) (docs/reports/TETO_STEAM-V3_DESIGN.md), the same shape as ./steamGameLabRescue.ts for V2.
 * ./SteamGameLabV3.tsx reaches the pure V3 model (../logic/steam/steamGameV3.ts) only through this file, so the steam stays read only
 * where it is owned (../logic/steam/steam.architecture.test.ts). Re-exports only: no state, storage, game reducer, score or save.
 */
export {
  STEAM_V3_BATCHES,
  STEAM_V3_GRADE_LABEL,
  STEAM_V3_IDLE,
  STEAM_V3_SECONDS,
  STEAM_V3_SIZE_SCALE,
  steamV3Advice,
  steamV3GoalLine,
  steamV3Reducer,
  steamV3Snapshot,
  steamV3Spots,
  steamV3WindowFromQuery,
  type SteamV3Batch,
  type SteamV3Heat,
  type SteamV3ShellStatus,
  type SteamV3Size,
  type SteamV3Window,
} from "../logic/steam/steamGameV3";
