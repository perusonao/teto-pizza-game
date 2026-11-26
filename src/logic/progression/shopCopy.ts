/**
 * B案再構成 Phase 2b (Issue #901): which wording the player sees. Under the shop model (Preview only, `?progression=shop`) a
 * recipe discovery is 「メニュー開発」 (design C3 / plan-B spec §5: discovery stays, as new-menu development -- a reward that makes the
 * shop stronger, not a progression condition). Under the legacy model (Production) every string is the legacy one, unchanged.
 *
 * Deliberately light: it reads only the flag and the reputation table, so copy modules low in the import graph can use it
 * without pulling in the progression model. `SHOP_COPY_ACTIVE` equals `SHOP_MODEL_ACTIVE` (./shopStatus.ts; pinned by
 * ./shopCopy.test.ts), and like the flag it is fixed for the page load.
 */
import { PROGRESSION_MODEL_ID } from "./progressionModelFlag";
import { isReputationTableComplete, REPUTATION_TABLE } from "./reputationTable";

export const SHOP_COPY_ACTIVE: boolean = PROGRESSION_MODEL_ID === "shop" && isReputationTableComplete(REPUTATION_TABLE);

/** The legacy string, or the shop model's when the shop model runs. */
export function shopCopy<T>(legacy: T, shop: T): T {
  return SHOP_COPY_ACTIVE ? shop : legacy;
}
