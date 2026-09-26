import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { gameReducer, type MakingStep } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { getRecipe } from "../data/recipes";
import { resolvePieceDrop } from "../logic/pieceDrag";
import {
  getIngredient,
  ingredientsByCategory,
  INGREDIENTS,
  MAX_INGREDIENT_PALETTE_SLOTS,
  STARTER_INGREDIENT_IDS,
  type Ingredient,
  type IngredientCategory,
} from "../data/ingredients";
import type { Recipe } from "../data/recipes";

// EP4: every finite ingredient (onion/gorgonzola/garlic/etc.) reads as stock-0 -- and, per
// Issue #86, disabled/unselectable -- unless it's actually been granted/purchased stock. This
// file is about paging/selection mechanics, not the Stock Gate itself (see
// IngredientTray.recommendedOther.test.tsx for that), so every finite ingredient gets generous
// stock here, exactly like GameScreen.keyboardOverlay.test.tsx's own `GENEROUS_INVENTORY`.
const GENEROUS_INVENTORY = Object.fromEntries(
  INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 999]),
);

/**
 * Human Feel Fix 2 (2nd iPhone retest): scrolling the Ingredient Tray and dragging a piece
 * onto the pizza were the same single-finger swipe, so every drag start doubled as a
 * candidate scroll the browser had to arbitrate -- read by hands-on retesting as "still
 * unresponsive" even after Fix 1's threshold/iOS-callout work. This file covers what Fix 2
 * actually changed: the tray is a non-scrolling, capped 3x2 grid (`MAX_INGREDIENT_PALETTE_SLOTS`,
 * src/data/ingredients.ts). It intentionally does not repeat
 * IngredientTray.physicalDragReset.test.tsx's own coverage (RESET-mid-drag, outside-drop,
 * pointercancel, lostpointercapture, blur, visibilitychange, multi-touch) -- that file is
 * re-run unmodified alongside this one and still exercises the same IngredientTray component.
 *
 * Issue #159 P0 update: the tray no longer splits owned ingredients into "Recommended"/"Other"
 * (see IngredientTray.tsx / IngredientTray.recommendedOther.test.tsx) -- only this recipe's own
 * `requiredIngredients` (still owned-gated) render at all. The pagination-boundary tests below
 * that used to force every fixture ingredient into "Other" via a *zeroed*-requirements recipe
 * override now use a *widened*-requirements override instead (`allRequiredRecipe`), so the same
 * boundary fixtures still all render (now because the recipe requires every one of them, not
 * because pagination used to only apply to "Other").
 */

const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300 } as DOMRect;
const INSIDE_CLIENT = { x: 150, y: 150 };

// Issue #32 Phase 2: PLACE_TOPPING is now gated on the reducer's own `makingStep` matching
// the placed ingredient's category (see gameReducer.ts) -- a Harness mounted to exercise a
// given category's physical drag must advance the making flow to that category's own step
// first, via CONFIRM_MAKING_STEP, exactly like a real player's "次へ" tap would.
const CATEGORY_TO_MAKING_STEP: Record<IngredientCategory, MakingStep> = {
  sauce: "SAUCE",
  cheese: "CHEESE",
  topping: "TOPPING",
};

function Harness({
  category,
  ownedIngredientIds = STARTER_INGREDIENT_IDS,
  recipeOverride,
}: {
  category: IngredientCategory;
  ownedIngredientIds?: readonly string[];
  /** Test-only override of the `recipe` prop IngredientTray reads its offered-ingredient list
   *  from (IngredientTray.tsx never reads `recipe.id`, only `requiredIngredients`) -- lets the
   *  pagination-boundary tests below exercise it against every real, production `topping`
   *  ingredient (still real data, never a synthetic fixture) rather than being capped at
   *  whatever margherita's own real `basil` requirement alone would show. */
  recipeOverride?: Recipe;
}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    // Discovery 2.0: a guided round of an already-discovered margherita.
    let initial = gameReducer(createGuidedInitialState("margherita", { ownedIngredientIds }), {
      type: "BEGIN_PREPARE",
    });
    const targetStep = CATEGORY_TO_MAKING_STEP[category];
    while (initial.makingStep !== targetStep) {
      initial = gameReducer(initial, { type: "CONFIRM_MAKING_STEP" });
    }
    return initial;
  });
  const [resetToken, setResetToken] = useState(0);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);

  function resolvePhysicalDrop(clientX: number, clientY: number) {
    return resolvePieceDrop(clientX, clientY, DOUGH_RECT);
  }

  function handlePhysicalDrop(ingredient: Ingredient, point: { x: number; y: number }) {
    dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x: point.x, y: point.y });
  }

  function handleResetPizza() {
    setResetToken((token) => token + 1);
    dispatch({ type: "RESET_PIZZA" });
  }

  return (
    <div>
      <button type="button" onClick={handleResetPizza}>
        やり直す
      </button>
      <span data-testid="topping-count">{state.pizza.toppings.length}</span>
      <span data-testid="selected-id">{selectedIngredientId ?? ""}</span>
      <IngredientTray
        activeCategory={category}
        selectedIngredientId={selectedIngredientId}
        onSelectIngredient={(ingredient) => setSelectedIngredientId(ingredient.id)}
        ownedIngredientIds={state.ownedIngredientIds}
        recipe={recipeOverride ?? state.recipe}
        inventory={GENEROUS_INVENTORY}
        pizza={state.pizza}
        physicalDragEnabled
        draggableIngredientIds={["mozzarella", "basil"]}
        resolvePhysicalDrop={resolvePhysicalDrop}
        onPhysicalDrop={handlePhysicalDrop}
        resetToken={resetToken}
      />
    </div>
  );
}

function toppingCount(): number {
  return Number(screen.getByTestId("topping-count").textContent);
}

function findChip(ingredientId: string): HTMLElement {
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) throw new Error(`Unknown ingredient fixture: ${ingredientId}`);
  return screen.getByRole("button", { name: new RegExp(ingredient.nameJa) });
}

/** The tray's one ingredient grid -- the one that pages (see IngredientTray.tsx's own doc
 *  comment on paging). */
function tray(): HTMLElement {
  const el = document.querySelector(".ingredient-section .ingredient-tray");
  if (!el) throw new Error("Ingredient tray grid not found");
  return el as HTMLElement;
}

/** Builds a Recipe requiring exactly the given ingredient ids (any `minCount`), so every one of
 *  them is offered by the tray regardless of margherita's own real (much smaller) requirement
 *  list -- see this file's own header comment. */
function requireExactly(requiredIds: readonly string[]): Recipe {
  const margherita = getRecipe("margherita");
  if (!margherita) throw new Error("margherita fixture missing");
  return {
    ...margherita,
    requiredIngredients: requiredIds.map((ingredientId) => ({ ingredientId, minCount: 1 })),
  };
}

function startDrag(chip: HTMLElement, pointerId: number) {
  fireEvent.pointerDown(chip, {
    pointerId,
    isPrimary: true,
    pointerType: "mouse",
    clientX: 20,
    clientY: 20,
  });
  fireEvent.pointerMove(chip, { pointerId, clientX: 40, clientY: 20 });
}

afterEach(() => {
  cleanup();
});

describe("Ingredient Palette: fixed 3x2 grid, no scroll (Human Feel Fix 2)", () => {
  it("renders every owned-and-required ingredient in a category that has <=6, matching pre-fix behavior", () => {
    render(<Harness category="topping" recipeOverride={requireExactly(["basil"])} />);
    const owned = ingredientsByCategory("topping").filter((i) =>
      STARTER_INGREDIENT_IDS.includes(i.id),
    );
    expect(owned.length).toBeLessThanOrEqual(MAX_INGREDIENT_PALETTE_SLOTS);
    for (const ingredient of owned) {
      expect(findChip(ingredient.id)).toBeInTheDocument();
    }
  });

  it("caps the grid at MAX_INGREDIENT_PALETTE_SLOTS even when more are owned+required (never falls back to scroll)", () => {
    const allToppingIds = ingredientsByCategory("topping").map((i) => i.id);
    expect(allToppingIds.length).toBeGreaterThan(MAX_INGREDIENT_PALETTE_SLOTS);
    const owned = [...STARTER_INGREDIENT_IDS, ...allToppingIds];

    render(<Harness category="topping" ownedIngredientIds={owned} recipeOverride={requireExactly(allToppingIds)} />);

    const chips = within(tray()).getAllByRole("button");
    expect(chips).toHaveLength(MAX_INGREDIENT_PALETTE_SLOTS);
  });

  it("the grid container has no horizontal-scroll marker (grid replaces the old scrolling row)", () => {
    render(
      <Harness
        category="cheese"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "gorgonzola"]}
        recipeOverride={requireExactly(["mozzarella", "gorgonzola"])}
      />,
    );
    const el = tray();
    expect(el.className).not.toMatch(/scroll/i);
    // jsdom does not apply the stylesheet, so this only guards against an inline override
    // reintroducing scroll -- the real overflow-x:0 check is the 390x844 browser
    // verification in the Result Report.
    expect(el.style.overflowX).toBe("");
  });

  it("physical drag onto the pizza still works", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(1);
  });

  it("tap fallback (click, no drag) still selects an ingredient", () => {
    render(<Harness category="topping" />);
    const chip = findChip("basil");

    fireEvent.click(chip);

    expect(screen.getByTestId("selected-id").textContent).toBe("basil");
  });

  it("RESET_PIZZA mid-drag still discards a stale physical-drag session", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("outside-drop safety net still holds", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 900, clientY: 900 });

    expect(toppingCount()).toBe(0);
  });
});

describe("Purchased onion stays reachable via page nav (Independent Review P1, PR #26)", () => {
  // Recipe Expansion Batch 1A/1B-A grew the topping catalog to 13 -- "every topping" would no
  // longer pin the original 7-owned/2-page boundary this suite exists to test (it'd instead be
  // ceil(13/6)=3 pages), so this stays an explicit 7-topping list (the same original 6 from the
  // "exactly 6 owned" case below, plus `onion` as the one revealed by page nav), matching that
  // test's own already-established convention for the same reason.
  const sevenOwnedTopping = [
    ...STARTER_INGREDIENT_IDS,
    "basil",
    "garlic",
    "oregano",
    "cherry-tomato",
    "egg",
    "mushroom",
    "onion",
  ];
  // Issue #159 P0: the tray only ever offers owned ingredients the recipe requires -- this
  // override requires every one of `sevenOwnedTopping`'s topping ids so the pagination boundary
  // below is still reachable (the real margherita recipe alone requires only `basil`).
  const sevenToppingRequirement = ["basil", "garlic", "oregano", "cherry-tomato", "egg", "mushroom", "onion"];
  const allSevenRequiredRecipe = requireExactly(sevenToppingRequirement);
  const sixToppingRequirement = ["basil", "garlic", "oregano", "cherry-tomato", "egg", "mushroom"];
  const sixRequiredRecipe = requireExactly(sixToppingRequirement);

  it("with <=6 owned-and-required in a category, no page nav is rendered (unchanged from pre-fix)", () => {
    render(<Harness category="topping" recipeOverride={requireExactly(["basil"])} />);
    expect(screen.queryByRole("group", { name: "素材ページ切り替え" })).not.toBeInTheDocument();
  });

  it("with exactly 6 owned-and-required, no page nav is rendered", () => {
    // EP4: only `basil` remains Starter among toppings now (garlic/oregano/cherry-tomato/egg/
    // mushroom all gained their own `unlockCondition`) -- own every pre-Batch-1A topping except
    // `onion` explicitly (as production's Starter Grants would have by this point). Batch 1A
    // added 4 more toppings (sausage/pepperoni/anchovy/tuna) to the catalog, so this boundary
    // case is now pinned via an explicit list rather than "every topping" (which would be 13,
    // not 6) -- still the same original 6-topping boundary this test exists to pin.
    expect(sixToppingRequirement).toHaveLength(MAX_INGREDIENT_PALETTE_SLOTS);
    render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, ...sixToppingRequirement]}
        recipeOverride={sixRequiredRecipe}
      />,
    );
    expect(screen.queryByRole("group", { name: "素材ページ切り替え" })).not.toBeInTheDocument();
    expect(within(tray()).getAllByRole("button")).toHaveLength(MAX_INGREDIENT_PALETTE_SLOTS);
  });

  it("with 7 owned-and-required (onion included), page 1 shows the original 6 and hides onion", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} recipeOverride={allSevenRequiredRecipe} />);
    expect(screen.getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /たまねぎ/ })).not.toBeInTheDocument();
  });

  it("navigating to page 2 reveals onion, and it can be selected", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} recipeOverride={allSevenRequiredRecipe} />);

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    const onionChip = screen.getByRole("button", { name: /たまねぎ/ });
    expect(onionChip).toBeInTheDocument();

    fireEvent.click(onionChip);
    expect(screen.getByTestId("selected-id").textContent).toBe("onion");
  });

  it("onion is not in draggableIngredientIds, so it selects via tap like every other non-physical topping", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} recipeOverride={allSevenRequiredRecipe} />);
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    const onionChip = screen.getByRole("button", { name: /たまねぎ/ });

    expect(onionChip.className).not.toMatch(/ingredient-chip--physical/);
    fireEvent.click(onionChip);
    expect(screen.getByTestId("selected-id").textContent).toBe("onion");
  });

  it("the 前のページ button is disabled on page 1 and 次のページ disabled on the last page", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} recipeOverride={allSevenRequiredRecipe} />);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByRole("button", { name: "前のページ" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("switching category resets back to page 1", () => {
    const { rerender } = render(
      <Harness category="topping" ownedIngredientIds={sevenOwnedTopping} recipeOverride={allSevenRequiredRecipe} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    rerender(<Harness category="cheese" ownedIngredientIds={sevenOwnedTopping} recipeOverride={allSevenRequiredRecipe} />);
    rerender(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} recipeOverride={allSevenRequiredRecipe} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("switching pages mid-drag aborts the stale session (no commit onto the new page)", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} recipeOverride={allSevenRequiredRecipe} />);
    const chip = findChip("garlic");

    startDrag(chip, 1);
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("no regression: Basil selection and physical drag on page 1 still work with 7 owned", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);
    const chip = findChip("basil");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(1);
  });
});
