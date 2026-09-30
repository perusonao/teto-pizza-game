/**
 * Large Catalog UX LC-R2 (pure, UNWIRED): the hand's capacity policy.
 *
 * LC-OD-4: the capacity is NOT fixed. 9 and 12 are both candidates and the Owner decides after a Human Feel
 * comparison (docs/reports/TETO_LARGE-CATALOG-UX_LC-R2_Working-Set-Foundation_Result.md). Until the pantry
 * (LC-R3..R5) exists, no production round may hide an OWNED ingredient behind a capacity, so enforcement is
 * OFF: `handCapacityFor` returns a capacity that always fits every owned ingredient of the category, which
 * makes `selectWorkingSet` inactive (= today's tray). It flips only together with R3..R5.
 */
export const HAND_CAPACITY_CANDIDATES = [9, 12] as const;
export type HandCapacityCandidate = (typeof HAND_CAPACITY_CANDIDATES)[number];

/** Runtime capacity enforcement. Must stay false until the pantry can reach every hidden ingredient. */
export const HAND_ENFORCEMENT_ENABLED = false;

export function isHandCapacityCandidate(value: unknown): value is HandCapacityCandidate {
  return HAND_CAPACITY_CANDIDATES.some((c) => c === value);
}

/** The capacity to hand to `selectWorkingSet`: the candidate when enforcement is on, otherwise "everything fits". */
export function handCapacityFor(ownedCountInCategory: number, candidate: HandCapacityCandidate): number {
  if (HAND_ENFORCEMENT_ENABLED) return candidate;
  const owned = Number.isFinite(ownedCountInCategory) ? Math.floor(ownedCountInCategory) : 0;
  return Math.max(1, owned);
}

/**
 * LC-R5-d: the capacity the dormant tray wiring hands to `resolveHand`. 12 is the DESIGN CANDIDATE only (OD-R5-1):
 * 9 vs 12 is decided at the R6 real-device Human Feel Gate. Nothing (UI copy, layout) may depend on this value, and
 * tests parametrize both candidates.
 */
export const DEFAULT_HAND_CAPACITY_CANDIDATE: HandCapacityCandidate = 12;
