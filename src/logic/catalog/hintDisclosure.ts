/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the ONLY way hint information reaches the catalog model.
 *
 * Privacy boundary B-3 / B-4 (Implementation Gate §4, Owner Decision Gate §6):
 * - `disclosedHintsFromSheetView` reads what the hint sheet has **shown**: the revealed chips of a
 *   SELECTABLE view and the named lines of a TARGET (Dex-0 onboarding) view. It never reads the hint
 *   model, the target, the Rule W reserve or any unrevealed fact -- the view does not carry them
 *   (OD-H3-16), and this module does not import the modules that do.
 * - LC-R0 carries ONLY the named-ingredient path. The attribute-answer -> library-filter mapping of
 *   PR #272 was a second family membership authority and is not migrated; it returns with LC-4
 *   (hint -> pantry) after an audit against the Hint 5.0 ladder, expressed as shelves (OD-B5: no new k>=2 rule).
 * - Not yet audited against the Hint 5.0 ladder view fields; unwired.
 */
import type { HintSheetView } from "../../state/discoveryHint";
import { cleanIds } from "./catalogTypes";

export interface DisclosedHints {
  /** Ingredients the sheet has shown by name. */
  namedIngredientIds: readonly string[];
}

export const NO_DISCLOSED_HINTS: DisclosedHints = { namedIngredientIds: [] };

export function disclosedHintsFromSheetView(view: HintSheetView | null | undefined): DisclosedHints {
  if (!view) return NO_DISCLOSED_HINTS;
  if (view.kind === "SELECTABLE") {
    const named = view.presentation.rows.flatMap((row) => row.revealed.map((chip) => chip.ingredientId));
    const legacy = view.grandfatheredSteps.map((step) => step.namedIngredientId);
    return { namedIngredientIds: cleanIds([...named, ...legacy]) };
  }
  if (view.kind === "TARGET") {
    return { namedIngredientIds: cleanIds(view.steps.map((step) => step.namedIngredientId)) };
  }
  return NO_DISCLOSED_HINTS;
}
