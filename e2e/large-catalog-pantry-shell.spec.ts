import { FAMILY_ROW_PX } from "../src/logic/prepareDock";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { INGREDIENTS } from "../src/data/ingredients";
import { runOnlyOnWidth } from "./support/projectGuard";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Large Catalog UX LC-R3: the 食材庫 entry + pantry sheet SHELL in real layout, at the four Owner viewports
 * (390x844, 360x800, 390x664, 360x640). Contract:
 *  - the pizza stage (and the dock / pager row) is EXACTLY the size it had before R3 -- the "before" numbers are the
 *    LC-R2 harness measurements committed in docs/reports/data/TETO_LARGE-CATALOG-UX_HAND-CAPACITY-COMPARISON.json
 *    (hand22 = today's full tray, measured on the code without the entry);
 *  - the entry sits inside the existing 28px pager row, left of the pager, with a >= 44px hit area that does not
 *    reach the chips above;
 *  - the sheet is a fixed-height dialog (same height with 3 rows or 22 rows), anchored to the bottom, page / body
 *    never scroll, only the list scrolls (also on PageDown), 閉じる stays visible and >= 44px;
 *  - open / close / Escape / focus return; cooking continues afterwards.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const BASELINE = JSON.parse(
  readFileSync(join(process.cwd(), "docs/reports/data/TETO_LARGE-CATALOG-UX_HAND-CAPACITY-COMPARISON.json"), "utf8"),
).viewports as Record<string, { hand22: { page1: { doughDiameter: number; dockHeight: number } } }>;

const SAVE = {
  schemaVersion: 2,
  dex: [],
  pitzBalance: 0,
  ownedIngredientIds: INGREDIENTS.map((i) => i.id),
  missionBest: {},
  inventory: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])),
  starterGrantClaimedRecipeIds: [],
};

async function startFree(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
}
async function toSauce(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
}
async function toTopping(page: Page) {
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

async function layout(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom };
    };
    const chips = [...document.querySelectorAll(".ingredient-chip")].map((c) => c.getBoundingClientRect());
    return {
      stage: r(document.querySelector(".pizza-dough"))?.w ?? null,
      dock: r(document.querySelector(".prepare-dock"))?.h ?? null,
      familyAbove: document.querySelector(".tray-family-row") !== null, // Issue #399: the family filter has its own row above the tray
      row: r(document.querySelector(".ingredient-page-nav")),
      pager: r(document.querySelector(".ingredient-page-nav__pager")),
      entry: r(document.querySelector(".pantry-entry")),
      lowestChip: chips.length ? Math.max(...chips.map((c) => c.bottom)) : null,
      barTop: document.querySelector(".prepare-bake-bar")?.getBoundingClientRect().top ?? null,
      docScrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1 || window.scrollY > 0,
      gameScreenScrolls: (() => {
        const el = document.querySelector(".game-screen");
        return el ? el.scrollHeight > el.clientHeight : false;
      })(),
    };
  });
}

async function sheetFacts(page: Page) {
  return page.evaluate(() => {
    const b = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
    const sheet = b(document.querySelector(".pantry-sheet"));
    const close = b(document.querySelector(".pantry-sheet__close"));
    const list = document.querySelector<HTMLElement>(".pantry-sheet__list")!;
    const lr = list.getBoundingClientRect();
    return {
      sheet: sheet && { x: sheet.x, y: sheet.y, w: sheet.width, h: sheet.height, b: sheet.bottom, r: sheet.right },
      close: close && { y: close.y, h: close.height, w: close.width, b: close.bottom },
      listTop: lr.top,
      listBottom: lr.bottom,
      listScrollable: list.scrollHeight > list.clientHeight + 1,
      listScrollTop: list.scrollTop,
      tiles: document.querySelectorAll(".pantry-tile").length,
      innerH: window.innerHeight,
      innerW: window.innerWidth,
      docScrollW: document.documentElement.scrollWidth,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1 || window.scrollY > 0,
      activeIsClose: document.activeElement === document.querySelector(".pantry-sheet__close"),
    };
  });
}

const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x664", width: 390, height: 664 },
  { id: "360x640", width: 360, height: 640 },
] as const;

for (const width of [390, 360] as const) {
  test(`LC-R3 pantry shell contract at width ${width} (stage unchanged, fixed-height sheet, focus, scroll ownership)`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, width);
    test.setTimeout(180_000);
    for (const vp of VIEWPORTS.filter((v) => v.width === width)) {
      const label = vp.id;
      await startFree(page, vp.width, vp.height);
      await toSauce(page);

      // ---- SAUCE step (3 owned sauces): entry exists (pager row is reserved for the round), sheet with few rows
      const sauceEntry = page.getByRole("button", { name: /食材庫/ });
      await expect(sauceEntry, `${label}: entry on the sauce step`).toBeVisible();
      await sauceEntry.click();
      const fewRows = await sheetFacts(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await toTopping(page);

      // ---- TOPPING step: stage / dock exactly as before R3
      const base = BASELINE[vp.id].hand22.page1;
      const before = await layout(page);
      // Engine-neutral "before R3": the entry is absolutely positioned, so hiding it reproduces the layout without it.
      // Compared inside the same run (exact), so WebKit / Chromium sub-pixel differences cannot matter.
      await page.addStyleTag({ content: ".pantry-entry{display:none !important}" });
      const withoutEntry = await layout(page);
      await page.evaluate(() => {
        for (const style of document.querySelectorAll("style")) if (style.textContent?.includes(".pantry-entry{display:none")) style.remove();
      });
      expect(before.stage, `${label}: pizza stage identical with / without the entry`).toBeCloseTo(withoutEntry.stage!, 1);
      expect(before.dock, `${label}: dock identical with / without the entry`).toBeCloseTo(withoutEntry.dock!, 1);
      expect(before.row!.h, `${label}: pager row identical with / without the entry`).toBeCloseTo(withoutEntry.row!.h, 1);
      // And against the LC-R2 measurement taken on the code without the entry (Chromium): a sanity bound only,
      // wide enough for WebKit's rounding (WebKit measured 246 vs 245.1 at 360x640).
      expect(Math.abs(before.stage! - base.doughDiameter), `${label}: stage within 1.5px of the pre-R3 measurement`).toBeLessThanOrEqual(1.5);
      // Issue #399: where the stage can spare it the family filter takes its own row above the tray and the dock reserves it
      // (FAMILY_ROW_PX); the pizza stays what it was. The dock is the pre-R3 one plus exactly that row, or exactly the pre-R3 one.
      const expectedDock = base.dockHeight + (before.familyAbove ? FAMILY_ROW_PX : 0);
      expect(Math.abs(before.dock! - expectedDock), `${label}: dock within 1.5px of the pre-R3 measurement (+ the family row when it is above)`).toBeLessThanOrEqual(1.5);
      expect(before.row!.h, `${label}: pager row stays 28px`).toBeCloseTo(28, 0);
      expect(before.docScrollW, `${label}: no horizontal overflow`).toBeLessThanOrEqual(before.innerW);
      expect(before.gameScreenScrolls, `${label}: game screen does not scroll`).toBe(false);

      // ---- entry placement: inside the row, left of the pager, hit area >= 44px and clear of the chips
      const e = before.entry!;
      expect(e.x, `${label}: entry inside the row`).toBeGreaterThanOrEqual(before.row!.x - 0.5);
      expect(e.r, `${label}: entry left of the pager group`).toBeLessThanOrEqual(before.pager!.x - 2);
      expect(e.h, `${label}: visual height stays within the row`).toBeLessThanOrEqual(28.5);
      const hitTop = e.y - 8;
      const hitBottom = e.b + 8;
      expect(hitBottom - hitTop, `${label}: hit area >= 44px`).toBeGreaterThanOrEqual(44);
      // Free space above the row is the 6px margin; the last 2px of the hit area may touch the chips' bottom edge.
      expect(before.lowestChip! - hitTop, `${label}: hit area overlaps the chips by at most 2px`).toBeLessThanOrEqual(2.5);
      expect(hitBottom, `${label}: hit area ends at the bake bar`).toBeLessThanOrEqual(before.barTop! + 0.5);
      const cx = e.x + e.w / 2;
      for (const y of [hitTop + 1, e.y + e.h / 2, hitBottom - 1]) {
        const hit = await page.evaluate(([x, yy]) => {
          const el = document.elementFromPoint(x, yy);
          return el?.closest(".pantry-entry") ? "entry" : `${el?.tagName}.${el?.className}`;
        }, [cx, y] as const);
        expect(hit, `${label}: entry receives a tap at y=${y.toFixed(1)} `).toBe("entry");
      }

      // ---- the chip above the entry keeps its own taps: only the bottom <= 2.5px BORDER band of the bottom-row
      // first chip (the 4th chip, directly above the entry column) resolves to the entry; content and everything
      // >= 3px above the chip's bottom edge still resolves to the chip. (Audit: tools/large-catalog-ux/entry-hitbox-audit.mjs)
      const chip4 = (await page.locator(".ingredient-chip").nth(3).boundingBox())!;
      const probeAt = (x: number, y: number) =>
        page.evaluate(([px, py]) => {
          const el = document.elementFromPoint(px, py);
          return el?.closest(".pantry-entry") ? "entry" : el?.closest(".ingredient-chip") ? "chip" : "other";
        }, [x, y] as const);
      expect(await probeAt(cx, chip4.y + chip4.height / 2), `${label}: chip centre stays the chip`).toBe("chip");
      expect(await probeAt(cx, chip4.y + chip4.height - 3), `${label}: 3px above the chip bottom is still the chip`).toBe("chip");
      expect(await probeAt(cx, chip4.y + chip4.height - 12), `${label}: chip content band is the chip`).toBe("chip");

      // ---- open
      await page.getByRole("button", { name: /食材庫/ }).click();
      const dialog = page.getByRole("dialog", { name: /食材庫/ });
      await expect(dialog).toBeVisible();
      const open = await sheetFacts(page);
      expect(open.activeIsClose, `${label}: focus enters the sheet (閉じる)`).toBe(true);
      const expectedH = open.innerH - 20; // LC-R5-b: the shell ceiling (safe-top 0 here), no longer 70dvh
      expect(open.sheet!.h, `${label}: fixed sheet height`).toBeCloseTo(expectedH, 0);
      expect(open.sheet!.b, `${label}: anchored to the bottom`).toBeCloseTo(open.innerH, 0);
      expect(open.sheet!.x).toBeGreaterThanOrEqual(-0.5);
      expect(open.sheet!.r).toBeLessThanOrEqual(open.innerW + 0.5);
      expect(open.sheet!.h, `${label}: height identical with 3 rows (sauce) and 24 rows (topping)`).toBeCloseTo(fewRows.sheet!.h, 0);
      expect(fewRows.listScrollable, `${label}: 3 sauces do not need a scroll`).toBe(false);
      expect(open.listScrollable, `${label}: 24 toppings scroll inside the list`).toBe(true);
      expect(open.close!.y, `${label}: close visible`).toBeGreaterThanOrEqual(0);
      expect(open.close!.b).toBeLessThanOrEqual(open.innerH);
      expect(open.close!.h, `${label}: close >= 44px`).toBeGreaterThanOrEqual(43.5);
      expect(open.docScrollW).toBeLessThanOrEqual(open.innerW);
      expect(open.pageScrolls, `${label}: page does not scroll while open`).toBe(false);
      const during = await layout(page);
      expect(during.stage, `${label}: stage unchanged while the sheet is open`).toBeCloseTo(before.stage!, 1);
      expect(open.tiles, `${label}: owned toppings only (all 27 owned here)`).toBe(27);

      // ---- scroll ownership: PageDown on the focused list scrolls the list, never the page
      await page.locator(".pantry-sheet__list").focus();
      await page.keyboard.press("PageDown");
      await expect.poll(async () => (await sheetFacts(page)).listScrollTop, { message: `${label}: list scrolled`, timeout: 4000 }).toBeGreaterThan(0);
      const scrolled = await sheetFacts(page);
      expect(scrolled.pageScrolls, `${label}: PageDown did not scroll the page`).toBe(false);
      expect(scrolled.close!.y, `${label}: close pinned after scroll`).toBeCloseTo(open.close!.y, 0);

      // ---- close: Escape closes, focus returns to the entry, layout identical, cooking continues
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => document.activeElement?.classList.contains("pantry-entry")), `${label}: focus returns to the entry`).toBe(true);
      const after = await layout(page);
      expect(after.stage).toBeCloseTo(before.stage!, 1);
      expect(after.dock).toBeCloseTo(before.dock!, 1);
      const placedBefore = await page.locator(".pizza-topping").count();
      await page.locator(".ingredient-chip:not([disabled])").first().click(); // any hand topping (Hand ON: the tray holds 12 of the 24)
      await tapDoughPercent(page, 45, 60);
      await expect(page.locator(".pizza-topping")).toHaveCount(placedBefore + 1);

      // ---- close button also closes; a second open works
      await page.getByRole("button", { name: /食材庫/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
}
