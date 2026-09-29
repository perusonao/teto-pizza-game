import { expect, test, type Page } from "@playwright/test";
import { INGREDIENTS } from "../src/data/ingredients";
import { runOnlyOnWidth } from "./support/projectGuard";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

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
  await page.getByRole("button", { name: /フリークッキング/ }).click();
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
 * Large Catalog UX LC-R5-b: the pantry search field and the Mode C keyboard fit in real layout at the four Owner
 * viewports (390x844, 360x800, 390x664, 360x640). Chromium cannot show an iOS soft keyboard, so the keyboard is
 * SIMULATED by replacing `window.visualViewport` with a controllable stand-in (height = innerHeight - 338, the
 * shrink measured on the real iPhone in Discovery); the sheet's response is real layout. Real keyboard behaviour
 * is the Human Verification's job (PreAudit §9), not this spec's.
 *
 * Contract:
 *  - the search row is a fixed slot (44px field + 44px clear) above the chips; the sheet's outer bounds never move
 *    with text / result / shelf changes (same outer box for 22 rows, 1 row, 0 rows);
 *  - baseline sheet height = the shell ceiling (innerHeight - safe-top - 20);
 *  - keyboard-like visual viewport: the sheet's top stays inside it (>= 8px), its bottom sits ON the visual
 *    viewport's bottom edge, search + chips + at least one full result row stay above the keyboard, the page never
 *    scrolls; releasing the keyboard restores the exact baseline bounds;
 *  - no visualViewport: the CSS ceiling only.
 */
const KEYBOARD_PX = 338;
const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x664", width: 390, height: 664 },
  { id: "360x640", width: 360, height: 640 },
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
const NO_VV = () => Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });

async function searchFacts(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { y: b.y, h: b.height, b: b.bottom, x: b.x, w: b.width };
    };
    const list = document.querySelector<HTMLElement>(".pantry-sheet__list")!;
    const input = document.querySelector<HTMLInputElement>(".pantry-sheet__search-input");
    const l = list.getBoundingClientRect();
    const vvH = (window as unknown as { __vvH?: number }).__vvH ?? window.innerHeight;
    const tops = new Set<number>();
    for (const t of document.querySelectorAll(".pantry-tile")) {
      const b = t.getBoundingClientRect();
      if (b.top >= l.top - 0.5 && b.bottom <= Math.min(l.bottom, vvH) + 0.5) tops.add(Math.round(b.top));
    }
    return {
      innerH: window.innerHeight,
      sheet: r(document.querySelector(".pantry-sheet")),
      header: r(document.querySelector(".pantry-sheet__header")),
      close: r(document.querySelector(".pantry-sheet__close")),
      search: r(input),
      clear: r(document.querySelector(".pantry-sheet__search-clear")),
      chips: r(document.querySelector(".pantry-sheet__shelves")),
      list: r(list),
      listVisibleH: Math.max(0, Math.min(l.bottom, vvH) - l.top),
      fullRows: tops.size,
      tiles: document.querySelectorAll(".pantry-tile").length,
      fontSize: input ? parseFloat(getComputedStyle(input).fontSize) : null,
      activeIsInput: document.activeElement === input,
      activeClass: (document.activeElement as HTMLElement | null)?.className ?? "",
      scrollY: window.scrollY,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1 || window.scrollY > 0,
      fit: document.querySelector(".pantry-sheet")?.classList.contains("pantry-sheet--fit") ?? false,
    };
  });
}
const same = (a: { y: number; h: number; b: number } | null, b: { y: number; h: number; b: number } | null) =>
  !!a && !!b && Math.abs(a.y - b.y) <= 0.5 && Math.abs(a.h - b.h) <= 0.5 && Math.abs(a.b - b.b) <= 0.5;

for (const width of [390, 360] as const) {
  test(`LC-R5-b pantry search + Mode C keyboard fit at width ${width}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, width);
    test.setTimeout(300_000);
    await page.addInitScript(FAKE_VV);
    for (const vp of VIEWPORTS.filter((v) => v.width === width)) {
      const label = vp.id;
      await startFree(page, vp.width, vp.height);
      await toSauce(page);

      // ---- SAUCE: 3 owned => no search field
      await page.getByRole("button", { name: /食材庫/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await page.locator(".pantry-sheet__search-input").count(), `${label}: no search for 3 sauces`).toBe(0);
      const sauce = await searchFacts(page);
      await page.keyboard.press("Escape");

      await toTopping(page);
      const stageBefore = await layout(page);
      await page.getByRole("button", { name: /食材庫/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const base = await searchFacts(page);

      // ---- baseline: ceiling height, search slot, not focused, 16px, 44px targets
      expect(base.sheet!.h, `${label}: baseline sheet height = the shell ceiling`).toBeCloseTo(base.innerH - 20, 0);
      expect(sauce.sheet!.h, `${label}: same outer height with and without a search row`).toBeCloseTo(base.sheet!.h, 0);
      expect(base.sheet!.b, `${label}: bottom anchored`).toBeCloseTo(base.innerH, 0);
      expect(base.search, `${label}: 22 owned toppings show the search field`).not.toBeNull();
      expect(base.search!.h).toBeGreaterThanOrEqual(44);
      expect(base.clear!.h).toBeGreaterThanOrEqual(44);
      expect(base.clear!.w).toBeGreaterThanOrEqual(44);
      expect(base.fontSize!, `${label}: font-size >= 16px`).toBeGreaterThanOrEqual(16);
      expect(base.activeIsInput, `${label}: not auto-focused`).toBe(false);
      expect(base.activeClass).toContain("pantry-sheet__close");
      expect(base.search!.b, `${label}: search above chips`).toBeLessThanOrEqual(base.chips!.y + 0.5);
      expect(base.chips!.b).toBeLessThanOrEqual(base.list!.y + 0.5);
      expect(base.pageScrolls).toBe(false);
      expect(base.fit).toBe(false);
      console.log("R5B_BASELINE " + JSON.stringify({ vp: label, sheetH: base.sheet!.h, sheetY: base.sheet!.y, listH: base.list!.h, searchH: base.search!.h, chipsH: base.chips!.h, rows: (base.list!.h + 8) / 79.19 }));

      // ---- stable outer bounds across text / 0 results / shelf / clear (no keyboard change)
      const input = page.getByRole("searchbox", { name: "材料を検索" });
      for (const [name, act] of [
        ["one row", async () => input.fill("バジル")],
        ["alias 玉ねぎ", async () => input.fill("玉ねぎ")],
        ["zero rows", async () => input.fill("zzzz")],
        ["shelf 肉 with no text", async () => { await input.fill(""); await page.getByRole("button", { name: "肉" }).click(); }],
        ["shelf すべて", async () => page.getByRole("button", { name: "すべて" }).click()],
      ] as const) {
        await act();
        const f = await searchFacts(page);
        expect(same(f.sheet, base.sheet), `${label}: ${name}: outer sheet bounds identical`).toBe(true);
        expect(same(f.list, base.list), `${label}: ${name}: list viewport identical`).toBe(true);
        expect(same(f.search, base.search) && same(f.chips, base.chips) && same(f.header, base.header), `${label}: ${name}: fixed slots identical`).toBe(true);
        expect(f.pageScrolls).toBe(false);
        expect(await page.locator(".pantry-sheet__search-input").count(), `${label}: ${name}: field stays`).toBe(1);
      }
      await input.fill("玉ねぎ");
      expect((await searchFacts(page)).tiles).toBe(1);
      await input.fill("");

      // ---- stage / dock unchanged while the sheet (and search) are in use
      const during = await layout(page);
      expect(during.stage, `${label}: stage unchanged`).toBeCloseTo(stageBefore.stage!, 1);
      expect(during.dock, `${label}: dock unchanged`).toBeCloseTo(stageBefore.dock!, 1);

      // ---- IME (real Chromium composition through CDP): the list never flashes empty during a composition
      const cdp = await page.context().newCDPSession(page);
      await input.focus();
      await cdp.send("Input.imeSetComposition", { text: "たまねき", selectionStart: 4, selectionEnd: 4 });
      expect((await searchFacts(page)).tiles, `${label}: composing: list unchanged (22)`).toBe(22);
      await expect(page.locator(".pantry-sheet__empty")).toHaveCount(0);
      await cdp.send("Input.imeSetComposition", { text: "玉ねぎ", selectionStart: 3, selectionEnd: 3 });
      expect((await searchFacts(page)).tiles).toBe(22);
      await cdp.send("Input.insertText", { text: "玉ねぎ" });
      await expect.poll(async () => (await searchFacts(page)).tiles, { message: `${label}: confirmed 玉ねぎ applies`, timeout: 3000 }).toBe(1);
      await input.fill("");

      // ---- Mode C: simulated soft keyboard (visual viewport shrinks by 338px)
      await input.focus();
      const vvH = vp.height - KEYBOARD_PX;
      await page.evaluate((h) => (window as unknown as { __setVv: (h: number) => void }).__setVv(h), vvH);
      await expect.poll(async () => (await searchFacts(page)).fit, { message: `${label}: fit applied`, timeout: 3000 }).toBe(true);
      const kb = await searchFacts(page);
      expect(kb.sheet!.y, `${label}: sheet top stays inside the visual viewport with the 8px margin`).toBeGreaterThanOrEqual(8 - 0.5);
      expect(kb.sheet!.b, `${label}: sheet bottom sits on the visual viewport bottom`).toBeCloseTo(vvH, 0);
      expect(kb.sheet!.h, `${label}: sheet height = visual viewport - 8`).toBeCloseTo(vvH - 8, 0);
      expect(kb.header!.y).toBeGreaterThanOrEqual(0);
      expect(kb.close!.b).toBeLessThanOrEqual(vvH);
      expect(kb.search!.y).toBeGreaterThanOrEqual(0);
      expect(kb.search!.b, `${label}: search above the keyboard`).toBeLessThanOrEqual(vvH);
      expect(kb.chips!.b, `${label}: chips above the keyboard`).toBeLessThanOrEqual(vvH);
      expect(kb.list!.h, `${label}: minimum usable list height (>= one tile row, 71px)`).toBeGreaterThanOrEqual(71);
      expect(kb.fullRows, `${label}: at least one full result row above the keyboard`).toBeGreaterThanOrEqual(1);
      expect(kb.scrollY).toBe(0);
      expect(kb.pageScrolls).toBe(false);
      expect(kb.activeIsInput).toBe(true);
      console.log("R5B_KEYBOARD " + JSON.stringify({ vp: label, K: KEYBOARD_PX, vvH, sheetY: kb.sheet!.y, sheetB: kb.sheet!.b, sheetH: kb.sheet!.h, searchH: kb.search!.h, chipsH: kb.chips!.h, listH: kb.list!.h, fullRows: kb.fullRows, rows: (kb.list!.h + 8) / 79.19 }));

      // ordinary state changes while fitted do not move the fitted sheet
      await input.fill("ハ");
      expect(same((await searchFacts(page)).sheet, kb.sheet), `${label}: text change keeps the fitted bounds`).toBe(true);
      await page.getByRole("button", { name: "肉" }).click();
      expect(same((await searchFacts(page)).sheet, kb.sheet), `${label}: shelf change keeps the fitted bounds`).toBe(true);
      await input.fill("");
      await page.getByRole("button", { name: "すべて" }).click();

      // blur while the keyboard is still up: the shrink alone keeps the fit
      await page.locator(".pantry-sheet__list").focus();
      expect((await searchFacts(page)).fit, `${label}: blur with the keyboard still up keeps the fit`).toBe(true);

      // keyboard goes away -> exact baseline bounds again
      await page.evaluate(() => (window as unknown as { __setVv: (h: number | null) => void }).__setVv(null));
      await expect.poll(async () => (await searchFacts(page)).fit, { message: `${label}: fit released`, timeout: 3000 }).toBe(false);
      const back = await searchFacts(page);
      expect(same(back.sheet, base.sheet) && same(back.list, base.list) && same(back.search, base.search), `${label}: baseline bounds restored`).toBe(true);
      expect(back.scrollY).toBe(0);

      // Enter -> list focus; Escape from the field closes; focus returns to the entry; reopening is clean
      await input.focus();
      await input.fill("バジル");
      await page.keyboard.press("Enter");
      expect((await searchFacts(page)).activeClass, `${label}: Enter moves focus to the list`).toContain("pantry-sheet__list");
      await input.focus();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => document.activeElement?.classList.contains("pantry-entry")), `${label}: focus returns to the entry`).toBe(true);
      await page.getByRole("button", { name: /食材庫/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const reopened = await searchFacts(page);
      expect(reopened.tiles, `${label}: reopening resets the search`).toBe(22);
      expect(same(reopened.sheet, base.sheet), `${label}: reopened bounds identical`).toBe(true);
      await page.keyboard.press("Escape");
      const after = await layout(page);
      expect(after.stage).toBeCloseTo(stageBefore.stage!, 1);
      expect(after.dock).toBeCloseTo(stageBefore.dock!, 1);
    }
  });

  test(`LC-R5-b without visualViewport the sheet keeps the CSS ceiling at width ${width}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, width);
    test.setTimeout(120_000);
    await page.addInitScript(NO_VV);
    const vp = VIEWPORTS.filter((v) => v.width === width)[0];
    await startFree(page, vp.width, vp.height);
    await toSauce(page);
    await toTopping(page);
    await page.getByRole("button", { name: /食材庫/ }).click();
    const base = await searchFacts(page);
    await page.getByRole("searchbox", { name: "材料を検索" }).focus();
    const focused = await searchFacts(page);
    expect(focused.fit).toBe(false);
    expect(same(focused.sheet, base.sheet)).toBe(true);
    expect(focused.sheet!.h).toBeCloseTo(base.innerH - 20, 0);
  });
}
