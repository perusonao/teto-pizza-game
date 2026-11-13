/**
 * R-1: the EXPECTED catalog, composed from two independent records -- never read from the code under test. TEST SUPPORT ONLY.
 *
 *   expected  =  FROZEN BASELINE  (+)  the landed train specs
 *
 * - `frozenBaseline.json` is the shipped catalog at one historical commit (`node tools/train-kit/cli.mjs freeze`): history, committed once.
 * - `src/trainKit/landed/*.json` are the Owner-approved train specs, in landing order (`seq`). `apply` writes one per train.
 *
 * A test that used to pin "89 ladder steps", "the late step is 88", "the floors are { ... }" or "the 9th step from the end is X" now compares the
 * implementation to this composition with EXACT equality (`catalogComposition.test.ts` and the historical batch tests). The detection power is the same
 * as a hand-written number; what disappears is only the per-train edit of dozens of files. This module imports no catalog module (the ladder-bridge,
 * `.emoji` and Preview-isolation gates scan every non-test file under src/), so it can never be "derived from the implementation".
 */
import type { KitTrain } from "../../../../tools/train-kit/lib/implSpec";
import baselineJson from "./frozenBaseline.json";

export interface FrozenBaseline {
  readonly commit: string;
  readonly recipes: readonly { readonly id: string; readonly credited: boolean; readonly late: boolean }[];
  readonly ingredients: readonly { readonly id: string; readonly category: string; readonly family: string | null; readonly late: boolean }[];
  readonly ordinaryLadder: readonly LadderRow[];
  readonly lateLadder: readonly LadderRow[];
  readonly floors: Readonly<Record<string, number>>;
  readonly chapterSizes: readonly number[];
  readonly lunchRushPool: number;
}
export interface LadderRow {
  readonly ingredientIds: readonly string[];
  readonly keyRecipeId: string;
  readonly starGates?: Readonly<Record<string, number>>;
}

export const FROZEN: FrozenBaseline = baselineJson as FrozenBaseline;

const landedModules = import.meta.glob<KitTrain>("../../../trainKit/landed/*.json", { eager: true, import: "default" });
/** Landed trains in landing order. */
export const LANDED: readonly KitTrain[] = Object.values(landedModules).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

/** The recipe gated off in a build without Pinsa (`TETO_PINSA_OFF=1`, ../../../data/pinsaGate.ts). */
export const PINSA_GATED_RECIPE_IDS: readonly string[] = ["pinsa-romana"];

export interface ComposedStep extends LadderRow {
  /** Derived like the ladder derives it: ordinary steps 1..n, then the late steps. */
  readonly step: number;
  readonly late: boolean;
}

export interface ComposedCatalog {
  readonly recipeIds: readonly string[];
  readonly creditedIds: readonly string[];
  readonly ingredients: readonly { readonly id: string; readonly category: string; readonly family: string | null; readonly late: boolean }[];
  readonly toppingCount: number;
  /** sauce / cheese by category, toppings by family (the shelf distribution of catalogLedger.test.ts). */
  readonly byShelf: Readonly<Record<string, number>>;
  readonly ordinarySteps: readonly ComposedStep[];
  readonly lateSteps: readonly ComposedStep[];
  readonly steps: readonly ComposedStep[];
  readonly floors: Readonly<Record<string, number>>;
  readonly chapterSizes: readonly number[];
  readonly lunchRushPool: number;
  /** Ladder step of a key recipe / of the step that unlocks a material, or undefined. */
  readonly stepOfKey: (recipeId: string) => number | undefined;
  readonly stepOfMaterial: (ingredientId: string) => number | undefined;
}

function numbered(ordinary: readonly LadderRow[], late: readonly LadderRow[]): { ordinary: ComposedStep[]; late: ComposedStep[] } {
  return {
    ordinary: ordinary.map((row, i) => ({ ...row, step: i + 1, late: false })),
    late: late.map((row, i) => ({ ...row, step: ordinary.length + i + 1, late: true })),
  };
}

/** `pinsa` = whether the build has the Pinsa gate open (`pinsaEnabled()`); pass it from the test. */
export function composeCatalog(opts: { readonly pinsa: boolean }, landed: readonly KitTrain[] = LANDED, frozen: FrozenBaseline = FROZEN): ComposedCatalog {
  const lateIngredient = (train: KitTrain, id: string) => train.recipes.find((r) => r.ladderStep?.ingredientIds.includes(id))?.placement === "late";
  const gated = (id: string) => !opts.pinsa && PINSA_GATED_RECIPE_IDS.includes(id);

  const recipes = [
    ...frozen.recipes.filter((r) => !gated(r.id)),
    ...landed.flatMap((t) => t.recipes.map((r) => ({ id: r.id, credited: r.ladderCredit, late: r.placement === "late" }))),
  ];
  const ingredients = [
    ...frozen.ingredients,
    ...landed.flatMap((t) => t.newIngredients.map((i) => ({ id: i.id, category: i.category as string, family: i.family, late: lateIngredient(t, i.id) }))),
  ];
  const ordinaryRows: LadderRow[] = [...frozen.ordinaryLadder];
  const lateRows: LadderRow[] = [...frozen.lateLadder];
  for (const train of landed) {
    for (const r of train.recipes) {
      if (!r.ladderStep) continue;
      (r.placement === "late" ? lateRows : ordinaryRows).push({ ingredientIds: r.ladderStep.ingredientIds, keyRecipeId: r.id });
    }
  }
  const { ordinary, late } = numbered(ordinaryRows, lateRows);
  const steps = [...ordinary, ...late];

  const byShelf: Record<string, number> = {};
  for (const i of ingredients) {
    const shelf = i.category === "topping" ? i.family! : i.category;
    byShelf[shelf] = (byShelf[shelf] ?? 0) + 1;
  }
  const chapterSizes = [...frozen.chapterSizes];
  if (!opts.pinsa) chapterSizes[chapterSizes.length - 1] -= frozen.recipes.filter((r) => gated(r.id)).length; // the gated recipe sits in the last chapter (pinsa-romana: chapter 4)
  for (const train of landed) for (const r of train.recipes) chapterSizes[(r.chapter ?? 4) - 1] += 1;

  return {
    recipeIds: recipes.map((r) => r.id),
    creditedIds: recipes.filter((r) => r.credited).map((r) => r.id),
    ingredients,
    toppingCount: ingredients.filter((i) => i.category === "topping").length,
    byShelf,
    ordinarySteps: ordinary,
    lateSteps: late,
    steps,
    floors: { ...frozen.floors, ...Object.assign({}, ...landed.map((t) => t.floors ?? {})) },
    chapterSizes,
    lunchRushPool: frozen.lunchRushPool + landed.flatMap((t) => t.recipes).filter((r) => r.lunchRush).length,
    stepOfKey: (recipeId) => steps.find((s) => s.keyRecipeId === recipeId)?.step,
    stepOfMaterial: (ingredientId) => steps.find((s) => s.ingredientIds.includes(ingredientId))?.step,
  };
}

/** The composition for the running build. Tests pass `pinsaEnabled()`. */
export const composedFor = (pinsa: boolean): ComposedCatalog => composeCatalog({ pinsa });
