import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cooking Sear Phase 1 (#724): the sear look is display-only state. Scoring, identification, hints, discovery, completion, saves and the pending-round
 * journal never read it; only the reducer (which owns the field), the sear modules, the stage that draws it and the screen that relays it mention it.
 */
const SRC = path.resolve(__dirname, "../..");
const ALLOWED = new Set(["state/gameReducer.ts", "components/PizzaStage.tsx", "components/SearLayer.tsx", "screens/GameScreen.tsx"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe("searedLook is read only where it is owned", () => {
  const files = walk(SRC)
    .map((f) => path.relative(SRC, f).replace(/\\/g, "/"))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith("logic/sear/"));

  it("no other source file mentions searedLook or SEAR_INGREDIENT", () => {
    const offenders = files.filter((f) => !ALLOWED.has(f) && /searedLook|SEAR_INGREDIENT/.test(readFileSync(path.join(SRC, f), "utf8")));
    // App.tsx dispatches the action (the one wiring line); nothing else may.
    expect(offenders).toEqual(["App.tsx"]);
  });
  it.each(["state/pendingRound.ts", "state/persistence.ts", "logic/scoringV2.ts"])("%s (if present) does not", (f) => {
    if (!files.includes(f)) return;
    expect(readFileSync(path.join(SRC, f), "utf8")).not.toMatch(/searedLook|SEAR_INGREDIENT/);
  });
  it("the sear modules do not touch the 炒める prep's state", () => {
    const own = walk(path.join(SRC, "logic/sear")).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith("searFixtures.ts"));
    for (const f of own) expect(readFileSync(f, "utf8"), f).not.toMatch(/preparedIngredientIds|preparedLook|PREP_INGREDIENT|prepExperienceGate/);
  });
});
