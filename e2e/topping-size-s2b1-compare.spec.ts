import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { base, HAND_ON_OWNED, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * #479 S2b-1 capture (NOT a regression test): the six pilot ingredients on one pizza at the current sizes (no switch = 1.0) and under the
 * Preview / DEV comparison sets A and B (?toppingScale=a|b, src/preview/toppingScalePreview.ts), as screenshots plus the measured on-screen
 * box of each piece, for the Owner's comparison. Skipped unless TOPPING_SCALE_CAPTURE_DIR is set. The dev server the config starts allows the switch.
 */
const OUT = process.env.TOPPING_SCALE_CAPTURE_DIR;
const MODES = [
  { id: "off", query: "" },
  { id: "a", query: "?toppingScale=a" },
  { id: "b", query: "?toppingScale=b" },
] as const;
/** [ingredient id, chip name, dough percent x, y]: spaced well apart so each size reads on its own (no overlap with a neighbour) */
const PILOT = [
  ["corn", /コーン/, 28, 36],
  ["black-olive", /ブラックオリーブ/, 50, 30],
  ["mushroom", /マッシュルーム/, 72, 36],
  ["mozzarella", /モッツァレラ/, 30, 66],
  ["bacon", /ベーコン/, 50, 70],
  ["basil", /バジル/, 70, 66],
] as const;

async function chooseChip(page: Page, name: RegExp) {
  const chip = page.getByRole("button", { name }).first();
  const prev = page.getByRole("button", { name: "前のページ" }).first();
  const next = page.getByRole("button", { name: "次のページ" }).first();
  // the tray is paged: go back to the first page, then forward until the chip is on screen
  for (let i = 0; i < 20 && (await prev.isEnabled().catch(() => false)); i += 1) await prev.click();
  for (let i = 0; i < 20 && !(await chip.isVisible().catch(() => false)); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await chip.click();
}

test.describe.configure({ mode: "serial" });
test.describe("S2b-1 capture", () => {
  test.skip(!OUT, "set TOPPING_SCALE_CAPTURE_DIR");
  for (const mode of MODES) {
    test(`pilot six ${mode.id}`, async ({ page }) => {
      test.setTimeout(120_000);
      const vp = page.viewportSize()!;
      await openWith(page, vp.width, vp.height, base(HAND_ON_OWNED));
      await page.goto(`/${mode.query}`);
      await page.waitForSelector(".app-frame");
      await startTargetlessFreeCook(page);
      await page.waitForSelector(".pizza-stage");
      await completeDoughStep(page);
      await page.getByRole("button", { name: /次へ/ }).click();
      await page.getByRole("button", { name: /トマトソース/ }).click();
      await paintSauceRing(page, 25, 16);
      await page.getByRole("button", { name: /次へ/ }).click();
      // the cheese step, then the topping step
      await chooseChip(page, /モッツァレラ/);
      await tapDoughPercent(page, 30, 66);
      await page.getByRole("button", { name: /次へ/ }).click();
      for (const [, name, x, y] of PILOT) {
        if (name.source === "モッツァレラ") continue;
        await chooseChip(page, name);
        await tapDoughPercent(page, x, y);
      }
      await page.waitForTimeout(600); // the landing animation (220-280 ms) is real time
      const tag = `${vp.width}x${vp.height}-${mode.id}`;
      await page.locator(".pizza-stage").first().screenshot({ path: `${OUT}/${tag}.png` });
      const boxes: Record<string, { w: number; h: number; rank: string }> = {};
      for (const [id] of PILOT) {
        const piece = page.locator(`.pizza-topping--${id}`).first();
        await expect(piece, id).toHaveCount(1, { timeout: 5000 }).catch(() => undefined);
        const inner = piece.locator(".ingredient-piece-visual__emoji, .pizza-cheese, canvas.pizza-cheese-canvas").first();
        const b = await inner.boundingBox();
        const rank = await piece.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--piece-rank-scale"));
        boxes[id] = { w: Math.round((b?.width ?? 0) * 10) / 10, h: Math.round((b?.height ?? 0) * 10) / 10, rank };
      }
      writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(boxes, null, 2));
      // no horizontal page overflow at this viewport
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  }
});
