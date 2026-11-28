import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";

const evidenceDir = process.env.HV_SCREENSHOT_DIR;
const recordVideo = Boolean(process.env.HV_VIDEO);
const before = Boolean(process.env.HV_BEFORE);

if (recordVideo) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const SAVE = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 80, bestStars: 3, timesMade: 1 }],
  pitzBalance: 500,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  inventory: { "tomato-sauce": 10, mozzarella: 10, basil: 10 },
  missionBest: {},
  shopProgress: { reputation: 15, grantedMenuRecipeIds: ["margherita"] },
};

async function open(page: Page) {
  await page.goto("/");
  await page.evaluate((save) => {
    localStorage.clear();
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(save));
  }, SAVE);
  await page.goto("/?progression=shop");
  await expect(page.locator(".home-screen")).toBeVisible();
}

async function capture(page: Page, name: string) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll<HTMLElement>(".home-screen, .dex-overlay__body").forEach((element) => {
      element.scrollTop = 0;
    });
  });
  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: `${evidenceDir}/${name}.png` });
  }
  if (recordVideo) await page.waitForTimeout(1500);
}

async function css(locator: Locator, property: string) {
  return locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name).trim(), property);
}

test("P1 palette reaches HOME and keeps Dinner purple outside the four-action system", async ({ page }) => {
  await open(page);
  await capture(page, "01-home-390x844");

  if (!before) {
    const root = page.locator(":root");
    await expect.poll(() => css(root, "--teto-ground-cream")).toBe("#fff7e8");
    await expect.poll(() => css(root, "--teto-ink-brown")).toBe("#4a2e1b");
    await expect.poll(() => css(root, "--teto-action-order")).toBe("#f6ad55");
    await expect.poll(() => css(root, "--teto-action-research")).toBe("#8fd3e8");
    await expect.poll(() => css(root, "--teto-action-shop")).toBe("#b8d986");
    await expect.poll(() => css(root, "--teto-action-lunch")).toBe("#ffd66b");
    await expect.poll(() => css(root, "--dinner-night")).toBe("#2f2a52");
    await expect.poll(() => css(page.locator(".home-action--order"), "background-color")).toBe("rgb(246, 173, 85)");
    await expect.poll(() => css(page.locator(".home-action--research"), "background-color")).toBe("rgb(143, 211, 232)");
    await expect.poll(() => css(page.locator(".home-action--lunch"), "background-color")).toBe("rgb(255, 214, 107)");
    await expect.poll(() => css(page.locator(".home-menu__card--shop"), "background-color")).toBe("rgb(184, 217, 134)");
  }
});

const screens = [
  { opener: /ピザ図鑑 開発/, shot: "02-dex-390x844", panel: ".dex-overlay__panel" },
  { opener: /ショップ NEW/, shot: "03-shop-390x844", panel: ".shop-overlay__panel" },
  { opener: /^🧺 材料/, shot: "04-inventory-390x844", panel: ".inventory-overlay__panel" },
  { opener: /^設定$/, shot: "05-settings-390x844", panel: ".settings-overlay__panel" },
] as const;

for (const screen of screens) {
  test(`${screen.shot} uses the shared cream sheet ground`, async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: screen.opener }).click();
    await expect(page.locator(screen.panel)).toBeVisible();
    if (!before) {
      await expect.poll(() => css(page.locator(screen.panel), "background-color")).toBe("rgb(255, 247, 232)");
      if (screen.shot === "03-shop-390x844") {
        await expect.poll(() => css(page.locator(`${screen.panel} .dex-overlay__header`), "background-color")).toBe("rgb(184, 217, 134)");
      }
    }
    await capture(page, screen.shot);
  });
}

test("Lunch Rush uses the yellow action color", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /ランチラッシュ/ }).click();
  await expect(page.locator(".mission-overlay__panel")).toBeVisible();
  if (!before) await expect.poll(() => css(page.locator(".mission-overlay__panel"), "border-top-color")).toBe("rgb(255, 214, 107)");
  await capture(page, "06-lunch-rush-390x844");
});

test("Order and menu-development screens carry their action accents", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /注文を受ける/ }).click();
  await expect(page.locator(".game-screen--order")).toBeVisible();
  await expect.poll(() => css(page.locator(".game-screen--order > .app-header"), "box-shadow")).toContain("rgb(246, 173, 85)");

  await open(page);
  await page.locator(".home-action--research").click();
  await expect(page.locator(".game-screen--research")).toBeVisible();
  await expect.poll(() => css(page.locator(".game-screen--research > .app-header"), "box-shadow")).toContain("rgb(143, 211, 232)");
});
