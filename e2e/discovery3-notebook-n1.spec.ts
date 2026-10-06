import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Discovery 3.0 Notebook N1: the read-only 試作ノート, opened from the Hint sheet, played for real on both iPhone widths.
 *
 * Dex 3 save (funghi is the one DISCOVERABLE recipe, pool 1) and the Dex 12 save (portuguesa + calabresa, pool 2).
 * Hint -> 試作ノート (empty state) -> back -> FREE attempts -> Notebook rows (#n, the player's own combination, the
 * line shown, repeat count) -> back to the Hint -> retry; HOME / FREE keeps the session notebook; nothing about the
 * hidden recipes reaches the DOM; a long list scrolls inside the sheet with the way back kept on screen; the save is
 * still schema v2 with no notebook in it.
 *
 * Optional output: HV_SCREENSHOT_DIR.
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
const LADDER12: [string, string[]][] = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]],
];
const materials12 = [...LADDER12.flatMap(([, m]) => m), "onion"];
const DEX12_SAVE = {
  schemaVersion: 2,
  dex: LADDER12.map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials12],
  missionBest: {},
  inventory: Object.fromEntries(materials12.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials12,
};
const DISCOVERED_3 = ["margherita", "bismarck", "breakfast-pizza"];
const DISCOVERED_12 = LADDER12.map(([id]) => id);

type Pieces = { cheese: [RegExp, number][]; toppings: [RegExp, number][]; sauceDab?: boolean };
const ADD_ONE: Pieces = { cheese: [[/モッツァレラ/, 3]], toppings: [] };
const FAR: Pieces = { cheese: [], toppings: [[/バジル/, 1], [/たまご/, 2], [/ベーコン/, 2]] };
const INCOMPLETE: Pieces = { cheese: [[/モッツァレラ/, 2]], toppings: [[/マッシュルーム/, 3]], sauceDab: true };
const EGG: Pieces = { cheese: [], toppings: [[/たまご/, 2]] };
const BACON: Pieces = { cheese: [], toppings: [[/ベーコン/, 2]] };
const BASIL: Pieces = { cheese: [], toppings: [[/バジル/, 2]] };

const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function openWithSave(page: Page, save: object, pill: RegExp) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(pill);
}

async function capture(page: Page, name: string, projectName: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${projectName}.png` });
}

async function pickChip(page: Page, name: RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name }).first();
  const prev = page.getByRole("button", { name: "前のページ" });
  const next = page.getByRole("button", { name: "次のページ" });
  // The tray only has a pager when it has several pages (Dex 12); never wait for one that is not there.
  const enabled = async (b: typeof prev) => (await b.count()) > 0 && (await b.isEnabled());
  for (let i = 0; i < 6 && (await enabled(prev)); i += 1) await prev.click();
  for (let i = 0; i < 6 && !(await chip.isVisible()); i += 1) {
    if (!(await enabled(next))) break;
    await next.click();
  }
  await chip.click();
}

async function startFree(page: Page, from: "HOME" | "RESULT") {
  if (from === "HOME") await startTargetlessFreeCook(page);
  else await page.getByRole("button", { name: /もう一度試す/ }).click();
  await page.waitForSelector(".pizza-stage");
}

/** One FREE round (Dex 3 save), baked on target, to its RESULT. */
async function cookFree(page: Page, pieces: Pieces, from: "HOME" | "RESULT") {
  await startFree(page, from);
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await pickChip(page, /トマトソース/);
  if (pieces.sauceDab) await tapDoughPercent(page, 50, 50);
  else await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  const spots: [number, number][] = [[40, 50], [60, 50], [50, 32], [50, 66], [34, 38], [66, 62]];
  let s = 0;
  for (const [name, n] of pieces.cheese) {
    await pickChip(page, name);
    for (const [x, y] of spots.slice(s, (s += n))) await tapDoughPercent(page, x, y);
  }
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  for (const [name, n] of pieces.toppings) {
    await pickChip(page, name);
    for (const [x, y] of spots.slice(s % 6, (s % 6) + n)) await tapDoughPercent(page, x, y);
    s += n;
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
/** Dex 12 save: sausage x3, onion x2, olive x2, oregano x`oregano`, no cheese. */
async function cookCalabresa(page: Page, oregano: number, from: "HOME" | "RESULT") {
  await startFree(page, from);
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await pickChip(page, /トマトソース/);
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  let spot = 0;
  for (const [name, n] of [[/ソーセージ/, 3], [/たまねぎ/, 2], [/ブラックオリーブ/, 2], [/オレガノ/, oregano]] as [RegExp, number][]) {
    if (n === 0) continue;
    await pickChip(page, name);
    for (let i = 0; i < n; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

const hintButton = (page: Page) => page.getByRole("button", { name: "ヒント", exact: true });
const hintSheet = (page: Page) => page.getByRole("dialog", { name: /^💡 ヒント/ });
const notebook = (page: Page) => page.getByRole("dialog", { name: /試作ノート/ });
const openNotebookFromHint = async (page: Page) => {
  await hintButton(page).click();
  await expect(hintSheet(page)).toBeVisible();
  await hintSheet(page).getByRole("button", { name: /試作ノートを見る/ }).click();
  await expect(notebook(page)).toBeVisible();
};
const backToHint = async (page: Page) => {
  await notebook(page).getByRole("button", { name: /ヒントにもどる/ }).click();
  await expect(notebook(page)).toHaveCount(0);
  await expect(hintSheet(page)).toBeVisible();
  await expect(hintSheet(page).getByRole("button", { name: /試作ノートを見る/ })).toBeFocused();
};
const noHorizontalOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

test.describe("Discovery 3.0 Notebook N1 (read-only 試作ノート from the Hint sheet)", () => {
  test.setTimeout(300_000);

  test("empty state: Hint -> 試作ノート (empty, not blank) -> back to the Hint -> close", async ({ page }, testInfo) => {
    await openWithSave(page, DEX3_SAVE, /3\/33/);
    await startFree(page, "HOME");
    await openNotebookFromHint(page);
    await expect(notebook(page)).toContainText("まだ試作の記録はないよ。");
    await expect(notebook(page)).toContainText("レシピ発見で作ってみよう！");
    await expect(notebook(page)).toContainText("読み込みなおすと消える");
    await noHorizontalOverflow(page);
    // keyboard: the Hint underneath is inert, so Tab / Shift+Tab never land on a Hint control behind the notebook
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press(i % 2 ? "Tab" : "Shift+Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[data-hint-kind]"))).toBe(false);
    }
    // the way back stays inside the viewport
    const back = await notebook(page).getByRole("button", { name: /ヒントにもどる/ }).boundingBox();
    const vp = page.viewportSize()!;
    expect(back!.x).toBeGreaterThanOrEqual(0);
    expect(back!.x + back!.width).toBeLessThanOrEqual(vp.width);
    expect(back!.y).toBeGreaterThanOrEqual(0);
    await capture(page, "n1-empty", testInfo.project.name);
    await backToHint(page);
    await hintSheet(page).getByRole("button", { name: "閉じる" }).click();
    await expect(hintSheet(page)).toHaveCount(0);
  });

  test("attempts show up (#n, own combination, line shown), a repeat shows its count, Notebook -> Hint -> retry; HOME/FREE keeps it; save stays v2 without the notebook", async ({ page }, testInfo) => {
    await openWithSave(page, DEX3_SAVE, /3\/33/);
    await cookFree(page, ADD_ONE, "HOME");
    await cookFree(page, FAR, "RESULT");
    await startFree(page, "RESULT");
    await openNotebookFromHint(page);
    const rows = notebook(page).locator("[data-trial-entry]");
    await expect(rows).toHaveCount(2);
    // recent activity first: #2 then #1
    await expect(rows.nth(0)).toContainText("試作 #2");
    await expect(rows.nth(1)).toContainText("試作 #1");
    await expect(rows.nth(1)).toContainText("モッツァレラ");
    await expect(rows.nth(0)).toContainText("バジル");
    await expect(rows.nth(0)).toContainText("ベーコン");
    // Near/Far Neutralization Phase 1: no near/far feedback is recorded, so no feedback row is shown.
    await expect(rows.nth(0).locator(".trial-notebook__feedback")).toHaveCount(0);
    await expect(rows.nth(1).locator(".trial-notebook__feedback")).toHaveCount(0);
    await noHorizontalOverflow(page);
    await capture(page, "n1-entries", testInfo.project.name);
    await backToHint(page);
    await hintSheet(page).getByRole("button", { name: "閉じる" }).click();

    // Retry the first combination from the FREE round we are already in.
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await pickChip(page, /トマトソース/);
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    const spots: [number, number][] = [[40, 50], [60, 50], [50, 32]];
    await pickChip(page, /モッツァレラ/);
    for (const [x, y] of spots) await tapDoughPercent(page, x, y);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await bakeToTarget(page, FREE_BAKE);
    await page.waitForSelector(".result-panel");
    await expect(page.locator(".original-pizza__trial-notice")).toContainText("試作#1");

    // HOME / FREE navigation keeps the session notebook.
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await startFree(page, "HOME");
    await openNotebookFromHint(page);
    await expect(notebook(page).locator("[data-trial-entry]")).toHaveCount(2);
    const first = notebook(page).locator("[data-trial-entry]").first();
    await expect(first).toContainText("試作 #1"); // the repeat moved to the top, its #n unchanged
    await expect(first).toContainText("同じ組み合わせを 2 回作ったよ");
    await capture(page, "n1-retry", testInfo.project.name);

    // Not saved: the save is still schema v2 and holds no notebook.
    const raw = await page.evaluate((key) => localStorage.getItem(key) ?? "", SAVE_KEY);
    expect(JSON.parse(raw).schemaVersion).toBe(2);
    expect(raw).not.toMatch(/trialNotebook|fp1:|試作/);

    // Reload: the (session-only) notebook is gone -- the accepted N1 limitation.
    await page.reload();
    await page.waitForSelector(".app-frame");
    await startFree(page, "HOME");
    await openNotebookFromHint(page);
    await expect(notebook(page)).toContainText("まだ試作の記録はないよ。");
  });

  test("a long list scrolls inside the sheet and the way back stays on screen", async ({ page }, testInfo) => {
    await openWithSave(page, DEX3_SAVE, /3\/33/);
    await cookFree(page, ADD_ONE, "HOME");
    await cookFree(page, FAR, "RESULT");
    await cookFree(page, EGG, "RESULT");
    await cookFree(page, BACON, "RESULT");
    await cookFree(page, BASIL, "RESULT");
    await startFree(page, "RESULT");
    // A short window makes five entries a "long list".
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width, height: 440 });
    await openNotebookFromHint(page);
    await expect(notebook(page).locator("[data-trial-entry]")).toHaveCount(5);
    const list = notebook(page).locator(".trial-notebook__list");
    const m = await list.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
    expect(m.scroll).toBeGreaterThan(m.client);
    await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(notebook(page).locator('[data-trial-entry="1"]')).toBeVisible(); // the oldest, reachable by scrolling
    const sheet = await notebook(page).boundingBox();
    expect(sheet!.y).toBeGreaterThanOrEqual(0);
    expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(440 + 1);
    await expect(notebook(page).getByRole("button", { name: /ヒントにもどる/ })).toBeInViewport();
    await noHorizontalOverflow(page);
    await capture(page, "n1-long-list", testInfo.project.name);
    await backToHint(page);
  });

  test("pool = 2 (Dex 12) and an INCOMPLETE attempt: the notebook names no recipe and shows no count / match", async ({ page }, testInfo) => {
    await openWithSave(page, DEX12_SAVE, /12\/33/);
    await cookCalabresa(page, 0, "HOME"); // no oregano: an incomplete attempt
    await startFree(page, "RESULT");
    // pool > 1 and nothing bought: the Hint sheet offers the open-pool message only, yet the notebook is reachable.
    await openNotebookFromHint(page);
    await expect(hintSheet(page)).toContainText("研究するピザを選ぼう");
    const row = notebook(page).locator("[data-trial-entry]");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("試作 #1");
    await expect(row).toContainText("ソーセージ");
    const text = await notebook(page).innerText();
    expect(text).not.toMatch(/ブラジリアン|ポルトゲーザ|カラブレーザ|正解|一致|候補|%|％|距離/);
    expect(text).not.toMatch(/[0-9０-９]+\s*(種類|個|件)/); // no candidate / ingredient count (the shown 「あと1つ」 line is the existing RESULT feedback)
    await expectNoUndiscoveredIdentity(page, DISCOVERED_12, "notebook (pool 2, incomplete attempt)");
    const attrs = await page.evaluate(() => [...document.querySelectorAll("[data-trial-notebook] *, [data-trial-notebook]")].flatMap((el) => [...el.attributes].map((a) => `${a.name}=${a.value}`)).join("\n"));
    expect(attrs).not.toMatch(/calabresa|portuguesa|INCOMPLETE|ORIGINAL|FAR|fp1/);
    await capture(page, "n1-pool2-incomplete", testInfo.project.name);
    await backToHint(page);
  });

  test("pool = 1 (Dex 3) notebook rows pass the whole-document anti-spoiler sweep", async ({ page }) => {
    await openWithSave(page, DEX3_SAVE, /3\/33/);
    await cookFree(page, INCOMPLETE, "HOME");
    await startFree(page, "RESULT");
    await openNotebookFromHint(page);
    await expect(notebook(page).locator("[data-trial-entry]")).toHaveCount(1);
    await expectNoUndiscoveredIdentity(page, DISCOVERED_3, "notebook (pool 1, incomplete attempt)");
  });
});
