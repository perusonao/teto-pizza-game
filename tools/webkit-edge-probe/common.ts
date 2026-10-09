import { expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, startFreshMargherita, tapDoughPercent } from "../../e2e/gestures";

/** signed offset of the line through (px,py) with direction angDeg, in dragLine's convention */
export function offsetThrough(angDeg: number, px: number, py: number): number {
  const a = (angDeg * Math.PI) / 180;
  return (px - 50) * -Math.sin(a) + (py - 50) * Math.cos(a);
}

export const DOUGH = ".pizza-dough";

export async function toCutStep(page: Page, stretch: number | null) {
  await startFreshMargherita(page);
  if (stretch === null) {
    await completeDoughStep(page);
  } else {
    const box = await page.locator(DOUGH).boundingBox();
    if (!box) throw new Error("no dough box");
    const u = box.width / 100;
    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < 16; i += 1) {
        const ang = (i / 16) * Math.PI * 2;
        const at = (r: number) => ({ x: box.x + (50 + Math.cos(ang) * r) * u, y: box.y + (50 + Math.sin(ang) * r) * u });
        const from = at(30);
        const to = at(stretch);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 8 });
        await page.mouse.up();
      }
    }
  }
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

/** A straight drag across the dough along angleDeg, shifted offset units sideways, from just outside the rim to just outside the rim. */
export async function dragLine(page: Page, angleDeg: number, offset: number) {
  const box = await page.locator(DOUGH).boundingBox();
  if (!box) throw new Error("no dough box");
  const u = box.width / 100;
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const nx = -dy * offset;
  const ny = dx * offset;
  const reach = Math.sqrt(Math.max(1, 49.2 * 49.2 - offset * offset)); // start/end just outside the rim, inside the dough box
  const at = (t: number) => ({ x: box.x + (50 + nx + dx * t) * u, y: box.y + (50 + ny + dy * t) * u });
  const from = at(-reach);
  const to = at(reach);
  await expect
    .poll(() => page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".pizza-dough--interactive"), from))
    .toBe(true);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

