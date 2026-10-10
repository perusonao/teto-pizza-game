# Cooking Tray Family Row — Mobile UX Follow-up — Result Report (Issue #399)

Base `origin/main` **`960bb3eb8728bb3b412d74f67b6bcdd289889a53`** (PR #397 merged). Branch `claude/tray-family-mobile-ux-design-ug0fhp`. PR open, **not merged** (no auto-merge). Separate from PR #398 (TQ-1D / NO_SAUCE), which this work never touched.

## 0. Problem and Owner Decisions

Production, real device: scrolling the family chip row cut chips off on the left and right, the selected family was easy to lose, nothing said there was more on the left, the 360px window was tiny and the chips were 28px tall. Fresh Audit / Design (previous session) fixed the root causes:

1. `ShelfChipRow` put the active chip flush against the right edge (`scrollLeft = right - clientWidth`), exactly under the 22px right fade mask.
2. Only a right fade existed; no left affordance.
3. Alignment ran on an active change only (not on mount, options change or resize) and had no room for a fade.
4. The chip window was 151 / 121px (390 / 360) because the pager's 128px stayed reserved even when idle: the longest chip 「ちょっと変わった材料」 (144px) could not fit at 360.
5. 28px tap targets.

Owner Decisions applied: OD-1 B4 (idle pager gives its room back); OD-2 Pantry unchanged (「🧺 食材庫」, padding, accessible name); OD-3 no active-side fade tint; OD-4 no two-row layout; OD-5 no tray-only short label, `familyDisplay` untouched.

## 1. What changed

- **S1 — `src/logic/chipRowAlign.ts` (new, pure) + `ShelfChipRow` compact path.** `alignChipScrollLeft`: the chip is shown whole first, clear of the edge fades second (fade room `CHIP_ROW_FADE_PX = 14` per side that has neighbours, shrinking to 0 when the window is tight, a chip wider than the window starts at the left edge), moving the least possible and idempotent. `chipRowEdges`: a fade per side that still hides chips, capped at the gap beside the active chip so its text is never under a fade. The row writes `data-more-start` / `data-more-end` and `--fade-start` / `--fade-end`; the CSS mask reads them (both sides now; the old right-only 22px class is gone). Triggers: mount and options change (instant), active change (smooth unless `prefers-reduced-motion`), `ResizeObserver` / window resize (ensure-visible only: moves only when the active chip is no longer whole), keyboard focus (`:focus-visible` only, so a tap is not pre-scrolled). A manual scroll only updates the fades and is never undone. Only the row's own scroll position is written (`row.scroll` / `scrollLeft`); never the page. **The non-compact rows (Pantry / Inventory / Shop) keep their old effect byte for byte.**
- **S2 — CSS.** The chip button itself is 44px tall (8px of hit area above and below), its visible 28px pill is a `::before`; the scroller is 44px with a −8px block margin so the row's layout height stays 28px. (A first attempt, a 44px scroller around 28px chips, was wrong: an `overflow:auto` box clips hit-testing to itself and a tap on its padding reaches no chip. The E2E hit test caught it.) Chip width (12px each side), gap (6px), text and colours are unchanged; the focus ring moved to the pill.
- **S3 — CSS.** In the family row only, `.ingredient-page-nav__pager--idle { display: none }`. The node stays (aria-hidden, inert) so the existing unit contract holds; a list that pages shows the pager exactly as before (128px, 36×28 buttons unshrunk). Family change still returns to page 1 (untouched logic).
- **Production DOM golden re-baselined** (`rebaselineNote5`), as #397 did: only the family chip group element's own attributes change in `free22.topping.page1–4` / `afterPantry` (verified: neutralising that element's attribute list makes old and new byte-identical); the other 8 snapshots are byte-identical.

Not changed: recipe data / population, hidden-recipe and Research privacy, family taxonomy and labels, Pantry semantics, pagination semantics, pizza / dock contracts, save schema, `ShelfChips` / `ShelfTabs`.

## 2. Width before / after (measured in real Chromium, family chip window)

| | 390×844 | 360×800 |
|---|---|---|
| pager shown (すべて, a paging family) | 151 → 151 px | 121 → 121 px |
| pager idle (one-page family) | 151 → **285** px | 121 → **255** px |
| longest 「ちょっと変わった材料」 (144px chip) | whole before and after (it sits at the far end) | before: **23px cut off, 45px under the fade**; after: **whole, 0px under any fade** |
| pizza diameter | 290 → 290 | 274 → 274 |
| utility row / dock height | 28 / 174 → 28 / 174 | 28 / 174 → 28 / 174 |

Chips under a fade before (selected chip, px): 390: 魚介系 22, 果物系 22, スパイス・薬味系 22; 360: 肉系 15, 魚介系 22, 野菜・きのこ系 15, 果物系 22, ハーブ・香味系 15, スパイス・薬味系 22, ちょっと変わった材料 45. After: 0 for every family at both widths.

## 3. Tests

- `tsc -b` clean, `oxlint` only the 2 pre-existing warnings on main, `npm run build` OK.
- **Vitest full: 347 files, 6234 passed, 1 skipped.** New: `chipRowAlign.test.ts` (alignment invariants swept over view widths 122–400 and every scroll start: chip whole when it fits, in range, idempotent; fade room kept; fade cap at the active chip; four edge states) and `ShelfChipRow.compact.test.tsx` (initial alignment, active change, options change, resize, manual scroll never pulled back, fade cap, selected state, non-compact rows untouched). `ShelfChips` / `ShelfTabs` / `IngredientTray.familyFilter` tests unchanged and green.
- **Chromium E2E** (iphone-390x844, iphone-360x800, layout-chromium), the whole suite: **453 passed, 69 skipped (the existing OD-V-6 once-per-engine skips), 0 failed.** New `e2e/cooking-tray-family-mobile-ux.spec.ts` (10 tests per width): for FREE HAND on / HAND off / all 8 chips / a paging family / Research, every family in turn (first, middle, last, the longest, back to すべて) has its selected chip whole inside the scroller (boundingBox) and clear of the fades, the edge affordances match the real scroll position, the pager is shown exactly when the list pages (and hands ≥ 120px to the chips when idle), the pizza is 290 / 274 and the dock does not move; the longest label at both widths; a real wheel scroll both ways leaves the row where the user put it; Tab through the chips keeps each focused chip clear of the fades; paging pager 128px with unshrunk buttons, page 1 after a family change, collapsed pager aria-hidden; Pantry open / close; 44px hit area (a tap 6px outside the pill selects, the Pantry entry and pager are beside the scroller, the scroller overlaps the tray's last row by at most 2px, a card 5px inside its bottom edge and the bake bar still receive their own taps). The existing `cooking-tray-family-filter`, `layout-contract` (LC-S / LC-R3 / layout-chromium), `layout-invariants-lb`, `large-catalog-*`, `lc-hand-*` specs pass unmodified. Run against main first (before the last spec tweaks): the new tests fail there (RED), as designed.
- History, honestly: the 44px scroller (instead of 44px chips) failed its own hit test and was replaced; a focus-driven pre-scroll that moved the row before a tap landed was limited to `:focus-visible`; a test fixture assumed a Hand of 12 contains 「他」 (it does not) and was replaced with an 11-owned save that has all 7 families. No timeout, retry, skip or gate was changed; the golden was re-baselined deliberately and verified item by item.
- WebKit was not run locally (CI runs it).

## 4. Human Verification

Before / after screenshots: `docs/reports/screenshots/cooking-tray-family-mobile-ux/` (`before-*`, `after-*`, FREE with all 8 chips, plus `compare-*-longest-label` with before above and after below). Videos are **not committed** (policy): delivered directly to the Owner in the session.

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `tray-family-mobile-ux-hv-390.mp4` | 390×844 | 66.0 s | 0.92 MB | H.264 | PASS (ffprobe, frames inspected) |
| `tray-family-mobile-ux-hv-360.mp4` | 360×800 | 65.0 s | 0.86 MB | H.264 | PASS (ffprobe, frames inspected) |

What each video shows (1–3 s holds): arrival on the 具材 step; 肉系 → 野菜・きのこ系 → スパイス・薬味系 → ちょっと変わった材料 → すべて; the longest label again; real wheel scroll left / right / left; 果物系; Pantry open / close; pager next / previous; a paging family (野菜・きのこ系) keeping its pager and a one-page family (肉系) collapsing it; HAND ON; Research; FREE.

Video Verification: PASS

The Owner's question, to be judged on the videos / screenshots: the selected chip is whole (360px 「ちょっと変わった材料」 included), a fade says which side has more, and a tap 8px above / below a chip selects it. The Owner's real-device judgement is the open item.

## 5. Residual risks

- A paging list keeps the 122px (360px) window: the longest chip still cannot show whole there. In production data only 「すべて」 (5 pages) and 「野菜・きのこ系」 (2 pages) page, and neither is the longest chip. At 172-scale most families will page; that, and pager digit growth ("10 / 29"), are out of scope by decision (OD-1) and would need the tray-only short label (OD-5) or similar.
- The scroller's hit area overlaps the tray's last row by 2px and sits over the spacer above the bake bar (which paints over it): the same compromise the 食材庫 entry already makes, asserted by the E2E.
- An idle pager now changes the chip window when the list's page count crosses 1; the alignment only moves a chip that is no longer whole, and a leftover left offset can show a left fade even when everything would fit (cosmetic).
- Production DOM golden needed a (verified, deliberate) rebaseline; WebKit not run locally.

## 7. Owner HV follow-up (2026-10-05): the responsive family row

Owner HV on the Preview (`994e879`) found the family filter, below the tray and sharing its row with the pager, hard to find and not what #401's fix was about. Owner Decisions: the filter goes ABOVE the ingredients on its own row, the pager below them (order "pick a family → see the ingredients → place one"); LC-S3, the pizza minimum and the Layout Contract are NOT relaxed; a +34px row on every viewport (and Pantry on a third row, +68px) were rejected because they shrink the pizza on a real Safari height (S390 262 → 236); the layout is therefore **responsive**: expanded where the stage can spare the row, the #401 one-row layout where it cannot.

### Layouts

- **Expanded** (normal heights): `[filter, full width, 1 row, scrolls sideways]` / `[3 x 2 ingredients]` / `[🧺 食材庫 … ◀ 1 / 2 ▶]` (the LC-R3 utility row). The 食材庫 entry and the pager share their row with no chips; the filter shares its width with nothing.
- **Compact** (short heights): the #401 layout, unchanged (`[食材庫][filter][◀ 1 / 2 ▶]`, an idle pager collapses; B4).
- One `ShelfChipRow` element, mounted in either place (`IngredientTray` `familyPlacement`): same chips, labels, bilateral fades, no-snap-back scroll, 44px chips. Nothing of `familyDisplay`, taxonomy, Pantry, HAND, Research, recipes or pagination changed.

### Responsive authority (no fixed breakpoint)

`prepareDock.ts` `familyRowFits({ contentHeight, pizzaCap, placedAbove })`, measured by `GameScreen` from the pizza stage (ResizeObserver + resize): the filter takes its own row only while the stage keeps `FAMILY_ROW_PX` (42) more than the pizza's cap needs, i.e. while the pizza is exactly as large as the one-row layout makes it. The same reading holds in both layouts (the row's own height is added back when it is already above), so the switch is a fixed point: no oscillation, a 2px margin only on the way in. The DM-3R-0 `max-height: 700px` breakpoint could not serve: where the row fits depends on the round (FREE ≥ 741, Research ≥ 772 at 390 wide) and a constant 700 would have shrunk the Research pizza by up to 34px between 701 and 779px. The pizza cap is no longer written twice: App.css defines `--pizza-cap-compact` / `--pizza-cap-roomy` once; the dough and a zero-size `::before` probe read them, and `GameScreen` reads the probe's resolved width (a unit test pins this).

Switch heights measured by 1px sweeps on one page, down then up (FREE / Research, 390 / 360 wide): FREE 390 compact at ≤ 738, expanded at ≥ 741; FREE 360 722 / 725; Research 390 769 / 772; Research 360 786 / 789 (a 3px hysteresis). Across every sweep: one switch each way, the pizza never jumps (0.0px at the switch), the bake bar follows the height 1:1, the tray-to-bar distance changes only by the pager row's extra 4px gap at the switch, no sideways scroll.

### Measured (real Chromium, FREE, hand on)

| profile | layout | pizza before → after | dock | filter usable width |
|---|---|---|---|---|
| N390 390×844 | expanded | 290 → 290 | 174 → 216 | 151 → **366** |
| N360 360×800 | expanded | 273.59 → 273.59 | 174 → 216 | 121 → **336** |
| P390i 844 + inset | expanded | 290 → 290 | 174 → 216 | 151 → 366 |
| S390 390×664 | compact | 269.06 → 269.06 | 162 (unchanged) | 151 (unchanged) |
| S360 360×640 | compact | 245.06 → 245.06 | 162 | 121 |
| E390i 664 + inset | compact | 188.06 → 188.06 | 162 | 151 |
| E360i 640 + inset | compact | 164.06 → 164.06 | 162 | 121 |

LC-S3 and the Layout Contract are untouched and pass on all seven profiles. In the expanded layout the bake bar, and the tray's position relative to it, move by nothing but the pager row's 4px gap (below).

### Hit areas never overlap (expanded)

The chips' 44px target ends 2px before the first card; the pager's and the entry's 44px targets (9px above their 28px body, 7px below: the bake bar takes over from 7.5px) end 1px before the last card; the chips' target starts below the pizza (4.5px at the narrowest). To get that: the family row's gap to the tray is 10px (was 6) and the utility row's gap above it is 10px in the expanded layout; both are in `--family-h` (42px = 28 + 10 + 4), which the dock reserves. Hit-testing in the E2E agrees at every edge (card top edge = card; chip box top and bottom edge = chip; pager 8.5px above / 6.5px below / 3.5px beside = pager; bar = bar). Nothing was removed from the 44px targets and the pizza was not reduced.

### Production DOM golden

Re-baselined with the Owner's approval (`rebaselineNote6`), after checking item by item: 7 snapshots change (`free22.sauce`, `free22.cheese`: the `.prepare-dock` element only, class `prepare-dock--family-above` and `--dock-family: 1`; `free22.topping.page1-4` / `afterPantry`: the same, plus the family chip group moved into `<div class="tray-family-row">` above the ingredients and the utility row losing `ingredient-page-nav--with-family`). Applying exactly those transformations to the previous golden reproduces all 7 byte for byte; the other 6 snapshots (`free6.*`, `free22.topping.pantryEntry` / `pantry`) are byte-identical (`--dock-family` is absent unless the row is above).

### Tests

- Unit: `familyRowFits` (boundary, hysteresis, fixed-point and 1px-sweep properties, no layout), `prepareDockReserve().familyRow`, IngredientTray placement (above / inline, one filter element, order, page 1, placeholder), App.css guards (`--family-h` = `FAMILY_ROW_PX`, the pizza cap written once).
- E2E (Chromium): `cooking-tray-family-expanded.spec.ts` (every family × FREE hand on / off / 8 chips / paging family / Research at 390 and 360: filter width 366 / 336, pizza and dock, nothing moves per family, longest label with the left fade, manual scroll and Shift+Tab, pager below and idle placeholder, Pantry, hit areas, ingredient tap, bake bar); `cooking-tray-family-responsive.spec.ts` (1px sweeps); `family-layout-contract.spec.ts` (the seven profiles); `cooking-tray-family-mobile-ux.spec.ts` now pins the compact layout at 390×664 / 360×640 (pizza equal to #401's). #397's spec, layout-contract (LC-S3) and layout-invariants unchanged and green.
- Before / after screenshots: `docs/reports/screenshots/cooking-tray-family-responsive/` (390×844, 360×800 expanded; 390×664, 360×640 compact = unchanged).

### Residual risks

- On a real iPhone the layout depends on the visible height: when Safari's toolbars come and go, the filter moves between the two places (the pizza does not move). A 3px hysteresis keeps it from flickering at the boundary.
- At the boundary the tray is 4px nearer the bake bar in the expanded layout (the pager row's larger gap that keeps its hit area off the cards).
- Dinner rounds were not swept by height (the Layout Contract's Dinner flows pass on all profiles); the rule reads the stage, so it holds for them too.

## 8. 追記（2026-10-10）: 現行仕様との対応（Issue #447 / Research UX Fresh Audit）

上の §0〜§7 は当時の判断記録として変更しない。**現在の実装**との差を次に示す。詳細は `TETO_COOKING-TRAY-FAMILY-ROW-STABLE_Result.md`。

- **配置は「常にトレイの上」**（§7 の後に Owner が決定、commit `9c69a55`）。§7 の「responsive（`familyRowFits` で、余裕のある高さだけ上、短い高さは #401 の 1 行）」と、そこに載せた切替高さ（FREE 390 の 738 / 741 など）・S390 / S360 / E390i / E360i の compact 実測は、**置き換えられた hybrid の記録**。`familyRowFits` は `prepareDock.ts` に残っているが `GameScreen` から呼ばれていない（整理は別件）。390×664 / 360×640 でも行は上にあり、ピザは 274 / 250。
- **食材庫は廃止済み**（2026-10-06 All-Owned Cooking Tray、#408）。§7 の「`[🧺 食材庫 … ◀ 1 / 2 ▶]`」「pager と食材庫の entry」「Pantry open / close」は現在存在せず、トレイ下の utility row は pager のみ。
- **「nothing moves per family」の範囲**: §3 / §7 の E2E（`cooking-tray-family-expanded.spec.ts`）は、全 family を巡回して「すべて」へ戻した後の dock / tray top / bake bar を比べる。途中の family（結果が 3 件以下で 1 行になるもの）でのタブ行の y は検証していなかった。そのため、1 行の family でタブ行が **+70px**（390×844: 548 → 618、360×800: 504 → 574）動く不具合を見逃していた（Issue #447）。
- **#447 の修正**: タブ行が表示されている間はトレイを常に 2 行分の高さに固定（CSS のみ）。タブ行・トレイ上端・pager・dock・bake bar・ピザは全 family で動かない。§1 の「dock Δ0」「ピザ 290 / 274」は変わらない。
