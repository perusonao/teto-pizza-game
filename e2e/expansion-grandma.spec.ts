import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { chipOnTrayOrPin } from "./support/handPick";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Square Dough E-2 / Multi-Sauce S3 (Issue #521): grandma-pizza, the first recipe on the square tray with TWO required sauces (tomato-sauce + olive-oil),
 * through the NORMAL flow of Free Cooking: DOUGH -> SAUCE (tomato -> olive oil, painted by hand) -> CHEESE (mozzarella 3) -> TOPPING (garlic 2) -> BAKE -> RESULT.
 *
 * - E-AC2: cooked ROUND (the default ○), the exact same ingredients are an ORIGINAL -- no NEW DISCOVERY, nothing in the Dex.
 * - E-AC3: cooked on the TRAY (□, opened by the real derived affordance: 14 credited discoveries), the same ingredients are a NEW DISCOVERY of グランマピザ.
 *
 * Free Cooking judges the bake by the generic window (58-78); grandma's own window is 56-76, so the needle is taken out in their intersection (58-76).
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only; delivered to the Owner directly, never committed).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const OWNED = ["tomato-sauce", "olive-oil", "mozzarella", "garlic"];
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79]];

const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
/** 14 credited discoveries: the tray affordance (derived from grandma-pizza's materials, ladder step 14) is open. */
const DISCOVERED_14 = keysBefore(14).map((recipeId) => ({ recipeId, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }));

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });
const hold = (page: Page, ms = 1500) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${test.info().project.name.replace("iphone-", "")}.png` });
}

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const next = (page: Page) => bar(page).getByRole("button", { name: /次へ/ });

async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

/** One hand-painted pass over the dough: concentric rings, so the sauce clears the Completion Gate's quantity / coverage floor. */
async function paintRings(page: Page, radii: readonly number[], msPerRing = 700) {
  const b = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const at = (r: number, a: number) => ({ x: cx + Math.cos(a) * (r / 100) * b.width, y: cy + Math.sin(a) * (r / 100) * b.height });
  const start = at(radii[0], 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const r of radii) {
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const p = at(r, (i / steps) * Math.PI * 2);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(msPerRing / steps);
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
}

async function place(page: Page, chip: RegExp, count: number, startSpot: number) {
  await (await chipOnTrayOrPin(page, chip)).click();
  for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[(startSpot + i) % SPOTS.length]);
  return startSpot + count;
}

/** Runs #558's square dough end to end (STEP 1 -> STEP 2 -> complete), as the F4-b spec does, on the real page. */
async function completeSquareDough(page: Page) {
  const layer = page.getByTestId("square-dough-layer");
  await expect(layer).toBeVisible();
  await expect(layer).toHaveAttribute("data-step", "1");
  const attr = async (name: string) => (await layer.getAttribute(name)) ?? "";
  const at = async (x: number, y: number) => {
    const b = (await layer.boundingBox())!;
    return { x: b.x + (b.width * x) / 100, y: b.y + (b.height * y) / 100 };
  };
  const drag = async (pts: [number, number][]) => {
    const f = await at(...pts[0]);
    await page.mouse.move(f.x, f.y);
    await page.mouse.down();
    for (const p of pts.slice(1)) {
      const q = await at(...p);
      await page.mouse.move(q.x, q.y, { steps: 6 });
    }
    await page.mouse.up();
  };
  const rows = [14, 26, 38, 50, 62, 74, 86];
  for (let i = 0; i < rows.length; i++) await drag(i % 2 === 0 ? [[10, rows[i]], [50, rows[i]], [90, rows[i]]] : [[90, rows[i]], [50, rows[i]], [10, rows[i]]]);
  for (const [x, y] of [[10, 10], [90, 10], [90, 90], [10, 90]]) await drag([[50, 50], [x, y]]);
  for (let k = 0; k < 8 && (await attr("data-step")) !== "2"; k++) await drag([[12, 12 + k * 10], [88, 12 + k * 10]]);
  expect(await attr("data-step")).toBe("2");
  for (let k = 0; k < 60 && (await attr("data-complete")) !== "true"; k++) {
    const idx = await layer.evaluate((el) => {
      const v = (el.getAttribute("data-thickness") ?? "").split(",").map(Number);
      let best = 0;
      for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i;
      return best;
    });
    const q = await at(((idx % 16) + 0.5) * (100 / 16), (Math.floor(idx / 16) + 0.5) * (100 / 16));
    await page.mouse.move(q.x, q.y);
    await page.mouse.down();
    await page.waitForTimeout(k % 3 === 0 ? 700 : 30);
    await page.mouse.up();
  }
  expect(await attr("data-complete")).toBe("true");
}

/** SAUCE (tomato, then olive oil) -> CHEESE (mozzarella 3) -> TOPPING (garlic 2) -> BAKE -> RESULT. Starts on the SAUCE tab. */
async function cookFromSauce(page: Page, flow: "round" | "tray") {
  await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
  await paintRings(page, [10, 20, 30, 38]);
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await paintRings(page, [14, 26, 36], 500);
  await noOverflow(page, "SAUCE both sauces");
  await capture(page, `${flow}-sauce-both`);
  await hold(page);
  await next(page).click();
  await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
  const spot = await place(page, /モッツァレラ/, 3, 0);
  await next(page).click();
  await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
  expect(await place(page, /にんにく/, 2, spot)).toBe(5);
  await capture(page, `${flow}-topping`);
  await hold(page);
  await bakeToTarget(page, { start: 58, end: 76 });
  await page.waitForSelector(".result-panel");
}

test.describe("grandma-pizza (square tray, two sauces, normal flow)", () => {
  test.setTimeout(240_000);

  test("E-AC2: cooked round, the exact ingredients are an ORIGINAL -- no NEW DISCOVERY, nothing enters the Dex", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const { width, height } = page.viewportSize()!;
    await openWith(page, width, height, { ...base(OWNED), dex: DISCOVERED_14 });
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page); // the default ○: the round dough
    await next(page).click();
    await cookFromSauce(page, "round");
    await expect(page.locator(".result-panel--discovery")).toHaveCount(0);
    await capture(page, "round-result-original");
    await hold(page, 2500);
    await expect(page.locator(".result-panel")).not.toContainText("グランマピザ");
    await noOverflow(page, "ORIGINAL result");
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).not.toContain("grandma-pizza");
    expect(errors).toEqual([]);
  });

  test("E-AC3: cooked on the tray (□, the derived affordance open), the same ingredients are a NEW DISCOVERY of グランマピザ; both sauces were painted; save stays v2", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const { width, height } = page.viewportSize()!;
    await openWith(page, width, height, { ...base(OWNED), dex: DISCOVERED_14 });
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    // the real affordance (14 credited discoveries, derived from grandma-pizza's own materials) offers the ○/□ switch without any Preview query
    await expect(page.getByTestId("pan-switch")).toBeVisible();
    await capture(page, "tray-dough-switch");
    await page.getByRole("radio", { name: "四角い生地" }).click();
    await hold(page);
    await completeSquareDough(page);
    await capture(page, "tray-dough-complete");
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect(page.getByTestId("pan-switch")).toHaveCount(0); // settled: no switch in SAUCE
    await cookFromSauce(page, "tray");

    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("グランマピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "tray-result-new-discovery");
    await hold(page, 3000);

    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-card").filter({ hasText: "グランマピザ" })).toHaveCount(1);
    await noOverflow(page, "Dex");
    await capture(page, "tray-dex");
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain("grandma-pizza");
    expect(JSON.stringify(saved)).not.toMatch(/"pan"|panShape/); // the pan is never stored in a save
    expect(errors).toEqual([]);
  });

  test("the switch is closed before the affordance (a fresh save): no □ offered, so grandma-pizza cannot be found yet", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    await openWith(page, width, height, base(OWNED));
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await expect(page.getByTestId("pan-switch")).toHaveCount(0);
  });
});
