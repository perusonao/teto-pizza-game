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
import type { IdentityDimensions, RuntimeSignature } from "../discovery/signature";

/** `dimensions` is optional so a caller that only knows the base (the NO_SAUCE rule) need not build one; a signature
 *  without it never uses the tray. */
type SignatureView = Pick<RuntimeSignature, "ingredientSet" | "sauceBase"> & Partial<Pick<RuntimeSignature, "dimensions">>;
export type TechniqueTargetView = Pick<DiscoveryTarget, "sauceBase"> & {
  identityDimensions?: Partial<Pick<IdentityDimensions, "pan" | "dough">>;
};

function usesNoSauce(signature: SignatureView): boolean {
  return (
    signature.sauceBase.status === "OBSERVED" &&
    signature.sauceBase.value.length === 0 &&
    signature.ingredientSet.value.length > 0
  );
}

/**
 * TRAY (Square Dough F2): the pizza was cooked on the tray -- the `pan` identity axis is OBSERVED and holds `"tray"`.
 * Only the explicit `PizzaState.pan` counts (signature.ts); a Preview query or a square dough model alone never
 * sets it, so neither can discover the technique.
 */
function usesTray(signature: SignatureView): boolean {
  const pan = signature.dimensions?.pan;
  return pan !== undefined && pan.status === "OBSERVED" && pan.value === "tray" && signature.ingredientSet.value.length > 0;
}

/** A target requires the tray when its identity declares `pan: "tray"` (deep-pan / shallow-pan are not the tray). */
function requiresTray(target: TechniqueTargetView): boolean {
  return target.identityDimensions?.pan === "tray";
}

/** The dough technique's id, exported so the chips' logic (./doughSwitch.ts) needs no literal of its own. */
export const DOUGH_TECHNIQUE_ID: TechniqueId = "dough-pinsa-romana";

/** The `dough` identity value the technique `dough-pinsa-romana` stands for (design §3.2: the one place the id <-> value pairing lives). */
const PINSA_DOUGH = "material-multigrain-long-ferment";

/** DOUGH PINSA ROMANA (Dough Kind P1): the pizza was made with that dough -- the `dough` axis is OBSERVED and holds the value. */
function usesPinsaDough(signature: SignatureView): boolean {
  const dough = signature.dimensions?.dough;
  return dough !== undefined && dough.status === "OBSERVED" && dough.value === PINSA_DOUGH && signature.ingredientSet.value.length > 0;
}

function requiresPinsaDough(target: TechniqueTargetView): boolean {
  return target.identityDimensions?.dough === PINSA_DOUGH;
}

/** Techniques the pizza used, in registry order. */
export function detectTechniquesUsed(signature: SignatureView): TechniqueId[] {
  return TECHNIQUES.filter(
    (t) => (t.id === "no-sauce" && usesNoSauce(signature)) ||
      (t.id === "tray" && usesTray(signature)) ||
      (t.id === "dough-pinsa-romana" && usesPinsaDough(signature)),
  ).map((t) => t.id);
}

/** Techniques a target requires, in registry order. */
export function requiredTechniquesOf(target: TechniqueTargetView): TechniqueId[] {
  const noSauce = Array.isArray(target.sauceBase) && target.sauceBase.length === 0;
  return TECHNIQUES.filter(
    (t) =>
      (t.id === "no-sauce" && noSauce) ||
      (t.id === "tray" && requiresTray(target)) ||
      (t.id === "dough-pinsa-romana" && requiresPinsaDough(target)),
  ).map((t) => t.id);
}
