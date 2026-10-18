/**
 * Square-Pan Dough D1-b (Issue #537, Epic #532): the square pan has no CUT step.
 *
 * CUT's geometry (slice lines, the evaluation, #429/#467) is the round pizza's; the Epic keeps a square round away from it
 * rather than widening that contract. The round's cooking profile is derived once, at the one place a round is built, so every
 * later reader (the step bar, `postBakeSteps`, `createCutState`) sees a profile that simply has no CUT.
 *
 * A round pan returns the profile it was given (same object), so every shipped recipe's profile is untouched.
 */
import type { CookingProfile } from "../../data/cookingProfiles";
import type { PanShape } from "./panShape";

export function cookingProfileForPan(profile: CookingProfile, pan: PanShape): CookingProfile {
  if (pan !== "square" || !profile.steps.includes("CUT")) return profile;
  const { cutConfig: _cutConfig, ...rest } = profile;
  return { ...rest, steps: profile.steps.filter((step) => step !== "CUT") };
}
