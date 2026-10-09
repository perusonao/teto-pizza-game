import { test } from "@playwright/test";
import { cutAndConfirm, triangle } from "../../e2e/support/cutInjection";

/** Human Verification video (390x844): the Preview build with the URL override, a 3rd cut a few px off. Not an assertion test. */
test.use({ video: { mode: "on", size: { width: 390, height: 844 } }, viewport: { width: 390, height: 844 } });

async function showCutDetail(page: import("@playwright/test").Page) {
  await page.waitForTimeout(1500); // the pizza, as the player sees it
  await page.locator(".cut-evaluation-summary__summary").first().click();
  await page.locator(".cut-evaluation-summary__slices").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500); // 「N等分」 and the badge
}

test("video: default, then the override", async ({ page }) => {
  test.setTimeout(180_000);
  const key = "teto-pizza-preview-save-v1";
  // 1) Defaults: a 3rd cut ~3 u (9 px) off -> a tiny centre triangle is drawn (7 pieces) but RESULT says 6等分.
  await cutAndConfirm(page, triangle(3), { previewSaveKey: key });
  await showCutDetail(page);
  // 2) Same cuts with ?cutAreaPct=0.05&cutMinWidth=0.5 -> that triangle now counts: 7等分.
  await cutAndConfirm(page, triangle(3), { previewSaveKey: key, query: "?cutAreaPct=0.05&cutMinWidth=0.5" });
  await showCutDetail(page);
  // 3) ?cutAreaPct=0.20&cutMinWidth=1.0 with a 3rd cut ~4.3 u off -> 6等分 (default would say 7).
  await cutAndConfirm(page, triangle(4.3), { previewSaveKey: key, query: "?cutAreaPct=0.20&cutMinWidth=1.0" });
  await showCutDetail(page);
});
