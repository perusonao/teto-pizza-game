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

/**
 * Cooking Steps 2.0 CS-4a (Owner Decision, T3 compact chips): the label a *completed* or not-yet-reached
 * (locked) tab shows. The active and next tabs keep `STEP_LABEL`, and `aria-label` is always `STEP_LABEL`,
 * so this never changes what a screen reader announces. At most 3 full-width characters, so every
 * step still fits a tab at the 360px / 7-tab worst case (pinned by makingStepLabels.test.ts). Today
 * only the not-yet-shipped FOLD (折りたたみ → 折る) and EDGE_FILL (ふちづめ → ふち) differ from `STEP_LABEL`.
 */
export const STEP_SHORT_LABEL: Record<MakingStep, string> = {
  DOUGH: "生地",
  SAUCE: "ソース",
  CHEESE: "チーズ",
  TOPPING: "具材",
  CUT: "カット",
  FOLD: "折る",
  SEAL: "とじる",
  EDGE_FILL: "ふち",
  FINISH: "仕上げ",
};
