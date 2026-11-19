import { useEffect, type Dispatch, type SetStateAction } from "react";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { createIdealDoughShape } from "../logic/doughShape";
import type { GameAction, GameState } from "../state/gameReducer";
import { COOK_STEAM_HV_CLAM_ID, cookSteamHvStage, setCookSteamHvStage } from "./cookSteamHv";

interface StarterProps {
  state: Pick<GameState, "phase" | "makingStep">;
  dispatch: Dispatch<GameAction>;
  setScreen: (screen: "GAME") => void;
  setSelectedIngredientId: Dispatch<SetStateAction<string | null>>;
}

const MOZZARELLA_GROUP = MARGHERITA_REFERENCE.pieceGroups[0];

/** Renders nothing. Walks DOUGH -> SAUCE -> CHEESE -> TOPPING once after `activateCookSteamHv` swapped the storage, then selects the clam. */
export function CookSteamHvStarter({ state, dispatch, setScreen, setSelectedIngredientId }: StarterProps) {
  useEffect(() => {
    if (cookSteamHvStage() !== "start") return;
    setCookSteamHvStage("select");
    dispatch({ type: "START_FREE_COOK", now: Date.now() });
    dispatch({ type: "COMMIT_DOUGH_STRETCH", shape: createIdealDoughShape() });
    dispatch({ type: "CONFIRM_MAKING_STEP", now: Date.now() }); // DOUGH -> SAUCE
    dispatch({ type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: buildIdealMargheritaSauceFixture() });
    dispatch({ type: "CONFIRM_MAKING_STEP", now: Date.now() }); // SAUCE -> CHEESE
    for (const p of MOZZARELLA_GROUP.positions) dispatch({ type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
    dispatch({ type: "CONFIRM_MAKING_STEP", now: Date.now() }); // CHEESE -> TOPPING
    setScreen("GAME");
  }, [dispatch, setScreen]);

  useEffect(() => {
    if (cookSteamHvStage() !== "select" || state.phase !== "PREPARE" || state.makingStep !== "TOPPING") return;
    // After the screen's own step-change effects, so the selection is not cleared by them.
    const timer = setTimeout(() => {
      setCookSteamHvStage("done");
      setSelectedIngredientId(COOK_STEAM_HV_CLAM_ID);
    }, 0);
    return () => clearTimeout(timer);
  }, [state.phase, state.makingStep, setSelectedIngredientId]);

  return null;
}
