import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PizzaSelectScreen } from "./PizzaSelectScreen";
import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../state/dex";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { QualityStars } from "../logic/scoring";

afterEach(() => {
  cleanup();
});

/** Builds a Dex where `recipeIds` are discovered at `stars` each -- a shorthand for
 *  simulating "played through the Chapter 1 chain up to here" (Economy & Progression 1.0
 *  EP1). */
function dexDiscovering(recipeIds: readonly string[], stars: QualityStars): DexState {
  let dex: DexState = EMPTY_DEX;
  for (const recipeId of recipeIds) {
    dex = registerScoreToDex(dex, recipeId, {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: stars * 20,
      stars,
    }).dex;
  }
  return dex;
}

const CHAIN_TO_BISMARCK = ["margherita", "funghi", "marinara"];
const CHAIN_TO_FUGAZZA = [
  "margherita",
  "funghi",
  "marinara",
  "bismarck",
  "genovese",
  "quattro-formaggi",
];

/** Full Chapter 1 chain discovered and every ingredient (incl. onion) owned -- every one of
 *  the 7 production recipes renders NEW/COMPLETED, never LOCKED. Used by pager-mechanics tests
 *  that don't care about lock state, so navigation assertions aren't entangled with it. */
const ALL_UNLOCKED_DEX = dexDiscovering(
  [...CHAIN_TO_FUGAZZA, "fugazza"],
  3 as QualityStars,
);
// EP4: 10 of these ingredients are no longer trivially Starter-owned -- own every ingredient
// explicitly (as production's per-recipe Starter Grants would have by this point) so this
// pager suite keeps exercising unlock-chain/pager mechanics, not ingredient ownership.
const ALL_OWNED_INGREDIENTS = INGREDIENTS.map((i) => i.id);

function renderPager(
  overrides: Partial<{
    dex: DexState;
    ownedIngredientIds: readonly string[];
    onSelectRecipe: (recipeId: RecipeId) => void;
    onBack: () => void;
    recipes: readonly Recipe[];
  }> = {},
) {
  const onSelectRecipe = overrides.onSelectRecipe ?? vi.fn();
  const onBack = overrides.onBack ?? vi.fn();
  render(
    <PizzaSelectScreen
      dex={overrides.dex ?? EMPTY_DEX}
      ownedIngredientIds={overrides.ownedIngredientIds ?? STARTER_INGREDIENT_IDS}
      onSelectRecipe={onSelectRecipe}
      onBack={onBack}
      recipes={overrides.recipes}
    />,
  );
  return { onSelectRecipe, onBack };
}

function nextButton() {
  return screen.getByRole("button", { name: "次のレシピ" });
}
function prevButton() {
  return screen.getByRole("button", { name: "前のレシピ" });
}
function ctaButton() {
  return screen.getByRole("button", { name: /このピザを作る/ });
}

describe("PizzaSelectScreen pager (Issue #88 UX-4)", () => {
  it("1. shows the first recipe (margherita) on initial render", () => {
    renderPager();
    expect(screen.getByText("マルゲリータ")).toBeInTheDocument();
    expect(screen.getByText("未挑戦")).toBeInTheDocument();
  });

  it("2. Next advances to the following recipe in RECIPES order", async () => {
    const user = userEvent.setup();
    renderPager({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    await user.click(nextButton());
    expect(screen.getByText(RECIPES[1].nameJa)).toBeInTheDocument();
    expect(screen.queryByText(RECIPES[0].nameJa)).not.toBeInTheDocument();
  });

  it("3. Previous returns to the prior recipe, and is disabled at the start", async () => {
    const user = userEvent.setup();
    renderPager({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    expect(prevButton()).toBeDisabled();
    await user.click(nextButton());
    expect(prevButton()).toBeEnabled();
    await user.click(prevButton());
    expect(screen.getByText(RECIPES[0].nameJa)).toBeInTheDocument();
    expect(prevButton()).toBeDisabled();
  });

  it("4. clamps at the end boundary instead of wrapping around", async () => {
    const user = userEvent.setup();
    renderPager({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    for (let i = 0; i < RECIPES.length - 1; i++) {
      await user.click(nextButton());
    }
    expect(screen.getByText(RECIPES[RECIPES.length - 1].nameJa)).toBeInTheDocument();
    expect(nextButton()).toBeDisabled();
    await user.click(nextButton());
    expect(screen.getByText(RECIPES[RECIPES.length - 1].nameJa)).toBeInTheDocument();
  });

  it("5. shows a dot-per-recipe position indicator at 7 recipes, advancing with Next", async () => {
    // Recipe Expansion Batch 1A/1B-A: full production RECIPES is now 13 (> PAGER_DOT_INDICATOR_MAX
    // 10), which switches to counter mode on its own -- see test 16b below for that. This test
    // keeps exercising dot mode specifically via a 7-recipe subset, its own original subject.
    const user = userEvent.setup();
    const { container } = render(
      <PizzaSelectScreen
        dex={ALL_UNLOCKED_DEX}
        ownedIngredientIds={ALL_OWNED_INGREDIENTS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
        recipes={RECIPES.slice(0, 7)}
      />,
    );
    const dots = container.querySelectorAll(".pizza-select-dot");
    expect(dots).toHaveLength(7);
    expect(container.querySelectorAll(".pizza-select-dot--active")).toHaveLength(1);
    expect(screen.getByLabelText("1 / 7")).toBeInTheDocument();
    await user.click(nextButton());
    expect(screen.getByLabelText("2 / 7")).toBeInTheDocument();
  });

  it("5b. full production RECIPES (14) switches to counter mode, never a 14-dot row (Batch 1A/1B-A/1B-B recipe-count gate)", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PizzaSelectScreen
        dex={ALL_UNLOCKED_DEX}
        ownedIngredientIds={ALL_OWNED_INGREDIENTS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    expect(RECIPES.length).toBe(15);
    expect(container.querySelectorAll(".pizza-select-dot")).toHaveLength(0);
    expect(screen.getByLabelText("1 / 15")).toBeInTheDocument();
    await user.click(nextButton());
    expect(screen.getByLabelText("2 / 15")).toBeInTheDocument();
  });

  it("6. tapping the CTA on the current (unlocked) recipe reports its exact id", async () => {
    const user = userEvent.setup();
    const { onSelectRecipe } = renderPager({
      dex: ALL_UNLOCKED_DEX,
      ownedIngredientIds: ALL_OWNED_INGREDIENTS,
    });
    await user.click(ctaButton());
    expect(onSelectRecipe).toHaveBeenCalledTimes(1);
    expect(onSelectRecipe).toHaveBeenCalledWith(RECIPES[0].id);
  });

  it("7. renders an unlocked, unplayed recipe (bismarck) as NEW with a working CTA", async () => {
    const user = userEvent.setup();
    const bismarck = RECIPES.find((r) => r.id === "bismarck")!;
    const dex = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    // EP4: `egg` (bismarck's own non-Starter ingredient) is no longer trivially owned -- own it
    // explicitly, as production's bismarck Starter Grant would have.
    const { onSelectRecipe } = renderPager({
      dex,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg"],
      recipes: [bismarck],
    });
    expect(screen.getByText("ビスマルク")).toBeInTheDocument();
    expect(screen.getByText("未挑戦")).toBeInTheDocument();
    await user.click(ctaButton());
    expect(onSelectRecipe).toHaveBeenCalledWith("bismarck");
  });

  it("8. renders a chain-locked recipe (funghi) with its real name, an unlock hint, and a disabled/no-op CTA", async () => {
    const user = userEvent.setup();
    const funghi = RECIPES.find((r) => r.id === "funghi")!;
    const { onSelectRecipe } = renderPager({ recipes: [funghi] });
    expect(screen.getByText("フンギ")).toBeInTheDocument();
    expect(screen.getByText("マルゲリータを1枚完成させると解禁")).toBeInTheDocument();
    expect(ctaButton()).toBeDisabled();
    await user.click(ctaButton());
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });

  it("9. fugazza stays mystery-locked (？？？) and never leaks its name or ingredient via the pager", async () => {
    const user = userEvent.setup();
    const { onSelectRecipe } = renderPager({
      dex: ALL_UNLOCKED_DEX,
      ownedIngredientIds: ALL_OWNED_INGREDIENTS,
    });
    // Navigate to fugazza's own card (Batch 1A: no longer the last card -- 4 more recipes now
    // follow it in RECIPES order) via Next -- exercises the pager's own chrome (position
    // indicator) at the exact card Issue #88 flags as the leak-risk surface.
    const fugazzaIndex = RECIPES.findIndex((r) => r.id === "fugazza");
    for (let i = 0; i < fugazzaIndex; i++) {
      await user.click(nextButton());
    }
    expect(screen.getByText("フガッサ")).toBeInTheDocument(); // unlocked in this dex -> real name

    cleanup();
    const fugazza = RECIPES.find((r) => r.id === "fugazza")!;
    renderPager({ recipes: [fugazza] }); // locked (fresh save) -> mystery
    const card = screen.getByLabelText("？？？、未解放");
    expect(card).toHaveTextContent("？？？");
    expect(card).not.toHaveTextContent("フガッサ");
    expect(card).toHaveTextContent("あと★12で解禁");
    expect(card).not.toHaveTextContent("たまねぎ");
    expect(ctaButton()).toBeDisabled();
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });

  it("10. a recipe whose chain is unlocked but whose ingredients aren't owned still renders LOCKED (never selectable)", async () => {
    const user = userEvent.setup();
    const fugazza = RECIPES.find((r) => r.id === "fugazza")!;
    const dex = dexDiscovering([...CHAIN_TO_FUGAZZA, "fugazza"], 5 as QualityStars);
    const { onSelectRecipe } = renderPager({
      dex,
      ownedIngredientIds: STARTER_INGREDIENT_IDS, // onion NOT owned
      recipes: [fugazza],
    });
    expect(ctaButton()).toBeDisabled();
    await user.click(ctaButton());
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });

  it("11. preserves RECIPES' own declared order while paging (never re-sorted to unlock-chain order)", async () => {
    const user = userEvent.setup();
    renderPager({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    const seen: string[] = [];
    seen.push(screen.getByText(RECIPES[0].nameJa).textContent!);
    for (let i = 1; i < RECIPES.length; i++) {
      await user.click(nextButton());
      seen.push(screen.getByText(RECIPES[i].nameJa).textContent!);
    }
    expect(seen).toEqual(RECIPES.map((r) => r.nameJa));
  });

  it("12. HOME button calls onBack", async () => {
    const user = userEvent.setup();
    const { onBack } = renderPager();
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("13. FREE recipe selection: tapping CTA on a fresh save's first (always-unlocked) recipe selects it", async () => {
    const user = userEvent.setup();
    const { onSelectRecipe } = renderPager(); // EMPTY_DEX, starter ingredients only
    await user.click(ctaButton());
    expect(onSelectRecipe).toHaveBeenCalledWith("margherita");
  });

  it("14. Lunch Rush regression: this screen never renders any Lunch Rush affordance", () => {
    renderPager();
    expect(screen.queryByText(/ランチラッシュ/)).not.toBeInTheDocument();
  });

  it("15. all 7 production recipes remain reachable forward and back with no errors", async () => {
    const user = userEvent.setup();
    renderPager({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    for (let i = 0; i < RECIPES.length - 1; i++) await user.click(nextButton());
    expect(screen.getByLabelText(`${RECIPES.length} / ${RECIPES.length}`)).toBeInTheDocument();
    for (let i = 0; i < RECIPES.length - 1; i++) await user.click(prevButton());
    expect(screen.getByLabelText(`1 / ${RECIPES.length}`)).toBeInTheDocument();
  });

  it("16. a mocked larger recipe collection (12) switches to a numeric counter and never breaks pager arithmetic", async () => {
    const user = userEvent.setup();
    const mockRecipes: Recipe[] = Array.from({ length: 12 }, (_, i) => ({
      ...RECIPES[0],
      id: `mock-recipe-${i}` as unknown as RecipeId,
      nameJa: `モック${i}`,
      unlockCondition: undefined,
    }));
    renderPager({ recipes: mockRecipes });

    // 12 > PAGER_DOT_INDICATOR_MAX (10) -> counter mode, never a 12-dot row.
    expect(screen.getByLabelText("1 / 12")).toBeInTheDocument();
    expect(screen.getByText("1 / 12")).toBeInTheDocument();
    expect(document.querySelectorAll(".pizza-select-dot")).toHaveLength(0);

    for (let i = 0; i < 11; i++) await user.click(nextButton());
    expect(screen.getByText("モック11")).toBeInTheDocument();
    expect(nextButton()).toBeDisabled();
    await user.click(nextButton());
    expect(screen.getByText("モック11")).toBeInTheDocument(); // still clamped, no crash/wrap

    for (let i = 0; i < 11; i++) await user.click(prevButton());
    expect(screen.getByText("モック0")).toBeInTheDocument();
    expect(prevButton()).toBeDisabled();
  });

  it("renders exactly one recipe card at a time (single-screen pager, not a scrolling list)", () => {
    renderPager();
    expect(document.querySelectorAll(".pizza-select-card")).toHaveLength(1);
    expect(document.querySelector(".pizza-select-grid")).not.toBeInTheDocument();
  });

  it("the position indicator never renders the current recipe's name (index-only chrome)", async () => {
    const user = userEvent.setup();
    renderPager({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    for (let i = 0; i < RECIPES.length - 1; i++) await user.click(nextButton());
    const indicator = screen.getByLabelText(`${RECIPES.length} / ${RECIPES.length}`);
    expect(within(indicator).queryByText("フガッサ")).not.toBeInTheDocument();
  });
});
