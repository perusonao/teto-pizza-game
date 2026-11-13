import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cooking Fry Phase 1 (#749), F1: the fry look is display-only state, and the fry is a FOURTH, INDEPENDENT treatment next to the 炒める prep, the 炙り sear and the
 * 蒸す steam. F1 is unwired: NOTHING outside the fry's own files may mention it (no reducer, no screen, no scoring, no save). Scoring, identification, hints,
 * discovery, completion, saves and the pending-round journal never read it; nothing is shared with the other three. Test files are excluded from the scans.
 * When the separately approved wiring slices land, the files that own / relay the state are added to LATER_SLICES here -- a deliberate, reviewed edit.
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

const OWN = (f: string) => f.startsWith("logic/fry/") || /^data\/fry[A-Za-z]*\.ts$/.test(f) || /^preview\/fry[A-Za-z]*\.ts$/.test(f);
/** Empty in F1: the wiring slices (F2 reducer, F3 UI) are on HOLD. */
const LATER_SLICES = new Set<string>([]);
const FRY_NAMES = /friedLook|FRY_INGREDIENT|fryExperienceGate|fryPreview|fryIngredients|logic\/fry|cookFry|FRY_EXPERIENCE/;

describe("the fry is read only where it is owned", () => {
  it("has its own files", () => {
    expect(all.filter(OWN).length).toBeGreaterThanOrEqual(8);
  });
  it("no other source file mentions it (F1 is unwired; nothing imports it)", () => {
    const offenders = all.filter((f) => !OWN(f) && !LATER_SLICES.has(f) && FRY_NAMES.test(read(f)));
    expect(offenders).toEqual([]);
  });
  it("the reducer, the screens, the stage and App do not mention it", () => {
    for (const f of ["state/gameReducer.ts", "components/PizzaStage.tsx", "screens/GameScreen.tsx", "App.tsx", "main.tsx"]) {
      if (all.includes(f)) expect(read(f), f).not.toMatch(FRY_NAMES);
    }
  });
  it("scoring, identification, discovery, hints, signature and save modules never mention it", () => {
    const sensitive = all.filter((f) => /^(logic\/(scoring|discovery|signature|hint|research|dex|pitz|ladder|completion)|state\/(persist|save|dex|pendingRound))/i.test(f));
    expect(sensitive.length).toBeGreaterThan(0);
    for (const f of sensitive) expect(read(f), f).not.toMatch(FRY_NAMES);
  });
  it("the ingredient catalog is untouched by the fry (no fry id / flag in it)", () => {
    expect(read("data/ingredients.ts")).not.toMatch(/\bfry\b|Fry|fried/i);
  });
});

/** Every relative specifier a file pulls in (import / export ... from, side-effect imports, dynamic import(), CSS @import), resolved to a src-relative path without extension. */
export function relativeTargets(file: string, text: string): string[] {
  const specs = [
    ...text.matchAll(/(?:^|[\s;])(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']/g),
    ...text.matchAll(/(?:^|[\s;])import\s*["']([^"']+)["']/g),
    ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...text.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g),
  ].map((m) => m[1]);
  return specs
    .filter((s) => s.startsWith("."))
    .map((s) => path.posix.normalize(path.posix.join(path.posix.dirname(file), s)).replace(/\.(tsx?|css)$/, ""));
}
const isFryTarget = (t: string) => /^logic\/fry(\/|$)/.test(t) || /^data\/fry[A-Za-z]*$/.test(t) || /^preview\/fry[A-Za-z]*$/.test(t);

describe("a relative import cannot connect to the fry (resolved from the importing file, not name-matched)", () => {
  it("the resolver sees the paths a name scan would miss", () => {
    expect(relativeTargets("logic/scoringV2.ts", 'import { fryResultOf } from "./fry/fryPot";').map(isFryTarget)).toEqual([true]);
    expect(relativeTargets("logic/prep/prepX.ts", 'import { x } from "../fry/fryTap";').map(isFryTarget)).toEqual([true]);
    expect(relativeTargets("state/gameReducer.ts", 'export * from "../logic/fry/friedLook.ts";').map(isFryTarget)).toEqual([true]);
    expect(relativeTargets("components/A.tsx", 'const m = await import("../data/fryIngredients");').map(isFryTarget)).toEqual([true]);
    expect(relativeTargets("components/A.tsx", 'import "../preview/fryPreview";').map(isFryTarget)).toEqual([true]);
    expect(relativeTargets("components/A.css", '@import "../logic/fry/x.css";').map(isFryTarget)).toEqual([true]);
    expect(relativeTargets("logic/a.ts", 'import { fryish } from "./fryish-unrelated-dir/x"; import y from "react";').map(isFryTarget)).toEqual([false]);
  });
  it("no source file outside the fry's own files imports anything the fry owns", () => {
    const offenders = all.filter((f) => !OWN(f) && !LATER_SLICES.has(f)).filter((f) => relativeTargets(f, read(f)).some(isFryTarget));
    expect(offenders).toEqual([]);
  });
  it("test files outside the fry's own files do not import it either (only the fry's own tests and the Result's gates may)", () => {
    const tests = walk(SRC).map(rel).filter((f) => /\.test\.tsx?$/.test(f) && !OWN(f) && !/^data\/fryIngredients\.test\.ts$/.test(f) && !/^preview\/fryPreview\.test\.ts$/.test(f));
    const offenders = tests.filter((f) => relativeTargets(f, read(f)).some(isFryTarget));
    expect(offenders).toEqual([]);
  });
});

describe("the fry registration is a closed, unwired list (F2-pre)", () => {
  it("the fry's CSS custom properties and class live only in the fry's own files (no stylesheet, screen or other module defines or reads them yet)", () => {
    const offenders = all.filter((f) => !OWN(f) && !LATER_SLICES.has(f) && /--fry-|ingredient-piece--fried/.test(read(f)));
    expect(offenders).toEqual([]);
  });
  it("only the fry's own files read the fry opt-in names, so a production build has nothing to keep", () => {
    const offenders = all.filter((f) => !OWN(f) && !LATER_SLICES.has(f) && /cookFry|teto:cookFry/.test(read(f)));
    expect(offenders).toEqual([]);
  });
  it("the production switch is literally false, and the gate has no other way on than the Preview / DEV opt-in", () => {
    const gate = read("data/fryExperienceGate.ts");
    expect(gate).toMatch(/export const FRY_EXPERIENCE_PRODUCTION = false;/);
    expect(gate).toMatch(/return FRY_EXPERIENCE_PRODUCTION \|\| fryPreviewOptedIn\(\);/);
  });
  it("the fry offer and registration read only ids and round facts: no recipe, score, target or Research input", () => {
    for (const f of ["logic/fry/fryOffer.ts", "data/fryIngredients.ts"]) {
      expect(read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), f).not.toMatch(/recipe|score|(?<!not-)target\b|research|hint|discover|\bdex\b|pitz/i);
    }
  });
  it("the fry registration does not edit or import the ingredient catalog beyond a read-only lookup", () => {
    const text = read("data/fryIngredients.ts");
    expect(text).toMatch(/import \{ getIngredient \} from "\.\/ingredients";/);
    expect(text.match(/^import /gm)?.length).toBe(1);
  });
});

describe("independent of the 炒める prep, the 炙り sear and the 蒸す steam (both directions)", () => {
  const OTHER_NAMES =
    /preparedIngredientIds|preparedLook|PREP_INGREDIENT|prepExperienceGate|prepIngredients|searedLook|SEAR_INGREDIENT|searExperienceGate|searIngredients|logic\/sear|logic\/prep|searPreview|cookPrep|cookSear|steamedLook|STEAM_INGREDIENT|steamExperienceGate|steamPreview|steamIngredients|logic\/steam|cookSteam/;
  it("the fry's own source files do not touch the other three", () => {
    for (const f of all.filter(OWN)) expect(read(f), f).not.toMatch(OTHER_NAMES);
  });
  it("the prep, sear and steam modules do not mention the fry", () => {
    const theirs = all.filter(
      (f) =>
        f.startsWith("logic/prep/") ||
        f.startsWith("logic/sear/") ||
        f.startsWith("logic/steam/") ||
        /^data\/(prep|sear|steam)[A-Za-z]*\.ts$/.test(f) ||
        /^preview\/(sear|steam|cookSear|cookPrep|prep)[A-Za-z]*\.tsx?$/.test(f) ||
        /^components\/(Sear|Steam|CookingPrep)/.test(f),
    );
    expect(theirs.length).toBeGreaterThan(10);
    for (const f of theirs) expect(read(f), f).not.toMatch(FRY_NAMES);
  });
  it("the fry does not use the other treatments' CSS custom properties or classes", () => {
    for (const f of all.filter(OWN)) expect(read(f), f).not.toMatch(/--sear-|--prep-|--steam-|ingredient-piece--(seared|prepared|steamed)/);
  });
});

describe("what the fry may import (pure, no engine)", () => {
  const ALLOWED = /^(\.\/fry[A-Za-z]*|\.\/friedLook|\.\.\/logic\/fry\/fryPot|\.\.\/preview\/fryPreview|\.\/ingredients|\.\.\/\.\.\/data\/fryIngredients|\.\.\/data\/fryExperienceGate|\.\.\/\.\.\/state\/roundKind|react)$/;
  it("only its own modules, the ingredient catalog (read), the round-kind type and the CSSProperties type", () => {
    for (const f of all.filter(OWN)) {
      const imports = [...read(f).matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
      for (const spec of imports) expect(spec, `${f} imports ${spec}`).toMatch(ALLOWED);
    }
  });
});

describe("the fry never reads the real clock or randomness (the same input is the same pan)", () => {
  it("no Date / performance / Math.random / timers in the fry logic", () => {
    const logic = all.filter((x) => x.startsWith("logic/fry/"));
    expect(logic.length).toBeGreaterThan(4);
    for (const f of logic) expect(read(f), f).not.toMatch(/Date\.now|new Date|performance\.now|Math\.random|setTimeout|setInterval|requestAnimationFrame/);
  });
  it("no persistence APIs in the fry logic or data (transient only)", () => {
    for (const f of all.filter((x) => x.startsWith("logic/fry/") || /^data\/fry/.test(x))) expect(read(f), f).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });
});
