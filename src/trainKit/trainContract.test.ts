import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENTS, getIngredient } from "../data/ingredients";
import { LATE_ENTITLEMENT_FLOORS } from "../data/lateCatalog";
import { RECIPES } from "../data/recipes";
import { getReferencePizza } from "../data/referencePizza";
import { DEFAULT_PIECE_STYLE, renderIngredient, renderIngredientBlock, renderRecipe } from "../../tools/train-kit/lib/codegen";
import { extractRecipe, extractTrain, referenceGroups, shippedPieceStyles } from "../../tools/train-kit/lib/extract";
import { isLateIngredient, type KitTrain } from "../../tools/train-kit/lib/implSpec";

/**
 * Train contract: every LANDED train spec (`./landed/<tag>.json`, written by `cli.mjs apply`) still describes the shipped catalog.
 * This is the generic replacement for a hand-written `expansionBatchNN.test.ts` data section: the spec the Owner approved is the
 * assertion. Changing a landed recipe later means changing its spec in the same PR (the spec stays the single description).
 * The Gate measurements (Research, Hint 5.0, DH4, shop, save) stay in their own suites and are not repeated here.
 */
const DIR = join(process.cwd(), "src", "trainKit", "landed");
const LANDED: KitTrain[] = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")));
const evaluate = (objectLiteral: string): unknown => vm.runInNewContext(`(${objectLiteral.trim().replace(/,$/, "")})`);
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

describe.each(LANDED.map((kit) => [kit.tag, kit] as const))("landed train %s", (_tag, kit) => {
  const meta = { train: kit.train, tag: kit.tag, label: kit.label, issue: kit.issue };
  const strip = (k: KitTrain) => ({ ...k, recipes: k.recipes.map(({ hvAlias: _h, ...r }) => r) });

  it("the shipped catalog is exactly what the spec says (recipes, materials, order, sauce profile, hint role, ladder step, evidence id)", () => {
    const now = extractTrain(kit.recipes.map((r) => r.id), meta);
    expect(now.unsupported).toEqual([]);
    expect(strip(now.kit)).toEqual(strip(kit));
  });

  it("what the generator renders from the spec evaluates to the shipped rows", () => {
    for (const r of kit.recipes) expect(evaluate(renderRecipe(r)), r.id).toEqual(plain(RECIPES.find((x) => x.id === r.id)));
    for (const i of kit.newIngredients) for (const render of [renderIngredient, renderIngredientBlock]) expect(evaluate(render(i)), i.id).toEqual(plain(getIngredient(i.id)));
  });

  it("the Reference is the RT-01 layout of the spec's pieces", () => {
    const category = new Map(INGREDIENTS.map((i) => [i.id, i.category as string]));
    for (const r of kit.recipes) {
      const real = getReferencePizza(r.id)!;
      const styles = shippedPieceStyles();
      const mine = referenceGroups(r, (id) => category.get(id) ?? null, (id) => styles.get(id)).map((g) => ({ ingredientId: g.ingredientId, positions: g.positions, interaction: (g.style ?? DEFAULT_PIECE_STYLE).interaction, matching: (g.style ?? DEFAULT_PIECE_STYLE).matching }));
      expect(plain(real.pieceGroups), r.id).toEqual(mine);
      expect(real.sauce === null, `${r.id}: NO_SAUCE`).toBe(r.sauceProfile === null);
    }
  });

  it("every late material has an entitlement floor that grants no later than its ladder step", () => {
    for (const i of kit.newIngredients.filter((x) => isLateIngredient(kit, x.id))) {
      const step = DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(i.id))!.step;
      expect(LATE_ENTITLEMENT_FLOORS[i.id], i.id).toBeGreaterThan(0);
      expect(LATE_ENTITLEMENT_FLOORS[i.id], i.id).toBeLessThanOrEqual(step);
    }
  });
});

describe("the spec format against the whole shipped catalog", () => {
  it("every recipe a catalog-only spec can express renders back to its shipped row", () => {
    let expressible = 0;
    for (const r of RECIPES) {
      const x = extractRecipe(r.id);
      if (x.unsupported.some((u) => u.startsWith("recipe field"))) continue;
      expressible += 1;
      expect(evaluate(renderRecipe(x.recipe)), r.id).toEqual(plain(r));
    }
    expect(expressible).toBeGreaterThan(0);
  });
});
