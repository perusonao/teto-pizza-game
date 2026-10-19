// Static safety checks: the Owner Gate must stay read-only, dry-run and free of PR-controlled execution.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const strip = (s) => s.replace(/^\s*#.*$/gm, "");

test("owner-gate.yml: manual trigger only, read-only permissions, default-branch guard, no PR checkout", () => {
  const raw = read(".github/workflows/owner-gate.yml");
  const y = strip(raw);
  const triggers = y.match(/^on:\n([\s\S]*?)^\S/m)[1];
  assert.match(triggers, /workflow_dispatch:/);
  for (const bad of ["pull_request", "pull_request_target", "workflow_run", "issue_comment", "pull_request_review", "schedule", "push:"]) assert.ok(!triggers.includes(bad), `trigger ${bad}`);
  assert.ok(!/:\s*write\b/.test(y), "no write permission anywhere");
  assert.match(y, /^permissions: \{\}/m);
  assert.match(y, /github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/);
  assert.ok(!/ref:\s*\$\{\{/.test(y), "checkout never takes a ref from an expression");
  assert.ok(!/github\.event\.pull_request|head\.sha|head\.ref/.test(y), "no PR-controlled values");
  // inputs reach the shell only through env, never interpolated into the script text
  const runBlocks = [...y.matchAll(/run: \|\n((?:\s{10}.*\n?)+)/g)].map((m) => m[1]).join("\n");
  assert.ok(!/\$\{\{/.test(runBlocks), "no expression interpolation inside run scripts");
  for (const bad of ["gh ", "curl", "rerun", "merge", "deploy", "gh api", "pull-requests: write", "issues: write", "contents: write"]) assert.ok(!y.includes(bad), `workflow mentions ${bad}`);
});

test("ops-tests.yml: pull_request with read-only token and no secrets", () => {
  const y = strip(read(".github/workflows/ops-tests.yml"));
  assert.ok(!/:\s*write\b/.test(y));
  assert.ok(!/secrets\./.test(y));
  assert.ok(!/pull_request_target/.test(y));
  assert.match(y, /contents: read/);
});

test("no existing quality workflow was touched by Phase 1A", () => {
  // The five workflows named in the audit keep their identity: the required-check producers still exist.
  for (const f of ["ci.yml", "e2e-webkit.yml", "deploy.yml", "firebase-production-deploy.yml"]) assert.ok(fs.existsSync(path.join(root, ".github/workflows", f)), f);
  const web = read(".github/workflows/e2e-webkit.yml");
  assert.match(web, /shard: \[1, 2, 3\]/);
  assert.match(web, /project: \[webkit-390x844, webkit-360x800\]/);
  assert.match(web, /retries|--reporter=list,html,json/);
});

test("ops sources: GitHub access is GET plus a GraphQL query only; nothing executes fetched text", () => {
  const files = fs.readdirSync(here).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs")).map((f) => path.join(here, f));
  files.push(...fs.readdirSync(path.join(here, "lib")).map((f) => path.join(here, "lib", f)));
  assert.ok(files.length >= 7);
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");
    const rel = path.relative(root, f);
    assert.ok(!/\b(PUT|PATCH|DELETE)\b/.test(t), `${rel}: write verb`);
    assert.ok(!/child_process|execSync|spawn|\beval\(|new Function|import\(\s*[^"'`]/.test(t), `${rel}: executes code`);
    const methods = [...t.matchAll(/method:\s*"(\w+)"/g)].map((m) => m[1]);
    for (const m of methods) assert.equal(m, "POST", `${rel}: only the GraphQL POST`);
    if (methods.length) assert.ok(/collect-facts\.mjs$/.test(rel), "POST appears only in the GraphQL client");
    assert.ok(!/issues\/\$\{[^}]+\}\/comments["'`]\s*,\s*\{/.test(t), `${rel}: no comment write`);
  }
});

test("repo-wide Preview gate: no ops file mentions a preview build variable", () => {
  for (const f of [".github/workflows/owner-gate.yml", ".github/workflows/ops-tests.yml"]) assert.ok(!/VITE_PREVIEW|LC_HAND|VITE_LC_/.test(read(f)), f);
});
