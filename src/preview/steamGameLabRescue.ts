/**
 * Issue #755 / PR #757: the V2 ("5個の貝を見て取り出す") facade of the Steam Gameplay Lab, the same shape as ./steamGameLab.ts for V1.
 * ./SteamGameLabV2.tsx reaches the pure V2 model (../logic/steam/steamGameV2.ts) only through this file, so the steam stays read only where it
 * is owned (../logic/steam/steam.architecture.test.ts). Re-exports only: no state, storage, reducer of the game, score or save.
 */
export {
  STEAM_V2_BATCHES,
  STEAM_V2_IDLE,
  steamV2Reducer,
  steamV2Snapshot,
  type SteamV2Batch,
  type SteamV2Heat,
  type SteamV2ShellStatus,
} from "../logic/steam/steamGameV2";
