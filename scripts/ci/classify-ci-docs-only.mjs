#!/usr/bin/env node
// CI optimization Phase 1: is a pull request documentation-only, so ci.yml may skip lint / Vitest /
// build?
//
// Reads a newline-separated list of changed file paths (stdin) and prints `docs_only=<true|false>` and
// `reason=<text>` (GITHUB_OUTPUT format). Deliberately an ALLOW-LIST of "safe to skip" paths, never a
// list of runtime paths: any path not explicitly recognised -- including every path added to the repo
// in the future -- falls through to docs_only=false (full CI). Broaden the allow-list only with evidence.
//
// This is STRICTER than ./classify-webkit.mjs (which treats all of docs/** as skippable for the WebKit
// E2E job). Vitest imports JSON data straight out of docs/design/data/ (hint5Taxonomy.gate.test.ts,
// phase2Matrix.ts), so a change to a docs/** JSON file can change a Vitest result; lint / Vitest / build
// may only be skipped when every changed file is one of:
//   - Markdown under docs/            (docs/**/*.md)
//   - an image under docs/            (docs/**/*.png|jpg|jpeg|webp|gif -- screenshots / report figures)
//   - Markdown at the repo root       (README.md, CLAUDE.md)
// Everything else (docs/** JSON / SVG / HTML / TXT / JSONL, Markdown anywhere else, src, tests, tools,
// scripts, .github, config, lockfiles, ...) runs the full CI.
//
// Usage:
//   git diff --name-only --no-renames A B | node scripts/ci/classify-ci-docs-only.mjs
//   node scripts/ci/classify-ci-docs-only.mjs --self-test

import { readFileSync } from "node:fs";

const DOCS_IMAGE = /\.(png|jpe?g|webp|gif)$/i;

/** @returns {string | null} a skip reason when `path` is documentation-only for CI purposes, else null */
export function docsOnlyReason(path) {
  // Anything that is not a plain repo-relative path is never skippable.
  if (path.startsWith("/") || path.includes("\\") || path.split("/").some((s) => s === ".." || s === "." || s === "")) {
    return null;
  }
  if (path.startsWith("docs/")) {
    if (/\.md$/i.test(path)) return "docs/**/*.md";
    if (DOCS_IMAGE.test(path)) return "docs/** image";
    return null; // docs/** data (JSON etc.) can be imported by tests
  }
  if (!path.includes("/") && /\.md$/i.test(path)) return "root *.md";
  return null;
}

/**
 * @param {string[]} rawPaths
 * @returns {{ docsOnly: boolean, reason: string }}
 */
export function classify(rawPaths) {
  const paths = [...new Set(rawPaths.map((p) => p.trim()).filter(Boolean))];
  if (paths.length === 0) {
    return { docsOnly: false, reason: "fail-safe: no changed files could be determined" };
  }
  const risky = paths.filter((p) => docsOnlyReason(p) === null);
  if (risky.length > 0) {
    const shown = risky.slice(0, 5).join(", ");
    const more = risky.length > 5 ? ` (+${risky.length - 5} more)` : "";
    return {
      docsOnly: false,
      reason: `${risky.length} of ${paths.length} changed file(s) are not documentation-only: ${shown}${more}`,
    };
  }
  return {
    docsOnly: true,
    reason: `all ${paths.length} changed file(s) are documentation-only (docs/**/*.md, docs/** images, root *.md)`,
  };
}

// [changed files, expected docsOnly]
const SELF_TEST_CASES = [
  // docs-only: skip lint / Vitest / build
  [["docs/reports/TETO_X_Result.md"], true],
  [["docs/PROJECT_HANDOFF.md", "docs/decisions/TETO_X.md"], true],
  [["docs/reports/screenshots/task/before.png", "docs/reports/screenshots/task/after.jpg"], true],
  [["docs/reports/screenshots/task/a.webp", "docs/reports/screenshots/task/b.gif", "docs/x/c.jpeg"], true],
  [["docs/reports/screenshots/task/UPPER.PNG"], true],
  [["README.md", "CLAUDE.md"], true],
  [["docs/reports/x.md", "docs/reports/screenshots/t/a.png", "README.md"], true],
  // docs data that tests import or may read: full CI
  [["docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"], false],
  [["docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"], false],
  [["docs/reports/data/x.json"], false],
  [["docs/design/references/ingredient-icons-2.0/hot-dog.svg"], false],
  [["docs/reports/screenshots/t/hv/index.html"], false],
  [["docs/reports/notes.txt", "docs/reports/log.jsonl"], false],
  [["docs/reports/x.md", "docs/design/data/m.json"], false],
  // source, tests, tooling, config, workflows: full CI
  [["src/App.tsx"], false],
  [["src/logic/cut/regions.test.ts"], false],
  [["src/notes.md"], false],
  [["e2e/viewport-1screen.spec.ts"], false],
  [["tools/cut-preview-hv/verify.spec.ts"], false],
  [["tools/NOTES.md"], false],
  [["scripts/ci/README.md"], false],
  [["scripts/ci/classify-ci-docs-only.mjs"], false],
  [[".github/workflows/ci.yml"], false],
  [[".github/PULL_REQUEST_TEMPLATE.md"], false],
  [["public/icon-192.png"], false],
  [["data/recipes.json"], false],
  [["functions/src/index.ts"], false],
  [["package.json"], false],
  [["package-lock.json"], false],
  [["vite.config.ts"], false],
  [["vitest.config.ts"], false],
  [["tsconfig.app.json"], false],
  [["playwright.config.ts"], false],
  [["index.html"], false],
  [["firestore.rules"], false],
  [[".env.example"], false],
  [["docs/reports/x.md", "src/App.tsx"], false],
  // unknown / malformed / fail-safe: full CI
  [["some/new/dir/file.txt"], false],
  [["docs"], false],
  [["docs/"], false],
  [["docs.md.ts"], false],
  [["docs/x.md.ts"], false],
  [["docs/x.mdx"], false],
  [["docs/../src/App.tsx"], false],
  [["../docs/x.md"], false],
  [["/docs/x.md"], false],
  [["docs\\x.md"], false],
  [["docs//x.md"], false],
  [["./docs/x.md"], false],
  [["docs/./x.md"], false],
  [[], false],
  [["", "  "], false],
];

function selfTest() {
  let failed = 0;
  for (const [files, expected] of SELF_TEST_CASES) {
    const { docsOnly, reason } = classify(files);
    const ok = docsOnly === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} [${files.join(", ")}] -> ${docsOnly} (${reason})`);
  }
  console.log(`${SELF_TEST_CASES.length - failed}/${SELF_TEST_CASES.length} classifier cases passed`);
  return failed === 0;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest() ? 0 : 1);
  }
  const { docsOnly, reason } = classify(readFileSync(0, "utf8").split("\n"));
  // Reasons are single-line by construction; strip newlines anyway so GITHUB_OUTPUT stays valid.
  console.log(`docs_only=${docsOnly}`);
  console.log(`reason=${reason.replace(/[\r\n]+/g, " ")}`);
}
