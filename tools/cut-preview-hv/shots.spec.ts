import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { cutAndConfirm, triangle } from "../../e2e/support/cutInjection";

/** Screenshots only (no assertions): the same three cuts, the third shifted d dough units, RESULT as the player sees it.
 *  SHOTS_DIR + SHOT_PREFIX (before / after) name the files. Run against any Preview build, main included. */
const DIR = process.env.SHOTS_DIR;
const PREFIX = process.env.SHOT_PREFIX ?? "shot";

for (const d of [1.5, 3, 6]) {
  test(`RESULT screenshots, third cut ${d} u off`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    if (!DIR) throw new Error("SHOTS_DIR is required");
    mkdirSync(DIR, { recursive: true });
    await cutAndConfirm(page, triangle(d), { previewSaveKey: "teto-pizza-preview-save-v1" });
    const name = `${PREFIX}-d${d}-${testInfo.project.name.replace("preview-", "")}`;
    await page.screenshot({ path: `${DIR}/${name}-1-pizza.png` });
    await page.locator(".cut-evaluation-summary__summary").first().click();
    await page.locator(".cut-evaluation-summary__slices").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/${name}-2-cut-detail.png` });
  });
}
