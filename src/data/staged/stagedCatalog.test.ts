import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../ingredients";
import { pinsaEnabled } from "../pinsaGate";
import { RECIPES } from "../recipes";
import {
  IN_FLIGHT_RECIPE_IDS,
  isBlocking,
  stagedDependencies,
  stagedDuplicateGate,
  validateStagedCatalog,
  type ShippedView,
} from "./stagedCatalog";
import { STAGED_INGREDIENTS } from "./testSupport/stagedIngredients";
import { STAGED_MECHANICS } from "./stagedMechanics";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";

const SHIPPED: ShippedView = { recipes: RECIPES, ingredientIds: INGREDIENTS.map((i) => i.id) };
const PLAN = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "docs", "reports", "data", "TETO_FULL-EXPANSION-177_plan.json"), "utf8"),
) as { recipes: { evidenceId: string; inFlight: string | null }[]; ingredients: { id: string }[] };

describe("Staged Catalog — WS-R / WS-I registration (Issue #780)", () => {
  // Expansion Batch 21 (#780): taco-pizza and okonomiyaki-style-pizza (and their 6 new ingredients) shipped from the staged population (the plan data file is a frozen 2026-11-07 record).
  const B21_EVIDENCE_IDS = ["taco-pizza-pizzadb", "okonomiyaki-style-pizza-pizzadb-p1"];
  const B21_INGREDIENT_IDS = ["cheddar", "lettuce", "tortilla-chips", "okonomiyaki-sauce", "cabbage", "bonito-flakes"];
  it("registers all 82 recipes: the 87 unshipped plan rows minus the 3 owned by in-flight work and the 2 shipped by Batch 21 (177 = shipped + 82)", () => {
    expect(STAGED_RECIPES).toHaveLength(82);
    const planned = PLAN.recipes.filter((r) => !r.inFlight && !B21_EVIDENCE_IDS.includes(r.evidenceId)).map((r) => r.evidenceId).sort();
    expect(STAGED_RECIPES.map((r) => r.evidenceId).sort()).toEqual(planned);
    expect(PLAN.recipes.filter((r) => r.inFlight)).toHaveLength(3);
    // In-flight ids that have shipped (pesto-burrata-pizza / pizza-alla-crudaiola via PR #783, pesto-noci-pizza via Batch 20-A #790) are already inside RECIPES: count them once.
    const shippedIds = new Set(RECIPES.map((r) => r.id as string));
    const shippedInFlight = Object.keys(IN_FLIGHT_RECIPE_IDS).filter((id) => shippedIds.has(id));
    expect(shippedInFlight).toEqual(["pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza", "taco-pizza", "okonomiyaki-style-pizza"]);
    expect(RECIPES.length + STAGED_RECIPES.length).toBe(pinsaEnabled() ? 177 : 176);
    expect(Object.keys(IN_FLIGHT_RECIPE_IDS).sort()).toEqual(["okonomiyaki-style-pizza", "pesto-burrata-pizza", "pesto-noci-pizza", "pizza-alla-crudaiola", "taco-pizza"]);
  });

  it("registers all 64 ingredient candidates (the 73 minus burrata / honey / walnut and the 6 shipped by Batch 21); provisional I-1 / I-2 only change their status", () => {
    expect(STAGED_INGREDIENTS).toHaveLength(64);
    const planned = PLAN.ingredients.map((i) => i.id).filter((i) => !["burrata", "honey", "walnut", ...B21_INGREDIENT_IDS].includes(i)).sort();
    expect(STAGED_INGREDIENTS.map((i) => i.id).sort()).toEqual(planned);
    const byStatus = Object.fromEntries(["ACTIVE", "ALIASED_PROVISIONAL", "MERGED_PROVISIONAL"].map((s) => [s, STAGED_INGREDIENTS.filter((i) => i.status === s).map((i) => i.id)]));
    expect(byStatus).toMatchInlineSnapshot(`
      {
        "ACTIVE": [
          "aji-amarillo",
          "apple",
          "asparagus",
          "balsamic-vinegar",
          "banana",
          "blueberry",
          "brick-cheese",
          "brie",
          "buffalo-sauce",
          "caciocavallo",
          "carrot",
          "cauliflower",
          "celery",
          "cheese-curd",
          "chicken-tikka",
          "chicory",
          "chocolate",
          "chutney",
          "condensed-milk",
          "cucumber",
          "cumin",
          "daikon",
          "eel",
          "fennel",
          "french-fries",
          "graham-cracker",
          "gravy-sauce",
          "halloumi",
          "kebab-sauce",
          "kimchi",
          "kiwi",
          "lime",
          "liver-pate",
          "marshmallow",
          "melted-butter",
          "mentaiko",
          "mochi",
          "natto",
          "okra",
          "orange",
          "peanut-sauce",
          "pecorino",
          "peking-duck",
          "powdered-sugar",
          "radicchio",
          "red-cabbage",
          "rock-salt",
          "sansho-pepper",
          "spicy-salami",
          "squid",
          "strawberry",
          "sunflower-seeds",
          "sweet-bean-sauce",
          "truffle",
          "yakiniku-sauce",
          "yogurt-sauce",
          "zaatar",
        ],
        "ALIASED_PROVISIONAL": [
          "blue-cheese-dressing",
          "chili-powder",
          "cotija",
          "ground-beef",
          "salsa",
        ],
        "MERGED_PROVISIONAL": [
          "nutella-spread",
          "puntarelle",
        ],
      }
    `);
  });

  it("is structurally valid against the shipped catalog (ids, references, statuses, lanes)", () => {
    expect(validateStagedCatalog(SHIPPED)).toEqual([]);
  });

  it("every mechanic dependency is registered, and the registry matches the real production gates", () => {
    const keys = new Set(STAGED_MECHANICS.map((m) => m.key));
    for (const r of STAGED_RECIPES) for (const m of r.mechanics) expect(keys.has(m)).toBe(true);
    // GATED_OFF rows: the gate file's literal, read as TEXT (importing the fry gate would break #749's unwired-isolation guard).
    const GATE_FILES: Record<string, string> = { PREP: "prepExperienceGate.ts", FRY: "fryExperienceGate.ts" };
    const gated = STAGED_MECHANICS.filter((x) => x.state === "GATED_OFF").map((x) => x.key).sort();
    expect(gated).toEqual(Object.keys(GATE_FILES).sort());
    for (const key of gated) {
      const text = readFileSync(join(__dirname, "..", GATE_FILES[key]), "utf8");
      expect([key, text.match(/^export const [A-Z_]+_PRODUCTION = (true|false);$/m)?.[1]]).toEqual([key, "false"]);
    }
  });

  // The golden is measured on the Production catalog (Pinsa ON). The Pinsa rollback build (`npm run test:pinsa-off`) has one recipe fewer, so it skips this one.
  it.skipIf(!pinsaEnabled())("duplicate gate and dependency ledger (measured; changes must be reviewed)", async () => {
    const dup = stagedDuplicateGate(SHIPPED);
    const perRecipe = STAGED_RECIPES.map((r) => {
      const deps = stagedDependencies(r, dup[r.id], undefined, SHIPPED.ingredientIds);
      return { id: r.id, lane: r.lane, blocking: deps.filter(isBlocking).map((d) => `${d.kind}:${d.id}`), staged: deps.filter((d) => !isBlocking(d)).map((d) => d.id), dup: dup[r.id] };
    });
    const KINDS = ["IDENTICAL", "SUBSET", "SUPERSET", "ONE_DIFF", "JACCARD_GT_0_4"];
    const count = (pred: (k: string) => boolean) => perRecipe.reduce((n, r) => n + r.blocking.filter(pred).length, 0);
    const summary = {
      recipes: perRecipe.length,
      readyForPromotion: perRecipe.filter((r) => r.blocking.length === 0).map((r) => r.id),
      recipesWithBlockingDeps: perRecipe.filter((r) => r.blocking.length > 0).length,
      blockingDeps: perRecipe.reduce((n, r) => n + r.blocking.length, 0),
      byKind: Object.fromEntries(["OWNER_RULE", "MECHANIC", "INGREDIENT_IN_FLIGHT", "UNRESOLVED_TOKEN", "SAUCE_UNSPECIFIED", "DUPLICATE_GATE", "ID_SUFFIXED"].map((k) => [k, count((d) => d.startsWith(`${k}:`))])),
      recipesBlockedOnlyBy: Object.fromEntries(
        ["OWNER_RULE", "MECHANIC", "DUPLICATE_GATE"].map((k) => [k, perRecipe.filter((r) => r.blocking.length > 0 && r.blocking.every((d) => d.startsWith(`${k}:`))).length]),
      ),
      duplicateGate: {
        // recipe-level: how many staged recipes have at least one hit of the kind
        recipesVsShipped: Object.fromEntries(KINDS.map((k) => [k, perRecipe.filter((r) => r.dup.some((h) => !h.againstStaged && h.kind === k)).length])),
        recipesVsStaged: Object.fromEntries(KINDS.map((k) => [k, perRecipe.filter((r) => r.dup.some((h) => h.againstStaged && h.kind === k)).length])),
        recipesWithNoHit: perRecipe.filter((r) => r.dup.length === 0).length,
        recipesWithNoShippedHit: perRecipe.filter((r) => !r.dup.some((h) => !h.againstStaged)).length,
        hitsVsShipped: perRecipe.reduce((n, r) => n + r.dup.filter((h) => !h.againstStaged).length, 0),
      },
      stagedIngredientRefs: perRecipe.reduce((n, r) => n + r.staged.length, 0),
    };
    await expect(JSON.stringify({ summary, perRecipe }, null, 1) + "\n").toMatchFileSnapshot("./__golden__/stagedGate.json");
  });
});
