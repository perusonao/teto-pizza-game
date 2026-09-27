/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the ONLY way hint information reaches the catalog model.
 *
 * Privacy boundary B-3 / B-4 (Implementation Gate §4, Owner Decision Gate §6):
 * - `disclosedHintsFromSheetView` reads what the hint sheet has **shown**: the revealed chips of a
 *   SELECTABLE view and the named lines of a TARGET (Dex-0 onboarding) view. It never reads the hint
 *   model, the target, the Rule W reserve or any unrevealed fact -- the view does not carry them
 *   (OD-H3-16), and this module does not import the modules that do.
 * - `libraryFilterForAttribute` maps a DH4 attribute answer to a library filter at exactly the
 *   answered granularity: a family answer -> that family; a group answer -> every family of the
 *   group (never the reserve's own family); a category answer -> the whole category; existence or
 *   anything unrecognized -> no filter. It never narrows below the answer and takes no reserve.
 */
import type { HintSheetView } from "../../state/discoveryHint";
import { cleanIds, type CatalogCategory, type CatalogFamilyId, type CatalogFamilyTable } from "./catalogTypes";

export interface DisclosedHints {
  /** Ingredients the sheet has shown by name. */
  namedIngredientIds: readonly string[];
  /** DH4 attribute answers the sheet has shown, verbatim (`attr:family:meat`, ...). */
  attributeFactIds: readonly string[];
}

export const NO_DISCLOSED_HINTS: DisclosedHints = { namedIngredientIds: [], attributeFactIds: [] };

export function disclosedHintsFromSheetView(view: HintSheetView | null | undefined): DisclosedHints {
  if (!view) return NO_DISCLOSED_HINTS;
  if (view.kind === "SELECTABLE") {
    const named = view.presentation.rows.flatMap((row) => row.revealed.map((chip) => chip.ingredientId));
    const legacy = view.grandfatheredSteps.map((step) => step.namedIngredientId);
    return { namedIngredientIds: cleanIds([...named, ...legacy]), attributeFactIds: [] };
  }
  if (view.kind === "TARGET") {
    return { namedIngredientIds: cleanIds(view.steps.map((step) => step.namedIngredientId)), attributeFactIds: [] };
  }
  return NO_DISCLOSED_HINTS;
}

/** Adds attribute answers the sheet has shown (DH4-2 will supply them; unwired today). */
export function withDisclosedAttributes(hints: DisclosedHints, factIds: readonly unknown[]): DisclosedHints {
  return { ...hints, attributeFactIds: cleanIds([...hints.attributeFactIds, ...factIds]) };
}

export type LibraryFilter =
  | { kind: "none" }
  | { kind: "families"; families: readonly CatalogFamilyId[] }
  | { kind: "category"; category: CatalogCategory };

const CATEGORIES = new Set<string>(["sauce", "cheese", "topping"]);

/** `taxonomy` is DH4-1's family table, injected (production passes `ATTRIBUTE_FAMILIES`). */
export function libraryFilterForAttribute(factId: unknown, taxonomy: CatalogFamilyTable): LibraryFilter {
  if (typeof factId !== "string") return { kind: "none" };
  const FAMILY_IDS = new Set<string>(taxonomy.families.map((f) => f.id));
  const GROUP_IDS = new Set<string>(taxonomy.families.map((f) => f.group));
  const parts = factId.split(":");
  if (parts.length !== 3 || parts[0] !== "attr") return { kind: "none" };
  const [, level, value] = parts;
  if (level === "family" && FAMILY_IDS.has(value)) {
    return { kind: "families", families: [value] };
  }
  if (level === "group" && GROUP_IDS.has(value)) {
    // Every family of the group, in taxonomy order -- the answer's own granularity.
    const families = taxonomy.families.filter((f) => f.group === value).map((f) => f.id);
    return { kind: "families", families };
  }
  if (level === "category" && CATEGORIES.has(value)) return { kind: "category", category: value as CatalogCategory };
  return { kind: "none" };
}
