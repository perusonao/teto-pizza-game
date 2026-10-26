import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { INGREDIENTS, ingredientsByCategory } from "../../src/data/ingredients";
import { ingredientShelf } from "../../src/data/ingredientShelf";
import { HAND_ON_OWNED, bootFree, toTopping, familyRow, pagerLabel, rowState } from "../../e2e/support/familyTray";

/**
 * Issue #675 Phase 0: measure the real Cooking Tray (具材 step, FREE, every ingredient owned) at 390x844 / 360x800.
 * Observation only: no assertions on the product, results go to OUT_DIR as JSON + a few screenshots.
 */
const OUT_DIR = process.env.OUT_DIR ?? "docs/reports/screenshots/cooking-tray-75-phase0";
const LABEL = process.env.RUN_LABEL ?? "main";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;
const TOPPINGS = ingredientsByCategory("topping");
const NAME_TO_ID = new Map(INGREDIENTS.map((i) => [i.nameJa, i.id]));

const chips = (page: Page) =>
  page.locator(".ingredient-chip").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { name: e.querySelector(".ingredient-chip__name")?.textContent ?? "", pressed: e.getAttribute("aria-pressed") === "true", w: r.width, h: r.height, top: r.top, bottom: r.bottom };
    }),
  );
const pager = async (page: Page) => {
  const t = (await pagerLabel(page).first().textContent())?.trim() ?? "";
  const m = /(\d+)\s*\/\s*(\d+)/.exec(t);
  return { cur: m ? +m[1] : 1, total: m ? +m[2] : 1, visible: await page.locator(".ingredient-page-nav__pager--idle").count() === 0 };
};
const layout = (page: Page) =>
  page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, height: Math.round(r.height * 10) / 10 };
    };
    const btns = [...document.querySelectorAll(".ingredient-page-nav__button")].map((b) => {
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    return {
      vh: innerHeight,
      docScroll: document.documentElement.scrollHeight - innerHeight,
      tray: box(".ingredient-tray"),
      nav: box(".ingredient-page-nav"),
      stage: box(".pizza-dough"),
      pagerButtons: btns,
    };
  });

for (const vp of VIEWPORTS) {
  test(`phase0 ${LABEL} ${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    const out: Record<string, unknown> = { label: LABEL, viewport: vp, toppingCount: TOPPINGS.length, ingredientCount: INGREDIENTS.length };
    const shot = (n: string) => page.screenshot({ path: `${OUT_DIR}/${LABEL}-${vp.width}x${vp.height}-${n}.png` });
    mkdirSync(OUT_DIR, { recursive: true });
    await bootFree(page, vp.width, vp.height, HAND_ON_OWNED);
    await toTopping(page);

    // M1: "all"
    const p0 = await pager(page);
    const firstChips = await chips(page);
    out.all = { pages: p0.total, firstPageChips: firstChips.length, chipSize: { w: firstChips[0]?.w, h: firstChips[0]?.h }, layoutPage1: await layout(page) };
    await shot("all-p1");

    // M2: family chips
    const row = familyRow(page);
    const options = await row.getByRole("button").evaluateAll((els) => els.map((e) => ({ label: (e.textContent ?? "").trim(), aria: e.getAttribute("aria-label") ?? "" })));
    out.familyChipCount = options.length;
    const fam: Record<string, unknown> = {};
    const rowStates: Record<string, unknown> = {};
    for (const o of options) {
      await row.getByRole("button", { name: o.aria }).click();
      await page.waitForTimeout(150);
      const pg = await pager(page);
      const lay = await layout(page);
      const pages: string[][] = [];
      for (let i = 1; i <= pg.total; i++) {
        pages.push((await chips(page)).map((c) => c.name));
        if (i < pg.total) await page.getByRole("button", { name: "次のページ" }).click();
      }
      fam[o.label] = { pages: pg.total, perPage: pages.map((p) => p.length), layout: lay, names: pages };
      const rs = await rowState(page);
      rowStates[o.label] = { chip: rs.chip, fadeStart: rs.fadeStart, fadeEnd: rs.fadeEnd, moreStart: rs.moreStart, moreEnd: rs.moreEnd, mode: rs.mode, rowWidth: rs.rowWidth, scrollWidth: rs.scrollWidth, pagerShown: rs.pagerShown };
    }
    out.families = fam;
    out.familyRowStates = rowStates;
    // restore "all"
    await row.getByRole("button", { name: "全ての具材を表示" }).click();

    // M3: selection vs paging (すべて)
    const sel: Record<string, unknown> = {};
    const firstName = (await chips(page))[0].name;
    await page.locator(".ingredient-chip").first().click();
    await page.waitForTimeout(100);
    sel.afterTapOnP1 = (await chips(page)).filter((c) => c.pressed).map((c) => c.name);
    await page.getByRole("button", { name: "次のページ" }).click();
    sel.afterNextPage = (await chips(page)).filter((c) => c.pressed).map((c) => c.name);
    await page.getByRole("button", { name: "前のページ" }).click();
    sel.afterBackToP1 = (await chips(page)).filter((c) => c.pressed).map((c) => c.name);
    sel.selectedName = firstName;
    // select on p1 then switch family where it is NOT present / present
    const f0 = ingredientShelf(NAME_TO_ID.get(firstName) ?? "");
    await page.locator(".ingredient-chip").first().click(); // reselect
    const otherFam = options.find((o) => o.label !== "すべて" && o.aria !== "全ての具材を表示" && !o.aria.includes("") === false)!;
    sel.firstFamilyKey = f0;
    const ownFamilyBtn = options.find((o) => o.label !== "すべて")!;
    await row.getByRole("button", { name: ownFamilyBtn.aria }).click();
    sel.afterFamilySwitch = { to: ownFamilyBtn.label, pressed: (await chips(page)).filter((c) => c.pressed).map((c) => c.name) };
    await row.getByRole("button", { name: "全ての具材を表示" }).click();
    out.selection = sel;

    // M4: taps to reach each topping from "すべて"
    const taps: Record<string, number> = {};
    const allNames: string[] = [];
    for (let i = 1; i <= p0.total; i++) {
      for (const c of await chips(page)) { allNames.push(c.name); taps[c.name] = i - 1; }
      if (i < p0.total) await page.getByRole("button", { name: "次のページ" }).click();
    }
    out.tapsFromAll = taps;
    out.allOrder = allNames;
    await shot("all-last");
    // consistency: the layout never moves between page 1 and the last page
    out.layoutLast = await layout(page);
    writeFileSync(`${OUT_DIR}/${LABEL}-${vp.width}x${vp.height}.json`, JSON.stringify(out, null, 2));
  });
}

/** Second pass: hit areas of the pager buttons / family chips, and what the tray does after a placement. */
for (const vp of VIEWPORTS) {
  test(`phase0b ${LABEL} ${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const out: Record<string, unknown> = { label: LABEL, viewport: vp };
    await bootFree(page, vp.width, vp.height, HAND_ON_OWNED);
    await toTopping(page);
    // hit area: for each of the next/prev buttons and 3 family chips, find the largest symmetric reach (px beyond the visible box) that still hits the element
    const reach = async (selector: string, index = 0) =>
      page.evaluate(
        ([sel, idx]) => {
          const els = document.querySelectorAll<HTMLElement>(sel as string);
          const el = els[idx as number];
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const hits = (x: number, y: number) => {
            const t = document.elementFromPoint(x, y);
            return !!t && (t === el || el.contains(t));
          };
          let up = 0, down = 0, left = 0, right = 0;
          while (up < 30 && hits(cx, r.top - up - 1)) up++;
          while (down < 30 && hits(cx, r.bottom + down)) down++;
          while (left < 30 && hits(r.left - left - 1, cy)) left++;
          while (right < 30 && hits(r.right + right, cy)) right++;
          return { visible: { w: Math.round(r.width), h: Math.round(r.height) }, extra: { up, down, left, right }, hit: { w: Math.round(r.width + left + right), h: Math.round(r.height + up + down) } };
        },
        [selector, index] as const,
      );
    out.hitPagerPrev = await reach(".ingredient-page-nav__button", 0);
    out.hitPagerNext = await reach(".ingredient-page-nav__button", 1);
    out.hitFamilyChip = await reach('[data-tray-family] button, [aria-label="具材の絞り込み"] button', 1);
    out.hitIngredientChip = await reach(".ingredient-chip", 0);
    // placement: go to page 3, select a chip, tap the dough, read the pager
    await page.getByRole("button", { name: "次のページ" }).click();
    await page.getByRole("button", { name: "次のページ" }).click();
    const before = await pager(page);
    const names = await chips(page);
    await page.locator(".ingredient-chip").nth(1).click();
    const dough = page.locator(".pizza-dough").first();
    const b = (await dough.boundingBox())!;
    await page.mouse.click(b.x + b.width * 0.6, b.y + b.height * 0.4);
    await page.waitForTimeout(250);
    const after = await pager(page);
    out.placement = { pagerBefore: before, pagerAfter: after, picked: names[1]?.name, pressedAfter: (await chips(page)).filter((c) => c.pressed).map((c) => c.name) };
    // family persistence across a placement
    await familyRow(page).getByRole("button", { name: "野菜・きのこ系の具材だけ表示" }).click();
    await page.getByRole("button", { name: "次のページ" }).click();
    const vegP2 = await chips(page);
    await page.locator(".ingredient-chip").first().click();
    await page.mouse.click(b.x + b.width * 0.4, b.y + b.height * 0.6);
    await page.waitForTimeout(250);
    out.placementInFamily = { family: "野菜・きのこ系", pagerAfter: await pager(page), firstOnP2: vegP2[0]?.name, nowFirst: (await chips(page))[0]?.name };
    // dock/CTA: is anything covered? bake bar position
    out.bakeBar = await page.evaluate(() => {
      const el = document.querySelector(".cta-bar, .bake-bar, .making-cta") as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      return r ? { top: r.top, bottom: r.bottom, vh: innerHeight } : null;
    });
    await page.screenshot({ path: `${OUT_DIR}/${LABEL}-${vp.width}x${vp.height}-family-veg-p2.png` });
    writeFileSync(`${OUT_DIR}/${LABEL}-${vp.width}x${vp.height}-b.json`, JSON.stringify(out, null, 2));
  });
}
