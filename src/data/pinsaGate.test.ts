import { describe, expect, it } from "vitest";
import { DEFAULT_DOUGH_KIND } from "../logic/dough/doughKind";
import { buildHint5Ladder } from "../logic/discovery/hint5Ladder";
import { deriveResearchEntries, researchCohortLetters } from "../logic/discovery/researchEntry";
import { techniqueDexViews } from "../logic/techniques/dexView";
import { DINNER_MISSIONS } from "../mission/dinner/dinnerMission";
import { buildRecipeChapters } from "../state/recipeChapters";
import { isCutEligible } from "./cookingProfiles";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { INGREDIENTS } from "./ingredients";
import { ALL_LATE_RECIPE_IDS, LATE_DISCOVERY_TARGET_IDS, LATE_ORDERS, LATE_RECIPES, isGatedOffRecipeId, isInactiveLateRecipeId } from "./lateCatalog";
import { ORDERS } from "./orders";
import { PINSA_PRODUCTION, pinsaEnabled } from "./pinsaGate";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { RECIPE_SAUCE_PROFILES, noSauceRecipeIds } from "./recipeSauceProfiles";
import { RECIPES, getRecipe, participatesInLunchRush } from "./recipes";
import { getReferencePizza, listReferencePizzas } from "./referencePizza";

/**
 * Pinsa Romana public gate (#577 P3-b, Owner option A): the REAL modules, nothing mocked. While `PINSA_PRODUCTION` is false (the shipped value) Pinsa must not
 * exist on any path a player or a save can reach: recipe, order, Dex / discovery target, ladder, Research, Hint, technique, chapter, Reference, Dinner, Lunch Rush.
 * The type-keyed tables keep a `pinsa-romana` row (so `RecipeId` is exhaustive); every reader of those tables is checked here.
 * The ON state is exercised, with the gate mocked, in lateCatalog.pinsa.test.ts. Changing the literal is a separate Owner decision (the
 * original-source check and the iPhone Safari Human Verification come first).
 */
const PINSA = "pinsa-romana";
const WORDS = /ピンサ|ロマーナ|pinsa|romana|material-multigrain/i;

/** `TETO_PINSA_ON=1` (vitest.config.ts) compiles the gate open to rehearse the publish: the runtime OFF checks below are then skipped, and the shipped TEXT is still pinned. */
const REHEARSING_ON = pinsaEnabled();

describe("the gate literal", () => {
  it("is false in the shipped source (publishing Pinsa is a separate Owner approval; the text is read raw, so a rehearsal run cannot hide a flipped literal)", () => {
    const sources = import.meta.glob<string>("./pinsaGate.ts", { query: "?raw", import: "default", eager: true });
    const text = Object.values(sources)[0];
    expect(text).toMatch(/^export const PINSA_PRODUCTION = false;$/m);
    expect(text).not.toMatch(/import\.meta\.env/);
    if (!REHEARSING_ON) {
      expect(PINSA_PRODUCTION).toBe(false);
      expect(pinsaEnabled()).toBe(false);
    }
  });
});

describe.skipIf(REHEARSING_ON)("OFF: Pinsa exists in no runtime catalog", () => {
  it("RECIPES / ORDERS / discovery catalog / ladder / ingredients / late arrays name no Pinsa", () => {
    for (const [name, value] of Object.entries({ RECIPES, ORDERS, RECIPE_DISCOVERY_CATALOG, DISCOVERY_LADDER, INGREDIENTS, LATE_RECIPES, LATE_ORDERS, LATE_DISCOVERY_TARGET_IDS })) {
      expect(JSON.stringify(value), name).not.toMatch(WORDS);
    }
  });
  it("the late catalog (ON in Production since E5) still holds exactly ikura: it is not the late switch that publishes Pinsa", () => {
    expect(LATE_RECIPES.map((r) => r.id)).toEqual(["ikura-salmon-pizza"]);
    expect(RECIPES.at(-1)!.id).toBe("ikura-salmon-pizza");
    expect(DISCOVERY_LADDER.steps.at(-1)).toMatchObject({ step: DISCOVERY_LADDER.steps.length, keyRecipeId: "ikura-salmon-pizza" });
  });
  it("every lookup by id comes back empty", () => {
    expect(getRecipe(PINSA as never)).toBeUndefined();
    expect(Object.keys(LATE_DISCOVERY_TARGET_IDS)).not.toContain(PINSA);
    expect(ORDERS.some((o) => (o.recipeId as string) === PINSA)).toBe(false);
    expect(RECIPE_DISCOVERY_CATALOG.some((t) => (t.recipeId as string) === PINSA)).toBe(false);
    expect(participatesInLunchRush(PINSA)).toBe(true); // an unknown id defaults to "participates", but is in no pool because it is in no catalog
    expect(RECIPES.filter((r) => participatesInLunchRush(r.id)).some((r) => (r.id as string) === PINSA)).toBe(false);
    expect(isCutEligible(PINSA as never)).toBe(false);
  });
  it("the type-keyed tables keep their row, and every reader hides it", () => {
    expect(Object.keys(RECIPE_SAUCE_PROFILES)).toContain(PINSA);
    expect(Object.keys(RECIPE_HINT_ROLES)).toContain(PINSA);
    expect(isGatedOffRecipeId(PINSA)).toBe(true);
    expect(isInactiveLateRecipeId(PINSA)).toBe(true);
    expect(isGatedOffRecipeId("ikura-salmon-pizza")).toBe(false); // the gate is Pinsa-only: ikura (E5) is unchanged
    expect(ALL_LATE_RECIPE_IDS).toEqual(["ikura-salmon-pizza", PINSA]);
    expect(getReferencePizza(PINSA)).toBeNull();
    expect(listReferencePizzas().some((r) => (r.recipeId as string) === PINSA)).toBe(false);
    expect(JSON.stringify(listReferencePizzas())).not.toMatch(WORDS);
    expect((noSauceRecipeIds() as readonly string[]).includes(PINSA)).toBe(false);
    expect(buildHint5Ladder(PINSA)).toBeNull();
  });
  it("Dinner never targets it and every runtime recipe keeps the standard dough", () => {
    expect(DINNER_MISSIONS.flatMap((m) => m.targetRecipeIds as readonly string[])).not.toContain(PINSA);
    for (const r of RECIPES) expect((r as { doughKind?: string }).doughKind ?? DEFAULT_DOUGH_KIND).toBe("standard");
    expect(RECIPE_DISCOVERY_CATALOG.every((t) => t.identityDimensions.dough === "standard")).toBe(true);
  });
});

describe.skipIf(REHEARSING_ON)("OFF: Research, Hint and the technique Dex show nothing of Pinsa, at any progress", () => {
  const allOwned = INGREDIENTS.map((i) => i.id);

  it("Research candidates (every material owned, empty Dex) never contain it, and arugula's cohort is jamon alone (no letter)", () => {
    const entries = deriveResearchEntries({ dex: [], ownedIngredientIds: allOwned }).entries;
    expect(entries.map((e) => e.recipeId as string)).not.toContain(PINSA);
    expect(JSON.stringify(entries)).not.toMatch(WORDS);
    expect(entries.find((e) => (e.recipeId as string) === "jamon-serrano-pizza")?.cohortLetter ?? null).toBeNull();
    expect(researchCohortLetters(allOwned).has(PINSA)).toBe(false);
    expect(researchCohortLetters(allOwned).has("jamon-serrano-pizza")).toBe(false);
  });
  it("the chapters list neither the recipe nor a changed total", () => {
    expect(JSON.stringify(buildRecipeChapters())).not.toMatch(WORDS);
  });
  it("the technique Dex never offers the dough technique (INV-TQ-4: no catalog target requires it), at every credited count", () => {
    const dexOf = (n: number) => RECIPES.slice(0, n).map((r) => ({ recipeId: r.id, discovered: true, bestScore: 0, bestStars: 1 as const, timesMade: 1 }));
    for (const n of [0, 10, 33, 50, RECIPES.length]) {
      const views = techniqueDexViews([], dexOf(n));
      expect(views.some((v) => v.id === "dough-pinsa-romana"), `dex ${n}`).toBe(false);
      expect(JSON.stringify(views), `dex ${n}`).not.toMatch(WORDS);
    }
  });
});
