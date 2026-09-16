# PIZZA_GAME Phase 4A-1B.1: First-Fun Fix Result

## Summary

| Area | Result |
| --- | --- |
| Fix A: First Sauce Touch copy | **DONE** |
| Fix B: Short Sauce Stroke visual smoothing | **DONE** |
| Fix C: Production Prototype Metrics hiding | **DONE** |
| Full vitest suite | **PASS** (505/505) |
| typecheck (`tsc -b`) | **PASS** |
| lint (`oxlint`) | **PASS** |
| production build (`vite build`) | **PASS**, Prototype Metrics dead-code-eliminated |
| `git diff --check` | **PASS** (no whitespace errors) |
| Browser 390x844 walkthrough | **PASS**, 0 console errors |
| Issue #27 | **untouched**, confirmed out of scope |
| Independent Review (Codex, PR #28) | 1 P2 finding, self-caused by Fix B, fixed same round |

- **Baseline main SHA:** `20c23b96fc7d72f2ef8105f509b36111b3d9210b` (PR #26 merge
  commit; confirmed `origin/main` HEAD and a clean working tree before any edits)
- **Branch:** `claude/phase-4a-1b1-first-fun-fix-b445ge` (new branch cut directly
  from that `main` SHA; PR #26's own branch was not reused)
- **Initial commit SHA:** `04f8a0401aa77931d16806af6692054ee1648284` (Fix A/B/C)
- **Report commit SHA:** `fe9a7e4ab17039d8071fd46b4cf2c35ff49eb2cb` (this report,
  first version -- PR #28 opened here, CI green, Preview deployed from this SHA)
- **Follow-up fix commit SHA:** this commit (branch tip after this report
  edit — see section 10 below and the PR's own commit history for the
  final pushed hash; Independent Review fix, pushed after PR #28 was opened)

## 0. Pre-flight state check

Before any edits:

- `origin/main` fetched fresh and confirmed at
  `20c23b96fc7d72f2ef8105f509b36111b3d9210b`, matching the merge SHA given in
  the brief (PR #26, "Phase 4A-1B: Cheese & Topping Physical Interaction").
- The session's designated branch (`claude/phase-4a-1b1-first-fun-fix-b445ge`)
  was already sitting at that exact SHA with a clean working tree, so no
  rebase/reset was needed.
- GitHub Pages Deploy Run #22 (production) was already reported SUCCESS per
  the brief; not re-verified independently since production `main` is not
  touched by this change (no merge in this round).

## 1. Changed files

```
 src/App.css                               |  24 +++--
 src/App.humanFeelFix3.test.tsx            |   2 +-
 src/components/PizzaStage.tsx             |  10 ++-
 src/components/SauceMetricsPanel.test.tsx |  60 ++++++++++++-
 src/components/SauceMetricsPanel.tsx      | 140 ++++++++++++++++--------------
 src/data/hints.test.ts                    |  38 ++++++++ (new file)
 src/data/hints.ts                         |  12 +--
 src/logic/sauceField.test.ts              | 109 +++++++++++++++++++++++
 src/logic/sauceField.ts                   |  55 ++++++++++++
 9 files changed, 369 insertions(+), 81 deletions(-)
```

No other files touched. Scope stayed to the three fixes; no touch to
`sauceDeposits`/`sauceField` resolution/authoritative data,
`computeSauceMetrics` semantics, Reference target values, scoring, stars,
BEST, Recipe, ingredient placement, physical drag/drop, the 3x2 Palette, the
fixed Bake CTA, Dex, Mission, Pitz, Shop, progression, save schema, or
keyboard interaction.

## 2. Fix A — First Sauce Touch copy (exact change)

`src/data/hints.ts`'s `RECIPE_HINTS[*].empty` field (the line `buildHintLine`
returns on `BEGIN_PREPARE`, before any explicit ヒント tap) changed from
naming only the ingredient to naming the gesture *and* the ingredient, for
all six recipes that have a `RECIPE_HINTS` entry:

| Recipe | Before | After |
| --- | --- | --- |
| margherita | `まずはトマトソースを塗ってみて！` | `指でなぞってトマトソースを塗ろう！` |
| marinara | `マリナーラはまずトマトソースからだよ！` | `指でなぞってトマトソースを塗ろう！` |
| quattro-formaggi | `クアトロ フォルマッジは、まずオリーブオイルを塗るところから！` | `指でなぞってオリーブオイルを塗ろう！` |
| genovese | `ジェノベーゼは、まず緑のジェノベーゼソースを塗ってみて！` | `指でなぞって緑のソースを塗ろう！` |
| bismarck | `ビスマルクはまずトマトソースからだよ！` | `指でなぞってトマトソースを塗ろう！` |
| funghi | `フンギはまずトマトソースを塗るところから！` | `指でなぞってトマトソースを塗ろう！` |

`emptyHint` (the explicit ヒント-button copy, already gesture-worded) and
every other hint category (`missing`/`ready`) are unchanged.

No new tutorial state, save flag, or modal was added — this is a pure copy
edit inside the existing `RECIPE_HINTS` table, read by the existing
`buildHintLine`/`BEGIN_PREPARE` path. `.order-card__hint` (the single-line,
`text-overflow: ellipsis` container that shows this text — Human Feel Fix 3)
truncated the first, longer draft (`ピザを指でなぞって、トマトソースを塗って
みよう！`, 24 chars) mid-sentence; the shortened forms above (14-18 chars,
at or below the old copy's own length) were verified in a real headless
Chromium render at 390px width to render with `scrollWidth === clientWidth`
(no truncation) — see section 6.

Tests: `src/data/hints.test.ts` (new) pins that every recipe's `empty` line
contains `指でなぞって` and a `塗` character, that `buildHintLine`'s default
call for Margherita returns the exact new string, and that the explicit-hint
call is unchanged. `src/App.humanFeelFix3.test.tsx` updated to assert the new
copy renders inside `.order-card`.

## 3. Fix B — Short Sauce Stroke: exact rendering approach

Two independent, both render-only, changes — neither touches
`sauceDeposits`, `buildSauceField`, `computeSauceMetrics`, the 16x16
resolution, or any metric:

1. **`smoothSauceFieldForDisplay`** (new, `src/logic/sauceField.ts`): two
   chained passes of a 3x3 binomial blur kernel (`[1,2,1;2,4,2;1,2,1]/16`)
   applied to a **copy** of the field. `computeSauceMetrics`/`buildSauceField`
   never call it. `PizzaStage.tsx`'s heatmap-canvas effect is its only
   caller, inserted right before `sauceFieldToRgbaPixels`:
   `field` (unchanged, still what `computeSauceMetrics` would see) →
   `smoothSauceFieldForDisplay(field)` → `sauceFieldToRgbaPixels(...)` →
   pixels written to the tiny 16x16 source canvas, same as before.
   A flat plateau (every cell in a local window equal) maps to itself
   exactly through both passes (proven in `sauceField.test.ts`), which is
   why a normal/broad-coverage stroke's interior is untouched — only an
   isolated dab or short stroke's own small, hard-edged cell block (mostly
   surrounded by untouched zero-value cells) gets pulled down and spread
   wider.
2. **`.pizza-sauce-heatmap` CSS blur** (`src/App.css`): `blur(1px)` →
   `blur(3px)` (and the three bake-state variants that repeat the same
   filter list). 1px only softened the canvas's own already-blurred pixel
   edge; it was not enough to visually round an isolated dab/short stroke's
   square/rectangular footprint. 3px was chosen empirically (see section 6's
   screenshots) as the smallest value that reads as a round dab/cloud for an
   isolated tap and a short stroke while leaving a normal/broad-coverage
   stroke's already-good look effectively unchanged (if anything slightly
   more even, by softening a small unpainted "hole" artifact that already
   existed at 1px).

### Authoritative Sauce data unchanged — evidence

- `src/logic/sauceField.ts`'s `buildSauceField`, `computeSauceMetrics`,
  `insideDoughFraction`, `insideTargetFraction`, `SAUCE_FIELD_SIZE` (16),
  `SAUCE_TARGET_RADIUS`, `COVERAGE_THRESHOLD`, `BRUSH_RADIUS_CELLS`,
  `DEPOSIT_FOOTPRINT_RADIUS` are **byte-identical** to `main` — `git diff
  main...HEAD -- src/logic/sauceField.ts` only adds new code (`blurPass`,
  `smoothSauceFieldForDisplay`) after the existing functions; no existing
  line changed.
- `PizzaStage.tsx`'s dispense/commit reducers (`APPLY_SAUCE`,
  `COMMIT_SAUCE_DISPENSE`, the pointer-tracking session logic) are untouched;
  the only new line in its heatmap effect is the `smoothSauceFieldForDisplay`
  call feeding the *pixel* generation step, after `field` (the metrics-grade
  data) has already been fully computed.
- Regression test (`sauceField.test.ts`, "computing metrics again after also
  computing the render-smoothed field ... produces identical metrics")
  explicitly calls `computeSauceMetrics` before and after invoking
  `smoothSauceFieldForDisplay` on the same deposits and asserts the two
  results are `toEqual` — proving the two paths share no mutable state.

### Sauce metrics unchanged — evidence

`sauceField.test.ts`'s new "Regression (Phase 4A-1B.1 Fix B)" describe block
pins the exact numeric metrics for an isolated single tap and a very short
(3-tap) stroke:

| Scenario | quantity | coverage | evenness |
| --- | --- | --- | --- |
| isolated tap | `0.02` | `0.005319148936170213` | `0.6547677550192725` |
| short stroke (3 taps) | `0.06` | `0.047872340425531915` | `0.6813936726183989` |

Both were captured directly from `computeSauceMetrics` on the pre-Fix-B code
path (the function itself is byte-identical before/after this change) and
are asserted with `toBeCloseTo(..., 10)`. `overflowAmount`/`edgeAmount` are
pinned at exactly `0` in both cases.

`referencePizza.test.ts` (untouched, still fully passing) independently
confirms the Reference target itself never moved: `MARGHERITA_REFERENCE.sauce`
and `IDEAL_MARGHERITA_SAUCE_FIXTURE` are unchanged files, and their own
"fixture reachability"/"deterministic"/"sane range" assertions all still
pass unmodified.

## 4. Fix C — Production Prototype Metrics: Preview/Production behavior

`SauceMetricsPanel.tsx`: the `🧪 Prototype Metrics（開発用）` toggle button
and its expandable raw-numbers detail (量/被覆/均一性/はみ出し/ふち量, shadow
similarity, per-piece detail) are now wrapped in
`{import.meta.env.VITE_PREVIEW_MODE && (...)}` — the same SSOT
`PreviewBadge.tsx` and `persistence.ts`'s `SAVE_STORAGE_KEY` already use, not
a new mechanism. The player-facing `ソースのでき` row (広さ/均一さ/ふち tiers)
and the live one-line message while painting are **not** gated — both stay
identical in Production and Preview.

Verified against real builds, not just the dev server:

- `npm run build` (no `VITE_PREVIEW_*` env vars, i.e. the actual production
  `vite build`): `grep -c "Prototype Metrics" dist/assets/index-*.js` → `0`.
  Vite/Rollup fully dead-code-eliminates the gated subtree.
- `VITE_PREVIEW_MODE=true VITE_PREVIEW_SHA=... vite build`:
  `grep -c "Prototype Metrics" dist/assets/index-*.js` → `1`. Present as
  expected.
- Browser check (both a plain `vite` dev server, which behaves like
  Production since `VITE_PREVIEW_MODE` is unset by default, and a second dev
  server started with `VITE_PREVIEW_MODE=true`): the "Production" instance
  never renders the 🧪 toggle while painting; the "Preview" instance does,
  alongside the `PREVIEW · PR#99 · abc1234` badge. Screenshots in section 6.

## 5. Tests

All 15 required areas are covered, 10 by new/updated automated tests and 5
by the existing regression suite (never weakened):

1. First Sauce copy has gesture guidance → `hints.test.ts` (new)
2. Production hides Prototype Metrics → `SauceMetricsPanel.test.tsx` (new
   describe block)
3. Preview offers Prototype Metrics → same block
4. 広さ survives in Production → same block
5. 均一さ survives in Production → same block
6. ふち survives in Production → same block
7. Isolated sauce input: authoritative field unchanged →
   `sauceField.test.ts` (new regression describe block)
8. Short stroke: authoritative field unchanged → same block
9. Sauce metrics unchanged by render smoothing → same block (the
   "computing metrics again after also computing the render-smoothed field"
   test) + `smoothSauceFieldForDisplay`'s own "never mutates the field it's
   given" test
10. Reference target unchanged → `referencePizza.test.ts` (pre-existing,
    unmodified, still green — the file itself has no diff)
11. Normal Sauce painting works → pre-existing `sauceField.test.ts`/
    `SauceMetricsPanel.test.tsx`/`App.*.test.tsx` coverage, still green, plus
    manual browser verification (section 6)
12. Reset works → pre-existing `IngredientTray.physicalDragReset.test.tsx`
    and `gameReducer.test.ts` `RESET_PIZZA` coverage, still green
13. Mozzarella physical drag not regressed →
    `IngredientTray.physicalDragReset.test.tsx`,
    `GameScreen.physicalDragOverlay.test.tsx`, still green
14. Basil physical drag not regressed → same files, still green
15. Bake→Result not regressed → `App.test.tsx`, `gameReducer.test.ts`,
    `phase4a1b.regression.test.ts`, still green

No existing assertion was weakened, relaxed, or deleted to make the suite
pass; two pre-existing tests (`App.humanFeelFix3.test.tsx`'s
`.order-card` text assertion, and `SauceMetricsPanel.test.tsx`'s "hidden
until expand" test) were updated to match the intentional copy/gating
changes themselves (Fix A/Fix C), not loosened.

### Before / after

| | Before this round | After this round |
| --- | --- | --- |
| Test files | 35 | 36 |
| Tests | ~490 (pre-existing suite, all passing on `main`) | **505, all passing** |

(`npm test` / `vitest run` output: `Test Files 36 passed (36)` /
`Tests 505 passed (505)` -- includes 2 further regression tests added in
section 11's Independent Review follow-up.)

## 6. Verification

```
$ npx tsc -b            # clean, no output
$ npx oxlint             # clean, exit 0
$ npx vitest run         # Test Files 36 passed (36); Tests 503 passed (503)
$ npm run build           # tsc -b && vite build -- succeeds, Prototype Metrics
                           #   confirmed absent from the production bundle
$ git diff --check        # clean, exit 0
```

### Browser (390x844, headless Chromium, pre-installed at
`/opt/pw-browsers`), 0 console errors throughout

Full path exercised: HOME → GAME → Margherita → Sauce (isolated dab → reset
→ short stroke → reset → normal/broad painting) → Mozzarella (x2, physical
drag) → Basil (physical drag) → Bake → 取り出す！(take-out timing) → Result.

- `document.documentElement`: `scrollWidth === clientWidth === 390`,
  `scrollHeight === clientHeight === 844` throughout PREPARE — no
  scrollbars, one screen maintained.
- `.order-card__hint`'s `scrollWidth === clientWidth` for the new Margherita
  copy (`指でなぞってトマトソースを塗ろう！`) — confirmed not truncated by
  the single-line `text-overflow: ellipsis` container.
- Isolated dab: before this fix, a hard-edged square with only a faint 1px
  blur halo; after, a visibly rounded, soft-gradient dab (compared at 3x
  device-scale-factor zoom, and by reading the canvas's own `toDataURL()`
  bitmap directly, independent of CSS compositing).
- Short stroke: before, a flat-edged rectangle/bar; after, a rounded
  cloud/blob shape — the complaint ("四角/ブロック状に見える") visibly
  resolved.
- Normal/broad painting: before and after both read as good, even coverage;
  after is, if anything, marginally more even (a small unpainted gap near
  the top edge present in the "before" capture is smoothed away in "after").
- Production dev server (no `VITE_PREVIEW_MODE`): 🧪 Prototype Metrics toggle
  never renders; 広さ/均一さ/ふち chips and the live message do.
  `VITE_PREVIEW_MODE=true` dev server: toggle renders, expands to the raw
  detail panel, alongside the `PREVIEW` badge.
- 3x2 Palette (ソース/チーズ/トッピング tabs, 3-per-row ingredient grid):
  unchanged, confirmed visually across all screenshots.
- Fixed Bake CTA row (やり直す/焼く！/ヒント): unchanged, confirmed visually.
- Mozzarella/Basil physical drag-and-drop: both placed correctly at the
  intended drop coordinates (verified by screenshot position matching the
  computed drop target).
- Bake → take-out timing → Result: reached ★3/75, 具材/配置/焼き bars, with
  no console errors at any step.

## 7. Preview

- **Preview repository:** `perusonao/teto-pizza-game-preview`
- **Preview URL:** `https://perusonao.github.io/teto-pizza-game-preview/`
- **Preview source SHA:** `04f8a0401aa77931d16806af6692054ee1648284`
  (this branch's tip, `claude/phase-4a-1b1-first-fun-fix-b445ge`)

`main` on `perusonao/teto-pizza-game` was **not** touched by this round —
only the dedicated feature branch/PR. Production and Preview saves stay
separated by the existing `VITE_PREVIEW_MODE`-gated `SAVE_STORAGE_KEY`
(`persistence.ts`), unchanged by this round.

## 8. Remaining issues

- None newly introduced by this round. Fix A/B/C are scoped exactly to the
  brief; no other gameplay system was touched.
- Fix A's shortened copy sacrifices some of the original per-recipe flavor
  text (e.g. マリナーラ/ビスマルク/フンギ's tomato-sauce lines are now
  identical to Margherita's, to fit the single-line hint container without
  truncation). If recipe-specific flavor text is wanted back later, it would
  need either a wider/multi-line hint container or further copy trimming —
  out of scope for this round, not filed as a new issue (cosmetic, no
  Merge-Blocker-level impact).

## 9. Issue #27 untouched — confirmation

Issue #27 ("Accessibility: retrigger live-region feedback for consecutive
same-ingredient drops") concerns `src/components/IngredientTray.tsx`'s
live-region announcement string for consecutive same-ingredient physical
drops. This round's diff does not touch `IngredientTray.tsx` at all (see
section 1's file list) — confirmed via `git diff main...HEAD --
src/components/IngredientTray.tsx` returning empty. Left for its own
dedicated follow-up as directed.

## 10. Independent Review (Codex, PR #28) follow-up

One P2 finding on `src/logic/sauceField.ts:417`
(`smoothSauceFieldForDisplay`): two chained 3x3 blur passes (Fix B's own
reach is 2 cells) could bleed a cell in the rim band beyond
`SAUCE_TARGET_RADIUS` from fully invisible (raw value 0, below
`MIN_VISIBLE_VALUE`) to just barely visible — display painting a hint of
sauce past the `ふち` (edge) guide even where the authoritative
`edgeAmount`/`edgeRatio` metric says 0. Concretely reproduced against
`IDEAL_MARGHERITA_SAUCE_FIXTURE` (the game's own "ideal", `edgeAmount`
exactly 0): 19 previously-invisible rim-band cells newly crossed the
visibility floor after the two blur passes, before this fix.

**Triage:** self-caused by this same PR's own Fix B (not a pre-existing,
unrelated concern), small, and well-scoped to fix within Fix B's own
render-only boundary — so fixed directly in this round (the one
"必要な修正確認" round after Independent Review) rather than filed as a
separate Issue, even though it doesn't corrupt data or break a main
interaction (the brief's own P2 Merge-Blocker bar).

**Fix:** `smoothSauceFieldForDisplay` now clamps every rim-band cell
(distance from center beyond `SAUCE_TARGET_RADIUS`) to
`Math.min(smoothed, raw)` after the two blur passes — display can never
*raise* a cell's visibility past its own raw value once past the edge
boundary the ふち evaluation scores against. Every cell inside the target
radius (where an isolated dab/short stroke actually happens during normal
play) still gets the full, unclamped two-pass smoothing this fix is for.
Still render-only: `computeSauceMetrics`/`buildSauceField` are untouched by
this follow-up too.

**Verification:** two new regression tests in `sauceField.test.ts` pin
`IDEAL_MARGHERITA_SAUCE_FIXTURE` never gaining a newly-visible rim-band cell,
and that a rim-band cell's smoothed value never exceeds its own raw value.
Full suite re-run: 505/505 passing (up from 503, +2 for this follow-up).
typecheck/lint/build/`git diff --check` all re-verified green. Isolated
dab/short stroke/broad-coverage screenshots re-captured post-fix and
confirmed visually unchanged from section 6 (the clamp only touches the
rim band, outside where those scenarios paint).

- **Follow-up commit SHA:** this commit (see section 0's "Follow-up fix
  commit SHA" note, and the PR's commit history for the final pushed hash)

## 11. FINAL VERDICT

**READY FOR PR → CI → PREVIEW DEPLOY → WAITING FOR IPHONE HUMAN FEEL.**

All three fixes implemented within the stated scope only. Full verification
suite (typecheck/lint/vitest/build/`git diff --check`) green. Browser
walkthrough at 390x844 confirms the golden path and all specified edge cases
(isolated dab, short stroke, normal painting, Mozzarella/Basil physical
drag, Bake→Result) with 0 console errors and no regressions. Production
build confirmed to fully exclude Prototype Metrics; Preview build confirmed
to include it. Issue #27 confirmed untouched. The one Independent Review
finding (section 10) was self-caused by this round's own Fix B and is fixed
in the same round, within the brief's one-round fix-confirmation allowance.

**Not merged to `main`.** Per the brief's stop condition, this round stops
at PR-created / CI-green / Preview-deploy-complete, awaiting a physical
iPhone Human Feel confirmation before any merge.
