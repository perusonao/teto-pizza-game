import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Issue #758 HV E2E: the shiso leaf (`shiso-leaf`) is drawn in a 1.35em box (was the shared 1.2em; same value and method as the
 * whitebait school, #739) with a -0.175em margin, so its layout box stays 1em. Rendering only: no id, size class, recipe, score or save change.
 * Checked at 390x844 and 360x800 everywhere the glyph is drawn in play:
 *  - the tray chip (the chip keeps its size; the glyph stays inside the chip), the pizza before the bake, the RESULT pizza;
 *  - next to the whitebait (the recipe layout of ume-shiso-pizza: no overlap; a dense layout right beside the fish: measured);
 *  - the Shop row, the Dex card ingredient pill, the Hint sheet chip;
 *  - the POST_BAKE garnish of tarako-cream-pizza (FINISH, `.pizza-post-layer`).
 * The box ratio is read from the DOM (width / font-size). `SHISO_EXPECT_EM` (default 1.35) lets the same spec record the before state on main.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots + measured sizes as JSON), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ALL_IDS = RECIPES.map((r) => r.id as string);
const EXPECT_EM = Number(process.env.SHISO_EXPECT_EM ?? "1.35");
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const stepOf = (id: string) => DISCOVERY_LADDER.steps.findIndex((s) => s.ingredientIds.includes(id)) + 1;

const saveJson = (discovered: readonly string[], owned: readonly string[], hintFacts: Record<string, string[]> = {}) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: [...owned],
    discoveryHintFacts: hintFacts,
  });

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
const measured: Record<string, unknown> = {};
async function capture(page: Page, name: string, project: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/issue758-${name}-${project}.png` });
}
function flush(project: string, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/issue758-${name}-${project}.json`, JSON.stringify(measured, null, 1));
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

interface Box { w: number; h: number; font: number; ratio: number; x: number; y: number }
/** Every shiso glyph under `scope`: its drawn box, its font-size and the ratio (the em box). */
async function shisoBoxes(page: Page, scope: string): Promise<Box[]> {
  return page.evaluate((sel) => [...document.querySelectorAll(`${sel} .ingredient-glyph--shiso-leaf`)].map((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    const font = parseFloat(cs.fontSize);
    // The em box from the computed width (transforms on the piece wrappers -- rotation, the RESULT scale -- do not change it); `w` / `h` are the drawn,
    // axis-aligned box on screen (a rotated piece reads a little larger).
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), font: +font.toFixed(2), ratio: +(parseFloat(cs.width) / font).toFixed(3), x: +r.x.toFixed(1), y: +r.y.toFixed(1) };
  }), scope);
}
async function expectEm(page: Page, scope: string, where: string, count?: number) {
  await settle(page);
  const boxes = await shisoBoxes(page, scope);
  if (count !== undefined) expect(boxes.length, `${where}: shiso glyph count`).toBe(count);
  else expect(boxes.length, `${where}: shiso glyph present`).toBeGreaterThan(0);
  for (const b of boxes) expect(Math.abs(b.ratio - EXPECT_EM), `${where}: shiso em box (drawn ${b.w}px, font ${b.font}px)`).toBeLessThan(0.02);
  measured[where] = boxes;
  return boxes;
}
/** Lets the last placed piece finish its landing animation (a transient scale), so the drawn box and the overlap read the resting state. */
const settle = (page: Page) => page.waitForTimeout(900);
/** The largest share of a shiso glyph's box covered by another on-pizza piece's glyph box. */
async function shisoOverlap(page: Page) {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll(".pizza-stage .ingredient-glyph")];
    return all.filter((e) => e.classList.contains("ingredient-glyph--shiso-leaf")).map((s) => {
      const a = s.getBoundingClientRect();
      let best = 0;
      for (const o of all) {
        if (o === s || o.classList.contains("ingredient-glyph--shiso-leaf")) continue;
        const b = o.getBoundingClientRect();
        const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        best = Math.max(best, (ix * iy) / (a.width * a.height));
      }
      return +best.toFixed(3);
    });
  });
}
/** The tray chip keeps its size, and the shiso glyph stays inside the chip. */
async function expectChip(page: Page) {
  const chip = await chipOnTrayOrPin(page, /大葉/);
  const c = await chip.boundingBox();
  const g = await chip.locator(".ingredient-glyph--shiso-leaf").boundingBox();
  expect(c && g, "tray chip + glyph").toBeTruthy();
  expect(Math.round(c!.height), "chip height").toBe(64);
  // The chip width follows the viewport (118 at 390, 108 at 360), on every project (Chromium iphone-* and WebKit webkit-*).
  expect(Math.round(c!.width), "chip width").toBe(page.viewportSize()!.width <= 360 ? 108 : 118);
  expect(g!.x >= c!.x && g!.y >= c!.y && g!.x + g!.width <= c!.x + c!.width && g!.y + g!.height <= c!.y + c!.height, "glyph inside chip").toBe(true);
  measured["tray chip"] = { chip: [c!.width, c!.height], glyph: [g!.width, g!.height] };
}

test.describe("Issue #758: the shiso leaf in a 1.35em box", () => {
  test.setTimeout(300_000);

  test("ume-shiso-pizza: Shop, Dex, Hint, tray chip, on the pizza next to the whitebait, RESULT", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && !new URL(m.location().url || "http://x/").pathname.endsWith("/favicon.ico") && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const step = stepOf("umeboshi-paste");
    const discovered = ALL_IDS.filter((id) => id !== "ume-shiso-pizza");
    // A legacy hint fact for the target names shiso in the Hint sheet's archive chips (the M3 legacy path; the ladder itself is unchanged).
    await open(page, saveJson(discovered, [...materialsUpTo(step - 1), "umeboshi-paste"], { "ume-shiso-pizza": ["ing:shiso"] }));
    await hold(page);

    // Shop: the shiso row.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const row = page.locator('.shop-item[data-ingredient-id="shiso"]');
    await row.scrollIntoViewIfNeeded();
    await expectEm(page, '.shop-item[data-ingredient-id="shiso"]', "shop row", 1);
    await noOverflow(page, "shop");
    await capture(page, "shop", project);
    await hold(page, 2000);
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();

    // Dex: the shirasu-pizza card's ingredient pill.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    const card = page.locator(".dex-card").filter({ hasText: "しらすピザ" });
    await expect(card).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    const pill = await expectEm(page, ".dex-card", "dex card pill");
    await noOverflow(page, "dex");
    await capture(page, "dex", project);
    await hold(page, 2000);
    expect(pill.length).toBeGreaterThan(0);

    // Research the target; the Hint sheet's archive chip names shiso.
    await page.getByRole("button", { name: /^？？？ピザ（梅肉）を研究する$/ }).click();
    await page.waitForSelector(".pizza-stage");
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    const hint = page.getByRole("dialog", { name: /ヒント/ });
    await expect(hint).toBeVisible();
    await expect(hint.locator(".hint-sheet__legacy")).toContainText("大葉");
    await expectEm(page, ".hint-sheet__legacy", "hint chip", 1);
    await expectNoUndiscoveredIdentity(page, discovered, "hint sheet");
    await capture(page, "hint", project);
    await hold(page, 2000);
    await hint.getByRole("button", { name: "閉じる" }).click();
    await expect(hint).toHaveCount(0);

    // Cooking: sauce, cheese, then the topping tray.
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await (await chipOnTrayOrPin(page, /梅肉/)).click();
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await (await chipOnTrayOrPin(page, /モッツァレラ/)).click();
    await tapDoughPercent(page, ...SPOTS[0]);
    await tapDoughPercent(page, ...SPOTS[1]);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await expectChip(page);
    await noOverflow(page, "tray");
    await capture(page, "tray", project);
    await hold(page, 2000);

    // The recipe layout (whitebait 4, shiso 2): the leaves do not overlap the fish.
    await (await chipOnTrayOrPin(page, /しらす/)).click();
    for (const s of [2, 3, 4, 5]) await tapDoughPercent(page, ...SPOTS[s]);
    await (await chipOnTrayOrPin(page, /大葉/)).click();
    for (const s of [6, 7]) await tapDoughPercent(page, ...SPOTS[s]);
    await expectEm(page, ".pizza-stage", "on the pizza", 2);
    const overlap = await shisoOverlap(page);
    measured["overlap (recipe layout)"] = overlap;
    expect(Math.max(...overlap), "recipe layout: shiso vs whitebait/mozzarella glyph boxes").toBe(0);
    await noOverflow(page, "topped");
    await capture(page, "topped", project);
    await hold(page, 2400);

    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");
    await expect(page.locator(".result-panel--discovery")).toContainText("梅しそピザ");
    await expectEm(page, ".pizza-stage", "RESULT pizza", 2);
    await noOverflow(page, "RESULT");
    await capture(page, "result", project);
    await hold(page, 3000);
    flush(project, "ume");
    expect(errors).toEqual([]);
  });

  test("dense layout: shiso placed right beside the whitebait (measured; the leaves keep their 1.35em box)", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const step = stepOf("umeboshi-paste");
    await open(page, saveJson(ALL_IDS.filter((id) => id !== "ume-shiso-pizza"), [...materialsUpTo(step - 1), "umeboshi-paste"]));
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await page.getByRole("button", { name: /^？？？ピザ（梅肉）を研究する$/ }).click();
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await (await chipOnTrayOrPin(page, /梅肉/)).click();
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await (await chipOnTrayOrPin(page, /モッツァレラ/)).click();
    await tapDoughPercent(page, ...SPOTS[0]);
    await tapDoughPercent(page, ...SPOTS[1]);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await (await chipOnTrayOrPin(page, /しらす/)).click();
    for (const s of [[40, 40], [60, 40], [40, 60], [60, 60]] as [number, number][]) await tapDoughPercent(page, ...s);
    await (await chipOnTrayOrPin(page, /大葉/)).click();
    for (const s of [[50, 40], [50, 60], [40, 50], [60, 50]] as [number, number][]) await tapDoughPercent(page, ...s);
    await expectEm(page, ".pizza-stage", "dense on the pizza", 4);
    measured["overlap (dense, before bake)"] = await shisoOverlap(page);
    await capture(page, "dense-topped", project);
    await hold(page, 2400);
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");
    await expectEm(page, ".pizza-stage", "dense RESULT", 4);
    measured["overlap (dense, RESULT)"] = await shisoOverlap(page);
    await capture(page, "dense-result", project);
    await hold(page, 2400);
    flush(project, "dense");
  });

  test("tarako-cream-pizza: shiso as a POST_BAKE garnish in FINISH (the post layer) and on the RESULT pizza", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const discovered = ALL_IDS.filter((id) => id !== "tarako-cream-pizza");
    await open(page, saveJson(discovered, materialsUpTo(stepOf("nori"))));
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（のり）を研究する$/ }).click();
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await (await chipOnTrayOrPin(page, /クリームソース/)).click();
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await (await chipOnTrayOrPin(page, /モッツァレラ/)).click();
    await tapDoughPercent(page, ...SPOTS[0]);
    await tapDoughPercent(page, ...SPOTS[1]);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await bakeToTarget(page, { start: 60, end: 76 }, { finish: false });
    await expect(page.getByTestId("finish-dock")).toBeVisible();
    let k = 2;
    for (const [chip, n] of [[/たらこ/, 2], [/のり/, 1], [/大葉/, 1]] as [RegExp, number][]) {
      await (await chipOnTrayOrPin(page, chip)).click();
      for (let i = 0; i < n; i += 1) await tapDoughPercent(page, ...SPOTS[k++ % SPOTS.length]);
    }
    await expectEm(page, ".pizza-post-layer", "FINISH post layer", 1);
    await noOverflow(page, "finish");
    await capture(page, "finish-garnish", project);
    await hold(page, 2400);
    await page.getByTestId("finish-complete").click();
    await page.waitForSelector(".result-panel");
    await expect(page.locator(".result-panel--discovery")).toContainText("たらこクリームピザ");
    await expectEm(page, ".pizza-stage", "post-bake RESULT", 1);
    await capture(page, "finish-result", project);
    await hold(page, 3000);
    flush(project, "tarako");
  });
});
