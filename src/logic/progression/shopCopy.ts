/**
 * B案再構成 Phase 2b (Issue #901): which wording the player sees. Under the shop model a
 * recipe discovery is 「メニュー開発」 (design C3 / plan-B spec §5: discovery stays, as new-menu development -- a reward that makes the
 * shop stronger, not a progression condition). Under the legacy model every string is the legacy one.
 *
 * Copy modules can read the effective ID without importing the progression model.
 */
import { PROGRESSION_MODEL_ID } from "./progressionModelFlag";

export const SHOP_COPY_ACTIVE: boolean = PROGRESSION_MODEL_ID === "shop";

/** The legacy string, or the shop model's when the shop model runs. */
export function shopCopy<T>(legacy: T, shop: T): T {
  return SHOP_COPY_ACTIVE ? shop : legacy;
}
