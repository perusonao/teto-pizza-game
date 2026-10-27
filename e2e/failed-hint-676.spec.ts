import { expect, test, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";

/**
 * Issue #676 (C1 / C3): the bake-FAILED card's 「💡 ヒントを見る」 and the targetless ORIGINAL note, on the states a production
 * player reaches (no test hook): a fresh save through HOME 「レシピ発見」, and a Research round from the Dex. Chromium 390×844 /
 * 360×800 (the iphone-* projects); the WebKit shards run it in CI. Checks layout (no page scroll, nothing overlapping the
 * action row, a margin left), the click (the existing retry-with-hint: a new PREPARE with the sheet open), that the sheet equals
 * the one the ORIGINAL card opens, and that the card leaks nothing (Contract 2.1, INV-D7).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const RAW_BAKE = { start: 3, end: 15 };
const NOTE = "ヒントを見ながら、次に試す材料を考えてみよう。";
const keysBefore = DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId);
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds as readonly string[]);
const dexOf = (ids: readonly string[]) => ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
const RESEARCH_SAVE = {
  schemaVersion: 2,
  dex: dexOf(["margherita", ...keysBefore, "brazilian-calabresa", "aussie", "chilean-napolitana", "grandma-pizza"]),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function open(page: Page, research: boolean) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    if (v) localStorage.setItem(k, v);
  }, [SAVE_KEY, research ? JSON.stringify(RESEARCH_SAVE) : ""] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  if (research) {
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
  } else {
    await page.getByRole("button", { name: /レシピ発見/ }).first().click();
  }
  await page.waitForSelector(".pizza-stage");
}
async function cook(page: Page, research: boolean, bake: { start: number; end: number }) {
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await (await chipOnTrayOrPin(page, research ? /ナス/ : /バジル/)).click();
  await tapDoughPercent(page, 44, 44);
  await bakeToTarget(page, bake);
  await page.waitForSelector(".result-panel");
}
const geometry = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector(".result-panel") as HTMLElement;
    const actions = document.querySelector(".result-panel__actions") as HTMLElement | null;
    const kids = [...panel.children].filter((c) => !(c as HTMLElement).classList.contains("result-panel__actions")) as HTMLElement[];
    const lastBottom = Math.max(...kids.map((c) => c.getBoundingClientRect().bottom));
    const a = actions?.getBoundingClientRect();
    const hint = [...panel.querySelectorAll("button")].find((b) => /ヒントを見る/.test(b.textContent ?? ""));
    const h = hint?.getBoundingClientRect();
    return {
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      hOverflow: document.documentElement.scrollWidth - innerWidth,
      gap: a ? a.top - lastBottom : null,
      hint: h ? { w: h.width, h: h.height, left: h.left, right: h.right, bottom: h.bottom } : null,
      actionsTop: a?.top ?? null,
      vw: innerWidth,
    };
  });
const sheetText = (page: Page) =>
  page.evaluate(() => {
    const d = document.querySelector('[role="dialog"], .hint-sheet') as HTMLElement | null;
    return d ? d.innerText.split("\n").map((s) => s.trim()).filter(Boolean) : null;
  });
async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

for (const research of [false, true]) {
  const label = research ? "Research" : "targetless Free Cook (fresh save)";
  test(`C1: ${label} FAILED card shows 「💡 ヒントを見る」, fits, opens the same sheet as the ORIGINAL card`, async ({ page }) => {
    test.setTimeout(240_000);
    // FAILED
    await open(page, research);
    await cook(page, research, RAW_BAKE);
    const failed = page.locator(".result-panel--failed");
    await expect(failed).toBeVisible();
    const hint = failed.getByRole("button", { name: /ヒントを見る/ });
    await expect(hint).toHaveCount(1);
    await expect(hint).toHaveText(/💡 ヒントを見る/);
    const g = await geometry(page);
    expect(g.pageScroll, "page scroll").toBeLessThanOrEqual(0);
    expect(g.hOverflow, "horizontal overflow").toBeLessThanOrEqual(0);
    expect(g.hint!.left).toBeGreaterThanOrEqual(0);
    expect(g.hint!.right).toBeLessThanOrEqual(g.vw);
    expect(g.hint!.bottom, "the row never overlaps the action row").toBeLessThanOrEqual(g.actionsTop!);
    expect(g.gap!, "AC-L2: a margin is left above the action row").toBeGreaterThanOrEqual(16);
    await shot(page, `c1-${research ? "research" : "free"}-failed`);
    // AC-P2 / P4: the card leaks nothing
    const text = await failed.innerText();
    const html = await failed.innerHTML();
    expect(text).not.toMatch(/\d+\s*(種|個|件|%)|あと|おしい|近い|遠い|なし|不要|もう少し長く焼|焼きすぎ/);
    expect(html).not.toMatch(/data-(kind|outcome|candidate|target|recipe)/i);
    if (research) {
      for (const needle of ["ペストポッロ", "pesto-pollo", "ペスト", "pesto"]) {
        expect(text, needle).not.toContain(needle);
        expect(html, needle).not.toContain(needle);
      }
    }
    // the click = the existing retry-with-hint: a new PREPARE with the sheet open
    await hint.click();
    await page.waitForSelector(".pizza-stage");
    await expect(page.locator(".result-panel")).toHaveCount(0);
    await page.waitForSelector('[role="dialog"], .hint-sheet');
    const fromFailed = await sheetText(page);
    expect(fromFailed).not.toBeNull();
    await shot(page, `c1-${research ? "research" : "free"}-sheet-after-failed`);
    // ORIGINAL: the existing 「ヒントを見る」 opens the same sheet (AC-P1)
    await open(page, research);
    await cook(page, research, FREE_BAKE);
    await page.locator(".result-panel--original").getByRole("button", { name: /ヒントを見る/ }).click();
    await page.waitForSelector('[role="dialog"], .hint-sheet');
    expect(await sheetText(page)).toEqual(fromFailed);
  });
}

test("C3: the targetless ORIGINAL note is the fixed sentence, under the hint row, and the card still fits", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, false);
  await cook(page, false, FREE_BAKE);
  const card = page.locator(".result-panel--original");
  await expect(card).toBeVisible();
  const note = card.locator(".original-pizza__note");
  await expect(note).toHaveText(NOTE);
  await expect(card).not.toContainText("図鑑のピザと同じ組み合わせ");
  const hint = card.getByRole("button", { name: /ヒントを見る/ });
  await expect(hint).toHaveCount(1);
  const noteBox = (await note.boundingBox())!;
  const hintBox = (await hint.boundingBox())!;
  expect(noteBox.y, "the note sits under the hint row").toBeGreaterThanOrEqual(hintBox.y + hintBox.height - 1);
  const g = await geometry(page);
  expect(g.pageScroll).toBeLessThanOrEqual(0);
  expect(g.hOverflow).toBeLessThanOrEqual(0);
  expect(g.gap!).toBeGreaterThanOrEqual(16);
  // no Notebook button / Dex bridge on a targetless card (C2 / C5 stay out)
  await expect(card.getByRole("button", { name: /試作ノート|図鑑|研究/ })).toHaveCount(0);
  await shot(page, "c3-free-original");
});
