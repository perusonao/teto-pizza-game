import { activeProgressionModel, type ProgressionInputs } from "../logic/progression/progressionModel";
import type { DinnerMenuMembership } from "../mission/dinner/dinnerMission";

/** Keep Dinner on the same menu as the rest of the shop, including Phase 3b's stage rule. */
export function dinnerMenuMembership(state: ProgressionInputs): DinnerMenuMembership | undefined {
  const progression = activeProgressionModel();
  return progression.id === "shop" ? (recipeId) => progression.isOnMenu(recipeId, state) : undefined;
}
