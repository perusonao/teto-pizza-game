# PIZZA_GAME Phase 4A-1B: iPhone Human Feel Fix 4 Result (Sauce Visual Polish)

## Summary

Physical iPhone Human Feel Gate on Fix 3
(`docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix3_Result.md`):

| Area | Result |
| --- | --- |
| Ingredient Palette 3x2 | **PASS** |
| No horizontal scroll | **PASS** |
| Cheese/Topping physical interaction | **PASS** |
| PREPARE 390x844 1-screen | **PASS** |
| Fixed Bake CTA | **PASS** |
| Sauce grid/stamp pattern | **resolved (Fix 3)** |
| HOME -> RESULT full flow | **PASS** |
| **Painted sauce color/opacity** | **MINOR FIX** (this round) |

Fix 3 replaced the sauce heatmap's overlapping-circle cells with a true
one-pixel-per-cell buffer drawn through the browser's own bilinear image
upscaler, which genuinely removed the grid/stamp pattern -- but its alpha
formula (`min(0.85, value * 2.2)`) was tuned against numbers well below
what real gameplay actually produces. On a physical device this read as
"the dough got a little pink", not "tomato sauce was spread on it", with
the gap widest exactly where it matters most: even
`IDEAL_MARGHERITA_SAUCE_FIXTURE` (the game's own definition of "painted
well") only reached alpha ~0.02-0.15 under Fix 3's formula. This round
replaces that curve, keeping every one of Fix 3's structural wins (the
16x16 field, bilinear smoothing, no raw grid, the Target Area Guide)
completely untouched.

- **Source PR:** #26 (untouched -- not merged, rebased, or force-pushed)
- **Branch:** `claude/sauce-visual-polish-fix4-daojxu`
- **Fix commit:** `e232a18` (`e232a184d4aca83b9b6475a211f7b96bae82d76a`)
- **Built on (Fix 3 HEAD):** `4970011` (`claude/phase-4a-1b-human-feel-preview-1byr1k`,
  which carries Fix 1/2/3 and the Preview infra on top of PR #26 + the
  Post-#25 integration)

Before starting, per the brief's instruction: `origin` was fetched fresh,
`claude/phase-4a-1b-human-feel-preview-1byr1k` was confirmed as the
correct, up-to-date Human Feel Fix 3 HEAD (`4970011`, its own commit
message titled "iPhone Human Feel Fix 3 result report"), the working tree
was clean, and this session's designated branch
(`claude/sauce-visual-polish-fix4-daojxu`, which started equal to `main`
and therefore did **not** yet contain Fix 3) was reset onto that Fix 3
HEAD before any edits -- so this round builds on the actual latest Human
Feel work, not a stale base. PR #26 was confirmed still open/unmerged
throughout and was not touched.

## 1. Sauce color / opacity

### Root cause

`sauceFieldToRgbaPixels` (`src/logic/sauceField.ts`) kept the sauce
color constant per cell and encoded everything in alpha via
`Math.min(0.85, value * 2.2)`. Measuring real per-cell field values (not
round numbers) against that formula:

| Scenario | Field value | Old alpha (Fix 3) |
| --- | --- | --- |
| A single dispense tick (one light dab) | ~0.02 | ~0.04 (out of 1.0) |
| `IDEAL_MARGHERITA_SAUCE_FIXTURE` (the "painted well" reference) | 0.008-0.068 (median 0.028) | ~0.02-0.15 |
| Two full overlapping coats | up to ~0.14 | ~0.30 |

Even the game's own definition of "good coverage" barely left the
near-invisible end of the opacity range -- exactly the Gate's complaint.
`min(0.85, ...)`'s 0.85 cap was also never reached under any realistic
play, so it did nothing.

### Fix

`sauceField.ts` gained `densityToAlpha(value)`, a sqrt-shaped curve with
three named constants (`ALPHA_FLOOR` 0.46, `ALPHA_CAP` 0.93,
`DENSITY_AT_CAP` 0.09) tuned directly against the measured values above,
not picked in isolation:

- **`ALPHA_FLOOR` (0.46):** the alpha the instant a cell crosses the
  existing visibility cutoff (`MIN_VISIBLE_VALUE`, unchanged at 0.005) --
  so *any* touched cell reads unambiguously as sauce with the dough still
  showing through (薄塗り), never a faint tint.
- Fast initial rise (`sqrt`), so a single light dab (~0.02) already lands
  around alpha 0.66 -- clearly "sauce", not "barely there".
- `DENSITY_AT_CAP` (0.09) sits above the ideal fixture's own heaviest
  cell (~0.068) but well within reach of a real two-coat overlap
  (~0.1-0.14), so a normal well-painted coat (適量) reads vivid
  (alpha ~0.70-0.87 across the fixture's own range) with headroom left,
  and genuinely re-painting an area (重ね塗り) pushes further toward
  `ALPHA_CAP` (0.93) -- "slightly more concentrated", never a flat
  block, per the brief's explicit "don't just crank opacity to max and
  erase the thin/thick distinction" instruction.

The color itself (`SAUCE_HEATMAP_COLOR`) is unchanged in *architecture*
(still one constant RGB per cell, only alpha varies) -- verified to stay
in the tomato hue family at every density by a new regression test (see
Regression tests below). This keeps the change to exactly what the brief
scoped ("Visual Polishだけに限定する", "既存architectureに対する最小変更"):
one function's tuning, not a new rendering model.

### Color token SSOT

Before this round, the painted/baked heatmap's color (`SAUCE_HEATMAP_COLOR`,
hard-coded `rgb(196,46,34)`) and the tomato-sauce ingredient's own swatch
color (`ingredients.ts`, hard-coded `#c73b2e` = `rgb(199,59,46)`) were two
separately hard-coded reds a few RGB steps apart -- close enough nobody had
noticed, but exactly the kind of drift the brief's "SSOT化" ask flags.
`sauceField.ts` now exports `SAUCE_TOMATO_HEX = "#c73b2e"` as the single
source of truth; `SAUCE_HEATMAP_COLOR` is derived from it (a small
`hexToRgb` helper, no external dependency), and `ingredients.ts`'s
tomato-sauce entry imports the same constant instead of its own literal.
This also unifies the heatmap with the Reference popover's mini-pizza
sauce swatch and bar-fill (`ReferencePreview.tsx`, both driven by
`sauceIngredient.color`), which previously rendered a very slightly
different red than the actual painted/baked pizza. No CSS files were
touched for this -- both existing CSS literals (`.reference-preview__bar-fill`,
etc.) already matched the ingredient hex, so nothing there needed to
change.

## 2. Cooking / finished consistency

Fix 3 already gives the heatmap bake-state-scoped filters
(`.pizza-dough--raw/--perfect/--burnt .pizza-sauce-heatmap--*` in
`App.css`) -- raw brighter/more saturated, perfect slightly darker and
warmer (`hue-rotate(-6deg) brightness(0.95)`), burnt much darker. Those
were never the problem; they were simply invisible on top of an
already-near-transparent base color. With Fix 4's vivid base alpha, the
existing bake progression now reads as intended without any CSS changes:
PREPARE shows fresh, vivid tomato red (no bake-state class applies yet,
so just the new base color/alpha); RESULT's `perfect` state shows the
same red, warmed and slightly darkened by the unchanged existing filter.
Verified visually (see Verification below) -- PREPARE and RESULT read as
the same sauce, baked, not two different materials.

## 3. Preserved from Fix 3 (unchanged)

Confirmed via `git diff --stat` (only `sauceField.ts`,
`sauceField.test.ts`, `ingredients.ts` changed) and visually:

- 16x16 field architecture (`SAUCE_FIELD_SIZE`, `buildSauceField`) --
  untouched.
- Bilinear smoothing (`PizzaStage.tsx`'s `imageSmoothingEnabled`/
  `imageSmoothingQuality = "high"` canvas draw) -- untouched, not even
  read by this round's diff.
- Raw grid never shown; no per-cell shape drawn (`sauceFieldToRgbaPixels`
  is still one pixel per cell, no rect/circle) -- structure unchanged,
  only the value->alpha curve inside it.
- Target Area Guide (`.sauce-target-guide`) and `SAUCE_TARGET_RADIUS` SSOT
  -- byte-for-byte unchanged.
- `computeSauceMetrics`/scoring/evenness/coverage math -- untouched (this
  round only touches the *visual* pixel function, never the metrics one).

## 4. Do NOT change -- scope guard

`git diff --stat` for this round:

```
src/data/ingredients.ts      |  6 ++++-
src/logic/sauceField.test.ts | 74 +++++++++++++++++++++++++++++++++
src/logic/sauceField.ts      | 76 +++++++++++++++++++++++++++++++----
```

No changes to `IngredientTray.tsx`, `pieceDrag.ts`, any CSS file, PREPARE
layout (`GameScreen.tsx`, `.prepare-bake-bar`), HOME, save schema,
`scoring.ts`, Dex, Mission, Pitz, Shop, or progression.

## Regression tests (new)

`src/logic/sauceField.test.ts` gained a `sauceFieldToRgbaPixels alpha
curve (Human Feel Fix 4)` describe block (6 new tests), built from the
same real measured values as the brief's minimum checklist:

1. An untouched field has zero alpha everywhere (**zero field alpha = 0**).
2. A single light dab already reads past half-opaque (**never again a
   near-invisible dough tint** -- this is the exact case Fix 3 put at
   alpha ~0.04; Fix 4 pins it > 0.5).
3. A light dab has **lower** opacity than the ideal fixture's typical
   well-painted density (**low density < target density opacity**).
4. Re-painting the same area (two full coats) has **higher** opacity
   than the ideal fixture's typical density, never lower (**high density
   > low density opacity**).
5. Sauce color stays in the tomato hue family (red channel comfortably
   dominant over green/blue) at both a light and a heavy touch
   (**sauce hue/color family is tomato**).
6. `SAUCE_TOMATO_HEX` SSOT: the tomato-sauce ingredient's own color
   matches the heatmap's color source.

The existing `sauceFieldToRgbaPixels` describe block from Fix 3 (exact
RGBA-buffer length, empty-field transparency, out-of-dough cells never
painted, exact color match, alpha monotonicity) was re-run unmodified and
still passes -- the pixel buffer's **interpolation architecture** (one
pixel per cell, no shape, consumed by `PizzaStage.tsx`'s unchanged
`imageSmoothingEnabled` canvas draw) is untouched by this round, so those
tests needed no changes.

Every other existing test file (`sauceEvaluation.test.ts`,
`referencePizza.test.ts`, `SauceMetricsPanel.test.tsx`,
`App.humanFeelFix3.test.tsx`, etc.) was re-run unmodified.

## Verification

Run from `perusonao/teto-pizza-game` at commit `e232a18`:

| Check | Result |
| --- | --- |
| `tsc -b` | Pass |
| `oxlint` | Pass |
| `vitest run` | Pass -- 32 files / **447 tests** (441 carried over from Fix 3 + 6 new) |
| `vite build` | Pass |
| `git diff --check` | Pass |
| Scope guard | Only `src/data/ingredients.ts`, `src/logic/sauceField.ts`, `src/logic/sauceField.test.ts` changed (confirmed via `git diff --stat`) |

(`vitest run` was executed multiple times back-to-back after the full
suite to rule out flakiness; one unrelated pre-existing timing-sensitive
test in the gameReducer suite flaked once during iteration and passed
cleanly on every other run, including the final run recorded above -- not
touched by this round's diff.)

**Browser verification (Playwright + Chromium, 390x844 viewport)** -- the
full required flow: HOME -> GAME -> Margherita -> Sauce (paint through
four states) -> Cheese (drag Mozzarella x3) -> Topping (drag Basil x2) ->
BAKE -> RESULT.

| Step | vertical scroll | horizontal scroll | Bake CTA visible | console errors |
| --- | --- | --- | --- | --- |
| HOME | 0 | 0 | n/a | 0 |
| ORDER | 0 | 0 | n/a | 0 |
| PREPARE -- A (bare dough) | 0 | 0 | true | 0 |
| PREPARE -- B (thin/partial) | 0 | 0 | true | 0 |
| PREPARE -- C (good coverage) | 0 | 0 | true | 0 |
| PREPARE -- D (locally thick) | 0 | 0 | true | 0 |
| PREPARE -- Cheese (3 Mozzarella placed) | 0 | 0 | true | 0 |
| PREPARE -- Topping (2 Basil placed) | 0 | 0 | true | 0 |
| RESULT | 0 | 0 | n/a | 0 |

`vertical scroll`/`horizontal scroll` = `document.documentElement.scrollHeight
- clientHeight` / `scrollWidth - clientWidth`, both exactly `0` at every
step. `Bake CTA visible` = `.cta-button--bake`'s `getBoundingClientRect()`
fully within the 390x844 viewport. Zero console errors/warnings across
the entire flow. Result: **★5 / 99 points**, bake badge "✅ 焼き加減: いい
焼き加減" (perfect), all 3 Mozzarella + 2 Basil present on the finished
pizza -- confirming this round's visual-only change didn't regress
placement, bake, or scoring.

### Sauce A-E comparison (the brief's core Acceptance check)

Real per-cell density readouts (from the same "🧪 Prototype Metrics（開発用）"
panel players can open), captured alongside each screenshot:

| State | 量 (quantity) | 被覆 (coverage) | 均一性 (evenness) |
| --- | --- | --- | --- |
| A: bare dough | 0% | 0% | -- |
| B: thin/partial | 14% | 7% | 74% |
| C: good coverage | 72% | 43% | 90% |
| D: locally thick (repainted center, on top of C) | 100% (capped) | 43% | 88% |
| E: RESULT after bake | (same deposits as D, baked) | -- | -- |

Visually (all captured at 390x844, reviewed side by side):

- **A -> B:** immediately and unambiguously reads as "sauce was just
  spread here" -- a soft, clearly tomato-red patch with the dough visibly
  showing through at its edges. (**Before/after proof:** re-running this
  exact same B gesture against the unmodified Fix 3 build at identical
  quantity/coverage numbers produces a barely-visible pink smudge --
  see screenshots sent alongside this report, `OLD-B-thin-partial.png`
  vs. `B-thin-partial.png`.)
- **B -> C:** spreading further fills toward a natural, continuous
  tomato-sauce surface -- darker where the concentric painting passes
  overlapped near center, translucent (dough visible) toward the edges,
  no grid or petal pattern at any zoom level.
- **C:** already reads unmistakably as "a Margherita's sauce" well before
  baking, staying inside the Target Area Guide ring.
- **C -> D:** the re-painted center is visibly, but only modestly, more
  saturated/darker than the surrounding C-level area -- "a bit more",
  never a jump to a flat block (量 hitting the dispenser's own 100% cap
  here is itself a realistic in-game state: the sauce bottle is empty).
- **C/D -> E:** RESULT's baked sauce reads as the same tomato red,
  warmed and slightly darkened by bake -- no color-family discontinuity,
  the crust visibly golden ("perfect" bake state) around it.
- **16x16 grid:** not visible at any state, at any zoom level tested --
  Fix 3's own guarantee, untouched by this round.

Screenshots for all of the above (`A-bare-dough.png` through
`E-result-baked.png`, plus the `OLD-*` before/after pair) were sent
alongside this report for direct visual review.

### Production impact

None. `perusonao/teto-pizza-game`'s `main` branch, its GitHub Pages
deployment, and its Actions were not touched. All changes live on
`claude/sauce-visual-polish-fix4-daojxu` only; PR #26 was not merged,
rebased, or force-pushed.

## Preview

- **Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
- **Source PR:** #26
- **Source SHA (branch HEAD this preview builds):** `e232a18`
  (`e232a184d4aca83b9b6475a211f7b96bae82d76a`, `claude/sauce-visual-polish-fix4-daojxu`)
- **Preview deploy commit:** `dd92293`
  (`dd92293edb67a963e05f1b8e016589bd6ffc10cb`, `perusonao/teto-pizza-game-preview`,
  `main`)
- **PREVIEW badge:** now reads `PREVIEW · PR#26 · e232a18` -- confirmed
  present in the built JS bundle (`grep` against the deployed `site/`
  bundle) before and after deploy.
- **Deploy pipeline:** `perusonao/teto-pizza-game-preview`'s
  `Build & deploy a source PR/branch` workflow
  ([run 34979780371](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/34979780371),
  success) built `claude/sauce-visual-polish-fix4-daojxu` at `e232a18`
  and pushed it into `site/`. Its downstream `Deploy Preview to GitHub
  Pages` workflow did not auto-fire from that push (a `GITHUB_TOKEN`-authored
  push does not trigger other workflows' `push` events, a standard GitHub
  Actions safeguard against infinite loops) -- it was dispatched manually
  as this round's own extra step
  ([run 34979928552](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/34979928552),
  success, `head_sha: dd92293`). Noted here since it's a real difference
  from the semi-automatic flow the README describes, in case a future
  round hits the same "the push went through but Pages never updated"
  confusion.
- **Verification:** this environment's outbound network policy blocks
  direct HTTPS access to `*.github.io` (confirmed via `curl`, same
  limitation noted in every prior report in this series), so the live
  page itself could not be fetched from here as an independent check;
  the deployed bundle's own content (badge string, source SHA) was
  instead confirmed directly from the pushed `site/` files.

## Remaining Human Feel risks

- **Physical device confirmation is still outstanding.** This report, like
  Fix 1/2/3's, establishes the fix in a real desktop-Chromium browser at
  the exact 390x844 viewport, not an actual iPhone Safari retest.
- **The alpha curve's three constants (`ALPHA_FLOOR`/`ALPHA_CAP`/
  `DENSITY_AT_CAP`) are tuned against this game's own measured field
  values, not a physical-device color-calibration pass** -- an OLED vs.
  LCD iPhone, screen brightness, or ambient light could still shift how
  vivid/saturated the result reads in practice; this is exactly the kind
  of thing only a physical device confirms.
- **`量` (quantity) hitting the dispenser's 100% cap in state D is a real
  in-game state** (the bottle empties), not a chosen demo number --
  worth keeping in mind if a future round wants an even higher densities
  ceiling for "thick" specifically.

## FINAL VERDICT

**READY FOR FINAL IPHONE GATE**

The one MINOR FIX item from the latest Gate -- painted sauce reading as
"the dough got a little pink" rather than "tomato sauce was spread on
it" -- is addressed with a re-tuned alpha curve built directly from this
game's own measured field values (not round numbers), plus a small color
SSOT cleanup, while Fix 3's bilinear/smooth rendering, the 16x16 field
architecture, the Target Area Guide, and every other previously-PASSed
item (Ingredient Palette, physical drag, PREPARE layout, full flow) stay
completely untouched (`git diff --stat` confirms only the three sauce
files changed). The full check suite (tsc/oxlint/vitest 447 tests/build/
`git diff --check`), a live 390x844 browser run covering every PREPARE
sauce state through RESULT with zero scroll and zero console errors, and
a direct before/after comparison against the unmodified Fix 3 build all
pass cleanly against the commit now deployed to the Preview URL above.
As with every round in this series, final sign-off still requires an
actual iPhone Safari confirmation against that URL.
