import { expect, test, type Page } from "@playwright/test";

/** Issue #755 V3 prototype: Preview/DEV-only Lab, real-browser one-screen checks and clock-controlled play (no wall-clock dependence). */
test.use({ hasTouch: true });
const sizes = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x664", width: 390, height: 664 },
];
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const shell = (page: Page, i: number) => page.getByTestId(`sgl-v3-shell-${i}`);
const scene = (page: Page) => page.getByTestId("sgl-v3-scene");

async function openLab(page: Page, clock = true) {
  if (clock) await page.clock.install();
  await page.goto("/?steamGameLab=on&steamGameMode=v3");
  await expect(scene(page)).toBeVisible();
  await expect(page.getByRole("note")).toHaveText("試作・保存されません");
  if (clock) await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
}
async function fits(page: Page, w: number, h: number) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
  expect(m.sw).toBeLessThanOrEqual(w);
  expect(m.sh).toBeLessThanOrEqual(h);
  const names = ["弱火", "強火", "やり直す", "あさり", "ムール貝"];
  for (const name of names) {
    const box = await btn(page, name).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(w);
    expect(box!.y + box!.height).toBeLessThanOrEqual(h);
    expect(box!.height, name).toBeGreaterThanOrEqual(name === "あさり" || name === "ムール貝" ? 48 : 44);
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
  const msg = await page.getByTestId("sgl-v3-msg").boundingBox();
  expect(msg!.y + msg!.height).toBeLessThanOrEqual(h);
}

for (const s of sizes) {
  test(`V3 ${s.name}: one screen, 48px type buttons and ≥44px shells while idle / cooking / released`, async ({ page }) => {
    await page.setViewportSize(s);
    await openLab(page);
    await fits(page, s.width, s.height);
    await btn(page, "強火").tap();
    await btn(page, "ふたをして蒸す").tap();
    await page.clock.runFor(2180); // the trio is wobbling (from 2.09 s; it opens at 2.27 s)
    await expect(scene(page)).toHaveAttribute("data-wobble", "3");
    await fits(page, s.width, s.height);
    await page.clock.runFor(1700);
    await btn(page, "ふたを開ける").tap();
    await expect(scene(page)).toHaveAttribute("data-stars", "0");
    await expect(page.getByTestId("sgl-v3-summary")).toBeVisible();
    await fits(page, s.width, s.height);
  });
}

test("V3 low heat only rescues all five but stays at ★★ (virtual clock)", async ({ page }) => {
  await openLab(page);
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  await btn(page, "ふたをして蒸す").tap();
  await page.clock.runFor(2400);
  await shell(page, 0).tap();
  await page.clock.runFor(2100);
  for (const i of [1, 2, 3]) {
    await expect(shell(page, i)).toHaveAttribute("data-shell-state", "ready");
    await shell(page, i).tap();
  }
  await page.clock.runFor(2400);
  await shell(page, 4).tap();
  await btn(page, "ふたを開ける").tap();
  await expect(scene(page)).toHaveAttribute("data-rescued", "5");
  await expect(scene(page)).toHaveAttribute("data-stars", "2");
  await expect(page.getByTestId("sgl-v3-msg")).toContainText("閉じている間は強火");
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(before);
});

test("V3 planned heat switching reaches ★★★ on the clam trio (virtual clock)", async ({ page }) => {
  await openLab(page);
  await btn(page, "強火").tap();
  await btn(page, "ふたをして蒸す").tap();
  await page.clock.runFor(1300);
  await shell(page, 0).tap();
  await page.clock.runFor(750); // 2.05 s: the trio starts to wobble
  await btn(page, "弱火").tap();
  await page.clock.runFor(1300);
  for (const i of [1, 2, 3]) await shell(page, i).tap();
  await btn(page, "強火").tap();
  await page.clock.runFor(1000);
  await expect(shell(page, 4)).toHaveAttribute("data-shell-state", "ready");
  await shell(page, 4).tap();
  await btn(page, "ふたを開ける").tap();
  await expect(scene(page)).toHaveAttribute("data-stars", "3");
  await expect(page.getByTestId("sgl-v3-count")).toContainText("★★★");
});

test("V3 high heat with no taps: every shell shrivels, the overcooked tap answers, and the layout rotates", async ({ page }) => {
  await openLab(page);
  await expect(page.locator(".sglv3")).toHaveAttribute("data-layout", "0");
  await btn(page, "強火").tap();
  await btn(page, "ふたをして蒸す").tap();
  await page.clock.runFor(5200);
  await expect(scene(page)).toHaveAttribute("data-over", "5");
  await shell(page, 0).tap();
  await expect(page.getByTestId("sgl-v3-msg")).toContainText("縮んじゃった");
  await page.clock.runFor(1700);
  await expect(page.getByTestId("sgl-v3-msg")).not.toContainText("縮んじゃった");
  await btn(page, "ふたを開ける").tap();
  await expect(scene(page)).toHaveAttribute("data-rescued", "0");
  await page.clock.runFor(500);
  await btn(page, "もう一度蒸す").tap();
  await expect(page.locator(".sglv3")).toHaveAttribute("data-layout", "1");
});

test("V3 a tap leaves no focus box on the shell; the keyboard still shows one", async ({ page }) => {
  await openLab(page);
  await btn(page, "強火").tap();
  await btn(page, "ふたをして蒸す").tap();
  await page.clock.runFor(1250);
  await shell(page, 0).tap();
  const stroke = (i: number) => shell(page, i).locator("rect.sglv3__hit").evaluate((el) => getComputedStyle(el).stroke);
  expect(await stroke(0)).toBe("none");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName);
  if (focused?.startsWith("sgl-v3-shell-")) expect(await stroke(Number(focused.slice(-1)))).not.toBe("none");
  await expect(page.locator(".sglv3")).toHaveAttribute("data-input", "keyboard");
});

test("V3 does not replace V1 / V2; a duplicate or upper-case mode stays on V1", async ({ page }) => {
  for (const [q, id] of [
    ["?steamGameLab=on", "sgl-scene"],
    ["?steamGameLab=on&steamGameMode=v2", "sgl-v2-scene"],
    ["?steamGameLab=on&steamGameMode=V3", "sgl-scene"],
    ["?steamGameLab=on&steamGameMode=v3&steamGameMode=v3", "sgl-scene"],
  ] as const) {
    await page.goto(`/${q}`);
    await expect(page.getByTestId(id)).toBeVisible();
    await expect(scene(page)).toHaveCount(0);
  }
});
