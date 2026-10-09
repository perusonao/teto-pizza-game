import { expect, test, type Page } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
} from "./gestures";

/**
 * #427 / #426: what the player SEES (pieces on the pizza) and what RESULT SAYS (N等分) must agree, driven by
 * real pointer drags at exact dough-unit coordinates (1 unit = 1/100 of the dough box). No fixed sleeps: every
 * wait is an `expect` on real state.
 *
 * Counting rule under test: every geometric region is drawn; only significant ones (>= 0.1% of the circle and
 * >= 1.0 u thick) count as pieces; a stroke that stops short of the rim is a groove (no split, no completeness).
 * Set CUT_E2E_SHOTS=<dir> to also write screenshots of the CUT step and RESULT.
 */
const DOUGH = ".pizza-dough";
const SHOTS = process.env.CUT_E2E_SHOTS;

async function toCutStep(page: Page) {
  await startFreshMargherita(page);
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
  await bakeToTarget(page, { start: 60, end: 80 });
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
}

/** Drag across the dough along `angleDeg`, shifted `offset` units sideways, starting/ending just outside the rim. */
async function dragLine(page: Page, angleDeg: number, offset: number, stopShort = 0) {
  const box = await page.locator(DOUGH).boundingBox();
  if (!box) throw new Error("no dough box");
  const u = box.width / 100;
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const nx = -dy * offset;
  const ny = dx * offset;
  const reach = 49.4; // just outside the rim (48), inside the dough box
  const at = (t: number) => ({ x: box.x + (50 + nx + dx * t) * u, y: box.y + (50 + ny + dy * t) * u });
  const from = at(-reach);
  const to = at(reach - stopShort);
  await expect
    .poll(() =>
      page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return !!el?.closest(".pizza-dough--interactive");
        },
        from,
      ),
    )
    .toBe(true);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}x${page.viewportSize()?.height}.png` });
}

async function confirmAndRead(page: Page) {
  await page.getByRole("button", { name: /切り終わる/ }).click();
  await expect(page.locator(".result-panel")).toBeVisible();
  return page.locator(".cut-evaluation-summary__slices");
}

const cases = [
  { name: "six", cuts: [[0, 0], [60, 0], [120, 0]], drawn: 6, counted: "6等分" },
  { name: "seven", cuts: [[0, 0], [60, 0], [120, 6]], drawn: 7, counted: "7等分（目標 6等分）" },
  // The third line 1 u off centre: seven regions exist and are drawn, the 7th is too small to count.
  { name: "micro", cuts: [[0, 0], [60, 0], [120, 1]], drawn: 7, counted: "6等分" },
] as const;

for (const c of cases) {
  test(`${c.name}: ${c.drawn} pieces drawn, RESULT says ${c.counted}`, async ({ page }) => {
    test.setTimeout(45_000);
    await toCutStep(page);
    for (const [angle, offset] of c.cuts) await dragLine(page, angle, offset);
    await expect(page.locator(".pizza-cut-mark")).toHaveCount(c.cuts.length);
    await expect(page.locator(".pizza-piece")).toHaveCount(c.drawn);
    await shot(page, `cut-${c.name}`);
    await expect(await confirmAndRead(page)).toHaveText(c.counted);
    await expect(page.locator(".pizza-piece")).toHaveCount(c.drawn);
    await shot(page, `result-${c.name}`);
  });
}

test("stopped stroke: a groove does not split and does not count", async ({ page }) => {
  test.setTimeout(45_000);
  await toCutStep(page);
  await dragLine(page, 0, 0);
  await dragLine(page, 90, 0);
  await dragLine(page, 45, 0, 20); // stops 20 u short of the rim: a groove
  await expect(page.locator(".pizza-cut-mark")).toHaveCount(3);
  await expect(page.locator(".pizza-piece")).toHaveCount(4);
  await shot(page, "cut-groove");
  await expect(await confirmAndRead(page)).toHaveText("4等分（目標 6等分）");
  await shot(page, "result-groove");
});

test("three grooves only: one piece, nothing split", async ({ page }) => {
  test.setTimeout(45_000);
  await toCutStep(page);
  for (const angle of [0, 60, 120]) await dragLine(page, angle, 0, 25);
  await expect(page.locator(".pizza-cut-mark")).toHaveCount(3);
  await expect(page.locator(".pizza-piece")).toHaveCount(0);
  await expect(await confirmAndRead(page)).toHaveText("1等分（目標 6等分）");
});
