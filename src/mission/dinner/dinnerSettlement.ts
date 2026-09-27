import type { DinnerMissionDefinition } from "./dinnerMission";
import {
  dinnerClearTier,
  DINNER_CLEAR_TIERS,
  quoteDinnerReward,
  validateDinnerRewardTable,
  type DinnerClearTier,
  type DinnerRewardQuote,
  type DinnerRewardTable,
} from "./dinnerReward";
import type { DinnerRunState } from "./dinnerRun";

/**
 * Dinner Mission DM-4-1 (Issue #257 / its DM-4-1 child): the pure settlement model -- what one
 * finished run is worth and how it changes the mission's record. Authority:
 * docs/reports/TETO_DINNER-MISSION_DM-4_Phase4-0_Plan.md §3 (OD-DM4-1..6), §6, §7, §8.
 *
 * PURE and UNWIRED: nothing in the reducer, the save or the UI calls this yet (DM-4-2 persists the
 * record, DM-4-3 settles inside the one CLEAR transition). It never reads or writes the Dex
 * (OD-DM4-5), never touches Pitz or the save itself (it only *returns* the Pitz to add), and holds
 * no numbers: the reward table is always an argument (OD-DM4-1) -- there is no production table
 * with amounts or thresholds until DM-5-2.
 *
 * Rules (Phase 4-0 §7.1):
 * - Only a CLEARED run settles. FAILED (TIME_UP / INFEASIBLE / ABANDONED) -- or anything still
 *   PLAYING -- pays 0 and leaves the record untouched (OD-DM4-2). No reward for partial progress.
 * - A run settles at most once: a run whose key was already settled is refused (OD-DM4-3).
 * - First clear vs repeat is decided by the persisted `firstClearRewarded`, never by run or UI
 *   state, so a reload or a retry cannot earn the first-clear schedule again.
 * - The reward table unavailable (missing, untuned `pitz: null`, or invalid) pays 0 and does NOT
 *   consume the first-clear entitlement; the clear itself is still recorded.
 * - `bestClearMs` only ever gets shorter; `bestTier` only ever gets better; `clears` counts up.
 * - Malformed input fails closed: nothing is paid and nothing is recorded.
 */

/** One mission's saved record (Phase 4-0 §6). `cleared` is `clears > 0`. */
export interface DinnerMissionRecord {
  /** The mission revision this record was last written under. */
  revision: number;
  clears: number;
  /** Fastest clear in ms; only ever decreases. `null` = no clear (under this revision). */
  bestClearMs: number | null;
  /** Best tier; only ever improves. `null` = no clear, or only clears slower than every tier. */
  bestTier: DinnerClearTier | null;
  /** The first-clear schedule has been paid. Never reverts to false. */
  firstClearRewarded: boolean;
}

/**
 * What happens to a record written under another mission revision (U-1, Phase 4-0 §6.2). The
 * default is the Phase 4-0 proposal (V-1); the Owner may still pick V-2 before DM-4-2 persists
 * anything. Persistence migration itself is DM-4-2's.
 * - KEEP_REWARD_RESET_BESTS (V-1): keep `clears` / `firstClearRewarded`, reset the bests (a record
 *   set under other targets or limits is not comparable).
 * - KEEP_ALL (V-2): keep everything.
 */
export type DinnerRevisionPolicy = "KEEP_REWARD_RESET_BESTS" | "KEEP_ALL";

export const DINNER_DEFAULT_REVISION_POLICY: DinnerRevisionPolicy = "KEEP_REWARD_RESET_BESTS";

export function emptyDinnerMissionRecord(revision: number): DinnerMissionRecord {
  return { revision, clears: 0, bestClearMs: null, bestTier: null, firstClearRewarded: false };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isClearMs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isTier(value: unknown): value is DinnerClearTier {
  return typeof value === "string" && (DINNER_CLEAR_TIERS as readonly string[]).includes(value);
}

/** Problems with a record's shape (empty when valid). Also rejects contradictions, e.g. a best
 *  time or first-clear payment with zero clears. */
export function dinnerMissionRecordProblems(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ["record is not an object"];
  const r = value as Record<string, unknown>;
  const problems: string[] = [];
  if (!isPositiveInteger(r.revision)) problems.push("revision must be a positive integer");
  if (!isNonNegativeInteger(r.clears)) problems.push("clears must be a non-negative integer");
  if (r.bestClearMs !== null && !isClearMs(r.bestClearMs)) problems.push("bestClearMs must be a non-negative number or null");
  if (r.bestTier !== null && !isTier(r.bestTier)) problems.push("bestTier must be GOLD / SILVER / BRONZE or null");
  if (typeof r.firstClearRewarded !== "boolean") problems.push("firstClearRewarded must be a boolean");
  if (problems.length === 0 && r.clears === 0 && (r.bestClearMs !== null || r.bestTier !== null || r.firstClearRewarded)) {
    problems.push("a record with no clears cannot have a best or a first-clear payment");
  }
  return problems;
}

export function isValidDinnerMissionRecord(value: unknown): value is DinnerMissionRecord {
  return dinnerMissionRecordProblems(value).length === 0;
}

/** Rank of a tier: GOLD 3, SILVER 2, BRONZE 1, none 0. */
function tierRank(tier: DinnerClearTier | null): number {
  return tier === null ? 0 : DINNER_CLEAR_TIERS.length - DINNER_CLEAR_TIERS.indexOf(tier);
}

/** Strictly better (GOLD > SILVER > BRONZE > none). */
export function isBetterDinnerTier(candidate: DinnerClearTier | null, current: DinnerClearTier | null): boolean {
  return tierRank(candidate) > tierRank(current);
}

/**
 * The record as seen by a run of `missionRevision`: a missing record starts empty; a record from
 * another revision goes through `policy`. Does not validate (callers check first).
 */
export function dinnerRecordForRevision(
  record: DinnerMissionRecord | undefined,
  missionRevision: number,
  policy: DinnerRevisionPolicy = DINNER_DEFAULT_REVISION_POLICY,
): DinnerMissionRecord {
  if (record === undefined) return emptyDinnerMissionRecord(missionRevision);
  if (record.revision === missionRevision || policy === "KEEP_ALL") return { ...record, revision: missionRevision };
  return { ...record, revision: missionRevision, bestClearMs: null, bestTier: null };
}

/** Stable identity of one run (for the exactly-once check). A run is never saved and only one
 *  exists at a time, so mission + revision + start instant is unique. */
export function dinnerRunKey(run: Pick<DinnerRunState, "missionId" | "revision" | "clock">): string {
  return `${run.missionId}@${run.revision}#${run.clock.startedAt}`;
}

/** The table actually usable for paying, or `null` with the reason it is not. */
function usableTable(table: DinnerRewardTable | null | undefined): { table: DinnerRewardTable | null; problems: string[] } {
  if (!table) return { table: null, problems: ["reward table unavailable"] };
  let problems: string[];
  try {
    problems = validateDinnerRewardTable(table);
  } catch {
    // A structurally broken table (e.g. a schedule missing) cannot even be validated.
    problems = ["reward table is malformed"];
  }
  if (problems.length > 0) return { table: null, problems };
  return { table, problems: [] };
}

export interface DinnerSettlementInput {
  /** The finished (or not) run. */
  run: DinnerRunState;
  /** The mission definition the run was started from (`getDinnerMission(run.missionId)`); `undefined`
   *  when unknown to this build. */
  mission: DinnerMissionDefinition | undefined;
  /** The saved record for this mission, if any. */
  record: DinnerMissionRecord | undefined;
  /** The reward authority for this mission (OD-DM4-1: an input, never a constant here). `null` /
   *  `undefined` = unavailable. */
  table: DinnerRewardTable | null | undefined;
  /** The key of the run this session already settled, if any (the DM-4-3 `session.settlement`
   *  backstop). */
  settledRunKey: string | null;
  revisionPolicy?: DinnerRevisionPolicy;
}

export type DinnerPaySchedule = "FIRST_CLEAR" | "REPEAT_CLEAR" | "UNAVAILABLE";

export type DinnerSettlementDecision =
  | {
      kind: "NO_SETTLEMENT";
      /** NOT_CLEARED: FAILED / PLAYING (pays 0, record unchanged). ALREADY_SETTLED: this run key
       *  was settled before. INVALID_INPUT: malformed or mismatched input (fails closed). */
      reason: "NOT_CLEARED" | "ALREADY_SETTLED" | "INVALID_INPUT";
      problems: string[];
    }
  | {
      kind: "SETTLE";
      runKey: string;
      missionId: string;
      clearMs: number;
      tier: DinnerClearTier | null;
      schedule: DinnerPaySchedule;
      /** Pitz to add: a non-negative integer, 0 when the table is unavailable. */
      pitz: number;
      /** The quote the pay came from (`pitz: null` inside when unavailable). */
      quote: Extract<DinnerRewardQuote, { kind: "CLEAR" }>;
      /** The record to store in place of the old one. */
      record: DinnerMissionRecord;
      newBestTime: boolean;
      newBestTier: boolean;
      /** Why the table could not pay (empty when it could). */
      tableProblems: string[];
    };

function noSettlement(
  reason: Extract<DinnerSettlementDecision, { kind: "NO_SETTLEMENT" }>["reason"],
  problems: string[] = [],
): DinnerSettlementDecision {
  return { kind: "NO_SETTLEMENT", reason, problems };
}

/**
 * The one settlement decision for a run (Phase 4-0 §7). Deterministic and side-effect free: the
 * same input always yields an equal output, and nothing passed in is mutated.
 */
export function decideDinnerSettlement(input: DinnerSettlementInput): DinnerSettlementDecision {
  const { run, mission, record, table, settledRunKey } = input;
  const policy = input.revisionPolicy ?? DINNER_DEFAULT_REVISION_POLICY;

  if (typeof run !== "object" || run === null) return noSettlement("INVALID_INPUT", ["run is missing"]);
  // Anything but a CLEAR pays 0 and records nothing (OD-DM4-2) -- checked before the rest, so a
  // failed run never depends on the reward table, the mission data or the record.
  if (run.status !== "CLEARED" || run.outcome?.kind !== "CLEAR") return noSettlement("NOT_CLEARED");

  const problems: string[] = [];
  if (!mission) problems.push(`unknown mission ${run.missionId}`);
  else {
    if (mission.missionId !== run.missionId) problems.push("run and mission ids differ");
    if (!isPositiveInteger(mission.revision)) problems.push("mission revision must be a positive integer");
    else if (run.revision !== mission.revision) problems.push("run revision differs from the mission revision");
  }
  if (typeof run.clock !== "object" || run.clock === null || !Number.isFinite(run.clock.startedAt)) {
    problems.push("run clock is malformed");
  }
  const clearMs = run.outcome.clearMs;
  if (!isClearMs(clearMs)) problems.push("clearMs must be a non-negative finite number");
  if (record !== undefined) {
    // A malformed record is never silently replaced: rebuilding it could pay the first clear twice.
    // Turning a corrupt save into `undefined` (or not) is DM-4-2's decision.
    for (const p of dinnerMissionRecordProblems(record)) problems.push(`record: ${p}`);
  }
  if (problems.length > 0 || !mission) return noSettlement("INVALID_INPUT", problems);

  const runKey = dinnerRunKey(run);
  if (settledRunKey === runKey) return noSettlement("ALREADY_SETTLED");

  const base = dinnerRecordForRevision(record, mission.revision, policy);
  const usable = usableTable(table);
  const tier = usable.table ? dinnerClearTier(clearMs, usable.table.thresholds) : null;
  const isFirstClear = !base.firstClearRewarded;
  const quote = usable.table
    ? quoteDinnerReward({ kind: "CLEAR", clearMs }, usable.table, { isFirstClear })
    : ({ kind: "CLEAR", clearMs, tier: null, pitz: null } as const);
  if (quote.kind !== "CLEAR") return noSettlement("INVALID_INPUT", ["quote is not a CLEAR quote"]);
  const paid = quote.pitz !== null;
  const schedule: DinnerPaySchedule = !paid ? "UNAVAILABLE" : isFirstClear ? "FIRST_CLEAR" : "REPEAT_CLEAR";

  const newBestTime = base.bestClearMs === null || clearMs < base.bestClearMs;
  const newBestTier = isBetterDinnerTier(tier, base.bestTier);
  const nextRecord: DinnerMissionRecord = {
    revision: mission.revision,
    clears: base.clears + 1,
    bestClearMs: newBestTime ? clearMs : base.bestClearMs,
    bestTier: newBestTier ? tier : base.bestTier,
    // Only an actual payment consumes the first-clear entitlement.
    firstClearRewarded: base.firstClearRewarded || (paid && isFirstClear),
  };

  return {
    kind: "SETTLE",
    runKey,
    missionId: mission.missionId,
    clearMs,
    tier,
    schedule,
    pitz: quote.pitz?.total ?? 0,
    quote,
    record: nextRecord,
    newBestTime,
    newBestTier,
    tableProblems: paid ? [] : usable.problems.length > 0 ? usable.problems : ["reward table has no Pitz amounts (untuned)"],
  };
}

/** Limits a production reward table must respect (Phase 4-0 §8). All are inputs: the candidate
 *  cap (OD-DM4-1, ~250), Lunch Rush's Pitz per minute (derived by the caller from economy.ts)
 *  and the fastest measured human clear (DM-5-1). */
export interface DinnerRewardEconomyLimits {
  maxFirstClearPitz: number;
  lunchRushPitzPerMinute: number;
  fastestHumanClearMs: number;
}

function maxPayout(payout: { clear: number; tierBonus: Readonly<Record<DinnerClearTier, number>> }): number {
  return payout.clear + Math.max(...DINNER_CLEAR_TIERS.map((t) => payout.tierBonus[t]));
}

/**
 * OD-DM4-1 economy invariants (I1..I4) of a tuned table (empty when it passes). An untuned table
 * (`pitz: null`) has nothing to check. Invalid limits are reported, never assumed.
 */
export function validateDinnerRewardEconomy(table: DinnerRewardTable, limits: DinnerRewardEconomyLimits): string[] {
  const problems = usableTable(table).problems;
  const { maxFirstClearPitz, lunchRushPitzPerMinute, fastestHumanClearMs } = limits;
  if (!(Number.isFinite(maxFirstClearPitz) && maxFirstClearPitz >= 0)) problems.push("limit maxFirstClearPitz is invalid");
  if (!(Number.isFinite(lunchRushPitzPerMinute) && lunchRushPitzPerMinute >= 0)) problems.push("limit lunchRushPitzPerMinute is invalid");
  if (!(Number.isFinite(fastestHumanClearMs) && fastestHumanClearMs > 0)) problems.push("limit fastestHumanClearMs is invalid");
  if (!table.pitz || problems.length > 0) return problems;

  const { firstClear, repeatClear } = table.pitz;
  const firstMax = maxPayout(firstClear);
  const repeatMax = maxPayout(repeatClear);
  if (firstMax > maxFirstClearPitz) problems.push(`I1: first clear pays up to ${firstMax} > ${maxFirstClearPitz}`);
  const repeatPerMinute = repeatMax / (fastestHumanClearMs / 60_000);
  if (repeatPerMinute > lunchRushPitzPerMinute) {
    problems.push(`I2: repeat clear earns ${repeatPerMinute.toFixed(1)} Pitz/min > Lunch Rush ${lunchRushPitzPerMinute.toFixed(1)}`);
  }
  if (!(repeatMax < firstMax)) problems.push(`I3: repeat clear (${repeatMax}) must pay less than the first clear (${firstMax})`);
  for (const [name, payout] of [["first", firstClear], ["repeat", repeatClear]] as const) {
    const b = payout.tierBonus;
    if (!(b.GOLD >= b.SILVER && b.SILVER >= b.BRONZE && b.BRONZE >= 0)) {
      problems.push(`I4: ${name} tier bonus must satisfy GOLD >= SILVER >= BRONZE >= 0`);
    }
  }
  return problems;
}
