import { expect, test, type Page } from "@playwright/test";
import { runOnlyOnWidth } from "./support/projectGuard";
import { tapDoughPercent } from "./gestures";
import {
  ALL_FAMILIES_OWNED,
  bootFree,
  bootResearch,
  dough,
  expectNoPageOverflow,
  expectSelectedClear,
  familyRow,
  HAND_OFF_OWNED,
  HAND_ON_OWNED,
  LONGEST_LABEL,
  pagerLabel,
  PAGING_FAMILY_OWNED,
  rowState,
  settle,
  shot,
  toTopping,
  walkAllFamilies,
} from "./support/familyTray";

/**
 * Cooking Tray family row, EXPANDED layout (Issue #399, Owner HV): at a normal visible height the family filter is its own
 * full-width row ABOVE the ingredients and the pager alone sits in the utility row BELOW them (the 食材庫 entry is gone). Real Chromium,
 * 390x844 and 360x800 (and the short 390x664 / 360x640). Facts: the pizza keeps its size (and every step the same), the filter has the whole row width, the
 * selected chip is whole and clear of the fades for every family, nothing moves when a family is chosen or a page turned, the
 * 44px hit areas of the chips, the pager and the entry never overlap an ingredient card (nor the pizza), the bake bar still
 * wins its own tap, and the page never scrolls sideways. The same holds on the short heights (390x664 / 360x640), where the
 * pizza gives way by the row's height instead of keeping its size.
 */
const VIEWPORTS = [
  { width: 390, height: 844, pizza: 290 as number | null, family: 366, dock: 174 + 42, short: null },
  { width: 360, height: 800, pizza: 273.6 as number | null, family: 336, dock: 174 + 42, short: null },
  // A short visible height (Safari with its toolbars): the row is above here too (Owner decision) and the 上部 note cards are gone
  // (Research and Free Cooking: they are in the ヒント sheet), so the pizza (stage-limited here) is at least what it was before the
  // family filter (269.1 / 245.1 on FREE); the measured sizes are 274 / 250 on Chromium. The dock is the 162px short dock + the row.
  { width: 390, height: 664, pizza: null, family: 366, dock: 162 + 42, short: { pizza: 274, atLeast: 269.1 } },
  { width: 360, height: 640, pizza: null, family: 336, dock: 162 + 42, short: { pizza: 250, atLeast: 245.1 } },
] as const;

interface Geometry {
  mode: string;
  chipBox: { top: number; bottom: number; height: number };
  firstCardTop: number;
  lastCardBottom: number;
  doughBottom: number;
  pager: { top: number; bottom: number; width: number; height: number } | null;
  barTop: number;
  barBottom: number;
  trayTop: number;
  dockHeight: number;
}

/** Positions of everything the family row's hit areas could compete with (all in CSS px, one read). */
async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const R = (e: Element | null) => e!.getBoundingClientRect();
    const cards = [...document.querySelectorAll(".ingredient-chip")].map((c) => R(c));
    const chip = R(document.querySelector("[data-tray-family]"));
    const next = document.querySelector(".ingredient-page-nav__pager .ingredient-page-nav__button"); // also the idle placeholder
    const bar = R(document.querySelector(".prepare-bake-bar"));
    return {
      mode: document.querySelector(".tray-family-row") ? "expanded" : "compact",
      chipBox: { top: chip.top, bottom: chip.bottom, height: chip.height },
      firstCardTop: Math.min(...cards.map((c) => c.top)),
      lastCardBottom: Math.max(...cards.map((c) => c.bottom)),
      doughBottom: R(document.querySelector(".pizza-dough")).bottom,
      pager: next ? { top: R(next).top, bottom: R(next).bottom, width: R(next).width, height: R(next).height } : null,
      barTop: bar.top,
      barBottom: bar.bottom,
      trayTop: Math.min(...cards.map((c) => c.top)),
      dockHeight: R(document.querySelector(".prepare-dock")).height,
    };
  });
}

for (const vp of VIEWPORTS) {
  const wh = `${vp.width}x${vp.height}`;
  const scenarios = [
    { name: "FREE HAND on", boot: (page: Page) => bootFree(page, vp.width, vp.height, HAND_ON_OWNED), free: true },
    { name: "FREE HAND off", boot: (page: Page) => bootFree(page, vp.width, vp.height, HAND_OFF_OWNED), free: true },
    { name: "FREE all 8 chips", boot: (page: Page) => bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED), free: true },
    { name: "FREE paging family", boot: (page: Page) => bootFree(page, vp.width, vp.height, PAGING_FAMILY_OWNED), free: true },
    { name: "Research", boot: (page: Page) => bootResearch(page, vp.width, vp.height), free: false },
  ];

  for (const sc of scenarios) {
    test(`expanded: family row above the tray, whole row width, pizza and dock fixed, nothing moves per family: ${sc.name} ${wh}`, async ({ page, browserName }, testInfo) => {
      runOnlyOnWidth(testInfo, vp.width);
      await sc.boot(page);
      const doughAtStart = (await dough(page))!; // DOUGH step: the same dock is already reserved
      await toTopping(page);
      const row = familyRow(page);
      await expect(row).toBeVisible();

      const s0 = await rowState(page);
      expect(s0.mode, "a normal visible height takes the expanded layout").toBe("expanded");
      expect(s0.navHeight, "the filter row's visual height").toBe(28);
      expect(s0.rowHeight, "the chips are 44px tap targets").toBe(44);
      expect(Math.abs(s0.rowWidth - vp.family), `filter usable width ${s0.rowWidth}`).toBeLessThanOrEqual(1);
      const pizza = (await dough(page))!;
      if (vp.pizza !== null) expect(Math.abs(pizza.width - vp.pizza), `pizza ${pizza.width}`).toBeLessThanOrEqual(0.6);
      else {
        const stageLimit = await page.evaluate(() => {
          const st = document.querySelector(".pizza-stage")!;
          const cs = getComputedStyle(st);
          return st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        });
        expect(Math.abs(pizza.width - stageLimit), "short height: the pizza is as large as its stage allows").toBeLessThanOrEqual(1.5);
        // Final authority: not smaller than before the family filter existed (WebKit lays the same layout out about a pixel larger).
        expect(pizza.width, "the pizza is at least its pre-family-filter size").toBeGreaterThanOrEqual(vp.short!.atLeast - 0.5);
        if (browserName === "chromium") expect(Math.abs(pizza.width - vp.short!.pizza), `short height pizza ${pizza.width}`).toBeLessThanOrEqual(0.6);
      }
      expect(Math.abs(pizza.width - doughAtStart.width), "the pizza is one size from DOUGH to 具材").toBeLessThanOrEqual(0.5);
      const g0 = await geometry(page);
      if (sc.free) expect(g0.dockHeight, "dock = the viewport's own FREE dock + the row").toBeCloseTo(vp.dock, 0);
      // order on the screen: filter row, then the ingredients, then the utility row
      expect(g0.chipBox.top).toBeLessThan(g0.firstCardTop);
      expect(g0.pager!.top).toBeGreaterThan(g0.lastCardBottom);
      await shot(page, `expanded-${sc.name.replace(/ /g, "-").toLowerCase()}-01-arrival`);

      const { labels, widths } = await walkAllFamilies(page, sc.name);
      // The filter's width does not depend on the pager: the same for every family, paging or not.
      for (const w of widths.values()) expect(Math.abs(w - s0.rowWidth), "the pager never takes the filter's width").toBeLessThanOrEqual(0.5);
      testInfo.annotations.push({ type: "measure", description: `${sc.name}: filter ${s0.rowWidth}px, pizza ${Math.round(pizza.width * 10) / 10}, dock ${g0.dockHeight}, ${labels.length} chips` });

      // Nothing moved while filtering: dock, tray, bake bar and the pizza are where they were.
      const g1 = await geometry(page);
      expect(g1.dockHeight, "dock height Δ0").toBe(g0.dockHeight);
      expect(g1.trayTop, "tray top Δ0").toBe(g0.trayTop);
      expect(g1.barTop, "bake bar Δ0").toBe(g0.barTop);
      const pizzaAfter = (await dough(page))!;
      expect(Math.abs(pizzaAfter.width - pizza.width)).toBeLessThanOrEqual(0.5);
      await shot(page, `expanded-${sc.name.replace(/ /g, "-").toLowerCase()}-02-after-walk`);
    });
  }

  test(`expanded: longest label 「${LONGEST_LABEL}」 whole, with a continuation fade on the left ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    await row.getByRole("button", { name: `${LONGEST_LABEL}の具材だけ表示` }).click();
    const s = await expectSelectedClear(page, "longest");
    expect(s.chip!.width).toBeGreaterThan(130); // the real 144px chip
    expect(s.moreStart, "chips are still hidden to the left").toBe("true");
    expect(s.moreEnd).toBe("false"); // the last chip: nothing to the right
    expect(s.mask).toContain("gradient");
    const tail = await row.evaluate((r) => {
      const cs = getComputedStyle(r, "::after");
      const last = r.lastElementChild as HTMLElement;
      return { width: cs.width, margin: cs.marginInlineStart, spare: r.scrollWidth - (last.getBoundingClientRect().right - r.getBoundingClientRect().left + r.scrollLeft) };
    });
    expect(tail.width).toBe("1px");
    expect(tail.margin).toBe("-6px");
    expect(tail.spare).toBeGreaterThanOrEqual(0.5 - 1e-6);
    await shot(page, "expanded-longest-label");
    for (const target of ["肉系", "スパイス・薬味系", "すべて"]) {
      await row.getByRole("button", { name: target === "すべて" ? "全ての具材を表示" : `${target}の具材だけ表示` }).click();
      await expectSelectedClear(page, `after longest -> ${target}`);
    }
  });

  test(`expanded: bilateral fades follow a manual scroll, which is never undone; keyboard focus stays clear of the fades ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, HAND_ON_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    await row.getByRole("button", { name: "魚介系の具材だけ表示" }).click();
    const first = await expectSelectedClear(page, "魚介系");
    expect(first.moreEnd, "continuation to the right").toBe("true");
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(900, 0);
    await settle(page);
    const right = await rowState(page);
    expect(right.scrollLeft).toBeGreaterThan(0);
    expect(right.moreStart).toBe("true");
    expect(right.moreEnd).toBe("false");
    await page.waitForTimeout(700);
    expect((await rowState(page)).scrollLeft, "no forced return to the selected chip").toBe(right.scrollLeft);
    await page.mouse.wheel(-1500, 0);
    await settle(page);
    const left = await rowState(page);
    expect(left.scrollLeft).toBe(0);
    expect(left.moreStart).toBe("false");
    expect(left.moreEnd).toBe("true");
    await shot(page, "expanded-manual-scroll");

    // keyboard: from the far end, Shift+Tab leftwards: every focused chip is whole and clear of the fades
    await row.evaluate((r) => (r.scrollLeft = r.scrollWidth));
    await settle(page);
    await row.getByRole("button").last().focus();
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("Shift+Tab");
      await settle(page);
      const f = await row.evaluate((r) => {
        const el = document.activeElement as HTMLElement;
        const rb = r.getBoundingClientRect();
        const bb = el.getBoundingClientRect();
        const cs = getComputedStyle(r);
        return { inRow: r.contains(el), left: bb.left - rb.left, right: rb.right - bb.right, fadeStart: parseFloat(cs.getPropertyValue("--fade-start")) || 0, fadeEnd: parseFloat(cs.getPropertyValue("--fade-end")) || 0 };
      });
      expect(f.inRow, `Shift+Tab ${i + 1} stays in the filter`).toBe(true);
      expect(f.left, `Shift+Tab ${i + 1}: whole (start)`).toBeGreaterThanOrEqual(-0.5);
      expect(f.right, `Shift+Tab ${i + 1}: whole (end)`).toBeGreaterThanOrEqual(-0.5);
      expect(f.left, `Shift+Tab ${i + 1}: clear of the start fade`).toBeGreaterThanOrEqual(f.fadeStart - 0.5);
      expect(f.right, `Shift+Tab ${i + 1}: clear of the end fade`).toBeGreaterThanOrEqual(Math.min(f.fadeEnd, 14) - 0.5);
    }
  });

  test(`expanded: pager below the tray: working when the list pages, an inert placeholder when it does not, page 1 after a family change ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, PAGING_FAMILY_OWNED);
    await toTopping(page);
    const row = familyRow(page);

    const paging = await rowState(page);
    expect(paging.pagerShown).toBe(true);
    const g = await geometry(page);
    expect(g.pager!.top, "the pager is under the tray, not beside the filter").toBeGreaterThan(g.lastCardBottom);
    const pagerBox = (await page.locator(".ingredient-page-nav__pager").boundingBox())!;
    expect(pagerBox.width, "the pager keeps its 128px").toBeGreaterThanOrEqual(127);
    const prev = (await page.getByRole("button", { name: "前のページ" }).boundingBox())!;
    expect(prev.width).toBeGreaterThanOrEqual(36);
    expect(prev.height).toBeGreaterThanOrEqual(28);
    await page.getByRole("button", { name: "次のページ" }).click();
    await expect(pagerLabel(page)).toContainText("2 /");

    await row.getByRole("button", { name: "野菜・きのこ系の具材だけ表示" }).click(); // 2 pages: back to page 1, pager kept
    await expect(pagerLabel(page)).toContainText("1 /");
    expect((await expectSelectedClear(page, "野菜・きのこ系")).pagerShown).toBe(true);
    await page.getByRole("button", { name: "次のページ" }).click();
    await expect(pagerLabel(page)).toContainText("2 /");
    await row.getByRole("button", { name: "肉系の具材だけ表示" }).click(); // one page: the pager is an inert placeholder
    const meat = await expectSelectedClear(page, "肉系");
    expect(meat.pagerShown).toBe(false);
    await expect(page.locator(".ingredient-page-nav__pager")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("button", { name: /食材庫/ })).toHaveCount(0);
    const gAfter = await geometry(page);
    expect(gAfter.pager!.top, "the row keeps its place: no layout shift when the pager goes idle").toBeCloseTo(g.pager!.top, 0);
    expect(gAfter.dockHeight).toBe(g.dockHeight);
    await row.getByRole("button", { name: "全ての具材を表示" }).click();
    await expect(pagerLabel(page)).toContainText("1 /");
    await expectNoPageOverflow(page, "pager");
  });

  test(`expanded: there is no 食材庫 entry; the utility row below the tray holds the pager alone ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    await expect(page.getByRole("button", { name: /食材庫/ })).toHaveCount(0);
    await expect(page.locator(".pantry-entry")).toHaveCount(0);
    const g = await geometry(page);
    expect(g.pager!.top, "the pager is in the utility row under the tray").toBeGreaterThan(g.lastCardBottom);
    await row.getByRole("button", { name: `${LONGEST_LABEL}の具材だけ表示` }).click();
    await expectSelectedClear(page, "filtered");
    await expectNoPageOverflow(page, "no pantry");
  });

  test(`expanded: hit areas never overlap: chips >= 44px, a positive gap to the first card and the pizza, the pager the same to the last card ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    const g = await geometry(page);

    // 1. geometry: the 44px chip box ends before the first card begins; the 8px extensions of the pager and the entry
    //    end before the last card's bottom edge; the chip box starts below the pizza.
    expect(g.chipBox.height, "chip tap target height").toBe(44);
    expect(g.firstCardTop - g.chipBox.bottom, "family chip target -> first card: positive gap").toBeGreaterThanOrEqual(1.5);
    expect(g.pager!.top - 9 - g.lastCardBottom, "pager target (9px above its body) -> last card: positive gap").toBeGreaterThanOrEqual(0.5);
    expect(g.chipBox.top - g.doughBottom, "family chip target -> pizza: no overlap").toBeGreaterThanOrEqual(0);
    expect(g.barTop - (g.pager!.bottom + 7), "pager target (7px below its body) -> bake bar: no overlap").toBeGreaterThanOrEqual(0);

    // 2. hit-testing agrees: the card owns its whole box; the chip owns its whole 44px box; the pager its 44px; the bar its own
    const probe = (x: number, y: number) =>
      page.evaluate(([px, py]) => {
        const el = document.elementFromPoint(px, py);
        return { chip: el?.closest("[data-tray-family]")?.getAttribute("data-tray-family") ?? null, card: !!el?.closest(".ingredient-chip"), label: el?.closest("button")?.getAttribute("aria-label") ?? null, bar: !!el?.closest(".prepare-bake-bar"), dough: !!el?.closest(".pizza-dough") };
      }, [x, y] as const);
    const meat = (await row.getByRole("button", { name: "肉系の具材だけ表示" }).boundingBox())!;
    const cx = meat.x + meat.width / 2;
    expect((await probe(cx, g.chipBox.top + 0.5)).chip, "top edge of the chip target").toBe("meat");
    expect((await probe(cx, g.chipBox.bottom - 0.5)).chip, "bottom edge of the chip target").toBe("meat");
    const firstCard = (await page.locator(".ingredient-chip").first().boundingBox())!;
    expect((await probe(firstCard.x + firstCard.width / 2, g.firstCardTop + 0.5)).card, "the card's own top edge is the card").toBe(true);
    expect((await probe(cx, g.chipBox.bottom + 0.5)).chip, "the gap below the chip target is not the chip").toBeNull();
    const next = (await page.getByRole("button", { name: "次のページ" }).boundingBox())!;
    const nx = next.x + next.width / 2;
    expect((await probe(nx, next.y - 8.5)).label, "pager target, 8.5px above its body").toBe("次のページ");
    expect((await probe(nx, next.y + next.height + 6.5)).label, "pager target, 6.5px below its body").toBe("次のページ");
    expect(next.height + 9 + 7, "pager target height").toBeGreaterThanOrEqual(44);
    expect((await probe(next.x + next.width + 3.5, next.y + next.height / 2)).label, "pager target, 3.5px beside its body").toBe("次のページ");
    const lastCard = (await page.locator(".ingredient-chip").last().boundingBox())!;
    expect((await probe(lastCard.x + lastCard.width / 2, g.lastCardBottom - 0.5)).card, "the last card's own bottom edge is the card").toBe(true);
    const bar = (await page.locator(".prepare-bake-bar").boundingBox())!;
    expect((await probe(bar.x + 30, bar.y + 1)).bar, "the bake bar still wins its own tap").toBe(true);
    await shot(page, "expanded-touch-targets");

    // 3. the 44px area really selects: a tap 6px above the pill
    await page.mouse.click(cx, g.chipBox.top + 2);
    await expect(row.getByRole("button", { name: "肉系の具材だけ表示" })).toHaveAttribute("aria-pressed", "true");
  });

  test(`expanded: an ingredient tap selects and places from a filtered tray; the bake controls are in place ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, HAND_ON_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    await row.getByRole("button", { name: "肉系の具材だけ表示" }).click();
    const card = page.locator(".ingredient-chip").first();
    const placedBefore = await page.locator(".pizza-dough .pizza-topping").count();
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await tapDoughPercent(page, 32, 68);
    await expect(page.locator(".pizza-dough .pizza-topping")).toHaveCount(placedBefore + 1); // one piece went onto the pizza
    const bar = page.locator(".prepare-bake-bar");
    await expect(bar.getByRole("button", { name: /焼く/ })).toBeVisible();
    const b = (await bar.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 1);
    await expectNoPageOverflow(page, "tap");
  });
}
