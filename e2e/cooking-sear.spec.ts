import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep, tapDoughPercent } from "./gestures";
import { base, HAND_ON_OWNED, SAVE_KEY } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Cooking Sear Phase 1 (#724, 焼き目をつける・長押し炙り): the optional sausage sear in the TOPPING step, on both authority viewports (390x844, 360x800).
 * Production is OFF; the Preview / DEV opt-in `?cookSear=on` stands in for it. HV_SHOT_DIR (optional) writes the screenshots.
 * The pill sits in the same band as the 炒める pill (44px high, centred, pill bottom = stage bottom - 18px).
 */
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

async function toTopping(page: Page, query: string) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(base(HAND_ON_OWNED))] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByTestId("prepare-dock")).toBeVisible();
}

async function select(page: Page, label: string) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: label }).first();
  for (let i = 0; i < 20 && !(await chip.isVisible()); i += 1) {
    const nextPage = page.getByRole("button", { name: "次のページ" });
    if (!(await nextPage.isEnabled().catch(() => false))) break;
    await nextPage.click();
  }
  await chip.click();
}

const rect = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height };
  }, selector);
const pill = (page: Page) => page.getByTestId("cooking-sear-pill");
const screenEl = (page: Page) => page.getByTestId("cooking-sear");
const holdBtn = (page: Page) => page.getByTestId("cooking-sear-hold");
const sausageInner = (page: Page) =>
  page.evaluate(() => {
    const path = document.querySelector(".pizza-dough .pizza-topping--sausage svg path:nth-of-type(2)");
    return path ? getComputedStyle(path).fill : null;
  });
const sausagePieces = (page: Page) => page.locator(".pizza-dough .pizza-topping--sausage").count();
const readSave = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), SAVE_KEY);

/** A real mouse hold on the centre of the hold button, kept for `ms` of real time. */
async function holdFor(page: Page, ms: number) {
  const b = (await holdBtn(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function noOverflow(page: Page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.sh).toBeLessThanOrEqual(m.ih);
}

test.describe("Cooking Sear: gate", () => {
  test("production default (no query): selecting sausage shows no pill and nothing changes", async ({ page }) => {
    await toTopping(page, "");
    await select(page, "ソーセージ");
    await expect(pill(page)).toHaveCount(0);
    await expect(screenEl(page)).toHaveCount(0);
    // "before": the same three pieces with the feature OFF are the shipped drawing and there is nothing to press (screenshots only)
    await tapDoughPercent(page, 38, 48);
    await tapDoughPercent(page, 60, 52);
    await tapDoughPercent(page, 50, 30);
    expect(await sausageInner(page)).toBe("rgb(185, 94, 71)");
    await expect(pill(page)).toHaveCount(0);
    await page.waitForTimeout(700); // the last piece's landing animation
    await shot(page, "00-before-feature-off");
  });

  test("?cookPrep=on alone does not turn the sear on, and the 炒める pill still belongs to beef", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "ソーセージ");
    await expect(pill(page)).toHaveCount(0);
    await expect(page.getByTestId("cooking-prep-pill")).toHaveCount(0);
    await select(page, "牛肉");
    await expect(page.getByTestId("cooking-prep-pill")).toBeVisible();
    await expect(pill(page)).toHaveCount(0);
  });
});

test.describe("Cooking Sear: the long press", () => {
  test("pill geometry, the hold changes the colour while pressed, the release keeps it, nothing is saved or scored", async ({ page }) => {
    await toTopping(page, "?cookSear=on");
    await select(page, "ソーセージ");
    await expect(pill(page)).toBeVisible();
    await expect(page.getByTestId("cooking-prep-pill")).toHaveCount(0);

    const stage = (await rect(page, ".pizza-stage"))!;
    const p = (await rect(page, ".cooking-sear-pill"))!;
    expect(p.h).toBeGreaterThanOrEqual(44);
    expect(Math.abs(stage.b - 18 - p.b)).toBeLessThanOrEqual(1);
    const dough = (await rect(page, ".pizza-dough"))!;
    expect(p.t).toBeGreaterThan(dough.b); // never touching the dough
    await shot(page, "01-pill");

    await tapDoughPercent(page, 38, 48);
    await tapDoughPercent(page, 60, 52);
    await tapDoughPercent(page, 50, 30);
    expect(await sausagePieces(page)).toBe(3);
    expect(await sausageInner(page)).toBe("rgb(185, 94, 71)"); // the shipped SausageSlices colour
    const saveBefore = await readSave(page);
    await page.waitForTimeout(700);
    await shot(page, "02-placed-raw");

    await pill(page).click();
    await expect(screenEl(page)).toBeVisible();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "idle");
    await shot(page, "03-screen-idle");

    // The hold: the colour moves only while the finger is down.
    const b = (await holdBtn(page).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "holding");
    const food = () => page.getByTestId("cooking-sear-food").evaluate((el) => getComputedStyle(el).getPropertyValue("--sear-inner"));
    const c0 = await food();
    await page.waitForTimeout(1300);
    await shot(page, "04-holding-light");
    const c1 = await food();
    await page.waitForTimeout(1500);
    await shot(page, "05-holding-golden");
    const c2 = await food();
    expect(new Set([c0, c1, c2]).size).toBe(3);
    await page.mouse.up();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "done");
    const kept = await food();
    await page.waitForTimeout(500);
    expect(await food()).toBe(kept); // let go: it does not keep browning
    await shot(page, "06-released");

    await expect(screenEl(page)).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByTestId("cooking-sear-done")).toBeVisible();
    // The placed pieces carry the kept look (a different colour from raw) and the save is byte-identical.
    expect(await sausageInner(page)).not.toBe("rgb(185, 94, 71)");
    expect(await readSave(page)).toStrictEqual(saveBefore);
    expect(await sausagePieces(page)).toBe(3);
    await page.waitForTimeout(700);
    await shot(page, "07-seared-on-pizza");
  });

  test("a tap is not a sear; × leaves nothing; the layout holds with no scroll", async ({ page }) => {
    await toTopping(page, "?cookSear=on");
    await select(page, "ソーセージ");
    await tapDoughPercent(page, 40, 50);
    await pill(page).click();
    await expect(screenEl(page)).toBeVisible();
    // layout: the hold button inside the panel, clear of the ×, ≥ 56px; the title clear of the ×
    const panel = (await rect(page, ".cooking-sear"))!;
    const hb = (await rect(page, ".cooking-sear__hold"))!;
    const x = (await rect(page, ".cooking-sear__close"))!;
    const title = (await rect(page, ".cooking-sear__title"))!;
    const plate = (await rect(page, ".cooking-sear__plate"))!;
    expect(hb.h).toBeGreaterThanOrEqual(56);
    expect(hb.b).toBeLessThanOrEqual(panel.b - 8);
    expect(plate.b).toBeLessThanOrEqual(hb.t);
    expect(title.b).toBeLessThanOrEqual(plate.t + 1);
    expect(hb.t).toBeGreaterThan(x.b + 8);
    await noOverflow(page);
    await shot(page, "08-layout");

    await holdFor(page, 120); // a tap
    await expect(screenEl(page)).toHaveAttribute("data-mode", "idle");
    await expect(page.getByTestId("cooking-sear-title")).toContainText("もう少し押し続けてね");
    await page.waitForTimeout(1200);
    await expect(screenEl(page)).toBeVisible(); // nothing kept, nothing closed
    expect(await sausageInner(page)).toBe("rgb(185, 94, 71)");

    await page.mouse.move(panel.l + 40, panel.t + 60);
    await page.getByTestId("cooking-sear-cancel").click();
    await expect(screenEl(page)).toHaveCount(0);
    await expect(pill(page)).toBeVisible();
    expect(await sausageInner(page)).toBe("rgb(185, 94, 71)");
  });

  test("behind the sear screen nothing can be tapped (pieces, bake, reset), and a late tap after it closes does not reach the dough", async ({ page }) => {
    await toTopping(page, "?cookSear=on");
    await select(page, "ソーセージ");
    await tapDoughPercent(page, 40, 50);
    expect(await sausagePieces(page)).toBe(1);
    await pill(page).click();
    await expect(screenEl(page)).toBeVisible();
    const bake = await rect(page, ".prepare-bake-bar");
    if (bake) await page.mouse.click(bake.l + bake.w * 0.75, bake.t + bake.h / 2); // 焼く！ behind the panel
    await expect(page.getByTestId("prepare-dock")).toBeVisible();
    expect(await sausagePieces(page)).toBe(1);
    await expect(page.locator(".bake-overlay, .bake-gauge")).toHaveCount(0);
    await holdFor(page, 900);
    await expect(screenEl(page)).toHaveCount(0, { timeout: 3000 });
    expect(await sausagePieces(page)).toBe(1);
  });

  test("the whole round still plays to a result with a seared sausage (bake → 取り出す → RESULT)", async ({ page }) => {
    await toTopping(page, "?cookSear=on");
    await select(page, "ソーセージ");
    await tapDoughPercent(page, 40, 50);
    await tapDoughPercent(page, 60, 50);
    await pill(page).click();
    await holdFor(page, 1800);
    await expect(page.getByTestId("cooking-sear-done")).toBeVisible({ timeout: 4000 });
    await tapDoughPercent(page, 50, 32);
    expect(await sausagePieces(page)).toBe(3);
    await shot(page, "09-three-seared");
    await page.getByRole("button", { name: /焼く/ }).click();
    await expect(page.locator(".bake-gauge, .bake-overlay").first()).toBeVisible();
    await shot(page, "10-bake");
  });
});
