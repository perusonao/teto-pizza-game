import { beforeEach, describe, expect, it, vi } from "vitest";
import { legacyStartupSave } from "../../e2e/support/legacyStartupSave";
import type { ProgressionModelId } from "../logic/progression/progressionModelId";
import { EMPTY_SHOP_PROGRESS, researchPointsEarnedOf } from "../logic/progression/shopProgress";
import { getDexEntry } from "./dex";
import { gameReducer } from "./gameReducer";
import { PENDING_ROUND_VERSION } from "./pendingRound";
import { SAVE_STORAGE_KEY, commitProgress, loadSave, persistProgress, readStoredJournal } from "./persistence";
import { progressionSnapshotOf } from "./roundCommit";
import { referencePizzaFor } from "./testSupport/confirmBakeMatrix";
import { memoryStorage } from "./testSupport/memoryStorage";
import { Tab, type StorageLike } from "./testSupport/r8Harness";

const page = vi.hoisted(() => ({ mode: "legacy" as ProgressionModelId, shopReady: true }));
vi.mock("../logic/progression/progressionModelFlag", () => ({
  get PROGRESSION_MODEL_ID() { return page.mode; },
  progressionModelId: () => page.mode,
}));
vi.mock("../logic/progression/reputationTable", async (original) => {
  const table = await original<typeof import("../logic/progression/reputationTable")>();
  return { ...table, canEnableShopProgression: () => page.shopReady && table.canEnableShopProgression() };
});

const SHOP_AT_39 = {
  reputation: 39,
  grantedMenuRecipeIds: ["margherita"],
  awaitingMenuRecipeIds: ["meat-lovers", "funghi"],
  menuEntryPaidRecipeIds: ["funghi"],
};

function seed(save: object = legacyStartupSave) {
  return memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(save) });
}

function newPage(mode: ProgressionModelId, storage: ReturnType<typeof seed>): Tab {
  page.mode = mode;
  return new Tab(storage);
}

function rawSave(storage: StorageLike): string {
  return storage.getItem(SAVE_STORAGE_KEY)!;
}

function bakeMargherita(tab: Tab) {
  expect(tab.state.recipe.id).toBe("margherita");
  tab.apply({ type: "BEGIN_PREPARE" });
  tab.setRound(gameReducer({ ...tab.state, pizza: referencePizzaFor("margherita") }, { type: "START_BAKE" }));
  expect(tab.bake().status).toBe("committed");
  expect(tab.state.phase).toBe("POST_BAKE");
}

beforeEach(() => {
  page.mode = "legacy";
  page.shopReady = true;
});

describe("R8 settlement across modes on the same save key", () => {
  const directions = [["legacy", "shop"], ["shop", "legacy"]] as const;

  it.each(directions)("settles a %s order once when reloaded in %s, including the existing shop ledgers", (origin, destination) => {
    const storage = seed({ ...legacyStartupSave, shopProgress: SHOP_AT_39 });
    const baking = newPage(origin, storage);
    bakeMargherita(baking);
    expect(readStoredJournal(storage)).toMatchObject({ kind: "round", round: { v: PENDING_ROUND_VERSION, originMode: origin, status: "pending" } });

    const reloaded = newPage(destination, storage.view());
    expect(reloaded.settled).toMatchObject({ originMode: origin, status: "settled", settled: { outcome: "REGISTERED", discovered: false } });
    const earnedPitz = origin === "legacy" ? 120 : 170;
    expect(reloaded.settled?.settled).toMatchObject({ stars: 5, earnedPitz });
    const pitz = reloaded.state.pitzBalance;
    expect(pitz).toBe(legacyStartupSave.pitzBalance + earnedPitz);
    expect(getDexEntry(reloaded.state.dex, "margherita")?.timesMade).toBe(2);
    expect(reloaded.state.inventory).toEqual(legacyStartupSave.inventory);
    expect(reloaded.state.shop).toEqual(origin === "legacy" ? SHOP_AT_39 : {
      ...SHOP_AT_39,
      reputation: 50, // 39 + 8 for the order + 3 for the menu entry
      menuEntryPaidRecipeIds: ["funghi", "meat-lovers"],
    });
    // The first page cannot erase the settled notice by confirming its stale CUT step.
    const settledRaw = rawSave(storage);
    page.mode = origin;
    expect(baking.cutAndConfirm()).toEqual({ status: "refused", commit: { status: "blocked", block: "stale-save" } });
    expect(rawSave(storage)).toBe(settledRaw);

    const back = newPage(origin, storage.view());
    expect(back.settled).toEqual(reloaded.settled);
    expect(back.state.shop).toEqual(reloaded.state.shop);
    expect(back.state.pitzBalance).toBe(pitz);
    expect(back.acknowledge()).toEqual({ status: "ok" });
    const again = newPage(destination, storage.view());
    expect(again.settled).toBeNull();
    expect(again.state.pitzBalance).toBe(pitz);
    expect(getDexEntry(again.state.dex, "margherita")?.timesMade).toBe(2);
    expect(again.state.shop).toEqual(reloaded.state.shop);
    expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it.each(["legacy", "shop"] as const)("replays a v1 journal under legacy rules when the page is %s", (destination) => {
    const baked = newPage("legacy", seed({ ...legacyStartupSave, shopProgress: SHOP_AT_39 }));
    bakeMargherita(baked);
    const { v: _v, originMode: _origin, ...oldRound } = baked.state.pendingRound!;
    const storage = seed({ ...baked.stored(), pendingRound: { ...oldRound, v: 1 } });

    const reloaded = newPage(destination, storage);
    expect(reloaded.settled).toMatchObject({ v: 1, status: "settled", settled: { outcome: "REGISTERED" } });
    expect(reloaded.settled).not.toHaveProperty("originMode");
    expect(reloaded.state.shop).toEqual(SHOP_AT_39);
    expect(getDexEntry(reloaded.state.dex, "margherita")?.timesMade).toBe(2);
    expect(reloaded.state.pitzBalance).toBeGreaterThan(legacyStartupSave.pitzBalance);
  });

  it.each(directions)("uses the %s matcher and Research Point rules for Free Cooking when reloaded in %s", (origin, destination) => {
    const recipeId = "pesto-patate"; // exact match outside the curated shop catalog
    const pizza = referencePizzaFor(recipeId);
    const used = [...pizza.sauceIds, ...pizza.toppings.map((piece) => piece.ingredientId)];
    const storage = seed({
      ...legacyStartupSave,
      ownedIngredientIds: [...legacyStartupSave.ownedIngredientIds, ...used],
      inventory: { ...legacyStartupSave.inventory, ...Object.fromEntries(used.map((id) => [id, 20])) },
    });
    const baking = newPage(origin, storage);
    baking.apply({ type: "START_FREE_COOK" }, { type: "BEGIN_PREPARE" });
    baking.setRound(gameReducer({ ...baking.state, pizza }, { type: "START_BAKE" }));
    expect(baking.bake(68).status).toBe("committed");
    expect(readStoredJournal(storage)).toMatchObject({ kind: "round", round: { kind: "FREE_COOK", originMode: origin, status: "pending" } });
    const consumed = loadSave(storage).inventory;
    expect(consumed.potato).toBeLessThan(20);

    const reloaded = newPage(destination, storage.view());
    expect(reloaded.state.inventory).toEqual(consumed);
    if (origin === "legacy") {
      expect(getDexEntry(reloaded.state.dex, recipeId)?.timesMade).toBe(1);
      expect(reloaded.settled?.settled?.outcome).toBe("REGISTERED");
      expect(reloaded.state.pitzBalance).toBeGreaterThan(legacyStartupSave.pitzBalance);
      expect(researchPointsEarnedOf(reloaded.state.shop)).toBe(0);
    } else {
      expect(getDexEntry(reloaded.state.dex, recipeId)).toBeUndefined();
      expect(reloaded.settled?.settled?.outcome).toBe("ORIGINAL");
      expect(reloaded.state.pitzBalance).toBe(legacyStartupSave.pitzBalance);
      expect(researchPointsEarnedOf(reloaded.state.shop)).toBe(1);
    }
  });

  it("holds an unplayable shop journal through ordinary writes and can replay it when shop becomes available", () => {
    const storage = seed();
    const baking = newPage("shop", storage);
    bakeMargherita(baking);
    const journal = baking.stored().pendingRound;

    page.shopReady = false;
    const held = newPage("legacy", storage.view());
    expect(held.held).toBe("unresolvable");
    expect(held.settled).toBeNull();
    expect(held.state.pitzBalance).toBe(legacyStartupSave.pitzBalance);
    const snapshot = progressionSnapshotOf({ ...held.state, pitzBalance: held.state.pitzBalance + 1 }, undefined);
    expect(persistProgress(snapshot, held.storage).blocked).toBeUndefined();
    expect(held.stored().pendingRound).toEqual(journal);
    expect(commitProgress({ ...snapshot, pendingRound: null }, held.storage)).toEqual({ status: "failed", failure: "occupied" });
    expect(held.stored().pendingRound).toEqual(journal);

    page.shopReady = true;
    const reloaded = newPage("legacy", storage.view());
    expect(reloaded.settled).toMatchObject({ originMode: "shop", status: "settled" });
    expect(reloaded.state.shop.reputation).toBeGreaterThan(0);
    expect(getDexEntry(reloaded.state.dex, "margherita")?.timesMade).toBe(2);
  });
});

it("retains shared records and merges the shop ledgers on a legacy → shop → legacy → shop round trip", () => {
  const storage = seed();
  expect(newPage("legacy", storage).state.shop).toEqual(EMPTY_SHOP_PROGRESS);
  const shop = newPage("shop", storage.view());
  expect(shop.state.shop).toEqual(EMPTY_SHOP_PROGRESS);
  expect(shop.stored()).toMatchObject(legacyStartupSave);
  expect(shop.stored()).not.toHaveProperty("shopProgress");
  expect(commitProgress(progressionSnapshotOf({ ...shop.state, shop: SHOP_AT_39 }, undefined), shop.storage)).toEqual({ status: "ok" });

  const legacy = newPage("legacy", storage.view());
  expect(legacy.state.shop).toEqual(SHOP_AT_39);
  const legacyUpdate = {
    ...legacy.state,
    pitzBalance: legacy.state.pitzBalance + 5,
    shop: { reputation: 15, grantedMenuRecipeIds: ["pepperoni"], awaitingMenuRecipeIds: ["pepperoni"], menuEntryPaidRecipeIds: ["pepperoni"] },
  };
  expect(persistProgress(progressionSnapshotOf(legacyUpdate, undefined), legacy.storage).blocked).toBeUndefined();

  const shopAgain = newPage("shop", storage.view());
  expect(shopAgain.state.shop).toEqual({
    reputation: 39,
    grantedMenuRecipeIds: ["margherita", "pepperoni"],
    awaitingMenuRecipeIds: ["meat-lovers", "funghi", "pepperoni"],
    menuEntryPaidRecipeIds: ["funghi", "pepperoni"],
  });
  expect(shopAgain.stored()).toMatchObject({ ...legacyStartupSave, pitzBalance: 736 });
  expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
});
