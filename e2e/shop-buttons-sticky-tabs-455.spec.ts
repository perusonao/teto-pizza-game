import { test, expect, type Page } from "@playwright/test";

/**
 * Issue #455 (Fresh Audit P2-1 / P2-2): the Shop's 仕入れる / 補充する buttons are 44px tap targets, and the
 * category tabs stay pinned while the long list scrolls (Shop only; the Inventory is unchanged). Real layout at
 * 390x844 and 360x800.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato",
  "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];

// 8 owned (restock rows, stock 3), 18 unlocked -> 10 NEW rows. 70 Pitz buys some rows and not others.
function save(pitz: number) {
  const owned = FINITE.slice(0, 8);
  return {
    schemaVersion: 2,
    dex: [{ recipeId: "margherita", discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 }],
    pitzBalance: pitz,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((id) => [id, 3])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: FINITE.slice(0, 18),
  };
}

async function openApp(page: Page, pitz: number) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(save(pitz))] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function openShop(page: Page, pitz = 70) {
  await openApp(page, pitz);
  await page.getByRole("button", { name: /ショップ/ }).click();
  await page.waitForSelector(".shop-overlay__body");
}

test.describe("Shop buttons and sticky tabs (#455)", () => {
  test("P2-1: every 仕入れる / 補充する button (enabled and disabled) is at least 44px tall, inside the viewport", async ({ page }) => {
    await openShop(page);
    const f = await page.evaluate(() => {
      const vw = window.innerWidth;
      const all = [...document.querySelectorAll<HTMLButtonElement>(".shop-item__buy-button, .shop-item__restock-button")];
      const rects = all.map((b) => b.getBoundingClientRect());
      return {
        count: all.length,
        enabled: all.filter((b) => !b.disabled).length,
        disabled: all.filter((b) => b.disabled).length,
        buy: all.filter((b) => b.classList.contains("shop-item__buy-button")).length,
        restock: all.filter((b) => b.classList.contains("shop-item__restock-button")).length,
        minHeight: Math.min(...rects.map((r) => r.height)),
        minWidth: Math.min(...rects.map((r) => r.width)),
        inside: rects.every((r) => r.left >= 0 && r.right <= vw + 0.5),
        pageOverflow: document.documentElement.scrollWidth > vw,
        bodyOverflowX: (() => { const b = document.querySelector<HTMLElement>(".shop-overlay__body")!; return b.scrollWidth > b.clientWidth + 1; })(),
        // a button never overlaps the price text beside it, nor the shortfall line under it
        overlapsSiblings: all.some((b) => {
          const r = b.getBoundingClientRect();
          const row = b.closest(".shop-item")!;
          return [...row.querySelectorAll<HTMLElement>(".shop-item__price, .shop-item__pack, .shop-item__shortfall")].some((e) => {
            const s = e.getBoundingClientRect();
            return r.left < s.right - 0.5 && r.right > s.left + 0.5 && r.top < s.bottom - 0.5 && r.bottom > s.top + 0.5;
          });
        }),
      };
    });
    expect(f.buy).toBeGreaterThan(0);
    expect(f.restock).toBeGreaterThan(0);
    expect(f.enabled).toBeGreaterThan(0);
    expect(f.disabled).toBeGreaterThan(0);
    expect(f.minHeight).toBeGreaterThanOrEqual(44);
    expect(f.minWidth).toBeGreaterThanOrEqual(44);
    expect(f.inside).toBe(true);
    expect(f.pageOverflow).toBe(false);
    expect(f.bodyOverflowX).toBe(false);
    expect(f.overlapsSiblings).toBe(false);
  });

  test("P2-1: purchase and refill still work, and a short balance still shows 「あと N Pitz たりません」", async ({ page }) => {
    await openShop(page, 999);
    await page.locator('.shop-item[data-ingredient-id="pepperoni"]').getByRole("button", { name: "仕入れる" }).click();
    await expect(page.locator('.shop-item[data-ingredient-id="pepperoni"]')).toHaveAttribute("data-shop-state", "OWNED");
    await expect(page.locator(".shop-overlay__balance")).toContainText("919 Pitz");
    const oil = page.locator('.shop-item[data-ingredient-id="olive-oil"]');
    const before = await oil.locator(".shop-item__stock").innerText();
    await oil.getByRole("button", { name: "補充する" }).click();
    await expect(page.locator('.shop-item[data-ingredient-id="olive-oil"] .shop-item__stock')).not.toHaveText(before);

    // A short balance: the button is disabled and the row says how much is missing (unchanged copy).
    await openShop(page, 70);
    const anchovy = page.locator('.shop-item[data-ingredient-id="anchovy"]');
    await expect(anchovy.getByRole("button", { name: "仕入れる" })).toBeDisabled();
    await expect(anchovy.locator(".shop-item__shortfall")).toHaveText(/あと \d+ Pitz たりません/);
    await expect(page.locator(".shop-item__shortfall").first()).toBeVisible();
  });

  test("P2-2: the tabs stay pinned and usable while the list scrolls; a tab tap filters the list", async ({ page }) => {
    await openShop(page);
    const facts = () =>
      page.evaluate(() => {
        const body = document.querySelector<HTMLElement>(".shop-overlay__body")!;
        const tabs = document.querySelector<HTMLElement>(".shop-overlay__shelf > .shelf-tabs")!;
        const b = body.getBoundingClientRect();
        const t = tabs.getBoundingClientRect();
        return { scrollTop: body.scrollTop, bodyTop: b.top, tabsTop: t.top, tabsBottom: t.bottom, tabsH: t.height, vh: window.innerHeight };
      });
    const start = await facts();
    expect(start.scrollTop).toBe(0);

    // Scroll deep into the list: the tabs are still at the top edge of the scrolling body, fully visible.
    await page.locator(".shop-item").nth(12).scrollIntoViewIfNeeded();
    const deep = await facts();
    expect(deep.scrollTop).toBeGreaterThan(400);
    expect(Math.abs(deep.tabsTop - deep.bodyTop)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("group", { name: "材料の大分類" })).toBeInViewport();

    // Tapping 具材 while scrolled filters the list; the family row appears and is pinned too.
    await page.getByRole("group", { name: "材料の大分類" }).getByRole("button", { name: "具材", exact: true }).click();
    await expect(page.getByRole("group", { name: "具材の分類" })).toBeInViewport();
    const toppings = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".shop-item")].every((e) => !["tomato-sauce", "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina"].includes(e.dataset.ingredientId!)),
    );
    expect(toppings).toBe(true);
    const family = await facts();
    expect(Math.abs(family.tabsTop - family.bodyTop)).toBeLessThanOrEqual(1);
    // the pinned block never takes more than a fifth of the viewport (two tiers at most)
    expect(family.tabsH).toBeLessThanOrEqual(family.vh * 0.2);
    await page.getByRole("group", { name: "具材の分類" }).getByRole("button", { name: "肉系", exact: true }).click();
    const meat = await page.locator(".shop-item .family-tag").allInnerTexts();
    expect(meat.length).toBeGreaterThan(0);
    expect(meat.every((t) => t.includes("肉系"))).toBe(true);
    // back to すべて from the pinned row, without scrolling to the top first
    await page.getByRole("group", { name: "材料の大分類" }).getByRole("button", { name: "すべて", exact: true }).click();
    expect(await page.locator(".shop-item").count()).toBe(18);
  });

  test("P2-2: the pinned tabs release before the LOCKED section and never cover its slots", async ({ page }) => {
    await openShop(page);
    await page.locator(".shop-locked__cell").last().scrollIntoViewIfNeeded();
    const f = await page.evaluate(() => {
      const body = document.querySelector<HTMLElement>(".shop-overlay__body")!;
      const tabs = document.querySelector<HTMLElement>(".shop-overlay__shelf > .shelf-tabs")!.getBoundingClientRect();
      const locked = document.querySelector<HTMLElement>("[data-shop-locked-section]")!.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      return {
        tabsBottom: tabs.bottom,
        lockedTop: locked.top,
        tabsAboveLocked: tabs.bottom <= locked.top + 0.5,
        tabsLeftBody: tabs.bottom <= bodyRect.top + 0.5, // scrolled out with the list
        cells: document.querySelectorAll(".shop-locked__cell").length,
      };
    });
    expect(f.cells).toBeGreaterThan(20);
    expect(f.tabsAboveLocked).toBe(true);
    expect(f.tabsLeftBody).toBe(true);
  });

  test("regression: the Inventory tabs are not sticky and keep their layout", async ({ page }) => {
    await openApp(page, 70);
    await page.getByRole("button", { name: /材料/ }).first().click();
    await page.waitForSelector(".inventory-overlay__body");
    const pos = await page.evaluate(() => getComputedStyle(document.querySelector(".inventory-overlay__shelves .shelf-tabs")!).position);
    expect(pos).toBe("static");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
