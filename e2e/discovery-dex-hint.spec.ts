import { test, expect, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { PROFILES, ProfileDriver, readViewport, type Profile } from "./support/layoutProfiles";
import { runOnlyOnWidth } from "./support/projectGuard";

/**
 * Discovery Hint 2.0 (Issue #229, 229-D): Recipe Dex 🎨 ？？？ card -> 「💡 ヒントを見る」 -> Free
 * Cooking PREPARE with the hint sheet -> H1..H3 -> close -> cook right away.
 *
 * Dex 11 ladder save: capricciosa (chapter 2) is the one DISCOVERABLE card. At 390x844, 360x800,
 * the short 360x640 and (Chromium) the 390x664 safe-area profile: no horizontal overflow, the card
 * CTA fully visible and no card overlap in the chapter list, the sheet <= 45dvh with its CTA above
 * the bottom inset, and the Free Cooking screen underneath unmoved. Runs once per engine.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const LADDER: [string, string[]][] = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]],
];
const materials = LADDER.flatMap(([, m]) => m);
const DEX11_SAVE = {
  schemaVersion: 2,
  dex: LADDER.slice(0, 11).map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 10])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};
const UNDISCOVERED = ["カプリチョーザ", "ピッツァ・ポルトゲーザ", "フガッサ", "マリナーラ"];

async function openWithSave(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(DEX11_SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/11\/25/);
}

function profilesFor(browserName: string): Profile[] {
  return browserName === "chromium"
    ? [PROFILES.N390, PROFILES.N360, PROFILES.S360, PROFILES.E390i]
    : [PROFILES.N390, PROFILES.N360, PROFILES.S360];
}

const card = (page: Page) => page.locator('.dex-card[data-dex-state="DISCOVERABLE"]');

async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

async function checkDex(page: Page, driver: ProfileDriver, browserName: string) {
  for (const profile of profilesFor(browserName)) {
    await driver.apply(profile);
    await card(page).scrollIntoViewIfNeeded();
    const vp = await readViewport(page);
    const m = await page.evaluate(() => {
      const c = document.querySelector('.dex-card[data-dex-state="DISCOVERABLE"]')!;
      const cta = c.querySelector("button")!.getBoundingClientRect();
      const rect = c.getBoundingClientRect();
      const list = [...c.parentElement!.children].map((el) => el.getBoundingClientRect());
      const overlaps = list.some((a, i) => list.some((b, j) => i < j && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5));
      const plain = [...c.parentElement!.querySelectorAll('.dex-card[data-dex-state="UNKNOWN"]')].map((el) => el.getBoundingClientRect().height);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        panelScrollWidth: document.querySelector(".dex-overlay__body")!.scrollWidth,
        panelWidth: document.querySelector(".dex-overlay__body")!.clientWidth,
        cta: { top: cta.top, bottom: cta.bottom, left: cta.left, right: cta.right },
        card: { left: rect.left, right: rect.right, height: rect.height },
        overlaps,
        plainHeight: plain.length ? Math.max(...plain) : rect.height,
      };
    });
    const where = `Dex @${profile.id}`;
    expect.soft(m.scrollWidth, `${where}: page overflow`).toBeLessThanOrEqual(vp.innerWidth);
    expect.soft(m.panelScrollWidth, `${where}: Dex list overflow`).toBeLessThanOrEqual(m.panelWidth + 0.5);
    expect.soft(m.cta.left >= m.card.left - 0.5 && m.cta.right <= m.card.right + 0.5, `${where}: CTA inside its card`).toBe(true);
    expect.soft(m.cta.top >= 0 && m.cta.bottom <= vp.innerHeight - vp.sab + 0.5, `${where}: CTA on screen`).toBe(true);
    expect.soft(m.overlaps, `${where}: cards overlap`).toBe(false);
    expect.soft(m.card.height, `${where}: card height vs a plain locked card`).toBeLessThanOrEqual(m.plainHeight * 2);
  }
  await driver.apply(PROFILES.N390);
}

const BACKGROUND = [".pizza-stage", ".making-step-tabs", ".prepare-bake-bar", ".order-card"];
const rects = (page: Page) =>
  page.evaluate(
    (sels) => sels.map((s) => {
      const b = document.querySelector(s)?.getBoundingClientRect();
      return b ? [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10) : null;
    }),
    BACKGROUND,
  );

async function checkSheet(page: Page, driver: ProfileDriver, browserName: string, label: string, closed: Map<string, unknown>) {
  for (const profile of profilesFor(browserName)) {
    await driver.apply(profile);
    const vp = await readViewport(page);
    const m = await page.evaluate(() => {
      const s = document.querySelector(".hint-sheet")!.getBoundingClientRect();
      const cta = (document.querySelector(".hint-sheet__next") ?? document.querySelector(".hint-sheet__done"))!.getBoundingClientRect();
      return { scrollWidth: document.documentElement.scrollWidth, height: s.height, bottom: s.bottom, ctaBottom: cta.bottom };
    });
    const where = `${label} @${profile.id}`;
    expect.soft(m.scrollWidth, `${where}: overflow`).toBeLessThanOrEqual(vp.innerWidth);
    expect.soft(m.height, `${where}: sheet <= 45dvh`).toBeLessThanOrEqual(vp.innerHeight * 0.45 + 1);
    expect.soft(m.bottom, `${where}: sheet in viewport`).toBeLessThanOrEqual(vp.innerHeight + 0.5);
    expect.soft(m.ctaBottom, `${where}: CTA above the inset`).toBeLessThanOrEqual(vp.innerHeight - vp.sab + 0.5);
    expect.soft(await rects(page), `${where}: Free Cooking unmoved`).toEqual(closed.get(profile.id));
  }
  await driver.apply(PROFILES.N390);
}

test.describe("Discovery Hint 2.0 Dex entry (229-D)", () => {
  test.beforeEach(() => runOnlyOnWidth(test.info(), 390));

  test("Dex 🎨 card -> 「💡 ヒントを見る」 -> Free Cooking + hint sheet -> H1..H3 -> close -> cook", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page);
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await expect(page.locator(".dex-overlay")).toBeVisible();
    await expect(card(page)).toHaveCount(1);
    await expect(card(page).getByRole("button")).toHaveText(/ヒントを見る/);
    await expect(page.getByRole("button", { name: "フリークッキングで探す" })).toHaveCount(0);
    await checkDex(page, driver, browserName);
    const lockedText = (await page.locator(".dex-card--locked").allTextContents()).join("|");
    for (const name of UNDISCOVERED) expect(lockedText).not.toContain(name);
    await card(page).scrollIntoViewIfNeeded();
    await capture(page, "d1-dex-discoverable-card");

    await card(page).getByRole("button", { name: /ヒントを見る/ }).click();
    await expect(page.locator(".dex-overlay")).toHaveCount(0);
    await expect(page.locator(".order-card--free-cook")).toBeVisible();
    const sheet = page.getByRole("dialog", { name: /ヒント/ });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".hint-sheet__step")).toHaveCount(1);
    await capture(page, "d2-free-cook-sheet-h0");

    // Free Cooking underneath, measured with the sheet closed, per profile.
    await sheet.getByRole("button", { name: "閉じる" }).click();
    const closed = new Map<string, unknown>();
    for (const profile of profilesFor(browserName)) {
      await driver.apply(profile);
      closed.set(profile.id, await rects(page));
    }
    await driver.apply(PROFILES.N390);
    await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
    await expect(sheet.locator(".hint-sheet__step")).toHaveCount(1); // same pinned session, still H0

    await sheet.getByRole("button", { name: "次のヒントを見る" }).click();
    // H1 names capricciosa's key ingredient (oregano); the recipe itself is never named.
    await expect(sheet.locator(".hint-sheet__step--latest")).toContainText("オレガノ を使うピザが作れそう！");
    await checkSheet(page, driver, browserName, "H1", closed);
    await capture(page, "d3-h1");
    await sheet.getByRole("button", { name: "次のヒントを見る" }).click();
    await sheet.getByRole("button", { name: "次のヒントを見る" }).click();
    await expect(sheet.locator(".hint-sheet__step")).toHaveCount(4);
    await checkSheet(page, driver, browserName, "H3", closed);
    await capture(page, "d4-h3");
    for (const name of UNDISCOVERED) await expect(sheet).not.toContainText(name);

    await sheet.getByRole("button", { name: "閉じる" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" })).toBeFocused();
    await completeDoughStep(page);
    await expect(page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ })).toBeEnabled();
    await capture(page, "d5-closed-cooking");
  });
});
