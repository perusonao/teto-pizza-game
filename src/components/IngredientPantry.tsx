import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, getIngredient, type IngredientCategory } from "../data/ingredients";
import { INGREDIENT_SHELF_ORDER, type IngredientShelfId, type ShelfFilter } from "../data/ingredientShelf";
import { queryCatalog } from "../logic/catalog/catalogQuery";
import { runtimeCatalog } from "../logic/catalog/catalogSource";
import { emptyUsageSession } from "../logic/catalog/usageSignals";
import { remainingStock, type InventoryState } from "../state/inventory";
import { IngredientGlyph } from "./IngredientGlyph";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { ShelfChips } from "./ShelfChips";

/**
 * Large Catalog UX LC-R3: the 「食材庫」 (pantry) sheet SHELL, opened from the FREE Cooking cooking screen.
 *
 * Shell + LC-R4 shelf filtering: no search, no picks, no hand editing, no counts (R5). It lists the
 * player's OWNED ingredients of the active step's category, read-only, through `queryCatalog` (OWNED-only:
 * a LOCKED / not-yet-bought ingredient has no row, name, silhouette or `???`). Zero-stock owned rows go last
 * (LC-OD-17). Opening or closing it changes no game state, no selection, no ownership and no save.
 *
 * Layout contract (PR #304, stable-height modal): the sheet keeps ONE outer height whatever the row count;
 * the header (title + 閉じる) is pinned; only `.pantry-sheet__list` scrolls (a keyboard-focusable region);
 * the page / body never scrolls.
 *
 * LC-R4 (Owner-confirmed OD-R4-1 / OD-R4-2): the pantry stays per active category. `ShelfChips` sits in a fixed
 * (non-scrolling) slot between the subtitle and the list and appears only when the OWNED rows of this category
 * span two or more shelves; its chips are derived from the `shelf` of those rows (in `INGREDIENT_SHELF_ORDER`), never from the catalog.
 * The chosen shelf is local UI state (the sheet is unmounted on close, so reopening starts at 「すべて」; nothing
 * is saved or lifted into GameState). Membership is `ingredientShelf` (through the catalog descriptor's `shelf`);
 * a `shelf === null` row is listed under 「すべて」 only. The pantry filter never touches the Builder tray, so
 * `selectedIngredientId` is not cleared here (#197 applies once the Builder hand visible set changes, R5).
 * It is a fixed overlay like the hint sheet, so opening it moves nothing on
 * the cooking screen (the pizza stage keeps its size). InventoryOverlay is deliberately NOT reused: that
 * component is read-only by type and owns a different card.
 */
export interface IngredientPantryProps {
  category: IngredientCategory;
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
  onClose: () => void;
}

export function IngredientPantry({ category, ownedIngredientIds, inventory, onClose }: IngredientPantryProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeShelf, setActiveShelf] = useState<ShelfFilter>("all");
  const catalog = useMemo(() => runtimeCatalog(), []);

  // Opening lands on 閉じる (the pinned control), never on the page behind.
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
  const itemsFor = (shelves?: readonly IngredientShelfId[]) =>
    queryCatalog(catalog, ownership, emptyUsageSession(), { shelves }).filter((item) => item.category === category);
  const toRows = (items: readonly { id: string }[]) =>
    items.flatMap((item) => {
      const ingredient = getIngredient(item.id);
      return ingredient ? [{ ingredient, stock: remainingStock(ingredient, inventory) }] : [];
    });

  // The chip row is derived from what this category's OWNED rows can show under 「すべて」: the shelves of the very
  // descriptors the filter uses (so a chip can never select an empty list), in the shelf authority's order.
  const allItems = itemsFor();
  const represented = new Set(allItems.flatMap((item) => (item.shelf === null ? [] : [item.shelf])));
  const presentShelves = INGREDIENT_SHELF_ORDER.filter((id) => represented.has(id));
  const showChips = presentShelves.length >= 2;
  // A stored shelf that is no longer listed reads as 「すべて」 (derived while rendering, like Shop / Inventory).
  const shelfFilter: ShelfFilter = showChips && activeShelf !== "all" && presentShelves.includes(activeShelf) ? activeShelf : "all";
  const rows = toRows(shelfFilter === "all" ? allItems : itemsFor([shelfFilter]));

  function handleShelfChange(next: ShelfFilter) {
    setActiveShelf(next);
    // Only the list's own scroll position: the sheet, the page and the chip row stay where they are.
    if (listRef.current) listRef.current.scrollTop = 0;
  }

  return (
    <div className="pantry-sheet__backdrop" role="presentation" onClick={onClose}>
      <section
        className="pantry-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
            {"\u{1F9FA}"} 食材庫
          </h2>
          <button ref={closeRef} type="button" className="pantry-sheet__close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <p className="pantry-sheet__subtitle">{CATEGORY_LABEL[category]}</p>

        {showChips && (
          <div className="pantry-sheet__shelves">
            <ShelfChips shelves={presentShelves} active={shelfFilter} onChange={handleShelfChange} ariaLabel="材料の分類" />
          </div>
        )}

        <div ref={listRef} className="pantry-sheet__list" role="region" aria-label="所持している材料" tabIndex={0}>
          {rows.length === 0 ? (
            <p className="pantry-sheet__empty">まだこのカテゴリの材料を持っていません</p>
          ) : (
            <ul className="pantry-sheet__grid">
              {rows.map(({ ingredient, stock }) => (
                <li key={ingredient.id} className="pantry-tile">
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
