import { test, expect } from "@playwright/test";

/**
 * Dinner Mission DM-4-2 (Issue #274): `dinnerMissionRecords` in a real browser. A save carrying a
 * valid record, a broken record (fail-closed), a future mission id, a future field inside a record
 * and a key outside the id grammar is loaded; the real mount-time write (the Discovery Ladder
 * unlocks `egg` for the seeded margherita discovery, as in save-forward-compat-3-4b.spec.ts) must
 * keep every one of them verbatim, across a reload, while the rest of the game stays playable.
 * Nothing Dinner-specific runs yet (settlement is DM-4-3), so the records must be byte-for-byte
 * what was seeded.
 */

const RECORDS = {
  "dm-a": { revision: 1, clears: 2, bestClearMs: 95000, bestTier: "SILVER", firstClearRewarded: true, futureField: [1, 2] },
  "dm-b": { revision: 1, clears: -3, bestClearMs: "fast", bestTier: "PLATINUM", firstClearRewarded: "yes" },
  "dm-z-future": { revision: 4, clears: 1, bestClearMs: 60000, bestTier: "GOLD", firstClearRewarded: true },
  "Not An Id": { anything: true },
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
  dinnerMissionRecords: RECORDS,
};

test("dinner records (valid, broken, future) survive the real mount write and a reload", async ({ page }) => {
  await page.addInitScript((save) => {
    if (sessionStorage.getItem("__e2e_seeded_once")) return;
    sessionStorage.setItem("__e2e_seeded_once", "1");
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(save));
  }, SAVE);

  await page.goto("/");
  await page.waitForSelector(".app-frame");
  // The rest of the game is not blocked by a broken Dinner record.
  await expect(page.getByRole("button", { name: /ランチラッシュ/ })).toBeEnabled();

  const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem("teto-pizza-save-v1") ?? "null"));

  // The mount-time write happened ...
  await expect.poll(async () => (await readSave()).unlockedForShopIngredientIds).toContain("egg");
  // ... and carried every Dinner record through verbatim (broken one included: never deleted,
  // repaired or replaced; future id, future field and non-id key kept).
  expect((await readSave()).dinnerMissionRecords).toEqual(RECORDS);

  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(page.getByRole("button", { name: /ランチラッシュ/ })).toBeEnabled();
  expect((await readSave()).dinnerMissionRecords).toEqual(RECORDS);
  expect((await readSave()).pitzBalance).toBe(40);
});

test("a save that never met Dinner gets no dinnerMissionRecords key from the mount write", async ({ page }) => {
  const { dinnerMissionRecords: _omit, ...plain } = SAVE;
  void _omit;
  await page.addInitScript((save) => {
    if (sessionStorage.getItem("__e2e_seeded_once")) return;
    sessionStorage.setItem("__e2e_seeded_once", "1");
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(save));
  }, plain);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem("teto-pizza-save-v1") ?? "null"));
  await expect.poll(async () => (await readSave()).unlockedForShopIngredientIds).toContain("egg");
  expect(await readSave()).not.toHaveProperty("dinnerMissionRecords");
});
