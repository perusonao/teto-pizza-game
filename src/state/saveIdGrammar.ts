/**
 * The one id grammar the save trusts for data this build may not know (Progression 2.0 Phase 3-4B
 * forward-compat, ./persistence.ts; DM-4-2 Dinner mission records, ./dinnerMissionRecordsSave.ts):
 * lowercase kebab/snake, 1..64 chars -- what every catalog / mission id looks like. Kept in one place
 * so the two layers can never disagree about which ids are "well-formed".
 */
export const SAVE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
