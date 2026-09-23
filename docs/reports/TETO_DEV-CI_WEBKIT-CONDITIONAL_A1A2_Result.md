# Dev CI: Conditional WebKit + WebKit Gate — Issue #201 A1/A2 Result

- Issue: #201 (A0 Fresh Audit is in the Issue body)
- PR: #203, branch `claude/teto-pizza-ci-optimization-n46bif`, based on `main` @ `1e73a7d`
- Scope: CI workflows and CI scripts only. No gameplay, progression, economy, recipe, scoring or
  ranking changes. PR #202 / Issue #200 were not touched.
- Human Verification policy: not applicable. This change has no UI/UX/gameplay effect, so there is
  no video and no screenshots.

## 1. What changed

| File | Change |
|---|---|
| `.github/workflows/e2e-webkit.yml` | `classify` → `webkit` → `WebKit Gate`; PR-scoped concurrency; `permissions: contents: read` |
| `.github/workflows/ci.yml` | PR-scoped concurrency only (lint / Vitest / build steps unchanged) |
| `scripts/ci/classify-webkit.mjs` | Path classifier (allow-list) with a built-in `--self-test` case table |
| `scripts/ci/classify-webkit-pr.sh` | PR orchestration: PR diff, reuse of evidence from the previous head, fail-safe handling |
| `docs/PROJECT_HANDOFF.md` | Short "PR CI and the WebKit Gate" section |
| this report | — |

The WebKit test itself is unchanged: every `e2e/*.spec.ts`, projects `webkit-390x844` and
`webkit-360x800`, `timeout-minutes: 15`, the same browser cache, installation proof and report
artifact. No assertion was removed.

## 2. Job structure (required-check-safe)

```
pull_request (every PR to main, no paths: filter)
 ├─ classify ── webkit_required=true|false, reason
 ├─ webkit   ── if: !cancelled() && (classify.result != success || webkit_required != 'false')
 └─ WebKit Gate (if: always())
       required  & webkit=success           → PASS
       required  & webkit=failure/cancelled/skipped → FAIL
       !required & webkit=skipped           → PASS ("safely skipped")
       classify failed / output not true|false → treated as required (fail-safe)
```

- No top-level `paths:` filter anywhere, so the workflow always reports check runs and a required
  check can never stay at "Expected — waiting for status".
- `WebKit Gate` uses `always()` and not `!cancelled()`. If the gate itself were skipped, branch
  protection would read the skip as success. A cancelled WebKit run therefore gives a red gate
  and never a green one.
- The heavy job keeps its job id and check name `webkit`, so an existing requirement on `webkit`
  keeps working. Recommended: require **`WebKit Gate`** instead. `webkit` is intentionally
  skippable, and GitHub counts a job skipped by `if:` as passing.
- Branch protection / ruleset state is not visible through the tools available in this session.
  The repo owner should confirm which checks are required (Settings → Rules / Branches) and add
  `WebKit Gate` (and `build` from `CI`).

## 3. Classifier rules (A1)

Allow-list only. A path skips WebKit only if it matches one of these rules:

- `docs/**`
- `**/*.md` **outside** `src/`, `e2e/`, `public/`, `functions/` and `.github/` (Markdown inside a
  runtime tree could be imported, for example with `?raw`)

Everything else is `webkit_required=true`, including every path added in the future. Examples:
`src/**` (UI, state, storage, navigation, input and gesture code), `e2e/**`, `package*.json`,
`vite.config.ts`, `tsconfig*.json`, `playwright.config.ts`, `index.html`, `public/**`,
`.github/workflows/**`, `scripts/**` (including the classifier itself), `functions/**`, `data/**`,
`tools/**`.

Decision order (`classify-webkit-pr.sh`):

1. PR diff `merge-base(base, head)..head` (`--no-renames`, so both sides of a rename are counted;
   `core.quotePath=false`) is entirely documentation → **skip** (Case A).
2. On a `synchronize` push, WebKit is skipped and the earlier result reused only if all of these
   hold. This is the PR #199 `5700dee` → `aa0f74a` case.
   - the tree diff `before..head` is entirely documentation;
   - the `before` SHA has a successful `WebKit Gate` check run (github-actions app);
   - that gate's annotation records `tested_base=<sha>`, which must equal this run's
     `tested_base`. `tested_base` is the first parent of the two-parent PR merge ref
     (`github.sha`), i.e. the base-branch commit the merge result is built on.

   If `main` moved in between (or `main` was merged into the branch), the new merge result has
   never been WebKit-tested, so WebKit runs. This rule was added after the Codex P1 review on
   PR #203.
3. Otherwise → **run**.

Fail-safe paths (all resolve to `true`): self-test failure, missing SHAs, merge-base, diff or
fetch failure, empty file list, classifier output that is neither `true` nor `false`, and a
missing, failed, cancelled or unreadable previous gate. If the classify job itself fails, `webkit`
still runs, because its condition is `!cancelled()` and not the default `success()`.

The reason text is shown as a `::notice` annotation (PR Checks tab) and in the job summary, along
with the full changed-file list. The gate repeats the reason and its own verdict.

Fail-safe paths for reuse: a merge ref that is not the expected two-parent
`[base, head]` commit, or a missing or unparseable `tested_base` on either side, means the tested
base is unknown, so there is no reuse.

Remaining difference (Case A only): a PR whose **whole** diff is documentation is skipped
regardless of base movement. By construction such a PR changes nothing that the browser loads,
and every commit that moved `main` passed its own WebKit Gate.

## 4. Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

The group includes the workflow name and the PR number, and both workflows only trigger on
`pull_request`. `CI` and `E2E WebKit` therefore never cancel each other, and runs on other PRs
and on `main` (`deploy.yml` has its own `pages` group) are never cancelled. Motivating
observation: at 15:48 UTC on 2026-09-23, PR #202 had **7 WebKit runs in progress at once**
(#65–#71), one for each push, and all but the newest were wasted.

## 5. Verification

### 5.1 Focused (local)

- `node scripts/ci/classify-webkit.mjs --self-test` → **24/24**: Case A docs/README/CLAUDE.md,
  report PNGs under `docs/`; Case B `src/*.ts(x)`, `src/*.css`, `src/*.md`, docs+src mix; Case C
  `e2e/*.spec.ts`, `e2e/gestures.ts`; Case D workflows, Playwright/vite/tsconfig, `package*.json`,
  `index.html`, `public/`, `scripts/`; Case E unknown path, `docs` without a slash, `docs.md.ts`,
  empty, blank lines.
- `classify-webkit-pr.sh` on real history:
  - `5700dee..aa0f74a` (the PR #199 docs-only commit) → `false`
  - `5700dee~1..5700dee` (src + e2e) → `true`
  - reuse path (synthetic merge refs + stubbed `gh`): same tested base → `false`; base moved →
    `true`; previous gate without `tested_base` → `true`; previous gate `failure` → `true`;
    merge ref not `[base, head]` → `true`; no `MERGE_SHA` → `true`
  - runtime push after a successful runtime head → `true`
  - unfetchable `before` → `true`; bad base → `true`; no env → `true`
- Gate step extracted from the YAML: all 24 combinations of classify {success, failure} ×
  webkit_required {true, false, ''} × webkit {success, failure, cancelled, skipped} give the
  expected exit code.
- actionlint 1.7.7 (with shellcheck) clean on both workflows; shellcheck clean;
  `npm run lint` clean.

### 5.2 GitHub Actions (live, PR #203)

| # | Head | Change type | classify | webkit | WebKit Gate | Notes |
|---|---|---|---|---|---|---|
| 1 | `d4b90c1` | workflow + scripts (Case D) | `true` (11 s): "4 of 5 changed file(s) are not documentation-only: .github/workflows/ci.yml, …" | started, then **cancelled** at 16:02:24 by the next push | **failure** ("required but its result is 'cancelled'") | Live proof of concurrency cancellation, and that a cancelled WebKit run never turns the gate green |
| 2 | `8d5cc28` | scripts + workflow (Case D) | `true` (8 s) | **ran**, 7 m 52 s, `114 passed (7.1m)` on `[webkit-390x844]` + `[webkit-360x800]` | **success**, annotation `tested_base=1e73a7d…` | Codex P1 fix commit |
| 3 | `a4ac347` | docs-only report on top of #2 (reuse) | `false` (8 s) | **skipped** | **success** 16 s after the run was created | See §5.3 |

Fast CI (`build`: lint + Vitest + build) ran and passed on each head: 77 s on `d4b90c1` and
72 s on `8d5cc28`.

Case B (`src/**`) and Case C (`e2e/**`) were not pushed to this PR, because this PR must not
touch runtime code. Both go through the same code path as Case D (a non-documentation path gives
`true`). They are covered by the self-test run in every classify job (visible in the classify
log: `24/24 classifier cases passed`) and by the local runs against real history above
(`5700dee`: `src/logic/economySimulation.ts` + `e2e/…spec.ts` → `true`).

### 5.3 Docs-only reuse (live)

Run [#75](https://github.com/perusonao/teto-pizza-game/actions/runs/35887218647) on `a4ac347`,
which only added this report:

- classify notice: `webkit_required=false -- only documentation changed since 8d5cc28 (all 1
  changed file(s) are documentation-only (docs/**, **/*.md)), whose WebKit Gate already succeeded
  on the same base 1e73a7d -- reusing that WebKit evidence`
- `webkit`: **skipped** (conclusion `skipped`, 0 s)
- `WebKit Gate` notice: `PASS -- WebKit safely skipped (not required).
  tested_base=1e73a7d3e6007e67d1d2ea14e103a47c491bdbd5. only documentation changed since 8d5cc28 …`
- Timeline: run created 16:13:12, classify done 16:13:24, gate done ~16:13:28. The gate result
  was ready **~16 s** after the push, compared with 7 m 52 s for the WebKit run it reused. The
  check never sat at pending/"Expected".

The commit that added this section is also docs-only, so it exercises chained reuse:
`a4ac347`'s gate succeeded by reuse, so its successor reuses it in turn, still pinned to base
`1e73a7d`.

Not exercised live: a PR whose **whole** diff is docs-only (rule 1). A PR that changes the
workflow cannot also be docs-only. Rule 1 goes through the same classifier and the same gate
`skipped → PASS` path shown above, and it was verified locally against `aa0f74a`. The first
docs-only PR after merge will show it on GitHub.

## 6. Before / after

| Scenario | Before (unconditional WebKit) | After |
|---|---|---|
| Runtime / E2E / config PR head | WebKit ~6–16 min (A0: #59 6m05s … #64 16m30s) | Same WebKit job (this PR: 7m52s) + ~10 s classify + ~3 s gate |
| Docs-only follow-up commit (PR #199 `aa0f74a` pattern) | Full WebKit again: #64 took **16m30s** end-to-end (incl. queue) | WebKit skipped; the gate result arrives in ~15–25 s (§5.3) |
| Docs-only PR | Full WebKit ~6–16 min | WebKit skipped; the gate result arrives in ~15–25 s |
| Rapid successive pushes | Every push runs its own WebKit in parallel (PR #202: 7 runs in progress at once) | Older runs cancelled; only the newest head runs |

The time until merge is decided by the slower of `build` (~1–1.5 min) and `WebKit Gate`. For
docs-only changes that is now `build`, so Merge Gate wait goes from roughly 6–16 minutes to about
1.5 minutes.

## 7. Rollback

1. `git revert` the Issue #201 commits (or restore `.github/workflows/e2e-webkit.yml` and
   `ci.yml` from `1e73a7d`, then delete `scripts/ci/`). This restores the unconditional
   single-job WebKit workflow.
2. If `WebKit Gate` was added as a required check, replace it with `webkit` in the same change
   window. Otherwise every PR waits for a check that no longer exists.
3. To disable only the skip while keeping the gate: make `classify-webkit-pr.sh` call
   `emit true "skip disabled"` right after the self-test.
