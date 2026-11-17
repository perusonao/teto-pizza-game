/**
 * Greek-style pan-oiling pure research prototype (Issue #870).
 * Production OFF: no imports from runtime, reducers, save or UI.
 * Normalized pan coordinates are [0,1] with a circular interior.
 * Grid resolution and readiness target are caller-provided research fixtures,
 * NOT approved game balance or physical oil quantities.
 */
export type PanPoint = Readonly<{ x: number; y: number }>;
export type OilPhase = "PAN_OIL" | "DOUGH_PRESS" | "READY";
export interface OilSession {
  readonly size: number;
  readonly covered: ReadonlySet<number>;
  readonly activePointer: number | null;
  readonly previous: PanPoint | null;
  readonly phase: OilPhase;
  readonly hasSpread: boolean;
}
export type OilEvent =
  | { readonly type: "down"; readonly pointerId: number; readonly point: PanPoint }
  | { readonly type: "move"; readonly pointerId: number; readonly point: PanPoint }
  | { readonly type: "up" | "cancel"; readonly pointerId: number }
  | { readonly type: "finish-oil"; readonly requiredFraction: number }
  | { readonly type: "finish-dough"; readonly doughComplete: boolean }
  | { readonly type: "reset" };

const validPoint = (p: PanPoint): boolean =>
  Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
const inPan = (p: PanPoint): boolean => (p.x - 0.5) ** 2 + (p.y - 0.5) ** 2 <= 0.25;

export function newOilSession(size: number): OilSession {
  if (!Number.isInteger(size) || size < 2 || size > 128) throw new RangeError("invalid research grid size");
  return { size, covered: new Set<number>(), activePointer: null, previous: null, phase: "PAN_OIL", hasSpread: false };
}
export function validPanCells(size: number): number {
  let n = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (inPan({ x: (x + 0.5) / size, y: (y + 0.5) / size })) n++;
  }
  return n;
}
export function oilCoverage(session: OilSession): number {
  return session.covered.size / validPanCells(session.size);
}
function paint(session: OilSession, from: PanPoint, to: PanPoint): ReadonlySet<number> {
  // Fixed sample density in grid units; each event deterministically paints a connected stroke.
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance * session.size * 4));
  const covered = new Set(session.covered);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    if (!inPan(p)) continue;
    const x = Math.min(session.size - 1, Math.floor(p.x * session.size));
    const y = Math.min(session.size - 1, Math.floor(p.y * session.size));
    const center = { x: (x + 0.5) / session.size, y: (y + 0.5) / session.size };
    if (inPan(center)) covered.add(y * session.size + x);
  }
  return covered;
}
export function reduceOilSession(session: OilSession, event: OilEvent): OilSession {
  if (event.type === "reset") return newOilSession(session.size);
  if (event.type === "finish-dough") {
    return session.phase === "DOUGH_PRESS" && event.doughComplete
      ? { ...session, phase: "READY" } : session;
  }
  if (event.type === "finish-oil") {
    if (session.phase !== "PAN_OIL" || session.activePointer !== null || !session.hasSpread ||
        !Number.isFinite(event.requiredFraction) || event.requiredFraction <= 0 ||
        event.requiredFraction > 1 || oilCoverage(session) < event.requiredFraction) return session;
    return { ...session, phase: "DOUGH_PRESS", previous: null };
  }
  if (session.phase !== "PAN_OIL") return session;
  if (event.type === "down") {
    if (session.activePointer !== null || !validPoint(event.point)) return session;
    return { ...session, activePointer: event.pointerId, previous: event.point,
      covered: paint(session, event.point, event.point) };
  }
  if (event.pointerId !== session.activePointer) return session;
  if (event.type !== "move") {
    // "up" | "cancel": release the owning pointer, keep painted cells and hasSpread.
    return { ...session, activePointer: null, previous: null };
  }
  if (!validPoint(event.point) || session.previous === null) return session;
  const covered = paint(session, session.previous, event.point);
  return { ...session, covered, previous: event.point,
    hasSpread: session.hasSpread || covered.size > session.covered.size };

}
