import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cooking Prep Phase 1 AC-6: the prep set is display-only state. Scoring, identification, hints, discovery, completion, saves and the
 * pending-round journal never read it; only the reducer (which owns the field), the prep modules and their tests mention it.
 */
const SRC = path.resolve(__dirname, "../..");
// PR-B (display only): the stage draws prepped pieces, the layer shows the mark, GameScreen relays the field. Nothing that scores / identifies / saves.
const ALLOWED = new Set(["state/gameReducer.ts", "data/prepIngredients.ts", "data/prepExperienceGate.ts", "preview/prepPreview.ts", "components/PizzaStage.tsx", "components/CookingPrepLayer.tsx", "screens/GameScreen.tsx"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe("preparedIngredientIds is read only where it is owned", () => {
  const files = walk(SRC)
    .map((f) => path.relative(SRC, f).replace(/\\/g, "/"))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith("logic/prep/"));

  it("no other source file mentions it", () => {
    const offenders = files.filter((f) => !ALLOWED.has(f) && readFileSync(path.join(SRC, f), "utf8").includes("preparedIngredientIds"));
    expect(offenders).toEqual([]);
  });

  it.each(["state/pendingRound.ts", "state/persistence.ts", "logic/scoringV2.ts"])("%s (if present) does not", (f) => {
    if (!files.includes(f)) return;
    expect(readFileSync(path.join(SRC, f), "utf8")).not.toMatch(/preparedIngredientIds|PREP_INGREDIENT/);
  });
});
