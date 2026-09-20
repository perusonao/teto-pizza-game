/**
 * Pizza Cutting 1.0 Phase 2 (docs/design/TETO_PIZZA-CUTTING_1.0.md): test-only helper shared by
 * every existing test file whose own fixture used to reach `RESULT` the instant `CONFIRM_BAKE`
 * landed -- true for every recipe before this phase, and still true for the 14 recipes whose
 * `CookingProfile` has no post-BAKE steps (`../../data/cookingProfiles.ts`'s
 * `DEFAULT_COOKING_PROFILE`). Margherita's own profile now adds one post-BAKE `"CUT"` step
 * (`COOKING_PROFILES`), so `CONFIRM_BAKE` lands it on `POST_BAKE` instead -- this walks the rest
 * of the way to `RESULT` by committing the minimum required, evenly-spaced "ideal" cut lines and
 * confirming, exactly the same one-way `CONFIRM_MAKING_STEP` mechanism a real player's "カット完了"
 * tap uses. A complete no-op passthrough (returns `state` immediately) for every CUT-free recipe,
 * which is already sitting at `RESULT` the moment this is called -- no existing test's own
 * assertions about *those* recipes' behavior change by routing their setup through this helper
 * too, so it is safe to use unconditionally rather than only for margherita-specific fixtures.
 */
import { gameReducer, type GameState } from "../gameReducer";
import { requiredCutCount } from "../../logic/cut/evaluation";
import { resolveRequestedSliceCount, type CutLine } from "../../logic/cut/types";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../../logic/pizzaCoordinates";

/** `count` full diameters through the dough's exact center, evenly spaced by angle -- the same
 *  "ideal" fixture shape Phase 1's own geometry/evaluation tests already use for a perfect N-way
 *  cut, reused here purely to produce a valid, `requiredCutCount`-satisfying set of lines; this
 *  helper does not care about (and no caller asserts on) the resulting `cutResult` quality. */
function idealCutLines(count: number): CutLine[] {
  const lines: CutLine[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * i) / count;
    const dx = Math.cos(angle) * DOUGH_RADIUS;
    const dy = Math.sin(angle) * DOUGH_RADIUS;
    lines.push({
      start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy },
      end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy },
    });
  }
  return lines;
}

/**
 * Given a state fresh off `CONFIRM_BAKE` (whatever phase it landed on -- `RESULT` directly for
 * every CUT-free recipe, `POST_BAKE` for margherita), returns the state at `RESULT`. For a
 * CUT-enabled round, commits `requiredCutCount` ideal lines via `ADD_CUT_LINE` and confirms via
 * `CONFIRM_MAKING_STEP` (walking every post-BAKE step in the profile, not just CUT, so a future
 * multi-post-BAKE-step fixture is still handled correctly). `now` is threaded through to every
 * `CONFIRM_MAKING_STEP` dispatch the same way a real caller would.
 */
export function walkPostBakeToResult(state: GameState, now?: number): GameState {
  let next = state;
  while (next.phase === "POST_BAKE") {
    if (next.makingStep === "CUT") {
      const required = requiredCutCount(resolveRequestedSliceCount(next.cutState.config));
      for (const line of idealCutLines(required)) {
        next = gameReducer(next, { type: "ADD_CUT_LINE", line });
      }
    }
    next = gameReducer(next, { type: "CONFIRM_MAKING_STEP", now });
  }
  return next;
}
