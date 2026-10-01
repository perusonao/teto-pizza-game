# TETO CI / WebKit Efficiency — Fresh Audit

- Audit only. No production code, workflow, or script was changed. No PR, no merge. No WebKit was run locally.
- Authority: fresh `git fetch` of `origin/main` = `ce2c07b9001ea6d7d65d54342252678940b1a328` (matches expected; = merge of #334).
- Evidence: `.github/workflows/{ci,e2e-webkit,deploy}.yml`, `scripts/ci/*`, `playwright.config.ts`, `e2e/`, plus GitHub Actions job/step timings of runs 36908782326, 36910255969 (PR #334), 36912167144 (post-merge push of #334), 36897376551 (post-merge push of #333).
- Out of scope / untouched: Near/Far, R6, N2, IP-2.

## 1. Current CI structure

| Workflow / job | Triggers | What it does | Observed time |
|---|---|---|---|
| `ci.yml` `build` | every PR to main (no path filter, no push) | `npm ci` → WebKit-CI script tests → `oxlint` → `vitest run` (all) → `tsc -b && vite build` | not sampled here (runs in parallel with the E2E workflow) |
| `e2e-webkit.yml` `classify` | PR / push main / dispatch | `scripts/ci/classify-webkit-pr.sh` + `classify-webkit.mjs` | 11–24 s |
| `layout-chromium` | same `if` as `webkit` (`webkit_required != false` or classify failed) | `npm ci`, Chromium install, `layout-contract.spec.ts` on 7 profiles | 2m50s–4m (run: 76 s) |
| `webkit` ×4 (390×844 / 360×800 × shard 1/2, 2) | same `if` | `npm ci`, WebKit `install --with-deps`, full `e2e/` (57 listed tests per project) | 7m–9m40s per shard (install 1–3 min, tests 4.5–6 min) |
| `Layout Contract Gate` | always | evidence verify of layout-chromium | ~10 s |
| `WebKit Gate` | always | evidence verify of 4 shards (every listed test ran once and passed) | ~10 s |
| `deploy.yml` | push main | second `npm ci && npm run build` + Pages | n/a |

The classifier has **exactly one skip class**: docs-only (`docs/**`, `*.md` outside `src/ e2e/ public/ functions/ .github/`). Everything else — including every unknown path — is `webkit_required=true` and runs the same *Full* matrix: layout-chromium + 4 WebKit shards. There is no "level" in practice (`level` is `full|none` only; the gate comment mentions a Phase 2B that does not exist).

Additional skip: a docs-only push on top of an already-green head on the same base reuses the previous WebKit Gate (≈25 s).

## 2. Answers to the ten questions

### 1. What starts each job
- `build`: every PR, unconditionally. Not on push to main.
- `classify`, `WebKit Gate`, `Layout Contract Gate`: always.
- `layout-chromium`, `webkit` ×4: everything except docs-only / reuse-skip. Forced on for push-to-main, `workflow_dispatch`, label `webkit-full`, classifier failure.

### 2. Current classification of change kinds
| Kind | Today |
|---|---|
| docs-only | skip E2E (only class that skips). `build` still runs fully (`ci.yml` has no filter) |
| pure logic (`src/logic/**`, tests) | **Full** (layout + 4 WebKit) |
| DEV-only tool (`src/dev/**`) | **Full** |
| CSS / production UI | **Full** (same as everything else) |
| storage / persistence | **Full** |
| cooking interaction | **Full** |
| unit-test-only change | **Full** (any `src/` path) |
| `e2e/` change, workflow, deps, config | **Full** (correct) |

So today the classifier is binary: docs vs. everything.

### 3. Why #334 (DEV-only) needed all shards
Changed non-doc files: `src/dev/*` (6 files), `src/main.tsx`, `src/logic/discoveryLadder.test.ts` (+4 lines), `src/preview/previewIsolation.gate.test.ts`. The classifier does not read content; any `src/` path is "not documentation-only". Note `src/main.tsx` is the production entry point, so even a smarter classifier must treat this as "production bundle isolation" — which is already covered by `previewIsolation.gate.test.ts` (an in-memory production `vite build` scan) and `src/dev/mainStartup.test.tsx` in vitest. Nothing in #334 can change layout, WebKit font metrics, storage format, or gestures, yet it cost, on the PR run alone, ~46 runner-minutes (5 E2E jobs ≈ 8 min each + gates) on top of `build`, and the post-merge push repeated it (see 4).

### 4. Duplicated verification
1. **Post-merge Full run repeats the PR's Full run** on the same tree. For #334: PR run 36910255969 (success, 11m46s) and push run 36912167144 (success, 11m08s) ~4 min later. The push run is meant as a backstop, but its input is the PR merge ref that was just tested, unless `main` moved. For a sequential single-author flow this is nearly pure duplicate. Its stated second job (writing the `main`-scoped Playwright cache) is needed only when the cache key changes.
2. **Superseded commits are fully run**: #334 run 36908782326 (commit `4b79852`) spent ~13 min and was cancelled by the next push (`53fe37a`). `cancel-in-progress` works, but the cancelled runs still burned all 5 jobs for 13 min because the WebKit jobs were stuck in install.
3. **Layout Contract runs twice per engine set**: `layout-chromium` (7 profiles) *and* inside each WebKit shard (N/S profiles, 12 tests in the spec). Intentional (OD-V-1/6) but it means a pure layout PR pays Chromium + WebKit regardless.
4. **`npm ci` ×7 per run** (build + layout + 4 WebKit + …) each ~20–26 s; Playwright browser caches exist but WebKit still runs `apt` via `--with-deps` every time (not cacheable).
5. **Two production builds per merge**: `ci.yml` build (PR) and `deploy.yml` build (push) plus a third in-memory build inside `previewIsolation.gate.test.ts` (twice: production and preview). The vitest gate duplicates `npm run build` work, by design.
6. **Local/CI duplication**: CLAUDE.md / policy require "focused/full tests → typecheck/lint/build" locally before PR, then `ci.yml` re-runs full `lint + test + build`. Reasonable as a safety net, but combined with PR-cancel-on-push, each push re-runs the full vitest. Not wasteful per se; it is the cheapest job class (no browser).
7. `iphone-*` Chromium projects exist but are local/manual only. Authors run Chromium locally, then CI runs WebKit — not a duplicate, but CI has **no Chromium non-layout E2E tier**, which is why the only "heavier than unit" CI option today is WebKit ×4.

### 5. Candidate causes of WebKit install stalls (measured)
Step "Install WebKit (with system deps)" durations (`npx playwright install --with-deps webkit`):

| Run | Job | Install | Outcome |
|---|---|---|---|
| 36910255969 (#334 final) | 4 shards | 29 s, 77 s, 184 s, 185 s | ok |
| 36908782326 (#334 first) | 360 s1 | **cancelled at 12m10s** | superseded by next push |
|  | 360 s2 | **cancelled at 12m08s** | " |
|  | 390 s1 / s2 | 87 s / 208 s | ok |
| 36897376551 (#333 push), attempt 1 | 360 s1 | **cancelled at 14m36s** | job `timeout-minutes: 15` |
|  | 390 s2 | **cancelled at 14m31s** | " |
|  | 390 s1 / 360 s2 | 76 s / 57 s | ok |
| attempt 2 (re-run of failed) | 390 s2 | **cancelled at 14m33s** | stalled again |
|  | 360 s1 | 86 s | ok |
| attempt 3 | 390 s2 | 156 s | ok |

Normal install: 30–210 s. A stall is 12–15 min with no output until the 15 min job timeout kills it (step shows `cancelled`, not `failure`). One stuck download/apt step on any of 4 parallel runners is enough; with 4 shards the probability that *at least one* stalls per run is roughly 4× the per-job rate. Run 36897376551 took **1h 1m wall-clock** (created 17:10, finished 18:11) with 3 attempts, and `PR #333`'s own post-merge verification waited on this.
Earlier record: P3-3a push (run 36728419810) had the same 10m19 s install stall.

Candidate causes (hypotheses — logs not inspected, install output not retained):
- `apt-get` mirror / Azure archive contention during `--with-deps` (a full apt update + installing ~60 libs for WebKit: gstreamer, libgles, etc.).
- CDN download of the WebKit tarball (~90–100 MB) hanging without a read timeout (Playwright's downloader has a connection timeout but an idle stall may wait long).
- `needrestart`/dpkg lock contention on freshly provisioned runners.
- Concurrency of 4 simultaneous `apt` installs from the same IP range (Phase 2A report already noted 36–70 s per shard on cold cache).

The Playwright browser cache (`~/.cache/ms-playwright`) is declared, but in the sampled runs the install step still took 30–200 s, and `--with-deps` always runs apt, so caching the binary does not remove the exposure.

### 6. Can install failure and test failure be separated on the Gate?
Today: no. `webkit-gate.sh` sees only `needs.webkit.result` (success/failure/cancelled/skipped) plus evidence. A stall → job timeout → `cancelled` → "FAIL — … result is 'cancelled'" — indistinguishable from a cancelled-by-new-push shard or from a failed assertion, except by reading the job. The evidence step runs with `if: always()` and records "missing results file" as an error, so the data exists but the Gate's verdict text does not classify it.

Feasible: yes, cheaply.
- Give the install step its own `id` and `timeout-minutes` and write an `install_status=ok|failed|timeout` into the shard evidence (the evidence collector already runs `always()`).
- Gate verdict becomes `FAIL-INFRA (webkit install)` vs `FAIL-TEST (n tests)`, and the hermetic truth-table in `test-webkit-ci.sh` can cover it.
- Keep both red (fail-closed); only the label, retry policy and the human reading change. Never convert an infra failure into a pass.

### 7. Shorter timeout + automatic retry?
Yes, and it is the highest-value change.
- Install normally ≤ ~3.5 min. A step `timeout-minutes: 6` (or a `timeout 300 …` wrapper) turns a 14.5 min stall into ≤ 6 min detection.
- In-job retry of *only* the install step (e.g. `nick-fields/retry`-style loop in bash: attempt 1 `timeout 300`, then 2 attempts; or a plain bash loop — no new third-party action needed) recovers without a new job, ~−9 min per stalled shard vs today and no manual "Re-run failed jobs" (+8 min and more exposure).
- Test steps must **not** auto-retry (Playwright `retries: 0` is a deliberate part of the evidence contract: `flaky` fails the verifier). Retry applies to install/network steps only; this keeps "a failing test is never an infra flake".
- Re-run semantics already work (evidence verifier keeps highest attempt per shard), so retry-in-step needs no verifier change.

### 8. Shortening install via dependency / cache / container
Ranked by expected value vs risk:
1. **Cache the apt packages / split `--with-deps`.** Run `npx playwright install-deps webkit` and `npx playwright install webkit` separately so each is timed/retried separately; cache `~/.cache/ms-playwright` (already) and optionally `actions/cache` the downloaded `.deb`s (`/var/cache/apt/archives`) — fragile, medium win.
2. **Playwright container image** (`mcr.microsoft.com/playwright:v<ver>-noble` pinned to the `package-lock` version): browsers + system deps preinstalled → install step ≈ 0 s and removes the apt/CDN exposure entirely. Cost: container pull (~1.5 GB, but cached on the GitHub-hosted fabric, typically 20–40 s), version pinning must track `@playwright/test` (a lockstep check can reuse the existing `hashFiles('package-lock.json')`). Highest win, moderate change; needs a trial run to confirm `HOME`/cache paths and the dev-server `webServer` still work.
3. **Fewer install sites**: with 2 shards per viewport, 4 installs. Collapsing viewport projects into 2 jobs (see 9) halves exposure.
4. **Pre-warm on main only**: the push run already writes the cache; PRs restore it. Confirm the cache hit rate (step "Cache Playwright browsers" is 1–2 s in sampled runs which suggests it either hits and is tiny or misses; the install still ran 30–200 s). Needs a log check (not done: log retrieval out of scope).

### 9. Are 390×844 and 360×800, ×2 shards, always required?
Not by the evidence. Current: each project runs the *entire* `e2e/` suite (57 tests listed per project) so both viewports × all specs run for any change. Viewport-width-specific risk is concentrated in `layout-contract.spec.ts`, `viewport-1screen.spec.ts`, `stage-size-stability.spec.ts`, `making-ui-1screen.spec.ts`, `result-1screen-2.0.spec.ts` (+ layout-invariants). The remaining ~30 specs (discovery-hint, dex, dinner, inventory/pantry navigation, etc.) are functional flows run at two widths with the same assertions.
Proposal tiers (not implemented):
- Functional-only / storage / interaction: **WebKit 390×844 only** (1 project, 2 shards → or even 1 runner if time acceptable) plus Chromium unit.
- Layout / CSS / viewport: both widths for the layout specs only, not the entire suite.
- Keep **Full ×2 widths** for: push-to-main (optionally nightly), `webkit-full` label, shared CSS/App.css primitives, `playwright.config.ts`, e2e infrastructure, workflow/deps.
Caveat: the evidence verifier currently requires both projects (`REQUIRED_PROJECTS`) and "both viewports list the same tests". A tiered selection needs the contract to be parameterised (required projects + required spec set per level); the `level` field in `webkit-gate.sh` already anticipates this.

### 10. Risk-based classifier — feasible?
Yes. The current design is an allow-list of skippable paths; it can be extended the same way — add *more allow-lists with evidence*, always falling through to Full for unknown/mixed paths (preserving fail-safe). Sketch below. The hard part is not routing, it is that a route must name **which gate set is required** and the Gate must enforce exactly that set (today the Gate hard-codes "4 shards").

## 3. Proposed classifier (hypothesis refined by the above)

| Class | Match (all changed files must fit; otherwise escalate to the max class) | Required |
|---|---|---|
| docs-only | `docs/**`, `**/*.md` outside runtime trees | `ci.yml` build only → ideally **skip even build** (a `paths-ignore`-free approach: classify job + gate) ; no E2E |
| unit-test-only / pure logic | `src/logic/**`, `src/state/*` **excluding persistence/storage**, `*.test.ts(x)`, no CSS/TSX component | lint + vitest + tsc/build (existing `ci.yml`); **no browser** |
| DEV-only tool | `src/dev/**`, `src/preview/**`, plus `main.tsx` only if `main.tsx` diff touches only the DEV branch (needs content check, otherwise keep as production entry) | focused unit (`src/dev`, `src/preview`) + **production bundle isolation gate** (`previewIsolation.gate.test.ts`); no E2E |
| production non-layout UI | `src/components/**/*.tsx`, `src/App.tsx` without CSS | unit + **Chromium** (iphone-390x844 subset) — a new light tier, today missing |
| layout / CSS | `*.css`, `src/App.css`, `index.html`, layout specs | layout-chromium (7 profiles) + Chromium 390×844 + 360×800; WebKit **only the layout specs** at both widths |
| storage / persistence | `src/state/persistence.ts`, `dex.ts`, `hint5Flag.ts`, `src/firebase/**`, save schema | Chromium + **WebKit 390×844 full** (Safari ITP/localStorage semantics) |
| cooking pointer / gesture | `e2e/gestures.ts`, cooking components, pointer handlers (`Pizza*`, `*Stage*`, dough/sauce/cut/bake) | Chromium + **WebKit** (both widths for gesture specs) |
| e2e / CI infra | `e2e/**`, `playwright.config.ts`, `.github/**`, `scripts/ci/**`, deps, vite/ts config | **Full** (unchanged) |
| unknown | anything else | **Full** |

Main-branch backstop: keep Full after merge only when the merge commit tree differs from the tested PR merge ref (or nightly), otherwise reuse the PR's Gate result (extend the existing `tested_base` reuse mechanism).

Note: the exact path→class mapping must be derived with evidence per Issue #201's own rule ("broaden SKIP rules only with evidence"); the table above is a hypothesis grounded in the file list, not verified per spec. A first mapping step would be tagging each e2e spec with a risk tag (`@layout`, `@storage`, `@gesture`, `@flow`) and generating the required `--grep` set.

## 4. Waste and bottleneck summary

**Current waste (measured on #334):**
- DEV-only change → 5 browser jobs ≈ 40+ runner-min on the PR run, again on push (≈ 40+ more) = ~85–90 runner-minutes for a change with zero layout/engine exposure.
- Superseded run: ~13 runner-min × 5 jobs burned on a cancelled run because installs were stuck.
- Stalled installs: 5 stall events in 3 runs (14.5 min each) → in run 36897376551, 1h 1m wall-clock for a suite whose test steps take ~5 min.
- `npm ci` ×7, Playwright install ×5 per run.

**Largest wait-time factor:** WebKit `install --with-deps` stalls (12–15 min vs 1–3 min normal), ahead of the test run itself (~5 min per shard). A 15 min job timeout converts a stall into a 15 min wait + manual re-run (+8–9 min) with ≥1 stall in ≈ 1 of every 2–3 sampled runs.

**Safely omittable gates (never at the cost of fail-closed):**
- Full WebKit ×4 for DEV-only/preview-only changes (covered by bundle-isolation + unit).
- Post-merge Full when the tested merge ref equals the post-merge tree.
- WebKit shards 360×800 for functional/non-layout/non-width-sensitive specs.
- `ci.yml build` + E2E on docs-only (currently build runs).
- Not safely omittable without further evidence: WebKit for storage and gesture changes; Layout Contract for any CSS.

## 5. Recommended implementation slices

| Slice | Content | Risk | Expected effect |
|---|---|---|---|
| S1 — Install resilience | step-level `timeout-minutes` (~6) + in-step retry for `install webkit` / `install chromium` only; split `install-deps` vs `install` for timing | very low; no coverage change | stall cost 14.5 min → ≤ ~6–7 min with no manual re-run; eliminates most red-by-infra cycles |
| S2 — Gate failure taxonomy | evidence records `install_status`; `webkit-gate.sh` / `layout-gate.sh` print FAIL-INFRA vs FAIL-TEST; extend `test-webkit-ci.sh` truth table | low; still fail-closed | faster diagnosis, no behavioral change |
| S3 — Classifier v2 (routing only, no new tiers executed) | classifier outputs `level` (`none|unit|dev|chromium|layout|webkit|full`) with reasons; Gate still enforces Full for all but `none`, shadow-reported | low | produces evidence of what each PR *would* have needed |
| S4 — DEV-only / pure-logic skip | enable skipping browser jobs for DEV-only / unit-only classes; require bundle-isolation + vitest | medium (authority on class correctness) | ~40+ runner-min and ~8–12 min wall per such PR |
| S5 — Reduced WebKit tiers | parameterised required-project/spec set (390-only for storage/functional, layout-spec-only both widths); Gate/evidence verifier parameterised; spec tags | medium-high | ~50% fewer WebKit jobs on non-layout runtime PRs |
| S6 — Post-merge dedupe | skip/reuse Full on push when the PR's Gate on the same tree succeeded; keep nightly Full | low-medium | −1 Full per merge |
| S7 (optional) — Playwright container | pinned `mcr.microsoft.com/playwright` image for E2E jobs | medium | removes install step (≈ −30–200 s per shard) and the apt/CDN stall class entirely |

Suggested order: S1 → S2 → S3 → S4 → S6 → S5 → S7. S1 + S2 are independent, low risk, and address the biggest measured wait.

## 6. Estimated impact (from measured numbers)

| Scenario | Today | After |
|---|---|---|
| Healthy Full run wall-clock | ~11–12 min (#334: 11m46s) | unchanged until S5/S7; S7 → ~9 min |
| Run with one install stall | 27 – 61 min (runs 36876302610, 36897376551) | ≤ ~13–14 min (S1: stall detected at ~6 min, retried in-step) |
| DEV-only / pure-logic PR | Full: ~11 min wall, ~45 runner-min (+ same again post-merge) | ~2–3 min wall (vitest + build only), ~5 runner-min (S4+S6) |
| Non-layout runtime PR (functional/storage) | Full | WebKit 390 only: ~½ the shard-minutes (S5) |
| Layout/CSS PR | Full | Full-equivalent (layout-chromium + layout specs both widths), small saving |

These are estimates from 3–4 sampled runs; they are not benchmarks. Hit rates for stalls (≈5 of ~20 sampled WebKit install steps) need a larger sample from the Actions history before committing to numbers.

## 7. Open points / limits of this audit
- Install logs were not retrieved, so stall causes are hypotheses; step timing and conclusions are measured.
- Per-spec risk tags and which specs are width-sensitive were not exhaustively verified (grep only: 36 specs use localStorage/reload/init scripts; pointer/gesture specs are concentrated in 6 files + `gestures.ts`).
- `ci.yml build` duration was not sampled.
- Branch protection settings (which checks are required) were not inspected; any slice must keep `WebKit Gate` / `Layout Contract Gate` as the required names.
- Nothing here was run against WebKit.
