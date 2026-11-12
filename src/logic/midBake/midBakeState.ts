import {
  DEFAULT_MID_BAKE_WINDOW,
  isValidMidBakeWindow,
  midBakeStageAt,
  progressFromElapsed,
  type MidBakeStage,
  type MidBakeWindow,
} from "./midBakeTiming";

export type MidBakeIngredientState = "ready" | "prepared" | "fried";
export type MidBakeInput = "direct" | "alternative";

export interface MidBakeRequirement {
  readonly ingredientId: string;
  readonly count: number;
  /** E.g. french-fries in lomo-saltado must arrive from FRY already fried. */
  readonly requiredState?: MidBakeIngredientState;
}

export interface MidBakePlan {
  readonly recipeId: string;
  readonly totalBakeMs: number;
  readonly window?: MidBakeWindow;
  readonly requirements: readonly MidBakeRequirement[];
}

export interface MidBakeAddition {
  readonly ingredientId: string;
  readonly ingredientState: MidBakeIngredientState;
  readonly atProgress: number;
  readonly input: MidBakeInput;
}

export type MidBakeCompletion = "complete" | "missing-additions";

export type MidBakeState =
  | { readonly status: "idle"; readonly plan: MidBakePlan }
  | {
      readonly status: "baking";
      readonly plan: MidBakePlan;
      readonly startedAt: number;
      readonly lastAt: number;
      readonly progress: number;
      readonly stage: Exclude<MidBakeStage, "done">;
      readonly additions: readonly MidBakeAddition[];
    }
  | {
      readonly status: "finished";
      readonly plan: MidBakePlan;
      readonly progress: 1;
      readonly additions: readonly MidBakeAddition[];
      readonly completion: MidBakeCompletion;
    };

export type MidBakeEvent =
  | { readonly type: "START"; readonly now: number }
  | { readonly type: "TICK"; readonly now: number }
  | {
      readonly type: "ADD";
      readonly now: number;
      readonly ingredientId: string;
      readonly ingredientState: MidBakeIngredientState;
      readonly input: MidBakeInput;
    }
  | { readonly type: "FINISH"; readonly now: number }
  | { readonly type: "CANCEL" };

function validatePlan(plan: MidBakePlan): void {
  if (!plan.recipeId || !Number.isFinite(plan.totalBakeMs) || plan.totalBakeMs <= 0) throw new Error("Invalid MID_BAKE plan");
  if (!isValidMidBakeWindow(plan.window ?? DEFAULT_MID_BAKE_WINDOW)) throw new Error("Invalid MID_BAKE window");
  const seen = new Set<string>();
  for (const requirement of plan.requirements) {
    if (!requirement.ingredientId || !Number.isInteger(requirement.count) || requirement.count <= 0 || seen.has(requirement.ingredientId)) {
      throw new Error("Invalid MID_BAKE requirement");
    }
    seen.add(requirement.ingredientId);
  }
  if (plan.requirements.length === 0) throw new Error("MID_BAKE needs at least one requirement");
}

export function createMidBakeState(plan: MidBakePlan): MidBakeState {
  validatePlan(plan);
  return { status: "idle", plan };
}

function requirementFor(plan: MidBakePlan, ingredientId: string): MidBakeRequirement | undefined {
  return plan.requirements.find((requirement) => requirement.ingredientId === ingredientId);
}

function additionCount(additions: readonly MidBakeAddition[], ingredientId: string): number {
  return additions.filter((addition) => addition.ingredientId === ingredientId).length;
}

export function midBakeRequirementsMet(plan: MidBakePlan, additions: readonly MidBakeAddition[]): boolean {
  return plan.requirements.every((requirement) => additionCount(additions, requirement.ingredientId) >= requirement.count);
}

function progressAt(state: Extract<MidBakeState, { status: "baking" }>, now: number): number | null {
  if (!Number.isFinite(now) || now < state.lastAt) return null;
  return progressFromElapsed(now - state.startedAt, state.plan.totalBakeMs);
}

function finish(state: Extract<MidBakeState, { status: "baking" }>): MidBakeState {
  return {
    status: "finished",
    plan: state.plan,
    progress: 1,
    additions: state.additions,
    completion: midBakeRequirementsMet(state.plan, state.additions) ? "complete" : "missing-additions",
  };
}

function advance(state: Extract<MidBakeState, { status: "baking" }>, now: number): MidBakeState {
  const progress = progressAt(state, now);
  if (progress === null) return state;
  if (progress >= 1) return finish(state);
  return { ...state, lastAt: now, progress, stage: midBakeStageAt(progress, state.plan.window ?? DEFAULT_MID_BAKE_WINDOW) as Exclude<MidBakeStage, "done"> };
}

/**
 * Pure, clock-injected state machine. Direct placement and the T9 alternative
 * control intentionally enter through the same ADD event and produce equal state.
 */
export function midBakeReducer(state: MidBakeState, event: MidBakeEvent): MidBakeState {
  if (event.type === "CANCEL") return state.status === "idle" ? state : { status: "idle", plan: state.plan };
  if (state.status === "idle") {
    if (event.type !== "START" || !Number.isFinite(event.now)) return state;
    return { status: "baking", plan: state.plan, startedAt: event.now, lastAt: event.now, progress: 0, stage: "before-window", additions: [] };
  }
  if (state.status === "finished") return state;
  if (event.type === "START") return state;

  // A stale (< lastAt) or non-finite clock makes the whole event a no-op. Without this guard
  // advance() returns the old state and ADD would be judged against that old window stage.
  if (event.type === "ADD" && progressAt(state, event.now) === null) return state;

  const advanced = advance(state, event.now);
  if (advanced.status !== "baking") return advanced;
  if (event.type === "TICK") return advanced;
  if (event.type === "FINISH") return advanced; // FINISH is accepted only when advance reaches 1.

  if (advanced.stage !== "window-open") return advanced;
  const requirement = requirementFor(advanced.plan, event.ingredientId);
  if (!requirement || additionCount(advanced.additions, event.ingredientId) >= requirement.count) return advanced;
  if (requirement.requiredState && requirement.requiredState !== event.ingredientState) return advanced;
  const addition: MidBakeAddition = {
    ingredientId: event.ingredientId,
    ingredientState: event.ingredientState,
    atProgress: advanced.progress,
    input: event.input,
  };
  return { ...advanced, additions: [...advanced.additions, addition] };
}
