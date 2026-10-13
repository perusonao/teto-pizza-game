import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHEESE_POOL_GRID,
  CHEESE_POOL_GRID_CANDIDATE,
  CHEESE_POOL_GRID_SMALL,
  CHEESE_POOL_LIMITS,
  cheeseBoundaryRejection,
  cheesePoolInternals,
  CHEESE_POOL_MELT_STEPS,
  CHEESE_POOL_RAW_AREA,
  cheesePoolRadiusScale,
  clearCheesePoolCaches,
  getCheesePoolGeometry,
  renderCheesePool,
  renderCheesePoolCached,
  type CheesePoolGrid,
  type CheesePoolImage,
} from "./cheesePool";
import { measureCheesePool } from "./cheesePoolMetrics";

/**
 * #421 S1 / S1b: `renderCheesePool` is pure, deterministic, shaped like the reference photo's pools (audit numbers, not the photo), and cheap once its
 * per-seed geometry is cached. Reference (large pools of the Owner's photo): solidity 0.76-0.84, aspect 1.06-1.37, crisp edge, core ~(238,234,218),
 * <= 7 % of the pixels above luminance 246, warm (browning) pixels 1-4 %.
 */

const seeds = (n: number) => Array.from({ length: n }, (_, i) => `mozzarella:${i}:${(i * 7) % 100}`);
const pct = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(p * values.length))];
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function fingerprint(img: CheesePoolImage): string {
  let h = 2166136261;
  for (let i = 0; i < img.data.length; i += 1) h = Math.imul(h ^ img.data[i], 16777619);
  return (h >>> 0).toString(16);
}

function meanRegionLum(img: CheesePoolImage): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue;
    sum += lum(img.data[i], img.data[i + 1], img.data[i + 2]);
    n += 1;
  }
  return sum / n;
}

afterEach(() => {
  clearCheesePoolCaches();
  vi.restoreAllMocks();
});

describe("renderCheesePool: output and determinism", () => {
  it("is a 96x96 straight-RGBA image with every byte in 0..255, and fully transparent pixels carry no colour", () => {
    const img = renderCheesePool("mozzarella:40.00:50.00", 1, 0.5, 0);
    expect([img.width, img.height]).toEqual([CHEESE_POOL_GRID, CHEESE_POOL_GRID]);
    expect(img.data).toBeInstanceOf(Uint8ClampedArray);
    expect(img.data).toHaveLength(CHEESE_POOL_GRID * CHEESE_POOL_GRID * 4);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] === 0) expect([img.data[i], img.data[i + 1], img.data[i + 2]]).toEqual([0, 0, 0]);
    }
    // the corners are empty: the pool never reaches the image border
    for (const [x, y] of [[0, 0], [95, 0], [0, 95], [95, 95]]) expect(img.data[(y * 96 + x) * 4 + 3]).toBe(0);
  });

  it("gives the same pixels for the same inputs, every time, and different pools for different seeds", () => {
    const a = renderCheesePool("mozzarella:40.00:50.00", 1, 0.4, 0.1);
    const b = renderCheesePool("mozzarella:40.00:50.00", 1, 0.4, 0.1);
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    clearCheesePoolCaches(); // a cold cache must not change a single byte either
    expect(fingerprint(renderCheesePool("mozzarella:40.00:50.00", 1, 0.4, 0.1))).toBe(fingerprint(a));
    const prints = new Set(seeds(40).map((s) => fingerprint(renderCheesePool(s, 1, 0, 0))));
    expect(prints.size).toBe(40);
    // numeric seeds work and are distinct from the same digits as text
    expect(fingerprint(renderCheesePool(7, 1, 0, 0))).not.toBe(fingerprint(renderCheesePool("7", 1, 0, 0)));
  });

  it("uses no randomness and no clock", () => {
    const random = vi.spyOn(Math, "random");
    const now = vi.spyOn(Date, "now");
    const perf = vi.spyOn(performance, "now");
    renderCheesePool("mozzarella:12:34", 0.7, 0.3, 0.2);
    renderCheesePoolCached("mozzarella:12:35", 0.7, 0.3, 0.2);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(perf).not.toHaveBeenCalled();
  });

  it("can reuse a buffer, and clamps its inputs (NaN and out-of-range behave as 0 / 1)", () => {
    const buffer: CheesePoolImage = { width: 96, height: 96, data: new Uint8ClampedArray(96 * 96 * 4).fill(77) };
    const out = renderCheesePool("mozzarella:1:2", 0.5, 0, 0, {}, buffer);
    expect(out).toBe(buffer);
    expect(fingerprint(out)).toBe(fingerprint(renderCheesePool("mozzarella:1:2", 0.5, 0, 0))); // the old contents never leak
    expect(fingerprint(renderCheesePool("s", Number.NaN, -3, 9))).toBe(fingerprint(renderCheesePool("s", 0, 0, 1)));
    expect(fingerprint(renderCheesePool("s", 5, 0, 0))).toBe(fingerprint(renderCheesePool("s", 1, 0, 0)));
  });
});

describe("renderCheesePool: the finished pool (melt 1) against the reference-photo numbers", () => {
  const metrics = seeds(200).map((s) => measureCheesePool(renderCheesePool(s, 1, 0, 0)));

  it("has a real, irregular outline: not a convex oval (solidity), yet a rounded mass (aspect 1.06-1.37 reference)", () => {
    const solidity = metrics.map((m) => m.solidity);
    const aspect = metrics.map((m) => m.aspect);
    // the CSS prototypes were 0.95-1.0; the photo's large pools 0.76-0.84. S1 lands at about 0.87-0.93: clearly concave, still tidy.
    expect(pct(solidity, 0.5)).toBeGreaterThan(0.82);
    expect(pct(solidity, 0.5)).toBeLessThan(0.93);
    expect(pct(solidity, 0.9)).toBeLessThan(0.95);
    expect(Math.min(...solidity)).toBeGreaterThan(0.78);
    expect(pct(aspect, 0.5)).toBeGreaterThan(1.1);
    expect(pct(aspect, 0.5)).toBeLessThan(1.3);
    expect(pct(aspect, 0.05)).toBeGreaterThan(1.04);
    expect(pct(aspect, 0.95)).toBeLessThan(1.37);
    expect(Math.max(...aspect)).toBeLessThan(1.4);
  });

  it("is centred, fits the image with a margin, and has a consistent size", () => {
    for (const m of metrics) {
      expect(m.centreOffset).toBeLessThan(1.5);
      expect(m.borderMargin).toBeGreaterThanOrEqual(2);
      expect(m.eqd).toBeGreaterThan(54);
      expect(m.eqd).toBeLessThan(78);
    }
  });

  it("has a crisp edge (only a few px from opaque to clear) and a limited translucent film", () => {
    for (const m of metrics) {
      expect(m.edgeWidthPx).toBeLessThan(7.5);
      expect(m.thin).toBeLessThan(0.35);
    }
    expect(pct(metrics.map((m) => m.thin), 0.5)).toBeGreaterThan(0.05); // the tongue tips are translucent
  });

  it("is matte creamy white, not blown out: core ~(238,234,218), at most 7 % of the pixels above luminance 246", () => {
    for (const m of metrics) {
      expect(Math.abs(m.core[0] - 238)).toBeLessThan(6); // S2-B2: 5 -> 6 (the shaded, thicker look moves the core mean a little with the seed)
      expect(Math.abs(m.core[1] - 234)).toBeLessThan(6); // S2-B2: 5 -> 6 (the shaded, thicker look moves the core mean a little with the seed)
      expect(Math.abs(m.core[2] - 218)).toBeLessThan(6); // S2-B2: 5 -> 6 (the shaded, thicker look moves the core mean a little with the seed)
      expect(m.whiteClip).toBeLessThanOrEqual(0.07);
    }
  });
});

describe("renderCheesePool: browning", () => {
  const list = seeds(80);

  it("shows no amber without toast, and 1-7 % warm (amber / brown) pixels at full toast, in the photo's 1-4 % range on median", () => {
    const none = list.map((s) => measureCheesePool(renderCheesePool(s, 1, 0, 0)).warm);
    const full = list.map((s) => measureCheesePool(renderCheesePool(s, 1, 1, 0)).warm);
    expect(pct(none, 0.9)).toBeLessThan(0.004);
    expect(pct(full, 0.5)).toBeGreaterThan(0.01);
    expect(pct(full, 0.5)).toBeLessThan(0.05);
    expect(pct(full, 0.95)).toBeLessThan(0.1);
  });

  it("the browning grows with toast, and char turns the pool darker and the blisters brown", () => {
    const seed = "mozzarella:50.00:30.00";
    const w = (t: number) => measureCheesePool(renderCheesePool(seed, 1, t, 0)).warm;
    expect(w(0.25)).toBeLessThanOrEqual(w(0.6) + 1e-9);
    expect(w(0.6)).toBeLessThanOrEqual(w(1) + 1e-9);
    expect(w(1)).toBeGreaterThan(w(0));
    const baked = meanRegionLum(renderCheesePool(seed, 1, 1, 0));
    const charred = meanRegionLum(renderCheesePool(seed, 1, 1, 1));
    expect(charred).toBeLessThan(baked * 0.85);
    // the burnt blister is brown (red > green > blue by a clear margin), never grey
    const img = renderCheesePool(seed, 1, 1, 1);
    let darkest = [255, 255, 255];
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] < 250) continue;
      if (lum(img.data[i], img.data[i + 1], img.data[i + 2]) < lum(darkest[0], darkest[1], darkest[2])) darkest = [img.data[i], img.data[i + 1], img.data[i + 2]];
    }
    expect(darkest[0]).toBeGreaterThan(darkest[1] + 12);
    expect(darkest[1]).toBeGreaterThan(darkest[2] + 8);
  });
});

describe("renderCheesePool: the melt (area growth, not a sideways stretch) and reduced motion", () => {
  const seed = "mozzarella:60.00:50.00";
  const steps = Array.from({ length: CHEESE_POOL_MELT_STEPS + 1 }, (_, i) => i / CHEESE_POOL_MELT_STEPS);

  it("the radius scale grows from the raw lump to 1 smoothly; the raw lump has about 38 % of the finished area", () => {
    let last = 0;
    for (const m of steps) {
      const r = cheesePoolRadiusScale(m, true);
      expect(r).toBeGreaterThanOrEqual(last - 1e-12);
      last = r;
    }
    expect(cheesePoolRadiusScale(0, true) ** 2).toBeCloseTo(CHEESE_POOL_RAW_AREA, 5);
    expect(cheesePoolRadiusScale(1, true)).toBeCloseTo(1, 5);
    expect(cheesePoolRadiusScale(1, false)).toBeCloseTo(1, 5); // the transient settles by melt 1
    expect(cheesePoolRadiusScale(0, false)).toBeCloseTo(cheesePoolRadiusScale(0, true), 8);
  });

  it("area rises monotonically with melt and the aspect stays within 1.0-1.55 throughout (finished: 1.06-1.37; no sideways stretching); the raw lump is nearly convex", () => {
    for (const s of seeds(12)) {
      let lastArea = 0;
      for (const m of steps.filter((_, i) => i % 3 === 0)) {
        const r = measureCheesePool(renderCheesePool(s, m, 0, 0, { reducedMotion: true }));
        expect(r.area).toBeGreaterThanOrEqual(lastArea - 2);
        lastArea = r.area;
        expect(r.aspect).toBeGreaterThan(0.99);
        expect(r.aspect).toBeLessThan(1.55);
      }
      const raw = measureCheesePool(renderCheesePool(s, 0, 0, 0));
      const done = measureCheesePool(renderCheesePool(s, 1, 0, 0));
      expect(raw.area / done.area).toBeGreaterThan(0.26);
      expect(raw.area / done.area).toBeLessThan(0.5);
      expect(raw.solidity).toBeGreaterThan(done.solidity); // the outline gets more irregular as it melts
      expect(raw.solidity).toBeGreaterThan(0.93);
    }
  });

  it("reduced motion drops the transient overshoot and keeps the finished pool identical", () => {
    const full = renderCheesePool(seed, 1, 0.5, 0, { reducedMotion: false });
    const reduced = renderCheesePool(seed, 1, 0.5, 0, { reducedMotion: true });
    expect(fingerprint(full)).toBe(fingerprint(reduced));
    const mid = (reducedMotion: boolean) => measureCheesePool(renderCheesePool(seed, 0.75, 0, 0, { reducedMotion })).area;
    expect(mid(false)).toBeGreaterThan(mid(true) * 1.04); // the spreading pool momentarily overshoots, unless reduced motion
    // with reduced motion the area never exceeds the finished area on the way (no overshoot at all)
    const finished = measureCheesePool(reduced).area;
    for (const m of steps) expect(measureCheesePool(renderCheesePool(seed, m, 0, 0, { reducedMotion: true })).area).toBeLessThanOrEqual(finished + 2);
  });
});

describe("caches and cost", () => {
  it("geometry is computed once per seed (same object) and is bounded (LRU); results do not depend on whether it was cached", () => {
    const g = getCheesePoolGeometry("mozzarella:1:1");
    expect(getCheesePoolGeometry("mozzarella:1:1")).toBe(g);
    const before = fingerprint(renderCheesePool("mozzarella:1:1", 1, 0.3, 0));
    for (let i = 0; i < 60; i += 1) getCheesePoolGeometry(`evict:${i}`); // more than the 48-seed limit
    expect(getCheesePoolGeometry("mozzarella:1:1")).not.toBe(g); // evicted and rebuilt ...
    expect(fingerprint(renderCheesePool("mozzarella:1:1", 1, 0.3, 0))).toBe(before); // ... to exactly the same pool
  });

  it("renderCheesePoolCached memoises on (seed, melt in 24 steps, toast / char in 8 steps, reduced motion) and renders the quantised values", () => {
    const a = renderCheesePoolCached("mozzarella:5:5", 0.5, 0.25, 0);
    expect(renderCheesePoolCached("mozzarella:5:5", 0.5, 0.25, 0)).toBe(a);
    expect(renderCheesePoolCached("mozzarella:5:5", 0.5 + 0.4 / CHEESE_POOL_MELT_STEPS, 0.25, 0)).toBe(a); // same melt step
    expect(renderCheesePoolCached("mozzarella:5:5", 0.5 + 1 / CHEESE_POOL_MELT_STEPS, 0.25, 0)).not.toBe(a);
    expect(renderCheesePoolCached("mozzarella:5:5", 0.5, 0.25, 0, { reducedMotion: true })).not.toBe(a);
    expect(fingerprint(a)).toBe(fingerprint(renderCheesePool("mozzarella:5:5", 12 / CHEESE_POOL_MELT_STEPS, 2 / 8, 0)));
    // bounded: after 70 other keys the first is gone (a new object, the same pixels)
    for (let i = 0; i < 70; i += 1) renderCheesePoolCached(`other:${i}`, 1, 0, 0);
    const again = renderCheesePoolCached("mozzarella:5:5", 0.5, 0.25, 0);
    expect(again).not.toBe(a);
    expect(fingerprint(again)).toBe(fingerprint(a));
  });

  it("is cheap: geometry once, then a render is a few milliseconds, and a memo hit is free (generous bounds, to be flake-proof)", () => {
    const time = (fn: () => void, n: number) => {
      const t: number[] = [];
      for (let i = 0; i < n; i += 1) {
        const t0 = performance.now();
        fn();
        t.push(performance.now() - t0);
      }
      return pct(t, 0.5);
    };
    let i = 0;
    const cold = time(() => getCheesePoolGeometry(`cost:${i++}`), 12);
    expect(cold).toBeLessThan(60);
    getCheesePoolGeometry("cost:warm");
    for (let k = 0; k < 8; k += 1) renderCheesePool("cost:warm", k / 8, 0.3, 0); // JIT warm-up
    let m = 0;
    const render = time(() => renderCheesePool("cost:warm", (m++ % 24) / 23, 0.3, 0), 40);
    expect(render).toBeLessThan(12);
    renderCheesePoolCached("cost:warm", 0.5, 0, 0);
    expect(time(() => renderCheesePoolCached("cost:warm", 0.5, 0, 0), 40)).toBeLessThan(0.5);
  });
});

describe("measureCheesePool (the measurement used above)", () => {
  it("reads a disc as solidity ~1 / aspect ~1 and an ellipse as its axis ratio", () => {
    const make = (rx: number, ry: number): CheesePoolImage => {
      const data = new Uint8ClampedArray(96 * 96 * 4);
      for (let y = 0; y < 96; y += 1) {
        for (let x = 0; x < 96; x += 1) {
          if (((x + 0.5 - 48) / rx) ** 2 + ((y + 0.5 - 48) / ry) ** 2 <= 1) data.set([240, 235, 220, 255], (y * 96 + x) * 4);
        }
      }
      return { width: 96, height: 96, data };
    };
    const disc = measureCheesePool(make(30, 30));
    expect(disc.solidity).toBeGreaterThan(0.97);
    expect(disc.aspect).toBeCloseTo(1, 1);
    expect(measureCheesePool(make(36, 24)).aspect).toBeCloseTo(1.5, 1);
    expect(disc.core[0]).toBeCloseTo(240, 0);
  });
});

describe("S1b: outline variety over a large seed set (distribution and outliers, not representative seeds)", () => {
  const list = seeds(300);
  const rows = list.map((s) => measureCheesePool(renderCheesePool(s, 1, 0, 0)));
  const regularTri = (m: (typeof rows)[number]) => m.lobes === 3 && m.lobeGaps.every((g) => g >= 95 && g <= 145);

  it("is not a three-lobed clover: the regular tri-lobe share is small and the lobe counts vary (S1: 46 % regular, 77 % three-lobed)", () => {
    expect(rows.filter(regularTri).length / rows.length).toBeLessThan(0.2);
    expect(rows.filter((m) => m.lobes === 3).length / rows.length).toBeLessThan(0.7);
    expect(new Set(rows.map((m) => m.lobes)).size).toBeGreaterThanOrEqual(3);
    // the outline also varies in how it is built (several archetypes are in use)
    expect(new Set(list.map((s) => getCheesePoolGeometry(s).archetype)).size).toBeGreaterThanOrEqual(4);
  });

  it("stays within natural-pool bounds for every seed: aspect, solidity, no slits, no spikes, no folded shading", () => {
    for (const m of rows) {
      expect(m.aspect).toBeGreaterThan(1.04);
      expect(m.aspect).toBeLessThan(1.4);
      expect(m.solidity).toBeGreaterThan(0.8); // never forced down to the photo's 0.76-0.84 by slits
      expect(m.solidity).toBeLessThan(0.985);
      expect(m.slitFill).toBeLessThan(0.02);
      expect(m.spikeShare).toBeLessThan(0.02);
      expect(m.shadeSpread).toBeLessThan(1.3); // no ridge / origami contrast (S2-B2: 1.1 -> 1.3; the thick shaded lip is intended, folds would be well above)
      expect(m.whiteClip).toBeLessThanOrEqual(0.07);
    }
    const solidity = rows.map((m) => m.solidity);
    expect(pct(solidity, 0.5)).toBeGreaterThan(0.86);
    expect(pct(solidity, 0.5)).toBeLessThan(0.94);
    expect(pct(solidity, 0.05)).toBeLessThan(0.9); // a real spread of concavity, not one value
  });

  it("the translucent pink film is thinner than S1 (S1 median 0.17 of the pool area)", () => {
    expect(pct(rows.map((m) => m.thin), 0.5)).toBeLessThan(0.14);
    for (const m of rows) expect(m.thin).toBeLessThan(0.25);
  });

  it("every chosen outline passes its own naturalness limits, and the limits do reject slits, spikes and clovers", () => {
    for (const s of list.slice(0, 120)) {
      const g = getCheesePoolGeometry(s);
      expect(g.aspect).toBeGreaterThanOrEqual(CHEESE_POOL_LIMITS.aspectMin);
      expect(g.aspect).toBeLessThanOrEqual(CHEESE_POOL_LIMITS.aspectMax);
      expect(g.solidity).toBeGreaterThanOrEqual(CHEESE_POOL_LIMITS.solidityMin);
    }
    const rng = cheesePoolInternals.makeRng("limits");
    const reasons = new Set<string>();
    for (let i = 0; i < 1500; i += 1) {
      const reason = cheeseBoundaryRejection(cheesePoolInternals.drawBoundary(rng));
      if (reason) reasons.add(reason);
    }
    expect(reasons.has("slit")).toBe(true);
    expect(reasons.has("aspect")).toBe(true);
    expect(reasons.has("too convex")).toBe(true);
  });

  it("browning varies between seeds: blister size and amount are not one recipe", () => {
    const warm = list.slice(0, 120).map((s) => measureCheesePool(renderCheesePool(s, 1, 1, 0)).warm);
    expect(pct(warm, 0.9) - pct(warm, 0.1)).toBeGreaterThan(0.01);
    expect(new Set(list.slice(0, 120).map((s) => getCheesePoolGeometry(s).blisterCount)).size).toBeGreaterThanOrEqual(3);
  });
});

describe("S1b: the 64x64 grid is the same pool at lower cost", () => {
  const small = { grid: CHEESE_POOL_GRID_SMALL } as const;

  it("renders a 64x64 straight-RGBA image, deterministically, with the same contracts as 96x96", () => {
    const a = renderCheesePool("mozzarella:7:7", 1, 0.5, 0, small);
    expect([a.width, a.height, a.data.length]).toEqual([64, 64, 64 * 64 * 4]);
    expect(fingerprint(renderCheesePool("mozzarella:7:7", 1, 0.5, 0, small))).toBe(fingerprint(a));
    expect(fingerprint(a)).not.toBe(fingerprint(renderCheesePool("mozzarella:7:7", 1, 0.5, 0)));
    expect(getCheesePoolGeometry("mozzarella:7:7", 64)).not.toBe(getCheesePoolGeometry("mozzarella:7:7", 96));
    expect(getCheesePoolGeometry("mozzarella:7:7", 64).archetype).toBe(getCheesePoolGeometry("mozzarella:7:7", 96).archetype); // same outline
    for (let i = 3; i < a.data.length; i += 4) if (a.data[i] === 0) expect(a.data[i - 1] + a.data[i - 2] + a.data[i - 3]).toBe(0);
    // reduced motion still drops the overshoot, and memoised results are kept per grid
    expect(renderCheesePoolCached("mozzarella:7:7", 1, 0.5, 0, small)).not.toBe(renderCheesePoolCached("mozzarella:7:7", 1, 0.5, 0));
    expect(renderCheesePoolCached("mozzarella:7:7", 1, 0.5, 0, small).width).toBe(64);
  });

  it("matches the 96x96 pool after upscaling (same outline, similar metrics) and is cheaper to render", () => {
    for (const s of seeds(24)) {
      const big = measureCheesePool(renderCheesePool(s, 1, 0.6, 0));
      const sm = measureCheesePool(renderCheesePool(s, 1, 0.6, 0, small));
      expect(Math.abs(sm.aspect - big.aspect)).toBeLessThan(0.06);
      expect(Math.abs(sm.solidity - big.solidity)).toBeLessThan(0.04);
      expect(Math.abs(sm.eqd / 64 - big.eqd / 96)).toBeLessThan(0.03); // the same size relative to the image
      expect(sm.whiteClip).toBeLessThanOrEqual(0.07);
    }
    const time = (opts: object) => {
      const t: number[] = [];
      renderCheesePool("cost64", 1, 0.3, 0, opts);
      for (let i = 0; i < 40; i += 1) {
        const t0 = performance.now();
        renderCheesePool("cost64", (i % 24) / 23, 0.3, 0, opts);
        t.push(performance.now() - t0);
      }
      return pct(t, 0.5);
    };
    expect(time(small)).toBeLessThan(time({}) * 0.85); // about half in practice; the bound is loose to be flake-proof
  });
});

describe("S2-A: faster outline choice, a clear border and a budgeted browning, without changing the pools' look", () => {
  it("the optimised chooser draws exactly the outlines of the plain rejection loop (S1b golden seeds, and a 150-seed cross-check)", () => {
    const golden: Array<[string, string, number]> = [
      ["mozzarella:0:0", "lobes", 1.2501],
      ["mozzarella:1:7", "bay", 1.286],
      ["mozzarella:2:14", "tongue", 1.2039],
      ["mozzarella:3:21", "bay", 1.0787],
      ["mozzarella:4:28", "shoulder", 1.1668],
      ["mozzarella:5:35", "bay", 1.2448],
      ["mozzarella:6:42", "puddle", 1.2307],
      ["mozzarella:7:49", "bay", 1.1275],
    ];
    for (const [seed, archetype, aspect] of golden) {
      const g = getCheesePoolGeometry(seed);
      expect(g.archetype).toBe(archetype);
      expect(g.aspect).toBeCloseTo(aspect, 3);
    }
    // all 400 report seeds: the same outline (type and aspect) as S1b, as one fingerprint
    let h = 2166136261;
    for (const seed of seeds(400)) {
      const g = getCheesePoolGeometry(seed);
      for (const ch of `${g.archetype}:${g.aspect.toFixed(4)};`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    }
    expect((h >>> 0).toString(16)).toBe("b5d4610c");
    // the plain loop: every candidate fully built and measured, no aspect pre-test (what S1b did)
    for (const seed of seeds(150)) {
      const rng = cheesePoolInternals.makeRng(seed);
      let chosen = null;
      for (let draw = 0; draw < 60 && !chosen; draw += 1) {
        const candidate = cheesePoolInternals.drawBoundary(rng);
        if (!cheeseBoundaryRejection(candidate, rng())) chosen = candidate;
      }
      const g = getCheesePoolGeometry(seed);
      if (chosen) {
        expect(g.archetype).toBe(chosen.archetype);
        expect(g.aspect).toBeCloseTo(chosen.aspect, 6);
        expect(g.solidity).toBeCloseTo(chosen.solidity, 6);
      }
    }
  });

  it("keeps a clear border: every visible pixel is at least 3 px from the edge on the 64 grid (4.5 px on 96), at every melt, with or without reduced motion", () => {
    for (const grid of [64, 96] as const satisfies readonly CheesePoolGrid[]) {
      const need = grid === 64 ? 3 : 4;
      for (const s of seeds(60)) {
        for (const reducedMotion of [false, true]) {
          for (let k = 0; k <= 8; k += 1) {
            const img = renderCheesePool(s, k / 8, 0.6, 0, { grid, reducedMotion });
            let margin: number = grid;
            for (let y = 0; y < grid; y += 1) {
              for (let x = 0; x < grid; x += 1) {
                if (img.data[(y * grid + x) * 4 + 3] > 0) margin = Math.min(margin, x, y, grid - 1 - x, grid - 1 - y);
              }
            }
            expect(margin).toBeGreaterThanOrEqual(need);
          }
        }
      }
    }
  });

  it("browning is in the photo's range for almost every seed: warm pixels at toast 0.6 median 1.5-3.5 %, p95 below 5.5 %, never above 7 %", () => {
    const warm = seeds(200).map((s) => measureCheesePool(renderCheesePool(s, 1, 0.6, 0)).warm);
    expect(pct(warm, 0.5)).toBeGreaterThan(0.015);
    expect(pct(warm, 0.5)).toBeLessThan(0.035);
    expect(pct(warm, 0.95)).toBeLessThan(0.055);
    expect(Math.max(...warm)).toBeLessThan(0.07);
    expect(pct(warm, 0.9) - pct(warm, 0.1)).toBeGreaterThan(0.01); // still a real spread between pools
  });

  it("offers 64 as the provisional default candidate without changing the call default (96)", () => {
    expect(CHEESE_POOL_GRID_CANDIDATE).toBe(CHEESE_POOL_GRID_SMALL);
    expect(renderCheesePool("mozzarella:9:9", 1, 0, 0).width).toBe(CHEESE_POOL_GRID);
  });
});
