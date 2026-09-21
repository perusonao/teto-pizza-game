# Teto Pizza Game — Visual Polish 2.0 Phase 0 Fresh Audit

**Type:** Read-only / audit. No production code changed (`src/**`, `functions/**`, Firebase,
workflows, save schema, recipe data, progression/economy, tests are all untouched — see
`git status` / diff for this branch, which contains only this report and screenshots).

**Audited main SHA:** `f14217b3db1be69308769838e2510773dd7b2b46`
(Recipe Select 2.0A: sectioned browse grid + focused detail, PR #139, merged 2026-09-21 15:12 JST)

## 1. Duplicate Gate #1 (start of audit)

Checked before any review work:

- `origin/main` HEAD: `f14217b3db1be69308769838e2510773dd7b2b46` (PR #139, just merged).
- **Open PRs:** #105 (Dev Automation A1, unrelated to UI, base SHA from 2026-09-19), #72 (docs-only
  status sync, stale), #46 (Issue #33 Dough Shaping D0 audit, docs-only, stale base), #34 (Issue #32
  Phase 1 reference visuals, stale base from 2026-09-16), #3 (very old docs PR). **None of these
  touch the same UI surfaces as this audit, and none are actively being iterated on** (all have
  bases well behind current `main`).
- **Open Issues** scanned for overlapping visual/UX work: #134 (Firebase Deploy — infra, no UI
  overlap), #129 (Player Profile — merged via #133, follow-up only), #104 (Dev Automation), #88
  (Pizza Select single-screen pager — **superseded by PR #139**, effectively closed by that design
  change even though the issue itself is still open), #87 (Lunch Rush Online Ranking — Firebase
  backend, directly explains the "ランキング機能は準備中です" state found in §5), #47 (**Making UX
  Cleanup** — open, describes several of the same problem areas this audit independently found:
  HOME message clipping, Reference visibility, CTA thumb-reach, no implementation PR yet), #39/#38/
  #37/#33/#32/#30/#27/#24/#22 — earlier-phase design/roadmap issues, all either merged or superseded.
- **Conclusion:** no in-flight PR duplicates this audit's scope. Issue #47 overlaps in *topic* (Making
  screen UX) but has no implementation started — this audit's findings are treated as independent,
  fresh observations against current `main`, cross-referenced against #47 where relevant (see §6).

## 2. Review environment

- Local Vite dev server (`npm run dev`), Chromium (pre-installed, Playwright-driven,
  `/opt/pw-browsers/chromium`), mobile emulation (`isMobile`, `hasTouch`, `deviceScaleFactor: 2`).
- Viewports: **390×844** (iPhone 12/13/14-class) and **360×800** (common Android mid-range) — both
  reviewed for every flow below.
- Fresh save each run (`localStorage.clear()` + reload) — no prior progression carried over.
- Console errors and horizontal-overflow (`scrollWidth > clientWidth`) were captured programmatically
  for every screenshot (98 screenshots total across both viewports); results in §4/§7.
- Automated interaction (Playwright pointer/mouse events driving real DOUGH stretch gestures, SAUCE
  paint drags, CUT line drags, and CHEESE/TOPPING placement taps) was used in place of manual device
  operation, since this session runs headless in a cloud container with no attached phone. This
  reaches the same DOM/CSS state a real touch session would (same event types, same render), but
  actual hand-feel/gesture responsiveness was not subjectively felt by a human tester this round —
  flagged as a deferred check in §9.

## 3. Reviewed flows

All of the following were driven end-to-end at both viewports:

- **HOME** — landing hub, all 4 menu cards, both primary CTAs.
- **Recipe Select 2.0A** — grid top, scrolled to last recipe (第2章 fully visible), a LOCKED detail
  (marinara), the one NEW/starter detail (margherita), the mystery LOCKED detail (fugazza,
  「？？？」), back-to-grid scroll-position retention, and the grid again after two completions
  (COMPLETED badges + stars).
- **FREE gameplay, CUT recipe (margherita)** — PREPARE (DOUGH→SAUCE→CHEESE→TOPPING) → BAKE → CUT →
  RESULT, full loop.
- **FREE gameplay, non-CUT recipe (funghi, unlocked by completing margherita)** — same PREPARE→BAKE
  flow without a CUT step, straight to RESULT.
- **Lunch Rush** — Mission Intro overlay, 「スタート」, ORDER display (Mito/Teto dialogue + recipe),
  full making flow with `MissionHud` visible, BAKE, `MissionServePanel` (a round that timed out
  before serving, exercising the 0-served edge case), `MissionResultOverlay`.
- **Shop, Inventory, Pizza Dex, Settings, Weekly Ranking** — opened from HOME, all reviewed.

## 4. Viewport results (both 390×844 and 360×800)

- **Horizontal overflow:** none detected on any of the 98 captured states, at either viewport.
- **Console errors:** zero `console.error` calls and zero uncaught page errors across the entire
  session (both viewports, full flow).
- **Vertical scroll:** measured `document.scrollHeight` vs. viewport height per screen. Pattern:
  - Recipe Select grid: **~1.9× viewport height** (by design — this is a browse grid, not meant to
    fit in one screen, see PR #139's own design doc).
  - RESULT screens (FREE + CUT): **~1.1–1.4× viewport height** — the primary retry CTA is below the
    fold, reachable only by scrolling.
  - TOPPING step (once toppings are placed) and the CUT progress readout: **~1.1–1.2×** — minor,
    content-driven.
  - DOUGH / SAUCE / CHEESE / BAKE: **exactly 1.0×**, i.e. these screens fit in one viewport with zero
    scroll at both 390×844 and 360×800 — see §6 Finding P1-1 for why this "fits perfectly" number is
    itself the problem (it fits because roughly half of it is empty).
  - Both viewports (390×844 and 360×800) show the same ratios within a few px — no viewport-specific
    breakage found; 360×800 is strictly a scaled-down version of the same layout with no new overflow
    or clipping introduced.

## 5. Screen-by-screen findings

### HOME
Matches its own established visual language (warm wood/brick, Teto/Mito/Blue portraits, single
primary CTA). No overflow, no clipping. One functional-clarity issue: the 「ランキング」 card's own
sub-label reads 「今週のTOP10」 (implying live data exists) but opening it shows 「ランキング機能は
準備中です」 (see Finding P1-2).

### Recipe Select 2.0A
Grid/NEW/LOCKED/mystery-LOCKED/detail/scroll-position-retention all work exactly as PR #139's design
doc describes — no regressions found. On a **fresh save**, 14 of the 15 recipe cards (93%) render as
an identical grey lock icon across two full scrolled screens, because only margherita has no
`unlockCondition` (see `src/data/recipes.ts`) — every other recipe, including the very first card in
row 2 (marinara), is locked behind a prior recipe. This is a first-run clarity problem, not a
regression in the 2.0A rebuild itself (see Finding P1-4). After completing margherita + funghi, the
grid correctly shows COMPLETED cards with stars/BEST score, and the mystery card's countdown updates
(「あと★12で解禁」 → 「あと★7で解禁」) — the progression-state rendering itself is correct and
consistent.

### FREE gameplay — PREPARE (DOUGH/SAUCE/CHEESE/TOPPING)
Every step is functionally correct (dough stretch gate, sauce dispense, tap-to-place cheese/topping,
the 「次へ」 gating). The dominant visual issue across all four steps is **empty vertical space**:
roughly 45–55% of the viewport below the pizza stage/tray is unused flat background at both 390×844
and 360×800 (screenshots: `390x844/08_margherita_dough.png`, `.../08_margherita_sauce_dispensed.png`,
`360x800/08_margherita_dough.png`). This is the single most visible, most reproducible finding in
this audit — see Finding P1-1.

One interaction-pattern inconsistency also surfaced during this review: cheese (mozzarella) and
basil are drag-only ingredients (chip reads 「上へドラッグ」), while every other ingredient is
tap-select-then-tap-to-place — both patterns work, but a player who only ever taps (the pattern every
other ingredient teaches) can select mozzarella/basil via tap+tap too (confirmed: `onClick` still
calls `onSelectIngredient`), so this is not a functional dead-end, just a visual/copy inconsistency
("上へドラッグ" implies drag is the *only* way, when tap also works). Noted as P3.

### BAKE
Functionally simple and clear (single CTA, color-coded needle, fading guide). Same empty-space
pattern as PREPARE — the bottom ~55% of the screen is empty once the Guide has faded
(`390x844/08_margherita_bake.png`).

### CUT (margherita only)
Clear instruction card, live progress counter (`0/3本`), undo control. Same empty-space pattern below
the cut lines/progress readout.

### RESULT (FREE, both CUT and non-CUT)
Content-rich (score, stars, bake-quality badge, discovery banner, Pitz breakdown, and — for CUT
recipes — an additional CUT-score card). This is the one screen in the whole PREPARE→RESULT loop that
overflows instead of leaving dead space (~1.1–1.4× viewport height), meaning the primary next action
(「もう一度つくる」 / 「別のピザを作る」) requires a scroll to reach. See Finding P1-5.

### Lunch Rush
Mission Intro, ORDER, MissionHud (timer + served count), and MissionServePanel all rendered
correctly and matched FREE's own Making chrome (same PizzaStage, same tray, same step tabs) — no
visual seams between FREE and Mission mode. One edge case surfaced by this session's forced 8s dev
`?missionDuration=` override: a round that times out before any pizza is served renders
`MissionResultOverlay` with 提供 0/平均 0点/最高 0点/スコア 0 — a plain zero-state, no
softer "next time!" framing. Real players are extremely unlikely to hit literal 0-served in the real
180s duration, so this is P3 at most, included for completeness since the task asked for edge-case
coverage.

### Shop / Inventory / Settings / Weekly Ranking (all HOME overlays)
All four open/close correctly, tab filters work, no console errors, no overflow. Visually, Shop,
Inventory, and Settings all render as a card anchored to the **top** of the viewport that only fills
about half the screen height on a fresh save — HOME's own dimmed hero (Teto/Mito/Blue) stays partly
visible above the card, and the lower ~45% of the viewport is flat cream background under the card
(`390x844/16_shop.png`, `.../17_inventory.png`, `.../19_settings.png`). This is the exact same
dead-space pattern as PREPARE/BAKE, in a different component family (overlay vs. Making screen) — see
Finding P1-3. Pizza Dex is the one overlay that doesn't have this problem, because its own list
content (recipe cards + 「？？？」 placeholders) naturally fills the available height.

Weekly Ranking's own card is smaller still (title + one line of "準備中" text), floating mid-screen
with HOME's CTA row and footer both still visible around it — confirms Finding P1-2 (the feature is
correctly gated as not-yet-built per Issue #87, but HOME's own card copy doesn't reflect that).

## 6. P0 / P1 / P2 / P3

**P0 (gameplay blocker / 操作不能): none found.** No horizontal overflow, no console errors, no dead
CTAs, no flow that couldn't be completed at either viewport. This audit does not fabricate a P0 to fit
the rubric — the correct read of the evidence is that Recipe Select 2.0A (#139) shipped clean.

### P1 (highest-value next fixes, capped at 5)

**P1-1 — PREPARE/BAKE/CUT waste 45–55% of the viewport as dead space, at both 390×844 and 360×800.**
*Why now:* this is the most-visited part of the game (every single round passes through DOUGH→SAUCE→
CHEESE→TOPPING→BAKE) and the most visually "unfinished-looking" — a screen that's half empty reads as
broken or incomplete far more than a screen that needs a small scroll, and it's the strongest
"HOME/Recipe Select/Making/RESULT の一貫性" mismatch in the app: HOME and Recipe Select are tightly
composed with no wasted space, then Making suddenly goes very sparse. *How to fix:* this is a layout
problem, not a logic problem — grow the `PizzaStage` circle to use the reclaimed space (it currently
sits at a fixed size independent of viewport height), and/or bring persistent content into the lower
half (e.g. keep the ingredient tray visible/larger during DOUGH, or show a taller Reference/tips
panel). No gameplay/state changes needed. *Estimated scope:* CSS/layout only in `App.css` +
`PizzaStage.tsx`'s size logic; 1–2 hours for a first pass across all four steps, since it's the same
fix pattern repeated per step.

**P1-2 — HOME's 「ランキング」 card promises data ("今週のTOP10") that doesn't exist yet.**
*Why now:* this is a trust/clarity problem, not a cosmetic one — a player taps expecting a
leaderboard and gets "機能は準備中です", which reads as broken rather than "not built yet". It's a
one-string, one-condition fix that removes a confusing dead end without touching Issue #87's actual
Firebase ranking work. *How to fix:* swap the HOME card's sub-label from 「今週のTOP10」 to something
that matches the overlay's own honest copy (e.g. 「近日公開」, matching the precedent HOME already
uses for the old Achievements slot per the HomeScreen.tsx header comment) until #87 ships real data.
*Estimated scope:* one-line label change in `HomeScreen.tsx`; under 15 minutes, but flagged as its own
P1 because of how disproportionately confusing the mismatch is relative to its fix cost.

**P1-3 — Shop/Inventory/Settings overlays anchor to the top and leave ~45% of the viewport as dead
background beneath the card.** *Why now:* same visual-unfinished-ness as P1-1, in a different
component, and it's the first thing new players see when they explore HOME's sub-navigation — three
of HOME's four menu destinations currently look unpolished this way. *How to fix:* CSS-only — either
vertically center the overlay card instead of anchoring to the top, or let it grow to fill more of the
viewport height (matching Pizza Dex's own overlay, which already fills correctly because its content
is taller). *Estimated scope:* shared `.dex-overlay`-family CSS in `App.css`; under 1 hour since it's
one shared class fix, not three separate ones.

**P1-4 — Recipe Select's fresh-save first impression is 93% grey locks.** *Why now:* this is the very
first thing a new player does after HOME's primary CTA, and right now it's two full scrolled screens
of identical lock icons with only one playable card. This isn't a regression (deliberate progression
design, PR #139's own design doc), but it works against "達成感"/"次に何をすればよいか" precisely at
the moment a new player needs the clearest possible "here's what to do" signal. *How to fix:* no
unlock-logic change needed — purely presentational, e.g. visually recede second-chapter-and-beyond
locked cards further (lower contrast/smaller) so the one NEW card reads as obviously primary, or
collapse/summarize far-future locked chapters behind a single "第2章 (未解放)" section header instead
of 7 identical individual cards. *Estimated scope:* `PizzaSelectScreen.tsx` + CSS, no data/logic
changes; 1–2 hours depending on which of the two approaches is chosen.

**P1-5 — RESULT's primary retry CTA sits below the fold (~1.1–1.4× viewport height).**
*Why now:* RESULT is the "did I do well, what next" beat — the natural loop-closing action
(「もう一度つくる」/「別のピザを作る」) should be immediately reachable, not require a scroll past the
score breakdown. *How to fix:* either make the CTA row `position: fixed` to the viewport bottom
(the same pattern `.prepare-bake-bar` already uses during PREPARE — see `App.css`), or move the
score-breakdown detail behind the existing 「くわしいスコアを見る」 disclosure by default so the
collapsed state fits in one screen. *Estimated scope:* CSS-only if using the fixed-bar approach
(reuses an existing pattern); 1 hour.

### P2 (worthwhile polish)
- MakingStepTabs' active-tab color coding (brown/red/yellow/green per step) has no accompanying icon
  or pattern difference — fine for sighted users but worth a look for colorblind-safe redundancy
  given the task's own accessibility callout (text labels are present, so this is low-severity).
- CUT step's instruction card ("ピザを6等分に切ろう！") and PREPARE's `.order-card` are visually
  identical components reused correctly — no issue, noted only as a consistency positive.
- Weekly Ranking's centered small-card presentation (vs. Shop/Inventory/Settings' top-anchored cards)
  is itself an inconsistency once P1-3 is fixed — worth reconciling into one overlay treatment.

### P3 (future / low priority)
- Mozzarella/basil's 「上へドラッグ」 copy overstates drag as the only input method (tap also works).
- Lunch Rush's 0-served result state has no softer messaging than a bare "0" (extremely unlikely in
  real 180s rounds).
- MakingStepTabs' BAKE tab sits flush against the screen's right padding edge at both viewports —
  confirmed **not** an actual overflow (no horizontal scrollbar, `scrollWidth === clientWidth` at
  every screen), just visually tight; a hair more end padding would be safer.

## 7. Screenshots

Saved to `docs/reports/screenshots/visual-polish-2.0-phase0/` (this PR), split by viewport:

- `390x844/` — 21 representative screens: HOME, Recipe Select (grid top/bottom, LOCKED detail,
  mystery LOCKED detail, post-completion grid), full PREPARE/BAKE/CUT sequence for margherita,
  CUT + non-CUT RESULT, Dex/Shop/Inventory/Ranking/Settings overlays, Lunch Rush intro/order/result.
- `360x800/` — 6 cross-check screens (HOME, grid, DOUGH, TOPPING-placed, CUT RESULT, Shop) confirming
  no viewport-specific breakage.

27 screenshots total (of 98 captured during the full automated pass) — kept to the representative set
per the task's "無意味に大量保存しない" instruction; the full 98-screenshot set (including every
individual step of both the margherita/CUT and funghi/non-CUT playthroughs, and the full Lunch Rush
sequence) exists only in this session's scratch directory and was not committed, since the 27 chosen
here cover every distinct UI state referenced in §5/§6.

## 8. Console / overflow results

Zero console errors, zero page errors, zero horizontal overflow across all 98 captured states at both
viewports (raw Playwright report retained in this session's scratch directory, not committed — see
§4/§7 for the summarized numbers). This is a clean result: Recipe Select 2.0A (#139) did not introduce
any regressions of this kind.

## 9. Recipe Select 2.0A consistency

No inconsistencies found between Recipe Select 2.0A and the rest of the app's visual language — card
styling, typography, and spacing match HOME's own card family (`.home-menu__card` / `.pizza-select-
grid-card` share the same warm-cream/gold-border treatment). The one cross-screen inconsistency this
audit did find is broader than Recipe Select: **Recipe Select and HOME are both tightly composed
(minimal dead space), while Making (PREPARE/BAKE/CUT) and three of HOME's four overlays are not**
(Findings P1-1/P1-3). So the app does *not* currently look like one consistent visual system end to
end — HOME and Recipe Select feel "finished", Making and most overlays feel "half-built" by
comparison, even though every individual screen is functionally correct.

## 10. Recommended Visual Polish 2.0A scope (next phase, 2–3 hours)

**Recommendation: ship Finding P1-1 alone as Visual Polish 2.0A.**

Rationale for picking this one over the other four P1s: it's the highest-traffic screen family (every
single round, FREE and Lunch Rush alike, passes through it 4–5 times), it's the most visually obvious
problem in this whole audit (half the screen is empty, at both viewports, on every PREPARE/BAKE/CUT
step), it requires zero gameplay/state/reducer changes (pure layout), and it directly serves the
task's own "HOME/Recipe Select/Making/RESULT が同じゲームに見えるか" question — right now Making is
the one obvious visual outlier, and fixing its density is what would make the biggest felt difference
in a single before/after screenshot comparison.

**Suggested slice:**
1. Increase `PizzaStage`'s rendered size (currently fixed, not viewport-height-aware) so the dough
   circle claims more of the reclaimed vertical space on both DOUGH and SAUCE (today's two emptiest
   steps).
2. For CHEESE/TOPPING (where the ingredient tray already exists), verify the tray + stage together
   now use the space well, adjusting tray card sizing only if needed — no new content required.
3. Re-screenshot all four PREPARE steps + BAKE at 390×844 and 360×800 to confirm the fix and produce
   the after/before comparison.

**What to explicitly defer to a later slice** (do not fold into 2.0A — keep this one slice focused
per the task's own "複数画面を一度に全面改修しない" instruction):
- P1-2 (ranking label) and P1-3 (overlay anchoring) — different component family, trivial to
  cherry-pick into a fast-follow PR once 2.0A's PizzaStage sizing work is reviewed.
- P1-4 (Recipe Select first-impression) — a design decision (recede-vs-collapse) that's worth its own
  short discussion before implementation.
- P1-5 (RESULT CTA below fold) — same `position: fixed` bar pattern as P1-1's own bottom bar, natural
  fast-follow once that pattern is touched anyway, but a separate component (`ResultPanel.tsx`) so
  kept out of this slice.
- All P2/P3 items.

**Estimated Claude Code time for 2.0A as scoped:** 2–3 hours (CSS/layout in `App.css` +
`PizzaStage.tsx` sizing, no test changes expected since no behavior changes, but existing
`PizzaStage.*.test.tsx` suites should be re-run to confirm no coordinate-math regressions from any
sizing change; manual 390×844/360×800 re-screenshot pass to confirm).

## 11. Duplicate Gate #2 (end of audit)

Re-checked immediately before opening this audit's PR:

- `origin/main` HEAD at audit start: `f14217b3db1be69308769838e2510773dd7b2b46`.
- `origin/main` HEAD at audit end: **unchanged**, still `f14217b3db1be69308769838e2510773dd7b2b46` —
  main did not advance during this audit session, so every finding above is current against the
  actual latest main, not a stale snapshot.
- Open PRs re-checked: one new PR appeared during this session, **#140 "Firebase Production Deploy
  via GitHub Actions (Phase 1-2): WIF + workflow" (Issue #134)** — infra/CI only (GitHub Actions +
  Workload Identity Federation), no UI files touched, confirmed non-overlapping with this audit's
  scope (matches the task brief's own note that Firebase/WIF work runs in parallel). No other new
  PRs. No UI-overlapping PR appeared during this audit session.
