import type { BakeTarget } from "../../data/recipes";
import { classifyBake, type BakeState } from "../../logic/bake";
import { BAKE_DURATION_S } from "../../logic/bakeProgress";
import { createLabClock, labClockEngineNow, labClockPositionPct, labClockReducer, LAB_HOLD_TIMEOUT_MS_PROVISIONAL, type LabClockState, type LabHoldRelease } from "../../logic/midBake/labClock";
import { createMidBakeState, midBakeReducer, midBakeRequirementsMet, type MidBakeCompletion, type MidBakeInput, type MidBakePlan, type MidBakeState } from "../../logic/midBake/midBakeState";
import { placementFor, type LabPoint } from "./labPlacement";

/**
 * MID_BAKE Lab session (stage C-2): the pure, in-memory model behind the Lab screen. It drives the Lab clock (C-1) and the MID_BAKE engine together
 * the way the game will -- the engine only ever sees the bake clock in milliseconds, never wall-clock time -- and keeps a stand-in stock, the
 * deterministic placements and a plain log for the HV notes. It imports nothing from the game's state, reducer, inventory or save.
 *
 * Decisions it encodes (docs/design/TETO_MID-BAKE_OWNER-DECISION-TABLE_2026-11-12.md): additions are offered only while the clock holds (Q2),
 * a tap adds one piece and the required count caps it (Q3/Q4), placement is automatic and deterministic (Q6), the take-out is blocked while the
 * clock holds, the stock is "reserved" by the placed pieces and spent when the round ends (Q9, the stand-in for CONFIRM_BAKE), and the timing of
 * an addition earns no score (Q11).
 */

/** The Lab round: two natto pieces (Q7: natto first). Not catalog data. */
export const NATTO_LAB_PLAN: MidBakePlan = {
  recipeId: "natto-pizza",
  totalBakeMs: BAKE_DURATION_S * 1000,
  requirements: [{ ingredientId: "natto", count: 2 }],
};

/** A plain take-out target for the Lab only (the Lab is not a recipe). */
export const LAB_BAKE_TARGET: BakeTarget = { start: 55, end: 75 };
export const LAB_INGREDIENT_ID = "natto";
const MAX_LOG = 40;

export type LabPhase = "ready" | "baking" | "finished";
export type LabLogKind = "start" | "hold" | "add" | "rejected" | "release" | "takeout" | "blocked-takeout" | "finish";

export interface LabLogEntry {
  readonly seq: number;
  readonly kind: LabLogKind;
  readonly text: string;
  /** The bake clock (ms) when it happened. */
  readonly atMs: number;
}

export interface LabPiece {
  readonly id: number;
  readonly ingredientId: string;
  readonly input: MidBakeInput;
  readonly at: LabPoint;
  readonly atMs: number;
}

export interface LabResult {
  readonly completion: MidBakeCompletion;
  /** Gauge position of the take-out, or `null` when the bake ran to the end by itself. */
  readonly takeOutPct: number | null;
  readonly bake: BakeState;
  readonly additions: number;
  /** Stock spent when the round ended (the stand-in for CONFIRM_BAKE's consumption). */
  readonly consumed: number;
  readonly releasedBy: LabHoldRelease | null;
  readonly holdMs: number;
}

export interface LabConfig {
  /** PROVISIONAL Lab value, not a Production specification. */
  readonly holdTimeoutMs: number;
  readonly stock: number;
}

export interface LabSession {
  readonly config: LabConfig;
  readonly plan: MidBakePlan;
  readonly phase: LabPhase;
  readonly clock: LabClockState;
  readonly engine: MidBakeState;
  readonly pieces: readonly LabPiece[];
  readonly log: readonly LabLogEntry[];
  readonly seq: number;
  readonly rejectedAdds: number;
  readonly blockedTakeOuts: number;
  readonly result: LabResult | null;
  readonly round: number;
}

export type LabEvent =
  | { readonly type: "START" }
  | { readonly type: "FRAME"; readonly dtMs: number }
  | { readonly type: "ADD"; readonly input: MidBakeInput }
  | { readonly type: "CLOSE" }
  | { readonly type: "TAKE_OUT" }
  | { readonly type: "RESTART" };

export const DEFAULT_LAB_CONFIG: LabConfig = { holdTimeoutMs: LAB_HOLD_TIMEOUT_MS_PROVISIONAL, stock: 3 };

export function createLabSession(config: Partial<LabConfig> = {}, round = 1): LabSession {
  const full: LabConfig = { ...DEFAULT_LAB_CONFIG, ...config };
  return {
    config: full,
    plan: NATTO_LAB_PLAN,
    phase: "ready",
    clock: createLabClock({ totalBakeMs: NATTO_LAB_PLAN.totalBakeMs, holdTimeoutMs: full.holdTimeoutMs }),
    engine: createMidBakeState(NATTO_LAB_PLAN),
    pieces: [],
    log: [],
    seq: 0,
    rejectedAdds: 0,
    blockedTakeOuts: 0,
    result: null,
    round,
  };
}

/** Stock still free to add (the placed pieces are the reservation). */
export function labRemainingStock(session: LabSession): number {
  return Math.max(0, session.config.stock - session.pieces.length);
}

/** Additions are offered only while the clock holds and the round is on. */
export function labCanAdd(session: LabSession): boolean {
  return session.phase === "baking" && session.clock.status === "holding" && labRemainingStock(session) > 0 && !midBakeRequirementsMet(session.plan, additionsOf(session.engine));
}

export function labCanClose(session: LabSession): boolean {
  return session.phase === "baking" && session.clock.status === "holding";
}

/** The take-out is blocked while holding (a mis-tap guard) and outside a round. */
export function labCanTakeOut(session: LabSession): boolean {
  return session.phase === "baking" && session.clock.status === "running";
}

function additionsOf(engine: MidBakeState) {
  return engine.status === "idle" ? [] : engine.additions;
}

function withLog(session: LabSession, kind: LabLogKind, text: string): LabSession {
  const entry: LabLogEntry = { seq: session.seq + 1, kind, text, atMs: session.clock.elapsedMs };
  return { ...session, seq: entry.seq, log: [...session.log, entry].slice(-MAX_LOG) };
}

function finalize(session: LabSession, takeOutPct: number | null): LabSession {
  const additions = additionsOf(session.engine);
  const result: LabResult = {
    completion: midBakeRequirementsMet(session.plan, additions) ? "complete" : "missing-additions",
    takeOutPct,
    bake: classifyBake(takeOutPct ?? 100, LAB_BAKE_TARGET),
    additions: additions.length,
    consumed: session.pieces.length,
    releasedBy: session.clock.released,
    holdMs: session.clock.holdElapsedMs,
  };
  const text = `${result.completion === "complete" ? "追加そろい" : "追加不足"}・在庫 ${result.consumed} 消費`;
  return withLog({ ...session, phase: "finished", result }, "finish", text);
}

function onFrame(session: LabSession, dtMs: number): LabSession {
  if (session.phase !== "baking") return session;
  const clock = labClockReducer(session.clock, { type: "FRAME", dtMs });
  if (clock === session.clock) return session;
  const engine = midBakeReducer(session.engine, { type: "TICK", now: labClockEngineNow(clock) });
  let next: LabSession = { ...session, clock, engine };
  if (session.clock.status !== "holding" && clock.status === "holding") next = withLog(next, "hold", "窓の入口で針が止まった");
  if (session.clock.released === null && clock.released === "timeout") next = withLog(next, "release", `タイムアウト（${Math.round(clock.config.holdTimeoutMs)}ms）で再開`);
  if (clock.status === "finished") return finalize(next, null);
  return next;
}

function onAdd(session: LabSession, input: MidBakeInput): LabSession {
  if (session.phase !== "baking") return session;
  const reject = (text: string): LabSession => withLog({ ...session, rejectedAdds: session.rejectedAdds + 1 }, "rejected", text);
  if (session.clock.status !== "holding") return reject("針が止まっていないので追加できない");
  if (labRemainingStock(session) <= 0) return reject("在庫がない");
  const before = additionsOf(session.engine).length;
  const engine = midBakeReducer(session.engine, {
    type: "ADD",
    now: labClockEngineNow(session.clock),
    ingredientId: LAB_INGREDIENT_ID,
    ingredientState: "ready",
    input,
  });
  if (additionsOf(engine).length === before) return reject("必要な数に達している");
  const piece: LabPiece = {
    id: session.pieces.length + 1,
    ingredientId: LAB_INGREDIENT_ID,
    input,
    at: placementFor(LAB_INGREDIENT_ID, session.pieces.length),
    atMs: session.clock.elapsedMs,
  };
  let next = withLog({ ...session, engine, pieces: [...session.pieces, piece] }, "add", `納豆 ${piece.id} 個目（${input === "direct" ? "タップ" : "代替操作"}）`);
  if (midBakeRequirementsMet(next.plan, additionsOf(engine))) {
    next = withLog({ ...next, clock: labClockReducer(next.clock, { type: "RELEASE", reason: "complete" }) }, "release", "追加がそろったので再開");
  }
  return next;
}

function onClose(session: LabSession): LabSession {
  if (!labCanClose(session)) return session;
  return withLog({ ...session, clock: labClockReducer(session.clock, { type: "RELEASE", reason: "closed" }) }, "release", "とじるで再開");
}

function onTakeOut(session: LabSession): LabSession {
  if (session.phase !== "baking") return session;
  if (session.clock.status === "holding") {
    return withLog({ ...session, blockedTakeOuts: session.blockedTakeOuts + 1 }, "blocked-takeout", "止まっている間は取り出せない");
  }
  const pct = labClockPositionPct(session.clock);
  return finalize(withLog(session, "takeout", `${Math.round(pct)}% で取り出した`), pct);
}

export function labSessionReducer(session: LabSession, event: LabEvent): LabSession {
  switch (event.type) {
    case "START": {
      if (session.phase !== "ready") return session;
      const engine = midBakeReducer(session.engine, { type: "START", now: labClockEngineNow(session.clock) });
      return withLog({ ...session, phase: "baking", engine }, "start", "焼きはじめ");
    }
    case "FRAME":
      return onFrame(session, event.dtMs);
    case "ADD":
      return onAdd(session, event.input);
    case "CLOSE":
      return onClose(session);
    case "TAKE_OUT":
      return onTakeOut(session);
    case "RESTART":
      return createLabSession(session.config, session.round + 1);
  }
}
