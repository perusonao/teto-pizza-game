import { describe, expect, it, vi } from "vitest";

// Passthrough spies: the real production functions still run; the spies only prove the Inspector calls them.
vi.mock("../state/recipeDiscoveryState", async (importOriginal) => {
  const real = await importOriginal<typeof import("../state/recipeDiscoveryState")>();
  return { ...real, recipeDiscoveryState: vi.fn(real.recipeDiscoveryState) };
});
vi.mock("../logic/discovery/hintTarget", async (importOriginal) => {
  const real = await importOriginal<typeof import("../logic/discovery/hintTarget")>();
  return { ...real, selectHintTarget: vi.fn(real.selectHintTarget) };
});
vi.mock("../state/materialEntitlement", async (importOriginal) => {
  const real = await importOriginal<typeof import("../state/materialEntitlement")>();
  return { ...real, resolveShopEntitlement: vi.fn(real.resolveShopEntitlement) };
});

import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENTS } from "../data/ingredients";
import { countsTowardLadder, participatesInLunchRush, RECIPES } from "../data/recipes";
import { selectHintTarget } from "../logic/discovery/hintTarget";
import { poolOf, walkState, W1_ORDER } from "../logic/testSupport/branchingFixture";
import { ingredientUnlockStep, resolveShopEntitlement } from "../state/materialEntitlement";
import { recipeDiscoveryState } from "../state/recipeDiscoveryState";
import { buildInspectorModel, stepMatchesFilter, stepMatchesQuery } from "./discoveryProgressionModel";

const model = buildInspectorModel();
const step = (n: number) => model.steps.find((s) => s.step === n)!;
const stepOf = (ingredientId: string) => step(ingredientUnlockStep(ingredientId)!);

describe("production authority reuse (no second DISCOVERABLE logic)", () => {
  it("calls the production predicate, entitlement bridge and hint target selection", () => {
    vi.mocked(recipeDiscoveryState).mockClear();
    vi.mocked(selectHintTarget).mockClear();
    vi.mocked(resolveShopEntitlement).mockClear();
    buildInspectorModel();
    expect(vi.mocked(recipeDiscoveryState).mock.calls.length).toBeGreaterThan(RECIPES.length * model.stepCount);
    expect(vi.mocked(selectHintTarget)).toHaveBeenCalled();
    expect(vi.mocked(resolveShopEntitlement)).toHaveBeenCalled();
  });

  it("every step's After pool equals the production walk fixture's pool (poolOf / walkState), step by step", () => {
    for (const s of model.steps) {
      const prod = poolOf(walkState(W1_ORDER.slice(0, s.step)));
      expect(s.afterPool.map((m) => m.recipeId).sort(), `step ${s.step}`).toEqual(prod.sort());
    }
  });

  it("every step's Hint target equals what selectHintTarget returns for the same state", () => {
    for (const s of model.steps) {
      const result = selectHintTarget(walkState(W1_ORDER.slice(0, s.step)));
      expect(s.hintTargetKind, `step ${s.step}`).toBe(result.kind === "TARGET" ? `TARGET:${result.recipeId}` : result.kind);
    }
  });

  it("the unlock per step is the production ladder's, and owned materials grow only by it", () => {
    DISCOVERY_LADDER.steps.forEach((l) => {
      const s = step(l.step);
      expect(s.unlocked.map((i) => i.id)).toEqual([...l.ingredientIds]);
      expect(s.afterOwned.length - s.beforeOwned.length).toBe(l.ingredientIds.length);
      expect(s.afterOwned.map((i) => i.id)).toEqual(expect.arrayContaining([...l.ingredientIds]));
    });
  });
});

describe("current production population", () => {
  it("27 recipes, 30 ingredients, 25 steps (24 frozen W1 + No.27's step 25), all read from production data", () => {
    expect(model.recipeCount).toBe(RECIPES.length);
    expect(model.ingredientCount).toBe(INGREDIENTS.length);
    expect(model.stepCount).toBe(DISCOVERY_LADDER.steps.length);
    expect([model.recipeCount, model.ingredientCount, model.stepCount]).toEqual([27, 30, 25]);
    expect(model.startingPool.map((m) => m.recipeId)).toEqual(["margherita"]);
  });
});

describe("cherry-tomato (step 18)", () => {
  const s = stepOf("cherry-tomato");
  it("newly makes only genovese DISCOVERABLE: a single recipe, not a multi-recipe unlock", () => {
    expect(s.step).toBe(18);
    expect(s.newlyDiscoverable.map((r) => r.recipeId)).toEqual(["genovese"]);
    expect(s.newlyDiscoverable[0].missingBefore.map((i) => i.id)).toEqual(["cherry-tomato"]);
    expect(s.newlyDiscoverable[0].ladderCredit).toBe(true);
    expect(stepMatchesFilter(s, "multi")).toBe(false);
  });
  it("the pool is genovese plus the carried-over brazilian-calabresa", () => {
    expect(s.afterPool.map((m) => m.recipeId).sort()).toEqual(["brazilian-calabresa", "genovese"]);
    expect(s.beforePool.map((m) => m.recipeId)).toEqual(["brazilian-calabresa"]);
    expect(s.classification).toBe("OPEN_POOL_POSSIBLE");
  });
});

describe("onion (step 12)", () => {
  const s = stepOf("onion");
  it("newly makes pizza-portuguesa AND brazilian-calabresa DISCOVERABLE", () => {
    expect(s.step).toBe(12);
    expect(s.newlyDiscoverable.map((r) => r.recipeId).sort()).toEqual(["brazilian-calabresa", "pizza-portuguesa"]);
    for (const r of s.newlyDiscoverable) expect(r.missingBefore.map((i) => i.id)).toEqual(["onion"]);
    expect(s.beforePool).toEqual([]); // capricciosa is already found on this path
    expect(s.afterPool).toHaveLength(2);
  });
  it("is OPEN_POOL (both are new, nothing can be a maintained target)", () => {
    expect(s.classification).toBe("OPEN_POOL");
    expect(s.hintTargetKind).toBe("OPEN_POOL");
    expect(s.maintainableTargetIds).toEqual([]);
  });
});

describe("multi-recipe unlock", () => {
  it("is exactly the steps whose newly-DISCOVERABLE count is 2+ (here: step 12 only)", () => {
    expect(model.multiRecipeStepNumbers).toEqual(model.steps.filter((s) => s.newlyDiscoverable.length >= 2).map((s) => s.step));
    expect(model.multiRecipeStepNumbers).toEqual([12]);
    expect(model.steps.filter((s) => stepMatchesFilter(s, "multi")).map((s) => s.step)).toEqual([12]);
  });
});

describe("OPEN_POOL classification follows selectHintTarget, not 'candidate >= 2'", () => {
  it("OPEN_POOL only at step 12; OPEN_POOL POSSIBLE for 13..25 (25: carried calabresa + new pesto-pollo); NORMAL (pool 1) before", () => {
    expect(model.openPoolStepNumbers).toEqual([12]);
    expect(model.openPoolPossibleStepNumbers).toEqual(Array.from({ length: 13 }, (_, i) => 13 + i));
    for (let n = 1; n <= 11; n += 1) {
      expect(step(n).classification).toBe("NORMAL");
      expect(step(n).afterPool).toHaveLength(1);
    }
  });
  it("a POSSIBLE step really maintains a carried target (sticky) yet is OPEN_POOL without one", () => {
    const s = step(13);
    const w = walkState(W1_ORDER.slice(0, 13));
    expect(selectHintTarget(w)).toEqual({ kind: "OPEN_POOL" });
    expect(selectHintTarget(w, { stickyRecipeId: "brazilian-calabresa" })).toMatchObject({ kind: "TARGET", recipeId: "brazilian-calabresa" });
    expect(s.maintainableTargetIds).toEqual(["brazilian-calabresa"]);
  });
  it("the OPEN_POOL filter is exactly the OPEN_POOL and OPEN_POOL POSSIBLE steps", () => {
    expect(model.steps.filter((s) => stepMatchesFilter(s, "open-pool")).map((s) => s.step)).toEqual([12, ...model.openPoolPossibleStepNumbers]);
  });
});

describe("ladderCredit:false (brazilian-calabresa)", () => {
  it("is read from the production credit predicate, is in the pool from step 12 on, and never advances the ladder", () => {
    const calabresa = model.nonCreditRecipes.find((r) => r.recipeId === "brazilian-calabresa")!;
    expect(model.nonCreditRecipes).toHaveLength(1);
    expect(calabresa.advancesLadder).toBe(countsTowardLadder("brazilian-calabresa"));
    expect(calabresa.advancesLadder).toBe(false);
    expect(calabresa.lunchRush).toBe(participatesInLunchRush("brazilian-calabresa"));
    expect(calabresa.firstDiscoverableStep).toBe(12);
    expect(calabresa.poolSteps).toEqual(Array.from({ length: 14 }, (_, i) => 12 + i)); // 12..25 (until step 25 adds pesto-pollo beside it)
    expect(step(12).newlyDiscoverable.find((r) => r.recipeId === "brazilian-calabresa")!.ladderCredit).toBe(false);
  });
  it("finding it leaves the production ladder count and the entitlement unchanged", () => {
    const before = walkState(W1_ORDER.slice(0, 12));
    const after = walkState([...W1_ORDER.slice(0, 12), "brazilian-calabresa"]);
    expect(after.ladderCount).toBe(before.ladderCount);
    expect(after.unlockedForShopIngredientIds).toEqual(before.unlockedForShopIngredientIds);
  });
});

describe("filters / search", () => {
  it("searches ingredient id/name and recipe id/name", () => {
    const hit = (q: string) => model.steps.filter((s) => stepMatchesQuery(s, q)).map((s) => s.step);
    expect(hit("cherry-tomato")).toContain(18);
    expect(hit("たまねぎ")).toContain(12);
    expect(hit("pizza-portuguesa")).toContain(12);
    expect(hit("ブラジリアン")).toContain(12);
    expect(hit("zzz-not-there")).toEqual([]);
    expect(hit("")).toHaveLength(25);
  });
});

describe("read-only", () => {
  it("building the model does not mutate production data or touch storage", () => {
    const snapshot = () => JSON.stringify([RECIPES, INGREDIENTS, DISCOVERY_LADDER]);
    const before = snapshot();
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    buildInspectorModel();
    expect(snapshot()).toBe(before);
    expect([get, set, remove].map((s) => s.mock.calls.length)).toEqual([0, 0, 0]);
    vi.restoreAllMocks();
  });

  it("the Inspector source imports no save / reducer / storage module", () => {
    const sources = import.meta.glob(["./*.ts", "./*.tsx", "!./*.test.ts", "!./*.test.tsx"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(2);
    for (const [file, text] of Object.entries(sources)) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/persistence|gameReducer|localStorage|sessionStorage|indexedDB|firebase|dispatch\(/);
    }
  });
});
