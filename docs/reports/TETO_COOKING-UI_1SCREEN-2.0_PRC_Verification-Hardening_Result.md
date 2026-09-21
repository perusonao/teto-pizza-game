# Cooking UI 1-Screen 2.0 — PR-C: Verification Hardening — Result Report

Status: **Implementation complete, PR open — pending user/ChatGPT Fresh Review. Not merged.**

- Issue: [#167](https://github.com/perusonao/teto-pizza-game/issues/167)
- PR: [#171](https://github.com/perusonao/teto-pizza-game/pull/171)
- Latest `main` SHA (at task start and re-confirmed via Duplicate Gate #2): `f1b8051ee16814b2f183247229c4c48867522363`
  (= PR-B's own merge SHA — `main` had not moved since PR-B merged, at either check)
- Base SHA: `f1b8051ee16814b2f183247229c4c48867522363`
- Implementation HEAD: `ddf2561d1393e08463a51367ba992218548620a5`

## Duplicate Gates

- **Duplicate Gate #1** (before starting): fresh `search_issues`/`search_pull_requests`/
  `list_pull_requests` for Issue #167, "Verification Hardening", WebKit, Safari, "Playwright
  WebKit", "iPhone Safari", "Cooking UI 1-Screen" — 0 matches. Issue #167 itself confirmed open,
  `closed_by_pull_requests.total_count: 0`. **Clear.**
- **Duplicate Gate #2** (immediately before push): fresh `git fetch origin main` — SHA unchanged
  (`f1b8051...`). Fresh `list_pull_requests` (open) — no new PR-C-shaped PR appeared; only this
  session's own PR #171 (by then already open) plus four long-standing, unrelated open PRs.
  **Clear.**

## Before CI architecture

- `.github/workflows/ci.yml` — the only CI workflow that ran Playwright-adjacent code at all, and
  it didn't: `npm ci` → `npm run lint` (oxlint) → `npm test` (**Vitest/jsdom only** — no real
  browser layout) → `npm run build`. Triggered on every PR to `main`.
- `playwright.config.ts` already defined four projects (`iphone-390x844`, `iphone-360x800` on
  Chromium via `devices["Desktop Chrome"]`; `webkit-390x844`, `webkit-360x800` on WebKit via
  `devices["Desktop Safari"]`, added by PR-A) covering `e2e/viewport-1screen.spec.ts` and
  `e2e/making-ui-1screen.spec.ts`. The file's own header comment stated outright: **"Deliberately
  NOT wired into `npm test` or `.github/workflows/ci.yml`."**
- **Fresh Audit finding (explicitly required by the task, not assumed): no Playwright project —
  Chromium or WebKit — ran in CI before this PR.** The only real-browser verification path was
  manual/local `npm run test:e2e`. This is a strictly larger gap than "WebKit specifically doesn't
  run" — it's "no real-browser layout assertion gates a PR at all." Confirmed by reading
  `ci.yml` directly (no `playwright` invocation anywhere) and by this task's own local baseline
  run (see below).
- `.github/workflows/deploy.yml` / `.github/workflows/firebase-production-deploy.yml`: unrelated
  (GitHub Pages / Firebase deploy on push to `main`), untouched, not part of this audit's scope.
- Node 22, Playwright `^1.56.1` (`package.json`), no browser-binary caching anywhere pre-existing.

## After CI architecture

New dedicated workflow: **`.github/workflows/e2e-webkit.yml`**, job `webkit`, triggered on every
`pull_request` to `main` (same trigger shape as `ci.yml`, separate job/workflow — `ci.yml` itself
is untouched, so its own runtime is unaffected).

Steps: checkout → `setup-node` (Node 22, npm cache) → `npm ci` → cache `~/.cache/ms-playwright`
keyed on `hashFiles('package-lock.json')` → `npx playwright install --with-deps webkit` → a
"Browser installation proof" step (`npx playwright --version` + `find` the installed WebKit
revision dir) → `npx playwright test --project=webkit-390x844 --project=webkit-360x800
--reporter=list,html` → always-upload the HTML report as a build artifact (`playwright-webkit-report`,
14-day retention).

`playwright.config.ts`'s own header/project comments were updated (comments only, no behavioral
change) to stop claiming WebKit "is not run by CI" now that it is.

### CI Runtime — architecture trade-off (Issue #167 §11)

Chosen: **(A) WebKit focused job on every PR**, not path-filtered, not folded into `ci.yml`.

- **Why not path-filtered (B):** Issue #167's own root cause was a regression introduced by a
  change that didn't obviously look Cooking-UI-related to a reviewer. A path filter keyed on
  `src/components/PizzaStage*` etc. would still miss a shared `App.css` primitive, a reducer
  change, or a dependency bump that happens to shift Safari-only font/layout metrics — reopening
  the exact "silently broke, nobody noticed" gap this PR exists to close. Given the measured
  runtime (below) is small in absolute terms, the safety margin was judged worth more than the
  saved minutes on PRs that don't touch Cooking UI.
- **Why a separate job/workflow, not folded into `ci.yml`'s existing job:** keeps the fast
  lint/vitest/build feedback loop's own runtime completely unaffected (they run in parallel, not
  sequentially) and keeps the browser-install step isolated so a WebKit download hiccup can never
  block the fast job's own status.
- **Why not (C) a fully separate, non-blocking "verification" workflow:** the task's own goal
  (§2) is catching a regression *before merge*, which requires the check to actually gate the PR
  (a required/blocking check), not just report after the fact.

**Measured added CI runtime** (this PR's own actual run, `webkit` job,
[run 35649357184](https://github.com/perusonao/teto-pizza-game/actions/runs/35649357184)):
**cold** ≈3m (system deps + WebKit download + `npm ci` + 46 tests in 2.2m); with the
`~/.cache/ms-playwright` cache warm on a later PR, the WebKit download step is skipped, leaving
roughly `npm ci` + apt (fast, packages already satisfied) + the ~2.2m test run. This runs in
parallel with `ci.yml`'s own job, so it adds to total wall-clock PR gate time (not free) but does
not serialize behind or slow down the fast job.

## Local WebKit attempt (§4)

WebKit was not pre-installed locally (`~/.cache/ms-playwright` did not exist; only Chromium
is pre-provisioned in this sandbox, at `/opt/pw-browsers`, unrelated to Playwright's own cache
dir). One normal, supported attempt: `npx playwright install webkit`.

**Result: blocked**, same network egress policy PR-A/PR-B already documented — `403` from the
sandbox's own outbound proxy allowlist on both `cdn.playwright.dev` and
`playwright.download.prss.microsoft.com` (Playwright's own retry-with-mirror logic tried both,
both blocked). No bypass attempted (no allowlist/proxy changes, no repeated retries against the
same blocked hosts) — recorded the limitation and moved to GitHub Actions per the task's own
explicit instruction. Chromium, by contrast, **is** available locally (pre-installed in this
sandbox) — used for the full local baseline/regression run below.

**GitHub Actions is not subject to this restriction** — its own runner has open egress, and did
successfully download WebKit 26.0 (playwright build v2215) from `cdn.playwright.dev` directly (see
Actual WebKit execution evidence below).

## A real WebKit-only finding (Issue #167's own goal, demonstrated)

The very first `webkit` CI run on this PR (
[run 35648302924](https://github.com/perusonao/teto-pizza-game/actions/runs/35648302924), commit
`6f50c36`) **failed with 6 real, reproducible failures** — not the new CI job's own smoke test,
but a genuine WebKit-vs-Chromium behavior difference the same commit's Chromium run (local) did
not show:

- `startQuattroFormaggiHeavyInventory` (**pre-existing** fixture, `e2e/gestures.ts`, used by an
  already-merged test in `viewport-1screen.spec.ts`) and the new `startSalsicciaUnlocked` (this
  PR's own fixture) both seed a synthetic save via `page.goto("/")` → `page.evaluate(() =>
  localStorage.setItem(...))` → `page.reload()`.
- On WebKit specifically, `loadSave()` (`src/state/persistence.ts` — plain synchronous
  `localStorage.getItem`/`JSON.parse`, zero browser-conditional code) read back a fresh/empty save
  instead of the fixture's own data. Both quattro-formaggi and サルシッチャ have a real
  `unlockCondition` an empty Dex can't satisfy, so `recipeCardState` correctly rendered them
  `LOCKED` — the detail CTA (`disabled={isLocked}`) stayed genuinely disabled for the test's full
  30s timeout (confirmed via the failure's own Call Log: 51 retries, "element is not enabled",
  every single one, for the entire 30s — not an intermittent race that would eventually resolve).
- **Root-caused as a WebKit-only test-harness timing issue, not a production bug**: the card-state
  derivation is pure, synchronous, engine-agnostic JS — it only ever sees "no data" vs. "this
  fixture's data," never a browser-conditional branch. This also means it is explicitly **out of
  Issue #167 PR-C §12's own scope guard** ("recipe unlock... No unrelated UX redesign") either
  way — no recipe-unlock production code was touched.
- **Fix** (commit `ddf2561`): seed localStorage via `page.addInitScript(...)` *before* `page.goto`
  instead of `evaluate` + `reload`. `addInitScript` is guaranteed by Playwright to run before any
  of the page's own scripts on every navigation, in every engine — no reload/flush race at all.
  Applied to both `gestures.ts` fixtures and the inline "Sauce lock" test's own save injection
  (`making-ui-1screen.spec.ts`), which used the identical fragile pattern but happened not to be
  caught by its own assertions (margherita needs no unlock condition, so it renders correctly
  whether or not the injected save actually landed) — fixed proactively so that latent gap can't
  someday silently stop testing what it claims to, exactly the class of problem this PR exists to
  prevent.
- **Re-run after the fix**: 46/46 pass on WebKit (see below) — confirms both the new Reference
  modal coverage and the pre-existing quattro-formaggi fixture now genuinely exercise their own
  intended state on every engine, not just Chromium.

This is the concrete demonstration that this PR's own CI architecture works as designed: a
WebKit-only failure was caught, root-caused, and fixed before merge, on this very PR.

## New WebKit test coverage added (beyond wiring existing projects into CI)

Auditing Issue #167 §7/§9's own required assertions against the existing two spec files found one
real gap: nothing asserted that the **Reference modal itself** (PR-B's Reference Truth) fits the
viewport, stays readable, or leaves a stable layout on close — only piece-count *parity* between
the mini thumbnail and the popover was tested (`e2e/making-ui-1screen.spec.ts`, pre-existing).

Added (`e2e/making-ui-1screen.spec.ts`, new `assertReferenceModalLifecycle` helper + describe
block "Reference modal fit + close (Issue #167 PR-C §9)"):

- Opens the modal (`role=dialog`), asserts its bounding box is fully inside the viewport on all
  four edges, asserts a sane/readable minimum size (not a collapsed 0×0 box technically "inside"
  the viewport), asserts opening it causes no document horizontal/vertical overflow.
- Asserts the close button is reachable inside the viewport, then closes it and asserts **zero**
  matching dialog elements remain (no stale overlay) and the underlying 1-screen layout
  (`assertOneScreen`/`assertNavFitsViewport`, both pre-existing helpers) is still intact
  afterward — not just "the modal is gone."
- Run for **Margherita** (this file's existing baseline recipe) and **Salsiccia** — the recipe the
  user originally reported the Reference divergence on (Issue #167 background) — via a new
  `startSalsicciaUnlocked` save fixture (`e2e/gestures.ts`), plus Salsiccia once more at the
  360×800 secondary viewport.

## Exact WebKit projects / tests

- Projects: `webkit-390x844` (390×844, authority), `webkit-360x800` (360×800, secondary) —
  `playwright.config.ts`, both `devices["Desktop Safari"]` (WebKit engine).
- Specs run: every test in `e2e/viewport-1screen.spec.ts` and `e2e/making-ui-1screen.spec.ts` (no
  hand-picked subset — see "CI Runtime" above for why the whole `e2e/` directory runs, not a
  maintained allowlist that could silently stop covering a newly added test).
- Test count: **46** (23 unique tests × 2 projects).

## GitHub Actions configuration

`.github/workflows/e2e-webkit.yml`, job `webkit`, `runs-on: ubuntu-latest`, `timeout-minutes: 15`.
See "After CI architecture" above for the full step list. Browser install:
`npx playwright install --with-deps webkit` (official supported Playwright CLI invocation, no
custom download logic).

## Browser installation proof

From the passing run's own "Browser installation proof" step
([run 35649357184](https://github.com/perusonao/teto-pizza-game/actions/runs/35649357184/job/106497618095)):

```
$ npx playwright --version
Version 1.56.1
$ find ~/.cache/ms-playwright -maxdepth 1 -type d -iname 'webkit-*'
/home/runner/.cache/ms-playwright/webkit-2215
```

Install log confirms an actual network download, not a no-op:

```
Downloading Webkit 26.0 (playwright build v2215) from https://cdn.playwright.dev/dbazure/download/playwright/builds/webkit/2215/webkit-ubuntu-24.04.zip
Webkit 26.0 (playwright build v2215) downloaded to /home/runner/.cache/ms-playwright/webkit-2215
```

## Actual WebKit execution proof

Every one of the 46 result lines in the job log is prefixed with its actual Playwright *project*
name — `[webkit-390x844]` / `[webkit-360x800]` — which Playwright only ever prints for the browser
engine that project is configured for (WebKit here, confirmed by `playwright.config.ts`'s own
`devices["Desktop Safari"]`). Example lines (full log:
[run 35649357184, job 106497618095](https://github.com/perusonao/teto-pizza-game/actions/runs/35649357184/job/106497618095)):

```
Running 46 tests using 2 workers
  ✓   1 [webkit-390x844] › e2e/making-ui-1screen.spec.ts:131:5 › ... (390x844) (25.0s)
  ✓   6 [webkit-390x844] › ... Salsiccia: Reference modal fits viewport, closes cleanly ... (3.2s)
  ✓  22 [webkit-390x844] › ... quattro-formaggi heavy inventory ... (7.4s)
  ✓  46 [webkit-360x800] › ... margherita CUT round -- CTA reachable via internal scroll only (6.9s)
  46 passed (2.2m)
```

This is a green job that a green-but-silently-Chromium job could not have produced: the first run
on this same branch (commit `6f50c36`, before the `addInitScript` fix) genuinely failed 6/46 under
these same WebKit projects — proving the job does execute real WebKit and can fail on
WebKit-specific behavior, not just report success unconditionally.

## Results by required area (Issue #167 §5/§7, this PR's own head)

| Area | 390×844 | 360×800 | 390×650 |
|---|---|---|---|
| Six-step nav present + fits viewport (`assertNavFitsViewport`) | PASS | PASS | PASS |
| No horizontal overflow (`docScrollWidth`) | PASS | PASS | PASS |
| No vertical page/Cooking-UI scroll (`assertOneScreen`) | PASS | PASS | PASS |
| Safety margin ≥ existing floor (`MIN_SAFETY_MARGIN_PX = 8`) | PASS | PASS | PASS |
| PizzaStage fits / sane dimensions | PASS | PASS | PASS (height-aware shrink path, see below) |
| Bottom CTA accessible/on-screen | PASS | PASS | PASS |
| Reference thumbnail/popover piece-count parity | PASS | PASS | n/a |
| Reference modal fits viewport, readable (new) | PASS | PASS | n/a |
| Reference modal close → no stale overlay, stable layout (new) | PASS | PASS | n/a |
| Salsiccia Reference coverage (new) | PASS | PASS | n/a |
| Physical drag-to-dough interaction | PASS | n/a | PASS |
| CUT line-drag interaction | PASS | n/a | PASS |
| Height-aware PizzaStage shrink path (390×650, dynamic viewport within the spec, not a separate project) | PASS (via `iphone-*`/`webkit-*` running the same spec) | — | PASS — confirmed both compact (DOUGH) and roomy (BAKE) shrink terms actually bind below both shipped viewports' own caps |

All cells above are from this PR's own actual runs (local Chromium: 46/46; CI WebKit: 46/46 after
the fix) — no area was asserted without an actual pass on both browsers.

## Vertical fit / six-tab / Reference / Salsiccia / interaction / CUT — narrative summary

- **Six-tab**: `assertNavFitsViewport` checks the nav strip and every individual tab's bounding
  box against the viewport width with an explicit ≥8px trailing margin, at every PREPARE/BAKE/
  POST_BAKE step, for every viewport this suite drives (390×844, 361×800, 360×800, 390×650).
- **Vertical fit**: `assertOneScreen` checks `document.documentElement.scrollWidth` and
  `.game-screen`'s own `scrollHeight`/`clientHeight`, plus a direct `getBoundingClientRect()`
  measurement of the lowest non-`position:fixed` in-flow child against the viewport height (the
  ≥8px floor) — real layout measurement, not screenshot comparison, per Issue #167 §7's own
  requirement.
- **Reference (Margherita + Salsiccia)**: open → fits/readable → close → no stale overlay →
  layout stable, both viewports, both recipes (new this PR).
- **Interaction**: `physicalDragToDough` (real pointerdown → threshold-move → glide → pointerup)
  confirmed landing correctly at the height-aware-shrunk 390×650 dough rect, not a stale cached
  size.
- **CUT**: `cutThreeLines` (three real drag gestures across the dough) confirmed producing exactly
  3 `.pizza-cut-line` elements at the shrunk 390×650 size too.

## Tests

- **Focused** (this PR's own new/changed): 6 new Reference-modal tests — pass on Chromium (local)
  and WebKit (CI), both before-fix (0/6, blocked by the localStorage race above) and after-fix
  (6/6).
- **Vitest**: 2146/2146 pass (`npm test`), unchanged from base — no `src/` production code
  touched by this PR.
- **TypeScript**: clean (`npm run build` = `tsc -b && vite build`, zero errors).
- **lint**: clean (`npm run lint` = `oxlint`, zero errors/warnings).
- **build**: clean, `dist/` output unchanged in shape (same asset graph, no new production code).
- **Existing Chromium Playwright** (local, both `iphone-390x844`/`iphone-360x800` projects, all of
  `e2e/`): 46/46 pass, both before and after the `addInitScript` fix (Chromium was never affected
  by the WebKit-only race).
- **GitHub Actions `build` job** (`ci.yml`, unchanged): green on this PR's final head
  ([run 35649357179](https://github.com/perusonao/teto-pizza-game/actions/runs/35649357179)).
- **GitHub Actions `webkit` job** (new, `e2e-webkit.yml`): green on this PR's final head, 46/46
  ([run 35649357184](https://github.com/perusonao/teto-pizza-game/actions/runs/35649357184)).

## CI runtime before/after

- **Before**: `ci.yml`'s `build` job only — `npm ci` + lint + Vitest + build. This PR's own final
  `build` job run: ~1m40s (`20:10:05`→`20:11:45`), consistent with the pre-existing job (no change
  made to it).
- **After**: the above, **plus** the new `webkit` job running in parallel — this PR's own final
  run: ~3m2s (`20:10:06`→`20:13:08`; cache-warm — the browser-cache step above found a hit,
  `Cache saved with key: playwright-webkit-Linux-...` on the *first* run, and would be a
  cache-restore, not a fresh download, on the next PR touching `package-lock.json` unchanged).
  Runs in parallel with `build`, so PR gate wall-clock time is bounded by the slower of the two
  (~3m), not their sum.

## Production files changed

**NO.** Every changed file is under `e2e/`, `.github/workflows/`, or is a comment-only edit to
`playwright.config.ts`. Zero changes under `src/`. Confirmed via `git diff --stat` against base
`f1b8051...` and re-confirmed no production behavior changed by the fact Vitest's 2146/2146 and
the build output are byte-for-byte the same shape as base.

## Human Verification

**N/A.**

Reason: verification/CI-only; PR-A/PR-B production UI unchanged. No production `src/` file was
modified in this PR (per "Production files changed" above) — WebKit reverified the *existing*
PR-A/PR-B production layout/Reference-Truth work and found it correct (46/46 pass); it did not
expose a production UI bug requiring a code change, so the Human Verification Policy's own
`§2`/`§14` "docs/CI-only" exemption applies. If a future WebKit run *does* expose a real production
bug and this PR (or a follow-up) changes visible CSS/React to fix it, fresh Human Verification
video(s) become required per policy before that change can be considered complete.

## Scope check (Issue #167 §12)

No changes to: scoring, Completion Gate, economy, inventory semantics, Firebase, Cloud Functions,
Firestore, ranking, Player Profile, recipe unlock **production code**, Lunch Rush scoring, CUT
scoring, recipe requirements, or Reference recipe data. The one recipe-unlock-*adjacent* thing
touched — the WebKit-only save-fixture timing fix — is entirely inside `e2e/gestures.ts` test
fixtures and does not modify `src/state/progression.ts`, `src/data/recipes.ts`, or any other
production recipe-unlock code; see "A real WebKit-only finding" above for the full root-cause
trail justifying why this was in-scope to fix (a CI-blocking test-harness bug found by this very
PR's own new job) without touching production code.

## Known limitations

- Local WebKit remains unreachable in this sandbox (network egress policy, same as PR-A/PR-B) —
  GitHub Actions is the sole practical authority for WebKit execution in this environment. This is
  a limitation of the local dev/session environment only, not of the shipped CI architecture.
- The new `webkit` job runs on every PR to `main`, unfiltered by path — see "CI Runtime" above for
  the deliberate trade-off. If this proves too slow in practice as the suite grows, the documented
  fallback is path-filtering scoped to Cooking UI-relevant paths plus a periodic (e.g. nightly or
  pre-merge-queue) full run, not silently dropping WebKit coverage.
- `e2e/*.spec.ts` (both Chromium and WebKit) still is not part of `npm test` itself and is not a
  required check for non-PR pushes (e.g., direct pushes to `main`, which this repo doesn't appear
  to use given branch protection via PR-only workflow triggers) — CI coverage is PR-gate-only, per
  existing `ci.yml`/this PR's own `e2e-webkit.yml` trigger shape (`on: pull_request`).
- This PR's own WebKit run surfaced and fixed one real WebKit-only bug (the save-fixture race) —
  a reminder that "wire WebKit into CI" and "WebKit CI is fully stable" are two different
  milestones; this PR delivers the former with one concrete instance of the latter's own value
  already demonstrated, not a guarantee no further WebKit-only test-harness quirks exist.

## Issue #167 completion recommendation

**YES**, with the understanding that this Result Report itself asks for Fresh Review, not
self-certification:

- PR-C's own stated goal (§2: "今後のCooking UI変更で、Safari系だけ崩れた場合に検出できる検証体系")
  is met and *demonstrated working end-to-end on this very PR* — a real WebKit-only failure was
  caught by the new job, root-caused, fixed, and re-verified green, before merge.
- All of §7's required assertion categories are covered with real `getBoundingClientRect()`/
  `scrollHeight` measurements, not screenshots, across 390×844 (authority), 360×800 (secondary),
  and 390×650 (short-height shrink path).
  Reference Truth (PR-B) now has WebKit-covered open/fit/close/no-stale-overlay coverage for both
  Margherita and Salsiccia specifically.
- No production code was touched; scope guard (§12) fully respected.
- Human Verification is correctly N/A per policy (no visible UI change).

This PR itself should not be merged by this session — per the task's own explicit instruction,
merge decision and Issue #167 closure are reserved for the user's/ChatGPT's independent Fresh
Review of the exact PR HEAD, live CI, and this report.
