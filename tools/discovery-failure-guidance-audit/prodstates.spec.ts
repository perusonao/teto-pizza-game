import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DISCOVERY_LADDER } from "../../src/data/discoveryLadder";

/** Issue #676: targetless Free Cook states a PRODUCTION player can reach (HOME 「レシピ発見」, no test hook). Observation only. */
const OUT_DIR = process.env.OUT_DIR ?? "docs/reports/screenshots/discovery-failure-guidance";
const SAVE_KEY = "teto-pizza-save-v1";
const base = { schemaVersion: 2, pitzBalance: 999, missionBest: {}, starterGrantClaimedRecipeIds: [] as string[] };
const dexOf = (ids: readonly string[]) => ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
const step1 = DISCOVERY_LADDER.steps[0];
const STATES: Record<string, object | null> = {
  FRESH_SAVE: null,
  MARGHERITA_ONLY_STARTER: { ...base, dex: dexOf(["margherita"]), ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], inventory: { "tomato-sauce": 9, mozzarella: 9, basil: 9 } },
  REFILL_NO_STOCK: { ...base, dex: dexOf(["margherita"]), ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], inventory: { "tomato-sauce": 0, mozzarella: 0, basil: 0 } },
  SHOP_NEW_UNBOUGHT: { ...base, dex: dexOf(["margherita"]), ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], inventory: { "tomato-sauce": 9, mozzarella: 9, basil: 9 }, unlockedForShopIngredientIds: [...step1.ingredientIds] },
};
test("production-reachable targetless states", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(OUT_DIR, { recursive: true });
  const out: Record<string, unknown> = {};
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, save] of Object.entries(STATES)) {
    await page.goto("icons/icon-16.png");
    await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, v); }, [SAVE_KEY, save ? JSON.stringify(save) : ""] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    const homeButtons = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean));
    const start = page.getByRole("button", { name: /レシピ発見/ }).first();
    if (!(await start.count())) { out[name] = { homeButtons, note: "no レシピ発見 button" }; continue; }
    await start.click();
    await page.waitForTimeout(500);
    const landed = await page.evaluate(() => ({ stage: !!document.querySelector(".pizza-stage"), dex: !!document.querySelector(".dex-overlay"), research: !!document.querySelector('[data-testid="research-context"]') }));
    let hint: unknown = null;
    if (landed.stage) {
      await page.getByRole("button", { name: /ヒント/ }).first().click();
      await page.waitForTimeout(300);
      hint = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"], .hint-sheet') as HTMLElement | null;
        return d ? d.innerText.split("\n").map((s) => s.trim()).filter(Boolean) : null;
      });
      await page.screenshot({ path: `${OUT_DIR}/prod-${name}-hint-390x844.png` });
    }
    out[name] = { homeButtons: homeButtons.slice(0, 8), landed, hint };
  }
  writeFileSync(`${OUT_DIR}/prodstates-390x844.json`, JSON.stringify(out, null, 2));
});
