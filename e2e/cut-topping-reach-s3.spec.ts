import { expect, test, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, cutThroughCentre, paintSauceRing, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * #479 S3: a topping a cut slices shows its part in the neighbouring piece, sized by its own drawing and the dough's rendered width (the RESULT's 196px dough
 * makes a topping a larger share than the CUT screen's 330-360px). Basil (class xl, x1.3 in production) is placed at known distances from a cut:
 * every one of them is sliced at the RESULT; at the CUT screen only the ones within the topping's footprint are. DOM-level, so it holds on every engine.
 * With CUT_REACH_CAPTURE_DIR set it also saves a crop of the cut area (Before / After evidence for the PR; not a regression check).
 */
const OUT = process.env.CUT_REACH_CAPTURE_DIR;
test.use({ deviceScaleFactor: OUT ? 3 : 1 });

/** the basil's dough-percent position and its distance (dough-percent) from the nearest cut */
const ON_THE_GAME_CUTS = [
  { x: 14, y: 50, d: 0 },
  { x: 86, y: 59, d: 9 },
  { x: 15, y: 63, d: 13 },
  { x: 84, y: 34, d: 16 },
];
/** for cuts through the centre at 22.5 / 82.5 / 142.5 degrees: along the 22.5-degree cut by `t`, off it by `d` (its normal sits halfway between two probe directions) */
const along = (t: number, d: number) => {
  const a = (22.5 * Math.PI) / 180;
  return { x: 50 + t * Math.cos(a) - d * Math.sin(a), y: 50 + t * Math.sin(a) + d * Math.cos(a), d };
};
const ON_OBLIQUE_CUTS = [along(34, 0), along(-34, 9), along(34, 13), along(-34, -16)].map((p) => ({ ...p, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));

async function playToCut(page: Page, basils: { x: number; y: number }[]) {
  await startFreshMargherita(page);
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 20);
  await tapDoughPercent(page, 60, 20);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  for (const b of basils) await tapDoughPercent(page, b.x, b.y);
  await page.waitForTimeout(500);
  await bakeToTarget(page, { start: 60, end: 80 });
}

/** the left (dough-percent, rounded) of every basil that has a copy in a neighbouring piece */
async function slicedBasils(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const whole = new Map<string, number>();
    for (const el of document.querySelectorAll<HTMLElement>(".pizza-topping--basil[data-topping-id]")) whole.set(el.dataset.toppingId!, Math.round(parseFloat(el.style.left)));
    const ids = new Set([...document.querySelectorAll<HTMLElement>(".pizza-topping-half[data-topping-id]")].map((el) => el.dataset.toppingId!));
    return [...ids].filter((id) => whole.has(id)).map((id) => whole.get(id)!).sort((a, b) => a - b);
  });
}

async function crop(page: Page, name: string) {
  if (!OUT) return;
  const db = (await page.locator(".pizza-dough").first().boundingBox())!;
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: db.x, y: db.y, width: db.width, height: db.height } });
}

test.describe("S3: cut toppings keep their slice in the neighbouring piece", () => {
  test("the game's three cuts (0 / 60 / 120 degrees): CUT screen and RESULT", async ({ page }, info) => {
    test.setTimeout(120_000);
    await playToCut(page, ON_THE_GAME_CUTS);
    await cutThreeLines(page);
    await page.waitForTimeout(500);
    const atCut = await slicedBasils(page);
    await crop(page, `${info.project.name}-three-cuts-1-cut-screen`);
    // d = 0 and 9 are inside the footprint at both CUT widths (radius ~11-12%); d = 13 and 16 are past it
    expect.soft(atCut).toEqual(expect.arrayContaining([14, 86]));
    expect.soft(atCut).not.toContain(15);
    expect.soft(atCut).not.toContain(84);
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await page.waitForTimeout(700);
    await crop(page, `${info.project.name}-three-cuts-2-result`);
    // RESULT: the 196px dough makes the footprint ~21% of it, so every one of them is sliced
    expect.soft(await slicedBasils(page)).toEqual([14, 15, 84, 86]);
  });

  test("cuts at 22.5 / 82.5 / 142.5 degrees (the normal halfway between two probe directions): CUT screen and RESULT", async ({ page }, info) => {
    test.setTimeout(120_000);
    await playToCut(page, ON_OBLIQUE_CUTS);
    for (const deg of [22.5, 82.5, 142.5]) await cutThroughCentre(page, deg);
    await page.waitForTimeout(500);
    const atCut = await slicedBasils(page);
    await crop(page, `${info.project.name}-oblique-1-cut-screen`);
    const left = (i: number) => Math.round(ON_OBLIQUE_CUTS[i].x);
    expect.soft(atCut).toEqual(expect.arrayContaining([left(0), left(1)]));
    expect.soft(atCut).not.toContain(left(2));
    expect.soft(atCut).not.toContain(left(3));
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await page.waitForTimeout(700);
    await crop(page, `${info.project.name}-oblique-2-result`);
    expect.soft(await slicedBasils(page)).toEqual(ON_OBLIQUE_CUTS.map((_, i) => left(i)).sort((a, b) => a - b));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});
