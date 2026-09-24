import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { playFullMargheritaRound, failMissionOrderMissingSauce } from "../../../e2e/gestures";
import { SAVE_KEY, futureSaveC } from "../fixtures";

/**
 * PR #206 Forward-Compat Deployment Readiness Fresh Audit -- real-browser session.
 * Seeds the future (C) save once, then drives the build under test (SIM_BUILD_LABEL, served from
 * SIM_TREE by ../playwright.config.ts) through: boot (EP4 catch-up) -> pizza completed -> Shop
 * restock -> Lunch Rush run to RESULT -> HOME -> reload. Dumps the raw save after every step.
 */

const LABEL = process.env.SIM_BUILD_LABEL ?? "unknown";
const OUT = process.env.SIM_E2E_OUT;

const readSave = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), SAVE_KEY);

function summarize(r: any) {
  const dex: any[] = r?.dex ?? [];
  const owned: string[] = r?.ownedIngredientIds ?? [];
  return {
    unlockedForShopIngredientIds: r?.unlockedForShopIngredientIds ?? null,
    lifetimePitzEarned: r?.lifetimePitzEarned ?? null,
    futureMeta: r?.futureMeta ?? null,
    dexFutureRecipeA: dex.some((e) => e.recipeId === "future-recipe-a"),
    dexFutureRecipeB: dex.some((e) => e.recipeId === "future-recipe-b"),
    ownedFutureIngredientA: owned.includes("future-ingredient-a"),
    inventoryFutureIngredientA: r?.inventory?.["future-ingredient-a"] ?? null,
    ledgerFutureRecipeA: (r?.starterGrantClaimedRecipeIds ?? []).includes("future-recipe-a"),
    missionBest: r?.missionBest ?? null,
    pitzBalance: r?.pitzBalance ?? null,
    starterGrantClaimedRecipeIds: r?.starterGrantClaimedRecipeIds ?? null,
    dexTimesMade: Object.fromEntries(dex.map((e) => [e.recipeId, e.timesMade])),
  };
}

test("future entitlement save through a full session", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", (d) => d.accept());
  const steps: any[] = [];
  const snap = async (step: string, extra: Record<string, unknown> = {}) =>
    steps.push({ step, ...extra, save: summarize(await readSave(page)) });

  await page.addInitScript(
    ({ key, save }) => {
      if (sessionStorage.getItem("__sim_seeded_once")) return;
      sessionStorage.setItem("__sim_seeded_once", "1");
      localStorage.setItem(key, JSON.stringify(save));
    },
    { key: SAVE_KEY, save: futureSaveC() },
  );

  // 1. boot (EP4 catch-up write on mount)
  await page.goto("/?missionDuration=20");
  await page.waitForSelector(".app-frame");
  const dexPill = await page.locator(".app-header__dex-pill").innerText();
  await snap("1 boot + EP4 catch-up", { dexPill });

  // 2. pizza completed (FREE margherita -> RESULT, REGISTER_TO_DEX)
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await playFullMargheritaRound(page);
  await page.waitForSelector(".result-panel__actions");
  await snap("2 pizza completed (margherita)");
  await page.getByRole("button", { name: /ホーム/ }).first().click();
  await page.waitForSelector(".app-frame");

  // 3. Shop: restock the first affordable owned item
  await page.getByRole("button", { name: /ショップ/ }).click();
  let restocked: string | null = null;
  const tabs = page.locator(".shop-filter-tabs [role=tab], .shop-filter-tabs button");
  const tabCount = await tabs.count();
  for (let i = -1; i < tabCount && !restocked; i++) {
    if (i >= 0) await tabs.nth(i).click();
    const row = page
      .locator(".shop-item", { has: page.locator(".shop-item__restock-button:enabled") })
      .first();
    if (await row.count()) {
      restocked = await row.locator(".shop-item__name").innerText();
      await row.locator(".shop-item__restock-button").click();
    }
  }
  await snap("3 Shop restock", { restocked });
  await page.getByRole("button", { name: "閉じる" }).click();

  // 4. Lunch Rush: one real (FAILED) serve, then let the 20s run expire into RESULT
  await page.getByRole("button", { name: /ランチラッシュ/ }).click();
  await page.getByRole("button", { name: "スタート" }).click();
  await page.getByRole("button", { name: "ピザを作る！" }).click();
  await page.waitForSelector(".pizza-stage");
  await failMissionOrderMissingSauce(page);
  await page.getByRole("button", { name: "次の注文へ" }).click();
  await page.waitForSelector(".mission-result__stats", { timeout: 40_000 });
  await page.waitForTimeout(300);
  await snap("4 Lunch Rush RESULT");

  // 5. HOME
  await page.getByRole("button", { name: /ホームへ/ }).click();
  await page.waitForSelector(".app-frame");
  await snap("5 HOME");

  // 6. restart
  await page.reload();
  await page.waitForSelector(".app-frame");
  await page.waitForTimeout(300);
  await snap("6 reload", { dexPill: await page.locator(".app-header__dex-pill").innerText() });

  if (OUT) writeFileSync(OUT, JSON.stringify({ build: LABEL, steps }, null, 2));
  expect(steps.length).toBe(6);
});
