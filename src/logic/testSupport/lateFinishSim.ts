/**
 * E5 (late catalog + FINISH ON in Production): the progression harnesses (hint5EconomySim / discoveryHintEconomySim / researchAttemptSim) bake
 * "the answer" of a recipe as one Free Cooking pizza. The late recipe's answer has post-bake ingredients that are placed in the FINISH step
 * (after the bake), exactly as a player does before pressing 完成. TEST SUPPORT ONLY.
 */
import { RECIPES } from "../../data/recipes";
import { gameReducer, type GameState } from "../../state/gameReducer";

/** The POST_BAKE ingredient ids of the recipe whose whole ingredient set is exactly `ids` (the harness' "answer"); `[]` for every other set. */
export function postBakeIdsOf(ids: readonly string[]): string[] {
  const want = [...new Set(ids)].sort().join("|");
  for (const recipe of RECIPES) {
    const all = [...new Set(recipe.requiredIngredients.map((q) => q.ingredientId))];
    if (all.sort().join("|") !== want) continue;
    return recipe.requiredIngredients
      .filter((q) => (q as { applicationPhase?: string }).applicationPhase === "POST_BAKE")
      .map((q) => q.ingredientId);
  }
  return [];
}

/**
 * Pinsa Romana (#577 P3-b): the harnesses bake "the answer" from an INGREDIENT SET, but a recipe is also its dough kind and its post-bake part, so two recipes can share
 * every ingredient (jamon-serrano-pizza / pinsa-romana). `answerVariantOf` is the one place that turns an answer into what a player does with it: which ingredients go
 * after the bake and which dough is chosen (the DOUGH chip, as `trayPanForIds` stands in for the ○/□ switch). With `recipeId` it is exactly that recipe's variant; without
 * it, the first recipe whose ingredient set matches (the previous behaviour, so every other caller is unchanged).
 */
export function answerVariantOf(ids: readonly string[], recipeId?: string): { post: string[]; dough?: "material-multigrain-long-ferment" } {
  const recipe = recipeId === undefined ? undefined : RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { post: postBakeIdsOf(ids) };
  const post = recipe.requiredIngredients.filter((q) => (q as { applicationPhase?: string }).applicationPhase === "POST_BAKE").map((q) => q.ingredientId);
  const dough = (recipe as { doughKind?: string }).doughKind;
  return dough === "material-multigrain-long-ferment" ? { post, dough } : { post };
}

/** Places `piecesOf(id)` pieces of each post-bake id in the FINISH step the round is waiting in (no-op for `post = []`). */
export function placeFinishPieces(state: GameState, post: readonly string[], piecesOf: (id: string) => number): GameState {
  let s = state;
  let n = 0;
  for (const ingredientId of post) {
    for (let i = 0; i < piecesOf(ingredientId); i += 1) {
      s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId, x: 25 + ((n * 9) % 50), y: 35 + ((n * 13) % 30) });
      n += 1;
    }
  }
  return s;
}
