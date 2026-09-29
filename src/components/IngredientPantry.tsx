import { useEffect, useId, useMemo, useRef } from "react";
import { CATEGORY_LABEL, getIngredient, type Ingredient, type IngredientCategory } from "../data/ingredients";
import { queryCatalog } from "../logic/catalog/catalogQuery";
import { runtimeCatalog } from "../logic/catalog/catalogSource";
import { emptyUsageSession } from "../logic/catalog/usageSignals";
import { remainingStock, type InventoryState } from "../state/inventory";
import { IngredientGlyph } from "./IngredientGlyph";
import { IngredientPieceVisual } from "./IngredientPieceVisual";

/**
 * Large Catalog UX LC-R3: the 「食材庫」 (pantry) sheet SHELL, opened from the FREE Cooking cooking screen.
 *
 * Shell only: no shelf chips, no search, no picks, no hand editing, no counts (LC-R4 / R5). It lists the
 * player's OWNED ingredients of the active step's category, read-only, through `queryCatalog` (OWNED-only:
 * a LOCKED / not-yet-bought ingredient has no row, name, silhouette or `???`). Zero-stock owned rows go last
 * (LC-OD-17). Opening or closing it changes no game state, no selection, no ownership and no save.
 *
 * Layout contract (PR #304, stable-height modal): the sheet keeps ONE outer height whatever the row count;
 * the header (title + 閉じる) is pinned; only `.pantry-sheet__list` scrolls (a keyboard-focusable region);
 * the page / body never scrolls. It is a fixed overlay like the hint sheet, so opening it moves nothing on
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
  const catalog = useMemo(() => runtimeCatalog(), []);

  // Opening lands on 閉じる (the pinned control), never on the page behind.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const rows: { ingredient: Ingredient; stock: ReturnType<typeof remainingStock> }[] = queryCatalog(
    catalog,
    {
      ownedIds: ownedIngredientIds,
      stock: (id) => {
        const ingredient = getIngredient(id);
        return ingredient ? remainingStock(ingredient, inventory) : 0;
      },
    },
    emptyUsageSession(),
  )
    .filter((item) => item.category === category)
    .flatMap((item) => {
      const ingredient = getIngredient(item.id);
      return ingredient ? [{ ingredient, stock: remainingStock(ingredient, inventory) }] : [];
    });

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

        <div className="pantry-sheet__list" role="region" aria-label="所持している材料" tabIndex={0}>
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
