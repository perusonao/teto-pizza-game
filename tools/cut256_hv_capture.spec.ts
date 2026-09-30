import { expect, test, type Page } from "@playwright/test";
import {
  completeDoughStep,
  cutThreeLines,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  startFreshMargherita,
  startLunchRushMission,
  startMarinaraUnlocked,
  tapDoughPercent,
} from "./gestures";
import { cookDinnerPizza, DM_A, dinnerSave, nextDinnerPizza, openDinnerDetail, openWithSave } from "./support/dinner";

/**
 * #256 / Dinner UI Polish: Human Verification capture (tool; not part of the suite). Copy to e2e/
 * of a checkout and run
 *   HV_OUT=<dir> [HV_VIDEO=1] npx playwright test e2e/cut256_hv_capture.spec.ts --project=iphone-390x844 --workers=1
 * Run on the baseline (before) and on the change (after); each scenario saves its key screens as
 * <dir>/<scenario>-<n>-<state>.png, and with HV_VIDEO=1 records a 390x844 video (left in
 * test-results/, converted to H.264 separately). Holds of 1.2-2 s make each state readable.
 * Every take-out stays far from a Completion Gate band edge (see e2e/cut-skip-failed-bake.spec.ts).
 */

const OUT = process.env.HV_OUT ?? "hv-out";
test.use({ viewport: { width: 390, height: 844 }, video: process.env.HV_VIDEO ? { mode: "on", size: { width: 390, height: 844 } } : "off" });

const hold = (page: Page, ms = 1500) => page.waitForTimeout(ms);
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });
const cutButton = (page: Page) => page.getByRole("button", { name: /切り終わる/ });

async function prepareMargherita(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 55);
  await tapDoughPercent(page, 55, 45);
}

async function prepareMarinara(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /にんにく/ }).click();
  await tapDoughPercent(page, 35, 45);
  await tapDoughPercent(page, 65, 45);
  await tapDoughPercent(page, 50, 65);
  await page.getByRole("button", { name: /オレガノ/ }).click();
  await tapDoughPercent(page, 45, 30);
  await tapDoughPercent(page, 55, 30);
}

/** Bake at `value`, screenshot what 取り出す leads to, and walk a CUT if one is shown. */
async function bakeAndShow(page: Page, value: number, name: string) {
  await enterBakePaused(page);
  await hold(page, 800);
  await landNeedleAndTakeOut(page, { start: value, end: value });
  await hold(page, 1200);
  await shot(page, `${name}-after-takeout`);
  if (await cutButton(page).count()) {
    await hold(page);
    await cutThreeLines(page);
    await hold(page, 600);
    await cutButton(page).click();
    await hold(page, 1200);
    await shot(page, `${name}-result`);
  }
  await hold(page, 1500);
}

test("A-guided: burnt marinara (skip) and in-band margherita (CUT kept)", async ({ page }) => {
  test.setTimeout(180_000);
  await startMarinaraUnlocked(page);
  await prepareMarinara(page);
  await bakeAndShow(page, 97, "A1-guided-marinara-burnt");
  await startFreshMargherita(page);
  await prepareMargherita(page);
  await bakeAndShow(page, 70, "A2-guided-margherita-inband");
});

test("B-lunch-rush: raw margherita (skip) then serve", async ({ page }) => {
  test.setTimeout(180_000);
  await startLunchRushMission(page, 900);
  await prepareMargherita(page);
  await bakeAndShow(page, 2, "B1-lunch-rush-raw");
  await page.getByRole("button", { name: /次の注文へ/ }).click();
  await hold(page);
});

test("C-dinner: target row + 見本, burnt bismarck, QUALITY_FAIL", async ({ page }) => {
  test.setTimeout(240_000);
  await openWithSave(page, dinnerSave([...DM_A], { egg: 4 }), "?dinnerDuration=900&dinnerMinStars=5");
  await openDinnerDetail(page, /ディナーミッション 1/);
  await page.getByRole("button", { name: /スタート/ }).click();
  await expect(page.getByTestId("dinner-target-row")).toBeVisible();
  await hold(page, 2000);
  await shot(page, "C1-dinner-target-row");
  await page.getByTestId("dinner-chip-breakfast-pizza").click();
  await hold(page, 2000);
  await shot(page, "C2-dinner-reference");
  await page.getByRole("dialog", { name: /の見本/ }).getByRole("button", { name: /閉じる/ }).click();
  await hold(page, 800);
  // Burnt bismarck: before = CUT first; after = INVALID at 取り出す.
  await cookDinnerPizza(page, "bismarck", { overbake: true, pauseMs: 400 });
  await hold(page, 1200);
  await shot(page, "C3-dinner-bismarck-burnt-after-takeout");
  if (await cutButton(page).count()) {
    await cutThreeLines(page);
    await cutButton(page).click();
    await hold(page, 1200);
  }
  await hold(page, 1500);
  await nextDinnerPizza(page);
  // S = 5: a hand-placed margherita lands below it -> QUALITY_FAIL (あと★N on the change).
  await cookDinnerPizza(page, "margherita", { pauseMs: 300 });
  await expect(page.getByTestId("dinner-attempt-result")).toBeVisible();
  await hold(page, 2500);
  await shot(page, "C4-dinner-quality-fail");
});

test("D-dinner-clear: 最後のピザ", async ({ page }) => {
  test.setTimeout(300_000);
  await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=900&dinnerMinStars=1");
  await openDinnerDetail(page, /ディナーミッション 1/);
  await page.getByRole("button", { name: /スタート/ }).click();
  const order = ["funghi", "margherita", "bismarck", "breakfast-pizza"] as const;
  for (const [i, p] of order.entries()) {
    await cookDinnerPizza(page, p);
    await hold(page, 900);
    if (i < order.length - 1) await nextDinnerPizza(page);
  }
  await expect(page.getByRole("dialog", { name: "ディナーミッション結果" })).toBeVisible();
  await hold(page, 2500);
  await shot(page, "D1-dinner-clear");
});
