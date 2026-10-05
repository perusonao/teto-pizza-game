import { expect, test, type Page } from "@playwright/test";
import { INGREDIENTS } from "../src/data/ingredients";
import { runOnlyOnWidth } from "./support/projectGuard";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";

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

/**
 * Large Catalog UX LC-R4: shelf filtering inside the active-category pantry, in real layout at the four Owner
 * viewports (390x844, 360x800, 390x664, 360x640). Contract (PR #304 stable-height + Owner OD-R4-1 / OD-R4-2):
 *  - the family chips sit in a FIXED slot between the subtitle and the list; the sheet's outer bounds, header and 閉じる
 *    never move with the filter, the chip row never wraps or grows, only .pantry-sheet__list scrolls;
 *  - the chip row scrolls horizontally on its own (never the page); chips are >= 44px; the list keeps room for rows;
 *  - filtering resets the list scrollTop to 0; reopening starts on 「すべて」;
 *  - sauce / cheese steps (one shelf) show no chip row and (OD-B) no subtitle; the stage / dock geometry never changes;
 *  - the Builder selection is untouched by pantry filtering.
 */

async function shelfFacts(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, b: b.bottom, r: b.right };
    };
    const row = document.querySelector<HTMLElement>(".shelf-chips");
    const list = document.querySelector<HTMLElement>(".pantry-sheet__list")!;
    const chips = [...document.querySelectorAll<HTMLElement>(".shelf-chip")];
    return {
      sheet: rect(document.querySelector(".pantry-sheet")),
      header: rect(document.querySelector(".pantry-sheet__header")),
      close: rect(document.querySelector(".pantry-sheet__close")),
      subtitle: rect(document.querySelector(".pantry-sheet__subtitle")),
      row: rect(row),
      rowScrollW: row?.scrollWidth ?? 0,
      rowClientW: row?.clientWidth ?? 0,
      rowScrollLeft: row?.scrollLeft ?? 0,
      list: rect(list),
      listScrollable: list.scrollHeight > list.clientHeight + 1,
      listScrollTop: list.scrollTop,
      rowInsideList: row ? list.contains(row) : false,
      chipBoxes: chips.map((c) => ({ label: c.textContent, ...rect(c)!, pressed: c.getAttribute("aria-pressed") })),
      tiles: [...document.querySelectorAll(".pantry-tile__name")].map((n) => n.textContent),
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      docScrollW: document.documentElement.scrollWidth,
      scrollX: window.scrollX,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1 || window.scrollY > 0,
    };
  });
}
const same = (a: Record<string, number> | null, b: Record<string, number> | null) => JSON.stringify(a) === JSON.stringify(b);

const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x664", width: 390, height: 664 },
  { id: "360x640", width: 360, height: 640 },
] as const;

for (const width of [390, 360] as const) {
  test(`LC-R4 pantry shelf chips at width ${width} (fixed slot, stable bounds, horizontal chip scroll, list-only scroll)`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, width);
    test.setTimeout(240_000);
    for (const vp of VIEWPORTS.filter((v) => v.width === width)) {
      const label = vp.id;
      await startFree(page, vp.width, vp.height);
      await toSauce(page);

      // ---- SAUCE step: one shelf => no chip row; this is also the "no chips" list height reference
      await page.getByRole("button", { name: /食材庫/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const sauce = await shelfFacts(page);
      expect(sauce.row, `${label}: sauce step has no chip row`).toBeNull();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await toTopping(page);
      const stageBefore = await layout(page);
      // Pick a Builder selection first: pantry filtering must never touch it.
      const basilChip = page.locator(".ingredient-chip:not([disabled])").first(); // a hand topping (Hand ON: the tray holds 12 of the 24)
      await basilChip.click();
      await expect(basilChip).toHaveAttribute("aria-pressed", "true");

      await page.getByRole("button", { name: /食材庫/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const all = await shelfFacts(page);

      // ---- chips: all 24 toppings own 7 shelves => すべて + 7
      expect(all.chipBoxes.map((c) => c.label), `${label}: すべて + represented shelves in authority order`).toEqual([
        "すべて", "肉系", "魚介系", "野菜・きのこ系", "果物系", "ハーブ・香味系", "スパイス・薬味系", "ちょっと変わった材料",
      ]);
      expect(all.chipBoxes[0].pressed).toBe("true");
      expect(all.tiles, `${label}: すべて lists every owned topping`).toHaveLength(27);
      expect(all.rowInsideList, `${label}: chip row is outside the scroll region`).toBe(false);
      expect(all.row!.b, `${label}: chip row sits above the list`).toBeLessThanOrEqual(all.list!.y + 0.5);
      expect(all.row!.y, `${label}: chip row sits below the subtitle`).toBeGreaterThanOrEqual(all.subtitle!.b - 0.5);
      for (const c of all.chipBoxes) {
        expect(c.h, `${label}: chip ${c.label} >= 44px tall`).toBeGreaterThanOrEqual(43.5);
        expect(c.w, `${label}: chip ${c.label} >= 44px wide`).toBeGreaterThanOrEqual(43.5);
      }
      const chipTops = new Set(all.chipBoxes.map((c) => Math.round(c.y)));
      expect(chipTops.size, `${label}: one line of chips (never wraps)`).toBe(1);
      expect(all.rowScrollW, `${label}: chip row scrolls horizontally (${all.rowScrollW} > ${all.rowClientW})`).toBeGreaterThan(all.rowClientW + 8);
      expect(all.rowClientW, `${label}: chip row fits the sheet width`).toBeLessThanOrEqual(all.innerW - 32 + 0.5);
      expect(all.docScrollW, `${label}: no page horizontal overflow`).toBeLessThanOrEqual(all.innerW);
      expect(all.pageScrolls, `${label}: page does not scroll`).toBe(false);

      // ---- list viewport: the chip row costs one 44px chip + padding + gap; the outer sheet is the same as R3
      const expectedH = all.innerH - 20; // LC-R5-b: the shell ceiling (safe-top 0 here), no longer 70dvh
      expect(all.sheet!.h, `${label}: sheet outer height unchanged (R3 rule)`).toBeCloseTo(expectedH, 0);
      expect(sauce.sheet!.h, `${label}: same height as the chip-less sauce sheet`).toBeCloseTo(all.sheet!.h, 0);
      const cost = sauce.list!.h - all.list!.h;
      // LC-R5-b: the topping step (22 owned) now also carries the search row (44px field + 8px gap) above the chips.
      // Pantry / Category Tabs OD-B: the sauce step has no subtitle any more, so its (chip-less) list is one subtitle line
      // (+ the 8px gap) taller than before; the topping step keeps its 「具材」 subtitle. Cost = search + chips + that line.
      expect(cost, `${label}: list viewport loses only the search + chip slots (${cost.toFixed(1)}px)`).toBeGreaterThan(46 + 44);
      expect(cost).toBeLessThan(60 + 60 + 30);
      expect(all.list!.h, `${label}: list still shows about three tile rows`).toBeGreaterThanOrEqual(250);
      expect(all.listScrollable, `${label}: 24 toppings scroll inside the list`).toBe(true);
      expect(all.close!.h).toBeGreaterThanOrEqual(43.5);

      // ---- chip taps hit the chip (nothing overlaps them)
      for (const c of all.chipBoxes.slice(0, 3)) {
        const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".shelf-chip")?.textContent ?? null, [c.x + c.w / 2, c.y + c.h / 2] as const);
        expect(hit, `${label}: ${c.label} receives its own tap`).toBe(c.label);
      }

      // ---- horizontal chip scroll: only the row moves; the last chip is reachable and stays inside the row
      await page.evaluate(() => { document.querySelector(".shelf-chips")!.scrollLeft = 9999; });
      const scrolledRow = await shelfFacts(page);
      expect(scrolledRow.rowScrollLeft, `${label}: row scrolled`).toBeGreaterThan(0);
      expect(scrolledRow.scrollX, `${label}: page did not scroll horizontally`).toBe(0);
      expect(same(scrolledRow.sheet, all.sheet) && same(scrolledRow.header, all.header) && same(scrolledRow.list, all.list), `${label}: bounds unchanged by row scroll`).toBe(true);
      expect(scrolledRow.row!.y).toBeCloseTo(all.row!.y, 1);

      // ---- scroll the list, then filter: scrollTop resets to 0 and every fixed region stays put
      await page.locator(".pantry-sheet__list").focus();
      await page.keyboard.press("PageDown");
      await expect.poll(async () => (await shelfFacts(page)).listScrollTop, { timeout: 4000 }).toBeGreaterThan(0);
      const filters: Record<string, number> = { "野菜・きのこ系": 10, "肉系": 5, "ちょっと変わった材料": 1, "魚介系": 4, すべて: 27 };
      for (const [name, count] of Object.entries(filters)) {
        await page.locator(".pantry-sheet__list").focus();
        await page.keyboard.press("PageDown");
        await page.getByRole("button", { name, exact: true }).click();
        const f = await shelfFacts(page);
        expect(f.tiles, `${label}: ${name} shows ${count} rows`).toHaveLength(count);
        expect(f.listScrollTop, `${label}: ${name} resets the list scrollTop`).toBe(0);
        expect(f.chipBoxes.filter((c) => c.pressed === "true").map((c) => c.label), `${label}: only ${name} is pressed`).toEqual([name]);
        expect(same(f.sheet, all.sheet), `${label}: ${name}: outer sheet bounds identical`).toBe(true);
        expect(same(f.header, all.header) && same(f.close, all.close), `${label}: ${name}: header / 閉じる fixed`).toBe(true);
        expect(same(f.row, scrolledRow.row) || same(f.row, all.row), `${label}: ${name}: chip row does not move or resize`).toBe(true);
        expect(same(f.list, all.list), `${label}: ${name}: list viewport identical (only its content changes)`).toBe(true);
        expect(f.pageScrolls, `${label}: ${name}: page does not scroll`).toBe(false);
        expect(f.docScrollW).toBeLessThanOrEqual(f.innerW);
        if (count === 1) expect(f.listScrollable, `${label}: one row needs no scroll`).toBe(false);
        const now = await layout(page);
        expect(now.stage, `${label}: ${name}: stage unchanged`).toBeCloseTo(stageBefore.stage!, 1);
        expect(now.dock).toBeCloseTo(stageBefore.dock!, 1);
      }

      // ---- privacy in the DOM (real page): after filtering, no unowned / hidden hint of another shelf's names
      await page.getByRole("button", { name: "ちょっと変わった材料", exact: true }).click();
      expect(await page.locator(".pantry-sheet").innerText()).not.toMatch(/\?\?\?|NEW|LOCKED/);

      // ---- Escape from a focused chip closes; focus returns to the entry; the Builder selection survived filtering
      await page.getByRole("button", { name: "肉系", exact: true }).focus();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => document.activeElement?.classList.contains("pantry-entry")), `${label}: focus returns to the entry`).toBe(true);
      await expect(basilChip, `${label}: Builder selection not cleared by pantry filtering (#197 not applied in R4)`).toHaveAttribute("aria-pressed", "true");
      const after = await layout(page);
      expect(after.stage).toBeCloseTo(stageBefore.stage!, 1);
      expect(after.dock).toBeCloseTo(stageBefore.dock!, 1);

      // ---- reopen: back on すべて (OD-R4-2)
      await page.getByRole("button", { name: /食材庫/ }).click();
      const reopened = await shelfFacts(page);
      expect(reopened.chipBoxes.filter((c) => c.pressed === "true").map((c) => c.label), `${label}: reopen resets to すべて`).toEqual(["すべて"]);
      expect(reopened.tiles).toHaveLength(27);
      expect(same(reopened.sheet, all.sheet), `${label}: reopened bounds identical`).toBe(true);
      await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // ---- cooking continues
      const placed = await page.locator(".pizza-topping").count();
      await page.locator(".ingredient-chip:not([disabled])").first().click();
      await tapDoughPercent(page, 45, 60);
      await expect(page.locator(".pizza-topping")).toHaveCount(placed + 1);
    }
  });
}
