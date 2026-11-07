import { stepIsComplete, type FoldSealEvent, type FoldSealState } from "../../logic/foldSeal";

/**
 * FOLD+SEAL Lab helpers (Issue #773 T6-F2): pure, no DOM, no clock. The lab's rules that are NOT part of the F1 state machine live here:
 * pointer-to-box mapping, the explicit contact tracking and the "no navigation while a pointer is down" rule, and the measurement counters.
 */
export interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A client point as dough-box percent (0..100), or null for a degenerate rect / non-finite input. */
export function clientToBox(rect: BoxRect, clientX: number, clientY: number): { x: number; y: number } | null {
  if (![rect.left, rect.top, rect.width, rect.height, clientX, clientY].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 };
}

/**
 * Whether the (mock) "next step" may fire. Owner contract (#773 6705248785): `stepIsComplete` is true after a committed fold, sealing included, but there
 * is NO navigation while any pointer is still in contact -- tracked explicitly, never inferred from `phase` alone (a finger can be down on the stage while
 * the phase is still `folded`, e.g. an off-band touch the machine ignored).
 */
export function canAdvance(state: FoldSealState, activeContacts: number): boolean {
  return stepIsComplete(state) && activeContacts === 0;
}

/** Contact set helpers (immutable). */
export type Contacts = ReadonlySet<number>;
export const NO_CONTACTS: Contacts = new Set<number>();
export function addContact(c: Contacts, pointerId: number): Contacts {
  if (!Number.isFinite(pointerId) || c.has(pointerId)) return c;
  return new Set([...c, pointerId]);
}
export function removeContact(c: Contacts, pointerId: number): Contacts {
  if (!c.has(pointerId)) return c;
  const next = new Set(c);
  next.delete(pointerId);
  return next;
}

export interface LabMetrics {
  foldTouches: number;
  foldGrabMisses: number;
  foldReleasedShort: number;
  foldCommits: number;
  /** null until the first commit; true when the first release that ended a drag was a commit. */
  foldFirstTry: boolean | null;
  foldMs: number | null;
  sealStrokes: number;
  sealBandExits: number;
  sealResets: number;
  sealSkips: number;
  sealMs: number | null;
  buttonFolds: number;
  buttonSeals: number;
  cancels: number;
  invalidates: number;
  advanceOk: number;
  advanceBlocked: number;
  foldStartAt: number | null;
  sealStartAt: number | null;
}

export const EMPTY_METRICS: LabMetrics = {
  foldTouches: 0,
  foldGrabMisses: 0,
  foldReleasedShort: 0,
  foldCommits: 0,
  foldFirstTry: null,
  foldMs: null,
  sealStrokes: 0,
  sealBandExits: 0,
  sealResets: 0,
  sealSkips: 0,
  sealMs: null,
  buttonFolds: 0,
  buttonSeals: 0,
  cancels: 0,
  invalidates: 0,
  advanceOk: 0,
  advanceBlocked: 0,
  foldStartAt: null,
  sealStartAt: null,
};

const coverage = (s: FoldSealState) => s.seal.bins.reduce<number>((a, b) => a + b, 0);

/** Fold one event's effect into the counters. `now` is a monotonic ms reading supplied by the caller. Display-only; nothing is saved or sent. */
export function recordLabEvent(m: LabMetrics, e: FoldSealEvent, before: FoldSealState, after: FoldSealState, now: number): LabMetrics {
  const changed = before !== after;
  switch (e.type) {
    case "FOLD_DOWN":
      return changed ? { ...m, foldTouches: m.foldTouches + 1, foldStartAt: m.foldStartAt ?? now } : { ...m, foldGrabMisses: m.foldGrabMisses + 1 };
    case "FOLD_UP": {
      if (before.phase !== "folding") return m;
      if (after.phase === "folded") {
        return { ...m, foldCommits: m.foldCommits + 1, foldFirstTry: m.foldFirstTry ?? true, foldMs: m.foldStartAt === null ? null : now - m.foldStartAt };
      }
      return { ...m, foldReleasedShort: m.foldReleasedShort + 1, foldFirstTry: m.foldFirstTry ?? false };
    }
    case "FOLD_BUTTON":
      return changed ? { ...m, buttonFolds: m.buttonFolds + 1, foldCommits: m.foldCommits + 1, foldFirstTry: m.foldFirstTry ?? true } : m;
    case "SEAL_DOWN":
      return changed ? { ...m, sealStrokes: m.sealStrokes + 1, sealStartAt: m.sealStartAt ?? now } : m;
    case "SEAL_MOVE": {
      let next = m;
      if (before.seal.lastAngle !== null && after.seal.lastAngle === null) next = { ...next, sealBandExits: next.sealBandExits + 1 };
      if (coverage(before) < 36 && coverage(after) === 36 && next.sealMs === null && next.sealStartAt !== null) next = { ...next, sealMs: now - next.sealStartAt };
      return next;
    }
    case "SEAL_BUTTON":
      return changed ? { ...m, buttonSeals: m.buttonSeals + 1 } : m;
    case "SEAL_RESET":
      return changed ? { ...m, sealResets: m.sealResets + 1, sealStartAt: null, sealMs: null } : m;
    case "SEAL_SKIP":
      return changed ? { ...m, sealSkips: m.sealSkips + 1 } : m;
    case "CANCEL":
      return changed ? { ...m, cancels: m.cancels + 1 } : m;
    case "INVALIDATE":
      return changed ? { ...m, invalidates: m.invalidates + 1, foldStartAt: null, sealStartAt: null, foldMs: null, sealMs: null } : m;
    default:
      return m;
  }
}
