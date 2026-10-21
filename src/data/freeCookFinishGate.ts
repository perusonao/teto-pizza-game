/**
 * FINISH FIN-E3a (Issue #604 / #294): the one gate for the Free Cooking FINISH step (Owner Decision UD-B = a permanent 仕上げ tab in
 * Free Cooking and Research; the production switch-on is a separate, later Owner decision, E5).
 *
 * Production is fixed OFF. The only other way ON is the Preview / DEV query opt-in (../preview/freeFinishPreview.ts), which a production
 * build compiles out. Nothing else reads a flag: `freeCookingProfile` (./cookingProfiles.ts) is the single consumer, and everything
 * downstream (`roundRunsFinish`, the reducer's CONFIRM_BAKE / CONFIRM_MAKING_STEP, the view helpers) keys off the resulting profile
 * carrying FINISH. With this OFF a Free Cooking round is byte-for-byte the round it was before E3a.
 */
import { freeFinishPreviewOptedIn } from "../preview/freeFinishPreview";

/** Production switch. Stays `false` until the Owner enables Free Cooking FINISH (E5, after the E4 data). */
export const FREE_COOK_FINISH_PRODUCTION = false;

export function freeCookFinishEnabled(): boolean {
  return FREE_COOK_FINISH_PRODUCTION || freeFinishPreviewOptedIn();
}
