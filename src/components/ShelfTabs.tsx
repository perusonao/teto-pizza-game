import {
  FAMILY_SHELF_IDS,
  ingredientShelfLabel,
  majorLabel,
  selectFamily,
  selectMajor,
  SHELF_ALL_LABEL_JA,
  type FamilyFilter,
  type MajorFilter,
  type MajorShelfId,
  type ShelfSelection,
} from "../data/ingredientShelf";
import { ShelfChipRow } from "./ShelfChipRow";

/**
 * Ingredient Pantry / Category Tabs: the two-tier shelf tabs shared by the Inventory and the Shop (OD-1 / OD-8).
 *
 * Tier 1: 「すべて」 + the major groups the caller lists (ソース / チーズ / 具材). Tier 2: 「すべて」 + the families
 * the caller lists, rendered ONLY while 「具材」 is the selected major. Both are `role="group"` rows of `aria-pressed`
 * toggles (OD-7, not a tablist) with a horizontally scrolling row each. Controlled and stateless: the caller owns
 * the `ShelfSelection` and derives `majors` / `families` from the rows it lists, so a tab can never select an empty
 * list. Moving to another major resets the family to 「すべて」; re-tapping the active major changes nothing (OD-D).
 * Labels come from `ingredientShelf` (CATEGORY_LABEL / the familyDisplay authority). No counts.
 */
type FamilyId = Exclude<FamilyFilter, "all">;

export interface ShelfTabsProps {
  majors: readonly MajorShelfId[];
  families: readonly FamilyId[];
  selection: ShelfSelection;
  onChange: (next: ShelfSelection) => void;
}

export function ShelfTabs({ majors, families, selection, onChange }: ShelfTabsProps) {
  const majorOptions = [
    { id: "all", label: SHELF_ALL_LABEL_JA },
    ...majors.map((major) => ({ id: major, label: majorLabel(major) })),
  ];
  const familyOptions = [
    { id: "all", label: SHELF_ALL_LABEL_JA },
    ...FAMILY_SHELF_IDS.filter((family) => families.includes(family)).map((family) => ({
      id: family,
      label: ingredientShelfLabel(family) ?? "",
    })),
  ];
  return (
    <div className="shelf-tabs">
      <ShelfChipRow
        options={majorOptions}
        active={selection.major}
        onChange={(id) => {
          const next = selectMajor(selection, id as MajorFilter);
          if (next !== selection) onChange(next);
        }}
        ariaLabel="材料の大分類"
        dataAttr="data-major"
      />
      {selection.major === "topping" && (
        <ShelfChipRow
          options={familyOptions}
          active={selection.family}
          onChange={(id) => onChange(selectFamily(selection, id as FamilyFilter))}
          ariaLabel="具材の分類"
          dataAttr="data-shelf"
        />
      )}
    </div>
  );
}
