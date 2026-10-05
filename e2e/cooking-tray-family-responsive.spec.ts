import { expect, test, type Page } from "@playwright/test";
import { runOnlyOnWidth } from "./support/projectGuard";
import { bootFree, bootResearch, HAND_ON_OWNED, toTopping } from "./support/familyTray";

/**
 * Cooking Tray family row, the switch between the EXPANDED and the COMPACT layout (Issue #399). The family filter takes its own
 * row above the tray only while the pizza stage can spare that row's height (prepareDock.ts `familyRowFits`, measured from the
 * stage and the pizza cap the CSS itself defines), so the pizza is never smaller than the one-row layout would leave it.
 * Real Chromium, the viewport height swept by 1px on the same page (down, then up): one switch each way (the hysteresis is a
 * couple of px), the pizza never jumps, the bake bar follows the height exactly, the tray moves only by the one gap the
 * expanded layout adds, and nothing oscillates. Profiles (safe-area insets included) are in family-layout-contract.spec.ts.
 */
const PAGE_CAP = { 390: 290, 360: 273.6 } as const;
/** The tray's distance to the bake bar differs by the pager row's 4px extra gap between the two layouts, nothing else. */
const LAYOUT_STEP = 4;

interface Sample {
  h: number;
  mode: "expanded" | "compact";
  pizza: number;
  tray: number;
  bar: number;
  dock: number;
  ovfX: boolean;
}

async function frames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

async function sample(page: Page, h: number): Promise<Sample> {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: h });
  await frames(page);
  await frames(page);
  return page.evaluate((hh) => {
    const R = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const cards = [...document.querySelectorAll(".ingredient-chip")].map((c) => c.getBoundingClientRect().top);
    return {
      h: hh,
      mode: document.querySelector(".tray-family-row") ? ("expanded" as const) : ("compact" as const),
      pizza: Math.round(R(".pizza-dough").width * 100) / 100,
      tray: Math.round(Math.min(...cards) * 100) / 100,
      bar: Math.round(R(".prepare-bake-bar").top * 100) / 100,
      dock: Math.round(R(".prepare-dock").height * 100) / 100,
      ovfX: document.documentElement.scrollWidth > window.innerWidth,
    };
  }, h);
}

/** Heights `from` -> `to` (inclusive): 1px steps within `fine` of the first switch found by a 4px coarse pass, 4px elsewhere. */
function plan(from: number, to: number, fineAround: number | null, fine = 8): number[] {
  const dir = to < from ? -1 : 1;
  const out: number[] = [];
  for (let h = from; dir < 0 ? h >= to : h <= to; ) {
    out.push(h);
    h += fineAround !== null && Math.abs(h - fineAround) <= fine + 4 ? dir : dir * 4;
  }
  return out;
}

function switches(samples: Sample[]): number[] {
  const at: number[] = [];
  for (let i = 1; i < samples.length; i += 1) if (samples[i]!.mode !== samples[i - 1]!.mode) at.push(i);
  return at;
}

function expectNoJumps(samples: Sample[], cap: number, where: string) {
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    expect(s.ovfX, `${where} h=${s.h}: no sideways page scroll`).toBe(false);
    if (s.mode === "expanded") expect(Math.abs(s.pizza - cap), `${where} h=${s.h}: expanded only while the pizza is at its cap`).toBeLessThanOrEqual(0.6);
    if (i === 0) continue;
    const p = samples[i - 1]!;
    const dh = s.h - p.h;
    expect(Math.abs(s.pizza - p.pizza), `${where} h=${p.h}->${s.h}: pizza jump`).toBeLessThanOrEqual(Math.abs(dh) + 0.6); // it only follows the stage, never more than the height change
    if (s.mode !== p.mode) {
      expect(Math.abs(s.pizza - p.pizza), `${where} h=${p.h}->${s.h}: the pizza does not change at the switch`).toBeLessThanOrEqual(0.6);
    }
    expect(Math.abs(s.bar - p.bar - dh), `${where} h=${p.h}->${s.h}: the bake bar follows the height 1:1`).toBeLessThanOrEqual(0.6);
    const gap = (x: Sample) => x.bar - x.tray;
    const expected = s.mode === p.mode ? 0 : s.mode === "expanded" ? LAYOUT_STEP : -LAYOUT_STEP;
    expect(Math.abs(gap(s) - gap(p) - expected), `${where} h=${p.h}->${s.h}: tray-to-bar distance changes only by the one extra gap at the switch`).toBeLessThanOrEqual(0.6);
  }
}

for (const width of [390, 360] as const) {
  for (const kind of ["FREE", "Research"] as const) {
    test(`responsive: a 1px height sweep switches once each way, the pizza never jumps, nothing oscillates: ${kind} ${width}`, async ({ page }, testInfo) => {
      runOnlyOnWidth(testInfo, width);
      test.setTimeout(240_000);
      if (kind === "FREE") await bootFree(page, width, 880, HAND_ON_OWNED);
      else await bootResearch(page, width, 880);
      await toTopping(page);

      // coarse pass down: where does the layout switch?
      const coarse: Sample[] = [];
      // stop above DM-3R-0's own `@media (max-height: 700px)` step (chip rows 64 -> 58px): it sits at a slightly different height per engine
      // and is not what is being tested; the family row never expands at or below it, which family-layout-contract.spec.ts holds
      for (let h = 880; h >= 708; h -= 4) coarse.push(await sample(page, h));
      const idx = switches(coarse);
      expect(idx.length, "one switch on the way down").toBe(1);
      const switchAt = coarse[idx[0]!]!.h;
      expect(coarse[0]!.mode).toBe("expanded");
      expect(coarse[coarse.length - 1]!.mode).toBe("compact");

      // fine sweeps around it, down and up, on the same page (state carries over: this is where the hysteresis shows)
      const down: Sample[] = [];
      for (const h of plan(switchAt + 14, switchAt - 14, switchAt, 10)) down.push(await sample(page, h));
      const up: Sample[] = [];
      for (const h of plan(switchAt - 14, switchAt + 14, switchAt, 10)) up.push(await sample(page, h));
      const all = [...coarse, ...down, ...up];
      const full = [...down, ...up];
      expect(switches(down).length, "down: exactly one switch").toBe(1);
      expect(switches(up).length, "up: exactly one switch").toBe(1);
      expect(switches(full).length, "no oscillation: one switch down, one back up, nothing else").toBe(2);
      const downAt = down[switches(down)[0]!]!.h; // first compact height going down
      const upAt = up[switches(up)[0]!]!.h; // first expanded height going up
      expect(upAt - downAt, "the way back switches within a few px of the way there (hysteresis)").toBeGreaterThanOrEqual(0);
      expect(upAt - downAt).toBeLessThanOrEqual(8);

      expectNoJumps(coarse, PAGE_CAP[width], "coarse");
      expectNoJumps(down, PAGE_CAP[width], "down");
      expectNoJumps(up, PAGE_CAP[width], "up");
      testInfo.annotations.push({ type: "measure", description: `${kind} ${width}: switches to compact at h=${downAt} going down, back to expanded at h=${upAt} going up; ${all.length} samples` });
    });
  }
}
