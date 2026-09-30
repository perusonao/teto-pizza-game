/**
 * Large Catalog UX LC-R2 (pure, UNWIRED): the hand's capacity policy.
 *
 * LC-OD-4: the capacity is NOT fixed. 9 and 12 are both candidates and the Owner decides after a Human Feel
 * comparison (docs/reports/TETO_LARGE-CATALOG-UX_LC-R2_Working-Set-Foundation_Result.md). Until the pantry
 * (LC-R3..R5) exists, no production round may hide an OWNED ingredient behind a capacity, so enforcement is
 * OFF: `handCapacityFor` returns a capacity that always fits every owned ingredient of the category, which
 * makes `selectWorkingSet` inactive (= today's tray). It flips only together with R3..R5.
 */
import { LC_HAND_PREVIEW_CAPACITY } from "../../preview/lcHandPreview";

export const HAND_CAPACITY_CANDIDATES = [9, 12] as const;
export type HandCapacityCandidate = (typeof HAND_CAPACITY_CANDIDATES)[number];

/**
 * PRODUCTION enforcement: the one production switch. Must stay false until the pantry can reach every hidden
 * ingredient (R6-e). Kept as a literal line on purpose: the hand-on Vitest projects (`vitest.config.ts`) rewrite it.
 */
export const HAND_ENFORCEMENT_PRODUCTION = false;

export function isHandCapacityCandidate(value: unknown): value is HandCapacityCandidate {
  return HAND_CAPACITY_CANDIDATES.some((c) => c === value);
}

/**
 * LC-R6-b (OD-R6a-1 = A2): the Preview-only variant. `import.meta.env.VITE_PREVIEW_MODE` is set only by the Preview
 * build pipeline; a production build folds it to `undefined`, so this is statically `null` there (and the variant
 * module is tree-shaken) even if a disposable HV commit put 9 / 12 in `LC_HAND_PREVIEW_CAPACITY`. A value that is not
 * a capacity candidate is treated as "no variant" (fail closed). No URL / storage / global reader exists.
 */
const previewVariant: HandCapacityCandidate | null = import.meta.env.VITE_PREVIEW_MODE
  ? isHandCapacityCandidate(LC_HAND_PREVIEW_CAPACITY)
    ? LC_HAND_PREVIEW_CAPACITY
    : null
  : null;

/** The Preview variant capacity in effect (`null` = none: production, and every normal Preview). Badge / tests only. */
export const HAND_PREVIEW_VARIANT: HandCapacityCandidate | null = previewVariant;

/** Runtime capacity enforcement: production's switch, or a Preview HV variant. */
export const HAND_ENFORCEMENT_ENABLED: boolean = HAND_ENFORCEMENT_PRODUCTION || previewVariant !== null;

/** The capacity to hand to `selectWorkingSet`: the candidate when enforcement is on, otherwise "everything fits". */
export function handCapacityFor(ownedCountInCategory: number, candidate: HandCapacityCandidate): number {
  if (HAND_ENFORCEMENT_ENABLED) return candidate;
  const owned = Number.isFinite(ownedCountInCategory) ? Math.floor(ownedCountInCategory) : 0;
  return Math.max(1, owned);
}

/**
 * LC-R5-d: the PRODUCTION capacity the tray wiring hands to `resolveHand`. 12 is the DESIGN CANDIDATE only (OD-R5-1):
 * 9 vs 12 is decided at the R6 real-device Human Feel Gate (R6-d / R6-e). Nothing (UI copy, layout) may depend on
 * this value, and tests parametrize both candidates. A literal line on purpose (the hand-on projects rewrite it).
 */
export const DEFAULT_HAND_CAPACITY_PRODUCTION: HandCapacityCandidate = 12;

/** The capacity the App hands to `resolveHand`: the Preview variant when one is in effect, else the production value. */
export const DEFAULT_HAND_CAPACITY_CANDIDATE: HandCapacityCandidate = previewVariant ?? DEFAULT_HAND_CAPACITY_PRODUCTION;
