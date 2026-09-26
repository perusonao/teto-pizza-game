import { test, expect, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { PROFILES, ProfileDriver, readViewport, type Profile } from "./support/layoutProfiles";
import { runOnlyOnWidth } from "./support/projectGuard";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Discovery Hint 2.0 (Issue #229, 229-B): the Free Cooking hint bottom sheet on mobile.
 *
 * For each state (sheet closed / H1 / H3 / longest H4 / the empty states) and each profile
 * (390×844, 360×800, the short 390×664 / 360×640 and, on Chromium, the three safe-area profiles), checks:
 * no horizontal overflow, the sheet at most 45dvh and inside the viewport, its CTA visible above
 * the bottom safe-area inset, and the cooking screen underneath (stage, tabs, tray pager, bake
 * bar) at exactly the same place as with the sheet closed. Closing returns focus to 「ヒント」.
 *
 * The profiles are forced per state, so this runs once per engine (the *-390x844 project).
 * The final Layout Contract matrix for the sheet is 229-E.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const SEED_DOCUMENT = "icons/icon-16.png";
const LADDER = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]], ["pizza-portuguesa", ["onion"]], ["fugazza", ["olive-oil"]],
  ["marinara", ["garlic"]], ["napoletana", ["anchovy"]], ["tonno-e-cipolla", ["tuna"]], ["pesto-tonno", ["pesto"]],
  ["genovese", ["cherry-tomato"]], ["new-haven-apizza", ["clam"]], ["pesto-caprese", ["fresh-tomato"]],
  ["pesto-patate", ["potato"]], ["pizza-bianca", ["rosemary"]], ["puttanesca-pizza", ["capers"]],
  ["quattro-formaggi", ["fontina", "gorgonzola"]],
] as const;

/** The ladder played to `count` discoveries; the materials of steps <= count owned with `stock`
 *  (the newest step's with `newestStock`, or not owned at all when `newestOwned` is false). */
function ladderSave(
  count: number,
  opts: { newestOwned?: boolean; newestStock?: number; pitz?: number; purchases?: Record<string, number> } = {},
) {
  const materials = LADDER.slice(1, count + 1).flatMap(([, m]) => m);
  const newest = count >= 1 && count < LADDER.length ? LADDER[count][1] : [];
  const owned = materials.filter((m) => opts.newestOwned !== false || !(newest as readonly string[]).includes(m));
  return {
    schemaVersion: 2,
    dex: LADDER.slice(0, count).map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: opts.pitz ?? 999,
    ...(opts.purchases ? { discoveryHintPurchases: opts.purchases } : {}),
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, (newest as readonly string[]).includes(m) ? (opts.newestStock ?? 10) : 10])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
  };
}

const DEX11 = LADDER.slice(0, 11).map(([id]) => id);

async function openWithSave(page: Page, save: { dex: unknown[] }) {
  await page.goto(SEED_DOCUMENT);
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${save.dex.length}/25`));
}

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const sheet = (page: Page) => page.getByRole("dialog", { name: /ヒント/ });

async function startFreeCookAtTopping(page: Page) {
  await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  for (let i = 0; i < 3; i += 1) {
    const nextButton = bar(page).getByRole("button", { name: /次へ/ });
    if (!(await nextButton.count())) break;
    await nextButton.click();
  }
}

const BACKGROUND = [".pizza-stage", ".making-step-tabs", ".ingredient-page-nav", ".prepare-bake-bar", ".order-card"];

async function backgroundRects(page: Page) {
  return page.evaluate((sels) => {
    const out: Record<string, number[] | null> = {};
    for (const sel of sels) {
      const el = document.querySelector(sel);
      const b = el?.getBoundingClientRect();
      out[sel] = b ? [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10) : null;
    }
    return out;
  }, BACKGROUND);
}

async function sheetMetrics(page: Page) {
  return page.evaluate(() => {
    const s = document.querySelector(".hint-sheet")!.getBoundingClientRect();
    const cta =
      document.querySelector(".hint-sheet__next") ??
      document.querySelector(".hint-sheet__done") ??
      document.querySelector(".hint-sheet__empty-body");
    const c = cta!.getBoundingClientRect();
    const close = document.querySelector(".hint-sheet__close")!.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      sheet: { top: s.top, bottom: s.bottom, left: s.left, right: s.right, height: s.height },
      cta: { top: c.top, bottom: c.bottom },
      close: { top: close.top, bottom: close.bottom },
    };
  });
}

function profilesFor(browserName: string): Profile[] {
  // #229 Final Gate: the 7 Layout Contract profiles on Chromium; N and S at both widths on WebKit
  // (no safe-area override there).
  const all = Object.values(PROFILES);
  return browserName === "chromium" ? all : all.filter((p) => !p.inset);
}

/** Every profile: sheet geometry, and the background exactly where it is with the sheet closed. */
async function checkOpenState(page: Page, driver: ProfileDriver, browserName: string, label: string, closed: Map<string, unknown>) {
  for (const profile of profilesFor(browserName)) {
    await driver.apply(profile);
    const vp = await readViewport(page);
    const m = await sheetMetrics(page);
    const where = `${label} @${profile.id}`;
    expect.soft(m.scrollWidth, `${where}: horizontal overflow`).toBeLessThanOrEqual(vp.innerWidth);
    expect.soft(m.sheet.height, `${where}: sheet <= 45dvh`).toBeLessThanOrEqual(vp.innerHeight * 0.45 + 1);
    expect.soft(m.sheet.bottom, `${where}: sheet inside the viewport`).toBeLessThanOrEqual(vp.innerHeight + 0.5);
    expect.soft(m.sheet.left >= -0.5 && m.sheet.right <= vp.innerWidth + 0.5, `${where}: sheet width`).toBe(true);
    expect.soft(m.cta.bottom, `${where}: CTA above the bottom safe area`).toBeLessThanOrEqual(vp.innerHeight - vp.sab + 0.5);
    expect.soft(m.cta.top, `${where}: CTA inside the sheet`).toBeGreaterThanOrEqual(m.sheet.top);
    expect.soft(m.close.top, `${where}: 閉じる inside the sheet`).toBeGreaterThanOrEqual(m.sheet.top);
    expect.soft(await backgroundRects(page), `${where}: background unmoved`).toEqual(closed.get(profile.id));
  }
  await driver.apply(PROFILES.N390);
}

async function closedRects(page: Page, driver: ProfileDriver, browserName: string) {
  const out = new Map<string, unknown>();
  for (const profile of profilesFor(browserName)) {
    await driver.apply(profile);
    out.set(profile.id, await backgroundRects(page));
  }
  await driver.apply(PROFILES.N390);
  return out;
}

async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test.describe("Discovery Hint 2.0 sheet (229-B)", () => {
  test.beforeEach(() => runOnlyOnWidth(test.info(), 390));

  test("target flow: closed -> H1 -> H3 -> longest H4, background never moves, close restores", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    // Dex 11 with the ladder's materials: capricciosa (6 ingredients) is today's target -> 7 lines.
    await openWithSave(page, ladderSave(11));
    await startFreeCookAtTopping(page);
    const closed = await closedRects(page, driver, browserName);
    await capture(page, "01-closed-topping");

    const hint = bar(page).getByRole("button", { name: "ヒント" });
    await hint.click();
    await expect(sheet(page)).toBeVisible();
    await sheet(page).locator(".hint-sheet__next").click();
    await expect(sheet(page).locator(".hint-sheet__step")).toHaveCount(2);
    await checkOpenState(page, driver, browserName, "H1", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "sheet H1");
    await capture(page, "02-h1");

    await sheet(page).locator(".hint-sheet__next").click();
    await sheet(page).locator(".hint-sheet__next").click();
    await expect(sheet(page).locator(".hint-sheet__step")).toHaveCount(4);
    await checkOpenState(page, driver, browserName, "H3", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "sheet H3");
    await capture(page, "03-h3");

    while (await sheet(page).locator(".hint-sheet__next").count()) {
      await sheet(page).locator(".hint-sheet__next").click();
    }
    await expect(sheet(page).locator(".hint-sheet__step")).toHaveCount(7);
    await expect(sheet(page).getByText(/ヒントはここまで/)).toBeVisible();
    await expect(sheet(page)).not.toContainText("カプリチョーザ");
    await checkOpenState(page, driver, browserName, "H4 longest", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "sheet H4 longest");
    await capture(page, "04-h4-longest");

    // Background taps are blocked by the sheet's backdrop; closing restores everything.
    await sheet(page).getByRole("button", { name: "閉じる" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(hint).toBeFocused();
    expect(await backgroundRects(page)).toEqual(closed.get("N390"));
    await page.getByRole("button", { name: "次のページ" }).click();
    await capture(page, "05-closed-after");
  });

  for (const [kind, save, text] of [
    ["SHOP_NEW", ladderSave(6, { newestOwned: false }), /ショップに入荷した材料/],
    ["REFILL", ladderSave(6, { newestStock: 0 }), /材料が足りない/],
    ["COMPLETE", ladderSave(25), /図鑑コンプリート/],
  ] as const) {
    test(`empty state ${kind}`, async ({ page, browserName }) => {
      const driver = await ProfileDriver.create(page, browserName);
      await driver.apply(PROFILES.N390);
      await openWithSave(page, save);
      await startFreeCookAtTopping(page);
      const closed = await closedRects(page, driver, browserName);
      await bar(page).getByRole("button", { name: "ヒント" }).click();
      await expect(sheet(page)).toHaveAttribute("data-hint-kind", kind);
      await expect(sheet(page)).toContainText(text);
      await checkOpenState(page, driver, browserName, kind, closed);
      await expectNoUndiscoveredIdentity(page, save.dex.map((d) => d.recipeId), kind);
      await capture(page, `06-empty-${kind.toLowerCase()}`);
    });
  }

  // Discovery Hint Economy 1.0 (Issue #232, HE-3): the purchase CTA states, on the same geometry
  // contract (every profile: <= 45dvh, CTA above the safe area, background unmoved).
  test("purchase CTA: price + balance, buy H1, insufficient, reload keeps purchases", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    // Dex 11 (capricciosa, 6 ingredients -> the longest H4), 120 Pitz.
    await openWithSave(page, ladderSave(11, { pitz: 120 }));
    await startFreeCookAtTopping(page);
    const closed = await closedRects(page, driver, browserName);
    const hint = bar(page).getByRole("button", { name: "ヒント" });
    await hint.click();

    const cta = sheet(page).locator(".hint-sheet__next");
    await expect(cta).toHaveText("🔒次のヒントを解除 5 Pitz");
    await expect(sheet(page)).toContainText("所持 120 Pitz");
    await checkOpenState(page, driver, browserName, "H1 CTA", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "H1 CTA");

    await cta.click();
    await expect(sheet(page).locator(".hint-sheet__step")).toHaveCount(2);
    await expect(cta).toHaveText("🔒次のヒントを解除 10 Pitz");
    await expect(sheet(page)).toContainText("所持 115 Pitz");
    await cta.click();
    await cta.click();
    await cta.click();
    await expect(sheet(page).locator(".hint-sheet__step")).toHaveCount(7);
    // Nothing left to buy: the footer shows the closing line, no price and no balance line.
    await expect(sheet(page).getByText(/ヒントはここまで/)).toBeVisible();
    await expect(sheet(page)).not.toContainText("Pitz");
    await expect(page.locator(".app-header__pitz")).toContainText("45");
    await checkOpenState(page, driver, browserName, "purchased H4 longest", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "purchased H4 longest");
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.pitzBalance).toBe(45);
    expect(saved.discoveryHintPurchases).toEqual({ capricciosa: 4 });

    // Reload: every bought line is back, nothing is charged again.
    await page.reload();
    await page.waitForSelector(".app-frame");
    await startFreeCookAtTopping(page);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    await expect(sheet(page).locator(".hint-sheet__step")).toHaveCount(7);
    await expect(sheet(page).getByText(/ヒントはここまで/)).toBeVisible();
    await expect(page.locator(".app-header__pitz")).toContainText("45");
    await sheet(page).getByRole("button", { name: "閉じる" }).click();

    // Insufficient: H4 (40) with 25 Pitz -> disabled, calm; 閉じる still works and cooking goes on.
    await openWithSave(page, ladderSave(11, { pitz: 25, purchases: { capricciosa: 3 } }));
    await startFreeCookAtTopping(page);
    const closedShort = await closedRects(page, driver, browserName);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    await expect(cta).toBeDisabled();
    await expect(cta).toHaveText("🔒次のヒント 40 Pitz");
    await expect(sheet(page)).toContainText("所持 25 Pitz");
    await expect(sheet(page).getByRole("button", { name: "閉じる" })).toBeFocused();
    await checkOpenState(page, driver, browserName, "insufficient", closedShort);
    await expectNoUndiscoveredIdentity(page, DEX11, "insufficient");
    await sheet(page).getByRole("button", { name: "閉じる" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(bar(page).getByRole("button", { name: "ヒント" })).toBeFocused();
  });

  test("Dex 0 Margherita onboarding: free, no price and no balance", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page, ladderSave(0, { pitz: 0 }));
    await startFreeCookAtTopping(page);
    const closed = await closedRects(page, driver, browserName);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    const cta = sheet(page).locator(".hint-sheet__next");
    for (let level = 1; level <= 4; level += 1) {
      await expect(cta).toHaveText("次のヒントを見る");
      await expect(sheet(page)).not.toContainText("Pitz");
      if (level === 1) await checkOpenState(page, driver, browserName, "onboarding", closed);
      await cta.click();
    }
    await expect(sheet(page).getByText(/ヒントはここまで/)).toBeVisible();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.pitzBalance).toBe(0);
    expect(saved.discoveryHintPurchases ?? {}).toEqual({});
  });
});
