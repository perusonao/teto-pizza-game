import { expect, test, type Page } from "@playwright/test";
import { startFreshMargherita } from "./gestures";

/**
 * Issue #474 A-0/A-1: the DOUGH step's one-line status under the pizza. Runs in the 390x844 and
 * 360x800 projects (the viewport comes from the project). Real-mouse drags; checks the text per
 * state, that nothing moves when it changes, and that it sits inside the screen above the CTA bar.
 */

const SMALL = "もう少し大きく伸ばそう";
const READY = "いい大きさ！「次へ」で進めよう";
const LARGE = "大きめでもOK。縮めて整えてもいいよ";

async function dragRadial(page: Page, deg: number, fromPct: number, toPct: number) {
  const box = (await page.locator(".pizza-dough").boundingBox())!;
  const at = (pct: number) => {
    const a = (deg * Math.PI) / 180;
    const r = (box.width * pct) / 100;
    return { x: box.x + box.width / 2 + Math.cos(a) * r, y: box.y + box.height / 2 + Math.sin(a) * r };
  };
  const a = at(fromPct);
  const b = at(toPct);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

async function pullAllDirections(page: Page, toPct: number, rounds: number, fromPct = 18) {
  for (let i = 0; i < rounds; i += 1) {
    for (let d = 0; d < 360; d += 45) await dragRadial(page, d, fromPct, toPct);
  }
}

test("DOUGH status line: SMALL -> READY -> LARGE -> back, nothing moves, fits the screen", async ({ page }) => {
  await startFreshMargherita(page);
  const status = page.getByTestId("dough-size-status");
  const next = page.getByRole("button", { name: /^次へ/ });
  await expect(status).toBeVisible();
  await expect(status).toHaveText(SMALL);
  await expect(next).toBeDisabled();
  await expect(next).toHaveAttribute("aria-describedby", "dough-size-status");

  const before = (await page.locator(".pizza-dough").boundingBox())!;
  const nextBefore = (await next.boundingBox())!;

  // A modest pull: still small. Then pull everywhere out near the ideal ring.
  await dragRadial(page, 0, 18, 40);
  await expect(status).toHaveText(SMALL);
  await pullAllDirections(page, 44, 4);
  await expect(status).toHaveText(READY);
  await expect(next).toBeEnabled();

  // Past the ideal size: LARGE. A press must start inside the ideal ring (r <= 48 today), so the
  // drag starts well inside and is pulled out past the edge (pointer capture keeps it going).
  await pullAllDirections(page, 56, 6, 30);
  await expect(status).toHaveText(LARGE);
  await expect(next).toBeEnabled();

  // Shrinking again returns to SMALL and disables 次へ (the existing reversible gesture).
  for (let i = 0; i < 8; i += 1) for (let d = 0; d < 360; d += 45) await dragRadial(page, d, 46, 12);
  await expect(status).toHaveText(SMALL);
  await expect(next).toBeDisabled();

  // The pizza and the CTA did not move at any point; the line is inside the screen, above the bar.
  const after = (await page.locator(".pizza-dough").boundingBox())!;
  const nextAfter = (await next.boundingBox())!;
  expect(after).toEqual(before);
  expect(nextAfter).toEqual(nextBefore);
  const line = (await status.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(line.x).toBeGreaterThanOrEqual(0);
  expect(line.x + line.width).toBeLessThanOrEqual(vp.width);
  expect(line.y).toBeGreaterThanOrEqual(after.y + after.height - 1);
  expect(line.y + line.height).toBeLessThanOrEqual(nextAfter.y);
  const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(scroll.sw).toBe(scroll.cw);
  // One line: the text is not truncated or wrapped.
  expect(await status.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("DOUGH status line disappears with the DOUGH step (SAUCE has none)", async ({ page }) => {
  await startFreshMargherita(page);
  await pullAllDirections(page, 44, 4);
  await page.getByRole("button", { name: /^次へ/ }).click();
  await expect(page.getByTestId("dough-size-status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /トマトソース/ })).toBeVisible();
});
