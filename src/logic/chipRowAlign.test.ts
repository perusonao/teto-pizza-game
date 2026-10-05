import { describe, expect, it } from "vitest";
import { alignChipScrollLeft, CHIP_ROW_FADE_PX as F, chipRowEdges, chipRowPads, type ChipRect } from "./chipRowAlign";

// The production family row: chips (width) laid out with a 6px gap, 750px in all (すべて + the 7 families).
const WIDTHS = [60, 48, 60, 108, 108, 120, 60, 144];
const CHIPS: ChipRect[] = (() => {
  let left = 0;
  return WIDTHS.map((width, i) => {
    const chip = { left, width, isFirst: i === 0, isLast: i === WIDTHS.length - 1 };
    left += width + 6;
    return chip;
  });
})();
const SCROLL_WIDTH = CHIPS[CHIPS.length - 1]!.left + CHIPS[CHIPS.length - 1]!.width;
const view = (viewWidth: number, scrollLeft = 0) => ({ scrollLeft, viewWidth, scrollWidth: SCROLL_WIDTH });

describe("chipRowPads", () => {
  it("keeps the fade room on a side only when a neighbour is there", () => {
    expect(chipRowPads(view(255), CHIPS[0]!)).toEqual({ start: 0, end: F });
    expect(chipRowPads(view(255), CHIPS[3]!)).toEqual({ start: F, end: F });
    expect(chipRowPads(view(255), CHIPS[7]!)).toEqual({ start: F, end: 0 });
  });

  it("shrinks the room (both sides alike) when chip + room would not fit, down to none", () => {
    expect(chipRowPads(view(121), CHIPS[3]!)).toEqual({ start: (121 - 108) / 2, end: (121 - 108) / 2 });
    expect(chipRowPads(view(100), CHIPS[3]!)).toEqual({ start: 0, end: 0 });
  });
});

describe("alignChipScrollLeft", () => {
  it("does not move when the chip is already whole and clear of the fades", () => {
    expect(alignChipScrollLeft(view(255, 100), CHIPS[3]!)).toBe(100); // chip 186..294 sits at 86..194 of 255, clear of both 14px fades
    expect(alignChipScrollLeft(view(255, 0), CHIPS[0]!)).toBe(0);
  });

  it("moves the least that brings an off-edge chip in, leaving the fade room beside it", () => {
    const c = CHIPS[5]!; // スパイス・薬味系, 414..534
    expect(alignChipScrollLeft(view(255, 0), c)).toBe(c.left + c.width - 255 + F);
    expect(alignChipScrollLeft(view(255, 400), c)).toBe(c.left - F);
  });

  it("puts the first chip at 0 and the last chip against the end (no fade room beyond them)", () => {
    expect(alignChipScrollLeft(view(255, 300), CHIPS[0]!)).toBe(0);
    expect(alignChipScrollLeft(view(255, 0), CHIPS[7]!)).toBe(SCROLL_WIDTH - 255);
  });

  it("shows the longest chip whole at 360px (255px with the pager collapsed, even 121px with it) and clear of a fade where it fits", () => {
    const longest = CHIPS[7]!;
    for (const w of [255, 285, 121, 151]) {
      const left = alignChipScrollLeft(view(w, 0), longest);
      const shown = longest.left - left; // chip's left edge inside the view
      if (w > longest.width) {
        expect(shown, `view ${w}`).toBeGreaterThanOrEqual(0);
        expect(shown + longest.width, `view ${w}`).toBeLessThanOrEqual(w);
      } else {
        expect(left, `view ${w}: a chip wider than the view starts at the left edge`).toBe(longest.left);
      }
    }
    // 255px: the start fade has its full room too.
    expect(longest.left - alignChipScrollLeft(view(255, 0), longest)).toBeGreaterThanOrEqual(F);
  });

  it("every chip, at every view width from 122 to 400 and from every scroll position, ends up whole when it fits the view", () => {
    for (let w = 122; w <= 400; w += 7) {
      for (const chip of CHIPS) {
        for (let from = 0; from <= SCROLL_WIDTH; from += 53) {
          const to = alignChipScrollLeft(view(w, from), chip);
          expect(to).toBeGreaterThanOrEqual(0);
          expect(to).toBeLessThanOrEqual(Math.max(0, SCROLL_WIDTH - w));
          if (chip.width <= w) {
            expect(chip.left, `w=${w} chip@${chip.left}`).toBeGreaterThanOrEqual(to - 0.001);
            expect(chip.left + chip.width, `w=${w} chip@${chip.left}`).toBeLessThanOrEqual(to + w + 0.001);
          }
          // idempotent: aligning again from the result changes nothing.
          expect(alignChipScrollLeft(view(w, to), chip)).toBeCloseTo(to, 5);
        }
      }
    }
  });

  it("keeps the room for the fades whenever the view allows it", () => {
    for (const w of [200, 255, 285, 360]) {
      for (const chip of CHIPS.slice(1, 7)) {
        const to = alignChipScrollLeft(view(w, 0), chip);
        const pads = chipRowPads(view(w), chip);
        const max = SCROLL_WIDTH - w;
        if (to > 0 && to < max) {
          expect(chip.left - to).toBeGreaterThanOrEqual(pads.start - 0.001);
          expect(to + w - (chip.left + chip.width)).toBeGreaterThanOrEqual(pads.end - 0.001);
        }
      }
    }
  });
});

describe("chipRowEdges", () => {
  it("says more-right at the start, more-left at the end, both in the middle, neither when everything fits", () => {
    expect(chipRowEdges(view(255, 0), null)).toMatchObject({ moreStart: false, moreEnd: true, fadeStart: 0, fadeEnd: F });
    expect(chipRowEdges(view(255, SCROLL_WIDTH - 255), null)).toMatchObject({ moreStart: true, moreEnd: false, fadeStart: F, fadeEnd: 0 });
    expect(chipRowEdges(view(255, 100), null)).toMatchObject({ moreStart: true, moreEnd: true, fadeStart: F, fadeEnd: F });
    expect(chipRowEdges({ scrollLeft: 0, viewWidth: 800, scrollWidth: 750 }, null)).toMatchObject({ moreStart: false, moreEnd: false, fadeStart: 0, fadeEnd: 0 });
  });

  it("never lets a fade cover the active chip while it is fully in the view", () => {
    const active = CHIPS[3]!; // 186..294
    // Active chip 5px from the start edge and 9px from the end edge: the fades shrink to those gaps.
    const v = { scrollLeft: active.left - 5, viewWidth: active.width + 14, scrollWidth: SCROLL_WIDTH };
    expect(chipRowEdges(v, active)).toMatchObject({ fadeStart: 5, fadeEnd: 9 });
    // A chip cut off by the edge (a manual scroll) is not protected.
    expect(chipRowEdges({ scrollLeft: active.left + 20, viewWidth: 255, scrollWidth: SCROLL_WIDTH }, active)).toMatchObject({ fadeStart: F });
  });
});
