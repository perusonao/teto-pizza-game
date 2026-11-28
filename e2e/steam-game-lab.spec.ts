import { expect, test, type Page } from "@playwright/test";

/**
 * #755 Steam Gameplay Lab (`?steamGameLab=on`, Preview / DEV only): real-browser checks at the phone profiles. Emulation only -- the iPhone
 * real-device HV is the Owner's step and is NOT claimed. HV_SHOT_DIR (optional) writes screenshots.
 */
test.use({ hasTouch: true });
const SHOT_DIR = process.env.HV_SHOT_DIR;
const PROFILES = [
  { name: "390x844", w: 390, h: 844 },
  { name: "360x800", w: 360, h: 800 },
  { name: "390x664", w: 390, h: 664 },
];
const btn = (page: Page, name: string) => page.getByRole("button", { name });
const outcome = (page: Page) => page.getByTestId("sgl-scene").getAttribute("data-outcome");
async function open(page: Page) {
  await page.goto("/?steamGameLab=on");
  await expect(page.getByTestId("sgl-scene")).toBeVisible();
}
async function fits(page: Page, w: number, h: number) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, bw: document.body.scrollWidth, bh: document.body.scrollHeight }));
  expect(m.sw).toBeLessThanOrEqual(w);
  expect(m.sh).toBeLessThanOrEqual(h);
  for (const name of ["弱火", "強火", "やり直す"]) {
    const b = await btn(page, name).boundingBox();
    expect(b && b.y + b.height <= h && b.x >= 0 && b.x + b.width <= w, `${name} on screen`).toBe(true);
    expect(b!.height).toBeGreaterThanOrEqual(44);
  }
}

for (const p of PROFILES) {
  test(`${p.name}: one screen in every state, label shown`, async ({ page }) => {
    await page.setViewportSize({ width: p.w, height: p.h });
    await open(page);
    await expect(page.getByRole("note")).toHaveText("試作・保存されません");
    await fits(page, p.w, p.h);
    await btn(page, "ふたをして蒸す").tap();
    await btn(page, "強火").tap();
    await page.waitForTimeout(1500);
    await fits(page, p.w, p.h);
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/lab-${p.name}-cooking.png` });
    await btn(page, "ふたを開ける").tap();
    await fits(page, p.w, p.h);
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/lab-${p.name}-result.png` });
  });
}

test("the three plays give three different results; retry works; no storage written", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  // 1. high fire, lifted at once -> too early
  await btn(page, "ふたをして蒸す").tap();
  await btn(page, "強火").tap();
  await page.waitForTimeout(800);
  await btn(page, "ふたを開ける").tap();
  expect(await outcome(page)).toBe("tooEarly");
  // 2. high fire, kept far too long -> overcooked
  await page.waitForTimeout(450);
  await btn(page, "もう一度蒸す").tap();
  await btn(page, "強火").tap();
  await page.waitForTimeout(6800);
  await btn(page, "ふたを開ける").tap();
  expect(await outcome(page)).toBe("overcooked");
  // 3. high fire, then lifted around the time all shells open -> just right
  await page.waitForTimeout(450);
  await btn(page, "もう一度蒸す").tap();
  await btn(page, "強火").tap();
  await expect(page.getByTestId("sgl-scene")).toHaveAttribute("data-open-count", "5", { timeout: 8000 });
  await btn(page, "ふたを開ける").tap();
  expect(await outcome(page)).toBe("justRight");
  await btn(page, "やり直す").tap();
  await expect(btn(page, "ふたをして蒸す")).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(before);
});

test("low fire is slower: after 4s on low the shells are not all open, on high they are", async ({ page }) => {
  await open(page);
  await btn(page, "ふたをして蒸す").tap();
  await page.waitForTimeout(4000);
  expect(Number(await page.getByTestId("sgl-scene").getAttribute("data-open-count"))).toBeLessThan(5);
  await btn(page, "やり直す").tap();
  await btn(page, "ふたをして蒸す").tap();
  await btn(page, "強火").tap();
  await expect(page.getByTestId("sgl-scene")).toHaveAttribute("data-open-count", "5", { timeout: 6000 });
});

test("off without the exact opt-in", async ({ page }) => {
  for (const q of ["?steamGameLab=1", "?steamGameLab=on&steamGameLab=on", ""]) {
    await page.goto(`/${q}`);
    await expect(page.getByTestId("sgl-scene")).toHaveCount(0);
  }
});
