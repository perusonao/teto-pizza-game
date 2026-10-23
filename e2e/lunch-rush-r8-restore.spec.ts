import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * Save R8 (Issue #617), Lunch Rush L-1 in a real browser (Chromium and WebKit, 390x844 and 360x800).
 * Until now the Lunch Rush save/restore rules were pinned only in Vitest (src/state/pendingRound.lunchRush.test.ts);
 * no browser test reloaded a Lunch Rush round. This spec checks the three cases that decide whether stock can be lost or
 * duplicated, against the real localStorage save:
 *   1. a pizza baked but NOT served is not saved as consumed -- a reload on the result screen leaves the stock as it was;
 *   2. serving is the commit point -- the consumption and the registration are saved, and a reload keeps them;
 *   3. after a serve, a second baked-but-unserved pizza is the only one outstanding: a reload keeps the served one consumed.
 * Leaving the run inside the app without serving (the Owner-approved exception, HV G-6) is still covered by Vitest only.
 * Starter ingredients (tomato sauce, mozzarella, basil) are unlimited and never consumed, so the order is funghi, whose mushrooms are a finite, consumed stock.
 * The Lunch Rush run itself is not persisted: a reload returns to HOME (no pendingRound journal is ever written for it).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const MUSHROOM_STOCK = 9;

const missionSave = () => ({
  schemaVersion: 2,
  dex: [{ recipeId: "funghi", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
  pitzBalance: 100,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "mushroom"],
  missionBest: {},
  inventory: { mushroom: MUSHROOM_STOCK },
  starterGrantClaimedRecipeIds: [] as string[],
});

type SavedGame = {
  inventory: Record<string, number>;
  dex: { recipeId: string; timesMade: number }[];
  pitzBalance: number;
  pendingRound?: unknown;
};

const readSave = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as SavedGame | null, SAVE_KEY);

const timesMade = (save: SavedGame | null) => save?.dex.find((e) => e.recipeId === "funghi")?.timesMade;

/** Same script-free seeding as e2e/r8-pending-round.spec.ts and lunch-rush-material-shortage.spec.ts (WebKit-safe). */
async function openRun(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(
    ([k, v]) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(k, v);
    },
    [SAVE_KEY, JSON.stringify(missionSave())] as const,
  );
  await page.goto("./?missionDuration=300");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ランチラッシュ/ }).click();
  await page.getByRole("button", { name: "スタート" }).click();
  await page.getByRole("button", { name: "ピザを作る！" }).click();
  await expect(page.locator(".making-step-tabs")).toBeVisible();
}

/** Funghi (mushroom topping), baked and cut to the Lunch Rush serve panel. Nothing is served yet. */
async function bakeToServePanel(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /マッシュルーム/ }).click();
  await tapDoughPercent(page, 45, 55);
  await tapDoughPercent(page, 55, 45);
  await tapDoughPercent(page, 50, 60);

  await bakeToTarget(page, { start: 58, end: 78 }); // funghi's own bakeTarget (src/data/recipes.ts)
  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
  await expect(page.locator(".mission-serve-panel")).toBeVisible();
}

test.describe("Lunch Rush save/restore in the browser (R8 L-1)", () => {
  test("G-1: a pizza baked but not served is not saved as consumed; a reload on the serve panel leaves the stock and the Dex as they were", async ({ page }) => {
    await openRun(page);
    await bakeToServePanel(page);

    const unserved = await readSave(page);
    expect(unserved?.inventory.mushroom, "the unserved pizza's mushrooms is not saved as consumed").toBe(MUSHROOM_STOCK);
    expect(timesMade(unserved), "nothing is registered before the serve").toBe(1);
    expect(unserved?.pendingRound, "Lunch Rush never writes a pendingRound journal").toBeUndefined();

    await page.reload();
    await page.waitForSelector(".app-frame");
    const after = await readSave(page);
    expect(after?.inventory.mushroom).toBe(MUSHROOM_STOCK);
    expect(timesMade(after)).toBe(1);
    expect(after?.pitzBalance).toBe(unserved?.pitzBalance);
    await expect(page.locator('[data-round-notice="settled"]')).toHaveCount(0); // Lunch Rush leaves no "interrupted pizza" notice
  });

  test("G-4: serving is the commit point; the consumption and the registration are saved together and a reload keeps them", async ({ page }) => {
    await openRun(page);
    await bakeToServePanel(page);

    await page.getByRole("button", { name: "次の注文へ" }).click();
    await expect(page.locator(".making-step-tabs")).toBeVisible();

    const served = await readSave(page);
    expect(served?.inventory.mushroom ?? 0, "the served pizza's mushrooms is consumed").toBeLessThan(MUSHROOM_STOCK);
    expect(timesMade(served), "the served pizza is registered once").toBe(2);

    await page.reload();
    await page.waitForSelector(".app-frame");
    const after = await readSave(page);
    expect(after?.inventory.mushroom, "a reload does not give a served pizza's stock back").toBe(served?.inventory.mushroom);
    expect(timesMade(after), "a reload does not register it twice").toBe(2);
    expect(after?.pitzBalance).toBe(served?.pitzBalance);
  });

  test("G-5: after a serve, only the second (unserved) pizza is outstanding; a reload gives back that one and keeps the served one consumed", async ({ page }) => {
    await openRun(page);
    await bakeToServePanel(page);

    // serve one, then bake a second one and leave without serving it
    await page.getByRole("button", { name: "次の注文へ" }).click();
    await expect(page.locator(".making-step-tabs")).toBeVisible();
    const servedOnion = (await readSave(page))?.inventory.mushroom ?? 0;
    expect(servedOnion).toBeLessThan(MUSHROOM_STOCK);

    await bakeToServePanel(page);
    expect((await readSave(page))?.inventory.mushroom, "the second, unserved pizza is not saved as consumed").toBe(servedOnion);

    await page.reload();
    await page.waitForSelector(".app-frame");
    const after = await readSave(page);
    expect(after?.inventory.mushroom, "only the unserved pizza is given back; the served one stays consumed").toBe(servedOnion);
    expect(timesMade(after)).toBe(2);
  });
});
