import { expect, type Page } from "@playwright/test";

/**
 * LC-R6-e: Production runs the Hand (手元) in FREE Cooking, so the TOPPING tray holds at most 12 ingredients and the
 * rest of the owned pantry is one 食材庫 away. Specs that only need "this topping chip, wherever it is" use this:
 * page the tray first, then fall back to pinning it from the pantry (search -> tile press -> close), which is exactly
 * what a player does. Returns the chip, already on screen.
 */
export async function chipOnTrayOrPin(page: Page, name: string | RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name }).first();
  const next = page.getByRole("button", { name: "次のページ" });
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 6 && (await next.isVisible().catch(() => false)) && (await prev.isEnabled().catch(() => false)); i += 1) {
    await prev.click(); // always search from page 1
  }
  for (let i = 0; i < 6 && !(await chip.isVisible()); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  if (await chip.isVisible()) return chip;

  await page.getByRole("button", { name: /食材庫/ }).click();
  await page.waitForSelector(".pantry-sheet");
  const input = page.getByRole("searchbox", { name: "材料を検索" });
  // Narrow with the search field only when the matcher is plain text (a regex with lookarounds is matched on the tiles instead).
  const text = typeof name === "string" ? name : name.source;
  if (/^[^\\^$.*+?()[\]{}|]+$/.test(text)) await input.fill(text);
  const tile = page.locator(".pantry-tile__toggle").filter({ hasText: name }).first();
  await expect(tile).toBeVisible();
  await tile.click();
  await page.getByRole("button", { name: "閉じる" }).click();
  await page.waitForSelector(".pantry-sheet", { state: "detached" });
  for (let i = 0; i < 6 && !(await chip.isVisible()); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await expect(chip).toBeVisible();
  return chip;
}
