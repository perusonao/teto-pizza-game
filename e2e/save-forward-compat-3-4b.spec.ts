import { test, expect } from "@playwright/test";

/**
 * Progression 2.0 Phase 3-4B: save forward-compat, in a real browser. A save written by a newer
 * build (a future recipe/ingredient, stock, ledger entry and top-level field) is loaded by this
 * build: gameplay must not see the unknown data (Dex pill still counts only this build's recipes),
 * and the real write that happens on mount must carry the unknown data through, across a reload.
 *
 * Progression 2.0 W1 Integration I4b-3: EP4's load-time Starter Grant is retired, so the mount
 * write is now the Discovery Ladder's -- the seeded margherita discovery (Dex count 1; the unknown
 * recipe never reaches gameplay) unlocks `egg` for the Shop, which is persisted to
 * `unlockedForShopIngredientIds` next to the future `calabresa` entitlement.
 */

const FUTURE_SAVE = {
  schemaVersion: 2,
  dex: [
    { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
    { recipeId: "brazilian-calabresa", discovered: true, bestScore: 77, bestStars: 4, timesMade: 1 },
  ],
  pitzBalance: 40,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "calabresa"],
  missionBest: {},
  inventory: { calabresa: 10 },
  starterGrantClaimedRecipeIds: ["brazilian-calabresa"],
  unlockedForShopIngredientIds: ["calabresa"],
  futureLedger: { purchased: ["calabresa"] },
};

test("a save carrying future recipe/ingredient data loads unchanged and survives a real write + reload", async ({
  page,
}) => {
  // Seed exactly once (sessionStorage survives the same-tab reload below), so the reload reads
  // back what this build actually wrote rather than a re-seeded fixture.
  await page.addInitScript((save) => {
    if (sessionStorage.getItem("__e2e_seeded_once")) return;
    sessionStorage.setItem("__e2e_seeded_once", "1");
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(save));
  }, FUTURE_SAVE);

  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/1\/15/);
  await expect(page.getByRole("button", { name: /ランチラッシュ/ })).toBeEnabled();

  const readSave = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("teto-pizza-save-v1") ?? "null"));

  // The mount-time write happened (the ladder unlocked egg) and kept the future data.
  await expect.poll(async () => (await readSave()).unlockedForShopIngredientIds).toContain("egg");
  const written = await readSave();
  expect(written.unlockedForShopIngredientIds).toEqual(["egg", "calabresa"]);
  // Nothing was granted: the retired EP4 ledger is carried through as it was.
  expect(written.starterGrantClaimedRecipeIds).toEqual(["brazilian-calabresa"]);
  expect(written.inventory).toEqual({ calabresa: 10 });
  expect(written.dex).toContainEqual(FUTURE_SAVE.dex[1]);
  expect(written.ownedIngredientIds).toContain("calabresa");
  expect(written.inventory).toMatchObject({ calabresa: 10 });
  expect(written.starterGrantClaimedRecipeIds).toContain("brazilian-calabresa");
  expect(written.futureLedger).toEqual(FUTURE_SAVE.futureLedger);

  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/1\/15/);
  const reloaded = await readSave();
  expect(reloaded.dex).toContainEqual(FUTURE_SAVE.dex[1]);
  expect(reloaded.ownedIngredientIds).toContain("calabresa");
  expect(reloaded.inventory).toMatchObject({ calabresa: 10 });
  expect(reloaded.futureLedger).toEqual(FUTURE_SAVE.futureLedger);
  expect(reloaded.unlockedForShopIngredientIds).toEqual(["egg", "calabresa"]);
});
