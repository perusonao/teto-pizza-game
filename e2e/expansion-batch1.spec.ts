import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { RECIPES } from "../src/data/recipes";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { startTargetlessFreeCook } from "./support/startFreeCook";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Expansion Batch 1 representative E2E (baba-ganoush-pizza / prosciutto-funghi / veggie-supreme-pizza; pine-nuts 30,
 * prosciutto-crudo 31, green-pepper 32). ONE spec for the batch: the LATEST step (32, veggie-supreme-pizza) is played end to
 * end -- Shop NEW, purchase, Research (no identity leak), cooking on the All-Owned Tray, NEW DISCOVERY, Dex. The other two
 * recipes are covered by the Batch Validator and focused unit tests (recipeBatch.validator.test.ts and friends).
 *
 * Save: every other recipe found (35 of 36), every material up to step 31 owned and stocked, 999 Pitz; step 32 is reached, so
 * `green-pepper` is entitled but not bought. Only the starting save is seeded.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ID = "veggie-supreme-pizza";
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

test.describe("Expansion Batch 1 (representative: step 32, veggie-supreme-pizza)", () => {
  test.setTimeout(300_000);

  test("Shop NEW green-pepper -> purchase -> Research (no leak) -> cook on the All-Owned Tray -> NEW DISCOVERY -> Dex", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    await open(page, saveJson());
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${DISCOVERED.length}/${CATALOG_COUNTS.recipes}`));
    await hold(page);

    // 1. Shop: green-pepper 🌶️ ピーマン is NEW (first T4 band: 120 Pitz, 20 pieces) and visibly not the owned bell-pepper 🫑 パプリカ.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const pepper = page.locator('.shop-item[data-ingredient-id="green-pepper"]');
    await expect(pepper).toHaveCount(1);
    await expect(pepper).toHaveAttribute("data-shop-state", "NEW");
    await expect(pepper).toContainText("ピーマン");
    await expect(pepper).toContainText("🌶️");
    await expect(pepper).not.toContainText("🫑");
    await expect(pepper).toContainText("10ピザ分（20個）");
    await expect(pepper).toContainText(/初回 .*120 Pitz/);
    const bell = page.locator('.shop-item[data-ingredient-id="bell-pepper"]');
    if (await bell.count()) {
      await expect(bell).toContainText("パプリカ");
      await expect(bell).toContainText("🫑");
      await expect(bell).not.toContainText("🌶️");
    }
    await pepper.scrollIntoViewIfNeeded();
    await noOverflow(page, "shop NEW green-pepper");
    await capture(page, "batch1-shop-green-pepper-new", project);
    await hold(page, 2200);
    await pepper.locator(".shop-item__buy-button").click();
    await expect(pepper).not.toHaveAttribute("data-shop-state", "NEW");
    await expect(pepper).toContainText("在庫 20");
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the single Research Entry: only the unlock ingredient is named; the recipe's name / id / No. never reach the DOM.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    const entry = page.locator(".dex-overlay__research .dex-research-card");
    await expect(entry).toHaveCount(1);
    await expect(page.locator(".dex-overlay__research")).toContainText("？？？ピザ（ピーマン）");
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Dex Research Entry");
    await noOverflow(page, "Dex Research Entry");
    await capture(page, "batch1-research-entry", project);
    await hold(page, 2000);
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（ピーマン）を研究する$/ }).click();
    await expectResearchLead(page, "？？？ピザ");
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Research PREPARE");

    // 3. Cooking: tomato sauce 1 / mozzarella 2 / black-olive 1 / tomato 1 / mushroom 1 / onion 1 / green-pepper 2. Every chip comes
    //    straight off the All-Owned Tray (no pantry, no pin); the new material is there with its glyph and its Family.
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    let spot = 0;
    await page.locator(".ingredient-chip").filter({ hasText: /モッツァレラ/ }).first().click();
    for (let i = 0; i < 2; i += 1) await tapDoughPercent(page, ...SPOTS[spot++]);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    const greenChip = await chipOnTrayOrPin(page, /ピーマン/);
    await expect(greenChip).toContainText("🌶️");
    await expect(greenChip).not.toContainText("🫑");
    await capture(page, "batch1-tray-green-pepper", project);
    const cook: [RegExp, number][] = [[/ブラックオリーブ/, 1], [/^(?!.*チェリー)(?!.*ソース).*トマト/, 1], [/マッシュルーム/, 1], [/たまねぎ/, 1], [/ピーマン/, 2]];
    for (const [name, count] of cook) {
      const chip = await chipOnTrayOrPin(page, name);
      await chip.click();
      for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
    }
    await bakeToTarget(page, { start: 50, end: 70 });
    await page.waitForSelector(".result-panel");

    // 4. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ベジースプリームピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "batch1-new-recipe", project);
    await hold(page, 3000);

    // 5. Dex: complete; the first T4 recipes open Chapter 4 (3 slots); schema v2 unchanged.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "ベジースプリームピザ" });
    await expect(card).toHaveCount(1);
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: `第${CATALOG_COUNTS.chapterSizes.length}章` })).toContainText(`${last}/${last}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "batch1-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(ID);
    expect(errors).toEqual([]);
  });

  // Records the CURRENT Hint behavior of veggie-supreme-pizza (the first recipe with 5 purchasable facts). Not an Owner-approved
  // specification: the Hint 5.0 ladder is the production default; the Selectable fact path (the one the 75 Pitz cap belongs to) is
  // the rollback path, reached here through the DEV opt-out key. Both are read off the real sheet.
  test("veggie-supreme Hint: current Selectable price progression is recorded (rollback path, not an approved spec)", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await open(page, saveJson([...OWNED_BEFORE, "green-pepper"]), { "teto.dev.hint5Ladder": "0" });
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    for (let i = 0; i < 3; i += 1) {
      const next = bar(page).getByRole("button", { name: /次へ/ });
      if (!(await next.count())) break;
      await next.click();
    }
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    const sheet = page.getByRole("dialog", { name: /ヒント/ });
    await expect(sheet).toBeVisible();
    const cta = sheet.locator('.hint-sheet__card[data-hint-family="material"] .hint-sheet__next');
    const entry = sheet.getByRole("button", { name: "ヒントをもらう" });
    const seen: string[] = [];
    // Read the 材料 CTA label before each ask (like a player: 「ヒントをもらう」 -> 「たずねる」), until nothing is left to sell.
    for (let i = 0; i < 8; i += 1) {
      if (await entry.count()) {
        await expect(entry).not.toHaveAttribute("aria-disabled", "true");
        await entry.click();
      }
      if (!(await cta.count())) break;
      await expect(cta).not.toHaveAttribute("aria-disabled", "true");
      seen.push(((await cta.innerText()) ?? "").replace(/\s+/g, " ").trim());
      if (i === 0) await capture(page, "batch1-hint-first-cta", project);
      await cta.click();
      await page.waitForTimeout(450);
    }
    testInfo.annotations.push({ type: "veggie-supreme-selectable-hint-ctas", description: JSON.stringify(seen) });
    console.log(`VEGGIE_HINT_CTAS ${JSON.stringify(seen)}`);
    await capture(page, "batch1-hint-last", project);
    expect(seen.length).toBeGreaterThan(0);
  });
});
