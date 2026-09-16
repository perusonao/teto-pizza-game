# Issue #32 Phase 2 — One-Way Cooking Flow: Fresh Audit

**Mode:** READ-ONLY AUDIT. No implementation, no PR opened.

**Audited SHA (`origin/main`, verified via `git fetch origin main && git rev-parse origin/main`):**

```
f29371164088e294ac813cd548a86b003f9c0c23
```

This matches the merge commit for PR #35 ("Issue #32 Phase 1 Reference/Player visual
consistency"). All findings below are read directly from this exact tree — no assumption is
carried over from prior Phase 4A-1A/4A-1B reports.

Scope guard respected: this audit does not propose or make any change to Scoring 2.0, reference
geometry, ingredient placement scoring, sauce scoring, the save schema, inventory/economy, dough
shaping (Issue #33), or legacy scoring/rewards.

---

## 1. Current step/state model

`GameState.phase` (`src/state/gameReducer.ts:25`) is the *only* state-machine field for the
round:

```ts
export type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "RESULT" | "DISCOVERED";
```

There is **no SAUCE / CHEESE / TOPPING sub-phase in `GameState` at all**. Everything the product
contract calls "SAUCE", "CHEESE", and "TOPPING" happens inside the single `"PREPARE"` phase.

The only thing that currently looks like a per-ingredient-category "step" is `activeCategory`
(`IngredientCategory = "sauce" | "cheese" | "topping"`, `src/data/ingredients.ts:3`), and it is
**plain, ungated `useState` in `App.tsx`** (`App.tsx:77`), not part of `GameState` and not
dispatched through the reducer:

```ts
const [activeCategory, setActiveCategory] = useState<IngredientCategory>("sauce");
...
function handleChangeCategory(category: IngredientCategory) {
  setActiveCategory(category);          // App.tsx:245-247 — unconditional, no guard
}
```

`activeCategory` is a tray-filter selection, not a cooking-step pointer. Switching it never
confirms, locks, or unlocks anything in `GameState`.

**DOUGH is not a real interactive step today.** `IngredientCategory` has exactly three values
(`sauce`, `cheese`, `topping`); there is no `dough` category, no dough ingredient, and no dough
UI/state anywhere in `src/`. PREPARE opens directly onto an already-round dough circle
(`DOUGH_CENTER`/`DOUGH_RADIUS` in `src/logic/pizzaCoordinates.ts` are fixed geometry, not player
input). DOUGH is conceptual only, correctly deferred to Issue #33, and is out of scope here.

## 2. Reducer transitions between SAUCE / CHEESE / TOPPING / BAKE

`gameReducer` (`src/state/gameReducer.ts:192-421`) has no action and no case that represents
"confirm SAUCE", "confirm CHEESE", or "confirm TOPPING". The relevant cases:

- `APPLY_SAUCE` (single-tap sauce ingredients) — guarded only by ingredient ownership. **No
  `state.phase` check at all**, let alone a step check.
- `COMMIT_SAUCE_DISPENSE` (painted/dispensed sauces) — guarded by `state.phase === "PREPARE"`,
  sauce-profile match, ownership, and deposit-batch validity (`gameReducer.ts:226-248`). No
  concept of "sauce already confirmed".
- `PLACE_TOPPING` — used for **both cheese and topping** ingredients (cheese is simply a
  `category: "cheese"` ingredient placed the same way as any topping, see
  `src/data/ingredients.ts:67-91` vs `:99-160`). Guarded by `state.phase === "PREPARE"`,
  finite/in-dough coordinates, and ownership (`gameReducer.ts:250-299`). Nothing distinguishes
  "cheese not yet confirmed" from "topping in progress" — they are the same action against the
  same `pizza.toppings` array.
- `RESET_PIZZA` — wipes the *entire* pizza (`sauceIds`, `sauceDeposits`, `toppings`,
  `bakeResult`) back to `createEmptyPizza()`. **No `state.phase` guard whatsoever**
  (`gameReducer.ts:301-304`): a direct `RESET_PIZZA` dispatch during `BAKE` or `RESULT` would
  silently blank the pizza those phases are displaying/scored from.
- `START_BAKE` — `phase: "PREPARE" → "BAKE"`, unconditional (no check that sauce/cheese/topping
  were ever touched).
- `CONFIRM_BAKE` — `"BAKE" → "RESULT"`, scores the pizza as it stands at that instant.

**There is no reducer state that can distinguish "still painting sauce" from "already placed
three toppings."** Both `APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE` and `PLACE_TOPPING` remain equally
legal for the entire duration of `PREPARE`, in any order, any number of times, interleaved
arbitrarily.

## 3. Current tabs/buttons/navigation UI

`IngredientTray` (`src/components/IngredientTray.tsx:294-309`) renders all three category tabs
(`CATEGORY_ORDER = ["sauce", "cheese", "topping"]`, `src/data/ingredients.ts:170`)
simultaneously and always-enabled:

```tsx
{CATEGORY_ORDER.map((category) => (
  <button ... onClick={() => onChangeCategory(category)}>
    {CATEGORY_LABEL[category]}
  </button>
))}
```

No `disabled`, no "confirm this step" CTA, no visual lock state. `GameScreen.tsx:308-323` mounts
`IngredientTray` unconditionally for the whole `PREPARE` phase with the full three-tab set. The
single "焼く！" (Bake) button in `.prepare-bake-bar` (`GameScreen.tsx:331-341`) is reachable
regardless of `activeCategory` or what has/hasn't been placed — there is no "you must place
cheese before topping" or "you must finish sauce before cheese" gating in the UI either.

## 4. Whether users can currently go backward

**Yes, freely, within PREPARE.** A player can:

1. Paint sauce, tap the "チーズ" tab, place cheese, tap the "トッピング" tab, place a topping,
   then **tap "ソース" again and paint more sauce** (or a different sauce ingredient, subject
   only to the recipe's fixed sauce profile) — `handleChangeCategory` never blocks this, and
   `COMMIT_SAUCE_DISPENSE`/`APPLY_SAUCE` never check whether cheese/toppings already exist.
2. Return to the "チーズ" tab after placing toppings and place more cheese pieces.
3. Repeat step 1/2 any number of times before pressing 焼く！.

The one boundary that *is* enforced is `PREPARE → BAKE`: once `START_BAKE` fires, `BakeOverlay`
(`src/components/BakeOverlay.tsx`) exposes only a single "取り出す！" (confirm) button — there is
no button or reducer path that returns `phase` from `"BAKE"` back to `"PREPARE"`. The only exit
from an in-progress `BAKE`/`PREPARE` round is `handleGoHome`'s whole-round-discard confirm
(`App.tsx:298-310`, `PLAY_AGAIN`/`MISSION`-exit), which matches the contract's "whole-pizza
discard/restart remains the recovery path." So the **PREPARE→BAKE edge is already one-way**; the
gap is entirely *inside* PREPARE, between the three making sub-steps.

## 5. Whether direct reducer actions can bypass UI restrictions

Since the UI restrictions (tab switching) don't exist as restrictions in the first place, this
question collapses to: are `COMMIT_SAUCE_DISPENSE`/`APPLY_SAUCE`/`PLACE_TOPPING` themselves
gated on anything beyond phase/ownership/validity? No. A hand-crafted `dispatch` sequence, a
test, or any future UI regression can freely intermix sauce/cheese/topping actions in any order
for as long as `phase === "PREPARE"` holds — the reducer has nothing more restrictive to bypass.

Additionally, `RESET_PIZZA` has **no phase guard at all**, so a stray/direct dispatch during
`BAKE` or `RESULT` bypasses the "whole-pizza discard is the recovery path, but only while a round
is still being made" implicit assumption — worth closing alongside the one-way fix even though
it's a separate (small) gap from the SAUCE/CHEESE/TOPPING ordering itself.

## 6. Sauce reset/repaint behavior

Confirmed against `src/components/PizzaStage.sauceReset.test.tsx` and the reducer: repaint today
is implemented as a *whole-pizza* `RESET_PIZZA`, not a sauce-scoped reset. There is no
sauce-only "clear just the sauce" action — `やり直す` in the PREPARE action row
(`GameScreen.tsx:332-334`) always wipes toppings and cheese too, whatever `activeCategory` is
active. This already technically satisfies "repaint/reset is allowed while still inside SAUCE"
(painting the same sauce ingredient repeatedly before anything else is placed works fine via
`COMMIT_SAUCE_DISPENSE`'s fresh-application branch, `gameReducer.ts:233-246`), but it does **not**
implement "repaint only within SAUCE" as a scoped concept — it's simply "reset always available,
and sauce repainting works because nothing stops re-committing sauce at any time," which is the
same root gap as section 4.

## 7. Stale pointer/reset-token protections

This layer is **solid and already handles the concern in its current scope**. `PizzaStage.tsx`:

- `resetToken` (bumped by `GameScreen`'s `handleResetPizza` on every `RESET_PIZZA`) aborts any
  in-flight dispense session and invalidates pending pointer capture
  (`PizzaStage.tsx:255-267`, mirrored in `IngredientTray.tsx:215-218`).
- An `activeIngredient` change mid-hold (e.g. a second finger tapping a different tray item)
  aborts the session keyed to the *original* ingredient, never silently re-validates against the
  new selection (`PizzaStage.tsx:269-279`, "Codex Broad Review MUST FIX 1").
- `interactive` going false (BAKE start, Reference popover open, global overlay open) aborts
  immediately (`PizzaStage.tsx:243-253`).
- `blur`/`visibilitychange` abort backgrounded sessions (`PizzaStage.tsx:281-294`).
- `COMMIT_SAUCE_DISPENSE`/`PLACE_TOPPING` both independently re-check `state.phase === "PREPARE"`
  at the reducer boundary, so a late pointerup that survives every UI-side abort still can't
  mutate a round that has already left PREPARE (`gameReducer.ts:227`, `:254`).

**However**, none of this machinery is step-aware, because there is no step to be aware of. A
gesture that is "stale" *for a still-open SAUCE step but already-confirmed CHEESE step* cannot be
described in the current model — the existing guards only distinguish "same PREPARE round" vs.
"gone" (phase left PREPARE, or `resetToken` bumped, or ingredient swapped). Once a step boundary
is introduced (section on minimum fix, below), this exact reset-token/abort pattern is the
mechanism to reuse for "stale gesture from step N must not mutate step N+1" — it is not something
that needs to be invented from scratch, but it does need one more axis (a step id/token) added to
what it already keys off of.

## 8. FREE vs Lunch Rush behavior

No divergence. Both reuse the identical `PREPARE`-phase `GameScreen` markup, the identical
`APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`/`PLACE_TOPPING`/`RESET_PIZZA` actions, and the identical
(absent) step gating. `gameReducer.ts`'s own comments confirm this is deliberate design ("FREE
and Lunch Rush deliberately share this same boundary and profile lookup", `:224`). Whatever
one-way enforcement is added must therefore live in the shared reducer/`GameState` path, not in
`isMissionRound`-conditional code, or FREE/Lunch Rush parity will regress.

## 9. Keyboard/accessibility behavior

`GameScreen.keyboardOverlay.test.tsx`/`GameScreen.keyboardSpreadRepeat.test.tsx` confirm keyboard
placement (Enter/Space on the focused dough) dispatches through the exact same `onTap` →
`APPLY_SAUCE`/`PLACE_TOPPING` path as pointer taps (`PizzaStage.tsx:608`, comment at
`GameScreen.keyboardOverlay.test.tsx:28`: "so a keyboard Enter/Space on the dough exercises the
exact same [...] ingredients -> PLACE_TOPPING"). Category tab buttons are ordinary `<button>`
elements with no keyboard-specific gating either. This means: **whatever gap exists for
pointer/touch also exists identically for keyboard** — there is no separate accessibility-path
regression risk here, but also no accessibility-path exemption to preserve. Any one-way fix must
gate the shared reducer actions (not a pointer-specific layer) so keyboard input inherits the
same enforcement for free.

## 10. Tests already covering the contract

None. Searched `src/state/*.test.ts`, `src/App*.test.tsx`, `src/screens/*.test.tsx`,
`src/components/*.test.tsx` for one-way/lock/confirm/reopen/backward language — every hit is
about ingredient LOCKED/OWNED shop state or unrelated HOME/DISCOVERED flow, not the
SAUCE→CHEESE→TOPPING ordering. `gameReducer.test.ts`, `phase4a1a.regression.test.ts`, and
`phase4a1b.regression.test.ts` all pin the *dispense/pointer* staleness guarantees from section 7
in detail, but none of them assert that sauce is rejected once cheese/topping has started, or
that cheese is rejected once topping has started. This contract is currently **completely
unenforced and completely untested**.

---

## Current flow diagram (as implemented today)

```
ORDER --BEGIN_PREPARE--> PREPARE --START_BAKE--> BAKE --CONFIRM_BAKE--> RESULT --REGISTER_TO_DEX--> DISCOVERED
                            |                       |
                            |                       +-- (no path back to PREPARE)
                            |
                            +-- activeCategory: sauce | cheese | topping
                                (plain useState, freely switchable in any order, any number
                                 of times, for the whole PREPARE duration)
                                  |
                                  +-- APPLY_SAUCE / COMMIT_SAUCE_DISPENSE  -- always legal
                                  +-- PLACE_TOPPING (cheese OR topping)   -- always legal
                                  +-- RESET_PIZZA (whole pizza)           -- always legal,
                                                                             even outside PREPARE
```

`ORDER→PREPARE→BAKE→RESULT→DISCOVERED` is a correctly one-way phase machine. The product
contract's `SAUCE→CHEESE→TOPPING` ordering does not exist as state anywhere in this diagram — it
is currently just a suggested reading order implied by tab position, with zero enforcement.

## Reducer enforcement gaps

1. No `GameState` field represents "which making step is open" or "which making steps are
   confirmed" (SAUCE/CHEESE/TOPPING). Only the phase-level `GamePhase` exists.
2. `APPLY_SAUCE` has no phase guard at all (not even `PREPARE`).
3. `COMMIT_SAUCE_DISPENSE` and `PLACE_TOPPING` both accept their action for the entire PREPARE
   phase regardless of what has already been placed — nothing stops sauce after cheese/topping,
   or cheese after topping.
4. `PLACE_TOPPING` is one action for both CHEESE and TOPPING ingredients; there is no reducer
   distinction between the two steps at all today (only `ingredient.category` on the payload).
5. `RESET_PIZZA` has no phase guard, so it can be dispatched (accidentally or by a future bug)
   outside PREPARE and silently blank an already-baked/scored pizza.

## UI enforcement gaps

1. `IngredientTray`'s three category tabs are always simultaneously enabled
   (`IngredientTray.tsx:296-309`); nothing disables "sauce"/"cheese" once later steps begin.
2. `App.tsx`'s `activeCategory` state has no memory of "highest step reached" — switching back
   is a plain `setState`.
3. No "confirm this step" affordance exists in the UI for SAUCE or CHEESE (only the single
   PREPARE-wide 焼く！ CTA and やり直す reset).

## Stale-event risk

Low for the *existing* scope (see section 7 — pointer/gesture staleness within a single PREPARE
round is already well defended). The risk is **structural, not yet realized**: once step
confirmation is added, every one of the existing abort triggers (`interactive`, `resetToken`,
ingredient-id change) needs to also fire on a step-confirm transition, or a gesture started while
SAUCE was still open (e.g., a slow drag) could commit its `COMMIT_SAUCE_DISPENSE` after the
player has already tapped through to CHEESE. The fix should extend the existing `resetToken`-style
mechanism (bump a token on step confirmation, same as `RESET_PIZZA` already does) rather than
introduce a parallel mechanism.

## FREE / Lunch Rush parity

No divergence found; both share every relevant code path (section 8). Any fix must live in the
shared `gameReducer`/`GameState`/`GameScreen` code, not behind `isMissionRound`.

---

## Minimum fix (without blocking Issue #33)

The smallest change that satisfies the contract without touching scoring/geometry/save schema:

1. Add a making-step field to `GameState`, e.g. `makingStep: "SAUCE" | "CHEESE" | "TOPPING"`,
   initialized to `"SAUCE"` wherever `PREPARE` begins (`BEGIN_PREPARE`, `buildOrderState`, and
   Mission's equivalents). Leave room for `"DOUGH"` to be prepended later by Issue #33 without
   renumbering anything else (a string union, not a numeric index).
2. Add one reducer action, e.g. `CONFIRM_MAKING_STEP`, that advances `makingStep` forward
   (`SAUCE→CHEESE→CHEESE→TOPPING→TOPPING`, i.e. a no-op past `TOPPING`) and bumps a
   `makingStepToken` counter (same pattern as `pizza.sauceToken`/`resetToken`) so PizzaStage's
   existing gesture-abort effects can key off it exactly like they already key off `resetToken`.
3. Gate the three making actions by `makingStep` at the reducer boundary (the actual enforcement
   the contract requires, "not UI-only"):
   - `APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`: reject unless `makingStep === "SAUCE"`.
   - `PLACE_TOPPING` for a `category: "cheese"` ingredient: reject unless `makingStep === "CHEESE"`.
   - `PLACE_TOPPING` for a `category: "topping"` ingredient: reject unless
     `makingStep === "TOPPING"`.
   - `RESET_PIZZA`: keep as the whole-pizza recovery path, but also reset `makingStep` back to
     `"SAUCE"` (or `"DOUGH"` once #33 lands) since a discarded pizza must re-enter at the start
     of the making flow, and add the missing `state.phase !== "PREPARE"` guard while touching
     this case.
4. Wire `activeCategory` to follow (not drive) `makingStep`: replace free tab-switching with tabs
   that are only enabled up to the current/confirmed step (disable "sauce"/"cheese" tabs once
   `makingStep` has advanced past them), and auto-advance `activeCategory` when
   `CONFIRM_MAKING_STEP` fires. This is the UI half of "does not expose backward editing" —
   necessary alongside the reducer gate, not instead of it.
5. Add a small "次へ" (confirm step) CTA in `GameScreen`'s PREPARE action row, shown for SAUCE and
   CHEESE (TOPPING's forward action is the existing 焼く！, which can double as TOPPING's implicit
   confirm — no separate button needed there).
6. Extend `PizzaStage`'s existing `resetToken`-driven abort effect (`PizzaStage.tsx:262-267`) to
   also key off the new `makingStepToken`, exactly the same shape as the existing effect, so a
   gesture in flight when a step confirms is aborted the same way a `RESET_PIZZA` gesture already
   is today.

This keeps `DOUGH` entirely out of scope (Issue #33 can later prepend a `"DOUGH"` value to the
`makingStep` union and add its own `CONFIRM_MAKING_STEP`-consuming step without touching
SAUCE/CHEESE/TOPPING's own gating logic) and touches none of scoring, reference geometry, save
schema, inventory/economy, or legacy scoring.

## Exact likely files

- `src/state/gameReducer.ts` — add `makingStep`/`makingStepToken` to `GameState`, add
  `CONFIRM_MAKING_STEP` action + case, gate `APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`/`PLACE_TOPPING`
  by step, fix `RESET_PIZZA`'s missing phase guard and step reset.
- `src/state/pizzaState.ts` — no schema change expected (step lives on `GameState`, not
  `PizzaState`), but double-check no cross-import assumption breaks.
- `src/App.tsx` — replace free `setActiveCategory` calls with step-derived tab enablement; wire
  `CONFIRM_MAKING_STEP` dispatch; keep `activeCategory` as a *view* of `state.makingStep`.
- `src/components/IngredientTray.tsx` — accept a `lockedCategories`/`maxReachableCategory` prop
  to disable tabs past the current step.
- `src/components/PizzaStage.tsx` — extend the `resetToken` effect (or add a sibling
  `makingStepToken` effect) to abort in-flight gestures on step confirmation.
- `src/screens/GameScreen.tsx` — add the step-confirm CTA to the PREPARE action row.
- `src/mission/lunchRush.ts` — verify no Mission-only path re-derives `activeCategory`/step
  independently (current read: it doesn't; Mission reuses `buildOrderState`/`nextMissionOrderState`
  which would pick up the new field for free).

## Focused test plan

Reducer-level (fastest, highest value — this is what "not UI-only" means to verify):
1. `COMMIT_SAUCE_DISPENSE`/`APPLY_SAUCE` rejected once `makingStep !== "SAUCE"` (post-confirm).
2. `PLACE_TOPPING` with a cheese ingredient rejected once `makingStep === "TOPPING"`.
3. `PLACE_TOPPING` with a topping ingredient rejected while `makingStep === "SAUCE"` or
   `"CHEESE"`.
4. Repaint/reset *while still in SAUCE* still works (`COMMIT_SAUCE_DISPENSE` replace-on-fresh-
   application path unaffected by the new gate).
5. `CONFIRM_MAKING_STEP` is a no-op (or clamps) past `"TOPPING"`, and a no-op if `phase !==
   "PREPARE"`.
6. `RESET_PIZZA` restores `makingStep` to the flow's start and is rejected outside `PREPARE`.
7. Direct-dispatch bypass test: assert a hand-built action sequence (confirm SAUCE, confirm
   CHEESE, then dispatch `COMMIT_SAUCE_DISPENSE`) is rejected purely by the reducer, with no UI
   involved — this is the regression test that pins "reducer enforces it, not UI hiding".
8. FREE vs Lunch Rush parity: same 1-7 assertions run once with `isMissionRound: true`.

Component-level:
9. `IngredientTray`: sauce/cheese tabs become `disabled`/non-interactive once their step is
   confirmed; clicking them is a no-op (mirrors existing `.palette`/`.physicalDragReset` test
   style).
10. `PizzaStage`: a dispense gesture started before a step confirms and released after does not
    dispatch `COMMIT_SAUCE_DISPENSE` (mirrors the existing `resetToken`
    `physicalDragReset`/`sauceReset` test pattern, parameterized over the new token instead of
    `resetToken`).

Keyboard/accessibility:
11. Keyboard Enter/Space placement on the dough is rejected by the same reducer gate once its
    step is closed (reuses `GameScreen.keyboardOverlay.test.tsx`'s harness shape).

## Implementation estimate

Small, self-contained: 1 new `GameState` field, 1 new counter, 1 new action/case, 3 existing
reducer cases gain a one-line guard, 1 existing case (`RESET_PIZZA`) gains 2 lines, plus the
matching UI wiring (tab disabling + one new CTA) and the ~11 tests above. Comparable in size to a
single prior "Human Feel Fix" round in this repo's history (e.g. Phase 4A-1B) —
**estimate: 0.5–1 day** for an implementer already familiar with this reducer, including tests.
No new dependencies, no schema/persistence change (the round-in-progress state, `makingStep`
included, is not persisted today and shouldn't become the first field that is).

---

## Verdict

**B. READY — SMALL ONE-WAY FLOW FIX**

The `ORDER→PREPARE→BAKE→RESULT→DISCOVERED` phase machine is already correctly one-way and needs
no change. The product contract's `SAUCE→CHEESE→TOPPING` ordering, however, does not exist as
enforced state today — it is presently just tab order in the UI, fully reversible in both the UI
and the reducer, with an existing stale-pointer/reset-token pattern that only needs to be
extended (not redesigned) to key off a new step token. This is additive, scoped state-machine
work on top of the existing `GameState`/`gameReducer`/`resetToken` architecture, not a broader
refactor, and it does not touch or block Issue #33's future DOUGH step.
