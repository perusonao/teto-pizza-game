import { expect, test, type Page } from "@playwright/test";

/**
 * FINISH FIN-B (Issue #294): the FINISH tray, on the real GameScreen at the FINISH step (e2e/harness/finish-screen.html -- the real reducer
 * and App's select / tap wiring, the test-only fixture recipe). Measured at 390x844 and 360x800: the tray + dock sit between the pizza and the
 * bottom bar with no overlap and no page scroll, a chip is selected and the pizza tapped to place a "post" piece (tap only, no drag), the
 * placement stops at the stock, and nothing baked changes. Production does not reach this screen (no shipped profile has FINISH).
 */
const HARNESS = "./e2e/harness/finish-screen.html";

async function open(page: Page, query = "") {
  await page.goto(`${HARNESS}?${query}`);
  await page.waitForSelector(".game-screen");
  await page.waitForTimeout(300);
}

const rect = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } : null;
  }, selector);

async function tapPizza(page: Page, fx: number, fy: number) {
  const box = (await page.locator(".pizza-dough").boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __state: () => { pizza: { toppings: { ingredientId: string; stage?: string }[]; sauceIds: string[]; doughShape: unknown } } }).__state();
    return s.pizza;
  });

for (const late of [1, 2, 3]) {
  test(`tray (${late} late ingredient${late > 1 ? "s" : ""}): sits between the pizza and the bar, no overlap, no page scroll`, async ({ page }) => {
    await open(page, `late=${late}&post=1`);
    const viewport = page.viewportSize()!;
    await expect(page.locator(".ingredient-tray .ingredient-chip")).toHaveCount(late);
    const [stage, dock, tray, bar] = await Promise.all([rect(page, ".pizza-stage"), rect(page, '[data-testid="finish-dock"]'), rect(page, ".ingredient-tray"), rect(page, ".prepare-bake-bar")]);
    expect(stage!.bottom).toBeLessThanOrEqual(dock!.top + 0.5);
    expect(tray!.top).toBeGreaterThanOrEqual(dock!.top - 0.5);
    expect(tray!.bottom).toBeLessThanOrEqual(bar!.top + 0.5);
    expect(bar!.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
    const doc = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    expect(doc.w).toBeLessThanOrEqual(viewport.width);
    expect(doc.h).toBeLessThanOrEqual(viewport.height);
    // the pizza keeps a usable size, and every chip is a >= 44px tap target inside the viewport
    expect((await rect(page, ".pizza-dough"))!.width).toBeGreaterThan(viewport.width * 0.6);
    for (const chip of await page.locator(".ingredient-tray .ingredient-chip").all()) {
      const b = (await chip.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 0.5);
    }
  });
}

test("tray: only the recipe's late ingredient is offered (no pre-bake ingredient, no family filter, no pager)", async ({ page }) => {
  await open(page);
  await expect(page.locator(".ingredient-tray .ingredient-chip")).toHaveCount(1);
  await expect(page.locator(".ingredient-tray .ingredient-chip")).toContainText("パセリ");
  await expect(page.locator(".tray-family-row")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "素材ページ切り替え" })).toHaveCount(0);
});

test("select the chip -> tap the pizza places a post piece; the count follows and stops at the stock; baked pieces never change", async ({ page }) => {
  await open(page, "stock=2");
  const before = await state(page);
  const chip = page.getByRole("button", { name: /パセリ/ });
  await expect(page.getByTestId("finish-stock")).toHaveText("あと2/2");
  await tapPizza(page, 0.5, 0.5); // nothing selected: nothing placed
  expect((await state(page)).toppings.filter((t) => t.stage === "post")).toHaveLength(0);
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await tapPizza(page, 0.4, 0.4);
  await expect(page.getByTestId("finish-stock")).toHaveText("あと1/2");
  await tapPizza(page, 0.6, 0.6);
  await expect(page.getByTestId("finish-stock")).toHaveText("あと0/2");
  await expect(chip).toBeDisabled();
  await tapPizza(page, 0.5, 0.3); // over the stock: rejected
  const after = await state(page);
  const post = after.toppings.filter((t) => t.stage === "post");
  expect(post).toHaveLength(2);
  expect(post.every((t) => t.ingredientId === "parsley")).toBe(true);
  expect(after.toppings.filter((t) => t.stage !== "post")).toEqual(before.toppings.filter((t) => t.stage !== "post"));
  expect(after.sauceIds).toEqual(before.sauceIds);
  expect(after.doughShape).toEqual(before.doughShape);
  await expect(page.locator(".pizza-post-layer")).toHaveCount(1);
});

test("the ヒント button shows the explicit FINISH hint (with the count) and follows a placement", async ({ page }) => {
  await open(page, "stock=3");
  await page.getByRole("button", { name: "ヒント" }).click();
  await expect(page.getByTestId("finish-hint")).toHaveText("パセリをあと2個、仕上げにのせてね。");
  await page.getByRole("button", { name: /パセリ/ }).click();
  await tapPizza(page, 0.5, 0.5);
  await expect(page.getByTestId("finish-hint")).toHaveText("パセリをあと1個、仕上げにのせてね。");
});
