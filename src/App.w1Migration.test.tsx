import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY, createDefaultSave } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";
import { SHIPPED_15_DISCOVERY_LADDER } from "./data/discoveryLadder";
import { materialIdsOfSteps } from "./logic/discoveryLadder";
import { LUNCH_RUSH_MISSION_ID } from "./mission/lunchRush";

/**
 * Progression 2.0 W1 I5b-3: the Fresh Audit migration matrix A-G (docs/reports/
 * TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md §11) through the real App load path, now that the 25-recipe
 * ladder is live. Loading only ever *adds* entitlement: no relock, no stock loss, no free grant,
 * no load-time NEW MATERIAL notice; Pitz, Lunch Rush best, the claimed ledger, unknown ids and
 * unknown keys are kept.
 */

const d = (id: string) => ({ recipeId: id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 });
const PRE_W1_IDS = RECIPES.slice(0, 15).map((r) => r.id);
const ALL_OLD_LADDER = materialIdsOfSteps(SHIPPED_15_DISCOVERY_LADDER.steps);

function stored(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY) ?? "null");
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

interface Case {
  name: string;
  save: Record<string, unknown> | null;
  /** The ledger after load (order = existing ledger, then owned finite, then the ladder reach). */
  expectedLedger: string[];
  /** Materials that should show as NEW rows in the Shop right after load. */
  expectedNewRows: string[];
}

const CASES: Case[] = [
  { name: "A new save", save: null, expectedLedger: [], expectedNewRows: [] },
  {
    name: "B Margherita only",
    save: { ...createDefaultSave(), dex: [d("margherita")], pitzBalance: 40, unlockedForShopIngredientIds: ["egg"] },
    expectedLedger: ["egg"],
    expectedNewRows: ["egg"],
  },
  {
    name: "C Dex 5 on the old ladder",
    save: {
      ...createDefaultSave(),
      dex: ["margherita", "bismarck", "breakfast-pizza", "funghi", "pepperoni"].map(d),
      pitzBalance: 77,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg", "bacon", "mushroom", "pepperoni"],
      inventory: { egg: 3, bacon: 12, mushroom: 0, pepperoni: 20 },
      unlockedForShopIngredientIds: ["egg", "bacon", "mushroom", "pepperoni", "sausage"],
      missionBest: { [LUNCH_RUSH_MISSION_ID]: 432 },
    },
    expectedLedger: ["egg", "bacon", "mushroom", "pepperoni", "sausage", "eggplant", "parmigiano"],
    expectedNewRows: ["eggplant", "parmigiano", "sausage"],
  },
  {
    name: "D all 15 old recipes discovered",
    save: {
      ...createDefaultSave(),
      dex: PRE_W1_IDS.map(d),
      pitzBalance: 555,
      // A player who bought every old material (ham still has pre-W1 k = 1 stock).
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...ALL_OLD_LADDER],
      inventory: { ...Object.fromEntries(ALL_OLD_LADDER.map((id) => [id, 5])), ham: 4 },
      unlockedForShopIngredientIds: ALL_OLD_LADDER,
      missionBest: { [LUNCH_RUSH_MISSION_ID]: 1200 },
    },
    expectedLedger: [...ALL_OLD_LADDER, "eggplant", "corn", "pineapple"],
    expectedNewRows: ["eggplant", "corn", "pineapple"],
  },
  {
    name: "E existing EP4 save (no ledger key)",
    save: {
      schemaVersion: 2,
      dex: ["margherita", "funghi", "marinara"].map(d),
      pitzBalance: 321,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom", "garlic", "oregano"],
      missionBest: { [LUNCH_RUSH_MISSION_ID]: 900 },
      inventory: { mushroom: 17, garlic: 3, oregano: 0 },
      starterGrantClaimedRecipeIds: ["funghi", "marinara"],
    },
    expectedLedger: ["mushroom", "garlic", "oregano", "egg", "bacon"],
    expectedNewRows: ["egg", "bacon"],
  },
  {
    name: "F I5a-era future save owning W1 materials",
    save: {
      ...createDefaultSave(),
      dex: ["margherita", "bismarck"].map(d),
      pitzBalance: 10,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg", "clam", "corn"],
      inventory: { egg: 7, clam: 6, corn: 0 },
      unlockedForShopIngredientIds: ["egg", "bacon", "clam", "corn"],
    },
    expectedLedger: ["egg", "bacon", "clam", "corn"],
    expectedNewRows: ["bacon"],
  },
  {
    name: "G unknown recipe / ingredient ids and keys",
    save: {
      ...createDefaultSave(),
      dex: [d("margherita"), d("brazilian-calabresa")],
      pitzBalance: 5,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "calabresa"],
      inventory: { calabresa: 9 },
      unlockedForShopIngredientIds: ["egg", "calabresa"],
      futureLedger: { purchased: ["calabresa"] },
    },
    expectedLedger: ["egg", "calabresa"],
    expectedNewRows: ["egg"],
  },
];

describe("I5b-3 migration matrix A-G through the App load path", () => {
  it.each(CASES)("$name", async ({ save, expectedLedger, expectedNewRows }) => {
    if (save) window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
    const user = userEvent.setup();
    render(<App />);

    // No NEW MATERIAL notice at load (it only ever appears on a RESULT screen).
    expect(document.querySelector(".material-unlock-notice")).toBeNull();

    const after = stored();
    if (!save) {
      // A brand-new player writes nothing on mount.
      expect(after).toBeNull();
    } else {
      expect(after.unlockedForShopIngredientIds).toEqual(expectedLedger);
      // Nothing was re-locked: every entitlement the save already had is still there.
      for (const id of save.unlockedForShopIngredientIds as string[] | undefined ?? []) {
        expect(after.unlockedForShopIngredientIds).toContain(id);
      }
      // No stock loss, no free grant, Pitz / Lunch Rush / claimed ledger / unknown data kept.
      expect(after.inventory).toEqual(save.inventory ?? {});
      expect(after.ownedIngredientIds).toEqual(save.ownedIngredientIds);
      expect(after.pitzBalance).toBe(save.pitzBalance);
      expect(after.missionBest).toEqual(save.missionBest ?? {});
      expect(after.starterGrantClaimedRecipeIds).toEqual(save.starterGrantClaimedRecipeIds ?? []);
      expect(after.dex).toEqual(save.dex);
      if ("futureLedger" in save) expect(after.futureLedger).toEqual(save.futureLedger);
    }

    // The Shop shows the newly reached materials as NEW at stock 0.
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    const newRows = Array.from(shop.querySelectorAll<HTMLElement>('.shop-item[data-shop-state="NEW"]')).map(
      (e) => e.dataset.ingredientId,
    );
    expect(newRows.sort()).toEqual([...expectedNewRows].sort());
    for (const row of shop.querySelectorAll<HTMLElement>('.shop-item[data-shop-state="NEW"]')) {
      expect(row.textContent).toContain("在庫 0");
    }
  });
});
