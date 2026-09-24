#!/usr/bin/env node
// Issue #201 A1 / #207 Phase 2B: WebKit change classifier.
//
// Reads a newline-separated list of changed file paths (stdin) and decides whether the heavy
// WebKit E2E job (.github/workflows/e2e-webkit.yml) must run. Deliberately an ALLOW-LIST of
// "cannot reach the browser" paths, never a list of runtime paths: any path not explicitly
// recognised -- including every path added to the repo in the future -- falls through to
// webkit_required=true. Broaden SKIP rules only with evidence (Issue #201 / #207).
//
// Skip categories (a PR/increment skips WebKit only if EVERY changed path is in one of them):
//   docs        docs/**, **/*.md outside runtime trees                        (#201, unchanged)
//   tools       tools/**/*.py -- offline analysis scripts, never imported     (#207 Phase 2B)
//   unit-test   src/**/*.test.ts(x), src/test/** -- Vitest-only files         (#207 Phase 2B)
//
// `tools` and `unit-test` additionally require a repository scan (--repo) proving nothing the
// browser or the E2E suite loads can reach those files: Vite (dev server and build) only loads
// modules reachable from index.html through import specifiers, so a file no import specifier
// names -- and with no import.meta.glob anywhere -- cannot execute in WebKit. If the scan is not
// run, fails, or finds such a reference, the category is disabled and those paths run WebKit.
// Storage/persistence, navigation, input, runtime UI, e2e/** (including e2e/*.test.ts, which
// Playwright's default testMatch would run), config and dependency files are never skippable.
//
// Usage:
//   git diff --name-only --no-renames BASE...HEAD | node scripts/ci/classify-webkit.mjs [--repo DIR]
//     -> prints `webkit_required=<true|false>` and `reason=<text>` (GITHUB_OUTPUT format)
//   node scripts/ci/classify-webkit.mjs --self-test
//     -> runs the built-in case table; exits non-zero on any mismatch

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

// Top-level trees whose contents can be loaded by the running app, the E2E suite, or the build,
// even when the file itself is Markdown (e.g. a `?raw` import). A `.md` file inside one of these
// is NOT treated as documentation-only.
const RUNTIME_ROOTS = ["src/", "e2e/", "public/", "functions/", ".github/"];

const UNIT_TEST_FILE = /^src\/(?:.+\/)?[^/]+\.test\.tsx?$/;
const UNIT_TEST_SETUP = /^src\/test\/[^/]+(?:\/[^/]+)*$/;
const TOOLS_SCRIPT = /^tools\/(?:.+\/)?[^/]+\.py$/;

/** @returns {{ category: string, label: string } | null} */
function skipCategory(path) {
  if (path.startsWith("docs/")) return { category: "docs", label: "docs/**" };
  if (path.endsWith(".md") && !RUNTIME_ROOTS.some((root) => path.startsWith(root))) {
    return { category: "docs", label: "**/*.md (outside runtime trees)" };
  }
  if (TOOLS_SCRIPT.test(path)) return { category: "tools", label: "tools/**/*.py" };
  if (UNIT_TEST_FILE.test(path) || UNIT_TEST_SETUP.test(path)) {
    return { category: "unit-test", label: "src/**/*.test.ts(x), src/test/**" };
  }
  return null;
}

const GUARDED = ["tools", "unit-test"];

/** Guards used when no repository scan ran: guarded categories are disabled (fail-safe). */
export const NO_SCAN = Object.fromEntries(GUARDED.map((c) => [c, { ok: false, reason: "repository scan not run" }]));

/**
 * @param {string[]} rawPaths
 * @param {{ guards?: Record<string, { ok: boolean, reason: string }> }} [options]
 * @returns {{ webkitRequired: boolean, reason: string }}
 */
export function classify(rawPaths, { guards = NO_SCAN } = {}) {
  const paths = [...new Set(rawPaths.map((p) => p.trim()).filter(Boolean))];
  if (paths.length === 0) {
    return { webkitRequired: true, reason: "fail-safe: no changed files could be determined" };
  }
  const risky = [];
  const blocked = new Map();
  const labels = new Set();
  for (const p of paths) {
    const hit = skipCategory(p);
    if (hit && GUARDED.includes(hit.category) && guards[hit.category]?.ok !== true) {
      blocked.set(hit.category, guards[hit.category]?.reason ?? "no guard result");
      risky.push(p);
    } else if (hit) {
      labels.add(hit.label);
    } else {
      risky.push(p);
    }
  }
  if (risky.length > 0) {
    const shown = risky.slice(0, 5).join(", ");
    const more = risky.length > 5 ? ` (+${risky.length - 5} more)` : "";
    const why = [...blocked].map(([c, r]) => `; '${c}' skip disabled: ${r}`).join("");
    return {
      webkitRequired: true,
      reason: `${risky.length} of ${paths.length} changed file(s) can reach the browser: ${shown}${more}${why}`,
    };
  }
  return {
    webkitRequired: false,
    reason: `all ${paths.length} changed file(s) cannot reach the browser (${[...labels].join(", ")})`,
  };
}

// ---------------------------------------------------------------------------------------------
// Repository scan for the guarded categories.

const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/;
// import x from "s" / import "s" / export ... from "s" / import("s") / require("s") / new URL("s", ...)
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bnew\s+URL\s*\(\s*)(["'`])([^"'`\n]+)\1/g;
// Root files the browser build, the dev server, Playwright or the WebKit workflow read directly.
const ROOT_FILES = ["index.html", "package.json", "vite.config.ts", "playwright.config.ts", ".github/workflows/e2e-webkit.yml"];

function walk(root, dir, out) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return;
  for (const entry of readdirSync(abs)) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(root, rel, out);
    else out.push(rel);
  }
}

/**
 * Drops comments from a root file before the raw-text reference check, so prose that merely
 * mentions a path (e.g. this workflow's own header describing tools/**) is not a reference.
 * Executable text (a `run:` line, a script, an HTML attribute) is kept.
 */
export function stripComments(file, text) {
  if (/\.ya?ml$/.test(file)) return text.replace(/(^|\s)#.*$/gm, "$1");
  if (/\.html?$/.test(file)) return text.replace(/<!--[\s\S]*?-->/g, "");
  if (CODE_FILE.test(file)) return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  return text;
}

/** Import specifiers in a source text (query suffixes like `?raw` stripped). */
export function specifiersOf(text) {
  return [...text.matchAll(SPECIFIER)].map((m) => m[2].replace(/[?#].*$/, ""));
}

/**
 * Scans the checkout at `root`. A guarded category is enabled only if nothing the browser or the
 * E2E suite loads can name its files.
 * @returns {Record<string, { ok: boolean, reason: string }>}
 */
export function scanGuards(root) {
  try {
    for (const need of ["src", "e2e", "index.html", "package.json"]) {
      if (!existsSync(join(root, need))) throw new Error(`${need} not found under ${root}`);
    }
    const graph = [];
    walk(root, "src", graph);
    walk(root, "e2e", graph);
    const loaded = graph.filter((p) => CODE_FILE.test(p) && skipCategory(p)?.category !== "unit-test");
    const refs = { tools: [], "unit-test": [] };
    for (const file of loaded) {
      const text = readFileSync(join(root, file), "utf8");
      if (/import\.meta\.glob/.test(text)) {
        refs["unit-test"].push(`${file} (import.meta.glob)`);
        refs.tools.push(`${file} (import.meta.glob)`);
      }
      for (const s of specifiersOf(text)) {
        if (/\.test(?:\.[cm]?[jt]sx?)?$/.test(s) || /(?:^|\/)test\//.test(s)) refs["unit-test"].push(`${file} -> ${s}`);
        if (/(?:^|\/)tools\//.test(s)) refs.tools.push(`${file} -> ${s}`);
      }
    }
    for (const file of ROOT_FILES) {
      if (!existsSync(join(root, file))) continue;
      const text = stripComments(file, readFileSync(join(root, file), "utf8"));
      if (/tools\//.test(text)) refs.tools.push(file);
      if (/\.test\.|src\/test\b|import\.meta\.glob/.test(text)) refs["unit-test"].push(file);
    }
    return Object.fromEntries(
      GUARDED.map((c) => [
        c,
        refs[c].length === 0
          ? { ok: true, reason: `no reference from ${loaded.length} browser/E2E source file(s)` }
          : { ok: false, reason: `referenced by ${refs[c].slice(0, 3).join(", ")}${refs[c].length > 3 ? ", ..." : ""}` },
      ]),
    );
  } catch (error) {
    const reason = `repository scan failed: ${String(error?.message ?? error).replace(/[\r\n]+/g, " ")}`;
    return Object.fromEntries(GUARDED.map((c) => [c, { ok: false, reason }]));
  }
}

// ---------------------------------------------------------------------------------------------
// Self-test.

const OK = Object.fromEntries(GUARDED.map((c) => [c, { ok: true, reason: "test" }]));

// [changed files, expected webkitRequired, guards (default: all guarded categories enabled)]
const SELF_TEST_CASES = [
  // Case A: docs-only (#201, unchanged -- also without any repository scan)
  [["docs/reports/TETO_X_Result.md"], false],
  [["docs/reports/screenshots/task/before.png", "docs/PROJECT_HANDOFF.md"], false],
  [["README.md", "CLAUDE.md"], false],
  [["docs/reports/TETO_X_Result.md"], false, NO_SCAN],
  // Case A2: tools/unit-test only (#207 Phase 2B) -- skip only with a clean repository scan
  [["tools/progression2_issue216_fresh_design.py", "docs/design/X.md"], false],
  [["tools/sub/dir/analysis.py"], false],
  [["src/state/persistence.forwardCompat.test.ts", "src/logic/scoring.test.ts"], false],
  [["src/components/PizzaStage.sauceParity.test.tsx"], false],
  [["src/test/setup.ts"], false],
  [["tools/x.py"], true, NO_SCAN],
  [["src/logic/scoring.test.ts"], true, NO_SCAN],
  [["src/logic/scoring.test.ts"], true, { ...OK, "unit-test": { ok: false, reason: "referenced" } }],
  [["tools/x.py"], true, { ...OK, tools: { ok: false, reason: "referenced" } }],
  [["tools/x.py", "src/logic/scoring.test.ts"], true, { ...OK, tools: { ok: false, reason: "referenced" } }],
  // Case B: runtime -- storage/persistence, navigation, input, runtime UI are never skippable
  [["src/App.tsx"], true],
  [["src/game/reducer.ts", "docs/reports/x.md"], true],
  [["src/App.css"], true],
  [["src/index.css"], true],
  [["src/notes.md"], true],
  [["src/state/persistence.ts"], true],
  [["src/state/persistence.ts", "src/state/persistence.forwardCompat.test.ts"], true],
  [["src/state/gameReducer.ts"], true],
  [["src/state/inventory.ts"], true],
  [["src/firebase/submitLunchRushScore.ts"], true],
  [["src/screens/GameScreen.tsx"], true],
  [["src/screens/HomeScreen.tsx"], true],
  [["src/components/PizzaStage.tsx"], true],
  [["src/components/IngredientTray.tsx"], true],
  [["src/logic/pointerTimestampNormalizer.ts"], true],
  [["src/mission/lunchRush.ts"], true],
  [["src/data/recipes.ts"], true],
  [["src/state/testSupport/postBakeFlow.ts"], true],
  [["src/logic/discovery/testSupport/phase2Matrix.ts"], true],
  [["src/test.ts"], true],
  [["src/logic/scoring.test.ts.orig"], true],
  [["src/logic/scoring.spec.ts"], true],
  [["src/logic/testing.ts"], true],
  [["src/assets/characters/teto.webp"], true],
  // Case C: E2E -- always WebKit, whatever the file name
  [["e2e/viewport-1screen.spec.ts"], true],
  [["e2e/gestures.ts"], true],
  [["e2e/new-flow.test.ts"], true],
  [["e2e/README.md"], true],
  // Case D: workflow / config / deps / other trees
  [[".github/workflows/e2e-webkit.yml"], true],
  [[".github/workflows/ci.yml"], true],
  [["playwright.config.ts"], true],
  [["vite.config.ts"], true],
  [["vitest.config.ts"], true],
  [["package.json"], true],
  [["package-lock.json"], true],
  [["tsconfig.app.json"], true],
  [["index.html"], true],
  [["public/icon-192.png"], true],
  [["scripts/ci/classify-webkit.mjs"], true],
  [["tools/progression2_phase34_unlocks.json"], true],
  [["tools/run.sh"], true],
  [["data/recipes/pizza_master_catalog.json"], true],
  [["functions/src/index.ts"], true],
  [["firestore.rules.test.ts"], true],
  // Case E: unknown / fail-safe
  [["some/new/dir/file.txt"], true],
  [["docs"], true],
  [["docs.md.ts"], true],
  [["tools.py"], true],
  [[], true],
  [["", "  "], true],
];

// [name, files {path: content}, expected { tools, "unit-test" }]
const SCAN_CASES = [
  [
    "clean tree",
    {
      "index.html": '<script type="module" src="/src/main.tsx"></script>',
      "package.json": '{"scripts":{"test":"vitest run"}}',
      "src/main.tsx": 'import "./App.css";\nimport { App } from "./App";\n// see tools/x.py and App.test.tsx\n',
      "src/App.tsx": 'import { render } from "@testing-library/react";\nexport const App = 1;\n',
      "src/App.test.tsx": 'import { App } from "./App";\nimport "../test/setup";\n',
      "src/test/setup.ts": 'import "@testing-library/jest-dom";\n',
      "e2e/a.spec.ts": 'import { go } from "./gestures";\n',
      "e2e/gestures.ts": "export const go = 1;\n",
    },
    { tools: true, "unit-test": true },
  ],
  ["runtime imports a test module", { "src/App.tsx": 'import { x } from "./App.test";\n' }, { tools: true, "unit-test": false }],
  ["runtime imports test/setup", { "src/App.tsx": 'import "./test/setup";\n' }, { tools: true, "unit-test": false }],
  ["dynamic import of a .test.tsx", { "src/App.tsx": 'const m = import("./x.test.tsx");\n' }, { tools: true, "unit-test": false }],
  ["import.meta.glob anywhere", { "src/App.tsx": 'const all = import.meta.glob("./**/*.ts");\n' }, { tools: false, "unit-test": false }],
  ["e2e imports a unit test helper", { "e2e/gestures.ts": 'import { x } from "../src/logic/a.test";\n' }, { tools: true, "unit-test": false }],
  ["runtime imports tools output", { "src/App.tsx": 'import data from "../tools/out.json?raw";\n' }, { tools: false, "unit-test": true }],
  ["package.json runs a tools script", { "package.json": '{"scripts":{"postinstall":"python tools/gen.py"}}' }, { tools: false, "unit-test": true }],
  ["workflow references tools", { ".github/workflows/e2e-webkit.yml": "run: python tools/gen.py" }, { tools: false, "unit-test": true }],
  ["workflow run line with a trailing comment", { ".github/workflows/e2e-webkit.yml": "  run: python tools/gen.py # regen" }, { tools: false, "unit-test": true }],
  [
    "comments that only mention tools/ and .test. are not references",
    {
      ".github/workflows/e2e-webkit.yml": "# skips tools/**/*.py and src/**/*.test.ts(x)\n  run: npx playwright test # not tools/x.py\n",
      "playwright.config.ts": '// see tools/x.py and a.test.ts\n/* tools/y.py */\nexport default { baseURL: "http://localhost/" };\n',
      "index.html": '<!-- tools/x.py a.test.ts --><script type="module" src="/src/main.tsx"></script>',
    },
    { tools: true, "unit-test": true },
  ],
  ["config code that references tools", { "vite.config.ts": 'const x = "tools/gen.py"; // generator\n' }, { tools: false, "unit-test": true }],
];

function scanFixture(overrides) {
  const base = SCAN_CASES[0][1];
  const root = mkdtempSync(join(tmpdir(), "classify-webkit-"));
  try {
    for (const [path, content] of Object.entries({ ...base, ...overrides })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    return scanGuards(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function selfTest() {
  let failed = 0;
  let count = 0;
  for (const [files, expected, guards = OK] of SELF_TEST_CASES) {
    count++;
    const { webkitRequired, reason } = classify(files, { guards });
    const ok = webkitRequired === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} [${files.join(", ")}] -> ${webkitRequired} (${reason})`);
  }
  for (const [name, files, expected] of SCAN_CASES) {
    count++;
    const guards = scanFixture(name === "clean tree" ? {} : files);
    const got = { tools: guards.tools.ok, "unit-test": guards["unit-test"].ok };
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} scan: ${name} -> ${JSON.stringify(got)} (${guards["unit-test"].reason} | ${guards.tools.reason})`);
  }
  count++;
  const missing = scanGuards(join(tmpdir(), "classify-webkit-does-not-exist"));
  const missingOk = !missing.tools.ok && !missing["unit-test"].ok;
  if (!missingOk) failed++;
  console.log(`${missingOk ? "PASS" : "FAIL"} scan: unreadable repository disables every guarded category`);
  console.log(`${count - failed}/${count} classifier cases passed`);
  return failed === 0;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest() ? 0 : 1);
  }
  const repo = arg("repo");
  const guards = repo ? scanGuards(repo) : NO_SCAN;
  const { webkitRequired, reason } = classify(readFileSync(0, "utf8").split("\n"), { guards });
  // Reasons are single-line by construction; strip newlines anyway so GITHUB_OUTPUT stays valid.
  console.log(`webkit_required=${webkitRequired}`);
  console.log(`reason=${reason.replace(/[\r\n]+/g, " ")}`);
  if (repo) console.error(`guards: ${relative(".", repo) || "."} ${JSON.stringify(guards)}`);
}
