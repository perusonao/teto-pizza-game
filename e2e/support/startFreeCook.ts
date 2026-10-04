import type { Page } from "@playwright/test";

/**
 * Issue #373 / #377: HOME 「レシピ発見」 and Pizza Select 「レシピ発見へ」 share one routing -- a save with a cookable Research
 * Entry researches it (the Dex opens for 2+), so neither is the targetless Free Cook there, and there is deliberately no
 * Production UI for it. Specs that pin the targetless contract (Hint sheet / pricing, no research context, layout
 * baselines) start it through the test-only hook that `tools/testHooksPlugin.ts` adds in memory to a dev server started
 * with TETO_TEST_HOOKS=1 (the Playwright `webServer`); it dispatches `START_FREE_COOK` without a target. No shipped build
 * has the hook. The bundle specs build with the hook for the same reason (`testHooks: true` in e2e/support/lcHandBuild.ts,
 * `TETO_TEST_HOOKS` in hint5-preview). A server or build without it fails loudly here instead of starting the wrong round.
 */
export async function startTargetlessFreeCook(page: Page): Promise<void> {
  const hooked = await page.evaluate(() => {
    const hooks = (globalThis as { __tetoTest?: { startTargetlessFreeCook: () => void } }).__tetoTest;
    hooks?.startTargetlessFreeCook();
    return Boolean(hooks);
  });
  if (!hooked) {
    // No silent fallback to HOME 「レシピ発見」: on a save with a cookable entry it researches, so a server / build without the hook
    // (e.g. a plain `npm run dev` that Playwright reused on port 5183) would run the wrong state.
    throw new Error("test hook missing: stop any dev server on :5183 started without TETO_TEST_HOOKS=1 (see tools/testHooksPlugin.ts)");
  }
}
