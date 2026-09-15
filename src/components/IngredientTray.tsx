import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  ingredientsByCategory,
  type Ingredient,
  type IngredientCategory,
} from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";
import { hasPieceDragIntent } from "../logic/pieceDrag";

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
}: IngredientTrayProps) {
  const items = ingredientsByCategory(activeCategory).filter((i) =>
    ownedIngredientIds.includes(i.id),
  );
  const sessionRef = useRef<DragSession | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickIdRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [announcement, setAnnouncement] = useState("");

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
  }, [activeCategory]);

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
            } ${isDraggable(ingredient) ? "ingredient-chip--physical" : ""}`}
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
                <span
                  className={`pizza-cheese pizza-cheese--${ingredient.id}`}
                  style={{ "--cheese-color": ingredient.color } as CSSProperties}
                />
              </span>
            ) : (
              <span className="ingredient-chip__emoji">{ingredient.emoji}</span>
            )}
            <span className="ingredient-chip__name">{ingredient.nameJa}</span>
            {isDraggable(ingredient) && <span className="ingredient-chip__drag-hint">上へドラッグ</span>}
          </button>
        ))}
      </div>

      {preview && (
        <div
          className={`piece-drag-preview piece-drag-preview--${preview.ingredient.id} ${
            preview.valid ? "piece-drag-preview--valid" : ""
          }`}
          style={{ left: preview.x, top: preview.y }}
          aria-hidden="true"
        >
          {preview.ingredient.category === "cheese" ? (
            <span
              className={`pizza-cheese pizza-cheese--${preview.ingredient.id}`}
              style={{ "--cheese-color": preview.ingredient.color } as CSSProperties}
            />
          ) : (
            <span className="piece-drag-preview__emoji">{preview.ingredient.emoji}</span>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
