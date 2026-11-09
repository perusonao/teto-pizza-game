import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DRIZZLE (Issue #579), D1: the post-bake liquid's pure layer is UNWIRED and independent. NOTHING outside its own files may mention it (no reducer, no screen, no
 * scoring, no save, no journal, no stock), it imports only the production dough coordinates, and it is a different mechanism from the other cooking treatments
 * (prep / sear / steam / fry) and from the independent gesture lab (#746, `drizzleLab*`, which this file's detection words deliberately do not match).
 * When the separately approved slices (D2 journal, D3 stock, D4 scoring / identity, D5 UI) land, the files that own / relay it are added to LATER_SLICES
 * here -- a deliberate, reviewed edit. Test files are excluded from the scans.
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
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const OWN = (f: string) => f.startsWith("logic/drizzle/") || f === "data/drizzleExperienceGate.ts";
/** Empty in D1: the wiring slices D2-D5 are on HOLD. */
const LATER_SLICES = new Set<string>([]);
const DRIZZLE_NAMES = /postBakeLiquid|PostBakeLiquid|logic\/drizzle|DRIZZLE_EXPERIENCE|drizzleExperienceGate|drizzleExperienceEnabled/;
const own = all.filter(OWN);

describe("the post-bake liquid is read only where it is owned", () => {
  it("has its own files", () => {
    expect(own.length).toBeGreaterThanOrEqual(4);
  });
  it("no other source file mentions it (D1 is unwired; nothing imports it)", () => {
    const offenders = all.filter((f) => !OWN(f) && !LATER_SLICES.has(f) && DRIZZLE_NAMES.test(read(f)));
    expect(offenders).toEqual([]);
  });
  it("the reducer, journal, save, stock, state, screens, stage, App and main do not mention it", () => {
    const named = [
      "state/gameReducer.ts", "state/pendingRound.ts", "state/pendingRoundSettle.ts", "state/persistence.ts", "state/inventory.ts",
      "state/finalizeRound.ts", "state/pizzaState.ts", "state/dex.ts",
      "components/PizzaStage.tsx", "screens/GameScreen.tsx", "App.tsx", "main.tsx",
    ];
    for (const f of named) if (all.includes(f)) expect(read(f), f).not.toMatch(DRIZZLE_NAMES);
  });
  it("scoring, Pitz, identification, hints, research and the late catalog do not mention it", () => {
    const guarded = all.filter((f) => f.startsWith("logic/scoringV2/") || f === "logic/pitzReward.ts" || f.startsWith("logic/discovery/") || f.startsWith("logic/catalog/") || f === "data/lateCatalog.ts" || f === "data/recipes.ts");
    expect(guarded.length).toBeGreaterThan(5);
    expect(guarded.filter((f) => DRIZZLE_NAMES.test(read(f)))).toEqual([]);
  });
});

describe("it is independent and pure", () => {
  it("imports only the production dough coordinates and its own files", () => {
    for (const f of own) {
      for (const m of stripComments(read(f)).matchAll(/from\s+["']([^"']+)["']/g)) {
        const target = m[1];
        const ok = target.startsWith("./") || target === "../pizzaCoordinates";
        expect(ok, `${f} imports ${target}`).toBe(true);
      }
    }
  });
  it("does not import the other cooking treatments, the lab, or any component / preview", () => {
    for (const f of own) {
      const code = stripComments(read(f));
      expect(code, f).not.toMatch(/logic\/(fry|steam|prep|sear)|\/(fry|steam|prep|sear)[A-Za-z]*["']|preview\/|drizzleLab|components\//);
    }
  });
  it("uses no clock, randomness, DOM or storage", () => {
    for (const f of own) {
      expect(stripComments(read(f)), f).not.toMatch(/\bDate\b|\bperformance\b|Math\.random|\blocalStorage\b|\bsessionStorage\b|\bdocument\b|\bwindow\b|\bsetTimeout\b|requestAnimationFrame/);
    }
  });
  it("the production flag is the literal false", () => {
    expect(read("data/drizzleExperienceGate.ts")).toMatch(/export const DRIZZLE_EXPERIENCE_PRODUCTION = false;/);
  });
});
