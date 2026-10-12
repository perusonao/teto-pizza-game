/**
 * Issue #421 S1 -- `renderCheesePool`: one baked mozzarella pool as pixels. A PURE function; it reads no DOM, no game state, no clock and no
 * `Math.random`, and is not wired into the game (S2 does that). Design: docs/reports/TETO_APPETITE-APPEAL_421_Render-Method-Audit.md.
 *
 * Why this exists: every CSS prototype (M1 .. Proto4b) stayed a convex ellipse (solidity 0.95-1.0 against 0.76-0.84 in the reference photo), because
 * the CSS parts are only unions of convex ellipses. Here the outline is a star-shaped polar boundary R(theta) with low harmonics, 1-2 broad
 * "tongues" and 0-1 notch, so it has real bulges and indentations; the rest (thickness, translucency, shading, browning) is derived from that one
 * shape in a small pixel grid, the same family as the sauce display (`sauceDisplay.ts`).
 *
 * Reference numbers (the Owner's photo, measured in the audit; the photo itself is NOT in the repository), "large pools":
 *   solidity 0.76-0.84 | aspect 1.06-1.37 | edge: normalised brightness 3 px outside the boundary 0.08-0.27 (crisp) | core ~(238,234,218), matte,
 *   <= 7 % of the pixels above luminance 246 | warm (amber / brown) pixels 1-4 % | the rim just inside the edge is a little warmer and darker.
 *
 * Structure (cost): everything that does not depend on the melt is computed once per seed and cached (`getCheesePoolGeometry`: per-pixel polar
 * coordinates in the pool's own frame, value-noise maps, the browning blisters). A render only re-evaluates the radius scale, the thickness, the
 * lighting and the colour. `renderCheesePoolCached` additionally memoises whole images by (seed, quantised melt / toast / char).
 */

/** Pixels per side of the pool image. The pool is centred and uses at most ~88 % of the half-width, leaving room for the soft edge. */
export const CHEESE_POOL_GRID = 96;
/** CSS px the grid is meant to span when S2 draws it (a hint for the wiring; nothing here depends on it). */
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
}

const N = CHEESE_POOL_GRID;
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

/** smooth 2-D value noise on a (lattice x lattice) grid of random values, sampled over the pool image; 0..1 */
function noiseMap(rng: () => number, lattice: number): Float32Array {
  const size = lattice + 2;
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i += 1) g[i] = rng();
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const fx = (x / (N - 1)) * lattice;
      const fy = (y / (N - 1)) * lattice;
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
      out[y * N + x] = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
  }
  return out;
}

// --- per-seed geometry (cached) ------------------------------------------------------------------------------------------------------------

export interface CheesePoolGeometry {
  /** harmonic part of the boundary (theta bins); multiplied by the melt's complexity */
  lutH: Float32Array;
  /** tongue + notch part of the boundary (theta bins); multiplied by the melt's tongue growth */
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
  /** per pixel browning blister weight 0..1 (1-3 irregular blisters, favouring the thin tongues) and how many there are */
  blister: Float32Array;
  blisterCount: number;
  /** the aspect ratio the seed targets at melt 1 (informational; tests check what is rendered) */
  targetAspect: number;
}

const GEOMETRY_CACHE_LIMIT = 48;
const geometryCache = new Map<string, CheesePoolGeometry>();

/** Everything about a pool that does not depend on melt / toast / char. Cached per seed (LRU, 48 seeds). */
export function getCheesePoolGeometry(seed: string | number): CheesePoolGeometry {
  const key = typeof seed === "number" ? `#${seed}` : seed;
  const hit = geometryCache.get(key);
  if (hit) {
    geometryCache.delete(key);
    geometryCache.set(key, hit); // most recently used
    return hit;
  }
  const geometry = buildGeometry(seed);
  geometryCache.set(key, geometry);
  if (geometryCache.size > GEOMETRY_CACHE_LIMIT) geometryCache.delete(geometryCache.keys().next().value as string);
  return geometry;
}

interface Boundary {
  lutH: Float32Array;
  lutT: Float32Array;
  tongue: Float32Array;
  tongueAngles: number[];
  r1: Float32Array;
  cx: number;
  cy: number;
  /** aspect ratio of the finished shape (sqrt of the covariance eigenvalue ratio) */
  aspect: number;
  /** direction of the major axis */
  phi: number;
}

/** One random boundary R(theta) = 1 + harmonics + tongues + notch (consumes `rng`) and the moments of the finished shape. */
function drawBoundary(rng: () => number): Boundary {
  const harmonicAmp = [0.27, 0.2, 0.1, 0.06];
  const harmonicPhase: number[] = [];
  const harmonicScale: number[] = [];
  for (let k = 0; k < harmonicAmp.length; k += 1) {
    harmonicPhase.push(rng() * TAU);
    harmonicScale.push(0.65 + 0.7 * rng());
  }
  const tongueCount = rng() < 0.4 ? 1 : 2;
  const tongueAngles: number[] = [];
  const tongueAmp: number[] = [];
  const tongueWidth: number[] = [];
  let a0 = rng() * TAU;
  for (let t = 0; t < tongueCount; t += 1) {
    tongueAngles.push(a0);
    tongueAmp.push(0.44 + 0.22 * rng());
    tongueWidth.push(0.32 + 0.16 * rng());
    a0 += 2.2 + 1.6 * rng(); // the next tongue lies well away from this one
  }
  const hasNotch = rng() < 0.9;
  const notchAngle = tongueAngles[0] + Math.PI * (0.55 + 0.9 * rng());
  const notchAmp = 0.28 + 0.16 * rng();
  const notchWidth = 0.3 + 0.14 * rng();
  const angDiff = (a: number, b: number) => {
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };
  const lutH = new Float32Array(BINS + 1);
  const lutT = new Float32Array(BINS + 1);
  const tongue = new Float32Array(BINS + 1);
  for (let b = 0; b <= BINS; b += 1) {
    const th = ((b % BINS) / BINS) * TAU;
    let h = 0;
    for (let k = 0; k < harmonicAmp.length; k += 1) h += harmonicAmp[k] * harmonicScale[k] * Math.cos((k + 2) * th + harmonicPhase[k]);
    let tt = 0;
    let tg = 0;
    for (let t = 0; t < tongueCount; t += 1) {
      const d = angDiff(th, tongueAngles[t]);
      const g = Math.exp(-(d * d) / (2 * tongueWidth[t] * tongueWidth[t]));
      tt += tongueAmp[t] * g;
      tg = Math.max(tg, g);
    }
    if (hasNotch) {
      const d = angDiff(th, notchAngle);
      tt -= notchAmp * Math.exp(-(d * d) / (2 * notchWidth * notchWidth));
    }
    lutH[b] = h;
    lutT[b] = tt;
    tongue[b] = tg;
  }
  // moments of the finished shape (melt 1): R1(theta) = 1 + lutH + lutT, clamped
  const r1 = new Float32Array(BINS);
  for (let b = 0; b < BINS; b += 1) r1[b] = Math.max(0.4, 1 + lutH[b] + lutT[b]);
  const dTh = TAU / BINS;
  let area = 0;
  let mx = 0;
  let my = 0;
  let ixx = 0;
  let iyy = 0;
  let ixy = 0;
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
  }
  const cx = mx / area;
  const cy = my / area;
  const sxx = ixx / area - cx * cx;
  const syy = iyy / area - cy * cy;
  const sxy = ixy / area - cx * cy;
  const mean = (sxx + syy) / 2;
  const diff = Math.hypot((sxx - syy) / 2, sxy);
  return { lutH, lutT, tongue, tongueAngles, r1, cx, cy, aspect: Math.sqrt((mean + diff) / Math.max(1e-6, mean - diff)), phi: 0.5 * Math.atan2(2 * sxy, sxx - syy) };
}

/** the finished pool's aspect is accepted in this band (the photo's large pools: 1.06 - 1.37) */
const ASPECT_MIN = 1.07;
const ASPECT_MAX = 1.34;

function buildGeometry(seed: string | number): CheesePoolGeometry {
  const rng = makeRng(seed);
  // The outline is drawn until its own aspect ratio lies in the photo's band (rejection sampling on the seed's stream, so it is deterministic);
  // that way no stretching is needed, and the round raw lump and the finished pool both keep a natural aspect. If 24 draws all miss (rare), the
  // last one is stretched along its major axis into the band.
  let boundary = drawBoundary(rng);
  for (let attempt = 1; attempt < 24 && (boundary.aspect < ASPECT_MIN || boundary.aspect > ASPECT_MAX); attempt += 1) boundary = drawBoundary(rng);
  const { lutH, lutT, tongue, tongueAngles, r1, cx, cy, phi } = boundary;
  const targetAspect = Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, boundary.aspect));
  const g = targetAspect / boundary.aspect; // 1 when accepted
  const cphi = Math.cos(phi);
  const sphi = Math.sin(phi);
  // pixel p (relative to the image centre) <- p = sc * M (q - c),  M = Rot(phi) diag(g, 1) Rot(-phi)  =>  q = c + M^-1 p / sc
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
  const noiseLow = noiseMap(rng, 6);
  const noiseHigh = noiseMap(rng, 17);
  // browning blisters (centres in the shape frame, scaled the same way); the first one sits on a tongue, where the film is thin
  const blister = new Float32Array(N * N);
  const blisterCount = 1 + Math.floor(rng() * 3); // 1..3
  for (let k = 0; k < blisterCount; k += 1) {
    const th = k === 0 ? tongueAngles[0] + (rng() - 0.5) * 0.7 : rng() * TAU;
    const rho = k === 0 ? 0.55 + 0.25 * rng() : 0.25 + 0.5 * rng();
    const rb = r1[Math.min(BINS - 1, Math.floor((((th % TAU) + TAU) % TAU) / TAU * BINS))] * rho;
    const [bx, by] = mapForward(rb * Math.cos(th), rb * Math.sin(th));
    const bxp = half + bx * sc;
    const byp = half + by * sc;
    const radius = (3.6 + 2.6 * rng()) * (N / 96) * (k === 0 ? 1.15 : 1);
    const strength = 0.75 + 0.25 * rng();
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const i = y * N + x;
        // an irregular blister: the distance is warped by the high-frequency noise
        const d = Math.hypot(x + 0.5 - bxp, y + 0.5 - byp) * (0.55 + 1.0 * noiseHigh[i]);
        const halo = (1 - smoothstep(radius * 0.5, radius * 1.7, d)) * 0.45;
        const core = 1 - smoothstep(radius * 0.25, radius * 0.9, d);
        const w = Math.max(halo, core) * strength;
        if (w > blister[i]) blister[i] = w;
      }
    }
  }
  return { lutH, lutT, tongue, bin0, binFrac, qr, noiseLow, noiseHigh, blister, blisterCount, targetAspect };
}

/** separable 5-tap box blur, twice (a cheap smooth): the lit height only, so the shading has no creases where the outline bends */
function boxBlurTwice(src: Float32Array): Float32Array {
  const tmp = new Float32Array(N * N);
  const dst = new Float32Array(N * N);
  let from = src;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        let sum = 0;
        for (let d = -2; d <= 2; d += 1) sum += from[y * N + Math.min(N - 1, Math.max(0, x + d))];
        tmp[y * N + x] = sum / 5;
      }
    }
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        let sum = 0;
        for (let d = -2; d <= 2; d += 1) sum += tmp[Math.min(N - 1, Math.max(0, y + d)) * N + x];
        dst[y * N + x] = sum / 5;
      }
    }
    from = dst;
  }
  return dst;
}

// --- melt -> shape (the same for every pool) ----------------------------------------------------------------------------------------------

/**
 * Radius scale of the pool at `melt` (0 raw lump .. 1 finished). Growth is in AREA (isotropic): the radius is the square root of an area that
 * rises from `CHEESE_POOL_RAW_AREA` to 1, so the pool spreads out rather than being stretched sideways. Unless `reducedMotion`, a small transient
 * overshoot (about +4 % radius mid-melt) settles back by melt 1.
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
const AMBER = [214, 148, 70] as const;
const BROWN = [122, 74, 42] as const;
const SCORCH = [156, 130, 104] as const; // overall tint of overbaked cheese

/**
 * One baked mozzarella pool (96 x 96, straight RGBA). `seed` fixes the shape (the same seed always gives the same pixels); `melt` 0..1 is how far
 * the lump has spread, `toast` 0..1 the golden browning, `char` 0..1 how burnt it is (the same three scalars as `cheeseMeltLook`).
 * `target` may be passed to reuse a buffer. Pure and deterministic.
 */
export function renderCheesePool(
  seed: string | number,
  melt: number,
  toast: number,
  char: number,
  options: CheesePoolOptions = {},
  target?: CheesePoolImage,
): CheesePoolImage {
  const geo = getCheesePoolGeometry(seed);
  const out = target && target.width === N && target.height === N ? target : { width: N, height: N, data: new Uint8ClampedArray(N * N * 4) };
  const m = clamp01(melt);
  const toastV = clamp01(toast);
  const charV = clamp01(char);
  const rs = cheesePoolRadiusScale(m, options.reducedMotion === true);
  // the outline's irregularity (harmonics, tongues and notch alike) grows with one curve, so the shape stays between a round lump and the
  // finished pool at every melt (and so its aspect stays between theirs: no stretching on the way)
  const complexity = smoothstep(0.1, 0.85, m);
  const tongueGrowth = complexity;
  // the boundary at this melt, per theta bin (radius in pixels of the melt-1 frame)
  const lut = new Float32Array(BINS + 1);
  for (let b = 0; b <= BINS; b += 1) lut[b] = Math.max(0.3, 1 + complexity * geo.lutH[b] + tongueGrowth * geo.lutT[b]) * rs;
  const { bin0, binFrac, qr, noiseLow, noiseHigh, blister } = geo;
  const height = new Float32Array(N * N);
  const rhoMap = new Float32Array(N * N);
  const rawMix = 1 - smoothstep(0, 0.6, m);
  // pass 1: rho (distance in boundary units), edge coverage, thickness
  for (let i = 0; i < N * N; i += 1) {
    const b = bin0[i];
    const boundary = lut[b] + (lut[b + 1] - lut[b]) * binFrac[i];
    const rho = qr[i] / boundary;
    rhoMap[i] = rho;
    const edge = smoothstep(1.035, 0.965, rho); // crisp: ~3.5 % of the radius from 0 to 1
    const dome = 1 - 0.2 * Math.min(1, rho * rho);
    height[i] = edge * dome * (0.94 + 0.12 * noiseLow[i]);
  }
  const lit = boxBlurTwice(height);
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
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      const rho = rhoMap[i];
      if (rho > 1.12) continue;
      const edge = smoothstep(1.035, 0.965, rho);
      if (edge <= 0.002) continue;
      const b = bin0[i];
      const tg = geo.tongue[b] + (geo.tongue[b + 1] - geo.tongue[b]) * binFrac[i];
      // thin tongue tips are translucent (the sauce shows through), everywhere else the pool is opaque
      const thin = tongueGrowth * tg * tg * smoothstep(0.55, 1, rho) * 0.5;
      const alpha = edge * (1 - thin);
      // surface normal from the thickness map (central differences), a small broken highlight on the lit rim
      const x0 = x > 0 ? i - 1 : i;
      const x1 = x < N - 1 ? i + 1 : i;
      const y0 = y > 0 ? i - N : i;
      const y1 = y < N - 1 ? i + N : i;
      const gx = (lit[x1] - lit[x0]) * 5;
      const gy = (lit[y1] - lit[y0]) * 5;
      const nl = Math.hypot(gx, gy, 1);
      const nx = -gx / nl;
      const ny = -gy / nl;
      const nz = 1 / nl;
      const diffuse = nx * lx + ny * ly + nz * lz;
      const flat = lz;
      const shade = Math.min(1.035, Math.max(0.94, 1 + 0.4 * (diffuse - flat)));
      const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen), 40) * (0.35 + 0.65 * noiseHigh[i]) * 9;
      // colour: matte cream, warmer toward the rim and where the film is thin, a little whiter while still raw
      const rimMix = smoothstep(0.6, 1, rho) * 0.85 + thin * 0.5;
      let r = lerp(CORE[0], RIM[0], rimMix);
      let g = lerp(CORE[1], RIM[1], rimMix);
      let bl = lerp(CORE[2], RIM[2], rimMix);
      r = lerp(r, RAW[0], rawMix * 0.6);
      g = lerp(g, RAW[1], rawMix * 0.6);
      bl = lerp(bl, RAW[2], rawMix * 0.6);
      r = r * shade + spec;
      g = g * shade + spec;
      bl = bl * shade + spec * 0.9;
      // browning: amber blisters (toast) that darken to brown when charred, and an overall scorched tint when charred
      const bw = blister[i] * toastV * (0.8 + 0.4 * noiseHigh[i]);
      if (bw > 0) {
        const t = clamp01(bw) * 0.9;
        r = lerp(r, lerp(AMBER[0], BROWN[0], charV), t);
        g = lerp(g, lerp(AMBER[1], BROWN[1], charV), t);
        bl = lerp(bl, lerp(AMBER[2], BROWN[2], charV), t);
      }
      if (charV > 0) {
        const t = charV * 0.38;
        r = lerp(r, SCORCH[0], t) * (1 - 0.25 * charV);
        g = lerp(g, SCORCH[1], t) * (1 - 0.25 * charV);
        bl = lerp(bl, SCORCH[2], t) * (1 - 0.25 * charV);
      }
      const a8 = alpha * 255;
      if (a8 < 0.5) continue; // rounds to fully transparent: leave the pixel (and its colour) at zero
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
 * `renderCheesePool` memoised on (seed, melt quantised to 24 steps, toast / char to 8, reducedMotion). The returned image is shared: do not
 * mutate it. The quantised values are what is rendered, so the same key always gives the same pixels. LRU, 64 images (~2.3 MB).
 */
export function renderCheesePoolCached(seed: string | number, melt: number, toast: number, char: number, options: CheesePoolOptions = {}): CheesePoolImage {
  const qm = Math.round(clamp01(melt) * CHEESE_POOL_MELT_STEPS);
  const qt = Math.round(clamp01(toast) * CHEESE_POOL_TONE_STEPS);
  const qc = Math.round(clamp01(char) * CHEESE_POOL_TONE_STEPS);
  const key = `${typeof seed === "number" ? `#${seed}` : seed}|${qm}|${qt}|${qc}|${options.reducedMotion ? 1 : 0}`;
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
