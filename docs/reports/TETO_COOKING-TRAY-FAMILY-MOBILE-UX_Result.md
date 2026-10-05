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
