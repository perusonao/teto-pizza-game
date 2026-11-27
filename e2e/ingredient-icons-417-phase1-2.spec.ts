import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { INGREDIENTS } from "../src/data/ingredients";
import { RECIPES } from "../src/data/recipes";
import { completeDoughStep } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";

const SAVE_KEY = "teto-pizza-save-v1";
const TARGET = "margherita";
const PILOT_VISUALS = [
  "tomato-sauce-bowl", "mozzarella-ball", "basil-leaves", "bacon-rashers", "button-mushrooms",
  "salmon-fillet", "ricotta-mound", "hot-dog-in-bun", "pineapple-wedges", "olive-oil-bottle",
] as const;
const AFTER = process.env.ICON417_AFTER !== "0";

function saveJson() {
  const owned = INGREDIENTS.map((i) => i.id);
  return JSON.stringify({
    schemaVersion: 2,
    dex: RECIPES.filter((r) => r.id !== TARGET).map((r) => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 9999,
    ownedIngredientIds: owned,
    missionBest: {},
    inventory: Object.fromEntries(owned.map((id) => [id, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: owned,
  });
}

async function open(page: Page) {
  const root = process.env.ICON417_TARGET_URL ?? "/";
  await page.goto(new URL("icons/icon-16.png", new URL(root, "http://localhost:5183/teto-pizza-game/")).toString());
  await page.evaluate(([key, value]) => { localStorage.clear(); localStorage.setItem(key, value); }, [SAVE_KEY, saveJson()] as const);
  await page.goto(root);
  await page.waitForSelector(".app-frame");
}

async function capture(page: Page, name: string, project: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${project}.png` });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test.describe("Issue #417 Phase 1–2 pilot identification UI", () => {
  test.setTimeout(180_000);

  test("Shop and Dex share Pilot SVGs", async ({ page }, testInfo) => {
    await open(page);
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    if (AFTER) {
      await expect(page.locator(".shop-overlay__panel svg.ingredient-glyph--olive-oil-bottle")).toBeAttached();
    }
    await noOverflow(page);
    await capture(page, `${AFTER ? "after" : "before"}-shop`, testInfo.project.name);
    await page.getByRole("button", { name: "閉じる" }).click();

    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).not.toContainText("マルゲリータ");
    if (AFTER) for (const visual of PILOT_VISUALS) await expect(page.locator(`.dex-overlay svg.ingredient-glyph--${visual}`).first()).toBeAttached();
    await capture(page, `${AFTER ? "after" : "before"}-dex`, testInfo.project.name);
    await noOverflow(page);
  });

  test("Cooking Tray, Hint and Notebook use the shared identification renderer", async ({ page }, testInfo) => {
    await open(page);
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ }).click();
    if (AFTER) {
      await expect(page.locator(".ingredient-tray svg.ingredient-glyph--tomato-sauce-bowl")).toBeAttached();
      await expect(page.locator(".pizza-stage svg.ingredient-glyph--tomato-sauce-bowl")).toHaveCount(0);
    }
    await capture(page, `${AFTER ? "after" : "before"}-cooking-tray`, testInfo.project.name);
    await page.getByRole("button", { name: "ヒント", exact: true }).click();
    await expect(page.locator(".hint-sheet")).toBeVisible();
    await capture(page, `${AFTER ? "after" : "before"}-hint`, testInfo.project.name);
    const notebookButton = page.locator(".hint-sheet").getByRole("button", { name: /試作ノートを見る/ });
    if (await notebookButton.count()) {
      await notebookButton.click();
      await expect(page.getByRole("dialog", { name: /試作ノート/ })).toBeVisible();
      await capture(page, `${AFTER ? "after" : "before"}-notebook`, testInfo.project.name);
    }
    await noOverflow(page);
    expect(PILOT_VISUALS).toHaveLength(10);
  });
});
