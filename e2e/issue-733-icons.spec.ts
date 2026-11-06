import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Issue #733 (Owner decision 2026-11-05: beef = plan B "seared chunks", green-pepper = plan R1 "two ring slices"; the visual ids are kept).
 * Human Verification of the two redrawn icons at 390x844 / 360x800:
 *  1. nigerian-suya-pizza (beef 3 / green-pepper 1 / onion 2, NO_SAUCE) played to NEW DISCOVERY: the recipe and the discovery are unchanged by the art.
 *  2. A lineup pizza: beef next to bacon / ham, green-pepper next to green-onion / zucchini, on the dough and baked, plus the 肉系 / 野菜 tray filters and a grayscale view.
 * Every chip and piece of beef / green-pepper draws the dedicated SVG (`svg.ingredient-glyph--beef-slices` / `--green-pepper-strips`), and nothing overflows horizontally.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ALL_IDS = RECIPES.map((r) => r.id as string);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const SUYA = "nigerian-suya-pizza";

const saveJson = (discovered: readonly string[], owned: readonly string[]) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: [...owned],
  });

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
async function capture(page: Page, name: string, project: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${project}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}
async function open(page: Page, json: string) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, json] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}
async function place(page: Page, picks: [RegExp, number][], startSpot: number) {
  let spot = startSpot;
  for (const [name, count] of picks) {
    await (await chipOnTrayOrPin(page, name)).click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  return spot;
}
/** Research the suya Entry and walk to the TOPPING step (dough, no sauce, cheese 2). */
async function toTopping(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ A（牛肉）を研究する$/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
  const spot = await place(page, [[/モッツァレラ/, 2]], 0);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
  return spot;
}
async function expectDedicated(page: Page, where: string) {
  for (const visual of ["beef-slices", "green-pepper-strips"]) {
    const svgs = page.locator(`.pizza-stage svg.ingredient-glyph--${visual}`);
    expect(await svgs.count(), `${where}: ${visual} pieces`).toBeGreaterThan(0);
    // R1 rings: two even-odd ring bodies; B chunks: three crust rects -- never the old ribbon / strip paths.
    if (visual === "green-pepper-strips") await expect(svgs.first().locator('path[fill-rule="evenodd"]')).toHaveCount(2);
    else await expect(svgs.first().locator("rect")).toHaveCount(9);
  }
}

test.describe("Issue #733: beef chunks / green-pepper rings in the real game", () => {
  test.setTimeout(300_000);

  test("nigerian-suya-pizza is still played to NEW DISCOVERY with the redrawn beef / green-pepper", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const step = DISCOVERY_LADDER.steps.findIndex((s) => s.ingredientIds.includes("beef")) + 1;
    const discovered = ALL_IDS.filter((id) => id !== SUYA);
    await open(page, saveJson(discovered, materialsUpTo(step)));
    await hold(page);
    let spot = await toTopping(page);
    await (await chipOnTrayOrPin(page, /牛肉/)).scrollIntoViewIfNeeded();
    await expect(page.locator(".ingredient-chip").filter({ hasText: /牛肉/ }).locator("svg.ingredient-glyph--beef-slices")).toHaveCount(1);
    await capture(page, "01-suya-tray-beef", project);
    await hold(page, 2000);
    spot = await place(page, [[/牛肉/, 3], [/ピーマン/, 1], [/たまねぎ|玉ねぎ/, 2]], spot);
    await expectDedicated(page, "suya topped");
    await noOverflow(page, "suya topped");
    await capture(page, "02-suya-topped", project);
    await hold(page, 2500);
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ナイジェリアンスヤピザ");
    await noOverflow(page, "suya result");
    await capture(page, "03-suya-baked-result", project);
    await hold(page, 3000);
    expect(errors).toEqual([]);
  });

  test("lineup: beef next to bacon / ham and green-pepper next to green-onion / zucchini (dough, baked, tray filters, grayscale)", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const step = DISCOVERY_LADDER.steps.findIndex((s) => s.ingredientIds.includes("beef")) + 1;
    await open(page, saveJson(ALL_IDS.filter((id) => id !== SUYA), materialsUpTo(step)));
    let spot = await toTopping(page);

    // Tray filters: 肉系 (beef with bacon / ham / salami / sausage ...) and 野菜・きのこ系 (green-pepper with green-onion / zucchini / jalapeno ...).
    await page.getByRole("button", { name: "肉系の具材だけ表示" }).click();
    await (await chipOnTrayOrPin(page, /牛肉/)).scrollIntoViewIfNeeded();
    await noOverflow(page, "tray meat");
    await capture(page, "04-tray-meat-filter", project);
    await hold(page, 2200);
    await page.getByRole("button", { name: "野菜・きのこ系の具材だけ表示" }).click();
    await (await chipOnTrayOrPin(page, /ピーマン/)).scrollIntoViewIfNeeded();
    await noOverflow(page, "tray vegetable");
    await capture(page, "05-tray-vegetable-filter", project);
    await hold(page, 2200);
    await page.getByRole("button", { name: "全ての具材を表示" }).click();

    spot = await place(page, [[/牛肉/, 1], [/ベーコン/, 1], [/ハム/, 1], [/ピーマン/, 1], [/青ねぎ/, 1], [/ズッキーニ/, 1]], spot);
    await expectDedicated(page, "lineup topped");
    await noOverflow(page, "lineup topped");
    await capture(page, "06-lineup-topped", project);
    await hold(page, 2500);
    const gray = await page.addStyleTag({ content: ".pizza-stage, .ingredient-tray { filter: grayscale(1) !important; }" });
    await capture(page, "07-lineup-topped-grayscale", project);
    await hold(page, 1500);
    await gray.evaluate((el) => el.remove());
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");
    await noOverflow(page, "lineup result");
    await capture(page, "08-lineup-baked-result", project);
    await hold(page, 3000);
    expect(errors).toEqual([]);
  });
});
