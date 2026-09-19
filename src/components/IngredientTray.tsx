import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ingredientsByCategory,
  MAX_INGREDIENT_PALETTE_SLOTS,
  type Ingredient,
  type IngredientCategory,
} from "../data/ingredients";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import type { DoughPoint } from "../logic/pizzaCoordinates";
import { hasPieceDragIntent } from "../logic/pieceDrag";
import type { Recipe } from "../data/recipes";
import { canPlaceIngredient, remainingStock, type InventoryState } from "../state/inventory";
import type { PizzaState } from "../state/pizzaState";

interface IngredientTrayProps {
  activeCategory: IngredientCategory;
  /** Issue #86: the making-step tab strip (MakingStepTabs.tsx, rendered by GameScreen) is now
   *  the tray's own former `category-tabs` -- no in-tray control drives a category switch any
   *  more. Kept optional purely so any remaining caller that still threads App.tsx's old,
   *  already-inert `handleChangeCategory` through doesn't need to change; never read here. */
  onChangeCategory?: (category: IngredientCategory) => void;
  selectedIngredientId: string | null;
  onSelectIngredient: (ingredient: Ingredient) => void;
  ownedIngredientIds: readonly string[];
  /** Issue #86: drives the "このピザにおすすめ" grouping below -- the current round's recipe,
   *  unchanged for both FREE and Lunch Rush (Lunch Rush's own order recipe already flows through
   *  `state.recipe` exactly like FREE's does, so no mode branching is needed here to make
   *  "required ingredients surface first" true for Lunch Rush too). */
  recipe: Recipe;
  /** Issue #86: read-only inputs to the EP3 Stock Gate (`canPlaceIngredient`) and EP1/EP3's own
   *  `remainingStock` -- both already-shipped, reducer-shared functions (src/state/inventory.ts),
   *  reused here purely for *display* (remaining-count badge, disabled chip). Placement itself is
   *  still gated exclusively at the reducer boundary (APPLY_SAUCE/COMMIT_SAUCE_DISPENSE/
   *  PLACE_TOPPING, src/state/gameReducer.ts) -- nothing here bypasses or re-implements that gate,
   *  a disabled chip only ever prevents a *doomed* placement attempt from starting. */
  inventory: InventoryState;
  pizza: PizzaState;
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
  /** Issue #32 Phase 2: bumped by the reducer's own CONFIRM_MAKING_STEP/RESET_PIZZA (see
   *  GameState.makingStepToken, src/state/gameReducer.ts). A step confirmation changes only
   *  `state.makingStep` -- none of the three signals already watched above move when it
   *  fires -- so without this, a physical-drag session started while a step was still open
   *  could survive the confirmation and commit onto the step that follows it. Mirrors
   *  `resetToken`'s own effect below exactly. */
  makingStepToken?: number;
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
  selectedIngredientId,
  onSelectIngredient,
  ownedIngredientIds,
  recipe,
  inventory,
  pizza,
  physicalDragEnabled = false,
  draggableIngredientIds = [],
  resolvePhysicalDrop,
  onPhysicalDrop,
  resetToken,
  makingStepToken,
}: IngredientTrayProps) {
  // Issue #86 (Ingredient Tray Scalability): rather than one flat list of every owned ingredient
  // in the active category (which stopped scaling well past the current ~14-ingredient catalog --
  // see docs/reports/TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md), the tray splits owned
  // ingredients into two groups. "Recommended" is this round's own recipe requirements
  // (`recipe.requiredIngredients`) that fall in the active category and are actually owned --
  // deliberately the *same* field for FREE and Lunch Rush (Lunch Rush's `state.recipe` is already
  // the current order's own recipe, so "surface what this order needs first" falls out of reusing
  // this one field rather than a Mission-only branch). "Other" is every remaining owned ingredient
  // in the category, so FREE creativity is never restricted to only the recommended set -- see
  // this file's own IngredientTrayProps doc comment.
  const recommendedIds = new Set(
    recipe.requiredIngredients
      .map((requirement) => requirement.ingredientId)
      .filter((id) => ownedIngredientIds.includes(id)),
  );
  const recommendedItems = ingredientsByCategory(activeCategory).filter((i) =>
    recommendedIds.has(i.id),
  );
  const otherItems = ingredientsByCategory(activeCategory).filter(
    (i) => ownedIngredientIds.includes(i.id) && !recommendedIds.has(i.id),
  );

  // Phase 4A-1B Human Feel Fix 2: the visible "Other" grid stays a fixed 3x2
  // (MAX_INGREDIENT_PALETTE_SLOTS in data/ingredients.ts), no scrolling. Independent Review P1
  // (PR #26, discussion_r4017018587): a 7th owned ingredient in one category was unconditionally
  // sliced off and could never be selected. Rather than special-casing it, owned "Other"
  // ingredients are paged MAX_INGREDIENT_PALETTE_SLOTS at a time -- a category with <=6 "Other"
  // owned (every category today) renders exactly as before with no page control at all; a 7th+
  // becomes reachable via a small page nav rendered only when it's actually needed. Issue #86:
  // this is also the mechanism that keeps a 30/62+-ingredient catalog from ever rendering more
  // than 6 "Other" chips at once, alongside the small, recipe-bounded "Recommended" row above it
  // (a recipe's own requiredIngredients count is curated, authored data -- never large enough on
  // its own to need paging; see the Result Report's 30/62-ingredient scalability verification).
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(otherItems.length / MAX_INGREDIENT_PALETTE_SLOTS));
  const currentPage = Math.min(page, pageCount - 1);
  const items = otherItems.slice(
    currentPage * MAX_INGREDIENT_PALETTE_SLOTS,
    (currentPage + 1) * MAX_INGREDIENT_PALETTE_SLOTS,
  );
  const sessionRef = useRef<DragSession | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickIdRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Visual Polish 1A (Ingredient Tray Overflow, P1-1): whether any tray content -- the last
  // "Other" row, or the page-nav -- still sits below the area actually visible above the fixed
  // `.prepare-bake-bar`. `contentEndRef` marks the true end of that content (see
  // `.ingredient-panel__content-end` in App.css); the observer's `rootMargin` shrinks its
  // effective viewport by roughly the CTA bar's own reserved height so "intersecting" means
  // "visible above the bar", not merely "within the raw window bounds" (which would include the
  // dead space the bar itself covers). This replaces hand-rolled scrollY/scrollHeight math with
  // one browser-native signal that already recomputes itself on scroll, resize, and any layout
  // change (category switch, page switch, Recommended row appearing/disappearing) without this
  // component needing to know why its own content height just changed.
  const contentEndRef = useRef<HTMLDivElement | null>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
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
    const target = contentEndRef.current;
    // jsdom (this project's unit-test DOM, see vitest.config.ts) has no IntersectionObserver;
    // the cue then simply never shows in tests unless a test explicitly stubs it in (see
    // IngredientTray.scrollCue.test.tsx), which is the correct default -- a unit test
    // environment has no real scroll/viewport to reason about anyway.
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setHasMoreBelow(!entry.isIntersecting),
      // At maximum scroll, the sentinel (the true end of in-flow content) sits exactly
      // `--bake-bar-reserve` (App.css, 84px) above the viewport's bottom edge -- that's what
      // the reserved padding-bottom *is* -- so shrinking the observer's effective viewport by
      // slightly less than that (78px) is what makes "intersecting" track "scrolled all the
      // way down" rather than firing a few pixels early or (worse, leaving the cue stuck on
      // forever) never firing at all.
      { rootMargin: "0px 0px -78px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
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

  useEffect(() => {
    if (sessionRef.current) clearSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires purely off the token bump.
  }, [makingStepToken]);

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

  // Issue #86 (Inventory表示): read-only display of the EP1/EP3 Stock Gate's own state --
  // `canPlaceIngredient`/`remainingStock` are the exact same functions CONFIRM_MAKING_STEP's
  // sibling actions (APPLY_SAUCE/COMMIT_SAUCE_DISPENSE/PLACE_TOPPING) already gate placement on
  // (src/state/gameReducer.ts), never a re-implementation. A disabled chip's `disabled`
  // attribute keeps it out of both click and pointer-drag activation (matching the pre-existing
  // locked-tab pattern), so an out-of-stock ingredient can never even be *selected* here -- but
  // the reducer's own gate remains the sole real enforcement either way (this only spares the
  // player a doomed placement attempt).
  function renderChip(ingredient: Ingredient) {
    const stock = remainingStock(ingredient, inventory);
    const placeable = canPlaceIngredient(ingredient, inventory, pizza);
    return (
      <button
        key={ingredient.id}
        type="button"
        className={`ingredient-chip ${
          selectedIngredientId === ingredient.id ? "ingredient-chip--selected" : ""
        } ${isDraggable(ingredient) ? "ingredient-chip--physical" : ""} ${
          grabbedId === ingredient.id ? "ingredient-chip--grabbing" : ""
        } ${!placeable ? "ingredient-chip--disabled" : ""}`}
        aria-pressed={selectedIngredientId === ingredient.id}
        disabled={!placeable}
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
          <span className="ingredient-chip__emoji">{ingredient.emoji}</span>
        )}
        <span className="ingredient-chip__name">{ingredient.nameJa}</span>
        <span className="ingredient-chip__stock">{stock === "UNLIMITED" ? "∞" : `×${stock}`}</span>
        {isDraggable(ingredient) && <span className="ingredient-chip__drag-hint">上へドラッグ</span>}
      </button>
    );
  }

  return (
    <div className="ingredient-panel">
      {/* Issue #86 (Ingredient Tray Scalability): "このピザにおすすめ" -- this round's own recipe
          requirements, owned and in the active category. Omitted entirely once empty (a recipe
          with no requirement in this category, e.g. marinara has no CHEESE requirement at all)
          rather than showing an empty heading. */}
      {recommendedItems.length > 0 && (
        <section className="ingredient-section ingredient-section--recommended">
          <h3 className="ingredient-section__title">このピザにおすすめ</h3>
          <div className="ingredient-row ingredient-row--recommended">
            {recommendedItems.map((ingredient) => renderChip(ingredient))}
          </div>
        </section>
      )}

      {/* "その他" -- every other owned ingredient in the active category, so FREE play is never
          limited to only the recommended set (see IngredientTrayProps' own doc comment). */}
      <section className="ingredient-section ingredient-section--other">
        {recommendedItems.length > 0 && otherItems.length > 0 && (
          <h3 className="ingredient-section__title">その他</h3>
        )}
        <div className="ingredient-tray">{items.map((ingredient) => renderChip(ingredient))}</div>
      </section>

      {/* Independent Review P1 (PR #26): only rendered once "Other" actually owns more than
          MAX_INGREDIENT_PALETTE_SLOTS ingredients -- every category today stays exactly as it
          was pre-fix (no nav, no layout change) until a 7th "Other" ingredient in one category is
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

      {/* Visual Polish 1A (Ingredient Tray Overflow, P1-1): the true end of this panel's
          in-flow content -- see this ref's own doc comment above and `.ingredient-panel__
          content-end` in App.css. Always rendered (zero height, aria-hidden) so the observer
          has one stable node to watch across category/page changes. */}
      <div ref={contentEndRef} className="ingredient-panel__content-end" aria-hidden="true" />
      {hasMoreBelow && (
        <div className="ingredient-scroll-cue" aria-hidden="true">
          <span className="ingredient-scroll-cue__chevron">{"▼"}</span>
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
          {preview.ingredient.category === "cheese" ? (
            <IngredientPieceVisual ingredient={preview.ingredient} />
          ) : (
            <span className="piece-drag-preview__emoji">{preview.ingredient.emoji}</span>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
