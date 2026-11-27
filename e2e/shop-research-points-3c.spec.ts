import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, completeEmptyFinishIfOffered, cutThreeLines, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { RECIPES } from "../src/data/recipes";

/**
 * B案 Phase 3c (Issue #901, Owner 2026-11-27), on the dev server under `?progression=shop`:
 * 1. HOME shows the research point balance beside Pitz (a save without the key reads 0);
 * 2. a Free Cooking trial (menu development) of a stage-2 recipe earns +2 on RESULT, with the balance and the "not yet" line;
 * 3. HOME shows the new balance, the save holds it, and a reload neither loses nor repeats it;
 * 4. the hint sheet of the next trial shows the balance and that it cannot buy a hint yet;
 * 5. a served order earns none; legacy (no parameter) shows none of it.
 *
 * `HV_VIDEO=1` records the Human Verification video, `HV_SCREENSHOT_DIR=<dir>` writes the screenshots; `HV_BEFORE=1` only captures
 * (for the `main` "before" screenshots, where the Phase 3c UI does not exist).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const MEAT = ["bacon", "ham", "pepperoni", "sausage"];
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const STRICT = !process.env.HV_BEFORE;

/** Every other recipe these materials make is already in the Dex, so 「メニュー開発」 goes straight to Free Cooking. */
const OTHERS = RECIPES.filter(
  (r) => r.id !== "meat-lovers" && r.requiredIngredients.every((x) => [...STARTERS, ...MEAT].includes(x.ingredientId)),
).map((r) => r.id);
/** Reputation 45: stage 2 (meat-lovers) is open, so the trial develops it onto the menu. No `researchPointsEarned`: reads 0. */
const save = () => ({
  schemaVersion: 2,
  dex: OTHERS.map((recipeId) => ({ recipeId, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 })),
  pitzBalance: 0,
  ownedIngredientIds: [...STARTERS, ...MEAT],
  missionBest: {},
  // One meat-lovers' worth, and a second one for the hint-sheet trial.
  inventory: { bacon: 4, ham: 2, pepperoni: 2, sausage: 4 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: [...MEAT],
  shopProgress: { reputation: 45, grantedMenuRecipeIds: [] },
});

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}
async function open(page: Page, query: string, json: object) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(json)] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
}
const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function place(page: Page, picks: [RegExp, number][], startSpot: number) {
  let spot = startSpot;
  for (const [name, count] of picks) {
    await (await chipOnTrayOrPin(page, name)).click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  return spot;
}

async function finishAfterBake(page: Page) {
  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
  await completeEmptyFinishIfOffered(page);
  await page.waitForSelector(".result-panel");
}

/** Free Cooking from HOME: meat-lovers (tomato sauce, mozzarella x2, bacon x2, ham, pepperoni, sausage x2). */
async function cookMeatLoversFreely(page: Page) {
  await page.locator(".cta-button--free-cook").first().click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await (await chipOnTrayOrPin(page, /トマトソース/)).click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  let spot = await place(page, [[/モッツァレラ/, 2]], 0);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  spot = await place(page, [[/ベーコン/, 2], [/ハム/, 1], [/ペパロニ/, 1], [/ソーセージ/, 2]], spot);
  await hold(page, 1200);
  await bakeToTarget(page, { start: 60, end: 76 });
  await finishAfterBake(page);
}

/** The FREE Mito order for margherita, from HOME. */
async function serveMargheritaOrder(page: Page) {
  await page.getByRole("button", { name: /注文を受ける/ }).click();
  await expect(page.locator(".dialogue-area")).toBeVisible();
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  for (const [x, y] of [[40, 50], [60, 50], [50, 30]] as const) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 60);
  await tapDoughPercent(page, 58, 42);
  await bakeToTarget(page, { start: 60, end: 80 });
  await finishAfterBake(page);
}

async function home(page: Page) {
  await page.getByRole("button", { name: /ホーム/ }).first().click();
  await page.waitForSelector(".home-screen");
}

const pill = (page: Page) => page.getByTestId("home-research-points");

test.describe("B案 Phase 3c: research points (shop model)", () => {
  test.setTimeout(240_000);

  test("a trial earns by its stage -> RESULT +N and the balance -> HOME -> reload keeps it, once -> the hint sheet shows it", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await open(page, "?progression=shop", save());
    if (STRICT) {
      await expect(pill(page)).toHaveText("🔬 0");
      await expect(pill(page)).toHaveAttribute("aria-label", /研究ポイント 0/);
      await noOverflow(page, "HOME rp 0");
    }
    await capture(page, "01-home-shop-rp0");
    await hold(page, 2000);

    // 1. Free Cooking: meat-lovers (stage 2) -> +2 research points.
    await cookMeatLoversFreely(page);
    const line = page.getByTestId("result-research-points");
    if (STRICT) {
      await expect(line).toContainText("研究ポイント +2");
      await expect(line).toContainText("所持 2");
      await expect(line).toContainText("ヒントと交換できるようになるのは、もう少し先です");
      await noOverflow(page, "RESULT research points");
      expect((await saved(page)).shopProgress.researchPointsEarned).toBe(2);
    }
    if (await line.count()) await line.scrollIntoViewIfNeeded();
    await capture(page, "02-result-research-points");
    await hold(page, 3500);

    // 2. HOME: the balance beside Pitz; a reload keeps it and adds nothing.
    await home(page);
    if (STRICT) await expect(pill(page)).toHaveText("🔬 2");
    await capture(page, "03-home-shop-rp2");
    await hold(page, 2000);
    await page.reload();
    await page.waitForSelector(".home-screen");
    if (STRICT) {
      await expect(pill(page)).toHaveText("🔬 2");
      expect((await saved(page)).shopProgress.researchPointsEarned).toBe(2);
    }
    await hold(page, 1500);

    // 3. The next trial's hint sheet: the balance, and that it cannot buy a hint yet.
    await page.locator(".cta-button--free-cook").first().click();
    await page.waitForSelector(".pizza-stage");
    const hintButton = page.getByRole("button", { name: /^ヒント$/ });
    if (await hintButton.count()) {
      await hintButton.first().click();
      const sheet = page.locator(".hint-sheet");
      await expect(sheet).toBeVisible();
      if (STRICT) {
        await expect(page.getByTestId("hint-research-points")).toContainText("研究ポイント 2");
        await expect(page.getByTestId("hint-research-points")).toContainText("ヒントと交換できるようになるのは、もう少し先です");
        await noOverflow(page, "hint sheet");
      }
      await capture(page, "04-hint-sheet-rp");
      await hold(page, 3000);
      await sheet.getByRole("button", { name: "閉じる" }).first().click();
    }
    // Leaving the trial before the bake earns nothing.
    await home(page);
    if (STRICT) {
      await expect(pill(page)).toHaveText("🔬 2");
      expect((await saved(page)).shopProgress.researchPointsEarned).toBe(2);
    }
    expect(errors).toEqual([]);
  });

  test("a served order earns no research points", async ({ page }) => {
    await open(page, "?progression=shop", {
      schemaVersion: 2,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
      pitzBalance: 0,
      ownedIngredientIds: STARTERS,
      missionBest: {},
      shopProgress: { reputation: 5, grantedMenuRecipeIds: [], researchPointsEarned: 7 },
    });
    await expect(pill(page)).toHaveText("🔬 7");
    await serveMargheritaOrder(page);
    await expect(page.getByTestId("result-reputation")).toBeVisible();
    await expect(page.getByTestId("result-research-points")).toHaveCount(0);
    expect((await saved(page)).shopProgress.researchPointsEarned).toBe(7);
    await home(page);
    await expect(pill(page)).toHaveText("🔬 7");
  });

  test("legacy (no parameter): no research points anywhere, and the save gains no shopProgress", async ({ page }) => {
    const { shopProgress: _drop, ...legacySave } = save();
    await open(page, "", legacySave);
    await expect(pill(page)).toHaveCount(0);
    await capture(page, "05-home-legacy");
    await cookMeatLoversFreely(page);
    await expect(page.locator(".result-panel--discovery")).toContainText("ミートラヴァーズ");
    await expect(page.getByTestId("result-research-points")).toHaveCount(0);
    expect(await saved(page)).not.toHaveProperty("shopProgress");
    await capture(page, "06-result-legacy");
  });
});
