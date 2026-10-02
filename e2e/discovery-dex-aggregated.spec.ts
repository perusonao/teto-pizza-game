import { test, expect, type Page } from "@playwright/test";

/**
 * Discovery 3.0 PR-4b-A (D-1 / D-2 / D-3): a save where several undiscovered recipes are DISCOVERABLE
 * at once (the Dex 11 ladder save plus onions / garlic, which open fugazza and marinara beside
 * capricciosa). #346 S4: every one of them is a registered Research Entry (its own anonymous card), so the
 * Dex no longer adds the old aggregate card; the slots stay plain unknowns, there is no 「💡 ヒントを見る」
 * and no number. HOME's Free Cooking (no Research Target) still gets a hint sheet that picks no recipe and
 * sells nothing. No horizontal overflow at the two iPhone widths.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const LADDER: [string, string[]][] = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]],
];
const materials = [...LADDER.flatMap(([, m]) => m), "onion", "garlic"];
const SAVE = {
  schemaVersion: 2,
  dex: LADDER.slice(0, 11).map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 10])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};

async function open(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    localStorage.setItem("teto.dev.hint5Ladder", "0");
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

test.describe("Dex with several Research Entries (pool 2+)", () => {
  test("no aggregate card, research cards only, no per-card hint, no overflow; Free Cooking's sheet chooses nothing", async ({ page }, testInfo) => {
    await open(page);
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator("[data-dex-aggregated]")).toHaveCount(0);
    const research = page.locator(".dex-overlay__research");
    await research.scrollIntoViewIfNeeded();
    expect(await research.locator(".dex-research-card").count()).toBeGreaterThanOrEqual(2);
    expect(await research.locator(".dex-research-card h3").allTextContents()).toEqual(
      expect.arrayContaining(["？？？ピザ ①", "？？？ピザ ②"]),
    );
    await expect(page.getByRole("button", { name: /ヒントを見る/ })).toHaveCount(0);
    await expect(page.locator('.dex-overlay__chapter [data-dex-state="DISCOVERABLE"]')).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const dir = process.env.HV_SCREENSHOT_DIR;
    if (dir) await page.screenshot({ path: `${dir}/dex-research-only-${testInfo.project.name}.png` });

    await page.getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".dex-overlay")).toHaveCount(0);
    await page.getByRole("button", { name: /フリークッキング/ }).first().click();
    await page.getByRole("button", { name: "ヒント", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: /ヒント/ });
    await expect(sheet).toContainText("まだ発見できるピザがあるよ");
    await expect(sheet.getByRole("button", { name: "ヒントをもらう" })).toHaveCount(0);
    if (dir) await page.screenshot({ path: `${dir}/hint-sheet-open-pool-${testInfo.project.name}.png` });
  });
});
