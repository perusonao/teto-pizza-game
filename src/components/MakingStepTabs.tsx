import type { MakingStep } from "../state/gameReducer";

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
 * BAKE is rendered as a trailing, permanently non-interactive indicator (never a `<button>`) --
 * per Issue #86's own recommendation, leaving `START_BAKE` reachable only through the existing
 * dedicated 「焼く！」 CTA rather than adding a second trigger for leaving PREPARE entirely.
 */

const STEP_ORDER: readonly MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"];

const STEP_LABEL: Record<MakingStep, string> = {
  DOUGH: "生地",
  SAUCE: "ソース",
  CHEESE: "チーズ",
  TOPPING: "トッピング",
};

interface MakingStepTabsProps {
  currentStep: MakingStep;
  /** Whether the immediate next step's tab may currently be tapped to advance -- the same gate
   *  driving the 「次へ」 CTA's own `disabled` attribute (see GameScreen.tsx). Ignored for every
   *  tab that isn't the immediate next one -- those are disabled unconditionally. */
  nextReady: boolean;
  /** Dispatches the reducer's `CONFIRM_MAKING_STEP` -- identical to the 「次へ」 CTA's own
   *  handler. Never called for any tab but the immediate next one. */
  onAdvance: () => void;
}

export function MakingStepTabs({ currentStep, nextReady, onAdvance }: MakingStepTabsProps) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="making-step-tabs" role="tablist" aria-label="ピザづくりの工程">
      {STEP_ORDER.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        const isNext = index === currentIndex + 1;
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
      })}
      {/* Non-interactive by design -- see this file's own header comment. */}
      <div
        className={`making-step-tab making-step-tab--bake ${
          currentStep === "TOPPING" ? "making-step-tab--bake-ready" : ""
        }`}
        aria-hidden="true"
      >
        {"\u{1F525}"} 焼く
      </div>
    </div>
  );
}
