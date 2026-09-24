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
// import x from "s" / import "s" / export ... from "s" / import("s") / require("s") / new URL("s", ...)
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bnew\s+URL\s*\(\s*)(["'`])([^"'`\n]+)\1/g;
// Root-level code files that are NOT traversal roots: Vitest-only configs and test files. Every
// other root code file (vite.config.*, playwright.config.*, postcss.config.*, ...) may be loaded
// by the dev server or Playwright, so it is a root.
const NON_ROOT_CODE = /^(?:vitest(?:\.[\w-]+)?\.config\.[cm]?[jt]s|.+\.test\.[cm]?[jt]sx?)$/;
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", "/index.ts", "/index.tsx", "/index.js", "/index.mjs"];

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

/** Resolves a relative or root-absolute specifier from `from` (repo-relative) to a repo file. */
function resolveSpecifier(root, from, spec) {
  const base = spec.startsWith("/") ? spec.slice(1) : join(dirname(from), spec);
  if (base.startsWith("..")) return null; // escapes the repository
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    const abs = join(root, candidate);
    if (existsSync(abs) && statSync(abs).isFile()) return candidate;
  }
  return null;
}

/** Code-level references to guarded files that a comment-stripped text contains as plain strings. */
function textRefs(text) {
  return { tools: /tools\//.test(text), "unit-test": /\.test\b|(?:^|[^\w-])src\/test\b/.test(text) };
}

// Vite settings that change what the dev server loads in ways the traversal cannot follow.
const VITE_UNFOLLOWABLE = /\b(?:alias|rollupOptions|optimizeDeps|publicDir)\b|\broot\s*:/;

/**
 * Scans the checkout at `root`. A guarded category is enabled only if nothing the browser, the
 * Vite dev server or the E2E suite can load reaches its files. It traverses imports from:
 *   - `index.html`'s script entries (src/href) and inline scripts,
 *   - every root-level config code file (all root *.ts/js except vitest*.config.* and *.test.*),
 *   - every non-test `src/**` and `e2e/**` code file,
 * following relative / root-absolute specifiers transitively (Codex reviews on #219). Comments
 * are stripped from every file first. It FAILS CLOSED (disables both categories) on anything it
 * cannot follow: an unresolvable relative import or HTML entry, a dynamic `import()` / `require()`
 * / `new URL()` whose argument is not a string literal, `import.meta.glob`, Vite settings that
 * redirect loading (alias, rollupOptions, optimizeDeps, publicDir, root), or a Playwright config
 * whose testDir is not `e2e` (Playwright would then run src/** test files itself).
 * @returns {Record<string, { ok: boolean, reason: string }>}
 */
export function scanGuards(root) {
  try {
    for (const need of ["src", "e2e", "index.html", "package.json"]) {
      if (!existsSync(join(root, need))) throw new Error(`${need} not found under ${root}`);
    }
    const tree = [];
    walk(root, "src", tree);
    walk(root, "e2e", tree);
    const rootCode = readdirSync(root).filter(
      (f) => CODE_FILE.test(f) && !NON_ROOT_CODE.test(f) && statSync(join(root, f)).isFile(),
    );
    const refs = { tools: [], "unit-test": [] };
    const both = (why) => {
      refs.tools.push(why);
      refs["unit-test"].push(why);
    };
    const seen = new Set();
    const queue = [];
    const enqueue = (file) => {
      if (!seen.has(file)) {
        seen.add(file);
        queue.push(file);
      }
    };
    const follow = (from, spec) => {
      if (/\.test(?:\.[cm]?[jt]sx?)?$/.test(spec) || /(?:^|\/)test\//.test(spec)) refs["unit-test"].push(`${from} -> ${spec}`);
      if (/(?:^|\/)tools\//.test(spec)) refs.tools.push(`${from} -> ${spec}`);
      if (!spec.startsWith(".") && !spec.startsWith("/")) return; // package import
      const target = resolveSpecifier(root, from, spec);
      if (target === null) return both(`${from} -> ${spec} (unresolved)`);
      if (skipCategory(target)?.category === "unit-test") refs["unit-test"].push(`${from} -> ${target}`);
      if (target.startsWith("tools/")) refs.tools.push(`${from} -> ${target}`);
      if (CODE_FILE.test(target)) enqueue(target);
    };
    const scanCode = (file, text) => {
      if (/import\.meta\.glob/.test(text)) both(`${file} (import.meta.glob)`);
      for (const call of ["\\bimport\\s*\\(", "\\brequire\\s*\\(", "\\bnew\\s+URL\\s*\\("]) {
        const all = text.match(new RegExp(call, "g"))?.length ?? 0;
        const literal = text.match(new RegExp(`${call}\\s*["'\`]`, "g"))?.length ?? 0;
        if (all !== literal) both(`${file} (${call.replace(/\\[bs]|\\/g, "").replace("*", "")} with a non-literal argument)`);
      }
      for (const spec of specifiersOf(text)) follow(file, spec);
    };

    // index.html: module entries and inline scripts are traversal roots.
    const html = stripComments("index.html", readFileSync(join(root, "index.html"), "utf8"));
    for (const [, attr] of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      if (/^(?:[a-z]+:)?\/\//i.test(attr)) continue; // external URL
      const spec = attr.replace(/[?#].*$/, "");
      const target =
        resolveSpecifier(root, "index.html", spec) ?? (spec.startsWith("/") ? resolveSpecifier(root, "public/x", spec.slice(1)) : null);
      if (target === null) both(`index.html -> ${attr} (unresolved script entry)`);
      else follow("index.html", spec.startsWith("/") || spec.startsWith(".") ? spec : `./${spec}`);
    }
    for (const [, body] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) scanCode("index.html <script>", body);
    const htmlText = textRefs(html);
    if (htmlText.tools) refs.tools.push("index.html");
    if (htmlText["unit-test"] || /import\.meta\.glob/.test(html)) refs["unit-test"].push("index.html");

    for (const f of rootCode) enqueue(f);
    for (const f of tree) if (CODE_FILE.test(f) && skipCategory(f)?.category !== "unit-test") enqueue(f);
    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      const text = stripComments(file, readFileSync(join(root, file), "utf8"));
      scanCode(file, text);
      // Config-side code (anything outside src/ and e2e/) may reach files without an import
      // specifier (fs reads, require.resolve, spawned commands): check its strings too.
      if (!file.startsWith("src/") && !file.startsWith("e2e/")) {
        const t = textRefs(text);
        if (t.tools) refs.tools.push(file);
        if (t["unit-test"]) refs["unit-test"].push(file);
        if (/^vite\.config\./.test(file) && VITE_UNFOLLOWABLE.test(text)) both(`${file} (Vite setting the scan cannot follow)`);
        if (/^playwright\.config\./.test(file)) {
          const dirs = [...text.matchAll(/\btestDir\s*:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1].replace(/^\.\//, "").replace(/\/+$/, ""));
          if (dirs.length === 0 || dirs.some((d) => d !== "e2e") || /\btestMatch\b/.test(text)) {
            both(`${file} (Playwright testDir is not e2e only: ${dirs.join(", ") || "default"})`);
          }
        }
      }
    }
    for (const file of ["package.json", ".github/workflows/e2e-webkit.yml"]) {
      if (!existsSync(join(root, file))) continue;
      const text = stripComments(file, readFileSync(join(root, file), "utf8"));
      if (/tools\//.test(text)) refs.tools.push(file);
      if (/\.test\.|src\/test\b|import\.meta\.glob/.test(text)) refs["unit-test"].push(file);
    }
    return Object.fromEntries(
      GUARDED.map((c) => [
        c,
        refs[c].length === 0
          ? { ok: true, reason: `no reference from ${queue.length} browser/E2E/config source file(s)` }
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

// [name, files {path: content}, expected { tools, "unit-test" }]
const SCAN_CASES = [
  [
    "clean tree",
    {
      "index.html": '<script type="module" src="/src/main.tsx"></script>',
      "package.json": '{"scripts":{"test":"vitest run"}}',
      "src/main.tsx": 'import "./App.css";\nimport { App } from "./App";\n// see tools/x.py and App.test.tsx\n',
      "src/App.css": "body {}\n",
      "src/App.tsx": 'import { render } from "@testing-library/react";\nexport const App = 1;\n',
      "src/App.test.tsx": 'import { App } from "./App";\nimport "./test/setup";\n',
      "src/test/setup.ts": 'import "@testing-library/jest-dom";\n',
      "e2e/a.spec.ts": 'import { go } from "./gestures";\n',
      "e2e/gestures.ts": "export const go = 1;\n",
    },
    { tools: true, "unit-test": true },
  ],
  ["runtime imports a test module", { "src/App.tsx": 'import { x } from "./App.test";\n' }, { tools: true, "unit-test": false }],
  ["runtime imports test/setup", { "src/App.tsx": 'import "./test/setup";\n' }, { tools: true, "unit-test": false }],
  ["dynamic import of a .test.tsx", { "src/App.tsx": 'const m = import("./x.test.tsx");\n', "src/x.test.tsx": "export {};\n" }, { tools: true, "unit-test": false }],
  ["import.meta.glob anywhere", { "src/App.tsx": 'const all = import.meta.glob("./**/*.ts");\n' }, { tools: false, "unit-test": false }],
  ["e2e imports a unit test helper", { "e2e/gestures.ts": 'import { x } from "../src/logic/a.test";\n', "src/logic/a.test.ts": "export const x = 1;\n" }, { tools: true, "unit-test": false }],
  ["runtime imports tools output", { "src/App.tsx": 'import data from "../tools/out.json?raw";\n', "tools/out.json": "{}\n" }, { tools: false, "unit-test": true }],
  ["package.json runs a tools script", { "package.json": '{"scripts":{"postinstall":"python tools/gen.py"}}' }, { tools: false, "unit-test": true }],
  ["workflow references tools", { ".github/workflows/e2e-webkit.yml": "run: python tools/gen.py" }, { tools: false, "unit-test": true }],
  ["workflow run line with a trailing comment", { ".github/workflows/e2e-webkit.yml": "  run: python tools/gen.py # regen" }, { tools: false, "unit-test": true }],
  [
    "comments that only mention tools/ and .test. are not references",
    {
      ".github/workflows/e2e-webkit.yml": "# skips tools/**/*.py and src/**/*.test.ts(x)\n  run: npx playwright test # not tools/x.py\n",
      "playwright.config.ts": '// see tools/x.py and a.test.ts\n/* tools/y.py */\nexport default { testDir: "./e2e", baseURL: "http://localhost/" };\n',
      "index.html": '<!-- tools/x.py a.test.ts --><script type="module" src="/src/main.tsx"></script>',
    },
    { tools: true, "unit-test": true },
  ],
  ["config code that references tools", { "vite.config.ts": 'const x = "tools/gen.py"; // generator\n' }, { tools: false, "unit-test": true }],
  // Codex review on #219 (0b3fc42): root configs and helpers outside src/ are traversed.
  ["vite.config imports a test module, extensionless", { "vite.config.ts": 'import p from "./src/plugin.test";\nexport default { plugins: [p] };\n', "src/plugin.test.ts": "export default {};\n" }, { tools: true, "unit-test": false }],
  [
    "vite.config -> config helper -> test module (transitive)",
    { "vite.config.ts": 'import p from "./config/plugin";\nexport default { plugins: [p] };\n', "config/plugin.ts": 'import x from "../lib/wrap";\nexport default x;\n', "lib/wrap.ts": 'export { default } from "../src/helper.test";\n', "src/helper.test.ts": "export default {};\n" },
    { tools: true, "unit-test": false },
  ],
  [
    "src -> helper outside src -> test module (transitive)",
    { "src/App.tsx": 'import { h } from "../lib/h";\nexport const App = h;\n', "lib/h.ts": 'export { h } from "../src/logic/h.test";\n', "src/logic/h.test.ts": "export const h = 1;\n" },
    { tools: true, "unit-test": false },
  ],
  ["playwright.config spawns a tools script", { "playwright.config.ts": 'export default { testDir: "./e2e", webServer: { command: "python tools/serve.py" } };\n' }, { tools: false, "unit-test": true }],
  // Codex re-review on #219 (27ce019) + hardening of the same class.
  ["dynamic import with an inline comment", { "src/App.tsx": 'const m = import(/* @vite-ignore */ "./lazy.test.ts");\n', "src/lazy.test.ts": "export {};\n" }, { tools: true, "unit-test": false }],
  ["dynamic import with a non-literal argument fails closed", { "src/App.tsx": 'const name = "./x";\nconst m = import(name);\n' }, { tools: false, "unit-test": false }],
  ["new URL with a non-literal argument fails closed", { "src/App.tsx": 'const u = new URL(path, import.meta.url);\n' }, { tools: false, "unit-test": false }],
  [
    "commented-out import in a traversed config helper is not a reference",
    { "vite.config.ts": 'import p from "./config/plugin";\nexport default { plugins: [p] };\n', "config/plugin.ts": '// import "../src/old.test";\n/* tools/x.py */\nexport default {};\n' },
    { tools: true, "unit-test": true },
  ],
  ["config helper reads a test file by path (no import)", { "vite.config.ts": 'import p from "./config/plugin";\nexport default { plugins: [p] };\n', "config/plugin.ts": 'import { readFileSync } from "node:fs";\nexport default readFileSync("src/x.test.ts", "utf8");\n' }, { tools: true, "unit-test": false }],
  [
    "index.html module entry outside src -> test module",
    { "index.html": '<script type="module" src="/client/main.ts"></script>', "client/main.ts": 'import "../src/lazy.test";\n', "src/lazy.test.ts": "export {};\n" },
    { tools: true, "unit-test": false },
  ],
  ["index.html entry that does not resolve fails closed", { "index.html": '<script type="module" src="/client/missing.ts"></script>' }, { tools: false, "unit-test": false }],
  ["index.html inline module script imports tools output", { "index.html": '<script type="module">import d from "/tools/out.json";</script>', "tools/out.json": "{}\n" }, { tools: false, "unit-test": true }],
  ["Playwright testDir widened to the repo fails closed", { "playwright.config.ts": 'export default { testDir: "." };\n' }, { tools: false, "unit-test": false }],
  ["Playwright config without testDir fails closed", { "playwright.config.ts": "export default {};\n" }, { tools: false, "unit-test": false }],
  ["Playwright testMatch fails closed", { "playwright.config.ts": 'export default { testDir: "./e2e", testMatch: "**/*.test.ts" };\n' }, { tools: false, "unit-test": false }],
  ["Vite rollupOptions input fails closed", { "vite.config.ts": 'export default { build: { rollupOptions: { input: "admin.html" } } };\n' }, { tools: false, "unit-test": false }],
  ["unresolvable relative import fails closed", { "src/App.tsx": 'import { x } from "./does-not-exist";\n' }, { tools: false, "unit-test": false }],
  ["vite resolve.alias fails closed", { "vite.config.ts": 'export default { resolve: { alias: { "@": "/src" } } };\n' }, { tools: false, "unit-test": false }],
  ["vitest.config referencing src/test is not a root", { "vitest.config.ts": 'export default { test: { setupFiles: ["./src/test/setup.ts"] } };\n' }, { tools: true, "unit-test": true }],
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
