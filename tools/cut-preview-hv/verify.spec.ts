import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { cutAndConfirm, counted, drawn, triangle } from "../../e2e/support/cutInjection";

/**
 * #427 / #426 HV stage 1: the Preview URL override, end to end in a real Preview build. The same three cuts (the third one
 * shifted d dough units) are made under different `?cutAreaPct=&cutMinWidth=` pairs, and each pair must count them the way
 * src/logic/cut/regions.ts says -- while the number of DRAWN regions never moves with the override.
 *
 * Boundary d (rotation-independent, from regions.test.ts): 0.05% -> 2.5 u, 0.10% / 1.0 u (default) -> 3.55 u, 0.20% -> 5.0 u.
 * `SHOTS_DIR` writes the RESULT screenshots.
 */
const PREVIEW_SAVE_KEY = "teto-pizza-preview-save-v1";
const SHOTS = process.env.SHOTS_DIR;

interface Case {
  name: string;
  query: string;
  badge: string | null;
  /** [d, counted pieces] */
  expectations: [number, number][];
}

const CASES: Case[] = [
  { name: "default", query: "", badge: null, expectations: [[1.5, 6], [3.0, 6], [4.3, 7], [6, 7]] },
  { name: "0.05pct-0.5u", query: "?cutAreaPct=0.05&cutMinWidth=0.5", badge: "CUT 0.05%/0.5u", expectations: [[1.5, 6], [3.0, 7], [4.3, 7], [6, 7]] },
  { name: "0.20pct-1.0u", query: "?cutAreaPct=0.20&cutMinWidth=1.0", badge: "CUT 0.20%/1.0u", expectations: [[1.5, 6], [3.0, 6], [4.3, 6], [6, 7]] },
  // An invalid value falls back for that parameter only; the valid one still applies.
  { name: "invalid-area-valid-width", query: "?cutAreaPct=abc&cutMinWidth=2.0", badge: "CUT 0.10%/2.0u", expectations: [[6, 7]] },
  { name: "out-of-range-both", query: "?cutAreaPct=9&cutMinWidth=0.01", badge: null, expectations: [[4.3, 7]] },
];

for (const c of CASES) {
  for (const [d, want] of c.expectations) {
    test(`${c.name}: third cut ${d} u off -> RESULT counts ${want}, drawn stays 7`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await cutAndConfirm(page, triangle(d), { previewSaveKey: PREVIEW_SAVE_KEY, query: c.query });
      const text = await counted(page);
      expect(text).toContain(`${want}等分`);
      expect(await drawn(page)).toBe("7");
      const badge = await page.locator(".preview-badge").first().textContent();
      expect(badge).toContain("PREVIEW");
      if (c.badge) expect(badge).toContain(c.badge);
      else expect(badge).not.toContain("CUT ");
      // Nothing about the override is saved.
      const keys = await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)));
      expect(keys.filter((k) => /cut(Area|Min)|threshold/i.test(k))).toEqual([]);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/preview-${c.name}-d${d}-${testInfo.project.name}.png` });
      }
    });
  }
}

test("reloading without the query returns to the defaults (nothing was kept)", async ({ page }) => {
  test.setTimeout(120_000);
  await cutAndConfirm(page, triangle(4.3), { previewSaveKey: PREVIEW_SAVE_KEY, query: "?cutAreaPct=0.20&cutMinWidth=1.0" });
  expect(await counted(page)).toContain("6等分");
  await page.goto("./");
  await page.waitForSelector(".app-frame");
  expect(await page.locator(".preview-badge").first().textContent()).not.toContain("CUT ");
});
