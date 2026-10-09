#!/usr/bin/env bash
# CI optimization Phase 1: hermetic tests for the docs-only CI classification (no network, no
# browser; runs in ci.yml's checkout and locally).
#
#   1. classify-ci-docs-only.mjs --self-test      (path allow-list)
#   2. repository contract: every docs/ path the repo imports or reads at test / build time is NOT
#      classified documentation-only (so lint / Vitest / build would still run if it changed), and no
#      Markdown is imported as source
#   3. classify-ci-docs-only.sh in throwaway git repos shaped like GitHub's PR merge ref (docs-only,
#      runtime, docs data, workflow, base moved, non-PR events, unexpected shapes, no node -> fail-safe)
#   4. .github/workflows/ci.yml invariants: the required `build` job always runs and reports (no
#      paths filter, no job-level if), every heavy step is gated on the classifier, nothing is lost
#
# Usage: bash scripts/ci/test-ci-docs-only.sh   (exit 0 = all passed)
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
cases=0

check() { # name, expected, actual
  cases=$((cases + 1))
  if [ "$2" = "$3" ]; then
    echo "PASS $1"
  else
    echo "FAIL $1 (expected '$2', got '$3')"
    failures=$((failures + 1))
  fi
}

echo "== 1. path classifier self-test"
node "$here/classify-ci-docs-only.mjs" --self-test > "$work/cls.txt" 2>&1
check "classify-ci-docs-only.mjs --self-test" 0 $?
tail -n 1 "$work/cls.txt"

echo "== 2. repository contract: docs/ files that tests or the build consume are never 'docs-only'"
cat > "$work/contract.mjs" <<'EOF'
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { classify } from "./classify-ci-docs-only.mjs";

const root = process.argv[2];
const roots = ["src", "tools", "scripts", "e2e"];
const skipDirs = new Set(["node_modules", "dist", ".git", "test-results", "playwright-report"]);
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|mjs|js|cjs)$/.test(name)) files.push(full);
  }
};
for (const r of roots) walk(join(root, r));
for (const f of ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]) files.push(join(root, f));

const SPEC = /(?:from|import\(|require\()\s*["'`]([^"'`]+)["'`]/g;
const READ_LINE = /(readFileSync|readFile|readdirSync|existsSync|statSync|resolve\(|join\(|import\.meta\.glob)/;
const STRING = /["'`]([^"'`]*docs\/[^"'`]*)["'`]/g;
const refs = []; // { file, path }
const markdownImports = [];

for (const file of files) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  for (const m of text.matchAll(SPEC)) {
    const spec = m[1].split("?")[0];
    if (/\.md$/i.test(spec)) markdownImports.push({ file: relative(root, file), spec: m[1] });
    if (!spec.startsWith(".")) continue;
    const abs = resolve(dirname(file), spec);
    const rel = relative(root, abs).split("\\").join("/");
    if (rel.startsWith("docs/")) refs.push({ file: relative(root, file), path: rel });
  }
  for (const line of text.split("\n")) {
    const code = line.replace(/\/\/.*$/, "");
    if (/^\s*(\*|\/\*)/.test(line) || !READ_LINE.test(code)) continue;
    for (const m of code.matchAll(STRING)) {
      const rel = m[1].replace(/^\.\//, "");
      if (rel.startsWith("docs/")) refs.push({ file: relative(root, file), path: rel });
    }
  }
}

let bad = 0;
for (const { file, path } of refs) {
  const { docsOnly } = classify([path]);
  if (docsOnly) { bad++; console.log(`BAD  ${file} reads ${path}, but the classifier calls it documentation-only`); }
}
for (const { file, spec } of markdownImports) { bad++; console.log(`BAD  ${file} imports Markdown as source (${spec}); *.md would no longer be safe to skip`); }
const unique = new Set(refs.map((r) => r.path));
console.log(`${unique.size} distinct docs/ path(s) read or imported by repo code; ${markdownImports.length} Markdown import(s); ${bad} problem(s)`);
// A canary: the two data files Vitest imports today must be found by this scan, or the scan is blind.
const canary = ["docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json", "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"];
for (const c of canary) if (!unique.has(c)) { bad++; console.log(`BAD  scan did not find the known import of ${c}`); }
process.exit(bad === 0 ? 0 : 1);
EOF
cp "$here/classify-ci-docs-only.mjs" "$work/classify-ci-docs-only.mjs"
node "$work/contract.mjs" "$root" > "$work/contract.out" 2>&1
check "docs/ files consumed by code are never classified documentation-only" 0 $?
tail -n 3 "$work/contract.out"

echo "== 3. classify-ci-docs-only.sh decisions (throwaway repos shaped like the PR merge ref)"
repo="$work/repo"
git init -q "$repo"
g() { git -C "$repo" -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false "$@"; }
mkdir -p "$repo/src" "$repo/docs/reports/screenshots" "$repo/docs/design/data" "$repo/.github/workflows"
echo "x" > "$repo/src/a.ts"; echo "r" > "$repo/README.md"; echo "d" > "$repo/docs/old.md"
echo '{"a":1}' > "$repo/docs/design/data/m.json"; echo "ci" > "$repo/.github/workflows/ci.yml"
g add -A; g commit -q -m base; g branch -M main
base="$(g rev-parse HEAD)"

# make_merge NAME FILE... : a PR branch from $base touching the given files (path=content pairs
# `path::content`), merged into $base with --no-ff, like GitHub's refs/pull/N/merge. Prints the PR head;
# leaves $repo checked out on the merge commit (detached).
make_merge() {
  local name="$1" pair path content head
  shift
  g checkout -q -B "pr-$name" "$base"
  for pair in "$@"; do
    path="${pair%%::*}"; content="${pair#*::}"
    mkdir -p "$repo/$(dirname "$path")"
    if [ "$content" = "__delete__" ]; then g rm -q "$path"; else printf '%s\n' "$content" > "$repo/$path"; g add "$path"; fi
  done
  g commit -q -m "pr $name"
  head="$(g rev-parse HEAD)"
  g checkout -q --detach "$base"
  g merge -q --no-ff -m "merge $name" "pr-$name" > /dev/null 2>&1
  echo "$head"
}

run_driver() { # KEY=VALUE... ; prints docs_only
  local out="$work/gh_output"
  : > "$out"
  (cd "$repo" && env -u GITHUB_STEP_SUMMARY GITHUB_OUTPUT="$out" "$@" bash "$here/classify-ci-docs-only.sh" > /dev/null 2>&1)
  sed -n 's/^docs_only=//p' "$out"
}
pr() { # NAME FILE... ; prints docs_only for a pull_request run on that merge commit
  local head
  head="$(make_merge "$@")"
  run_driver EVENT_NAME=pull_request HEAD_SHA="$head" BASE_SHA="$base"
}

check "pr: Markdown under docs -> docs-only" true "$(pr md "docs/reports/R.md::report")"
check "pr: Markdown edit of an existing doc -> docs-only" true "$(pr mdedit "docs/old.md::changed")"
check "pr: docs Markdown deleted -> docs-only" true "$(pr mddel "docs/old.md::__delete__")"
check "pr: docs screenshot -> docs-only" true "$(pr png "docs/reports/screenshots/a.png::png")"
check "pr: root README -> docs-only" true "$(pr readme "README.md::new readme")"
check "pr: docs Markdown + screenshot + README -> docs-only" true \
  "$(pr combo "docs/reports/R.md::r" "docs/reports/screenshots/b.png::p" "README.md::r2")"
check "pr: source file -> full CI" false "$(pr src "src/a.ts::y")"
check "pr: docs Markdown + source file -> full CI" false "$(pr mixed "docs/reports/R.md::r" "src/a.ts::z")"
check "pr: docs JSON that tests import -> full CI" false "$(pr json "docs/design/data/m.json::{\"a\":2}")"
check "pr: new docs JSON -> full CI" false "$(pr newjson "docs/reports/data/n.json::{}")"
check "pr: docs SVG -> full CI" false "$(pr svg "docs/reports/f.svg::<svg/>")"
check "pr: workflow change -> full CI" false "$(pr wf ".github/workflows/ci.yml::changed")"
check "pr: new CI script -> full CI" false "$(pr script "scripts/ci/new.sh::echo")"
check "pr: package.json -> full CI" false "$(pr pkg "package.json::{}")"
check "pr: Markdown outside docs/root -> full CI" false "$(pr srcmd "src/NOTES.md::n")"

# The base branch moved on after the PR branched: only what the PR itself adds is classified.
g checkout -q -B pr-moved "$base"
mkdir -p "$repo/docs"; echo "m" > "$repo/docs/moved.md"; g add -A; g commit -q -m "pr moved"; moved_head="$(g rev-parse HEAD)"
g checkout -q --detach "$base"; g checkout -q -B main-moved "$base"
echo "base moved" > "$repo/src/a.ts"; g add -A; g commit -q -m "main moves on (source change)"; moved_base="$(g rev-parse HEAD)"
g merge -q --no-ff -m "merge moved" pr-moved > /dev/null 2>&1
check "pr: docs-only PR, base moved with a source change -> docs-only (only the PR's own diff counts)" true \
  "$(run_driver EVENT_NAME=pull_request HEAD_SHA="$moved_head" BASE_SHA="$moved_base")"
g checkout -q --detach "$base"; g checkout -q -B pr-moved2 "$base"
echo "s" > "$repo/src/b.ts"; g add -A; g commit -q -m "pr moved2 (source)"; moved2_head="$(g rev-parse HEAD)"
g checkout -q --detach "$moved_base"; g merge -q --no-ff -m "merge moved2" pr-moved2 > /dev/null 2>&1
check "pr: source PR, base moved -> full CI" false \
  "$(run_driver EVENT_NAME=pull_request HEAD_SHA="$moved2_head" BASE_SHA="$moved_base")"

# Non-PR events and unexpected shapes always resolve to full CI (never a skip).
head="$(make_merge evt "docs/reports/E.md::e")"
check "push event on a docs-only merge -> full CI" false "$(run_driver EVENT_NAME=push HEAD_SHA="$head" BASE_SHA="$base")"
check "workflow_dispatch -> full CI" false "$(run_driver EVENT_NAME=workflow_dispatch HEAD_SHA="$head" BASE_SHA="$base")"
check "pull_request without HEAD_SHA/BASE_SHA on a merge commit -> full CI" false "$(run_driver EVENT_NAME=pull_request)"
check "pull_request, HEAD_SHA is not the merge's second parent, no BASE_SHA -> full CI" false \
  "$(run_driver EVENT_NAME=pull_request HEAD_SHA=deadbeef)"
check "pull_request, HEAD_SHA is not the merge's second parent, bogus SHAs -> full CI" false \
  "$(run_driver EVENT_NAME=pull_request HEAD_SHA=deadbeef BASE_SHA=cafebabe)"
# HEAD is a plain commit (not a merge ref): the merge-base fallback decides, or fail-safe.
g checkout -q --detach "pr-evt"
check "non-merge HEAD, docs-only PR, SHAs given -> docs-only (merge-base fallback)" true \
  "$(run_driver EVENT_NAME=pull_request HEAD_SHA="$head" BASE_SHA="$base")"
check "non-merge HEAD, SHAs missing -> full CI" false "$(run_driver EVENT_NAME=pull_request)"
check "no changed files (BASE == HEAD) -> full CI" false "$(run_driver EVENT_NAME=pull_request HEAD_SHA="$base" BASE_SHA="$base")"
g checkout -q --detach "$base"
check "docs_only output is exactly true|false even on the failure paths" 0 \
  "$( : > "$work/o"; (cd "$repo" && GITHUB_OUTPUT="$work/o" EVENT_NAME=push bash "$here/classify-ci-docs-only.sh" >/dev/null 2>&1); grep -cvE '^(docs_only=(true|false)|reason=.*)$' "$work/o")"

# No node on PATH: the driver must still answer (full CI), not crash or print nothing.
mkdir -p "$work/nonode"
for tool in git dirname sed; do ln -sf "$(command -v "$tool")" "$work/nonode/$tool"; done
head="$(make_merge nonode "docs/reports/N.md::n")"
: > "$work/o"
(cd "$repo" && env -u GITHUB_STEP_SUMMARY PATH="$work/nonode" GITHUB_OUTPUT="$work/o" EVENT_NAME=pull_request HEAD_SHA="$head" BASE_SHA="$base" \
  "$(command -v bash)" "$here/classify-ci-docs-only.sh" > /dev/null 2>&1)
check "no node available -> full CI (fail-safe, still writes the output)" false "$(sed -n 's/^docs_only=//p' "$work/o")"

echo "== 4. ci.yml invariants (the required check always runs and reports; nothing heavy is un-gated)"
cat > "$work/workflow.mjs" <<'EOF'
import { readFileSync } from "node:fs";
const text = readFileSync(process.argv[2], "utf8");
const problems = [];
const code = text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

if (/^\s*paths(-ignore)?\s*:/m.test(code)) problems.push("a `paths` / `paths-ignore` filter would leave the required check Expected on a skipped run");
if (/^\s*branches-ignore\s*:/m.test(code)) problems.push("`branches-ignore` is not expected here");
if (!/^on:\s*\n\s+pull_request:/m.test(code)) problems.push("ci.yml must still trigger on pull_request");

const jobBlock = code.split(/^jobs:\s*$/m)[1] ?? "";
const buildMatch = jobBlock.match(/^  build:\s*\n((?:    .*\n?|\s*\n)+)/m);
if (!buildMatch) problems.push("the required `build` job is missing");
const build = buildMatch ? buildMatch[1] : "";
const beforeSteps = build.split(/^    steps:\s*$/m)[0];
if (/^    if\s*:/m.test(beforeSteps)) problems.push("the `build` job has a job-level `if`; a skipped job would not report a conclusion");
if (/^    needs\s*:/m.test(beforeSteps)) problems.push("the `build` job must not depend on another job (a skipped dependency skips it)");

const stepsText = build.split(/^    steps:\s*$/m)[1] ?? "";
const steps = stepsText.split(/^      - /m).slice(1).map((s) => "      - " + s);
const GATE = "steps.classify.outputs.docs_only != 'true'";
const idx = steps.findIndex((s) => /^\s+id:\s*classify\s*$/m.test(s));
if (idx < 0) problems.push("no step with `id: classify`");
else {
  const classify = steps[idx];
  if (!/^\s+continue-on-error:\s*true\s*$/m.test(classify)) problems.push("the classify step must be `continue-on-error: true` (a crash must mean full CI, not a failed or skipped job)");
  if (/^\s+if\s*:/m.test(classify)) problems.push("the classify step must always run");
  if (!/classify-ci-docs-only\.sh/.test(classify)) problems.push("the classify step must run scripts/ci/classify-ci-docs-only.sh");
  for (const s of steps.slice(0, idx)) if (/^\s+if\s*:/m.test(s)) problems.push("a step before the classifier is conditional: " + s.split("\n")[0]);
  for (const s of steps.slice(idx + 1)) {
    const name = s.split("\n")[0];
    const cond = s.match(/^\s+if:\s*(.*)$/m);
    if (!cond) problems.push("a step after the classifier has no gate: " + name);
    else if (!cond[1].includes(GATE)) problems.push("a step after the classifier is not gated on the classifier output: " + name);
    else if (/!cancelled\(\)|always\(\)/.test(cond[1])) problems.push("a gated step must keep the implicit success() (no always()/!cancelled()): " + name);
  }
  const runs = steps.slice(idx + 1).map((s) => (s.match(/^\s+run:\s*(.*)$/m) ?? [])[1]).filter(Boolean);
  for (const cmd of ["npm ci", "bash scripts/ci/test-webkit-ci.sh", "bash scripts/ci/test-ci-docs-only.sh", "npm run lint", "npm test", "npm run build"]) {
    if (!runs.includes(cmd)) problems.push("the full CI no longer runs `" + cmd + "`");
  }
  const order = ["npm ci", "npm run lint", "npm test", "npm run build"].map((c) => runs.indexOf(c));
  if (order.some((v, i) => i > 0 && v < order[i - 1])) problems.push("npm ci / lint / test / build are out of order");
}
const depth = text.match(/fetch-depth:\s*(\d+)/);
if (!depth || Number(depth[1]) < 2) problems.push("checkout needs fetch-depth >= 2 (merge commit + parents) for the classifier");

for (const p of problems) console.log("PROBLEM " + p);
console.log(problems.length === 0 ? "ci.yml invariants hold" : problems.length + " problem(s)");
process.exit(problems.length === 0 ? 0 : 1);
EOF
node "$work/workflow.mjs" "$root/.github/workflows/ci.yml" > "$work/wf.out" 2>&1
check "ci.yml invariants hold" 0 $?
tail -n 3 "$work/wf.out"

# The checker must actually catch the regressions it exists for: mutate a copy of ci.yml and expect a failure.
mutate() { # name sed-expression
  sed -E "$2" "$root/.github/workflows/ci.yml" > "$work/ci.mut.yml"
  if cmp -s "$work/ci.mut.yml" "$root/.github/workflows/ci.yml"; then
    check "mutation '$1' changed the file (test is not vacuous)" changed unchanged
    return
  fi
  node "$work/workflow.mjs" "$work/ci.mut.yml" > /dev/null 2>&1
  check "ci.yml checker rejects: $1" 1 $?
}
mutate "a paths-ignore filter on the trigger" 's/^    branches: \[main\]/    branches: [main]\n    paths-ignore: ["docs\/**"]/'
mutate "a job-level if on build" 's/^  build:/  build:\n    if: ${{ github.actor != '"'"'x'"'"' }}/'
mutate "an ungated lint step" '/name: Lint/{n;d}'
mutate "an always() gate" "s/\\\$\\{\\{ steps\\.classify\\.outputs\\.docs_only != 'true' \\}\\}/\${{ always() \\&\\& steps.classify.outputs.docs_only != 'true' }}/"
mutate "classifier not continue-on-error" '/continue-on-error: true/d'
mutate "the build step removed" '/run: npm run build/d'
mutate "shallow checkout" 's/fetch-depth: 2/fetch-depth: 1/'

echo
echo "$((cases - failures))/$cases CI docs-only checks passed"
[ "$failures" -eq 0 ]
