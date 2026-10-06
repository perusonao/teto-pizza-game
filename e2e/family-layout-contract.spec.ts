import { expect, test as base, type Page } from "@playwright/test";
import { LayoutContract } from "./support/layoutContract";
import { type ProfileId } from "./support/layoutProfiles";
import { bootFree, HAND_ON_OWNED, toTopping } from "./support/familyTray";

/**
 * Cooking Tray family row x the Layout Contract profiles (Issue #399). On every profile of the project (the Layout Contract's
 * own N / S profiles, and on Chromium the safe-area ones) the family row is above the ingredient cards: the pizza is never
 * smaller than before the family filter, the filter has the whole row width, and nothing overflows sideways. LC-S3's floors are
 * in layout-contract.spec.ts.
 * File name ends in `layout-contract.spec.ts` so the `layout-chromium` project (and the WebKit projects' N / S profiles) run it.
 */
const test = base.extend<{ lc: LayoutContract }>({
  lc: async ({ page, browserName }, provide, testInfo) => {
    const lc = await LayoutContract.start(page, testInfo, browserName);
    try {
      await provide(lc);
    } finally {
      await lc.finish();
    }
  },
});

/** The authority (Owner HV): the family row is ALWAYS its own row above the ingredient cards, full width, and the Research / Free
 *  Cooking note cards above the pizza are gone. `atLeast` is the pizza a FREE round had before the family filter existed (the
 *  pre-#396 sizes measured on main: N = the cap, S / E = what the stage allowed with the 47px note card still there); `pizza` the
 *  Chromium size measured on this layout. */
const EXPECT: Record<ProfileId, { pizza: number; atLeast: number; family: number }> = {
  N390: { pizza: 290, atLeast: 290, family: 366 },
  N360: { pizza: 273.59, atLeast: 273.59, family: 336 },
  P390i: { pizza: 290, atLeast: 290, family: 366 },
  S390: { pizza: 274, atLeast: 269.06, family: 366 },
  S360: { pizza: 250, atLeast: 245.06, family: 336 },
  E390i: { pizza: 0, atLeast: 188.06, family: 366 },
  E360i: { pizza: 0, atLeast: 164.06, family: 336 },
};

async function measure(page: Page) {
  return page.evaluate(() => {
    const R = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const stage = document.querySelector(".pizza-stage")!;
    const cap = parseFloat(getComputedStyle(stage, "::before").width);
    return {
      mode: document.querySelector(".tray-family-row") ? ("expanded" as const) : ("compact" as const),
      pizza: R(".pizza-dough").width,
      cap,
      family: R('[aria-label="具材の絞り込み"]').width,
      bar: R(".prepare-bake-bar"),
      vh: window.innerHeight,
      ovfX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

test("family row on every Layout Contract profile: always above the cards, the pizza never smaller than before the family filter", async ({ page, lc, browserName }) => {
  test.setTimeout(240_000);
  await bootFree(page, 390, 844, HAND_ON_OWNED);
  await toTopping(page);
  for (const profile of lc.profiles) {
    await lc.apply(profile);
    await page.waitForTimeout(500);
    const m = await measure(page);
    const exp = EXPECT[profile.id];
    expect(m.mode, `${profile.id}: the family row is above the cards`).toBe("expanded");
    expect(m.ovfX, `${profile.id}: no sideways page scroll`).toBe(false);
    expect(m.bar.bottom, `${profile.id}: the bake bar stays on screen`).toBeLessThanOrEqual(m.vh + 1);
    expect(m.pizza, `${profile.id}: never above the cap`).toBeLessThanOrEqual(m.cap + 0.6);
    expect(m.pizza, `${profile.id}: pizza ${m.pizza} is at least its pre-family-filter size ${exp.atLeast}`).toBeGreaterThanOrEqual(exp.atLeast - 0.6);
    if (browserName === "chromium") {
      if (exp.pizza > 0) expect(Math.abs(m.pizza - exp.pizza), `${profile.id}: pizza ${m.pizza} (expected ${exp.pizza})`).toBeLessThanOrEqual(0.6);
      expect(Math.abs(m.family - exp.family), `${profile.id}: filter usable width ${m.family}`).toBeLessThanOrEqual(1.5);
    }
  }
});
