import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IngredientGlyph } from "../components/IngredientGlyph";
import { IngredientPieceVisual } from "../components/IngredientPieceVisual";
import { researchLetterChangesAcrossOrders } from "../logic/catalog/testSupport/researchLabelAudit";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";

const NEW_IDS = ["buffalo-cauliflower-pizza", "swedish-kebab-pizza", "banh-mi-pizza", "mexican-elote-pizza", "pizza-asparagi-limone", "pizza-salad"] as const;
const NEW_MATERIALS = ["cauliflower", "kebab-sauce", "daikon", "liver-pate", "lime", "asparagus", "yogurt-sauce"] as const;
const recipe = (id: string) => RECIPES.find((r) => r.id === id)! as Recipe;

describe("T25 independent content contract", () => {
  it("lands all six recipes and seven materials after the I-7 runtime Gate", () => {
    for (const id of NEW_IDS) expect(recipe(id).id).toBe(id);
    for (const id of NEW_MATERIALS) expect(getIngredient(id)?.id).toBe(id);
    expect(recipe("pizza-salad").requiredIngredients.some((r) => r.ingredientId === "yogurt-sauce")).toBe(true);
    expect(getIngredient("yogurt-sauce")?.color).toBe("#f7f3e8");
    expect(RECIPES.some((r) => (r.id as string) === "chicken-tikka-pizza")).toBe(false);
  });

  it("records the Owner-reapproved REC-04 order: ordinary 81, new late steps 97-101", () => {
    expect(DISCOVERY_LADDER.steps.filter((s) => NEW_IDS.includes(s.keyRecipeId as typeof NEW_IDS[number])).map((s) => [s.step, s.ingredientIds, s.keyRecipeId])).toEqual([
      [81, ["cauliflower"], "buffalo-cauliflower-pizza"],
      [97, ["kebab-sauce"], "swedish-kebab-pizza"],
      [98, ["daikon", "liver-pate"], "banh-mi-pizza"],
      [99, ["lime"], "mexican-elote-pizza"],
      [100, ["asparagus"], "pizza-asparagi-limone"],
      [101, ["yogurt-sauce"], "pizza-salad"],
    ]);
  });

  it("uses dedicated art, with different selection and placed drawings for every new solid", () => {
    for (const id of ["cauliflower", "daikon", "liver-pate", "lime", "asparagus"] as const) {
      const ingredient = getIngredient(id)!;
      expect(ingredient.pieceVisual, id).toBeTruthy();
      expect(renderToStaticMarkup(<IngredientGlyph ingredient={ingredient} />), `${id}/selection`).not.toBe(
        renderToStaticMarkup(<IngredientPieceVisual ingredient={ingredient} />),
      );
    }
    expect(getIngredient("cauliflower")?.pieceVisual).toBe("cauliflower-floret");
    expect(getIngredient("kebab-sauce")?.pieceVisual).toBe("kebab-sauce-swirl");
  });

  /**
   * Batch 25 B-2 (Owner decision D-2, conditional approval of the buffalo-cauliflower vs buffalo-chicken duplicate): the approval requires a DEDICATED floret SVG that is visibly different from the chicken.
   * These assertions compare what is actually rendered (the previous check compared `pieceVisual` ids, and the chicken has none, so it could never fail).
   */
  describe("D-2 conditions: the cauliflower's drawing differs from the chicken's, in the tray and on the pizza", () => {
    const cauliflower = getIngredient("cauliflower")!;
    const chicken = getIngredient("chicken")!;
    const sel = (i: typeof cauliflower) => renderToStaticMarkup(<IngredientGlyph ingredient={i} />);
    const placed = (i: typeof cauliflower) => renderToStaticMarkup(<IngredientPieceVisual ingredient={i} />);

    it("the cauliflower renders its dedicated SVG in both places; the chicken renders none (its emoji)", () => {
      for (const markup of [sel(cauliflower), placed(cauliflower)]) {
        expect(markup).toContain("<svg");
        expect(markup).toContain('data-ingredient-visual="cauliflower-floret"');
      }
      for (const markup of [sel(chicken), placed(chicken)]) {
        expect(markup).not.toContain("data-ingredient-visual");
        expect(markup).toContain(chicken.emoji);
      }
    });

    it("the rendered markup differs between cauliflower and chicken (tray chip and placed piece), and no other ingredient draws the same florets", () => {
      expect(sel(cauliflower)).not.toBe(sel(chicken));
      expect(placed(cauliflower)).not.toBe(placed(chicken));
      for (const other of INGREDIENTS.filter((i) => i.id !== "cauliflower")) {
        expect(placed(other), `${other.id} must not look like the cauliflower on the pizza`).not.toBe(placed(cauliflower));
      }
    });

    it("the cauliflower art is not the chicken's emoji and not a recolour of any shared id (the floret's own drawing id is unique in the catalog)", () => {
      expect(INGREDIENTS.filter((i) => i.pieceVisual === "cauliflower-floret").map((i) => i.id)).toEqual(["cauliflower"]);
      expect(cauliflower.emoji).not.toBe(chicken.emoji);
    });
  });
});

describe("T25 Research approval pins (R-00/R-01/R-42)", () => {
  const APPROVED_STAGES: Readonly<Record<string, readonly string[]>> = {
    "baba-ganoush-pizza": ["olive-oil"], "baingan-bharta-pizza": ["cilantro"], bambino: ["corn", "ham"],
    "bbq-chicken-pizza": ["cilantro"], "black-truffle-pizza": ["parmigiano"], boscaiola: ["olive-oil"],
    "brazilian-catupiry-corn-pizza": ["corn"], "buffalo-chicken": ["buffalo-sauce", "gorgonzola"], capricciosa: ["ham"],
    "cuban-pizza": ["ham"], currywurst: ["paprika-powder"], "eggplant-ricotta-pizza": ["olive-oil"], fugazza: ["olive-oil"],
    "goulash-pizza": ["paprika-powder", "sour-cream"], "grandma-pizza": ["olive-oil"], hawaiian: ["ham"], "meat-lovers": ["ham"],
    // Fresh partial-slice audit affects new-haven at parmigiano only; olive-oil remains within the broader Owner ceiling but is not an actual change here.
    "moussaka-style-pizza": ["feta"], "new-haven-apizza": ["parmigiano"], "okonomiyaki-style-pizza": ["mayo"],
    "parmigiana-pizza": ["parmigiano"], "pesto-burrata-pizza": ["olive-oil"], "pesto-noci-pizza": ["gorgonzola"],
    "peking-duck-pizza": ["cucumber"],
    "pesto-salmone": ["lemon"], "pizza-alla-crudaiola": ["olive-oil"], "pizza-bianca": ["olive-oil"],
    "pizza-bianca-ricotta": ["olive-oil"], "pizza-cavolo-carote": ["carrot", "lemon", "olive-oil"],
    "pizza-feta-eliniki": ["feta", "olive-oil"], "pizza-finocchi-salad": ["olive-oil"], "pizza-overload": ["ham"],
    "pizza-portuguesa": ["ham"], "pizza-radicchio-noci": ["olive-oil"], "potato-mayo-pizza": ["corn", "mayo"],
    "quattro-formaggi": ["gorgonzola", "olive-oil", "parmigiano"], "reina-pepiada-pizza": ["cilantro", "mayo"],
    "shirasu-pizza": ["lemon"], "spinach-artichoke-pizza": ["parmigiano"], "taco-pizza": ["lettuce"],
    "thai-chicken-pizza": ["cilantro"], vongole: ["olive-oil"],
  };
  const changes = researchLetterChangesAcrossOrders(NEW_IDS, RECIPES as never, 40, 20261105, [], true);
  const code = (letter: string) => letter.charCodeAt(0) - 64;

  it("keeps canonical Research changes at exactly zero", () => {
    expect([...changes.values()].flat().filter((change) => change.canonical)).toEqual([]);
  });

  it("requires exactly the 42 approved affected IDs and every approved stage", () => {
    const approvedIds = Object.keys(APPROVED_STAGES).sort();
    expect(approvedIds).toHaveLength(42);
    expect([...changes.keys()].sort()).toEqual(approvedIds);
    expect(approvedIds).toContain("peking-duck-pizza");
    const actualStages = Object.fromEntries([...changes].map(([id, list]) => [id, [...new Set(list.map((item) => /, ([a-z0-9-]+) last$/.exec(item.example)?.[1]).filter((stage): stage is string => !!stage))].sort()]));
    expect(actualStages).toEqual(Object.fromEntries(Object.entries(APPROVED_STAGES).map(([id, stages]) => [id, [...stages].sort()])));
  }, 60_000);

  it("keeps every exact stage transition within its approved direction and maximum shift", () => {
    for (const [id, list] of changes) for (const item of list) {
      const stage = /, ([a-z0-9-]+) last$/.exec(item.example)?.[1];
      if (stage) expect(APPROVED_STAGES[id], `${id}/${item.example}`).toContain(stage);
      const transition = /^(-|[A-Z]+)->([A-Z]+)$/.exec(item.change);
      expect(transition, `${id}/${item.change}`).not.toBeNull();
      const [, before, after] = transition!;
      const shift = before === "-" ? code(after) - 1 : code(after) - code(before);
      expect(shift, `${id}/${item.change}`).toBeGreaterThanOrEqual(0);
      expect(shift, `${id}/${item.change}`).toBeLessThanOrEqual(id === "taco-pizza" ? 2 : 1);
    }
  }, 60_000);
});
