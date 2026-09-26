import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { getIngredient, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";

/**
 * Discovery Hint 2.0 (Issue #229, 229-D) through the real App: a Dex 🎨 card's 「💡 ヒントを見る」
 * closes the Dex, starts Free Cooking and opens the hint sheet -- on a legacy save where several
 * undiscovered recipes are DISCOVERABLE at once (the LK-8 worst case). No undiscovered name ever
 * shows (text or aria), no guided round starts, Pizza Select stays discovered-only. Discovery Hint
 * Economy 1.0 (Issue #232, HE-2): the H1 bought on each card is the only change to the save.
 */

const OLD15 = RECIPES.slice(0, 15);
const UNDISCOVERED_NAMES = RECIPES.slice(15).map((r) => r.nameJa);
const MATERIALS = [
  ...new Set(OLD15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)).filter((id) => !!getIngredient(id)?.unlockCondition)),
];

function seedLegacyDex15(): void {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: OLD15.map((r) => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 500,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...MATERIALS],
      missionBest: {},
      inventory: Object.fromEntries(MATERIALS.map((m) => [m, 30])),
      starterGrantClaimedRecipeIds: [],
    }),
  );
}

function expectNoUndiscoveredName(where: string) {
  const text = document.body.textContent ?? "";
  const labels = [...document.querySelectorAll("*")].flatMap((e) => [...e.attributes].map((a) => a.value)).join("|");
  for (const name of UNDISCOVERED_NAMES) {
    expect(text, `${where}: ${name}`).not.toContain(name);
    expect(labels, `${where} attributes: ${name}`).not.toContain(name);
  }
  for (const r of RECIPES.slice(15)) expect(labels, `${where} attribute id ${r.id}`).not.toMatch(new RegExp(`(^|[|\\s:])${r.id}($|[|\\s:])`));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Dex 「💡 ヒントを見る」 through the App (229-D)", () => {
  it("every DISCOVERABLE card: Dex closes, Free Cooking PREPARE starts with the hint sheet, nothing leaks, only the purchase is saved", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLegacyDex15();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    const count = screen.getAllByRole("button", { name: /ヒントを見る/ }).length;
    expect(count).toBeGreaterThanOrEqual(2);
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);

    for (let i = 0; i < count; i += 1) {
      if (!document.querySelector(".dex-overlay")) {
        await user.click(screen.getByRole("button", { name: /ホーム/ }));
        await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
      }
      expectNoUndiscoveredName(`Dex before card ${i}`);
      await user.click(screen.getAllByRole("button", { name: /ヒントを見る/ })[i]);
      expect(document.querySelector(".dex-overlay")).toBeNull();
      expect(document.querySelector(".order-card--free-cook")).toBeInTheDocument();
      const sheet = screen.getByRole("dialog", { name: /ヒント/ });
      await user.click(sheet.querySelector<HTMLButtonElement>(".hint-sheet__next")!);
      expect(sheet.querySelectorAll(".hint-sheet__step")).toHaveLength(2);
      expectNoUndiscoveredName(`card ${i}: Free Cooking + sheet`);
      await user.click(within(sheet).getByRole("button", { name: "閉じる" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // Straight back into cooking: the free-cook round is live.
      expect(document.querySelector(".prepare-bake-bar")).toBeInTheDocument();
    }

    const after = JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!);
    const { pitzBalance, discoveryHintPurchases, ...rest } = after;
    // One H1 (5 Pitz) per card, each on its own recipe.
    expect(pitzBalance).toBe(500 - 5 * count);
    expect(Object.values(discoveryHintPurchases)).toEqual(Array(count).fill(1));
    const { pitzBalance: _p, discoveryHintPurchases: _d, ...restBefore } = JSON.parse(before!);
    void _p;
    void _d;
    expect(rest).toEqual(restBefore);
  });

  it("LK-8: after a Dex hint round, HOME -> Pizza Select still lists no undiscovered recipe", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLegacyDex15();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    await user.click(screen.getAllByRole("button", { name: /ヒントを見る/ })[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "閉じる" }));
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expectNoUndiscoveredName("HOME after a Dex hint round");
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expectNoUndiscoveredName("Pizza Select after a Dex hint round");
  });
});
