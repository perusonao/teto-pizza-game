/**
 * Cooking Sear (Issue #724 Phase 1, Production ON: Issue #727): the one gate for the sear experience. Production was OFF in Phase 1 and is switched ON by the
 * separate, Owner-approved #727 (rollback = set the literal back to `false`; nothing the sear does is saved). The Preview / DEV query opt-in
 * (../preview/searPreview.ts, compiled out of a production build) stays for the Owner's comparison switches and the HV entry.
 */
import { searPreviewOptedIn } from "../preview/searPreview";

/** Production switch. ON since the Production ON phase (Issue #727, Owner approval 2026-11-02). Rollback = set it back to `false` (nothing the sear does is saved). */
export const SEAR_EXPERIENCE_PRODUCTION = true;

export function searExperienceEnabled(): boolean {
  return SEAR_EXPERIENCE_PRODUCTION || searPreviewOptedIn();
}
