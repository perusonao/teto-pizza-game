/**
 * Cooking Techniques 1.0 TQ-1D: what the Dex's 「調理法」 section shows, pure.
 *
 * Authority: docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md (P6) and OD-TQ1D.
 * - DISCOVERED (in the ledger): the technique's name.
 * - RIDDLE (not in the ledger, but its affordance is open): 「？？？」 and the fixed riddle -- never
 *   the name, the id or the concrete action.
 * - anything else (not discovered, affordance not open): nothing is shown, so a technique no recipe
 *   the player can reach requires is never even hinted at.
 * It reads the ledger, the Dex and the ladder only; never a recipe's own sauce or a target identity.
 */
import { TECHNIQUES, type TechniqueId } from "../../data/techniques";
import type { DexState } from "../../state/dex";
import { creditedDiscoveredCount } from "../../state/materialEntitlement";
import { isTechniqueAffordanceOpen, knownTechniqueIds, techniqueAffordanceStep } from "./registration";
import { productionTechniqueContext, type TechniqueRuntimeContext } from "./runtime";

export type TechniqueDexView =
  | { id: TechniqueId; state: "DISCOVERED"; nameJa: string }
  | { id: TechniqueId; state: "RIDDLE"; riddleJa: string };

export function techniqueDexViews(
  ledger: readonly string[],
  dex: DexState,
  context: TechniqueRuntimeContext = productionTechniqueContext(),
): TechniqueDexView[] {
  const known = new Set(knownTechniqueIds(ledger));
  const credited = creditedDiscoveredCount(dex, context.countsTowardLadder);
  const views: TechniqueDexView[] = [];
  for (const t of TECHNIQUES) {
    if (known.has(t.id)) {
      views.push({ id: t.id, state: "DISCOVERED", nameJa: t.nameJa });
    } else if (isTechniqueAffordanceOpen(techniqueAffordanceStep(t.id, context.catalog, context.materialStep), credited)) {
      views.push({ id: t.id, state: "RIDDLE", riddleJa: t.riddleJa });
    }
  }
  return views;
}
