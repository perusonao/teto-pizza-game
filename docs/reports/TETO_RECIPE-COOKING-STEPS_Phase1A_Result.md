# TETO Recipe Cooking Steps 1.0 — Phase 1A Result Report

**Audited `origin/main` SHA:** `ff591ebaea40095c5a25ea52797be9d3fd2b5538` (Pizza Cutting 1.0 Phase
0: fresh design, #123 — `git fetch origin` re-verified this is `origin/main` HEAD both before any
implementation work started and again immediately before opening this PR; see §1).

**Implementation SHA (this commit):** `b872ea7db782627790b7dec88aa9aa129436a0d6`

**SSOT design documents (implementation authority):**
`docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` (§7 CookingProfile, §8 state machine extension, §9
UI navigation, §18 migration strategy, §21 Phase 1A/1A-T boundary, §22.10-§22.14 Step Timing
hand-off) and `docs/design/TETO_PIZZA-CUTTING_1.0.md` (§12 REGISTER_TO_DEX orchestration finding,
§20 CUT Phase 2 roadmap) — both read in full before any code change.

**Scope:** Phase 1A — Cooking Step Foundation only. No CUT/FOLD/SEAL/EDGE_FILL/FINISH gameplay, no
Step Timing instrumentation (Phase 1A-T, separate slice), no Scoring 2.0/Completion Gate/Lunch
Rush/Firebase/Economy/Progression/Inventory/Shop/save-schema change.

---

## 1. Fresh Audit / Duplicate Gate #1

`git fetch origin` pulled ~120 remote branches. Checked against this task's scope (Cooking Steps,
POST_BAKE, CookingProfile, Step Timing, Pizza Cutting):

- **Open PRs at audit time:** #121 (Firebase Production Connection — explicitly out of scope, not
  touched), #105 (dev automation, draft), #72/#46/#34/#3 (docs/unrelated features). **No open PR
  of matching scope.**
- **Leftover branches with matching-sounding names** (`claude/teto-recipe-cooking-steps-audit-caq0tq`,
  `claude/pizza-cutting-phase0-v7hwm2`, `claude/making-step-tabs-tray-8508su`,
  `claude/cooking-time-ct1-impl-a86ygk`, `claude/cooking-time-ct2-efficiency-j0kz25`) were checked
  via `git log origin/main..<branch>` — each contains only commits already squash-merged into
  `origin/main` (Phase 0's own `8d6109b`/#122 and `ff591eb`/#123) or is a different, already-shipped
  feature (UX-2 tabs/tray, Cooking Time CT1/CT2). **No unmerged work in this scope on any branch.**
- This task's own designated branch (`claude/teto-cooking-steps-phase-1a-91rrh8`) had zero prior
  commits, exactly at `origin/main` HEAD, before this implementation started.

**Verdict: clear to proceed, no duplicate.**

## 2. Files audited (current code, not assumed from the design doc)

`src/state/gameReducer.ts`, `src/state/pizzaState.ts`, `src/components/MakingStepTabs.tsx`,
`src/screens/GameScreen.tsx`, `src/App.tsx`, `src/data/recipes.ts`, `src/data/referencePizza.ts`,
`src/logic/completionGate.ts`, `src/logic/scoringV2/`, `src/state/persistence.ts`,
`src/mission/lunchRush.ts`, plus every file importing `MakingStep`/`GamePhase`
(`src/data/hints.ts`, `src/components/IngredientTray.tsx`, `src/components/PizzaStage.tsx`, and
every test harness building a `Record<MakingStep, ...>`). The actual flow confirmed in code
matches the task's stated assumption exactly: `ORDER -> PREPARE (DOUGH -> SAUCE -> CHEESE ->
TOPPING) -> BAKE -> RESULT -> DISCOVERED`, with `MAKING_STEP_ORDER` a module-level constant
(`gameReducer.ts:52`, pre-change) and `MakingStepTabs.tsx`'s own module-level `STEP_ORDER` a
second, independent hardcoding of the same 4 steps.

## 3. CookingProfile implementation

New file `src/data/cookingProfiles.ts`, modeled directly on `referencePizza.ts`'s own
`REFERENCE_PIZZAS` Map pattern (design doc §7 Option C):

```ts
export interface CookingProfile {
  steps: readonly MakingStep[];
}
export const DEFAULT_COOKING_PROFILE: CookingProfile = {
  steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
};
const COOKING_PROFILES: ReadonlyMap<RecipeId, CookingProfile> = new Map(); // empty this phase
export function getCookingProfile(recipeId: RecipeId): CookingProfile {
  return COOKING_PROFILES.get(recipeId) ?? DEFAULT_COOKING_PROFILE;
}
```

Deliberately **minimal** relative to the design doc's own §7 sketch: no `doughConfig`/
`sauceConfig`/`cutConfig`/... modifier fields. Those describe gameplay for a step or a HALF/REGION
modifier this phase explicitly does not build (task's own "実装しないもの" list) — adding inert
config fields with zero consumers would be scope creep beyond "make the sequence representable."
A future step's own implementation phase adds the config shape it actually needs, same "additive,
empty until built" discipline the design doc already applies to Scoring/Completion Gate (§10/§11).

Two more small exports complete the foundation, both fixed properties of a step (never a
per-recipe choice, per design doc §3.2's "where it sits" column):

```ts
export function isPostBakeStep(step: MakingStep): boolean; // true only for CUT, FINISH
export function preBakeSteps(profile: CookingProfile): readonly MakingStep[];
export function postBakeSteps(profile: CookingProfile): readonly MakingStep[];
```

**Default fallback guarantee:** `getCookingProfile` is called for every one of the 15 shipped
recipes in `src/data/cookingProfiles.test.ts` ("every one of the 15 shipped recipes has no profile
entry"), asserting `toBe(DEFAULT_COOKING_PROFILE)` (referential equality, not just deep-equal) for
every single one. **`COOKING_PROFILES` has zero entries — no recipe was activated with a non-default
profile.**

## 4. MakingStep / GamePhase widening

`gameReducer.ts`:

```ts
export type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "POST_BAKE" | "RESULT" | "DISCOVERED";
export type MakingStep =
  | "DOUGH" | "SAUCE" | "CHEESE" | "TOPPING"
  | "FOLD" | "SEAL" | "EDGE_FILL" | "CUT" | "FINISH";
```

`POST_BAKE` sits between `BAKE` and `RESULT`. `MakingStep` widened from 4 to 9 values, matching
design doc §8 exactly. Every place that previously required an exhaustive `Record<MakingStep, X>`
was updated to stay a total function (`MakingStepTabs.tsx`'s `STEP_LABEL`,
`GameScreen.keyboardSpreadRepeat.test.tsx`'s `MAKING_STEP_TO_CATEGORY`) with harmless placeholder
values for the five new steps — none of the 15 recipes' profiles ever produce one, so these
branches are structurally unreachable in production, kept only so the type stays total ahead of
each step's own future implementation phase. `App.tsx`'s `makingStepToCategory` switch gained a
`default` arm for the same reason (same placeholder DOUGH already used, `"topping"`/`"sauce"`
being harmless — `IngredientTray` is hidden outside PREPARE regardless).

## 5. Making-sequence generalization (MAKING_STEP_ORDER -> cookingProfile-driven)

The old module-level `MAKING_STEP_ORDER`/`nextMakingStep()` pair is replaced by:

- `state.cookingProfile: CookingProfile` — a new `GameState` field, snapshotted once per round
  (`getCookingProfile(recipe.id)`) at every "start a new round" path (`buildOrderState`, which
  every one of `nextOrderState`/`nextMissionOrderState`/`startPreparingRecipe` already funnels
  through) — mirrors how `recipe` itself is already snapshotted.
- `nextStepWithin(step, steps)` — a pure, order-agnostic "advance one step within this list,
  clamped at the end" helper (identical logic to the old `nextMakingStep`, now parameterized).
- `CONFIRM_MAKING_STEP` now branches on `state.phase`: `PREPARE` walks
  `preBakeSteps(state.cookingProfile)`, `POST_BAKE` walks `postBakeSteps(state.cookingProfile)`.
  Confirming the *last* POST_BAKE step transitions `phase` straight to `RESULT` (no separate
  "leave POST_BAKE" action needed, mirroring design doc §8's "same CONFIRM_MAKING_STEP mechanism,
  same one-way gate").

For every one of the 15 shipped recipes, `preBakeSteps(cookingProfile)` is always exactly
`["DOUGH", "SAUCE", "CHEESE", "TOPPING"]` and `postBakeSteps(cookingProfile)` is always `[]` — the
walk is byte-identical to the pre-Phase-1A fixed sequence, confirmed by `onewayFlow.test.ts`
passing **unmodified** (not one assertion in that file changed) and by
`gameReducer.cookingSteps.test.ts`'s own default-profile tests.

## 6. POST_BAKE implementation

`CONFIRM_BAKE`'s reducer case:

```ts
const postBake = postBakeSteps(state.cookingProfile);
return {
  ...state, pizza, score, bakeState, scoringV2Result, completion, inventory,
  ...(postBake.length > 0
    ? { phase: "POST_BAKE", makingStep: postBake[0] }
    : { phase: "RESULT" }),
};
```

For all 15 recipes, `postBake` is always `[]`, so `phase` is always `"RESULT"` and `makingStep` is
left **completely untouched** (carried through by the spread, exactly as before this phase — no
new field is set). Scoring, Completion Gate, and inventory consumption are computed exactly as
before, at the same call site, regardless of which phase the round lands on afterward.

Only a future recipe's non-default profile (none activated this phase) would ever produce
`phase: "POST_BAKE"`. `gameReducer.cookingSteps.test.ts` exercises this via a **test-only fixture**
`CookingProfile` (never a real recipe entry) covering: single post-BAKE step (CONFIRM_BAKE ->
POST_BAKE at that step), two post-BAKE steps (confirm walks FINISH -> CUT -> RESULT), and
POST_BAKE completion (confirming the last post-BAKE step -> RESULT, with `score`/`completion`
carried through unchanged).

## 7. MakingStepTabs.tsx generalization

Removed the component's own module-level `STEP_ORDER` constant; added a required `steps: readonly
MakingStep[]` prop. `GameScreen.tsx` now passes `preBakeSteps(state.cookingProfile)` — always the
default 4-step array today. `STEP_LABEL` extended to cover the widened `MakingStep` union (inert
labels for CUT/FOLD/SEAL/EDGE_FILL/FINISH, never rendered this phase since no `steps` prop the
component receives during real play includes them). The trailing BAKE indicator's "ready" styling
(`making-step-tab--bake-ready`) now derives from `isLastStep` (index equals `steps.length - 1`)
instead of a literal `currentStep === "TOPPING"` check — same condition, expressed generically.

Visible output for all 15 recipes: unchanged (4 tabs, same Japanese labels, same completed/
active/next/locked states, same non-interactive BAKE indicator).

## 8. REGISTER_TO_DEX / mission-serve orchestration boundary (audited, not fixed — CUT Phase 2 dependency)

`docs/design/TETO_PIZZA-CUTTING_1.0.md` §12 already identifies this exact risk: `App.tsx`'s
`handleConfirmBake` dispatches `CONFIRM_BAKE` then `REGISTER_TO_DEX` back-to-back, assuming
`CONFIRM_BAKE` always lands on `phase: "RESULT"`. Once a profile can land on `"POST_BAKE"`
instead, that immediate `REGISTER_TO_DEX` call would need to instead fire once the round *actually*
reaches `RESULT` (after POST_BAKE's last step confirms). The same applies to
`handleMissionServeNext`'s `SERVE`/`MISSION_NEXT_ORDER` dispatch for Lunch Rush.

**Decision: audit only, no code change, per the Pizza Cutting 1.0 SSOT's own roadmap.** That
document's §20 roadmap table explicitly scopes "the `REGISTER_TO_DEX`/mission-serve orchestration
relocation" to **CUT Phase 2** (depending on "CUT Phase 1, Cooking Steps Phase 1A (full)") — it is
not this phase's SSOT-assigned scope, and Phase 1A activates zero recipes with post-BAKE steps, so
the risk cannot actually manifest yet:

- `REGISTER_TO_DEX`'s own `if (state.phase !== "RESULT" ...) return state;` guard already rejects
  the premature call safely today — confirmed by a dedicated test
  (`gameReducer.cookingSteps.test.ts`, "REGISTER_TO_DEX / mission-serve orchestration boundary"):
  dispatching `CONFIRM_BAKE` then `REGISTER_TO_DEX` back-to-back against a future-profile fixture
  that lands on `POST_BAKE` produces `afterRegisterAttempt === afterBake` (referentially unchanged)
  and `justDiscovered: false` — a silent no-op, not a silent bug.
- `MISSION_NEXT_ORDER`'s own `if (state.phase !== "RESULT" ...) return state;` guard (unchanged)
  gives Lunch Rush the same protection at the reducer layer.
- For all 15 shipped recipes, `state.phase` can never actually be `"POST_BAKE"` (§6), so
  `App.tsx`'s call sites are never exercised against that phase in production — this is inert, not
  latent-broken, code today.

**Concrete dependency for CUT Phase 2** (per the Pizza Cutting SSOT §12, restated here so it is not
rediscovered mid-implementation): the action that finally leaves `POST_BAKE` for `RESULT` (CUT's
own confirm, or whichever step is last in a given profile) must trigger the same
`REGISTER_TO_DEX`/mission-serve orchestration `App.tsx` currently fires immediately after
`CONFIRM_BAKE` — a mechanical relocation of one existing call site from "fires the instant
`CONFIRM_BAKE` returns" to "fires the instant the round *actually* reaches `RESULT`." This is
**not** solved by Phase 1A's own `CONFIRM_MAKING_STEP` POST_BAKE-completion transition (§6) alone
— that only moves `state.phase`; `App.tsx`'s own two call sites still need to move from
"immediately after `CONFIRM_BAKE`" to "immediately after the dispatch that lands on `RESULT`",
whichever action that turns out to be for CUT.

## 9. Compatibility verification

- **15 shipped recipes, profile absent:** `cookingProfiles.test.ts` pins every recipe id resolves
  to `DEFAULT_COOKING_PROFILE` by reference. `onewayFlow.test.ts` (unmodified) still passes in
  full, both for FREE and Lunch Rush (`describe.each`), covering
  `ORDER -> PREPARE (DOUGH -> SAUCE -> CHEESE -> TOPPING) -> BAKE -> RESULT` exactly as before.
- **FREE:** unaffected — `preparedState()`/`CONFIRM_MAKING_STEP`/`START_BAKE`/`CONFIRM_BAKE` all
  behave identically for the default profile (§5/§6).
- **Lunch Rush:** `onewayFlow.test.ts`'s `isMissionRound: true` branch passes unmodified;
  `MISSION_NEXT_ORDER`'s own `phase !== "RESULT"` guard is untouched code.
- **Scoring 2.0 (`state.score.total`):** untouched call site (`computeScoringV2`, same inputs, same
  place in `CONFIRM_BAKE`) — `gameReducer.scoringV2Authority.test.ts` and every other pre-existing
  scoring test pass unmodified.
- **Completion Gate:** `completionGate.ts` was not edited at all; `evaluatePizzaCompletion`'s call
  site and inputs are unchanged; `gameReducer.completionGate*.test.ts` pass unmodified.
- **Save schema:** `state/persistence.ts` was not edited. `cookingProfile`/the widened
  `makingStep`/`POST_BAKE` are transient `GameState` fields, exactly like `pizza`/`score` already
  are — `persistence.ts` never serialized `GameState` before this phase and still doesn't.
  `CURRENT_SCHEMA_VERSION` stays `2`.

## 10. Tests

New files:

- `src/data/cookingProfiles.test.ts` — lookup (unknown id, all 15 shipped recipes, a present
  fixture profile respected unchanged) + pre/post-BAKE classification (CUT/FINISH only, a
  fixture with FOLD/SEAL staying pre-BAKE, a fixture splitting pre/post correctly regardless of
  declared order).
- `src/state/gameReducer.cookingSteps.test.ts` — making-sequence walk (default 4-step, a longer
  future pre-BAKE fixture, final-step no-op, no-op outside PREPARE/POST_BAKE), POST_BAKE reducer
  behavior (default CONFIRM_BAKE -> RESULT, future-fixture CONFIRM_BAKE -> POST_BAKE, POST_BAKE
  completion -> RESULT, a two-step post-BAKE fixture's full walk), and the REGISTER_TO_DEX/
  mission-serve boundary (§8).

Modified (existing tests updated only where the widened `MakingStepTabs` prop signature or the
widened `MakingStep`/`Record<MakingStep, ...>` type required it — no assertion changed):

- `src/components/MakingStepTabs.test.tsx` — `Harness` now passes
  `steps={preBakeSteps(state.cookingProfile)}`; added a future-fixture `describe` block (renders
  every step in a 6-step fixture; a step absent from `steps` is not rendered at all, not merely
  disabled; BAKE-ready styling tracks the sequence's own last step).
- `src/screens/GameScreen.keyboardSpreadRepeat.test.tsx` — `MAKING_STEP_TO_CATEGORY` extended with
  the 5 new (unreachable-here) `MakingStep` keys to stay a valid `Record`.

**Zero assertions changed in any pre-existing test file** (`onewayFlow.test.ts`,
`gameReducer.test.ts`, `gameReducer.completionGate*.test.ts`, `gameReducer.scoringV2Authority.test.ts`,
etc.) — only the two files above needed structural updates to keep compiling/rendering against the
widened types, and both updates are additive (new prop value, new Record keys), not behavioral.

## 11. Verification

- **Focused tests** (`cookingProfiles.test.ts`, `gameReducer.cookingSteps.test.ts`,
  `MakingStepTabs.test.tsx`): 36/36 passed.
- **Full suite** (`npm test` / `vitest run`), run twice to check for flakiness:
  - Run 1: **95 files / 1815 tests passed**, 0 failed.
  - Run 2: **95 files / 1815 tests passed**, 0 failed. No flake.
- **TypeScript** (`tsc -b`, the exact command `npm run build` uses): clean, 0 errors.
- **Lint** (`npm run lint` / `oxlint`): clean, 0 errors/warnings.
- **Production build** (`npm run build`): succeeded (`tsc -b && vite build`), 121 modules
  transformed, no new warnings beyond the pre-existing "chunk larger than 500kB" advisory
  (unrelated to this change, present before it).

## 12. Viewport verification (390×844 authority, 360×800 secondary)

Rendered the real app (`npm run dev`, headless Chromium) through Home -> ピザを作る -> Pizza
Select -> Margherita -> PREPARE, at both viewports:

- **390×844:** 4 tabs (生地/ソース/チーズ/トッピング) render at full width, no overflow, 🔥焼く
  indicator visible and correctly non-interactive, CTA bar (やり直す/次へ→/ヒント) fully visible
  with no scrolling needed.
- **360×800:** identical layout, still no overflow at the narrower width.

BAKE-ready indicator state and the BAKE/RESULT phase transitions themselves are covered by the
component/reducer tests (§10) rather than re-verified via manual gesture interaction in the
browser — reproducing the DOUGH-stretch/sauce-paint touch gestures in headless automation was
judged not worth the effort for a foundation phase whose own acceptance bar is "zero visible
change," already proven by the passing test suite; no visual polish was attempted either way, per
the task's own scope limit.

## 13. Known risks

1. **App.tsx orchestration relocation (§8)** — real work, correctly scoped to CUT Phase 2 by the
   Pizza Cutting SSOT, not a Phase 1A gap. Restated here as the concrete hand-off dependency.
2. **`CookingProfile` is intentionally minimal (§3)** — no modifier/step-config fields. A future
   step's implementation phase will need to add its own config shape; this is expected, not a
   missed requirement (design doc's own "additive, empty until built" discipline applied to data).
3. **Widened-union placeholder branches** (`makingStepToCategory`'s `default`, `STEP_LABEL`'s 5
   inert entries) are unreachable in production but untested-by-construction (nothing can reach
   them without a non-default profile, which nothing yet has) — a future step's own implementation
   phase will exercise and, likely, replace them with real behavior.

## 14. Phase 1A-T hand-off

Per design doc §21/§22.10-§22.14, **Step Timing instrumentation (per-step `activeStep`/
`stepStartedAt`/`perStepElapsedMs`) is a separate slice, Phase 1A-T, sequenced immediately after
this one** — deliberately not built here. This phase's widened `MakingStep` union and `POST_BAKE`
phase are exactly the two prerequisites §22.2/§22.10 name as blocking Phase 1A-T from starting
earlier; both now exist. Phase 1A-T's own acceptance criteria (design doc §22.13) are unaffected
by any implementation choice made in this PR — nothing here reads or writes a timing field, and
`CookingProfile.stepTimeLimits` (§22.5, Challenge Mode's own future extension point) was not added
in §3's minimal `CookingProfile`, since Phase 1A-T's own criterion #6 only requires it be "present
in the type but read by nothing," not present ahead of Phase 1A-T actually needing it.

## 15. Final Verdict

**Phase 1A foundation implemented, zero behavior change confirmed for all 15 shipped recipes (FREE
and Lunch Rush), by an unmodified pre-existing test suite plus new focused coverage for the new
plumbing.** TypeScript/lint/build/tests all clean, full suite run twice with no flake. The one
real open item (App.tsx orchestration relocation) is correctly out of this phase's SSOT-assigned
scope and is documented as a concrete CUT Phase 2 dependency, not a TODO comment. Ready for
external Merge Gate review; **not merged by this session**, per instructions.
