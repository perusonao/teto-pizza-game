/**
 * Discovery Hint 4.0 (Issue #253): the 構成 / 特徴 switch and price.
 *
 * - DH4-2B introduced the E3 flag (OD-DH4-2-5): DEV / Preview only, with a provisional shared ESC
 *   rung as the price.
 * - DH4 Production Enablement (OD-DH4-PROD-1, Owner Decision 2026-09-28) turns it on in every
 *   build, production included, at a **fixed** price: 構成 5 Pitz, 特徴 5 Pitz. The price is not a
 *   rung of the 材料 ESC ladder (5 / 10 / 20 / 40), which stays unchanged and never counts a
 *   deduction purchase. Never 0 Pitz. DH4-ECON may re-tune it from real data later.
 *
 * The flag stays a single constant so a rollback is a one-line change
 * (./gameReducer.deductionHint.flagOff.test.ts pins the flag-off behavior).
 */
export const DEDUCTION_HINTS_ENABLED: boolean = true;

/** OD-DH4-PROD-1: the fixed price of one answered 構成 or 特徴 request. */
export const DEDUCTION_HINT_PRICE = { structure: 5, attribute: 5 } as const;
