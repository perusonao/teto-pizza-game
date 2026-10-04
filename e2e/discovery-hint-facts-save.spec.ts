import { test, expect } from "@playwright/test";

/**
 * Discovery Hint 3.0 (Issue #238), H3-2: the Selectable Hint fact ledger in a real browser. A save
 * carrying `discoveryHintFacts` (known + unknown recipe ids, future fact kinds, a hostile key) next
 * to the legacy `discoveryHintPurchases` is loaded by this build. The real mount-time write (the
 * Discovery Ladder unlocking `egg` for the seeded margherita discovery) must carry both ledgers
 * through unchanged, across a reload. Nothing in the UI reads the new ledger yet (H3-3).
 */

const FACTS = {
  napoletana: ["ing:mozzarella", "tech:fold", "finish:basil-oil:drizzle"],
  "future-unknown-recipe": ["ing:calabresa", "shape:square"],
};

const SAVE = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 }],
  pitzBalance: 40,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  missionBest: {},
  inventory: {},
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: [],
  discoveryHintPurchases: { napoletana: 2, "future-unknown-recipe": 1 },
  discoveryHintFacts: FACTS,
};

test("the fact ledger and the legacy ledger survive a real mount write and a reload; nothing pollutes", async ({ page }) => {
  await page.addInitScript((raw) => {
    if (sessionStorage.getItem("__e2e_seeded_once")) return;
    sessionStorage.setItem("__e2e_seeded_once", "1");
    // A hostile key is injected as raw text so JSON.parse sees it exactly as a crafted save would.
    localStorage.setItem("teto-pizza-save-v1", raw.replace('"discoveryHintFacts":{', '"discoveryHintFacts":{"__proto__":["ing:egg"],'));
  }, JSON.stringify(SAVE));

  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/1\/28/);

  const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem("teto-pizza-save-v1") ?? "null"));
  await expect.poll(async () => (await readSave()).unlockedForShopIngredientIds).toContain("egg");
  const written = await readSave();
  expect(written.schemaVersion).toBe(2);
  expect(written.discoveryHintFacts).toEqual(FACTS);
  expect(written.discoveryHintPurchases).toEqual(SAVE.discoveryHintPurchases);
  // The hostile `__proto__` key was dropped and polluted nothing.
  expect(await page.evaluate(() => Object.keys(Object.prototype).length)).toBe(0);
  expect(written.discoveryHintFacts).not.toHaveProperty("__proto__", ["ing:egg"]);

  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/1\/28/);
  const reloaded = await readSave();
  expect(reloaded.discoveryHintFacts).toEqual(FACTS);
  expect(reloaded.discoveryHintPurchases).toEqual(SAVE.discoveryHintPurchases);
});
