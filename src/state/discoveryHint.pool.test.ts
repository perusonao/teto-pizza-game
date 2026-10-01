import { describe, expect, it } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { discoverableHintCandidates, selectHintTarget } from "../logic/discovery/hintTarget";
import {
  branchingPopulation,
  branchPoint,
  poolOf,
  SYNTHETIC_BRANCH_B,
  SYNTHETIC_BRANCH_ID,
  W1_ORDER,
  W1_RECIPES,
  walkState,
} from "../logic/testSupport/branchingFixture";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { hintSheetView, resolveHintSession, unlockNextHint, type DiscoveryHintState } from "./discoveryHint";
import { resolveShopEntitlement } from "./materialEntitlement";

/**
 * Discovery 3.0 PR-4b-A (D-1): with 2+ DISCOVERABLE unknown recipes and no valid sticky / purchased
 * target, nothing is auto-targeted; a valid sticky or purchased target is kept untouched.
 * pool 0 / 1 / 2+ are explicit. The credited production 25 (`W1_RECIPES`) never reach pool > 1 on
 * their own; PR-4b-B's 26th recipe is what makes production pool 2 real (see
 * `discoveryHint.pool.production26.test.ts`).
 */

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

/** A legacy save (the first 15 recipes found, their materials owned): several DISCOVERABLE at once. */
function legacy(over: Partial<DiscoveryHintState> = {}): DiscoveryHintState {
  const old15 = RECIPES.slice(0, 15);
  const mats = [...new Set(old15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
  const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...mats])];
  const dex = discover(old15.map((r) => r.id));
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: Object.fromEntries(mats.map((m) => [m, 30])),
    preDiscoveryFreeCookAttempts: 0,
    hintSession: null,
    pitzBalance: 1000,
    discoveryHintPurchases: {},
    discoveryHintFacts: {},
    ...over,
  };
}

const POP = branchingPopulation();
const { step: STEP, w1Recipe: A } = branchPoint(SYNTHETIC_BRANCH_B);
const B = SYNTHETIC_BRANCH_ID;
const BASE = W1_ORDER.slice(0, STEP);

describe("pool size 0 / 1 / 2+ at the target selector", () => {
  it("pool 0: no target (a sheet kind that names no recipe)", () => {
    const s = walkState(W1_ORDER, W1_RECIPES);
    expect(poolOf(s, W1_RECIPES)).toHaveLength(0);
    expect(selectHintTarget(s, { recipes: W1_RECIPES }).kind).not.toBe("TARGET");
    expect(selectHintTarget(s, { recipes: W1_RECIPES }).kind).not.toBe("OPEN_POOL");
  });

  it("pool 1: the lone candidate is the automatic target (existing behaviour)", () => {
    for (let count = 1; count < W1_ORDER.length; count += 1) {
      const s = walkState(W1_ORDER.slice(0, count), W1_RECIPES);
      expect(poolOf(s, W1_RECIPES), `count ${count}`).toEqual([W1_ORDER[count]]);
      expect(selectHintTarget(s, { recipes: W1_RECIPES }), `count ${count}`).toEqual({ kind: "TARGET", recipeId: W1_ORDER[count], source: "auto" });
    }
  });

  it("pool 2 (A beside B, both orders to reach it): OPEN_POOL, whatever the population or Dex order", () => {
    const s = walkState(BASE, POP);
    expect(poolOf(s, POP).sort()).toEqual([A, B].sort());
    expect(selectHintTarget(s, { recipes: POP })).toEqual({ kind: "OPEN_POOL" });
    expect(selectHintTarget(s, { recipes: [...POP].reverse() })).toEqual({ kind: "OPEN_POOL" });
  });

  it("A -> B and B -> A: after the first find the pool is back to 1 and that recipe is the target again", () => {
    const afterA = walkState([...BASE, A], POP);
    const afterB = walkState([...BASE, B], POP);
    expect(selectHintTarget(afterB, { recipes: POP })).toEqual({ kind: "TARGET", recipeId: A, source: "auto" });
    // After A the pool holds B and the next W1 recipe: two again, so nothing is chosen.
    expect(poolOf(afterA, POP)).toHaveLength(2);
    expect(selectHintTarget(afterA, { recipes: POP })).toEqual({ kind: "OPEN_POOL" });
  });

  it("a valid sticky target is kept at pool 2+; a stale one (no longer DISCOVERABLE) chooses nothing", () => {
    const s = walkState(BASE, POP);
    for (const id of [A, B]) {
      expect(selectHintTarget(s, { recipes: POP, stickyRecipeId: id })).toEqual({ kind: "TARGET", recipeId: id, source: "auto" });
    }
    expect(selectHintTarget(s, { recipes: POP, stickyRecipeId: "margherita" })).toEqual({ kind: "OPEN_POOL" });
    expect(selectHintTarget(s, { recipes: POP, stickyRecipeId: "no-such-recipe" })).toEqual({ kind: "OPEN_POOL" });
  });
});

describe("resolveHintSession / hintSheetView on a pool of 2+ (legacy save)", () => {
  const base = legacy();
  const pool = discoverableHintCandidates(base).map((r) => r.id);

  it("the legacy save really is a pool of 2+", () => {
    expect(pool.length).toBeGreaterThanOrEqual(2);
  });

  it("no sticky / purchase: no session, and the sheet says only that something can still be found", () => {
    expect(resolveHintSession(base)).toBeNull();
    const view = hintSheetView(base);
    expect(view).toEqual({ kind: "OPEN_POOL" });
    expect(Object.keys(view)).toEqual(["kind"]);
  });

  it("a purchased fact keeps its recipe as the target, on any pool member (never moved to another)", () => {
    for (const id of pool) {
      const s = legacy({ discoveryHintFacts: { [id]: ["ing:tomato-sauce"] } });
      expect(resolveHintSession(s)?.targetId, id).toBe(id);
    }
  });

  it("a purchased legacy level keeps its recipe as the target", () => {
    const id = pool[pool.length - 1];
    expect(resolveHintSession(legacy({ discoveryHintPurchases: { [id]: 1 } }))?.targetId).toBe(id);
  });

  it("with several purchased recipes the first in hint order wins, deterministically", () => {
    const s = legacy({ discoveryHintFacts: { [pool[1]]: ["ing:tomato-sauce"], [pool[2]]: ["ing:tomato-sauce"] } });
    expect(resolveHintSession(s)?.targetId).toBe(pool[1]);
  });

  it("a revealed (H1+) session target stays sticky; an H0-only session does not survive a pool of 2+", () => {
    const revealed = legacy({ hintSession: { targetId: pool[1], revealedIndex: 1 } });
    expect(resolveHintSession(revealed)?.targetId).toBe(pool[1]);
    const h0 = legacy({ hintSession: { targetId: pool[1], revealedIndex: 0 } });
    expect(resolveHintSession(h0)).toBeNull();
  });

  it("a purchased target is not dropped for the Dex-pin-less open, and an unlock for a non-sticky session is refused", () => {
    const bought = legacy({ discoveryHintFacts: { [pool[0]]: ["ing:tomato-sauce"] } });
    expect(hintSheetView({ ...bought, hintSession: resolveHintSession(bought) }).kind).toBe("SELECTABLE");
    expect(hintSheetView(bought).kind).toBe("SELECTABLE");
    // A session left on a recipe that is neither sticky nor purchased no longer unlocks anything.
    const stray = legacy({ hintSession: { targetId: pool[1], revealedIndex: 0 } });
    expect(unlockNextHint(stray, 1)).toBeNull();
  });
});
