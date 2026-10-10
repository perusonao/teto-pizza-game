import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  completeDoughStep,
  paintSauceRing,
  physicalDragToDough,
  startFreshMargherita,
  startLunchRushMission,
  tapDoughPercent,
} from "./gestures";

/**
 * Cooking Steps 2.0 Phase 1 (Issue #449, parent #270): the ↩ 「1つ戻す」 button in the PREPARE bar.
 * Runs on both authority viewports (the shared 390x844 / 360x800 projects). Pins, in a real browser:
 * - it takes back only the piece placed last in the current step, never an earlier step's piece;
 * - it is a separate control from 「やり直す」 (which still empties the pizza);
 * - the slot is constant: the ↩ and the CTA do not move between steps, every control is >= 44px
 *   and nothing in the bar overlaps or leaves the viewport (the 360px fit is the point of this spec);
 * - a physical tray drag can be taken back too;
 * - Lunch Rush has no ↩ at all.
 */

const pieces = (page: Page) => page.locator("[data-topping-id]");
const undo = (page: Page) => page.getByRole("button", { name: "1つ戻す" });
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box");
  return b;
}

async function toCheeseStep(page: Page) {
  await startFreshMargherita(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "チーズ" })).toHaveAttribute("aria-selected", "true");
}

test("↩ takes back only the last piece of the current step and leaves やり直す alone", async ({ page }) => {
  await toCheeseStep(page);
  await expect(undo(page)).toBeDisabled();

  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await expect(pieces(page)).toHaveCount(3);
  await expect(undo(page)).toBeEnabled();

  await undo(page).click();
  await expect(pieces(page)).toHaveCount(2);
  await undo(page).click();
  await undo(page).click();
  await expect(pieces(page)).toHaveCount(0);
  await expect(undo(page)).toBeDisabled();

  // The slot freed by Undo can be used again.
  await tapDoughPercent(page, 40, 50);
  await expect(pieces(page)).toHaveCount(1);

  // A piece from a confirmed step cannot be reached from the next step.
  await page.getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "具材" })).toHaveAttribute("aria-selected", "true");
  await expect(undo(page)).toBeDisabled();
  await expect(pieces(page)).toHaveCount(1);

  // 「やり直す」 is still the whole-pizza discard and is a different button.
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(pieces(page)).toHaveCount(0);
});

test("a physical tray drag can be taken back", async ({ page }) => {
  await toCheeseStep(page);
  await physicalDragToDough(page, /モッツァレラ/, 50, 50);
  await expect(pieces(page)).toHaveCount(1);
  await undo(page).click();
  await expect(pieces(page)).toHaveCount(0);
});

test("the bar keeps a constant, tappable, non-overlapping layout across steps", async ({ page }, testInfo) => {
  await startFreshMargherita(page);
  await page.waitForSelector(".pizza-stage");
  const viewport = page.viewportSize()!;

  const layoutAt = async (label: string) => {
    const b = await box(bar(page));
    const u = await box(undo(page));
    const reset = await box(page.getByRole("button", { name: "やり直す" }));
    const cta = await box(bar(page).locator(".cta-button"));
    const hint = await box(page.getByRole("button", { name: "ヒント" }));
    const controls = { reset, undo: u, cta, hint };
    for (const [name, c] of Object.entries(controls)) {
      expect(c.height, `${label}: ${name} height >= 44`).toBeGreaterThanOrEqual(44);
      expect(c.width, `${label}: ${name} width >= 44`).toBeGreaterThanOrEqual(44);
      expect(c.x, `${label}: ${name} inside viewport (left)`).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width, `${label}: ${name} inside viewport (right)`).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(c.y + c.height, `${label}: ${name} inside viewport (bottom)`).toBeLessThanOrEqual(viewport.height + 0.5);
    }
    const ordered = [reset, u, cta, hint].sort((p, q) => p.x - q.x);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i].x, `${label}: controls do not overlap`).toBeGreaterThanOrEqual(ordered[i - 1].x + ordered[i - 1].width - 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: no horizontal overflow`).toBe(true);
    expect(b.x + b.width, `${label}: bar inside viewport`).toBeLessThanOrEqual(viewport.width + 0.5);
    return { u, cta, reset, hint, bar: b };
  };

  const dough = await layoutAt("DOUGH");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  const sauce = await layoutAt("SAUCE");
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  const cheese = await layoutAt("CHEESE");
  await page.getByRole("button", { name: /次へ/ }).click();
  const topping = await layoutAt("TOPPING (CTA is 焼く！)");

  for (const [label, l] of [["SAUCE", sauce], ["CHEESE", cheese], ["TOPPING", topping]] as const) {
    expect(l.u.x, `${label}: ↩ x is the DOUGH x`).toBeCloseTo(dough.u.x, 0);
    expect(l.reset.x, `${label}: やり直す x`).toBeCloseTo(dough.reset.x, 0);
    expect(l.hint.x, `${label}: ヒント x`).toBeCloseTo(dough.hint.x, 0);
    expect(l.bar.height, `${label}: bar height`).toBeCloseTo(dough.bar.height, 0);
  }
  testInfo.annotations.push({ type: "undo-box", description: JSON.stringify(dough.u) });
});

test("Lunch Rush has no ↩ in its bar", async ({ page }) => {
  await startLunchRushMission(page, 180);
  await expect(bar(page)).toBeVisible();
  await expect(undo(page)).toHaveCount(0);
});
