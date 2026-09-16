# PIZZA_GAME Phase 4A-1B: iPhone Human Feel Fix 3 Result

## Summary

Physical iPhone Human Feel Gate on Fix 2
(`docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix2_Result.md`):

| Area | Result |
| --- | --- |
| Ingredient Palette | **PASS** |
| Sauce operation (gesture) | 成立 (works) |
| Sauce Visual / Scoring Discoverability | **FIX REQUIRED** |
| PREPARE 1-screen layout | **FIX REQUIRED** |

This round (Fix 3) leaves the Ingredient Palette's gesture architecture
completely untouched (it already passed) and addresses the two remaining
FIX REQUIRED items: PREPARE overflowing 390x844 (the Bake CTA scrolled off
screen), and painted sauce still visibly tiling into a 16x16 grid/stamp
pattern despite Fix 2's overlapping-circle cells.

- **Source PR:** #26 (untouched — not merged, rebased, or force-pushed)
- **Branch:** `claude/phase-4a-1b-human-feel-preview-1byr1k`
- **Fix commit:** `564fd52`
- **Previous (Fix 2) commit this round builds on:** `2d05c3e`

Before starting, per the brief's instruction, the branch's actual
GitHub/origin state was fetched and confirmed to match the local working
tree exactly (`2d05c3e`, clean) and PR #26 confirmed still open/unmerged —
no existing work was at risk of being lost.

## A/B. PREPARE 1-screen + Fixed Bake CTA

### Root cause

`state.hint` (`data/hints.ts`'s `buildHintLine`) is **never null** during
PREPARE — it always holds live progress guidance ("まずはトマトソースを
塗ってみて！" → "とろっとしたモッツァレラを…" → "いい感じ！「焼く！」を
押してみよう。"). PREPARE was therefore always rendering the full
character-portrait `DialogueBox` (48px avatar + speech bubble, ~90-100px)
*and* a separate `.reference-tools-row` just for the 見本 button, on top
of the full-size Pizza Stage, the (until this round, always-visible)
Sauce evaluation panel, the 3x2 Ingredient Palette, and the action row —
comfortably taller than 844px. The Bake CTA sat at the very end of that
flow via `.action-row`'s `margin-top: auto`, a trick that only pushes an
element to the bottom of content that *already* fits inside the flex
container — once PREPARE grew past the viewport, it silently stopped
working and the CTA scrolled off screen.

### Fix

- **Compact order-card** (`src/screens/GameScreen.tsx`, `.order-card` in
  `src/App.css`): one row combining the recipe name, the *same* live
  `state.hint` text (now without the portrait/bubble chrome), and the
  *same* `<ReferencePreview>` component inline — its own popover/modal is
  completely unchanged, only where its trigger button sits moved. This
  replaces both the old hint `DialogueBox` and `.reference-tools-row`.
  `dialogue-area` itself no longer renders at all during PREPARE (it's
  still used, unchanged, by ORDER/BAKE/RESULT/DISCOVERED).
- **Fixed Bake CTA bar** (`.prepare-bake-bar`): PREPARE's action row
  (やり直す/焼く！/ヒント) now uses `position: fixed`, anchored to the
  *viewport* (not `.app-frame`, which a fixed element ignores) — centered
  and width-capped at 390px by hand to match `.app-frame`'s own centering,
  with `env(safe-area-inset-bottom, 0px)` in its bottom padding.
  `.ingredient-panel` gained matching `padding-bottom` so the bar can
  never cover the Palette above it. This is a structurally different
  mechanism from the old `margin-top: auto`, not a tuned version of it —
  it stays visible regardless of how tall the rest of PREPARE's content
  is.
- **Disabled-state check**: `gameReducer.ts`'s `START_BAKE` case
  transitions unconditionally (`return { ...state, phase: "BAKE" }`) —
  there is no existing "can't reach BAKE yet" rule in the game logic
  today, so there is nothing for the Bake CTA to disable against.
  Inventing one would be a new gameplay rule, out of this round's (Human
  Feel/layout) scope — noted here per the brief's "if such a state
  exists" phrasing, rather than silently skipped.
- **Ingredient Palette untouched**: `git diff --stat` for this round shows
  no changes to `IngredientTray.tsx` or `pieceDrag.ts`; a live
  re-measurement in a real browser (see Verification) confirms the grid
  is still 3 columns x ~117px with no scroll container.

## C. Compact Header/Reference

Same change as A/B's order-card above — recipe name + hint + 見本 in one
card, replacing what used to be two separate, taller elements. Reference
Pizza is not shown large/permanently (only the compact 見本 trigger sits
on screen; the full preview stays behind the existing popover/modal,
opened on tap, exactly as before). HOME/GAME screen structure
(`App.tsx`'s `screen` state machine) was not touched.

## D. Sauce Visual Fix 3

### Root cause

Fix 2 replaced flat `fillRect` cells with overlapping circles (radius
0.75x the cell size) to blend neighbors together. In a real render at
full opacity, each circle's own crisp edge still tiled into a visible
"flower/stamp" pattern — better than a hard grid, but still readable as
"painting 16x16 cells" rather than "spreading sauce", per the Gate's FIX
REQUIRED.

### Fix

`src/logic/sauceField.ts` gained `sauceFieldToRgbaPixels(field)` — a pure
function (no Canvas API) turning the 16x16 field into one RGBA pixel per
cell (same alpha formula as Fix 2: `min(0.85, value * 2.2)`, out-of-dough
and untouched cells fully transparent). `PizzaStage.tsx`'s heatmap effect
writes that buffer 1:1 into a tiny `SAUCE_FIELD_SIZE`x`SAUCE_FIELD_SIZE`
offscreen canvas, then draws it scaled up onto the real heatmap canvas
with `ctx.imageSmoothingEnabled = true` / `imageSmoothingQuality = "high"`
— the browser's own image upscaler performs the interpolation, blending
every cell into its neighbors continuously. There is no per-cell shape or
edge left to tile at all. Still the same 16x16 field (`SAUCE_FIELD_SIZE`
unchanged), still Canvas2D only (no WebGL), still one extra small canvas
+ one `drawImage` call — the brief's "既存architectureに対する最小変更".
The 16x16 field remains exactly what it always was as a *data* structure
(scoring/coverage/evenness math in `computeSauceMetrics` is completely
unchanged); only how it gets turned into pixels for display changed.

Visually (see Verification screenshots): painted sauce now reads as a
soft, continuous, naturally-shaded blob/spread — darker where overlapped,
translucent (dough visible) where thin — with no grid, square, or
flower-petal pattern visible at any zoom level tested.

## E. Sauce Target Guide

Same `SAUCE_TARGET_RADIUS` SSOT as Fix 2 (unchanged value, still the one
constant behind both the guide's geometry and `edgeAmount`/`edgeRatio`
scoring — see Fix 2's report for that source-of-truth argument, still
true). Only the guide ring's own stroke changed: opacity 0.22 → 0.4 and
width 0.6 → 1.1 (SVG units) on the main dough, opacity 0.3 → 0.4 and
width 1px → 1.5px on the Reference mini preview — "現在より実機で認識できる
ように" while staying a plain dashed line (no glow, no color change, no
animation), so it still reads as a hint rather than competing with the
sauce itself once painting starts covering it.

## F. Evaluation UI

`SauceMetricsPanel` now renders only while `activeCategory === "sauce"`
(new condition in `GameScreen.tsx`) — completely absent from the DOM for
Cheese/Topping, rather than always-visible as in Fix 2. This alone is most
of this panel's contribution to the 1-screen budget being reclaimed for
2 of the 3 categories. Positioned directly below Pizza Stage (not beside
it): a true side-by-side layout, as sketched in early mockups, would mean
shrinking the dough itself to make horizontal room, which section A's
"Pizza操作領域を極端に縮小しない" rules out as this round's tradeoff — noted
under Remaining Risks below as a legitimate future direction, not pursued
here. The panel's own content (three tiers + one live-message line, the
detailed quantity/coverage/evenness/overflow/edgeRatio numbers behind the
already-collapsed-by-default "🧪 Prototype Metrics（開発用）" toggle) is
unchanged from Fix 2.

## G. Ingredient Palette

Not touched this round, by design (it already PASSed the Gate). Every
item on the brief's "maintain" list — 3x2 grid/max 6 slots/no horizontal
scroll/no touch-action conflict/pointerdown grab feedback/drag threshold/
tap fallback/keyboard fallback/RESET abort/outside drop/pointercancel/
lostpointercapture/blur/visibilitychange/multi-touch safety — lives in
`IngredientTray.tsx`/`pieceDrag.ts`/their CSS, none of which this round's
diff touches (confirmed via `git diff --stat`, see Verification).

## Regression tests (new)

`src/App.humanFeelFix3.test.tsx` (8 tests, real end-to-end `<App/>`
render, same pattern as the existing `App.test.tsx`):

1. The compact order-card renders with recipe name + live hint text +
   見本 button; the old per-phase `.dialogue-area` is absent during
   PREPARE.
2. The Reference popover (existing, unchanged) still opens from the
   order-card's 見本 button.
3. The PREPARE action row carries the `.prepare-bake-bar` class.
4. Ingredient Palette is still a non-scrolling grid.
5-8. `SauceMetricsPanel`/"ソースのでき" shows on the default Sauce tab,
   is absent on Cheese, absent on Topping, and reappears switching back
   to Sauce.

`src/logic/sauceField.test.ts` gained a `sauceFieldToRgbaPixels` describe
block (5 new tests): exact `SAUCE_FIELD_SIZE^2 * 4`-byte buffer size, an
empty field is fully transparent, out-of-dough cells stay transparent
even where the brush falloff numerically reaches them, a touched cell
gets the correct color/non-zero alpha, and alpha is monotonic in density
(more overlap never reads lighter). This is the regression guard for
"never falls back to raw square-grid rendering": if a future change
reintroduces per-cell shape drawing instead of this one-pixel-per-cell
buffer, this file's tests are the ones that would need to change to match
it, making that revert visible in review.

Every existing test (Fix 1/Fix 2's `IngredientTray.palette.test.tsx`,
`IngredientTray.physicalDragReset.test.tsx`, `sauceEvaluation.test.ts`,
`SauceMetricsPanel.test.tsx`, etc.) was re-run unmodified.

## Verification

Run from `perusonao/teto-pizza-game` at commit `564fd52`:

| Check | Result |
| --- | --- |
| `tsc -b` | Pass |
| `oxlint` | Pass |
| `vitest run` | Pass — 32 files / 441 tests |
| `vite build` | Pass |
| `git diff --check` | Pass |
| Scope guard | No changes to save schema, Dex BEST, stars, Mission, Pitz, Shop, progression, or `scoring.ts` (confirmed via `git status`/`git diff --stat` — only `App.css`, `PizzaStage.tsx`, `sauceField.ts`/`.test.ts`, `GameScreen.tsx`, plus the new test file) |

**Browser verification (Playwright + Chromium, 390x844 viewport)** — the
full required flow: HOME → GAME → Margherita → Sauce (paint) → Cheese
(drag Mozzarella x3) → Topping (drag Basil x2) → BAKE → RESULT.

At every PREPARE step (Sauce in each of 5 painted states below, Cheese,
Topping) the following were measured programmatically, not eyeballed:

| Step | vertical scroll | horizontal scroll | Bake CTA visible | console errors |
| --- | --- | --- | --- | --- |
| Sauce — A (before painting) | 0 | 0 | true | 0 |
| Sauce — B (partial) | 0 | 0 | true | 0 |
| Sauce — C (uneven) | 0 | 0 | true | 0 |
| Sauce — D (edge overflow) | 0 | 0 | true | 0 |
| Sauce — E (good coverage) | 0 | 0 | true | 0 |
| Cheese (3 Mozzarella placed) | 0 | 0 | true | 0 |
| Topping (2 Basil placed) | 0 | 0 | true | 0 |
| BAKE | 0 | 0 | true (取り出す！, same `.cta-button--bake` class) | 0 |
| RESULT | 0 | 0 | n/a | 0 |

`vertical scroll`/`horizontal scroll` = `document.documentElement.scrollHeight
- clientHeight` / `scrollWidth - clientWidth`, both exactly `0` at every
step — genuinely zero page scroll, not "close enough". `Bake CTA visible`
= the `.cta-button--bake` element's `getBoundingClientRect()` fully within
the viewport.

Ingredient Palette re-measured live: still `display: grid`,
`grid-template-columns: 116.656px 116.672px 116.656px` (3 columns), chips
117x78px, `overflowX: visible` (no scroll container) — identical to Fix
2's own measurement.

Sauce painted-state screenshots (all captured, visually reviewed):

- **A (before painting)**: bare dough, dashed target guide ring clearly
  visible, no sauce.
- **B (partial)**: a soft, single translucent blob near where painted —
  no grid/square pattern.
- **C (uneven)**: an irregular, off-center-weighted blob (visibly denser
  where the extra pile was painted) — still fully smooth, no tiling.
- **D (edge overflow)**: faint marks sitting on/near the guide ring at
  the rim — visibly distinct from the interior "good" fill.
- **E (good coverage)**: a broad, soft, naturally-shaded spread staying
  inside the guide ring, darker toward the center, translucent (dough
  visible) toward the edge.

BAKE → RESULT completed normally (★4 / 81 points) with all 3 Mozzarella +
2 Basil visible on the finished pizza, matching the pre-Fix-3 baseline —
confirming the layout/visual changes didn't regress placement or bake
logic.

**What this does and does not confirm**: this confirms the new layout
fits 390x844 with zero scroll and the Bake CTA stays reachable regardless
of sauce/category state, and that the sauce visual no longer tiles into a
grid pattern, all in a real browser (not jsdom, which has no real layout
engine and a no-op canvas). **It does not by itself confirm the physical
iPhone Safari experience** — real Safari chrome (URL bar collapse
behavior, the actual safe-area-inset-bottom value on a notched device,
real touch latency) can only be confirmed on-device. That confirmation is
what the Preview URL below is for.

## Production impact

None. `perusonao/teto-pizza-game`'s `main` branch, its GitHub Pages
deployment, and its Actions were not touched. All changes live on
`claude/phase-4a-1b-human-feel-preview-1byr1k` only; PR #26 was not
merged, rebased, or force-pushed.

## Preview

- **Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
- **Source PR:** #26
- **Source SHA (branch HEAD this preview builds):** `564fd52`
- **Preview deploy commit:** `04dcad3` (`perusonao/teto-pizza-game-preview`,
  `main`)
- **PREVIEW badge:** now reads `PREVIEW · PR#26 · 564fd52` — confirmed
  present in the built JS bundle before deploying.
- **Deploy status:** `perusonao/teto-pizza-game-preview` run
  [34976724043](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/34976724043)
  (`Deploy Preview to GitHub Pages`) — status confirmed via the GitHub
  Actions API before this report was finalized (see the session's own
  polling; this environment's outbound network policy blocks direct HTTP
  access to `*.github.io`, so the live page itself could not be curled
  from here as a second, independent check, same limitation noted in
  every prior report in this series).

## Remaining Human Feel risks

- **Physical device confirmation is still outstanding** for all three
  rounds' fixes — this report (like Fix 1/Fix 2's) establishes that the
  identified causes are addressed and the build is sound in a real
  desktop-Chromium browser, not that an actual iPhone Safari retest has
  passed.
- **Evaluation panel is below the Pizza Stage, not beside it.** The brief
  allowed this ("可能ならPizza Stage近くに"); a true side-by-side layout
  was intentionally not attempted this round because it would require
  shrinking the dough, which conflicts with "Pizza操作領域を極端に縮小し
  ない". If a future round wants the panel beside the pizza, that's a
  real layout redesign (the dough's own box drives the coordinate system
  every sauce/topping/guide calculation is keyed off), not a small
  follow-up.
- **`env(safe-area-inset-bottom)` could not be exercised in this
  environment.** Chromium in this sandbox reports `0` for it (no real
  device notch/home-indicator to simulate), so the fixed Bake CTA bar's
  bottom padding on an actual notched iPhone is untested here — the CSS
  itself is standard and widely supported, but this is exactly the kind
  of thing only a physical device confirms.
- **No Bake-CTA disabled state exists to verify**, because none exists in
  `gameReducer.ts` today (see section A/B) — if a future round adds one
  (e.g. requiring sauce before baking), its disabled styling will need
  its own verification pass.

## FINAL VERDICT

**READY FOR IPHONE RETEST**

Both FIX REQUIRED items from this round's Human Feel Gate — PREPARE not
fitting 390x844 (Bake CTA unreachable without scrolling) and the sauce
visual still reading as a 16x16 grid — are addressed with structural
fixes (a viewport-anchored fixed CTA bar, not a layout trim; bilinear
pixel interpolation, not a bigger blur radius) rather than incremental
tuning, and the Ingredient Palette's already-passing gesture architecture
was left completely untouched. The full check suite, a live 390x844
browser run covering every PREPARE state with zero scroll/CTA-visible
asserted programmatically, and five reviewed sauce-visual screenshots all
pass cleanly against the commit now deployed to the Preview URL above. As
with Fix 1 and Fix 2, final sign-off still requires an actual iPhone
Safari confirmation against that URL.
