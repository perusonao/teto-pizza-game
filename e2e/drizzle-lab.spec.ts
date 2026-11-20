import { expect, test, type Page } from "@playwright/test";

/**
 * #579 DRIZZLE Gesture Lab (`?drizzleLab=on`, Preview / DEV only): real-browser checks of the standalone lab at the phone profiles
 * (390x844, 360x800, short 390x664, 360x640). Emulation only -- the iPhone real-device HV is a later Owner step and is NOT claimed here.
 * HV_SHOT_DIR (optional) writes screenshots.
 */
test.use({ hasTouch: true });
const SHOT_DIR = process.env.HV_SHOT_DIR;
const PROFILES = [
  { name: "390x844", w: 390, h: 844 },
  { name: "360x800", w: 360, h: 800 },
  { name: "390x664", w: 390, h: 664 },
  { name: "360x640", w: 360, h: 640 },
];
const surface = (page: Page) => page.getByTestId("drizzle-surface");
const drawn = (page: Page) => page.locator('[data-stroke="drag"], [data-stroke="tap"]').count();

async function open(page: Page, query = "?drizzleLab=on") {
  await page.goto(`/${query}`);
  await expect(surface(page)).toBeVisible();
}
async function box(page: Page) {
  const b = await surface(page).boundingBox();
  if (!b) throw new Error("no surface box");
  return b;
}
async function drag(page: Page, from: [number, number], to: [number, number], steps = 12) {
  const b = await box(page);
  await page.mouse.move(b.x + b.width * from[0], b.y + b.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * to[0], b.y + b.height * to[1], { steps });
  await page.mouse.up();
}

for (const p of PROFILES) {
  test(`${p.name}: the lab fits one screen, shows the label, and draws a stroke and a tap line`, async ({ page }) => {
    await page.setViewportSize({ width: p.w, height: p.h });
    await open(page);
    await expect(page.getByRole("note")).toHaveText("試作・保存されません");
    // Primary interaction stays on screen: no page scroll, surface and reset fully inside the viewport.
    const scroll = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight, sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(scroll.sh).toBeLessThanOrEqual(scroll.ih);
    expect(scroll.sw).toBeLessThanOrEqual(scroll.iw);
    const b = await box(page);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(p.w);
    expect(b.y + b.height).toBeLessThanOrEqual(p.h);
    expect(b.width).toBeGreaterThan(Math.min(p.w - 40, 300));
    const reset = await page.getByRole("button", { name: "リセット" }).boundingBox();
    expect(reset!.y + reset!.height).toBeLessThanOrEqual(p.h);
    expect(reset!.height).toBeGreaterThanOrEqual(44);

    await drag(page, [0.25, 0.5], [0.75, 0.55]);
    expect(await drawn(page)).toBe(1);
    await page.touchscreen.tap(b.x + b.width * 0.5, b.y + b.height * 0.3);
    expect(await drawn(page)).toBe(2);
    expect(await page.locator('[data-stroke="tap"]').count()).toBe(1);
    // A second tap right after adds exactly one more line (no duplicate click).
    await page.touchscreen.tap(b.x + b.width * 0.5, b.y + b.height * 0.7);
    await page.waitForTimeout(450);
    expect(await drawn(page)).toBe(3);
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/lab-${p.name}-drawn.png` });

    await page.getByRole("button", { name: "リセット" }).click();
    expect(await drawn(page)).toBe(0);
  });
}

test("a drag that leaves the dough keeps the line inside it, and a press outside draws nothing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const b = await box(page);
  await page.mouse.move(b.x + 2, b.y + 2);
  await page.mouse.down();
  await page.mouse.up();
  expect(await drawn(page)).toBe(0);
  await drag(page, [0.7, 0.5], [1.6, 0.5]); // pointer capture keeps it tracking outside the SVG
  expect(await drawn(page)).toBe(1);
  const pts = (await page.locator('[data-stroke="drag"]').first().getAttribute("points"))!.split(" ").map((s) => s.split(",").map(Number));
  for (const [x, y] of pts) expect(Math.hypot(x - 50, y - 50)).toBeLessThanOrEqual(44.05);
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/lab-edge.png` });
});

test("a pointercancel mid-stroke discards it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const b = await box(page);
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5, { steps: 6 });
  await expect(page.locator('[data-stroke="pending"]')).toHaveCount(1);
  await page.getByTestId("drizzle-surface").evaluate((el) => el.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, bubbles: true })));
  await expect(page.locator('[data-stroke="pending"]')).toHaveCount(0);
  await page.mouse.up();
  expect(await drawn(page)).toBe(0);
});

test("the lab is off without the exact opt-in, and never touches the saved game", async ({ page }) => {
  await page.goto("icons/icon-16.png");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sentinel-save", "REAL");
  });
  for (const q of ["?drizzleLab=1", "?drizzleLab=on&drizzleLab=on", ""]) {
    await page.goto(`/${q}`);
    await expect(page.getByTestId("drizzle-surface")).toHaveCount(0);
  }
  await open(page);
  await drag(page, [0.3, 0.5], [0.7, 0.5]);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys).toEqual(["sentinel-save"]);
  expect(await page.evaluate(() => localStorage.getItem("sentinel-save"))).toBe("REAL");
  // Reload starts empty.
  await page.reload();
  expect(await drawn(page)).toBe(0);
});

test("touch gestures are swallowed by the surface only (touch-action); the lab sets no document-wide touch lock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  expect(await surface(page).evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).not.toBe("none");
});

