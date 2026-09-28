/**
 * Discovery Hint 5.0 (Issue #292), H5-2: the runtime switch for the Sub-topping Classification Ladder.
 *
 * **OFF in every build**, production included. With the flag off, the reducer behaves exactly as
 * before H5-2:
 * - PURCHASE_HINT5_RUNG is a no-op;
 * - the 材料 / 構成 / 特徴 sheet is unchanged.
 *
 * With the flag on (tests / DEV experiments only until H5-4), the H5-1 ladder authority
 * (./hint5Ladder.ts) serves every Hint 5.0 target, and the 材料 / 構成 / 特徴 purchases are
 * refused, so sub-topping names are never sold (OD-H5-C3). The flag decides no activation policy:
 * which targets production enables is OD-H5-M2 (19 first or all 25), and it is decided at H5-4.
 *
 * A single constant, so turning it on or rolling it back is a one-line change
 * (../../state/gameReducer.hint5.flagOff.test.ts pins the flag-off parity).
 */
export const HINT5_LADDER_ENABLED: boolean = false;
