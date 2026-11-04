import { useEffect, type Dispatch, type SetStateAction } from "react";
import { createIdealDoughShape } from "../logic/doughShape";
import type { GameAction, GameState } from "../state/gameReducer";
import { COOK_PREP_HV_BEEF_ID, cookPrepHvStage, setCookPrepHvStage } from "./cookPrepHv";

interface StarterProps {
  state: Pick<GameState, "phase" | "makingStep">;
  dispatch: Dispatch<GameAction>;
  setScreen: (screen: "GAME") => void;
  setSelectedIngredientId: Dispatch<SetStateAction<string | null>>;
}

/** Renders nothing. Walks the first TOPPING step once after `activateCookPrepHv` swapped the storage. */
export function CookPrepHvStarter({ state, dispatch, setScreen, setSelectedIngredientId }: StarterProps) {
  useEffect(() => {
    if (cookPrepHvStage() !== "start") return;
    setCookPrepHvStage("select");
    dispatch({ type: "START_FREE_COOK", now: Date.now() });
    dispatch({ type: "COMMIT_DOUGH_STRETCH", shape: createIdealDoughShape() });
    for (let i = 0; i < 3; i += 1) dispatch({ type: "CONFIRM_MAKING_STEP", now: Date.now() });
    setScreen("GAME");
  }, [dispatch, setScreen]);

  useEffect(() => {
    if (cookPrepHvStage() !== "select" || state.phase !== "PREPARE" || state.makingStep !== "TOPPING") return;
    // After the screen's own step-change effects, so the selection is not cleared by them.
    const timer = setTimeout(() => {
      setCookPrepHvStage("done");
      setSelectedIngredientId(COOK_PREP_HV_BEEF_ID);
    }, 0);
    return () => clearTimeout(timer);
  }, [state.phase, state.makingStep, setSelectedIngredientId]);

  return null;
}
