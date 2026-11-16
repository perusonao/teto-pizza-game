import type { MakingStep } from "../state/gameReducer";

export type StepOrderId = "standard" | "cheese-before-sauce";

export interface StepPrecedenceConstraint {
  readonly before: MakingStep;
  readonly after: MakingStep;
}

export interface StepOrderContract {
  readonly id: StepOrderId;
  readonly steps: readonly MakingStep[];
  readonly precedence: readonly StepPrecedenceConstraint[];
}

export type StepOrderErrorCode =
  | "UNKNOWN_STEP"
  | "DUPLICATE_STEP"
  | "UNKNOWN_CONSTRAINT_STEP"
  | "MISSING_CONSTRAINT_STEP"
  | "SELF_EDGE"
  | "DUPLICATE_EDGE"
  | "CYCLE"
  | "AMBIGUOUS_ORDER"
  | "NOT_A_PERMUTATION";

export class StepOrderValidationError extends Error {
  readonly code: StepOrderErrorCode;

  constructor(code: StepOrderErrorCode, message: string) {
    super(message);
    this.name = "StepOrderValidationError";
    this.code = code;
  }
}

export const STEP_ORDER_STEPS = [
  "DOUGH",
  "SAUCE",
  "CHEESE",
  "TOPPING",
  "FOLD",
  "SEAL",
  "EDGE_FILL",
  "CUT",
  "FINISH",
] as const satisfies readonly MakingStep[];

const KNOWN_STEPS: ReadonlySet<string> = new Set(STEP_ORDER_STEPS);
const CORE_STEPS = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"] as const satisfies readonly MakingStep[];

function chain(steps: readonly MakingStep[]): StepPrecedenceConstraint[] {
  return steps.slice(1).map((after, index) => ({ before: steps[index], after }));
}

export const STEP_ORDER_FIXTURES: Readonly<Record<StepOrderId, StepOrderContract>> = {
  standard: {
    id: "standard",
    steps: CORE_STEPS,
    precedence: chain(CORE_STEPS),
  },
  "cheese-before-sauce": {
    id: "cheese-before-sauce",
    steps: ["DOUGH", "CHEESE", "SAUCE", "TOPPING"],
    precedence: chain(["DOUGH", "CHEESE", "SAUCE", "TOPPING"]),
  },
};

function validateSteps(steps: readonly MakingStep[]): void {
  const seen = new Set<MakingStep>();
  for (const step of steps) {
    if (!KNOWN_STEPS.has(step)) {
      throw new StepOrderValidationError("UNKNOWN_STEP", `unknown step: ${String(step)}`);
    }
    if (seen.has(step)) {
      throw new StepOrderValidationError("DUPLICATE_STEP", `duplicate step: ${step}`);
    }
    seen.add(step);
  }
}

function validateEdges(
  steps: readonly MakingStep[],
  precedence: readonly StepPrecedenceConstraint[],
): void {
  const present = new Set(steps);
  const edges = new Set<string>();
  for (const { before, after } of precedence) {
    if (!KNOWN_STEPS.has(before) || !KNOWN_STEPS.has(after)) {
      throw new StepOrderValidationError(
        "UNKNOWN_CONSTRAINT_STEP",
        `constraint contains unknown step: ${before} -> ${after}`,
      );
    }
    if (before === after) {
      throw new StepOrderValidationError("SELF_EDGE", `self edge: ${before}`);
    }
    if (!present.has(before) || !present.has(after)) {
      throw new StepOrderValidationError(
        "MISSING_CONSTRAINT_STEP",
        `constraint refers to a step absent from the input: ${before} -> ${after}`,
      );
    }
    const key = `${before}\0${after}`;
    if (edges.has(key)) {
      throw new StepOrderValidationError("DUPLICATE_EDGE", `duplicate edge: ${before} -> ${after}`);
    }
    edges.add(key);
  }
}

export function resolveStepOrder(
  steps: readonly MakingStep[],
  precedence: readonly StepPrecedenceConstraint[],
): readonly MakingStep[] {
  validateSteps(steps);
  validateEdges(steps, precedence);

  const outgoing = new Map(steps.map((step) => [step, [] as MakingStep[]]));
  const indegree = new Map(steps.map((step) => [step, 0]));
  for (const { before, after } of precedence) {
    outgoing.get(before)!.push(after);
    indegree.set(after, indegree.get(after)! + 1);
  }

  const remaining = new Set(steps);
  const result: MakingStep[] = [];
  while (remaining.size > 0) {
    const available = [...remaining].filter((step) => indegree.get(step) === 0);
    if (available.length === 0) {
      throw new StepOrderValidationError("CYCLE", "precedence constraints contain a cycle");
    }
    if (available.length !== 1) {
      throw new StepOrderValidationError(
        "AMBIGUOUS_ORDER",
        `precedence constraints allow multiple next steps: ${available.join(", ")}`,
      );
    }
    const step = available[0];
    remaining.delete(step);
    result.push(step);
    for (const after of outgoing.get(step)!) indegree.set(after, indegree.get(after)! - 1);
  }

  if (result.length !== steps.length || new Set(result).size !== steps.length) {
    throw new StepOrderValidationError("NOT_A_PERMUTATION", "resolved steps are not an input permutation");
  }
  return result;
}

/**
 * Explicit partial-sequence adapter. Strict resolution rejects constraints whose endpoints are
 * absent; this adapter first takes the contract's transitive closure, then projects it onto the
 * requested subsequence so removing SAUCE/CHEESE/TOPPING cannot make the result ambiguous.
 */
export function projectStepOrderContract(
  contract: StepOrderContract,
  steps: readonly MakingStep[],
): StepOrderContract {
  validateSteps(contract.steps);
  validateEdges(contract.steps, contract.precedence);
  resolveStepOrder(contract.steps, contract.precedence);
  validateSteps(steps);

  const contractSteps = new Set(contract.steps);
  for (const step of steps) {
    if (!contractSteps.has(step)) {
      throw new StepOrderValidationError(
        "MISSING_CONSTRAINT_STEP",
        `partial sequence contains a step outside the contract: ${step}`,
      );
    }
  }

  const reach = new Map(contract.steps.map((step) => [step, new Set<MakingStep>()]));
  for (const { before, after } of contract.precedence) reach.get(before)!.add(after);
  for (const via of contract.steps) {
    for (const before of contract.steps) {
      for (const after of contract.steps) {
        if (reach.get(before)!.has(via) && reach.get(via)!.has(after)) {
          reach.get(before)!.add(after);
        }
      }
    }
  }

  const projectedOrder = contract.steps.filter((step) => steps.includes(step));
  const projected = chain(projectedOrder).filter(({ before, after }) => reach.get(before)!.has(after));
  return { id: contract.id, steps: [...steps], precedence: projected };
}

export function resolveStepOrderId(
  id: StepOrderId | undefined,
  steps: readonly MakingStep[],
): readonly MakingStep[] {
  validateSteps(steps);
  if (id === undefined || id === "standard") return [...steps];
  const desired = [...steps];
  const sauce = desired.indexOf("SAUCE");
  const cheese = desired.indexOf("CHEESE");
  if (sauce >= 0 && cheese >= 0 && sauce < cheese) {
    [desired[sauce], desired[cheese]] = [desired[cheese], desired[sauce]];
  }
  return resolveStepOrder(steps, chain(desired));
}
