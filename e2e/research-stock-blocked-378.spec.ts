import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { getIngredient } from "../src/data/ingredients";

/**
 * #378 Option 1: a registered Research Entry blocked only by stock shows the fixed notice + Shop CTA; the Shop marks
 * every owned stock-0 material 「在庫なし」; refilling and closing the Shop brings the research CTA back.
 * Production data: ladder step 25 with brazilian-calabresa found -> pesto-pollo is the single entry (chicken stock 0).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const keys = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId), "brazilian-calabresa"];
// Step 25 state: the step-26 material (shrimp, Expansion Slice 1) is not entitled yet, so it is not seeded.
const mats = DISCOVERY_LADDER.steps
  .filter((s) => s.step <= 25)
  .flatMap((s) => [...s.ingredientIds])
  .filter((id) => !!getIngredient(id)?.unlockCondition);
const SAVE = {
  schemaVersion: 2,
  dex: keys.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: [...STARTERS, ...mats],
  missionBest: {},
  inventory: Object.fromEntries(mats.map((m) => [m, m === "chicken" ? 0 : 10])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: mats,
};

async function shot(page: Page, testInfo: { project: { name: string } }, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}-${testInfo.project.name}.png` });
}

test("stock-blocked research card -> Shop (在庫なし) -> refill -> close -> research CTA is back", async ({ page }, testInfo) => {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");

  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  const section = page.locator(".dex-overlay__research");
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator(".dex-card__research-stock-notice")).toHaveText("研究を続けるには材料の補充が必要");
  await expect(section.getByRole("button", { name: /研究する/ })).toHaveCount(0);
  const text = (await section.textContent()) ?? "";
  expect(text).not.toMatch(/ペスト|ポッロ|No\.|あと|残り|不足|種類|\d/);
  await shot(page, testInfo, "before-01-dex-stock-blocked");

  await section.getByRole("button", { name: /ショップで補充する/ }).click();
  const shop = page.locator(".shop-overlay__panel");
  await expect(shop).toBeVisible();
  const chicken = shop.locator('[data-ingredient-id="chicken"]');
  await chicken.scrollIntoViewIfNeeded();
  await expect(chicken).toContainText("在庫なし");
  await expect(shop.locator('[data-ingredient-id="pesto"]')).not.toContainText("在庫なし");
  await expect(shop.locator('[data-stock-state="EMPTY"]')).toHaveCount(1);
  await shot(page, testInfo, "after-02-shop-zero-stock");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await chicken.getByRole("button", { name: "補充する" }).click();
  await expect(chicken).not.toContainText("在庫なし");
  await shop.getByRole("button", { name: "閉じる" }).click();
  await expect(shop).toHaveCount(0);
  await expect(page.locator(".dex-overlay")).toBeVisible();
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("button", { name: /を研究する/ })).toBeVisible();
  await expect(section.locator(".dex-card__research-stock-notice")).toHaveCount(0);
  await shot(page, testInfo, "after-03-research-cta-back");
});
