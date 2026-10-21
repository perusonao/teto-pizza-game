import { expect, test, type Page } from "@playwright/test";

/**
 * FINISH FIN-C (Issue #294): ↩ (UNDO_LAST_PLACEMENT, only the latest FINISH piece) and 完成 (CONFIRM_MAKING_STEP -> FINAL -> RESULT), on the real
 * GameScreen at the FINISH step (e2e/harness/finish-screen.html -- real reducer, test-only fixture recipe). Measured at 390x844 and 360x800:
 * the tray, ↩, 完成 and the hint never overlap and are >= 44px, undo is consecutive and re-placeable, a baked piece is never taken, 完成 with no
 * late piece is FAILED, and a double press consumes the stock once. Production does not reach this screen (no shipped profile has FINISH).
 */
const HARNESS = "./e2e/harness/finish-screen.html";

async function open(page: Page, query = "") {
  await page.goto(`${HARNESS}?${query}`);
  await page.waitForSelector(".game-screen");
  await page.waitForTimeout(300);
}

type S = {
  phase: string;
  completion: { status: string } | null;
  inventory: Record<string, number>;
  pizza: { toppings: { id: string; ingredientId: string; stage?: string }[] };
};
const state = (page: Page) => page.evaluate(() => (window as unknown as { __state: () => unknown }).__state() as S);
const post = async (page: Page) => (await state(page)).pizza.toppings.filter((t) => t.stage === "post");

const rect = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } : null;
  }, selector);

async function tapPizza(page: Page, fx: number, fy: number) {
  const box = (await page.locator(".pizza-dough").boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

for (const late of [1, 3]) {
  test(`bar (${late} late): tray, ↩, 完成 and the hint do not overlap, every control >= 44px, inside the viewport, no page scroll`, async ({ page }) => {
    await open(page, `late=${late}&post=1`);
    const viewport = page.viewportSize()!;
    const undo = (await page.getByTestId("finish-undo").boundingBox())!;
    const complete = (await page.getByTestId("finish-complete").boundingBox())!;
    const hint = (await page.getByRole("button", { name: "ヒント" }).boundingBox())!;
    const tray = (await rect(page, ".ingredient-tray"))!;
    const bar = (await rect(page, '[data-testid="finish-bar"]'))!;
    const hintLine = (await rect(page, '[data-testid="finish-hint"]'))!;
    const stage = (await rect(page, ".pizza-stage"))!;
    for (const b of [undo, complete, hint]) {
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(b.y).toBeGreaterThanOrEqual(bar.top - 0.5);
      expect(b.y + b.height).toBeLessThanOrEqual(viewport.height + 0.5);
    }
    // the three controls sit side by side without touching
    const ordered = [undo, complete, hint].sort((a, b) => a.x - b.x);
    expect(ordered[0].x + ordered[0].width).toBeLessThanOrEqual(ordered[1].x + 0.5);
    expect(ordered[1].x + ordered[1].width).toBeLessThanOrEqual(ordered[2].x + 0.5);
    expect(tray.bottom).toBeLessThanOrEqual(bar.top + 0.5);
    expect(hintLine.bottom).toBeLessThanOrEqual(stage.top + 0.5);
    const doc = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    expect(doc.w).toBeLessThanOrEqual(viewport.width);
    expect(doc.h).toBeLessThanOrEqual(viewport.height);
  });
}

test("↩: disabled with no FINISH piece; takes back only the latest FINISH piece, consecutively; re-placing works; baked pieces never change", async ({ page }) => {
  await open(page, "stock=3");
  const preBefore = (await state(page)).pizza.toppings.filter((t) => t.stage !== "post");
  const undo = page.getByTestId("finish-undo");
  await expect(undo).toBeDisabled();
  await page.getByRole("button", { name: /パセリ/ }).click();
  await tapPizza(page, 0.4, 0.4);
  await tapPizza(page, 0.6, 0.6);
  await expect(page.getByTestId("finish-stock")).toHaveText("あと1/3");
  const [first] = await post(page);
  await expect(undo).toBeEnabled();
  await undo.click();
  expect((await post(page)).map((t) => t.id)).toEqual([first.id]);
  await expect(page.getByTestId("finish-stock")).toHaveText("あと2/3");
  await undo.click();
  expect(await post(page)).toHaveLength(0);
  await expect(undo).toBeDisabled();
  expect((await state(page)).pizza.toppings.filter((t) => t.stage !== "post")).toEqual(preBefore);
  await page.getByRole("button", { name: /パセリ/ }).click();
  await tapPizza(page, 0.5, 0.45);
  expect(await post(page)).toHaveLength(1);
  expect((await state(page)).pizza.toppings.filter((t) => t.stage !== "post")).toEqual(preBefore);
});

test("stock 0 releases the selection (no selected-but-disabled chip), and a tap then places nothing", async ({ page }) => {
  await open(page, "stock=1");
  const chip = page.getByRole("button", { name: /パセリ/ });
  await chip.click();
  await tapPizza(page, 0.4, 0.4);
  await expect(chip).toBeDisabled();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await tapPizza(page, 0.6, 0.6);
  expect(await post(page)).toHaveLength(1);
});

test("完成 with no late piece: no dialog, FINAL runs, the pizza is FAILED and the screen leaves FINISH", async ({ page }) => {
  await open(page, "stock=2");
  await page.getByTestId("finish-complete").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("finish-dock")).toHaveCount(0);
  const s = await state(page);
  expect(s.phase).not.toBe("POST_BAKE");
  expect(s.completion?.status).toBe("FAILED");
});

test("完成 with the late pieces: RESULT reached, stock consumed exactly once even on a double press, baked pieces unchanged", async ({ page }) => {
  await open(page, "stock=3");
  const preBefore = (await state(page)).pizza.toppings.filter((t) => t.stage !== "post");
  await page.getByRole("button", { name: /パセリ/ }).click();
  await tapPizza(page, 0.4, 0.4);
  await tapPizza(page, 0.6, 0.6);
  await page.getByTestId("finish-complete").dblclick({ delay: 0 });
  await expect(page.getByTestId("finish-dock")).toHaveCount(0);
  const s = await state(page);
  expect(["RESULT", "DISCOVERED"]).toContain(s.phase);
  expect(s.completion?.status).not.toBe("FAILED");
  expect(s.inventory.parsley).toBe(1); // 3 owned - 2 placed, consumed once
  expect(s.pizza.toppings.filter((t) => t.stage !== "post")).toEqual(preBefore);
});

test("no late ingredient owned: the tray shows a one-line note, 完成 stays available, nothing overlaps", async ({ page }) => {
  await open(page, "owned=none");
  await expect(page.getByTestId("finish-tray-empty")).toHaveText("後乗せにつかう食材がありません");
  await expect(page.locator(".ingredient-tray")).toHaveCount(0);
  const note = (await rect(page, '[data-testid="finish-tray-empty"]'))!;
  const bar = (await rect(page, '[data-testid="finish-bar"]'))!;
  const stage = (await rect(page, ".pizza-stage"))!;
  expect(note.top).toBeGreaterThanOrEqual(stage.bottom - 0.5);
  expect(note.bottom).toBeLessThanOrEqual(bar.top + 0.5);
  await expect(page.getByTestId("finish-complete")).toBeEnabled();
});

test("with CUT in the profile, 完成 moves to CUT (CUT itself is unchanged and not completed by 完成)", async ({ page }) => {
  await open(page, "cut=1&stock=2");
  await page.getByRole("button", { name: /パセリ/ }).click();
  await tapPizza(page, 0.5, 0.5);
  await page.getByTestId("finish-complete").click();
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeDisabled();
  expect((await state(page)).phase).toBe("POST_BAKE");
});
