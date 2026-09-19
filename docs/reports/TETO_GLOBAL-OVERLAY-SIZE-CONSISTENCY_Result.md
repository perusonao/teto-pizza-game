# HOME Global Overlay Size Consistency — Result

## Summary

Dex / Shop / Inventory each opened `.dex-overlay__panel` with `max-height: 80%` and
`overflow-y: auto` applied directly to the panel, and no `height`. With no `height` set, the
panel's actual box was driven by its own content's intrinsic size (up to the 80% cap), not by a
fixed viewport rule. Inventory made this visible because its category tabs change item count
(3 items under "ソース" vs. more under "すべて"), so switching tabs visibly resized the panel and
moved its top/bottom edges. Dex and Shop happened to have enough content to sit near the 80% cap
most of the time, masking the same underlying bug.

Fixed by giving all three overlays one shared, viewport-derived panel size (`80dvh`, capped by
safe-area) and splitting the panel into a fixed header + a separate scrollable body, so content
length can only affect internal scrolling, never the panel's own box.

**FINAL VERDICT: A — GLOBAL OVERLAY SIZE CONSISTENT — READY FOR MERGE REVIEW**

## Audited main SHA

`db2e87bdaa983967bf897ac6a06ae41402b0d932` (origin/main, "Add read-only Inventory Screen (材料)
as a new HOME sub-navigation entry (#96)"). Branch `claude/home-global-overlay-size-lmspz2` was
created with this commit as an ancestor (verified via `git merge-base --is-ancestor origin/main
HEAD`), so no other overlay-affecting change landed on `main` mid-task.

## Duplicate PR gate

Checked both before starting and again immediately before opening the PR:

- `list_pull_requests` (state=open): #72 (docs), #46 (Issue #33 Dough Shaping D0 — in-game
  dough-shaping interaction design, unrelated to HOME overlays), #34 (Reference ingredient visual
  unification), #3 (docs). None touch Dex/Shop/Inventory overlay sizing.
- `search_pull_requests` for `overlay OR modal OR inventory OR shop OR dex OR home` (open, this
  repo): only #46, confirmed unrelated (see above).
- Local/remote branch search for `*overlay*`, `*modal*`, `*inventory*`, `*shop*`, `*dex*`,
  `*home*`: only this session's own branch.

No duplicate found either time. Proceeding was clear both at start and at PR time.

## Root cause

`src/App.css`, `.dex-overlay__panel` (pre-change):

```css
.dex-overlay__panel {
  width: 100%;
  max-height: 80%;
  background: #fff8ea;
  border-radius: 20px 20px 0 0;
  padding: 16px;
  overflow-y: auto;
}
```

- No `height` — only a `max-height` cap — so the panel's actual rendered height was determined by
  its children's intrinsic content height, clamped at 80%.
- `overflow-y: auto` was on the panel itself, not on a separate content region, so the header
  scrolled together with the content instead of staying fixed.
- `InventoryOverlay.tsx` had no CSS for `.inventory-overlay__panel` beyond this base rule, so
  switching its category tabs (which changes the number of `.inventory-card` children) directly
  changed the panel's own rendered height and, since the backdrop uses
  `align-items: flex-end`, its top edge moved with it.

## Before behavior (reproduced)

Confirmed pre-fix by rendering the original CSS: with the panel's height driven by content,
`すべて` (3 Starter ingredients on a fresh save) rendered taller than `ソース` (1 of those 3),
moving the panel's top edge down and shrinking its visible bottom sheet — exactly the reported
"外枠サイズが変化する" behavior. Dex/Shop were less obviously affected only because their
default content happened to be tall enough to sit near the 80% cap.

## Common sizing rule

New shared shell in `src/App.css` (`.dex-overlay__panel` / `.dex-overlay__header` /
`.dex-overlay__body`), used unmodified by Dex, Shop, and Inventory:

```css
.dex-overlay__panel {
  width: 100%;
  height: 80dvh;
  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 20px);
  background: #fff8ea;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dex-overlay__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 0 0 auto;
  padding: 16px 16px 0;
  margin-bottom: 12px;
}

.dex-overlay__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 16px calc(16px + env(safe-area-inset-bottom, 0px));
}
```

- `height: 80dvh` is a fixed, viewport-derived target — never a function of content — so it
  cannot shrink for a short list or grow for a long one.
- `max-height: calc(100dvh - env(safe-area-inset-top) - 20px)` is a safety cap only, so the panel
  never runs under the top safe area (notch) on a very short viewport; it never engages under
  normal circumstances since `80dvh < ` that cap on any realistic phone height.
- `overflow: hidden` on the panel + `display:flex; flex-direction:column` turns it into a shell of
  exactly two children: the fixed-size header (`flex: 0 0 auto`) and the scrollable body
  (`flex: 1 1 auto; min-height: 0; overflow-y: auto`). Only the body's own scroll position can
  change with content; the panel's box cannot.
- `env(safe-area-inset-bottom)` is now honored inside the body's own bottom padding (previously
  the panel's flat `padding: 16px` ignored it) — an incidental correctness improvement toward the
  "iPhone Safe Area維持" requirement, not a new feature.
- Shop's own `display:flex; flex-direction:column; gap:10px` (previously on `.shop-overlay__panel`,
  which no longer needs it) moved to a new `.shop-overlay__body` rule applied alongside
  `.dex-overlay__body` on Shop's own body wrapper — Shop's internal balance/feedback/list spacing
  is otherwise pixel-identical to before.

## Changed files

- `src/App.css` — the shared shell rule above; `.shop-overlay__panel` layout rule renamed/moved to
  `.shop-overlay__body`.
- `src/components/DexOverlay.tsx` — wrapped everything below the header (progress, list, footer
  CTA) in a new `<div className="dex-overlay__body">`.
- `src/components/ShopOverlay.tsx` — wrapped everything below the header (balance, feedback,
  empty state, product list) in `<div className="dex-overlay__body shop-overlay__body">`.
- `src/components/InventoryOverlay.tsx` — wrapped everything below the header (summary, category
  tabs, grid/empty state) in `<div className="dex-overlay__body">`.
- `src/App.globalOverlayShellSizing.test.tsx` — new structural test file (see Tests below).
- `docs/reports/screenshots/global-overlay-size-20260919/` — visual verification screenshots +
  raw geometry JSON (new).

No other files touched. `.dex-overlay__panel` / `.shop-overlay__panel` / `.inventory-overlay__panel`
class names on the panel element itself are unchanged (existing tests assert their presence to
distinguish which overlay is open), and no game-logic file (economy, reducer, inventory state,
save schema, MakingStepTabs, IngredientTray, Pizza Select) was touched.

## Dex/Shop/Inventory geometry comparison (measured via headless Chromium)

All figures are the `.dex-overlay__panel` element's `getBoundingClientRect()`, captured with a
real browser against the production build (`vite build` + `vite preview`), not jsdom (which
doesn't compute real CSS layout).

### 390×844

| scenario | x | y | width | height | bottom | horiz. overflow | console errors |
|---|---|---|---|---|---|---|---|
| Dex | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |
| Shop | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |
| Inventory / すべて | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |
| Inventory / ソース (3件→1件) | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |
| Inventory / チーズ | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |
| Inventory / トッピング | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |
| Dex (全7レシピ発見, long content) | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |
| Shop (全14材料所持, long content, **scrolls**) | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |
| Inventory / すべて (全14材料所持) | 0 | 168.81 | 390 | 675.19 | 844 | no | 0 |

Every row: identical x/y/width/height/bottom. Shop's long-content variant is the only one whose
body actually needed to scroll (`scrollHeight` 980 vs. `clientHeight` 607) — and its panel box is
still pixel-identical to the empty Shop.

### 360px width

| scenario | x | y | width | height | bottom | horiz. overflow | console errors |
|---|---|---|---|---|---|---|---|
| Dex | 0 | 160 | 360 | 640 | 800 | no | 0 |
| Shop | 0 | 160 | 360 | 640 | 800 | no | 0 |
| Inventory / すべて | 0 | 160 | 360 | 640 | 800 | no | 0 |
| Inventory / ソース | 0 | 160 | 360 | 640 | 800 | no | 0 |
| Inventory / チーズ | 0 | 160 | 360 | 640 | 800 | no | 0 |
| Inventory / トッピング | 0 | 160 | 360 | 640 | 800 | no | 0 |
| Dex (long content) | 0 | 160 | 360 | 640 | 800 | no | 0 |
| Shop (long content, **scrolls**) | 0 | 160 | 360 | 640 | 800 | no | 0 |
| Inventory / すべて (long content, **scrolls**) | 0 | 160 | 360 | 640 | 800 | no | 0 |

Same result: every panel box is identical across Dex/Shop/Inventory and across all 4 Inventory
categories, at both viewports. Border radius, header geometry (title baseline, close button
position/size, left/right padding) come from the same shared `.dex-overlay__header` rule for all
three, so they're identical by construction, not just by measurement.

Raw data: `docs/reports/screenshots/global-overlay-size-20260919/geometry-results.json`.

## Screenshots

`docs/reports/screenshots/global-overlay-size-20260919/`:

- `390x844_01_dex.png`, `390x844_02_shop.png`, `390x844_03_inventory-all.png`,
  `390x844_04_inventory-sauce.png`, `390x844_05_inventory-cheese.png`,
  `390x844_06_inventory-topping.png` — same panel top/bottom across all six.
- `390x844_07_shop-long-scroll.png` — long Shop content stays clipped inside the same panel box
  (internal scroll engaged, panel doesn't grow).
- `360w_01_dex.png` … `360w_06_inventory-topping.png` — same set at 360px width.

## Tests

- `npx vitest run` (full suite): **1402 passed**, 72 files (1397 pre-existing + 5 new).
- New file `src/App.globalOverlayShellSizing.test.tsx` (5 tests), through the real `App`
  (reducer + localStorage, no mocking), covering:
  - Dex overlay panel is exactly `[header, body]` with no third child, and the recipe list lives
    inside `.dex-overlay__body`, never directly under the panel.
  - Shop overlay panel uses the identical shell shape.
  - Inventory overlay panel uses the identical shell shape.
  - Switching Inventory category tabs (すべて → ソース → チーズ → トッピング → すべて) never
    changes the panel element's `className` or its child count/shape.
  - The panel DOM node itself is reused (not remounted) across a category switch — only its body
    content changes.
  - Pre-existing coverage already satisfied: Dex/Shop/Inventory open/close
    (`App.test.tsx`, `App.inventoryOverlay.test.tsx`), HOME stays mounted underneath every overlay
    (same tests — the closest equivalent to "global interaction lock remains" this codebase
    already asserts), Inventory category-switch content filtering (`InventoryOverlay.test.tsx`).
  - Real pixel geometry (top/bottom/height/width, overflow, scroll behavior, console errors) is
    not something jsdom computes — verified separately via the headless-Chromium pass above
    instead of faked in a unit test.

## typecheck / lint / build

- `npm run build` (`tsc -b && vite build`): passes, no errors.
- `npm run lint` (`oxlint`): passes, no warnings/errors.

## HEAD SHA

See the branch's latest commit after this report is committed (reported in the PR).

## Remaining risks

- The `max-height` safe-area guard (`calc(100dvh - env(safe-area-inset-top) - 20px)`) is untested
  against a real notched device; it only matters on a viewport short enough that `80dvh` would
  otherwise exceed it, which no verified device here triggers.
- `dvh` requires a browser that supports dynamic viewport units (iOS Safari 15.4+, modern
  Chrome/Android). Older WebViews without `dvh` support will fall back to the CSS default (auto),
  which the browser generally treats as `0` for an unsupported unit token — no fallback `vh` rule
  was added since the existing `.app-frame` already assumes `100svh`/modern viewport unit support
  and no minimum-supported-browser floor is documented in this repo.
- Verification used the production build served via `vite preview` in headless Chromium; it was
  not additionally checked in a real iOS/Android browser or the dev server.
