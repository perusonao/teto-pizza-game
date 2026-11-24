import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { defineConfig, type Plugin } from "vitest/config";
import { testHooksPlugin } from "./tools/testHooksPlugin.ts";

/**
 * LC-R5-e-h (test-only): the Large Catalog hand ACTIVATION projects.
 *
 * `HAND_ENFORCEMENT_PRODUCTION` (the production switch behind `HAND_ENFORCEMENT_ENABLED`) is `true` since LC-R6-e (Production activation).
 * The ROLLBACK is that one literal set back to `false`: the `hand-off` project compiles exactly that (the real `handPolicy.ts` with the flag
 * off) and runs `*.handOff.test.ts(x)`, so "flag off = today's tray, no pin UI, nothing hidden" is proven continuously, not only on the day.
 *
 * LC-R6-b: the Preview variant (`LC_HAND_PREVIEW_CAPACITY`) is `null` here (and `VITE_PREVIEW_MODE` is unset), so
 * these projects exercise the PRODUCTION path of the policy (flag on). Mocking it with
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
const HAND_OFF_TESTS = ["src/**/*.handOff.test.ts", "src/**/*.handOff.test.tsx"];

/** The rollback: the production flag literal set to `false` (nothing else changes). Fail closed like `handActivation`. */
function handRollback(): Plugin {
  return {
    name: "lc-hand-rollback",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("?") || !id.replace(/\\/g, "/").endsWith(HAND_POLICY)) return null;
      const hits = code.match(new RegExp(FLAG.source, "gm"))?.length ?? 0;
      if (hits !== 1) throw new Error(`[lc-hand-rollback] ${FLAG} matched ${hits}x in handPolicy.ts (fail closed)`);
      return code.replace(FLAG, "export const HAND_ENFORCEMENT_PRODUCTION = false;");
    },
  };
}

/**
 * Pinsa Romana (#577): the ROLLBACK project. `TETO_PINSA_OFF=1 npx vitest run` compiles the REAL `pinsaGate.ts` with its literal set to `false` (nothing else
 * changes) and runs the whole suite against the real catalog, so "gate closed = Pinsa exists on no path" is proven continuously, not only on the day. The shipped
 * literal is `true`; a `?raw` import (source-reading gates) still sees the shipped text. Fail closed like `handRollback`.
 */
const PINSA_GATE = "/src/data/pinsaGate.ts";
const PINSA_FLAG = /^export const PINSA_PRODUCTION = (?:false|true);$/m;
function pinsaRollback(): Plugin {
  return {
    name: "pinsa-gate-rollback",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("?") || !id.replace(/\\/g, "/").endsWith(PINSA_GATE)) return null;
      const hits = code.match(new RegExp(PINSA_FLAG.source, "gm"))?.length ?? 0;
      if (hits !== 1) throw new Error(`[pinsa-gate-rollback] ${PINSA_FLAG} matched ${hits}x in pinsaGate.ts (fail closed)`);
      return code.replace(PINSA_FLAG, "export const PINSA_PRODUCTION = false;");
    },
  };
}

/**
 * Test speed-up (Task 3, pilot): files that run under the `node` environment instead of jsdom. The list is `tools/nodeEnvTests.txt` (one repo-relative path per line).
 * Selection rule: a `src/logic` / `src/data` `*.test.ts` that contains none of the DOM-ish tokens (window, document, localStorage, navigator, `?raw`, render(, fireEvent,
 * globalThis, location, ... -- see the PR report) and passes under `node`. It is an ALLOW list on purpose: a new test file defaults to jsdom (the single-config intent
 * below), and a listed file that starts needing the DOM fails loudly and is simply removed from the list. Nothing else (flag-variant projects, setup file) changes.
 */
const NODE_ENV_TESTS = readFileSync(new URL("./tools/nodeEnvTests.txt", import.meta.url), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

/**
 * Explicit pool / parallelism (Task 1). `forks` is Vitest's default and is kept on purpose: each file gets a process-level isolation, which the suites that mutate
 * module state / `localStorage` / fake timers rely on; `threads` would only add risk for a small gain. Worker count = (logical CPUs - 1) capped at 8: the same as the
 * default on a 4-vCPU CI runner (3 workers; one CPU stays free for the main process and the reporter) and bounded on big developer machines, where more workers mostly
 * add memory pressure (jsdom per worker) and CPU contention for the timing-sensitive tests. Not an aggressive tuning: it makes the implicit default readable.
 */
const MAX_WORKERS = Math.min(8, Math.max(1, availableParallelism() - 1));

export default defineConfig({
  // #377: the test-only targetless-start hook (tools/testHooksPlugin.ts); Vitest only, never `vite build`.
  plugins: [testHooksPlugin(), ...(process.env.TETO_PINSA_OFF === "1" ? [pinsaRollback()] : [])],
  test: {
    // jsdom (added for Issue #24's HOME/GAME component tests) is a superset of what the
    // existing pure-logic/data `.test.ts` suite needs -- none of it depends on `window`
    // being absent, so switching the whole project over (rather than per-file) keeps one
    // config for every test.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    pool: "forks",
    maxWorkers: MAX_WORKERS,
    projects: [
      {
        extends: true,
        test: { name: "default", include: ["src/**/*.test.ts", "src/**/*.test.tsx"], exclude: [...HAND_ON_TESTS, ...HAND_OFF_TESTS, ...NODE_ENV_TESTS] },
      },
      // Task 3 pilot: DOM-free logic/data tests on `node` (no jsdom per file). Same setup file, same plugins.
      { extends: true, test: { name: "node", environment: "node", include: NODE_ENV_TESTS } },
      ...([9, 12] as const).map((capacity) => ({
        extends: true,
        plugins: [handActivation(capacity)],
        test: { name: `hand-on-${capacity}`, include: HAND_ON_TESTS },
      })),
      { extends: true, plugins: [handRollback()], test: { name: "hand-off", include: HAND_OFF_TESTS } },
    ],
  },
});
