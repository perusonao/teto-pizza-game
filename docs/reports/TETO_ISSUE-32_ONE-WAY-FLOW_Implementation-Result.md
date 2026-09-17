# Issue #32 Phase 2 — One-Way Cooking Flow: Implementation Result

**Base SHA (`origin/main`, verified via `git fetch origin main && git rev-parse origin/main`):**

```
f29371164088e294ac813cd548a86b003f9c0c23
```

This is the exact merge commit for PR #35 ("Issue #32 Phase 1 Reference/Player visual
consistency") and matches the expected base SHA given in the task and the SHA the Fresh Audit
(`docs/reports/TETO_ISSUE-32_ONE-WAY-FLOW_Fresh-Audit.md`) was read against. The audit itself
lives on `claude/teto-pizza-one-way-audit-pwwfo7` (never merged to `main`); this implementation
was branched from a clean `origin/main` at the SHA above, not from the audit branch.

**Implementation HEAD:**

```
38221b7e747b54de148beea338eb6232a948928e
```

on branch `claude/teto-pizza-one-way-flow-2i9pik`, opened as
**[PR #36](https://github.com/perusonao/teto-pizza-game/pull/36)** against `main`. **Not
merged** — this PR is left open for iPhone Human Feel review per the task's instructions.

---

## Scope

Implements the Fresh Audit's "minimum fix" (verdict **B. READY — SMALL ONE-WAY FLOW FIX**)
exactly: a reducer-authoritative `makingStep` field plus one new action
(`CONFIRM_MAKING_STEP`), gating the three making actions by step, fixing `RESET_PIZZA`'s
missing phase guard, and locking the UI tabs to match. DOUGH is untouched and remains Issue
#33's scope. Scoring 2.0, reference geometry/visual work from PR #35, sauce/pieces/recipe
scoring, the Golden Matrix, legacy score/stars/BEST/rewards, the save schema, inventory/
economy, and physical dough shaping are all unmodified — every change in this PR is additive
gating around the existing PREPARE actions.

## State model: before → after

**Before** (per the Fresh Audit): `GameState.phase` (`ORDER | PREPARE | BAKE | RESULT |
DISCOVERED`) was the only state-machine field for a round. SAUCE/CHEESE/TOPPING existed only as
`activeCategory`, a plain `useState<IngredientCategory>` in `App.tsx` — a tray filter, never
dispatched through the reducer, and never gating anything.

**After** (`src/state/gameReducer.ts`):

```ts
export type MakingStep = "SAUCE" | "CHEESE" | "TOPPING";
```

added to `GameState` alongside a `makingStepToken: number` counter. Both are initialized in
`buildOrderState` (the one shared "start a fresh round" path for free play, `PLAY_AGAIN`, and
every Mission order) to `"SAUCE"` / `0`, so every entry point into a round — including Mission's
`MISSION_NEXT_ORDER`/`MISSION_RESET_ORDER`, which reuse `buildOrderState` — starts the making
flow at SAUCE with no separate initialization path to drift out of sync. A string union (not a
numeric index), so Issue #33 can prepend `"DOUGH"` later without renumbering anything.

`App.tsx`'s `activeCategory` is now a pure *view*:

```ts
function makingStepToCategory(step: MakingStep): IngredientCategory { ... }
const activeCategory = makingStepToCategory(state.makingStep);
```

`setActiveCategory`/free category switching no longer exist — `handleChangeCategory` is kept as
an explicit no-op (IngredientTray's tab `onClick` still calls it, since tabs are otherwise
disabled) rather than deleted, to make "clicking a tab does nothing" an intentional, documented
fact rather than a silently unwired prop.

## New action: `CONFIRM_MAKING_STEP`

```ts
case "CONFIRM_MAKING_STEP": {
  if (state.phase !== "PREPARE") return state;
  const makingStep = nextMakingStep(state.makingStep);
  if (makingStep === state.makingStep) return state;
  return { ...state, makingStep, makingStepToken: state.makingStepToken + 1 };
}
```

`nextMakingStep` walks a fixed `["SAUCE", "CHEESE", "TOPPING"]` order and clamps at the end —
forward-only, a no-op past `"TOPPING"`, and a no-op outside `PREPARE`. There is no action in
`GameAction` that sets `makingStep` to an earlier step; `TOPPING → BAKE` remains the pre-existing,
separate `START_BAKE`/`phase` transition, never touched by this action.

## Reducer guards (the actual enforcement)

| Action | Guard added |
|---|---|
| `APPLY_SAUCE` | `state.phase !== "PREPARE" \|\| state.makingStep !== "SAUCE"` → reject. (Also closes a pre-existing gap: this action previously had **no** phase guard at all.) |
| `COMMIT_SAUCE_DISPENSE` | Same `makingStep !== "SAUCE"` guard, alongside its existing `phase`/sauce-profile/ownership/deposit-batch checks. |
| `PLACE_TOPPING` | Looks up the placed ingredient's own `category` (`getIngredient`) and rejects unless it matches the current step: `category === "cheese"` requires `makingStep === "CHEESE"`; `category === "topping"` requires `makingStep === "TOPPING"`; a `category === "sauce"` id is rejected outright (this action was never meant to place sauce). This is the fix for the audit's core finding: `PLACE_TOPPING` was one action for both cheese and topping ingredients with zero distinction between the two steps. |
| `RESET_PIZZA` | Gains a `state.phase !== "PREPARE"` guard (previously **none** — a stray dispatch during BAKE/RESULT could have silently blanked a scored pizza). On success, resets `makingStep` to `"SAUCE"` and bumps `makingStepToken`, so a discarded pizza always re-enters the making flow at its start. |

Every guard is a plain reducer condition in `src/state/gameReducer.ts`, independent of any
component — `src/state/onewayFlow.test.ts` proves this directly by hand-building a dispatch
sequence (confirm SAUCE, confirm CHEESE, then dispatch `COMMIT_SAUCE_DISPENSE`/`PLACE_TOPPING`
for cheese) with no UI involved at all and asserting the state object reference is unchanged.

## UI flow

`src/components/IngredientTray.tsx`'s category tabs now compute `disabled={!isActive}` for
every tab except the one matching the reducer's own `makingStep`. A tab before the current step
renders with a ✓ prefix and a `.category-tab--completed` class (quieter fill, not a "broken
control" look); a tab after it gets `.category-tab--locked` (dimmed). Native `<button disabled>`
removes the element from the tab order and suppresses both click and keyboard
(Enter/Space)-triggered activation, so a locked step cannot be reactivated through any input
path — the reducer's own `makingStep` gate remains the final backstop regardless.

`src/screens/GameScreen.tsx`'s PREPARE action row now shows a "次へ →" button (dispatching
`CONFIRM_MAKING_STEP`) in the same slot as 焼く！ while `makingStep` is `SAUCE` or `CHEESE`; once
`makingStep === "TOPPING"`, the slot reverts to the existing 焼く！ button unchanged — TOPPING's
own forward action is `START_BAKE`, which already leaves PREPARE entirely, so no separate
"confirm TOPPING" button was added (matching the audit's estimate exactly).

## Stale-event handling

The audit identified that the existing `resetToken`-driven gesture-abort pattern in
`PizzaStage.tsx`/`IngredientTray.tsx` (which already aborts an in-flight sauce dispense or
physical drag on `RESET_PIZZA`, an ingredient change, an overlay opening, `blur`/
`visibilitychange`, or `interactive` going false) was not step-aware, because there was no step
to be aware of. This implementation extends that exact same pattern rather than inventing a
second mechanism:

- Both components gained a new `makingStepToken: number` prop, fed `state.makingStepToken` from
  `GameScreen`.
- Both components gained a sibling `useEffect` — identical in shape to the existing `resetToken`
  effect — that calls the same `abortActiveGesture()`/`clearSession()` on a `makingStepToken`
  change.

Since `CONFIRM_MAKING_STEP` and `RESET_PIZZA` both bump `makingStepToken`, a sauce-paint gesture
or physical drag started while a step was still open is aborted the instant that step is
confirmed (or the pizza is discarded) — its buffered deposits/drag session are discarded
locally and never reach the reducer. The reducer's own `makingStep`/`phase` guards above are the
independent backstop if a stale event somehow still arrived.

## RESET behavior

`RESET_PIZZA` now: (1) rejects outside `PREPARE` (pins the audit's gap #5), (2) always resets
`makingStep` to `"SAUCE"` and bumps `makingStepToken`, and (3) is the *only* path back to SAUCE
from CHEESE/TOPPING — there is no other backward-editing route. Pinned in
`onewayFlow.test.ts`'s `RESET` describe block (parameterized over every starting step) and in
`App.humanFeelFix3.test.tsx`'s rewritten "shows the panel again only after a whole-pizza
discard/restart back to Sauce" test.

## FREE / Lunch Rush parity

No mode-specific making-step code was introduced. Both modes build their round state through
the same `buildOrderState` (free play's `nextOrderState`, and Mission's
`nextMissionOrderState` — both funnel into it, as they already did pre-existing), so both start
at `makingStep: "SAUCE"` identically, and both dispatch the exact same
`APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`/`PLACE_TOPPING`/`CONFIRM_MAKING_STEP`/`RESET_PIZZA`
actions through the one shared `gameReducer`. `src/state/onewayFlow.test.ts` runs its entire
SAUCE/CHEESE/TOPPING/ORDER/RESET suite twice via `describe.each(["FREE", false], ["Lunch Rush",
true])` — 56 tests total, half FREE and half Lunch Rush, identical assertions.

## Tests

**New:**

- `src/state/onewayFlow.test.ts` — **56 tests**, parameterized over FREE/Lunch Rush: SAUCE
  actions accepted/rejected by step, SAUCE→CHEESE, stale-event rejection after transition,
  CHEESE/TOPPING acceptance and rejection by category+step, forward-only `CONFIRM_MAKING_STEP`
  (no skip, no backward move, clamped past TOPPING, no-op outside PREPARE), the direct
  hand-built bypass-attempt test, `RESET_PIZZA` determinism (parameterized over
  SAUCE/CHEESE/TOPPING) + phase guard, `TOPPING → BAKE` + `CONFIRM_BAKE` scoring parity
  unchanged.
- `src/components/IngredientTray.stepLock.test.tsx` — **6 tests**: only the current step's tab
  enabled at each of the three steps, a completed step renders with ✓ and the `--completed`
  class, a locked tab's click never fires `onChangeCategory`, and a disabled tab cannot be
  keyboard-focused.

**Updated** (existing fixtures that placed cheese/topping ingredients without confirming a step
first, now advancing via `CONFIRM_MAKING_STEP` the same way a real "次へ"/焼く！ tap would):
`gameReducer.test.ts`, `gameReducer.pieceDrag.test.ts`, `logic/pieceDrag.test.ts`,
`IngredientTray.palette.test.tsx`, `IngredientTray.physicalDragReset.test.tsx`,
`GameScreen.physicalDragOverlay.test.tsx`, `GameScreen.keyboardOverlay.test.tsx`,
`GameScreen.keyboardSpreadRepeat.test.tsx`, `App.test.tsx`, `App.humanFeelFix3.test.tsx`. Three
component test files (`PizzaStage.sauceParity.test.tsx`, `PizzaStage.sauceReset.test.tsx`,
`IngredientPieceVisual.test.tsx`) gained the new required `makingStepToken` prop.

**Totals:** full `npm test` (Vitest): **831/831 passed** (was 769 before this change; +62 new,
0 regressions, 0 skipped). This single run covers making-flow, sauce gesture/reset/stale-event,
physical ingredient interaction, Scoring 2.0 + Golden Matrix (`scoringV2.test.ts`, unmodified
and passing unchanged), and FREE/Lunch Rush integration — there is one Vitest suite in this repo,
not separate focused/full runs.

```
npx tsc -b        → clean (0 errors)
npx oxlint        → clean (0 warnings/errors)
npm run build     → succeeds (dist/index.html, assets/*.js 306KB, assets/*.css 29KB)
git diff --check  → clean
```

## CI

PR #36's `build` check (lint + test + build in one job, per `.github/workflows/ci.yml`) is
**green**:

**[Run #83 — success](https://github.com/perusonao/teto-pizza-game/actions/runs/35130921844)**
(head SHA `38221b7`).

## Preview deployment

Deployed to `perusonao/teto-pizza-game-preview` (source ref: the exact implementation HEAD SHA
`38221b7e747b54de148beea338eb6232a948928e`, PR #36) via that repo's manual two-step pipeline
(confirmed unchanged from the process the Phase 1 report documented):

1. **`deploy-from-source.yml`**
   [run #9 — success](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35131013531) —
   checks out `perusonao/teto-pizza-game@38221b7`, runs
   `vite build --base=/teto-pizza-game-preview/` with `VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=36
   VITE_PREVIEW_SHA=38221b7`, rewrites the manifest's `start_url`/`scope` to the preview path,
   injects the `noindex, nofollow` meta tag, and pushes the result into this repo's `site/` at
   commit
   [`b788b2b`](https://github.com/perusonao/teto-pizza-game-preview/commit/b788b2b63e7eeb2e34253e6bb0927ad8e23b5337).
2. **`pages.yml`**
   [run #14 — success](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35131134066) —
   as the Phase 1 report noted from this same repo's run history, the push in step 1 did not
   auto-trigger this workflow, so it was dispatched manually as the required second step.

**Deployed Preview URL: https://perusonao.github.io/teto-pizza-game-preview/**

**Preview safeguards verified** by reading the committed `site/index.html` and
`site/manifest.webmanifest` directly from the deployment commit (this sandbox's network egress
to `perusonao.github.io` is blocked, so the live page itself could not be fetched from here —
see Remaining Human Feel checks below):

| Safeguard | Verified |
|---|---|
| Preview base path | ✅ `/teto-pizza-game-preview/` on every asset/icon/manifest link in `site/index.html` |
| noindex/nofollow | ✅ `<meta name="robots" content="noindex, nofollow" />` present |
| Manifest `start_url`/`scope` | ✅ rewritten to `/teto-pizza-game-preview/` (not production's `/teto-pizza-game/`) |
| PR/SHA badge | Baked into the JS bundle via `VITE_PREVIEW_PR=36 VITE_PREVIEW_SHA=38221b7` at build time (`PreviewBadge.tsx`, unmodified by this PR) — not independently visible from a static file read; expected to render `PREVIEW · PR#36 · 38221b7` on load, per the same build inputs the Phase 1 deployment used and confirmed live |
| Preview save namespace | ✅ same unmodified `VITE_PREVIEW_MODE`-gated localStorage key from `persistence.ts` — this PR does not touch the save schema or persistence code at all |
| Production unchanged | ✅ this deployment only pushed to `teto-pizza-game-preview`; no commits/pushes/workflow runs against `teto-pizza-game`'s `main` or `deploy.yml` |

## Remaining Human Feel checks

Everything achievable from this sandboxed environment (reducer contract, UI lock behavior, CI,
build, and preview deployment/config) is done and green. Still to verify on a real device at
**https://perusonao.github.io/teto-pizza-game-preview/** (390×844, iPhone Safari):

- SAUCE: paint, やり直す repaint, 次へ confirm — the actual finger-drawn feel, not just the
  reducer accepting the dispatch.
- CHEESE: confirm the ソース/チーズ tabs are visually unmistakable as done/current (not just
  functionally disabled) — no way to reach the ソース tab by tapping or swiping; place
  mozzarella; 次へ confirm.
- TOPPING: confirm no path back to チーズ/ソース; place basil; 焼く！ → RESULT flows as before.
- Whole-pizza discard/restart (やり直す) from each step, confirming it visually and
  interactively lands back on a blank SAUCE step.
- General 390×844 layout: the new "次へ" CTA and the ✓/locked tab styling fit within the
  existing 1-screen budget (Human Feel Fix 3) without introducing scrolling.

---

## Verdict

**A. READY FOR IPHONE HUMAN FEEL**
