import { afterAll, describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Wave 2 W2-A Authoring Gate harness (see vitest.harness.config.ts). Uses the real production
 * Scoring 2.0, Completion Gate, reference-layout, persistence and entitlement code; the only
 * seam is `getReferencePizza`, which is mocked to also return a W2-A candidate reference built
 * exactly like the W1 references (RT-01 slots + the mechanical sauce reference). The W2-A
 * ingredient rows are pushed into the in-memory INGREDIENTS array for this process only.
 * Writes docs/reports/data/TETO_WAVE2_W2A_CALIBRATION.json.
 */

const ROOT = process.cwd();
const CANDIDATES = JSON.parse(readFileSync(join(ROOT, "tools/wave2-w2a/w2a_authoring_candidates.json"), "utf8"));
const GATE = JSON.parse(readFileSync(join(ROOT, "docs/design/data/TETO_WAVE2_W2A_OWNER-GATE.json"), "utf8"));
const OUT = join(ROOT, "docs/reports/data/TETO_WAVE2_W2A_CALIBRATION.json");

interface CandRecipe {
  runtimeId: string;
  nameJa: string;
  requiredIngredients: { ingredientId: string; minCount: number }[];
  bakeTarget: { start: number; end: number };
  w1Analog: string;
}

const synthetic = new Map<string, unknown>();

vi.mock("../../src/data/referencePizza", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/data/referencePizza")>();
  return {
    ...original,
    getReferencePizza: (id: string) => (synthetic.get(id) as never) ?? original.getReferencePizza(id),
  };
});

const { INGREDIENTS, getIngredient } = await import("../../src/data/ingredients");
const { getReferencePizza, buildIdealSauceFixture, MARGHERITA_REFERENCE } = await import("../../src/data/referencePizza");
const { assignReferenceSlots } = await import("../../src/logic/pizzaReferenceLayout");
const { computeScoringV2 } = await import("../../src/logic/scoringV2/index");
const { toLegacyScoreBreakdown } = await import("../../src/logic/scoringV2/toLegacyScoreBreakdown");
const { evaluatePizzaCompletion } = await import("../../src/logic/completionGate");
const { createEmptyPizza } = await import("../../src/state/pizzaState");
const { getRecipe, RECIPES } = await import("../../src/data/recipes");
const { DISCOVERY_LADDER } = await import("../../src/data/discoveryLadder");
const { resolveShopEntitlement } = await import("../../src/state/materialEntitlement");
const { loadSave, persistDex } = await import("../../src/state/persistence");

for (const ing of CANDIDATES.ingredients) {
  if (getIngredient(ing.id)) continue;
  (INGREDIENTS as unknown as Record<string, unknown>[]).push({
    id: ing.id,
    category: ing.id === "fromage-blanc-sauce" ? "sauce" : "topping",
    nameJa: ing.nameJa,
    color: ing.colorCandidate,
    emoji: "?",
    placement: ing.id === "fromage-blanc-sauce" ? "spread" : "scatter",
    unlockCondition: { minTotalStars: 0 },
  });
}

const SAUCES = new Set(["tomato-sauce", "pesto", "olive-oil", "fromage-blanc-sauce"]);
const LEAFY = new Set(["basil", "arugula", "parsley", "rosemary"]);

function buildReference(r: CandRecipe) {
  const nonSauce = r.requiredIngredients.filter((q) => !SAUCES.has(q.ingredientId));
  const sauce = r.requiredIngredients.find((q) => SAUCES.has(q.ingredientId))!;
  const groups = assignReferenceSlots(nonSauce.map((q) => ({ ingredientId: q.ingredientId, count: q.minCount })));
  return {
    recipeId: r.runtimeId,
    sauce: { ...MARGHERITA_REFERENCE.sauce, ingredientId: sauce.ingredientId },
    pieceGroups: groups.map((g) => ({
      ingredientId: g.ingredientId,
      positions: g.positions,
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: LEAFY.has(g.ingredientId) ? "LIGHT_LEAF" : "HEAVY_SQUASH",
      },
      matching: g.ingredientId === "egg" ? { fullCreditRadius: 14, zeroCreditRadius: 30 } : { fullCreditRadius: 8, zeroCreditRadius: 22 },
    })),
  };
}

function recipeOf(r: CandRecipe) {
  return {
    id: r.runtimeId,
    nameJa: r.nameJa,
    description: "",
    requiredIngredients: r.requiredIngredients,
    bakeTarget: r.bakeTarget,
    baseRewardPitz: 100,
  } as never;
}

type Pizza = ReturnType<typeof createEmptyPizza>;
const center = (t: { start: number; end: number }) => (t.start + t.end) / 2;
function ring(radius: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: 50 + Math.cos(a) * radius, y: 50 + Math.sin(a) * radius, amount: 0.02 };
  });
}

function variants(reference: ReturnType<typeof buildReference>, recipe: { bakeTarget: { start: number; end: number } }) {
  const sauceId = reference.sauce.ingredientId;
  const refPieces = reference.pieceGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `r${gi}-${i}`, ingredientId: g.ingredientId, ...p })));
  const bake = center(recipe.bakeTarget);
  const base = (over: Partial<Pizza>): Pizza => ({ ...createEmptyPizza(), sauceIds: [sauceId], sauceDeposits: buildIdealSauceFixture(), toppings: refPieces, bakeResult: bake, ...over });
  const primary = reference.pieceGroups.reduce((a, g) => (g.positions.length > a.positions.length ? g : a));
  return {
    "V0 reference-accurate": base({}),
    "V1 good (pieces ±3, sauce ring 28x24)": base({ sauceDeposits: ring(28, 24), toppings: refPieces.map((p, i) => ({ ...p, x: p.x + (i % 2 ? 3 : -3), y: p.y + (i % 2 ? -3 : 3) })) }),
    "V2 careless sauce (dumped at one spot)": base({ sauceDeposits: Array.from({ length: 10 }, () => ({ x: 55, y: 55, amount: 0.02 })) }),
    "V3 careless placement (all pieces in one corner)": base({ toppings: refPieces.map((p, i) => ({ ...p, x: 24 + (i % 3) * 4, y: 24 + Math.floor(i / 3) * 4 })) }),
    "V4 quantity short (1 of each)": base({ toppings: reference.pieceGroups.map((g, gi) => ({ id: `s${gi}`, ingredientId: g.ingredientId, ...g.positions[0] })) }),
    "V5 quantity over (+2 primary)": base({ toppings: [...refPieces, { id: "x1", ingredientId: primary.ingredientId, x: 50, y: 50 }, { id: "x2", ingredientId: primary.ingredientId, x: 44, y: 56 }] }),
    "V6 bake at window edge + 4 (burnt, inside Completion margin)": base({ bakeResult: recipe.bakeTarget.end + 4 }),
    "V7 bake far over (end + 15)": base({ bakeResult: recipe.bakeTarget.end + 15 }),
    "V8 bake far under (start - 15)": base({ bakeResult: recipe.bakeTarget.start - 15 }),
    "V9 missing one required topping": base({ toppings: refPieces.filter((p) => p.ingredientId !== primary.ingredientId) }),
    "V10 no sauce": base({ sauceIds: [], sauceDeposits: [] }),
  } as Record<string, Pizza>;
}

function evaluate(recipe: never, pizza: Pizza) {
  const s = computeScoringV2(recipe, pizza);
  const legacy = toLegacyScoreBreakdown(s, pizza.bakeResult, (recipe as { bakeTarget: { start: number; end: number } }).bakeTarget);
  const recipePolicy = evaluatePizzaCompletion(recipe, pizza, "recipe");
  const orderPolicy = evaluatePizzaCompletion(recipe, pizza, "order");
  return {
    total: s.totalScore === null ? null : Math.round(s.totalScore * 10) / 10,
    stars: legacy?.stars ?? null,
    components: {
      sauce: s.components.sauce.available ? Math.round((s.components.sauce as { score: number }).score * 1000) / 1000 : null,
      pieces: s.components.pieces.available ? Math.round((s.components.pieces as { score: number }).score * 1000) / 1000 : null,
      recipe: s.components.recipe.available ? Math.round((s.components.recipe as { score: number }).score * 1000) / 1000 : null,
      bake: s.components.bake.available ? Math.round((s.components.bake as { score: number }).score * 1000) / 1000 : null,
    },
    completionFree: recipePolicy.status === "PASS" ? "PASS" : `FAILED:${(recipePolicy as { failures: { reason: string }[] }).failures.map((f) => f.reason).join("+")}`,
    completionOrder: orderPolicy.status === "PASS" ? "PASS" : `FAILED:${(orderPolicy as { failures: { reason: string }[] }).failures.map((f) => f.reason).join("+")}`,
  };
}

const out: Record<string, unknown> = { calibration: {}, analogs: {}, saveCompatibility: {} };

describe("W2-A scoring / completion calibration (candidates)", () => {
  for (const r of CANDIDATES.recipes as CandRecipe[]) {
    it(r.runtimeId, () => {
      const reference = buildReference(r);
      synthetic.set(r.runtimeId, reference);
      expect(getReferencePizza(r.runtimeId)).toBe(reference);
      const recipe = recipeOf(r);
      const rows = Object.fromEntries(Object.entries(variants(reference, r)).map(([k, p]) => [k, evaluate(recipe, p)]));
      (out.calibration as Record<string, unknown>)[r.runtimeId] = {
        pieces: reference.pieceGroups.reduce((n, g) => n + g.positions.length, 0),
        reference: reference.pieceGroups.map((g) => ({ ingredientId: g.ingredientId, positions: g.positions, landingStyle: g.interaction.landingStyle })),
        bakeTarget: r.bakeTarget,
        variants: rows,
      };
      const v = rows as Record<string, ReturnType<typeof evaluate>>;
      expect(v["V0 reference-accurate"].completionFree).toBe("PASS");
      expect(v["V0 reference-accurate"].completionOrder).toBe("PASS");
      expect(v["V0 reference-accurate"].stars).toBe(5);
      expect(v["V0 reference-accurate"].total!).toBeGreaterThan(v["V1 good (pieces ±3, sauce ring 28x24)"].total!);
      expect(v["V1 good (pieces ±3, sauce ring 28x24)"].total!).toBeGreaterThan(v["V2 careless sauce (dumped at one spot)"].total!);
      expect(v["V0 reference-accurate"].total!).toBeGreaterThan(v["V3 careless placement (all pieces in one corner)"].total!);
    });
  }
  // The same variants on the W1 analogs (real production references), for comparison.
  for (const id of ["salsiccia", "new-haven-apizza", "breakfast-pizza", "pesto-tonno", "pesto-caprese", "melanzane-pizza", "funghi", "hawaiian"] as const) {
    it(`analog ${id}`, () => {
      const recipe = getRecipe(id)!;
      const reference = getReferencePizza(id)!;
      const rows = Object.fromEntries(Object.entries(variants(reference as never, recipe)).map(([k, p]) => [k, evaluate(recipe as never, p)]));
      (out.analogs as Record<string, unknown>)[id] = { variants: rows };
      expect((rows["V0 reference-accurate"] as { stars: number }).stars).toBe(5);
    });
  }
});

describe("W2-A save compatibility", () => {
  const w1Finite = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds);
  const appended = (GATE.ladder as { step: number; ingredientIds: string[]; keyRecipeId: string }[]).filter((s) => s.step >= 25);
  const w2aLadder = { populationId: "w2a-34", steps: [...DISCOVERY_LADDER.steps, ...appended.map((s) => ({ ...s, kind: "MATERIAL" as const }))] };
  const w1Ids = RECIPES.map((r) => r.id);
  const w2aIds = (CANDIDATES.recipes as CandRecipe[]).map((r) => r.runtimeId);
  const dexOf = (ids: readonly string[]) => ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 }));
  const saves: Record<string, { dex: string[]; owned: string[] }> = {
    "Dex 0": { dex: [], owned: [] },
    "W1 mid (10 discovered)": { dex: w1Ids.slice(0, 10), owned: w1Finite.slice(0, 8) },
    "W1 complete (25 discovered)": { dex: w1Ids, owned: w1Finite },
    "future ids (W1 complete + 3 W2-A discovered, W2-A materials owned)": { dex: [...w1Ids, ...w2aIds.slice(0, 3)], owned: [...w1Finite, "prosciutto-crudo", "fromage-blanc-sauce", "arugula"] },
  };
  for (const [name, s] of Object.entries(saves)) {
    it(name, () => {
      const dex = dexOf(s.dex);
      const before = resolveShopEntitlement(dex as never, s.owned, [], DISCOVERY_LADDER);
      const after = resolveShopEntitlement(dex as never, s.owned, [], w2aLadder as never);
      const w1Part = after.unlockedForShopIngredientIds.filter((id) => w1Finite.includes(id));
      const beforeW1 = before.unlockedForShopIngredientIds.filter((id) => w1Finite.includes(id));
      expect([...w1Part].sort()).toEqual([...beforeW1].sort());
      // Current build (pre-W2-A) loading a save that already holds W2-A ids: nothing is lost on write.
      const storage = new Map<string, string>();
      const store = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) };
      const raw = {
        schemaVersion: 2,
        dex,
        pitzBalance: 300,
        ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...s.owned],
        missionBest: {},
        inventory: Object.fromEntries(s.owned.map((id) => [id, 5])),
        starterGrantClaimedRecipeIds: [],
        unlockedForShopIngredientIds: s.owned,
      };
      const key = Object.keys(localStorage).length ? Object.keys(localStorage)[0] : "teto-pizza-save-v1";
      store.setItem(key, JSON.stringify(raw));
      const loaded = loadSave(store);
      persistDex([...loaded.dex, { recipeId: "margherita", discovered: true, bestScore: 99, bestStars: 5, timesMade: 9 }].filter((e, i, a) => a.findIndex((x) => x.recipeId === e.recipeId) === i) as never, store);
      const written = JSON.parse(storage.get(key) ?? "null");
      const futureKept = {
        dex: w2aIds.filter((id) => s.dex.includes(id)).every((id) => JSON.stringify(written).includes(`"${id}"`)),
        owned: s.owned.filter((id) => !w1Finite.includes(id)).every((id) => JSON.stringify(written).includes(`"${id}"`)),
      };
      (out.saveCompatibility as Record<string, unknown>)[name] = {
        discoveredCount: s.dex.length,
        w1EntitlementUnchanged: true,
        entitlementBefore: before.unlockedForShopIngredientIds.length,
        entitlementAfterW2A: after.unlockedForShopIngredientIds.length,
        newlyEntitledByW2A: after.unlockedForShopIngredientIds.filter((id) => !w1Finite.includes(id)),
        currentBuildLoad: { schemaVersion: loaded.schemaVersion, knownDex: loaded.dex.length },
        forwardCompatAfterWrite: futureKept,
      };
      expect(loaded.schemaVersion).toBe(2);
      expect(futureKept.dex && futureKept.owned).toBe(true);
    });
  }
});

afterAll(() => {
  writeFileSync(OUT, `${JSON.stringify({ schema: "teto-wave2-w2a-calibration/1", generatedBy: "tools/wave2-w2a/w2a.harness.test.ts (real Scoring 2.0 / Completion Gate / persistence; candidate values)", ...out }, null, 1)}\n`);
});
