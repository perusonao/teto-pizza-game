# PIZZA_GAME Phase 4A-1B: iPhone Human Feel Fix 2 Result

## Summary

Physical iPhone retest of Fix 1
(`docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix_Result.md` --
drag threshold + iOS Safari callout/selection suppression) came back
**FAIL** again: "操作性は変わらない。チーズやトッピングが横スクロールする
のが原因だと思う" ("operability hasn't changed. I think the cause is that
cheese/topping scroll horizontally"). This round (Fix 2) removes the
Ingredient Tray's horizontal scroll entirely and replaces it with a fixed,
non-scrolling 3-column x 2-row grid ("Ingredient Palette"), on the
hypothesis that the real cause was two touch gestures — "scroll the tray"
and "drag a piece onto the pizza" — sharing the same single-finger swipe.

- **Source PR:** #26 (untouched — not merged, rebased, or force-pushed)
- **Branch:** `claude/phase-4a-1b-human-feel-preview-1byr1k`
- **Fix commit:** `df54072`
- **Previous (Fix 1) commit this builds on:** `f375e19`

## Root cause (this round)

`.ingredient-chip--physical` used `touch-action: pan-x` so the tray could
still scroll horizontally when the same chip a drag might start on was
touched. That setting doesn't just permit horizontal scroll — it puts
iOS Safari's gesture recognizer into "wait and see if this is a horizontal
pan" mode for every touch on a physical chip, regardless of how the
JS-side drag-intent angle gate (`hasPieceDragIntent`, unchanged since Fix 1)
resolves it. Fix 1 addressed the callout/selection contest and the
threshold distance, but left this specific arbitration in place — which is
exactly what the user's own diagnosis (horizontal scroll) pointed back to.

## Fix

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

## Future genre-tab split (design note only, not implemented)

Per the task brief, category subdivision was deliberately **not**
implemented this round, so the gesture-conflict fix's effect stays
isolated and measurable on its own. The candidate future split — Sauce /
Cheese / Meat-Seafood / Vegetable / Herb / Finish — is recorded in
`docs/design/PIZZA_GAME_Phase4A-1B_Ingredient-Palette-Fixed-Grid_Design.md`
for when a category needs more than 6 owned ingredients.

## Regression tests (new)

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

## Verification

Run from `perusonao/teto-pizza-game` at commit `df54072`:

| Check | Result |
| --- | --- |
| `tsc -b` | Pass |
| `oxlint` | Pass |
| `vitest run` | Pass — 29 files / 410 tests |
| `vite build` | Pass |
| `git diff --check` | Pass |

**Browser verification (Playwright + Chromium, 390x844 viewport)** — the
full flow: HOME → GAME → Margherita → Sauce (tap tomato) → Cheese
(drag Mozzarella x3) → Topping (drag Basil x2) → BAKE → RESULT.

- `document.documentElement.scrollWidth === clientWidth === 390` (i.e.
  **horizontal overflow 0**) checked and confirmed at every screen:
  PREPARE-Sauce, PREPARE-Cheese, PREPARE-Topping, BAKE, RESULT.
- Live-measured Cheese-tab grid: 3 columns x up to 2 rows, each chip
  ~117px wide x 78-82px tall (`grid-template-columns:
  116.656px 116.672px 116.656px`), vs. the old fixed 72x72px chip.
- All 3 Mozzarella + 2 Basil drags (mouse-simulated pointer events: down →
  move in small steps → up, mirroring a touch drag) landed successfully;
  `.ingredient-chip--grabbing` was confirmed present immediately after
  `pointerdown`, before any movement.
- BAKE → RESULT completed normally: ★4 / 81 points, no placement/bake
  logic regressed by the layout change.
- Zero browser console errors/`pageerror` events across the entire run.

This confirms the new grid renders and behaves correctly and produces zero
horizontal overflow in a real browser at the target viewport. **It does
not by itself confirm the iPhone Safari "feels unresponsive" complaint is
resolved** — Playwright's simulated pointer events cannot reproduce iOS
Safari's own touch-gesture arbitration, which is the actual mechanism this
fix targets. That confirmation is what the Preview URL below is for.

## Production impact

None. `perusonao/teto-pizza-game`'s `main` branch, its GitHub Pages
deployment, and its Actions were not touched. All changes live on
`claude/phase-4a-1b-human-feel-preview-1byr1k` only; PR #26 was not
merged, rebased, or force-pushed.

## Preview

- **Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
- **Source PR:** #26
- **Source SHA (branch HEAD this preview builds):** `df54072`
- **Preview deploy commit:** `7fdd6aa` (`perusonao/teto-pizza-game-preview`,
  `main`)
- **PREVIEW badge:** now reads `PREVIEW · PR#26 · df54072` — confirmed
  present in the built JS bundle before deploying.
- `perusonao/teto-pizza-game-preview` remains fully separate from
  `teto-pizza-game`'s production Pages/`main`/Actions; only the preview
  repo's own `main` (and therefore only
  https://perusonao.github.io/teto-pizza-game-preview/) was updated.
- **Deploy status:** `perusonao/teto-pizza-game-preview` run
  [34969188798](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/34969188798)
  (`Deploy Preview to GitHub Pages`) completed with `actions/deploy-pages@v4`
  reporting `success`, confirmed via the GitHub Actions API. As with Fix
  1's report, this environment's outbound network policy blocks direct
  HTTP access to `*.github.io`, so the live page could not be curled from
  here as a second, independent check.

## FINAL VERDICT

**READY FOR IPHONE RETEST**

The specific mechanism the user's diagnosis pointed at (tray horizontal
scroll competing with the drag gesture) is removed outright rather than
further tuned, the full check suite plus a live 390x844 browser run pass
cleanly, and the fix is deployed to the Preview URL above. As with Fix 1,
final sign-off still requires an actual iPhone Safari confirmation against
that URL — this report establishes the identified cause is addressed and
the build is sound, not that the physical retest has already passed.
