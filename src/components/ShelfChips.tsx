import {
  ingredientShelfLabel,
  SHELF_ALL_LABEL_JA,
  type IngredientShelfId,
  type ShelfFilter,
} from "../data/ingredientShelf";
import { ShelfChipRow } from "./ShelfChipRow";

/**
 * Ingredient Category Tabs 1.0 (Phase 3): the presentational shelf filter chip row, now used by the Pantry's
 * family row (the Inventory / Shop use the two-tier `ShelfTabs`).
 *
 * Display only and stateless with respect to the domain: the caller owns the active filter and decides which
 * shelves to offer (it derives them from the rows it actually lists, so this component can never reveal a shelf
 * the screen cannot show). It renders 「すべて」 first, then `shelves` in the order given. No counts, no per-chip
 * descriptions, no hidden nodes. Row mechanics (scrolling, `aria-pressed` group) live in `ShelfChipRow`.
 */
export interface ShelfChipsProps {
  shelves: readonly IngredientShelfId[];
  active: ShelfFilter;
  onChange: (filter: ShelfFilter) => void;
  ariaLabel: string;
}

export function ShelfChips({ shelves, active, onChange, ariaLabel }: ShelfChipsProps) {
  const options = [
    { id: "all", label: SHELF_ALL_LABEL_JA },
    ...shelves.map((shelf) => ({ id: shelf, label: ingredientShelfLabel(shelf) ?? "" })),
  ];
  return (
    <ShelfChipRow
      options={options}
      active={active}
      onChange={(id) => onChange(id as ShelfFilter)}
      ariaLabel={ariaLabel}
      dataAttr="data-shelf"
    />
  );
}
