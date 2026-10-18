import { expect, test, type Page } from "@playwright/test";
import { startFreshMargherita } from "./gestures";

/**
 * #535 B2 on-device diagnostics (TEMPORARY, delete with ./src/preview/squareDoughDiag.ts): `?diag=1` shows what the phone delivers.
 * Real touch input (hasTouch), real clock, every browser project. Pins both sides: with diag OFF nothing is drawn or recorded and the
 * layer behaves exactly as before; with diag ON the overlay never takes a touch and the tap still works, and its numbers are right.
 */
test.use({ hasTouch: true });

const layer = (page: Page) => page.getByTestId("square-dough-layer");
const panel = (page: Page) => page.getByTestId("square-dough-diag");
async function evenness(page: Page): Promise<number> {
  return Number(await layer(page).getAttribute("data-evenness"));
}
async function at(page: Page, xPercent: number, yPercent: number) {
  const box = (await layer(page).boundingBox())!;
  return { x: box.x + (box.width * xPercent) / 100, y: box.y + (box.height * yPercent) / 100 };
}
async function start(page: Page, query: string) {
  await startFreshMargherita(page, query);
  await page.waitForSelector('[data-testid="square-dough-layer"]');
}

test.describe("#535 B2 diagnostics: diag OFF", () => {
  test("no panel, no extra DOM, and a touch tap works exactly as before", async ({ page }) => {
    await start(page, "?pan=square&squareStart=lumpy");
    await expect(panel(page)).toHaveCount(0);
    expect(await page.locator("body > pre").count()).toBe(0);
    const before = await evenness(page);
    const p = await at(page, 58, 48);
    await page.touchscreen.tap(p.x, p.y);
    expect(await evenness(page)).toBeGreaterThan(before);
  });

  test("diag=0 and a repeated diag=1 are off too", async ({ page }) => {
    await start(page, "?pan=square&squareStart=lumpy&diag=0");
    await expect(panel(page)).toHaveCount(0);
    await page.goto("/?pan=square&squareStart=lumpy&diag=1&diag=1");
    await expect(panel(page)).toHaveCount(0);
  });
});

test.describe("#535 B2 diagnostics: diag ON", () => {
  test("a touch tap through the overlay still works, and the panel shows the pointer events, the phase and the counts", async ({ page }) => {
    await start(page, "?pan=square&squareStart=lumpy&diag=1");
    await expect(panel(page)).toBeVisible();
    expect(await panel(page).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    const before = await evenness(page);
    const p = await at(page, 58, 48);
    await page.touchscreen.tap(p.x, p.y);
    const after = await evenness(page);
    expect(after, "the overlay must not take the touch").toBeGreaterThan(before);
    await expect.poll(async () => (await panel(page).textContent()) ?? "", { timeout: 5_000 }).toContain("accepted=1");
    const text = (await panel(page).textContent()) ?? "";
    expect(text).toContain("win pointerdown touch");
    expect(text).toContain("layer pointerdown touch");
    expect(text).toContain("layer pointerup touch");
    expect(text).toContain("interactive=true");
    expect(text).toMatch(/press=1 hold=\d+ commit=1 accepted=1 discard=0/);
    expect(text).toContain("(=layer)");
    expect(text).toMatch(/capture (ok|FAIL)/);
    expect(text).toContain("touch-action=none");
  });

  test("a failing setPointerCapture is reported, and the tap still works", async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.setPointerCapture = () => {
        throw new DOMException("no capture", "NotFoundError");
      };
    });
    await start(page, "?pan=square&squareStart=lumpy&diag=1");
    const before = await evenness(page);
    const p = await at(page, 58, 48);
    await page.touchscreen.tap(p.x, p.y);
    expect(await evenness(page)).toBeGreaterThan(before);
    await expect.poll(async () => (await panel(page).textContent()) ?? "", { timeout: 5_000 }).toContain("capture FAIL NotFoundError");
    expect((await panel(page).textContent()) ?? "").toContain("capFail=1");
  });

  test("diag=1 without ?pan=square: no square layer and no panel (the round pizza is untouched)", async ({ page }) => {
    await startFreshMargherita(page, "?diag=1");
    await expect(layer(page)).toHaveCount(0);
    await expect(panel(page)).toHaveCount(0);
  });
});
