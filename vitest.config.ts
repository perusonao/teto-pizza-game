import { defineConfig, type Plugin } from "vitest/config";

/**
 * LC-R5-e-h (test-only): the Large Catalog hand ACTIVATION projects.
 *
 * `HAND_ENFORCEMENT_PRODUCTION` (the production switch behind `HAND_ENFORCEMENT_ENABLED`) stays `false` until R6-e.
 * LC-R6-b: the Preview variant (`LC_HAND_PREVIEW_CAPACITY`) is `null` here (and `VITE_PREVIEW_MODE` is unset), so
 * these projects exercise the PRODUCTION path of the policy with its production literals switched on. Mocking it with
 * `vi.mock` also forces every function of `handPolicy.ts` that reads it (`handCapacityFor`) to be mocked, which
 * hides the real flag / capacity wiring. Instead, these projects compile the REAL `handPolicy.ts` with the flag on
 * and one capacity (12 = the OD-5 production capacity; 9 stays as a coverage parameter of the capacity-agnostic logic) and run `*.handOn.test.tsx`
 * against the unmodified App / reducer / tray / pantry. Nothing here reaches `vite build` (`vite.config.ts`).
 *
 * Fail closed: if either declaration is not found exactly once, the transform throws, so a refactor of
 * `handPolicy.ts` cannot silently turn these suites back into flag-off runs.
 */
const HAND_POLICY = "/src/logic/catalog/handPolicy.ts";
const FLAG = /^export const HAND_ENFORCEMENT_PRODUCTION = (?:false|true);$/m;
const CAPACITY = /^export const DEFAULT_HAND_CAPACITY_PRODUCTION: HandCapacityCandidate = (?:9|12);$/m;

function handActivation(capacity: 9 | 12): Plugin {
  return {
    name: `lc-hand-activation-${capacity}`,
    enforce: "pre",
    transform(code, id) {
      // The module itself only: a `?raw` import (source-reading gates) must see the shipped text.
      if (id.includes("?") || !id.replace(/\\/g, "/").endsWith(HAND_POLICY)) return null;
      for (const pattern of [FLAG, CAPACITY]) {
        const hits = code.match(new RegExp(pattern.source, "gm"))?.length ?? 0;
        if (hits !== 1) throw new Error(`[lc-hand-activation-${capacity}] ${pattern} matched ${hits}x in handPolicy.ts (fail closed)`);
      }
      return code
        .replace(FLAG, "export const HAND_ENFORCEMENT_PRODUCTION = true;")
        .replace(CAPACITY, `export const DEFAULT_HAND_CAPACITY_PRODUCTION: HandCapacityCandidate = ${capacity};`);
    },
  };
}

const HAND_ON_TESTS = ["src/**/*.handOn.test.ts", "src/**/*.handOn.test.tsx"];

export default defineConfig({
  test: {
    // jsdom (added for Issue #24's HOME/GAME component tests) is a superset of what the
    // existing pure-logic/data `.test.ts` suite needs -- none of it depends on `window`
    // being absent, so switching the whole project over (rather than per-file) keeps one
    // config for every test.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: { name: "default", include: ["src/**/*.test.ts", "src/**/*.test.tsx"], exclude: HAND_ON_TESTS },
      },
      ...([9, 12] as const).map((capacity) => ({
        extends: true,
        plugins: [handActivation(capacity)],
        test: { name: `hand-on-${capacity}`, include: HAND_ON_TESTS },
      })),
    ],
  },
});
