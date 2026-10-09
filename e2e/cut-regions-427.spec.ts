import { test, expect } from "@playwright/test";
import { cutAndConfirm, counted, drawn, triangle } from "./support/cutInjection";

/**
 * #427 / #426: real-browser, coordinate-injected CUT verification (390x844 and 360x800 through the project).
 *
 * The three cuts are dragged along exact dough-unit coordinates (./support/cutInjection.ts). The pizza on screen is drawn as
 * every geometric region (data-piece-count); RESULT counts only the SIGNIFICANT ones. Pixel-level margins are deliberately
 * generous (a WebKit mouse may round to whole pixels), so nothing here sits near a threshold: the boundary itself is fixed
 * from both sides in src/logic/cut/regions.test.ts, and tools/cut-preview-hv checks the Preview URL override.
 */

test.describe("#427 / #426: what is drawn vs what RESULT counts (real gestures, dough-unit coordinates)", () => {
  test("three diameters through the centre: 6 drawn, 6等分, no target note", async ({ page }) => {
    test.setTimeout(90_000);
    await cutAndConfirm(page, triangle(0));
    expect(await drawn(page)).toBe("6");
    const text = await counted(page);
    expect(text).toContain("6等分");
    expect(text).not.toContain("目標");
  });

  test("the third cut ~2 u (6 px) off: the tiny centre triangle is drawn (7) but RESULT still says 6等分", async ({ page }) => {
    test.setTimeout(90_000);
    await cutAndConfirm(page, triangle(2));
    expect(Number(await drawn(page))).toBeGreaterThanOrEqual(6);
    const text = await counted(page);
    expect(text).toContain("6等分");
    expect(text).not.toContain("目標");
  });

  test("the third cut ~6 u (18 px) off: a clear triangle -- 7 drawn and RESULT says 7等分 (目標 6等分)", async ({ page }) => {
    test.setTimeout(90_000);
    await cutAndConfirm(page, triangle(6));
    expect(await drawn(page)).toBe("7");
    const text = await counted(page);
    expect(text).toContain("7等分");
    expect(text).toContain("目標 6等分");
  });

  test("a stroke that stops ~14 u short of the rim is a groove: it splits nothing and is not counted (4 drawn, 4等分)", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await cutAndConfirm(page, [{ angle: 0 }, { angle: 90 }, { angle: 45, stopShort: 14 }]);
    expect(await drawn(page)).toBe("4");
    const text = await counted(page);
    expect(text).toContain("4等分");
    expect(text).toContain("目標 6等分");
  });
});
