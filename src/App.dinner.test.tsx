import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { SAVE_STORAGE_KEY } from "./state/persistence";

/**
 * Dinner Mission DM-3 (Issue #242) / DM-3R-2 (Issue #250): the App wiring -- HOME entry, Mission
 * Select -> START with the DEV-only `?dinnerDuration=` (OD-DM3-1) and S (OD-R2), START landing
 * straight on a recipe-free cooking round with the target row (no Target Board, no declaration),
 * the Shop / hint guards, and HOME's in-app abandon dialog instead of `window.confirm`.
 */

const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const DM_A = ["margherita", "bismarck", "breakfast-pizza", "funghi"];

function seed(inventory: Record<string, number> = { egg: 5, bacon: 9, mushroom: 9 }) {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: DM_A.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 })),
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

describe("App: Dinner Mission (DM-3 / DM-3R-2)", () => {
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

  it("R1: START -> recipe-free cooking at once (no Target Board, no ORDER UI); HOME asks in-app; 続ける / やめる", async () => {
    seed();
    window.history.replaceState({}, "", "/?dinnerDuration=120");
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    render(<App />);
    await openDetail(user);
    await user.click(screen.getByRole("button", { name: /スタート/ }));

    const row = screen.getByTestId("dinner-target-row");
    expect(within(row).getByTestId("dinner-hud")).toHaveTextContent("02:00");
    expect(within(row).getByTestId("dinner-hud")).toHaveTextContent("0/4");
    for (const name of ["マルゲリータ", "ビスマルク", "ブレックファストピザ", "フンギ"]) expect(row).toHaveTextContent(name);
    expect(screen.queryByRole("region", { name: "ターゲット選択" })).toBeNull();
    expect(screen.queryByRole("button", { name: /ピザを作る！|フリープレイ/ })).toBeNull();
    // R22: no hint in a Dinner round; the step CTA is there.
    expect(screen.queryByRole("button", { name: "ヒント" })).toBeNull();
    expect(screen.getByRole("button", { name: /次へ/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "続ける" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("dinner-target-row")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "やめる" }));
    expect(screen.getByRole("button", { name: /ディナーミッション/ })).toBeInTheDocument(); // HOME
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /ランチラッシュ/ })).toBeEnabled();
  });

  it("R27: a target chip opens its reference; closing returns to cooking with nothing selected", async () => {
    seed();
    window.history.replaceState({}, "", "/?dinnerDuration=120");
    const user = userEvent.setup();
    render(<App />);
    await openDetail(user);
    await user.click(screen.getByRole("button", { name: /スタート/ }));
    await user.click(screen.getByTestId("dinner-chip-funghi"));
    const popover = screen.getByRole("dialog", { name: /フンギ/ });
    expect(popover).toBeInTheDocument();
    await user.click(within(popover).getByRole("button", { name: /閉じる/ }));
    expect(screen.queryByRole("dialog", { name: /フンギ/ })).toBeNull();
    // Still the same recipe-free round: no recipe card, no target name as the round's recipe.
    expect(screen.queryByText("フリークッキング")).toBeNull();
    expect(screen.getByTestId("dinner-target-row")).toBeInTheDocument();
  });

  it("a retry after TIME_UP starts a fresh round: nothing transient (the 見本 popover) carries over", async () => {
    seed();
    window.history.replaceState({}, "", "/?dinnerDuration=1");
    const user = userEvent.setup();
    render(<App />);
    await openDetail(user);
    await user.click(screen.getByRole("button", { name: /スタート/ }));
    await user.click(screen.getByTestId("dinner-chip-margherita"));
    expect(screen.getByRole("dialog", { name: /マルゲリータ/ })).toBeInTheDocument();

    const result = await screen.findByRole("dialog", { name: "ディナーミッション結果" }, { timeout: 3000 });
    expect(result).toHaveTextContent("時間切れ！");
    await user.click(within(result).getByRole("button", { name: "もう一度" }));
    expect(screen.getByTestId("dinner-target-row")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /マルゲリータ/ })).toBeNull();
  });
});
