import { expect, test, type Page } from "@playwright/test";
import { startFreshMargherita } from "./gestures";

/**
 * #535 B2 (Square-Pan Dough, Epic #532): the square DOUGH step through the real game, Preview switch `?pan=square&squareStart=lumpy`.
 * Tap = a local push-in, hold = a continuing spread (driven by Playwright's fake clock, so the hold lengths are exact), a movement
 * past the slop stops the spread, a cancelled gesture is discarded, a committed one stays after the finger lifts, 「次へ」 stays
 * unavailable (completion is C's, #536), and nothing scrolls. Every number the gestures use is provisional (Owner iPhone HV).
 */
const QUERY = "?pan=square&squareStart=lumpy";

async function start(page: Page) {
  await page.clock.install();
  await startFreshMargherita(page, QUERY);
  await page.waitForSelector('[data-testid="square-dough-layer"]');
}

const layer = (page: Page) => page.getByTestId("square-dough-layer");
async function evenness(page: Page): Promise<number> {
  return Number(await layer(page).getAttribute("data-evenness"));
}
/** page coordinates of a dough-percent point on the layer */
async function at(page: Page, xPercent: number, yPercent: number) {
  const box = (await layer(page).boundingBox())!;
  return { x: box.x + (box.width * xPercent) / 100, y: box.y + (box.height * yPercent) / 100 };
}

test.describe("#535 B2 square dough: tap / hold", () => {
  test("shows the square pan and sheet, keeps 次へ unavailable, and the page does not scroll", async ({ page }) => {
    await start(page);
    await expect(layer(page)).toBeVisible();
    expect(await layer(page).locator("rect").count()).toBeGreaterThan(190); // pan + 196 cells
    await expect(page.getByRole("button", { name: /次へ/ })).toBeDisabled();
    await expect(page.getByTestId("dough-size-status")).toHaveAttribute("data-status", "SQUARE");
    const css = await layer(page).evaluate((el) => getComputedStyle(el).touchAction);
    expect(css).toBe("none");
    const scroll = await page.evaluate(() => document.scrollingElement!.scrollTop);
    expect(scroll).toBe(0);
  });

  test("a tap pushes the dough in under the finger, and it stays after the finger lifts", async ({ page }) => {
    await start(page);
    const before = await evenness(page);
    const p = await at(page, 58, 48); // the middle lump
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
    const after = await evenness(page);
    expect(after).toBeGreaterThan(before);
    await page.clock.runFor(2000);
    expect(await evenness(page)).toBe(after);
    await expect(page.getByRole("button", { name: /次へ/ })).toBeDisabled();
  });

  test("a long press keeps spreading while held, more than a tap, and shows the hold ring", async ({ page }) => {
    await start(page);
    const p = await at(page, 58, 48);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    const tapOnly = await evenness(page);
    await page.clock.runFor(600);
    await expect(page.getByTestId("square-dough-hold-ring")).toBeVisible();
    const midHold = await evenness(page);
    await page.clock.runFor(600);
    const longerHold = await evenness(page);
    await page.mouse.up();
    expect(midHold).toBeGreaterThan(tapOnly);
    expect(longerHold).toBeGreaterThan(midHold);
    await expect(page.getByTestId("square-dough-hold-ring")).toHaveCount(0);
    expect(await evenness(page)).toBe(longerHold);
  });

  test("a finger that drifts past the slop while held stops spreading (no smearing)", async ({ page }) => {
    await start(page);
    const p = await at(page, 58, 48);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.clock.runFor(500);
    await page.mouse.move(p.x + 40, p.y, { steps: 4 });
    const atDrift = await evenness(page);
    await page.clock.runFor(800);
    await page.mouse.move(p.x + 80, p.y + 10, { steps: 4 });
    await page.mouse.up();
    expect(await evenness(page)).toBe(atDrift);
  });

  test("a cancelled gesture (pointercancel) is discarded entirely", async ({ page }) => {
    await start(page);
    const before = await evenness(page);
    const p = await at(page, 58, 48);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.clock.runFor(500);
    expect(await evenness(page)).toBeGreaterThan(before);
    await layer(page).evaluate((el) => el.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, bubbles: true })));
    expect(await evenness(page)).toBe(before);
    await page.mouse.up();
    expect(await evenness(page)).toBe(before);
  });

  test("a hidden tab / window blur discards a live gesture", async ({ page }) => {
    await start(page);
    const before = await evenness(page);
    const p = await at(page, 58, 48);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.clock.runFor(400);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    expect(await evenness(page)).toBe(before);
    await page.mouse.up();
    expect(await evenness(page)).toBe(before);
  });

  test("a second finger is ignored while one is down", async ({ page }) => {
    await start(page);
    const p = await at(page, 58, 48);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    const afterFirst = await evenness(page);
    await layer(page).evaluate(
      (el, pt) => el.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, clientX: pt.x2, clientY: pt.y2, bubbles: true })),
      { x2: p.x - 90, y2: p.y - 90 },
    );
    expect(await evenness(page)).toBe(afterFirst);
    await page.mouse.up();
  });

  test("without pointer capture, releasing outside the layer still ends the gesture (the next press works)", async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.setPointerCapture = () => {
        throw new Error("capture unavailable");
      };
    });
    await start(page);
    const p = await at(page, 58, 48);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(8, 8); // far outside the layer: the layer gets no move and no up
    await page.mouse.up();
    const afterFirst = await evenness(page);
    expect(afterFirst).toBeGreaterThan(0.739); // the first press was committed (tap), not left live
    const q = await at(page, 24, 26);
    await page.mouse.move(q.x, q.y);
    await page.mouse.down();
    await page.mouse.up();
    expect(await evenness(page)).toBeGreaterThan(afterFirst);
  });

  test("a press on the round-pizza path is unaffected: without ?pan=square there is no square layer", async ({ page }) => {
    await startFreshMargherita(page, "");
    await expect(page.getByTestId("square-dough-layer")).toHaveCount(0);
  });
});
