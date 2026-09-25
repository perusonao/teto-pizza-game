import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY, createDefaultSave, type PersistentSaveV2 } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { LUNCH_RUSH_MISSION_ID } from "./mission/lunchRush";

/**
 * Progression 2.0 W1 Integration I4b-3: App.tsx's load path resolves the Discovery Ladder
 * (`resolveShopEntitlement`) instead of EP4's Starter Grant catch-up, and persists the Shop
 * entitlement ledger. This is the existing-save migration (docs/reports/
 * TETO_PROGRESS2_W1_I4B_Fresh-Audit.md §3 K): owned materials and their stock are kept, ladder
 * materials the player lacks become NEW at stock 0, nothing is granted.
 */

function stored(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY) ?? "null");
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("load-time migration of an existing EP4 save", () => {
  it("keeps owned materials, stock, Pitz and the claimed ledger; adds the ladder reach at stock 0", () => {
    const legacy = {
      schemaVersion: 2,
      dex: [
        { recipeId: "margherita", discovered: true, bestScore: 88, bestStars: 4, timesMade: 5 },
        { recipeId: "funghi", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
        { recipeId: "marinara", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
      ],
      pitzBalance: 321,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom", "garlic", "oregano"],
      missionBest: { [LUNCH_RUSH_MISSION_ID]: 900 },
      inventory: { mushroom: 17, garlic: 3, oregano: 0 },
      starterGrantClaimedRecipeIds: ["funghi", "marinara"],
    };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(legacy));
    render(<App />);

    const save = stored() as unknown as PersistentSaveV2;
    // Dex 3 -> ladder steps 1-3 (egg, bacon, mushroom); mushroom was already owned.
    expect(save.unlockedForShopIngredientIds).toEqual(["mushroom", "garlic", "oregano", "egg", "bacon"]);
    // EP4 retired: bismarck is EP1-unlocked by marinara, but no Starter Grant lands for it.
    expect(save.starterGrantClaimedRecipeIds).toEqual(["funghi", "marinara"]);
    expect(save.ownedIngredientIds).toEqual(legacy.ownedIngredientIds);
    expect(save.inventory).toEqual(legacy.inventory);
    expect(save.pitzBalance).toBe(321);
    expect(save.dex).toEqual(legacy.dex);
    expect(save.missionBest).toEqual(legacy.missionBest);
  });

  it("a brand-new player writes nothing on mount (empty Dex -> nothing unlocked)", () => {
    render(<App />);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
  });

  it("reloading an already-migrated save is a no-op", () => {
    const current = {
      ...createDefaultSave(),
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }],
      unlockedForShopIngredientIds: ["egg"],
    };
    const raw = JSON.stringify(current);
    window.localStorage.setItem(SAVE_STORAGE_KEY, raw);
    render(<App />);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });

  it("unknown ingredient ids in the ledger survive the load + write", () => {
    const current = {
      ...createDefaultSave(),
      dex: [
        { recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 },
        { recipeId: "bismarck", discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 },
      ],
      unlockedForShopIngredientIds: ["egg", "future-ingredient"],
      inventory: { "future-ingredient": 9 },
    };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(current));
    render(<App />);
    const save = stored();
    // Dex 2 -> bacon newly entitled; the unknown id and its stock are kept.
    expect(save.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "future-ingredient"]);
    expect(save.inventory).toEqual({ "future-ingredient": 9 });
  });
});

/** A save whose only discovery is margherita, with the ladder's step 1 (egg) already unlocked. */
function seedEggNew(pitzBalance: number): void {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      ...createDefaultSave(),
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
      pitzBalance,
      unlockedForShopIngredientIds: ["egg"],
    }),
  );
}

async function openShop(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: /ショップ/ }));
  return document.querySelector<HTMLElement>(".dex-overlay")!;
}

function eggRow(shop: HTMLElement): HTMLElement {
  return shop.querySelector<HTMLElement>('.shop-item[data-ingredient-id="egg"]')!;
}

describe("I4b-4 Shop through the real App: NEW -> first pack -> OWNED, persisted", () => {
  it("buys egg's first pack: NEW -> OWNED, stock 0 -> 10, Pitz -60, and it survives a reload", async () => {
    seedEggNew(100);
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    let shop = await openShop(user);
    expect(eggRow(shop).dataset.shopState).toBe("NEW");
    expect(within(eggRow(shop)).getByText("在庫 0")).toBeInTheDocument();

    await user.click(within(eggRow(shop)).getByRole("button", { name: "仕入れる" }));
    expect(eggRow(shop).dataset.shopState).toBe("OWNED");
    expect(within(eggRow(shop)).getByText("在庫 10")).toBeInTheDocument();
    expect(within(shop).getByText(/40 Pitz/)).toBeInTheDocument(); // balance 100 - 60
    expect(within(shop).getByText(/たまごを仕入れました！（10ピザ分（10個））/)).toBeInTheDocument();
    expect(within(eggRow(shop)).getByText(/補充 .*30 Pitz/)).toBeInTheDocument();

    const saved = stored() as unknown as PersistentSaveV2;
    expect(saved.ownedIngredientIds).toContain("egg");
    expect(saved.inventory).toEqual({ egg: 10 });
    expect(saved.pitzBalance).toBe(40);

    // Reload.
    unmount();
    render(<App />);
    shop = await openShop(user);
    expect(eggRow(shop).dataset.shopState).toBe("OWNED");
    expect(within(eggRow(shop)).getByText("在庫 10")).toBeInTheDocument();
  });

  it("refill after the first pack adds 10 more for 30 Pitz", async () => {
    seedEggNew(100);
    const user = userEvent.setup();
    render(<App />);
    const shop = await openShop(user);
    await user.click(within(eggRow(shop)).getByRole("button", { name: "仕入れる" }));
    await user.click(within(eggRow(shop)).getByRole("button", { name: "補充する" }));
    expect(within(eggRow(shop)).getByText("在庫 20")).toBeInTheDocument();
    expect(within(shop).getByText(/たまごを補充しました！/)).toBeInTheDocument();
    expect((stored() as unknown as PersistentSaveV2).pitzBalance).toBe(10);
  });

  it("insufficient Pitz: the first pack cannot be bought and nothing changes", async () => {
    seedEggNew(59);
    const user = userEvent.setup();
    render(<App />);
    const shop = await openShop(user);
    const button = within(eggRow(shop)).getByRole("button", { name: "仕入れる" });
    expect(button).toBeDisabled();
    expect(within(eggRow(shop)).getByText("あと 1 Pitz たりません")).toBeInTheDocument();
    await user.click(button);
    expect(eggRow(shop).dataset.shopState).toBe("NEW");
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).not.toContain('"egg":');
  });

  it("the progress hint counts toward the next step without naming it", async () => {
    seedEggNew(0);
    const user = userEvent.setup();
    render(<App />);
    const shop = await openShop(user);
    expect(within(shop).getByText(/あと1つ発見で新しい材料が入荷/)).toBeInTheDocument();
    expect(shop.textContent).not.toContain("ベーコン");
  });
});

describe("progress hint on a migrated EP4 save (PR #227 review)", () => {
  it("Margherita + Funghi with EP4-owned mushroom: the hint counts to step 4, not 'one more'", async () => {
    window.localStorage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        dex: [
          { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
          { recipeId: "funghi", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
        ],
        pitzBalance: 0,
        ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "mushroom"],
        missionBest: {},
        inventory: { mushroom: 12 },
        starterGrantClaimedRecipeIds: ["funghi"],
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    const shop = await openShop(user);
    expect(within(shop).getByText(/あと2つ発見で新しい材料が入荷/)).toBeInTheDocument();
  });
});

describe("A2 in the real Pizza Select: a Free-Cooking discovery is re-selectable", () => {
  it("discovered Bismarck (EP1 chain predecessor marinara NOT discovered) is not LOCKED", async () => {
    window.localStorage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        ...createDefaultSave(),
        dex: [
          { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
          { recipeId: "bismarck", discovered: true, bestScore: 65, bestStars: 3, timesMade: 1 },
        ],
        ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg"],
        inventory: { egg: 9 },
        unlockedForShopIngredientIds: ["egg", "bacon"],
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    const card = screen.getByRole("button", { name: /^ビスマルク、/ });
    expect(card.getAttribute("aria-label")).not.toMatch(/未解放/);
    expect(card.getAttribute("aria-label")).toMatch(/最高評価3つ星/);
    // Marinara itself stays EP1-locked (undiscovered, its chain is unchanged).
    expect(screen.getByRole("button", { name: /^マリナーラ、/ }).getAttribute("aria-label")).toMatch(/未解放/);
  });
});
