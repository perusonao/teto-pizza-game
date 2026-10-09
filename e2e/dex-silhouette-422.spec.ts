import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";

/**
 * #422 PR-A: the Dex's undiscovered slots carry one generic silhouette. Real-browser layout checks at
 * the two iPhone widths: no horizontal overflow, the silhouette is the same 40px disc on every locked
 * slot and stays inside the panel, the close button and every locked-slot CTA are >= 44x44, and the
 * list scrolls to its last row and the footer CTA. `HV_SCREENSHOT_DIR` (optional) receives screenshots.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const LADDER: [string, string[]][] = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
];
const materials = LADDER.flatMap(([, m]) => m);
const entry = (recipeId: string) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 });
const base = { schemaVersion: 2, pitzBalance: 999, missionBest: {}, starterGrantClaimedRecipeIds: [] };

const SAVES = {
  "0-discovered": { ...base, dex: [], ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], inventory: {}, unlockedForShopIngredientIds: [] },
  "mid-11-discovered": {
    ...base,
    dex: LADDER.map(([id]) => entry(id)),
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
    inventory: Object.fromEntries(materials.map((m) => [m, 10])),
    unlockedForShopIngredientIds: materials,
  },
  "all-discovered": { ...base, dex: RECIPES.map((r) => entry(r.id)), ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], inventory: {}, unlockedForShopIngredientIds: [] },
} as const;

async function openDex(page: Page, save: unknown) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    localStorage.setItem("teto.dev.hint5Ladder", "0");
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
}

for (const [name, save] of Object.entries(SAVES)) {
  test(`Dex silhouette layout: ${name}`, async ({ page }, testInfo) => {
    const dir = process.env.HV_SCREENSHOT_DIR;
    const shot = async (suffix: string) => {
      if (dir) await page.screenshot({ path: `${dir}/dex-${name}-${suffix}-${testInfo.project.name}.png` });
    };
    await openDex(page, save);
    const vw = page.viewportSize()!.width;
    const noOverflow = async () => {
      const o = await page.evaluate(() => {
        const body = document.querySelector<HTMLElement>(".dex-overlay__body")!;
        return {
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: body.scrollWidth - body.clientWidth,
        };
      });
      expect(o.page).toBeLessThanOrEqual(0);
      expect(o.body).toBeLessThanOrEqual(0);
    };
    await noOverflow();
    await shot("top");

    // close button: >= 44x44
    const close = await page.locator(".dex-overlay__close").boundingBox();
    expect(close!.width).toBeGreaterThanOrEqual(44);
    expect(close!.height).toBeGreaterThanOrEqual(44);

    const lockedCount = await page.locator(".anonymous-lock").count();
    expect(await page.locator(".generic-pizza-silhouette").count()).toBe(lockedCount);
    if (name === "all-discovered") expect(lockedCount).toBe(0);
    else expect(lockedCount).toBeGreaterThan(0);

    // every silhouette: same 40x40 disc, fully inside the viewport width (measured as it scrolls by)
    const sil = page.locator(".generic-pizza-silhouette");
    for (let i = 0; i < lockedCount; i++) {
      const el = sil.nth(i);
      await el.scrollIntoViewIfNeeded();
      const b = (await el.boundingBox())!;
      expect(Math.round(b.width)).toBe(40);
      expect(Math.round(b.height)).toBe(40);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vw);
    }

    // every locked-slot CTA: >= 44x44
    const ctas = page.locator(".dex-card--locked .dex-card__tag-cta");
    for (let i = 0; i < (await ctas.count()); i++) {
      await ctas.nth(i).scrollIntoViewIfNeeded();
      const b = (await ctas.nth(i).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }

    // scroll to the end: the last slot and the footer CTA are fully visible inside the panel
    await page.evaluate(() => {
      const body = document.querySelector<HTMLElement>(".dex-overlay__body")!;
      body.scrollTop = body.scrollHeight;
    });
    const lastCard = await page.locator(".dex-overlay__chapter .dex-card").last().boundingBox();
    const footerBtn = await page.locator(".dex-overlay__footer .cta-button").boundingBox();
    const vh = page.viewportSize()!.height;
    expect(footerBtn!.y + footerBtn!.height).toBeLessThanOrEqual(vh);
    expect(lastCard!.y + lastCard!.height).toBeLessThanOrEqual(footerBtn!.y);
    await noOverflow();
    await shot("bottom");
  });
}
