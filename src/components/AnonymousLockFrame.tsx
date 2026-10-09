import type { ReactNode } from "react";
import type { AnonymousLockHint } from "./anonymousLockHints";

/**
 * #422 PR-A (OD-DISPLAY-1): the display-only pieces of an anonymous locked slot, shared so a later
 * surface (the Shop's LOCKED section, PR-B) draws the very same frame. Only the *look* is shared --
 * which slots are locked, and why, stays with each surface's own state authority (Dex: the Dex /
 * recipe discovery state; Shop: its own entitlement state).
 *
 * Privacy by construction: nothing here accepts a recipe, an ingredient, an id or a free-form
 * string. `lead` is a slot marker only, `hint` is one of the fixed copy lines below, and the
 * silhouette takes no data at all -- so every locked slot renders the same pixels and the same
 * attributes whatever it stands for.
 */

/**
 * One pure-CSS pizza-shaped disc with a lock. Takes no props on purpose: the same element for
 * every locked slot (no per-slot size, rotation, colour, id or delay). Decorative, so hidden from
 * assistive tech -- the slot's text carries the meaning.
 */
export function GenericPizzaSilhouette() {
  return (
    <span className="generic-pizza-silhouette" aria-hidden="true">
      <span className="generic-pizza-silhouette__lock">🔒</span>
    </span>
  );
}

interface AnonymousLockFrameProps {
  /** The slot's fixed position marker ("No.07"); omitted for a card that stands for no slot. */
  lead?: `No.${string}`;
  hint: AnonymousLockHint;
  /** A dashed "this one is reachable next" border (the Dex's tagged slots). */
  tagged?: boolean;
  /** State markers the surface already publishes (e.g. `data-dex-state`); values are the surface's own enums. */
  dataAttributes?: Readonly<Record<`data-${string}`, string>>;
  /** An optional action (a CTA button) under the hint. */
  children?: ReactNode;
}

export function AnonymousLockFrame({ lead, hint, tagged = false, dataAttributes, children }: AnonymousLockFrameProps) {
  return (
    <div
      className={`dex-card dex-card--locked anonymous-lock${tagged ? " dex-card--tagged" : ""}`}
      {...dataAttributes}
    >
      <GenericPizzaSilhouette />
      <div className="dex-card__lock-text">
        <p className="dex-card__lock-label">
          {lead ? (
            <>
              <span className="dex-card__no">{lead}</span> ？？？
            </>
          ) : (
            "？？？"
          )}
        </p>
        <p className="dex-card__lock-hint">{hint}</p>
        {children}
      </div>
    </div>
  );
}
