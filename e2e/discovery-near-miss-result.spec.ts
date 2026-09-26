import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { PROFILES, ProfileDriver, readViewport, type Profile } from "./support/layoutProfiles";
import { runOnlyOnWidth } from "./support/projectGuard";

/**
 * Discovery Hint 2.0 (Issue #229, 229-C): the Free Cooking RESULT's "おしい" row, played for real
 * (dough -> sauce -> cheese -> toppings -> bake) on a Dex 3 ladder save, where funghi (tomato
 * sauce, mozzarella, mushroom) is the one DISCOVERABLE recipe.
 *
 * Each result is measured at 390x844, 360x800, the short 360x640 and (Chromium) the 390x664
 * safe-area profile: no horizontal overflow, the primary CTA fully on screen above the bottom
 * inset, and no recipe name on screen. 「💡 ヒントを見る」 then opens Free Cooking with the hint
 * sheet. Profiles are forced per state, so this runs once per engine (the *-390x844 project).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const DEX3_SAVE = {
  schemaVersion: 2,
  dex: ["margherita", "bismarck", "breakfast-pizza"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg", "bacon", "mushroom"],
  missionBest: {},
  inventory: { egg: 30, bacon: 30, mushroom: 30 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: ["egg", "bacon", "mushroom"],
};
const UNDISCOVERED = ["フンギ", "メランザーネピザ", "パルミジャーナピザ"];

async function openWithSave(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(DEX3_SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/3\/25/);
}

const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function place(page: Page, name: RegExp, spots: [number, number][]) {
  await page.locator(".ingredient-chip").filter({ hasText: name }).first().click();
  for (const [x, y] of spots) await tapDoughPercent(page, x, y);
}

/** One Free Cooking round with tomato sauce plus `pieces`, baked on target, to its RESULT. */
async function cookFree(page: Page, pieces: { cheese: [RegExp, number][]; toppings: [RegExp, number][]; sauceDab?: boolean }) {
  await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  if (pieces.sauceDab) await tapDoughPercent(page, 50, 50);
  else await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  const spots: [number, number][] = [[40, 50], [60, 50], [50, 32], [50, 66], [34, 38], [66, 62]];
  let s = 0;
  for (const [name, n] of pieces.cheese) await place(page, name, spots.slice(s, (s += n)));
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  for (const [name, n] of pieces.toppings) await place(page, name, spots.slice(s % 6, (s % 6) + n)), (s += n);
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

function profilesFor(browserName: string): Profile[] {
  return browserName === "chromium"
    ? [PROFILES.N390, PROFILES.N360, PROFILES.S360, PROFILES.E390i]
    : [PROFILES.N390, PROFILES.N360, PROFILES.S360];
}

async function checkResult(page: Page, driver: ProfileDriver, browserName: string, label: string) {
  for (const profile of profilesFor(browserName)) {
    await driver.apply(profile);
    const vp = await readViewport(page);
    const m = await page.evaluate(() => {
      const cta = document.querySelector(".result-panel__actions .cta-button--primary")!.getBoundingClientRect();
      return { scrollWidth: document.documentElement.scrollWidth, cta: { top: cta.top, bottom: cta.bottom } };
    });
    const where = `${label} @${profile.id}`;
    expect.soft(m.scrollWidth, `${where}: horizontal overflow`).toBeLessThanOrEqual(vp.innerWidth);
    expect.soft(m.cta.top, `${where}: primary CTA on screen`).toBeGreaterThanOrEqual(0);
    expect.soft(m.cta.bottom, `${where}: primary CTA above the bottom inset`).toBeLessThanOrEqual(vp.innerHeight - vp.sab + 0.5);
  }
  await driver.apply(PROFILES.N390);
  const text = (await page.locator(".result-panel").textContent()) ?? "";
  for (const name of UNDISCOVERED) expect(text, `${label}: ${name}`).not.toContain(name);
}

async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test.describe("Discovery Hint 2.0 near-miss RESULT (229-C)", () => {
  test.beforeEach(() => runOnlyOnWidth(test.info(), 390));

  for (const [name, pieces, text, shot] of [
    ["ADD_ONE", { cheese: [[/モッツァレラ/, 3]], toppings: [] }, /材料をあと1つ足すと/, "c1-add-one"],
    ["REMOVE_ONE", { cheese: [[/モッツァレラ/, 2]], toppings: [[/マッシュルーム/, 3], [/バジル/, 1]] }, /材料を1つ減らすと/, "c2-remove-one"],
    ["CLOSE", { cheese: [[/モッツァレラ/, 2]], toppings: [[/マッシュルーム/, 2], [/バジル/, 1], [/たまご/, 1]] }, /かなり近づいてるよ/, "c3-close"],
  ] as const) {
    test(`ORIGINAL ${name}: one secondary line + hint CTA, CTA bar on screen`, async ({ page, browserName }) => {
      const driver = await ProfileDriver.create(page, browserName);
      await driver.apply(PROFILES.N390);
      await openWithSave(page);
      await cookFree(page, pieces as never);
      await expect(page.locator(".result-panel--original")).toBeVisible();
      await expect(page.locator(".result-near-miss__text")).toHaveText(text);
      await checkResult(page, driver, browserName, name);
      await capture(page, shot);
    });
  }

  test("INCOMPLETE_MATCH wording, then 「💡 ヒントを見る」 opens Free Cooking with the hint sheet", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page);
    // The exact funghi set with a single sauce dab: the set matches, funghi's own sauce-amount
    // check does not (Free Cooking itself never checks the sauce amount).
    await cookFree(page, { cheese: [[/モッツァレラ/, 2]], toppings: [[/マッシュルーム/, 3]], sauceDab: true });
    await expect(page.locator(".original-pizza__lead")).toHaveText("図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。");
    await checkResult(page, driver, browserName, "INCOMPLETE_MATCH");
    await capture(page, "c4-incomplete-match");

    await page.getByRole("button", { name: /ヒントを見る/ }).click();
    const sheet = page.getByRole("dialog", { name: /ヒント/ });
    await expect(sheet).toBeVisible();
    await expect(page.locator(".order-card--free-cook")).toBeVisible();
    await expect(sheet.locator(".hint-sheet__step")).toHaveCount(1);
    await expect(sheet).not.toContainText("フンギ");
    await capture(page, "c5-hint-cta-sheet");
    await sheet.getByRole("button", { name: "閉じる" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator(".pizza-stage")).toBeVisible();
  });
});
