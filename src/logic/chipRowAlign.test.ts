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

// ---- fractional layout + whole-pixel scroll (the WebKit case: chips laid out at fractional widths, scrollLeft stored whole) ----
const FRAC_WIDTHS = [60.4, 48.53, 60.4, 108.2, 108.2, 120.53, 60.4, 144.17];
const FRAC: ChipRect[] = (() => {
  let left = 0;
  return FRAC_WIDTHS.map((width, i) => {
    const chip = { left, width, isFirst: i === 0, isLast: i === FRAC_WIDTHS.length - 1 };
    left += width + 6;
    return chip;
  });
})();
const FRAC_SCROLL_WIDTH = Math.ceil(FRAC[7]!.left + FRAC[7]!.width); // an engine reports scrollWidth / clientWidth as whole pixels
const fview = (viewWidth: number, scrollLeft = 0) => ({ scrollLeft, viewWidth, scrollWidth: FRAC_SCROLL_WIDTH });
const endRoom = (to: number, w: number, c: ChipRect) => to + w - (c.left + c.width); // px between the chip's end and the view's end
const startRoom = (to: number, c: ChipRect) => c.left - to; // px between the view's start and the chip's start

describe("alignChipScrollLeft with fractional layout", () => {
  it("right edge: a whole-pixel scroll never leaves the chip's end past the safe boundary, and only rounds up by < 1px", () => {
    const w = 255;
    const c = FRAC[5]!; // 414.. + 120.53: its end is at a fractional position
    const to = alignChipScrollLeft(fview(w, 0), c);
    expect(Number.isInteger(to)).toBe(true);
    const pads = chipRowPads(fview(w), c);
    expect(endRoom(to, w, c)).toBeGreaterThanOrEqual(pads.end - 1e-9); // the old fractional target, rounded the other way, failed this by ~0.5px
    expect(endRoom(to, w, c) - pads.end).toBeLessThan(1);
  });

  it("left edge: a whole-pixel scroll never leaves the chip's start inside the safe boundary, and only rounds down by < 1px", () => {
    const w = 255;
    const c = FRAC[3]!;
    const to = alignChipScrollLeft(fview(w, 420), c);
    expect(Number.isInteger(to)).toBe(true);
    const pads = chipRowPads(fview(w), c);
    expect(startRoom(to, c)).toBeGreaterThanOrEqual(pads.start - 1e-9);
    expect(startRoom(to, c) - pads.start).toBeLessThan(1);
  });

  it("an exactly-fitting integer target is not pushed a whole pixel further by float noise", () => {
    const c: ChipRect = { left: 300, width: 100, isFirst: false, isLast: false };
    const w = 200;
    const lo = c.left + c.width - w + F;
    expect(alignChipScrollLeft({ scrollLeft: 0, viewWidth: w, scrollWidth: 800 }, c)).toBe(lo);
    expect(alignChipScrollLeft({ scrollLeft: 0, viewWidth: w, scrollWidth: 800 }, { ...c, left: 300 + 0.1 + 0.2 - 0.3 })).toBe(lo);
  });

  it("clamps at 0 (the first chip, and a chip whose fade room would push the target below 0)", () => {
    expect(alignChipScrollLeft(fview(255, 300), FRAC[0]!)).toBe(0);
    const near: ChipRect = { left: 5.7, width: 60.4, isFirst: false, isLast: false };
    expect(alignChipScrollLeft(fview(255, 90), near)).toBe(0);
  });

  it("clamps at the max scroll (the last chip, and a chip whose fade room would push the target past it)", () => {
    const max = FRAC_SCROLL_WIDTH - 255;
    expect(alignChipScrollLeft(fview(255, 0), FRAC[7]!)).toBe(max);
    const nearEnd = FRAC[6]!; // its end + the end fade room lies past the max scroll
    const to = alignChipScrollLeft(fview(255, 0), nearEnd);
    expect(to).toBeLessThanOrEqual(max);
    expect(endRoom(to, 255, nearEnd)).toBeGreaterThanOrEqual(-1e-9); // still whole
  });

  it("does not move when the chip is already whole and clear, even at a fractional scroll position", () => {
    const c = FRAC[3]!; // 186.. in a 255 view
    expect(alignChipScrollLeft(fview(255, 100.5), c)).toBe(100.5);
    expect(alignChipScrollLeft(fview(255, 100), c)).toBe(100);
  });

  it("an oversized chip keeps the whole-chip-first contract: its start is aligned to the view's start", () => {
    const wide: ChipRect = { left: 606.3, width: 144.17, isFirst: false, isLast: true };
    expect(alignChipScrollLeft(fview(121, 0), wide)).toBe(wide.left); // unchanged contract: the chip's own start, not rounded
    expect(alignChipScrollLeft(fview(144, 0), wide)).toBe(wide.left);
    const first: ChipRect = { left: 0, width: 150.5, isFirst: true, isLast: false };
    expect(alignChipScrollLeft(fview(121, 40), first)).toBe(0);
  });

  it("sweep: every chip at every view width and start (fractional and whole): whole when it fits, a whole pixel unless clamped, safe side of both fades whenever a whole pixel can be, and idempotent", () => {
    for (let w = 122.4; w <= 400; w += 6.7) {
      const vw = Math.floor(w); // an engine reports clientWidth as a whole number
      for (const chip of FRAC) {
        for (let from = 0; from <= FRAC_SCROLL_WIDTH; from += 37.3) {
          const view = fview(vw, from);
          const max = FRAC_SCROLL_WIDTH - vw;
          const to = alignChipScrollLeft(view, chip);
          expect(to).toBeGreaterThanOrEqual(0);
          expect(to).toBeLessThanOrEqual(max);
          expect(alignChipScrollLeft(fview(vw, to), chip), `w=${vw} chip@${chip.left} from=${from}`).toBe(to); // idempotent
          if (chip.width >= vw) continue;
          if (to !== from) expect(Number.isInteger(to) || to === max || to === 0).toBe(true);
          const pads = chipRowPads(view, chip);
          const atEdge = to === 0 || to === max;
          if (!atEdge) {
            // whole inside the view
            expect(startRoom(to, chip), `w=${vw} chip@${chip.left}`).toBeGreaterThanOrEqual(-1e-9);
            expect(endRoom(to, vw, chip), `w=${vw} chip@${chip.left}`).toBeGreaterThanOrEqual(-1e-9);
            // clear of both fades whenever some whole pixel is (floor(hi) >= ceil(lo))
            const lo = chip.left + chip.width - vw + pads.end;
            const hi = chip.left - pads.start;
            if (Math.ceil(lo - 1e-6) <= Math.floor(hi + 1e-6) && (from < lo - 1e-6 || from > hi + 1e-6)) {
              expect(endRoom(to, vw, chip)).toBeGreaterThanOrEqual(pads.end - 1e-9);
              expect(startRoom(to, chip)).toBeGreaterThanOrEqual(pads.start - 1e-9);
            }
          }
        }
      }
    }
  });
});

describe("chipRowEdges with fractional measurements (a manual scroll only reads, never moves)", () => {
  it("reads fractional scroll positions against the 2px threshold, and caps a fade at the real fractional gap", () => {
    expect(chipRowEdges({ scrollLeft: 2.4, viewWidth: 255, scrollWidth: FRAC_SCROLL_WIDTH }, null).moreStart).toBe(true);
    expect(chipRowEdges({ scrollLeft: 1.9, viewWidth: 255, scrollWidth: FRAC_SCROLL_WIDTH }, null).moreStart).toBe(false);
    const c = FRAC[5]!;
    const v = { scrollLeft: c.left - 9.47, viewWidth: Math.ceil(c.width + 9.47 + 13.47), scrollWidth: FRAC_SCROLL_WIDTH };
    const e = chipRowEdges(v, c);
    expect(e.fadeStart).toBeCloseTo(9.47, 6);
    expect(e.fadeEnd).toBeLessThanOrEqual(14);
    expect(startRoom(v.scrollLeft, c)).toBeGreaterThanOrEqual(e.fadeStart - 1e-9);
    expect(endRoom(v.scrollLeft, v.viewWidth, c)).toBeGreaterThanOrEqual(e.fadeEnd - 1e-9);
  });
});
