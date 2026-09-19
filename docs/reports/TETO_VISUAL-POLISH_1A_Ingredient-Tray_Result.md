# Teto Pizza Game — Visual Polish 1A: Ingredient Tray Overflow / Required Ingredient Accessibility (Result Report)

## 0. Fresh / Duplicate PR Gate

- `git fetch origin` run at task start. `origin/main` = `2ae37f1e022acb9fcf4bac644e38bd00fb1ff5f7`
  ("Human Feel Tuning 1A: clarify insufficient sauce guidance", PR #103) — matches the audit
  baseline SHA supplied in the task.
- Open PRs checked (`list_pull_requests`, state=open): #105 (Dev Automation A1, unrelated), #72
  (docs), #46 (Issue #33 Dough Shaping D0), #34 (Issue #32 Phase 1 reference-visual), #3 (docs).
  **None overlaps this scope.**
- Implementation was started fresh from `origin/main` on branch
  `claude/teto-ingredient-tray-overflow-e2qsyy` (not from the audit branch
  `claude/teto-pizza-visual-audit-o7nise`, per the task's explicit instruction) — that branch's
  local HEAD already matched `origin/main`'s SHA exactly at task start.
- Re-checked for duplicates immediately before opening the PR (§11 below) — no new PR/branch
  touching the Ingredient Tray appeared in the interim.

## 1. Original P1 (from `TETO_AI-UI-UX_VISUAL-REVIEW-1_Fresh-Audit.md`, on
`claude/teto-pizza-visual-audit-o7nise`)

**P1-1. Ingredient Tray: a "recommended row + full Other grid" recipe hides its own second
Other row under the fixed BAKE CTA bar, with no scroll affordance.** For Tonno e Cipolla at
TOPPING, the second "その他" row rendered with only ~8px peeking above `.prepare-bake-bar` at
390×844, and was fully hidden at 360×800 — with no on-screen sign (fade/chevron/anything) that
scrolling would reveal it. The audit's own live pointer probe confirmed the row *was* reachable
by scrolling (`scrollHeight` 936 vs `clientHeight` 844) — this was a pure discoverability gap,
not a hard unreachability bug, but one that would only get more common as the 18→62-ingredient
roadmap lands (see §7).

## 2. Reproduction

Reproduced live in a real Chromium browser (Playwright driving the actual Vite dev server, real
pointer gestures — no mocked state) against `origin/main`'s unmodified code before making any
change:

- Seeded a save (`localStorage`, schema v2) with all 11 recipes discovered/★5 (unlocks Tonno e
  Cipolla's chain: `napoletana` discovered + 28 total stars) and every ingredient owned/stocked
  — the same kind of seed the original audit used, and the actual real-world state any player
  reaching Tonno e Cipolla will have (the EP4 Starter Grant auto-grants every ingredient any
  now-unlocked recipe requires, so a curated narrower ingredient list collapses to this same
  set regardless).
- Real gestures throughout: an 8-angle repeated `pointermove` stretch gesture on the dough until
  the size-completion gate passed (DOUGH), a real pointer-hold-and-move gesture (SAUCE), and
  real tray-select + tap-to-place clicks (CHEESE), landing on TOPPING exactly as a player would.
- At TOPPING, `.ingredient-section--other .ingredient-tray` owned 9 items (2 pages of 6/3 —
  since every recipe's required ingredients are now owned via the Starter Grant chain, this is
  actually a *harder* case than the audit's own single-extra-row repro, not a softer one).
- Confirmed the exact failure: at 390×844, three chips (チェリートマト/たまご/マッシュルーム)
  rendered at `top:749/bottom:844`, directly under `.prepare-bake-bar` (`top:770/bottom:844`) —
  visually indistinguishable from "this is all there is." At 360×800 the same row was further
  under the bar.
- Confirmed the audit's own diagnosis: scrolling to the true document bottom (`scrollY:120`)
  *did* bring every chip and the page-nav fully above the bake bar (`pageNavRect.bottom:760` vs
  `bakeBarRect.top:770`) — the reserved `padding-bottom` on `.ingredient-panel` was already
  mechanically sufficient. The bug was 100% "nothing tells the player to scroll," matching the
  audit's own conclusion.

## 3. Root Cause

`.ingredient-panel`'s `padding-bottom: calc(84px + safe-area)` (`src/App.css`) reserves exactly
enough trailing space for the fixed `.prepare-bake-bar` to never structurally cover the last row
— and this reservation is unconditional trailing space at the very end of the document flow, so
it works correctly regardless of how much content (Recommended row + Other grid) precedes it.
The actual defect was that **nothing on screen ever indicated the page was scrollable in the
first place**: the fixed BAKE bar visually reads as "the bottom of the screen," so a first-time
player has no reason to suspect more content exists below it, and the second Other row's ~8px
peek at 390×844 (0px at 360×800) is not a legible affordance.

## 4. Chosen UX Solution

Direction **(b)** from the audit ("add a lightweight bottom-edge scroll affordance whenever the
tray content overflows"), implemented via an `IntersectionObserver` rather than hand-rolled
`scrollY`/`scrollHeight` math:

- A zero-height sentinel (`.ingredient-panel__content-end`) is always rendered as the true last
  node of the tray's in-flow content (`src/components/IngredientTray.tsx`, right after the
  page-nav).
- One `IntersectionObserver` (created once per mount) watches that sentinel with a `rootMargin`
  shrinking its effective viewport by `-78px` — chosen because, at maximum scroll, the sentinel
  sits exactly `--bake-bar-reserve` (84px, the same constant `.ingredient-panel`'s own
  `padding-bottom` uses) above the viewport's bottom edge, by construction; -78px is what makes
  "intersecting" track "scrolled all the way down" with a small safety margin, verified
  empirically at both target viewports (see §6).
- While the sentinel is not intersecting, a `.ingredient-scroll-cue` (a soft gradient fade + a
  small bouncing "▼" chevron, `aria-hidden`, `pointer-events: none`) renders fixed just above
  the BAKE bar, using the *same* `--bake-bar-reserve` CSS variable for its own position — so the
  two can never drift out of sync.
- This reuses the existing, browser-native scroll (no change to `.ingredient-tray`'s own fixed
  3×2 grid or its `touch-action: none` gesture-arbitration fix from Human Feel Fix 2 — nothing
  about *how* scrolling works changed, only whether the player is told it's available) and
  requires no `scrollY`/`resize` listener bookkeeping: the observer already recomputes itself on
  scroll, resize, and any layout change (category switch, page switch, Recommended row
  appearing/disappearing) with no extra code.
- No change to `.ingredient-tray`'s fixed-grid/paging mechanics, no change to placement/drag
  logic, no recipe-specific branching anywhere — the fix is generic to "does tray content
  overflow the visible-above-the-CTA-bar area," which is exactly the acceptance criterion.

Direction (a) (dynamically resizing the padding) was not needed: the padding already worked
correctly for *reachability*; only the *visibility of that fact* was broken. Direction (c) (a
combined-rows cap falling back to page-nav) was rejected as unnecessary scope — it would touch
`MAX_INGREDIENT_PALETTE_SLOTS`/paging logic for no discoverability gain over (b), and paging
logic itself needed no change. Direction (d) (shrinking the whole tray) was rejected per the
task's own instruction (risks tap-target size/readability).

## 5. Changed Files

- `src/App.css` — introduced `--bake-bar-reserve: 84px` on `.ingredient-panel` (shared by its
  existing `padding-bottom` rule, unchanged in value/behavior) and added
  `.ingredient-panel__content-end` (zero-height sentinel) + `.ingredient-scroll-cue` /
  `.ingredient-scroll-cue__chevron` (+ `prefers-reduced-motion` override for the chevron's
  bounce animation).
- `src/components/IngredientTray.tsx` — added the `contentEndRef`/`hasMoreBelow` state, the
  `IntersectionObserver` effect (with a defensive `typeof IntersectionObserver === "undefined"`
  guard for jsdom/older browsers), and the sentinel + conditional cue markup at the end of
  `.ingredient-panel`'s JSX. No other prop, handler, or existing markup changed.
- `src/components/IngredientTray.scrollCue.test.tsx` — new regression test file (see §8).
- `docs/reports/screenshots/visual-polish-1a/` — before/after screenshots (see §9).
- `docs/reports/TETO_VISUAL-POLISH_1A_Ingredient-Tray_Result.md` — this report.

Nothing in pizza canvas mechanics, ingredient interaction semantics, sauce mechanics,
Completion Gate, Cooking Time, Scoring, Economy, Inventory counts, Starter Grant, Recipe data,
Recipe unlock, Shop, Dex, HOME, Lunch Rush, or the Save schema was touched.

## 6. Tests

### 6.1 New regression test (`IngredientTray.scrollCue.test.tsx`, 5 tests)

jsdom has no real layout engine and no `IntersectionObserver`, so a CSS-only/pixel-position test
would be unnatural (per the task's own guidance) — this file instead pins the actual new
*behavior contract* by stubbing a fake `IntersectionObserver` and driving its callback directly:

1. The content-end sentinel always renders and is always the node the observer watches.
2. The cue is hidden by default and appears once the observer reports the sentinel is not
   intersecting (content still below the visible-above-the-bar area).
3. The cue disappears again once the observer reports the sentinel has scrolled into view.
4. Margherita's simple single-row case never shows the cue (default-hidden state, no
   regression).
5. The component does not crash when `IntersectionObserver` is entirely unavailable (jsdom's
   actual real-world default for every *other* existing test file in this suite) — the cue
   simply never shows, which is correct: no real viewport to reason about in a unit test anyway.

### 6.2 Full existing suite

| Check | Before | After |
|---|---|---|
| `npx vitest run` | 1604 tests / 81 files passed | **1609 tests / 82 files passed** (+5, 0 failed, 0 modified) |
| `npx tsc -b` | Clean | Clean, 0 errors |
| `npx oxlint` | Clean | Clean, 0 errors/warnings |
| `npm run build` | Succeeds | Succeeds — `dist/assets/index-*.js` 351.31 kB (gzip 109.01 kB), CSS 40.82 kB (gzip 8.52 kB) |

Every pre-existing test (including `IngredientTray.scalability.test.tsx`,
`IngredientTray.recommendedOther.test.tsx`, `IngredientTray.palette.test.tsx`,
`IngredientTray.physicalDragReset.test.tsx`, and every `GameScreen.*`/`App.*` test) passed
unmodified — no existing test needed a single line changed.

## 7. 390×844 Result

Real browser verification (Playwright + Chromium, real gestures, seeded save with all 11
recipes discovered — the actual reachable state for any player at Tonno e Cipolla, and a harder
case than the audit's own single-extra-row repro since it owns all 18 ingredients, forcing
2-page pagination in "その他"):

- `docs/reports/screenshots/visual-polish-1a/after-tonno-390.png` — the chevron/gradient cue is
  now clearly visible directly above the 焼く！ bar the instant TOPPING renders, telling the
  player more ingredients exist below.
- No horizontal overflow (`scrollWidth <= innerWidth`).
- 0 console errors / page errors throughout the full DOUGH→SAUCE→CHEESE→TOPPING flow.
- Selecting a Recommended-row chip (ツナ) and tapping the pizza places it
  (`.pizza-topping--tuna` renders) — ingredient selection + tap placement unaffected.
- 焼く！ (BAKE CTA) is still reachable and still starts BAKE — unaffected.
- やり直す (RESET_PIZZA) still clears placed toppings and returns to the DOUGH step (its
  existing, correct "start over" behavior, confirmed pre-existing and unrelated to this fix) —
  unaffected.

## 8. 360×800 Result

- `docs/reports/screenshots/visual-polish-1a/after-tonno-360.png` — same cue, same fix, at the
  narrower/shorter viewport where the audit found the row *fully* hidden (not just peeking).
- No horizontal overflow.
- Scrolling to the true bottom (`docs/reports/screenshots/visual-polish-1a/
  after-tonno-360-scrolled.png`) brings every chip and the page-nav fully above the bake bar
  (`allChipsAboveBar: true`) **and** the cue correctly disappears (`cueGoneAfterScroll: true`) —
  confirming the affordance tracks real scroll position at both target viewports, not just one.
- 0 console errors / page errors.

## 9. Margherita Result (no-regression case)

- `docs/reports/screenshots/visual-polish-1a/after-margherita-390.png` — fresh save (no
  progression at all, matching the audit's own fresh-state Margherita case). TOPPING shows only
  the single Recommended chip (バジル), no "その他" section, everything fits with room to spare.
- **No scroll cue renders** (`cueVisible: false`) and **no page-nav renders** — confirms the fix
  is purely additive: a tray that already fit the screen is completely unaffected.
- No horizontal overflow. 0 console errors.

## 10. Tonno e Cipolla Result

See §7/§8 above — Tonno e Cipolla was the primary repro case throughout, verified at both
target viewports with real gestures end-to-end (DOUGH shape → SAUCE dispense → CHEESE
placement → TOPPING → BAKE), not a shortcut/mocked state.

## 11. Screenshots

All in `docs/reports/screenshots/visual-polish-1a/`:

| File | Description |
|---|---|
| `before-tonno-390.png` | Copied verbatim from the audit's own `04-prepare-complex-390.png` — the original bug, second Other row peeking ~8px above the bar with no cue. |
| `before-tonno-360.png` | Copied verbatim from the audit's own `14-prepare-complex-360.png` — the same row fully hidden. |
| `after-tonno-390.png` | This fix: chevron/gradient cue visible above the bar at default scroll. |
| `after-tonno-360.png` | This fix at 360×800: cue visible. |
| `after-tonno-360-scrolled.png` | Scrolled to the true bottom: every chip + page-nav clear the bar, cue correctly gone. |
| `after-margherita-390.png` | No-regression case: simple recipe, no cue, no page-nav, unaffected. |

## 12. Regression Check (task §6/§7)

| Check | Result |
|---|---|
| DOUGH/SAUCE/CHEESE/TOPPING Making tabs | Normal — real gesture flow through all four steps, correct step transitions, tab active/next/locked states unaffected |
| Ingredient selection | Normal — chip click selects (`ingredient-chip--selected`), disabled/stock states untouched (existing `IngredientTray.recommendedOther.test.tsx` suite passes unmodified) |
| Tap placement | Normal — verified live: selecting ツナ then tapping the pizza renders `.pizza-topping--tuna` |
| Sauce interaction | Normal — real ~1.5s pointer-hold-and-move dispense gesture completed with 0 console errors before advancing to CHEESE |
| BAKE CTA | Normal — 焼く！ still starts BAKE after the fix |
| Completion Gate / Cooking Time / Scoring / Economy / Inventory / Starter Grant / Recipe data / unlock / Shop / Dex / HOME / Lunch Rush / Save schema | Untouched — no file in any of these areas was modified; full existing test suite (1604 pre-existing tests) passes unmodified |
| RESET_PIZZA (やり直す) | Normal (pre-existing behavior confirmed, not a regression): clears the round and returns to DOUGH |
| Console errors | 0 across every scenario/viewport tested |
| Horizontal overflow | None at either viewport, before or after |

## 13. Scalability (18→62+ ingredients)

The fix is generic to "does the tray's in-flow content extend below the visible-above-the-bar
area" — it does not special-case any recipe, ingredient count, or category. It was verified
against the *harder* 9-owned-item/2-page case (not just the original 5-item single-extra-row
case), and the same `IntersectionObserver`+sentinel mechanism will continue to work unchanged
whether "その他" ever needs 2 pages or 10: the sentinel always sits at the true end of content
regardless of how many pages/rows precede it, so no further change is needed here as the catalog
grows. Shop/Dex/Recipe Select scalability (P1-3, P2-4, P2-5, P2-6 from the original audit) were
explicitly out of scope for this slice and remain open.

## 14. Remaining Visual Review Findings (unchanged, from the original audit)

Not in scope for this slice, still open:

- **P1-2** — Lunch Rush Result hardcoded English copy (`MissionResultOverlay.tsx`).
- **P1-3** — Shop's empty-state hint gated to `products.length === 0` only, never shown at the
  common 1-2-item state.
- **P2-4/P2-5/P2-6** — Dex/Shop have no category filter; Recipe Select's pager has no
  chapter/jump control.
- **P2-7/P2-8/P2-9** — HOME's unused lower space; 実績/設定 permanently disabled; RESULT
  FAILED's terse "0 Pitz" framing.

## 15. Final Verdict

**A. P1 RESOLVED.**

The original P1 — a player being unable to discover a required ingredient because it silently
sat behind the fixed BAKE bar with no indication scrolling would reveal it — is fixed at both
target viewports (390×844, 360×800), verified live with real gestures against the exact Tonno e
Cipolla repro case (and a harder, fully-owned-catalog variant), with zero regressions to
Margherita's existing simple-recipe layout, zero regressions to any adjacent system (Making
tabs, ingredient selection, tap placement, sauce interaction, BAKE CTA, RESET_PIZZA), zero new
console errors, zero new horizontal overflow, and the full pre-existing 1604-test suite passing
unmodified alongside 5 new tests pinning the fix's own behavior contract.
