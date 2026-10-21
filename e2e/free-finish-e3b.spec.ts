import { expect, test, type Page } from "@playwright/test";
import { enterBakePaused, completeDoughStep, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";
import { base, HAND_ON_OWNED, SAVE_KEY } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * FINISH FIN-E3b (Issue #608 / #294): the Free Cooking 仕上げ step on the real app at 390x844 and 360x800 (Chromium and WebKit projects).
 * Production keeps Free Cooking FINISH OFF; these rounds opt in with the Preview / DEV query `?freeFinish=on` (the dev server is a DEV build),
 * and the last tests pin that without it Free Cooking is exactly what it was. FINISH is optional in Free Cooking: 完成 with nothing placed is allowed.
 */
const FREE_BAKE = { start: 58, end: 78 }; // FREE_COOK_BAKE_TARGET (src/data/freeCook.ts)
const RAW_BAKE = { start: 0, end: 30 };

async function boot(page: Page, query: string, owned: readonly string[] | null) {
  if (owned) {
    await page.goto("icons/icon-16.png");
    await page.evaluate(([k, v]) => {
      localStorage.clear();
      localStorage.setItem(k, v);
    }, [SAVE_KEY, JSON.stringify(base(owned))] as const);
  }
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
}

/** A margherita-shaped Free pizza (the starter trio), up to the 焼く tap. */
async function prepareStarterPizza(page: Page) {
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
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 60);
  await tapDoughPercent(page, 58, 42);
}

async function bake(page: Page, target: { start: number; end: number }) {
  await enterBakePaused(page);
  await landNeedleAndTakeOut(page, target);
}

const rect = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } : null;
  }, selector);

async function expectNoPageOverflow(page: Page) {
  const viewport = page.viewportSize()!;
  const doc = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  expect(doc.w).toBeLessThanOrEqual(viewport.width);
  expect(doc.h).toBeLessThanOrEqual(viewport.height);
}

async function expectSixTabsInside(page: Page) {
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(6);
  const viewport = page.viewportSize()!;
  for (const tab of await tabs.all()) {
    const b = (await tab.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 0.5);
  }
}

test.describe("Free Cooking FINISH (gate ON via ?freeFinish=on)", () => {
  test("six tabs 生地 / ソース / チーズ / 具材 / 焼く / 仕上げ inside the viewport, from the first step", async ({ page }) => {
    await boot(page, "?freeFinish=on", null);
    await expectSixTabsInside(page);
    await expect(page.getByRole("tab", { name: "仕上げ" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "焼く" })).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test("焼成 → 仕上げ → 完成: the dish stays unnamed in FINISH, a piece is placed and undone, 完成 reaches the result", async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await boot(page, "?freeFinish=on", null);
    await prepareStarterPizza(page);
    await bake(page, FREE_BAKE);

    // FINISH, not the result: the dish is not identified yet.
    await expect(page.getByTestId("finish-dock")).toBeVisible();
    await expect(page.locator(".result-panel")).toHaveCount(0);
    await expectSixTabsInside(page);
    await expect(page.getByRole("tab", { name: "仕上げ" })).toHaveAttribute("aria-current", /.+/);
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("マルゲリータ");
    await expect(page.getByTestId("finish-hint")).toContainText("仕上げに好きな具をのせよう");

    // the tray: every owned scatter topping (the starter trio owns one), tap-to-place, ↩ takes the piece back
    const chips = page.locator(".ingredient-tray .ingredient-chip");
    await expect(chips).toHaveCount(1);
    await expect(chips.first()).toContainText("バジル");
    await expect(page.getByTestId("finish-undo")).toBeDisabled();
    await chips.first().click();
    await page.locator(".pizza-dough").click({ position: { x: 90, y: 90 } });
    await expect(page.getByTestId("finish-undo")).toBeEnabled();
    await page.getByTestId("finish-undo").click();
    await expect(page.getByTestId("finish-undo")).toBeDisabled();
    await expectNoPageOverflow(page);

    // 完成 with nothing placed is allowed in Free Cooking: the finished pizza is identified now
    await page.getByTestId("finish-complete").click();
    await expect(page.locator(".result-panel")).toBeVisible();
    await expect(page.getByTestId("finish-dock")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a piece placed in FINISH reaches the result as a finished (original) pizza", async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, "?freeFinish=on", null);
    await prepareStarterPizza(page);
    await bake(page, FREE_BAKE);
    await page.locator(".ingredient-tray .ingredient-chip").first().click();
    await page.locator(".pizza-dough").click({ position: { x: 100, y: 100 } });
    await page.getByTestId("finish-complete").click();
    await expect(page.locator(".result-panel")).toBeVisible();
  });

  test("a failed bake skips 仕上げ and shows the failure at once", async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, "?freeFinish=on", null);
    await prepareStarterPizza(page);
    await bake(page, RAW_BAKE);
    await expect(page.locator(".result-panel")).toBeVisible();
    await expect(page.getByTestId("finish-dock")).toHaveCount(0);
  });

  test("the tray lists every owned scatter topping, paged, inside the layout (no overlap, no page scroll, 44px chips)", async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, "?freeFinish=on", HAND_ON_OWNED);
    await prepareStarterPizza(page);
    await bake(page, FREE_BAKE);
    await expect(page.getByTestId("finish-dock")).toBeVisible();
    const viewport = page.viewportSize()!;
    const chips = page.locator(".ingredient-tray .ingredient-chip");
    expect(await chips.count()).toBeGreaterThan(0);
    expect(await chips.count()).toBeLessThanOrEqual(6);
    const pager = page.getByRole("group", { name: "素材ページ切り替え" });
    await expect(pager, "more than one page of owned toppings: the pager is there").toBeVisible();
    const first = await page.locator(".ingredient-chip__name").allTextContents();
    await pager.getByRole("button").last().click();
    const second = await page.locator(".ingredient-chip__name").allTextContents();
    expect(second.join("|")).not.toBe(first.join("|"));
    for (const name of [...first, ...second]) {
      expect(name, "no sauce / cheese in FINISH").not.toMatch(/ソース|モッツァレラ/);
    }
    const [stage, dock, tray, bar] = await Promise.all([rect(page, ".pizza-stage"), rect(page, '[data-testid="finish-dock"]'), rect(page, ".ingredient-tray"), rect(page, ".prepare-bake-bar")]);
    expect(stage!.bottom).toBeLessThanOrEqual(dock!.top + 0.5);
    expect(tray!.top).toBeGreaterThanOrEqual(dock!.top - 0.5);
    expect(tray!.bottom).toBeLessThanOrEqual(bar!.top + 0.5);
    expect(bar!.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
    expect((await rect(page, ".pizza-dough"))!.width).toBeGreaterThan(viewport.width * 0.6);
    for (const chip of await chips.all()) {
      const b = (await chip.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 0.5);
    }
    await expectNoPageOverflow(page);
  });

  test("leaving the home screen midway asks to confirm, and a new Free round starts clean afterwards", async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, "?freeFinish=on", null);
    await prepareStarterPizza(page);
    await bake(page, FREE_BAKE);
    await expect(page.getByTestId("finish-dock")).toBeVisible();
    let asked = 0;
    page.on("dialog", (dialog) => {
      asked += 1;
      void dialog.accept();
    });
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await expect.poll(() => asked).toBe(1);
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await expect(page.getByTestId("finish-dock")).toHaveCount(0);
    await expect(page.locator(".result-panel")).toHaveCount(0);
    await expectSixTabsInside(page);
  });
});

test.describe("Free Cooking FINISH stays OFF without the opt-in", () => {
  for (const query of ["", "?freeFinish=1", "?freeFinish=off", "?freeFinish=on&freeFinish=on"]) {
    test(`${query || "(no query)"}: five tabs, no 仕上げ, and 焼く goes straight to the result`, async ({ page }) => {
      test.setTimeout(120_000);
      await boot(page, query, null);
      await expect(page.getByRole("tab")).toHaveCount(5);
      await expect(page.getByRole("tab", { name: "仕上げ" })).toHaveCount(0);
      await prepareStarterPizza(page);
      await bake(page, FREE_BAKE);
      await expect(page.locator(".result-panel")).toBeVisible();
      await expect(page.getByTestId("finish-dock")).toHaveCount(0);
    });
  }
});
