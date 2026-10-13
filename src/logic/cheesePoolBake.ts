import { charIntensity } from "./bakeVisual";
import { clamp01 } from "./referenceMatching";

/**
 * #421 S2-B: how the existing continuous bake scalar (`bakeHeat`, ../logic/bakeVisual.ts: 1 = the recipe's target centre, 2 = burnt) drives the
 * Canvas mozzarella's three inputs. It reuses the bake vocabulary the dough and the M1 cheese already follow (melt intensity, char intensity), plus a
 * golden toast that starts a little before the target. Nothing here touches scoring, timing or the recipe: it only reads `bakeHeat`.
 *
 * `bakeHeat === null` (not baking yet, i.e. while the player is still making the pizza) is the raw, unmelted lump.
 */
export interface CheesePoolBakeParams {
  melt: number;
  toast: number;
  char: number;
}

export function cheesePoolBakeParams(bakeHeat: number | null): CheesePoolBakeParams {
  if (bakeHeat === null) return { melt: 0, toast: 0, char: 0 };
  // S2-B2: the melt runs over heat 0.4 .. 0.95 (about 1.1 s of the bake), wider than the dough/M1 melt intensity (0.5 .. 0.9), so the spread reads as a movement and not a pop
  return { melt: clamp01((bakeHeat - 0.4) / 0.55), toast: clamp01((bakeHeat - 0.7) / 0.7), char: charIntensity(bakeHeat) };
}
