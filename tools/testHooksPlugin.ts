import type { Plugin } from "vite";

/**
 * Issue #377 (test-only): a way to start a TARGETLESS Free Cook for fixtures, with no Production UX behind it.
 *
 * Pizza Select's 「レシピ発見へ」 used to be the only way to start a targetless round on a save that has a cookable
 * Research Entry (HOME's 「レシピ発見」 researches since #373). #377 gave Pizza Select HOME's routing, so specs that pin the
 * targetless contract (Hint sheet / pricing, no research context, layout baselines) start that round through this hook.
 *
 * The hook is added IN MEMORY by this Vite plugin and nothing is written to the repo, the same way `lcHandBuild.ts` rewrites
 * its one line. It is on only for the Vitest projects and for a dev server started with `TETO_TEST_HOOKS=1` (the Playwright
 * `webServer`); `npm run build` / `npm run dev` never add it, so the shipped source and bundle have no such code. The
 * transform throws unless it finds its anchor exactly once (fail closed), so a refactor cannot silently drop the hook.
 */
const APP_FILE = "/src/App.tsx";
const ANCHOR = /^( {2})function handleStartFreeCook\(\) \{$/m;

export function testHooksPlugin(): Plugin {
  return {
    name: "teto-test-hooks",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("?") || !id.replace(/\\/g, "/").endsWith(APP_FILE)) return null;
      const hits = code.match(new RegExp(ANCHOR.source, "gm"))?.length ?? 0;
      if (hits !== 1) throw new Error(`[teto-test-hooks] the handleStartFreeCook anchor matched ${hits}x (fail closed)`);
      return code.replace(
        ANCHOR,
        (m) =>
          `  (globalThis as { __tetoTest?: unknown }).__tetoTest = { startTargetlessFreeCook: () => handleStartFreeCook() };\n${m}`,
      );
    },
  };
}

/** True for a dev server / build the test runner asked for; production never sets it. */
export const TEST_HOOKS_ENABLED = process.env.TETO_TEST_HOOKS === "1";
