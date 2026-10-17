import type { DoughShape } from "../logic/doughShape";
import type { SauceDeposit } from "../state/pizzaState";
import { expectedOwnLayers, type ExpectedLayer } from "./sauceDiagExpected";

/**
 * Sauce diagnostic (Issue #524 Owner HV), the READ side. Preview / DEV only (./SauceDiag.tsx is its one caller, behind a static env gate).
 *
 * Strictly read-only: it reads the sauce canvases of the first `.pizza-dough` (their pixels through `getImageData`, their computed style), whether a dot
 * fallback is on screen, and a plain snapshot of the pizza's sauce data it is handed. It never draws, never writes a canvas / storage / cookie, never
 * touches the network and never calls the game's dispatch. Every read is guarded: a failure becomes an `ERR:` token in that line, never an exception.
 *
 * Per heat canvas it prints what the canvas HOLDS (non-transparent pixels, their mean RGB, a checksum of their 64x64 position mask, the centroid of that
 * mask) next to what the pizza's data says it SHOULD hold (./sauceDiagExpected.ts, computed without any canvas): `cd` = distance between the two centroids
 * (% of the dough), `iou` = overlap of the two 64x64 masks, `dRGB` = colour distance. A canvas holding another layer's pixels shows `MISMATCH`.
 */
export interface SauceDiagFacts {
  /** `pizza.sauceIds`: the kinds committed so far, first-use order. */
  sauceIds: readonly string[];
  /** `pizza.sauceDeposits` (read only). `ingredientId` is absent on a one-kind pizza. */
  deposits: readonly SauceDeposit[];
  /** `pizza.doughShape`, for the expected pixels. */
  doughShape: DoughShape;
}

const errName = (e: unknown): string => String((e as { name?: string } | null)?.name ?? e).slice(0, 18);
const pad = (n: number) => (n < 10 ? "0" : "") + n;
const GRID = 64;

/** Thresholds of the MISMATCH flag (display only). */
export const MISMATCH_CENTROID_PCT = 12;
export const MISMATCH_IOU_BELOW = 0.6;
export const MISMATCH_RGB_ABOVE = 60;

/** Data side: how many deposits (and how much amount) each sauce kind has in the pizza's own log. */
export function dataLine(facts: SauceDiagFacts): string {
  const per = new Map<string, { n: number; amount: number }>();
  const only = facts.sauceIds.length === 1 ? facts.sauceIds[0] : "?";
  for (const d of facts.deposits) {
    const key = d.ingredientId ?? only;
    const cur = per.get(key) ?? { n: 0, amount: 0 };
    cur.n += 1;
    cur.amount += Number.isFinite(d.amount) ? d.amount : 0;
    per.set(key, cur);
  }
  const parts = Array.from(per, ([k, v]) => `${k.slice(0, 7)}=${v.n}/${v.amount.toFixed(1)}`);
  return `DATA ids=[${facts.sauceIds.map((s) => s.slice(0, 7)).join(",")}] dep(n/amt) ${parts.join(" ") || "-"}`;
}

/** What a canvas holds, from one `getImageData`. */
export interface CanvasHold {
  /** pixels with alpha > 8 */
  px: number;
  /** mean RGB over those pixels */
  rgb: [number, number, number];
  /** 64x64 position mask: 1 where the canvas, sampled at the cell centre, has alpha > 8 */
  mask: Uint8Array;
  /** FNV-1a hash of the mask, 8 hex digits: equal masks <=> equal hash */
  hash: string;
  /** centroid of the mask, % of the canvas */
  centroid: [number, number];
}

/** Reduce RGBA bytes of a `w` x `h` canvas to what it holds. Pure (no canvas): the unit tests feed it arrays. */
export function holdOf(data: ArrayLike<number>, w: number, h: number): CanvasHold {
  let px = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] > 8) {
      px += 1;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
  }
  const mask = new Uint8Array(GRID * GRID);
  let hash = 0x811c9dc5;
  let cx = 0;
  let cy = 0;
  let cells = 0;
  for (let j = 0; j < GRID; j += 1) {
    for (let i = 0; i < GRID; i += 1) {
      const x = Math.min(w - 1, Math.floor(((i + 0.5) * w) / GRID));
      const y = Math.min(h - 1, Math.floor(((j + 0.5) * h) / GRID));
      const on = data[(y * w + x) * 4 + 3] > 8 ? 1 : 0;
      mask[j * GRID + i] = on;
      hash = Math.imul(hash ^ on, 0x01000193) >>> 0;
      if (on) {
        cx += ((i + 0.5) / GRID) * 100;
        cy += ((j + 0.5) / GRID) * 100;
        cells += 1;
      }
    }
  }
  return {
    px,
    rgb: px > 0 ? [Math.round(r / px), Math.round(g / px), Math.round(b / px)] : [0, 0, 0],
    mask,
    hash: hash.toString(16).padStart(8, "0"),
    centroid: cells > 0 ? [cx / cells, cy / cells] : [50, 50],
  };
}

/** How a canvas's hold compares with the expectation from the data. */
export function compareHold(hold: CanvasHold, exp: ExpectedLayer): { cd: number; iou: number; dRgb: number; mismatch: boolean } {
  const cd = Math.hypot(hold.centroid[0] - exp.centroid[0], hold.centroid[1] - exp.centroid[1]);
  let inter = 0;
  let union = 0;
  for (let i = 0; i < hold.mask.length; i += 1) {
    const a = hold.mask[i] === 1;
    const e = exp.mask[i] === 1;
    if (a && e) inter += 1;
    if (a || e) union += 1;
  }
  const iou = union > 0 ? inter / union : 1;
  const dRgb = Math.hypot(hold.rgb[0] - exp.rgb[0], hold.rgb[1] - exp.rgb[1], hold.rgb[2] - exp.rgb[2]);
  const mismatch = hold.px === 0 ? exp.mask.some((v) => v === 1) : cd > MISMATCH_CENTROID_PCT || iou < MISMATCH_IOU_BELOW || dRgb > MISMATCH_RGB_ABOVE;
  return { cd, iou, dRgb, mismatch };
}

/** Screen side: header + per canvas lines. `expected` (own heat canvases, oldest first) adds the comparison. Never throws. */
export function screenLines(doc: Document, win: Window, seq: number, now: Date, expected: readonly ExpectedLayer[] | null = null): string[] {
  const out: string[] = [];
  let canvases: HTMLCanvasElement[] = [];
  let fallback = -1;
  let ios = "?";
  try {
    const m = /OS (\d+[_\d]*)/.exec(win.navigator.userAgent || "");
    if (m) ios = m[1];
  } catch {
    ios = "ERR";
  }
  try {
    const dough = doc.querySelector(".pizza-dough");
    canvases = dough ? Array.from(dough.querySelectorAll("canvas")) : [];
    fallback = doc.querySelectorAll("[data-sauce-fallback]").length;
  } catch {
    canvases = [];
  }
  let area = 0;
  const heat = expected ? expected.length : 0; // the own heat canvases come first, in DOM order, when no run is flattened
  const lines: string[] = [];
  const overflow: string[] = [];
  canvases.forEach((c, i) => {
    let a = `c${i} `;
    let b = "";
    try {
      const st = win.getComputedStyle(c);
      const kind = /kind-([a-z-]+)/.exec(c.className)?.[1] ?? "1";
      const tag = `${kind.slice(0, 6)}${c.className.includes("--oil") ? "*" : ""}`;
      let hold: CanvasHold | null = null;
      let px: string | number = "?";
      try {
        const ctx = c.getContext("2d");
        if (ctx) {
          hold = holdOf(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          px = hold.px;
        } else px = "noctx";
      } catch (e) {
        px = `ERR:${errName(e)}`;
      }
      area += c.width * c.height;
      a += `${tag} px=${px} v=${st.visibility.charAt(0)} o=${st.opacity} d=${st.display.slice(0, 3)} f=${st.filter === "none" ? "-" : st.filter.slice(0, 9)}`;
      if (hold && hold.px > 0) {
        b = `${tag} rgb=${hold.rgb.join(",")} h=${hold.hash} c=${hold.centroid[0].toFixed(0)},${hold.centroid[1].toFixed(0)}`;
        const exp = i < heat ? expected![i] : null;
        if (exp) {
          const cmp = compareHold(hold, exp);
          b += ` cd=${cmp.cd.toFixed(1)} iou=${cmp.iou.toFixed(2)} dRGB=${Math.round(cmp.dRgb)} ${cmp.mismatch ? "MISMATCH" : "ok"}`;
        }
      } else if (hold && i < heat) {
        b = `${tag} EMPTY but expected pixels: MISMATCH`;
      }
    } catch (e) {
      a += `ERR:${errName(e)}`;
    }
    // heat canvases get two lines (state, then what they hold); overflow marker canvases that hold nothing share one line
    if (heat > 0 && i >= heat) overflow.push(a.replace(/ v=.*$/, ""));
    else {
      lines.push(` ${a}`);
      if (b) lines.push(`  ${b}`);
    }
  });
  out.push(`#${seq} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ios=${ios} dpr=${win.devicePixelRatio} h=${win.innerHeight} fb=${fallback} n=${canvases.length} area=${area}`);
  out.push(...lines);
  if (overflow.length > 0) out.push(` ${overflow.join(" | ")}`);
  return out;
}

/** The whole report for one tap: screen header, data line, one block per canvas. */
export function buildSauceDiagReport(doc: Document, win: Window, seq: number, now: Date, facts: SauceDiagFacts): string[] {
  let expected: ExpectedLayer[] | null = null;
  try {
    expected = expectedOwnLayers(facts);
  } catch {
    expected = null;
  }
  const [head, ...canvasLines] = screenLines(doc, win, seq, now, expected);
  let data: string;
  try {
    data = dataLine(facts);
  } catch (e) {
    data = `DATA ERR:${errName(e)}`;
  }
  return [head, ` ${data}`, ...canvasLines];
}
