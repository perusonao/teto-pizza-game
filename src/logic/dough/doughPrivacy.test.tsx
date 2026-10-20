import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES } from "../../data/recipes";
import { TechniqueReveal } from "../../components/TechniqueReveal";
import type { DexEntry, DexState } from "../../state/dex";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { evaluateDiscovery } from "../discovery/matcher";
import { signatureOfPizza } from "../discovery/signature";
import { techniqueDexViews } from "../techniques/dexView";
import { productionTechniqueContext, resolveRoundTechniques } from "../techniques/runtime";

/**
 * Dough Kind P1 (#577), Anti-Oracle: Pinsa is not published (P3). With the production catalog nothing may surface the dough kind,
 * the technique or the recipe: not the Dex, not the RESULT's technique stage, not the discovery outcome, not any player-facing literal.
 */
const PINSA = "material-multigrain-long-ferment";
const WORDS = /ピンサ|ロマーナ|pinsa|romana/i;
const dexOf = (n: number): DexState =>
  RECIPES.filter((r) => !("ladderCredit" in r))
    .slice(0, n)
    .map((r): DexEntry => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
const jamonSet = (dough?: PizzaState["dough"]): PizzaState => ({
  ...createEmptyPizza(),
  ...(dough === undefined ? {} : { dough }),
  sauceIds: ["tomato-sauce"],
  toppings: ["mozzarella", "prosciutto-crudo", "arugula"].map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 8, y: 50 })),
  bakeResult: 70,
});

afterEach(cleanup);

describe("unpublished Pinsa does not leak (production catalog)", () => {
  it("no recipe id / name / description carries the Pinsa words, and no catalog target has a non-standard dough", () => {
    for (const r of RECIPES) expect(`${r.id}${r.nameJa}${r.description}`, r.id).not.toMatch(WORDS);
    for (const t of RECIPE_DISCOVERY_CATALOG) expect(t.identityDimensions.dough, t.targetId).toBe("standard");
  });

  it("the Dex 調理法 section never shows the dough technique, at any progress, with an empty ledger", () => {
    for (let n = 0; n <= RECIPES.length; n++) {
      const views = techniqueDexViews([], dexOf(n));
      expect(JSON.stringify(views), `credited ${n}`).not.toMatch(WORDS);
      expect(views.map((v) => v.id)).not.toContain("dough-pinsa-romana");
    }
  });

  it("a Pinsa-dough cook of the jamon ingredients is not jamon and not a discovery; the RESULT's technique stage stays empty", () => {
    const sig = signatureOfPizza(jamonSet(PINSA));
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, []).kind).toBe("ORIGINAL");
    expect(evaluateDiscovery(signatureOfPizza(jamonSet()), RECIPE_DISCOVERY_CATALOG, []).kind).toBe("NEW_DISCOVERY");
    const result = resolveRoundTechniques({
      eligibility: "FREE_COOK",
      ledger: [],
      signature: sig,
      completionPassed: true,
      dexBefore: dexOf(RECIPES.length),
      dexAfter: dexOf(RECIPES.length),
      context: productionTechniqueContext(),
    });
    // (a full Dex legitimately re-reports techniques its recipes require, e.g. no-sauce; the dough technique is never among them)
    expect(result.newlyDiscovered).not.toContain("dough-pinsa-romana");
    const { container } = render(<TechniqueReveal techniqueIds={result.newlyDiscovered} />);
    expect(container.innerHTML).not.toMatch(WORDS);
  });

  it("no player-facing string literal in the app mentions Pinsa, other than the technique registry and its detection pairing", () => {
    const sources = import.meta.glob<string>(["/src/**/*.ts", "/src/**/*.tsx", "!/src/**/*.test.ts", "!/src/**/*.test.tsx"], { query: "?raw", import: "default", eager: true });
    const literal = /(["'`])(?:(?!\1)[^\n\\])*(?:ピンサ|ロマーナ|pinsa|romana)(?:(?!\1)[^\n\\])*\1/i;
    const holders = Object.entries(sources)
      .filter(([, text]) => literal.test(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")))
      .map(([path]) => path)
      .sort();
    expect(holders).toEqual(["/src/data/techniques.ts", "/src/logic/techniques/detection.ts"]);
  });
});
