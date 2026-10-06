import { expect, type Page } from "@playwright/test";

/**
 * All-Owned Cooking Tray (食材庫廃止): the FREE Cooking tray lists every owned ingredient, paged. Specs that only need "this
 * topping chip, wherever it is" use this: go back to page 1, then page forward until the chip is on screen. (It used to fall
 * back to pinning from the pantry while the Hand held only 12; the Hand and the pantry are gone.) Returns the chip, on screen.
 */
export async function chipOnTrayOrPin(page: Page, name: string | RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name }).first();
  const next = page.getByRole("button", { name: "次のページ" });
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 8 && (await prev.isVisible().catch(() => false)) && (await prev.isEnabled().catch(() => false)); i += 1) {
    await prev.click(); // always search from page 1
  }
  for (let i = 0; i < 8 && !(await chip.isVisible()); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await expect(chip).toBeVisible();
  return chip;
}
