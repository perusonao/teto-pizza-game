import { expect, test, type Page } from "@playwright/test";
import { BAKE_SPEED_PCT_PER_S } from "../src/logic/bakeProgress";
import { SEAR_FULL_MS, SEAR_LOOK_COPY, searAmountAt, searLookOf } from "../src/logic/sear/searHold";
import { SEAR_DONE_MS, SEAR_GUARD_MS } from "../src/logic/sear/searOffer";
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

/**
 * Installs the virtual clock and pauses it a little ahead, so nothing on the page advances until the test says so. Used for the sear hold (#394 Phase 1b) and for the bake.
 * The page measures a hold with `event.timeStamp`, and Playwright's clock fakes that stamp together with `performance.now()` and the timers, so a hold of N ms is N
 * virtual ms exactly, whatever the runner does between `mouse.down()` and `mouse.up()`. (The old test slept 1600 real ms: a 260 ms stall on a loaded WebKit runner
 * moved the release past the 0.62 edge, 1860 ms, and 「こんがり焼き目」 became 「しっかり焼き目」 -- main run 41656667776, 2026-11-03.)
 */
async function pauseVirtualClock(page: Page) {
  await page.clock.install();
  for (const buffer of [300, 800, 2000]) {
    try {
      await page.clock.pauseAt(Date.now() + buffer);
      return;
    } catch (error) {
      if (!String(error).includes("to the past")) throw error;
    }
  }
  throw new Error("pauseVirtualClock: could not pause the clock (every pauseAt landed in the past)");
}

/**
 * Enters BAKE with the virtual clock paused, so the needle starts at exactly 0 (same helper shape as bake-one-way.spec.ts). The click is a DOM click: Playwright's own actionability wait needs a running rAF.
 * `clockPaused`: the sear hold above already installed and paused the clock, which has only moved by `runFor` since.
 */
async function enterBakeAtZero(page: Page, options: { clockPaused?: boolean } = {}) {
  if (!options.clockPaused) await pauseVirtualClock(page);
  await page.getByRole("button", { name: /焼く/ }).evaluate((el) => (el as HTMLButtonElement).click());
  await page.waitForSelector(".bake-gauge__needle");
}

/** One URL -> the sear screen is open on the TOPPING step with 3 sausage pieces placed; returns the centre of the hold button. */
async function openSearScreen(page: Page) {
  await openEntry(page, "?cookSearHv=1");
  await expect(pill(page)).toBeVisible({ timeout: 10_000 });
  for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) await tapDoughPercent(page, x, y);
  expect(await sausagePieces(page)).toBe(3);
  await pill(page).click();
  await expect(screenEl(page)).toHaveAttribute("data-full-ms", String(SEAR_FULL_MS));
  await expect(page.getByTestId("cooking-sear-tune")).toHaveCount(0);
  const hb = (await page.getByTestId("cooking-sear-hold").boundingBox())!;
  return { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };
}

/**
 * Presses the hold button for `heldMs` of VIRTUAL time and releases. `realStallMs` is real time the runner "loses" between the last virtual tick and the release
 * (a loaded CI runner does this at random; the regression test below does it on purpose): the virtual clock does not move during it.
 */
async function holdSear(page: Page, at: { x: number; y: number }, heldMs: number, realStallMs = 0) {
  await pauseVirtualClock(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.clock.runFor(heldMs);
  if (realStallMs > 0) await page.waitForTimeout(realStallMs);
  await page.mouse.up();
}

/** After the release: the result words are up; advance the VIRTUAL clock until the screen has closed ("✓ 炙り済み") and the short guard has run out. */
async function finishSearScreen(page: Page) {
  await expect.poll(async () => {
    await page.clock.runFor(100);
    return page.getByTestId("cooking-sear-done").isVisible();
  }, { message: "the sear screen closed (SEAR_DONE_MS of virtual time after the release)", timeout: 10_000 }).toBe(true);
  await page.clock.runFor(SEAR_GUARD_MS + 100);
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
    const at = await openSearScreen(page);
    await holdSear(page, at, 1600);
    await expect(page.getByTestId("cooking-sear-title")).toHaveText("こんがり焼き目");
    await shot(page, "hv-01-seared");
    await finishSearScreen(page);
    await expect(page.getByTestId("cooking-sear-done")).toBeVisible();
    await page.waitForTimeout(700); // the piece's landing animation (a CSS animation: real time, only for the screenshot)
    await shot(page, "hv-02-on-pizza");
    // The bake is driven by the VIRTUAL clock (the way bake-one-way.spec.ts does): the generic Free Cooking window is only 58-78 and the needle moves 33 pt/s, so
    // "wait until >= 66, then click" on a loaded WebKit runner can overshoot the window (a burnt bake skips 仕上げ and the 完成 button never appears).
    await enterBakeAtZero(page, { clockPaused: true });
    await page.clock.runFor(Math.round((66 / BAKE_SPEED_PCT_PER_S) * 1000)); // the needle at 66, inside the JUST band
    await page.getByRole("button", { name: "取り出す！" }).evaluate((el) => (el as HTMLButtonElement).click());
    await page.clock.resume();
    await page.getByRole("button", { name: "完成" }).click(); // the FINISH step ("仕上げ") before RESULT
    await page.waitForSelector(".result-panel", { timeout: 15_000 });
    await shot(page, "hv-03-result");
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).not.toBe(REAL); // the page's storage is the disposable one
  });

  // #394 Phase 1b regression. The hold is measured on the page's (virtual) clock, so what the runner does in REAL time between the press and the release must not change
  // the look. Before: the test slept 1600 real ms and a stall of 260 ms or more moved the release past the golden / deep edge (0.62 x 3000 = 1860 ms).
  test("the look follows the virtual held time, not the runner's speed: a real stall of 2.5 s before the release changes nothing", async ({ page }) => {
    const at = await openSearScreen(page);
    await holdSear(page, at, 1600, 2500);
    await expect(page.getByTestId("cooking-sear-title")).toHaveText(SEAR_LOOK_COPY.golden);
    await expect(screenEl(page)).toHaveAttribute("data-look", "golden");
  });

  // The two sides of the golden / deep edge, 10 virtual ms either way: a hold is exactly as long as the virtual clock says, with no real-time slack in either direction.
  for (const [heldMs, look] of [[1850, "golden"], [1870, "deep"]] as const) {
    test(`a virtual hold of ${heldMs} ms is ${look} (the edge is ${0.62 * SEAR_FULL_MS} ms)`, async ({ page }) => {
      expect(searLookOf(searAmountAt(heldMs)), "the table follows the pure function").toBe(look);
      const at = await openSearScreen(page);
      await holdSear(page, at, heldMs);
      await expect(page.getByTestId("cooking-sear-title")).toHaveText(SEAR_LOOK_COPY[look]);
    });
  }

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
