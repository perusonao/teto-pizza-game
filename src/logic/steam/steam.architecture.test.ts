import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cooking Steam Phase 1 (#726): the steam look is display-only state, and the steam is a third, INDEPENDENT treatment next to the 炒める prep and the 炙り sear.
 * Scoring, identification, hints, discovery, completion, saves and the pending-round journal never read it; nothing is shared with the other two.
 * Test files and this directory are excluded from the scans of "other" code.
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

/** The files that may mention the steam: its own modules, and (for the later, separately approved slices) the files that own / relay the state. */
const OWN = (f: string) =>
  f.startsWith("logic/steam/") ||
  /^data\/steam[A-Za-z]*\.ts$/.test(f) ||
  /^preview\/(steam|CookSteam|cookSteam)[A-Za-z]*\.tsx?$/.test(f) ||
  f === "components/SteamLayer.tsx" ||
  f === "components/Steam.css";
const LATER_SLICES = new Set(["state/gameReducer.ts", "components/PizzaStage.tsx", "components/SteamLayer.tsx", "components/Steam.css", "screens/GameScreen.tsx", "App.tsx"]);
const STEAM_NAMES = /steamedLook|STEAM_INGREDIENT|steamExperienceGate|steamPreview|steamIngredients|logic\/steam|cookSteam/;

describe("the steam is read only where it is owned", () => {
  it("no other source file mentions it (S1 is unwired; only the later slices' files are allowed to)", () => {
    const offenders = all.filter((f) => !OWN(f) && !LATER_SLICES.has(f) && STEAM_NAMES.test(readFileSync(path.join(SRC, f), "utf8")));
    expect(offenders).toEqual([]);
  });
  it.each(["state/pendingRound.ts", "state/persistence.ts", "logic/scoringV2.ts"])("%s (if present) does not", (f) => {
    if (!all.includes(f)) return;
    expect(readFileSync(path.join(SRC, f), "utf8")).not.toMatch(/steamedLook|STEAM_INGREDIENT|logic\/steam/);
  });
  it("scoring, identification, discovery, hints, signature and save modules never mention it", () => {
    const sensitive = all.filter((f) => /^(logic\/(scoring|discovery|signature|hint|research|dex|pitz|ladder|completion)|state\/(persist|save|dex|pendingRound))/i.test(f));
    expect(sensitive.length).toBeGreaterThan(0);
    for (const f of sensitive) expect(readFileSync(path.join(SRC, f), "utf8"), f).not.toMatch(/steamedLook|STEAM_INGREDIENT|logic\/steam|steamIngredients|steamExperienceGate/);
  });
});

describe("independent of the 炒める prep and the 炙り sear (both directions)", () => {
  const OTHER_NAMES = /preparedIngredientIds|preparedLook|PREP_INGREDIENT|prepExperienceGate|prepIngredients|searedLook|SEAR_INGREDIENT|searExperienceGate|searIngredients|logic\/sear|logic\/prep|searPreview|cookPrep|cookSear/;
  it("the steam's own source files do not touch the other two", () => {
    const own = all.filter(OWN);
    expect(own.length).toBeGreaterThanOrEqual(8);
    for (const f of own) expect(readFileSync(path.join(SRC, f), "utf8"), f).not.toMatch(OTHER_NAMES);
  });
  it("the prep and sear modules do not mention the steam", () => {
    const theirs = all.filter((f) => f.startsWith("logic/prep/") || f.startsWith("logic/sear/") || /^data\/(prep|sear)[A-Za-z]*\.ts$/.test(f) || /^preview\/(sear|cookSear|cookPrep|prep)[A-Za-z]*\.tsx?$/.test(f) || /^components\/(Sear|CookingPrep)/.test(f));
    expect(theirs.length).toBeGreaterThan(5);
    for (const f of theirs) expect(readFileSync(path.join(SRC, f), "utf8"), f).not.toMatch(STEAM_NAMES);
    // (the plain word "steam" is fine there: the prep's pan draws vapour and says so in comments.)
  });
  it("the steam does not use the other treatments' CSS custom properties or classes", () => {
    for (const f of all.filter(OWN)) expect(readFileSync(path.join(SRC, f), "utf8"), f).not.toMatch(/--sear-|--prep-|ingredient-piece--seared|ingredient-piece--prepared/);
  });
});

describe("the steam never reads the real clock or randomness (the same input is the same pot)", () => {
  it("no Date / performance / Math.random / timers in the steam logic", () => {
    for (const f of all.filter((x) => x.startsWith("logic/steam/"))) expect(readFileSync(path.join(SRC, f), "utf8"), f).not.toMatch(/Date\.now|new Date|performance\.now|Math\.random|setTimeout|setInterval|requestAnimationFrame/);
  });
});
