import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { getIngredient, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";

/**
 * Progression 2.0 W1 Discovery 2.0 -- W1-a2 (LK-8 / LK-8b / LK-8d) through the real App: a
 * legacy save (the 15 shipped recipes discovered, their materials owned with stock) is the one
 * where undiscovered W1 recipes are cookable right now, i.e. where the old FREE order pool leaked
 * them. No path may show an undiscovered recipe's order or start its guided round, and App never
 * enters GAME for a selection the reducer rejects.
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
  for (const name of UNDISCOVERED_NAMES) expect(text, `${where}: ${name}`).not.toContain(name);
  const labels = [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label") ?? "");
  for (const name of UNDISCOVERED_NAMES) expect(labels.join("|"), `${where} aria: ${name}`).not.toContain(name);
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("LK-8 through the App (legacy Dex-15 save)", () => {
  it("HOME mid-PREPARE (FREE), then the Lunch Rush intro's 閉じる: only a discovered order, and フリープレイ starts it (LK-8b)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLegacyDex15();
    const user = userEvent.setup();
    render(<App />);
    for (let trial = 0; trial < 8; trial++) {
      // A FREE round in PREPARE, then HOME: handleGoHome replaces it via PLAY_AGAIN -- the order
      // the old pool filled with an undiscovered recipe first.
      await user.click(screen.getByRole("button", { name: /フリークッキング/ }));
      await user.click(screen.getByRole("button", { name: /ホーム/ }));
      await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
      await user.click(screen.getByRole("button", { name: "閉じる" }));
      expectNoUndiscoveredName(`trial ${trial}: ORDER after intro close`);
      await user.click(screen.getByRole("button", { name: /フリープレイ/ }));
      expect(document.querySelector(".pizza-stage")).toBeInTheDocument();
      expectNoUndiscoveredName(`trial ${trial}: FREE PREPARE`);
      await user.click(screen.getByRole("button", { name: /ホーム/ }));
    }
  });

  it("HOME during a Lunch Rush round, then the intro's 閉じる, never exposes an undiscovered guided order (LK-8b)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLegacyDex15();
    const user = userEvent.setup();
    render(<App />);
    for (let trial = 0; trial < 5; trial++) {
      await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
      await user.click(screen.getByRole("button", { name: "スタート" }));
      await user.click(screen.getByRole("button", { name: "ピザを作る！" }));
      await user.click(screen.getByRole("button", { name: /ホーム/ }));
      await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
      await user.click(screen.getByRole("button", { name: "閉じる" }));
      expectNoUndiscoveredName(`trial ${trial}: ORDER after HOME + intro close`);
      await user.click(screen.getByRole("button", { name: /ホーム/ }));
    }
  });

  it("Pizza Select never lets an undiscovered (even fully cookable) recipe start a guided round, and App stays on Pizza Select (LK-8d)", async () => {
    // Portuguesa and Pesto Tonno are DISCOVERABLE on this save: every material owned with stock.
    for (const name of ["ピッツァ・ポルトゲーザ", "ペストトンノピザ"]) {
      seedLegacyDex15();
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
      const card = screen.queryByRole("button", { name: new RegExp(`^${name}、`) });
      if (card) {
        await user.click(card);
        const cta = screen.queryByRole("button", { name: /このピザを作る/ });
        if (cta && !(cta as HTMLButtonElement).disabled) await user.click(cta);
      }
      expect(document.querySelector(".pizza-stage"), name).not.toBeInTheDocument();
      expect(screen.getByText("作るピザを選ぼう！")).toBeInTheDocument();
      cleanup();
      window.localStorage.clear();
    }
  });
});
