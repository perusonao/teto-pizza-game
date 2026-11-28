import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { cookDinnerPizza, dinnerSave, DM_A, nextDinnerPizza, openDinnerDetail, openWithSave, readSave } from "./support/dinner";

const SHOP = "?progression=shop";
const title = /特別注文 1/;
const result = (page: Page) => page.getByRole("dialog", { name: "特別注文の結果" });
const launch = (page: Page) => page.getByRole("button", { name: /スタート/ });
const evidence = process.env.PHASE_3E_HV_DIR;
const video = Boolean(process.env.PHASE_3E_HV_VIDEO);

if (video) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

function menuSave(grants = ["breakfast-pizza", "funghi"], discovered = ["bismarck"]) {
  return {
    ...dinnerSave(discovered),
    shopProgress: { reputation: 0, grantedMenuRecipeIds: grants },
  };
}

async function capture(page: Page, label: string) {
  if (evidence) {
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/${label}.png` });
  }
  if (video) await page.waitForTimeout(1500);
}

async function clearDinner(page: Page, record: boolean) {
  for (const [i, id] of DM_A.entries()) {
    await cookDinnerPizza(page, id, { pauseMs: record && video ? 1000 : 0 });
    if (i < DM_A.length - 1) {
      await expect(page.getByTestId("dinner-attempt-result")).toHaveAttribute("data-category", "TARGET_PASS");
      if (record && video) await page.waitForTimeout(1300);
      await nextDinnerPizza(page);
    }
  }
  await expect(result(page)).toContainText("特別注文クリア！");
}

test("shop counts only missing menu targets and keeps locked targets private", async ({ page }) => {
  await openWithSave(page, menuSave(["funghi"]), SHOP);
  await page.getByRole("button", { name: /特別注文/ }).click();
  const cards = page.locator(".dinner-mission-card");
  await expect(cards.filter({ hasText: title })).toContainText("あと1品メニュー開発すると解放");
  await expect(cards.filter({ hasText: /特別注文 2/ })).toContainText("あと2品メニュー開発すると解放");
  await expect(cards.filter({ hasText: title })).toHaveAttribute("aria-disabled", "true");
  await expect(cards.locator(".dinner-mission-card__targets")).toHaveCount(0);
  await capture(page, "02-missing-menu");
});

test("shop detail offers 06:00 and ★3 for the same discovered recipes as legacy", async ({ page }) => {
  await openWithSave(page, menuSave([], [...DM_A]), SHOP);
  await openDinnerDetail(page, title);
  await expect(page.locator(".dinner-detail")).toContainText("06:00");
  await expect(page.locator(".dinner-detail")).toContainText("★3 以上");
  await expect(launch(page)).toBeEnabled();
  await capture(page, "03-start-ready");
});

test("shop starts with the four menu targets, clears at ★3+, pays first and repeat schedules and keeps finite stock", async ({ page }) => {
  test.setTimeout(300_000);
  await openWithSave(page, menuSave(), SHOP);
  const before = await readSave(page);
  await page.getByRole("button", { name: /特別注文/ }).click();
  const card = page.getByRole("button", { name: title });
  await expect(card.locator(".dinner-mission-card__targets")).toContainText("マルゲリータ");
  await capture(page, "01-menu-unlock");
  await card.click();
  await expect(page.locator(".dinner-detail")).toContainText("06:00");
  await expect(page.locator(".dinner-detail")).toContainText("★3 以上");
  await expect(launch(page)).toBeEnabled();
  if (video) await page.waitForTimeout(1500);
  await launch(page).click();
  await expect(page.getByTestId("dinner-hud")).toContainText(/^.*0[56]:[0-5][0-9]/);
  await capture(page, "04-dinner-started");
  await clearDinner(page, true);
  await expect(result(page)).toContainText(/GOLD\s+\+250 Pitz/);
  await expect(result(page)).toContainText(/評判\s+\+5/);
  await expect(result(page)).toContainText("4 / 4");
  await capture(page, "05-first-clear");

  await expect.poll(async () => (await readSave(page)).dinnerMissionRecords?.["dm-a"]?.clears).toBe(1);
  const first = await readSave(page);
  expect(first.dinnerMissionRecords["dm-a"]).toMatchObject({ clears: 1, bestTier: "GOLD", firstClearRewarded: true });
  expect(first.pitzBalance).toBe(before.pitzBalance + 250);
  expect(first.shopProgress.reputation).toBe(5);
  expect(first.dex).toEqual(before.dex);
  expect(first.inventory.egg).toBe(before.inventory.egg - 2);
  expect(first.inventory.bacon).toBe(before.inventory.bacon - 3);
  expect(first.inventory.mushroom).toBe(before.inventory.mushroom - 3);

  await result(page).getByRole("button", { name: "もう一度" }).click();
  await clearDinner(page, false);
  await expect(result(page)).toContainText(/GOLD\s+\+100 Pitz/);
  await expect(result(page)).not.toContainText("評判");
  await expect.poll(async () => (await readSave(page)).dinnerMissionRecords?.["dm-a"]?.clears).toBe(2);
  const repeat = await readSave(page);
  expect(repeat.pitzBalance).toBe(first.pitzBalance + 100);
  expect(repeat.shopProgress.reputation).toBe(5);
  expect(repeat.dex).toEqual(before.dex);
  expect(repeat.inventory.egg).toBe(before.inventory.egg - 4);
  await page.reload();
  await expect(page.locator(".home-screen")).toBeVisible();
  expect(await readSave(page)).toMatchObject({
    pitzBalance: repeat.pitzBalance,
    shopProgress: { reputation: 5 },
    dinnerMissionRecords: repeat.dinnerMissionRecords,
  });
});

for (const arrival of ["HOME button", "reload from results"] as const) {
  test(`Dinner and waiting menu bonuses settle separately via ${arrival}`, async ({ page }) => {
    test.setTimeout(300_000);
    const awaitingRecipe = "tonno-e-cipolla";
    const save = {
      ...dinnerSave([...DM_A, awaitingRecipe]),
      shopProgress: { reputation: 39, grantedMenuRecipeIds: [], awaitingMenuRecipeIds: [awaitingRecipe] },
      dinnerMissionRecords: {
        "dm-a": { revision: 1, clears: 1, bestClearMs: 120_000, bestTier: null, firstClearRewarded: false },
      },
    };
    const notice = page.getByRole("status", { name: "メニューに加わりました" });
    await openWithSave(page, save, SHOP);
    await expect(notice).toHaveCount(0);
    const before = await readSave(page);
    expect(before.pitzBalance).toBe(500);
    expect(before.shopProgress.reputation).toBe(39);
    await openDinnerDetail(page, title);
    await launch(page).click();
    await clearDinner(page, true);
    await expect(result(page)).toContainText(/GOLD\s+\+250 Pitz/);
    await expect(result(page)).toContainText(/評判\s+\+5/);
    await expect(result(page)).not.toContainText("メニュー開発ボーナス");
    await expect(notice).toHaveCount(0);
    const clear = await readSave(page);
    expect(clear).toMatchObject({
      pitzBalance: 750,
      shopProgress: { reputation: 44, awaitingMenuRecipeIds: [awaitingRecipe] },
      dinnerMissionRecords: { "dm-a": { clears: 2, firstClearRewarded: true } },
    });
    expect(clear.shopProgress.menuEntryPaidRecipeIds).toBeUndefined();
    if (arrival === "HOME button") await capture(page, "08-dinner-result");

    if (arrival === "HOME button") await result(page).getByRole("button", { name: /ホーム/ }).click();
    else await page.reload();
    await expect(page.locator(".home-screen")).toBeVisible();
    if (arrival === "HOME button") await capture(page, "09-home-menu-entry");
    await expect(notice).toContainText("メニュー開発ボーナス +50 Pitz・評判 +3");
    await expect(notice).toContainText(RECIPES.find((recipe) => recipe.id === awaitingRecipe)!.nameJa);
    await expect(page.getByTestId("home-reputation")).toContainText(/評判\s+47/);
    const paid = await readSave(page);
    expect(paid).toMatchObject({
      pitzBalance: 800,
      shopProgress: { reputation: 47, menuEntryPaidRecipeIds: [awaitingRecipe] },
      dinnerMissionRecords: clear.dinnerMissionRecords,
    });
    expect(paid.inventory).toEqual(clear.inventory);
    await notice.getByRole("button", { name: "確認した" }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".home-screen")).toBeVisible();
    await expect(notice).toHaveCount(0);
    expect(await readSave(page)).toEqual(paid);
  });
}

test("shop takes the 360-second timeout without a reward or record", async ({ page }) => {
  await page.clock.install();
  await openWithSave(page, menuSave(), `${SHOP}&dinnerDuration=1&dinnerMinStars=5`);
  const before = await readSave(page);
  await openDinnerDetail(page, title);
  await expect(page.locator(".dinner-detail")).toContainText("★3 以上");
  await launch(page).click();
  await expect(page.getByTestId("dinner-hud")).toContainText("06:00");
  await page.clock.fastForward(360_001);
  await expect(result(page)).toContainText("時間切れ！");
  const failed = await readSave(page);
  expect(failed.pitzBalance).toBe(before.pitzBalance);
  expect(failed.shopProgress).toEqual(before.shopProgress);
  expect(failed.inventory).toEqual(before.inventory);
  expect(failed.dinnerMissionRecords).toBeUndefined();
  await capture(page, "06-timeout");
});

test("legacy still requires Dex discovery and has no default START", async ({ page }) => {
  await openWithSave(page, menuSave(), "?progression=legacy");
  await page.getByRole("button", { name: /特別注文/ }).click();
  await expect(page.locator(".dinner-mission-card", { hasText: title })).toContainText("あと3種類のピザを発見すると解放");
  await openWithSave(page, menuSave([], [...DM_A]), "?progression=legacy");
  await openDinnerDetail(page, title);
  await expect(page.locator(".dinner-detail")).toContainText("制限時間を調整中");
  await expect(launch(page)).toBeDisabled();
});

test("shop selects the adopted Hint when the only Research entry from legacy is out of catalog", async ({ page }) => {
  const dex = RECIPES.filter((recipe) => recipe.id !== "margherita" && recipe.id !== "pesto-patate").map((recipe) => recipe.id);
  const save = menuSave([], dex);
  await openWithSave(page, { ...save, shopProgress: { ...save.shopProgress, researchPointsEarned: 10 } }, SHOP);
  await page.locator(".cta-button--free-cook").first().click();
  await page.getByRole("button", { name: /^ヒント$/ }).first().click();
  const sheet = page.locator(".hint-sheet");
  await expect(sheet.getByTestId("shop-hint-board")).toBeVisible();
  await expect(sheet).not.toContainText("このピザのヒントは今は出せないよ");
  await capture(page, "07-adopted-hint");
  await sheet.getByRole("button", { name: /ソースを見る/ }).click();
  await expect(sheet.locator('[data-shop-hint-row="SAUCE"]')).toContainText("トマトソース");
  const saved = await readSave(page);
  expect(saved.shopProgress.hintRevealsByRecipe).toEqual({ margherita: ["sauce"] });
  expect(saved.shopProgress.researchPointsSpent).toBe(1);
  expect(saved.pitzBalance).toBe(save.pitzBalance);
});
