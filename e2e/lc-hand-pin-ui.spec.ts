import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { buildLcApp, serveBuilds } from "./support/lcHandBuild";
import { openFree, PREVIEW_KEY, saveWithToppings, TOPPING_COUNTS, toCheese, toSauce, toTopping } from "./support/lcHandDom";

/**
 * Large Catalog UX LC-R6-c: the Preview Hand / Pin UI on REAL builds. Two Preview builds of this source tree with the HV
 * variant (HAND 9 / HAND 12, `buildLcApp`; production is untouched and covered by `lc-hand-preview-activation.spec.ts`),
 * played at 390x844 and 360x800 for each capacity under the SAME scenario (ABBA order is the Owner's real-device protocol;
 * here both capacities are exercised identically):
 *  - full hand + pin / unpin, the capacity-full notice (no number, overlay at the sheet's bottom edge, 3 s, status region),
 *  - shelf (category) chips + pin, search -> pin keeps the field focused, hand -> ingredient selection -> placement,
 *  - the pin UI does not exist where the hand is inactive (sauce / cheese),
 *  - a Research Target trial (FREE_COOK): reach an ingredient the hand does not hold through the pantry, then bake.
 * Never decides 9 vs 12: it asserts structure, not preference.
 */
const NOTICE = "手元がいっぱいです。使わない食材のピンを外してね";
const BUILDS = [
  ["/h9/", 9],
  ["/h12/", 12],
] as const;

let origin = "";
let closeServer: (() => Promise<void>) | null = null;
let workDir = "";

test.beforeAll(async () => {
  test.setTimeout(240_000);
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-r6c-"));
  const roots: [string, string][] = [];
  for (const [base, variant] of BUILDS) {
    const outDir = path.join(workDir, base.replaceAll("/", ""));
    await buildLcApp({ outDir, base, preview: true, variant }, true);
    roots.push([base, outDir]);
  }
  const server = await serveBuilds(roots);
  origin = server.origin;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer?.();
  if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
});

const notice = (page: Page) => page.locator(".pantry-sheet__notice");
const shown = (page: Page) => page.locator(".pantry-sheet__notice--shown");

async function toppingStep(page: Page, capacity: 9 | 12) {
  await openFree(page, `${origin}/h${capacity}/`, PREVIEW_KEY, saveWithToppings(TOPPING_COUNTS.free22));
  await toSauce(page);
  await toCheese(page);
  await toTopping(page);
}

async function trayNames(page: Page): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    names.push(...(await page.locator(".ingredient-chip__name").allInnerTexts()));
    const next = page.getByRole("button", { name: "次のページ" });
    if ((await next.count()) === 0 || (await next.isDisabled())) break;
    await next.click();
  }
  const first = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 6 && (await first.count()) > 0 && (await first.isEnabled()); i += 1) await first.click();
  return names;
}

async function openPantry(page: Page) {
  await page.getByRole("button", { name: /食材庫/ }).click();
  await page.waitForSelector(".pantry-sheet");
}

async function noOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
}

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, selector).not.toBeNull();
  return b!;
}

for (const [, capacity] of BUILDS) {
  test.describe(`HAND ${capacity}`, () => {
    test(`full hand, pin / unpin, capacity-full notice (overlay, no number, 3 s, status region)`, async ({ page }) => {
      test.setTimeout(150_000);
      await toppingStep(page, capacity);
      // The hand holds exactly `capacity` ingredients over two tray pages.
      expect((await trayNames(page)).length).toBe(capacity);
      await expect(page.locator(".ingredient-page-nav__label")).toHaveText("1 / 2");
      await openPantry(page);
      await noOverflow(page, "pantry open");
      const status = page.getByRole("status");
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveText("");

      // Fill the hand with pins until a NEW pin is refused.
      const toggles = page.locator(".pantry-tile__toggle");
      const total = await toggles.count();
      let refusedAt = -1;
      for (let i = 0; i < total && refusedAt < 0; i += 1) {
        await toggles.nth(i).click();
        if ((await shown(page).count()) > 0) refusedAt = i;
      }
      expect(refusedAt, "a refusal must occur once the hand is full of pins").toBeGreaterThan(0);
      await expect(notice(page)).toHaveText(NOTICE);
      expect(NOTICE).not.toMatch(/[0-9０-９]/);

      // Overlay: inside the sheet's bottom edge and the viewport, and it moved neither the sheet nor the list.
      const vp = page.viewportSize()!;
      const nb = await box(page, ".pantry-sheet__notice");
      const sb = await box(page, ".pantry-sheet");
      expect(nb.y + nb.height).toBeLessThanOrEqual(sb.y + sb.height + 0.5);
      expect(nb.x).toBeGreaterThanOrEqual(0);
      expect(nb.x + nb.width).toBeLessThanOrEqual(vp.width);
      expect(nb.y).toBeGreaterThanOrEqual(0);
      const shownAt = Date.now();
      await expect(shown(page)).toHaveCount(0, { timeout: 5000 });
      const elapsed = Date.now() - shownAt;
      expect(elapsed, "the notice lasts about 3 s").toBeGreaterThan(1500);
      const sheetAfter = await box(page, ".pantry-sheet");
      const listAfter = await box(page, ".pantry-sheet__list");
      expect({ h: sheetAfter.height, y: sheetAfter.y }).toEqual({ h: sb.height, y: sb.y });
      // refuse again, then compare the list box with and without the notice: identical
      await toggles.nth(refusedAt).click();
      await expect(shown(page)).toHaveCount(1);
      const listDuring = await box(page, ".pantry-sheet__list");
      expect(listDuring).toEqual(listAfter);

      // Unpin one from the strip: the notice goes at once, and a new pin is accepted again.
      const strip = page.getByRole("group", { name: "選択中の材料" });
      await strip.getByRole("button", { name: /を外す$/ }).first().click();
      await expect(shown(page)).toHaveCount(0);
      await toggles.nth(refusedAt).click();
      await expect(shown(page)).toHaveCount(0);
      await expect(toggles.nth(refusedAt)).toHaveAttribute("aria-pressed", "true");
      await noOverflow(page, "pantry after pins");
    });

    test(`shelf chips + pin; search -> pin keeps the field; hand -> ingredient selection -> placement`, async ({ page }) => {
      test.setTimeout(150_000);
      await toppingStep(page, capacity);
      const onTray = new Set(await trayNames(page));
      await openPantry(page);

      // Category (shelf) switch, then pin from the filtered list.
      const chips = page.locator(".shelf-chip");
      expect(await chips.count()).toBeGreaterThan(2);
      await page.locator('.shelf-chip[data-shelf="seafood"]').click();
      const seafood = page.locator(".pantry-tile__toggle");
      expect(await seafood.count()).toBeGreaterThan(0);
      await page.locator('.shelf-chip[data-shelf="all"]').click();

      // Search -> pin: the field keeps the focus (and so the keyboard) on a tile press.
      const input = page.getByRole("searchbox", { name: "材料を検索" });
      await input.click();
      await input.fill("ソ");
      await expect(input).toBeFocused();
      const candidates = page.locator(".pantry-tile__toggle");
      const pick = candidates.filter({ hasText: /ソーセージ/ }).first();
      await expect(pick).toBeVisible();
      await pick.click();
      await expect(pick).toHaveAttribute("aria-pressed", "true");
      await expect(input, "keyboard rule: the search field keeps the focus").toBeFocused();
      await expect(input).toHaveValue("ソ");
      await input.fill("");

      // Hand -> ingredient selection: pin an ingredient the tray did not hold, it appears on the hand, select + place it.
      const names = await page.locator(".pantry-tile__name").allInnerTexts();
      const outside = names.find((n) => !onTray.has(n) && n !== "ソーセージ");
      expect(outside, "an owned ingredient outside the hand").toBeTruthy();
      await page.locator(".pantry-tile__toggle").filter({ hasText: outside! }).first().click();
      await page.getByRole("button", { name: "閉じる" }).click();
      await page.waitForSelector(".pantry-sheet", { state: "detached" });
      const now = await trayNames(page);
      expect(now).toContain(outside!);
      const chip = page.locator(".ingredient-chip").filter({ hasText: outside! }).first();
      const nextBtn = page.getByRole("button", { name: "次のページ" });
      for (let i = 0; i < 4 && !(await chip.isVisible()); i += 1) await nextBtn.click();
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      const before = await page.locator(".pizza-topping").count();
      await tapDoughPercent(page, 55, 45);
      await expect.poll(() => page.locator(".pizza-topping").count()).toBe(before + 1);
      await noOverflow(page, "after selection + placement");
    });

    test(`the pin UI does not exist where the hand is inactive (sauce / cheese steps)`, async ({ page }) => {
      test.setTimeout(120_000);
      await openFree(page, `${origin}/h${capacity}/`, PREVIEW_KEY, saveWithToppings(TOPPING_COUNTS.free22));
      await toSauce(page);
      for (const step of ["sauce", "cheese"] as const) {
        const entry = page.getByRole("button", { name: /食材庫/ });
        if ((await entry.count()) > 0) {
          await entry.click();
          await page.waitForSelector(".pantry-sheet");
          expect(await page.locator(".pantry-tile__toggle, .pantry-sheet__pins, .pantry-sheet__notice").count(), `${step}: no pin UI`).toBe(0);
          await expect(page.getByRole("status")).toHaveCount(0);
          await page.getByRole("button", { name: "閉じる" }).click();
          await page.waitForSelector(".pantry-sheet", { state: "detached" });
        }
        if (step === "sauce") await toCheese(page);
      }
    });
  });
}

// ---- The Owner's Preview entry: the existing HV seed `?hv=calabresa-key-free` (all materials owned, one Research Entry) ----
for (const [, capacity] of BUILDS) {
  test(`HAND ${capacity}: Owner Preview seed ?hv=calabresa-key-free -- badge, active hand on FREE Cooking, a Research entry in the Dex`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${origin}/h${capacity}/?hv=calabresa-key-free`);
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".preview-badge")).toContainText(`HAND ${capacity}`);
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    expect(await page.locator(".dex-overlay__research").getByRole("button").count(), "a Research entry to start a trial from").toBeGreaterThan(0);
    await page.getByRole("button", { name: /閉じる|もどる/ }).first().click().catch(() => {});
    await page.goto(`${origin}/h${capacity}/`); // a reload keeps the seeded save (the seed applies to a fresh navigation only)
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /レシピ発見/ }).first().click();
    await page.waitForSelector(".pizza-stage");
    await toSauce(page);
    await toCheese(page);
    await toTopping(page);
    expect((await trayNames(page)).length, "the hand holds exactly the capacity").toBe(capacity);
    await openPantry(page);
    expect(await page.locator(".pantry-tile__toggle").count(), "every owned topping is in the pantry").toBeGreaterThan(capacity);
    await noOverflow(page, "seeded pantry");
  });
}

// ---- Research Target trial (FREE_COOK): the same tray / pantry, reached from the Dex 研究する entry ----
const SAVE_KEY_PREVIEW = PREVIEW_KEY;
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);
const discovered = [...keysBefore(25), "brazilian-calabresa"];
const materials = materialsUpTo(25);
const RESEARCH_SAVE = {
  schemaVersion: 2,
  dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};

for (const [, capacity] of BUILDS) {
  test(`HAND ${capacity}: Research Target trial -- reach an ingredient outside the hand through the pantry, place it, bake to the Research result`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(`${origin}/h${capacity}/icons/icon-16.png`);
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, value);
    }, [SAVE_KEY_PREVIEW, JSON.stringify(RESEARCH_SAVE)] as const);
    await page.goto(`${origin}/h${capacity}/`);
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await page.locator(".dex-overlay__research").getByRole("button", { name: "？？？ピザを研究する" }).click();
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    const bar = page.locator(".prepare-bake-bar");
    await bar.getByRole("button", { name: /次へ/ }).click();
    await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
    await paintSauceRing(page, 25, 16);
    await bar.getByRole("button", { name: /次へ/ }).click();
    await bar.getByRole("button", { name: /次へ/ }).click(); // no cheese

    // The Research trial is a FREE_COOK round: the hand applies. Try an ingredient the hand does NOT hold: it is reached
    // only through the pantry (pin), then selected on the tray and placed. (The research context stays throughout.)
    const held = new Set(await trayNames(page));
    await openPantry(page);
    await expect(page.getByTestId("research-context")).toBeVisible();
    await expect(page.locator(".pantry-tile__toggle").first()).toBeVisible();
    const poolNames = await page.locator(".pantry-tile__name").allInnerTexts();
    const outside = poolNames.find((n) => !held.has(n));
    expect(outside, "Research save owns more than the hand holds (the hand is ACTIVE)").toBeTruthy();
    const outsideTile = page.locator(".pantry-tile__toggle").filter({ hasText: outside! }).first();
    await outsideTile.click();
    await expect(outsideTile).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.waitForSelector(".pantry-sheet", { state: "detached" });
    const chicken = page.locator(".ingredient-chip").filter({ hasText: outside! }).first();
    const next = page.getByRole("button", { name: "次のページ" });
    for (let i = 0; i < 4 && !(await chicken.isVisible()); i += 1) {
      if (!(await next.isEnabled().catch(() => false))) break;
      await next.click();
    }
    await chicken.click();
    await expect(chicken).toHaveAttribute("aria-pressed", "true");
    await tapDoughPercent(page, 40, 50);
    await tapDoughPercent(page, 60, 50);
    await expect(page.getByTestId("research-context")).toBeVisible(); // the Research context is kept in PREPARE
    await bakeToTarget(page, FREE_BAKE);
    await page.waitForSelector(".result-panel");
    await expect(page.locator(".result-panel--original")).toContainText("研究中 ？？？ピザ");
    await noOverflow(page, "research result");
  });
}
