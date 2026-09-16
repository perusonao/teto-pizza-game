# PIZZA_GAME Phase 4A-1B: iPhone Human Feel Fix 2 Result

## Summary

Physical iPhone retest of Fix 1
(`docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix_Result.md` --
drag threshold + iOS Safari callout/selection suppression) came back
**FAIL** again: "操作性は変わらない。チーズやトッピングが横スクロールする
のが原因だと思う" ("operability hasn't changed. I think the cause is that
cheese/topping scroll horizontally"). This Human Feel Fix 2 round covers
the two themes the brief scoped it to:

- **A. Ingredient Palette** — removes the Ingredient Tray's horizontal
  scroll entirely and replaces it with a fixed, non-scrolling 3-column x
  2-row grid, on the hypothesis that the real cause was two touch gestures
  — "scroll the tray" and "drag a piece onto the pizza" — sharing the same
  single-finger swipe.
- **B. Sauce Painting Visual/Scoring Discoverability** — a follow-up
  request in the same round: the sauce-paint mechanic itself reads as "a
  thick red line drawn on the dough" rather than "sauce spreading", and
  there was no way to tell what a good paint job looked like before
  BAKE/RESULT. Covered in its own section below.

- **Source PR:** #26 (untouched — not merged, rebased, or force-pushed)
- **Branch:** `claude/phase-4a-1b-human-feel-preview-1byr1k`
- **Part A commit:** `df54072`
- **Part B commit:** `292c152`
- **Previous (Fix 1) commit this round builds on:** `f375e19`

## Part A: Ingredient Palette

### Root cause

`.ingredient-chip--physical` used `touch-action: pan-x` so the tray could
still scroll horizontally when the same chip a drag might start on was
touched. That setting doesn't just permit horizontal scroll — it puts
iOS Safari's gesture recognizer into "wait and see if this is a horizontal
pan" mode for every touch on a physical chip, regardless of how the
JS-side drag-intent angle gate (`hasPieceDragIntent`, unchanged since Fix 1)
resolves it. Fix 1 addressed the callout/selection contest and the
threshold distance, but left this specific arbitration in place — which is
exactly what the user's own diagnosis (horizontal scroll) pointed back to.

### Fix

**Scope, deliberately narrow** (see
`docs/design/PIZZA_GAME_Phase4A-1B_Ingredient-Palette-Fixed-Grid_Design.md`
for the full reasoning and the follow-ups this intentionally deferred):
category tabs (Sauce/Cheese/Topping) are unchanged, no new
ingredient-selection screen, and which ingredients are owned is unchanged.
Only the tray's layout and touch-action changed, so this retest can
isolate whether the gesture conflict was the actual cause.

- **`src/data/ingredients.ts`**: added `MAX_INGREDIENT_PALETTE_SLOTS = 6`.
  Every category owns <=6 ingredients today (Sauce 3, Cheese 4, Topping 6),
  so this is a no-op cap in practice — it exists so a future 7th unlock
  (e.g. `onion`-style progression) can't silently need scroll back, per the
  task brief's "7個以上は今回は横scrollへ戻さない" instruction.
- **`src/components/IngredientTray.tsx`**: the rendered item list is
  `.slice(0, MAX_INGREDIENT_PALETTE_SLOTS)` before mapping to chips.
- **`src/App.css`**:
  - `.ingredient-tray`: `display: flex; overflow-x: auto;` (scroll
    container) → `display: grid; grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);` — no `overflow-x` anywhere, no
    scroll container exists to conflict with the drag gesture.
  - `.ingredient-chip`: dropped the fixed `min-width: 72px` / `flex-shrink:
    0` (no longer meaningful in a grid), raised `min-height` to `76px`. At
    390px width each chip's grid cell measured ~117px wide in a live
    browser check (see Verification) — a materially larger touch target
    than the old fixed 72x72px chip, satisfying the brief's "touch target
    を確保しやすいサイズに" ask without any extra markup.
  - `.ingredient-chip--physical`: `touch-action: pan-x` → `touch-action:
    none`. With no scroll left to preserve, this is the same "nothing for
    the browser to arbitrate" setting `.pizza-dough--interactive` already
    uses for the sauce-paint gesture — the "iOS Safariでdrag開始を阻害し
    ない最小設定" the brief asked for.
  - `.ingredient-chip--grabbing` (Fix 1's instant touch-feedback state)
    gained `position: relative; z-index: 1` so its `scale(1.08)` renders
    above its grid neighbors instead of underneath them.

**Left unchanged, as instructed:** drag threshold (4px, Fix 1), grab
feedback, RESET abort, outside-drop, `pointercancel`, `lostpointercapture`,
`blur`, `visibilitychange`, multi-touch safety, tap fallback, keyboard
fallback (Escape). None of `IngredientTray.tsx`'s session-lifecycle code
changed — only the item list feeding it and the CSS around it.

### Future genre-tab split (design note only, not implemented)

Per the task brief, category subdivision was deliberately **not**
implemented this round, so the gesture-conflict fix's effect stays
isolated and measurable on its own. The candidate future split — Sauce /
Cheese / Meat-Seafood / Vegetable / Herb / Finish — is recorded in
`docs/design/PIZZA_GAME_Phase4A-1B_Ingredient-Palette-Fixed-Grid_Design.md`
for when a category needs more than 6 owned ingredients.

### Regression tests (new)

`src/components/IngredientTray.palette.test.tsx` (7 tests, all passing):

1. Renders every owned ingredient in a category that owns <=6 (today's
   normal case, matches pre-fix behavior).
2. Caps the Palette at `MAX_INGREDIENT_PALETTE_SLOTS` even when 7 are
   owned (forced via a fixture that owns every Topping ingredient
   including the normally-locked `onion`) — confirms the grid never
   silently grows past 6 rather than falling back to scroll.
3. The tray container carries no scroll-related class/inline style (a
   structural smoke check — jsdom doesn't apply the stylesheet, so the
   real `overflow-x` behavior is the browser check under Verification
   below, not this test).
4. Physical drag onto the pizza still works from the capped grid.
5. Tap fallback (click, no drag) still selects an ingredient.
6. `RESET_PIZZA` mid-drag still discards a stale physical-drag session in
   the new grid (re-verifies the Fix-1-era P2 fix against the new layout).
7. Outside-drop still places nothing in the new grid.

`IngredientTray.physicalDragReset.test.tsx` (the full existing safety-net
suite — RESET-mid-drag, outside-drop, `pointercancel`,
`lostpointercapture`, `blur`, `visibilitychange`, multi-touch) was
re-run unmodified and still passes against the grid layout.

## Part B: Sauce Painting Visual/Scoring Discoverability

Goal (brief): make "spread sauce thin and even, from the center to just
short of the crust" understandable without an explanation, by fixing what
the interaction *shows* the player and what it *tells* them, without
touching legacy authoritative scoring (`../logic/scoring.ts`) or anything
downstream of it.

### 1. Sauce Visual

`PizzaStage.tsx`'s dispense session no longer draws the raw pointer-path
trail (the thick red SVG stroke) — that stroke is exactly what read as "a
red marker drawing a line" rather than "sauce spreading". The field-derived
heatmap (already the metrics' own source of truth, `sauceField.ts`'s
16x16 grid, unchanged) is now the *only* sauce visual for a reference
tomato-sauce session, and it already updates live every 50ms tick. The
legacy trail-drag path used by every other sauce/Mission play is untouched.

The heatmap's own cells changed from hard-edged rects to soft overlapping
circles (radius 0.75x the cell size, so neighbors blend into each other)
plus a 1px CSS `blur` on the canvas — adjacent deposits now visually
connect into one continuous surface instead of a visible 16x16 grid. Same
field data, same single canvas, no new render pass, no WebGL. Alpha still
scales with each cell's density (thin = translucent/dough shows through,
overlapped = darker, up to a cap) — one continuous gradient covers "thin" /
"well-painted" / "overlapped" rather than three hand-authored visual
states.

### 2. Target Area Guide

A new geometry constant, `SAUCE_TARGET_RADIUS = 40` (`sauceField.ts`,
vs. `DOUGH_RADIUS`'s 48 — an 8-point rim margin), drives a faint dashed
ring rendered on the dough during Practice/Prototype (`PizzaStage.tsx`,
shown only while `referenceModeEnabled && interactive`) and on the
Reference Pizza mini preview (`ReferencePreview.tsx`). Both read the exact
same constant, and it's also what the new edge scoring below (section 5)
uses — see "same source of truth" below.

### 3. Player-facing Evaluation

`SauceMetricsPanel`'s always-visible row is now three tiers — 広さ (`◎/○/×`,
coverage vs. the reference target), 均一さ (evenness, self-normalized),
ふち (edge — how much sauce stayed off the rim/crust) — under a "ソースの
でき" heading, replacing the four raw percentages that used to sit there
unconditionally. Those four numbers (量/被覆/均一性/はみ出し), a new ふち量
percentage, and the shadow-similarity readout all still exist, moved into
the same "🧪 Prototype Metrics（開発用）" expandable detail that already
held the shadow score — nothing was deleted, just relocated behind the
existing dev/QA toggle.

### 4. Live Feedback

One short message (`src/logic/sauceEvaluation.ts`'s `deriveSauceLiveMessage`),
shown only while a dispense session has buffered deposits
(`isDispensingSauce`, `pendingSauceDeposits.length > 0` in `App.tsx`) —
never while idle, never stacked with a previous message:

| Condition | Message |
| --- | --- |
| edge ratio too high (painted into the rim band or past the dough) | 「耳は残そう」 |
| else, coverage too low relative to the reference | 「もう少し広げよう」 |
| else, unevenness too high | 「厚いところを広げよう」 |
| else | 「いい感じ！」 |

Priority is deliberately edge-first: a rim violation always wins the
message even when coverage also reads low (this is exactly Human Feel Gate
scenario C below).

### 5. Scoring Truth (same source of truth)

`SAUCE_TARGET_RADIUS` is the *only* boundary behind both the guide's
geometry and the new `edgeAmount`/`edgeRatio` fields on `SauceMetrics`
(`sauceField.ts`) — there is no second, independently-tuned "is this too
close to the edge" number anywhere. `circleOverlapFraction` generalizes the
existing rim-continuity math (`insideDoughFraction`, unchanged in behavior)
to any radius, so `insideDoughFraction`/`insideTargetFraction` share one
continuity guarantee (no discontinuous jump for a deposit a fraction of a
percent from either boundary — pinned by `sauceField.test.ts`).
`edgeAmount` counts both the rim band still technically on the dough *and*
true overflow as the same player mistake ("sauce that isn't staying inside
the target area"), which is what lets the guide ring and the ふち
tier/message agree in every case, including the "painted right up to but
not past the dough edge" case that pure `overflowRatio` alone would have
missed. The reference fixture's own `edgeRatio` is pinned near 0 (it never
touches the rim band it warns players away from) — see
`sauceField.test.ts`.

All of this is additive to `SauceMetrics`/lives in `sauceEvaluation.ts`,
both already explicitly shadow-only (see `referenceScoring.ts`'s file
header) — implemented as Phase 4A shadow evaluation, per the brief.
`scorePizza`/`ScoreBreakdown` (`../logic/scoring.ts`), Dex BEST/★, Mission
scoring, Pitz/Shop, and progression were not touched by this change.

### 6. Human Feel Gate

`src/logic/sauceEvaluation.test.ts` encodes the brief's own four scenarios
as concrete, literally-paintable deposit sequences (same spirit as
`referencePizza.ts`'s own fixture) and asserts both the tier and the exact
live-message text:

| Scenario | Result |
| --- | --- |
| A. Center only | 広さ `×`, message 「もう少し広げよう」 |
| B. Partial overlap (even spread + a thick pile in one spot) | 均一さ `×`, message 「厚いところを広げよう」 — 広さ/ふち not poor |
| C. Painted to the ear (rim band, still on the dough) | ふち `×`, message 「耳は残そう」 — even though 広さ also reads poor |
| D. The reference fixture itself | all three `◎`, message 「いい感じ！」 |

`SauceMetricsPanel.test.tsx` re-verifies A and D at the component layer
(actual rendered tier symbols/message text, plus that the message is
absent when `isDispensing` is false). All of this is re-verified live in a
real browser under Verification below, with screenshots.

## Verification

Run from `perusonao/teto-pizza-game` at commit `292c152`:

| Check | Result |
| --- | --- |
| `tsc -b` | Pass |
| `oxlint` | Pass |
| `vitest run` | Pass — 31 files / 428 tests |
| `vite build` | Pass |
| `git diff --check` | Pass |
| Scope guard | No changes to save schema, Dex BEST, stars, Mission, Pitz, Shop, progression, or `scoring.ts` (confirmed via `git status`/diff over both commits) |

**Browser verification (Playwright + Chromium, 390x844 viewport).**

Full required flow: HOME → GAME → Margherita → Sauce (tap tomato) →
Cheese (drag Mozzarella x3) → Topping (drag Basil x2) → BAKE → RESULT.
`document.documentElement.scrollWidth === clientWidth === 390` (**horizontal
overflow 0**) confirmed at every screen (PREPARE-Sauce/Cheese/Topping,
BAKE, RESULT); BAKE → RESULT completed normally (★4 / 81 points); zero
`pageerror`/console-error events across the entire run. Live-measured
Cheese-tab grid: 3 columns x up to 2 rows, ~117px-wide chips (vs. the old
fixed 72x72px), with `.ingredient-chip--grabbing` confirmed present
immediately after `pointerdown`.

Sauce Human Feel Gate, painted live (real held pointer drags, not
simulated deposits) against the running app:

- **Scenario A** (small jitter at dough center): panel read 広さ`×`
  均一さ`×` ふち`◎`, live message 「もう少し広げよう」. Screenshot shows a
  soft blended blob at the center — no red line — inside the dashed guide.
- **Scenario C** (drag around a ring near the rim, radius ≈45/48): panel
  read 広さ`×` 均一さ`○` ふち`×`, live message 「耳は残そう」 — confirmed
  edge wins the message despite coverage also being poor, live in the
  browser, not just in the unit test. Screenshot shows faint dots sitting
  outside the dashed guide ring, right at the crust.
- **Scenario D** (four concentric ring passes approximating the reference
  fixture's own ring radii): reached 広さ`○` 均一さ`◎` ふち`◎` after two
  passes at each ring (real-time-gated dispensing means a live drag can't
  hit the fixture's exact deposit sequence, so this reads "good", not
  quite "great" — the exact fixture itself is what
  `sauceEvaluation.test.ts` pins at all-`◎`). Screenshot shows a broad,
  soft, naturally-shaded sauce spread — darker where passes overlapped
  near the center, translucent (dough visible) toward the edge, staying
  inside the guide ring.
- **Reference popover**: the mini pizza now shows the same dashed target
  guide ring just inside its crust.

This confirms the new visual/panel/message wiring renders and behaves
correctly in a real browser, and that the exact Human Feel Gate priority
(edge beats coverage for the *message*, scenario C) holds under a real
held drag, not only the pure-function unit tests. **It does not by itself
confirm the iPhone Safari "feels unresponsive"/"looks like a red line"
complaints are resolved on a physical device** — that confirmation is what
the Preview URL below is for.

## Production impact

None. `perusonao/teto-pizza-game`'s `main` branch, its GitHub Pages
deployment, and its Actions were not touched by either commit. All changes
live on `claude/phase-4a-1b-human-feel-preview-1byr1k` only; PR #26 was
not merged, rebased, or force-pushed.

## Preview

- **Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
- **Source PR:** #26
- **Source SHA (branch HEAD this preview builds):** `292c152`
- **Preview deploy commit:** `fd8aeef` (`perusonao/teto-pizza-game-preview`,
  `main`)
- **PREVIEW badge:** now reads `PREVIEW · PR#26 · 292c152` — confirmed
  present in the built JS bundle before deploying.
- `perusonao/teto-pizza-game-preview` remains fully separate from
  `teto-pizza-game`'s production Pages/`main`/Actions; only the preview
  repo's own `main` (and therefore only
  https://perusonao.github.io/teto-pizza-game-preview/) was updated.
- **Deploy status:** `perusonao/teto-pizza-game-preview` run
  [34971355207](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/34971355207)
  (`Deploy Preview to GitHub Pages`) completed with `actions/deploy-pages@v4`
  reporting `success`, confirmed via the GitHub Actions API. As with
  earlier reports, this environment's outbound network policy blocks
  direct HTTP access to `*.github.io`, so the live page could not be
  curled from here as a second, independent check.

## FINAL VERDICT

**READY FOR IPHONE RETEST**

Both mechanisms the user's own diagnosis and this round's brief pointed
at — the tray's horizontal scroll competing with the drag gesture (Part A),
and the sauce trail reading as "a red line" instead of "spreading sauce"
with no in-the-moment feedback (Part B) — are addressed directly rather
than incrementally tuned. The full check suite, a live 390x844 end-to-end
flow, and a live re-enactment of all four Human Feel Gate sauce scenarios
all pass cleanly against the same commit now deployed to the Preview URL
above. As with Fix 1, final sign-off still requires an actual iPhone
Safari confirmation against that URL — this report establishes the
identified causes are addressed and the build is sound, not that the
physical retest has already passed.
