import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DISCOVERY_LADDER } from "../../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { chipOnTrayOrPin } from "../../e2e/support/handPick";
import { startTargetlessFreeCook } from "../../e2e/support/startFreeCook";

/**
 * Issue #676 audit: capture the real RESULT screens a player sees after NOT discovering a recipe, in a Research round
 * and in a targetless Free Cook round (ORIGINAL and bake-FAILED), plus the exits they offer. Observation only.
 * Output: OUT_DIR/*.json (visible text + buttons per screen) and PNGs.
 */
const OUT_DIR = process.env.OUT_DIR ?? "docs/reports/screenshots/discovery-failure-guidance";
const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const RAW_BAKE = { start: 3, end: 15 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds as readonly string[]);
const discovered = [...keysBefore(25), "brazilian-calabresa", "aussie", "chilean-napolitana", "grandma-pizza"];
const SAVE = {
  schemaVersion: 2,
  dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function open(page: Page, vp: { width: number; height: number }) {
  await page.setViewportSize(vp);
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}
async function startResearch(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
}
async function cook(page: Page, toppings: RegExp[], bake: { start: number; end: number }) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  let i = 0;
  for (const t of toppings) {
    await (await chipOnTrayOrPin(page, t)).click();
    await tapDoughPercent(page, 38 + (i % 3) * 12, 40 + Math.floor(i / 3) * 16);
    i += 1;
  }
  await bakeToTarget(page, bake);
  await page.waitForSelector(".result-panel");
}
const collect = async (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector(".result-panel") as HTMLElement | null;
    const names = (root: ParentNode) => [...root.querySelectorAll("button")].filter((b) => (b as HTMLElement).offsetParent !== null).map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").replace(/\s+/g, " ").trim());
    return {
      className: panel?.className ?? null,
      text: panel?.innerText.split("\n").map((s) => s.trim()).filter(Boolean) ?? [],
      panelButtons: panel ? names(panel) : [],
      pageButtons: names(document.body),
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight,
    };
  });

const SCENARIOS = [
  { id: "research-original", research: true, toppings: [/ナス/], bake: FREE_BAKE },
  { id: "research-failed-raw", research: true, toppings: [/ナス/], bake: RAW_BAKE },
  { id: "free-original", research: false, toppings: [/ナス/], bake: FREE_BAKE },
  { id: "free-failed-raw", research: false, toppings: [/ナス/], bake: RAW_BAKE },
] as const;

for (const vp of VIEWPORTS) {
  for (const sc of SCENARIOS) {
    test(`audit ${sc.id} ${vp.width}x${vp.height}`, async ({ page }) => {
      test.setTimeout(240_000);
      mkdirSync(OUT_DIR, { recursive: true });
      await open(page, vp);
      if (sc.research) await startResearch(page);
      else await startTargetlessFreeCook(page);
      // PREPARE-side guidance on the first step
      await page.waitForSelector(".pizza-stage");
      const prepare = await page.evaluate(() => ({
        orderCard: (document.querySelector(".order-card") as HTMLElement | null)?.innerText.split("\n").map((s) => s.trim()).filter(Boolean) ?? [],
      }));
      await page.screenshot({ path: `${OUT_DIR}/${sc.id}-${vp.width}x${vp.height}-0-prepare.png` });
      await cook(page, [...sc.toppings], sc.bake);
      const result = await collect(page);
      await page.screenshot({ path: `${OUT_DIR}/${sc.id}-${vp.width}x${vp.height}-1-result.png` });
      const exits: Record<string, unknown> = {};
      // exit 1: 💡 ヒントを見る (when offered)
      const hintBtn = page.getByRole("button", { name: /ヒントを見る/ });
      if (await hintBtn.count()) {
        await hintBtn.first().click();
        await page.waitForTimeout(300);
        exits.hintSheet = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"], .hint-sheet') as HTMLElement | null;
          return d ? { text: d.innerText.split("\n").map((s) => s.trim()).filter(Boolean), buttons: [...d.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").replace(/\s+/g, " ").trim()) } : null;
        });
        await page.screenshot({ path: `${OUT_DIR}/${sc.id}-${vp.width}x${vp.height}-2-hint.png` });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
      // exit 2: 試作ノート (Research only)
      const log = page.getByRole("button", { name: /試作ノート/ });
      if (await log.count()) {
        await log.first().click();
        await page.waitForTimeout(300);
        exits.notebook = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]') as HTMLElement | null;
          return d ? { text: d.innerText.split("\n").map((s) => s.trim()).filter(Boolean) } : null;
        });
        await page.screenshot({ path: `${OUT_DIR}/${sc.id}-${vp.width}x${vp.height}-3-notebook.png` });
      }
      writeFileSync(`${OUT_DIR}/${sc.id}-${vp.width}x${vp.height}.json`, JSON.stringify({ scenario: sc.id, viewport: vp, prepare, result, exits }, null, 2));
      expect(true).toBe(true);
    });
  }
}
