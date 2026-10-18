/**
 * Cooking Techniques 1.0 TQ-1A (Issue #262): which techniques a pizza *used*, and which techniques a
 * discovery target *requires*. Pure.
 *
 * Direction of dependency: this module reads the discovery signature/target types; the discovery
 * matcher never reads anything technique-related (architecture test: techniques.architecture.test.ts,
 * INV-TQ-NB). A technique is therefore never a precondition for discovering a recipe.
 *
 * tray-bake (Square Dough F2, Issue #538): used when the signature's OBSERVED `pan` axis is "tray" (and a piece is on
 * the pizza); required when the target's `identityDimensions.pan` is "tray". Both read the pan axis only; the shape
 * axis stays UNAVAILABLE and the matcher is untouched.
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

type SignatureView = Pick<RuntimeSignature, "ingredientSet" | "sauceBase"> & Partial<Pick<RuntimeSignature, "dimensions">>;
export type TechniqueTargetView = Pick<DiscoveryTarget, "sauceBase"> & Partial<Pick<DiscoveryTarget, "identityDimensions">>;

function usesNoSauce(signature: SignatureView): boolean {
  return (
    signature.sauceBase.status === "OBSERVED" &&
    signature.sauceBase.value.length === 0 &&
    signature.ingredientSet.value.length > 0
  );
}

/** tray-bake (Square Dough F2): the signature's observed `pan` axis is "tray" and a piece is on the pizza. */
function usesTrayBake(signature: SignatureView): boolean {
  const pan = signature.dimensions?.pan;
  return pan?.status === "OBSERVED" && pan.value === "tray" && signature.ingredientSet.value.length > 0;
}

/** tray-bake: the target's declared `pan` identity dimension is "tray". Only the target's own declaration is read. */
function requiresTrayBake(target: TechniqueTargetView): boolean {
  return target.identityDimensions?.pan === "tray";
}

/** Techniques the pizza used, in registry order. */
export function detectTechniquesUsed(signature: SignatureView): TechniqueId[] {
  return TECHNIQUES.filter(
    (t) => (t.id === "no-sauce" && usesNoSauce(signature)) || (t.id === "tray-bake" && usesTrayBake(signature)),
  ).map((t) => t.id);
}

/** Techniques a target requires, in registry order. */
export function requiredTechniquesOf(target: TechniqueTargetView): TechniqueId[] {
  const noSauce = Array.isArray(target.sauceBase) && target.sauceBase.length === 0;
  return TECHNIQUES.filter((t) => (t.id === "no-sauce" && noSauce) || (t.id === "tray-bake" && requiresTrayBake(target))).map(
    (t) => t.id,
  );
}
