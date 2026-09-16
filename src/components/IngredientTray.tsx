import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  ingredientsByCategory,
  MAX_INGREDIENT_PALETTE_SLOTS,
  type Ingredient,
  type IngredientCategory,
} from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";
import { hasPieceDragIntent } from "../logic/pieceDrag";
import { IngredientPieceVisual } from "./IngredientPieceVisual";

interface IngredientTrayProps {
  activeCategory: IngredientCategory;
  onChangeCategory: (category: IngredientCategory) => void;
  selectedIngredientId: string | null;
  onSelectIngredient: (ingredient: Ingredient) => void;
  ownedIngredientIds: readonly string[];
  physicalDragEnabled?: boolean;
  draggableIngredientIds?: readonly string[];
  resolvePhysicalDrop?: (clientX: number, clientY: number) => DoughPoint | null;
  onPhysicalDrop?: (ingredient: Ingredient, point: DoughPoint) => void;
  /** Independent Review P2 (PR #26): bumped by the caller every time RESET_PIZZA fires (see
   *  GameScreen.tsx's `handleResetPizza`). RESET_PIZZA changes only `state.pizza` -- none of
   *  `physicalDragEnabled`/`selectedIngredientId`/`activeCategory` (the three signals already
   *  watched below) moves when it fires -- so without this, a second pointer resetting the
   *  pizza mid-drag left the first pointer's session alive to commit a stale `onPhysicalDrop`
   *  onto the freshly emptied pizza the moment it lifted. */
  resetToken?: number;
}

interface DragSession {
  pointerId: number;
  pointerType: string;
  ingredient: Ingredient;
  source: HTMLButtonElement;
  startX: number;
  startY: number;
  dragging: boolean;
}

interface DragPreview {
  ingredient: Ingredient;
  x: number;
  y: number;
  valid: boolean;
}

export function IngredientTray({
  activeCategory,
  onChangeCategory,
  selectedIngredientId,
  onSelectIngredient,
  ownedIngredientIds,
  physicalDragEnabled = false,
  draggableIngredientIds = [],
  resolvePhysicalDrop,
  onPhysicalDrop,
  resetToken,
}: IngredientTrayProps) {
  // Phase 4A-1B Human Feel Fix 2: the visible grid stays a fixed 3x2 (MAX_INGREDIENT_PALETTE_SLOTS
  // in data/ingredients.ts), no scrolling. Independent Review P1 (PR #26, discussion_r4017018587):
  // a 7th owned ingredient in one category (onion, once purchased, joins 6 existing topping
  // ingredients) was unconditionally sliced off and could never be selected. Rather than special
  // -casing onion, owned ingredients in the active category are now paged MAX_INGREDIENT_PALETTE_
  // SLOTS at a time -- a category with <=6 owned (every category today, minus a purchased onion)
  // renders exactly as before with no page control at all; a 7th+ owned ingredient becomes
  // reachable via a small page nav rendered only when it's actually needed.
  const [page, setPage] = useState(0);
  const categoryItems = ingredientsByCategory(activeCategory).filter((i) =>
    ownedIngredientIds.includes(i.id),
  );
  const pageCount = Math.max(1, Math.ceil(categoryItems.length / MAX_INGREDIENT_PALETTE_SLOTS));
  const currentPage = Math.min(page, pageCount - 1);
  const items = categoryItems.slice(
    currentPage * MAX_INGREDIENT_PALETTE_SLOTS,
    (currentPage + 1) * MAX_INGREDIENT_PALETTE_SLOTS,
  );
  const sessionRef = useRef<DragSession | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickIdRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Phase 4A-1B Human Feel fix: set the instant a physical ingredient is touched (not once
  // drag-intent is confirmed), purely so `.ingredient-chip--grabbing` can give the finger
  // immediate visual confirmation. Never read for drag/drop logic -- sessionRef stays the
  // single source of truth there.
  const [grabbedId, setGrabbedId] = useState<string | null>(null);

  function clearScheduledFrame() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingPointRef.current = null;
  }

  function clearSession() {
    const session = sessionRef.current;
    sessionRef.current = null;
    clearScheduledFrame();
    setPreview(null);
    setGrabbedId(null);
    if (session) {
      try {
        session.source.releasePointerCapture(session.pointerId);
      } catch {
        // Capture may already be gone after pointerup/cancel or an app switch.
      }
    }
  }

  function schedulePreview(clientX: number, clientY: number) {
    pendingPointRef.current = { x: clientX, y: clientY };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const session = sessionRef.current;
      const point = pendingPointRef.current;
      pendingPointRef.current = null;
      if (!session?.dragging || !point) return;
      setPreview({
        ingredient: session.ingredient,
        x: point.x,
        y: point.y - 30,
        valid: resolvePhysicalDrop?.(point.x, point.y) !== null,
      });
    });
  }

  function finishDrag(pointerId: number, clientX: number, clientY: number, commit: boolean) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== pointerId) return;
    if (session.dragging) {
      suppressClickIdRef.current = session.ingredient.id;
      window.setTimeout(() => {
        if (suppressClickIdRef.current === session.ingredient.id) suppressClickIdRef.current = null;
      }, 0);
      const point = commit ? resolvePhysicalDrop?.(clientX, clientY) : null;
      if (point && onPhysicalDrop) {
        onPhysicalDrop(session.ingredient, point);
        setAnnouncement(`${session.ingredient.nameJa}をピザに置きました`);
      } else {
        setAnnouncement(`${session.ingredient.nameJa}の配置をキャンセルしました`);
      }
    }
    clearSession();
  }

  useEffect(() => {
    function handleWindowPointerUp(event: PointerEvent) {
      finishDrag(event.pointerId, event.clientX, event.clientY, true);
    }
    function handleWindowPointerCancel(event: PointerEvent) {
      finishDrag(event.pointerId, event.clientX, event.clientY, false);
    }
    function abort() {
      const session = sessionRef.current;
      if (session) finishDrag(session.pointerId, 0, 0, false);
    }
    function handleVisibility() {
      if (document.hidden) abort();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") abort();
    }
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("keydown", handleKeyDown);
      clearScheduledFrame();
    };
    // The window bridge is lifecycle-only. App's resolver is stable and dispatch callbacks
    // remain valid for the component lifetime; keeping one listener set also avoids a drag
    // preview frame being cancelled by the selection rerender that starts the gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!physicalDragEnabled && sessionRef.current) clearSession();
  }, [physicalDragEnabled]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session && selectedIngredientId !== session.ingredient.id) clearSession();
  }, [selectedIngredientId]);

  useEffect(() => {
    if (sessionRef.current) clearSession();
    setPage(0);
  }, [activeCategory]);

  // A page switch unmounts the currently-dragged chip's button element (React reconciles it
  // away once it's no longer in `items`), so any in-flight session on it must end the same way
  // switching category already does -- otherwise its pointer capture and window listeners would
  // keep tracking a session bound to a chip no longer on screen.
  useEffect(() => {
    if (sessionRef.current) clearSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires purely off the page change.
  }, [currentPage]);

  useEffect(() => {
    if (sessionRef.current) clearSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires purely off the token bump.
  }, [resetToken]);

  function goToPage(next: number) {
    setPage(Math.max(0, Math.min(pageCount - 1, next)));
  }

  function isDraggable(ingredient: Ingredient): boolean {
    return physicalDragEnabled && draggableIngredientIds.includes(ingredient.id);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, ingredient: Ingredient) {
    if (!isDraggable(ingredient) || !event.isPrimary || sessionRef.current) return;
    sessionRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      ingredient,
      source: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    setGrabbedId(ingredient.id);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners finish the gesture if capture is unavailable.
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!session.dragging) {
      if (!hasPieceDragIntent(
        session.startX,
        session.startY,
        event.clientX,
        event.clientY,
        session.pointerType,
      )) return;
      session.dragging = true;
      onSelectIngredient(session.ingredient);
    }
    event.preventDefault();
    schedulePreview(event.clientX, event.clientY);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    finishDrag(event.pointerId, event.clientX, event.clientY, true);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    finishDrag(event.pointerId, event.clientX, event.clientY, false);
  }

  function handleLostPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    if (session?.pointerId === event.pointerId) finishDrag(event.pointerId, 0, 0, false);
  }

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>, ingredient: Ingredient) {
    if (suppressClickIdRef.current === ingredient.id) {
      event.preventDefault();
      suppressClickIdRef.current = null;
      return;
    }
    if (sessionRef.current) {
      event.preventDefault();
      return;
    }
    onSelectIngredient(ingredient);
    if (isDraggable(ingredient)) {
      setAnnouncement(`${ingredient.nameJa}を選びました。ピザをタップして置けます`);
    }
  }

  return (
    <div className="ingredient-panel">
      <div className="category-tabs">
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            className={`category-tab category-tab--${category} ${
              activeCategory === category ? "category-tab--active" : ""
            }`}
            onClick={() => onChangeCategory(category)}
          >
            {CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>
      <div className="ingredient-tray">
        {items.map((ingredient) => (
          <button
            key={ingredient.id}
            type="button"
            className={`ingredient-chip ${
              selectedIngredientId === ingredient.id ? "ingredient-chip--selected" : ""
            } ${isDraggable(ingredient) ? "ingredient-chip--physical" : ""} ${
              grabbedId === ingredient.id ? "ingredient-chip--grabbing" : ""
            }`}
            aria-pressed={selectedIngredientId === ingredient.id}
            onPointerDown={(event) => handlePointerDown(event, ingredient)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handleLostPointerCapture}
            onClick={(event) => handleClick(event, ingredient)}
          >
            {ingredient.category === "cheese" ? (
              <span className="ingredient-chip__cheese-slot">
                <IngredientPieceVisual ingredient={ingredient} />
              </span>
            ) : (
              <IngredientPieceVisual
                ingredient={ingredient}
                emojiClassName="ingredient-chip__emoji"
              />
            )}
            <span className="ingredient-chip__name">{ingredient.nameJa}</span>
            {isDraggable(ingredient) && <span className="ingredient-chip__drag-hint">上へドラッグ</span>}
          </button>
        ))}
      </div>

      {/* Independent Review P1 (PR #26): only rendered once a category actually owns more than
          MAX_INGREDIENT_PALETTE_SLOTS ingredients -- every category today stays exactly as it
          was pre-fix (no nav, no layout change) until a 7th ingredient in one category is
          actually owned. Page switching, not scrolling, so it never reintroduces the
          single-finger-swipe conflict Fix 2 removed. */}
      {pageCount > 1 && (
        <div className="ingredient-page-nav" role="group" aria-label="素材ページ切り替え">
          <button
            type="button"
            className="ingredient-page-nav__button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0}
            aria-label="前のページ"
          >
            {"◀"}
          </button>
          <span className="ingredient-page-nav__label">
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="ingredient-page-nav__button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === pageCount - 1}
            aria-label="次のページ"
          >
            {"▶"}
          </button>
        </div>
      )}

      {preview && (
        <div
          className={`piece-drag-preview piece-drag-preview--${preview.ingredient.id} ${
            preview.valid ? "piece-drag-preview--valid" : ""
          }`}
          style={{ left: preview.x, top: preview.y }}
          aria-hidden="true"
        >
          <IngredientPieceVisual
            ingredient={preview.ingredient}
            emojiClassName="piece-drag-preview__emoji"
          />
        </div>
      )}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
