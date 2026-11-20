import { BAKE_DURATION_S } from "../../logic/bakeProgress";
import {
  createLabClock,
  labClockEngineNow,
  labClockPositionPct,
  labClockReducer,
  type LabClockConfig,
  type LabClockState,
  type LabHoldRelease,
} from "../../logic/midBake/labClock";
import {
  createMidBakeState,
  midBakeReducer,
  midBakeRequirementsMet,
  type MidBakeCompletion,
  type MidBakeInput,
  type MidBakeState,
} from "../../logic/midBake/midBakeState";
import { DEFAULT_MID_BAKE_WINDOW } from "../../logic/midBake/midBakeTiming";
import { labHandedState, labIngredientSpec, labScenarioPlan, type LabOpKind, type LabScenario } from "./labIngredients";

/**
 * MID_BAKE Lab session (Issue #795, stage C-2): the pure glue between the Lab clock (C-1) and the MID_BAKE engine.
 * No React, no storage, no PREP / FRY. The screen only dispatches `LabSessionEvent`s and renders `labSnapshot`.
 *
 * Rules the session adds on top of the engine (the engine itself is unchanged):
 * - An addition is accepted only while the clock is *holding*. The tray is not offered otherwise, so the engine's own window
 *   check (still open after a resume, until 90%) stays a safety net, not a second way to add.
 * - Every operation of every ingredient resolves to the same engine `ADD`; only `input` differs ("direct" for tap).
 * - The engine's `now` is the Lab clock's active bake time in **milliseconds** (never wall-clock, never seconds).
 * - The log records what the Owner needs for the HV (accepted / rejected additions, by input, hold time, how it ended).
 */
export type LabRejectReason = "not-holding" | "unknown-ingredient" | "unsupported-op" | "over-limit" | "rejected-by-engine";

export interface LabLog {
  readonly accepted: number;
  readonly acceptedDirect: number;
  readonly acceptedAlternative: number;
  readonly rejected: number;
  readonly rejectedByReason: Readonly<Record<LabRejectReason, number>>;
  /** Active hold time at the moment the hold ended (null while no hold has ended). */
  readonly holdActiveMs: number | null;
}

export interface LabSession {
  readonly scenario: LabScenario;
  readonly clock: LabClockState;
  readonly engine: MidBakeState;
  readonly log: LabLog;
}

export type LabSessionEvent =
  | { readonly type: "FRAME"; readonly dtMs: number }
  | { readonly type: "ADD"; readonly ingredientId: string; readonly op: LabOpKind }
  | { readonly type: "CLOSE" };

export interface LabSessionOptions {
  readonly totalBakeMs?: number;
  /** Provisional Lab value (see `LAB_HOLD_TIMEOUT_MS_PROVISIONAL`); tests and the HV entry may shorten it. */
  readonly holdTimeoutMs?: number;
  readonly holdAtWindowStart?: boolean;
}

const EMPTY_REJECTS: Record<LabRejectReason, number> = {
  "not-holding": 0,
  "unknown-ingredient": 0,
  "unsupported-op": 0,
  "over-limit": 0,
  "rejected-by-engine": 0,
};

function emptyLog(): LabLog {
  return { accepted: 0, acceptedDirect: 0, acceptedAlternative: 0, rejected: 0, rejectedByReason: { ...EMPTY_REJECTS }, holdActiveMs: null };
}

export function createLabSession(scenario: LabScenario, options: LabSessionOptions = {}): LabSession {
  const totalBakeMs = options.totalBakeMs ?? BAKE_DURATION_S * 1000;
  const clockConfig: Partial<LabClockConfig> = {
    totalBakeMs,
    window: DEFAULT_MID_BAKE_WINDOW,
    ...(options.holdTimeoutMs !== undefined ? { holdTimeoutMs: options.holdTimeoutMs } : {}),
    ...(options.holdAtWindowStart !== undefined ? { holdAtWindowStart: options.holdAtWindowStart } : {}),
  };
  const clock = createLabClock(clockConfig);
  const engine = midBakeReducer(createMidBakeState(labScenarioPlan(scenario, totalBakeMs)), { type: "START", now: labClockEngineNow(clock) });
  return { scenario, clock, engine, log: emptyLog() };
}

function reject(log: LabLog, reason: LabRejectReason): LabLog {
  return { ...log, rejected: log.rejected + 1, rejectedByReason: { ...log.rejectedByReason, [reason]: log.rejectedByReason[reason] + 1 } };
}

function additionsOf(engine: MidBakeState): number {
  return engine.status === "idle" ? 0 : engine.additions.length;
}

function addedCount(engine: MidBakeState, ingredientId: string): number {
  return engine.status === "idle" ? 0 : engine.additions.filter((addition) => addition.ingredientId === ingredientId).length;
}

/** Keep the engine on the clock: TICK while running or holding, FINISH once the clock is at the end of the bake. */
function syncEngine(session: LabSession, clock: LabClockState): LabSession {
  const now = labClockEngineNow(clock);
  let engine = midBakeReducer(session.engine, { type: "TICK", now });
  if (clock.status === "finished") engine = midBakeReducer(engine, { type: "FINISH", now });
  const releasedNow = clock.released !== null && session.clock.released === null;
  const log = releasedNow ? { ...session.log, holdActiveMs: clock.holdElapsedMs } : session.log;
  return { ...session, clock, engine, log };
}

function releaseClock(session: LabSession, reason: Exclude<LabHoldRelease, "timeout">): LabSession {
  const clock = labClockReducer(session.clock, { type: "RELEASE", reason });
  return clock === session.clock ? session : syncEngine(session, clock);
}

function applyAdd(session: LabSession, ingredientId: string, op: LabOpKind): LabSession {
  const { clock, engine } = session;
  const spec = labIngredientSpec(session.scenario, ingredientId);
  if (!spec) return { ...session, log: reject(session.log, "unknown-ingredient") };
  if (!spec.ops.includes(op)) return { ...session, log: reject(session.log, "unsupported-op") };
  if (clock.status !== "holding" || engine.status !== "baking") return { ...session, log: reject(session.log, "not-holding") };
  if (addedCount(engine, ingredientId) >= spec.count) return { ...session, log: reject(session.log, "over-limit") };

  const input: MidBakeInput = op === "alternative" ? "alternative" : "direct";
  const next = midBakeReducer(engine, { type: "ADD", now: labClockEngineNow(clock), ingredientId, ingredientState: labHandedState(spec), input });
  if (additionsOf(next) === additionsOf(engine)) return { ...session, log: reject(session.log, "rejected-by-engine") };

  const log: LabLog = {
    ...session.log,
    accepted: session.log.accepted + 1,
    acceptedDirect: session.log.acceptedDirect + (input === "direct" ? 1 : 0),
    acceptedAlternative: session.log.acceptedAlternative + (input === "alternative" ? 1 : 0),
  };
  const added: LabSession = { ...session, engine: next, log };
  // The hold ends as soon as every required piece is in: the clock resumes by itself.
  return next.status === "baking" && midBakeRequirementsMet(next.plan, next.additions) ? releaseClock(added, "complete") : added;
}

export function labSessionReducer(session: LabSession, event: LabSessionEvent): LabSession {
  if (event.type === "FRAME") {
    const clock = labClockReducer(session.clock, { type: "FRAME", dtMs: event.dtMs });
    return clock === session.clock ? session : syncEngine(session, clock);
  }
  if (event.type === "CLOSE") return releaseClock(session, "closed");
  return applyAdd(session, event.ingredientId, event.op);
}

export interface LabIngredientSnapshot {
  readonly ingredientId: string;
  readonly label: string;
  readonly glyph: string;
  readonly required: number;
  readonly added: number;
  readonly ops: readonly LabOpKind[];
}

export interface LabSnapshot {
  readonly status: "running" | "holding" | "finished";
  /** Gauge position 0..100. */
  readonly positionPct: number;
  readonly windowStartPct: number;
  readonly windowEndPct: number;
  readonly stage: "before-window" | "window-open" | "rebaking" | "done";
  /** The tray is offered only while the clock holds. */
  readonly trayOpen: boolean;
  readonly ingredients: readonly LabIngredientSnapshot[];
  readonly completion: MidBakeCompletion | null;
  readonly releasedBy: LabHoldRelease | null;
  readonly holdActiveMs: number;
  readonly holdTimeoutMs: number;
  readonly log: LabLog;
}

export function labSnapshot(session: LabSession): LabSnapshot {
  const { clock, engine, scenario } = session;
  const window = engine.plan.window ?? DEFAULT_MID_BAKE_WINDOW;
  return {
    status: clock.status,
    positionPct: labClockPositionPct(clock),
    windowStartPct: window.start * 100,
    windowEndPct: window.end * 100,
    stage: engine.status === "finished" ? "done" : engine.status === "baking" ? engine.stage : "before-window",
    trayOpen: clock.status === "holding" && engine.status === "baking",
    ingredients: scenario.ingredients.map((spec) => ({
      ingredientId: spec.ingredientId,
      label: spec.label,
      glyph: spec.glyph,
      required: spec.count,
      added: addedCount(engine, spec.ingredientId),
      ops: spec.ops,
    })),
    completion: engine.status === "finished" ? engine.completion : null,
    releasedBy: clock.released,
    holdActiveMs: clock.holdElapsedMs,
    holdTimeoutMs: clock.config.holdTimeoutMs,
    log: session.log,
  };
}
