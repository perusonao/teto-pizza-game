/**
 * Cooking Steps 2.0 FINISH D2-0 (Issue #294): the Mito hint line for the FINISH step. Separate from `buildHintLine`
 * (which the reducer keeps calling, unchanged) and not yet wired: the reducer still leaves the previous hint in place
 * in FINISH (gameReducer.ts, "FINISH has no hint yet"). Names a late ingredient only for a Guided recipe that itself
 * requires it after the bake -- the same recipe-named level of help the other steps give -- and never for Free Cooking.
 */
import { postBakePieces } from "../state/finishEngine";
import type { PizzaState } from "../state/pizzaState";
import type { DialogueLine } from "./dialogue";
import { isFreeCookRecipe } from "./freeCook";
import { getIngredient } from "./ingredients";
import type { Recipe } from "./recipes";

const FREE_COOK_FINISH_HINT = { text: "仕上げに好きな具をのせよう（なしでもOK）", explicit: "仕上げは好きな具をのせられるよ。のせずに「次へ」でもOK！" };
const READY_FINISH_HINT = "仕上がり！「次へ」で完成しよう。";
const NO_LATE_FINISH_HINT = "仕上げはなくてもOK。「次へ」で進もう。";

export function buildFinishHintLine(recipe: Recipe, pizza: Pick<PizzaState, "toppings">, isExplicitHint = false): DialogueLine {
  if (isFreeCookRecipe(recipe)) {
    return {
      speaker: "mito",
      id: "hint.finish.free-cook",
      textJa: isExplicitHint ? FREE_COOK_FINISH_HINT.explicit : FREE_COOK_FINISH_HINT.text,
    };
  }

  const late = recipe.requiredIngredients.filter((req) => req.applicationPhase === "POST_BAKE");
  const placed = postBakePieces(pizza);
  for (const req of late) {
    const have = placed.filter((piece) => piece.ingredientId === req.ingredientId).length;
    if (have >= req.minCount) continue;
    const name = getIngredient(req.ingredientId)?.nameJa ?? "材料";
    return {
      speaker: "mito",
      id: `hint.finish.${recipe.id}`,
      textJa: isExplicitHint ? `${name}をあと${req.minCount - have}個、仕上げにのせてね。` : `${name}を仕上げにのせよう！`,
    };
  }
  return { speaker: "mito", id: `hint.finish.${recipe.id}`, textJa: late.length > 0 ? READY_FINISH_HINT : NO_LATE_FINISH_HINT };
}
