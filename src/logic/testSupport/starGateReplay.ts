/**
 * TEST-ONLY. Batch 6 PR-2 (#420, OD-420-1): goat-cheese (step 50) and spinach (step 51) need 120 / 130
 * cumulative Dex BEST stars. A simulated player who only ever earns ★1 can never meet that by discovering
 * alone -- like a real player, it has to REPLAY recipes for better stars. The walks simulate that replay
 * here (raise some discovered recipes to ★5 and re-resolve the entitlement the way REGISTER_TO_DEX does)
 * only once the star-gated step is reached, so every earlier stage of every walk is unchanged.
 */
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { resolveShopEntitlement } from "../../state/materialEntitlement";
import type { DexState } from "../../state/dex";
import { totalStars } from "../mastery";

const GATED_STEPS = DISCOVERY_LADDER.steps.filter((s) => s.starGates);
const MAX_GATE = Math.max(...GATED_STEPS.flatMap((s) => Object.values(s.starGates ?? {})));
const FIRST_GATED_STEP = Math.min(...GATED_STEPS.map((s) => s.step));

interface ShopState {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
}

/** Replays discovered recipes for stars until every production gate is met (once its step is reached). */
export function replayForGateStars<S extends ShopState>(state: S): S {
  const discovered = state.dex.filter((e) => e.discovered).length;
  if (discovered < FIRST_GATED_STEP || totalStars(state.dex) >= MAX_GATE) return state;
  let have = totalStars(state.dex);
  const dex = state.dex.map((e) => {
    if (!e.discovered || have >= MAX_GATE || e.bestStars >= 5) return e;
    have += 5 - e.bestStars;
    return { ...e, bestStars: 5 as typeof e.bestStars };
  });
  const entitlement = resolveShopEntitlement(dex, state.ownedIngredientIds, state.unlockedForShopIngredientIds);
  return { ...state, dex, unlockedForShopIngredientIds: entitlement.unlockedForShopIngredientIds };
}
