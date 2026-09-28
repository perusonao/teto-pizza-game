/**
 * Discovery Hint 5.0 (Issue #292), H5-2 / H5-3: the runtime switch for the Sub-topping Classification
 * Ladder.
 *
 * **OFF by default in every build, production included.** With the flag off, the reducer and the
 * hint sheet behave exactly as before H5-2:
 * - PURCHASE_HINT5_RUNG is a no-op;
 * - the 材料 / 構成 / 特徴 sheet is unchanged.
 *
 * With the flag on (unit tests, and DEV-only experiments until H5-4), the H5-1 ladder authority
 * (./hint5Ladder.ts) serves every Hint 5.0 target and the sheet renders the ladder. The 材料 / 構成 /
 * 特徴 purchases are then refused, so sub-topping names are never sold (OD-H5-C3). The flag decides
 * no activation policy: which targets production enables is OD-H5-M2, decided at H5-4.
 *
 * **DEV-only opt-in (H5-3, for E2E and Human Verification recordings).** In a DEV server
 * (`import.meta.env.DEV`), setting `localStorage["teto.dev.hint5Ladder"] = "1"` before the app loads
 * turns the flag on. A production / Preview build is not DEV, so this is always `false` there. A
 * failing storage read is `false`.
 *
 * ../../state/gameReducer.hint5.flagOff.test.ts pins the flag-off parity.
 */
export const HINT5_DEV_OPT_IN_KEY = "teto.dev.hint5Ladder";

function devOptIn(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return globalThis.localStorage?.getItem(HINT5_DEV_OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export const HINT5_LADDER_ENABLED: boolean = devOptIn();
