/**
 * Cooking Fry Phase 1 (Issue #749): the one gate for the fry experience. Production is fixed OFF; switching it on is a separate, explicit Owner approval.
 * The only other way ON is the Preview / DEV query opt-in (../preview/fryPreview.ts), which a production build compiles out.
 */
import { fryPreviewOptedIn } from "../preview/fryPreview";

/** Production switch. Stays `false` until the Owner explicitly approves a production activation. */
export const FRY_EXPERIENCE_PRODUCTION = false;

export function fryExperienceEnabled(): boolean {
  return FRY_EXPERIENCE_PRODUCTION || fryPreviewOptedIn();
}
