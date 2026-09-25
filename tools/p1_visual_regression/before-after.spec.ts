import { test, expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { INGREDIENTS } from "../../src/data/ingredients";
import { RECIPES } from "../../src/data/recipes";

/**
 * Production Visual P1: drive the identical deterministic script against the BEFORE and AFTER
 * production builds and require every capture to be pixel-identical. Contexts: HOME, Pizza Select
 * (thumbnails), Free Cooking tray (every sauce / cheese / topping page), pizza raw with every
 * current topping, bake (needle frozen at the window center), RESULT (all-ingredient list),
 * Inventory, Shop, Dex -- each list scrolled to its end.
 */

const BEFORE = process.env.W1_P1_BEFORE_URL;
const AFTER = process.env.W1_P1_AFTER_URL;
const SHOTS = process.env.W1_P1_SHOTS_DIR;
const SAVE_KEY = "teto-pizza-save-v1";
const BAKE = { start: 58, end: 78, speed: 55 };

test.skip(!BEFORE || !AFTER, "set W1_P1_BEFORE_URL and W1_P1_AFTER_URL");

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const SAVE = {
  schemaVersion: 2,
  dex: RECIPES.map((r) => ({ recipeId: r.id, discovered: true, bestScore: 80, bestStars: 3, timesMade: 2 })),
  pitzBalance: 9999,
  ownedIngredientIds: ALL_IDS,
  missionBest: {},
  inventory: Object.fromEntries(FINITE_IDS.map((id) => [id, 30])),
  starterGrantClaimedRecipeIds: RECIPES.map((r) => r.id),
};
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping");
// Deterministic, spaced positions (>= 10 apart) for every current topping on one pizza.
const SPOTS: Array<[number, number]> = [];
for (const y of [22, 34, 46, 58, 70, 82]) for (const x of [24, 36, 48, 60, 72]) if (Math.hypot(x - 48, y - 52) < 34) SPOTS.push([x, y]);

type Shot = { name: string; png: Buffer };

async function openPage(browser: Browser, base: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(
    ([key, raw]) => {
      localStorage.setItem(key, JSON.stringify(raw));
      let seed = 42;
      Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    },
    [SAVE_KEY, SAVE] as const,
  );
  await page.goto(base);
  await page.waitForSelector(".app-frame");
  return page;
}

async function snap(page: Page, shots: Shot[], name: string) {
  await page.waitForTimeout(350);
  shots.push({ name, png: await page.screenshot({ animations: "disabled", caret: "hide" }) });
}

/** Screenshot, then scroll the biggest scrollable element page by page to its end. */
async function snapScrolling(page: Page, shots: Shot[], name: string) {
  await snap(page, shots, `${name}-0`);
  for (let i = 1; i <= 12; i += 1) {
    const moved = await page.evaluate(() => {
      const els = [...document.querySelectorAll<HTMLElement>("*")].filter(
        (el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY),
      );
      const el = els.sort((a, b) => b.clientHeight - a.clientHeight)[0];
      if (!el) return false;
      const before = el.scrollTop;
      el.scrollTop = before + el.clientHeight * 0.8;
      return el.scrollTop !== before;
    });
    if (!moved) break;
    await snap(page, shots, `${name}-${i}`);
  }
}

async function selectChip(page: Page, name: string) {
  const chip = page.locator(".ingredient-chip").filter({
    has: page.locator(".ingredient-chip__name", { hasText: new RegExp(`^${name}$`) }),
  });
  for (let i = 0; i < 5 && (await chip.count()) === 0; i += 1) await page.getByRole("button", { name: "次のページ" }).click();
  await chip.click();
}

async function firstTrayPage(page: Page) {
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 5 && (await prev.count()) && !(await prev.isDisabled()); i += 1) await prev.click();
}

async function trayPages(page: Page, shots: Shot[], name: string) {
  await firstTrayPage(page);
  await snap(page, shots, `${name}-p1`);
  const next = page.getByRole("button", { name: "次のページ" });
  for (let p = 2; p <= 5 && (await next.count()) && !(await next.isDisabled()); p += 1) {
    await next.click();
    await snap(page, shots, `${name}-p${p}`);
  }
  await firstTrayPage(page);
}

async function script(page: Page, base: string): Promise<Shot[]> {
  const shots: Shot[] = [];
  await snap(page, shots, "01-home");

  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.waitForSelector(".pizza-select-screen");
  await snapScrolling(page, shots, "02-pizza-select");
  // Back to HOME with the same seeded save (the init script re-runs on every navigation).
  await page.goto(base);
  await page.waitForSelector(".app-frame");

  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await trayPages(page, shots, "03-tray-sauce");
  await selectChip(page, "トマトソース");
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await trayPages(page, shots, "04-tray-cheese");
  await selectChip(page, "モッツァレラ");
  await tapDoughPercent(page, 50, 52);
  await page.getByRole("button", { name: /次へ/ }).click();
  await trayPages(page, shots, "05-tray-topping");
  for (let i = 0; i < TOPPINGS.length && i < SPOTS.length; i += 1) {
    await selectChip(page, TOPPINGS[i].nameJa);
    await tapDoughPercent(page, SPOTS[i][0], SPOTS[i][1]);
    await firstTrayPage(page);
  }
  await page.mouse.move(2, 2);
  await snap(page, shots, "06-pizza-raw");

  // Freeze virtual time *before* the oven mounts, so the needle advances by exactly the same
  // frames in both builds (a real-time head start would make the bake tint differ).
  // Fixed absolute times: the fake clock's frame grid (and so the first frame's dt) is then
  // identical in both runs -- a Date.now()-relative pause left up to one frame (~0.8 needle) of jitter.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:10Z"));
  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForSelector(".bake-gauge__needle");
  await page.clock.runFor(Math.round((((BAKE.start + BAKE.end) / 2) / BAKE.speed) * 1000));
  const needle = page.locator(".bake-gauge__needle");
  const at = await needle.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left));
  expect(at).toBeGreaterThan(BAKE.start);
  expect(at).toBeLessThan(BAKE.end);
  await snap(page, shots, "07-bake");
  await page.getByRole("button", { name: "取り出す！" }).click();
  await page.clock.resume();
  if (await page.getByRole("button", { name: /切り終わる/ }).count()) await page.getByRole("button", { name: /切り終わる/ }).click();
  await page.waitForSelector(".result-panel");
  await snapScrolling(page, shots, "08-result");

  await page.goto(base);
  await page.waitForSelector(".app-frame");
  for (const [label, name] of [["材料", "09-inventory"], ["ショップ", "10-shop"], ["ピザ図鑑", "11-dex"]] as const) {
    await page.locator(".home-menu__card", { hasText: label }).click();
    await page.waitForTimeout(300);
    await snapScrolling(page, shots, name);
    await page.getByRole("button", { name: "閉じる" }).first().click();
  }
  return shots;
}

async function pixelDiff(a: Buffer, b: Buffer) {
  const [ra, rb] = await Promise.all([sharp(a).raw().toBuffer({ resolveWithObject: true }), sharp(b).raw().toBuffer({ resolveWithObject: true })]);
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) return { differing: -1, exact: -1, mask: null as Buffer | null, info: ra.info };
  // `exact` counts any channel change; `differing` ignores +/-2 per channel, the renderer's own
  // antialias jitter (measured: the same build compared with itself occasionally differs by 1 on a
  // few gauge-rail edge pixels). The gate uses `differing`; `exact` is reported alongside.
  let differing = 0;
  let exact = 0;
  const mask = Buffer.alloc(ra.info.width * ra.info.height);
  for (let p = 0; p < mask.length; p += 1) {
    const o = p * ra.info.channels;
    let maxDelta = 0;
    for (let c = 0; c < ra.info.channels; c += 1) maxDelta = Math.max(maxDelta, Math.abs(ra.data[o + c] - rb.data[o + c]));
    if (maxDelta > 0) exact += 1;
    if (maxDelta > 2) {
      differing += 1;
      mask[p] = 255;
    }
  }
  return { differing, exact, mask, info: ra.info };
}

test("P1 BEFORE == AFTER (pixel-identical in every context)", async ({ browser }, testInfo: TestInfo) => {
  test.setTimeout(300_000);
  const viewport = testInfo.project.use.viewport!;
  const before = await script(await openPage(browser, BEFORE!, viewport), BEFORE!);
  const after = await script(await openPage(browser, AFTER!, viewport), AFTER!);
  expect(after.map((s) => s.name)).toEqual(before.map((s) => s.name));

  const dir = SHOTS ? `${SHOTS}/${testInfo.project.name}` : null;
  if (dir) mkdirSync(dir, { recursive: true });
  const report: Array<{ name: string; differingPixels: number; exactChangedPixels: number }> = [];
  for (let i = 0; i < before.length; i += 1) {
    const { differing, exact, mask, info } = await pixelDiff(before[i].png, after[i].png);
    report.push({ name: before[i].name, differingPixels: differing, exactChangedPixels: exact });
    if (dir) {
      writeFileSync(`${dir}/${before[i].name}.before.png`, before[i].png);
      writeFileSync(`${dir}/${before[i].name}.after.png`, after[i].png);
      if (differing > 0 && mask) {
        await sharp(mask, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toFile(`${dir}/${before[i].name}.diff.png`);
      }
    }
  }
  if (dir) writeFileSync(`${dir}/report.json`, JSON.stringify({ captures: report.length, report }, null, 2));
  console.log(
    `${testInfo.project.name}: ${report.length} captures, differing=${JSON.stringify(report.filter((r) => r.differingPixels !== 0))}, ` +
      `exactChanged=${JSON.stringify(report.filter((r) => r.exactChangedPixels !== 0).map((r) => [r.name, r.exactChangedPixels]))}`,
  );
  expect(report.filter((r) => r.differingPixels !== 0)).toEqual([]);
  expect(report.length).toBeGreaterThan(15);
});
