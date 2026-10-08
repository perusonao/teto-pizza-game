import { useEffect } from "react";

/** Gap kept between a just-opened detail's bottom edge and the fixed action bar's top edge. */
const REVEAL_GAP_PX = 8;

/**
 * Issue #423: `.result-panel__actions` is a `position: fixed` bar over the scrolling
 * `.game-screen`, so a `<details>` opened below the bar's top edge used to expand *behind* it
 * (readable only after the player noticed and scrolled). When a RESULT detail opens, scroll the
 * screen just enough to bring its bottom edge above the bar -- never so far that its own
 * `<summary>` leaves the top of the scroll area. Reads layout only; no state, no content change.
 */
export function revealOpenedResultDetail(details: HTMLDetailsElement): void {
  const scroller = details.closest<HTMLElement>(".game-screen");
  const bar = document.querySelector<HTMLElement>(".result-panel__actions");
  if (!scroller || !bar) return;
  const hidden = details.getBoundingClientRect().bottom - (bar.getBoundingClientRect().top - REVEAL_GAP_PX);
  if (hidden <= 0) return;
  const summary = details.querySelector("summary") ?? details;
  const room = summary.getBoundingClientRect().top - scroller.getBoundingClientRect().top - REVEAL_GAP_PX;
  const delta = Math.min(hidden, room);
  if (delta > 0) scroller.scrollBy({ top: delta });
}

/** `toggle` does not bubble, so listen in the capture phase for any `<details>` inside `.result-panel`. */
export function useRevealOpenedResultDetail(): void {
  useEffect(() => {
    const onToggle = (event: Event) => {
      const el = event.target;
      if (el instanceof HTMLDetailsElement && el.open && el.closest(".result-panel")) revealOpenedResultDetail(el);
    };
    document.addEventListener("toggle", onToggle, true);
    return () => document.removeEventListener("toggle", onToggle, true);
  }, []);
}
