import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY, type PersistentSaveV1 } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * HOME/GAME separation (Issue #24) integration coverage, extended by Issue #39 for the
 * HOME -> Pizza Select -> FREE navigation this file's own describe block now covers end to
 * end. Renders the real `App` (real reducers, real localStorage) end-to-end rather than
 * mocking anything internal -- these tests exist specifically to catch a broken navigation
 * wire or a HOME number that silently stops tracking `GameState`, not to re-verify
 * scoring/economy/Dex rules already covered by their own unit suites (src/logic, src/state).
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

  it("navigates HOME -> Pizza Select on the primary CTA (Issue #39), not straight into GAME", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expect(document.querySelector(".pizza-select-screen")).toBeInTheDocument();
    expect(document.querySelector(".game-screen")).not.toBeInTheDocument();
    expect(document.querySelector(".home-screen")).not.toBeInTheDocument();
    expect(screen.getByText("作るピザを選ぼう！")).toBeInTheDocument();
    // The old redundant "フリープレイ / Lunch Rush" two-choice picker must not appear here --
    // Pizza Select's cards are the only FREE entry point now.
    expect(screen.queryByRole("button", { name: /フリープレイ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lunch Rush/ })).not.toBeInTheDocument();
  });

  it("selects an unlocked recipe from Pizza Select and starts FREE with that exact recipe", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    // Bismarck is unlocked (Starter Set only) and undiscovered on a fresh save -- NEW.
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(document.querySelector(".pizza-select-screen")).not.toBeInTheDocument();
    // Issue #47 Finding C: Pizza Select already made the recipe choice explicit, so selecting
    // a recipe now lands straight at PREPARE -- the old redundant フリープレイ button (a
    // second FREE-mode choice after the recipe was already picked) no longer appears.
    expect(screen.queryByRole("button", { name: /フリープレイ/ })).not.toBeInTheDocument();
    expect(document.querySelector(".order-card")).toBeInTheDocument();
    // The recipe name shown in PREPARE's compact order-card confirms the selected recipeId
    // (not a random one) actually reached GameScreen/state.recipe.
    expect(screen.getAllByText(/ビスマルク/).length).toBeGreaterThan(0);
    // The in-round secondary Lunch Rush entry point was removed from GAME's ORDER action row
    // (Issue #39 PS1) -- only the one FREE CTA remains here.
    expect(screen.queryByRole("button", { name: /Lunch Rush/ })).not.toBeInTheDocument();
  });

  // Issue #47 Finding K: Shop/Pizza Dex must not be reachable from Making at all -- HOME
  // remains the sole hub. Checked across ORDER (Lunch Rush's own ORDER screen, the one place
  // GAME still renders phase "ORDER" for FREE-mode content) and PREPARE.
  it("never renders Shop/Pizza Dex navigation inside GAME's header (Finding K)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" })); // Pizza Select -> GAME/PREPARE
    const header = document.querySelector<HTMLElement>(".game-screen .app-header")!;
    expect(within(header).queryByText(/Shop/)).not.toBeInTheDocument();
    expect(within(header).queryByText(/レシピ図鑑/)).not.toBeInTheDocument();
    expect(within(header).getByRole("button", { name: /ホーム/ })).toBeInTheDocument();
  });

  it("a locked recipe card (fugazza, before onion is owned) cannot start a round", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    const lockedCard = screen.getByRole("button", { name: "？？？、未解放" });
    expect(lockedCard).toBeDisabled();
    await user.click(lockedCard);
    // Still on Pizza Select -- a disabled button's click is a no-op, never reaching GAME.
    expect(document.querySelector(".pizza-select-screen")).toBeInTheDocument();
    expect(document.querySelector(".game-screen")).not.toBeInTheDocument();
  });

  it("navigates Pizza Select -> HOME via its back button", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expect(document.querySelector(".pizza-select-screen")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
    expect(document.querySelector(".pizza-select-screen")).not.toBeInTheDocument();
  });

  it("navigates HOME -> Lunch Rush straight into the Mission Intro overlay", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(document.querySelector(".mission-overlay")).toBeInTheDocument();
    expect(screen.getByText(/LUNCH RUSH/)).toBeInTheDocument();
  });

  // Issue #47 Finding C only changes SELECT_RECIPE (Pizza Select's own path) -- Mission's own
  // ORDER-phase round (MISSION_RESET_ORDER) must still show its own "ピザを作る！" ORDER CTA
  // unaffected, never the フリープレイ label or a skip straight to PREPARE.
  it("Lunch Rush's own ORDER screen is unaffected by the Pizza Select FREE-mode change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    await user.click(screen.getByRole("button", { name: "スタート" }));
    expect(screen.getByRole("button", { name: "ピザを作る！" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /フリープレイ/ })).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" })); // Pizza Select -> GAME
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
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" })); // Pizza Select -> GAME, already PREPARE (Finding C)
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

  it("starts a fresh round instead of reopening a finished round from HOME's CTA", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" })); // Pizza Select -> GAME, already PREPARE
    // Issue #32 Phase 2: 焼く only appears once the making flow reaches TOPPING.
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ })); // PREPARE -> BAKE
    await user.click(screen.getByRole("button", { name: "取り出す！" })); // BAKE -> RESULT
    await user.click(screen.getByRole("button", { name: "レシピ図鑑に登録する" })); // RESULT -> DISCOVERED
    // Issue #47 Finding D: the old single "もう一度作る" (always a *different* recipe) is
    // replaced by two explicit actions.
    expect(screen.queryByRole("button", { name: "もう一度作る" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度つくる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "別のピザを作る" })).toBeInTheDocument();

    // DISCOVERED has nothing in-progress to lose, so no confirmation is needed leaving GAME.
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".home-screen")).toBeInTheDocument();

    // Tapping HOME's CTA again lands on Pizza Select, now showing bismarck as COMPLETED
    // (just discovered above) rather than NEW -- selecting it again must land on a fresh
    // PREPARE, not reopen the DISCOVERED screen this same round left behind.
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: /ビスマルク/ }));
    expect(screen.queryByRole("button", { name: "もう一度つくる" })).not.toBeInTheDocument();
    expect(document.querySelector(".order-card")).toHaveTextContent("ビスマルク");
  });

  it("「もう一度つくる」retries the exact same recipe with a fresh pizza (Finding D)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await user.click(screen.getByRole("button", { name: "レシピ図鑑に登録する" })); // DISCOVERED

    await user.click(screen.getByRole("button", { name: "もう一度つくる" }));

    // Same recipe, landed directly on a fresh PREPARE -- no Pizza Select, no フリープレイ gate.
    expect(document.querySelector(".pizza-select-screen")).not.toBeInTheDocument();
    expect(document.querySelector(".order-card")).toHaveTextContent("ビスマルク");
    expect(screen.queryByRole("button", { name: /フリープレイ/ })).not.toBeInTheDocument();
    // Fresh making state: the flow is back at the SAUCE step (次へ, not 焼く, is showing).
    expect(screen.getByRole("button", { name: /次へ/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /焼く/ })).not.toBeInTheDocument();
  });

  it("「別のピザを作る」returns to Pizza Select instead of retrying (Finding D)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await user.click(screen.getByRole("button", { name: "レシピ図鑑に登録する" })); // DISCOVERED

    await user.click(screen.getByRole("button", { name: "別のピザを作る" }));

    expect(document.querySelector(".pizza-select-screen")).toBeInTheDocument();
    expect(document.querySelector(".game-screen")).not.toBeInTheDocument();
  });

  // Deeper Dex/Pitz/ownedIngredientIds preservation across RETRY_SAME_RECIPE is covered at the
  // reducer level (src/state/gameReducer.test.ts) -- this checks the one progression field
  // GAME's own header still surfaces (Pitz balance) stays stable across the same UI flow.
  it("keeps Pitz balance stable across a same-recipe retry", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: "ビスマルク、未挑戦" }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await user.click(screen.getByRole("button", { name: "レシピ図鑑に登録する" })); // DISCOVERED

    const pitzBefore = screen.getByLabelText(/Pitz残高/).textContent;
    await user.click(screen.getByRole("button", { name: "もう一度つくる" }));
    expect(screen.getByLabelText(/Pitz残高/).textContent).toBe(pitzBefore);
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
