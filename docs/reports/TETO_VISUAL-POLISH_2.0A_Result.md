# Teto Pizza Game — Visual Polish 2.0A Result

**Type:** Implementation. Visual/layout polish only — no gameplay, scoring, Completion Gate,
dough/sauce/ingredient/bake/CUT judgment, Step Timing, CookingProfile, recipe data,
progression, economy, inventory, Dex, save schema, Firebase, ranking, or Player Profile code
was touched (see §6, Scope guard).

**Audited main SHA (Phase 0 audit):** `f14217b3db1be69308769838e2510773dd7b2b46`
(PR #139, Recipe Select 2.0A — the SHA the Phase 0 Fresh Audit itself reviewed against).

**Merged Phase 0 audit PR:** #141, merge SHA `2b401001f50a393d914b7bff1462aa21911893fc`
(`docs/reports/TETO_VISUAL-POLISH_2.0_Phase0_Fresh-Audit.md`).

**Final base SHA (this session's Duplicate Gate #2, `origin/main` after re-fetch):**
`e02b91bca901c245305c6abadea9d630d829fa8c` (PR #145, Firebase Phase 4a production-deploy
result doc — docs/CI only, no `src/` overlap; fast-forward merged into this branch with zero
conflicts, see §11).

**Branch:** `claude/visual-polish-2-0a-cbmbd9`

**Exact HEAD (implementation commit, this branch, about to be pushed):** see the PR — this
report is written and committed together with the implementation in the same commit.

## 1. Duplicate Gate #1 (session start)

- `git fetch origin` + `git status`: local branch already sitting at `origin/main` HEAD
  (`2b401001f50a393d914b7bff1462aa21911893fc`), working tree clean.
- Open PRs re-checked (#142 Firebase verify-target, #105 Dev Automation A1, #72/#46/#34/#3 —
  all stale docs/infra PRs from earlier sessions): **none touch `PizzaStage.tsx`, `App.css`,
  `GameScreen.tsx`, or any other Making-screen file.** No in-flight Visual Polish 2.0A
  implementation found anywhere — this session's work is not a duplicate.

## 2. Objective

Phase 0 Fresh Audit's **P1-1**: PREPARE/BAKE/CUT left roughly 45–55% of the viewport as dead
empty space below the pizza, at both 390×844 and 360×844. This slice implements **only** that
finding, exactly as the Phase 0 audit's own §10 "Recommended Visual Polish 2.0A scope"
described it — a larger, more visually dominant `PizzaStage`, without pushing the CTA/tray off
screen and without touching any other screen or any gameplay logic.

## 3. What changed

Three files, CSS/layout + one presentational prop — **no gameplay/state/reducer changes**:

- **`src/App.css`** (+24/-1 lines): a new `.pizza-stage--roomy .pizza-dough` rule raising the
  dough's size cap from `min(78vw, 300px)` to `min(92vw, 380px)`.
- **`src/components/PizzaStage.tsx`** (+13/-1): a new optional `roomy?: boolean` prop that
  toggles a `pizza-stage--roomy` class on the existing `.pizza-stage` wrapper div. Nothing else
  in this component changed — the gesture/coordinate code (`clientPointToDoughPercent`, the
  `DOMRect`-based pointer math every gesture family shares) is completely untouched and derives
  its percent space from whatever size the DOM box actually renders at, live, on every
  gesture — so it automatically tracks the new size with no separate update needed (see §5).
- **`src/screens/GameScreen.tsx`** (+9): a `roomyStage` boolean computed from `state.phase`/
  `state.makingStep` (`true` for PREPARE's four steps, BAKE, and POST_BAKE's CUT step; `false`
  for ORDER/RESULT/DISCOVERED), passed straight through as `roomy={roomyStage}`.
- **`src/components/PizzaStage.stageLayout.test.tsx`** (new, focused): pins the `roomy` prop →
  `pizza-stage--roomy` className contract directly, so this addition can't silently regress.

### Sizing decision (what was tried, what shipped)

The first approach tried was a flex-grow `.pizza-stage` absorbing *all* of `.game-screen`'s own
leftover column height (already `flex:1` inside `.app-frame`'s column). Measuring it live showed
this doesn't actually help on a phone-width viewport: the dough's diameter is bounded by
**screen width** (`vw`), not height — on DOUGH/CUT (no ingredient tray, the most leftover
height), flex-grow just re-centered the *same-size* circle inside a much taller box, opening an
equally large gap **above** it (between `.order-card` and the dough) instead of below it. That
reads worse, not better — the pizza looks disconnected from the recipe info above it, which
directly works against the task's own "pizza → 操作 → 次のアクション" reading-order goal. This
was reverted in favor of a plain, larger **static** cap (`min(92vw, 380px)` vs. the old
`min(78vw, 300px)`) that keeps `.pizza-stage`'s pre-2.0A "hug the order card" flow position and
just lets the circle itself claim meaningfully more of the reclaimed space, at both viewports,
without moving anything else. This is a deliberate, measured design decision, not an oversight —
see the CSS's own comment in `App.css` for the same reasoning in place.

## 4. Before / After — measured (Playwright, headless Chromium, live DOM `getBoundingClientRect`)

FREE Margherita, fresh save, both viewports. "Dough diameter" is `.pizza-dough`'s own rendered
`height`; "gap to CTA" is the distance from the dough's bottom edge to `.prepare-bake-bar`'s
top edge (the two steps with no ingredient tray below the stage — DOUGH and CUT — where the
audit's dead space was most visible).

| Step (390×844) | Dough Ø before | Dough Ø after | Gap-to-CTA before | Gap-to-CTA after |
|---|---|---|---|---|
| DOUGH  | 300px | **359px** (+20%) | 266px (31.5% of vp) | **207px** (24.5% of vp) |
| CUT    | 300px | **359px** (+20%) | 346px (41.0% of vp) | **287px** (34.0% of vp) |
| CHEESE | 300px | **359px** (+20%) | tray immediately below both times (unchanged position) |
| BAKE   | 300px | **359px** (+20%) | bake gauge/CTA immediately below both times |

| Step (360×800) | Dough Ø before | Dough Ø after |
|---|---|---|
| DOUGH  | 281px | **331px** (+18%) |

Every one of these was captured at `document.documentElement.scrollHeight === viewport height`
(**ratio 1.00**) both before and after, at both viewports, for DOUGH/SAUCE/CHEESE/TOPPING/BAKE
— i.e. **no new scroll was introduced** on any step that didn't already need it. SAUCE at
360×800 measured `scrollH=802` vs. `vpH=800` after the change (a 2px difference, effectively
subpixel rounding, not a visible or functional scroll).

Representative screenshots (10 total — 4 before/after pairs at 390×844 covering DOUGH/CHEESE/
BAKE/CUT, plus 1 before/after pair at 360×800 for DOUGH as the cross-viewport check) are saved
to `docs/reports/screenshots/visual-polish-2.0a/`.

## 5. Gesture / pointer coordinate integrity (task's own explicit risk callout)

`PizzaStage` places every gesture — DOUGH stretch, SAUCE dispense/paint, CHEESE/TOPPING tap and
physical drag, CUT line drag — in **percent-of-rendered-box** space via
`clientPointToDoughPercent(clientX, clientY, rect)` (`src/logic/pizzaCoordinates.ts`), where
`rect` is `circleRef.current.getBoundingClientRect()` queried fresh at gesture start. This math
has no hard-coded pixel assumption anywhere — it already tracked whatever size CSS rendered
before this change, so growing `.pizza-dough` via CSS could not by itself desync it. Verified
concretely, not just by code reading:

- **Off-center SAUCE dispense** at dough-percent (30, 30) on the new 359px-diameter dough
  visually painted in the correct upper-left quadrant (screenshot inspected).
- **Off-center physical drag** of mozzarella to (65%, 40%) and basil to (35%, 65%) on the new
  size landed exactly at those relative positions (screenshots inspected) — confirms
  `resolvePhysicalDrop`/`pieceDrag.ts` (which shares the same `clientPointToDoughPercent`) is
  equally unaffected.
- **DOUGH stretch-to-completion** and **CUT's 6-wedge guide lines** both rendered proportionally
  correct on the new size (screenshots), confirming `applyStretchPoint`/`buildRimToRimCutLine`
  (which only ever see dough-percent coordinates, never a page pixel) are size-agnostic by
  construction.
- Every existing `PizzaStage.*.test.tsx` suite (`doughStretch`, `sauceParity`, `sauceReset`,
  `cutGesture`, `bakeVisual`) — all built on a fixed 300×300 `DOMRect` test fixture — **passed
  unmodified**, since none of this touched the coordinate math itself, only a CSS class.

## 6. Scope guard — confirmed untouched

`git diff --stat` for this branch touches exactly 3 source files (`App.css`, `PizzaStage.tsx`,
`GameScreen.tsx`) + 1 new test file + this report + its screenshots. Confirmed **not** touched:
`src/logic/scoring*`, `src/logic/cut/evaluation.ts`, `src/logic/doughShape.ts` (except its
already-existing `applyStretchPoint`, unmodified), `src/logic/sauceField.ts`,
`src/state/gameReducer.ts`, `src/data/recipes.ts`, `src/data/cookingProfiles.ts`,
`src/state/persistence.ts` (save schema), `src/state/progression.ts`, `src/state/dex.ts`,
Firebase config, ranking, Player Profile, or `src/mission/lunchRush.ts`'s timer/score semantics.

## 7. 390×844 result

FREE Margherita (CUT) full loop — DOUGH (stretch-to-completion) → SAUCE (dispense) → CHEESE
(physical drag ×3) → TOPPING (physical drag ×2) → BAKE (confirm) → CUT (3 valid lines, one
duplicate-angle line correctly rejected with "同じ位置には切れません", undo, redraw, confirm) →
RESULT — completed end to end with **zero horizontal overflow, zero console/page errors** at
every step. FREE funghi (non-CUT) — PREPARE → BAKE → RESULT — same result, zero overflow/errors
(TOPPING step alone scrolls, `scrollH=998` vs `vpH=844`, unrelated to this change — funghi's own
larger ingredient list, same as before this branch). Lunch Rush — Mission Intro → スタート →
ORDER → Making (MissionHud visible, no collision with the larger stage or the step tabs) → BAKE
→ CUT → MissionServePanel — zero overflow/errors.

## 8. 360×800 result

Same three flows (FREE Margherita CUT, FREE funghi non-CUT, Lunch Rush) re-run at 360×800:
identical outcome — zero horizontal overflow, zero console/page errors, CUT duplicate rejection
and undo both confirmed again, MissionHud still collision-free with the larger stage. 360×800 is
consistently a scaled-down version of the same layout with no new viewport-specific breakage,
matching the Phase 0 audit's own finding that 360×800 introduces no new issues beyond 390×844.

## 9. FREE result

See §7/§8 — both the CUT recipe (margherita) and the non-CUT recipe (funghi) completed the full
PREPARE→BAKE(→CUT)→RESULT loop cleanly at both viewports. RESULT itself renders unchanged
(explicitly out of this slice's scope — Finding P1-5, deferred, see §12) — the test run's rough,
unskilled automated play produced a real "失敗" (failed) RESULT for margherita, which is the
**correct, working behavior of the untouched scoring/Completion Gate**, not a defect introduced
by this branch.

## 10. Lunch Rush result

Mission Intro → スタート → ORDER → Making → BAKE → CUT → MissionServePanel completed cleanly at
both viewports, both with and without the CUT step reached within a mission round. `MissionHud`
(timer + served count, fixed under the header) never collided with the larger `PizzaStage`, the
`MakingStepTabs`, or the fixed CTA bar at any step, at either viewport — confirmed visually via
screenshot at 390×844 (`verify_390x844_missionrush_bake.png` equivalent, in scratch — see the
representative committed set in §4 for the shipped selection).

## 11. Interaction regression result

All explicitly-flagged-at-risk interactions re-verified end to end on the new size (§5, §7, §8):
dough stretch, sauce paint/dispense, mozzarella physical drag, basil physical drag, topping
placement, bake confirm, CUT line drag, **CUT duplicate-line rejection** (message confirmed:
"同じ位置には切れません"), **CUT undo** (progress readout confirmed decrementing 3→2, then
redrawing back to 3), step tabs (checkmarks/active/locked states all rendered correctly through
every step transition in every screenshot), every CTA (「次へ」「焼く！」「取り出す！」「1本戻す」
「切り終わる」「もう一度つくる」「別のピザを作る」「次の注文へ」all functioned), and Lunch
Rush's `MissionHud`. Full Vitest suite (**2069/2069 passed**, 110 files, including every
existing `PizzaStage.*.test.tsx` gesture suite unmodified) confirms no coordinate-math
regression at the unit level either.

## 12. Horizontal overflow / console errors

**Zero** horizontal overflow (`scrollWidth > clientWidth`) and **zero** `console.error`/
uncaught page errors across the entire automated pass — every FREE Margherita/funghi step,
both viewports, plus the full Lunch Rush flow at both viewports (§7/§8 have the per-step
breakdown).

## 13. Duplicate Gate #2 (end of session, before opening the PR)

- `git fetch origin` re-run: `origin/main` had advanced from `2b401001f5...` to
  `e02b91bca901c245305c6abadea9d630d829fa8c` (4 new commits — #142/#143/#144/#145, all
  Firebase production-deploy Phase 3 work: a GitHub Actions workflow, a JDK 21 Firestore
  emulator fix, and two result-report docs).
- `git diff --stat` between those two SHAs: **exactly 2 files changed**, both under
  `.github/workflows/` and `docs/reports/` — zero overlap with this branch's `src/` changes.
- Open PRs re-checked: same 5 from Duplicate Gate #1 (#105/#72/#46/#34/#3), none new, none
  touching Making-screen files.
- **Action taken:** fast-forward merged `origin/main` into this branch (`git merge origin/main`
  — a clean fast-forward, zero conflicts, since the two branches never touched the same files).
  Full `npm test`/`npm run build`/`npm run lint` re-run after the merge — all still pass
  (§14) — confirming the merge introduced no regression.

## 14. Tests

- **Focused (new):** `src/components/PizzaStage.stageLayout.test.tsx` — 3 tests pinning the
  `roomy` prop → `.pizza-stage--roomy` className contract (default-off for ORDER/RESULT,
  on when requested, dough drop-target still renders either way).
- **`npm test -- --run`** (full Vitest suite): **2069/2069 passed**, 110 test files — run twice
  (once before Duplicate Gate #2's merge, once after), identical result both times.
- **`npx tsc -b --noEmit`** (this repo's `package.json` has no separate `typecheck` script —
  `npm run build`'s own `tsc -b && vite build` is the authoritative typecheck + build, per the
  task's own "use package.json as authority" instruction): clean, no errors.
- **`npm run build`**: succeeds, `dist/` produced (924KB main JS bundle, pre-existing
  code-splitting warning unrelated to this change — present before this branch too).
- **`npm run lint`** (`oxlint`): clean, no warnings/errors.

## 15. Known limitations

- The dough circle's diameter is fundamentally bounded by viewport **width** on a phone-portrait
  layout (`vw`-based cap), not height — so DOUGH and CUT (the two steps with no ingredient tray)
  still have a visible, if now clearly smaller, gap between the dough and the fixed CTA bar
  (207px/287px at 390×844, down from 266px/346px). This is a deliberate, bounded outcome per
  the task's own "全工程を無理に完全1画面固定にする必要はない" allowance, not an oversight — see
  §3's sizing-decision writeup for why a flex-grow alternative that *would* close that gap
  further was tried and rejected as visually worse.
- CHEESE/TOPPING's ingredient tray position moved down slightly (e.g. CHEESE's tray top:
  512px → 571px at 390×844) to make room for the larger dough — verified this doesn't push any
  interactive tray content behind the fixed CTA bar (the tray's own existing
  `--bake-bar-reserve` padding already accounts for this, see §11), but a reviewer should
  re-confirm on a real device if the exact tray-to-CTA spacing feels tight at 360×800's smaller
  vertical budget.
- RESULT's own primary CTA remains below the fold on longer score breakdowns (Finding P1-5) —
  unchanged by this branch, explicitly out of scope (see §16).

## 16. Remaining Visual Polish P1 (deferred, per Phase 0 audit's own recommendation)

Per the Phase 0 audit's §10 ("what to explicitly defer to a later slice"), not folded into
2.0A:

- **P1-2** — HOME's 「ランキング」 card copy mismatch ("今週のTOP10" vs. the overlay's own
  "準備中" state).
- **P1-3** — Shop/Inventory/Settings overlays anchor to the top, leaving ~45% dead space below
  the card.
- **P1-4** — Recipe Select's fresh-save first impression (93% grey locks).
- **P1-5** — RESULT's primary retry CTA below the fold.

## 17. Final verdict

**A. SHIPPED AS SCOPED.** Finding P1-1 (PREPARE/BAKE/CUT dead space) is measurably and visibly
reduced at both 390×844 and 360×800 — the dough circle is ~20% larger in diameter at both
viewports, and the two steps with the most visible dead space (DOUGH, CUT) show a ~22%/17%
reduction in the gap between the pizza and the fixed CTA bar — with zero gameplay/state/reducer
changes, zero new horizontal overflow, zero new console errors, zero test regressions (2069/2069
still passing), and every explicitly-flagged-at-risk interaction (gesture coordinates, physical
drag, CUT duplicate-rejection, undo, MissionHud) re-verified working correctly on the new size.
The "flex-grow to fill 100% of leftover space" alternative was tried, measured, and deliberately
rejected in favor of the shipped static-cap approach for the reasons in §3 — this is a
considered design tradeoff, not a partial implementation.
