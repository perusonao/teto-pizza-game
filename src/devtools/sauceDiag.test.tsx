import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import sauceDiagSource from "./SauceDiag.tsx?raw";
import readSource from "./sauceDiagRead.ts?raw";
import { SauceDiag } from "./SauceDiag";
import { buildSauceDiagReport, dataLine, screenLines } from "./sauceDiagRead";

/** Issue #524 Owner HV: the sauce diagnostic is read-only and cannot throw. (The bundle-level proof it is not in production is previewIsolation.gate.test.ts.) */

const facts = { sauceIds: ["tomato-sauce", "olive-oil"], deposits: [{ amount: 2, ingredientId: "tomato-sauce" }, { amount: 1.5, ingredientId: "tomato-sauce" }, { amount: 3, ingredientId: "olive-oil" }] };

function dough(...classes: string[]) {
  document.body.innerHTML = `<div class="pizza-dough">${classes.map((c) => `<canvas class="${c}" width="4" height="4"></canvas>`).join("")}</div>`;
  return Array.from(document.querySelectorAll("canvas"));
}

describe("sauceDiagRead: the data side", () => {
  it("counts deposits and amount per kind; an absent ingredientId on a one-kind pizza belongs to that kind", () => {
    expect(dataLine(facts)).toBe("DATA ids=[tomato-,olive-o] dep(n/amt) tomato-=2/3.5 olive-o=1/3.0");
    expect(dataLine({ sauceIds: ["tomato-sauce"], deposits: [{ amount: 1 }, { amount: 2 }] })).toBe("DATA ids=[tomato-] dep(n/amt) tomato-=2/3.0");
    expect(dataLine({ sauceIds: [], deposits: [] })).toBe("DATA ids=[] dep(n/amt) -");
  });
  it("a non-finite amount never produces NaN", () => {
    expect(dataLine({ sauceIds: ["a"], deposits: [{ amount: Number.NaN }] })).toContain("a=1/0.0");
  });
});

describe("sauceDiagRead: the screen side", () => {
  it("one line per canvas with its pixel count, style and kind; the oil canvas is starred", () => {
    const [c0, c1] = dough("pizza-sauce-heatmap pizza-sauce-heatmap--kind-tomato-sauce", "pizza-sauce-heatmap pizza-sauce-heatmap--oil pizza-sauce-heatmap--kind-olive-oil");
    const alpha = (n: number) => ({ getImageData: () => ({ data: new Uint8ClampedArray(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : 0))) }) }) as unknown as CanvasRenderingContext2D;
    vi.spyOn(c0, "getContext").mockReturnValue(alpha(5));
    vi.spyOn(c1, "getContext").mockReturnValue(alpha(0));
    const lines = screenLines(document, window, 3, new Date(2026, 0, 1, 7, 8, 9));
    expect(lines[0]).toMatch(/^#3 07:08:09 ios=\? dpr=\d+ h=\d+ fb=0 n=2 area=32$/);
    expect(lines[1]).toMatch(/^ c0 tomato px=5 v=v o=1 d=\w+/);
    expect(lines[2]).toMatch(/^ c1 olive-\* px=0 /);
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
  it("the whole report: header, data, canvas lines", () => {
    dough("pizza-sauce-heatmap");
    const r = buildSauceDiagReport(document, window, 1, new Date(), facts);
    expect(r[0]).toMatch(/^#1 /);
    expect(r[1]).toMatch(/^ DATA ids=/);
    expect(r[2]).toMatch(/^ c0 /);
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
    expect((screen.getByTestId("sauce-diag-log").textContent ?? "").split("\n").length).toBeLessThanOrEqual(11);
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
  it("neither module can write a canvas, storage, a cookie or the network, nor dispatch", () => {
    for (const [name, text] of [["SauceDiag.tsx", sauceDiagSource], ["sauceDiagRead.ts", readSource]] as const) {
      const c = code(text);
      expect(c, name).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|indexedDB|localStorage|sessionStorage|caches)\b|document\.cookie|\.setItem\(|\.removeItem\(/);
      expect(c, name).not.toMatch(/\b(putImageData|fillRect|clearRect|drawImage|fillText|strokeRect|createImageData|toDataURL|toBlob)\b|\.(width|height)\s*=[^=]/);
      expect(c, name).not.toMatch(/dispatch|useReducer|firebase|from ['"]\.\.\/(state|preview|firebase)/);
    }
  });
  it("its only imports are react and its own marks / read module", () => {
    const imports = [...sauceDiagSource.matchAll(/^import .* from "([^"]+)";/gm), ...readSource.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]).sort();
    expect(imports).toEqual(["./marks", "./sauceDiagRead", "react"]);
  });
});
