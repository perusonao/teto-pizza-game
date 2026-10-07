import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { RECIPES } from "../src/data/recipes";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Expansion Batch 4 representative E2E (steps 44-47: catupiry 44, jalapeno 45, feta 46, sardine 47). ONE spec for the batch: the LATEST step
 * (47, pizza-moscow: sardine, NO_SAUCE) is played end to end -- Shop NEW, purchase, Research (no identity leak), cooking on the All-Owned Tray
 * with NO sauce step, NEW DISCOVERY, Dex. The other three recipes are covered by the Batch Validator, the NO_SAUCE / sauce-profile contract
 * tests and focused unit tests.
 *
 * Save: every other recipe found, every material up to step 46 owned and stocked, 999 Pitz; step 47 is reached, so its material is entitled
 * but not bought. Only the starting save is seeded. The tray helper (`chipOnTrayOrPin`) pages through the tray, so the growing catalog never
 * hides a chip on page 2+.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ID = "pizza-moscow";
const LAST_STEP = DISCOVERY_LADDER.steps.length;
const DISCOVERED = RECIPES.map((r) => r.id as string).filter((id) => id !== ID);
const OWNED_BEFORE = materialsUpTo(LAST_STEP - 1);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];

const saveJson = (owned: readonly string[] = OWNED_BEFORE, extraStock: Record<string, number> = {}) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: DISCOVERED.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: { ...Object.fromEntries(owned.map((m) => [m, 30])), ...extraStock },
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materialsUpTo(LAST_STEP),
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
async function open(page: Page, json: string, devKeys: Record<string, string> = {}) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value, dev]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    for (const [k, v] of Object.entries(dev)) localStorage.setItem(k, v);
  }, [SAVE_KEY, json, devKeys] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

test.describe("Expansion Batch 4 (representative: step 47, pizza-moscow, NO_SAUCE)", () => {
  test.setTimeout(300_000);

  test("Shop NEW sardine -> purchase -> Research (no leak) -> cook with no sauce step on the All-Owned Tray -> NEW DISCOVERY -> Dex", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    await open(page, saveJson());
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${DISCOVERED.length}/${CATALOG_COUNTS.recipes}`));
    await hold(page);

    // 1. Shop: the step-47 material is NEW (T4: 120 Pitz) with its own glyph.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const item = (id: string) => page.locator(`.shop-item[data-ingredient-id="${id}"]`);
    await item("sardine").scrollIntoViewIfNeeded();
    await expect(item("sardine")).toHaveCount(1);
    await expect(item("sardine")).toHaveAttribute("data-shop-state", "NEW");
    await expect(item("sardine")).toContainText("イワシ");
    await expect(item("sardine")).toContainText("🎏");
    await expect(item("sardine")).toContainText("10ピザ分（20個）");
    await expect(item("sardine")).toContainText(/初回 .*120 Pitz/);
    await noOverflow(page, "shop NEW step 47");
    await capture(page, "batch4-shop-step47-new", project);
    await hold(page, 2200);
    await item("sardine").locator(".shop-item__buy-button").click();
    await expect(item("sardine")).not.toHaveAttribute("data-shop-state", "NEW");
    await expect(item("sardine")).toContainText("在庫 20");
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the single Research Entry: only the unlock ingredient is named; the recipe's name / id / No. never reach the DOM.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    const entry = page.locator(".dex-overlay__research .dex-research-card");
    await expect(entry).toHaveCount(1);
    await expect(page.locator(".dex-overlay__research")).toContainText("？？？ピザ（イワシ）");
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Dex Research Entry");
    await noOverflow(page, "Dex Research Entry");
    await capture(page, "batch4-research-entry", project);
    await hold(page, 2000);
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（イワシ）を研究する$/ }).click();
    await expectResearchLead(page, "？？？ピザ");
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Research PREPARE");

    // 3. Cooking: mozzarella 2 / onion 1 / salmon 1 / sardine 2 / tuna 2, NO sauce. A Research round is recipe-free (the step strip is the same for every
    // target, so it never reveals that this recipe has no sauce step): the player simply skips the sauce step. Every chip comes straight off
    // the All-Owned Tray (paged: the helper looks through every page).
    await page.waitForSelector(".pizza-stage");
    await expect(page.getByRole("tab", { name: "ソース" })).toHaveCount(1);
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await bar(page).getByRole("button", { name: /次へ/ }).click(); // no sauce: straight on to the cheese
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    let spot = 0;
    await (await chipOnTrayOrPin(page, /モッツァレラ/)).click();
    for (let i = 0; i < 2; i += 1) await tapDoughPercent(page, ...SPOTS[spot++]);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible(); // the tab switch re-pages the tray: wait for it before looking for a chip
    const sardineChip = await chipOnTrayOrPin(page, /イワシ/);
    await expect(sardineChip).toContainText("🎏");
    await capture(page, "batch4-tray-sardine", project);
    const cook: [RegExp, number][] = [[/たまねぎ/, 1], [/サーモン/, 1], [/イワシ/, 2], [/ツナ/, 2]];
    for (const [name, count] of cook) {
      const chip = await chipOnTrayOrPin(page, name);
      await chip.click();
      for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
    }
    await bakeToTarget(page, { start: 60, end: 80 });
    await page.waitForSelector(".result-panel");

    // 4. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ピッツァ・モスクワ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "batch4-new-recipe", project);
    await hold(page, 3000);

    // 5. Dex: complete; Batch 4's recipes extend Chapter 4; schema v2 unchanged.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "ピッツァ・モスクワ" });
    await expect(card).toHaveCount(1);
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: `第${CATALOG_COUNTS.chapterSizes.length}章` })).toContainText(`${last}/${last}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "batch4-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(ID);
    expect(errors).toEqual([]);
  });
});
