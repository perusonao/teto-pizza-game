import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { RECIPES } from "../src/data/recipes";

/**
 * B案 Phase 3d (Issue #901, Owner 2026-11-27), on the dev server under `?progression=shop`:
 * 1. the next trial's hint sheet sells research point hints (never Pitz): the board, the price, the balance;
 * 2. a purchase reveals exactly that item and lowers the balance (Pitz unchanged); the price rises by 1 on the same recipe;
 * 3. the cooking screen lists what is revealed at its top edge;
 * 4. the Dex shows the same on that recipe's slot, and a reload keeps all of it;
 * 5. not enough points: the buttons are disabled and the sheet says so;
 * 6. legacy (no parameter): the hint sheet is the Pitz ladder, as before.
 *
 * `HV_VIDEO=1` records the Human Verification video, `HV_SCREENSHOT_DIR=<dir>` writes the screenshots; `HV_BEFORE=1` only captures
 * (for the `main` "before" screenshots, where the Phase 3d UI does not exist).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const MEAT = ["bacon", "ham", "pepperoni", "sausage"];
const STRICT = !process.env.HV_BEFORE;

/** Every other recipe these materials make is already in the Dex, so meat-lovers is the hint sheet's lone target. */
const OTHERS = RECIPES.filter(
  (r) => r.id !== "meat-lovers" && r.requiredIngredients.every((x) => [...STARTERS, ...MEAT].includes(x.ingredientId)),
).map((r) => r.id);
/** Reputation 45: stage 2 (meat-lovers) is open. 10 research points earned, none spent. */
const save = (researchPointsEarned = 10) => ({
  schemaVersion: 2,
  dex: OTHERS.map((recipeId) => ({ recipeId, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 })),
  pitzBalance: 500,
  ownedIngredientIds: [...STARTERS, ...MEAT],
  missionBest: {},
  inventory: { bacon: 4, ham: 2, pepperoni: 2, sausage: 4 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: [...MEAT],
  shopProgress: { reputation: 45, grantedMenuRecipeIds: [], researchPointsEarned },
});

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}
async function open(page: Page, query: string, json: object) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(json)] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
}
const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
const board = (page: Page) => page.locator(".hint-sheet").getByTestId("shop-hint-board");

async function startTrialWithHintSheet(page: Page) {
  await page.locator(".cta-button--free-cook").first().click();
  await page.waitForSelector(".pizza-stage");
  await page.getByRole("button", { name: /^ヒント$/ }).first().click();
  await expect(page.locator(".hint-sheet")).toBeVisible();
}
async function closeSheet(page: Page) {
  await page.locator(".hint-sheet").getByRole("button", { name: "閉じる" }).first().click();
  await expect(page.locator(".hint-sheet")).toHaveCount(0);
}
async function home(page: Page) {
  await page.getByRole("button", { name: /ホーム/ }).first().click();
  await page.waitForSelector(".home-screen");
}

test.describe("B案 Phase 3d: research point hints (shop model)", () => {
  test.setTimeout(180_000);

  test("buy on the hint sheet -> revealed on the sheet, the cooking screen and the Dex -> a reload keeps it", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await open(page, "?progression=shop", save());
    await capture(page, "01-home-shop");
    await hold(page, 1500);

    await startTrialWithHintSheet(page);
    if (STRICT) {
      const sheet = page.locator(".hint-sheet");
      await expect(sheet).toHaveAttribute("data-hint-ladder", "shop");
      await expect(sheet).not.toContainText("Pitz");
      await expect(page.getByTestId("shop-hint-wallet")).toContainText("研究ポイント 10");
      await expect(page.getByTestId("shop-hint-wallet")).toContainText("次のヒント 1点");
      // Sausage is the Research Entry's own clue (「？？？ピザ（ソーセージ）」): known from the start, never charged.
      await expect(board(page).locator('[data-shop-hint-slot="unknown"]')).toHaveCount(4);
      await expect(board(page).locator('[data-shop-hint-slot="known"]')).toContainText("ソーセージ");
      await noOverflow(page, "hint sheet (shop board)");
    }
    await capture(page, "02-hint-sheet-board");
    await hold(page, 2500);

    if (STRICT) {
      // 1 point (stage 2 base), then 2 points (+1 on the same recipe).
      await board(page).getByRole("button", { name: /ソースを見る/ }).click();
      await expect(board(page).locator('[data-shop-hint-row="SAUCE"]')).toContainText("トマトソース");
      await expect(page.getByTestId("shop-hint-wallet")).toContainText("研究ポイント 9");
      await expect(page.getByTestId("shop-hint-wallet")).toContainText("次のヒント 2点");
      await hold(page, 1500);
      await board(page).getByRole("button", { name: /材料を1つ見る/ }).click();
      await expect(board(page).locator('[data-shop-hint-slot="known"]')).toHaveCount(2);
      await expect(board(page).locator('[data-shop-hint-slot="known"]').first()).toContainText("モッツァレラ");
      await expect(page.getByTestId("shop-hint-wallet")).toContainText("研究ポイント 7");
      await expect(board(page).getByRole("button", { name: /ソースを見る/ })).toHaveCount(0);
      await expect(board(page)).toContainText("全部で 6 種類");
      const sp = (await saved(page)).shopProgress;
      expect(sp.researchPointsSpent).toBe(3);
      expect(sp.hintRevealsByRecipe).toEqual({ "meat-lovers": ["sauce", "ing:mozzarella"] });
      expect((await saved(page)).pitzBalance).toBe(500);
    }
    await capture(page, "03-hint-sheet-bought");
    await hold(page, 2500);

    // The cooking screen: the revealed items at the top edge, nothing else.
    await closeSheet(page);
    if (STRICT) {
      const strip = page.getByTestId("shop-hint-strip");
      await expect(strip).toBeVisible();
      await expect(strip).toContainText("ソース：トマトソース");
      await expect(strip).toContainText("モッツァレラ");
      await expect(strip).not.toContainText("？");
      await noOverflow(page, "cooking screen strip");
    }
    await completeDoughStep(page);
    await capture(page, "04-cooking-strip");
    await hold(page, 2500);

    // HOME -> reload -> the Dex shows the same on meat-lovers' slot.
    await home(page);
    await page.reload();
    await page.waitForSelector(".home-screen");
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    if (STRICT) {
      const fold = page.getByTestId("dex-shop-hint").filter({ hasText: "わかったこと 3" });
      await expect(fold).toHaveCount(1);
      await fold.locator("summary").click();
      await expect(fold).toContainText("トマトソース");
      await expect(fold).toContainText("モッツァレラ");
      await expect(fold.getByTestId("shop-hint-wallet")).toContainText("研究ポイント 7");
      await fold.scrollIntoViewIfNeeded();
      await noOverflow(page, "Dex fold");
    }
    await capture(page, "05-dex-shop-hint");
    await hold(page, 3000);
    expect(errors).toEqual([]);
  });

  test("not enough points: nothing can be bought, and the sheet says so", async ({ page }) => {
    await open(page, "?progression=shop", save(0));
    await startTrialWithHintSheet(page);
    if (STRICT) {
      for (const button of await board(page).getByRole("button").all()) await expect(button).toBeDisabled();
      await expect(page.getByTestId("shop-hint-short")).toContainText("研究ポイントが足りません（あと 1点）");
      expect((await saved(page)).shopProgress.researchPointsSpent ?? 0).toBe(0);
    }
    await capture(page, "06-hint-sheet-short");
  });

  test("legacy (no parameter): the hint sheet is the Pitz ladder, unchanged", async ({ page }) => {
    const { shopProgress: _drop, ...legacySave } = save();
    await open(page, "", legacySave);
    await startTrialWithHintSheet(page);
    await expect(page.getByTestId("shop-hint-board")).toHaveCount(0);
    await expect(page.locator(".hint-sheet")).toContainText("Pitz");
    await capture(page, "07-hint-sheet-legacy");
    await closeSheet(page);
    await expect(page.getByTestId("shop-hint-strip")).toHaveCount(0);
    expect(await saved(page)).not.toHaveProperty("shopProgress");
  });
});
