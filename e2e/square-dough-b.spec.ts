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
  test("shows the square pan and sheet, 次へ follows the finish (the lumpy start is already above the evenness goal), and the page does not scroll", async ({ page }) => {
    await start(page);
    await expect(layer(page)).toBeVisible();
    expect(await layer(page).locator("rect").count()).toBeGreaterThan(190); // pan + 196 cells
    // C (#536): 次へ follows the finish. The Preview lumpy sheet has every corner, full coverage and an evenness (0.739) above the goal.
    await expect(page.getByRole("button", { name: /次へ/ })).toBeEnabled();
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
    await expect(page.getByRole("button", { name: /次へ/ })).toBeEnabled(); // a tap only evens the dough out: still finished
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
    // The release counts the last sub-frame slice of the hold (pressGesture "up"), so it may land a rounding step above the last frame's reading
    // (WebKit frame timing); what must hold is that it is at most that sliver, and that nothing spreads after the release.
    const released = await evenness(page);
    expect(released).toBeGreaterThanOrEqual(longerHold);
    expect(released - longerHold).toBeLessThan(0.01);
    await page.clock.runFor(2000);
    expect(await evenness(page)).toBe(released);
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

  test("without pointer capture, a stroke that leaves the layer becomes a drag, and releasing outside still ends the gesture (the next press works)", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Element.prototype.setPointerCapture = () => {
        throw new Error("capture unavailable");
      };
    });
    await start(page);
    // What the layer showed at each step, kept so a failure says where drag state and evenness parted (attached to the report on failure).
    const trail: Record<string, string | number | undefined>[] = [];
    const snap = async (label: string) => {
      const shown = await layer(page).evaluate((el) => ({
        dragging: el.getAttribute("data-dragging") ?? undefined,
        pressing: el.getAttribute("data-pressing") ?? undefined,
        evenness: el.getAttribute("data-evenness") ?? undefined,
        coverage: el.getAttribute("data-coverage") ?? undefined,
        step: el.getAttribute("data-step") ?? undefined,
        clock: Math.round(performance.now()),
      }));
      trail.push({ label, ...shown });
    };
    try {
      const p = await at(page, 58, 48);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.clock.runFor(500);
      await snap("held 500ms");
      await expect(layer(page), "no drag has started while the finger is still pressing").toHaveAttribute("data-dragging", "false");
      // Far outside the layer, with no capture: only the window-level fallback sees this move. Since #558 a move of 24 px or more is a
      // drag, so the layer accounts for the hold up to now and drags to this point. The layer sets `data-dragging` (the trail) and
      // `data-evenness` (the working dough) from the same state update, so `data-dragging="true"` means the move is on screen.
      await page.mouse.move(8, 8);
      await expect(layer(page), "the move outside the layer reached the gesture and was drawn").toHaveAttribute("data-dragging", "true");
      await snap("moved outside");
      const atLeave = await evenness(page);
      await page.clock.runFor(800);
      await snap("after 800ms");
      expect(await evenness(page), "after the drag has begun, time passing alone changes nothing (no tick, no hold)").toBe(atLeave);
      await page.mouse.up();
      await snap("released");
      const afterFirst = await evenness(page);
      expect(afterFirst).toBeGreaterThan(0.739); // the first press was committed (tap), not left live
      await expect(layer(page), "the release outside the layer ended the drag").toHaveAttribute("data-dragging", "false");
      const q = await at(page, 24, 26);
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.mouse.up();
      expect(await evenness(page)).toBeGreaterThan(afterFirst);
    } catch (error) {
      await testInfo.attach("gesture-trail.json", { body: JSON.stringify(trail, null, 2), contentType: "application/json" });
      console.error(`[square-dough-b trail] ${JSON.stringify(trail)}`);
      throw error;
    }
  });

  test("a press on the round-pizza path is unaffected: without ?pan=square there is no square layer", async ({ page }) => {
    await startFreshMargherita(page, "");
    await expect(page.getByTestId("square-dough-layer")).toHaveCount(0);
  });
});
