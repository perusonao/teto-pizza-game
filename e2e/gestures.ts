import type { Page } from "@playwright/test";

/**
 * Real-mouse (not synthetic PointerEvent dispatch) gesture helpers for driving a FREE round
 * through PizzaStage in a real browser. Mirrors src/App.test.tsx's own jsdom `fireEvent`-based
 * helpers (`completeDoughStep`/`selectAndTapPizza`/`paintSauceRing`/`completeCutStepIfPresent`)
 * but drives them via `page.mouse` at the dough element's *real* `boundingBox()` instead of a
 * mocked `getBoundingClientRect` + dispatched `PointerEvent` -- real Chromium's
 * `setPointerCapture` throws for a pointerId that was never associated with a live input
 * device, which a hand-rolled synthetic pointer session hits but a real mouse session never
 * does (see docs/reports/TETO_VIEWPORT-1SCREEN_Result.md's own audit notes on this).
 */

async function doughBox(page: Page) {
  const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
  if (!box) throw new Error("Pizza dough missing");
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, r: box.width * 0.46, box };
}

export async function tapDoughPercent(page: Page, xPercent: number, yPercent: number) {
  const { box } = await doughBox(page);
  const x = box.x + (xPercent / 100) * box.width;
  const y = box.y + (yPercent / 100) * box.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

export async function completeDoughStep(page: Page) {
  const { cx, cy, r } = await doughBox(page);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    await page.mouse.down();
    await page.mouse.up();
  }
}

export async function paintSauceRing(page: Page, radiusPercent: number, count: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    await tapDoughPercent(page, 50 + Math.cos(angle) * radiusPercent, 50 + Math.sin(angle) * radiusPercent);
  }
}

export async function cutThreeLines(page: Page) {
  const { cx, cy, r } = await doughBox(page);
  for (const angleDeg of [0, 60, 120]) {
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
    await page.mouse.move(cx - dx, cy - dy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
    await page.mouse.up();
  }
}

/** Fresh HOME -> Pizza Select -> margherita (the only unlockCondition-free recipe) -> PREPARE. */
export async function startFreshMargherita(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
}

/** Drives a full margherita round (DOUGH -> SAUCE -> CHEESE -> TOPPING -> BAKE -> CUT) from
 *  PREPARE/DOUGH through to RESULT. Real time bake wait (no RAF stub -- this is a real browser
 *  run, not jsdom), matching BakeOverlay's own ~55%/s needle speed. */
export async function playFullMargheritaRound(page: Page) {
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

  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "取り出す！" }).click();

  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
}
