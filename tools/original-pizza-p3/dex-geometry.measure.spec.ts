import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * P3 Fresh Audit: measures the current Recipe Dex (no app change). Seeds the Preview `?hv=multi-sub`
 * save (capricciosa scenario: some recipes discovered, several undiscovered slots), opens the Dex
 * from HOME and records per-card geometry for discovered and locked cards.
 * Output: JSON to $P3_OUT (default: docs/reports/data/...P3..._DexGeometry.json) and screenshots
 * to $P3_SHOTS (default: a temp dir; never committed by this harness).
 */
const OUT = process.env.P3_OUT ?? resolve("docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3_DexGeometry.json");
const SHOTS = process.env.P3_SHOTS ?? resolve(process.env.TMPDIR ?? "/tmp", "p3-dex-shots");

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 360, h: 800 },
];

test("measure current Dex geometry", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const rows: unknown[] = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto("./?hv=multi-sub");
    await page.waitForTimeout(800);
    await page.getByText("ピザ図鑑").first().click();
    await page.locator(".dex-overlay").waitFor();
    await page.waitForTimeout(300);
    const data = await page.evaluate(() => {
      const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
      const body = document.querySelector(".dex-overlay__body");
      const cards = [...document.querySelectorAll(".dex-card")].map((c) => {
        const b = c.getBoundingClientRect();
        return { locked: c.classList.contains("dex-card--locked"), state: c.getAttribute("data-dex-state"), w: Math.round(b.width), h: Math.round(b.height) };
      });
      const hs = (locked: boolean) => cards.filter((c) => c.locked === locked).map((c) => c.h);
      const stat = (a: number[]) => (a.length ? { n: a.length, min: Math.min(...a), max: Math.max(...a), median: [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] } : null);
      const header = r(document.querySelector(".dex-overlay__header"));
      const bodyRect = r(body);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        bodyVisibleHeight: bodyRect ? Math.round(bodyRect.height) : null,
        bodyScrollHeight: body ? body.scrollHeight : null,
        headerHeight: header ? Math.round(header.height) : null,
        cardWidth: cards[0]?.w ?? null,
        discoveredCardHeight: stat(hs(false)),
        lockedCardHeight: stat(hs(true)),
        states: cards.reduce<Record<string, number>>((acc, c) => {
          const k = c.locked ? (c.state ?? "?") : "DISCOVERED";
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
      };
    });
    await page.screenshot({ path: resolve(SHOTS, `dex-${vp.w}x${vp.h}.png`) });
    rows.push({ viewport: vp, ...data });
    await ctx.close();
  }
  writeFileSync(OUT, `${JSON.stringify({ tool: "tools/original-pizza-p3/dex-geometry.measure.spec.ts", seed: "?hv=multi-sub (Preview)", rows }, null, 2)}\n`);
});
