import { expect, test } from "@playwright/test";
import { runOnlyOnWidth } from "./support/projectGuard";
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
import type { Page } from "@playwright/test";

/**
 * Cooking Tray family row, COMPACT layout (Issue #399; follows #396 / #397 / #401): on a short visible height (Safari with its
 * toolbars: 390x664 / 360x640) the family filter stays inside the utility row, between the 食材庫 entry and the pager, and the
 * pizza keeps exactly the size it has without the expanded layout. Real Chromium. Facts: the SELECTED chip is whole inside
 * the family scroller and clear of the edge fades for every family; both edges say when chips are still hidden; a manual
 * scroll is never undone; an idle pager gives its width back to the chips (a paging list keeps the pager); the scroller's hit
 * area is 44px while the row stays 28px, with no competition from the Pantry entry, the pager, the ingredient cards or the
 * bake bar; the pizza / dock / page keep their size. The normal heights (EXPANDED layout) are in
 * cooking-tray-family-expanded.spec.ts, the switch between the two in cooking-tray-family-responsive.spec.ts.
 * `HV_SCREENSHOT_DIR` (optional) writes the Human Verification screenshots.
 */
const VIEWPORTS = [
  { width: 390, height: 664, pizzaFree: 269.06 }, // S390: the pizza the compact layout (= the #401 layout) has on a FREE round
  { width: 360, height: 640, pizzaFree: 245.06 }, // S360
] as const;

for (const vp of VIEWPORTS) {
  const wh = `${vp.width}x${vp.height}`;
  const scenarios = [
    { name: "FREE HAND on", boot: (page: Page) => bootFree(page, vp.width, vp.height, HAND_ON_OWNED) },
    { name: "FREE HAND off", boot: (page: Page) => bootFree(page, vp.width, vp.height, HAND_OFF_OWNED) },
    { name: "FREE all 8 chips", boot: (page: Page) => bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED) },
    { name: "FREE paging family", boot: (page: Page) => bootFree(page, vp.width, vp.height, PAGING_FAMILY_OWNED) },
    { name: "Research", boot: (page: Page) => bootResearch(page, vp.width, vp.height) },
  ];

  for (const sc of scenarios) {
    test(`family chips: selected chip whole and clear of the fades, every family, pager coherent, pizza/dock unchanged: ${sc.name} ${wh}`, async ({ page }, testInfo) => {
      runOnlyOnWidth(testInfo, vp.width);
      await sc.boot(page);
      await toTopping(page);
      const row = familyRow(page);
      await expect(row).toBeVisible();

      const pizza = (await dough(page))!;
      const s0 = await rowState(page);
      expect(s0.mode, "a short visible height keeps the one-row layout").toBe("compact");
      if (sc.name !== "Research") expect(Math.abs(pizza.width - vp.pizzaFree), `pizza width ${pizza.width}`).toBeLessThanOrEqual(0.6); // exactly today's pizza
      expect(s0.navHeight, "utility row visual height").toBe(28);
      expect(s0.rowHeight, "family scroller hit height (44px) in a 28px row").toBe(44);
      const dockBefore = (await page.locator(".prepare-dock").boundingBox())!;
      await shot(page, `${sc.name.replace(/ /g, "-").toLowerCase()}-01-arrival`);

      const { labels, widths } = await walkAllFamilies(page, sc.name);
      testInfo.annotations.push({ type: "measure", description: `${sc.name}: chip viewport by family = ${JSON.stringify(Object.fromEntries(widths))}; pizza ${Math.round(pizza.width)}px; dock h ${dockBefore.height}` });

      // The dock never changed height while filtering (Δ0) and the page still fits.
      const dockAfter = (await page.locator(".prepare-dock").boundingBox())!;
      expect(dockAfter.height, "dock height Δ0").toBe(dockBefore.height);
      expect(dockAfter.y, "dock top Δ0").toBe(dockBefore.y);
      const pizzaAfter = (await dough(page))!;
      expect(Math.abs(pizzaAfter.width - pizza.width)).toBeLessThanOrEqual(0.5);

      // Idle pager returns its width: a one-page family has a wider chip viewport than the paging 「すべて」 list.
      const all = widths.get("すべて")!;
      const idleWidths = labels.slice(1).map((l) => widths.get(l)!);
      expect(Math.max(...idleWidths), "an idle pager hands its room to the chips").toBeGreaterThanOrEqual(all + 120);
      await shot(page, `${sc.name.replace(/ /g, "-").toLowerCase()}-02-all-after-walk`);
    });
  }

  test(`longest label 「${LONGEST_LABEL}」 is shown whole and clear of the fades ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    await row.getByRole("button", { name: `${LONGEST_LABEL}の具材だけ表示` }).click();
    const s = await expectSelectedClear(page, "longest");
    expect(s.chip!.width).toBeGreaterThan(130); // the real 144px chip, not a shrunk one
    // The 1px trailing box (CSS ::after, the 6px gap taken back) keeps the last chip's end inside the scroll range: empty,
    // invisible, and the row keeps its 28px layout height / 44px hit area.
    const tail = await row.evaluate((r) => {
      const cs = getComputedStyle(r, "::after");
      const last = r.lastElementChild as HTMLElement;
      return { width: cs.width, margin: cs.marginInlineStart, content: cs.content, spare: r.scrollWidth - (last.getBoundingClientRect().right - r.getBoundingClientRect().left + r.scrollLeft) };
    });
    expect(tail.width).toBe("1px");
    expect(tail.margin).toBe("-6px");
    expect(tail.spare, "the chip's end is reachable: the scroll range extends at least ~1px past it").toBeGreaterThanOrEqual(0.5 - 1e-6);
    await expect(row.getByRole("button", { name: `${LONGEST_LABEL}の具材だけ表示` })).toHaveAttribute("aria-pressed", "true");
    await shot(page, "longest-label-selected");
    // first / middle / last family each in turn, in a fresh scroll position from the far end.
    for (const target of ["肉系", "スパイス・薬味系", "すべて"]) {
      await row.getByRole("button", { name: target === "すべて" ? "全ての具材を表示" : `${target}の具材だけ表示` }).click();
      await expectSelectedClear(page, `after longest -> ${target}`);
    }
  });

  test(`manual horizontal scroll is never undone, and the fades follow it ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, HAND_ON_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    await row.getByRole("button", { name: "肉系の具材だけ表示" }).click();
    await expectSelectedClear(page, "肉系");
    const box = (await row.boundingBox())!;

    // Scroll right with real wheel input: the selected chip leaves the view and stays gone.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(600, 0);
    await settle(page);
    const right = await rowState(page);
    expect(right.scrollLeft, "scrolled").toBeGreaterThan(0);
    expect(right.moreStart).toBe("true");
    expect(right.moreEnd).toBe("false"); // at the end
    await page.waitForTimeout(700); // longer than any alignment animation
    expect((await rowState(page)).scrollLeft, "no forced return to the active chip").toBe(right.scrollLeft);
    await shot(page, "manual-scrolled-right");

    // And back to the left end: the start fade goes away, the end fade (more on the right) appears.
    await page.mouse.wheel(-1200, 0);
    await settle(page);
    const left = await rowState(page);
    expect(left.scrollLeft).toBe(0);
    expect(left.moreStart).toBe("false");
    expect(left.moreEnd).toBe("true");
    await shot(page, "manual-scrolled-left");

    // Keyboard focus: from the far end, Tab from the 食材庫 entry through the chips; each focused chip is brought whole and
    // clear of the fades (the browser's own focus scroll alone leaves it under one).
    await row.evaluate((r) => (r.scrollLeft = r.scrollWidth));
    await settle(page);
    await page.getByRole("button", { name: /食材庫/ }).focus();
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("Tab");
      await settle(page);
      const f = await row.evaluate((r) => {
        const el = document.activeElement as HTMLElement;
        const rb = r.getBoundingClientRect();
        const bb = el.getBoundingClientRect();
        const cs = getComputedStyle(r);
        return { inRow: r.contains(el), left: bb.left - rb.left, right: rb.right - bb.right, fadeStart: parseFloat(cs.getPropertyValue("--fade-start")) || 0, fadeEnd: parseFloat(cs.getPropertyValue("--fade-end")) || 0 };
      });
      expect(f.inRow, `Tab ${i + 1} stays in the family row`).toBe(true);
      expect(f.left, `Tab ${i + 1}: focused chip whole (start)`).toBeGreaterThanOrEqual(0);
      expect(f.right, `Tab ${i + 1}: focused chip whole (end)`).toBeGreaterThanOrEqual(0);
      expect(f.left, `Tab ${i + 1}: clear of the start fade`).toBeGreaterThanOrEqual(f.fadeStart - 0.5);
      expect(f.right, `Tab ${i + 1}: clear of the end fade`).toBeGreaterThanOrEqual(Math.min(f.fadeEnd, 14) - 0.5);
    }
  });

  test(`pager: shown and working when the list pages, collapsed when it does not, page 1 after a family change ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, PAGING_FAMILY_OWNED);
    await toTopping(page);
    const row = familyRow(page);

    // すべて pages (9 toppings): the pager is shown as before (128px, unshrunk buttons) and works.
    const pagingState = await rowState(page);
    expect(pagingState.pagerDisplay).not.toBe("none");
    const pagerBox = (await page.locator(".ingredient-page-nav__pager").boundingBox())!;
    expect(pagerBox.width, "paging pager keeps its 128px").toBeGreaterThanOrEqual(127);
    const prev = (await page.getByRole("button", { name: "前のページ" }).boundingBox())!;
    expect(prev.width).toBeGreaterThanOrEqual(36);
    expect(prev.height).toBeGreaterThanOrEqual(28);
    // The pager does not overlap the scroller's box.
    expect(pagerBox.x).toBeGreaterThanOrEqual(pagingState.rowRight - 0.5);
    await page.getByRole("button", { name: "次のページ" }).click();
    await expect(pagerLabel(page)).toContainText("2 /");

    // A paging family (野菜・きのこ系: 2 pages) keeps the pager and resets to page 1; a one-page family collapses it.
    await row.getByRole("button", { name: "野菜・きのこ系の具材だけ表示" }).click();
    await expect(pagerLabel(page)).toContainText("1 /");
    const veg = await expectSelectedClear(page, "野菜・きのこ系");
    expect(veg.pagerDisplay).not.toBe("none");
    await page.getByRole("button", { name: "次のページ" }).click();
    await expect(pagerLabel(page)).toContainText("2 /");
    await row.getByRole("button", { name: "肉系の具材だけ表示" }).click();
    const meat = await expectSelectedClear(page, "肉系");
    expect(meat.pagerDisplay).toBe("none");
    expect(meat.rowWidth - veg.rowWidth, "the collapsed pager's room (128px + 6px gap) went to the chips").toBeGreaterThanOrEqual(120);
    await expect(page.locator(".ingredient-page-nav__pager--idle")).toHaveAttribute("aria-hidden", "true");
    // Back to すべて: page 1 again.
    await row.getByRole("button", { name: "全ての具材を表示" }).click();
    await expect(pagerLabel(page)).toContainText("1 /");
    await expectNoPageOverflow(page, "pager");
  });

  test(`Pantry open / close keeps the row intact, and the entry is unchanged ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    const entry = page.getByRole("button", { name: /食材庫/ });
    await expect(entry).toHaveText("🧺 食材庫"); // OD-FAMILY-UX-2: label and accessible name untouched
    await row.getByRole("button", { name: `${LONGEST_LABEL}の具材だけ表示` }).click();
    await expectSelectedClear(page, "before Pantry");
    await entry.click();
    await page.waitForSelector(".pantry-sheet");
    await expect(page.getByRole("group", { name: "具材の分類" })).toBeVisible();
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.waitForSelector(".pantry-sheet", { state: "detached" });
    await expectSelectedClear(page, "after Pantry");
    await expectNoPageOverflow(page, "Pantry");
  });

  test(`44px hit area: chips are tappable 8px above and below their 28px body, with no competition from neighbours ${wh}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await bootFree(page, vp.width, vp.height, ALL_FAMILIES_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    const rb = (await row.boundingBox())!;
    const nav = (await row.locator("xpath=..").boundingBox())!;
    expect(rb.height).toBe(44);
    expect(nav.height).toBe(28);

    // The chip is a 44px tap target whose visible pill is 28px, centred: 8px of hit area above and below the pill.
    const chip = row.getByRole("button", { name: "肉系の具材だけ表示" }); // the first family chip: on screen at both widths
    const cb = (await chip.boundingBox())!;
    expect(cb.height, "chip tap target height").toBe(44);
    expect(cb.y).toBe(rb.y);
    expect(await chip.evaluate((el) => getComputedStyle(el, "::before").height), "visible pill height").toBe("28px");
    const pillTop = cb.y + 8;
    for (const y of [pillTop - 6, pillTop + 28 + 6]) {
      const hit = await page.evaluate(([x, py]) => document.elementFromPoint(x, py)?.closest("[data-tray-family]")?.getAttribute("data-tray-family") ?? null, [cb.x + cb.width / 2, y] as const);
      expect(hit, `a tap at y=${y - pillTop} from the pill's top (outside the pill, inside the 44px) lands on the chip`).toBe("meat");
    }

    // Neighbours: the Pantry entry's hit area and the pager are beside the scroller, never over it.
    const entry = (await page.getByRole("button", { name: /食材庫/ }).boundingBox())!;
    expect(entry.x + entry.width).toBeLessThanOrEqual(rb.x);
    const pager = (await page.locator(".ingredient-page-nav__pager").boundingBox())!;
    expect(pager.x).toBeGreaterThanOrEqual(rb.x + rb.width);
    const pantryHit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className ?? "", [entry.x + entry.width / 2, entry.y + 28 + 6] as const);
    expect(String(pantryHit)).toContain("pantry-entry"); // the Pantry's own 44px hit area still reaches below its body
    const next = (await page.getByRole("button", { name: "次のページ" }).boundingBox())!;
    const pagerHit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.getAttribute("aria-label") ?? "", [next.x + next.width / 2, next.y + next.height / 2] as const);
    expect(pagerHit).toBe("次のページ");

    // The scroller's overlap with the tray above is at most the 2px the Pantry entry's hit area already takes, and only
    // the card bodies stay the card's: a tap on the middle of the last row's cards and on the bake bar are theirs.
    const cards = await page.locator(".ingredient-chip").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
    const overlap = Math.max(...cards) - rb.y;
    expect(overlap, "scroller's overlap into the tray's last row").toBeLessThanOrEqual(2.5);
    const lastCard = (await page.locator(".ingredient-chip").last().boundingBox())!;
    const cardHit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".ingredient-chip"), [lastCard.x + lastCard.width / 2, lastCard.y + lastCard.height - 5] as const);
    expect(cardHit, "5px inside a card's bottom edge is the card").toBe(true);
    const bar = (await page.locator(".prepare-bake-bar").boundingBox())!;
    const barTop = Math.max(bar.y, 0);
    const barHit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".prepare-bake-bar"), [rb.x + rb.width / 2, barTop + 1] as const);
    expect(barHit, "the bake bar paints over anything beyond the spacer").toBe(true);
    await expect(row).toBeVisible();
    await shot(page, "touch-target");

    // The 44px area really selects: tap 6px above the pill.
    await page.mouse.click(cb.x + cb.width / 2, pillTop - 6);
    await expect(chip).toHaveAttribute("aria-pressed", "true");
  });
}
