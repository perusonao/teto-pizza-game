import type { MidBakeIngredientState, MidBakePlan } from "../../logic/midBake/midBakeState";

/**
 * MID_BAKE Lab (Issue #795, stage C-2): the per-ingredient operation registry.
 *
 * Each ingredient the Lab can verify is ONE entry here: how many pieces the recipe needs, which state they must arrive in,
 * and which player operations the Lab offers for it. Adding the next ingredient (e.g. french-fries, `requiredState: "fried"`,
 * or a drag-placed one after #478) is a new entry plus, if it needs a new gesture, a new `LabOpKind`; the session logic and the
 * screen read this table and never name an ingredient. natto is the first verification target (Owner decision, Q7).
 *
 * Operations are *input methods*, never results: every operation resolves to the same engine `ADD` (`input` is the only
 * difference), so a placement method cannot change what is added.
 */
export type LabOpKind = "tap" | "alternative";

export interface LabIngredientSpec {
  readonly ingredientId: string;
  readonly label: string;
  /** Text fallback only; the Lab has no dedicated art. */
  readonly glyph: string;
  /** Pieces the recipe needs (the engine stops accepting beyond this). */
  readonly count: number;
  /** State the pieces must arrive in (engine `requiredState`); also the state the Lab tray hands over. */
  readonly requiredState?: MidBakeIngredientState;
  /** Operations the Lab offers for this ingredient, in display order. `tap` is the primary one (decision table Q3). */
  readonly ops: readonly LabOpKind[];
}

export interface LabScenario {
  readonly id: string;
  readonly label: string;
  readonly recipeId: string;
  readonly ingredients: readonly LabIngredientSpec[];
}

/** natto-pizza's mid-bake ingredient: 2 pieces, tapped one at a time (decision table section 3). okra is not MID_BAKE (Q7). */
export const NATTO_LAB_SCENARIO: LabScenario = {
  id: "natto",
  label: "natto-pizza（なっとう 2 個）",
  recipeId: "natto-pizza",
  ingredients: [{ ingredientId: "natto", label: "なっとう", glyph: "🫘", count: 2, ops: ["tap", "alternative"] }],
};

export const LAB_SCENARIOS: readonly LabScenario[] = [NATTO_LAB_SCENARIO];
export const DEFAULT_LAB_SCENARIO_ID = NATTO_LAB_SCENARIO.id;

export function getLabScenario(id: string | null | undefined, scenarios: readonly LabScenario[] = LAB_SCENARIOS): LabScenario {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}

export function labIngredientSpec(scenario: LabScenario, ingredientId: string): LabIngredientSpec | undefined {
  return scenario.ingredients.find((spec) => spec.ingredientId === ingredientId);
}

/** The engine plan for a scenario (the window stays the engine default unless a Lab session overrides it). */
export function labScenarioPlan(scenario: LabScenario, totalBakeMs: number): MidBakePlan {
  return {
    recipeId: scenario.recipeId,
    totalBakeMs,
    requirements: scenario.ingredients.map((spec) => ({
      ingredientId: spec.ingredientId,
      count: spec.count,
      ...(spec.requiredState ? { requiredState: spec.requiredState } : {}),
    })),
  };
}

/** The state the Lab tray hands over for an ingredient: its required state, otherwise a plain "ready" piece. */
export function labHandedState(spec: LabIngredientSpec): MidBakeIngredientState {
  return spec.requiredState ?? "ready";
}
