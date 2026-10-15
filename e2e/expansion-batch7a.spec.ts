import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { RECIPES } from "../src/data/recipes";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Batch 7a representative E2E (steps 52-53: mint 52, lamb + sweet-potato 53). ONE spec for the batch, both recipes played end to end:
 *  - the LATEST step (53, new-zealand-lamb-pizza: NO_SAUCE): Shop NEW for both materials, purchase, Research (the label names only the cohort key, sweet-potato; no identity
 *    leak), cooking on the All-Owned Tray with no sauce step, NEW DISCOVERY, Dex;
 *  - step 52 (eggplant-ricotta-pizza: olive-oil PAINT_TEMPORARY): Shop NEW mint, Research (label names only mint), cooking with the olive-oil sauce step, NEW DISCOVERY.
 * Neither save lists the new steps' materials as unlocked: the app's load-time entitlement must grant them. Only the starting save is seeded; the tray helper
 * (`chipOnTrayOrPin`) pages through the tray, so the growing catalog never hides a chip on page 2+.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const LAMB = "new-zealand-lamb-pizza";
const EGGPLANT = "eggplant-ricotta-pizza";
const LAST_STEP = DISCOVERY_LADDER.steps.length; // 53: lamb + sweet-potato
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

async function buyNew(page: Page, project: string, id: string, glyph: string, nameJa: string, pack: string, shot: string) {
  const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-shop-state", "NEW");
  await expect(row).toContainText(nameJa);
  await expect(row).toContainText(glyph);
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

test.describe("Batch 7a (representative: step 53 new-zealand-lamb-pizza NO_SAUCE; step 52 eggplant-ricotta-pizza olive-oil)", () => {
  test.setTimeout(300_000);

  test("step 53: Shop NEW lamb + sweet-potato -> purchase -> Research (no leak) -> cook with no sauce on the All-Owned Tray -> NEW DISCOVERY -> Dex", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const discovered = ALL_IDS.filter((id) => id !== LAMB);
    await open(page, saveJson(discovered, materialsUpTo(LAST_STEP - 1)));
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
    await hold(page);

    // 1. Shop: both step-53 materials are NEW (T4: 120 Pitz each). Packs: lamb k=3 -> 30 pieces, sweet-potato k=2 -> 20.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    await buyNew(page, project, "lamb", "🐑", "ラム", "10ピザ分（30個）", "batch7a-lamb");
    await buyNew(page, project, "sweet-potato", "🍠", "さつまいも", "10ピザ分（20個）", "batch7a-sweet-potato");
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the single Research Entry: only the cohort key (sweet-potato, the last material of step 53) is named.
    await openResearch(page, "？？？ピザ（さつまいも）", discovered, project, "batch7a-lamb");

    // 3. Cooking: mozzarella 2 / rosemary 1 / lamb 3 / sweet-potato 2, NO sauce (a Research round is recipe-free: the player simply skips the sauce step).
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    let spot = await place(page, [[/モッツァレラ/, 2]], 0);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await expect(await chipOnTrayOrPin(page, /ラム/)).toContainText("🐑");
    await expect(await chipOnTrayOrPin(page, /さつまいも/)).toContainText("🍠");
    await capture(page, "batch7a-tray-lamb", project);
    spot = await place(page, [[/ローズマリー/, 1], [/ラム/, 3], [/さつまいも/, 2]], spot);
    await bakeToTarget(page, { start: 56, end: 76 });
    await page.waitForSelector(".result-panel");

    // 4. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ニュージーランドラムピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "batch7a-new-recipe-lamb", project);
    await hold(page, 3000);

    // 5. Dex: complete; Batch 7a's recipes extend Chapter 4; schema v2 unchanged.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "ニュージーランドラムピザ" });
    await expect(card).toHaveCount(1);
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: `第${CATALOG_COUNTS.chapterSizes.length}章` })).toContainText(`${last}/${last}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "batch7a-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(LAMB);
    expect(errors).toEqual([]);
  });

  test("step 52: Shop NEW mint -> purchase -> Research (names only mint) -> cook with the olive-oil sauce step -> NEW DISCOVERY", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    // Step 53's materials are entitled by the ladder but not bought, so lamb is not researchable: exactly one Research Entry (mint's).
    const discovered = ALL_IDS.filter((id) => id !== EGGPLANT && id !== LAMB);
    await open(page, saveJson(discovered, materialsUpTo(LAST_STEP - 2)));
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    await buyNew(page, project, "mint", "🍀", "ミント", "10ピザ分（20個）", "batch7a-mint");
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    await openResearch(page, "？？？ピザ（ミント）", discovered, project, "batch7a-eggplant");

    // Cooking: olive-oil (sauce step, PAINT_TEMPORARY) / ricotta 3 / eggplant 3 / mint 2.
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await page.locator(".ingredient-chip").filter({ hasText: /オリーブオイル/ }).first().click();
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    let spot = await place(page, [[/リコッタ/, 3]], 0);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await expect(await chipOnTrayOrPin(page, /ミント/)).toContainText("🍀");
    await capture(page, "batch7a-tray-mint", project);
    spot = await place(page, [[/ナス/, 3], [/ミント/, 2]], spot);
    await bakeToTarget(page, { start: 54, end: 74 });
    await page.waitForSelector(".result-panel");
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ナスとリコッタのピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "batch7a-new-recipe-eggplant", project);
    expect(errors).toEqual([]);
  });
});
