import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { PROFILES, ProfileDriver } from "../../e2e/support/layoutProfiles";
import { runOnlyOnWidth } from "../../e2e/support/projectGuard";

/**
 * Discovery 3.0 S1 (OD-D3-8), item I: browser reproduction of the 「図鑑のピザまであと少し」 line.
 *
 * Hypothesis under test: "with the recipe identity (ingredient combination) correct, deliberately failing only the sauce
 * quality turns the INCOMPLETE_MATCH line into a free oracle of recipe correctness".
 *
 * This is behaviour reproduction (real pointer gestures, real Chromium, 390x844), not Human Feel. It observes and records;
 * it asserts only that the run completed and that each case is repeatable. Nothing here changes production.
 * The save is a Dex 3 ladder save (funghi is the one DISCOVERABLE recipe) that also owns pesto, to get a sauce/base mismatch.
 *

 * Run: npx playwright test --config tools/discovery3-s1/playwright.s1.config.ts
 * (kept out of e2e/ on purpose: it is measurement tooling, not a CI regression spec).
 * Outputs: S1_ORACLE_OUT (JSON of every observation), HV_SCREENSHOT_DIR (one RESULT screenshot per case).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const RAW_BAKE = { start: 2, end: 12 };
const SAVE = {
  schemaVersion: 2,
  dex: ["margherita", "bismarck", "breakfast-pizza"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg", "bacon", "mushroom", "pesto"],
  missionBest: {},
  inventory: { egg: 30, bacon: 30, mushroom: 30, pesto: 30 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: ["egg", "bacon", "mushroom", "pesto"],
};

type Pieces = { sauce: RegExp; dab: boolean; cheese: [RegExp, number][]; toppings: [RegExp, number][]; bake?: { start: number; end: number } };
const TOMATO = /トマトソース/;
const PESTO = /ジェノベーゼ/;
const MOZ = /モッツァレラ/;
const MUSH = /マッシュルーム/;
const BASIL = /バジル/;
const EGG = /たまご/;

/** `identity` = what the combination is against the one DISCOVERABLE recipe (funghi = tomato sauce + mozzarella + mushroom). */
const CASES: { id: string; label: string; identity: string; pieces: Pieces }[] = [
  { id: "K0", label: "correct identity, good quality", identity: "exact funghi", pieces: { sauce: TOMATO, dab: false, cheese: [[MOZ, 2]], toppings: [[MUSH, 3]] } },
  { id: "K1", label: "correct identity, sauce quality failure (one dab)", identity: "exact funghi", pieces: { sauce: TOMATO, dab: true, cheese: [[MOZ, 2]], toppings: [[MUSH, 3]] } },
  { id: "K2", label: "WRONG identity (far), same sauce quality failure", identity: "far from funghi", pieces: { sauce: TOMATO, dab: true, cheese: [[MOZ, 2]], toppings: [[BASIL, 1], [EGG, 1]] } },
  { id: "K3a", label: "sauce/base mismatch (pesto), sauce quality failure", identity: "funghi with pesto base", pieces: { sauce: PESTO, dab: true, cheese: [[MOZ, 2]], toppings: [[MUSH, 3]] } },
  { id: "K3b", label: "sauce/base mismatch (pesto), good quality", identity: "funghi with pesto base", pieces: { sauce: PESTO, dab: false, cheese: [[MOZ, 2]], toppings: [[MUSH, 3]] } },
  { id: "K4a", label: "missing ingredient (no mushroom), sauce quality failure", identity: "funghi minus mushroom", pieces: { sauce: TOMATO, dab: true, cheese: [[MOZ, 2]], toppings: [] } },
  { id: "K4b", label: "missing ingredient (no mushroom), good quality", identity: "funghi minus mushroom", pieces: { sauce: TOMATO, dab: false, cheese: [[MOZ, 2]], toppings: [] } },
  { id: "K5a", label: "extra ingredient (+ egg), sauce quality failure", identity: "funghi plus egg", pieces: { sauce: TOMATO, dab: true, cheese: [[MOZ, 2]], toppings: [[MUSH, 3], [EGG, 1]] } },
  { id: "K5b", label: "extra ingredient (+ egg), good quality", identity: "funghi plus egg", pieces: { sauce: TOMATO, dab: false, cheese: [[MOZ, 2]], toppings: [[MUSH, 3], [EGG, 1]] } },
  { id: "K6", label: "ALREADY-KNOWN exact recipe (margherita), sauce quality failure", identity: "exact margherita (discovered)", pieces: { sauce: TOMATO, dab: true, cheese: [[MOZ, 3]], toppings: [[BASIL, 2]] } },
  { id: "K7", label: "correct identity, BAKE quality failure (raw)", identity: "exact funghi", pieces: { sauce: TOMATO, dab: false, cheese: [[MOZ, 2]], toppings: [[MUSH, 3]], bake: RAW_BAKE } },
];

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
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/3\/25/);
}

async function place(page: Page, name: RegExp, spots: [number, number][]) {
  await page.locator(".ingredient-chip").filter({ hasText: name }).first().click();
  for (const [x, y] of spots) await tapDoughPercent(page, x, y);
}

async function cook(page: Page, p: Pieces, from: "HOME" | "RESULT") {
  if (from === "HOME") await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  else await page.getByRole("button", { name: /もう一度じゆうに作る/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: p.sauce }).first().click();
  if (p.dab) await tapDoughPercent(page, 50, 50);
  else await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  const spots: [number, number][] = [[40, 50], [60, 50], [50, 32], [50, 66], [34, 38], [66, 62]];
  let s = 0;
  for (const [name, n] of p.cheese) await place(page, name, spots.slice(s, (s += n)));
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  for (const [name, n] of p.toppings) {
    await place(page, name, spots.slice(s % 6, (s % 6) + n));
    s += n;
  }
  await bakeToTarget(page, p.bake ?? FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

async function observe(page: Page) {
  const txt = async (sel: string) => ((await page.locator(sel).count()) ? ((await page.locator(sel).first().textContent()) ?? "").trim() : null);
  const save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), SAVE_KEY);
  const panelClass = (await page.locator(".result-panel").first().getAttribute("class")) ?? "";
  const body = ((await page.locator(".result-panel").first().textContent()) ?? "").replace(/\s+/g, " ").trim();
  return {
    panelClass,
    kindByLead: await txt(".original-pizza__lead"),
    nearMiss: await txt(".result-near-miss__text"),
    trialNotice: await txt(".original-pizza__trial-notice"),
    dexDiscoveredInSave: save ? save.dex.filter((d: { discovered: boolean }) => d.discovered).length : null,
    pitzBalanceInSave: save ? save.pitzBalance : null,
    inventoryInSave: save ? save.inventory : null,
    resultTextHead: body.slice(0, 140),
  };
}

test.describe("Discovery 3.0 S1 (I): 「あと少し」 browser reproduction", () => {
  test.beforeEach(() => runOnlyOnWidth(test.info(), 390));
  test.setTimeout(Number(process.env.S1_TIMEOUT ?? 600_000));

  test("11 cases x (round 1, retry round 2, fresh-page round 3): observations", async ({ page, browser, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    const out: Record<string, unknown>[] = [];
    const shotDir = process.env.HV_SCREENSHOT_DIR;
    if (shotDir) mkdirSync(shotDir, { recursive: true });
    const only = process.env.S1_CASES?.split(",");
    for (const c of CASES.filter((k) => !only || only.includes(k.id))) {
      await openWithSave(page);
      const before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), SAVE_KEY);
      await cook(page, c.pieces, "HOME");
      const r1 = await observe(page);
      if (shotDir) await page.screenshot({ path: `${shotDir}/${c.id}-round1.png` });
      let r2: Awaited<ReturnType<typeof observe>> | { note: string };
      const retry = page.getByRole("button", { name: /もう一度じゆうに作る/ });
      if (await retry.count()) {
        await cook(page, c.pieces, "RESULT");
        r2 = await observe(page);
      } else r2 = { note: "no 「もう一度じゆうに作る」 button on this result" };
      // a fresh page of the same save: is round 1 repeatable (deterministic)?
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p2 = await ctx.newPage();
      await openWithSave(p2);
      await cook(p2, c.pieces, "HOME");
      const r3 = await observe(p2);
      await ctx.close();
      const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
        (["panelClass", "kindByLead", "nearMiss", "dexDiscoveredInSave", "pitzBalanceInSave"] as const).every((k) => a[k] === b[k]);
      out.push({ ...c, pieces: undefined, pitzBefore: before?.pitzBalance ?? null, round1: r1, round2: r2, round3_fresh: r3, repeatable_round1_vs_fresh: same(r1, r3) });
    }
    const dest = process.env.S1_ORACLE_OUT;
    if (dest) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, JSON.stringify(out, null, 1));
    }
    expect(out.length).toBeGreaterThan(0);
  });
});
