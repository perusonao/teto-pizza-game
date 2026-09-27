import {
  dinnerMissionRecordProblems,
  isBetterDinnerTier,
  type DinnerMissionRecord,
} from "../mission/dinner/dinnerSettlement";
import { SAVE_ID_PATTERN } from "./saveIdGrammar";

/**
 * Dinner Mission DM-4-2 (Issue #274): how `dinnerMissionRecords` is read from and merged into the
 * save. Pure -- ./persistence.ts calls it; nothing here touches storage, the reducer or the UI.
 *
 * Authority: docs/reports/TETO_DINNER-MISSION_DM-4_Phase4-0_Plan.md §6, DM-4-1's
 * `DinnerMissionRecord` / `dinnerMissionRecordProblems` (../mission/dinner/dinnerSettlement.ts),
 * and the Owner Decisions of 2026-09-27:
 * - Revision policy V-1: a revision change never makes the first-clear reward claimable again
 *   (`firstClearRewarded` and `clears` survive; the bests may reset).
 * - A broken saved record is FAIL-CLOSED: never deleted, repaired, rebuilt, replaced by a fresh
 *   record or read as `firstClearRewarded = false`. Its mission is *blocked* (no settlement, no
 *   Pitz, no overwrite) while every other mission and game mode carries on.
 *
 * Stored shape (save v2, top-level, no schema bump): `{ [missionId]: DinnerMissionRecord }`.
 */

/** The save's shared id grammar (./saveIdGrammar.ts), also used by the forward-compat layer. */
const RECORD_ID_PATTERN = SAVE_ID_PATTERN;

export interface DinnerMissionRecordsState {
  /** Readable records by mission id -- ids this build knows and well-formed future ids alike. */
  records: Readonly<Record<string, DinnerMissionRecord>>;
  /** Missions whose stored record is broken: kept verbatim in storage, never settled or written. */
  blockedMissionIds: readonly string[];
  /** The whole `dinnerMissionRecords` value is unreadable (not an object): every Dinner mission is
   *  blocked and the stored value is kept verbatim. Other game modes are unaffected. */
  containerCorrupt: boolean;
}

export const EMPTY_DINNER_MISSION_RECORDS_STATE: DinnerMissionRecordsState = Object.freeze({
  records: Object.freeze({}),
  blockedMissionIds: Object.freeze([]),
  containerCorrupt: false,
});

/** Own-property read. A mission id may legally spell an `Object.prototype` member (`constructor`,
 *  `tostring`, ...): a plain `map[id]` would then return the inherited value instead of "absent". */
function ownValue<T>(map: Readonly<Record<string, T>>, id: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Only the five record fields, in a fixed order (unknown fields stay in storage, see the merge). */
function pickRecord(value: Record<string, unknown>): DinnerMissionRecord {
  return {
    revision: value.revision as number,
    clears: value.clears as number,
    bestClearMs: value.bestClearMs as number | null,
    bestTier: value.bestTier as DinnerMissionRecord["bestTier"],
    firstClearRewarded: value.firstClearRewarded as boolean,
  };
}

/**
 * Reads the stored `dinnerMissionRecords` value. Absent (every save written before DM-4-2) reads as
 * empty. Nothing is normalized: a broken record only marks its mission blocked; a key outside the
 * id grammar is neither read nor blocked (it is no mission id any build uses) and stays in storage.
 */
export function parseDinnerMissionRecords(raw: unknown): DinnerMissionRecordsState {
  if (raw === undefined) return EMPTY_DINNER_MISSION_RECORDS_STATE;
  if (!isPlainObject(raw)) return { records: {}, blockedMissionIds: [], containerCorrupt: true };
  const records: Record<string, DinnerMissionRecord> = {};
  const blocked: string[] = [];
  for (const [id, value] of Object.entries(raw)) {
    if (!RECORD_ID_PATTERN.test(id)) continue;
    if (dinnerMissionRecordProblems(value).length > 0) blocked.push(id);
    else records[id] = pickRecord(value as Record<string, unknown>);
  }
  return { records, blockedMissionIds: blocked, containerCorrupt: false };
}

/** Whether a mission may be settled / written at all (DM-4-3 must refuse when this is true). */
export function isDinnerMissionRecordBlocked(state: DinnerMissionRecordsState, missionId: string): boolean {
  return state.containerCorrupt || state.blockedMissionIds.includes(missionId);
}

/**
 * The record DM-4-3 hands to settlement -- the only safe way to read one for that purpose. A
 * blocked mission has NO readable record, and reading `records[id]` alone would make it look like
 * "never cleared" (a first clear). This forces the caller to handle `blocked` first (fail-closed:
 * no settlement, no Pitz, no write).
 */
export function dinnerRecordForSettlement(
  state: DinnerMissionRecordsState,
  missionId: string,
): { blocked: true } | { blocked: false; record: DinnerMissionRecord | undefined } {
  if (isDinnerMissionRecordBlocked(state, missionId)) return { blocked: true };
  return { blocked: false, record: ownValue(state.records, missionId) };
}

function minBest(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/**
 * Merges an incoming (settled) record into the stored one so a stale write can never undo
 * progress (two tabs, a replayed snapshot):
 * - `firstClearRewarded` is OR-ed -- once paid, always paid (V-1: never claimable again);
 * - `clears` is the max;
 * - the newer revision's bests win (V-1 already reset them at settlement); at the same revision the
 *   best time is the minimum and the best tier the better one.
 * Both records must already be valid.
 */
export function mergeDinnerMissionRecord(stored: DinnerMissionRecord, incoming: DinnerMissionRecord): DinnerMissionRecord {
  const firstClearRewarded = stored.firstClearRewarded || incoming.firstClearRewarded;
  const clears = Math.max(stored.clears, incoming.clears);
  if (incoming.revision !== stored.revision) {
    const newer = incoming.revision > stored.revision ? incoming : stored;
    return { ...newer, clears, firstClearRewarded };
  }
  return {
    revision: stored.revision,
    clears,
    bestClearMs: minBest(stored.bestClearMs, incoming.bestClearMs),
    bestTier: isBetterDinnerTier(incoming.bestTier, stored.bestTier) ? incoming.bestTier : stored.bestTier,
    firstClearRewarded,
  };
}

function sameRecord(a: DinnerMissionRecord, b: DinnerMissionRecord): boolean {
  return (
    a.revision === b.revision &&
    a.clears === b.clears &&
    a.bestClearMs === b.bestClearMs &&
    a.bestTier === b.bestTier &&
    a.firstClearRewarded === b.firstClearRewarded
  );
}

export interface DinnerRecordsWrite {
  /** The value to store under `dinnerMissionRecords`, or `undefined` to leave the key out (no
   *  records ever written and none stored -- a save that never met Dinner keeps its exact bytes). */
  value: unknown;
  /** Something differs from what is stored. */
  changed: boolean;
  /** Incoming records refused because their mission (or the whole container) is blocked. */
  refusedMissionIds: string[];
}

/**
 * The value to write, given what storage holds now (`storedRaw`, straight from storage) and the
 * records this write wants to store. Everything already in storage survives: broken records,
 * future ids, keys outside the id grammar and unknown fields inside a record are kept verbatim.
 * A broken container is kept verbatim and nothing is written into it.
 */
export function mergeDinnerMissionRecordsForWrite(
  storedRaw: unknown,
  incoming: Readonly<Record<string, DinnerMissionRecord>>,
): DinnerRecordsWrite {
  const incomingIds = Object.keys(incoming).filter((id) => RECORD_ID_PATTERN.test(id));
  const stored = parseDinnerMissionRecords(storedRaw);
  const blocked = new Set(stored.blockedMissionIds);
  if (stored.containerCorrupt) {
    return { value: storedRaw, changed: false, refusedMissionIds: incomingIds };
  }
  const base: Record<string, unknown> = {};
  if (isPlainObject(storedRaw)) {
    for (const [id, value] of Object.entries(storedRaw)) {
      if (id === "__proto__") continue;
      base[id] = value;
    }
  }
  const refused: string[] = [];
  let changed = false;
  for (const id of incomingIds) {
    const record = incoming[id];
    if (blocked.has(id) || dinnerMissionRecordProblems(record).length > 0) {
      refused.push(id);
      continue;
    }
    const current = ownValue(stored.records, id);
    const next = current ? mergeDinnerMissionRecord(current, record) : pickRecord(record as unknown as Record<string, unknown>);
    if (current && sameRecord(current, next)) continue;
    // Unknown fields a newer build stored inside the record stay; the five known fields are ours.
    const rawValue = ownValue(base, id);
    const rawRecord = isPlainObject(rawValue) ? rawValue : {};
    base[id] = { ...rawRecord, ...next };
    changed = true;
  }
  if (storedRaw === undefined && !changed) return { value: undefined, changed: false, refusedMissionIds: refused };
  return { value: base, changed, refusedMissionIds: refused };
}
