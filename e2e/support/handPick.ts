import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The tray pager's own "n / m" label, or null when the tray has no pager. Read in one browser task, with no waiting: it is the state signal the paging
 * helpers below synchronise on (a click is finished when the label has changed, not when a guessed time has passed).
 */
const pagerLabel = (page: Page) => page.evaluate(() => document.querySelector(".ingredient-page-nav__label")?.textContent ?? null);

/**
 * Presses a pager button only if it can be pressed AT THE MOMENT OF THE PRESS, and reports whether it did (#394 Phase 1b).
 *
 * The old loops were `while (await button.isEnabled()) await button.click()`: a check, then an act, with two protocol round trips between them. The tray can
 * re-render in that gap (a reset to page 1, a re-sort), so the button is disabled by the time `click()` starts; Playwright's click then waits for "enabled"
 * until the test timeout (300 s in two WebKit shards on 2026-11-03: "element is not enabled" 541 times). Here the check and the act are ONE browser task: if the
 * button is disabled, detached or covered at that instant nothing is clicked and the caller simply stops paging. The covered check is the one Playwright's own
 * click makes (the topmost element at the button's centre is the button), so a pager hidden behind an overlay is still a failure, not a silent skip.
 * After a press the helper waits for the label to change: the page really moved, and the next read sees the new page.
 */
export async function pressPager(page: Page, button: Locator): Promise<boolean> {
  const before = await pagerLabel(page);
  const pressed = await button
    .evaluate(
      (el) => {
        const b = el as HTMLButtonElement;
        if (!b.isConnected || b.disabled) return false;
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!top || !(top === b || b.contains(top))) return false;
        b.click();
        return true;
      },
      undefined,
      { timeout: 2000 },
    )
    .catch((error: Error) => {
      if (error.name === "TimeoutError") return false; // the button went away while we looked: nothing to press
      throw error;
    });
  if (!pressed) return false;
  await expect.poll(() => pagerLabel(page), { message: "the tray did not change page after the pager press" }).not.toBe(before);
  return true;
}

/**
 * Pages the tray back to page 1 (a no-op when it has no pager or is already there). Every press goes through `pressPager`, so a tray that re-renders between
 * the check and the press can no longer park a click on a disabled button (#828: the same race as #394 Phase 1b, in the specs' own copies of this loop).
 */
export async function trayToFirstPage(page: Page): Promise<void> {
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 16 && (await prev.isVisible().catch(() => false)); i += 1) {
    if (!(await pressPager(page, prev))) break; // disabled at the moment of the press: already on page 1
  }
}

/** Pages forward until `chip` is on screen, or the pager runs out (the caller decides what a chip that is still missing means). */
export async function pageTrayUntilVisible(page: Page, chip: Locator): Promise<void> {
  const next = page.getByRole("button", { name: "次のページ" });
  for (let i = 0; i < 16 && !(await chip.isVisible()); i += 1) {
    if (!(await pressPager(page, next))) break;
  }
}

/**
 * The paged FREE Cooking tray: go back to page 1, then page forward until `chip` is on screen, and fail (not hang) if it never is. Use this instead of a
 * spec-local `while (isEnabled) click()` loop; `chipOnTrayOrPin` is the by-name form of it.
 */
export async function chipOnTray(page: Page, chip: Locator) {
  await trayToFirstPage(page); // always search from page 1
  await pageTrayUntilVisible(page, chip);
  await expect(chip).toBeVisible();
  return chip;
}

/**
 * All-Owned Cooking Tray (食材庫廃止): the FREE Cooking tray lists every owned ingredient, paged. Specs that only need "this
 * topping chip, wherever it is" use this: go back to page 1, then page forward until the chip is on screen. (It used to fall
 * back to pinning from the pantry while the Hand held only 12; the Hand and the pantry are gone.) Returns the chip, on screen.
 * Every pager press goes through `pressPager`, so a tray that re-renders between the check and the press can no longer park a click on a disabled button.
 */
export async function chipOnTrayOrPin(page: Page, name: string | RegExp) {
  return chipOnTray(page, page.locator(".ingredient-chip").filter({ hasText: name }).first());
}
