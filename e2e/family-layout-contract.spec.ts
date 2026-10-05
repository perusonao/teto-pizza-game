import { expect, test as base, type Page } from "@playwright/test";
import { LayoutContract } from "./support/layoutContract";
import { type ProfileId } from "./support/layoutProfiles";
import { bootFree, HAND_ON_OWNED, toTopping } from "./support/familyTray";

/**
 * Cooking Tray family row x the Layout Contract profiles (Issue #399). On every profile of the project (the Layout Contract's
 * own N / S profiles, and on Chromium the safe-area ones) the family row takes the layout its stage allows: EXPANDED at the
 * normal heights, COMPACT on the short ones, where the pizza is exactly what the one-row layout (= #401) gives. LC-S3's own
 * floors stay in layout-contract.spec.ts, untouched; this spec adds what the family row decides on top: the mode, the size of
 * the pizza against the cap CSS defines, the filter's usable width, and that nothing overflows sideways.
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

/** Chromium numbers measured on #401 (994e879) for a FREE round: the pizza the one-row layout gives on each profile. */
const EXPECT: Record<ProfileId, { mode: "expanded" | "compact"; pizza: number; family: number }> = {
  N390: { mode: "expanded", pizza: 290, family: 366 },
  N360: { mode: "expanded", pizza: 273.59, family: 336 },
  P390i: { mode: "expanded", pizza: 290, family: 366 },
  S390: { mode: "compact", pizza: 269.06, family: 150.8 },
  S360: { mode: "compact", pizza: 245.06, family: 120.8 },
  E390i: { mode: "compact", pizza: 188.06, family: 150.8 },
  E360i: { mode: "compact", pizza: 164.06, family: 120.8 },
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

test("family row on every Layout Contract profile: the mode its stage allows, the pizza never smaller than the one-row layout leaves it", async ({ page, lc, browserName }) => {
  test.setTimeout(240_000);
  await bootFree(page, 390, 844, HAND_ON_OWNED);
  await toTopping(page);
  for (const profile of lc.profiles) {
    await lc.apply(profile);
    await page.waitForTimeout(500);
    const m = await measure(page);
    const exp = EXPECT[profile.id];
    expect(m.ovfX, `${profile.id}: no sideways page scroll`).toBe(false);
    expect(m.bar.bottom, `${profile.id}: the bake bar stays on screen`).toBeLessThanOrEqual(m.vh + 1);
    if (m.mode === "expanded") expect(Math.abs(m.pizza - m.cap), `${profile.id}: expanded only with the pizza at its cap`).toBeLessThanOrEqual(0.6);
    expect(m.pizza, `${profile.id}: never above the cap`).toBeLessThanOrEqual(m.cap + 0.6);
    if (browserName === "chromium") {
      expect(m.mode, `${profile.id}: mode`).toBe(exp.mode);
      expect(Math.abs(m.pizza - exp.pizza), `${profile.id}: pizza ${m.pizza} (the one-row layout's ${exp.pizza})`).toBeLessThanOrEqual(0.6);
      expect(Math.abs(m.family - exp.family), `${profile.id}: filter usable width ${m.family}`).toBeLessThanOrEqual(1.5);
    } else {
      // WebKit: the N profiles (normal heights) are expanded, the S profiles (Safari's short height) compact.
      expect(m.mode, `${profile.id}: mode`).toBe(profile.id.startsWith("N") ? "expanded" : "compact");
    }
  }
});

