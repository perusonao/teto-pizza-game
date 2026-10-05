import { useEffect, useLayoutEffect, useRef } from "react";
import { alignChipScrollLeft, chipRowEdges, type ChipRect, type ChipRowMeasure } from "../logic/chipRowAlign";

/**
 * The one horizontally scrolling row of toggle chips shared by `ShelfChips` (the Pantry's family row) and
 * `ShelfTabs` (the two-tier Inventory / Shop tabs). Presentational and fully controlled; it knows nothing about
 * shelves, majors or labels: the caller passes the options (already labelled) and owns the active id.
 *
 * Semantics: a `group` of toggle buttons (`aria-pressed`), not a tablist (OD-7). One row that never wraps; the
 * active chip is kept visible by scrolling the row itself (never the page). `dataAttr` names the attribute that
 * carries each option id (`data-shelf` / `data-major`).
 */
export interface ShelfChipOption {
  id: string;
  label: string;
  /** Accessible name when it must differ from the visible label (the Cooking Tray row, which can sit behind the
   *  Pantry's chips of the same visible text). */
  ariaLabel?: string;
}

export interface ShelfChipRowProps {
  options: readonly ShelfChipOption[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  dataAttr: "data-shelf" | "data-major" | "data-tray-family";
  /** Cooking Tray (Issue #396 / #399): the compact row inside the tray's utility row (own classes, so the Pantry /
   *  Inventory / Shop `.shelf-chip` selectors never see it), with an edge fade on each side that still hides chips and
   *  the active chip kept whole and clear of those fades (see ../logic/chipRowAlign). */
  compact?: boolean;
}

/** The compact row's geometry, read straight from the DOM (chips are positioned against the row: it is `position: relative`). */
function measureRow(row: HTMLElement): ChipRowMeasure {
  return { scrollLeft: row.scrollLeft, viewWidth: row.clientWidth, scrollWidth: row.scrollWidth };
}

function chipRect(row: HTMLElement, chip: HTMLElement): ChipRect {
  return { left: chip.offsetLeft, width: chip.offsetWidth, isFirst: chip === row.firstElementChild, isLast: chip === row.lastElementChild };
}

/** Writes the fade state onto the row (data attributes + CSS variables the stylesheet reads). Imperative on purpose:
 *  it runs per scroll frame and nothing in React renders from it. */
function syncEdges(row: HTMLElement) {
  const active = row.querySelector<HTMLElement>('[aria-pressed="true"]');
  const edges = chipRowEdges(measureRow(row), active ? chipRect(row, active) : null);
  row.dataset.moreStart = String(edges.moreStart);
  row.dataset.moreEnd = String(edges.moreEnd);
  row.style.setProperty("--fade-start", `${edges.fadeStart}px`);
  row.style.setProperty("--fade-end", `${edges.fadeEnd}px`);
}

/** Scrolls the row's own `scrollLeft` (never the page) just enough to show `chip` whole and clear of the fades. */
function alignChip(row: HTMLElement, chip: HTMLElement, smooth: boolean) {
  const target = alignChipScrollLeft(measureRow(row), chipRect(row, chip));
  if (Math.abs(target - row.scrollLeft) >= 0.5) {
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (smooth && !reduced && typeof row.scroll === "function") row.scroll({ left: target, behavior: "smooth" }); // the row element itself, never the page
    else row.scrollLeft = target;
  }
  syncEdges(row);
}

export function ShelfChipRow({ options, active, onChange, ariaLabel, dataAttr, compact = false }: ShelfChipRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const activeMountedRef = useRef(false);
  const optionsKey = options.map((o) => o.id).join("|");

  // Compact row, positions: on mount and whenever the options change, put the active chip in view at once (no animation).
  // The row's size changing (the pager leaving / returning, a rotation) re-checks the same thing: it only moves when the
  // active chip is no longer fully visible, so a user's own scroll is never undone by anything but a layout change.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!compact || !row) return;
    const settle = () => {
      const chip = row.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (chip) alignChip(row, chip, false);
      else syncEdges(row);
    };
    settle();
    const onScroll = () => syncEdges(row);
    row.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", settle);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(settle) : null;
    observer?.observe(row);
    return () => {
      row.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", settle);
      observer?.disconnect();
    };
  }, [compact, optionsKey]);

  // Compact row: a changed selection scrolls (smoothly unless reduced motion) to the new active chip. Not on the first render.
  useEffect(() => {
    if (!compact) return;
    if (!activeMountedRef.current) {
      activeMountedRef.current = true;
      return;
    }
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && chip) alignChip(row, chip, true);
  }, [compact, active]);

  // Keep the active chip inside the row's own scrollport. Adjusts `scrollLeft` of the row only, so the page /
  // overlay body never jumps. Skipped on the first render (nothing moved yet). The non-compact rows (Pantry, Inventory,
  // Shop) keep exactly this behaviour; the compact row has its own above.
  useEffect(() => {
    if (compact) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chip) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < row.scrollLeft) row.scrollLeft = left;
    else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth;
  }, [compact, active]);

  // Compact row: a chip focused from the keyboard that sits under a fade is brought clear of it. A pointer / touch focus is
  // left alone: the tap itself selects the chip (and the active-change effect aligns it), so scrolling on the focus that
  // comes first would only move the row before the click lands.
  const onFocus = compact
    ? (event: React.FocusEvent<HTMLDivElement>) => {
        const row = rowRef.current;
        const chip = (event.target as HTMLElement).closest<HTMLElement>("button");
        if (!row || !chip || !row.contains(chip)) return;
        let keyboard = true;
        try {
          keyboard = chip.matches(":focus-visible");
        } catch {
          // an engine without :focus-visible: treat every focus as keyboard focus.
        }
        if (keyboard) alignChip(row, chip, false);
      }
    : undefined;

  return (
    <div
      className={compact ? "tray-family-chips" : "shelf-chips"}
      role="group"
      aria-label={ariaLabel}
      ref={rowRef}
      onFocus={onFocus}
    >
      {options.map((option) => {
        const pressed = active === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={
              compact
                ? `tray-family-chip${pressed ? " tray-family-chip--active" : ""}`
                : `shelf-chip${pressed ? " shelf-chip--active" : ""}`
            }
            aria-pressed={pressed}
            aria-label={option.ariaLabel}
            {...{ [dataAttr]: option.id }}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
