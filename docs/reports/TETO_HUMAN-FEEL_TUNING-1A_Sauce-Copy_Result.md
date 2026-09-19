# Human Feel Tuning 1A — Completion Gate INSUFFICIENT_SAUCE Copy Fix

**Status: IMPLEMENTED. Copy-only change. No threshold/logic/scoring/economy change.**

## 0. SHAs

- **Base `main` SHA** (fetched fresh via `git fetch origin && git rev-parse origin/main`
  before branching): `910476ab7bc3cb814231ed88870ede58d7e51e69` — matches the audited SHA in
  `docs/reports/TETO_11-RECIPE_HUMAN-FEEL_Post-Completion-CT2_Audit.md` exactly; `origin/main`
  had not moved since that audit.
- **Implementation HEAD SHA**: `4761885e3d46002a889d08ff3cc6720ee6a37296` on branch
  `claude/human-feel-tuning-1a-sauce-copy` (freshly branched from `main`, not stacked on the
  audit branch).

## 0.1 Duplicate/scope gate

Checked before starting and again immediately before opening the PR:
`mcp__github__list_pull_requests` (state: open) and an issue/PR search for "sauce copy",
"INSUFFICIENT_SAUCE", "Human Feel Tuning". No open PR or issue duplicates this exact
copy-only follow-up. No implementation was skipped or blocked.

## 1. P1 reproduction (fresh, from the audited code)

Read fresh from `main` before making any change:

- `src/logic/completionGate.ts`: `SAUCE_MIN_RATIO = COVERAGE_POOR_RATIO / 2 = 0.275`.
  `checkSauceQuantity` fails the gate when either `quantityRatio` or `coverageRatio` (vs. the
  recipe's Reference sauce target) drops below this ratio — i.e. it is a **coverage-area**
  check as much as a quantity one.
- `src/data/completionMessages.ts`'s `buildCompletionFailureMessage` is the sole place that
  turns a `CompletionFailureReason` into player-facing text; `INSUFFICIENT_SAUCE` mapped to
  `` `${ingredientNameJa}が少なすぎます` `` ("not enough X").
- `src/components/ResultPanel.tsx` renders that string verbatim in
  `.result-panel__failed-reason` (`role="alert"`), the one big FAILED reason line.

Reproduced live in-browser (`main`, before the fix, `1.2s` one-way straight swipe on
Margherita's tomato sauce): FAILED, reason text "トマトソースが少なすぎます" — which reads as an
amount complaint even though the pizza's dough was already visibly covered by a thick red band
across its middle (plenty of sauce, just not spread over enough area). This is the exact P1 the
audit flagged.

## 2. Change

**File:** `src/data/completionMessages.ts` (one `case` arm). **Also added:**
`src/data/completionMessages.test.ts` (new, pins the copy).

| | Old copy | New copy |
|---|---|---|
| `INSUFFICIENT_SAUCE` | `${ingredient}が少なすぎます` (e.g. "トマトソースが少なすぎます") | `${ingredient}をもう少し広くぬろう！` (e.g. "トマトソースをもう少し広くぬろう！") |

Kept the existing `${ingredientNameJa(failed.ingredientId)}` interpolation (rather than
hardcoding "ソース") so the message stays accurate for all three sauce-family ingredients this
reason can fire for — confirmed correct for all three:

- `tomato-sauce` → "トマトソースをもう少し広くぬろう！"
- `pesto` → "ジェノベーゼソースをもう少し広くぬろう！"
- `olive-oil` → "オリーブオイルをもう少し広くぬろう！"

No other `CompletionFailureReason` case was touched
(`MISSING_REQUIRED_INGREDIENT`/`INSUFFICIENT_REQUIRED_AMOUNT`/`UNDERBAKED`/`OVERBAKED` copy is
byte-identical to `main`, pinned by the new test file's own "every other reason unchanged"
case).

## 3. Unchanged (confirmed, not just claimed)

- **`SAUCE_MIN_RATIO` unchanged**: `git diff main -- src/logic/completionGate.ts` is empty —
  the file was not touched at all this session.
- **Coverage/quantity algorithm unchanged**: `src/logic/sauceField.ts`,
  `src/logic/sauceQuantity.ts`, `src/logic/sauceEvaluation.ts` were not touched.
- **Completion Gate PASS/FAIL logic unchanged**: `evaluatePizzaCompletion` itself and every
  `CompletionFailureReason` value/priority ordering are byte-identical to `main`.
- **Scoring 2.0, Economy, Cooking Time, Efficiency, Pitz, Shop, Inventory, Starter Grant,
  Recipe unlock, Lunch Rush, Save schema, Recipe data**: no file under any of
  `src/logic/scoringV2/`, `src/logic/pitzReward.ts`, `src/logic/efficiency.ts`,
  `src/logic/cookingTiming.ts`, `src/logic/economy.ts`, `src/state/starterStock.ts`,
  `src/state/progression.ts`, `src/state/persistence.ts`, `src/data/recipes.ts`,
  `src/data/ingredients.ts` was modified — `git diff --stat main` shows exactly two files
  changed (`src/data/completionMessages.ts`, and the new
  `src/data/completionMessages.test.ts`).

```
$ git diff --stat main
 src/data/completionMessages.ts | 11 ++++++++++-
 src/data/completionMessages.test.ts (new file)
```

## 4. Test results

| Check | Result |
|---|---|
| `npx vitest run` | **1604 tests passed** (81 test files) — 1600 baseline + 4 new (`completionMessages.test.ts`) |
| `npx tsc -b` | clean, exit 0 |
| `npx oxlint` | clean, exit 0 |
| `npm run build` | succeeds (`dist/` produced, bundle size unchanged within noise: 350.78 kB JS / gzip 108.82 kB) |
| `git diff --check` | clean (no whitespace errors) |

No existing test asserted the old `少なすぎます` string (verified via repo-wide grep before
changing anything), so no existing test needed updating — only the new
`completionMessages.test.ts` was added, covering:
1. the new copy for all three sauce-family ingredients,
2. an explicit "must not contain 少なすぎ" regression guard,
3. the unknown-ingredient fallback ("材料をもう少し広くぬろう！"),
4. every other `CompletionFailureReason`'s copy is unchanged.

## 5. Browser verification (real Playwright + Chromium, built app via `vite preview`)

All 4 scenarios run against the built app with the fix applied, Margherita, zero console
errors and zero `pageerror`s across every run.

### 390×844

| Scenario | Gesture | Result | Screenshot |
|---|---|---|---|
| A. Clearly insufficient sauce | single tap | **FAILED** — "トマトソースをもう少し広くぬろう！" | `insufficient_sauce_failed.png` |
| B. One-way swipe (audit's exact reproduction case) | one-way straight swipe, 400/700/900ms | **FAILED** reliably at all three durations — same new copy | `oneway_swipe_result.png` (900ms) |
| C. Back-and-forth swipe | back-and-forth swipe, 1500ms | **PASS** (★3, 70点) — unaffected by the copy-only change | `repeated_swipe_pass.png` |
| D. Normal painting | 3-row zigzag, ~1.5s | **PASS** (★3, 70点) | `normal_paint_pass.png` |

One additional observation reproducing the audit's own P2 note: at exactly **1200ms**, the
one-way swipe sits on the same unstable boundary the audit already flagged (PASS once, FAILED
once across two otherwise-identical runs) — this is pre-existing coverage-threshold behavior,
**not** something this copy-only change touches or could fix, and is called out again in §7
below as still-open.

**B's screenshot is the key validation**: the rendered pizza visibly shows a thick red band
across the middle (substantial sauce already applied, just narrow) — the new "spread it
wider" message now matches what's actually on screen, where the old "not enough" message did
not.

### 360×800

| Scenario | Result | Screenshot |
|---|---|---|
| FAILED insufficient sauce (700ms one-way swipe) | **FAILED**, new copy renders on one line, no truncation | `360x800_failed_sauce.png` |

Checked for all runs above: no text clipping, no `overlay`/CTA overflow
(`document.documentElement.scrollWidth <= clientWidth` confirmed via `page.evaluate` on every
run), "もう一度つくる"/"別のピザを作る" CTAs fully clickable and unobstructed, 0 console errors.

## 6. Remaining P0/P1/P2 (from the original audit)

| ID | Item | Status after this change |
|---|---|---|
| P1 (this task) | INSUFFICIENT_SAUCE copy reads as an amount problem | **Resolved** — copy now says "spread wider" |
| P2 | Back-and-forth swipe boundary instability (~800ms fail / ~1100ms pass) | **Still open**, unchanged — out of scope for this copy-only pass, matches the audit's own recommendation not to touch the threshold without more Human Feel data |
| P2 | Shared-ingredient Starter Grant floor (Math.max, not additive) | **Still open**, unchanged — out of scope (Economy) |
| P2 | No sauce upper-bound check in the Completion Gate | **Still open**, unchanged — audit recommended no change here |

No new findings surfaced by this pass.

## 7. Final Verdict

**READY TO MERGE** (pending human review). The change is minimal (one `case` arm's return
string + a small pinning test), verified not to touch `SAUCE_MIN_RATIO`, the coverage
algorithm, or any Completion Gate logic, passes the full test suite plus a new regression
test, and was confirmed live in-browser at both target mobile widths with zero console errors.
The two still-open P2 items are unchanged by design (explicitly out of this task's scope) and
remain candidates for a future, separate tuning pass.
