/**
 * Discovery 3.0 PR-4b-A: test support for opening the Free Cooking hint sheet on a chosen target in a state with
 * SEVERAL DISCOVERABLE recipes (the "everything owned and stocked" fixtures of the hint suites, i.e. a migrated
 * save). Since PR-4b-A a Dex pin alone no longer picks a target when the pool is larger than one (D-1): only a
 * valid sticky target (already revealed, Dex-pinned earlier or paid for) is kept (D-3). These suites test hint
 * purchase / ladder behaviour on a target, not target selection, so they start from that sticky session.
 * TEST SUPPORT ONLY.
 */
import { gameReducer, type GameAction, type GameState } from "../gameReducer";

export function openHintSheetOn(initial: GameState, target: string): GameState {
  const started = gameReducer(initial, { type: "START_FREE_COOK" } as GameAction);
  const withSticky: GameState = { ...started, hintSession: { targetId: target, revealedIndex: 0, fromDex: true } };
  return gameReducer(withSticky, { type: "SHOW_HINT", pinnedRecipeId: target });
}
