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
//   unit-test   src/**/*.test.ts(x), src/test/** code -- Vitest-only files    (#207 Phase 2B)
//
// `tools` and `unit-test` additionally require a repository scan (--repo) of the checked-out tree.
// Design (after four Codex review rounds on PR #219 found gaps in a regex import *parser*): the
// scan never parses or strips anything, so it cannot lose evidence -- every heuristic can only
// err towards running WebKit. Over the RAW text of every text file in the repo (any extension;
// binaries, docs/**, scripts/ci/** and the guarded files themselves excluded):
//   1. a changed guarded file whose name stem (e.g. `scoring.test`, `test/setup`, a tools script
//      stem) appears anywhere -- import, fs path, command, even a comment -- runs WebKit; guarded
//      files named that way (transitively) are themselves scanned like runtime code;
//   2. any construct that could load a file by a computed path fails the category closed:
//      import()/require()/fetch()/new URL()/new Worker()/fs reads whose whole first argument is
//      not one plain string literal ("a" + b, `${x}`, a comment are not), readdir/glob, import.meta.glob, eval,
//      new Function, a `python` invocation (tools);
//   3. config that could widen what Vite serves or Playwright runs fails closed: vite/playwright
//      configs importing any local module (so their settings can only live in those two files),
//      a Vite root/alias/rollupOptions/optimizeDeps/publicDir/input or Playwright testMatch/
//      testIgnore key in them, a Playwright testDir that is not exactly "./e2e" (else Playwright
//      could run src/** *.test.ts), or a --config / -c switch selecting another config.
// Threat model: accidental coupling in ordinary code. Deliberate obfuscation is out of scope; the
// post-merge Full WebKit run on main (push) and the `webkit-full` label are the backstops.
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
const UNIT_TEST_SETUP = /^src\/test\/(?:[^/]+\/)*[^/]+\.[cm]?[jt]sx?$/;
const TOOLS_SCRIPT = /^tools\/(?:.+\/)?[^/]+\.py$/;

/** @returns {{ category: string, label: string } | null} */
function skipCategory(path) {
  if (path.startsWith("docs/")) return { category: "docs", label: "docs/**" };
  if (path.endsWith(".md") && !RUNTIME_ROOTS.some((root) => path.startsWith(root))) {
    return { category: "docs", label: "**/*.md (outside runtime trees)" };
  }
  if (TOOLS_SCRIPT.test(path)) return { category: "tools", label: "tools/**/*.py" };
  if (UNIT_TEST_FILE.test(path) || UNIT_TEST_SETUP.test(path)) {
    return { category: "unit-test", label: "src/**/*.test.ts(x), src/test/**/*.{ts,tsx,js}" };
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
// Every text file is scanned, whatever its extension (.sh, Makefile, .py, ...): an allow-list of
// extensions would leave wrappers unscanned. Only binaries (a NUL byte) are skipped.
const SCAN_SKIP_DIRS = new Set(["node_modules", ".git", "docs", "dist", "playwright-report", "test-results", "coverage"]);
// scripts/ci/** classifies and verifies WebKit runs; it is never loaded by Vite or Playwright (and
// changing it is itself a Full-WebKit change). Vitest-only configs never run under Vite/Playwright.
const SCAN_SKIP_FILE = /^(?:scripts\/ci\/|vitest(?:\.[\w-]+)?\.config\.[cm]?[jt]s$)/;
// Whitespace and comments may sit wherever JS allows (`import /* x */ (p)`, `from /* x */ "./y"`).
const GAP = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*`;
// Calls that take a path/URL/specifier: fine with a plain string literal, fail closed otherwise.
const LOADER_CALL = new RegExp(
  String.raw`\b(?:import|require|fetch|importScripts|readFileSync|readFile|createReadStream)${GAP}\(|\bnew${GAP}(?:URL|Worker|SharedWorker)${GAP}\(`,
  "g",
);
// Constructs that load by pattern or by code: always fail closed.
const ALWAYS_DYNAMIC = new RegExp(
  String.raw`import${GAP}\.${GAP}meta${GAP}\.${GAP}glob|\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob|eval)${GAP}\(|\bnew${GAP}Function${GAP}\(`,
);
const CONFIG_KEY = /\b(?:testMatch|testIgnore|rollupOptions|optimizeDeps|publicDir|alias|mergeConfig|loadConfigFromFile)\b|\b(?:root|input)\s*:/;
const LOCAL_IMPORT = new RegExp(String.raw`(?:\bfrom|\bimport|\brequire)${GAP}\(?${GAP}["'\x60]\.{0,2}\/`);

function walk(root, dir, out) {
  for (const entry of readdirSync(join(root, dir))) {
    if (SCAN_SKIP_DIRS.has(entry)) continue;
    const rel = dir ? `${dir}/${entry}` : entry;
    if (statSync(join(root, rel)).isDirectory()) walk(root, rel, out);
    else out.push(rel);
  }
}

/** First non-literal use of a path-taking call in `text`, or null. Raw text: comments count too. */
export function dynamicLoad(text) {
  const always = text.match(ALWAYS_DYNAMIC);
  if (always) return always[0];
  for (const m of text.matchAll(LOADER_CALL)) {
    const rest = text.slice(m.index + m[0].length);
    // The WHOLE first argument must be one plain literal: closed, then `,` or `)` -- so
    // "a" + name, `./${x}`, a leading comment or any other expression fails closed.
    if (/^\s*(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`$\\]*`)\s*[,)]/.test(rest)) continue;
    return `${m[0]}${rest.replace(/^\s+/, "").slice(0, 24).replace(/\s+/g, " ")}`;
  }
  return null;
}

/** The text by which a guarded file would have to be named to be loaded or run. */
export function nameStem(path) {
  if (path.startsWith("tools/")) return path.split("/").pop().replace(/\.py$/, "");
  if (/^src\/test\//.test(path)) {
    // Relative imports inside src/test/ use only the basename (`./util`), and a directory index
    // is imported by its directory (`./helper` -> helper/index.ts): match on that last segment.
    return path.replace(/\.[^./]+$/, "").replace(/\/index$/, "").split("/").pop();
  }
  return path.split("/").pop().replace(/\.[cm]?[jt]sx?$/, "");
}

/**
 * Scans the checkout at `root` for the guarded categories of `paths` (see the header). Returns,
 * per guarded category, whether its skip may be used for these changed paths.
 * @returns {Record<string, { ok: boolean, reason: string }>}
 */
export function scanGuards(root, paths = []) {
  try {
    for (const need of ["src", "e2e", "index.html", "package.json"]) {
      if (!existsSync(join(root, need))) throw new Error(`${need} not found under ${root}`);
    }
    const all = [];
    walk(root, "", all);
    const raw = new Map();
    for (const f of all) {
      if (SCAN_SKIP_FILE.test(f)) continue;
      const buf = readFileSync(join(root, f));
      if (!buf.includes(0)) raw.set(f, buf.toString("utf8"));
    }
    const isGuarded = (f) => GUARDED.includes(skipCategory(f)?.category);
    const guardedFiles = [...raw.keys()].filter(isGuarded);
    const files = [...raw.keys()].filter((f) => !isGuarded(f));
    const read = (f) => raw.get(f);
    const texts = new Map(files.map((f) => [f, read(f)]));
    // Guarded files can load each other (runtime -> a.test -> b.test). A guarded file counts as
    // reachable if a non-guarded file or an already-reachable guarded file names it; reachable
    // guarded files then take part in every check below, exactly like runtime code.
    // Only guarded JS/TS modules can load further modules when they are loaded (a tools/*.py file
    // only runs under python, and any python invocation is caught by the python rule below).
    const guardedModules = guardedFiles.filter((f) => CODE_FILE.test(f));
    const guardedText = new Map(guardedModules.map((f) => [f, read(f)]));
    const reachable = new Set();
    for (let grew = true; grew; ) {
      grew = false;
      for (const g of guardedModules) {
        if (reachable.has(g)) continue;
        const stem = nameStem(g);
        const namedBy = [...texts.values(), ...[...reachable].map((r) => guardedText.get(r))].some((t) => t.includes(stem));
        if (namedBy) {
          reachable.add(g);
          grew = true;
        }
      }
    }
    for (const g of reachable) texts.set(g, guardedText.get(g));
    const blocked = { tools: [], "unit-test": [] };
    const both = (why) => {
      blocked.tools.push(why);
      blocked["unit-test"].push(why);
    };

    let playwrightConfigs = 0;
    for (const [file, text] of texts) {
      if (!CODE_FILE.test(file) && !/\.html?$/.test(file)) continue;
      const dyn = dynamicLoad(text);
      if (dyn) both(`${file} (${dyn})`);
      const config = /^(?:vite|playwright)\.config\.[cm]?[jt]s$/.test(file);
      if (config && LOCAL_IMPORT.test(text)) both(`${file} (imports a local module the scan cannot vouch for)`);
      // The two configs may not import local modules (above), so these keys can only live here.
      if (config && CONFIG_KEY.test(text)) both(`${file} (${text.match(CONFIG_KEY)[0]} can change what Vite serves or Playwright runs)`);
      if (/^playwright\.config\./.test(file)) {
        playwrightConfigs++;
        const dirs = [...text.matchAll(/\btestDir\b[^,\n}]*/g)].map((m) => m[0]);
        if (dirs.length !== 1 || !/^testDir\s*:\s*["']\.\/e2e\/?["']\s*$/.test(dirs[0])) both(`${file} (testDir is not exactly "./e2e")`);
      }
    }
    // No config -> Playwright's testDir is the repo root and its default testMatch runs *.test.ts.
    if (playwrightConfigs !== 1) both(`${playwrightConfigs} playwright.config file(s) (need exactly one)`);
    // An alternative config (vite --config / playwright -c) would bypass the checks above.
    for (const file of ["package.json", ".github/workflows/e2e-webkit.yml"]) {
      const text = texts.get(file) ?? "";
      if (/--config\b|\s-c\s/.test(text)) both(`${file} (selects a non-default config)`);
    }
    for (const [file, text] of texts) {
      if (/\bpython[0-9.]*\b/.test(text)) blocked.tools.push(`${file} (runs python)`);
    }
    // A tools/*.py file can never run in the browser; under Node it needs a spawned process (a
    // shebang script needs no `python` word). Any process spawning that can run during the WebKit
    // job disables the tools skip: code in src/, e2e/ or the repo root, or any file another
    // scanned file names (package.json scripts, the workflow, helpers). An unnamed script under
    // e.g. scripts/ cannot be run by the job.
    const SPAWN = /child_process|\b(?:execSync|execFileSync|execFile|spawnSync|spawn|fork|execa)\b|\bzx\b/;
    for (const [file, text] of texts) {
      if (!SPAWN.test(text)) continue;
      const stem = file.split("/").pop().replace(/\.[^.]+$/, "");
      const runnable = /^(?:src|e2e)\//.test(file) || !file.includes("/") || [...texts].some(([f, t]) => f !== file && t.includes(stem));
      if (runnable) blocked.tools.push(`${file} (spawns processes)`);
    }

    for (const path of paths) {
      const cat = skipCategory(path)?.category;
      if (!GUARDED.includes(cat)) continue;
      const stem = nameStem(path);
      for (const [file, text] of texts) {
        if (file !== path && text.includes(stem)) blocked[cat].push(`${file} names '${stem}'`);
      }
    }
    return Object.fromEntries(
      GUARDED.map((c) => [
        c,
        blocked[c].length === 0
          ? { ok: true, reason: `scan of ${files.length} file(s): nothing names or dynamically loads it` }
          : { ok: false, reason: `${blocked[c].slice(0, 3).join(", ")}${blocked[c].length > 3 ? ", ..." : ""}` },
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
  [["src/test/styles.css"], true],
  [["src/test/fixture.json"], true],
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

const BASE_TREE = {
  "index.html": '<!-- entry --><script type="module" src="/src/main.tsx"></script>',
  "package.json": '{"scripts":{"test":"vitest run","test:e2e":"playwright test"}}',
  "vite.config.ts": 'import react from "@vitejs/plugin-react";\nexport default { base: "/app/", plugins: [react()] };\n',
  "playwright.config.ts": 'import { defineConfig } from "@playwright/test";\nexport default defineConfig({ testDir: "./e2e", projects: [{ name: "p" }] });\n',
  "vitest.config.ts": 'export default { test: { setupFiles: ["./src/test/setup.ts"] } };\n',
  ".github/workflows/e2e-webkit.yml": "# skips tools/**/*.py\n  run: npx playwright test\n",
  "src/main.tsx": 'import "./App.css";\nimport { App } from "./App";\n',
  "src/App.css": "body {}\n",
  "src/App.tsx": 'import { render } from "@testing-library/react";\nexport const App = 1;\n',
  "src/logic/a.test.ts": 'import { App } from "../App";\nimport "../test/setup";\n',
  "src/test/setup.ts": 'import "@testing-library/jest-dom";\n',
  "e2e/a.spec.ts": 'import { go } from "./gestures";\nasync function f(page: import("@playwright/test").Page) {}\n',
  "e2e/gestures.ts": "export const go = 1;\n",
  "tools/gen.py": "print(1)\n",
  "scripts/ci/classify-webkit.mjs": "// mentions a.test and tools/gen.py and import(x) -- excluded from the scan\n",
  "docs/x.md": "a.test gen.py import(x)\n",
};
const CHANGED = ["src/logic/a.test.ts", "tools/gen.py"];
const T = { tools: true, "unit-test": true };
// [name, file overrides, expected { tools, "unit-test" }, changed paths (default CHANGED)]
const SCAN_CASES = [
  ["clean tree (vitest config, CI scripts and docs are not scanned)", {}, T],
  ["an HTML comment naming the test counts (never strip)", { "index.html": '<!-- a.test --><script type="module" src="/src/main.tsx"></script>' }, { ...T, "unit-test": false }],
  ["non-Vite script with an `input:` option is not a config key", { "scripts/icons.cjs": 'const sharp = require("sharp");\nsharp({ input: "x.svg" });\n' }, T],
  ["package.json selects another Vite config", { "package.json": '{"scripts":{"dev":"vite --config other.config.ts"}}' }, { tools: false, "unit-test": false }],
  ["runtime imports the changed test module", { "src/App.tsx": 'import { x } from "./logic/a.test";\n' }, { ...T, "unit-test": false }],
  ["a comment naming the test module counts (never strip)", { "src/App.tsx": "// see a.test.ts\n" }, { ...T, "unit-test": false }],
  ["comment markers inside strings cannot hide an import", { "src/App.tsx": 'const a = "/*"; import("./logic/a.test"); const b = "*/";\n' }, { ...T, "unit-test": false }],
  ["dynamic import with an inline comment", { "src/App.tsx": 'const m = import(/* @vite-ignore */ "./logic/a.test.ts");\n' }, { tools: false, "unit-test": false }],
  ["dynamic import with a non-literal argument", { "src/App.tsx": "const m = import(name);\n" }, { tools: false, "unit-test": false }],
  ["dynamic import with an interpolated template", { "src/App.tsx": "const m = import(`./${path}`);\n" }, { tools: false, "unit-test": false }],
  ["dynamic import with a plain template literal is fine", { "src/App.tsx": "const m = import(`./App`);\n" }, T],
  ["new URL / new Worker / fetch with a computed path", { "src/App.tsx": "new Worker(new URL(p, import.meta.url));\n" }, { tools: false, "unit-test": false }],
  ["import.meta.glob", { "src/App.tsx": 'const all = import.meta.glob("./**/*.ts");\n' }, { tools: false, "unit-test": false }],
  ["e2e helper reads the test file by literal path", { "e2e/gestures.ts": 'import { readFileSync } from "node:fs";\nexport const s = readFileSync("src/logic/a.test.ts", "utf8");\n' }, { ...T, "unit-test": false }],
  ["e2e helper reads a computed path", { "e2e/gestures.ts": 'import { readFileSync } from "node:fs";\nexport const s = (p) => readFileSync(p, "utf8");\n' }, { tools: false, "unit-test": false }],
  ["e2e helper lists a directory", { "e2e/gestures.ts": 'import { readdirSync } from "node:fs";\nexport const s = readdirSync("src");\n' }, { tools: false, "unit-test": false }],
  ["index.html entry outside src that imports the test", { "index.html": '<script type="module" src="/client/main.ts"></script>', "client/main.ts": 'import "../src/logic/a.test";\n' }, { ...T, "unit-test": false }],
  ["index.html inline script with a computed import", { "index.html": "<script type=\"module\">import(location.hash)</script>" }, { tools: false, "unit-test": false }],
  ["vite.config imports a local helper (provenance unknown)", { "vite.config.ts": 'import p from "./config/plugin";\nexport default { plugins: [p] };\n', "config/plugin.ts": 'export default { root: "app" };\n' }, { tools: false, "unit-test": false }],
  ["playwright.config imports a local helper", { "playwright.config.ts": 'import base from "./pw-base";\nexport default { ...base, testDir: "./e2e" };\n', "pw-base.ts": "export default {};\n" }, { tools: false, "unit-test": false }],
  ["Vite root / alias anywhere outside src", { "vite.config.ts": 'export default { resolve: { alias: { "@": "/src" } } };\n' }, { tools: false, "unit-test": false }],
  ["Vite rollupOptions input", { "vite.config.ts": 'export default { build: { rollupOptions: { input: "admin.html" } } };\n' }, { tools: false, "unit-test": false }],
  ["Playwright testDir widened", { "playwright.config.ts": 'export default { testDir: "." };\n' }, { tools: false, "unit-test": false }],
  ["Playwright config without testDir (default = repo root)", { "playwright.config.ts": "export default {};\n" }, { tools: false, "unit-test": false }],
  ["no Playwright config at all (default = repo root)", { "playwright.config.ts": null }, { tools: false, "unit-test": false }],
  ["Playwright testMatch", { "playwright.config.ts": 'export default { testDir: "./e2e", testMatch: "**/*.ts" };\n' }, { tools: false, "unit-test": false }],
  ["a project-level testDir", { "playwright.config.ts": 'export default { testDir: "./e2e", projects: [{ name: "u", testDir: "./src" }] };\n' }, { tools: false, "unit-test": false }],
  ["package.json runs the changed tools script", { "package.json": '{"scripts":{"gen":"node x && tools/gen.py"}}' }, { ...T, tools: false }],
  ["anything invoking python (tools)", { ".github/workflows/e2e-webkit.yml": "  run: python3 -m runner\n" }, { ...T, tools: false }],
  ["runtime imports tools output", { "src/App.tsx": 'import d from "../tools/gen.py?raw";\n' }, { ...T, tools: false }],
  ["comment between import and its parenthesis", { "src/App.tsx": "const m = import /* webpackIgnore: true */ (path);\n" }, { tools: false, "unit-test": false }],
  ["comment between new and URL", { "src/App.tsx": "new /* x */ URL(p, import.meta.url);\n" }, { tools: false, "unit-test": false }],
  ["static import with a comment is not a loader call", { "src/App.tsx": 'import /* types */ { x } from "./x";\n', "src/x.ts": "export const x = 1;\n" }, T],
  [
    "directory-index import names a guarded index module",
    { "src/App.tsx": 'import { h } from "./test/helper";\n', "src/test/helper/index.ts": "export const h = 1;\n" },
    { ...T, "unit-test": false },
    ["src/test/helper/index.ts"],
  ],
  ["comment between eval and its parenthesis", { "src/App.tsx": "eval /* instrumentation */ (source);\n" }, { tools: false, "unit-test": false }],
  ["comment between new and Function", { "src/App.tsx": "new /* note */ Function(source);\n" }, { tools: false, "unit-test": false }],
  ["comment between glob and its parenthesis", { "e2e/gestures.ts": "glob /* note */ (pattern);\n" }, { tools: false, "unit-test": false }],
  ["playwright.config imports a local helper after a comment", { "playwright.config.ts": 'import { base } from /* note */ "./pw-base";\nexport default { ...base, testDir: "./e2e" };\n', "pw-base.ts": 'export const base = { testMatch: "src/**/*.test.ts" };\n' }, { tools: false, "unit-test": false }],
  ["a shell wrapper runs python (any extension is scanned)", { "e2e/gestures.ts": 'import { execSync } from "node:child_process";\nexecSync("sh scripts/prepare.sh");\n', "scripts/prepare.sh": "#!/bin/sh\npython tools/gen.py\n" }, { ...T, tools: false }],
  ["an extensionless script naming the changed test", { "Makefile": "check:\n\tnode src/logic/a.test.ts\n" }, { ...T, "unit-test": false }],
  ["a named tools script is not itself a python runner", { "src/App.tsx": "// derived from tools/other.py\n", "tools/other.py": "#!/usr/bin/env python3\nimport subprocess\n" }, T],
  [
    "relative import inside src/test (./util)",
    { "src/App.tsx": 'import { h } from "./test/helper";\n', "src/test/helper.ts": 'export { u as h } from "./util";\n', "src/test/util.ts": "export const u = 1;\n" },
    { ...T, "unit-test": false },
    ["src/test/util.ts"],
  ],
  ["e2e spawns a process (shebang tools runner)", { "e2e/gestures.ts": 'import { execFileSync } from "node:child_process";\nexecFileSync("./tools/runner.py");\n', "tools/runner.py": "#!/usr/bin/env python3\nimport gen\n" }, { ...T, tools: false }],
  ["root config spawns a process", { "playwright.config.ts": 'import { execSync } from "node:child_process";\nexport default { testDir: "./e2e" };\n' }, { ...T, tools: false }],
  ["an unnamed script that spawns cannot run in the job", { "scripts/record.mjs": 'import { spawnSync } from "node:child_process";\nspawnSync("ffmpeg");\n' }, T],
  ["a named script that spawns can run in the job", { "scripts/record.mjs": 'import { spawnSync } from "node:child_process";\nspawnSync("x");\n', "package.json": '{"scripts":{"prep":"node scripts/record.mjs"}}' }, { ...T, tools: false }],
  ["binary files are skipped", { "public/icon.png": "\u0000PNG a.test tools/gen.py python" }, T],
  ["concatenated fetch argument", { "src/App.tsx": 'fetch("/src/logic/" + name);\n' }, { tools: false, "unit-test": false }],
  ["concatenated import argument", { "src/App.tsx": 'import("./logic/" + moduleName);\n' }, { tools: false, "unit-test": false }],
  ["literal followed by a second argument is fine", { "src/App.tsx": 'new URL("./App.css", import.meta.url);\nfetch("/api", { method: "GET" });\n' }, T],
  ["runtime -> other.test -> changed a.test (guarded chain)", { "src/App.tsx": 'import "./logic/other.test";\n', "src/logic/other.test.ts": 'import "./a.test";\n' }, { ...T, "unit-test": false }],
  ["reachable guarded file with a dynamic import", { "src/App.tsx": 'import "./logic/other.test";\n', "src/logic/other.test.ts": "import(name);\n" }, { tools: false, "unit-test": false }],
  ["unreachable test files may name each other", { "src/logic/other.test.ts": 'import "./a.test";\nimport(name);\n' }, T],
  ["functions/ `input:` params are not config keys", { "functions/src/index.ts": "export function f(input: X) { return { input: input }; }\n" }, T],
];

function scanFixture(overrides, changed = CHANGED) {
  const root = mkdtempSync(join(tmpdir(), "classify-webkit-"));
  try {
    for (const [path, content] of Object.entries({ ...BASE_TREE, ...overrides })) {
      if (content === null) continue;
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    return scanGuards(root, changed);
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
  for (const [name, files, expected, changed] of SCAN_CASES) {
    count++;
    const guards = scanFixture(files, changed);
    const got = { tools: guards.tools.ok, "unit-test": guards["unit-test"].ok };
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} scan: ${name} -> ${JSON.stringify(got)} (${guards["unit-test"].reason} | ${guards.tools.reason})`);
  }
  count++;
  const missing = scanGuards(join(tmpdir(), "classify-webkit-does-not-exist"), CHANGED);
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
  const paths = readFileSync(0, "utf8").split("\n");
  const guards = repo ? scanGuards(repo, paths.map((p) => p.trim()).filter(Boolean)) : NO_SCAN;
  const { webkitRequired, reason } = classify(paths, { guards });
  // Reasons are single-line by construction; strip newlines anyway so GITHUB_OUTPUT stays valid.
  console.log(`webkit_required=${webkitRequired}`);
  console.log(`reason=${reason.replace(/[\r\n]+/g, " ")}`);
  if (repo) console.error(`guards: ${relative(".", repo) || "."} ${JSON.stringify(guards)}`);
}
