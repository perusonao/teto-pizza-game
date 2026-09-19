import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PizzaSelectScreen } from "./PizzaSelectScreen";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../state/dex";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
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

describe("PizzaSelectScreen (Issue #39 PS2, extended by Economy & Progression 1.0 EP1)", () => {
  it("shows the title and a back-to-home button", () => {
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("作るピザを選ぼう！")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ホーム/ })).toBeInTheDocument();
  });

  it("calls onBack when the back button is tapped", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={onBack}
      />,
    );
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders margherita as a NEW, enabled card on a fresh save (always unlocked)", () => {
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    const card = screen.getByRole("button", { name: "マルゲリータ、未挑戦" });
    expect(card).toBeEnabled();
    expect(card).toHaveTextContent("NEW");
    expect(card.querySelector(".pizza-thumbnail")).toBeInTheDocument();
  });

  it("renders a chain-locked recipe (#2-#6) as a disabled LOCKED card that still shows its real name", () => {
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    const card = screen.getByRole("button", { name: "フンギ、未解放" });
    expect(card).toBeDisabled();
    expect(card).toHaveTextContent("フンギ");
    expect(card).not.toHaveTextContent("？？？");
    expect(card).toHaveTextContent("マルゲリータを1枚完成させると解禁");
  });

  it("renders an unlocked, unplayed recipe (bismarck) as a NEW, enabled card once its chain is discovered", () => {
    const dex = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    render(
      <PizzaSelectScreen
        dex={dex}
        // EP4: `egg` (bismarck's own non-Starter ingredient) is no longer trivially owned --
        // own it explicitly, as production's bismarck Starter Grant would have.
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "egg"]}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    const card = screen.getByRole("button", { name: "ビスマルク、未挑戦" });
    expect(card).toBeEnabled();
    expect(card).toHaveTextContent("NEW");
    expect(card.querySelector(".pizza-thumbnail")).toBeInTheDocument();
  });

  it("renders fugazza as a disabled, mystery LOCKED card when onion isn't owned", () => {
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    const card = screen.getByRole("button", { name: "？？？、未解放" });
    expect(card).toBeDisabled();
    expect(card).toHaveTextContent("？？？");
  });

  it("shows a star-progress unlock hint on fugazza's locked card, never the recipe/ingredient name", () => {
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    const card = screen.getByRole("button", { name: "？？？、未解放" });
    expect(card).toHaveTextContent("あと★12で解禁");
    expect(card).not.toHaveTextContent("たまねぎ");
  });

  it("renders a completed recipe with its highest stars and BEST score", () => {
    const dex: DexState = registerScoreToDex(EMPTY_DEX, "margherita", {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: 96,
      stars: 5 as QualityStars,
    }).dex;
    render(
      <PizzaSelectScreen
        dex={dex}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    const card = screen.getByRole("button", { name: "マルゲリータ、最高評価5つ星、BEST 96" });
    expect(card).toHaveTextContent("BEST 96");
    expect(card).toHaveTextContent("★★★★★");
  });

  it("taps an unlocked card and reports that exact recipeId, never a different one", async () => {
    const user = userEvent.setup();
    const onSelectRecipe = vi.fn();
    const dex = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    render(
      <PizzaSelectScreen
        dex={dex}
        // EP4: `egg` (bismarck's own non-Starter ingredient) is no longer trivially owned.
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "egg"]}
        onSelectRecipe={onSelectRecipe}
        onBack={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" }));
    expect(onSelectRecipe).toHaveBeenCalledTimes(1);
    expect(onSelectRecipe).toHaveBeenCalledWith("bismarck");
  });

  it("a locked card can never call onSelectRecipe, even via a forced click", async () => {
    const user = userEvent.setup();
    const onSelectRecipe = vi.fn();
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={onSelectRecipe}
        onBack={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "？？？、未解放" }));
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });

  it("renders all 7 recipes from RECIPES, never a hard-coded subset", () => {
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});
