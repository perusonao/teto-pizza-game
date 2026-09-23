#!/usr/bin/env node
// Issue #201 A1: WebKit change classifier.
//
// Reads a newline-separated list of changed file paths (stdin) and decides whether the heavy
// WebKit E2E job (.github/workflows/e2e-webkit.yml) must run. Deliberately an ALLOW-LIST of
// "safe to skip" documentation paths, never a list of runtime paths: any path not explicitly
// recognised as documentation-only -- including every path added to the repo in the future --
// falls through to webkit_required=true. Broaden SKIP rules only with evidence (Issue #201).
//
// Usage:
//   git diff --name-only --no-renames BASE...HEAD | node scripts/ci/classify-webkit.mjs
//     -> prints `webkit_required=<true|false>` and `reason=<text>` (GITHUB_OUTPUT format)
//   node scripts/ci/classify-webkit.mjs --self-test
//     -> runs the built-in case table; exits non-zero on any mismatch

import { readFileSync } from "node:fs";

// Top-level trees whose contents can be loaded by the running app, the E2E suite, or the build,
// even when the file itself is Markdown (e.g. a `?raw` import). A `.md` file inside one of these
// is NOT treated as documentation-only.
const RUNTIME_ROOTS = ["src/", "e2e/", "public/", "functions/", ".github/"];

/** @returns {string | null} a skip reason when `path` is documentation-only, else null */
function docsOnlyReason(path) {
  if (path.startsWith("docs/")) return "docs/**";
  if (path.endsWith(".md") && !RUNTIME_ROOTS.some((root) => path.startsWith(root))) {
    return "**/*.md (outside runtime trees)";
  }
  return null;
}

/**
 * @param {string[]} rawPaths
 * @returns {{ webkitRequired: boolean, reason: string }}
 */
export function classify(rawPaths) {
  const paths = [...new Set(rawPaths.map((p) => p.trim()).filter(Boolean))];
  if (paths.length === 0) {
    return { webkitRequired: true, reason: "fail-safe: no changed files could be determined" };
  }
  const risky = paths.filter((p) => docsOnlyReason(p) === null);
  if (risky.length > 0) {
    const shown = risky.slice(0, 5).join(", ");
    const more = risky.length > 5 ? ` (+${risky.length - 5} more)` : "";
    return {
      webkitRequired: true,
      reason: `${risky.length} of ${paths.length} changed file(s) are not documentation-only: ${shown}${more}`,
    };
  }
  return {
    webkitRequired: false,
    reason: `all ${paths.length} changed file(s) are documentation-only (docs/**, **/*.md)`,
  };
}

// [changed files, expected webkitRequired]
const SELF_TEST_CASES = [
  // Case A: docs-only
  [["docs/reports/TETO_X_Result.md"], false],
  [["docs/reports/screenshots/task/before.png", "docs/PROJECT_HANDOFF.md"], false],
  [["README.md", "CLAUDE.md"], false],
  // Case B: runtime
  [["src/App.tsx"], true],
  [["src/game/reducer.ts", "docs/reports/x.md"], true],
  [["src/App.css"], true],
  [["src/notes.md"], true],
  // Case C: E2E
  [["e2e/viewport-1screen.spec.ts"], true],
  [["e2e/gestures.ts"], true],
  // Case D: workflow / config / deps
  [[".github/workflows/e2e-webkit.yml"], true],
  [[".github/workflows/ci.yml"], true],
  [["playwright.config.ts"], true],
  [["vite.config.ts"], true],
  [["package.json"], true],
  [["package-lock.json"], true],
  [["tsconfig.app.json"], true],
  [["index.html"], true],
  [["public/icon-192.png"], true],
  [["scripts/ci/classify-webkit.mjs"], true],
  // Case E: unknown / fail-safe
  [["some/new/dir/file.txt"], true],
  [["docs"], true],
  [["docs.md.ts"], true],
  [[], true],
  [["", "  "], true],
];

function selfTest() {
  let failed = 0;
  for (const [files, expected] of SELF_TEST_CASES) {
    const { webkitRequired, reason } = classify(files);
    const ok = webkitRequired === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} [${files.join(", ")}] -> ${webkitRequired} (${reason})`);
  }
  console.log(`${SELF_TEST_CASES.length - failed}/${SELF_TEST_CASES.length} classifier cases passed`);
  return failed === 0;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest() ? 0 : 1);
  }
  const { webkitRequired, reason } = classify(readFileSync(0, "utf8").split("\n"));
  // Reasons are single-line by construction; strip newlines anyway so GITHUB_OUTPUT stays valid.
  console.log(`webkit_required=${webkitRequired}`);
  console.log(`reason=${reason.replace(/[\r\n]+/g, " ")}`);
}
