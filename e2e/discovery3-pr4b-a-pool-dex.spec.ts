import { test, expect, type Page } from "@playwright/test";
import { PROFILES, ProfileDriver, readViewport, type Profile } from "./support/layoutProfiles";
import { runOnlyOnWidth } from "./support/projectGuard";

/**
 * Discovery 3.0 PR-4b-A (Owner D-1 / D-2 / D-3): a state-derived pool > 1 -- here a migrated save (Dex 11 and every
 * later material already owned and stocked, so several unknown pizzas are DISCOVERABLE at once). The Dex shows ONE
 * aggregated "something is still left to find" notice and no per-candidate card, tag or hint button; the Free Cooking
 * hint sheet auto-targets nothing and says only that something is left. Layout is checked at 390x844 and 360x800
 * (plus the other Layout Contract profiles on Chromium); production has no such state on the normal path.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const LADDER: [string, string[]][] = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
];
const FOUND = LADDER.map(([id]) => id);
const LADDER_MATERIALS = LADDER.flatMap(([, m]) => m);
// Materials of later steps, owned and stocked: capricciosa, portuguesa, fugazza ... are all makeable now.
const LATER = ["black-olive", "oregano", "onion", "olive-oil", "garlic", "anchovy"];
const MATERIALS = [...LADDER_MATERIALS, ...LATER];
const SAVE = {
  schemaVersion: 2,
  dex: FOUND.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...MATERIALS],
  missionBest: {},
  inventory: Object.fromEntries(MATERIALS.map((m) => [m, 10])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: MATERIALS,
};
const UNDISCOVERED = ["カプリチョーザ", "ピッツァ・ポルトゲーザ", "フガッサ", "マリナーラ", "ナポレターナ"];

async function openWithSave(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    localStorage.setItem("teto.dev.hint5Ladder", "0");
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

const profilesFor = (browserName: string): Profile[] => {
  const all = Object.values(PROFILES);
  return browserName === "chromium" ? all : all.filter((p) => !p.inset);
};

async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test.describe("Discovery 3.0 PR-4b-A: aggregated unknown Dex (pool > 1)", () => {
  test.beforeEach(() => runOnlyOnWidth(test.info(), 390));

  test("Dex: one aggregated notice, no per-candidate card or hint entry, no leak, laid out on every profile", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page);
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await expect(page.locator(".dex-overlay")).toBeVisible();

    const aggregated = page.locator("[data-dex-aggregated]");
    await expect(aggregated).toHaveCount(1);
    await expect(aggregated).toContainText("まだ発見できるピザがあるよ");
    await expect(page.locator('.dex-card[data-dex-state="DISCOVERABLE"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ヒントを見る/ })).toHaveCount(0);
    // Same card count as always: every recipe keeps its own slot, plus the one notice.
    expect(await page.locator(".dex-card").count()).toBe(25 + 1);

    const lockedText = (await page.locator(".dex-card--locked").allTextContents()).join("|");
    for (const name of UNDISCOVERED) expect(lockedText).not.toContain(name);

    for (const profile of profilesFor(browserName)) {
      await driver.apply(profile);
      await aggregated.scrollIntoViewIfNeeded();
      const vp = await readViewport(page);
      const m = await page.evaluate(() => {
        const c = document.querySelector("[data-dex-aggregated]")!;
        const cta = c.querySelector("button")!.getBoundingClientRect();
        const r = c.getBoundingClientRect();
        const body = document.querySelector(".dex-overlay__body")!;
        return {
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: body.scrollWidth,
          bodyWidth: body.clientWidth,
          cta: { top: cta.top, bottom: cta.bottom, left: cta.left, right: cta.right },
          card: { left: r.left, right: r.right },
        };
      });
      const where = `Dex @${profile.id}`;
      expect.soft(m.scrollWidth, `${where}: page overflow`).toBeLessThanOrEqual(vp.innerWidth);
      expect.soft(m.bodyScrollWidth, `${where}: Dex list overflow`).toBeLessThanOrEqual(m.bodyWidth + 0.5);
      expect.soft(m.cta.left >= m.card.left - 0.5 && m.cta.right <= m.card.right + 0.5, `${where}: CTA inside its card`).toBe(true);
      expect.soft(m.cta.top >= 0 && m.cta.bottom <= vp.innerHeight - vp.sab + 0.5, `${where}: CTA on screen`).toBe(true);
    }
    await driver.apply(PROFILES.N390);
    await aggregated.scrollIntoViewIfNeeded();
    await capture(page, "pr4b-a-dex-aggregated-390");
    await driver.apply(PROFILES.N360);
    await aggregated.scrollIntoViewIfNeeded();
    await capture(page, "pr4b-a-dex-aggregated-360");
  });

  test("notice CTA -> Free Cooking -> hint sheet: nothing is auto-targeted, only 'something is left'; nothing is saved", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page);
    const before = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.locator("[data-dex-aggregated]").getByRole("button", { name: "フリークッキングで探す" }).click();
    await expect(page.locator(".dex-overlay")).toHaveCount(0);
    await expect(page.locator(".order-card--free-cook")).toBeVisible();

    await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
    const sheet = page.getByRole("dialog", { name: /ヒント/ });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("まだ見つけていないピザがありそう");
    await expect(sheet.getByRole("button", { name: "ヒントをもらう" })).toHaveCount(0);
    for (const name of UNDISCOVERED) await expect(sheet).not.toContainText(name);

    for (const profile of profilesFor(browserName)) {
      await driver.apply(profile);
      const vp = await readViewport(page);
      const m = await page.evaluate(() => {
        const s = document.querySelector(".hint-sheet")!.getBoundingClientRect();
        return { scrollWidth: document.documentElement.scrollWidth, bottom: s.bottom };
      });
      expect.soft(m.scrollWidth, `sheet @${profile.id}: overflow`).toBeLessThanOrEqual(vp.innerWidth);
      expect.soft(m.bottom, `sheet @${profile.id}: in viewport`).toBeLessThanOrEqual(vp.innerHeight + 0.5);
    }
    await driver.apply(PROFILES.N390);
    await capture(page, "pr4b-a-hint-sheet-pool-390");
    await sheet.getByRole("button", { name: "閉じる" }).click();
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(before);
  });
});
