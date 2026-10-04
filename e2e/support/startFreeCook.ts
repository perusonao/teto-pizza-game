import type { Page } from "@playwright/test";

/**
 * Issue #373 / #377: HOME 「レシピ発見」 and Pizza Select 「レシピ発見へ」 share one routing -- a save with a cookable Research
 * Entry researches it (the Dex opens for 2+), so neither is the targetless Free Cook there, and there is deliberately no
 * Production UI for it. Specs that pin the targetless contract (Hint sheet / pricing, no research context, layout
 * baselines) start it through the test-only hook that `tools/testHooksPlugin.ts` adds in memory to a dev server started
 * with TETO_TEST_HOOKS=1 (the Playwright `webServer`); it dispatches `START_FREE_COOK` without a target. No shipped build
 * has the hook. The Large Catalog bundle specs build with `testHooks: true` (e2e/support/lcHandBuild.ts) for the same reason;
 * a build without the hook falls back to HOME's own 「レシピ発見」, which is the targetless start only on a save with no cookable entry (OD-2).
 */
export async function startTargetlessFreeCook(page: Page): Promise<void> {
  const hooked = await page.evaluate(() => {
    const hooks = (globalThis as { __tetoTest?: { startTargetlessFreeCook: () => void } }).__tetoTest;
    hooks?.startTargetlessFreeCook();
    return Boolean(hooks);
  });
  if (hooked) return;
  await page.getByRole("button", { name: /レシピ発見/ }).first().click();
}
