import { test, expect, type Page } from "@playwright/test";
import { PREVIEW_BASE, PREVIEW_KEY, PROD_BASE, PROD_KEY, startDevStateServers, type DevStateServers } from "./support/devStateBuilds";
import { loadStarSaves, type StarSaves } from "./support/starSaves";

/**
 * DEV State Editor star-state presets (Issue #441), on REAL builds (a production build and a Preview build served from
 * one origin under their real base paths): the 119 / 120 / 129 / 130 presets are applied through the editor UI, the
 * stored Preview save is what the SHARED builder (e2e/support/starSaves.ts -> src/devtools/starStates.ts) produces, the
 * GAME then shows the Shop state the star gate dictates (goat-cheese from 120, spinach from 130), the production save
 * is never touched, and the original Preview save comes back byte for byte from the backup.
 *
 * `DEV_EDITOR_SCREENSHOTS=1` writes screenshots to docs/reports/screenshots/hv-ops-star-presets/;
 * `DEV_EDITOR_HV_VIDEO=1` records a paced video (kept out of the repo: delivered to the Owner directly).
 */

const VIDEO = process.env.DEV_EDITOR_HV_VIDEO === "1";
test.use({ video: VIDEO ? { mode: "on", size: { width: 390, height: 844 } } : "off" });

const GOAT = "goat-cheese";
const SPINACH = "spinach";
/** The Owner's pre-existing Preview save (planted): an unknown key and a Mission BEST must survive every apply. */
const OWNER_SAVE = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
  pitzBalance: 42,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  missionBest: { "lunch-rush": 640 },
  inventory: {},
  futureTopLevel: { keep: true },
});
const PROD_SAVE = "production-save-must-not-change";

/** Per target: whether the game must list the two star-gated materials as NEW in the Shop. */
const EXPECT_NEW: Record<number, { goat: boolean; spinach: boolean }> = {
  119: { goat: false, spinach: false },
  120: { goat: true, spinach: false },
  129: { goat: true, spinach: false },
  130: { goat: true, spinach: true },
};

let servers: DevStateServers;
let saves: StarSaves;
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  test.setTimeout(240_000);
  saves = await loadStarSaves();
  servers = await startDevStateServers();
});
test.afterAll(async () => servers?.close());

const editorUrl = () => `${servers.origin}${PREVIEW_BASE}?dev=state`;
const BACKUP_ORIGINAL_KEY = `${PREVIEW_KEY}.dev-backup-v1.original`;
const stored = (page: Page, key = PREVIEW_KEY) => page.evaluate((k) => localStorage.getItem(k), key);
const hold = (page: Page, ms = 1500) => (VIDEO ? page.waitForTimeout(ms) : Promise.resolve());
const openTab = (page: Page, name: string) => page.getByRole("tab", { name }).click();
async function shot(page: Page, name: string) {
  if (process.env.DEV_EDITOR_SCREENSHOTS !== "1") return;
  const project = test.info().project.name.replace("iphone-", "");
  await page.screenshot({ path: `docs/reports/screenshots/hv-ops-star-presets/${project}-${name}.png` });
}
async function noOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ vw: window.innerWidth, sw: document.documentElement.scrollWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
}
const starSum = (save: string) => (JSON.parse(save).dex as { bestStars: number; discovered: boolean }[]).reduce((n, e) => n + (e.discovered ? e.bestStars : 0), 0);

async function seed(page: Page, entries: Record<string, string>) {
  await page.goto(`${servers.origin}${PREVIEW_BASE}icons/icon-16.png`);
  await page.evaluate((e) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v);
  }, entries);
}

async function applyPreset(page: Page, target: number) {
  await page.goto("about:blank");
  await page.goto(editorUrl());
  await openTab(page, "プリセット");
  await noOverflow(page, `presets (${target})`);
  await shot(page, `${target}-1-presets`);
  await page.locator(`[data-preset-id="stars-${target}"]`).click();
  await expect(page.getByRole("status")).toContainText("まだ適用されていません");
  await hold(page);
  await openTab(page, "適用");
  await expect(page.getByRole("button", { name: "適用する" })).toBeDisabled();
  expect(starSum((await stored(page))!), "opening / choosing a preset writes nothing").not.toBe(target);
  await shot(page, `${target}-2-review`);
  await hold(page, 2000);
  await page.getByRole("checkbox", { name: /変更内容と backup を確認/ }).click();
  await page.getByRole("button", { name: "適用する" }).click();
  await expect(page.getByRole("status").last()).toContainText("適用しました（本物の loader で検証済み）");
  await shot(page, `${target}-3-applied`);
  await hold(page);
}

/** The material's Shop state as the GAME shows it: "NEW" (unlocked, unbought) or absent (LOCKED rows are anonymous). */
async function shopState(page: Page, id: string) {
  const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
  return (await row.count()) === 0 ? null : await row.first().getAttribute("data-shop-state");
}

test("HV: ⭐119 / 120 / 129 / 130 presets apply, the game's Shop follows the star gate, production is untouched, the Owner save restores", async ({ page }) => {
  test.setTimeout(240_000);
  await seed(page, { [PREVIEW_KEY]: OWNER_SAVE, [PROD_KEY]: PROD_SAVE });

  for (const target of saves.targets) {
    await applyPreset(page, target);

    // -- what is stored is the SHARED builder's save (same code as the E2E fixtures), merged over the Owner save
    const shared = JSON.parse(saves.json(target)) as Record<string, unknown>;
    const after = JSON.parse((await stored(page))!) as Record<string, unknown>;
    expect(starSum(JSON.stringify(after)), `${target}: stored Dex stars`).toBe(target);
    for (const key of ["dex", "pitzBalance", "ownedIngredientIds", "inventory", "unlockedForShopIngredientIds"]) {
      expect(after[key], `${target}: ${key} equals the shared builder's`).toEqual(shared[key]);
    }
    expect(after.futureTopLevel, "unknown keys survive").toEqual({ keep: true });
    expect(after.missionBest, "Mission BEST survives").toEqual({ "lunch-rush": 640 });
    expect(await stored(page, PROD_KEY), "production save untouched").toBe(PROD_SAVE);
    const original = JSON.parse((await stored(page, BACKUP_ORIGINAL_KEY))!) as { raw: string };
    expect(original.raw, "the Owner save is backed up byte for byte").toBe(OWNER_SAVE);

    // -- the game: loader -> step reached -> Shop entitlement
    await page.goto("about:blank");
    await page.goto(`${servers.origin}${PREVIEW_BASE}`);
    await page.waitForSelector(".app-frame");
    await expect(page.locator('[aria-label="Pitz残高 300"]')).toBeVisible();
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__body");
    const want = EXPECT_NEW[target];
    expect(await shopState(page, GOAT), `${target}: ${GOAT} in the Shop`).toBe(want.goat ? "NEW" : null);
    expect(await shopState(page, SPINACH), `${target}: ${SPINACH} in the Shop`).toBe(want.spinach ? "NEW" : null);
    const inGame = JSON.parse((await stored(page))!) as { unlockedForShopIngredientIds: string[]; dex: { bestStars: number }[] };
    expect(inGame.unlockedForShopIngredientIds.includes(GOAT), `${target}: ledger ${GOAT}`).toBe(want.goat);
    expect(inGame.unlockedForShopIngredientIds.includes(SPINACH), `${target}: ledger ${SPINACH}`).toBe(want.spinach);
    expect(starSum(JSON.stringify(inGame)), `${target}: playing does not change the stars`).toBe(target);
    await noOverflow(page, `shop (${target})`);
    await shot(page, `${target}-4-shop`);
    await hold(page, 2500);
  }

  // -- restore the Owner's save from the backup, byte for byte; production still untouched
  await page.goto("about:blank");
  await page.goto(editorUrl());
  await openTab(page, "バックアップ");
  const originalSlot = page.locator('[data-backup-slot="original"]');
  await originalSlot.getByRole("button", { name: /この backup に戻す/ }).click();
  expect(await stored(page)).not.toBe(OWNER_SAVE); // it asked first
  await shot(page, "5-restore-confirm");
  await hold(page);
  await originalSlot.getByRole("button", { name: "復元する" }).click();
  await expect(page.getByRole("status").last()).toContainText("復元しました");
  expect(await stored(page)).toBe(OWNER_SAVE);
  expect(await stored(page, PROD_KEY)).toBe(PROD_SAVE);
  await shot(page, "6-restored");
  await hold(page);
});

test("production: ?dev=state is inert, no star preset or backup key exists, the production save is untouched", async ({ page }) => {
  await seed(page, { [PROD_KEY]: PROD_SAVE });
  await page.goto("about:blank");
  await page.goto(`${servers.origin}${PROD_BASE}?dev=state`);
  await page.waitForSelector(".app-frame");
  expect(await page.locator("[data-dev-state-editor]").count()).toBe(0);
  expect(await page.locator("[data-preset-id]").count()).toBe(0);
  const dump = await page.evaluate(() => Object.keys(localStorage));
  expect(dump.filter((k) => k.includes("dev-backup"))).toEqual([]);
  expect(await stored(page, PROD_KEY)).toBe(PROD_SAVE);
  const text = await page.evaluate(() => document.body.innerText);
  for (const target of saves.targets) expect(text).not.toContain(`⭐${target}`);
});

test("the normal Preview game carries no star preset or editor entry (only ?dev=state does)", async ({ page }) => {
  await seed(page, { [PREVIEW_KEY]: OWNER_SAVE });
  await page.goto("about:blank");
  await page.goto(`${servers.origin}${PREVIEW_BASE}`);
  await page.waitForSelector(".app-frame");
  expect(await page.locator("[data-dev-state-editor], [data-preset-id]").count()).toBe(0);
  expect(await stored(page, BACKUP_ORIGINAL_KEY)).toBeNull();
});
