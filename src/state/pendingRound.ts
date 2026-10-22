/**
 * Save R8 (Issue #617, J-B): the `pendingRound` journal.
 *
 * `CONFIRM_BAKE` consumes stock, but the Dex / BEST / Pitz registration happens only after the post-BAKE steps (CUT / FINISH).
 * A save in between used to hold "stock gone, pizza not registered". The journal closes that window: the baked pizza is
 * written in the SAME `setItem` as the consumed stock, and a later start settles it with the ordinary scoring and
 * registration (./pendingRoundSettle.ts). It is an optional top-level key of save v2 (no schema bump).
 *
 * This module is pure: the journal's shape, how it is built from a round, and how a stored value is read back. It stores
 * only what scoring needs to be re-run -- never the score, the clock, UI state or stock.
 */
import { getIngredient } from "../data/ingredients";
import { getRecipe, type RecipeId } from "../data/recipes";
import { isDoughKind, type DoughKind } from "../logic/dough/doughKind";
import { DOUGH_SHAPE_POINTS, type DoughShape } from "../logic/doughShape";
import { SQUARE_DOUGH_GRID, type SquareDough } from "../logic/pan/squareDough";
import { SAVE_ID_PATTERN } from "./saveIdGrammar";
import type { PanId, PizzaState, PlacedTopping, SauceDeposit, SauceOrigin } from "./pizzaState";

export const PENDING_ROUND_KEY = "pendingRound";
export const PENDING_ROUND_VERSION = 1;
/** Provisional hard cap (Owner decision): UTF-8 bytes of the journal's JSON. The measured worst case is about 39 KB. */
export const PENDING_ROUND_MAX_BYTES = 64 * 1024;

export type PendingRoundKind = "GUIDED" | "FREE_COOK";
export type PendingRoundStatus = "pending" | "settled";

export interface PendingRoundPizza {
  toppings: PlacedTopping[];
  sauceIds: string[];
  sauceOrigin: SauceOrigin | null;
  sauceDeposits: SauceDeposit[];
  doughShape: DoughShape;
  pan?: PanId | null;
  dough?: DoughKind;
  squareDough?: SquareDough;
}

/** What the player is told after a round was completed for them. Display only; nothing reads it back into gameplay. */
export interface PendingRoundSummary {
  outcome: "REGISTERED" | "FAILED" | "ORIGINAL" | "UNMATCHED";
  recipeId: string | null;
  stars: number | null;
  earnedPitz: number;
  discovered: boolean;
  newBest: boolean;
  newMaterialIds: string[];
  newTechniqueIds: string[];
  /** The round was completed before its FINISH step was confirmed (Guided, recipe with FINISH): registered as baked, without the
   *  finishing touches. The notice says so (Owner condition 1). */
  unfinishedFinish?: true;
}

export interface PendingRound {
  v: typeof PENDING_ROUND_VERSION;
  id: string;
  status: PendingRoundStatus;
  kind: PendingRoundKind;
  recipeId?: string;
  bakeValue: number;
  createdAt: number;
  /** True once FINISH was confirmed (the FINISH pieces are in `pizza` and their stock is consumed): the round is then completed
   *  with the FINAL evaluation. Absent = the pizza is as it was baked, so a Guided round is completed with the evaluation the bake
   *  itself produced (the late requirement left out of the gate), exactly what a skipped FINISH would have registered. */
  finished?: true;
  /** A Guided round whose profile has a FINISH step that was not confirmed yet (cleared by `finished`). */
  finishPending?: true;
  pizza: PendingRoundPizza;
  research?: { targetId: string | null; validAtStart: boolean };
  settled?: PendingRoundSummary;
}

/** Why a stored `pendingRound` is kept as it is and not acted on. The original text is never touched. */
export type HeldPendingRoundReason = "unknown-version" | "corrupt" | "unresolvable" | "oversize";

export type StoredPendingRound =
  | { kind: "none" }
  | { kind: "round"; round: PendingRound }
  | { kind: "held"; reason: HeldPendingRoundReason };

/** The fields of a round the journal is built from (a structural slice of `GameState`, so this module needs no reducer import). */
export interface JournalSource {
  recipe: { id: string };
  roundKind: string;
  pizza: PizzaState;
  researchTargetId: string | null;
  researchTargetValidAtStart: boolean;
  /** Optional so a caller without a profile (tests) builds the same journal as before. */
  cookingProfile?: { steps: readonly string[] };
}

/** JSON with object keys in sorted order: two journals are the same journal whatever order their keys were built in. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function pendingRoundByteLength(round: PendingRound): number {
  return utf8ByteLength(JSON.stringify(round));
}

function journalPizza(pizza: PizzaState): PendingRoundPizza {
  return {
    toppings: pizza.toppings.map((t) => ({
      id: t.id,
      ingredientId: t.ingredientId,
      x: t.x,
      y: t.y,
      ...(t.stage ? { stage: t.stage } : {}),
    })),
    sauceIds: [...pizza.sauceIds],
    sauceOrigin: pizza.sauceOrigin ? { x: pizza.sauceOrigin.x, y: pizza.sauceOrigin.y } : null,
    sauceDeposits: pizza.sauceDeposits.map((d) => ({
      x: d.x,
      y: d.y,
      amount: d.amount,
      ...(d.ingredientId !== undefined ? { ingredientId: d.ingredientId } : {}),
    })),
    doughShape: { radii: [...pizza.doughShape.radii] },
    ...(pizza.pan !== undefined ? { pan: pizza.pan } : {}),
    ...(pizza.dough !== undefined ? { dough: pizza.dough } : {}),
    ...(pizza.squareDough ? { squareDough: { thickness: [...pizza.squareDough.thickness] } } : {}),
  };
}

/** Builds the `pending` journal of a round that was just baked. `roundId` comes from the caller (the action), never from here. */
export function buildPendingRound(source: JournalSource, roundId: string, bakeValue: number, createdAt: number): PendingRound {
  const freeCook = source.roundKind === "FREE_COOK";
  return {
    v: PENDING_ROUND_VERSION,
    id: roundId,
    status: "pending",
    kind: freeCook ? "FREE_COOK" : "GUIDED",
    ...(freeCook ? {} : { recipeId: source.recipe.id }),
    bakeValue,
    createdAt,
    ...(!freeCook && source.cookingProfile?.steps.includes("FINISH") ? { finishPending: true as const } : {}),
    pizza: journalPizza(source.pizza),
    ...(freeCook ? { research: { targetId: source.researchTargetId, validAtStart: source.researchTargetValidAtStart } } : {}),
  };
}

/** The same round with a new pizza (FINISH confirmed while CUT still follows: the finished pizza is what must be registered). */
export function withJournalPizza(round: PendingRound, pizza: PizzaState): PendingRound {
  const { research, settled, finishPending: _pending, ...rest } = round;
  return { ...rest, finished: true, pizza: journalPizza(pizza), ...(research ? { research } : {}), ...(settled ? { settled } : {}) };
}

export function settledPendingRound(round: PendingRound, summary: PendingRoundSummary): PendingRound {
  return { ...round, status: "settled", settled: summary };
}

/** The `PizzaState` a journal stands for. `sauceToken` is animation-only and `bakeResult` is set again by the finalization. */
export function pizzaFromJournal(pizza: PendingRoundPizza): PizzaState {
  return {
    doughShape: { radii: [...pizza.doughShape.radii] },
    sauceIds: [...pizza.sauceIds],
    sauceOrigin: pizza.sauceOrigin ? { ...pizza.sauceOrigin } : null,
    sauceToken: 0,
    sauceDeposits: pizza.sauceDeposits.map((d) => ({ ...d })),
    toppings: pizza.toppings.map((t) => ({ ...t })),
    bakeResult: null,
    ...(pizza.pan !== undefined ? { pan: pizza.pan } : {}),
    ...(pizza.dough !== undefined ? { dough: pizza.dough } : {}),
    ...(pizza.squareDough ? { squareDough: { thickness: [...pizza.squareDough.thickness] } } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAVE_ID_PATTERN.test(value);
}

function isNumberArray(value: unknown, length?: number): value is number[] {
  return Array.isArray(value) && (length === undefined || value.length === length) && value.every(isFiniteNumber);
}

/** "corrupt" = the value is not a journal of this version at all; "unresolvable" = well-formed, but names something this build lacks. */
type PizzaCheck = { ok: true; pizza: PendingRoundPizza } | { ok: false; reason: "corrupt" | "unresolvable" };

function readPizza(raw: unknown): PizzaCheck {
  if (!isRecord(raw)) return { ok: false, reason: "corrupt" };
  const { toppings, sauceIds, sauceOrigin, sauceDeposits, doughShape, pan, dough, squareDough } = raw;
  if (!Array.isArray(toppings) || !Array.isArray(sauceIds) || !Array.isArray(sauceDeposits)) return { ok: false, reason: "corrupt" };
  if (!isRecord(doughShape) || !isNumberArray(doughShape.radii, DOUGH_SHAPE_POINTS)) return { ok: false, reason: "corrupt" };
  let unresolvable = false;
  const outToppings: PlacedTopping[] = [];
  for (const t of toppings) {
    if (!isRecord(t) || !isSafeId(t.id) || !isSafeId(t.ingredientId) || !isFiniteNumber(t.x) || !isFiniteNumber(t.y)) {
      return { ok: false, reason: "corrupt" };
    }
    if (t.stage !== undefined && t.stage !== "pre" && t.stage !== "post") return { ok: false, reason: "corrupt" };
    if (!getIngredient(t.ingredientId)) unresolvable = true;
    outToppings.push({ id: t.id, ingredientId: t.ingredientId, x: t.x, y: t.y, ...(t.stage ? { stage: t.stage } : {}) });
  }
  const outSauceIds: string[] = [];
  for (const id of sauceIds) {
    if (!isSafeId(id)) return { ok: false, reason: "corrupt" };
    if (!getIngredient(id)) unresolvable = true;
    outSauceIds.push(id);
  }
  let outOrigin: SauceOrigin | null = null;
  if (sauceOrigin !== null && sauceOrigin !== undefined) {
    if (!isRecord(sauceOrigin) || !isFiniteNumber(sauceOrigin.x) || !isFiniteNumber(sauceOrigin.y)) return { ok: false, reason: "corrupt" };
    outOrigin = { x: sauceOrigin.x, y: sauceOrigin.y };
  }
  const outDeposits: SauceDeposit[] = [];
  for (const d of sauceDeposits) {
    if (!isRecord(d) || !isFiniteNumber(d.x) || !isFiniteNumber(d.y) || !isFiniteNumber(d.amount) || d.amount <= 0) {
      return { ok: false, reason: "corrupt" };
    }
    if (d.ingredientId !== undefined) {
      if (!isSafeId(d.ingredientId)) return { ok: false, reason: "corrupt" };
      if (!getIngredient(d.ingredientId)) unresolvable = true;
    }
    outDeposits.push({ x: d.x, y: d.y, amount: d.amount, ...(d.ingredientId !== undefined ? { ingredientId: d.ingredientId } : {}) });
  }
  if (pan !== undefined && pan !== null && pan !== "tray") return { ok: false, reason: "corrupt" };
  if (dough !== undefined && !isDoughKind(dough)) unresolvable = true;
  let outSquare: SquareDough | undefined;
  if (squareDough !== undefined) {
    if (!isRecord(squareDough) || !isNumberArray(squareDough.thickness, SQUARE_DOUGH_GRID ** 2)) return { ok: false, reason: "corrupt" };
    outSquare = { thickness: [...squareDough.thickness] };
  }
  if (unresolvable) return { ok: false, reason: "unresolvable" };
  return {
    ok: true,
    pizza: {
      toppings: outToppings,
      sauceIds: outSauceIds,
      sauceOrigin: outOrigin,
      sauceDeposits: outDeposits,
      doughShape: { radii: [...(doughShape.radii as number[])] },
      ...(pan !== undefined ? { pan: pan as PanId | null } : {}),
      ...(dough !== undefined ? { dough: dough as DoughKind } : {}),
      ...(outSquare ? { squareDough: outSquare } : {}),
    },
  };
}

function readSummary(raw: unknown): PendingRoundSummary | null {
  if (!isRecord(raw)) return null;
  const outcomes = ["REGISTERED", "FAILED", "ORIGINAL", "UNMATCHED"];
  if (typeof raw.outcome !== "string" || !outcomes.includes(raw.outcome)) return null;
  if (raw.recipeId !== null && !isSafeId(raw.recipeId)) return null;
  if (raw.stars !== null && !isFiniteNumber(raw.stars)) return null;
  if (!isFiniteNumber(raw.earnedPitz) || typeof raw.discovered !== "boolean" || typeof raw.newBest !== "boolean") return null;
  const ids = (v: unknown): string[] | null => (Array.isArray(v) && v.every(isSafeId) ? [...v] : null);
  const newMaterialIds = ids(raw.newMaterialIds);
  const newTechniqueIds = ids(raw.newTechniqueIds);
  if (!newMaterialIds || !newTechniqueIds) return null;
  if (raw.unfinishedFinish !== undefined && raw.unfinishedFinish !== true) return null;
  return {
    outcome: raw.outcome as PendingRoundSummary["outcome"],
    recipeId: raw.recipeId as string | null,
    stars: raw.stars as number | null,
    earnedPitz: raw.earnedPitz,
    discovered: raw.discovered,
    newBest: raw.newBest,
    newMaterialIds,
    newTechniqueIds,
    ...(raw.unfinishedFinish === true ? { unfinishedFinish: true as const } : {}),
  };
}

/**
 * Reads a stored `pendingRound` value. Never throws and never repairs: anything this build cannot act on is `held`, and the
 * caller leaves the stored text exactly as it is (it is written back untouched by every later save).
 */
export function readStoredPendingRound(raw: unknown): StoredPendingRound {
  if (raw === undefined) return { kind: "none" };
  if (!isRecord(raw)) return { kind: "held", reason: "corrupt" };
  if (raw.v !== PENDING_ROUND_VERSION) return { kind: "held", reason: typeof raw.v === "number" && raw.v > PENDING_ROUND_VERSION ? "unknown-version" : "corrupt" };
  let bytes: number;
  try {
    bytes = utf8ByteLength(JSON.stringify(raw));
  } catch {
    return { kind: "held", reason: "corrupt" };
  }
  if (bytes > PENDING_ROUND_MAX_BYTES) return { kind: "held", reason: "oversize" };
  if (!isSafeId(raw.id) || (raw.status !== "pending" && raw.status !== "settled")) return { kind: "held", reason: "corrupt" };
  if (raw.kind !== "GUIDED" && raw.kind !== "FREE_COOK") return { kind: "held", reason: "corrupt" };
  if (!isFiniteNumber(raw.bakeValue) || !isFiniteNumber(raw.createdAt)) return { kind: "held", reason: "corrupt" };
  const pizza = readPizza(raw.pizza);
  if (!pizza.ok) return { kind: "held", reason: pizza.reason };
  let recipeId: string | undefined;
  if (raw.kind === "GUIDED") {
    if (!isSafeId(raw.recipeId)) return { kind: "held", reason: "corrupt" };
    if (!getRecipe(raw.recipeId as RecipeId)) return { kind: "held", reason: "unresolvable" };
    recipeId = raw.recipeId;
  }
  if (raw.finished !== undefined && raw.finished !== true) return { kind: "held", reason: "corrupt" };
  if (raw.finishPending !== undefined && raw.finishPending !== true) return { kind: "held", reason: "corrupt" };
  let research: PendingRound["research"];
  if (raw.research !== undefined) {
    const r = raw.research;
    if (!isRecord(r) || typeof r.validAtStart !== "boolean" || (r.targetId !== null && !isSafeId(r.targetId))) return { kind: "held", reason: "corrupt" };
    research = { targetId: r.targetId as string | null, validAtStart: r.validAtStart };
  }
  let settled: PendingRoundSummary | undefined;
  if (raw.status === "settled") {
    const summary = readSummary(raw.settled);
    if (!summary) return { kind: "held", reason: "corrupt" };
    settled = summary;
  }
  return {
    kind: "round",
    round: {
      v: PENDING_ROUND_VERSION,
      id: raw.id,
      status: raw.status,
      kind: raw.kind,
      ...(recipeId ? { recipeId } : {}),
      bakeValue: raw.bakeValue,
      createdAt: raw.createdAt,
      ...(raw.finished === true ? { finished: true as const } : {}),
      ...(raw.finishPending === true ? { finishPending: true as const } : {}),
      pizza: pizza.pizza,
      ...(research ? { research } : {}),
      ...(settled ? { settled } : {}),
    },
  };
}
