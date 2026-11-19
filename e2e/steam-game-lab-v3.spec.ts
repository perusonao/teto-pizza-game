import { expect, test, type Page } from "@playwright/test";

/** Issue #755 V3 (Preview / DEV only): one screen, touch targets, focus behaviour and the time-graded result in a real browser. */
test.use({ hasTouch: true });
const sizes = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x664", width: 390, height: 664 },
];
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const shell = (page: Page, i: number) => page.getByTestId(`sgl-v3-shell-${i}`);
const scene = (page: Page) => page.getByTestId("sgl-v3-scene");
async function openLab(page: Page, extra = "") {
  await page.goto(`/?steamGameLab=on&steamGameMode=v3${extra}`);
  await expect(scene(page)).toBeVisible();
  await expect(page.getByRole("note")).toHaveText("試作・保存されません");
}
async function fits(page: Page, w: number, h: number) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
  expect(m.sw).toBeLessThanOrEqual(w);
  expect(m.sh).toBeLessThanOrEqual(h);
  for (const name of ["あさり", "ムール貝", "弱火", "強火", "やり直す"]) {
    const box = await btn(page, name).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(w);
    expect(box!.y + box!.height).toBeLessThanOrEqual(h);
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
  }
  for (let i = 0; i < 5; i++) {
    const touch = await shell(page, i).locator("rect").first().boundingBox();
    expect(touch).not.toBeNull();
    expect(touch!.width).toBeGreaterThanOrEqual(44);
    expect(touch!.height).toBeGreaterThanOrEqual(44);
    expect(touch!.y + touch!.height).toBeLessThanOrEqual(h);
  }
  const badge = await page.getByTestId("sgl-v3-badge").boundingBox();
  expect(badge!.x + badge!.width).toBeLessThanOrEqual(w);
}
/** The spot whose shell has the given size and is in the given state, read from the DOM. */
const spotWith = (page: Page, state: string) =>
  page.$$eval('[data-testid^="sgl-v3-shell-"]', (els, s) => els.findIndex((e) => e.getAttribute("data-shell-state") === s), state);

for (const s of sizes) {
  test(`V3 ${s.name}: one screen with 44px controls while idle / cooking / released`, async ({ page }) => {
    await page.setViewportSize(s);
    await openLab(page);
    await fits(page, s.width, s.height);
    await btn(page, "ふたをして蒸す").tap();
    await btn(page, "強火").tap();
    await page.waitForTimeout(400);
    await fits(page, s.width, s.height);
    await btn(page, "ふたを開ける").tap();
    await expect(scene(page)).toHaveAttribute("data-grade", "none");
    await expect(page.getByTestId("sgl-v3-badge")).toHaveText(/^× \d+\.\d秒・0\/5$/);
    await fits(page, s.width, s.height);
  });
}

test("V3 tell, rescue by touch without a focus ring, ★★ on low heat (virtual clock)", async ({ page }) => {
  await page.clock.install();
  await openLab(page);
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await expect(page.locator(".sglv3__msg")).toHaveText("小さい貝から開くよ｜★3は7.0秒以内");
  await btn(page, "ふたをして蒸す").tap();
  // Low heat: the first small clam tells at ~1.83 s and opens at 2.50 s.
  await page.clock.runFor(2000);
  const telling = await spotWith(page, "tell");
  expect(telling).toBeGreaterThanOrEqual(0);
  await expect(shell(page, telling)).toHaveAttribute("data-shell-size", "small");
  await expect(shell(page, telling).locator(".sglv3__bubbles")).toHaveCount(1);
  await page.clock.runFor(600);
  await expect(shell(page, telling)).toHaveAttribute("data-shell-state", "ready");
  await shell(page, telling).tap();
  await expect(shell(page, telling)).toHaveAttribute("data-shell-state", "rescued");
  // A tap does not move focus onto the SVG button (so no focus rectangle is drawn).
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? "")).not.toMatch(/sgl-v3-shell/);
  // Every second (well inside the >= 2.5 s low-heat window), tap every open shell.
  for (let k = 0; k < 6; k++) {
    await page.clock.runFor(1000);
    for (let ready = await spotWith(page, "ready"); ready >= 0; ready = await spotWith(page, "ready")) await shell(page, ready).tap();
  }
  await expect(scene(page)).toHaveAttribute("data-rescued", "5");
  await btn(page, "ふたを開ける").tap();
  await expect(scene(page)).toHaveAttribute("data-grade", "two");
  await expect(page.locator(".sglv3__msg")).toContainText("強火も使ってみよう");
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(before);
});

test("V3 keyboard: Tab reaches a shell, the focus ring shows, Enter rescues it", async ({ page }) => {
  await page.clock.install();
  await openLab(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await btn(page, "ふたをして蒸す").click();
  await page.clock.runFor(2600);
  const ready = await spotWith(page, "ready");
  expect(ready).toBeGreaterThanOrEqual(0);
  for (let k = 0; k < 20; k++) {
    await page.keyboard.press("Tab");
    if ((await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))) === `sgl-v3-shell-${ready}`) break;
  }
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe(`sgl-v3-shell-${ready}`);
  const stroke = await shell(page, ready).locator(".sglv3__hit").evaluate((e) => getComputedStyle(e).stroke);
  expect(stroke).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(shell(page, ready)).toHaveAttribute("data-shell-state", "rescued");
});

test("V3 provisional window and routing: V1 / V2 unchanged", async ({ page }) => {
  await openLab(page, "&steamV3Window=tight");
  await expect(page.getByRole("heading")).toHaveText("蒸しミニゲーム V3・強火きつめ");
  await page.goto("/?steamGameLab=on&steamGameMode=v2");
  await expect(page.getByTestId("sgl-v2-scene")).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
  await page.goto("/?steamGameLab=on");
  await expect(page.getByTestId("sgl-scene")).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
});
