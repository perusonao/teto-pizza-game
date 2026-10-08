import { useLayoutEffect } from "react";

/**
 * Issue #423 (Owner HV on 268bd66): `.result-panel__actions` is `position: fixed` over the scrolling `.game-screen`, so on a
 * viewport shorter than the RESULT content (iPhone Safari with its toolbars, ~<733px tall) a collapsed `<details>` such as
 * 「くわしいスコアを見る」 sat BEHIND the bar from the first frame -- a reserved bottom padding only helps at the scroll end.
 *
 * The scroll area now simply ends where the bar begins: the bar's measured height (its own safe-area padding included) is
 * published as `--result-bar-h` on the scroller and `[data-result-bar]` (App.css) lifts the scroller's bottom edge by it, so
 * nothing can ever scroll underneath the bar. Layout-only: no state, no content change; removed on unmount.
 */
export function useResultActionBarInset(): void {
  useLayoutEffect(() => {
    let observed: HTMLElement | null = null;
    let scroller: HTMLElement | null = null;
    const apply = () => {
      const bar = document.querySelector<HTMLElement>(".result-panel__actions");
      const next = bar?.closest<HTMLElement>(".game-screen") ?? null;
      if (scroller && scroller !== next) release(scroller);
      scroller = next;
      if (bar && observer && bar !== observed) {
        if (observed) observer.unobserve(observed);
        observer.observe(bar);
        observed = bar;
      }
      if (bar && scroller) {
        scroller.style.setProperty("--result-bar-h", `${bar.getBoundingClientRect().height}px`);
        scroller.dataset.resultBar = "";
      }
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      observer?.disconnect();
      if (scroller) release(scroller);
    };
  });
}

function release(el: HTMLElement): void {
  el.style.removeProperty("--result-bar-h");
  delete el.dataset.resultBar;
}
