/**
 * Cooking Tray family row (Issue #399): the pure geometry behind the compact `ShelfChipRow`. No DOM, no React: the row's
 * measurements go in, the `scrollLeft` to move to and the edge-fade widths come out.
 *
 * Contract (priority order): the chip is shown WHOLE, then its text is never under a fade, then the fade is as wide as
 * `CHIP_ROW_FADE_PX`. A chip that cannot fit with its fades (a narrow window) shrinks the fades toward 0 first; a chip
 * wider than the window itself is aligned to the row's left edge (its start stays readable).
 */

/** Width of the edge fade (and of the room an off-edge chip keeps for it). Smaller than a chip's own 12px side padding + gap. */
export const CHIP_ROW_FADE_PX = 14;

export interface ChipRowMeasure {
  scrollLeft: number;
  viewWidth: number;
  scrollWidth: number;
}

export interface ChipRect {
  /** Left edge in the row's scroll coordinates (`offsetLeft`). */
  left: number;
  width: number;
  /** First / last chip of the row: nothing sits beyond it, so no fade room is kept on that side. */
  isFirst: boolean;
  isLast: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Room kept at each edge for an off-edge chip: `fade` per side that has neighbours, shrunk so chip + room fit the view. */
export function chipRowPads(view: ChipRowMeasure, chip: ChipRect, fade: number = CHIP_ROW_FADE_PX): { start: number; end: number } {
  const start = chip.isFirst ? 0 : fade;
  const end = chip.isLast ? 0 : fade;
  const total = start + end;
  const spare = Math.max(0, view.viewWidth - chip.width);
  if (total <= spare || total === 0) return { start, end };
  const scale = spare / total;
  return { start: start * scale, end: end * scale };
}

/**
 * The `scrollLeft` that shows `chip` whole and clear of the fades, moving as little as possible (the current value when
 * it already does). Always within the row's own scroll range.
 */
export function alignChipScrollLeft(view: ChipRowMeasure, chip: ChipRect, fade: number = CHIP_ROW_FADE_PX): number {
  const max = Math.max(0, view.scrollWidth - view.viewWidth);
  const current = clamp(view.scrollLeft, 0, max);
  if (chip.width >= view.viewWidth) return clamp(chip.left, 0, max);
  const pads = chipRowPads(view, chip, fade);
  const right = chip.left + chip.width;
  if (chip.left < current + pads.start) return clamp(chip.left - pads.start, 0, max);
  if (right > current + view.viewWidth - pads.end) return clamp(right - view.viewWidth + pads.end, 0, max);
  return current;
}

export interface ChipRowEdges {
  /** Chips are still hidden to the left / right (drives the fades). */
  moreStart: boolean;
  moreEnd: boolean;
  /** Fade widths in px: `fade` where chips are hidden, but never wide enough to cover the active chip's own text. */
  fadeStart: number;
  fadeEnd: number;
}

/**
 * Which edges fade, and how wide. `active` (the pressed chip, when there is one) caps a fade so it never overlaps that
 * chip while the chip is fully inside the view; a chip cut off by the edge is the user's own scroll, not ours to protect.
 */
export function chipRowEdges(view: ChipRowMeasure, active: ChipRect | null, fade: number = CHIP_ROW_FADE_PX): ChipRowEdges {
  const moreStart = view.scrollLeft > 2;
  const moreEnd = view.scrollLeft + view.viewWidth < view.scrollWidth - 2;
  let fadeStart = moreStart ? fade : 0;
  let fadeEnd = moreEnd ? fade : 0;
  if (active) {
    const relLeft = active.left - view.scrollLeft;
    const gapRight = view.viewWidth - (relLeft + active.width);
    if (relLeft >= 0 && gapRight >= 0) {
      fadeStart = Math.min(fadeStart, relLeft);
      fadeEnd = Math.min(fadeEnd, gapRight);
    }
  }
  return { moreStart, moreEnd, fadeStart, fadeEnd };
}
