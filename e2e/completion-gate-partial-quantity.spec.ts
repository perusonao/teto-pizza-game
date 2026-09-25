import { test, expect, type Page } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  cutThreeLines,
  paintSauceRing,
  startFreshMargherita,
  startLunchRushMission,
  tapDoughPercent,
} from "./gestures";

/**
 * Issue #215 (Completion Gate partial-quantity) through the real UI, Chromium and WebKit
 * (playwright.config.ts projects). Owner Decision: OD-1 G1 (0 = FAILED, 1+ completes), OD-2 Q
 * shortage 0.5, OD-3 / OD-4b excess 0.15, OD-4 LR-A (Lunch Rush needs the ordered quantity),
 * OD-5 D-A (Free Cooking discovers with under-ideal quantities).
 *
 * Margherita's mozzarella is the "ideal 3" ingredient here (Reference = minCount = 3), and all
 * three Margherita ingredients are unlimited starters, so every round can be replayed without
 * any stock setup. Star assertions are upper bounds the quantity factor guarantees regardless
 * of where the real taps land: 2/3 -> factor 0.833 (max 83.3, never ★5); 1/3 -> factor 0.667
 * (max 66.7, never above ★3).
 */

const MARGHERITA_BAKE = { start: 60, end: 80 }; // src/data/recipes.ts
const FREE_COOK_BAKE_TARGET = { start: 58, end: 78 }; // src/data/freeCook.ts
const MOZZARELLA_SPOTS: ReadonlyArray<[number, number]> = [
  [40, 50],
  [60, 50],
  [50, 30],
  [50, 70],
];

/** DOUGH -> SAUCE -> CHEESE (`mozzarella` pieces) -> TOPPING (2 basil) -> BAKE -> CUT. */
async function playMargherita(page: Page, mozzarella: number, bake = MARGHERITA_BAKE) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();

  if (mozzarella > 0) await page.getByRole("button", { name: /モッツァレラ/ }).click();
  for (const [x, y] of MOZZARELLA_SPOTS.slice(0, mozzarella)) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 60);
  await tapDoughPercent(page, 58, 42);

  await bakeToTarget(page, bake);

  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
}

async function starCount(page: Page, selector: string): Promise<number> {
  const text = await page.locator(selector).first().innerText();
  return (text.match(/★/g) ?? []).length;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const s = await page.evaluate(() => ({
    docScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(s.docScrollWidth, `${label}: no horizontal overflow`).toBeLessThanOrEqual(s.innerWidth);
}

test.describe("Issue #215 Completion Gate partial-quantity", () => {
  test("recipe mode: ideal 3 -> 2 completes below ★5 with the quantity line; 0 is FAILED", async ({ page }) => {
    test.setTimeout(90_000);
    await startFreshMargherita(page);

    await playMargherita(page, 2);
    await expect(page.locator(".result-panel--failed")).toHaveCount(0);
    await expect(page.locator(".result-panel__quantity-note")).toHaveText(
      "モッツァレラがお手本より少なめ（2個／お手本3個）",
    );
    expect(await starCount(page, ".result-panel__stars")).toBeLessThanOrEqual(4);
    await expect(page.locator(".pitz-credit-summary__headline")).toContainText("Pitz");
    await expectNoHorizontalOverflow(page, "RESULT 2/3");
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem("teto-pizza-save-v1")!));
    expect(save.dex.find((e: { recipeId: string }) => e.recipeId === "margherita").timesMade).toBe(2);

    await page.getByRole("button", { name: "もう一度つくる" }).click();
    await playMargherita(page, 0);
    await expect(page.locator(".result-panel__failed-reason")).toHaveText("モッツァレラが入っていません");
    await expect(page.locator(".result-panel__quantity-note")).toHaveCount(0);
  });

  test("Free Cooking: Margherita's ingredient set with under-ideal quantities is a NEW discovery (OD-5)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /フリークッキング/ }).click();
    await page.waitForSelector(".pizza-stage");

    await playMargherita(page, 1, FREE_COOK_BAKE_TARGET);
    await expect(page.locator(".discovered-banner--new-pizza")).toHaveText(/NEW PIZZA!.*マルゲリータを発見しました！/);
    await expect(page.locator(".result-panel__quantity-note")).toHaveText(
      "モッツァレラがお手本より少なめ（1個／お手本3個）",
    );
    expect(await starCount(page, ".result-panel__stars")).toBeLessThanOrEqual(3);
  });

  test("Lunch Rush (LR-A): under-order is rejected; exact and excess are served, excess with the quantity line", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await startLunchRushMission(page, 100);

    // Under the ordered 3 mozzarella -> 注文失敗 with the order-quantity copy.
    await playMargherita(page, 2);
    await expect(page.locator(".mission-serve-panel--failed")).toBeVisible();
    await expect(page.locator(".mission-serve-panel__failed-reason")).toHaveText("注文のモッツァレラの数が足りません");
    await page.getByRole("button", { name: "次の注文へ" }).click();
    await page.waitForSelector(".pizza-stage");

    // Exactly the ordered quantity -> served, no quantity line.
    await playMargherita(page, 3);
    await expect(page.locator(".mission-serve-panel--failed")).toHaveCount(0);
    await expect(page.locator(".mission-serve-panel__served")).toContainText("+1 SERVED");
    await expect(page.locator(".mission-serve-panel__quantity-note")).toHaveCount(0);
    await page.getByRole("button", { name: "次の注文へ" }).click();
    await page.waitForSelector(".pizza-stage");

    // Over the ordered quantity -> served, excess penalty explained.
    await playMargherita(page, 4);
    await expect(page.locator(".mission-serve-panel--failed")).toHaveCount(0);
    await expect(page.locator(".mission-serve-panel__served")).toContainText("+1 SERVED");
    await expect(page.locator(".mission-serve-panel__quantity-note")).toHaveText(
      "モッツァレラがお手本より多め（4個／お手本3個）",
    );
    await expectNoHorizontalOverflow(page, "Lunch Rush serve panel");
  });
});
