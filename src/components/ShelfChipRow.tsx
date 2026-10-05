import { useEffect, useRef, useState } from "react";

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
  /** Cooking Tray (Issue #396): the compact row inside the tray's utility row (own classes, so the Pantry / Inventory /
   *  Shop `.shelf-chip` selectors never see it), with a right-edge fade while more chips sit off to the right. */
  compact?: boolean;
}

export function ShelfChipRow({ options, active, onChange, ariaLabel, dataAttr, compact = false }: ShelfChipRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const [moreRight, setMoreRight] = useState(false);

  // Compact rows only: whether chips are still hidden to the right (drives the edge fade). jsdom has no layout, so
  // there it stays false; a real browser re-reads it on scroll and resize.
  useEffect(() => {
    const row = rowRef.current;
    if (!compact || !row) return;
    const update = () => setMoreRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
    update();
    row.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      row.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [compact, options.length]);

  // Keep the active chip inside the row's own scrollport. Adjusts `scrollLeft` of the row only, so the page /
  // overlay body never jumps. Skipped on the first render (nothing moved yet).
  useEffect(() => {
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
  }, [active]);

  return (
    <div
      className={compact ? `tray-family-chips${moreRight ? " tray-family-chips--more-right" : ""}` : "shelf-chips"}
      role="group"
      aria-label={ariaLabel}
      ref={rowRef}
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
