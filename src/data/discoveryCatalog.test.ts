import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG, RECIPE_DISCOVERY_TARGET_IDS } from "./discoveryCatalog";
import { RECIPES, type BaseRecipeId } from "./recipes";
import { getReferencePizza } from "./referencePizza";
import { isLateRecipeId, referencePizzaWithLateStage } from "../logic/catalog/testSupport/lateIds";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import {
  fullyObservedSignatureFor,
  phase2CollisionFreeByProfile,
  phase2DiscoveryTargets,
  phase2Targets,
  type Phase2Profile,
} from "../logic/discovery/testSupport/phase2Matrix";
import { noSauceRecipeIds } from "./recipeSauceProfiles";
import { LATE_DISCOVERY_TARGET_IDS } from "./lateCatalog";

function signatureKey(t: { items: readonly string[]; identityDimensions: unknown }): string {
  return JSON.stringify([[...t.items].sort(), t.identityDimensions]);
}

const BATCH10_PHASE2_BLOCKED_OWNER_APPROVED: readonly string[] = ["curry-pizza-japan", "rendang-pizza", "tandoori-paneer-pizza"];
// B11 S1 (PROVISIONAL SPEC, ORIGINAL NOT CONFIRMED): the Phase-2 matrix classifies these two rows BLOCKED_PRODUCT_DECISION (COMPOSITION_CONFLICT_CANDIDATE), so they have no SHIPPED_KEEP target; the Owner approval of B11 S1 ships them.
// expansionBatch11.s1.test.ts pins their exact ingredient sets.
const B11_PHASE2_BLOCKED_OWNER_APPROVED: readonly string[] = ["boscaiola", "porcini-pizza"];
// B12 (Issue #706): the Phase-2 matrix classifies these two rows BLOCKED_PRODUCT_DECISION (BASE_SAUCE_UNSPECIFIED: the source sauce field is 'その他'). They are implemented as NO_SAUCE
// as a GAMEPLAY ASSUMPTION and are NOT yet Owner-approved: the Owner's decision on that assumption is a merge condition of the B12 PR (not a precedent for later batches).
const B12_PHASE2_BLOCKED_PENDING_OWNER: readonly string[] = ["caponata-pizza", "jamaican-jerk-chicken-pizza"];

describe("RECIPE_DISCOVERY_CATALOG (P3-1 runtime catalog)", () => {
  it("has exactly one target per production recipe, in RECIPES order", () => {
    expect(RECIPE_DISCOVERY_CATALOG.map((t) => t.recipeId)).toEqual(RECIPES.map((r) => r.id));
    expect(new Set(RECIPE_DISCOVERY_CATALOG.map((t) => t.targetId)).size).toBe(RECIPES.length);
  });

  it("every target is identical to its Phase-2 SHIPPED_KEEP target (items, capabilities, dimensions)", () => {
    const phase2 = new Map(phase2Targets("SHIPPED_KEEP").map((t) => [t.targetId, t]));
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      if (t.recipeId === "brazilian-calabresa") continue; // PR-4b-B: production-only (no Phase-2 row)
      // Expansion Batch 10 PR-1 (docs/decisions/TETO_EXPANSION-BATCH-10_PR1_OWNER-DECISIONS.md): the Phase-2 design matrix classifies these three rows BLOCKED_EVIDENCE (the curry base sauce is unresolved / unspecified there);
      // the Owner's approval (curry-ketchup as the base, D-B3) supersedes it, so they have no SHIPPED_KEEP target. expansionBatch10.pr1.test.ts pins their exact ingredient sets.
      if (BATCH10_PHASE2_BLOCKED_OWNER_APPROVED.includes(t.recipeId)) continue;
      if (B11_PHASE2_BLOCKED_OWNER_APPROVED.includes(t.recipeId)) continue;
      if (B12_PHASE2_BLOCKED_PENDING_OWNER.includes(t.recipeId)) continue;
      if (isLateRecipeId(t.recipeId)) continue; // E5: the late target has no Phase-2 row; lateCatalog.ikura.test.ts pins it
      const expected = phase2.get(RECIPE_DISCOVERY_TARGET_IDS[t.recipeId as BaseRecipeId]);
      expect(expected, t.recipeId).toBeDefined();
      // Square Dough E-2: the Phase-2 row of grandma-pizza lists MULTI_SPREAD_LAYER and `spreadLayers: [olive-oil, tomato-sauce]`, but no capability of that name is runtime-supported (a target that requires one is unmatchable)
      // and the runtime does not observe `spreadLayers` (null, like every other target); the two-sauce engine (B1 / B2) needs neither, and the two sauces are already in \`items\` / \`sauceBase\`. Its identity instead declares
      // \`pan: "tray"\` (Owner decision 2026-10-17/18, F1: the pan axis is OBSERVED). Everything else about the target stays checked.
      const grandma = t.recipeId === "grandma-pizza";
      // B11 S1, the ONLY Owner-approved deviation from a SHIPPED_KEEP target (Owner decision 2026-10-28, option A; GAMEPLAY ASSUMPTION, original NOT confirmed): pescatore omits the matrix's olive-oil (a single tomato-sauce, no MULTI_SPREAD_LAYER).
      // Exactly three differences are allowed and each is asserted below: items without olive-oil, no capability, `spreadLayers: null`. Every other item / dimension is still compared with the matrix, which is unchanged.
      const pescatore = t.recipeId === "pescatore";
      const expectedItems = pescatore ? expected!.items.filter((i) => i !== "olive-oil") : expected!.items;
      if (pescatore) {
        expect(expected!.items).toContain("olive-oil");
        expect(expected!.capabilities).toEqual(["MULTI_SPREAD_LAYER"]);
        expect(expected!.identityDimensions.spreadLayers).toEqual(["tomato-sauce", "olive-oil"]);
      }
      expect(t.items).toEqual([...expectedItems].sort());
      expect(t.capabilities).toEqual(grandma || pescatore ? [] : expected!.capabilities);
      expect(t.identityDimensions).toEqual(
        grandma ? { ...expected!.identityDimensions, spreadLayers: null, pan: "tray" } : pescatore ? { ...expected!.identityDimensions, spreadLayers: null } : expected!.identityDimensions,
      );
      expect(t.eligibility).toEqual({ status: "ELIGIBLE" });
    }
  });

  it("covers every Phase-2 shipped:* target, and tonno-e-cipolla via its corroborating row", () => {
    const shipped = phase2Targets("SHIPPED_KEEP").filter((t) => t.source === "shipped-src").map((t) => t.targetId);
    const mapped = Object.values(RECIPE_DISCOVERY_TARGET_IDS);
    expect(shipped).toHaveLength(14);
    for (const id of shipped) expect(mapped).toContain(id);
    const tonno = phase2Targets("SHIPPED_KEEP").find((t) => t.targetId === RECIPE_DISCOVERY_TARGET_IDS["tonno-e-cipolla"]);
    expect(tonno?.productDecisionStatus).toBe("ALREADY_SHIPPED_CORROBORATED");
  });

  it("every target declares its base: exactly the recipe's sauce-category ingredients", () => {
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      expect(t.sauceBase, t.recipeId).toBeDefined();
      // TQ-1D: a NO_SAUCE recipe (derived from the sauce-profile authority) declares an EMPTY base (the Technique no-sauce); every other recipe has a sauce.
      if ((noSauceRecipeIds() as readonly string[]).includes(t.recipeId)) expect(t.sauceBase).toEqual([]);
      else expect(t.sauceBase!.length, t.recipeId).toBeGreaterThan(0);
      for (const id of t.sauceBase!) expect(t.items).toContain(id);
    }
    expect(RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "quattro-formaggi")?.sauceBase).toEqual(["olive-oil"]);
    expect(RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "genovese")?.sauceBase).toEqual(["pesto"]);
  });

  it("all runtime signatures are unique", () => {
    const keys = RECIPE_DISCOVERY_CATALOG.map(signatureKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("12. every shipped recipe's own reference pizza is discovered as that recipe, and only it", () => {
    for (const recipe of RECIPES) {
      const reference = getReferencePizza(recipe.id)!;
      const pizza = referencePizzaWithLateStage(recipe, reference);
      // E5: the late recipe's FINISH pieces carry `stage: "post"` (referencePizzaWithLateStage).
      expect(evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, [])).toEqual({
        kind: "NEW_DISCOVERY",
        recipeId: recipe.id,
        targetId: RECIPE_DISCOVERY_TARGET_IDS[recipe.id as BaseRecipeId] ?? LATE_DISCOVERY_TARGET_IDS[recipe.id],
      });
    }
  });
});

describe.each<Phase2Profile>(["SHIPPED_KEEP", "EVIDENCE_STRICT"])("Phase-2 %s parity in TypeScript", (profile) => {
  const targets = phase2DiscoveryTargets(profile);

  it("has the Phase-2 target count and 0 signature collisions (as the Phase-2 validator reports)", () => {
    expect(targets).toHaveLength(profile === "SHIPPED_KEEP" ? 101 : 87);
    expect(phase2CollisionFreeByProfile(profile)).toEqual([]);
    const keys = targets.map(signatureKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("with every dimension observed and every capability supported, each target matches only itself", () => {
    const allCapabilities = [...new Set(targets.flatMap((t) => t.capabilities))];
    for (const t of targets) {
      const result = matchDiscovery(fullyObservedSignatureFor(t), targets, { supportedCapabilities: allCapabilities });
      expect(result.kind === "UNIQUE_MATCH" && result.target.targetId, t.targetId).toBe(t.targetId);
    }
  });
});
