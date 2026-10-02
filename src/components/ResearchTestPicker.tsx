import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getIngredient } from "../data/ingredients";
import { INGREDIENT_SHELF_ORDER, type IngredientShelfId, type ShelfFilter } from "../data/ingredientShelf";
import { queryCatalog } from "../logic/catalog/catalogQuery";
import { runtimeCatalog } from "../logic/catalog/catalogSource";
import { emptyUsageSession } from "../logic/catalog/usageSignals";
import { remainingStock, type InventoryState } from "../state/inventory";
import { IngredientGlyph } from "./IngredientGlyph";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { ShelfChips } from "./ShelfChips";

/**
 * Issue #356 (Discovery 3.1) Slice 2: the fixed-overlay picker for 「今回調べる食材」.
 *
 * It reuses the 食材庫 sheet's shell classes, `queryCatalog` (OWNED only) and `ShelfChips` / `ingredientShelf`
 * (no new taxonomy, no new tab on the tray, no dependency on the Pantry's owned > 6 entry). Unlike the Pantry it lists
 * every category, grouped by the existing shelves.
 *
 * Anti-oracle: the list is a function of what the player OWNS, its stock, and what the player ALREADY knows about
 * this target -- never of the hidden recipe. It highlights nothing, counts nothing and orders nothing by the target.
 * `candidateIds` (owned and not yet known) arrive from GameScreen; `selectableIds` (Slice 1's `canDeclareResearchTest`)
 * decides which candidates can actually be chosen (a stock-0 one is shown but disabled).
 */
export interface ResearchTestPickerProps {
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
  /** Owned ingredients the player does not already know for this target. */
  candidateIds: readonly string[];
  /** The subset `canDeclareResearchTest` allows. */
  selectableIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (ingredientId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ResearchTestPicker({
  ownedIngredientIds,
  inventory,
  candidateIds,
  selectableIds,
  selectedId,
  onSelect,
  onClear,
  onClose,
}: ResearchTestPickerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [activeShelf, setActiveShelf] = useState<ShelfFilter>("all");
  const catalog = useMemo(() => runtimeCatalog(), []);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const ownership = {
    ownedIds: ownedIngredientIds,
    stock: (id: string) => {
      const ingredient = getIngredient(id);
      return ingredient ? remainingStock(ingredient, inventory) : 0;
    },
  };
  const candidates = new Set(candidateIds);
  const itemsFor = (shelves?: readonly IngredientShelfId[]) =>
    queryCatalog(catalog, ownership, emptyUsageSession(), { shelves }).filter((item) => candidates.has(item.id));

  const allItems = itemsFor();
  const represented = new Set(allItems.flatMap((item) => (item.shelf === null ? [] : [item.shelf])));
  const presentShelves = INGREDIENT_SHELF_ORDER.filter((id) => represented.has(id));
  const showChips = presentShelves.length >= 2;
  const shelfFilter: ShelfFilter = showChips && activeShelf !== "all" && presentShelves.includes(activeShelf) ? activeShelf : "all";
  const rows = itemsFor(shelfFilter === "all" ? undefined : [shelfFilter]).flatMap((item) => {
    const ingredient = getIngredient(item.id);
    return ingredient ? [{ ingredient, stock: remainingStock(ingredient, inventory) }] : [];
  });

  return (
    <div className="pantry-sheet__backdrop" role="presentation" onClick={onClose}>
      <section
        className="pantry-sheet research-test-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="research-test-picker"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="pantry-sheet__header">
          <h2 id={titleId} className="pantry-sheet__title">
            {"\u{1F52C}"} 今回調べる食材
          </h2>
          <button ref={closeRef} type="button" className="pantry-sheet__close" onClick={onClose}>
            閉じる
          </button>
        </div>
        <p className="pantry-sheet__subtitle">この試作で使う食材を1つえらびます</p>

        {showChips && (
          <div className="pantry-sheet__shelves">
            <ShelfChips shelves={presentShelves} active={shelfFilter} onChange={setActiveShelf} ariaLabel="材料の分類" />
          </div>
        )}

        {selectedId !== null && (
          <button type="button" className="pantry-sheet__pins-reset research-test-picker__clear" onClick={onClear}>
            えらびなおす（選択をはずす）
          </button>
        )}

        <div className="pantry-sheet__list" role="region" aria-label="調べられる食材" tabIndex={0}>
          {rows.length === 0 ? (
            <p className="pantry-sheet__empty">いま調べられる食材はありません</p>
          ) : (
            <ul className="pantry-sheet__grid">
              {rows.map(({ ingredient, stock }) => {
                const selectable = selectableIds.has(ingredient.id);
                const selected = selectedId === ingredient.id;
                return (
                  <li key={ingredient.id} className="pantry-tile pantry-tile--editable">
                    <button
                      type="button"
                      className={`pantry-tile__toggle${selected ? " pantry-tile__toggle--pinned" : ""}`}
                      aria-pressed={selected}
                      aria-disabled={!selectable || undefined}
                      onClick={() => {
                        if (selectable) onSelect(ingredient.id);
                      }}
                    >
                      {ingredient.category === "cheese" ? (
                        <span className="pantry-tile__cheese-slot">
                          <IngredientPieceVisual ingredient={ingredient} />
                        </span>
                      ) : (
                        <span className="pantry-tile__emoji">
                          <IngredientGlyph ingredient={ingredient} />
                        </span>
                      )}
                      <span className="pantry-tile__name">{ingredient.nameJa}</span>
                      <span className={`pantry-tile__stock${stock === 0 ? " pantry-tile__stock--zero" : ""}`}>
                        {stock === "UNLIMITED" ? "∞" : `×${stock}`}
                      </span>
                      {!selectable && <span className="pantry-tile__no-stock">ざいこなし</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
