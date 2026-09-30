/**
 * Large Catalog UX LC-R5-b (Mode C, PreAudit §18.4): make the pantry sheet follow the VISUAL viewport while the
 * soft keyboard is up. Confined to the pantry (nothing else imports `visualViewport`).
 *
 * Why: on iOS Safari the keyboard shrinks `visualViewport.height` but not the layout viewport / `100dvh`, and
 * Safari then pans the page (real device, Mode A: scrollY ~140, header above the visual viewport, sheet bottom
 * under the keyboard). Fitting the sheet into the visual viewport kept everything visible (Mode C, same device).
 *
 * The hook only publishes two CSS custom properties and one class on the sheet element. The CSS decides the
 * height (`min(ceiling, --pantry-vv-h - safe-top - margin)`), so the safe-area and the no-JS baseline stay in CSS.
 * With no `visualViewport`, a non-finite value or an exception nothing is applied and the plain CSS ceiling is
 * the fallback. The fit never enlarges the sheet past its ceiling and is released as soon as the field is
 * blurred AND the visual viewport is back to the layout viewport, and always on unmount.
 */
import { useEffect } from "react";

/** A shrink of the visual viewport at least this large is treated as keyboard-like (a toolbar collapse is smaller). */
export const KEYBOARD_LIKE_MIN_SHRINK_PX = 120;

export interface PantryFit {
  /** `visualViewport.height` in px. */
  vvHeight: number;
  /** Distance from the layout viewport's bottom edge up to the visual viewport's bottom edge (>= 0). */
  bottom: number;
}

/**
 * Pure. `null` = do not fit (fallback to the CSS baseline). Applies while the search field is focused OR the
 * visual viewport is keyboard-like smaller than the layout viewport; garbage input never fits.
 */
export function computePantryFit(input: {
  layoutHeight: number;
  vvHeight: number;
  vvOffsetTop: number;
  fieldFocused: boolean;
}): PantryFit | null {
  const { layoutHeight, vvHeight, vvOffsetTop, fieldFocused } = input;
  if (![layoutHeight, vvHeight, vvOffsetTop].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (layoutHeight <= 0 || vvHeight <= 0 || vvOffsetTop < 0) return null;
  const keyboardLike = layoutHeight - vvHeight >= KEYBOARD_LIKE_MIN_SHRINK_PX;
  if (!fieldFocused && !keyboardLike) return null;
  return { vvHeight, bottom: Math.max(0, layoutHeight - (vvOffsetTop + vvHeight)) };
}

export const PANTRY_FIT_CLASS = "pantry-sheet--fit";
export const PANTRY_FIT_VV_HEIGHT_VAR = "--pantry-vv-h";
export const PANTRY_FIT_BOTTOM_VAR = "--pantry-vv-bottom";

function clear(el: HTMLElement) {
  el.classList.remove(PANTRY_FIT_CLASS);
  el.style.removeProperty(PANTRY_FIT_VV_HEIGHT_VAR);
  el.style.removeProperty(PANTRY_FIT_BOTTOM_VAR);
}

export function usePantryViewportFit(sheetRef: { current: HTMLElement | null }, fieldFocused: boolean): void {
  useEffect(() => {
    const el = sheetRef.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!el || !vv) return; // fallback: the CSS ceiling only

    let frame = 0;
    function apply() {
      frame = 0;
      if (!el || !vv) return;
      try {
        const fit = computePantryFit({
          layoutHeight: document.documentElement.clientHeight,
          vvHeight: vv.height,
          vvOffsetTop: vv.offsetTop,
          fieldFocused,
        });
        if (!fit) return clear(el);
        el.style.setProperty(PANTRY_FIT_VV_HEIGHT_VAR, `${fit.vvHeight}px`);
        el.style.setProperty(PANTRY_FIT_BOTTOM_VAR, `${fit.bottom}px`);
        el.classList.add(PANTRY_FIT_CLASS);
      } catch {
        clear(el); // any abnormal value: the CSS baseline
      }
    }
    function schedule() {
      if (frame === 0) frame = window.requestAnimationFrame(apply);
    }

    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      clear(el);
    };
  }, [sheetRef, fieldFocused]);
}
