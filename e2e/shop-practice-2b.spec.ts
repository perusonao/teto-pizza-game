import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * B案 Phase 2b (Issue #901, design §6 Q7): under the shop model (`?progression=shop`, DEV / Preview) Pizza Select is a no-reward
 * 「練習」: a pizza picked there earns no Pitz and no reputation, and RESULT says so. A service order still pays as in Phase 2a.
 * The shop owner's title replaces 「第○章」. Legacy (no parameter) Pizza Select is checked to be unchanged.
 */

const MARGHERITA_BAKE = { start: 60, end: 80 }; // src/data/recipes.ts

const SAVE = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
  pitzBalance: 100,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  missionBest: {},
  shopProgress: { reputation: 20, grantedMenuRecipeIds: [] },
};

async function open(page: Page, query: string) {
  await page.goto("/");
  await page.evaluate((text) => {
    localStorage.clear();
    localStorage.setItem("teto-pizza-save-v1", text);
  }, JSON.stringify(SAVE));
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

async function saved(page: Page): Promise<{ pitzBalance: number; reputation: number }> {
  return page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("teto-pizza-save-v1") ?? "{}");
    return { pitzBalance: save.pitzBalance, reputation: save.shopProgress?.reputation ?? 0 };
  });
}

test.describe("B案 Phase 2b: Pizza Select is practice (shop model)", () => {
  test("legacy (no parameter): Pizza Select is unchanged -- no practice note", async ({ page }) => {
    await open(page, "");
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await expect(page.getByRole("heading", { name: "作るピザを選ぼう！" })).toBeVisible();
    await expect(page.getByTestId("pizza-select-practice-note")).toHaveCount(0);
  });

  test("a practice round earns nothing and says so; the next service order pays", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, "?progression=shop");
    await expect(page.getByTestId("home-reputation")).toContainText("評判 20");
    await expect(page.getByTestId("home-reputation")).toContainText("駆け出し（屋台）");
    await expect(page.getByTestId("home-reputation")).toContainText("次のランクまで あと 20");

    // practice: Pizza Select -> margherita
    await page.getByRole("button", { name: /メニューから選んで練習する/ }).click();
    await expect(page.getByRole("heading", { name: "練習するピザを選ぼう！" })).toBeVisible();
    await expect(page.getByTestId("pizza-select-practice-note")).toBeVisible();
    await page.getByRole("button", { name: /マルゲリータ、/ }).click();
    await page.getByRole("button", { name: /このピザを作る/ }).click();
    await cookMargherita(page);

    await expect(page.getByTestId("result-practice")).toContainText("練習のピザなので、Pitz・評判は入りません");
    await expect(page.getByTestId("result-reputation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /次の注文へ/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "もう一度練習する" })).toBeVisible();
    expect(await saved(page)).toEqual({ pitzBalance: 100, reputation: 20 });

    // the order: HOME -> 「注文を受ける」 pays Pitz and reputation as in Phase 2a
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await expect(page.getByTestId("home-reputation")).toContainText("評判 20");
    await page.getByRole("button", { name: /注文を受ける/ }).click();
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await cookMargherita(page);
    await expect(page.getByTestId("result-practice")).toHaveCount(0);
    await expect(page.getByTestId("result-reputation")).toContainText(/評判 \+\d/);
    await expect(page.getByRole("button", { name: /次の注文へ/ })).toBeVisible();
    const after = await saved(page);
    expect(after.pitzBalance).toBeGreaterThan(100);
    expect(after.reputation).toBeGreaterThan(20);
  });
});
