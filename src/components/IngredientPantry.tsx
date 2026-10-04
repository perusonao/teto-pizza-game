import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { CATEGORY_LABEL, getIngredient, MAX_INGREDIENT_PALETTE_SLOTS, type IngredientCategory } from "../data/ingredients";
import { INGREDIENT_SHELF_ORDER, type IngredientShelfId, type ShelfFilter } from "../data/ingredientShelf";
import { queryCatalog } from "../logic/catalog/catalogQuery";
import { runtimeCatalog } from "../logic/catalog/catalogSource";
import type { HandContext, HandSession } from "../logic/catalog/handSession";
import { clearPins, pinsInCategory, pinTileState, selectedStripRendered, togglePin } from "../logic/catalog/pinEdit";
import { emptyUsageSession } from "../logic/catalog/usageSignals";
import { remainingStock, type InventoryState } from "../state/inventory";
import { IngredientGlyph } from "./IngredientGlyph";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import {
  INITIAL_SEARCH_INPUT,
  isConfirmEnter,
  onSearchBlur,
  onSearchClear,
  onSearchCompositionEnd,
  onSearchCompositionStart,
  onSearchInput,
  type SearchInputState,
} from "./pantrySearchIme";
import { usePantryViewportFit } from "./pantryViewportFit";
import { FamilyTag } from "./FamilyTag";
import { ShelfChips } from "./ShelfChips";

/**
 * Large Catalog UX LC-R3: the 「食材庫」 (pantry) sheet SHELL, opened from the FREE Cooking cooking screen.
 *
 * Shell + LC-R4 shelf filtering: no search, no picks, no hand editing, no counts (R5). It lists the
 * player's OWNED ingredients of the active step's category, read-only, through `queryCatalog` (OWNED-only:
 * a LOCKED / not-yet-bought ingredient has no row, name, silhouette or `???`). Zero-stock owned rows go last
 * (LC-OD-17). Opening or closing it changes no game state, no selection, no ownership and no save.
 *
 * LC-R5-b: a search field (owned rows of the active category only, ANDed with the shelf; the approved
 * search-only aliases come through the catalog descriptor) and Mode C keyboard fit. The field appears only when
 * the category's OWNED rows exceed one tray page (> 6) -- a fact about ownership, never about the text, the
 * shelf or the result count, so it can never vanish while typing -- and it is never auto-focused and never
 * removed on 0 results. The list is filtered by `applied` text, which does not move during an IME composition
 * (see `pantrySearchIme`). `usePantryViewportFit` keeps the sheet inside the visual viewport while the soft
 * keyboard is up (pantry only; CSS ceiling fallback). Ordinary search / result / shelf changes never move the
 * sheet: only the keyboard-driven visual viewport change may. No pins / hand / selection here (R5-c+).
 *
 * Layout contract (PR #304, stable-height modal): the sheet keeps ONE outer height whatever the row count;
 * the header (title + 閉じる) is pinned; only `.pantry-sheet__list` scrolls (a keyboard-focusable region);
 * the page / body never scrolls.
 *
 * LC-R5-c (dormant pin foundation, OD-R5-2 / OD-R5c-1..3): with `handEditing` a tile is a toggle button that edits
 * the active category's pins directly (Model D, `pinEdit`), a pinned tile carries a 📌 badge + `aria-pressed`, a
 * no-stock tile cannot be newly pinned, and a 「選択中」 strip lists the pins (方式 D: CSS hides it while the sheet is
 * keyboard-fitted; badge / `aria-pressed` / re-tap unpin stay). The pins live in App (session-only) and come in as
 * props. `handEditing` defaults to false and GameScreen passes the enforcement flag (false until R6), so production
 * renders exactly the R5-b sheet: read-only tiles, no badge, no strip. The pantry never touches the Builder selection.
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
  /** LC-R5-c: pin editing (dormant: GameScreen passes the enforcement flag, false until R6). */
  handEditing?: boolean;
  /** The App-level session pins (read; only the active category is shown / edited). */
  pinSession?: HandSession;
  /** The only pin writer: an updater over the App-level session. */
  onPinSessionChange?: (update: (previous: HandSession) => HandSession) => void;
  /** LC-R5-d (OD-R5d-3, Model C): would the newly pinned id still be on the visible hand? Absent = no capacity rule.
   *  A refused pin changes nothing; the capacity-full feedback UI is R6. */
  pinFits?: (candidate: HandSession, id: string) => boolean;
}

const NO_PINS: HandSession = { sauce: [], cheese: [], topping: [] };

/**
 * LC-R6-c (OD-R5e-3 / OD-R6a-4, initial UX judged at the R6 real-device HV): the capacity-full notice. No number (the
 * capacity (12, OD-5) is never printed), shown for 3 s as an overlay toast at the sheet's bottom edge (it never
 * pushes the list or the strip), and mirrored in an always-mounted `role="status"` polite region.
 */
export const PIN_CAPACITY_NOTICE = "手元がいっぱいです。使わない食材のピンを外してね";
const PIN_NOTICE_MS = 3000;

export function IngredientPantry({
  category,
  ownedIngredientIds,
  inventory,
  onClose,
  handEditing = false,
  pinSession = NO_PINS,
  onPinSessionChange,
  pinFits,
}: IngredientPantryProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCompositionEndRef = useRef<number | null>(null);
  const [fieldFocused, setFieldFocused] = useState(false);
  const [search, updateSearch] = useReducer(
    (state: SearchInputState, action: (s: SearchInputState) => SearchInputState) => action(state),
    INITIAL_SEARCH_INPUT,
  );
  usePantryViewportFit(sheetRef, fieldFocused);
  const [activeShelf, setActiveShelf] = useState<ShelfFilter>("all");
  const catalog = useMemo(() => runtimeCatalog(), []);
  // LC-R6-c: a capacity-full refusal (a fresh object per refusal, so a repeated refusal restarts the 3 s timer).
  const [capacityNotice, setCapacityNotice] = useState<object | null>(null);
  useEffect(() => {
    if (capacityNotice === null) return;
    const timer = window.setTimeout(() => setCapacityNotice(null), PIN_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [capacityNotice]);

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
  const itemsFor = (shelves?: readonly IngredientShelfId[], text?: string) =>
    queryCatalog(catalog, ownership, emptyUsageSession(), { shelves, text }).filter((item) => item.category === category);
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
  // The search text goes ONLY into the row query (shelf AND text AND owned); the chips and the search field's
  // own visibility are derived from the owned rows without it.
  const showSearch = allItems.length > MAX_INGREDIENT_PALETTE_SLOTS;
  const appliedText = showSearch ? search.applied : "";
  const rows = toRows(itemsFor(shelfFilter === "all" ? undefined : [shelfFilter], appliedText));

  // LC-R5-c: pins of the active category only (invalid entries pruned on read). Kept across shelf / search (OD-2).
  const pinContext: HandContext = { category, catalog, ownership };
  const pins = handEditing ? pinsInCategory(pinSession, pinContext) : [];
  const showStrip = selectedStripRendered({ handEditing, pinCount: pins.length });
  function editPins(update: (previous: HandSession) => HandSession) {
    if (handEditing) onPinSessionChange?.(update);
  }
  /** One tile tap. A refused NEW pin (the hand would not hold it) shows the notice and writes nothing; any other
   *  action clears a showing notice at once. The decision itself is `togglePin` (R5-c / R5-d), unchanged. */
  function tapTile(id: string) {
    const result = togglePin(pinSession, id, pinContext, pinFits);
    if (result.outcome === "rejected-capacity") {
      setCapacityNotice({});
      return;
    }
    setCapacityNotice(null);
    editPins((previous) => togglePin(previous, id, pinContext, pinFits).session);
  }

  // A new applied text starts the list at the top (the sheet, the page and the fixed slots stay where they are).
  const previousAppliedRef = useRef(appliedText);
  useEffect(() => {
    if (previousAppliedRef.current !== appliedText && listRef.current) listRef.current.scrollTop = 0;
    previousAppliedRef.current = appliedText;
  }, [appliedText]);

  function handleShelfChange(next: ShelfFilter) {
    setActiveShelf(next);
    // Only the list's own scroll position: the sheet, the page and the chip row stay where they are.
    if (listRef.current) listRef.current.scrollTop = 0;
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const end = lastCompositionEndRef.current;
    const confirming = isConfirmEnter({
      eventIsComposing: event.nativeEvent.isComposing,
      keyCode: event.nativeEvent.keyCode,
      composing: search.composing,
      msSinceCompositionEnd: end === null ? null : event.timeStamp - end,
    });
    // Enter that confirms a conversion is the IME's; only a plain Enter finishes the search: the field lets go
    // (the keyboard closes) and focus moves to the list, so Escape / PageDown keep working from the sheet.
    if (confirming) return;
    event.preventDefault();
    inputRef.current?.blur();
    listRef.current?.focus();
  }

  return (
    <div className="pantry-sheet__backdrop" role="presentation" onClick={onClose}>
      <section
        ref={sheetRef}
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

        {/* OD-B: sauce / cheese have no subtitle (the step already says which); 具材 keeps its label. */}
        {category === "topping" && <p className="pantry-sheet__subtitle">{CATEGORY_LABEL[category]}</p>}

        {showSearch && (
          <div className="pantry-sheet__search" role="search">
            <input
              ref={inputRef}
              className="pantry-sheet__search-input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              aria-label="材料を検索"
              value={search.value}
              onChange={(event) => {
                const { value } = event.target;
                const composing = (event.nativeEvent as InputEvent).isComposing === true;
                updateSearch((state) => onSearchInput(state, value, composing));
              }}
              onCompositionStart={() => updateSearch(onSearchCompositionStart)}
              onCompositionEnd={(event) => {
                const value = event.currentTarget.value;
                lastCompositionEndRef.current = event.timeStamp;
                updateSearch((state) => onSearchCompositionEnd(state, value));
              }}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setFieldFocused(true)}
              onBlur={() => {
                setFieldFocused(false);
                updateSearch(onSearchBlur);
              }}
            />
            <button
              type="button"
              className="pantry-sheet__search-clear"
              aria-label="検索をクリア"
              // Keep the focus (and the keyboard) in the field: a press must not blur it.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                updateSearch(onSearchClear);
                inputRef.current?.focus();
              }}
            >
              ✕
            </button>
          </div>
        )}

        {showChips && (
          <div className="pantry-sheet__shelves">
            <ShelfChips shelves={presentShelves} active={shelfFilter} onChange={handleShelfChange} ariaLabel="具材の分類" />
          </div>
        )}

        {showStrip && (
          <div className="pantry-sheet__pins" role="group" aria-label="選択中の材料">
            <span className="pantry-sheet__pins-label" aria-hidden="true">
              {"\u{1F4CC}"} 選択中
            </span>
            <div className="pantry-sheet__pins-scroll">
              {pins.flatMap((id) => {
                const ingredient = getIngredient(id);
                return ingredient
                  ? [
                      <button
                        key={id}
                        type="button"
                        className="pantry-pin"
                        aria-label={`${ingredient.nameJa}を外す`}
                        onClick={() => {
                          setCapacityNotice(null);
                          editPins((previous) => togglePin(previous, id, pinContext).session);
                        }}
                      >
                        <IngredientGlyph ingredient={ingredient} />
                        <span className="pantry-pin__name">{ingredient.nameJa}</span>
                        <span aria-hidden="true">✕</span>
                      </button>,
                    ]
                  : [];
              })}
            </div>
            <button
              type="button"
              className="pantry-sheet__pins-reset"
              onClick={() => {
                setCapacityNotice(null);
                editPins((previous) => clearPins(previous, pinContext));
              }}
            >
              おまかせに戻す
            </button>
          </div>
        )}

        <div ref={listRef} className="pantry-sheet__list" role="region" aria-label="所持している材料" tabIndex={0}>
          {rows.length === 0 ? (
            <p className="pantry-sheet__empty">
              {allItems.length === 0 ? "まだこのカテゴリの材料を持っていません" : "該当する材料がありません"}
            </p>
          ) : (
            <ul className="pantry-sheet__grid">
              {rows.map(({ ingredient, stock }) => {
                const body = (
                  <>
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
                    <FamilyTag ingredientId={ingredient.id} className="pantry-tile__family" />
                    <span className={`pantry-tile__stock${stock === 0 ? " pantry-tile__stock--zero" : ""}`}>
                      {stock === "UNLIMITED" ? "∞" : `×${stock}`}
                    </span>
                  </>
                );
                if (!handEditing) {
                  return (
                    <li key={ingredient.id} className="pantry-tile">
                      {body}
                    </li>
                  );
                }
                const tile = pinTileState(ingredient.id, pins, stock);
                return (
                  <li key={ingredient.id} className="pantry-tile pantry-tile--editable">
                    <button
                      type="button"
                      className={`pantry-tile__toggle${tile.pinned ? " pantry-tile__toggle--pinned" : ""}`}
                      aria-pressed={tile.pinned}
                      aria-disabled={tile.disabled || undefined}
                      // LC-R6-c (OD-R5c-5 / OD-R6a-5, initial behavior): while the search field has the focus a tile press keeps
                      // it (and the keyboard), like the field's own clear button. Without a focused field nothing changes.
                      onPointerDown={(event) => {
                        if (fieldFocused) event.preventDefault();
                      }}
                      // A click (not pointerdown), so a touch scroll of the list never toggles a pin.
                      onClick={() => {
                        if (!tile.disabled) tapTile(ingredient.id);
                      }}
                    >
                      {body}
                      {tile.disabled && <span className="pantry-tile__no-stock">ざいこなし</span>}
                      {tile.pinned && (
                        <span className="pantry-tile__pin-badge" aria-hidden="true">
                          {"\u{1F4CC}"}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {handEditing && (
          <p
            className={`pantry-sheet__notice${capacityNotice === null ? "" : " pantry-sheet__notice--shown"}`}
            role="status"
            aria-live="polite"
          >
            {capacityNotice === null ? "" : PIN_CAPACITY_NOTICE}
          </p>
        )}
      </section>
    </div>
  );
}
