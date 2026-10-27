import { expect, test, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectResearchLead } from "./support/hintNote";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Issue #676 C1 / C3 (Owner 2026-10-27): the FAILED card of a Free Cook round (Research or targetless) offers 「💡 ヒントを見る」 (the existing
 * handleRetryWithHint), and the targetless ORIGINAL card shows one fixed note. Both authority viewports (390x844 / 360x800 projects).
 * The hint sheet reads nothing from the failed round, so the sheet opened from FAILED and from ORIGINAL is the same one.
 * HV_SCREENSHOT_DIR (optional) writes the screenshots.
 */
const SAVE_KEY = "teto-pizza-save-v1";
const RAW_BAKE = { start: 3, end: 15 };
const JUST_BAKE = { start: 60, end: 76 };
const NOTE = "ヒントを見ながら、次に試す材料を考えてみよう。";
const OLD_NOTE = "図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。";
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds as readonly string[]);
const discovered = [...keysBefore(25), "brazilian-calabresa", "aussie", "chilean-napolitana", "grandma-pizza"];
const RESEARCH_SAVE = {
  schemaVersion: 2,
  dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}
async function noOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
}

/** Targetless Free Cook, starter trio. `bake` decides FAILED (raw) or the ORIGINAL (no basil, JUST). */
async function targetlessRound(page: Page, bake: { start: number; end: number }) {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(["tomato-sauce", "mozzarella", "basil"]));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bakeToTarget(page, bake);
  await page.waitForSelector(".result-panel");
}

async function openResearch(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(RESEARCH_SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
  await expectResearchLead(page, "？？？ピザ");
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await (await chipOnTrayOrPin(page, /ナス/)).click();
  await tapDoughPercent(page, 50, 45);
  await bakeToTarget(page, RAW_BAKE);
  await page.waitForSelector(".result-panel");
}

async function expectHintSheetFromFailed(page: Page) {
  const failed = page.locator(".result-panel--failed");
  await expect(failed).toBeVisible();
  const cta = failed.getByRole("button", { name: /ヒントを見る/ });
  await expect(cta).toHaveCount(1);
  await cta.scrollIntoViewIfNeeded();
  const retry = (await failed.getByRole("button", { name: "もう一度試す" }).boundingBox())!;
  const hint = (await cta.boundingBox())!;
  expect(hint.y + hint.height, "the hint button sits above the action buttons without touching them").toBeLessThanOrEqual(retry.y - 4);
  expect(hint.x + hint.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(hint.height).toBeGreaterThanOrEqual(32);
  await noOverflow(page, "FAILED card");
  const vertical = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(vertical, "no page-level vertical scroll caused by the new row").toBeLessThanOrEqual(1);
  await shot(page, "failed-with-hint");
  const text = await failed.innerText();
  expect(text).not.toMatch(/おしい|近い|遠い|あと\d|惜|ほぼ|\d+(種|個|件|%)/);
  await cta.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await noOverflow(page, "hint sheet");
  await shot(page, "hint-sheet");
}

test.describe("#676 C1 / C3: guidance after a failed discovery", () => {
  test.setTimeout(240_000);

  test("targetless Free Cook FAILED: 「💡 ヒントを見る」 opens the hint sheet through the existing retry-with-hint", async ({ page }) => {
    await targetlessRound(page, RAW_BAKE);
    await expectHintSheetFromFailed(page);
    // the retry-with-hint path left the failed card: a fresh PREPARE round with the sheet on top
    await expect(page.locator(".result-panel--failed")).toHaveCount(0);
  });

  test("Research FAILED (the tightest card): the hint button fits, nothing overlaps or scrolls, the sheet opens", async ({ page }) => {
    await openResearch(page);
    await expectHintSheetFromFailed(page);
  });

  test("targetless ORIGINAL: the one fixed note replaces the old Dex-match sentence, and the hint button is still there", async ({ page }) => {
    await targetlessRound(page, JUST_BAKE);
    const original = page.locator(".result-panel--original");
    await expect(original).toBeVisible();
    await expect(original.locator(".original-pizza__note")).toHaveText(NOTE);
    await expect(original).not.toContainText(OLD_NOTE);
    await expect(original.getByRole("button", { name: /ヒントを見る/ })).toHaveCount(1);
    await noOverflow(page, "ORIGINAL card");
    const vertical = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(vertical).toBeLessThanOrEqual(1);
    await shot(page, "original-note");
  });
});
