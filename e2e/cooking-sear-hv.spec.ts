import { expect, test, type Page } from "@playwright/test";
import { BAKE_SPEED_PCT_PER_S } from "../src/logic/bakeProgress";
import { tapDoughPercent } from "./gestures";
import { SAVE_KEY } from "./support/familyTray";

/**
 * Cooking Sear HV entry (#724): `?cookSearHv=1` is ONE URL to the TOPPING step with the dough / sauce / cheese done, the sausage owned, stocked and
 * selected, and the sear ON (3 s default). Both authority viewports (390x844, 360x800). The device's own save is never touched (a sentinel stands for it).
 * HV_SHOT_DIR (optional) writes the screenshots.
 */
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}
const REAL = "REAL-SAVE-SENTINEL";
const pill = (page: Page) => page.getByTestId("cooking-sear-pill");
const screenEl = (page: Page) => page.getByTestId("cooking-sear");
const sausagePieces = (page: Page) => page.locator(".pizza-dough .pizza-topping--sausage").count();

async function openEntry(page: Page, query: string) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, REAL] as const);
  await page.goto(`/${query}`);
}

/** Enters BAKE with the virtual clock paused, so the needle starts at exactly 0 (same helper shape as bake-one-way.spec.ts). The click is a DOM click: Playwright's own actionability wait needs a running rAF. */
async function enterBakeAtZero(page: Page) {
  await page.clock.install();
  let paused = false;
  for (const buffer of [300, 800, 2000]) {
    try {
      await page.clock.pauseAt(Date.now() + buffer);
      paused = true;
      break;
    } catch (error) {
      if (!String(error).includes("to the past")) throw error;
    }
  }
  if (!paused) throw new Error("enterBakeAtZero: could not pause the clock before BAKE");
  await page.getByRole("button", { name: /焼く/ }).evaluate((el) => (el as HTMLButtonElement).click());
  await page.waitForSelector(".bake-gauge__needle");
}

test.describe("Cooking Sear HV entry (?cookSearHv=1)", () => {
  test("one URL: TOPPING, sausage selected, the pill is on screen and tappable at once; the real save is never touched", async ({ page, context }) => {
    await openEntry(page, "?cookSearHv=1");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("prepare-dock")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-cook-sear-hv", "cook-sear-hv-v1");
    // (the pill is offered only while the sausage is the selected ingredient, so its presence is the selection check; the chip may sit on tray page 2)
    await expect(page.getByRole("button", { name: /焼く/ })).toBeEnabled(); // the sauce and the cheese are really on the pizza
    // inside the stage band, clear of the dough
    const g = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const s = r(".pizza-stage"), p = r(".cooking-sear-pill"), d = r(".pizza-dough");
      return { stageB: s.bottom, pillB: p.bottom, pillT: p.top, pillH: p.height, doughB: d.bottom, iw: innerWidth, pl: p.left, pr: p.right };
    });
    expect(g.pillH).toBeGreaterThanOrEqual(44);
    expect(Math.abs(g.stageB - 18 - g.pillB)).toBeLessThanOrEqual(1);
    expect(g.pl).toBeGreaterThanOrEqual(0);
    expect(g.pr).toBeLessThanOrEqual(g.iw);
    await shot(page, "hv-00-entry");
    // another page of the same origin still sees the device's own save, byte for byte
    const other = await context.newPage();
    await other.goto("icons/icon-16.png");
    expect(await other.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(REAL);
    await other.close();
  });

  test("entry -> place -> sear (3 s default) -> bake -> take out -> RESULT", async ({ page }) => {
    await openEntry(page, "?cookSearHv=1");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) await tapDoughPercent(page, x, y);
    expect(await sausagePieces(page)).toBe(3);
    await pill(page).click();
    await expect(screenEl(page)).toHaveAttribute("data-full-ms", "3000");
    await expect(page.getByTestId("cooking-sear-tune")).toHaveCount(0);
    const hb = (await page.getByTestId("cooking-sear-hold").boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1600);
    await page.mouse.up();
    await expect(page.getByTestId("cooking-sear-title")).toHaveText("こんがり焼き目");
    await shot(page, "hv-01-seared");
    await expect(page.getByTestId("cooking-sear-done")).toBeVisible({ timeout: 4000 });
    await page.waitForTimeout(700);
    await shot(page, "hv-02-on-pizza");
    // The bake is driven by the VIRTUAL clock (the way bake-one-way.spec.ts does): the generic Free Cooking window is only 58-78 and the needle moves 33 pt/s, so
    // "wait until >= 66, then click" on a loaded WebKit runner can overshoot the window (a burnt bake skips 仕上げ and the 完成 button never appears).
    await enterBakeAtZero(page);
    await page.clock.runFor(Math.round((66 / BAKE_SPEED_PCT_PER_S) * 1000)); // the needle at 66, inside the JUST band
    await page.getByRole("button", { name: "取り出す！" }).evaluate((el) => (el as HTMLButtonElement).click());
    await page.clock.resume();
    await page.getByRole("button", { name: "完成" }).click(); // the FINISH step ("仕上げ") before RESULT
    await page.waitForSelector(".result-panel", { timeout: 15_000 });
    await shot(page, "hv-03-result");
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).not.toBe(REAL); // the page's storage is the disposable one
  });

  test("a reload starts the entry over (nothing is kept) and ?cookSearMs= still compares", async ({ page }) => {
    await openEntry(page, "?cookSearHv=1&cookSearMs=2000");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await tapDoughPercent(page, 40, 50);
    expect(await sausagePieces(page)).toBe(1);
    await pill(page).click();
    await expect(screenEl(page)).toHaveAttribute("data-full-ms", "2000");
    await page.reload();
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    expect(await sausagePieces(page)).toBe(0);
  });

  test("without the param the game opens as usual: no marker, no jump into cooking, no pill, the real save untouched", async ({ page }) => {
    await openEntry(page, "?cookSear=on");
    await page.waitForSelector(".app-frame");
    await expect(page.locator("html")).not.toHaveAttribute("data-cook-sear-hv", /.*/);
    await expect(pill(page)).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(REAL);
  });
});
