import { useEffect, useRef } from "react";

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
}

export interface ShelfChipRowProps {
  options: readonly ShelfChipOption[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  dataAttr: "data-shelf" | "data-major";
}

export function ShelfChipRow({ options, active, onChange, ariaLabel, dataAttr }: ShelfChipRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

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
    <div className="shelf-chips" role="group" aria-label={ariaLabel} ref={rowRef}>
      {options.map((option) => {
        const pressed = active === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={`shelf-chip${pressed ? " shelf-chip--active" : ""}`}
            aria-pressed={pressed}
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
