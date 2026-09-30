import { test, expect, type Page } from "@playwright/test";
import { completeDoughStep, startFreshMargherita, startLunchRushMission } from "./gestures";
import { dinnerSave, DM_A, openDinnerDetail, openWithSave } from "./support/dinner";
import { mkdirSync } from "node:fs";

/**
 * Cooking Interaction 2.0 OD-CI-1 (Dough Guide Leak Fix): in a real browser, at 390x844 and
 * 360x800, the DOUGH step shows exactly one dashed guide ring and `.sauce-target-guide` exists
 * only on the SAUCE step of rounds that have a Reference (guided); FREE Cooking / Lunch Rush never
 * show it. Set `GUIDE_SHOTS_DIR` to also write the before/after screenshots.
 */

const SHOTS_DIR = process.env.GUIDE_SHOTS_DIR;

async function guides(page: Page) {
  return {
    dough: await page.locator(".dough-target-guide").count(),
    sauce: await page.locator(".sauce-target-guide").count(),
  };
}

async function shot(page: Page, name: string) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const size = page.viewportSize()!;
  await page.locator(".pizza-stage").screenshot({ path: `${SHOTS_DIR}/${name}-${size.width}x${size.height}.png` });
}

async function expectDoughThenSauce(page: Page, label: string, sauceExpected: number) {
  await page.waitForSelector(".pizza-stage");
  await shot(page, `${label}-dough`);
  expect(await guides(page), `${label}: DOUGH`).toEqual({ dough: 1, sauce: 0 });
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click(); // DOUGH -> SAUCE
  await shot(page, `${label}-sauce`);
  expect(await guides(page), `${label}: SAUCE`).toEqual({ dough: 0, sauce: sauceExpected });
  await page.getByRole("button", { name: /次へ/ }).click(); // SAUCE -> CHEESE
  expect(await guides(page), `${label}: CHEESE`).toEqual({ dough: 0, sauce: 0 });
}

test.describe("Dough Guide Leak Fix (OD-CI-1)", () => {
  test("guided Margherita: DOUGH 1 ring, SAUCE keeps the sauce guide, CHEESE none", async ({ page }) => {
    await startFreshMargherita(page);
    await expectDoughThenSauce(page, "guided", 1);
  });

  test("FREE Cooking: DOUGH 1 ring, never a sauce guide", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /フリークッキング/ }).click();
    await expectDoughThenSauce(page, "free-cooking", 0);
  });

  test("Lunch Rush: DOUGH 1 ring, never a sauce guide", async ({ page }) => {
    await startLunchRushMission(page, 600);
    await expectDoughThenSauce(page, "lunch-rush", 0);
  });

  test("Dinner (recipe-free round): DOUGH 1 ring, never a sauce guide", async ({ page }) => {
    await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=900&dinnerMinStars=1");
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await expectDoughThenSauce(page, "dinner", 0);
  });
});
