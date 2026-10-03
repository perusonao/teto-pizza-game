import type { Page } from "@playwright/test";

/**
 * Issue #373: HOME 「レシピ発見」 researches the cookable Research Entries (one: that entry is the Target; 2+: the Dex's
 * Research cards open), so on a save that has a cookable entry it is no longer the targetless Free Cook. Specs that
 * pin the targetless contract (Hint sheet / pricing, no research context, layout baselines) start it the way that
 * still is one: Pizza Select's 「レシピ発見へ」 (`START_FREE_COOK` without a target). A save with no cookable entry
 * has no such prompt, and HOME's own 「レシピ発見」 is the targetless start there (OD-2).
 */
export async function startTargetlessFreeCook(page: Page): Promise<void> {
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  const prompt = page.getByRole("button", { name: /レシピ発見へ/ });
  if (await prompt.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) {
    await prompt.click();
    return;
  }
  await page.getByRole("button", { name: /ホーム/ }).click();
  await page.getByRole("button", { name: /レシピ発見/ }).first().click();
}
