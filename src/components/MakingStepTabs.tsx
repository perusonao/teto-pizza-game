import type { MakingStep } from "../state/gameReducer";
import { STEP_LABEL } from "../data/makingStepLabels";

/**
 * Issue #86 (UX-2): a second, primary-navigation affordance for the PREPARE making flow,
 * alongside the pre-existing 「次へ」/「焼く！」 CTA (GameScreen.tsx's `.prepare-bake-bar`, kept
 * unchanged as an auxiliary control). DOUGH/SAUCE/CHEESE/TOPPING each get a real tab here --
 * unlike the pre-Issue-86 `IngredientTray`'s own `category-tabs` strip (Issue #32 Phase 2),
 * which only ever covered SAUCE/CHEESE/TOPPING (DOUGH has no `IngredientCategory` of its own)
 * and whose tap was wired to an explicit no-op (App.tsx's old `handleChangeCategory`) -- every
 * tab here is either a real "you are here" indicator or a real forward-navigation control.
 *
 * SSOT discipline (no UI-side validation duplication): the *only* action a tap here can ever
 * fire is `onAdvance`, which the caller wires to the exact same `CONFIRM_MAKING_STEP` dispatch
 * the 「次へ」 CTA already uses (see GameScreen.tsx) -- this component makes no dispatch
 * decisions of its own. Since the reducer's `CONFIRM_MAKING_STEP` only ever advances exactly
 * one step forward (`nextMakingStep`, src/state/gameReducer.ts) and is a no-op everywhere else,
 * only the *immediate next* tab is ever wired to fire it -- a completed tab, the active tab
 * itself, and any tab further ahead are all structurally non-interactive (`disabled`), so a
 * multi-step "jump" can never be expressed here even before the reducer's own forward-only gate
 * would reject it.
 *
 * `nextReady` mirrors the CTA's own completion gate (currently only DOUGH's
 * `doughShapeComplete`, computed once in GameScreen/App.tsx and threaded into both this
 * component and the CTA button, never recomputed here) -- SAUCE/CHEESE/TOPPING have no
 * reducer-side or UI-side completion gate today, so their own "next" tab is always tappable the
 * moment it becomes the immediate next step.
 *
 * Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §9): this
 * component no longer owns its own fixed 4-step array -- the caller (GameScreen.tsx) passes the
 * active round's own pre-BAKE sequence (`steps`, `preBakeSteps(state.cookingProfile)`,
 * ../data/cookingProfiles.ts). Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps): that
 * sequence is now recipe-specific -- always `["DOUGH", ...]` plus whichever of SAUCE/CHEESE/
 * TOPPING the active recipe actually requires (`getCookingProfile`'s own `deriveCoreSteps`), so a
 * recipe with no required cheese/topping ingredient renders no CHEESE/TOPPING tab at all rather
 * than an empty one. This component makes no such decision itself -- it renders exactly whatever
 * `steps` it is given, same as before.
 *
 * Issue #159 P0 (Cooking UI 1-Screen Polish): a real-device Fresh Audit (2026-09-21) found the
 * strip only ever rendered during PREPARE, so a cut-target recipe's own CUT step never appeared
 * in this nav at all (it got a separate, PREPARE-strip-less POST_BAKE screen instead) -- the
 * step sequence a player saw was inconsistent depending on where they were in the round. This
 * component now optionally also renders `postSteps` (`postBakeSteps(state.cookingProfile)`,
 * always `["CUT"]` for margherita today, `[]` for every other recipe -- i.e. still fully
 * recipe-aware, no new per-recipe logic added here) after the BAKE indicator, and takes an
 * explicit `currentPhase` so the same strip can render correctly (steps before BAKE showing
 * completed, BAKE itself showing active, `postSteps` showing locked) once GameScreen mounts it
 * during BAKE and POST_BAKE too, not just PREPARE -- "一貫表示" (Issue #159's own wording) means
 * the full 生地→ソース→チーズ→トッピング→焼く→切る sequence is visible and legible at every one
 * of those phases, not just before BAKE. `currentPhase` defaults to `"PREPARE"` and `postSteps`
 * defaults to `[]`, so every pre-#159 caller/test that only passed `steps`/`currentStep` keeps
 * behaving exactly as before.
 */

// Issue #159 P0: TOPPING's tab label is "具材" here, not the "トッピング" this recipe's own
// hint/inventory copy elsewhere still uses (that copy is untouched -- see this issue's own
// acceptance criteria wording, "具材/トッピング", which names both). A narrow tab strip fitting
// six items (DOUGH/SAUCE/CHEESE/TOPPING + the BAKE indicator + CUT for a cut-target recipe)
// within 361-390px was the actual mechanism behind "「焼く」のはみ出し" -- "トッピング"'s own
// 5-character width alone pushed the flex row's total content past the viewport, clipping the
// trailing BAKE/CUT tabs off the right edge (real-device Fresh Audit, 2026-09-21). "具材" is
// half the width and reads naturally as the same step.
// Gameplay UX PR-C (Timing Transparency): moved to ../data/makingStepLabels.ts so ResultPanel.tsx's
// own Timing Detail table can reuse the exact same recipe-step labels this tab strip uses, without
// a components file exporting a non-component (oxlint's react-refresh rule flags that).

interface MakingStepTabsProps {
  /** The active round's own ordered pre-BAKE step sequence (`preBakeSteps(state.cookingProfile)`,
   *  ../data/cookingProfiles.ts) -- always `["DOUGH", "SAUCE", "CHEESE", "TOPPING"]` for every one
   *  of the 15 shipped recipes today. */
  steps: readonly MakingStep[];
  /** Issue #159 P0: the active round's own ordered POST_BAKE step sequence
   *  (`postBakeSteps(state.cookingProfile)`) -- `["CUT"]` for margherita, `[]` (the default) for
   *  every other recipe today. Rendered after the BAKE indicator so a cut-target recipe's own
   *  nav reads 生地→ソース→チーズ→トッピング→焼く→切る end to end. */
  postSteps?: readonly MakingStep[];
  currentStep: MakingStep;
  /** Issue #159 P0: which of the three phases this round is currently in -- drives whether
   *  `steps`/the BAKE indicator/`postSteps` read as completed/active/locked. Defaults to
   *  `"PREPARE"` (this component's only phase before #159), so a caller mounting it only during
   *  PREPARE never needs to pass this explicitly. */
  currentPhase?: "PREPARE" | "BAKE" | "POST_BAKE";
  /** Whether the immediate next step's tab may currently be tapped to advance -- the same gate
   *  driving the 「次へ」/「切り終わる」 CTA's own `disabled` attribute (see GameScreen.tsx).
   *  Ignored for every tab that isn't the immediate next one -- those are disabled
   *  unconditionally. */
  nextReady: boolean;
  /** Dispatches the reducer's `CONFIRM_MAKING_STEP` -- identical to the 「次へ」/「切り終わる」
   *  CTA's own handler. Never called for any tab but the immediate next one. */
  onAdvance: () => void;
}

interface TabVisualState {
  isCompleted: boolean;
  isActive: boolean;
  isNext: boolean;
}

function tabState(
  index: number,
  currentIndex: number,
  sectionReached: boolean,
  sectionCurrent: boolean,
): TabVisualState {
  if (!sectionCurrent) {
    // This section (pre-BAKE steps or postSteps) isn't the one the round is currently walking --
    // either it's already fully done (sectionReached, every tab in it reads as completed) or it
    // hasn't started yet (every tab locked).
    return { isCompleted: sectionReached, isActive: false, isNext: false };
  }
  return {
    isCompleted: index < currentIndex,
    isActive: index === currentIndex,
    isNext: index === currentIndex + 1,
  };
}

export function MakingStepTabs({
  steps,
  postSteps = [],
  currentStep,
  currentPhase = "PREPARE",
  nextReady,
  onAdvance,
}: MakingStepTabsProps) {
  const preIndex = steps.indexOf(currentStep);
  const postIndex = postSteps.indexOf(currentStep);
  const isPreCurrent = currentPhase === "PREPARE";
  const isPostCurrent = currentPhase === "POST_BAKE";
  // Pre-BAKE steps read as fully completed once the round has moved on to BAKE or POST_BAKE --
  // there is no partial-completion state for this section from either of those phases.
  const preReached = currentPhase !== "PREPARE";
  const postReached = false; // postSteps can never be "already done" while this strip is visible
  // (POST_BAKE's own last step leaving POST_BAKE ends the round -- RESULT renders a different
  // screen entirely, not this strip).

  const bakeIsActive = currentPhase === "BAKE";
  const bakeIsCompleted = currentPhase === "POST_BAKE";
  // Ready to tap 「焼く！」: the pre-BAKE section's own last step is current and tappable-next
  // territory has been fully walked -- unchanged meaning from pre-#159 (steps' own last index).
  const bakeReady = isPreCurrent && preIndex === steps.length - 1;

  function renderTab(step: MakingStep, state: TabVisualState) {
    const { isCompleted, isActive, isNext } = state;
    const isLocked = !isActive && !isCompleted && !isNext;
    const tappable = isNext && nextReady;
    const label = STEP_LABEL[step];
    return (
      <button
        key={step}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-current={isActive ? "step" : undefined}
        className={`making-step-tab making-step-tab--${step.toLowerCase()} ${
          isActive ? "making-step-tab--active" : ""
        } ${isCompleted ? "making-step-tab--completed" : ""} ${
          isNext ? "making-step-tab--next" : ""
        } ${isLocked ? "making-step-tab--locked" : ""}`}
        disabled={!tappable}
        onClick={tappable ? onAdvance : undefined}
      >
        {isCompleted ? `✓ ${label}` : label}
      </button>
    );
  }

  return (
    <div className="making-step-tabs" role="tablist" aria-label="ピザづくりの工程">
      {steps.map((step, index) =>
        renderTab(step, tabState(index, preIndex, preReached, isPreCurrent)),
      )}
      {/* Non-interactive by design -- see this file's own header comment. START_BAKE stays
          reachable only through the dedicated 「焼く！」 CTA, never a tap here. */}
      <div
        className={`making-step-tab making-step-tab--bake ${
          bakeReady ? "making-step-tab--bake-ready" : ""
        } ${bakeIsActive ? "making-step-tab--bake-active" : ""} ${
          bakeIsCompleted ? "making-step-tab--completed" : ""
        }`}
        aria-hidden="true"
      >
        {bakeIsCompleted ? "✓ 焼く" : "焼く"}
      </div>
      {postSteps.map((step, index) =>
        renderTab(step, tabState(index, postIndex, postReached, isPostCurrent)),
      )}
    </div>
  );
}
