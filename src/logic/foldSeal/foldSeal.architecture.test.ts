// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FOLD+SEAL (Issue #773 T6-F1) architecture gate: the module is PURE and UNWIRED. It reads nothing but its own files and two existing pure geometry modules,
 * and nothing in the game imports it (except the DEV-only lab under src/labs/foldSeal, F2) -- so it cannot reach scoring, save, Dex, inventory, Research or hints, and it cannot change a screen.
 */
const here = __dirname;
const srcRoot = path.resolve(here, "../..");
const files = readdirSync(here).filter((f) => f.endsWith(".ts"));
const sources = files.filter((f) => !f.endsWith(".test.ts"));

const importSpecifiers = (code: string) => [...code.matchAll(/(?:import|export)[^"';]*?from\s+["']([^"']+)["']/g)].map((m) => m[1]);

describe("FOLD+SEAL is pure", () => {
  it("source files import only siblings and the two pure geometry modules (type-or-function read-only use)", () => {
    for (const f of sources) {
      for (const spec of importSpecifiers(readFileSync(path.join(here, f), "utf8"))) {
        const ok = spec.startsWith("./") || spec === "../doughShape";
        expect(ok, `${f} imports ${spec}`).toBe(true);
      }
    }
  });
  it("uses no DOM, clock, randomness, storage or network", () => {
    const banned = /\b(document|window|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|Date\.now|new Date|performance\.now|Math\.random|setTimeout|setInterval|requestAnimationFrame|navigator|crypto)\b/;
    for (const f of sources) expect(banned.test(readFileSync(path.join(here, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), f).toBe(false);
  });
  it("names no scoring / economy / persistence / discovery / catalog concept", () => {
    const banned = /\b(score|scoring|pitz|dex|inventory|stock|persist|pendingRound|research|hint|ladder|recipe|calzone|ingredient)\b/i;
    for (const f of sources) expect(banned.test(readFileSync(path.join(here, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), f).toBe(false);
  });
});

describe("FOLD+SEAL is unwired", () => {
  it("no file outside src/logic/foldSeal imports it", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (p === here) continue;
        // F2 (Issue #773): the stand-alone DEV lab is the one allowed consumer. Its own isolation test (src/labs/foldSeal/foldSealLab.isolation.test.ts) pins that
        // nothing else in the game imports the F1 module and that nothing imports the lab.
        if (p === path.join(srcRoot, "labs", "foldSeal")) continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && /foldSeal/.test(readFileSync(p, "utf8"))) hits.push(path.relative(srcRoot, p));
      }
    };
    walk(srcRoot);
    expect(hits).toEqual([]);
  });
});
