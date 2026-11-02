/**
 * Cooking Sear Phase 1 (Issue #724): the one gate for the sear experience. Production is fixed OFF; switching it on is a separate, explicit Owner
 * approval. The only other way ON is the Preview / DEV query opt-in (../preview/searPreview.ts), which a production build compiles out.
 */
import { searPreviewOptedIn } from "../preview/searPreview";

/** Production switch. Stays `false` until the Owner explicitly approves a production activation. */
export const SEAR_EXPERIENCE_PRODUCTION = false;

export function searExperienceEnabled(): boolean {
  return SEAR_EXPERIENCE_PRODUCTION || searPreviewOptedIn();
}
