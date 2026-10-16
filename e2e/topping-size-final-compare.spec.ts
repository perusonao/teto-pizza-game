import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { base, HAND_ON_OWNED, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";
import { getReferencePizza } from "../src/data/referencePizza";
import { INGREDIENTS } from "../src/data/ingredients";
import { toppingSizeClass } from "../src/data/toppingSizeClass";

/**
 * #479 final-adjustment capture (NOT a regression test): representative recipes laid out at their reviewed Reference coordinates, under
 * no switch (1.0) / ?toppingScale=a / ?toppingScale=b. Saves a PREPARE screenshot plus, per piece, the on-screen box, and pairwise overlap /
 * dough-edge overrun metrics. Skipped unless TOPPING_SCALE_CAPTURE_DIR is set.
 */
const OUT = process.env.TOPPING_SCALE_CAPTURE_DIR;
const RECIPES = ["margherita", "capricciosa", "pizza-portuguesa", "meat-lovers", "jamon-serrano-pizza", "puttanesca-pizza", "quattro-formaggi", "breakfast-pizza"];
const MODES = [
  { id: "off", query: "" },
  { id: "a", query: "?toppingScale=a" },
  { id: "b", query: "?toppingScale=b" },
] as const;
const byId = new Map(INGREDIENTS.map((i) => [i.id, i]));

async function chooseChip(page: Page, nameJa: string) {
  const chip = page.getByRole("button", { name: new RegExp(nameJa) }).first();
  const prev = page.getByRole("button", { name: "前のページ" }).first();
  const next = page.getByRole("button", { name: "次のページ" }).first();
  for (let i = 0; i < 20 && (await prev.isEnabled().catch(() => false)); i += 1) await prev.click();
  for (let i = 0; i < 20 && !(await chip.isVisible().catch(() => false)); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await chip.click();
}

test.describe.configure({ mode: "serial" });
test.describe("final size compare capture", () => {
  test.skip(!OUT, "set TOPPING_SCALE_CAPTURE_DIR");
  for (const recipeId of RECIPES) {
    const ref = getReferencePizza(recipeId)!;
    for (const mode of MODES) {
      test(`${recipeId} ${mode.id}`, async ({ page }, testInfo) => {
        test.setTimeout(180_000);
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
        const groups = ref.pieceGroups;
        const cheeses = groups.filter((g) => byId.get(g.ingredientId)?.category === "cheese");
        const toppings = groups.filter((g) => byId.get(g.ingredientId)?.category !== "cheese");
        for (const g of cheeses) {
          await chooseChip(page, byId.get(g.ingredientId)!.nameJa);
          for (const p of g.positions) await tapDoughPercent(page, p.x, p.y);
        }
        await page.getByRole("button", { name: /次へ/ }).click();
        for (const g of toppings) {
          await chooseChip(page, byId.get(g.ingredientId)!.nameJa);
          for (const p of g.positions) await tapDoughPercent(page, p.x, p.y);
        }
        await page.waitForTimeout(700);
        const tag = `${recipeId}-${testInfo.project.name}-${mode.id}`;
        await page.locator(".pizza-stage").first().screenshot({ path: `${OUT}/${tag}.png` });
        const data = await page.evaluate(() => {
          const dough = document.querySelector(".pizza-dough")!.getBoundingClientRect();
          const cx = dough.x + dough.width / 2, cy = dough.y + dough.height / 2, R = dough.width / 2;
          return [...document.querySelectorAll(".pizza-stage .pizza-topping")].map((el) => {
            const inner = el.querySelector(".ingredient-piece-visual__emoji, .pizza-cheese, canvas.pizza-cheese-canvas, svg") ?? el;
            const b = inner.getBoundingClientRect();
            const id = [...el.classList].find((c) => c.startsWith("pizza-topping--"))?.slice(15) ?? "?";
            // farthest box corner from the dough centre, relative to the dough radius
            const far = Math.max(...[[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy))) / R;
            return { id, x: b.x, y: b.y, w: b.width, h: b.height, far };
          });
        });
        // pairwise overlap: intersection area / smaller box area, of the visual boxes
        const pieces = data.map((d) => ({ ...d, cls: toppingSizeClass(d.id) }));
        const pairs: { a: string; b: string; frac: number }[] = [];
        for (let i = 0; i < pieces.length; i += 1)
          for (let j = i + 1; j < pieces.length; j += 1) {
            const p = pieces[i], q = pieces[j];
            const iw = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x);
            const ih = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
            if (iw > 0 && ih > 0) pairs.push({ a: p.id, b: q.id, frac: Math.round(((iw * ih) / Math.min(p.w * p.h, q.w * q.h)) * 100) / 100 });
          }
        writeFileSync(`${OUT}/${tag}.json`, JSON.stringify({ pieces: pieces.map((p) => ({ id: p.id, cls: p.cls, w: Math.round(p.w * 10) / 10, h: Math.round(p.h * 10) / 10, far: Math.round(p.far * 100) / 100 })), overlaps: pairs }, null, 1));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      });
    }
  }
});
