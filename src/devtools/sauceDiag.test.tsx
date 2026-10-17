import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import sauceDiagSource from "./SauceDiag.tsx?raw";
import readSource from "./sauceDiagRead.ts?raw";
import expectedSource from "./sauceDiagExpected.ts?raw";
import { SauceDiag } from "./SauceDiag";
import { buildSauceDiagReport, compareHold, dataLine, holdOf, screenLines, type SauceDiagFacts } from "./sauceDiagRead";
import { centroidOf, expectedOwnLayers } from "./sauceDiagExpected";
import { createIdealDoughShape } from "../logic/doughShape";

/** Issue #524 Owner HV: the sauce diagnostic is read-only and cannot throw. (The bundle-level proof it is not in production is previewIsolation.gate.test.ts.) */

const shape = createIdealDoughShape();
const dep = (x: number, y: number, amount: number, ingredientId?: string) => ({ x, y, amount, ...(ingredientId ? { ingredientId } : {}) });
const tomato = Array.from({ length: 6 }, (_, i) => dep(25 + i * 3, 40, 0.02, "tomato-sauce"));
const oil = Array.from({ length: 4 }, (_, i) => dep(60 + i * 3, 65, 0.02, "olive-oil"));
const facts: SauceDiagFacts = { sauceIds: ["tomato-sauce", "olive-oil"], deposits: [...tomato, ...oil], doughShape: shape };

function dough(...classes: string[]) {
  document.body.innerHTML = `<div class="pizza-dough">${classes.map((c) => `<canvas class="${c}" width="4" height="4"></canvas>`).join("")}</div>`;
  return Array.from(document.querySelectorAll("canvas"));
}

/** RGBA bytes of a `w` x `h` canvas with alpha 255 where `on(x, y)`. */
const rgba = (w: number, h: number, on: (x: number, y: number) => boolean, rgb: [number, number, number] = [200, 60, 50]) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (on(x, y)) d.set([...rgb, 255], (y * w + x) * 4);
  return d;
};

describe("sauceDiagRead: the data side", () => {
  it("counts deposits and amount per kind; an absent ingredientId on a one-kind pizza belongs to that kind", () => {
    expect(dataLine(facts)).toBe("DATA ids=[tomato-,olive-o] dep(n/amt) tomato-=6/0.1 olive-o=4/0.1");
    expect(dataLine({ sauceIds: ["tomato-sauce"], deposits: [dep(1, 1, 1), dep(2, 2, 2)], doughShape: shape })).toBe("DATA ids=[tomato-] dep(n/amt) tomato-=2/3.0");
    expect(dataLine({ sauceIds: [], deposits: [], doughShape: shape })).toBe("DATA ids=[] dep(n/amt) -");
  });
  it("a non-finite amount never produces NaN", () => {
    expect(dataLine({ sauceIds: ["a"], deposits: [dep(1, 1, Number.NaN)], doughShape: shape })).toContain("a=1/0.0");
  });
});

describe("holdOf / compareHold: what a canvas holds, and how it compares with the data", () => {
  it("pixel count, mean RGB, mask checksum and centroid; the same pixels give the same checksum, other pixels another", () => {
    const left = holdOf(rgba(200, 200, (x) => x < 80), 200, 200);
    const left2 = holdOf(rgba(200, 200, (x) => x < 80), 200, 200);
    const right = holdOf(rgba(200, 200, (x) => x >= 120), 200, 200);
    expect(left.px).toBe(80 * 200);
    expect(left.rgb).toEqual([200, 60, 50]);
    expect(left.hash).toBe(left2.hash);
    expect(left.hash).not.toBe(right.hash);
    expect(left.centroid[0]).toBeLessThan(25);
    expect(right.centroid[0]).toBeGreaterThan(75);
    expect(holdOf(new Uint8ClampedArray(200 * 200 * 4), 200, 200).px).toBe(0);
  });
  it("expected layers come from the deposit log alone: one per run, centroid = the weighted mean of the run's own deposits", () => {
    const layers = expectedOwnLayers(facts)!;
    expect(layers.map((l) => l.kind)).toEqual(["tomato-sauce", "olive-oil"]);
    expect(layers[0].centroid[0]).toBeCloseTo(centroidOf(tomato)[0], 6);
    expect(layers[1].centroid[1]).toBeCloseTo(65, 6);
    expect(layers[0].mask.some((v) => v === 1)).toBe(true);
    expect(expectedOwnLayers({ sauceIds: [], deposits: [], doughShape: shape })).toBeNull();
  });
  it("a canvas holding the OTHER layer's pixels (the #524 symptom) is a MISMATCH; the right pixels are ok", () => {
    const [t, o] = expectedOwnLayers(facts)!;
    // the canvas pixels the data says the oil layer should hold, painted in the oil's colour
    const oilHold = holdOf(rgba(200, 200, (x, y) => o.mask[Math.floor((y / 200) * 64) * 64 + Math.floor((x / 200) * 64)] === 1, o.rgb), 200, 200);
    const tomatoHold = holdOf(rgba(200, 200, (x, y) => t.mask[Math.floor((y / 200) * 64) * 64 + Math.floor((x / 200) * 64)] === 1, t.rgb), 200, 200);
    expect(compareHold(tomatoHold, t).mismatch).toBe(false);
    expect(compareHold(oilHold, o).mismatch).toBe(false);
    expect(oilHold.hash).not.toBe(tomatoHold.hash);
    // tomato canvas that holds the oil's pixels
    const wrong = compareHold(oilHold, t);
    expect(wrong.mismatch).toBe(true);
    expect(wrong.cd).toBeGreaterThan(12);
    // an empty canvas where pixels are expected is a mismatch too
    expect(compareHold(holdOf(new Uint8ClampedArray(200 * 200 * 4), 200, 200), t).mismatch).toBe(true);
  });
});

describe("sauceDiagRead: the screen side", () => {
  const alpha = (n: number) => ({ getImageData: () => ({ data: new Uint8ClampedArray(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : 0))) }) }) as unknown as CanvasRenderingContext2D;
  it("one line per canvas with its pixel count, style and kind; the oil canvas is starred; the hold line follows a non-empty canvas", () => {
    const [c0, c1] = dough("pizza-sauce-heatmap pizza-sauce-heatmap--kind-tomato-sauce", "pizza-sauce-heatmap pizza-sauce-heatmap--oil pizza-sauce-heatmap--kind-olive-oil");
    vi.spyOn(c0, "getContext").mockReturnValue(alpha(5));
    vi.spyOn(c1, "getContext").mockReturnValue(alpha(0));
    const lines = screenLines(document, window, 3, new Date(2026, 0, 1, 7, 8, 9));
    expect(lines[0]).toMatch(/^#3 07:08:09 ios=\? dpr=\d+ h=\d+ fb=0 n=2 area=32$/);
    expect(lines[1]).toMatch(/^ c0 tomato px=5 v=v o=1 d=\w+/);
    expect(lines[2]).toMatch(/^ {2}tomato rgb=0,0,0 h=[0-9a-f]{8} c=\d+,\d+$/);
    expect(lines[3]).toMatch(/^ c1 olive-\* px=0 /);
  });
  it("with expectations: an empty heat canvas where pixels are expected prints MISMATCH; overflow canvases share one line", () => {
    const [c0, c1, c2, c3] = dough("pizza-sauce-heatmap", "pizza-sauce-heatmap", "pizza-sauce-heatmap", "pizza-sauce-heatmap");
    for (const c of [c0, c1, c2, c3]) vi.spyOn(c, "getContext").mockReturnValue(alpha(0));
    const exp = expectedOwnLayers(facts)!;
    const lines = screenLines(document, window, 1, new Date(), exp);
    expect(lines.filter((l) => l.includes("MISMATCH")).length).toBe(2);
    expect(lines[lines.length - 1]).toMatch(/c2 .* \| c3 /);
  });
  it("counts a dot fallback on screen", () => {
    dough("pizza-sauce-heatmap");
    document.body.insertAdjacentHTML("beforeend", '<div data-sauce-fallback="true"></div>');
    expect(screenLines(document, window, 1, new Date())[0]).toContain("fb=1");
  });
  it("getImageData throwing becomes ERR in that line, not an exception", () => {
    const [c0] = dough("pizza-sauce-heatmap");
    vi.spyOn(c0, "getContext").mockReturnValue({ getImageData: () => { throw new DOMException("x", "SecurityError"); } } as unknown as CanvasRenderingContext2D);
    expect(screenLines(document, window, 1, new Date())[1]).toContain("px=ERR:SecurityError");
  });
  it("no 2D context: 'noctx'; getComputedStyle throwing: ERR; no dough at all: n=0", () => {
    dough("pizza-sauce-heatmap");
    expect(screenLines(document, window, 1, new Date())[1]).toContain("px=noctx");
    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation(() => { throw new Error("nope"); });
    expect(screenLines(document, window, 1, new Date())[1]).toContain("ERR:Error");
    spy.mockRestore();
    document.body.innerHTML = "";
    expect(screenLines(document, window, 1, new Date())[0]).toContain("n=0 area=0");
  });
  it("the whole report: header, data, canvas lines; a broken expectation (bad facts) never throws", () => {
    dough("pizza-sauce-heatmap");
    const r = buildSauceDiagReport(document, window, 1, new Date(), facts);
    expect(r[0]).toMatch(/^#1 /);
    expect(r[1]).toMatch(/^ DATA ids=/);
    expect(r[2]).toMatch(/^ c0 /);
    expect(() => buildSauceDiagReport(document, window, 2, new Date(), { sauceIds: null, deposits: null, doughShape: null } as unknown as SauceDiagFacts)).not.toThrow();
  });
});

describe("SauceDiag component", () => {
  it("the 診断 button prints the report into the log box; 消 clears it; the log box is there from the first render", () => {
    dough("pizza-sauce-heatmap");
    render(<SauceDiag facts={facts} />);
    const log = screen.getByTestId("sauce-diag-log");
    expect(log.textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /ソース診断\(DEV\)$/ }));
    expect(log.textContent).toContain("#1 ");
    expect(log.textContent).toContain("DATA ids=[tomato-,olive-o]");
    fireEvent.click(screen.getByRole("button", { name: /ソース診断\(DEV\)を消す/ }));
    expect(log.textContent).toBe("");
  });
  it("keeps only the last rows", () => {
    dough("pizza-sauce-heatmap");
    render(<SauceDiag facts={facts} />);
    const btn = screen.getByRole("button", { name: /ソース診断\(DEV\)$/ });
    for (let i = 0; i < 12; i++) fireEvent.click(btn);
    expect((screen.getByTestId("sauce-diag-log").textContent ?? "").split("\n").length).toBeLessThanOrEqual(12);
  });
  it("pressing it changes nothing in the page it reads (the canvases and the rest of the DOM)", () => {
    const [c0] = dough("pizza-sauce-heatmap");
    const wrap = document.createElement("div");
    document.body.appendChild(wrap);
    const before = document.querySelector(".pizza-dough")!.outerHTML;
    render(<SauceDiag facts={facts} />, { container: wrap });
    fireEvent.click(screen.getByRole("button", { name: /ソース診断\(DEV\)$/ }));
    expect(document.querySelector(".pizza-dough")!.outerHTML).toBe(before);
    expect(c0.width).toBe(4);
  });
});

describe("read-only by source", () => {
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const sources = [["SauceDiag.tsx", sauceDiagSource], ["sauceDiagRead.ts", readSource], ["sauceDiagExpected.ts", expectedSource]] as const;
  it("no module can write a canvas, storage, a cookie or the network, nor dispatch", () => {
    for (const [name, text] of sources) {
      const c = code(text);
      expect(c, name).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|indexedDB|localStorage|sessionStorage|caches)\b|document\.cookie|\.setItem\(|\.removeItem\(/);
      expect(c, name).not.toMatch(/\b(putImageData|fillRect|clearRect|drawImage|fillText|strokeRect|createImageData|toDataURL|toBlob)\b|\.(width|height)\s*=[^=]/);
      expect(c, name).not.toMatch(/dispatch|useReducer|firebase|from ['"]\.\.\/(preview|firebase)/);
    }
  });
  it("the EXPECTED side uses no canvas at all (it must not share the transfer path it checks)", () => {
    const c = code(expectedSource);
    expect(c).not.toMatch(/createElement|getContext|HTMLCanvasElement|OffscreenCanvas|ImageData\b|staging|Staging|SauceHeatmapCanvas|SauceMergedCanvas|sauceCanvasSupport/);
  });
  it("each module imports only what it needs", () => {
    const imports = (t: string) => [...t.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]).sort();
    expect(imports(sauceDiagSource)).toEqual(["./marks", "./sauceDiagRead", "react"]);
    expect(imports(readSource)).toEqual(["../logic/doughShape", "../state/pizzaState", "./sauceDiagExpected"]);
    expect(imports(expectedSource)).toEqual(["../data/ingredients", "../logic/doughShape", "../logic/sauceDisplay", "../state/pizzaState", "../state/sauceLayers"]);
  });
});
