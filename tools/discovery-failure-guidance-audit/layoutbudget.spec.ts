import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DISCOVERY_LADDER } from "../../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { chipOnTrayOrPin } from "../../e2e/support/handPick";
import { startTargetlessFreeCook } from "../../e2e/support/startFreeCook";

/**
 * Issue #676 pre-implementation Gate: layout budget of C1 / C3, measured WITHOUT touching the product: the RESULT DOM is
 * edited inside the browser (page.evaluate) the way the planned change would render it, then measured. Nothing is
 * written to the repository's src; this is an in-page experiment only.
 *  C1: insert the existing hintRow markup (.result-near-miss + .result-near-miss__cta) after .result-panel__headline of the FAILED card.
 *  C3: replace the text of .original-pizza__note on the targetless ORIGINAL card with the adopted sentence.
 */
const OUT_DIR = process.env.OUT_DIR ?? "docs/reports/screenshots/discovery-failure-guidance";
const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const RAW_BAKE = { start: 3, end: 15 };
const C3_TEXT = "ヒントを見ながら、次に試す材料を考えてみよう。";
const keysBefore = DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId);
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds as readonly string[]);
const SAVE = {
  schemaVersion: 2,
  dex: ["margherita", ...keysBefore, "brazilian-calabresa", "aussie", "chilean-napolitana", "grandma-pizza"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};
const bar = (page: Page) => page.locator(".prepare-bake-bar");
async function open(page: Page, vp: { width: number; height: number }, research: boolean) {
  await page.setViewportSize(vp);
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  if (research) {
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
  } else {
    await startTargetlessFreeCook(page); // test hook: this save has a cookable entry; the RESULT card structure is the same ResultPanel
  }
  await page.waitForSelector(".pizza-stage");
}
async function cook(page: Page, bake: { start: number; end: number }) {
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await (await chipOnTrayOrPin(page, /ナス/)).click();
  await tapDoughPercent(page, 44, 44);
  await bakeToTarget(page, bake);
  await page.waitForSelector(".result-panel");
}
const measure = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector(".result-panel") as HTMLElement;
    const actions = document.querySelector(".result-panel__actions") as HTMLElement | null;
    const kids = [...panel.children].filter((c) => !(c as HTMLElement).classList.contains("result-panel__actions")) as HTMLElement[];
    const lastBottom = Math.max(...kids.map((c) => c.getBoundingClientRect().bottom));
    const a = actions?.getBoundingClientRect();
    const hint = panel.querySelector(".result-near-miss__cta") as HTMLElement | null;
    const hr = hint?.getBoundingClientRect();
    const note = panel.querySelector(".original-pizza__note") as HTMLElement | null;
    const nr = note?.getBoundingClientRect();
    const lh = note ? parseFloat(getComputedStyle(note).lineHeight) : NaN;
    return {
      vh: innerHeight,
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      hOverflow: document.documentElement.scrollWidth - innerWidth,
      gapContentToActions: a ? Math.round((a.top - lastBottom) * 10) / 10 : null,
      hintButton: hr ? { h: Math.round(hr.height), w: Math.round(hr.width), top: Math.round(hr.top), bottom: Math.round(hr.bottom), overlapsActions: a ? hr.bottom > a.top : null } : null,
      noteLines: nr && lh ? Math.round((nr.height / lh) * 10) / 10 : null,
      noteHeight: nr ? Math.round(nr.height * 10) / 10 : null,
    };
  });
const HINT_ROW = '<div class="result-near-miss" data-experiment="c1"><button type="button" class="result-near-miss__cta">\u{1F4A1} ヒントを見る</button></div>';

test("layout budget of C1 and C3 (in-page DOM experiment)", async ({ page }) => {
  test.setTimeout(400_000);
  mkdirSync(OUT_DIR, { recursive: true });
  const out: Record<string, unknown> = {};
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
    const key = `${vp.width}x${vp.height}`;
    // C1 on the FAILED cards (Research, targetless)
    for (const research of [true, false]) {
      await open(page, vp, research);
      await cook(page, RAW_BAKE);
      const before = await measure(page);
      await page.evaluate((html) => {
        const head = document.querySelector(".result-panel--failed .result-panel__headline");
        head?.insertAdjacentHTML("afterend", html);
      }, HINT_ROW);
      const after = await measure(page);
      await page.screenshot({ path: `${OUT_DIR}/c1-experiment-${research ? "research" : "free"}-failed-${key}.png` });
      out[`C1_${research ? "research" : "free"}_failed_${key}`] = { before, after };
    }
    // C3 on the targetless ORIGINAL card
    await open(page, vp, false);
    await cook(page, FREE_BAKE);
    const before = await measure(page);
    await page.evaluate((t) => {
      const note = document.querySelector(".result-panel--original .original-pizza__note");
      if (note) note.textContent = t;
    }, C3_TEXT);
    const after = await measure(page);
    await page.screenshot({ path: `${OUT_DIR}/c3-experiment-free-original-${key}.png` });
    out[`C3_free_original_${key}`] = { before, after };
  }
  writeFileSync(`${OUT_DIR}/layoutbudget.json`, JSON.stringify(out, null, 2));
});
