/**
 * DRIZZLE (Issue #579), D1: the one gate for the post-bake liquid drizzle. Production is fixed OFF; switching it on is a separate, explicit Owner approval
 * (and D2-D5 -- journal, stock, scoring / identity, UI -- are on HOLD, so there is nothing to switch on yet). D1 has NO Preview / DEV query opt-in: the
 * independent gesture lab (#746, `?drizzleLab=on`) is a different, unrelated mechanism and does not read this file.
 */

/** Production switch. Stays `false` until the Owner explicitly approves a production activation. */
export const DRIZZLE_EXPERIENCE_PRODUCTION = false;

export function drizzleExperienceEnabled(): boolean {
  return DRIZZLE_EXPERIENCE_PRODUCTION;
}
