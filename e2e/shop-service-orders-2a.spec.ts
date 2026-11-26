import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * B案 Phase 2a (Issue #901): the service-order loop through the real UI, on the dev server (DEV accepts the same
 * `?progression=shop` instruction a Preview build does). Order -> cook -> evaluation -> Pitz + reputation -> chapter -> the
 * materials the Shop sells. The legacy (no parameter) HOME is checked to be unchanged first.
 *
 * Phase 2b (Owner 2026-11-26): the chapter wording became the owner's title ladder, so the lines that named 「第○章」 name the title.
 */

const MARGHERITA_BAKE = { start: 60, end: 80 }; // src/data/recipes.ts

/** Opens the game with `save` (or a fresh one) under `query`; the save is written once, before the first load. */
async function open(page: Page, query: string, save: object | null) {
  await page.goto("/");
  await page.evaluate((text) => {
    localStorage.clear();
    if (text) localStorage.setItem("teto-pizza-save-v1", text);
  }, save ? JSON.stringify(save) : null);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
}

/** DOUGH -> SAUCE -> CHEESE (3 mozzarella) -> TOPPING (2 basil) -> BAKE -> CUT, from PREPARE. */
async function cookMargherita(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  for (const [x, y] of [
    [40, 50],
    [60, 50],
    [50, 30],
  ] as const)
    await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 60);
  await tapDoughPercent(page, 58, 42);
  await bakeToTarget(page, MARGHERITA_BAKE);
  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
}

async function savedShop(page: Page): Promise<{ reputation: number } | undefined> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("teto-pizza-save-v1") ?? "{}").shopProgress);
}

test.describe("B案 Phase 2a: service orders (shop model)", () => {
  test("legacy (no parameter): HOME is unchanged -- no reputation line, 「ピザを作る」 leads", async ({ page }) => {
    await open(page, "", null);
    await expect(page.getByTestId("home-reputation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /注文を受ける/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ピザを作る/ })).toBeVisible();
  });

  test("a new save: take margherita's order, serve it, earn reputation, take the next order", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, "?progression=shop", null);
    await expect(page.getByTestId("home-reputation")).toContainText("評判 0");
    await expect(page.getByTestId("home-reputation")).toContainText("見習い（屋台）");

    await page.getByRole("button", { name: /注文を受ける/ }).click();
    await expect(page.locator(".dialogue-area")).toBeVisible();
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await cookMargherita(page);

    const gain = page.getByTestId("result-reputation");
    await expect(gain).toContainText(/評判 \+\d/);
    await expect(page.locator(".pitz-credit-summary__headline")).toContainText("Pitz");
    const reputation = (await savedShop(page))?.reputation ?? 0;
    expect(reputation).toBeGreaterThan(0);

    await page.getByRole("button", { name: /次の注文へ/ }).click();
    await expect(page.locator(".dialogue-area")).toBeVisible();
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await expect(page.getByTestId("home-reputation")).toContainText(`評判 ${reputation}`);
  });

  test("crossing a chapter floor: 「一人前（小さな店）に昇格しました！」 and the new materials are announced", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, "?progression=shop", {
      schemaVersion: 2,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
      pitzBalance: 0,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
      missionBest: {},
      shopProgress: { reputation: 39, grantedMenuRecipeIds: [] },
    });
    await expect(page.getByTestId("home-reputation")).toContainText("次のランクまで あと 1");
    await page.getByRole("button", { name: /注文を受ける/ }).click();
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await cookMargherita(page);
    await expect(page.getByTestId("result-reputation")).toContainText("一人前（小さな店）に昇格しました！");
    await expect(page.locator(".material-unlock-notice")).toBeVisible();
  });
});
