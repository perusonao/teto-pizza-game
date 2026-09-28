/**
 * Cooking Techniques 1.0 TQ-1C (Issue #287): the order a DISCOVERED round reveals its news in.
 * SSOT P5: a technique found in the same round as a recipe is revealed first -- ① Technique,
 * ② Recipe. Pure; nothing renders it until TQ-1D adds the technique stage.
 */
import type { GameState } from "./gameReducer";

export type DiscoveryRevealStage = "TECHNIQUE" | "RECIPE";

export function discoveryRevealOrder(
  state: Pick<GameState, "lastTechniqueDiscovery" | "lastDiscovery" | "justDiscovered">,
): DiscoveryRevealStage[] {
  const stages: DiscoveryRevealStage[] = [];
  if ((state.lastTechniqueDiscovery?.length ?? 0) > 0) stages.push("TECHNIQUE");
  if (state.justDiscovered || state.lastDiscovery?.kind === "NEW_DISCOVERY") stages.push("RECIPE");
  return stages;
}
