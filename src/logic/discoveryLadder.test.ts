import { describe, expect, it } from "vitest";
import {
  DISCOVERY_LADDER,
  SHIPPED_15_DISCOVERY_LADDER,
  type DiscoveryLadder,
} from "../data/discoveryLadder";
import { RECIPES } from "../data/recipes";
import { EMPTY_DEX, type DexEntry, type DexState } from "../state/dex";
import {
  discoveredRecipeCount,
  isMaterialUnlocked,
  ladderUnlockedMaterialIds,
  materialIdsOfSteps,
  nextLadderStep,
  normalizeDiscoveredCount,
  reachedLadderSteps,
  reachedStepNumber,
  resolveMaterialUnlocks,
  validateDiscoveryLadder,
} from "./discoveryLadder";
import { REC04_STARTERS, REC04_W1_25_LADDER_FIXTURE } from "./testSupport/discoveryLadderRule";

const LADDER = SHIPPED_15_DISCOVERY_LADDER;
const W1_LADDER = REC04_W1_25_LADDER_FIXTURE;

/** Expected cumulative materials of the shipped-15 ladder, index = discovered count. */
const EXPECTED_SHIPPED_15_BY_COUNT: readonly (readonly string[])[] = (() => {
  const rows: string[][] = [[]];
  for (const step of LADDER.steps) rows.push([...rows[rows.length - 1], ...step.ingredientIds]);
  return rows;
})();

function dexEntry(recipeId: string, discovered = true): DexEntry {
  return { recipeId, discovered, bestScore: 0, bestStars: 1, timesMade: 1 };
}

describe("normalizeDiscoveredCount", () => {
  it.each([
    [0, 0],
    [1, 1],
    [14, 14],
    [15, 15],
    [1000, 1000],
    [3.9, 3],
    [-1, 0],
    [-0.5, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeDiscoveredCount(input)).toBe(expected);
  });
});

describe("discoveredRecipeCount", () => {
  it("is 0 for an empty Dex", () => {
    expect(discoveredRecipeCount(EMPTY_DEX)).toBe(0);
  });

  it("counts only discovered entries, once per recipe", () => {
    const dex: DexState = [
      dexEntry("margherita"),
      dexEntry("bismarck"),
      dexEntry("funghi", false),
      dexEntry("bismarck"),
    ];
    expect(discoveredRecipeCount(dex)).toBe(2);
  });

  it("does not look at stars: the same discoveries count the same at any BEST", () => {
    const low: DexState = RECIPES.slice(0, 5).map((r) => ({ ...dexEntry(r.id), bestStars: 1 }));
    const high: DexState = RECIPES.slice(0, 5).map((r) => ({
      ...dexEntry(r.id),
      bestStars: 5,
      bestScore: 100,
    }));
    expect(discoveredRecipeCount(low)).toBe(5);
    expect(discoveredRecipeCount(high)).toBe(5);
  });

  it("is 15 once every shipped recipe is discovered", () => {
    expect(discoveredRecipeCount(RECIPES.map((r) => dexEntry(r.id)))).toBe(15);
  });
});

describe("Discovery Ladder: Dex discovered count >= step number (exhaustive, shipped 15)", () => {
  for (let count = 0; count <= 16; count += 1) {
    it(`count ${count}`, () => {
      const expectedStep = Math.min(count, LADDER.steps.length);
      const reached = reachedLadderSteps(LADDER, count);
      expect(reached.map((s) => s.step)).toEqual(
        Array.from({ length: expectedStep }, (_, i) => i + 1),
      );
      for (const s of reached) expect(count).toBeGreaterThanOrEqual(s.step);
      expect(reachedStepNumber(LADDER, count)).toBe(expectedStep);
      expect(ladderUnlockedMaterialIds(LADDER, count)).toEqual(
        EXPECTED_SHIPPED_15_BY_COUNT[expectedStep],
      );
      const next = nextLadderStep(LADDER, count);
      if (count < LADDER.steps.length) expect(next?.step).toBe(count + 1);
      else expect(next).toBeUndefined();
    });
  }

  it("each single discovery reaches exactly one more step until the ladder ends", () => {
    for (let count = 1; count <= LADDER.steps.length; count += 1) {
      expect(reachedLadderSteps(LADDER, count).length - reachedLadderSteps(LADDER, count - 1).length).toBe(1);
    }
  });

  it("the first discovery (margherita) unlocks egg, and all 15 unlock the full ladder", () => {
    expect(ladderUnlockedMaterialIds(LADDER, 0)).toEqual([]);
    expect(ladderUnlockedMaterialIds(LADDER, 1)).toEqual(["egg"]);
    expect(ladderUnlockedMaterialIds(LADDER, 15)).toEqual(materialIdsOfSteps(LADDER.steps));
    expect(ladderUnlockedMaterialIds(LADDER, 15)).toHaveLength(19);
  });

  it("a multi-material step unlocks all of its materials together", () => {
    expect(ladderUnlockedMaterialIds(LADDER, 6)).not.toContain("black-olive");
    expect(ladderUnlockedMaterialIds(LADDER, 7).slice(-2)).toEqual(["black-olive", "oregano"]);
    expect(ladderUnlockedMaterialIds(LADDER, 14).slice(-3)).toEqual([
      "fontina",
      "gorgonzola",
      "parmigiano",
    ]);
  });

  it("invalid counts reach nothing", () => {
    for (const bad of [-1, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(reachedLadderSteps(LADDER, bad)).toEqual([]);
      expect(reachedStepNumber(LADDER, bad)).toBe(0);
      expect(nextLadderStep(LADDER, bad)?.step).toBe(1);
    }
  });

  it("is monotonic: a higher count never reaches fewer materials", () => {
    for (let count = 0; count < 20; count += 1) {
      const lower = ladderUnlockedMaterialIds(LADDER, count);
      const higher = ladderUnlockedMaterialIds(LADDER, count + 1);
      for (const id of lower) expect(higher).toContain(id);
    }
  });

  it("never deadlocks: at every count the reachable recipes let the player discover the next one", () => {
    // After `count` discoveries the player owns starters + the reached materials. There must be
    // at least `count + 1` makeable recipes (i.e. one not yet discovered) until all are found.
    for (let count = 0; count < RECIPES.length; count += 1) {
      const owned = new Set([...REC04_STARTERS, ...ladderUnlockedMaterialIds(LADDER, count)]);
      const makeable = RECIPES.filter((r) =>
        r.requiredIngredients.every((q) => owned.has(q.ingredientId)),
      );
      expect(makeable.length).toBeGreaterThanOrEqual(count + 1);
    }
  });
});

describe("step kind", () => {
  it("materialIdsOfSteps only reads MATERIAL steps and de-duplicates in step order", () => {
    const foreign = {
      step: 3,
      kind: "CAPABILITY",
      ingredientIds: ["should-not-appear"],
      keyRecipeId: "x",
    } as unknown as DiscoveryLadder["steps"][number];
    const steps = [LADDER.steps[0], foreign, LADDER.steps[0], LADDER.steps[1]];
    expect(materialIdsOfSteps(steps)).toEqual(["egg", "bacon"]);
  });
});

describe("resolveMaterialUnlocks: entitlement union, never re-locks", () => {
  it("with no prior entitlement it equals the ladder-derived materials", () => {
    for (let count = 0; count <= 15; count += 1) {
      const r = resolveMaterialUnlocks({
        ladder: LADDER,
        discoveredCount: count,
        alreadyUnlockedMaterialIds: [],
      });
      expect(r.unlockedMaterialIds).toEqual(ladderUnlockedMaterialIds(LADDER, count));
      expect(r.newlyUnlockedMaterialIds).toEqual(r.unlockedMaterialIds);
    }
  });

  it("one discovery at a time announces exactly that step's materials", () => {
    let entitlement: string[] = [];
    for (let count = 1; count <= 15; count += 1) {
      const r = resolveMaterialUnlocks({
        ladder: LADDER,
        discoveredCount: count,
        alreadyUnlockedMaterialIds: entitlement,
      });
      const expected = LADDER.steps.find((s) => s.step === count)?.ingredientIds ?? [];
      expect(r.newlyUnlockedMaterialIds).toEqual(expected);
      entitlement = r.unlockedMaterialIds;
    }
    expect(entitlement).toEqual(materialIdsOfSteps(LADDER.steps));
  });

  it("a jump of several discoveries announces every skipped step in ladder order", () => {
    const r = resolveMaterialUnlocks({
      ladder: LADDER,
      discoveredCount: 4,
      alreadyUnlockedMaterialIds: ["egg"],
    });
    expect(r.newlyUnlockedMaterialIds).toEqual(["bacon", "mushroom", "pepperoni"]);
    expect(r.unlockedMaterialIds).toEqual(["egg", "bacon", "mushroom", "pepperoni"]);
  });

  it("does not re-lock when the discovered count goes down", () => {
    const full = materialIdsOfSteps(LADDER.steps);
    for (let count = 0; count <= 15; count += 1) {
      const r = resolveMaterialUnlocks({
        ladder: LADDER,
        discoveredCount: count,
        alreadyUnlockedMaterialIds: full,
      });
      expect(r.unlockedMaterialIds).toEqual(full);
      expect(r.newlyUnlockedMaterialIds).toEqual([]);
    }
  });

  it("keeps entitlement ids that the ladder does not contain (e.g. unknown to this build)", () => {
    const r = resolveMaterialUnlocks({
      ladder: LADDER,
      discoveredCount: 1,
      alreadyUnlockedMaterialIds: ["future-ingredient", "clam"],
    });
    expect(r.unlockedMaterialIds).toEqual(["future-ingredient", "clam", "egg"]);
    expect(r.newlyUnlockedMaterialIds).toEqual(["egg"]);
  });

  it("drops malformed and duplicate prior entries, keeping first-seen order", () => {
    const r = resolveMaterialUnlocks({
      ladder: LADDER,
      discoveredCount: 2,
      alreadyUnlockedMaterialIds: ["bacon", "", 3, null, undefined, "bacon", { id: "egg" }, "ham"],
    });
    expect(r.unlockedMaterialIds).toEqual(["bacon", "ham", "egg"]);
    expect(r.newlyUnlockedMaterialIds).toEqual(["egg"]);
  });

  it("is idempotent", () => {
    for (let count = 0; count <= 15; count += 1) {
      const first = resolveMaterialUnlocks({
        ladder: LADDER,
        discoveredCount: count,
        alreadyUnlockedMaterialIds: ["ham"],
      });
      const second = resolveMaterialUnlocks({
        ladder: LADDER,
        discoveredCount: count,
        alreadyUnlockedMaterialIds: first.unlockedMaterialIds,
      });
      expect(second.unlockedMaterialIds).toEqual(first.unlockedMaterialIds);
      expect(second.newlyUnlockedMaterialIds).toEqual([]);
    }
  });

  it("is deterministic and does not mutate its inputs", () => {
    const prior = Object.freeze(["tuna", "egg"]);
    const ladderSnapshot = JSON.stringify(LADDER);
    const a = resolveMaterialUnlocks({ ladder: LADDER, discoveredCount: 9, alreadyUnlockedMaterialIds: prior });
    const b = resolveMaterialUnlocks({ ladder: LADDER, discoveredCount: 9, alreadyUnlockedMaterialIds: prior });
    expect(a).toEqual(b);
    expect(prior).toEqual(["tuna", "egg"]);
    expect(JSON.stringify(LADDER)).toBe(ladderSnapshot);
  });

  it("does not depend on step array order in the data", () => {
    const shuffled: DiscoveryLadder = { ...LADDER, steps: [...LADDER.steps].reverse() };
    for (let count = 0; count <= 15; count += 1) {
      expect(ladderUnlockedMaterialIds(shuffled, count)).toEqual(ladderUnlockedMaterialIds(LADDER, count));
      expect(nextLadderStep(shuffled, count)).toEqual(nextLadderStep(LADDER, count));
    }
  });

  it("isMaterialUnlocked reflects the union", () => {
    const input = { ladder: LADDER, discoveredCount: 1, alreadyUnlockedMaterialIds: ["tuna"] };
    expect(isMaterialUnlocked(input, "egg")).toBe(true);
    expect(isMaterialUnlocked(input, "tuna")).toBe(true);
    expect(isMaterialUnlocked(input, "bacon")).toBe(false);
    expect(isMaterialUnlocked(input, "tomato-sauce")).toBe(false);
  });
});

describe("ladder rebuild (shipped 15 -> 25-recipe fixture): never re-locks", () => {
  it("the 25-recipe fixture follows the same count >= step rule", () => {
    expect(W1_LADDER.steps).toHaveLength(24);
    expect(ladderUnlockedMaterialIds(W1_LADDER, 4)).toEqual(["egg", "bacon", "mushroom", "eggplant"]);
    expect(reachedStepNumber(W1_LADDER, 30)).toBe(24);
    expect(nextLadderStep(W1_LADDER, 15)?.ingredientIds).toEqual(["tuna"]);
  });

  it("materials whose step moved later stay unlocked", () => {
    // Shipped-15 count 7 reached ham / black-olive / oregano; in the 25-recipe ladder they sit at
    // steps 8 and 11, beyond count 7.
    const before = resolveMaterialUnlocks({
      ladder: LADDER,
      discoveredCount: 7,
      alreadyUnlockedMaterialIds: [],
    }).unlockedMaterialIds;
    expect(before).toEqual(EXPECTED_SHIPPED_15_BY_COUNT[7]);
    const derivedOnRebuilt = ladderUnlockedMaterialIds(W1_LADDER, 7);
    for (const moved of ["ham", "black-olive", "oregano"]) {
      expect(before).toContain(moved);
      expect(derivedOnRebuilt).not.toContain(moved);
    }
    const after = resolveMaterialUnlocks({
      ladder: W1_LADDER,
      discoveredCount: 7,
      alreadyUnlockedMaterialIds: before,
    });
    for (const id of before) expect(after.unlockedMaterialIds).toContain(id);
    expect(after.newlyUnlockedMaterialIds).toEqual(["eggplant", "parmigiano"]);
    expect(after.unlockedMaterialIds.slice(0, before.length)).toEqual(before);
  });

  it("for every count, rebuild keeps all prior materials and adds only the new ladder's", () => {
    for (let count = 0; count <= 15; count += 1) {
      const before = resolveMaterialUnlocks({
        ladder: LADDER,
        discoveredCount: count,
        alreadyUnlockedMaterialIds: [],
      }).unlockedMaterialIds;
      for (let laterCount = count; laterCount <= 25; laterCount += 1) {
        const after = resolveMaterialUnlocks({
          ladder: W1_LADDER,
          discoveredCount: laterCount,
          alreadyUnlockedMaterialIds: before,
        });
        const expectedUnion = new Set([...before, ...ladderUnlockedMaterialIds(W1_LADDER, laterCount)]);
        expect(new Set(after.unlockedMaterialIds)).toEqual(expectedUnion);
        expect(after.unlockedMaterialIds).toHaveLength(expectedUnion.size);
        for (const id of after.newlyUnlockedMaterialIds) expect(before).not.toContain(id);
      }
    }
  });

  it("a Dex-15 player on the rebuilt ladder immediately gets the steps they now qualify for", () => {
    const before = resolveMaterialUnlocks({
      ladder: LADDER,
      discoveredCount: 15,
      alreadyUnlockedMaterialIds: [],
    }).unlockedMaterialIds;
    const after = resolveMaterialUnlocks({
      ladder: W1_LADDER,
      discoveredCount: 15,
      alreadyUnlockedMaterialIds: before,
    });
    expect(after.newlyUnlockedMaterialIds).toEqual(["eggplant", "corn", "pineapple"]);
    const nextDiscovery = resolveMaterialUnlocks({
      ladder: W1_LADDER,
      discoveredCount: 16,
      alreadyUnlockedMaterialIds: after.unlockedMaterialIds,
    });
    // Step 16 (tuna) was already entitled from the shipped ladder: nothing new, nothing lost.
    expect(nextDiscovery.newlyUnlockedMaterialIds).toEqual([]);
    expect(nextDiscovery.unlockedMaterialIds).toEqual(after.unlockedMaterialIds);
  });
});

describe("validateDiscoveryLadder", () => {
  const step = (n: number, ids: string[], key = "k") => ({
    step: n,
    kind: "MATERIAL" as const,
    ingredientIds: ids,
    keyRecipeId: key,
  });

  it("accepts the shipped ladder, the 25-recipe fixture and an empty ladder", () => {
    expect(validateDiscoveryLadder(DISCOVERY_LADDER)).toEqual([]);
    expect(validateDiscoveryLadder(W1_LADDER)).toEqual([]);
    expect(validateDiscoveryLadder({ populationId: "empty", steps: [] })).toEqual([]);
  });

  it.each<[string, DiscoveryLadder, string]>([
    ["gap", { populationId: "p", steps: [step(1, ["a"]), step(3, ["b"])] }, "expected 2"],
    ["duplicate step", { populationId: "p", steps: [step(1, ["a"]), step(1, ["b"])] }, "expected 2"],
    ["zero-based", { populationId: "p", steps: [step(0, ["a"])] }, "expected 1"],
    ["out of order", { populationId: "p", steps: [step(2, ["a"]), step(1, ["b"])] }, "expected 1"],
    ["empty material", { populationId: "p", steps: [step(1, [])] }, "unlocks no material"],
    ["empty id", { populationId: "p", steps: [step(1, [""])] }, "empty ingredient id"],
    ["duplicate material", { populationId: "p", steps: [step(1, ["a"]), step(2, ["a"])] }, "appears in step 1 and step 2"],
    ["no key recipe", { populationId: "p", steps: [step(1, ["a"], "")] }, "no keyRecipeId"],
    ["no population", { populationId: "", steps: [step(1, ["a"])] }, "populationId is empty"],
    [
      "unknown kind",
      {
        populationId: "p",
        steps: [{ ...step(1, ["a"]), kind: "CAPABILITY" } as unknown as DiscoveryLadder["steps"][number]],
      },
      "unknown kind CAPABILITY",
    ],
  ])("rejects %s", (_name, ladder, fragment) => {
    const problems = validateDiscoveryLadder(ladder);
    expect(problems.some((p) => p.includes(fragment))).toBe(true);
  });
});

describe("runtime wiring boundary (I4b-3/4)", () => {
  // Raw source of every non-test module under src/. `import.meta.glob` is resolved by Vite at
  // transform time, so this sees exactly the files the app build would.
  const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("the Discovery Ladder / material Shop pure layer is reached only through its intended bridges", () => {
    // I4a (ladder) + I4b-1 (material Shop) may import each other. The runtime reaches them only
    // via ../state/materialEntitlement.ts (ladder -> Shop entitlement), ../state/gameReducer.ts
    // (first pack / refill transactions) and, from I4b-4, ../components/ShopOverlay.tsx (reads the
    // same `materialOffer`/`nextMaterialHint` the reducer charges by -- no duplicated numbers).
    const pureLayer = new Set([
      "../data/discoveryLadder.ts",
      "./discoveryLadder.ts",
      "./materialShop.ts",
      "./testSupport/discoveryLadderRule.ts",
    ]);
    const bridges = [
      "../components/ShopOverlay.tsx",
      "../state/gameReducer.ts",
      "../state/materialEntitlement.ts",
    ];
    const importers = Object.entries(sources)
      .filter(([path]) => !pureLayer.has(path))
      .filter(([, text]) => /from\s+["'][^"']*(discoveryLadder(Rule)?|materialShop)["']/.test(text))
      .map(([path]) => path)
      .sort();
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(importers).toEqual(bridges);
  });

  it("nothing in production imports the test-only ladder rule port", () => {
    const importers = Object.entries(sources)
      .filter(([path]) => !path.includes("/testSupport/"))
      .filter(([, text]) => /discoveryLadderRule/.test(text))
      .map(([path]) => path);
    expect(importers).toEqual([]);
  });

  it("the retired EP4 Starter Grant is no longer called by any production module", () => {
    // ./economySimulation.ts is the legacy EP-era economy analysis model: only its own test
    // imports it (asserted below), so it is not part of the runtime bundle.
    const analysisOnly = ["../state/starterStock.ts", "./economySimulation.ts"];
    expect(
      Object.entries(sources)
        .filter(([, text]) => /from\s+["'][^"']*economySimulation["']/.test(text))
        .map(([path]) => path),
    ).toEqual([]);
    const callers = Object.entries(sources)
      .filter(([path]) => !analysisOnly.includes(path))
      .filter(([, text]) => /applyStarterGrants\s*\(|buildStarterGrantNotice\s*\(/.test(text))
      .map(([path]) => path);
    expect(callers).toEqual([]);
  });
});
