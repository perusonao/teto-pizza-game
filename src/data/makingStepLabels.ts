import type { MakingStep } from "../state/gameReducer";

/**
 * Gameplay UX PR-C (Timing Transparency): pulled out of `MakingStepTabs.tsx` (a components file,
 * where a react-refresh lint rule flags exporting anything other than a component) into its own
 * data module so both `MakingStepTabs.tsx`'s tab strip and `ResultPanel.tsx`'s Timing Detail
 * table share exactly one label mapping instead of risking a second, independently-maintained
 * copy that could drift (e.g. "トッピング" vs. "具材" -- see Issue #159's own Fresh Audit for why
 * "具材" was picked deliberately).
 */
export const STEP_LABEL: Record<MakingStep, string> = {
  DOUGH: "生地",
  SAUCE: "ソース",
  CHEESE: "チーズ",
  TOPPING: "具材",
  CUT: "カット",
  FOLD: "折りたたみ",
  SEAL: "とじる",
  EDGE_FILL: "ふちづめ",
  FINISH: "仕上げ",
};
