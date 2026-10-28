/**
 * Cooking Prep Phase 1 (下ごしらえ「炒める」), PR-A S2: the one gate for the prep experience (spec §8.4, §16.3).
 *
 * Production is fixed OFF. Switching it on is a separate, explicit Owner approval (never implied by HV PASS, green CI or a merge). The only
 * other way ON is the Preview / DEV query opt-in (../preview/prepPreview.ts), which a production build compiles out.
 * The reducer's `PREP_INGREDIENT` consults `prepExperienceEnabled`, so with this OFF the state is byte-for-byte what it was before.
 */
import { prepPreviewOptedIn } from "../preview/prepPreview";

/** Production switch. Stays `false` until the Owner explicitly approves the production activation. */
export const PREP_EXPERIENCE_PRODUCTION = false;

export function prepExperienceEnabled(): boolean {
  return PREP_EXPERIENCE_PRODUCTION || prepPreviewOptedIn();
}
