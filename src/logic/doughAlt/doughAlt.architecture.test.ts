import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T9 (#784) D-A' (dough step buttons): UNWIRED. The pure logic in logic/doughAlt/ is read by nothing but its own tests: no reducer, screen, stage, App, main, scoring, save,
 * identification, hint or discovery module mentions it, and its own source imports only the pure helpers it is built from (never React, the DOM, a reducer,
 * storage or a clock). When a separately approved wiring slice lands, the files that own / relay it are added to LATER_SLICES here -- a deliberate, reviewed edit.
 */
const SRC = path.resolve(__dirname, "../..");
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, "/");
const isSource = (f: string) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.tsx?$/.test(f);
const all = walk(SRC).map(rel).filter(isSource);
const read = (f: string) => readFileSync(path.join(SRC, f), "utf8");

const OWN = (f: string) => f.startsWith("logic/doughAlt/");
const LATER_SLICES = new Set<string>([]);
const NAMES = /doughAlt|DOUGH_ALT_|DoughAlt|stepDoughShape/;

describe("D-A' (dough step buttons) is read only where it is owned", () => {
  it("has its own files", () => {
    expect(all.filter(OWN).length).toBeGreaterThanOrEqual(2);
  });
  it("no other source file mentions it (nothing imports it)", () => {
    expect(all.filter((f) => !OWN(f) && !LATER_SLICES.has(f) && NAMES.test(read(f)))).toEqual([]);
  });
  it("the reducer, the screens, the stage, App and main do not mention it", () => {
    for (const f of ["state/gameReducer.ts", "components/PizzaStage.tsx", "screens/GameScreen.tsx", "App.tsx", "main.tsx"]) {
      if (all.includes(f)) expect(read(f), f).not.toMatch(NAMES);
    }
  });
  it("scoring, identification, discovery, hints, signature and save modules never mention it", () => {
    const sensitive = all.filter((f) => /^(logic\/(scoring|discovery|signature|hint|research|dex|pitz|ladder|completion)|state\/(persist|save|dex|pendingRound))/i.test(f));
    expect(sensitive.length).toBeGreaterThan(0);
    for (const f of sensitive) expect(read(f), f).not.toMatch(NAMES);
  });
  it("its own source imports only the pure helpers it is built from, and never reads the clock, the DOM or storage", () => {
    const allowed = ["../doughShape", "../pizzaCoordinates"];
    for (const f of all.filter(OWN)) {
      const text = read(f);
      for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']/g)) expect(m[1].startsWith("./") || allowed.includes(m[1]), f + " imports " + m[1]).toBe(true);
      expect(text, f).not.toMatch(/\b(Date\.now|performance\.now|document\.|window\.|localStorage|sessionStorage|requestAnimationFrame|setTimeout|setInterval)\b/);
    }
  });
});
