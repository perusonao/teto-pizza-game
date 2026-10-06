import { test, expect, type Locator, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { PREVIEW_BASE, PREVIEW_KEY, PROD_BASE, PROD_KEY, startDevStateServers, type DevStateServers } from "./support/devStateBuilds";

/**
 * DEV State Editor (Issue #403) S4, Human Verification on REAL builds (390x844 and 360x800 are the two iphone
 * projects): the editor UI end to end on the Preview build, and what the GAME then shows. The production /
 * normal-Preview isolation is also re-checked here (the full proof is e2e/dev-state-editor.spec.ts).
 *
 * `DEV_EDITOR_SCREENSHOTS=1` writes screenshots to docs/reports/screenshots/dev-state-editor-s4/;
 * `DEV_EDITOR_HV_VIDEO=1` records a paced video (kept out of the repo: delivered to the Owner directly).
 */

const VIDEO = process.env.DEV_EDITOR_HV_VIDEO === "1";
test.use({ video: VIDEO ? { mode: "on", size: { width: 390, height: 844 } } : "off" });

const SEED = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
  pitzBalance: 5,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  missionBest: { "lunch-rush": 640 },
  inventory: {},
  discoveryHintFacts: { margherita: ["ing:basil"] },
  discoveryHintPurchases: { margherita: 1 },
  futureTopLevel: { keep: true },
};
const SEED_RAW = JSON.stringify(SEED);

let servers: DevStateServers;
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  test.setTimeout(240_000);
  servers = await startDevStateServers();
});
test.afterAll(async () => servers.close());

const editorUrl = () => `${servers.origin}${PREVIEW_BASE}?dev=state`;

async function seed(page: Page, entries: Record<string, string>) {
  await page.goto(`${servers.origin}${PREVIEW_BASE}icons/icon-16.png`);
  await page.evaluate((e) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v);
  }, entries);
}
const stored = (page: Page, key = PREVIEW_KEY) => page.evaluate((k) => localStorage.getItem(k), key);
const hold = (page: Page, ms = 1500) => (VIDEO ? page.waitForTimeout(ms) : Promise.resolve());
async function shot(page: Page, name: string) {
  if (process.env.DEV_EDITOR_SCREENSHOTS !== "1") return;
  const project = test.info().project.name.replace("iphone-", "");
  await page.screenshot({ path: `docs/reports/screenshots/dev-state-editor-s4/${project}-${name}.png` });
}
const openTab = (page: Page, name: string) => page.getByRole("tab", { name }).click();

/** No horizontal scroll, and every operable control (button, link, text field, checkbox label) is at least 44px high. */
async function expectLayout(page: Page, where: string) {
  const m = await page.evaluate(() => {
    const vw = window.innerWidth;
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(".dse button, .dse a, .dse input[type='text'], .dse input[type='search'], .dse label.dse-check")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < 43.5 || r.width < 43.5) small.push(`${el.tagName} ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const wide = [...document.querySelectorAll<HTMLElement>(".dse *")].filter((el) => el.getBoundingClientRect().right > vw + 0.5).map((el) => el.className.toString().slice(0, 40));
    return { vw, scrollWidth: document.documentElement.scrollWidth, small, wide };
  });
  expect(m.scrollWidth, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
  expect(m.small, `${where}: controls under 44px`).toEqual([]);
  expect(m.wide, `${where}: content past the right edge`).toEqual([]);
}

interface IngredientRowInfo { id: string; name: string; order: number | null }
async function ingredientRows(page: Page): Promise<IngredientRowInfo[]> {
  return page.locator("[data-ingredient-id]").evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute("data-ingredient-id")!,
      name: e.querySelector(".dse-ing__name")!.textContent!,
      order: Number(/取得順 (\d+) 番目/.exec(e.querySelector('[aria-label^="取得順"]')?.getAttribute("aria-label") ?? "")?.[1]) || null,
    })),
  );
}
const row = (page: Page, id: string): Locator => page.locator(`[data-ingredient-id="${id}"]`);
const orderOf = async (page: Page, id: string) => (await ingredientRows(page)).find((r) => r.id === id)?.order ?? null;

async function noDevEntry(page: Page, where: string) {
  expect(await page.locator("[data-dev-state-editor], .dse").count(), where).toBe(0);
  expect(await page.locator("body").ariaSnapshot(), where).not.toMatch(/State Editor|\bDEV\b|dev=state/);
}

test("HV: edit, review, apply, reload, the game, backup, restore", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, { [PREVIEW_KEY]: SEED_RAW, [PROD_KEY]: "production-save" });
  const writesBefore = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));

  // -- open: nothing is written
  await page.goto(editorUrl());
  await expect(page.getByRole("main", { name: "DEV State Editor" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("PREVIEW");
  await expect(page.getByRole("main")).toContainText("読み取り可");
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(writesBefore);
  await expectLayout(page, "status");
  await shot(page, "01-editor-open");
  await hold(page);

  // -- Hint reset (draft)
  await openTab(page, "Pitz・Hint");
  await expect(page.getByText(/facts 1 レシピ/)).toBeVisible();
  await page.getByRole("button", { name: /Hint を初期化/ }).click();
  await expect(page.getByText(/facts 0 レシピ（0 facts）／ 購入履歴 0 レシピ/)).toBeVisible();
  await expectLayout(page, "pitz-hint");
  await shot(page, "02-hint-reset");
  await hold(page);

  // -- preset: Step 12 A/B/C undiscovered
  await openTab(page, "プリセット");
  await expectLayout(page, "presets");
  await expect(page.locator('[data-preset-id="step12-b-discovered"]')).toBeEnabled(); // #402 is merged: wired
  await shot(page, "03-presets");
  await page.getByRole("button", { name: /Step 12 A\/B\/C undiscovered/ }).click();
  await expect(page.getByRole("status")).toContainText("まだ適用されていません");
  await hold(page);
  await openTab(page, "状態");
  await expect(page.locator("[data-research-entries]")).toHaveAttribute("data-research-entries", "3");
  await shot(page, "04-preset-loaded-status");
  await hold(page);

  // -- ingredients: search, OWNED switch, stock, acquisition order ↑
  await openTab(page, "材料");
  await page.getByRole("button", { name: "OWNED", exact: true }).click();
  const owned = (await ingredientRows(page)).filter((r) => r.order !== null);
  const last = owned.reduce((a, b) => (b.order! > a.order! ? b : a));
  expect(last.order).toBe(owned.length);
  await page.getByRole("searchbox", { name: /材料を検索/ }).fill(last.name);
  await expect(row(page, last.id)).toBeVisible();
  expect((await ingredientRows(page)).length).toBeLessThan(owned.length);
  await expectLayout(page, "ingredients (search)");
  await shot(page, "05-ingredient-search");
  await hold(page);
  await page.getByRole("searchbox", { name: /材料を検索/ }).fill("");
  const field = row(page, last.id).getByRole("textbox", { name: `${last.name} の在庫` });
  await field.fill("7");
  await expect(field).toHaveValue("7");
  await row(page, last.id).getByRole("button", { name: `${last.name} の在庫を 1 増やす` }).click();
  await expect(field).toHaveValue("8");
  await row(page, last.id).getByRole("button", { name: `${last.name} を取得順で 1 つ前へ` }).click();
  expect(await orderOf(page, last.id)).toBe(last.order! - 1);
  await hold(page);
  await page.getByRole("button", { name: "未所有" }).click();
  const unowned = (await ingredientRows(page))[0];
  await row(page, unowned.id).getByRole("switch", { name: `${unowned.name} OWNED` }).click();
  await page.getByRole("button", { name: "OWNED", exact: true }).click();
  expect(await orderOf(page, unowned.id)).toBe(last.order! + 1);
  await expectLayout(page, "ingredients (edited)");
  await shot(page, "06-owned-stock-order");
  await hold(page);

  // -- Pitz
  await openTab(page, "Pitz・Hint");
  await page.getByLabel("Pitz 残高").fill("777");
  await expectLayout(page, "pitz-hint (edited)");
  await shot(page, "07-pitz");
  await hold(page);

  // -- review: diff, warnings, explicit confirmation, nothing written yet
  await openTab(page, "適用");
  await expect(page.getByRole("heading", { name: /適用前の確認/ })).toBeVisible();
  // (no "order" row here: the stored save owns none of these materials, so none is REordered; test 2 covers it)
  for (const id of ["pitz", "owned-added", "stock", "dex", "hint-facts", "hint-purchases", "last-acquired"]) {
    await expect(page.locator(`[data-diff-id="${id}"]`), `diff row ${id}`).toBeVisible();
  }
  await expect(page.getByText(/取得順を変えると/)).toBeVisible();
  await expect(page.getByRole("button", { name: "適用する" })).toBeDisabled();
  expect(await stored(page)).toBe(SEED_RAW);
  await expectLayout(page, "apply");
  await shot(page, "08-review-diff-warning");
  await hold(page, 2500);
  await page.getByRole("checkbox", { name: /変更内容と backup を確認/ }).click();
  await expect(page.getByRole("button", { name: "適用する" })).toBeEnabled();
  await page.getByRole("button", { name: "適用する" }).click();
  await expect(page.getByRole("status").last()).toContainText("適用しました（本物の loader で検証済み）");
  await shot(page, "09-applied");
  await hold(page);

  const afterApply = JSON.parse((await stored(page))!);
  expect(afterApply.pitzBalance).toBe(777);
  expect(afterApply.futureTopLevel).toEqual({ keep: true });
  expect(afterApply.missionBest).toEqual({ "lunch-rush": 640 });
  expect(afterApply.discoveryHintFacts).toEqual({});
  expect(afterApply.ownedIngredientIds.at(-1)).toBe(unowned.id);
  expect(afterApply.ownedIngredientIds.at(-3)).toBe(last.id);
  expect(afterApply.inventory[last.id]).toBe(8);
  expect(await stored(page, PROD_KEY)).toBe("production-save");

  // -- backup
  await openTab(page, "バックアップ");
  await expect(page.locator('[data-backup-slot="original"]')).toContainText("save あり");
  await expect(page.locator('[data-backup-slot="previous"]')).toContainText("save あり");
  await expectLayout(page, "backup");
  await shot(page, "10-backup");
  await hold(page);

  // -- reload: what is stored is what the editor shows
  await page.reload();
  await expect(page.getByRole("main", { name: "DEV State Editor" })).toBeVisible();
  await expect(page.getByText(/変更: 0 件/)).toBeVisible();
  await expect(page.getByText("Pitz: 777")).toBeVisible();
  await shot(page, "11-after-reload");
  await hold(page);

  // -- the game reflects it
  await page.getByRole("link", { name: "ゲームへ戻る" }).click();
  await page.waitForSelector(".app-frame");
  await expect(page.locator('[aria-label="Pitz残高 777"]')).toBeVisible();
  const dexLabel = await page.locator('[aria-label^="レシピ図鑑 発見数"]').getAttribute("aria-label");
  const dexInStore = (JSON.parse((await stored(page))!).dex as { discovered: boolean }[]).filter((d) => d.discovered).length;
  expect(dexLabel).toContain(`発見数 ${dexInStore} /`);
  await noDevEntry(page, "Preview game HOME");
  await shot(page, "12-game-home");
  await hold(page, 2500);
  const inGame = JSON.parse((await stored(page))!);
  expect(inGame.futureTopLevel).toEqual({ keep: true });
  expect(inGame.missionBest).toEqual({ "lunch-rush": 640 });

  // -- restore the original save, byte for byte
  await page.goto(editorUrl());
  await openTab(page, "バックアップ");
  const original = page.locator('[data-backup-slot="original"]');
  await original.getByRole("button", { name: /この backup に戻す/ }).click();
  expect(await stored(page)).not.toBe(SEED_RAW); // it asked first; nothing restored yet
  await shot(page, "13-restore-confirm");
  await hold(page);
  await original.getByRole("button", { name: "復元する" }).click();
  await expect(page.getByRole("status").last()).toContainText("復元しました");
  expect(await stored(page)).toBe(SEED_RAW);
  await shot(page, "14-restored");
  await hold(page);

  // -- isolation: production ?dev=state is the normal HOME; the normal Preview game has no entry
  await page.goto("about:blank");
  await page.goto(`${servers.origin}${PROD_BASE}?dev=state`);
  await page.waitForSelector(".app-frame");
  await noDevEntry(page, "production ?dev=state");
  await shot(page, "15-production-dev-state-home");
  await hold(page);
  await page.goto("about:blank");
  await page.goto(`${servers.origin}${PREVIEW_BASE}`);
  await page.waitForSelector(".app-frame");
  await noDevEntry(page, "Preview game");
  await shot(page, "16-preview-game-no-entry");
  await hold(page);
});

test("HV: Step 12 A/B/C reaches the game's Research, and the acquisition order changes what the game says", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, {});
  const applyPreset = async (label: RegExp) => {
    await page.goto(editorUrl());
    await openTab(page, "プリセット");
    await page.getByRole("button", { name: label }).click();
    await openTab(page, "適用");
    await page.getByRole("checkbox", { name: /変更内容と backup を確認/ }).click();
    await page.getByRole("button", { name: "適用する" }).click();
    await expect(page.getByRole("status").last()).toContainText("適用しました");
  };
  const researchFacts = async () => {
    await page.getByRole("link", { name: "ゲームを開く" }).click();
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /レシピ発見/ }).click();
    await expect(page.getByText("研究中のピザ")).toBeVisible();
    const cards = await page.getByText(/^✓ .+を使う$/).allInnerTexts();
    return cards;
  };

  await applyPreset(/Step 12 A\/B\/C undiscovered/);
  const before = await researchFacts();
  expect(before).toHaveLength(3);
  expect(new Set(before).size).toBe(1); // all three name the step's own material: it was acquired last
  await shot(page, "17-game-research-step12");
  await hold(page, 2500);

  // move the step's material to the front of the acquisition order, apply, and look again
  await page.goto(editorUrl());
  await openTab(page, "材料");
  await page.getByRole("button", { name: "OWNED", exact: true }).click();
  const owned = (await ingredientRows(page)).filter((r) => r.order !== null);
  const last = owned.reduce((a, b) => (b.order! > a.order! ? b : a));
  const up = row(page, last.id).getByRole("button", { name: `${last.name} を取得順で 1 つ前へ` });
  while (await up.isEnabled()) await up.click();
  expect(await orderOf(page, last.id)).toBe(1);
  await openTab(page, "適用");
  await expect(page.locator('[data-diff-id="order"]')).toBeVisible();
  await expect(page.locator('[data-diff-id="last-acquired"]')).toBeVisible();
  await expect(page.getByText(/取得順を変えると/)).toBeVisible();
  await page.getByRole("checkbox", { name: /変更内容と backup を確認/ }).click();
  await page.getByRole("button", { name: "適用する" }).click();
  await expect(page.getByRole("status").last()).toContainText("適用しました");
  const after = await researchFacts();
  expect(after).toHaveLength(3);
  expect(after, "the unlock fact follows the acquisition order").not.toEqual(before);
  await shot(page, "18-game-research-reordered");
  await hold(page, 2500);

  // Step 12 Ready: the step's material is not owned yet, so there is no Research Entry for it
  await applyPreset(/Research Step 12 Ready/);
  await page.getByRole("link", { name: "ゲームを開く" }).click();
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /レシピ発見/ }).click();
  await expect(page.getByText(/^✓ .+を使う$/)).toHaveCount(0);
});

const LABEL_A = "？？？ピザ A（たまねぎ）";
const LABEL_B = "？？？ピザ B（たまねぎ）";
const LABEL_C = "？？？ピザ C（たまねぎ）";

test("HV: Step 12 B discovered -> Apply -> the game shows Brazilian Calabresa discovered and A / C (C does not become B); reload; editor; restore", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, { [PREVIEW_KEY]: SEED_RAW });

  // -- the editor: the preset is wired (#402 merged), review shows the Dex gain, apply
  await page.goto(editorUrl());
  await openTab(page, "プリセット");
  await expectLayout(page, "presets");
  await expect(page.locator('[data-preset-id="step12-b-discovered"]')).toBeEnabled();
  await page.getByRole("button", { name: /Step 12 B discovered/ }).click();
  await openTab(page, "状態");
  await expect(page.locator("[data-research-entries]")).toHaveAttribute("data-research-entries", "2");
  await shot(page, "19-b-preset-status");
  await openTab(page, "適用");
  await expect(page.locator('[data-diff-id="dex"]')).toBeVisible();
  await expectLayout(page, "apply (B preset)");
  await shot(page, "20-b-preset-review");
  await hold(page);
  await page.getByRole("checkbox", { name: /変更内容と backup を確認/ }).click();
  await page.getByRole("button", { name: "適用する" }).click();
  await expect(page.getByRole("status").last()).toContainText("適用しました（本物の loader で検証済み）");
  const discovered = (JSON.parse((await stored(page))!).dex as { recipeId: string }[]).map((d) => d.recipeId);
  expect(discovered).toContain("brazilian-calabresa");
  expect(discovered).not.toContain("aussie");
  expect(discovered).not.toContain("pizza-portuguesa");

  // -- the game: Dex shows Brazilian Calabresa; Research shows A and C, never B
  await page.getByRole("link", { name: "ゲームを開く" }).click();
  await page.waitForSelector(".app-frame");
  const researchTitles = async () => {
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    const section = page.locator(".dex-overlay__research");
    await section.scrollIntoViewIfNeeded();
    return { section, titles: await section.locator(".dex-research-card h3").allTextContents() };
  };
  let { section, titles } = await researchTitles();
  expect(titles.sort()).toEqual([LABEL_A, LABEL_C]);
  expect(titles).not.toContain(LABEL_B);
  await expect(section.getByRole("button", { name: `${LABEL_A}を研究する` })).toBeVisible();
  await expect(section.getByRole("button", { name: `${LABEL_C}を研究する` })).toBeVisible();
  await expect(section.getByRole("button", { name: `${LABEL_B}を研究する` })).toHaveCount(0);
  const calabresa = RECIPES.find((r) => r.id === "brazilian-calabresa")!;
  await expect(page.locator(".dex-overlay")).toContainText(calabresa.nameJa);
  await expectNoUndiscoveredIdentity(page, discovered, "game Dex after the B preset");
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(overflow.sw).toBeLessThanOrEqual(overflow.vw);
  await shot(page, "21-b-game-dex-research-ac");
  await hold(page, 2500);

  // -- reload: still A and C
  await page.reload();
  await page.waitForSelector(".app-frame");
  ({ section, titles } = await researchTitles());
  expect(titles.sort()).toEqual([LABEL_A, LABEL_C]);
  await shot(page, "22-b-game-dex-after-reload");
  const inGame = JSON.parse((await stored(page))!);
  expect(inGame.futureTopLevel).toEqual({ keep: true });
  expect(inGame.missionBest).toEqual({ "lunch-rush": 640 });

  // -- back in the editor the save reads fine (2 entries, no pending change), then restore the original raw
  await page.goto(editorUrl());
  await expect(page.getByRole("main")).toContainText("読み取り可");
  await expect(page.getByText(/変更: 0 件/)).toBeVisible();
  await expect(page.locator("[data-research-entries]")).toHaveAttribute("data-research-entries", "2");
  await openTab(page, "バックアップ");
  await expect(page.locator('[data-backup-slot="original"]')).toContainText("save あり");
  await page.locator('[data-backup-slot="original"]').getByRole("button", { name: /この backup に戻す/ }).click();
  await page.locator('[data-backup-slot="original"]').getByRole("button", { name: "復元する" }).click();
  await expect(page.getByRole("status").last()).toContainText("復元しました");
  expect(await stored(page)).toBe(SEED_RAW);
  await shot(page, "23-b-restored");
});

test("the editor scrolls vertically on a phone: every tab reaches its bottom, the way back to the game is reachable", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, { [PREVIEW_KEY]: SEED_RAW });
  await page.goto(editorUrl());
  await expect(page.getByRole("main", { name: "DEV State Editor" })).toBeVisible();
  // html / body / #root are locked to the viewport by the game's shell: the editor itself must be the scroller.
  const scroller = page.locator(".dse");
  for (const tab of ["Pitz・Hint", "材料", "レシピ"]) {
    const tabButton = page.getByRole("tab", { name: new RegExp(tab) });
    if (await tabButton.count()) await tabButton.first().click();
    const state = await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight, locked: getComputedStyle(el).overflowY };
    });
    expect(state.locked, tab).toBe("auto");
    if (state.max > 0) expect(state.top, `${tab}: scrolled to the bottom`).toBeGreaterThanOrEqual(state.max - 1);
    await scroller.evaluate((el) => (el.scrollTop = 0));
  }
  // The long list scrolls by touch-like wheel input too, and the back link can be brought into view and pressed.
  await page.mouse.move(195, 400);
  await page.mouse.wheel(0, 3000);
  const back = page.getByRole("link", { name: "ゲームへ戻る" });
  await back.scrollIntoViewIfNeeded();
  await expect(back).toBeInViewport();
});
