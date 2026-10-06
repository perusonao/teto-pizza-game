import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Owner decision (#401 HV): the Research context and the Free Cooking note are no longer cards above the pizza; they lead the ヒント
 * sheet (`[data-hint-research]` the label, `[data-hint-research-details]` what is known + the fixed guidance sentence,
 * `[data-hint-free-note]` the Free Cooking note). These helpers read them through the sheet.
 */
export const hintSheet = (page: Page): Locator => page.getByRole("dialog", { name: /ヒント/ });

export async function openHint(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "ヒント" }).click();
  const sheet = hintSheet(page);
  await expect(sheet).toBeVisible();
  return sheet;
}

export async function closeHint(page: Page): Promise<void> {
  await hintSheet(page).getByRole("button", { name: "閉じる" }).click();
  await expect(hintSheet(page)).toHaveCount(0);
}

/** No note card above the pizza any more, in any round. */
export async function expectNoNoteCard(page: Page): Promise<void> {
  await expect(page.getByTestId("research-context")).toHaveCount(0);
  await expect(page.locator(".order-card--free-cook")).toHaveCount(0);
}

/** Opens the sheet, asserts the research label contains `text`, closes it; returns the label text. */
export async function expectResearchLead(page: Page, text: string | RegExp): Promise<string> {
  const sheet = await openHint(page);
  const label = sheet.locator("[data-hint-research]");
  await expect(label).toContainText(text);
  const t = (await label.textContent()) ?? "";
  await closeHint(page);
  return t;
}

/** Opens the sheet, asserts the Free Cooking note (title + body) is its first block, closes it. */
export async function expectFreeNote(page: Page): Promise<void> {
  await expectNoNoteCard(page);
  const sheet = await openHint(page);
  const note = sheet.locator("[data-hint-free-note]");
  await expect(note).toContainText("レシピ発見の試作");
  await expect(note.locator(".hint-sheet__note-line")).not.toBeEmpty(); // the step's guidance line (「好きな具をのせて「焼く！」」 on the 具材 step)
  await closeHint(page);
}

/** The Free Cooking note's text (title + the current escalation hint line), read through the sheet. */
export async function freeNoteText(page: Page): Promise<string> {
  const sheet = await openHint(page);
  const t = (await sheet.locator("[data-hint-free-note]").textContent()) ?? "";
  await closeHint(page);
  return t;
}
