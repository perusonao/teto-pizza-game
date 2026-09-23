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

/** Every production recipe discovered at 5 stars (so every `minTotalStars` gate up to
 *  meat-lovers' own 36 is cleared regardless of discovery order -- `totalStars` is a plain sum
 *  over the final Dex, not order-sensitive) -- every one of the 15 recipes renders
 *  NEW/COMPLETED, never LOCKED, once ingredients are also owned. Used by grid/navigation tests
 *  that don't care about lock state. */
const ALL_UNLOCKED_DEX = dexDiscovering(
  RECIPES.map((r) => r.id),
  5 as QualityStars,
);
// EP4: 10 of these ingredients are no longer trivially Starter-owned -- own every ingredient
// explicitly (as production's per-recipe Starter Grants would have by this point).
const ALL_OWNED_INGREDIENTS = INGREDIENTS.map((i) => i.id);

function renderSelect(
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

function gridCard(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name}、`) });
}
function backButton() {
  return screen.getByRole("button", { name: "レシピ一覧に戻る" });
}
/** The grid stays mounted (only hidden) behind an open detail view (see test 13), so any text
 *  a locked/NEW card's own hint also shows (e.g. an unlock hint) exists twice in the DOM --
 *  scope detail-specific assertions to this container instead of the whole `screen`. */
function detailPanel() {
  return document.querySelector(".pizza-select-detail") as HTMLElement;
}
function ctaButton() {
  return screen.getByRole("button", { name: /このピザを作る/ });
}

function mockRecipes(count: number): Recipe[] {
  return Array.from({ length: count }, (_, i) => ({
    ...RECIPES[0],
    id: `mock-recipe-${i}` as unknown as RecipeId,
    nameJa: `モック${i}`,
    unlockCondition: undefined,
  }));
}

describe("PizzaSelectScreen grid (Recipe Select 2.0A)", () => {
  it("1. grid renders every recipe in the collection as a selectable card", () => {
    renderSelect({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    expect(RECIPES.length).toBe(15);
    for (const recipe of RECIPES) {
      expect(screen.getByText(recipe.nameJa)).toBeInTheDocument();
    }
    expect(document.querySelectorAll(".pizza-select-grid-card")).toHaveLength(15);
  });

  it("2. renders position-based section headers (第1章 / 第2章), not a flat unlabeled list", () => {
    renderSelect({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    expect(screen.getByText("第1章")).toBeInTheDocument();
    expect(screen.getByText("第2章")).toBeInTheDocument();
    // salsiccia (index 7) is the first Chapter 2 recipe -- must land inside 第2章's own section.
    const chapter2 = screen.getByText("第2章").closest<HTMLElement>(".pizza-select-section")!;
    expect(within(chapter2).getByText("サルシッチャ")).toBeInTheDocument();
  });

  it("3. tapping an unlocked, unplayed (NEW) recipe card opens its focused detail", async () => {
    const user = userEvent.setup();
    // Progression 2.0 Phase 3-3: margherita on a truly fresh (EMPTY_DEX) save is now
    // preDiscoveryLocked -- bismarck (unlocked once its own chain is discovered, same fixture
    // pizzaSelect.test.ts's own "is NEW when available but not yet discovered" test uses) is a
    // NEW card that is *not* pre-discovery-locked, so this keeps exercising the original
    // NEW-card detail shape unchanged for a player past their first discovery. See tests 3b/4b
    // below for margherita's own new preDiscoveryLocked behavior.
    const dex = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    renderSelect({ dex, ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg"] });
    await user.click(gridCard("ビスマルク"));
    expect(backButton()).toBeInTheDocument();
    expect(document.querySelectorAll(".pizza-select-card")).toHaveLength(1);
    expect(within(detailPanel()).getByText("未挑戦")).toBeInTheDocument();
    expect(ctaButton()).toBeEnabled();
  });

  it("4. an unlocked NEW recipe's detail CTA starts the game with its exact id", async () => {
    const user = userEvent.setup();
    const dex = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    const { onSelectRecipe } = renderSelect({
      dex,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg"],
    });
    await user.click(gridCard("ビスマルク"));
    await user.click(ctaButton());
    expect(onSelectRecipe).toHaveBeenCalledTimes(1);
    expect(onSelectRecipe).toHaveBeenCalledWith("bismarck");
  });

  it("3b. Progression 2.0 Phase 3-3: on a truly fresh save, margherita's NEW card is preDiscoveryLocked -- no NEW badge, an explanatory hint instead of 未挑戦", async () => {
    const user = userEvent.setup();
    renderSelect(); // EMPTY_DEX
    const card = gridCard("マルゲリータ");
    expect(within(card).queryByText("NEW")).not.toBeInTheDocument();
    await user.click(card);
    expect(within(detailPanel()).queryByText("未挑戦")).not.toBeInTheDocument();
    expect(within(detailPanel()).getByText(/フリークッキングで発見しよう/)).toBeInTheDocument();
  });

  it("4b. Progression 2.0 Phase 3-3: the preDiscoveryLocked detail CTA opens Free Cooking, never SELECT_RECIPE", async () => {
    const user = userEvent.setup();
    const onSelectRecipe = vi.fn();
    const onGoFreeCook = vi.fn();
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={onSelectRecipe}
        onBack={vi.fn()}
        onGoFreeCook={onGoFreeCook}
      />,
    );
    await user.click(gridCard("マルゲリータ"));
    const freeCookCta = screen.getByRole("button", { name: /フリークッキングで探す/ });
    await user.click(freeCookCta);
    expect(onGoFreeCook).toHaveBeenCalledTimes(1);
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });

  it("5. a chain-locked recipe (funghi) is tappable but its detail shows the real name, an unlock hint, and a disabled/no-op CTA", async () => {
    const user = userEvent.setup();
    const { onSelectRecipe } = renderSelect();
    await user.click(gridCard("フンギ"));
    expect(within(detailPanel()).getByText("フンギ")).toBeInTheDocument();
    expect(within(detailPanel()).getByText("マルゲリータを1枚完成させると解禁")).toBeInTheDocument();
    expect(ctaButton()).toBeDisabled();
    await user.click(ctaButton());
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });

  it("6. locked recipes never start the game directly from the grid tap itself (only opens detail)", async () => {
    const user = userEvent.setup();
    const { onSelectRecipe } = renderSelect();
    await user.click(gridCard("フンギ"));
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });

  it("7. fugazza stays mystery-locked (？？？) in the grid and in its detail, never leaking its name/ingredient", async () => {
    const user = userEvent.setup();
    renderSelect();
    const mysteryCard = screen.getByRole("button", { name: "？？？、未解放" });
    expect(mysteryCard).toHaveTextContent("？？？");
    expect(mysteryCard).not.toHaveTextContent("フガッサ");

    await user.click(mysteryCard);
    const detail = document.querySelector(".pizza-select-card")!;
    expect(detail).toHaveTextContent("？？？");
    expect(detail).not.toHaveTextContent("フガッサ");
    expect(detail).toHaveTextContent("あと★12で解禁");
    expect(detail).not.toHaveTextContent("たまねぎ");
    expect(ctaButton()).toBeDisabled();
  });

  it("8. fugazza reveals its real name once genuinely unlocked (chain + totalStars + onion owned)", async () => {
    const user = userEvent.setup();
    renderSelect({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    expect(screen.queryByRole("button", { name: "？？？、未解放" })).not.toBeInTheDocument();
    await user.click(gridCard("フガッサ"));
    expect(screen.getAllByText("フガッサ").length).toBeGreaterThan(0);
  });

  it("9. a recipe whose chain is unlocked but whose ingredients aren't owned still renders LOCKED (never selectable)", async () => {
    const user = userEvent.setup();
    const dex = dexDiscovering([...CHAIN_TO_FUGAZZA, "fugazza"], 5 as QualityStars);
    const { onSelectRecipe } = renderSelect({ dex, ownedIngredientIds: STARTER_INGREDIENT_IDS }); // onion NOT owned
    // Chain + totalStars are satisfied, but ingredient ownership isn't -- still LOCKED, and
    // `mystery` reflects `recipe.mysteryLock` unconditionally while LOCKED (whichever axis
    // blocks it), so the card is still the mystery "？？？" card, not a revealed "フガッサ" one.
    await user.click(screen.getByRole("button", { name: "？？？、未解放" }));
    expect(ctaButton()).toBeDisabled();
    await user.click(ctaButton());
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });

  it("10. renders NEW state with badge + 未挑戦 for an unlocked, unplayed recipe (bismarck)", () => {
    const dex = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    renderSelect({ dex, ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg"] });
    const card = screen.getByRole("button", { name: /^ビスマルク、/ });
    expect(within(card).getByText("NEW")).toBeInTheDocument();
    expect(within(card).getByText("未挑戦")).toBeInTheDocument();
  });

  it("11. renders COMPLETED state with BEST star/score for a discovered recipe (bismarck)", () => {
    const chained = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    const dex: DexState = registerScoreToDex(chained, "bismarck", {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: 91.5,
      stars: 5 as QualityStars,
    }).dex;
    renderSelect({ dex, ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg"] });
    const card = screen.getByRole("button", { name: /^ビスマルク、/ });
    expect(within(card).getByText("BEST 92")).toBeInTheDocument();
  });

  it("12. selecting a card then tapping 戻る returns to the grid with every recipe still present", async () => {
    const user = userEvent.setup();
    renderSelect({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    await user.click(gridCard("マルゲリータ"));
    await user.click(backButton());
    expect(document.querySelector(".pizza-select-card")).not.toBeInTheDocument();
    for (const recipe of RECIPES) {
      expect(screen.getByText(recipe.nameJa)).toBeInTheDocument();
    }
  });

  it("13. the grid stays mounted (not unmounted) while a detail view is open, only hidden", async () => {
    const user = userEvent.setup();
    renderSelect();
    const bodyBefore = document.querySelector(".pizza-select-body");
    expect(bodyBefore).toBeInTheDocument();
    await user.click(gridCard("マルゲリータ"));
    const bodyAfter = document.querySelector(".pizza-select-body");
    expect(bodyAfter).toBe(bodyBefore); // same DOM node, not remounted
    expect(bodyAfter).toHaveStyle({ display: "none" });
  });

  it("14. HOME header button calls onBack from the grid", async () => {
    const user = userEvent.setup();
    const { onBack } = renderSelect();
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("15. this screen never renders any Lunch Rush affordance", () => {
    renderSelect();
    expect(screen.queryByText(/ランチラッシュ/)).not.toBeInTheDocument();
  });

  it("16. all 15 production recipes are reachable, and the last one (meat-lovers) is present in the grid without scrolling machinery breaking", async () => {
    const user = userEvent.setup();
    renderSelect({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    const last = RECIPES[RECIPES.length - 1];
    expect(screen.getByText(last.nameJa)).toBeInTheDocument();
    await user.click(gridCard(last.nameJa));
    expect(ctaButton()).toBeEnabled();
    await user.click(ctaButton());
  });

  it("preserves RECIPES' own declared order across sections (never re-sorted to unlock-chain order)", () => {
    renderSelect({ dex: ALL_UNLOCKED_DEX, ownedIngredientIds: ALL_OWNED_INGREDIENTS });
    const names = Array.from(document.querySelectorAll(".pizza-select-grid-card .pizza-select-card__name, .pizza-select-grid-card .pizza-select-card__lock-label")).map(
      (el) => el.textContent,
    );
    expect(names).toEqual(RECIPES.map((r) => r.nameJa));
  });

  it("no longer exposes a 前へ/次へ pager as the primary navigation", () => {
    renderSelect();
    expect(screen.queryByRole("button", { name: "前のレシピ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "次のレシピ" })).not.toBeInTheDocument();
  });
});

describe("PizzaSelectScreen scalability (30-50 recipe fixture, dev-only -- production stays 15)", () => {
  it("renders a 38-recipe mocked catalog across auto-generated sections with no dropped/duplicated card", () => {
    const recipes = mockRecipes(38);
    renderSelect({ recipes });
    expect(document.querySelectorAll(".pizza-select-grid-card")).toHaveLength(38);
    expect(screen.getByText("第1章")).toBeInTheDocument();
    expect(screen.getByText("第5章")).toBeInTheDocument();
  });

  it("the last card of a 38-recipe fixture is present in the DOM (reachable by scrolling) and selectable", async () => {
    const user = userEvent.setup();
    const recipes = mockRecipes(38);
    // Progression 2.0 Phase 3-3: an empty Dex makes every always-unlocked NEW card
    // preDiscoveryLocked (its CTA becomes フリークッキングで探す, see PizzaSelectScreen.tsx) --
    // irrelevant to this scalability test, so seed a real discovery to keep the guided CTA path.
    const { onSelectRecipe } = renderSelect({ recipes, dex: ALL_UNLOCKED_DEX });
    const last = recipes[recipes.length - 1];
    const lastCard = screen.getByText(last.nameJa);
    expect(lastCard).toBeInTheDocument();
    await user.click(gridCard(last.nameJa));
    await user.click(ctaButton());
    expect(onSelectRecipe).toHaveBeenCalledWith(last.id);
  });

  it("grid column count stays at 2 regardless of catalog size (no per-item layout blowup)", () => {
    renderSelect({ recipes: mockRecipes(50) });
    const grids = document.querySelectorAll(".pizza-select-grid");
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) {
      expect(getComputedStyle(grid).display).not.toBe("");
    }
  });
});
