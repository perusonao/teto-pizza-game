import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY, type PersistentSaveV1 } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * HOME/GAME separation (Issue #24) integration coverage. Renders the real `App` (real
 * reducers, real localStorage) end-to-end rather than mocking anything internal -- these
 * tests exist specifically to catch a broken navigation wire or a HOME number that silently
 * stops tracking `GameState`, not to re-verify scoring/economy/Dex rules already covered by
 * their own unit suites (src/logic, src/state).
 */

function seedSave(overrides: Partial<PersistentSaveV1>): void {
  const save: PersistentSaveV1 = {
    schemaVersion: 1,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
    missionBest: {},
    ...overrides,
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("HOME/GAME separation (Issue #24)", () => {
  it("shows HOME on initial load, not GAME", () => {
    render(<App />);
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
    expect(document.querySelector(".game-screen")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ピザを作る/ })).toBeInTheDocument();
  });

  it("navigates HOME -> FREE play on the primary CTA", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(document.querySelector(".home-screen")).not.toBeInTheDocument();
    // Free play's ORDER phase CTA ("フリープレイ") confirms this landed on a real round, not
    // just an empty shell.
    expect(screen.getByRole("button", { name: /フリープレイ/ })).toBeInTheDocument();
  });

  it("navigates HOME -> Lunch Rush straight into the Mission Intro overlay", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(document.querySelector(".mission-overlay")).toBeInTheDocument();
    expect(screen.getByText(/LUNCH RUSH/)).toBeInTheDocument();
  });

  it("opens the Dex overlay from HOME without leaving HOME underneath", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    expect(document.querySelector(".dex-overlay")).toBeInTheDocument();
    // Still on HOME underneath the overlay -- Dex/Shop are modals over HOME, not navigation.
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
    await user.click(within(document.querySelector(".dex-overlay")!).getByRole("button", { name: "閉じる" }));
    expect(document.querySelector(".dex-overlay")).not.toBeInTheDocument();
  });

  it("opens the Shop overlay from HOME without leaving HOME underneath", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    expect(document.querySelector(".dex-overlay")).toBeInTheDocument(); // ShopOverlay reuses this container class
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("renders 実績 (Achievements) disabled instead of fake progress", () => {
    render(<App />);
    const achievements = screen.getByRole("button", { name: /実績/ });
    expect(achievements).toBeDisabled();
    expect(achievements).toHaveTextContent("近日公開");
  });

  it("navigates GAME -> HOME via the header button when nothing is in progress", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    // Still ORDER phase -- nothing built yet, so no confirmation should even be asked.
    const confirmSpy = vi.spyOn(window, "confirm");
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("confirms before discarding an in-progress pizza when leaving GAME for HOME", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: /フリープレイ/ })); // BEGIN_PREPARE -> PREPARE phase
    // Issue #32 Phase 2: 焼く only appears once the making flow reaches TOPPING.
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(screen.getByRole("button", { name: /焼く/ })).toBeInTheDocument();

    // Cancel: stays on GAME, PREPARE state untouched.
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /焼く/ })).toBeInTheDocument();

    // Confirm: discards the round and returns to HOME.
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("starts a fresh ORDER instead of reopening a finished round from HOME's CTA", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: /フリープレイ/ })); // ORDER -> PREPARE
    // Issue #32 Phase 2: 焼く only appears once the making flow reaches TOPPING.
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ })); // PREPARE -> BAKE
    await user.click(screen.getByRole("button", { name: "取り出す！" })); // BAKE -> RESULT
    await user.click(screen.getByRole("button", { name: "レシピ図鑑に登録する" })); // RESULT -> DISCOVERED
    expect(screen.getByRole("button", { name: /もう一度作る/ })).toBeInTheDocument();

    // DISCOVERED has nothing in-progress to lose, so no confirmation is needed leaving GAME.
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".home-screen")).toBeInTheDocument();

    // Tapping HOME's CTA again must land on a fresh ORDER, not reopen the DISCOVERED screen
    // this same round left behind.
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expect(screen.queryByRole("button", { name: /もう一度作る/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /フリープレイ/ })).toBeInTheDocument();
  });

  it("reads Pitz balance and Dex progress from persisted state, never hard-coded", () => {
    seedSave({
      pitzBalance: 250,
      dex: [
        {
          recipeId: "margherita",
          discovered: true,
          bestScore: 92,
          bestStars: 4,
          timesMade: 3,
        },
      ],
    });
    render(<App />);
    expect(screen.getByLabelText("Pitz残高 250")).toBeInTheDocument();
    // 7 total recipes (src/data/recipes.ts) -- 1 discovered from the seeded save.
    expect(screen.getByLabelText(/レシピ図鑑 発見数 1 \/ 7/)).toBeInTheDocument();
    expect(screen.getByText(/発見 1\/7/)).toBeInTheDocument();
  });

  it("still shows HOME first after a reload, with persisted progression intact", () => {
    seedSave({ pitzBalance: 40, dex: [] });
    const { unmount } = render(<App />);
    expect(screen.getByLabelText("Pitz残高 40")).toBeInTheDocument();
    unmount();

    // Simulates a reload: a fresh mount reading the same storage back.
    render(<App />);
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
    expect(screen.getByLabelText("Pitz残高 40")).toBeInTheDocument();
  });
});
