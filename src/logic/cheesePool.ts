/**
 * Issue #421 S1 / S1b -- `renderCheesePool`: one baked mozzarella pool as pixels. A PURE function; it reads no DOM, no game state, no clock and no
 * `Math.random`, and is not wired into the game (S2 does that). Design: docs/reports/TETO_APPETITE-APPEAL_421_Render-Method-Audit.md.
 *
 * Why this exists: every CSS prototype (M1 .. Proto4b) stayed a convex ellipse (solidity 0.95-1.0 against 0.76-0.84 in the reference photo), because
 * the CSS parts are only unions of convex ellipses. Here the outline is a star-shaped polar boundary R(theta) with real bulges and bays; the rest
 * (thickness, translucency, shading, browning) is derived from that one shape in a small pixel grid, the same family as the sauce display
 * (`sauceDisplay.ts`).
 *
 * S1b (this version): the outline generator draws from five ARCHETYPES (puddle, one asymmetric tongue, kidney bay, two uneven lobes, shouldered
 * puddle) instead of one recipe (S1's fixed "2 tongues + 1 bay" made 77 % of the pools three-lobed), and every candidate must pass naturalness
 * filters (aspect, solidity band, curvature limits that forbid slits and spikes, slope limit, a minimum waist, no near-regular tri-lobe), by
 * deterministic rejection sampling on the seed's own stream. The pink bleed is reduced (a thinner, tip-only translucent film), the browning
 * blisters are irregular (rotated, noise-warped, with a darker rim and satellites), and the grid is selectable (96 or 64).
 *
 * Reference numbers (the Owner's photo, measured in the audit; the photo itself is NOT in the repository), "large pools":
 *   solidity 0.76-0.84 | aspect 1.06-1.37 | edge: normalised brightness 3 px outside the boundary 0.08-0.27 | core ~(238,234,218), matte,
 *   <= 7 % of the pixels above luminance 246 | warm (amber / brown) pixels 1-4 % | the rim just inside the edge is a little warmer and darker.
 *
 * Structure (cost): everything that does not depend on the melt is computed once per (seed, grid) and cached (`getCheesePoolGeometry`). A render only
 * re-evaluates the radius scale, the thickness, the lighting and the colour. `renderCheesePoolCached` additionally memoises whole images by
 * (seed, grid, quantised melt / toast / char, reducedMotion).
 */

/** Default pixels per side of the pool image. The pool is centred and uses at most ~88 % of the half-width, leaving room for the soft edge. */
export const CHEESE_POOL_GRID = 96;
/** The smaller grid (S1b compares both; the shape is identical, only the sampling differs). */
export const CHEESE_POOL_GRID_SMALL = 64;
export type CheesePoolGrid = 64 | 96;
/** CSS px the 96 grid is meant to span when S2 draws it (a hint for the wiring; nothing here depends on it). */
export const CHEESE_POOL_SPAN_PX = 72;
/** Raw lump area as a fraction of the finished pool's area (a 28x23 px piece grows to roughly 1100-1500 px^2). */
export const CHEESE_POOL_RAW_AREA = 0.38;

export interface CheesePoolImage {
  width: number;
  height: number;
  /** straight (non-premultiplied) RGBA, row-major, like `ImageData.data` */
  data: Uint8ClampedArray;
}

export interface CheesePoolOptions {
  /**
   * `prefers-reduced-motion`: leave out the transient deformation (the small overshoot while the pool is spreading) and show the settled shape
   * for the given melt. The finished pool (melt 1) is identical either way.
   */
  reducedMotion?: boolean;
  /** pixels per side: 96 (default) or 64. The same seed gives the same shape on both grids. */
  grid?: CheesePoolGrid;
}

const BINS = 360;
const TAU = Math.PI * 2;

function clamp01(v: number): number {
  return !(v > 0) ? 0 : v > 1 ? 1 : v; // NaN -> 0
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// --- deterministic randomness (FNV-1a hash of the seed, xorshift32 stream) -------------------------------------------------------------------

function hashSeed(seed: string | number): number {
  const text = typeof seed === "number" ? `#${seed}` : seed;
  let state = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    state ^= text.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return (state >>> 0) || 1;
}

function makeRng(seed: string | number): () => number {
  let s = hashSeed(seed);
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

/** smooth 2-D value noise on a (lattice x lattice) grid of random values, sampled over an n x n image; 0..1 */
function noiseMap(rng: () => number, lattice: number, n: number): Float32Array {
  const size = lattice + 2;
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i += 1) g[i] = rng();
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const fx = (x / (n - 1)) * lattice;
      const fy = (y / (n - 1)) * lattice;
      const xi = Math.min(lattice - 1, Math.floor(fx));
      const yi = Math.min(lattice - 1, Math.floor(fy));
      const tx = fx - xi;
      const ty = fy - yi;
      const u = tx * tx * (3 - 2 * tx);
      const v = ty * ty * (3 - 2 * ty);
      const a = g[yi * size + xi];
      const b = g[yi * size + xi + 1];
      const c = g[(yi + 1) * size + xi];
      const d = g[(yi + 1) * size + xi + 1];
      out[y * n + x] = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
  }
  return out;
}

// --- the outline: archetypes and naturalness filters ---------------------------------------------------------------------------------------

export type CheeseArchetype = "puddle" | "tongue" | "bay" | "lobes" | "shoulder";

export interface Boundary {
  archetype: CheeseArchetype;
  /** smooth harmonic part and ripple of R(theta) (theta bins, closed: index BINS equals index 0) */
  lutH: Float32Array;
  /** tongues, bay, shoulder and notch part of R(theta) */
  lutT: Float32Array;
  /** 0..1 how strongly each theta bin belongs to a positive tongue (the tongue tips are the thin film) */
  tongue: Float32Array;
  /** angle of the first tongue (or of the strongest bulge), where the first browning blister likes to sit */
  anchorAngle: number;
  /** the finished outline R1(theta) = max(0.4, 1 + lutH + lutT) */
  r1: Float32Array;
  cx: number;
  cy: number;
  /** aspect ratio of the finished shape (sqrt of the covariance eigenvalue ratio), and the direction of its major axis */
  aspect: number;
  phi: number;
  /** area / convex-hull area of the finished outline */
  solidity: number;
  /** extreme curvature of the finished outline in units of 1 / (mean radius): a circle is 1; concave bays are negative */
  minCurvature: number;
  maxCurvature: number;
  /** max |dR/dtheta| / R */
  maxSlope: number;
  /** shortest / longest radius of the finished outline (a small ratio is a narrow waist or spike) */
  radiusRatio: number;
  /** prominent radial lobes of the finished outline (bin = degree) */
  lobeAngles: number[];
  /** texture ripple not yet added to lutH (drawn candidates only; applied to the accepted outline) */
  ripple?: Array<{ k: number; a: number; ph: number }>;
}

/** a gaussian bump in angle with its own width on each side (an asymmetric tongue or bay) */
function skewBump(theta: number, centre: number, sigmaLeft: number, sigmaRight: number): number {
  let d = (theta - centre) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  const s = d < 0 ? sigmaLeft : sigmaRight;
  return Math.exp(-(d * d) / (2 * s * s));
}

/** Draws one candidate outline (and measures it). Consumes `rng`; the archetype comes from the stream, so a seed always draws the same sequence. */
function drawBoundary(rng: () => number): Boundary {
  const pick = rng();
  const archetype: CheeseArchetype = pick < 0.3 ? "puddle" : pick < 0.56 ? "tongue" : pick < 0.78 ? "bay" : pick < 0.92 ? "lobes" : "shoulder";
  const harm = (amp: number, decay: number, kMax: number) => {
    const out: Array<{ k: number; a: number; ph: number }> = [];
    for (let k = 2; k <= kMax; k += 1) out.push({ k, a: (amp / Math.pow(k, decay)) * (0.6 + 0.8 * rng()) * 2 * (k === 2 ? 0.5 : 1), ph: rng() * TAU });
    return out;
  };
  const bumps: Array<{ c: number; a: number; sl: number; sr: number; thin: boolean }> = [];
  let harmonics: Array<{ k: number; a: number; ph: number }>;
  let anchor = rng() * TAU;
  const bay = (c: number, depth: number) => bumps.push({ c, a: -depth, sl: 0.55 + 0.4 * rng(), sr: 0.55 + 0.4 * rng(), thin: false });
  if (archetype === "puddle") {
    harmonics = harm(0.2 + 0.1 * rng(), 0.8, 5);
    if (rng() < 0.5) bumps.push({ c: anchor, a: 0.16 + 0.14 * rng(), sl: 0.5 + 0.35 * rng(), sr: 0.5 + 0.35 * rng(), thin: true });
  } else if (archetype === "tongue") {
    harmonics = harm(0.1 + 0.08 * rng(), 0.9, 5);
    bumps.push({ c: anchor, a: 0.4 + 0.3 * rng(), sl: 0.3 + 0.25 * rng(), sr: 0.45 + 0.4 * rng(), thin: true });
    bay(anchor + (rng() < 0.5 ? 1 : -1) * (1.5 + 0.9 * rng()), 0.12 + 0.1 * rng());
  } else if (archetype === "bay") {
    harmonics = harm(0.12 + 0.1 * rng(), 0.9, 5);
    bay(anchor + Math.PI * (0.8 + 0.4 * rng()), 0.14 + 0.1 * rng());
    if (rng() < 0.55) bumps.push({ c: anchor, a: 0.18 + 0.16 * rng(), sl: 0.35 + 0.2 * rng(), sr: 0.35 + 0.2 * rng(), thin: true });
  } else if (archetype === "lobes") {
    harmonics = harm(0.1 + 0.08 * rng(), 0.9, 5);
    const a1 = 0.4 + 0.25 * rng();
    const c2 = anchor + 1.6 + 2.2 * rng();
    bumps.push({ c: anchor, a: a1, sl: 0.3 + 0.25 * rng(), sr: 0.3 + 0.25 * rng(), thin: true });
    bumps.push({ c: c2, a: a1 * (0.45 + 0.3 * rng()), sl: 0.3 + 0.25 * rng(), sr: 0.3 + 0.25 * rng(), thin: true });
    bay(anchor + (c2 - anchor) / 2 + Math.PI * (rng() < 0.5 ? 0 : 1), 0.1 + 0.08 * rng());
  } else {
    harmonics = harm(0.16 + 0.1 * rng(), 0.8, 5);
    bumps.push({ c: anchor, a: 0.28 + 0.16 * rng(), sl: 0.7 + 0.3 * rng(), sr: 0.9 + 0.4 * rng(), thin: true });
    if (rng() < 0.6) bumps.push({ c: anchor + 2.2 + 1.6 * rng(), a: 0.2 + 0.14 * rng(), sl: 0.35 + 0.2 * rng(), sr: 0.35 + 0.2 * rng(), thin: true });
  }
  // a faint high-frequency ripple, so no edge is perfectly smooth (kept small: it must never make a notch)
  const ripple: Array<{ k: number; a: number; ph: number }> = [];
  for (let k = 7; k <= 10; k += 1) ripple.push({ k, a: 0.008 + 0.01 * rng(), ph: rng() * TAU });
  const lutH = new Float32Array(BINS + 1);
  const lutT = new Float32Array(BINS + 1);
  const tongue = new Float32Array(BINS + 1);
  for (let b = 0; b <= BINS; b += 1) {
    const th = ((b % BINS) / BINS) * TAU;
    let h = 0;
    for (const t of harmonics) h += t.a * Math.cos(t.k * th + t.ph);
    let tt = 0;
    let tg = 0;
    for (const bump of bumps) {
      const g = skewBump(th, bump.c, bump.sl, bump.sr);
      tt += bump.a * g;
      if (bump.thin && bump.a > 0) tg = Math.max(tg, g);
    }
    lutH[b] = h;
    lutT[b] = tt;
    tongue[b] = tg;
  }
  anchor = bumps.find((b) => b.a > 0)?.c ?? anchor;
  // the ripple is texture: it is added only to the accepted outline (applyRipple), and never counts towards the curvature limits
  const boundary = measureBoundary(archetype, lutH, lutT, tongue, anchor);
  boundary.ripple = ripple;
  return boundary;
}

function applyRipple(boundary: Boundary): void {
  const ripple = boundary.ripple;
  if (!ripple) return;
  for (let b = 0; b <= BINS; b += 1) {
    const th = ((b % BINS) / BINS) * TAU;
    let h = 0;
    for (const t of ripple) h += t.a * Math.cos(t.k * th + t.ph);
    boundary.lutH[b] += h;
  }
  boundary.ripple = undefined;
}

function measureBoundary(archetype: CheeseArchetype, lutH: Float32Array, lutT: Float32Array, tongue: Float32Array, anchorAngle: number): Boundary {
  const r1 = new Float32Array(BINS);
  for (let b = 0; b < BINS; b += 1) r1[b] = Math.max(0.4, 1 + lutH[b] + lutT[b]);
  const dTh = TAU / BINS;
  let area = 0;
  let mx = 0;
  let my = 0;
  let ixx = 0;
  let iyy = 0;
  let ixy = 0;
  let rMin = Infinity;
  let rMax = 0;
  let rSum = 0;
  const pts: Array<[number, number]> = [];
  for (let b = 0; b < BINS; b += 1) {
    const th = ((b + 0.5) / BINS) * TAU;
    const r = r1[b];
    const c = Math.cos(th);
    const s = Math.sin(th);
    area += 0.5 * r * r * dTh;
    mx += (r * r * r * c * dTh) / 3;
    my += (r * r * r * s * dTh) / 3;
    ixx += (r * r * r * r * c * c * dTh) / 4;
    iyy += (r * r * r * r * s * s * dTh) / 4;
    ixy += (r * r * r * r * c * s * dTh) / 4;
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
    rSum += r;
    pts.push([r * c, r * s]);
  }
  const cx = mx / area;
  const cy = my / area;
  const sxx = ixx / area - cx * cx;
  const syy = iyy / area - cy * cy;
  const sxy = ixy / area - cx * cy;
  const mean = (sxx + syy) / 2;
  const diff = Math.hypot((sxx - syy) / 2, sxy);
  const aspect = Math.sqrt((mean + diff) / Math.max(1e-6, mean - diff));
  // the convex hull (and so the solidity) is only needed for outlines whose aspect is acceptable; the others are rejected first (0 = not measured)
  let solidity = 0;
  if (aspect >= CHEESE_POOL_LIMITS.aspectMin && aspect <= CHEESE_POOL_LIMITS.aspectMax) {
    // convex hull of the outline points (monotone chain)
    const sorted = [...pts].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o: [number, number], a: [number, number], c2: [number, number]) => (a[0] - o[0]) * (c2[1] - o[1]) - (a[1] - o[1]) * (c2[0] - o[0]);
    const lower: Array<[number, number]> = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: Array<[number, number]> = [];
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    let hullArea = 0;
    for (let i = 0; i < hull.length; i += 1) {
      const [x1, y1] = hull[i];
      const [x2, y2] = hull[(i + 1) % hull.length];
      hullArea += x1 * y2 - x2 * y1;
    }
    hullArea = Math.abs(hullArea) / 2;
    solidity = area / Math.max(1e-6, hullArea);
  }
  // curvature and slope of the polar curve on a lightly smoothed radius
  const sm = new Float32Array(BINS);
  for (let b = 0; b < BINS; b += 1) sm[b] = (r1[(b + BINS - 2) % BINS] + r1[(b + BINS - 1) % BINS] + r1[b] + r1[(b + 1) % BINS] + r1[(b + 2) % BINS]) / 5;
  const meanR = rSum / BINS;
  let minK = Infinity;
  let maxK = -Infinity;
  let maxSlope = 0;
  for (let b = 0; b < BINS; b += 1) {
    const rm = sm[(b + BINS - 1) % BINS];
    const r = sm[b];
    const rp = sm[(b + 1) % BINS];
    const d1 = (rp - rm) / (2 * dTh);
    const d2 = (rp - 2 * r + rm) / (dTh * dTh);
    const k = ((r * r + 2 * d1 * d1 - r * d2) / Math.pow(r * r + d1 * d1, 1.5)) * meanR;
    minK = Math.min(minK, k);
    maxK = Math.max(maxK, k);
    maxSlope = Math.max(maxSlope, Math.abs(d1) / r);
  }
  // prominent lobes (peaks of the radius, prominence > 10 % of the mean radius within +-50 degrees)
  const lobeAngles: number[] = [];
  for (let b = 0; b < BINS; b += 1) {
    if (sm[b] > sm[(b + BINS - 1) % BINS] && sm[b] >= sm[(b + 1) % BINS] && sm[b] > meanR * 1.04) {
      let lo = Infinity;
      for (let d = -50; d <= 50; d += 1) lo = Math.min(lo, sm[(b + d + BINS) % BINS]);
      if (sm[b] - lo > 0.1 * meanR) lobeAngles.push(b);
    }
  }
  return {
    archetype,
    lutH,
    lutT,
    tongue,
    anchorAngle,
    r1,
    cx,
    cy,
    aspect,
    phi: 0.5 * Math.atan2(2 * sxy, sxx - syy),
    solidity,
    minCurvature: minK,
    maxCurvature: maxK,
    maxSlope,
    radiusRatio: rMin / rMax,
    lobeAngles,
  };
}

/** Naturalness limits (S1b). The outline must look like a poured cheese pool, not a clover, a heart, a spike or a slit. */
export const CHEESE_POOL_LIMITS = {
  aspectMin: 1.07,
  aspectMax: 1.34,
  /** S1 was 0.80-0.97 (median 0.90); the photo's large pools are 0.76-0.84. Below ~0.78 the outlines turned into slits and folded paper. */
  solidityMin: 0.8,
  solidityMax: 0.95,
  /** curvature in units of 1/(mean radius): no needle-sharp convex tips, no tight concave pockets (slits) */
  maxCurvature: 5.5,
  minCurvature: -9,
  maxSlope: 1.25,
  minRadiusRatio: 0.42,
  /** a regular tri-lobe (3 lobes, every gap 95-145 degrees) is rejected unless the seed's stream lets it through at this rate */
  regularTriLobeRate: 0.12,
} as const;

/** null when the outline is acceptable, otherwise why it is rejected (used by the generator, the tests and the failure gallery) */
export function cheeseBoundaryRejection(b: Boundary, triLobeRoll = 1): string | null {
  const L = CHEESE_POOL_LIMITS;
  if (b.aspect < L.aspectMin || b.aspect > L.aspectMax) return "aspect";
  if (b.solidity < L.solidityMin) return "too concave";
  if (b.solidity > L.solidityMax) return "too convex";
  if (b.maxCurvature > L.maxCurvature) return "spike";
  if (b.minCurvature < L.minCurvature) return "slit";
  if (b.maxSlope > L.maxSlope) return "steep";
  if (b.radiusRatio < L.minRadiusRatio) return "waist";
  if (b.lobeAngles.length === 3) {
    const gaps = b.lobeAngles.map((a, i) => (b.lobeAngles[(i + 1) % 3] - a + BINS) % BINS);
    if (gaps.every((g) => g >= 95 && g <= 145) && triLobeRoll >= L.regularTriLobeRate) return "regular tri-lobe";
  }
  return null;
}

const MAX_DRAWS = 60;

/** A gentle outline that always passes the limits (the fallback after MAX_DRAWS misses, which essentially never happens). */
function safeBoundary(rng: () => number): Boundary {
  const lutH = new Float32Array(BINS + 1);
  const lutT = new Float32Array(BINS + 1);
  const tongue = new Float32Array(BINS + 1);
  const a2 = 0.1 + 0.05 * rng();
  const a3 = 0.07 + 0.04 * rng();
  const p2 = rng() * TAU;
  const p3 = rng() * TAU;
  for (let b = 0; b <= BINS; b += 1) {
    const th = ((b % BINS) / BINS) * TAU;
    lutH[b] = a2 * Math.cos(2 * th + p2) + a3 * Math.cos(3 * th + p3);
    tongue[b] = Math.max(0, Math.cos(th - p3)) ** 3;
  }
  return measureBoundary("puddle", lutH, lutT, tongue, p3);
}

/** Draws outlines from the seed's stream until one passes the limits (deterministic). `stats` receives the rejection reasons (for the report). */
function chooseBoundary(rng: () => number, stats?: { draws: number; reasons: Record<string, number> }): Boundary {
  for (let draw = 1; draw <= MAX_DRAWS; draw += 1) {
    const candidate = drawBoundary(rng);
    const reason = cheeseBoundaryRejection(candidate, rng());
    if (stats) {
      stats.draws = draw;
      if (reason) stats.reasons[reason] = (stats.reasons[reason] ?? 0) + 1;
    }
    if (!reason) {
      applyRipple(candidate);
      return candidate;
    }
  }
  return safeBoundary(rng);
}

// --- per-(seed, grid) geometry (cached) ------------------------------------------------------------------------------------------------------

export interface CheesePoolGeometry {
  grid: number;
  archetype: CheeseArchetype;
  /** harmonic / ripple part of the boundary (theta bins); multiplied by the melt's complexity */
  lutH: Float32Array;
  /** tongue / bay / shoulder part of the boundary (theta bins); multiplied by the same complexity */
  lutT: Float32Array;
  /** 0..1 how strongly each theta bin belongs to a tongue (the tongue tips are thin film) */
  tongue: Float32Array;
  /** per pixel: floor of theta in bins, and the fraction to the next bin (linear interpolation of the boundary) */
  bin0: Uint16Array;
  binFrac: Float32Array;
  /** per pixel: distance from the shape origin in the pool's own frame, in boundary units (rho = qr / boundary(theta, melt)) */
  qr: Float32Array;
  /** value noise: low frequency (thickness variation) and higher frequency (sheen and blister irregularity) */
  noiseLow: Float32Array;
  noiseHigh: Float32Array;
  /** per pixel browning blister: fill weight and darker rim weight, 0..1 (1-4 irregular blisters plus satellites) */
  blister: Float32Array;
  blisterRim: Float32Array;
  blisterCount: number;
  /** analytic properties of the finished outline (informational; the tests measure the rendered pixels) */
  solidity: number;
  aspect: number;
}

const GEOMETRY_CACHE_LIMIT = 48;
const geometryCache = new Map<string, CheesePoolGeometry>();

function gridOf(options?: CheesePoolOptions): CheesePoolGrid {
  return options?.grid === 64 ? 64 : 96;
}

/** Everything about a pool that does not depend on melt / toast / char. Cached per (seed, grid) (LRU, 48 entries). */
export function getCheesePoolGeometry(seed: string | number, grid: CheesePoolGrid = 96): CheesePoolGeometry {
  const key = `${typeof seed === "number" ? `#${seed}` : seed}|${grid}`;
  const hit = geometryCache.get(key);
  if (hit) {
    geometryCache.delete(key);
    geometryCache.set(key, hit); // most recently used
    return hit;
  }
  const rng = makeRng(seed);
  const geometry = buildGeometryFromBoundary(chooseBoundary(rng), rng, grid);
  geometryCache.set(key, geometry);
  if (geometryCache.size > GEOMETRY_CACHE_LIMIT) geometryCache.delete(geometryCache.keys().next().value as string);
  return geometry;
}

function buildGeometryFromBoundary(boundary: Boundary, rng: () => number, N: number): CheesePoolGeometry {
  const { lutH, lutT, tongue, r1, cx, cy, phi, aspect } = boundary;
  const cphi = Math.cos(phi);
  const sphi = Math.sin(phi);
  // The outline is accepted with its aspect inside the band (the chooser's filter), so no stretching is needed (g = 1); the frame only centres
  // it on its centroid and scales it to the grid. (A candidate outside the band, which only the failure gallery draws, is stretched into it.)
  const g = aspect > CHEESE_POOL_LIMITS.aspectMax || aspect < CHEESE_POOL_LIMITS.aspectMin ? Math.min(CHEESE_POOL_LIMITS.aspectMax, Math.max(CHEESE_POOL_LIMITS.aspectMin, aspect)) / aspect : 1;
  const mapForward = (qx: number, qy: number): [number, number] => {
    const x = qx - cx;
    const y = qy - cy;
    const u = cphi * x + sphi * y;
    const v = -sphi * x + cphi * y;
    const gu = u * g;
    return [cphi * gu - sphi * v, sphi * gu + cphi * v];
  };
  let maxExtent = 0;
  for (let b = 0; b < BINS; b += 1) {
    const th = ((b + 0.5) / BINS) * TAU;
    const [px, py] = mapForward(r1[b] * Math.cos(th), r1[b] * Math.sin(th));
    maxExtent = Math.max(maxExtent, Math.hypot(px, py));
  }
  const half = N / 2;
  const sc = (0.88 * half) / maxExtent;
  const qr = new Float32Array(N * N);
  const bin0 = new Uint16Array(N * N);
  const binFrac = new Float32Array(N * N);
  const ginv = 1 / g;
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const px = (x + 0.5 - half) / sc;
      const py = (y + 0.5 - half) / sc;
      const u = cphi * px + sphi * py;
      const v = -sphi * px + cphi * py;
      const gu = u * ginv;
      const qx = cx + (cphi * gu - sphi * v);
      const qy = cy + (sphi * gu + cphi * v);
      let th = Math.atan2(qy, qx);
      if (th < 0) th += TAU;
      const f = (th / TAU) * BINS;
      const b = Math.min(BINS - 1, Math.floor(f));
      const i = y * N + x;
      bin0[i] = b;
      binFrac[i] = f - b;
      qr[i] = Math.hypot(qx, qy); // distance from the shape origin, in boundary units (rho = qr / boundary)
    }
  }
  const noiseLow = noiseMap(rng, 6, N);
  const noiseHigh = noiseMap(rng, 17, N);
  // Browning blisters (S1b): 1-4 irregular blisters (rotated ellipses with a noise-warped distance), each with a soft fill and a darker rim, plus 0-2
  // tiny satellites near the larger ones. The first one sits on the outline's main tongue, where the film is thin; the others anywhere inside.
  const blister = new Float32Array(N * N);
  const blisterRim = new Float32Array(N * N);
  const blisterCount = 1 + Math.floor(rng() * 4); // 1..4
  const scale = N / 96;
  const addBlister = (bxp: number, byp: number, rx: number, ry: number, rot: number, strength: number) => {
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const reach = Math.max(rx, ry) * 1.9;
    const x0 = Math.max(0, Math.floor(bxp - reach));
    const x1 = Math.min(N - 1, Math.ceil(bxp + reach));
    const y0 = Math.max(0, Math.floor(byp - reach));
    const y1 = Math.min(N - 1, Math.ceil(byp + reach));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = y * N + x;
        const dx = x + 0.5 - bxp;
        const dy = y + 0.5 - byp;
        const u = (cr * dx + sr * dy) / rx;
        const v = (-sr * dx + cr * dy) / ry;
        // the distance is warped by the high-frequency noise (an irregular edge) and by the low one (an uneven size)
        const d = Math.hypot(u, v) * (0.5 + 0.9 * noiseHigh[i]) * (0.8 + 0.4 * noiseLow[i]);
        const fill = (1 - smoothstep(0.45, 1, d)) * strength;
        const rim = smoothstep(0.55, 0.9, d) * (1 - smoothstep(0.95, 1.35, d)) * strength;
        if (fill > blister[i]) blister[i] = fill;
        if (rim > blisterRim[i]) blisterRim[i] = rim;
      }
    }
  };
  for (let k = 0; k < blisterCount; k += 1) {
    const th = k === 0 ? boundary.anchorAngle + (rng() - 0.5) * 0.7 : rng() * TAU;
    const rho = k === 0 ? 0.5 + 0.28 * rng() : 0.2 + 0.55 * rng();
    const rb = r1[Math.min(BINS - 1, Math.floor(((((th % TAU) + TAU) % TAU) / TAU) * BINS))] * rho;
    const [bx, by] = mapForward(rb * Math.cos(th), rb * Math.sin(th));
    const bxp = half + bx * sc;
    const byp = half + by * sc;
    const size = (2.3 + 3.0 * rng() * rng() + 1.0 * rng()) * scale * (k === 0 ? 1.15 : 1);
    const stretch = 0.45 + 0.55 * rng(); // elongated blisters
    const rot = rng() * Math.PI;
    const strength = 0.7 + 0.3 * rng();
    addBlister(bxp, byp, size, size * stretch, rot, strength);
    const satellites = size > 4 * scale ? Math.floor(rng() * 3) : 0;
    for (let s = 0; s < satellites; s += 1) {
      const sa = rng() * TAU;
      const sd = size * (1.3 + 0.8 * rng());
      addBlister(bxp + Math.cos(sa) * sd, byp + Math.sin(sa) * sd, size * (0.22 + 0.2 * rng()), size * (0.18 + 0.2 * rng()), rng() * Math.PI, 0.6 + 0.3 * rng());
    }
  }
  return { grid: N, archetype: boundary.archetype, lutH, lutT, tongue, bin0, binFrac, qr, noiseLow, noiseHigh, blister, blisterRim, blisterCount, solidity: boundary.solidity, aspect: boundary.aspect };
}

// --- melt -> shape (the same for every pool) ----------------------------------------------------------------------------------------------

/**
 * Radius scale of the pool at `melt` (0 raw lump .. 1 finished). Growth is in AREA (isotropic): the radius is the square root of an area that
 * rises from `CHEESE_POOL_RAW_AREA` to 1, so the pool spreads out rather than being stretched sideways. Unless `reducedMotion`, a small transient
 * overshoot (about +4.5 % radius mid-melt) settles back by melt 1.
 */
export function cheesePoolRadiusScale(melt: number, reducedMotion = false): number {
  const m = clamp01(melt);
  const e = m * m * (3 - 2 * m);
  const base = Math.sqrt(lerp(CHEESE_POOL_RAW_AREA, 1, e));
  return reducedMotion ? base : base * (1 + 0.045 * Math.sin(Math.PI * Math.pow(m, 1.8)));
}

// --- rendering -----------------------------------------------------------------------------------------------------------------------------

const CORE = [238, 234, 218] as const; // matte creamy white
const RIM = [226, 216, 192] as const; // the warmer, slightly darker rim just inside the edge
const RAW = [246, 242, 226] as const; // a raw lump is a little whiter
const AMBER = [222, 160, 84] as const; // blister fill
const AMBER_RIM = [196, 124, 58] as const; // the darker rim of a blister
const BROWN = [122, 74, 42] as const;
const SCORCH = [156, 130, 104] as const; // overall tint of overbaked cheese

interface Scratch {
  height: Float32Array;
  lit: Float32Array;
  tmp: Float32Array;
  rho: Float32Array;
  lut: Float32Array;
}
const scratch = new Map<number, Scratch>();
function scratchFor(N: number): Scratch {
  let s = scratch.get(N);
  if (!s) {
    s = { height: new Float32Array(N * N), lit: new Float32Array(N * N), tmp: new Float32Array(N * N), rho: new Float32Array(N * N), lut: new Float32Array(BINS + 1) };
    scratch.set(N, s);
  }
  return s;
}

/** separable box blur, twice (a cheap smooth): the lit height only, so the shading has no creases where the outline bends. 5 taps at 96, 3 at 64. */
function boxBlurTwice(src: Float32Array, N: number, s: Scratch): Float32Array {
  const r = N >= 96 ? 2 : 1;
  const taps = 2 * r + 1;
  let from = src;
  const dst = s.lit;
  const tmp = s.tmp;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < N; y += 1) {
      const row = y * N;
      for (let x = 0; x < N; x += 1) {
        let sum = 0;
        for (let d = -r; d <= r; d += 1) sum += from[row + Math.min(N - 1, Math.max(0, x + d))];
        tmp[row + x] = sum / taps;
      }
    }
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        let sum = 0;
        for (let d = -r; d <= r; d += 1) sum += tmp[Math.min(N - 1, Math.max(0, y + d)) * N + x];
        dst[y * N + x] = sum / taps;
      }
    }
    from = dst;
  }
  return dst;
}

/**
 * One baked mozzarella pool (96 x 96 by default, 64 x 64 with `options.grid`; straight RGBA). `seed` fixes the shape (the same seed always gives the
 * same pixels); `melt` 0..1 is how far the lump has spread, `toast` 0..1 the golden browning, `char` 0..1 how burnt it is (the same three scalars as
 * `cheeseMeltLook`). `target` may be passed to reuse a buffer. Pure and deterministic.
 */
export function renderCheesePool(
  seed: string | number,
  melt: number,
  toast: number,
  char: number,
  options: CheesePoolOptions = {},
  target?: CheesePoolImage,
): CheesePoolImage {
  const grid = gridOf(options);
  return renderWithGeometry(getCheesePoolGeometry(seed, grid), melt, toast, char, options, target);
}

function renderWithGeometry(geo: CheesePoolGeometry, melt: number, toast: number, char: number, options: CheesePoolOptions, target?: CheesePoolImage): CheesePoolImage {
  const N = geo.grid;
  const out = target && target.width === N && target.height === N ? target : { width: N, height: N, data: new Uint8ClampedArray(N * N * 4) };
  const m = clamp01(melt);
  const toastV = clamp01(toast);
  const charV = clamp01(char);
  const rs = cheesePoolRadiusScale(m, options.reducedMotion === true);
  // the outline's irregularity grows with one curve, so the shape stays between a round lump and the finished pool at every melt (and so its
  // aspect stays between theirs: no stretching on the way)
  const complexity = smoothstep(0.1, 0.85, m);
  const s = scratchFor(N);
  const lut = s.lut;
  for (let b = 0; b <= BINS; b += 1) lut[b] = Math.max(0.3, 1 + complexity * (geo.lutH[b] + geo.lutT[b])) * rs;
  const { bin0, binFrac, qr, noiseLow, noiseHigh, blister, blisterRim } = geo;
  const height = s.height;
  const rhoMap = s.rho;
  const rawMix = 1 - smoothstep(0, 0.6, m);
  // pass 1: rho (distance in boundary units), edge coverage, thickness
  for (let i = 0; i < N * N; i += 1) {
    const b = bin0[i];
    const boundary = lut[b] + (lut[b + 1] - lut[b]) * binFrac[i];
    const rho = qr[i] / boundary;
    rhoMap[i] = rho;
    const edge = smoothstep(1.045, 0.955, rho); // crisp: ~9 % of the radius from clear to opaque
    const dome = 1 - 0.2 * Math.min(1, rho * rho);
    height[i] = edge * dome * (0.94 + 0.12 * noiseLow[i]);
  }
  const lit = boxBlurTwice(height, N, s);
  const data = out.data;
  data.fill(0);
  // light from the upper left
  const lx = -0.55;
  const ly = -0.55;
  const lz = 0.63;
  const hx = lx;
  const hy = ly;
  const hz = lz + 1; // half vector with a viewer straight above
  const hLen = Math.hypot(hx, hy, hz);
  const slope = 5 * (N / 96); // the same lit slope whatever the grid
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      const rho = rhoMap[i];
      if (rho > 1.12) continue;
      const edge = smoothstep(1.045, 0.955, rho);
      if (edge <= 0.002) continue;
      const b = bin0[i];
      const tg = geo.tongue[b] + (geo.tongue[b + 1] - geo.tongue[b]) * binFrac[i];
      // only the very tips of a tongue are translucent film (the sauce shows through); everywhere else the pool is opaque
      const thin = complexity * tg * tg * smoothstep(0.72, 1, rho) * 0.34;
      const alpha = edge * (1 - thin);
      const a8 = alpha * 255;
      if (a8 < 0.5) continue; // rounds to fully transparent: leave the pixel (and its colour) at zero
      // surface normal from the smoothed thickness map (central differences), a small broken highlight on the lit rim
      const x0 = x > 0 ? i - 1 : i;
      const x1 = x < N - 1 ? i + 1 : i;
      const y0 = y > 0 ? i - N : i;
      const y1 = y < N - 1 ? i + N : i;
      const gx = (lit[x1] - lit[x0]) * slope;
      const gy = (lit[y1] - lit[y0]) * slope;
      const nl = Math.hypot(gx, gy, 1);
      const nx = -gx / nl;
      const ny = -gy / nl;
      const nz = 1 / nl;
      const diffuse = nx * lx + ny * ly + nz * lz;
      const shade = Math.min(1.035, Math.max(0.95, 1 + 0.4 * (diffuse - lz)));
      const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen), 40) * (0.35 + 0.65 * noiseHigh[i]) * 9;
      // colour: matte cream, warmer toward the rim, a little whiter while still raw
      const rimMix = smoothstep(0.62, 1, rho) * 0.65 + thin * 0.35;
      let r = lerp(CORE[0], RIM[0], rimMix);
      let g = lerp(CORE[1], RIM[1], rimMix);
      let bl = lerp(CORE[2], RIM[2], rimMix);
      r = lerp(r, RAW[0], rawMix * 0.6);
      g = lerp(g, RAW[1], rawMix * 0.6);
      bl = lerp(bl, RAW[2], rawMix * 0.6);
      r = r * shade + spec;
      g = g * shade + spec;
      bl = bl * shade + spec * 0.9;
      // browning: amber blisters with a darker rim (toast) that turn brown when charred, and an overall scorched tint when charred
      if (toastV > 0) {
        const fill = blister[i] * toastV * (0.85 + 0.3 * noiseHigh[i]);
        const rim = blisterRim[i] * toastV;
        if (fill > 0 || rim > 0) {
          const tf = clamp01(fill) * 0.85;
          r = lerp(r, lerp(AMBER[0], BROWN[0], charV), tf);
          g = lerp(g, lerp(AMBER[1], BROWN[1], charV), tf);
          bl = lerp(bl, lerp(AMBER[2], BROWN[2], charV), tf);
          const tr = clamp01(rim) * 0.7;
          r = lerp(r, lerp(AMBER_RIM[0], BROWN[0], charV), tr);
          g = lerp(g, lerp(AMBER_RIM[1], BROWN[1], charV), tr);
          bl = lerp(bl, lerp(AMBER_RIM[2], BROWN[2], charV), tr);
        }
      }
      if (charV > 0) {
        const t = charV * 0.38;
        r = lerp(r, SCORCH[0], t) * (1 - 0.25 * charV);
        g = lerp(g, SCORCH[1], t) * (1 - 0.25 * charV);
        bl = lerp(bl, SCORCH[2], t) * (1 - 0.25 * charV);
      }
      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = bl;
      data[o + 3] = a8;
    }
  }
  return out;
}

// --- whole-image memo ----------------------------------------------------------------------------------------------------------------------

/** how finely melt / toast / char are quantised for the memo (melt 24 steps ~ 28 redraws per second over the sub-second melt) */
export const CHEESE_POOL_MELT_STEPS = 24;
export const CHEESE_POOL_TONE_STEPS = 8;
const IMAGE_CACHE_LIMIT = 64;
const imageCache = new Map<string, CheesePoolImage>();

/**
 * `renderCheesePool` memoised on (seed, grid, melt quantised to 24 steps, toast / char to 8, reducedMotion). The returned image is shared: do not
 * mutate it. The quantised values are what is rendered, so the same key always gives the same pixels. LRU, 64 images (~2.3 MB at 96, ~1 MB at 64).
 */
export function renderCheesePoolCached(seed: string | number, melt: number, toast: number, char: number, options: CheesePoolOptions = {}): CheesePoolImage {
  const grid = gridOf(options);
  const qm = Math.round(clamp01(melt) * CHEESE_POOL_MELT_STEPS);
  const qt = Math.round(clamp01(toast) * CHEESE_POOL_TONE_STEPS);
  const qc = Math.round(clamp01(char) * CHEESE_POOL_TONE_STEPS);
  const key = `${typeof seed === "number" ? `#${seed}` : seed}|${grid}|${qm}|${qt}|${qc}|${options.reducedMotion ? 1 : 0}`;
  const hit = imageCache.get(key);
  if (hit) {
    imageCache.delete(key);
    imageCache.set(key, hit);
    return hit;
  }
  const image = renderCheesePool(seed, qm / CHEESE_POOL_MELT_STEPS, qt / CHEESE_POOL_TONE_STEPS, qc / CHEESE_POOL_TONE_STEPS, options);
  imageCache.set(key, image);
  if (imageCache.size > IMAGE_CACHE_LIMIT) imageCache.delete(imageCache.keys().next().value as string);
  return image;
}

/** Test hook: empty both caches. */
export function clearCheesePoolCaches(): void {
  geometryCache.clear();
  imageCache.clear();
}

/**
 * Test / report internals (not part of the contract): the outline generator and its filters, so the tests can check the rejection statistics and
 * the report can draw the failure gallery (candidates the filters reject). Nothing in the game may use this.
 */
export const cheesePoolInternals = {
  makeRng,
  drawBoundary,
  chooseBoundary,
  rejectionReason: cheeseBoundaryRejection,
  /** the geometry of an arbitrary (possibly rejected) candidate outline, drawn exactly like a normal pool */
  geometryFromBoundary(boundary: Boundary, seed: string | number, grid: CheesePoolGrid = 96): CheesePoolGeometry {
    return buildGeometryFromBoundary(boundary, makeRng(`${typeof seed === "number" ? `#${seed}` : seed}|candidate`), grid);
  },
  render(geometry: CheesePoolGeometry, melt: number, toast: number, char: number, options: CheesePoolOptions = {}): CheesePoolImage {
    return renderWithGeometry(geometry, melt, toast, char, options);
  },
};
