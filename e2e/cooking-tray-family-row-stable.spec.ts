import { expect, test, type Page } from "@playwright/test";
import { runOnlyOnWidth } from "./support/projectGuard";
import {
  ALL_FAMILIES_OWNED,
  bootFree,
  bootResearch,
  dough,
  familyRow,
  HAND_ON_OWNED,
  labelsOf,
  settle,
  shot,
  toTopping,
} from "./support/familyTray";

/**
 * Issue #447: the family row (the tabs above the tray) never moves while a family is chosen or a page is turned.
 *
 * `cooking-tray-family-expanded.spec.ts` compares the geometry only after the walk has returned to 「すべて」, so a
 * family whose list is one row (<= 3 ingredients) used to pull the tab row 70px down in between and nothing noticed. Here
 * EVERY step of the walk is measured against the arrival state: the tab row's y, the tray's top and height, the pager's y,
 * the dock's height, the bake bar's y and the pizza's size. The coverage is asserted too (a scenario must contain a 1-3 card
 * family, a 4-6 card family and the full 「すべて」 list), so the test cannot pass by accident on a catalog that happens to
 * have no small family.
 */
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  // The short visible heights keep the row above the tray too (Owner decision #399): the same invariant holds there.
  { width: 390, height: 664 },
  { width: 360, height: 640 },
] as const;

interface Stack {
  rowY: number;
  rowH: number;
  trayY: number;
  trayH: number;
  firstCardTop: number;
  pagerY: number | null;
  dockH: number;
  barY: number;
  cards: number;
}

async function stack(page: Page): Promise<Stack> {
  return page.evaluate(() => {
    const R = (e: Element | null) => e!.getBoundingClientRect();
    const row = R(document.querySelector('[role="group"][aria-label="具材の絞り込み"]'));
    const tray = R(document.querySelector(".ingredient-tray"));
    const cards = [...document.querySelectorAll(".ingredient-chip")].map((c) => R(c));
    const pagerBtn = document.querySelector(".ingredient-page-nav__pager .ingredient-page-nav__button");
    return {
      rowY: row.top,
      rowH: row.height,
      trayY: tray.top,
      trayH: tray.height,
      firstCardTop: Math.min(...cards.map((c) => c.top)),
      pagerY: pagerBtn ? R(pagerBtn).top : null,
      dockH: R(document.querySelector(".prepare-dock")).height,
      barY: R(document.querySelector(".prepare-bake-bar")).top,
      cards: cards.length,
    };
  });
}

function expectSameStack(now: Stack, first: Stack, where: string) {
  expect(now.rowY, `${where}: the tab row's y`).toBeCloseTo(first.rowY, 1);
  expect(now.rowH, `${where}: the tab row's height`).toBeCloseTo(first.rowH, 1);
  expect(now.trayY, `${where}: the tray's top`).toBeCloseTo(first.trayY, 1);
  expect(now.trayH, `${where}: the tray's height (two rows, always)`).toBeCloseTo(first.trayH, 1);
  expect(now.firstCardTop, `${where}: the first card's top`).toBeCloseTo(first.firstCardTop, 1);
  expect(now.pagerY, `${where}: the pager's y`).toBe(first.pagerY);
  expect(now.dockH, `${where}: the dock's height`).toBeCloseTo(first.dockH, 1);
  expect(now.barY, `${where}: the bake bar's y`).toBeCloseTo(first.barY, 1);
}

for (const vp of VIEWPORTS) {
  const wh = `${vp.width}x${vp.height}`;
  const scenarios = [
    // every ingredient owned: 「すべて」 pages (6 per page), the small families (1-3 cards) and the 4-6 card ones are all there
    { name: "FREE all owned", boot: (page: Page) => bootFree(page, vp.width, vp.height, HAND_ON_OWNED) },
    // 11 owned, all 7 families, most of them one or two cards
    { name: "FREE 8 chips", boot: (page: Page) => bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED) },
    { name: "Research", boot: (page: Page) => bootResearch(page, vp.width, vp.height) },
  ];

  for (const sc of scenarios) {
    test(`family row stays put at every step of the family walk: ${sc.name} ${wh}`, async ({ page }, testInfo) => {
      runOnlyOnWidth(testInfo, vp.width);
      await sc.boot(page);
      await toTopping(page);
      await expect(familyRow(page)).toBeVisible();
      await settle(page);

      const first = await stack(page);
      const pizza0 = (await dough(page))!;
      const rowH = vp.height <= 700 ? 2 * 58 + 6 : 2 * 64 + 6;
      expect(first.trayH, "the tray is two rows tall while the tabs are shown").toBeCloseTo(rowH, 0);
      await shot(page, `row-stable-${sc.name.replace(/ /g, "-").toLowerCase()}-01-arrival`);

      const labels = await labelsOf(page);
      expect(labels[0]).toBe("すべて");
      const seen = { small: new Set<string>(), mid: new Set<string>(), all: 0 };
      const walk = [...labels.slice(1), "すべて"];
      for (const label of walk) {
        await familyRow(page)
          .getByRole("button", { name: label === "すべて" ? "全ての具材を表示" : `${label}の具材だけ表示` })
          .click();
        await settle(page);
        const s = await stack(page);
        expectSameStack(s, first, `${wh} ${sc.name} / ${label} (${s.cards} cards)`);
        if (label === "すべて") seen.all = s.cards;
        else if (s.cards <= 3) seen.small.add(label);
        else seen.mid.add(label);
        const pizza = (await dough(page))!;
        expect(Math.abs(pizza.width - pizza0.width), `${label}: pizza size`).toBeLessThanOrEqual(0.5);
      }
      expect(seen.small.size, `${sc.name}: coverage, a family of 1-3 cards (${[...seen.small]})`).toBeGreaterThanOrEqual(1);
      expect(seen.all, "coverage: the full 「すべて」 list is a full page").toBe(6);
      if (sc.name === "FREE all owned" || sc.name === "Research") {
        expect(seen.mid.size, `${sc.name}: coverage, a family of 4-6 cards (${[...seen.mid]})`).toBeGreaterThanOrEqual(1);
      }
      await shot(page, `row-stable-${sc.name.replace(/ /g, "-").toLowerCase()}-02-after-walk`);

      // The same family entered twice and left in a different order (small -> small -> mid): every hop, not only the end state.
      const order = [...seen.small, ...seen.mid, ...seen.small].slice(0, 6);
      for (const label of order) {
        await familyRow(page).getByRole("button", { name: `${label}の具材だけ表示` }).click();
        await settle(page);
        expectSameStack(await stack(page), first, `${wh} ${sc.name} / revisit ${label}`);
      }
    });
  }

  test(`family row stays put while paging the full list to its last page (a short page): ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, HAND_ON_OWNED);
    await toTopping(page);
    await settle(page);
    const first = await stack(page);
    const next = page.getByRole("button", { name: "次のページ" });
    let last = first;
    for (let i = 0; i < 20 && (await next.isEnabled()); i += 1) {
      await next.click();
      await settle(page);
      last = await stack(page);
      expectSameStack(last, first, `${wh} paging, page ${i + 2} (${last.cards} cards)`);
    }
    expect(last.cards, "the last page is a short one (a short page)").toBeLessThan(6);
    await shot(page, "row-stable-last-page");
  });
}
