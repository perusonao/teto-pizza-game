import { AnonymousLockFrame } from "./AnonymousLockFrame";
import { ANONYMOUS_LOCK_HINTS } from "./anonymousLockHints";

/**
 * #422 PR-B (OD-DISPLAY-1): the Shop's LOCKED section -- one anonymous slot per material that is not
 * unlocked yet, in its own 2-column grid outside the category tabs.
 *
 * Privacy by construction: the only input is a COUNT. No ingredient, id, family or price can reach this
 * component, and every slot renders identical markup (React keys are indices, nothing is derived from
 * the material). Which materials are LOCKED is the Shop's own state authority (`materialShopState`),
 * never the Dex's. Renders nothing for 0.
 */
export function ShopLockedSection({ count }: { count: number }) {
  if (!Number.isInteger(count) || count <= 0) return null;
  return (
    <section className="shop-locked" data-shop-locked-section="true" aria-label="未入荷の材料">
      <h3 className="shop-locked__title">{"\u{1F512}"} 未入荷の材料</h3>
      <div className="shop-locked__grid" role="list">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} role="listitem" className="shop-locked__cell">
            <AnonymousLockFrame hint={ANONYMOUS_LOCK_HINTS.SHOP_LOCKED} dataAttributes={{ "data-shop-state": "LOCKED" }} />
          </div>
        ))}
      </div>
    </section>
  );
}
