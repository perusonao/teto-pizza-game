/**
 * Cooking Techniques 1.0 TQ-1A (Issue #262): which techniques a pizza *used*, and which techniques a
 * discovery target *requires*. Pure.
 *
 * Direction of dependency: this module reads the discovery signature/target types; the discovery
 * matcher never reads anything technique-related (architecture test: techniques.architecture.test.ts,
 * INV-TQ-NB). A technique is therefore never a precondition for discovering a recipe.
 *
 * NO_SAUCE:
 * - used: the pizza's observed base is empty and at least one piece is on it (an empty pizza is
 *   not "a no-sauce pizza"; the recipe-free Completion Gate already fails it).
 * - required: the target declares its base and that base is empty. Only runtime catalog targets
 *   declare `sauceBase`; a target without it (Phase-2 JSON shape) requires nothing.
 */
import { TECHNIQUES, type TechniqueId } from "../../data/techniques";
import type { DiscoveryTarget } from "../discovery/matcher";
import type { RuntimeSignature } from "../discovery/signature";

type SignatureView = Pick<RuntimeSignature, "ingredientSet" | "sauceBase">;
export type TechniqueTargetView = Pick<DiscoveryTarget, "sauceBase">;

function usesNoSauce(signature: SignatureView): boolean {
  return (
    signature.sauceBase.status === "OBSERVED" &&
    signature.sauceBase.value.length === 0 &&
    signature.ingredientSet.value.length > 0
  );
}

/** Techniques the pizza used, in registry order. */
export function detectTechniquesUsed(signature: SignatureView): TechniqueId[] {
  return TECHNIQUES.filter((t) => t.id === "no-sauce" && usesNoSauce(signature)).map((t) => t.id);
}

/** Techniques a target requires, in registry order. */
export function requiredTechniquesOf(target: TechniqueTargetView): TechniqueId[] {
  const noSauce = Array.isArray(target.sauceBase) && target.sauceBase.length === 0;
  return TECHNIQUES.filter((t) => t.id === "no-sauce" && noSauce).map((t) => t.id);
}
