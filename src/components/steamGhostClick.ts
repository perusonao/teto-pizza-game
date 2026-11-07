/**
 * Cooking Steam Phase 1 (#726, S3): the "ghost click" of the pill's own tap.
 *
 * The "♨ 蒸す" pill opens the steam screen on `pointerup`, and the screen replaces the pill at once (React flushes the update inside the event). A touch tap then
 * still sends its compatibility events -- `mousedown` / `mouseup` / `click`, about 30 ms later and with NO new `pointerdown` -- to whatever is under the finger NOW:
 * the screen's big bottom button. Measured (390x844 and 360x800, emulated touch): operation A saw that click as "ふたをする" and started steaming the moment the screen
 * opened; operation B's click fell in the gap between its two buttons (harmless by luck of the layout).
 *
 * The rule here is deliberately narrow: swallow ONE click that arrives with no new `pointerdown` since the pill's pointerup, i.e. the one that belongs to the same
 * input. It ends the moment anything else happens, so a quick, deliberate second tap (it always starts with its own `pointerdown`) is never touched -- no fixed
 * dead time after the screen opens:
 *   - the next `pointerdown` anywhere disarms it (a new, explicit input);
 *   - a click with `detail === 0` (keyboard Enter / Space) is left alone and does not use it up;
 *   - it also gives up after STEAM_GHOST_CLICK_WINDOW_MS (a click that never came), and on dispose (unmount).
 */
export const STEAM_GHOST_CLICK_WINDOW_MS = 600;

/** Arms the guard; returns `dispose`. Safe to call `dispose` more than once. */
export function armSteamGhostClickGuard(doc: Document = document, win: Window = window): () => void {
  let done = false;
  let timer: number | undefined;
  const dispose = () => {
    if (done) return;
    done = true;
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("pointerdown", dispose, true);
    win.clearTimeout(timer);
  };
  function onClick(event: MouseEvent) {
    if (event.detail === 0) return; // a keyboard "click": not the ghost of a touch, and it does not disarm the guard
    event.preventDefault();
    event.stopPropagation();
    dispose();
  }
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("pointerdown", dispose, true);
  timer = win.setTimeout(dispose, STEAM_GHOST_CLICK_WINDOW_MS);
  return dispose;
}
