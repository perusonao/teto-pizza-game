import { expect, test, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { INGREDIENTS, ingredientsByCategory } from "../src/data/ingredients";
import { FAMILY_DISPLAY } from "../src/data/familyDisplay";
import { CHIP_ROW_FADE_PX } from "../src/logic/chipRowAlign";
import { runOnlyOnWidth } from "./support/projectGuard";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Cooking Tray family filter, Mobile UX follow-up (Issue #399; follows #396 / #397). Real Chromium, 390x844 and 360x800.
 * Facts: the SELECTED chip is whole inside the family scroller and clear of the edge fades for every family; both edges say
 * when chips are still hidden; a manual scroll is never undone; an idle pager gives its width back to the chips (and a
 * paging list keeps the pager); the scroller's hit area is 44px while the row stays 28px, with no competition from the
 * Pantry entry, the pager, the ingredient cards or the bake bar; and the pizza / dock / page keep their size.
 * `HV_SCREENSHOT_DIR` (optional) writes the Human Verification screenshots.
 */
const SAVE_KEY = "teto-pizza-save-v1";
const TOPPING_IDS = ingredientsByCategory("topping").map((i) => i.id);
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;
const LONGEST_LABEL = FAMILY_DISPLAY.other.labelJa; // 「ちょっと変わった材料」, the longest chip (about 144px)

/** Layout facts measured on main (960bb3e) before this change: the pizza and the dock the tray must keep (Δ0). */
const BASELINE = {
  390: { pizza: 290, nav: 28 },
  360: { pizza: 274, nav: 28 },
} as const;

const base = (owned: readonly string[]) => ({
  schemaVersion: 2,
  dex: [] as unknown[],
  pitzBalance: 0,
  ownedIngredientIds: owned,
  missionBest: {},
  inventory: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])),
  starterGrantClaimedRecipeIds: [] as string[],
});
const HAND_ON_OWNED = INGREDIENTS.map((i) => i.id); // owned >= 13: the production Hand is active
const HAND_OFF_OWNED = ["tomato-sauce", "mozzarella", ...TOPPING_IDS.slice(0, 9)]; // 11 owned: no hand, still > 6 toppings
/** 11 owned = no Hand: every one of the 7 families present (so the longest chip 「ちょっと変わった材料」 is in the row). */
const ALL_FAMILIES_OWNED = ["tomato-sauce", "mozzarella", "sausage", "anchovy", "mushroom", "pineapple", "basil", "capers", "egg", "onion", "bacon"];
/** 11 owned = no Hand: 8 vegetables + 1 meat, so a FAMILY (野菜・きのこ系) itself pages (2 pages) next to a one-page family. */
const PAGING_FAMILY_OWNED = ["tomato-sauce", "mozzarella", "mushroom", "cherry-tomato", "onion", "black-olive", "corn", "eggplant", "fresh-tomato", "potato", "sausage"];

async function openWith(page: Page, width: number, height: number, save: object) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function bootFree(page: Page, width: number, height: number, owned: readonly string[]) {
  await openWith(page, width, height, base(owned));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
}

/** Research: a save whose only open Research Entry is researched from the Dex (the same entry the Discovery specs use),
 *  with every ingredient owned so the 具材 tray pages and carries the family row. */
async function bootResearch(page: Page, width: number, height: number) {
  const step = 25;
  const keys = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId), "brazilian-calabresa"];
  const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);
  await openWith(page, width, height, {
    ...base([...new Set([...HAND_ON_OWNED])]),
    dex: keys.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  });
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  const section = page.locator(".dex-overlay__research");
  await section.scrollIntoViewIfNeeded();
  await section.getByRole("button", { name: /を研究する/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toBeVisible();
  await completeDoughStep(page);
}

const dough = (page: Page) => page.locator(".pizza-dough").first().boundingBox();

async function toTopping(page: Page) {
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

const familyRow = (page: Page) => page.getByRole("group", { name: "具材の絞り込み" });
const pagerLabel = (page: Page) => page.locator(".ingredient-page-nav__label");

interface RowState {
  vw: number;
  rowLeft: number;
  rowRight: number;
  rowWidth: number;
  rowHeight: number;
  navHeight: number;
  scrollLeft: number;
  scrollWidth: number;
  moreStart: string | undefined;
  moreEnd: string | undefined;
  fadeStart: number;
  fadeEnd: number;
  mask: string;
  pagerDisplay: string;
  chip: { name: string; left: number; right: number; width: number; height: number } | null;
}

async function rowState(page: Page): Promise<RowState> {
  return familyRow(page).evaluate((row) => {
    const rb = row.getBoundingClientRect();
    const nav = row.parentElement!;
    const pager = nav.querySelector(".ingredient-page-nav__pager")!;
    const chip = row.querySelector<HTMLElement>('[aria-pressed="true"]');
    const cb = chip?.getBoundingClientRect();
    const cs = getComputedStyle(row);
    return {
      vw: window.innerWidth,
      rowLeft: rb.left,
      rowRight: rb.right,
      rowWidth: rb.width,
      rowHeight: rb.height,
      navHeight: nav.getBoundingClientRect().height,
      scrollLeft: row.scrollLeft,
      scrollWidth: row.scrollWidth,
      moreStart: (row as HTMLElement).dataset.moreStart,
      moreEnd: (row as HTMLElement).dataset.moreEnd,
      fadeStart: parseFloat(cs.getPropertyValue("--fade-start")) || 0,
      fadeEnd: parseFloat(cs.getPropertyValue("--fade-end")) || 0,
      mask: cs.maskImage || cs.webkitMaskImage || "none",
      pagerDisplay: getComputedStyle(pager).display,
      chip: chip && cb ? { name: chip.textContent ?? "", left: cb.left, right: cb.right, width: cb.width, height: cb.height } : null,
    };
  });
}

/** Waits for a (smooth) programmatic scroll to come to rest: two reads 150ms apart agree. */
async function settle(page: Page) {
  let prev = -1;
  for (let i = 0; i < 30; i += 1) {
    const now = await familyRow(page).evaluate((r) => r.scrollLeft);
    if (now === prev) return;
    prev = now;
    await page.waitForTimeout(150);
  }
}

async function expectNoPageOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth, sh: document.documentElement.scrollHeight, vh: window.innerHeight }));
  expect(m.sw, `${where}: horizontal page overflow`).toBeLessThanOrEqual(m.vw);
  expect(m.sh, `${where}: page scrolls vertically`).toBeLessThanOrEqual(m.vh + 1);
}

/** The core claim: the selected chip is whole inside the scroller's visible window AND its text is clear of the fades. */
async function expectSelectedClear(page: Page, where: string) {
  await settle(page);
  const s = await rowState(page);
  expect(s.chip, `${where}: a chip is selected`).not.toBeNull();
  const c = s.chip!;
  expect(c.left, `${where} (${c.name}): left edge inside the scroller`).toBeGreaterThanOrEqual(s.rowLeft - 0.5);
  expect(c.right, `${where} (${c.name}): right edge inside the scroller`).toBeLessThanOrEqual(s.rowRight + 0.5);
  expect(c.left - s.rowLeft, `${where} (${c.name}): clear of the start fade`).toBeGreaterThanOrEqual(s.fadeStart - 0.5);
  expect(s.rowRight - c.right, `${where} (${c.name}): clear of the end fade`).toBeGreaterThanOrEqual(s.fadeEnd - 0.5);
  // The fades are honest: a side says "more" exactly when chips are hidden there.
  expect(s.moreStart, `${where}: start affordance`).toBe(String(s.scrollLeft > 2));
  expect(s.moreEnd, `${where}: end affordance`).toBe(String(s.scrollLeft + s.rowWidth < s.scrollWidth - 2));
  expect(s.fadeStart <= CHIP_ROW_FADE_PX && s.fadeEnd <= CHIP_ROW_FADE_PX).toBe(true);
  if (s.moreStart === "true" || s.moreEnd === "true") expect(s.mask, `${where}: the fade is drawn`).toContain("gradient");
  return s;
}

const labelsOf = (page: Page) => familyRow(page).getByRole("button").allTextContents();

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

/** Every family chip in turn (and back to すべて): the selected chip is whole and clear; then the pager state is coherent. */
async function walkAllFamilies(page: Page, where: string) {
  const row = familyRow(page);
  const labels = await labelsOf(page);
  expect(labels[0]).toBe("すべて");
  expect(labels.length).toBeGreaterThanOrEqual(3);
  await expectSelectedClear(page, `${where} / initial`);
  const widths = new Map<string, number>();
  for (const label of [...labels.slice(1), "すべて"]) {
    await row.getByRole("button", { name: label === "すべて" ? "全ての具材を表示" : `${label}の具材だけ表示` }).click();
    const s = await expectSelectedClear(page, `${where} / ${label}`);
    widths.set(label, s.rowWidth);
    // pager coherence: it is shown exactly when the list pages; an idle pager takes no room.
    const paging = (await pagerLabel(page).count()) > 0 && s.pagerDisplay !== "none";
    expect(s.pagerDisplay === "none", `${where} / ${label}: pager hidden only when the list fits one page`).toBe(!paging);
    await expectNoPageOverflow(page, `${where} / ${label}`);
  }
  return { labels, widths };
}

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
      expect(Math.abs(pizza.width - BASELINE[vp.width].pizza), `pizza width ${pizza.width}`).toBeLessThanOrEqual(1);
      const s0 = await rowState(page);
      expect(s0.navHeight, "utility row visual height").toBe(BASELINE[vp.width].nav);
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
