import { useEffect, useRef } from "react";
import {
  ingredientShelfLabel,
  SHELF_ALL_LABEL_JA,
  type IngredientShelfId,
  type ShelfFilter,
} from "../data/ingredientShelf";

/**
 * Ingredient Category Tabs 1.0 (Phase 3): the shared, presentational shelf filter chip row.
 *
 * Display only and stateless with respect to the domain: the caller owns the active filter and
 * decides which shelves to offer (it derives them from the rows it actually lists, so this
 * component can never reveal a shelf the screen cannot show). It renders 「すべて」 first, then
 * `shelves` in the order given (callers pass `shelvesPresent(...)`, i.e. the ingredientShelf
 * authority order). No counts, no per-chip descriptions, no hidden nodes.
 *
 * Semantics: a `group` of toggle buttons (`aria-pressed`), not a tablist -- there is no tabpanel.
 * One horizontally scrolling row (never wraps); the active chip is kept visible by scrolling the
 * row itself (never the page).
 */
export interface ShelfChipsProps {
  shelves: readonly IngredientShelfId[];
  active: ShelfFilter;
  onChange: (filter: ShelfFilter) => void;
  ariaLabel: string;
}

export function ShelfChips({ shelves, active, onChange, ariaLabel }: ShelfChipsProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  // Keep the active chip inside the row's own scrollport. Adjusts `scrollLeft` of the row only,
  // so the page / overlay body never jumps. Skipped on the first render (nothing moved yet).
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

  const filters: ShelfFilter[] = ["all", ...shelves];
  return (
    <div className="shelf-chips" role="group" aria-label={ariaLabel} ref={rowRef}>
      {filters.map((filter) => {
        const pressed = active === filter;
        return (
          <button
            key={filter}
            type="button"
            className={`shelf-chip${pressed ? " shelf-chip--active" : ""}`}
            aria-pressed={pressed}
            data-shelf={filter}
            onClick={() => onChange(filter)}
          >
            {filter === "all" ? SHELF_ALL_LABEL_JA : (ingredientShelfLabel(filter) ?? "")}
          </button>
        );
      })}
    </div>
  );
}
