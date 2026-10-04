import { test, expect, type Page } from "@playwright/test";

/**
 * Discovery 3.0 #346 S2: the Dex 「🔎 研究中のピザ」 section. Two or more registered entries show
 * anonymous ①② cards (display only, no CTA), no hidden name / No.xx / count, and no horizontal
 * overflow at the two iPhone widths; the formal chapters below still render.
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
  inventory: Object.fromEntries(materials.map((m) => [m, 0])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};

async function open(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

test("research section: anonymous cards, no overflow, formal Dex intact", async ({ page }, testInfo) => {
  await open(page);
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  const section = page.locator(".dex-overlay__research");
  await expect(section).toHaveCount(1);
  await section.scrollIntoViewIfNeeded();
  await expect(section).toContainText("🔎 研究中のピザ");
  const titles = await section.locator(".dex-research-card h3").allTextContents();
  expect(titles.length).toBeGreaterThanOrEqual(2);
  expect(titles.slice(0, 2)).toEqual(["？？？ピザ ①", "？？？ピザ ②"]);
  // #378: every material is at stock 0 here, so each (registered) card carries the fixed notice and the Shop
  // CTA -- and still no research CTA, name, number or count.
  await expect(section.locator("button", { hasText: "研究する" })).toHaveCount(0);
  await expect(section.locator(".dex-card__research-stock-notice")).toHaveCount(titles.length);
  await expect(section).not.toContainText(/No\.|残り|あと|\/|%/);
  await expect(page.locator(".dex-overlay__chapter")).toHaveCount(3);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const bodyOverflow = await page.locator(".dex-overlay__body").evaluate((e) => e.scrollWidth - e.clientWidth);
  expect(bodyOverflow).toBeLessThanOrEqual(0);
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) {
    await page.locator(".dex-overlay__body").evaluate((e) => (e.scrollTop = 0));
    await page.screenshot({ path: `${dir}/dex-research-top-${testInfo.project.name}.png` });
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/dex-research-${testInfo.project.name}.png` });
  }
});
