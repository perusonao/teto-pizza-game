/**
 * Measurement helpers for `renderCheesePool` images (used by the unit tests and the S1 report). Pure; the definitions follow the reference-photo
 * audit (docs/reports/TETO_APPETITE-APPEAL_421_Render-Method-Audit.md): solidity = area / convex-hull area, aspect = sqrt of the covariance
 * eigenvalue ratio, edge softness = how many pixels the alpha takes to go from 10 % to 90 % at the boundary, white clip = luminance > 246.
 */
import type { CheesePoolImage } from "./cheesePool";

export interface CheesePoolMetrics {
  area: number;
  /** equivalent diameter (px) of the alpha >= 0.5 region */
  eqd: number;
  solidity: number;
  aspect: number;
  /** |centroid - image centre| in px */
  centreOffset: number;
  /** the farthest alpha > 0.02 pixel from the image border, in px (a margin check) */
  borderMargin: number;
  /** mean number of partly transparent pixels (alpha 0.1 .. 0.9) per boundary pixel: the edge's width in px */
  edgeWidthPx: number;
  /** mean straight-RGB of the opaque interior (alpha >= 0.98, 6 px inside the boundary) */
  core: [number, number, number];
  /** share of the region's pixels with luminance > 246 */
  whiteClip: number;
  /** share of the region's pixels that read as amber / brown browning (warm, and darker than the core) */
  warm: number;
  /** share of the region with alpha < 0.9 (translucent film) */
  thin: number;
}

function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hullArea(points: Array<[number, number]>): number {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let a = 0;
  for (let i = 0; i < hull.length; i += 1) {
    const [x1, y1] = hull[i];
    const [x2, y2] = hull[(i + 1) % hull.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function measureCheesePool(img: CheesePoolImage): CheesePoolMetrics {
  const { width: w, height: h, data } = img;
  const inside = new Uint8Array(w * h);
  let area = 0;
  let sx = 0;
  let sy = 0;
  let minEdgeDist = Infinity;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 5) minEdgeDist = Math.min(minEdgeDist, x, y, w - 1 - x, h - 1 - y);
      if (a >= 128) {
        inside[y * w + x] = 1;
        area += 1;
        sx += x + 0.5;
        sy += y + 0.5;
      }
    }
  }
  const cx = sx / Math.max(1, area);
  const cy = sy / Math.max(1, area);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  const boundary: Array<[number, number]> = [];
  let boundaryCount = 0;
  let partial = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const a = data[i * 4 + 3];
      if (a > 25 && a < 230) partial += 1;
      if (!inside[i]) continue;
      sxx += (x + 0.5 - cx) ** 2;
      syy += (y + 0.5 - cy) ** 2;
      sxy += (x + 0.5 - cx) * (y + 0.5 - cy);
      const isEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !inside[i - 1] || !inside[i + 1] || !inside[i - w] || !inside[i + w];
      if (isEdge) {
        boundaryCount += 1;
        boundary.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]);
      }
    }
  }
  const n = Math.max(1, area);
  const vxx = sxx / n;
  const vyy = syy / n;
  const vxy = sxy / n;
  const mean = (vxx + vyy) / 2;
  const diff = Math.hypot((vxx - vyy) / 2, vxy);
  const aspect = Math.sqrt((mean + diff) / Math.max(1e-6, mean - diff));
  const hull = hullArea(boundary);
  // interior: opaque pixels at least 6 px from any non-region pixel (cheap erosion by a square window)
  let cr = 0;
  let cg = 0;
  let cb = 0;
  let cn = 0;
  const R = 6;
  for (let y = R; y < h - R; y += 1) {
    for (let x = R; x < w - R; x += 1) {
      const i = y * w + x;
      if (data[i * 4 + 3] < 250) continue;
      let ok = true;
      for (let d = -R; d <= R && ok; d += R) {
        if (!inside[i + d] || !inside[i + d * w] || !inside[i + d * w + d] || !inside[i + d * w - d]) ok = false;
      }
      if (!ok) continue;
      cr += data[i * 4];
      cg += data[i * 4 + 1];
      cb += data[i * 4 + 2];
      cn += 1;
    }
  }
  const core: [number, number, number] = cn ? [cr / cn, cg / cn, cb / cn] : [0, 0, 0];
  const coreLum = lum(core[0], core[1], core[2]);
  let white = 0;
  let warm = 0;
  let thin = 0;
  for (let i = 0; i < w * h; i += 1) {
    if (!inside[i]) continue;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const l = lum(r, g, b);
    if (l > 246) white += 1;
    if (r > g + 14 && g > b + 14 && l < coreLum * 0.93 && data[i * 4 + 3] >= 230) warm += 1;
    if (data[i * 4 + 3] < 230) thin += 1;
  }
  return {
    area,
    eqd: 2 * Math.sqrt(area / Math.PI),
    solidity: area / Math.max(1, hull),
    aspect,
    centreOffset: Math.hypot(cx - w / 2, cy - h / 2),
    borderMargin: minEdgeDist === Infinity ? 0 : minEdgeDist,
    edgeWidthPx: partial / Math.max(1, boundaryCount),
    core,
    whiteClip: white / n,
    warm: warm / n,
    thin: thin / n,
  };
}
