import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Batch 8b representative E2E (step 54: shiso + whitebait -> shirasu-pizza, NO_SAUCE; no star gate, OD-B8-1). The LATEST step played end to end: Shop NEW for both materials, purchase, Research
 * (the label names only the cohort key, whitebait; no identity leak), cooking on the All-Owned Tray with no sauce step, NEW DISCOVERY, Dex. The save does not list the new step's materials as unlocked: the app's load-time entitlement must grant them. Only the starting save is seeded; the tray helper
 * (`chipOnTrayOrPin`) pages through the tray, so the growing catalog never hides a chip on page 2+.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const SHIRASU = "shirasu-pizza";
const LAST_STEP = 54; // Batch 8b's own last step (shiso + whitebait); the ladder has grown since (New Sauces Phase A: step 55)
const ALL_IDS = RECIPES.map((r) => r.id as string);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];

const saveJson = (discovered: readonly string[], owned: readonly string[], extraStock: Record<string, number> = {}) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: { ...Object.fromEntries(owned.map((m) => [m, 30])), ...extraStock },
    starterGrantClaimedRecipeIds: [],
    // The new steps' materials are deliberately NOT listed: load-time entitlement (the ladder) must grant them.
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

async function buyNew(page: Page, project: string, id: string, visual: string, nameJa: string, pack: string, shot: string) {
  const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-shop-state", "NEW");
  await expect(row).toContainText(nameJa);
  // The dedicated art (PR #580 Owner Decision), never an emoji: the glyph slot draws the SVG and shows no emoji text.
  await expect(row.locator(`svg[data-ingredient-visual="${visual}"]`)).toHaveCount(1);
  await expect(row.locator(".shop-item__emoji")).toHaveText(""); // the glyph slot holds the SVG only (the unique text fallback is never shown)
  await expect(row).toContainText(pack);
  await expect(row).toContainText(/初回 .*120 Pitz/);
  await noOverflow(page, `shop NEW ${id}`);
  await capture(page, `${shot}-new`, project);
  await hold(page, 2200);
  await row.locator(".shop-item__buy-button").click();
  await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
}

async function openResearch(page: Page, label: string, discovered: readonly string[], project: string, shot: string) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await expect(page.locator(".dex-overlay__research")).toContainText(label);
  await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
  await noOverflow(page, "Dex Research Entry");
  await capture(page, `${shot}-research-entry`, project);
  await hold(page, 2000);
  await page.locator(".dex-overlay__research").getByRole("button", { name: new RegExp(`^${label}を研究する$`) }).click();
  await expectResearchLead(page, "？？？ピザ");
  await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");
}

async function place(page: Page, picks: [RegExp, number][], startSpot: number) {
  let spot = startSpot;
  for (const [name, count] of picks) {
    await (await chipOnTrayOrPin(page, name)).click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  return spot;
}

test.describe("Batch 8b (representative: step 54 shirasu-pizza NO_SAUCE; shiso + whitebait)", () => {
  test.setTimeout(300_000);

  test("step 54: Shop NEW shiso + whitebait -> purchase -> Research (no leak) -> cook with no sauce on the All-Owned Tray -> NEW DISCOVERY -> Dex", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const discovered = ALL_IDS.filter((id) => id !== SHIRASU);
    await open(page, saveJson(discovered, materialsUpTo(LAST_STEP - 1)));
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
    await hold(page);

    // 1. Shop: both step-54 materials are NEW (T4: 120 Pitz each, no star gate). Packs: shiso k=1 -> 10 pieces, whitebait k=3 -> 30.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    await buyNew(page, project, "shiso", "shiso-leaf", "大葉", "10ピザ分（10個）", "batch8b-shiso");
    await buyNew(page, project, "whitebait", "whitebait-school", "しらす", "10ピザ分（30個）", "batch8b-whitebait");
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the single Research Entry: only the cohort key (whitebait, the last material of step 54) is named.
    await openResearch(page, "？？？ピザ（しらす）", discovered, project, "batch8b-shirasu");

    // 3. Cooking: mozzarella 2 / lemon 2 / shiso 1 / whitebait 3, NO sauce (a Research round is recipe-free: the player simply skips the sauce step).
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    let spot = await place(page, [[/モッツァレラ/, 2]], 0);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await expect((await chipOnTrayOrPin(page, /大葉/)).locator('svg[data-ingredient-visual="shiso-leaf"]')).toHaveCount(1);
    await expect((await chipOnTrayOrPin(page, /しらす/)).locator('svg[data-ingredient-visual="whitebait-school"]')).toHaveCount(1);
    await capture(page, "batch8b-tray-shirasu", project);
    spot = await place(page, [[/レモン/, 2], [/大葉/, 1], [/しらす/, 3]], spot);
    // Free Cooking judges the bake on the generic window (58-78), which is also the recipe's own window (see recipes.ts): aim inside both.
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");

    // 4. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("しらすピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "batch8b-new-recipe-shirasu", project);
    await hold(page, 3000);

    // 5. Dex: complete; Batch 8b's recipe extends Chapter 4; schema v2 unchanged.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "しらすピザ" });
    await expect(card).toHaveCount(1);
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: `第${CATALOG_COUNTS.chapterSizes.length}章` })).toContainText(`${last}/${last}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "batch8b-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(SHIRASU);
    expect(errors).toEqual([]);
  });
});
