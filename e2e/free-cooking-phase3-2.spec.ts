import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * Progression 2.0 Phase 3-2 (Issue #194): Free Cooking / owned-ingredient selection, driven
 * through the real UI at 390x844 and 360x800 (Chromium and WebKit projects,
 * playwright.config.ts). Scenario letters follow the Issue's Human Verification list:
 * A start, B OWNED selection, C NEW discovery, D KNOWN, E ORIGINAL, F HOME / restart.
 */

// FREE_COOK_BAKE_TARGET (src/data/freeCook.ts) -- the generic window the BAKE gauge shows for a
// free-cook round. Its center (68) is also inside Margherita's own window (60-80).
const FREE_COOK_BAKE_TARGET = { start: 58, end: 78 };

async function openHomeFresh(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function startFreeCook(page: Page) {
  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await page.waitForSelector(".pizza-stage");
}

async function expectOneScreen(page: Page, label: string) {
  const state = await page.evaluate(() => {
    const el = document.querySelector(".game-screen")!;
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(state.docScrollWidth, `${label}: no horizontal overflow`).toBeLessThanOrEqual(state.innerWidth);
  expect(state.scrollHeight, `${label}: .game-screen must not need scroll`).toBeLessThanOrEqual(
    state.clientHeight,
  );
  const bar = await page.locator(".prepare-bake-bar").boundingBox();
  expect(bar!.y + bar!.height, `${label}: bottom bar stays on-screen`).toBeLessThanOrEqual(
    page.viewportSize()!.height + 1,
  );
}

async function trayNames(page: Page) {
  return page.locator(".ingredient-chip__name").allTextContents();
}

/** One free-cook round with the starter trio; `basil` false makes an unregistered combination. */
async function cookStarterPizza(page: Page, { basil }: { basil: boolean }) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();

  if (basil) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 60);
    await tapDoughPercent(page, 58, 42);
  }
  await bakeToTarget(page, FREE_COOK_BAKE_TARGET);
  await page.waitForSelector(".result-panel");
}

test.describe("Free Cooking (Issue #194)", () => {
  test("A-F: start, OWNED tray, NEW -> KNOWN -> ORIGINAL, HOME and restart", async ({ page }) => {
    test.setTimeout(90_000);
    await openHomeFresh(page);

    // A. HOME -> FREE COOKING, no recipe selection on the way.
    await startFreeCook(page);
    await expect(page.locator(".pizza-select-screen")).toHaveCount(0);
    await expect(page.locator(".order-card__recipe-name")).toHaveText(/フリークッキング/);
    await expect(page.locator(".mini-reference")).toHaveCount(0);
    await expectOneScreen(page, "DOUGH");

    // B. OWNED ingredients only (fresh save = the starter trio), step by step.
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();
    expect(await trayNames(page)).toEqual(["トマトソース"]);
    await expectOneScreen(page, "SAUCE");
    await page.getByRole("button", { name: /次へ/ }).click();
    expect(await trayNames(page)).toEqual(["モッツァレラ"]);
    await page.getByRole("button", { name: /次へ/ }).click();
    expect(await trayNames(page)).toEqual(["バジル"]);
    await expectOneScreen(page, "TOPPING");
    // Back to a clean pizza for the real round.
    await page.getByRole("button", { name: "やり直す" }).click();

    // C. Margherita, never selected as a recipe -> NEW PIZZA.
    await cookStarterPizza(page, { basil: true });
    await expect(page.locator(".discovered-banner--new-pizza")).toHaveText(/NEW PIZZA!.*マルゲリータを発見しました！/);
    await expect(page.locator(".result-panel__score")).toBeVisible();

    // D. Same pizza again -> KNOWN, no second discovery.
    await page.getByRole("button", { name: "もう一度じゆうに作る" }).click();
    await expect(page.locator(".result-panel")).toHaveCount(0);
    await expect(page.locator(".order-card__recipe-name")).toHaveText(/フリークッキング/);
    await cookStarterPizza(page, { basil: true });
    await expect(page.locator(".free-cook-known")).toHaveText(/マルゲリータができた！（発見済み）/);
    await expect(page.getByText(/を発見しました/)).toHaveCount(0);

    // E. Unregistered combination -> ORIGINAL, a normal finished result.
    await page.getByRole("button", { name: "もう一度じゆうに作る" }).click();
    await cookStarterPizza(page, { basil: false });
    await expect(page.locator(".result-panel__heading--original")).toHaveText(/オリジナルピザ完成！/);
    await expect(page.locator(".result-panel--failed")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "使った材料" })).toContainText("モッツァレラ");

    // Dex: exactly one discovery, made twice.
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem("teto-pizza-save-v1")!));
    const margherita = save.dex.find((e: { recipeId: string }) => e.recipeId === "margherita");
    expect(margherita).toMatchObject({ discovered: true, timesMade: 2 });
    expect(save.dex.filter((e: { discovered: boolean }) => e.discovered)).toHaveLength(1);

    // F. HOME, then restart: no stale result/discovery survives.
    await page.getByRole("button", { name: /ホーム/ }).click();
    await expect(page.locator(".home-screen")).toBeVisible();
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/レシピ 1\//);
    await startFreeCook(page);
    await expect(page.locator(".result-panel")).toHaveCount(0);
    await expect(page.locator(".discovered-banner")).toHaveCount(0);
    await expect(page.locator(".order-card__recipe-name")).toHaveText(/フリークッキング/);
  });

  test("a large owned set pages inside the tray and PREPARE still fits one screen", async ({ page }) => {
    test.setTimeout(45_000);
    const toppings = [
      "garlic", "oregano", "mushroom", "egg", "cherry-tomato", "onion", "sausage", "pepperoni",
      "bacon", "ham", "black-olive", "tuna", "anchovy", "rosemary",
    ];
    const owned = ["olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", ...toppings];
    const save = {
      schemaVersion: 2,
      dex: [],
      pitzBalance: 0,
      ownedIngredientIds: owned,
      missionBest: {},
      inventory: Object.fromEntries(owned.map((id) => [id, id === "onion" ? 0 : 9])),
      starterGrantClaimedRecipeIds: [],
    };
    await page.addInitScript((raw) => localStorage.setItem("teto-pizza-save-v1", JSON.stringify(raw)), save);
    await openHomeFresh(page);
    await startFreeCook(page);
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();
    expect((await trayNames(page)).length).toBe(3); // every owned sauce
    await expectOneScreen(page, "SAUCE (3 owned)");
    await page.getByRole("button", { name: /次へ/ }).click();
    expect((await trayNames(page)).length).toBe(4); // every owned cheese
    await expectOneScreen(page, "CHEESE (4 owned)");
    await page.getByRole("button", { name: /次へ/ }).click();

    // TOPPING: basil + every owned topping that exists in the catalog, 6 per page.
    const nav = page.getByRole("group", { name: "素材ページ切り替え" });
    await expect(nav).toBeVisible();
    await expectOneScreen(page, "TOPPING page 1");
    const seen = new Set<string>();
    let onionDisabled: boolean | null = null;
    for (;;) {
      for (const name of await trayNames(page)) seen.add(name);
      const onion = page.getByRole("button", { name: /たまねぎ/ });
      if (await onion.count()) onionDisabled = await onion.isDisabled();
      const next = page.getByRole("button", { name: "次のページ" });
      if (await next.isDisabled()) break;
      await next.click();
      await expectOneScreen(page, "TOPPING next page");
    }
    expect(seen.has("バジル")).toBe(true);
    expect(seen.has("たまねぎ")).toBe(true);
    expect(seen.size).toBe(15); // basil + all 14 owned toppings, across 3 pages
    // 0 stock: listed, disabled (existing Stock Gate contract).
    expect(onionDisabled).toBe(true);

    // Chips stay comfortably tappable.
    const chip = await page.locator(".ingredient-chip").first().boundingBox();
    expect(chip!.height).toBeGreaterThanOrEqual(44);
    expect(chip!.width).toBeGreaterThanOrEqual(44);
  });
});
