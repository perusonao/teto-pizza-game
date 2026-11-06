import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { startTargetlessFreeCook } from "./support/startFreeCook";
import { materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Issue #417 herbs (Owner R2 decision 2026-11-06: rosemary B / oregano B / spinach A2 / artichoke A2, 1.2em): the four herbs that shared
 * 🌱 / 🍃 now draw dedicated SVGs. Human Verification at 390x844 / 360x800 (Chromium + WebKit projects):
 *  1. Pizza Select: the thumbnails of the shipped recipes that use the herbs draw the SVGs (layout unchanged, pinned by RT-01).
 *  2. Free Cooking: the four chips, the four pieces on the dough, a grayscale view, the baked RESULT and its ingredient list.
 * Nothing overflows horizontally. Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (video, 390x844 only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ALL_IDS = RECIPES.map((r) => r.id as string);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const HERBS: [RegExp, string][] = [[/ローズマリー/, "rosemary-sprigs"], [/オレガノ/, "oregano-flakes"], [/ほうれん草/, "spinach-leaves"], [/アーティチョーク/, "artichoke-quarter"]];
const HERB_STEP = Math.max(...["rosemary", "oregano", "spinach", "artichoke"].map((id) => DISCOVERY_LADDER.steps.findIndex((s) => s.ingredientIds.includes(id)) + 1));

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

test.describe("Issue #417: rosemary / oregano / spinach / artichoke draw their dedicated SVGs", () => {
  test.setTimeout(240_000);

  test("Pizza Select thumbnails of the herb recipes draw the SVGs", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await open(page, saveJson(ALL_IDS, materialsUpTo(HERB_STEP)));
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await page.waitForSelector(".pizza-thumbnail");
    await capture(page, "01-pizza-select", testInfo.project.name);
    await hold(page, 2500);
    for (const [, visual] of HERBS) {
      const thumbs = page.locator(`.pizza-thumbnail svg.ingredient-glyph--${visual}`);
      expect(await thumbs.count(), `${visual} thumbnails`).toBeGreaterThan(0);
      // Video: walk to the first recipe card that draws this herb and hold it.
      await thumbs.first().scrollIntoViewIfNeeded();
      await hold(page, 2500);
    }
    await noOverflow(page, "pizza select");
    expect(errors).toEqual([]);
  });

  test("Free Cooking: chips, pieces, grayscale, baked RESULT and the ingredient list", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    await open(page, saveJson(ALL_IDS, materialsUpTo(HERB_STEP)));
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await hold(page);
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await hold(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    await (await chipOnTrayOrPin(page, /モッツァレラ/)).click();
    await tapDoughPercent(page, 50, 52);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    let spot = 0;
    for (const [name, visual] of HERBS) {
      const chip = await chipOnTrayOrPin(page, name);
      await chip.scrollIntoViewIfNeeded();
      await expect(page.locator(".ingredient-chip").filter({ hasText: name }).locator(`svg.ingredient-glyph--${visual}`)).toHaveCount(1);
      await hold(page, 1500);
      await chip.click();
      for (let i = 0; i < 2; i += 1) {
        await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
        await hold(page, 900);
      }
    }
    for (const [, visual] of HERBS) expect(await page.locator(`.pizza-stage svg.ingredient-glyph--${visual}`).count(), `${visual} pieces`).toBeGreaterThan(0);
    await noOverflow(page, "topped");
    await capture(page, "02-topped", project);
    await hold(page, 2500);
    const gray = await page.addStyleTag({ content: ".pizza-stage, .ingredient-tray { filter: grayscale(1) !important; }" });
    await capture(page, "03-topped-grayscale", project);
    await hold(page, 1500);
    await gray.evaluate((el) => el.remove());
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");
    const used = page.getByRole("list", { name: "使った材料" });
    for (const [, visual] of HERBS) await expect(used.locator(`svg.ingredient-glyph--${visual}`)).toHaveCount(1);
    await noOverflow(page, "result");
    await capture(page, "04-baked-result", project);
    await hold(page, 3000);
    await used.scrollIntoViewIfNeeded();
    await hold(page, 3000);
    expect(errors).toEqual([]);
  });
});
