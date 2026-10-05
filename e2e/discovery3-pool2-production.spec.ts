import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Discovery 3.0 PR-4b-B: the first production Discovery pool > 1, played for real (a pool of 3 since TQ-1D).
 *
 * The save is the Dex 12 ladder save (onion just unlocked and stocked): pizza-portuguesa,
 * brazilian-calabresa and (TQ-1D) the no-sauce aussie are all DISCOVERABLE. The Dex shows ONE aggregated unknown (no count, name,
 * identity or per-candidate hint), the hint sheet names no recipe and sells nothing, and
 * FREE Cooking -> a trial -> a retry -> NEW RECIPE DISCOVERED -> the Dex works, with the Dex pill
 * counting 27 recipes. Finding the non-credit calabresa first leaves one candidate (the hint is back);
 * the W1 ladder step is unchanged. Runs on both iPhone widths (390x844 / 360x800).
 *
 * Optional output: HV_SCREENSHOT_DIR.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const LADDER: [string, string[]][] = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]],
];
const materials = [...LADDER.flatMap(([, m]) => m), "onion"];
const SAVE = {
  schemaVersion: 2,
  dex: LADDER.map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};

const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function openWithSave(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    localStorage.setItem("teto.dev.hint5Ladder", "0");
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/12\/32/);
}

async function capture(page: Page, name: string, projectName: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${projectName}.png` });
}

/** Selects a tray chip, paging the tray (the free-cook tray has several pages). */
async function pickChip(page: Page, name: RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name }).first();
  const prev = page.getByRole("button", { name: "前のページ" });
  const next = page.getByRole("button", { name: "次のページ" });
  for (let i = 0; i < 6 && (await prev.isEnabled().catch(() => false)); i += 1) await prev.click();
  for (let i = 0; i < 6 && !(await chip.isVisible()); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await chip.click();
}

/** One FREE Cooking round: sausage x`sausage`, onion x2, olive x2, oregano x`oregano`, no cheese. */
async function cookCalabresa(page: Page, opts: { oregano: number; from: "HOME" | "RESULT" }) {
  if (opts.from === "HOME") await startTargetlessFreeCook(page);
  else await page.getByRole("button", { name: /もう一度試す/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // no cheese
  let spot = 0;
  for (const [name, n] of [[/ソーセージ/, 3], [/たまねぎ/, 2], [/ブラックオリーブ/, 2], [/オレガノ/, opts.oregano]] as [RegExp, number][]) {
    if (n === 0) continue;
    await pickChip(page, name);
    for (let i = 0; i < n; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

test.describe("Discovery 3.0 PR-4b-B: production pool 2 (portuguesa beside calabresa)", () => {
  test.setTimeout(240_000);

  test("Dex: three Research cards (no aggregate card), 32 slots, no hint entrance, no count; Free Cooking's sheet names nothing", async ({ page }, testInfo) => {
    await openWithSave(page);
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    // #346 S4: both candidates are registered Research Entries -> their own cards, no aggregate card.
    await expect(page.locator("[data-dex-aggregated]")).toHaveCount(0);
    const research = page.locator(".dex-overlay__research");
    await expect(research.locator(".dex-research-card")).toHaveCount(3);
    await expect(research).not.toContainText(/[0-9]/);
    await expect(page.locator(".dex-overlay__chapter .dex-card")).toHaveCount(32);
    await expect(page.getByRole("button", { name: /ヒントを見る/ })).toHaveCount(0);
    await expect(page.locator('.dex-overlay__chapter [data-dex-state="DISCOVERABLE"]')).toHaveCount(0);
    const body = await page.locator(".dex-overlay").innerText();
    expect(body).not.toContain("ブラジリアン");
    expect(body).not.toContain("ポルトゲーザ");
    expect(body).not.toContain("オージー");
    // The onion step also opens the no-sauce technique's affordance: the Dex shows only its 「？？？」 + riddle, never its name.
    expect(body).not.toMatch(/ソースなし|ソース不要/);
    await expect(page.locator("[data-dex-techniques] [data-technique-state]")).toHaveAttribute("data-technique-state", "RIDDLE");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await research.scrollIntoViewIfNeeded();
    await capture(page, "pool2-dex-research-cards", testInfo.project.name);

    await page.getByRole("button", { name: "閉じる" }).click();
    await startTargetlessFreeCook(page);
    await page.getByRole("button", { name: "ヒント", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: /ヒント/ });
    await expect(sheet).toContainText("研究するピザを選ぼう");
    await expect(sheet.getByRole("button", { name: "ヒントをもらう" })).toHaveCount(0);
    await capture(page, "pool2-hint-sheet-open-pool", testInfo.project.name);
  });

  test("FREE Cooking -> trial (recorded) -> retry -> NEW RECIPE DISCOVERED -> Dex: calabresa first, the hint comes back for portuguesa", async ({ page }, testInfo) => {
    await openWithSave(page);
    // Trial: no oregano -- an incomplete attempt. Recorded; the card says nothing about the hidden recipe.
    await cookCalabresa(page, { oregano: 0, from: "HOME" });
    await expect(page.locator(".result-panel--discovery")).toHaveCount(0);
    await expect(page.locator(".result-panel--original")).toBeVisible();
    await capture(page, "pool2-trial-result", testInfo.project.name);
    // Retry with the full set: the discovery.
    await cookCalabresa(page, { oregano: 1, from: "RESULT" });
    await expect(page.locator(".result-panel--discovery")).toBeVisible();
    await expect(page.locator(".result-panel--discovery")).toContainText("ブラジリアン・カラブレーザ");
    await capture(page, "pool2-new-recipe-discovered", testInfo.project.name);

    // #346 S4 (OD-RX-4): portuguesa and aussie are still researchable entries, so the primary CTA is 「次のピザを選んで研究する」
    // (not 「図鑑を見る」); with two left it opens the Dex's anonymous Research cards (no direct pick). The Dex stays reachable.
    await expect(page.getByRole("button", { name: "🔎 次のピザを選んで研究する" })).toBeVisible();
    await expect(page.getByRole("button", { name: "📖 図鑑を見る" })).toHaveCount(0);
    await page.getByRole("button", { name: "🔎 次のピザを選んで研究する" }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay__research .dex-research-card")).toHaveCount(2);
    // Research 2.0: calabresa (B) was just discovered live; its siblings keep their letters (A and C, never A and B).
    expect(await page.locator(".dex-overlay__research .dex-research-card h3").allTextContents()).toEqual([
      "？？？ピザ A（たまねぎ）",
      "？？？ピザ C（たまねぎ）",
    ]);
    await page.locator(".dex-overlay__research").getByRole("button", { name: "？？？ピザ A（たまねぎ）を研究する" }).click();
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
    await capture(page, "pool2-research-next-started", testInfo.project.name);
    page.on("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(/発見 13\s*\/\s*32/);
    // calabresa found; portuguesa and aussie left: a pool of 2 -> no aggregated unknown (both are Research Entries), no per-card hint.
    await expect(page.locator("[data-dex-aggregated]")).toHaveCount(0);
    await expect(page.locator(".dex-overlay__research .dex-research-card")).toHaveCount(2);
    await expect(page.getByRole("button", { name: /ヒントを見る/ })).toHaveCount(0);
    await capture(page, "pool2-dex-after-calabresa", testInfo.project.name);
    // The ladder did not move: the Shop's next material (olive-oil) is still not entitled.
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.unlockedForShopIngredientIds ?? []).not.toContain("olive-oil");
  });
});
