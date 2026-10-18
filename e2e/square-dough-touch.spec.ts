import { expect, test, type Page } from "@playwright/test";
import { startFreshMargherita } from "./gestures";

/**
 * #535 B2 on-device regression: the Owner's iPhone Safari HV (PR #546, HEAD 9496acb) found the square dough drawn but neither tap nor
 * long press did anything. Every earlier B2 E2E drove the layer with `page.mouse` (pointerType "mouse"), which never exercises a
 * finger: a touch pointer is implicitly captured by the browser, `setPointerCapture` on top of that and `lostpointercapture` behave
 * differently, and a real finger is the only input the Owner has. These specs drive it with real touch input (`hasTouch`), in
 * every browser project (Chromium and WebKit), on the real clock (no fake timers).
 */
test.use({ hasTouch: true });

const QUERY = "?pan=square&squareStart=lumpy";

const layer = (page: Page) => page.getByTestId("square-dough-layer");
async function evenness(page: Page): Promise<number> {
  return Number(await layer(page).getAttribute("data-evenness"));
}
async function at(page: Page, xPercent: number, yPercent: number) {
  const box = (await layer(page).boundingBox())!;
  return { x: box.x + (box.width * xPercent) / 100, y: box.y + (box.height * yPercent) / 100 };
}
async function start(page: Page) {
  await startFreshMargherita(page, QUERY);
  await page.waitForSelector('[data-testid="square-dough-layer"]');
}

test.describe("#535 B2 square dough: real touch input", () => {
  test("a finger tap reaches the layer as a touch pointer, pushes the dough in and the change stays", async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { __squareTouchEvents: string[] }).__squareTouchEvents = seen;
      for (const type of ["pointerdown", "pointerup", "pointercancel", "lostpointercapture"]) {
        window.addEventListener(type, (event) => seen.push(`${type}:${(event as PointerEvent).pointerType ?? ""}`), true);
      }
    });
    const before = await evenness(page);
    const p = await at(page, 58, 48); // the middle lump
    await page.touchscreen.tap(p.x, p.y);
    const events = await page.evaluate(() => (window as unknown as { __squareTouchEvents: string[] }).__squareTouchEvents);
    expect(events, `pointer events seen: ${JSON.stringify(events)}`).toContain("pointerdown:touch");
    expect(events, `a tap must not be cancelled: ${JSON.stringify(events)}`).not.toContain("pointercancel:touch");
    const after = await evenness(page);
    expect(after, `a tap must push the dough in (events: ${JSON.stringify(events)})`).toBeGreaterThan(before);
    await page.waitForTimeout(600);
    expect(await evenness(page), "the tap is committed, so it stays after the finger lifts").toBe(after);
  });

  test("a second tap elsewhere also works (the first one did not leave the layer stuck)", async ({ page }) => {
    await start(page);
    const first = await at(page, 58, 48);
    await page.touchscreen.tap(first.x, first.y);
    const afterFirst = await evenness(page);
    const second = await at(page, 24, 26);
    await page.touchscreen.tap(second.x, second.y);
    expect(await evenness(page)).toBeGreaterThan(afterFirst);
  });
});

// A held finger needs a touch that stays down: only Chromium can send that without a synthetic event (CDP); Playwright's WebKit
// exposes `touchscreen.tap` only. So this part is registered for Chromium alone (the tap specs above run in every browser).
test.describe("#535 B2 square dough: real touch input, long press (Chromium CDP)", () => {
  test("a finger held on the dough keeps spreading while it is down, and the result stays after it lifts", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "capability gate, not a tolerance: a touch that stays down needs CDP Input.dispatchTouchEvent (Chromium only)");
    await start(page);
    const cdp = await page.context().newCDPSession(page);
    const p = await at(page, 30, 70);
    const before = await evenness(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
    await page.waitForTimeout(1200);
    await expect(layer(page)).toHaveAttribute("data-pressing", "hold");
    await expect(page.getByTestId("square-dough-hold-ring")).toBeVisible();
    const held = await evenness(page);
    expect(held).toBeGreaterThan(before);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByTestId("square-dough-hold-ring")).toHaveCount(0);
    // The spread goes on until the finger lifts (the reading above was taken mid-hold), so compare two readings AFTER the lift:
    // the result is committed and stays, and it is never less than what was seen mid-hold.
    const lifted = await evenness(page);
    expect(lifted).toBeGreaterThanOrEqual(held);
    await page.waitForTimeout(600);
    expect(await evenness(page)).toBe(lifted);
  });
});
