/**
 * Cooking Steam Phase 1 (Issue #726): the one gate for the steam experience. Production is fixed OFF; switching it on is a separate, explicit Owner
 * approval. The only other way ON is the Preview / DEV query opt-in (../preview/steamPreview.ts), which a production build compiles out.
 */
import { steamPreviewOptedIn } from "../preview/steamPreview";

/** Production switch. Stays `false` until the Owner explicitly approves a production activation. */
export const STEAM_EXPERIENCE_PRODUCTION = false;

export function steamExperienceEnabled(): boolean {
  return STEAM_EXPERIENCE_PRODUCTION || steamPreviewOptedIn();
}
