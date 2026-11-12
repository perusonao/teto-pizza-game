import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("STEP_ORDER Phase 1 architecture", () => {
  it("stays a pure, unwired logic module with Production capability OFF", () => {
    const source = readFileSync(resolve(process.cwd(), "src/logic/stepOrder.ts"), "utf8");
    expect(source).not.toMatch(/from ["']\.\.\/data\/recipes["']/);
    expect(source).not.toMatch(/requiredIngredients|RecipeId|getCookingProfile|gameReducer\s*\(/);
  });
});
