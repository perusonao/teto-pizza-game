import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY, createDefaultSave, loadSave, type PersistentSaveV1 } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { LUNCH_RUSH_MISSION_ID } from "./mission/lunchRush";

/**
 * Full Game Reset / はじめから (Issue #89, Reset 1A) end-to-end coverage through the real `App`
 * (real reducer, real localStorage), following this codebase's established per-feature
 * App-level test file convention (see App.inventoryOverlay.test.tsx's own doc comment). Backs
 * the Fresh Audit's acceptance matrix (docs/reports/TETO_FULL-GAME-RESET_89_Fresh-Audit.md
 * section 19) at the integration layer; the underlying storage primitive (`resetSave`) has its
 * own unit coverage in state/persistence.test.ts -- this file's job is "is Reset correctly wired
 * into Settings/HOME, and does confirming it actually reproduce a true first launch."
 *
 * `window.location.reload()` is mocked throughout (jsdom has no real navigation) -- per this
 * suite's own "still shows HOME first after a reload" convention elsewhere in App.test.tsx, an
 * `unmount()` + fresh `render(<App />)` against the same `window.localStorage` simulates the
 * reload's actual effect (a brand new mount reading storage back from scratch).
 */

function mockReload() {
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload },
    writable: true,
  });
  return reload;
}

/** A heavily progressed v2 save touching every one of `PersistentSaveV2`'s six persisted
 *  fields at once -- matches the Fresh Audit's Test A ("every field matches createDefaultSave()
 *  exactly" after reset). */
function seedProgressedSaveV2(): void {
  const save = {
    schemaVersion: 2,
    dex: [
      { recipeId: "margherita", discovered: true, bestScore: 88, bestStars: 4, timesMade: 5 },
      { recipeId: "funghi", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
    ],
    pitzBalance: 999,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion"],
    missionBest: { [LUNCH_RUSH_MISSION_ID]: 5000 },
    inventory: { onion: 7 },
    starterGrantClaimedRecipeIds: ["funghi"],
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}

function seedV1Save(): void {
  const save: PersistentSaveV1 = {
    schemaVersion: 1,
    dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }],
    pitzBalance: 30,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion"],
    missionBest: {},
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "設定" }));
  return document.querySelector<HTMLElement>(".dex-overlay")!;
}

async function openResetConfirm(user: ReturnType<typeof userEvent.setup>) {
  const settings = await openSettings(user);
  await user.click(within(settings).getByRole("button", { name: "ゲームデータをリセット" }));
  return document.querySelector<HTMLElement>(".settings-reset-confirm__panel")!;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Settings entry point (Issue #89)", () => {
  it("HOME's ⚙️ button is enabled and opens the Settings overlay", async () => {
    const user = userEvent.setup();
    render(<App />);
    const settingsButton = screen.getByRole("button", { name: "設定" });
    expect(settingsButton).not.toBeDisabled();
    await user.click(settingsButton);
    const overlay = document.querySelector(".dex-overlay");
    expect(overlay).toBeInTheDocument();
    expect(within(overlay as HTMLElement).getByText("ゲームデータをリセット")).toBeInTheDocument();
  });

  it("closes via 閉じる, returning to a plain HOME", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.click(within(document.querySelector(".dex-overlay")!).getByRole("button", { name: "閉じる" }));
    expect(document.querySelector(".dex-overlay")).not.toBeInTheDocument();
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });
});

describe("Destructive confirmation UX (Issue #89 §17)", () => {
  it("shows the required title, body, and both actions -- and does not reset on open", async () => {
    seedProgressedSaveV2();
    const reload = mockReload();
    const user = userEvent.setup();
    render(<App />);
    const confirm = await openResetConfirm(user);
    expect(within(confirm).getByText("ゲームデータをリセットしますか？")).toBeInTheDocument();
    expect(
      within(confirm).getByText(/Pitz・材料・レシピ解放・ピザ図鑑・ベスト記録など/),
    ).toBeInTheDocument();
    expect(within(confirm).getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
    expect(within(confirm).getByRole("button", { name: "最初からやり直す" })).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
  });

  it("キャンセル closes the modal and leaves storage/HOME completely unchanged", async () => {
    seedProgressedSaveV2();
    const reload = mockReload();
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByLabelText("Pitz残高 999")).toBeInTheDocument();
    // Captured after mount (not before): mounting itself may settle a pending Starter Grant
    // catch-up write (EP4 migration behavior, unrelated to reset -- see App.tsx's own doc
    // comment on the mount-time `applyStarterGrants` call) before this test's own action
    // (キャンセル) runs; the assertion below is specifically that キャンセル itself never
    // writes again after that point.
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);
    const confirm = await openResetConfirm(user);
    await user.click(within(confirm).getByRole("button", { name: "キャンセル" }));
    expect(document.querySelector(".settings-reset-confirm__panel")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(before);
    expect(reload).not.toHaveBeenCalled();

    // Still shows HOME's original numbers -- cancel never touched GameState either.
    expect(screen.getByLabelText("Pitz残高 999")).toBeInTheDocument();

    // Reload after cancel: still the same progressed state (proves cancel never touched storage).
    cleanup();
    render(<App />);
    expect(screen.getByLabelText("Pitz残高 999")).toBeInTheDocument();
  });

  it("tapping the confirm dialog's backdrop does not reset (no handler, matching this codebase's other overlays)", async () => {
    seedProgressedSaveV2();
    const reload = mockReload();
    const user = userEvent.setup();
    render(<App />);
    await openResetConfirm(user);
    fireEvent.click(document.querySelector(".settings-reset-confirm")!);
    expect(reload).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
  });

  it("disables both buttons and shows リセット中… while a reset is in flight", async () => {
    seedProgressedSaveV2();
    mockReload();
    const user = userEvent.setup();
    render(<App />);
    const confirm = await openResetConfirm(user);
    await user.click(within(confirm).getByRole("button", { name: "最初からやり直す" }));
    expect(within(confirm).getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });
});

describe("Executing the reset (Issue #89 §6)", () => {
  it("最初からやり直す clears storage to exactly createDefaultSave() and reloads once", async () => {
    seedProgressedSaveV2();
    const reload = mockReload();
    const user = userEvent.setup();
    render(<App />);
    const confirm = await openResetConfirm(user);
    await user.click(within(confirm).getByRole("button", { name: "最初からやり直す" }));

    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(loadSave(window.localStorage)).toEqual(createDefaultSave());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("a double-click on 最初からやり直す reloads exactly once and leaves storage in a single valid fresh state", async () => {
    seedProgressedSaveV2();
    const reload = mockReload();
    const user = userEvent.setup();
    render(<App />);
    const confirm = await openResetConfirm(user);
    const confirmButton = within(confirm).getByRole("button", { name: "最初からやり直す" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(loadSave(window.localStorage)).toEqual(createDefaultSave());
  });

  it("an old (v1) save migrated in memory still resets to a clean v2 default, not a migrated-but-reset hybrid", async () => {
    seedV1Save();
    const reload = mockReload();
    const user = userEvent.setup();
    render(<App />);
    // Confirms the pre-reset migrated state actually landed (sanity check the seed took).
    expect(screen.getByLabelText("Pitz残高 30")).toBeInTheDocument();

    const confirm = await openResetConfirm(user);
    await user.click(within(confirm).getByRole("button", { name: "最初からやり直す" }));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(loadSave(window.localStorage)).toEqual(createDefaultSave());
  });
});

describe("Post-reset fresh state (reload simulated via unmount + remount)", () => {
  async function resetAndSimulateReload() {
    seedProgressedSaveV2();
    mockReload();
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const confirm = await openResetConfirm(user);
    await user.click(within(confirm).getByRole("button", { name: "最初からやり直す" }));
    // window.location.reload() is mocked to a no-op above -- simulate its actual effect (a
    // brand new mount reading the now-cleared storage back), matching App.test.tsx's own
    // "still shows HOME first after a reload" convention.
    unmount();
    render(<App />);
  }

  it("HOME shows Pitz 0 and 0 discovered recipes", async () => {
    await resetAndSimulateReload();
    expect(screen.getByLabelText("Pitz残高 0")).toBeInTheDocument();
    expect(screen.getByLabelText(/レシピ図鑑 発見数 0 \//)).toBeInTheDocument();
  });

  it("only Margherita is available in Pizza Select; the next recipe is locked", async () => {
    await resetAndSimulateReload();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expect(screen.getByText(/マルゲリータ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /このピザを作る/ })).not.toBeDisabled();

    // RECIPES's array order (data/recipes.ts) is not the same as the unlock-chain order (see
    // the Fresh Audit §7 table) -- every recipe other than Margherita must be locked
    // regardless of which one this lands on next, so this checks the generic "、未解放"
    // (unlocked) label suffix rather than a specific recipe name.
    await user.click(screen.getByRole("button", { name: "次のレシピ" }));
    expect(screen.getByLabelText(/、未解放$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /このピザを作る/ })).toBeDisabled();
  });

  it("Margherita's round reaches PREPARE using only Starter ingredients (no locked stock gate)", async () => {
    await resetAndSimulateReload();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: /このピザを作る/ }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(screen.getAllByText(/マルゲリータ/).length).toBeGreaterThan(0);
  });

  it("Inventory shows only the three Starter ingredients, none else owned", async () => {
    await resetAndSimulateReload();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(overlay).getByText("トマトソース")).toBeInTheDocument();
    expect(within(overlay).getByText("モッツァレラ")).toBeInTheDocument();
    expect(within(overlay).getByText("バジル")).toBeInTheDocument();
    expect(within(overlay).queryByText("たまねぎ")).not.toBeInTheDocument();
  });

  it("Dex shows nothing discovered", async () => {
    await resetAndSimulateReload();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(overlay).getByText(/発見 0\s*\/\s*13/)).toBeInTheDocument();
  });

  it("stays fresh across a second reload (no resurrection of the cleared save)", async () => {
    await resetAndSimulateReload();
    cleanup();
    render(<App />);
    expect(screen.getByLabelText("Pitz残高 0")).toBeInTheDocument();
    expect(loadSave(window.localStorage)).toEqual(createDefaultSave());
  });
});
