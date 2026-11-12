import { expect, test, type Page } from "@playwright/test";

/** Issue #755: V2 Preview-only, real-browser gesture and one-screen checks. */
test.use({ hasTouch: true });
const sizes = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x664", width: 390, height: 664 },
];
const btn = (page: Page, name: string) => page.getByRole("button", { name });
const shell = (page: Page, i: number) => page.getByTestId(`sgl-v2-shell-${i}`);
const scene = (page: Page) => page.getByTestId("sgl-v2-scene");
async function openLab(page: Page) {
  await page.goto("/?steamGameLab=on&steamGameMode=v2");
  await expect(scene(page)).toBeVisible();
  await expect(page.getByRole("note")).toHaveText("試作・保存されません");
}
async function fits(page: Page, w: number, h: number) {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
  }));
  expect(m.sw).toBeLessThanOrEqual(w);
  expect(m.sh).toBeLessThanOrEqual(h);
  for (const name of ["弱火", "強火", "やり直す"]) {
    const box = await btn(page, name).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(w);
    expect(box!.y + box!.height).toBeLessThanOrEqual(h);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  for (let i = 0; i < 5; i++) {
    const touch = await shell(page, i).locator("rect").first().boundingBox();
    expect(touch).not.toBeNull();
    expect(touch!.width).toBeGreaterThanOrEqual(44);
    expect(touch!.height).toBeGreaterThanOrEqual(44);
    expect(touch!.x).toBeGreaterThanOrEqual(0);
    expect(touch!.x + touch!.width).toBeLessThanOrEqual(w);
    expect(touch!.y + touch!.height).toBeLessThanOrEqual(h);
  }
}

for (const s of sizes) {
  test(`V2 ${s.name}: controls and five shell touch areas fit while idle/cooking/released`, async ({ page }) => {
    await page.setViewportSize(s);
    await openLab(page);
    await fits(page, s.width, s.height);
    await btn(page, "ふたをして蒸す").tap();
    await btn(page, "強火").tap();
    await page.waitForTimeout(550);
    await fits(page, s.width, s.height);
    await btn(page, "ふたを開ける").tap();
    await expect(scene(page)).toHaveAttribute("data-verdict", "missed");
    await fits(page, s.width, s.height);
  });
}

test("V2 opening shells demand active rescue; merely waiting awards zero", async ({ page }) => {
  await openLab(page);
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  await btn(page, "ふたをして蒸す").tap();
  await btn(page, "強火").tap();
  // Slow down before the first shell opens, to make the action window forgiving.
  await page.waitForTimeout(950);
  await btn(page, "弱火").tap();
  await expect(shell(page, 0)).toHaveAttribute("data-shell-state", "ready", { timeout: 4000 });
  await shell(page, 0).tap();
  await expect(scene(page)).toHaveAttribute("data-rescued", "1");
  await btn(page, "ふたを開ける").tap();
  await expect(scene(page)).toHaveAttribute("data-verdict", "partial");
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(before);
  await page.waitForTimeout(450);
  await btn(page, "もう一度蒸す").tap();
  await expect(scene(page)).toHaveAttribute("data-verdict", "none");
  await btn(page, "強火").tap();
  await page.waitForTimeout(4500);
  await btn(page, "ふたを開ける").tap();
  await expect(scene(page)).toHaveAttribute("data-rescued", "0");
  await expect(scene(page)).toHaveAttribute("data-verdict", "missed");
});

test("V2 larger mussels visibly open later; previous V1 route still works", async ({ page }) => {
  // The boundary is checked on Playwright's virtual clock, not wall time: the clock is paused before the pot starts, so the start and
  // the heat change share one instant and only runFor() moves the Lab's performance.now() / requestAnimationFrame. On high heat
  // (0.22/s) the 特大 mussel (opensAt 0.94) opens at ~4.27 s and the 大ぶり one (0.77) at ~3.50 s; no CI scheduling delay can move that.
  await page.clock.install();
  await openLab(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await btn(page, "ムール貝・大粒").tap();
  await expect(page.locator(".sglv2")).toHaveAttribute("data-batch", "mussel");
  await btn(page, "ふたをして蒸す").tap();
  await btn(page, "強火").tap();
  await expect(page.getByTestId("sgl-v2-lid")).toHaveAttribute("data-heat", "high");
  await page.clock.runFor(3900);
  await expect(shell(page, 3)).toHaveAttribute("data-shell-state", "ready");
  await expect(shell(page, 4)).toHaveAttribute("data-shell-state", "closed");
  await page.clock.runFor(600);
  await expect(shell(page, 4)).toHaveAttribute("data-shell-state", "ready");
  await page.clock.resume();
  await page.goto("/?steamGameLab=on");
  await expect(page.getByTestId("sgl-scene")).toBeVisible();
  await expect(scene(page)).toHaveCount(0);
});

test("V2 duplicate query stays on V1; no V2 session without exact flag", async ({ page }) => {
  for (const q of ["?steamGameLab=on&steamGameMode=v2&steamGameMode=v2", "?steamGameLab=on&steamGameMode=V2", "?steamGameLab=on"]) {
    await page.goto(`/${q}`);
    await expect(page.getByTestId("sgl-scene")).toBeVisible();
    await expect(scene(page)).toHaveCount(0);
  }
});
