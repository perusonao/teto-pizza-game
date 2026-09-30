/**
 * CUT-S2 (Issue #288): a seeded, pixel-based model of a person drawing the three CUT lines, shared
 * by the pure distribution probe (src/logic/cut/quality.s2Shadow.test.ts) and the real-pointer
 * Playwright harness (e2e/cut-quality-shadow-s2.spec.ts). Test support only: no production module
 * imports it.
 *
 * It models what the gesture layer actually receives -- a press point and a release point, each
 * with aim error in screen pixels -- and builds the committed line the same way the game does
 * (`buildRimToRimCutLine`). The aim error is the only human factor modelled; it is a MODEL, not a
 * measurement of real people (see the S2 report for what that does and does not prove).
 */
import { DOUGH_CENTER, DOUGH_RADIUS, type DoughPoint } from "../pizzaCoordinates";
import { buildRimToRimCutLine, type CutLine } from "../cut/types";

/** mulberry32: small, deterministic, good enough for a probe. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export interface OperatorProfile {
  readonly id: "ideal" | "normal" | "sloppy" | "rough";
  /** Std-dev of the press / release position error, in screen px. */
  readonly aimSigmaPx: number;
  /** Std-dev of the error in the intended angle of each cut, in degrees. */
  readonly angleSigmaDeg: number;
  /** Std-dev of a shared shift of the intended centre, in screen px (mis-judging the middle). */
  readonly centerShiftSigmaPx: number;
}

/** What a player "aims" at is a rim-to-rim diameter at 60 degree spacing; these are how far off
 *  their finger lands. `normal` is a fingertip-scale error (~6px), `sloppy` a careless one. */
export const OPERATOR_PROFILES: Readonly<Record<OperatorProfile["id"], OperatorProfile>> = {
  ideal: { id: "ideal", aimSigmaPx: 1.5, angleSigmaDeg: 1, centerShiftSigmaPx: 0 },
  normal: { id: "normal", aimSigmaPx: 6, angleSigmaDeg: 4, centerShiftSigmaPx: 3 },
  sloppy: { id: "sloppy", aimSigmaPx: 14, angleSigmaDeg: 10, centerShiftSigmaPx: 8 },
  rough: { id: "rough", aimSigmaPx: 30, angleSigmaDeg: 20, centerShiftSigmaPx: 18 },
};

/** Press/release fractions of the radius: the player need not touch the rim (design doc §2.2). */
const PRESS_RADIUS_FRACTION = 0.92;
const RELEASE_RADIUS_FRACTION = 0.92;

export interface PlannedCut {
  /** Dough-percent press point (what the gesture layer sees as the start). */
  readonly press: DoughPoint;
  /** Dough-percent release point. */
  readonly release: DoughPoint;
  /** The committed line the game builds from them (null only for a zero-length drag). */
  readonly line: CutLine | null;
}

/**
 * Plans `lineCount` cuts at `360/(2*lineCount)`-degree spacing (60 degrees for 3 lines).
 * `pxPerPercent` converts the pixel noise into dough-percent (stage px / 100), so the same operator
 * is relatively noisier on the smaller 360px stage than on the 390px one.
 */
export function planOperatorCuts(
  profile: OperatorProfile,
  pxPerPercent: number,
  rand: () => number,
  lineCount = 3,
): PlannedCut[] {
  const aim = profile.aimSigmaPx / pxPerPercent;
  const shiftX = (gaussian(rand) * profile.centerShiftSigmaPx) / pxPerPercent;
  const shiftY = (gaussian(rand) * profile.centerShiftSigmaPx) / pxPerPercent;
  const base = rand() * (180 / lineCount);
  const cuts: PlannedCut[] = [];
  for (let i = 0; i < lineCount; i++) {
    const angle = ((base + (180 / lineCount) * i + gaussian(rand) * profile.angleSigmaDeg) * Math.PI) / 180;
    const cx = DOUGH_CENTER + shiftX;
    const cy = DOUGH_CENTER + shiftY;
    const press: DoughPoint = {
      x: cx - Math.cos(angle) * DOUGH_RADIUS * PRESS_RADIUS_FRACTION + gaussian(rand) * aim,
      y: cy - Math.sin(angle) * DOUGH_RADIUS * PRESS_RADIUS_FRACTION + gaussian(rand) * aim,
    };
    const release: DoughPoint = {
      x: cx + Math.cos(angle) * DOUGH_RADIUS * RELEASE_RADIUS_FRACTION + gaussian(rand) * aim,
      y: cy + Math.sin(angle) * DOUGH_RADIUS * RELEASE_RADIUS_FRACTION + gaussian(rand) * aim,
    };
    // The press must land on the dough (the gesture layer's own gate); pull a stray one back in.
    const dx = press.x - DOUGH_CENTER;
    const dy = press.y - DOUGH_CENTER;
    const d = Math.hypot(dx, dy);
    if (d > DOUGH_RADIUS) {
      const k = (DOUGH_RADIUS - 0.5) / d;
      press.x = DOUGH_CENTER + dx * k;
      press.y = DOUGH_CENTER + dy * k;
    }
    cuts.push({ press, release, line: buildRimToRimCutLine(press, release) });
  }
  return cuts;
}
