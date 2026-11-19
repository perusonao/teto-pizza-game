/**
 * Issue #755 V3: the facade of the Steam Gameplay Lab V3 ("★評価・同時開き・3配置"), the same shape as ./steamGameLabRescue.ts for V2.
 * ./SteamGameLabV3.tsx reaches the pure V3 model (../logic/steam/steamGameV3.ts) only through this file, so the steam stays read only where it
 * is owned (../logic/steam/steam.architecture.test.ts). Re-exports only: no state, storage, reducer of the game, score or save.
 */
export {
  STEAM_V3_BATCHES,
  STEAM_V3_IDLE,
  STEAM_V3_LAYOUTS,
  steamV3LayoutForRound,
  steamV3Reducer,
  steamV3Snapshot,
  type SteamV3Advice,
  type SteamV3Batch,
  type SteamV3Heat,
  type SteamV3ResultShell,
  type SteamV3ShellStatus,
  type SteamV3Stars,
} from "../logic/steam/steamGameV3";
