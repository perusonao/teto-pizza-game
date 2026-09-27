import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { SAVE_STORAGE_KEY } from "./state/persistence";

/**
 * Dinner Mission DM-3 (Issue #242): the App wiring -- HOME entry, Mission Select -> START with the
 * DEV-only `?dinnerDuration=` (OD-DM3-1), the Target Board replacing ORDER, and HOME's in-app
 * abandon dialog instead of `window.confirm`.
 */

const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const DM_A = ["margherita", "bismarck", "breakfast-pizza", "funghi"];

function seed(inventory: Record<string, number> = { egg: 5, bacon: 9, mushroom: 9 }) {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: DM_A.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 300,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...FINITE],
      missionBest: {},
      inventory,
      unlockedForShopIngredientIds: FINITE,
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

async function openDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /ディナーミッション/ }));
  await user.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
}

describe("App: Dinner Mission (DM-3)", () => {
  it("HOME keeps its 2+1 CTAs and adds the Dinner entry", () => {
    seed();
    render(<App />);
    expect(screen.getByRole("button", { name: /ピザを作る/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ランチラッシュ/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /フリークッキング/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ディナーミッション/ })).toHaveTextContent("解放 1");
  });

  it("without ?dinnerDuration START is disabled (制限時間を調整中)", async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);
    await openDetail(user);
    expect(screen.getByRole("button", { name: /スタート/ })).toBeDisabled();
  });

  it("START -> Target Board (no ORDER UI); HOME asks in-app; 続ける / やめる", async () => {
    seed();
    window.history.replaceState({}, "", "/?dinnerDuration=120");
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    render(<App />);
    await openDetail(user);
    await user.click(screen.getByRole("button", { name: /スタート/ }));

    const board = screen.getByRole("region", { name: "ターゲット選択" });
    expect(board).toHaveTextContent("残り 4 / 4");
    expect(board).toHaveTextContent("02:00");
    expect(screen.queryByRole("button", { name: /ピザを作る！|フリープレイ/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "続ける" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("region", { name: "ターゲット選択" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "やめる" }));
    expect(screen.getByRole("button", { name: /ディナーミッション/ })).toBeInTheDocument(); // HOME
    expect(confirmSpy).not.toHaveBeenCalled();
    // HOME is usable again: Lunch Rush and the Shop open normally after the run.
    expect(screen.getByRole("button", { name: /ランチラッシュ/ })).toBeEnabled();
  });

  it("selecting a target opens its cooking round with the Dinner HUD", async () => {
    seed();
    window.history.replaceState({}, "", "/?dinnerDuration=120");
    const user = userEvent.setup();
    render(<App />);
    await openDetail(user);
    await user.click(screen.getByRole("button", { name: /スタート/ }));
    await user.click(screen.getByRole("button", { name: /フンギ/ }));
    const hud = screen.getByTestId("dinner-hud");
    expect(hud).toHaveTextContent("0 / 4");
    expect(hud).toHaveTextContent("DINNER");
    expect(screen.queryByRole("region", { name: "ターゲット選択" })).toBeNull();
    // Only the current target is on the cooking screen, never the full list.
    expect(screen.queryByText("ビスマルク")).toBeNull();
  });
});
