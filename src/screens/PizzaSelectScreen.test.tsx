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

describe("PizzaSelectScreen (Issue #39 PS2)", () => {
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

  it("renders an unlocked, unplayed recipe (bismarck) as a NEW, enabled card", () => {
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    const card = screen.getByRole("button", { name: "ビスマルク、未挑戦" });
    expect(card).toBeEnabled();
    expect(card).toHaveTextContent("NEW");
    expect(card.querySelector(".pizza-thumbnail")).toBeInTheDocument();
  });

  it("renders fugazza as a disabled LOCKED card when onion isn't owned", () => {
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

  it("shows a real-data unlock hint on the locked card, not a fabricated condition", () => {
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
        onSelectRecipe={() => {}}
        onBack={() => {}}
      />,
    );
    const card = screen.getByRole("button", { name: "？？？、未解放" });
    expect(card).toHaveTextContent("たまねぎ");
    expect(card).toHaveTextContent("12");
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
    render(
      <PizzaSelectScreen
        dex={EMPTY_DEX}
        ownedIngredientIds={STARTER_INGREDIENT_IDS}
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
