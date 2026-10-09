import { test, expect, type Page } from "@playwright/test";

/**
 * #422 PR-B: the Shop's anonymous LOCKED section through real layout at 390x844 and 360x800.
 * Asserts: a separate 2-column grid, no horizontal overflow, nothing identifying inside the slots,
 * NEW/OWNED rows still a single column, and the section reachable by scrolling the Shop body.
 * With SHOT=1 it also writes before/after screenshots for the Human Verification record.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];

function save(unlocked: string[], owned: string[]) {
  return {
    schemaVersion: 2,
    dex: [{ recipeId: "margherita", discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 }],
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((id) => [id, 9])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: unlocked,
  };
}

async function openShop(page: Page, data: unknown) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(data)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ショップ/ }).click();
  await page.waitForSelector(".shop-overlay__body");
}

const shot = (page: Page, name: string) =>
  process.env.SHOT
    ? page.screenshot({ path: `docs/reports/screenshots/shop-locked-422/${name}-${page.viewportSize()!.width}.png` })
    : Promise.resolve(undefined);

test.describe("Shop LOCKED section (#422 PR-B)", () => {
  test("2-column grid, no overflow, anonymous, below the single-column rows", async ({ page }) => {
    await openShop(page, save(["egg", "bacon"], ["mushroom"]));
    await page.addStyleTag({ content: "[data-shop-locked-section]{display:none!important}" });
    await shot(page, "before");
    await page.reload();
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__body");

    const section = page.locator("[data-shop-locked-section]");
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();

    const f = await page.evaluate(() => {
      const vw = window.innerWidth;
      const cells = [...document.querySelectorAll<HTMLElement>(".shop-locked__cell")].map((c) => c.getBoundingClientRect());
      const items = [...document.querySelectorAll<HTMLElement>(".shop-item")].map((c) => c.getBoundingClientRect());
      const grid = document.querySelector<HTMLElement>(".shop-locked__grid")!;
      const body = document.querySelector<HTMLElement>(".shop-overlay__body")!;
      return {
        cols: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        firstRowCells: cells.filter((r) => Math.abs(r.top - cells[0].top) < 2).length,
        cellMinH: Math.min(...cells.map((r) => r.height)),
        cellsInside: cells.every((r) => r.left >= 0 && r.right <= vw + 0.5),
        pageOverflow: document.documentElement.scrollWidth > vw,
        bodyOverflowX: body.scrollWidth > body.clientWidth + 1,
        itemsSingleColumn: new Set(items.map((r) => Math.round(r.left))).size === 1,
        itemsAboveLocked: items.every((r) => r.top < cells[0].top),
        count: cells.length,
      };
    });
    expect(f.cols).toBe(2);
    expect(f.firstRowCells).toBe(2);
    expect(f.count).toBeGreaterThan(20);
    expect(f.cellMinH).toBeGreaterThanOrEqual(44);
    expect(f.cellsInside).toBe(true);
    expect(f.pageOverflow).toBe(false);
    expect(f.bodyOverflowX).toBe(false);
    expect(f.itemsSingleColumn).toBe(true);
    expect(f.itemsAboveLocked).toBe(true);
    await expect(section.getByRole("button")).toHaveCount(0);
    await shot(page, "after-locked");

    // The last slot is reachable and fully on screen after scrolling to the end.
    await page.locator(".shop-locked__cell").last().scrollIntoViewIfNeeded();
    const last = await page.locator(".shop-locked__cell").last().boundingBox();
    const vh = page.viewportSize()!.height;
    expect(last!.y + last!.height).toBeLessThanOrEqual(vh + 0.5);
    await shot(page, "after-end");
  });

  test("the category tabs do not affect the LOCKED section", async ({ page }) => {
    await openShop(page, save(["egg", "bacon", "ham"], []));
    const before = await page.locator(".shop-locked__cell").count();
    await page.getByRole("group", { name: "材料の大分類" }).getByRole("button", { name: "具材", exact: true }).click();
    expect(await page.locator(".shop-locked__cell").count()).toBe(before);
    await expect(page.locator("[data-shop-locked-section]")).toHaveCount(1);
  });
});
