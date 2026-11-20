/**
 * #579 DRIZZLE Gesture Lab: a standalone Preview / DEV-only gesture experiment (`?drizzleLab=on`).
 *
 * It answers one question -- is drawing a sauce line with a finger understandable and enjoyable on a phone? -- with NO link to the game:
 * no reducer, no inventory, no score, no recipe, no Dex, no pendingRound, no save, no storage. Everything here is pure and in memory;
 * the state is gone on reload. FINISH liquid gameplay stays on HOLD (see docs/reports/TETO_FINISH-DRIZZLE_579_*).
 *
 * Isolation: ../main.tsx reaches the lab only behind `import.meta.env.DEV || VITE_PREVIEW_MODE` (a production build replaces both statically and
 * drops the query name and the lazily imported chunk; ./drizzleLab.gate.test.ts scans a real build). Any other value, a repeat or none: off.
 */

export const DRIZZLE_LAB_PARAM = "drizzleLab";
export const DRIZZLE_LAB_ON_VALUE = "on";
export const DRIZZLE_LAB_MARK = "drizzle-gesture-lab-v1";
export const DRIZZLE_LAB_LABEL = "試作・保存されません";

/** True when the query string asks for the lab exactly once. */
export function resolveDrizzleLabOptIn(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(DRIZZLE_LAB_PARAM);
  return all.length === 1 && all[0] === DRIZZLE_LAB_ON_VALUE;
}

let cachedOptIn: boolean | undefined;

/** Test seam: forget the cached page-load value. */
export function resetDrizzleLabForTest(): void {
  cachedOptIn = undefined;
}

/** Whether the Preview / DEV query opted in to the lab. Read once per page load; never true in production. */
export function drizzleLabOptedIn(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOptIn === undefined) cachedOptIn = resolveDrizzleLabOptIn(typeof window === "undefined" ? "" : window.location.search);
    return cachedOptIn;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Geometry (surface coordinates: a 0..100 square, the mock dough is a circle)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface Pt {
  x: number;
  y: number;
}

export const SURFACE_SIZE = 100;
export const DOUGH_CENTER: Pt = { x: 50, y: 50 };
export const DOUGH_RADIUS = 44;
/** Points closer than this to the previous kept point are dropped (distance resampling). */
export const MIN_POINT_DISTANCE = 1.4;
/** Hard cap on points of one stroke (a long scribble is thinned, never grows without bound). */
export const MAX_POINTS_PER_STROKE = 160;
/** Hard cap on committed strokes (the oldest is dropped). */
export const MAX_STROKES = 24;
/** A stroke whose total travel stays under this is a tap. */
export const TAP_TRAVEL = 3;
/** The deterministic tap line: a short slanted segment of this length centred on the tap (a line, never a dot). */
export const TAP_LINE_LENGTH = 16;
const TAP_LINE_ANGLE = -Math.PI / 6;

export function isInsideDough(p: Pt): boolean {
  return Math.hypot(p.x - DOUGH_CENTER.x, p.y - DOUGH_CENTER.y) <= DOUGH_RADIUS;
}

/** Pulls a point to the dough edge when it is outside (non-finite input becomes the centre). */
export function clampToDough(p: Pt): Pt {
  const x = Number.isFinite(p.x) ? p.x : DOUGH_CENTER.x;
  const y = Number.isFinite(p.y) ? p.y : DOUGH_CENTER.y;
  const dx = x - DOUGH_CENTER.x;
  const dy = y - DOUGH_CENTER.y;
  const d = Math.hypot(dx, dy);
  if (d <= DOUGH_RADIUS) return { x, y };
  const k = DOUGH_RADIUS / d;
  return { x: DOUGH_CENTER.x + dx * k, y: DOUGH_CENTER.y + dy * k };
}

export function pathLength(points: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** Maps a client coordinate to surface units; null when the rect is degenerate or the input is not finite. */
export function clientToSurface(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Pt | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: ((clientX - rect.left) / rect.width) * SURFACE_SIZE, y: ((clientY - rect.top) / rect.height) * SURFACE_SIZE };
}

/** The deterministic short line a tap makes, centred on the (clamped) tap point and kept inside the dough. */
export function tapLine(at: Pt): Pt[] {
  const c = clampToDough(at);
  const hx = (Math.cos(TAP_LINE_ANGLE) * TAP_LINE_LENGTH) / 2;
  const hy = (Math.sin(TAP_LINE_ANGLE) * TAP_LINE_LENGTH) / 2;
  return [clampToDough({ x: c.x - hx, y: c.y - hy }), clampToDough({ x: c.x + hx, y: c.y + hy })];
}

/** Keeps at most `max` points, always the first and last, evenly thinned in between. */
export function thinPoints(points: readonly Pt[], max: number = MAX_POINTS_PER_STROKE): Pt[] {
  if (points.length <= max) return points.slice();
  const out: Pt[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round((i * (points.length - 1)) / (max - 1))]);
  return out;
}

/** SVG polyline `points` attribute. */
export function toPolyline(points: readonly Pt[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Stroke state machine (pure; the component only forwards pointer events)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface Stroke {
  id: number;
  points: Pt[];
  /** True when the stroke was made by a tap (the fallback line). */
  tap: boolean;
}

export interface LabState {
  pending: { pointerId: number; points: Pt[]; travel: number } | null;
  strokes: Stroke[];
  nextId: number;
}

export const INITIAL_LAB_STATE: LabState = { pending: null, strokes: [], nextId: 1 };

/** Pointer down: starts a pending stroke only inside the dough and only when no other pointer owns one (multi-touch: the second finger is ignored). */
export function strokeStart(state: LabState, pointerId: number, at: Pt | null): LabState {
  if (state.pending || !at || !isInsideDough(at)) return state;
  return { ...state, pending: { pointerId, points: [at], travel: 0 } };
}

/** Pointer move: appends a clamped, resampled point for the owning pointer only. */
export function strokeMove(state: LabState, pointerId: number, at: Pt | null): LabState {
  const pending = state.pending;
  if (!pending || pending.pointerId !== pointerId || !at) return state;
  const p = clampToDough(at);
  const last = pending.points[pending.points.length - 1];
  const d = Math.hypot(p.x - last.x, p.y - last.y);
  if (d < MIN_POINT_DISTANCE) return state;
  const points = pending.points.length >= MAX_POINTS_PER_STROKE ? thinPoints([...pending.points, p], Math.ceil(MAX_POINTS_PER_STROKE * 0.75)) : [...pending.points, p];
  return { ...state, pending: { pointerId, points, travel: pending.travel + d } };
}

/** Pointer up: commits a VISUAL-ONLY stroke (a tap becomes the short deterministic line). Other pointers do nothing. */
export function strokeEnd(state: LabState, pointerId: number): LabState {
  const pending = state.pending;
  if (!pending || pending.pointerId !== pointerId) return state;
  const tap = pending.travel < TAP_TRAVEL;
  const points = tap ? tapLine(pending.points[0]) : pending.points;
  const stroke: Stroke = { id: state.nextId, points, tap };
  const strokes = [...state.strokes, stroke].slice(-MAX_STROKES);
  return { pending: null, strokes, nextId: state.nextId + 1 };
}

/** pointercancel / lost capture / leaving the lab: discards the pending stroke (null pointerId = whichever owns it). */
export function strokeCancel(state: LabState, pointerId?: number): LabState {
  if (!state.pending) return state;
  if (pointerId !== undefined && state.pending.pointerId !== pointerId) return state;
  return { ...state, pending: null };
}

export function labReset(): LabState {
  return INITIAL_LAB_STATE;
}
