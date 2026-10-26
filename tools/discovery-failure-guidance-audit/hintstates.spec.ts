import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DISCOVERY_LADDER } from "../../src/data/discoveryLadder";
import { INGREDIENTS } from "../../src/data/ingredients";
import { RECIPES } from "../../src/data/recipes";
import { startTargetlessFreeCook } from "../../e2e/support/startFreeCook";

/** Issue #676: the hint sheet a targetless Free Cook shows, per pool state (observation only). */
const OUT_DIR = process.env.OUT_DIR ?? "docs/reports/screenshots/discovery-failure-guidance";
const SAVE_KEY = "teto-pizza-save-v1";
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds as readonly string[]);
const keysBefore = DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId);
const dexOf = (ids: readonly string[]) => ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
const ALL = INGREDIENTS.map((i) => i.id);
const base = {
  schemaVersion: 2,
  pitzBalance: 999,
  missionBest: {},
  starterGrantClaimedRecipeIds: [] as string[],
};
const STATES: Record<string, object> = {
  // one recipe left to find with the owned materials (the earlier audit save): the sheet picks it automatically
  TARGET_auto: { ...base, dex: dexOf(["margherita", ...keysBefore, "brazilian-calabresa", "aussie", "chilean-napolitana", "grandma-pizza"]), ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials], inventory: Object.fromEntries(materials.map((m) => [m, 30])), unlockedForShopIngredientIds: materials },
  // everything owned, only margherita known: many recipes can be found
  OPEN_POOL: { ...base, dex: dexOf(["margherita"]), ownedIngredientIds: ALL, inventory: Object.fromEntries(ALL.map((m) => [m, 30])), unlockedForShopIngredientIds: ALL },
  // every recipe discovered
  COMPLETE: { ...base, dex: dexOf(RECIPES.map((r) => r.id)), ownedIngredientIds: ALL, inventory: Object.fromEntries(ALL.map((m) => [m, 30])), unlockedForShopIngredientIds: ALL },
};
for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 800 }] as const) {
  test(`hint states ${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const out: Record<string, unknown> = {};
    for (const [name, save] of Object.entries(STATES)) {
      await page.setViewportSize(vp);
      await page.goto("icons/icon-16.png");
      await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(save)] as const);
      await page.goto("/");
      await page.waitForSelector(".app-frame");
      await startTargetlessFreeCook(page);
      await page.waitForSelector(".pizza-stage");
      const btn = page.getByRole("button", { name: /^ヒント$|💡 ?ヒント$|ヒント/ }).first();
      await btn.click();
      await page.waitForTimeout(300);
      out[name] = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"], .hint-sheet') as HTMLElement | null;
        return d ? { text: d.innerText.split("\n").map((s) => s.trim()).filter(Boolean), buttons: [...d.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").replace(/\s+/g, " ").trim()) } : null;
      });
      await page.screenshot({ path: `${OUT_DIR}/hintstate-${name}-${vp.width}x${vp.height}.png` });
    }
    writeFileSync(`${OUT_DIR}/hintstates-${vp.width}x${vp.height}.json`, JSON.stringify(out, null, 2));
  });
}
