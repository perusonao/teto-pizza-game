import { test, expect, type Page } from "@playwright/test";

/**
 * Ingredients (Inventory) modal: fixed outer size regardless of how many cards the shelf filter
 * shows. Only the ingredient list scrolls; summary + the shelf tabs stay pinned.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato",
  "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 390, height: 664 },
  { width: 360, height: 640 },
];

function save(owned: string[]) {
  return {
    schemaVersion: 2,
    dex: [{ recipeId: "margherita", discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 }],
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((id) => [id, 9])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: owned,
  };
}

async function open(page: Page, owned: string[]) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(save(owned))] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /材料/ }).click();
  await page.waitForSelector(".inventory-grid");
}

const rect = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  }, sel);

for (const vp of VIEWPORTS) {
  test.describe(`Ingredients modal fixed bounds @${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test("filter changes never move the modal shell or pinned UI; only the list scrolls", async ({ page }) => {
      await open(page, FINITE);
      const shell = ".inventory-overlay__panel";
      const all = await rect(page, shell);
      const chips = await rect(page, ".shelf-chips");
      const closeBtn = await rect(page, ".dex-overlay__close");
      const summary = await rect(page, ".inventory-overlay__summary");

      // Modal shell inside the viewport (safe area: top gap kept).
      expect(all.top).toBeGreaterThanOrEqual(0);
      expect(all.bottom).toBeLessThanOrEqual(vp.height + 0.5);

      // Largest state: the list (not the page/body/panel) scrolls.
      const list = page.locator(".inventory-overlay__list");
      // Keyboard-operable scrollport: labelled region, focusable, PageDown scrolls it.
      await expect(page.getByRole("region", { name: "材料一覧" })).toHaveAttribute("tabindex", "0");
      await list.focus();
      expect(await list.evaluate((el) => document.activeElement === el)).toBe(true);
      await page.keyboard.press("PageDown");
      // Keyboard page-scroll may be animated (WebKit): poll until the list has moved. The list
      // itself must scroll; focus alone is not enough.
      await expect.poll(() => list.evaluate((el) => el.scrollTop), { timeout: 3000 }).toBeGreaterThan(0);
      // Keyboard scroll belongs to the list, not the page/body/panel.
      expect(await page.evaluate(() => [window.scrollY, document.documentElement.scrollTop, document.body.scrollTop])).toEqual([0, 0, 0]);
      expect(await page.locator(".inventory-overlay__body").evaluate((el) => el.scrollTop)).toBe(0);
      expect(await rect(page, shell)).toEqual(all);
      await list.evaluate((el) => { el.scrollTop = 0; });
      const big = await list.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
      expect(big.sh).toBeGreaterThan(big.ch);
      expect(await page.locator(".inventory-overlay__body").evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await list.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await rect(page, ".shelf-chips")).toEqual(chips);
      expect(await rect(page, ".dex-overlay__close")).toEqual(closeBtn);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
      expect(closeBtn.top).toBeGreaterThanOrEqual(0);

      // Two-tier tabs: the family row exists only under 具材, so it appears / disappears while the shell stays fixed.
      for (const [tier, name] of [
        ["材料の大分類", "具材"],
        ["具材の分類", "魚介系"],
        ["具材の分類", "肉系"],
        ["具材の分類", "スパイス・薬味系"],
        ["材料の大分類", "ソース"],
        ["材料の大分類", "すべて"],
        ["材料の大分類", "具材"],
        ["具材の分類", "スパイス・薬味系"],
      ] as const) {
        const group = page.getByRole("group", { name: tier });
        await group.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        await group.getByRole("button", { name, exact: true }).scrollIntoViewIfNeeded();
        await group.getByRole("button", { name, exact: true }).click();
        const now = await rect(page, shell);
        expect(now.top).toBe(all.top);
        expect(now.bottom).toBe(all.bottom);
        expect(now.height).toBe(all.height);
        expect((await rect(page, ".inventory-overlay__summary")).top).toBe(summary.top);
        expect(await rect(page, ".dex-overlay__close")).toEqual(closeBtn);
        expect((await rect(page, ".shelf-chips")).top).toBe(chips.top);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      }

      // Single-card shelf: card stays at the top of the list, not centred; shell unchanged.
      expect(await page.locator(".inventory-card").count()).toBe(1);
      const cardTop = await page.locator(".inventory-card").evaluate((c) => c.getBoundingClientRect().top);
      const listTop = await list.evaluate((el) => el.getBoundingClientRect().top);
      expect(cardTop - listTop).toBeLessThan(8);
    });
  });
}
