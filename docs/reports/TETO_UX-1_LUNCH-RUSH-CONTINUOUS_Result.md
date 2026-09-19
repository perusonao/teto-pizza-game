# TETO UX-1: Lunch Rush Continuous Per-Pizza Progression — Result

## Audited main SHA
`ccdf77722c8bed8d9560d5b5d5a02bcb6b344649` (PR #84 merge, "docs: Gameplay UX Next -- Fresh Audit
(read-only, verdict A)") — confirmed via `git fetch origin` + `git log -1 origin/main` as the
actual latest `origin/main` at the start of this session; matches the SHA given in the task
description.

## Issue
[#85 — UX-1: Lunch Rush continuous per-pizza progression (remove redundant 「ピザを作る！」
tap)](https://github.com/perusonao/teto-pizza-game/issues/85)

## Branch
`claude/lunch-rush-continuous-progression-58ko5o`, created fresh from `origin/main` at the SHA
above (no prior commits on the branch).

## PR
Opened against `main`, left **OPEN** (not merged) per task instructions. See final report message
for the PR number/URL.

## HEAD SHA
See final report message (recorded after commit/push).

## Changed files
- `src/App.tsx` — `handleMissionServeNext` (one new dispatch line)
- `src/App.test.tsx` — one new integration test (two consecutive Lunch Rush pizzas)
- `docs/reports/TETO_UX-1_LUNCH-RUSH-CONTINUOUS_Result.md` — this report

No other files touched. No reducer case, no scoring/economy/inventory logic, no screen/component
files changed.

## Fresh re-audit before implementing
Re-read `App.tsx`, `gameReducer.ts`, and `GameScreen.tsx` directly against the current `origin/main`
HEAD (not from the audit doc's memory) and confirmed the Fresh Audit's §2 findings still held
exactly, byte-for-byte:
- `handleMissionServeNext` (`App.tsx:295-306`) dispatched `SERVE` then, if not expired,
  `MISSION_NEXT_ORDER` only — landing at a fresh `phase: "ORDER"` state every time
  (`gameReducer.ts`'s `nextMissionOrderState` → `buildOrderState`, unconditional).
- `GameScreen.tsx:325-331` renders the single ORDER-phase CTA, labeled 「ピザを作る！」 for any
  non-FREE mission mode, wired to `onBeginPrepare` → `dispatch({ type: "BEGIN_PREPARE" })`.
- `BEGIN_PREPARE` (`gameReducer.ts:308-313`) is an unconditional `phase -> "PREPARE"` transition
  with no phase guard, rebuilding `hint` from `state.recipe`/`state.pizza`/`state.makingStep`.
- A same-tick, back-to-back two-`dispatch()` pattern from one `App.tsx` handler is already an
  established, tested pattern in this exact file: `handleConfirmBake` (`App.tsx:288-293`) already
  dispatches `CONFIRM_BAKE` then `REGISTER_TO_DEX` in one handler tick for FREE, relying on React
  18 batching the two `useReducer` updates into one render — the same mechanism this change reuses
  for Mission.
- A reducer-level precedent for "build a fresh order state, then immediately advance to PREPARE"
  already exists (`startPreparingRecipe`, `gameReducer.ts:266-284`, used by `SELECT_RECIPE` and
  `RETRY_SAME_RECIPE`) — this confirms landing straight at PREPARE with a freshly built order is
  not a new state shape, just a new call site producing the same shape via two dispatches instead
  of one combined reducer case.

Verdict: the audit's "one-line handler change" analysis holds exactly on current `main`. No drift
since PR #84.

## Previous flow
```
MissionServePanel "次の注文へ" tap
  -> handleMissionServeNext()
       dispatch(SERVE)
       dispatch(MISSION_NEXT_ORDER)   // phase -> "ORDER" (new recipe, fresh empty pizza)
  -> GameScreen renders ORDER phase: single CTA "ピザを作る！"
  -> player taps it -> dispatch(BEGIN_PREPARE) -> phase -> "PREPARE"
```
Two taps ("次の注文へ" then "ピザを作る！") were required per pizza after the first.

## New flow
```
MissionServePanel "次の注文へ" tap
  -> handleMissionServeNext()
       dispatch(SERVE)
       dispatch(MISSION_NEXT_ORDER)   // phase -> "ORDER" (new recipe, fresh empty pizza)
       dispatch(BEGIN_PREPARE)        // NEW -- phase -> "PREPARE", same tick
  -> GameScreen renders straight at PREPARE (DOUGH step) -- ORDER never paints
```
One tap ("次の注文へ") is now enough to reach the next pizza's PREPARE/DOUGH step. RESULT
(`MissionServePanel`'s score/stars/served-count screen) is completely unchanged — the player still
explicitly confirms it with a tap before advancing; only what that tap does downstream changed.

## Reducer / state impact
None. No `gameReducer.ts` case was added or modified. `BEGIN_PREPARE` and `MISSION_NEXT_ORDER` are
both pre-existing, unmodified actions; the only change is a new call site (`App.tsx`) dispatching
an already-existing action immediately after another already-existing dispatch, inside an
already-existing handler. Because `BEGIN_PREPARE` unconditionally sets `phase: "PREPARE"` from
whatever `state` it's handed, and `MISSION_NEXT_ORDER` always produces a `phase: "ORDER"` state
with `score: null`/`bakeState: null`/`makingStep: "DOUGH"` (fresh round), the two dispatches
compose exactly the same way `startPreparingRecipe` already composes `buildOrderState` +
PREPARE-advance for `SELECT_RECIPE`/`RETRY_SAME_RECIPE` — no new state shape is reachable.

React 18 batches both `dispatch()` calls (and the `missionDispatch(SERVE)` above them) into a
single render, so the intermediate `phase: "ORDER"` state is never committed to the DOM — no flash
of the ORDER screen, confirmed visually in the 390×844 verification below.

## FREE regression
None by construction, not by an added conditional. `handleMissionServeNext` is only ever wired to
`MissionServePanel`'s `onNext` prop (`GameScreen.tsx:426-432`, rendered only when
`state.phase === "RESULT" && state.score && isMissionPlaying`). FREE's own ORDER→PREPARE gate uses
a separate call site, `onBeginPrepare={() => dispatch({ type: "BEGIN_PREPARE" })}`
(`App.tsx:563`), wired to `GameScreen.tsx:325-331`'s CTA — untouched. Every existing FREE-mode
test in `src/App.test.tsx` (Pizza Select → PREPARE, HOME → Pizza Select, discard-in-progress
confirm, etc.) passed unmodified in the full suite run below, and `mode切替` (Lunch Rush ⇄ FREE)
has no new code path to regress.

## Inventory / EP3 regression
None. `consumePizzaInventory` (referenced from `CONFIRM_BAKE`) and `RESTOCK_INGREDIENT` are
untouched files/cases; this change never touches `CONFIRM_BAKE`, `PURCHASE_INGREDIENT`, or
`RESTOCK_INGREDIENT`. Inventory consumption and Pitz reward both already happen exactly once, at
`CONFIRM_BAKE`/`REGISTER_TO_DEX` time, which this slice does not call an extra time — Mission's own
per-pizza Dex/score registration (`MISSION_NEXT_ORDER`'s `registerScoreToDex` call) is called
exactly once per `handleMissionServeNext` invocation, same as before this change (still gated by
the pre-existing "not expired" check, still only reachable from one call site).

## Tests
New: `src/App.test.tsx` — *"Lunch Rush: 次の注文へ skips the redundant ORDER gate and lands
straight at PREPARE"*. Drives two consecutive full pizzas through Lunch Rush (ORDER → DOUGH →
SAUCE → CHEESE → TOPPING → BAKE → RESULT → 次の注文へ) and asserts, after each 「次の注文へ」 tap:
- No 「ピザを作る！」 button is rendered (item 2 in the task's required test list).
- The DOUGH drop target renders immediately (proves phase landed at PREPARE, not ORDER) — item 1.
- `MissionHud`'s served-count element (`.mission-hud__served`) reads `1` then `2` across the two
  pizzas — items 3/5 (completed-pizza count and score/HUD state keep advancing correctly, not just
  once).

Reused rather than duplicated: the existing
*"Lunch Rush: CONFIRM_BAKE still shows MissionServePanel..."* test's exact tap sequence and
`completeDoughStep()` helper — same scaffolding, extended forward instead of a parallel harness.

Existing coverage in the full suite already pins the remaining required items without new
duplicate tests, since this change touches no code they exercise:
- Item 6 (timer): `lunchRush.test.ts`'s full `MissionClock`/expiry suite is untouched code, passed
  unmodified.
- Item 7 (mission end condition): `missionRunReducer`'s `SERVE`-at-deadline rejection path
  (`App.tsx:298-305`, unchanged) is exercised by existing Mission expiry tests, passed unmodified.
- Item 8/9 (no double inventory consumption / no double Pitz grant): `CONFIRM_BAKE` and
  `REGISTER_TO_DEX` are unmodified; `gameReducer.inventoryConsumption.test.ts` and
  `gameReducer.pitzReward.test.ts` passed unmodified.
- Item 10 (mode-switch regression): all HOME/FREE/Lunch Rush navigation tests in `App.test.tsx`
  passed unmodified.

## Full suite count
```
Test Files  65 passed (65)
     Tests  1299 passed (1299)
```
(includes the 1 new test above; every other test file/assertion is byte-identical to what existed
on `origin/main` before this change — no test was edited or deleted).

## Typecheck / Lint / Build
- `npx tsc -b` — clean, no errors.
- `npx oxlint` — clean, exit code 0, no findings.
- `npm run build` (`tsc -b && vite build`) — succeeded:
  ```
  dist/index.html                   1.26 kB
  dist/assets/index-Cy0J8kUc.css   36.86 kB
  dist/assets/index-CocW8l_2.js   329.46 kB
  ✓ built in 473ms
  ```

## 390×844 verification
No project-specific "run the app" skill existed for this repo, so the app was driven directly:
`vite` dev server on `127.0.0.1:5173`, headless Chromium (`/opt/pw-browsers/chromium`) via
`playwright-core`, viewport locked to 390×844. Flow driven end to end: HOME → 「ランチラッシュ」→
「スタート」→ pizza 1 (ORDER「ピザを作る！」→ DOUGH → 3×「次へ」→「焼く」→「取り出す！」→
RESULT「次の注文へ」) → pizza 2 (same sequence, **no** ORDER tap needed this time) →「次の注文へ」.

Assertions (script output):
```json
{
  "doughVisibleAfterPizza1": true,
  "orderButtonVisibleAfterPizza1": false,
  "doughVisibleAfterPizza2": true,
  "orderButtonVisibleAfterPizza2": false,
  "overflow": { "scrollWidth": 390, "clientWidth": 390 },
  "servedCountText": "🍕 2",
  "consoleErrors": []
}
```
- No horizontal overflow (`scrollWidth === clientWidth === 390`).
- No browser console errors/page errors across the whole run.
- `score`/`servedCount` correct and monotonically advancing (`🍕 2` after 2 pizzas).
- No unnecessary intermediate operation: 「ピザを作る！」 never reappeared after pizza 1.
- Screenshots captured confirm visually: RESULT screen (`04-result.png`) shows the unchanged score
  (5点, ★☆☆☆☆), served count (+1 SERVED (1)), and 「次の注文へ」 CTA; the very next screenshot
  (`05-after-pizza1-next-order.png`) shows the next recipe (フンギ) already at the DOUGH-shaping
  PREPARE screen, timer still running (2:59), with no ORDER-phase button in between.

## Unresolved issues
None found. The one "open detail, not blocking" the Fresh Audit flagged (§2: `BEGIN_PREPARE`
recomputes `hint` from the fresh empty pizza/DOUGH step) behaves identically to the pre-existing
separate-tap flow — confirmed no change in hint text/timing beyond when the dispatch fires.

## Scope confirmation
Out-of-scope items explicitly NOT touched: Making Step Tabs (#86), Ranking (#87), Pizza Select
Pager (#88), Achievement Reset (#89), Ingredient Tray redesign, Inventory UI, EP4 Starter Stock,
economy rebalance, save schema changes, broad RESULT redesign. `git diff --stat` against
`origin/main` confirms only `src/App.tsx` (+8 lines) and `src/App.test.tsx` (+40 lines) changed,
plus this report — no reducer file, component file, or schema file touched.

## FINAL VERDICT
**A. UX-1 COMPLETE — READY FOR MERGE REVIEW**

Per task instructions, this PR is left OPEN and is NOT merged.
