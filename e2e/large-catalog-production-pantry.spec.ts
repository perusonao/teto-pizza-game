import { expect, test, type Page } from "@playwright/test";
import { INGREDIENTS } from "../src/data/ingredients";
import { runOnlyOnWidth } from "./support/projectGuard";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * Large Catalog UX LC-R5-c, re-pointed by LC-R6-e: the pin foundation was DORMANT in production (OD-R5c-1); Production now
 * runs the Hand (OD-5 = 12). What stays guarded here is the keyboard contract of the production pantry at the four Owner
 * viewports: the pin UI is live (toggles + 「選択中」 strip), the sheet never grows past the viewport, and with the simulated
 * keyboard (same stand-in `visualViewport` as e2e/large-catalog-pantry-search.spec.ts; K = 338, the real-iPhone shrink)
 * the list keeps >= 1 full result row above the keyboard. The R5-b pixel baselines belong to the Hand-OFF sheet (the pin
 * strip changes the list height), so only the floors are asserted; the OFF geometry is the rollback build's
 * (e2e/lc-hand-preview-activation.spec.ts + the hand-off Vitest project). The file name is kept for history.
 */
const SAVE_KEY = "teto-pizza-save-v1";
const SAVE = {
  schemaVersion: 2,
  dex: [],
  pitzBalance: 0,
  ownedIngredientIds: INGREDIENTS.map((i) => i.id),
  missionBest: {},
  inventory: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])),
  starterGrantClaimedRecipeIds: [],
};
const KEYBOARD_PX = 338;
const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844, sheetH: 824, listH: 617, kbListVisible: 291 },
  { id: "360x800", width: 360, height: 800, sheetH: 780, listH: 573, kbListVisible: 247 },
  { id: "390x664", width: 390, height: 664, sheetH: 644, listH: 437, kbListVisible: 111 },
  { id: "360x640", width: 360, height: 640, sheetH: 620, listH: 413, kbListVisible: 87 },
] as const;

const FAKE_VV = () => {
  class FakeViewport extends EventTarget {
    get width() { return window.innerWidth; }
    get height() { return (window as unknown as { __vvH?: number }).__vvH ?? window.innerHeight; }
    get offsetTop() { return 0; }
    get pageTop() { return 0; }
    get scale() { return 1; }
  }
  const vv = new FakeViewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  (window as unknown as { __setVv: (h: number | null) => void }).__setVv = (h) => {
    (window as unknown as { __vvH?: number }).__vvH = h ?? undefined;
    vv.dispatchEvent(new Event("resize"));
  };
};

async function toTopping(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /レシピ発見/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
}

async function facts(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector(".pantry-sheet")!.getBoundingClientRect();
    const list = document.querySelector(".pantry-sheet__list")!.getBoundingClientRect();
    const vvH = (window as unknown as { __vvH?: number }).__vvH ?? window.innerHeight;
    const bottom = Math.min(list.bottom, vvH);
    const rows = new Set<number>();
    for (const t of document.querySelectorAll(".pantry-tile")) {
      const b = t.getBoundingClientRect();
      if (b.top >= list.top - 0.5 && b.bottom <= bottom + 0.5) rows.add(Math.round(b.top));
    }
    const pantry = document.querySelector(".pantry-sheet")!;
    return {
      sheetH: sheet.height,
      listH: list.height,
      listVisible: Math.max(0, bottom - list.top),
      fullRows: rows.size,
      pinUi: pantry.querySelectorAll(".pantry-tile__toggle, .pantry-tile__pin-badge, .pantry-tile__no-stock, .pantry-sheet__pins, .pantry-tile--editable").length,
      listButtons: document.querySelectorAll(".pantry-sheet__list button, .pantry-sheet__list [aria-pressed]").length,
      text: pantry.textContent ?? "",
      tray: [...document.querySelectorAll(".ingredient-chip")].map((c) => `${c.textContent}|${c.getAttribute("aria-pressed")}`).join(","),
    };
  });
}

for (const width of [390, 360] as const) {
  test(`LC-R6-e production pantry: pin UI live and keyboard floors at width ${width}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, width);
    test.setTimeout(240_000);
    await page.addInitScript(FAKE_VV);
    for (const vp of VIEWPORTS.filter((v) => v.width === width)) {
      await toTopping(page, vp.width, vp.height);
      await page.getByRole("button", { name: /食材庫/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const normal = await facts(page);
      expect(normal.pinUi, `${vp.id}: pin UI is live in production`).toBeGreaterThan(0);
      expect(normal.sheetH, `${vp.id}: sheet fits the viewport`).toBeLessThanOrEqual(vp.sheetH + 0.5);
      expect(normal.listH, `${vp.id}: list keeps a usable height`).toBeGreaterThan(200);

      await page.locator(".pantry-sheet__search-input").focus();
      await page.evaluate((h) => (window as unknown as { __setVv: (h: number) => void }).__setVv(h), vp.height - KEYBOARD_PX);
      await page.waitForFunction(() => document.querySelector(".pantry-sheet")?.classList.contains("pantry-sheet--fit"));
      await expect.poll(async () => (await facts(page)).sheetH).toBeLessThan(vp.sheetH);
      const kb = await facts(page);
      expect(kb.pinUi).toBeGreaterThan(0);
      expect(kb.fullRows, `${vp.id}: >= 1 full result row above the keyboard`).toBeGreaterThanOrEqual(1);
      expect(kb.listVisible, `${vp.id}: keyboard list stays usable`).toBeGreaterThan(60);
      await page.evaluate(() => (window as unknown as { __setVv: (h: number | null) => void }).__setVv(null));
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
}
