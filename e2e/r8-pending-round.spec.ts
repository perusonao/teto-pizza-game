import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  cutThreeLines,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  tapDoughPercent,
} from "./gestures";
import { SAVE_KEY } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Save R8 (Issue #617, J-B): consumption and registration are saved together or not at all. Real browser, 390x844 (and 360x800 via
 * the iphone projects; the webkit-* projects run it in CI). Seeds only this context's own storage.
 *
 *   - Guided CUT: reload in the middle of CUT -> the baked pizza is registered, stock stays consumed, the notice is shown until
 *     confirmed, and the confirmation removes the journal.
 *   - HOME in CUT completes the round the same way.
 *   - Free Cooking FINISH (?freeFinish=on): reload in FINISH completes the previous pizza (also with the gate OFF on the reload).
 *   - A save that cannot take the bake (quota) stops the round at BAKE, says so, and a retry after space is freed goes through.
 *
 * HV_OUT_DIR (unset in CI) gets screenshots.
 */
const OUT = process.env.HV_OUT_DIR;
async function shot(page: Page, name: string, project: string) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}-${project}.png` });
}

const MARGHERITA_BAKE = { start: 60, end: 80 };
const FREE_BAKE = { start: 58, end: 78 }; // FREE_COOK_BAKE_TARGET (src/data/freeCook.ts)

const guidedSave = () => ({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
  pitzBalance: 100,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "onion"],
  missionBest: {},
  inventory: { onion: 9 },
  starterGrantClaimedRecipeIds: [] as string[],
});

const freeSave = () => ({ ...guidedSave(), dex: [] as unknown[], pitzBalance: 0 });

async function seed(page: Page, save: object) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(save)] as const);
}

const readSave = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as Record<string, any> | null, SAVE_KEY);

async function startGuidedMargherita(page: Page) {
  await seed(page, guidedSave());
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
}

async function prepareGuidedMargherita(page: Page) {
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
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
}

async function guidedToCut(page: Page) {
  await startGuidedMargherita(page);
  await prepareGuidedMargherita(page);
  await bakeToTarget(page, MARGHERITA_BAKE);
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
}

const notice = (page: Page) => page.locator('[data-round-notice="settled"]');

test("Guided CUT: a reload in the middle of CUT registers the baked pizza once, keeps the notice until confirmed", async ({ page }, info) => {
  test.setTimeout(90_000);
  await guidedToCut(page);
  await cutThreeLines(page);

  // The bake wrote the journal (and nothing is registered yet): that is what a reload will complete.
  const mid = await readSave(page);
  expect(mid?.pendingRound?.status).toBe("pending");
  expect(mid?.dex.find((e: any) => e.recipeId === "margherita").timesMade).toBe(1);
  await shot(page, "r8-01-cut-in-progress", info.project.name);

  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toContainText("中断していたピザを完成させました");
  await expect(notice(page)).toContainText("マルゲリータ");
  await shot(page, "r8-02-home-after-reload-notice", info.project.name);
  const done = await readSave(page);
  expect(done?.dex.find((e: any) => e.recipeId === "margherita").timesMade).toBe(2);
  expect(done?.pendingRound?.status).toBe("settled");

  // another reload: the notice is still there (kept until confirmed) and nothing is registered a second time
  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(notice(page)).toBeVisible();
  expect((await readSave(page))?.dex.find((e: any) => e.recipeId === "margherita").timesMade).toBe(2);

  await notice(page).getByRole("button", { name: "確認した" }).click();
  await expect(notice(page)).toHaveCount(0);
  expect((await readSave(page))?.pendingRound).toBeUndefined();
  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(notice(page)).toHaveCount(0);
  await shot(page, "r8-03-home-after-confirm", info.project.name);
});

test("Guided CUT: HOME completes the round the same way a restart does", async ({ page }, info) => {
  test.setTimeout(90_000);
  await guidedToCut(page);
  await cutThreeLines(page);
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page.getByRole("button", { name: /ホーム/ }).click();
  expect(messages).toHaveLength(1);
  expect(messages[0]).toContain("図鑑に登録");
  await expect(page.locator(".home-screen")).toBeVisible();
  await expect(notice(page)).toBeVisible();
  const save = await readSave(page);
  expect(save?.dex.find((e: any) => e.recipeId === "margherita").timesMade).toBe(2);
  expect(save?.pendingRound?.status).toBe("settled");
  await shot(page, "r8-04-home-leave-notice", info.project.name);
});

test("Guided CUT: confirming the cut registers and removes the journal in one go; a reload shows nothing", async ({ page }) => {
  test.setTimeout(90_000);
  await guidedToCut(page);
  await cutThreeLines(page);
  await page.getByRole("button", { name: /切り終わる/ }).click();
  await expect.poll(async () => (await readSave(page))?.pendingRound).toBeUndefined();
  expect((await readSave(page))?.dex.find((e: any) => e.recipeId === "margherita").timesMade).toBe(2);
  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(notice(page)).toHaveCount(0);
  expect((await readSave(page))?.dex.find((e: any) => e.recipeId === "margherita").timesMade).toBe(2);
});

async function bootFreeFinish(page: Page, save: object) {
  await seed(page, save);
  await page.goto("/?freeFinish=on");
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
}

async function prepareFreeMargherita(page: Page, extra?: () => Promise<void>) {
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
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 60);
  await tapDoughPercent(page, 58, 42);
  if (extra) await extra();
}

test("Free Cooking FINISH: a reload in FINISH registers the previous pizza, the notice appears (also with the gate OFF on the reload)", async ({ page }, info) => {
  test.setTimeout(120_000);
  await bootFreeFinish(page, freeSave());
  await prepareFreeMargherita(page);
  await bakeToTarget(page, FREE_BAKE, { finish: false }); // the FINISH step is what these specs quit in
  await expect(page.getByRole("button", { name: /完成/ })).toBeVisible();
  const mid = await readSave(page);
  expect(mid?.pendingRound?.kind).toBe("FREE_COOK");
  expect(mid?.pendingRound?.status).toBe("pending");
  expect(mid?.dex).toEqual([]);
  await shot(page, "r8-05-free-finish-before-reload", info.project.name);

  await page.goto("/"); // the reload without ?freeFinish=on: completing the journal does not depend on the gate
  await page.waitForSelector(".app-frame");
  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toContainText("マルゲリータ");
  const done = await readSave(page);
  expect(done?.dex.find((e: any) => e.recipeId === "margherita")?.timesMade).toBe(1);
  await shot(page, "r8-06-free-finish-reload-notice", info.project.name);
});

test("Free Cooking FINISH: the stock stays consumed after a reload in FINISH (a pizza that registers nothing is still reported)", async ({ page }) => {
  test.setTimeout(120_000);
  await bootFreeFinish(page, freeSave());
  await prepareFreeMargherita(page, async () => {
    // one piece of a finite ingredient on top of the margherita trio: the pizza uses 1 onion
    await page.getByRole("button", { name: /たまねぎ/ }).click();
    await tapDoughPercent(page, 50, 52);
  });
  await bakeToTarget(page, FREE_BAKE, { finish: false }); // the FINISH step is what these specs quit in
  await expect(page.getByRole("button", { name: /完成/ })).toBeVisible();
  expect((await readSave(page))?.inventory.onion).toBe(8); // consumed, saved together with the journal

  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(notice(page)).toBeVisible();
  expect((await readSave(page))?.inventory.onion).toBe(8); // not given back
});

test("a save that cannot take the bake stops the round at BAKE, says why, and a retry after space is freed goes through", async ({ page }, info) => {
  test.setTimeout(90_000);
  await startGuidedMargherita(page);
  await prepareGuidedMargherita(page);
  // from now on the browser refuses to store the save (a full disk)
  await page.evaluate((key) => {
    const real = Storage.prototype.setItem;
    (window as any).__failSave = true;
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (k === key && (window as any).__failSave) throw new DOMException("quota", "QuotaExceededError");
      return real.call(this, k, v);
    };
  }, SAVE_KEY);
  const before = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);

  await enterBakePaused(page);
  await page.clock.runFor(100);
  await landNeedleAndTakeOut(page, MARGHERITA_BAKE);
  const alert = page.locator('[data-round-notice="save-failure"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("保存できないため、焼成を確定しません");
  await expect(alert).toContainText("保存領域がいっぱい");
  await expect(page.getByRole("button", { name: "取り出す！" })).toBeVisible(); // still at BAKE
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(before);
  await shot(page, "r8-07-save-failure-at-bake", info.project.name);

  // The player reads the message for a while (real time: the needle would have run on to the burnt zone). The take-out they made is
  // what is retried, so the pizza is still the good bake it was.
  await page.waitForTimeout(3500);
  await page.evaluate(() => { (window as any).__failSave = false; });
  await page.getByRole("button", { name: "取り出す！" }).click();
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
  await expect(alert).toHaveCount(0);
  expect((await readSave(page))?.pendingRound?.status).toBe("pending");
});

test("a journal this build cannot act on is kept untouched and the notice explains how to recover", async ({ page }, info) => {
  const future = { v: 2, id: "from-a-newer-build", status: "pending", anything: { new: "shape" } };
  await seed(page, { ...guidedSave(), pendingRound: future });
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  const held = page.locator('[data-round-notice="held"]');
  await expect(held).toBeVisible();
  await expect(held).toContainText("復旧:");
  await expect(held).toContainText("今までどおり遊べます");
  expect((await readSave(page))?.pendingRound).toEqual(future);
  await shot(page, "r8-08-held-journal-notice", info.project.name);
  // playing on does not touch it
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  expect((await readSave(page))?.pendingRound).toEqual(future);
});
