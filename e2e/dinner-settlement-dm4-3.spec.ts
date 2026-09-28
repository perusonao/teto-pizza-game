import { expect, test } from "@playwright/test";
import { cookDinnerPizza, DM_A, dinnerSave, nextDinnerPizza, openDinnerDetail, openWithSave, readSave } from "./support/dinner";

/**
 * Dinner Mission DM-4-3: the CLEAR settlement, end to end in a real browser, with the SHIPPED
 * (untuned) reward table -- wiring is on, balance activation is not (OD-DM5-5): a CLEAR is recorded
 * in `dinnerMissionRecords` in the same save write as everything else, pays 0 Pitz and keeps the
 * first-clear right; a reload settles nothing; a broken saved record is never overwritten (its
 * mission is blocked) while the rest of the progress is still saved. Duration / S come from the
 * DEV/Preview-only query (the dev server is a DEV build).
 */

const RUN = "?dinnerDuration=900&dinnerMinStars=1";
const overlay = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "ディナーミッション結果" });

async function clearDmA(page: import("@playwright/test").Page) {
  await openDinnerDetail(page, /ディナーミッション 1/);
  await page.getByRole("button", { name: /スタート/ }).click();
  const order = ["funghi", "margherita", "breakfast-pizza", "bismarck"] as const;
  for (const [i, id] of order.entries()) {
    await cookDinnerPizza(page, id);
    if (i < order.length - 1) await nextDinnerPizza(page);
  }
  await expect(overlay(page)).toContainText("DINNER CLEAR!");
}

test("a CLEAR is recorded with its settlement (0 Pitz under the untuned table); reload never re-settles", async ({ page }) => {
  test.setTimeout(300_000);
  await openWithSave(page, dinnerSave([...DM_A]), RUN);
  const before = await readSave(page);
  expect(before).not.toHaveProperty("dinnerMissionRecords");

  await clearDmA(page);
  await expect.poll(async () => (await readSave(page)).dinnerMissionRecords?.["dm-a"]?.clears).toBe(1);
  const first = await readSave(page);
  const record = first.dinnerMissionRecords["dm-a"];
  expect(record).toMatchObject({ revision: 1, clears: 1, bestTier: null, firstClearRewarded: false });
  expect(record.bestClearMs).toBeGreaterThan(0);
  expect(first.pitzBalance).toBe(before.pitzBalance); // untuned: no payout
  expect(first.dex).toEqual(before.dex); // no Dex write
  expect(first.inventory.egg).toBe(before.inventory.egg - 2); // the same write carried the consumption

  // The CLEAR overlay being shown again / a reload settles nothing.
  await page.reload();
  await page.waitForSelector(".app-frame");
  const reloaded = await readSave(page);
  expect(reloaded.dinnerMissionRecords).toEqual(first.dinnerMissionRecords);
  expect(reloaded.pitzBalance).toBe(first.pitzBalance);
});

test("a broken saved record blocks only its mission: the CLEAR writes no record over it, other progress is saved", async ({ page }) => {
  test.setTimeout(300_000);
  const broken = { revision: 1, clears: -1, bestClearMs: "x", bestTier: "PLATINUM", firstClearRewarded: "yes" };
  await openWithSave(page, { ...dinnerSave([...DM_A]), dinnerMissionRecords: { "dm-a": broken } }, RUN);
  const before = await readSave(page);
  await clearDmA(page);
  await expect.poll(async () => (await readSave(page)).inventory.egg).toBe(before.inventory.egg - 2);
  const after = await readSave(page);
  expect(after.dinnerMissionRecords).toEqual({ "dm-a": broken });
  expect(after.pitzBalance).toBe(before.pitzBalance);
});
