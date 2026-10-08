import { describe, expect, it, vi } from "vitest";
import { revealOpenedResultDetail } from "./revealOpenedResultDetail";

const rect = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;

/** jsdom has no layout: stub the three rects the helper reads (scroller top, bar top, detail/summary). */
function setup(o: { scrollerTop?: number; barTop: number; summaryTop: number; detailBottom: number }) {
  document.body.innerHTML = `<div class="game-screen"><div class="result-panel"><details open><summary>s</summary>x</details></div></div><div class="result-panel__actions"></div>`;
  const scroller = document.querySelector<HTMLElement>(".game-screen")!;
  const details = document.querySelector("details")!;
  vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(rect(o.scrollerTop ?? 0, 844));
  vi.spyOn(document.querySelector(".result-panel__actions")!, "getBoundingClientRect").mockReturnValue(rect(o.barTop, 844));
  vi.spyOn(details, "getBoundingClientRect").mockReturnValue(rect(o.summaryTop, o.detailBottom));
  vi.spyOn(details.querySelector("summary")!, "getBoundingClientRect").mockReturnValue(rect(o.summaryTop, o.summaryTop + 20));
  const scrollBy = vi.fn();
  scroller.scrollBy = scrollBy as unknown as typeof scroller.scrollBy;
  return { details, scrollBy };
}

describe("revealOpenedResultDetail (#423)", () => {
  it("scrolls by exactly the amount hidden behind the fixed bar (+8px gap)", () => {
    const { details, scrollBy } = setup({ barTop: 722, summaryTop: 500, detailBottom: 812 });
    revealOpenedResultDetail(details);
    expect(scrollBy).toHaveBeenCalledWith({ top: 812 - (722 - 8) });
  });
  it("does nothing when the detail already ends above the bar", () => {
    const { details, scrollBy } = setup({ barTop: 722, summaryTop: 500, detailBottom: 700 });
    revealOpenedResultDetail(details);
    expect(scrollBy).not.toHaveBeenCalled();
  });
  it("never scrolls its own summary off the top of the scroll area", () => {
    const { details, scrollBy } = setup({ barTop: 722, summaryTop: 60, detailBottom: 1400 });
    revealOpenedResultDetail(details);
    expect(scrollBy).toHaveBeenCalledWith({ top: 60 - 8 });
  });
});
