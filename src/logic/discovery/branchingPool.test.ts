import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import type { Recipe } from "../../data/recipes";
import { resolveShopEntitlement } from "../../state/materialEntitlement";
import { recordTrialAttempt } from "../../state/trialRecord";
import { cook, freeRound, ORDINARY } from "../../state/testSupport/trialNotebookFlow";
import { createTrialNotebook } from "./trialNotebook";
import { reachedStepNumber } from "../discoveryLadder";
import {
  branchingPopulation,
  branchPoint,
  counts,
  pizzaOf,
  poolOf,
  remainingOf,
  SYNTHETIC_BRANCH_B,
  SYNTHETIC_BRANCH_ID,
  targetOf,
  W1_ORDER,
  W1_RECIPES,
  walkState,
} from "../testSupport/branchingFixture";
import { compareHintCandidates, discoverableHintCandidates, selectHintTarget } from "./hintTarget";
import { evaluateDiscovery, matchDiscovery } from "./matcher";
import { classifyNearMiss } from "./nearMiss";
import { signatureOfPizza } from "./signature";

/**
 * Discovery 3.0 PR-4a: a branching pool (several DISCOVERABLE unknown recipes at once) with a
 * non-credit synthetic recipe B beside the W1 recipe A it branches with. Production recipes are
 * untouched; B exists only in this population.
 */

const POP = branchingPopulation();
const credit = counts(POP);
const B = SYNTHETIC_BRANCH_ID;
const { step: STEP, w1Recipe: A } = branchPoint(SYNTHETIC_BRANCH_B);
const BASE = W1_ORDER.slice(0, STEP); // everything before the branch point
const NEXT_W1 = W1_ORDER[STEP + 1];
const W1_IDS = new Set(W1_RECIPES.map((r) => r.id));
const CATALOG = [...RECIPE_DISCOVERY_CATALOG.filter((t) => W1_IDS.has(t.recipeId)), targetOf(SYNTHETIC_BRANCH_B)];
const byId = (id: string): Recipe => POP.find((r) => r.id === id)!;
const sorted = (xs: readonly string[]) => [...xs].sort();
const unlocked = (s: ReturnType<typeof walkState>) => sorted(resolveShopEntitlement(s.dex, [], [], DISCOVERY_LADDER, credit).unlockedForShopIngredientIds);

describe("the fixture is a valid branching point", () => {
  it("B is non-credit, W1 recipe A is credited, both are DISCOVERABLE at the branch point", () => {
    expect(credit(B)).toBe(false);
    expect(credit(A)).toBe(true);
    expect(W1_RECIPES.map((r) => r.id)).toContain(A);
    expect(sorted(poolOf(walkState(BASE, POP), POP))).toEqual(sorted([A, B]));
  });

  it("B's identity is unique: it matches only itself, A matches only itself", () => {
    const sig = signatureOfPizza(pizzaOf(SYNTHETIC_BRANCH_B.requiredIngredients.map((r) => r.ingredientId)));
    const m = matchDiscovery(sig, CATALOG);
    expect(m.kind).toBe("UNIQUE_MATCH");
    expect(m.kind === "UNIQUE_MATCH" && m.target.recipeId).toBe(B);
  });
});

describe("pool size 0 / 1 / 2+ are explicit", () => {
  it("pool 0: everything discovered -> COMPLETE; nothing usable -> SHOP_NEW (never a recipe)", () => {
    const all = walkState([...W1_ORDER, B], POP);
    expect(poolOf(all, POP)).toEqual([]);
    expect(selectHintTarget(all, { recipes: POP })).toEqual({ kind: "COMPLETE" });
    const noMaterials = { ...walkState(["margherita"], POP), ownedIngredientIds: ["tomato-sauce"], inventory: {} };
    expect(poolOf(noMaterials, POP)).toEqual([]);
    expect(Object.keys(selectHintTarget(noMaterials, { recipes: POP }))).toEqual(["kind"]);
  });

  it("pool 1: before the branch point the W1 recipe is the only DISCOVERABLE one", () => {
    for (let count = 0; count < STEP; count += 1) {
      const s = walkState(W1_ORDER.slice(0, count), POP);
      expect(poolOf(s, POP), `count ${count}`).toEqual([W1_ORDER[count]]);
    }
  });

  it("pool 2: at the branch point A and B are both DISCOVERABLE; the hint contract does not pick 'the' recipe", () => {
    const s = walkState(BASE, POP);
    const pool = discoverableHintCandidates(s, POP).map((r) => r.id);
    expect(sorted(pool)).toEqual(sorted([A, B]));
    const auto = selectHintTarget(s, { recipes: POP });
    expect(auto).toMatchObject({ kind: "TARGET", source: "auto" });
    expect(pool).toContain((auto as { recipeId: string }).recipeId);
    // Every pool member can be chosen explicitly (the Dex card path); the choice wins over order.
    for (const id of pool) expect(selectHintTarget(s, { recipes: POP, pinnedRecipeId: id })).toEqual({ kind: "TARGET", recipeId: id, source: "dex" });
  });
});

describe.each([
  ["A then B", [A, B]],
  ["B then A", [B, A]],
] as const)("discovery order %s", (_label, order) => {
  const [first, second] = order;
  const s0 = walkState(BASE, POP);
  const s1 = walkState([...BASE, first], POP);
  const s2 = walkState([...BASE, first, second], POP);

  it("the discoverable pool shrinks as recipes are found", () => {
    expect(sorted(poolOf(s0, POP))).toEqual(sorted([A, B]));
    const afterFirst = poolOf(s1, POP);
    expect(afterFirst).not.toContain(first);
    // Both recipes remain findable in either order: finding one never hides the other.
    // Compared against fixed expectations, not against the pool itself: B stays findable after A
    // (and the next W1 recipe unlocks), A stays findable after B.
    if (first === B) expect(afterFirst).toEqual([A]);
    else expect(sorted(afterFirst)).toEqual(sorted([B, NEXT_W1]));
    expect(poolOf(s2, POP)).not.toContain(A);
    expect(poolOf(s2, POP)).not.toContain(B);
  });

  it("remaining unknown recipes shrink by exactly the discovered one", () => {
    expect(remainingOf(s1, POP)).toEqual(remainingOf(s0, POP).filter((id) => id !== first));
    expect(remainingOf(s2, POP)).toEqual(remainingOf(s0, POP).filter((id) => id !== first && id !== second));
  });

  it("ladder count: only the credited discovery advances it", () => {
    expect(s0.ladderCount).toBe(STEP);
    expect(s1.ladderCount).toBe(first === B ? STEP : STEP + 1);
    expect(s2.ladderCount).toBe(STEP + 1);
    expect(reachedStepNumber(DISCOVERY_LADDER, s1.ladderCount)).toBe(first === B ? STEP : STEP + 1);
  });

  it("entitlement: a non-credit discovery never unlocks the next material early", () => {
    if (first === B) expect(unlocked(s1)).toEqual(unlocked(s0));
    else expect(unlocked(s1).length).toBeGreaterThan(unlocked(s0).length);
    // The second discovery moves entitlement only if it is the credited one.
    if (second === B) expect(unlocked(s2)).toEqual(unlocked(s1));
    else expect(unlocked(s2).length).toBeGreaterThan(unlocked(s1).length);
  });

  it("the Dex records both, in discovery order", () => {
    expect(s2.dex.map((e) => e.recipeId).slice(-2)).toEqual([first, second]);
  });
});

describe("both orders end in the same state (order is not authority)", () => {
  const ab = walkState([...BASE, A, B], POP);
  const ba = walkState([...BASE, B, A], POP);
  it("same ladder count, entitlement, pool and remaining", () => {
    expect(ab.ladderCount).toBe(ba.ladderCount);
    expect(unlocked(ab)).toEqual(unlocked(ba));
    expect(sorted(poolOf(ab, POP))).toEqual(sorted(poolOf(ba, POP)));
    expect(remainingOf(ab, POP)).toEqual(remainingOf(ba, POP));
  });
  it("same hint target for the same state, whatever the Dex / owned / population array order", () => {
    const s = walkState(BASE, POP);
    const shuffled = { ...s, dex: [...s.dex].reverse(), ownedIngredientIds: [...s.ownedIngredientIds].reverse() };
    const reversedPop = [...POP].reverse();
    const target = selectHintTarget(s, { recipes: POP });
    expect(selectHintTarget(shuffled, { recipes: POP })).toEqual(target);
    // A and B differ in key step or ingredient count, so the choice never depends on array order.
    const [a, b] = [byId(A), byId(B)];
    expect(compareHintCandidates(a, b, POP)).not.toBe(0);
    expect(compareHintCandidates(a, b, POP)).toBe(compareHintCandidates(a, b, reversedPop));
    expect(selectHintTarget(s, { recipes: reversedPop })).toEqual(target);
  });
  it("sticky keeps a revealed target while it is DISCOVERABLE and lets go once found", () => {
    const s = walkState(BASE, POP);
    const [x, y] = discoverableHintCandidates(s, POP).map((r) => r.id);
    expect(selectHintTarget(s, { recipes: POP, stickyRecipeId: y })).toEqual({ kind: "TARGET", recipeId: y, source: "auto" });
    const found = walkState([...BASE, y], POP);
    expect(selectHintTarget(found, { recipes: POP, stickyRecipeId: y })).not.toMatchObject({ recipeId: y });
    expect(x).toBeDefined();
  });
});

describe("near-miss: no hidden identity leak with a branching pool", () => {
  const s = walkState(BASE, POP);
  const candidates = discoverableHintCandidates(s, POP);
  const NAMES = [A, B, byId(A).nameJa, byId(B).nameJa];
  const opts = { catalog: CATALOG, recipes: POP };

  it("a result carries only kind / distance / flags, never a recipe id or name", () => {
    for (const r of candidates) {
      const ids = r.requiredIngredients.map((q) => q.ingredientId);
      for (const drop of [0, 1, 2]) {
        const near = classifyNearMiss(signatureOfPizza(pizzaOf(ids.filter((_, i) => i !== drop))), candidates, opts);
        if (!near) continue;
        expect(Object.keys(near).every((k) => ["kind", "distance", "sauceStep", "keyUnused"].includes(k))).toBe(true);
        const text = JSON.stringify(near);
        for (const n of NAMES) expect(text).not.toContain(n);
      }
    }
  });

  it("the nearest candidate is reachable for each pool member through its own pizza (distance 0 -> null)", () => {
    for (const r of candidates) {
      const sig = signatureOfPizza(pizzaOf(r.requiredIngredients.map((q) => q.ingredientId)));
      expect(classifyNearMiss(sig, candidates, opts)).toBeNull();
      expect(evaluateDiscovery(sig, CATALOG, s.discoveredIds)).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: r.id });
    }
  });
});

describe("Notebook: no hidden correctness leak with a branching pool", () => {
  const input = () => ({ ...cook(freeRound(), ORDINARY), trialNotebook: createTrialNotebook() });
  it("an INCOMPLETE attempt for A and one for B are recorded identically, with no recipe in the record", () => {
    const i = input();
    const a = recordTrialAttempt(i, { kind: "INCOMPLETE_MATCH", recipeId: A as never, targetId: "t-a" });
    const b = recordTrialAttempt(i, { kind: "INCOMPLETE_MATCH", recipeId: B as never, targetId: "t-b" });
    expect(b).toEqual(a);
    const text = JSON.stringify(a.trialNotebook);
    for (const n of [A, B, byId(A).nameJa, byId(B).nameJa, "t-a", "t-b"]) expect(text).not.toContain(n);
    // And it is recorded like an ordinary original.
    const orig = recordTrialAttempt(i, { kind: "ORIGINAL", blockedTargetIds: [] });
    expect(orig.lastTrialAttempt).toEqual(a.lastTrialAttempt);
  });
});

describe("simulation: completes without a unique-next assumption", () => {
  // Walk the population to a complete Dex with different (legal) pool choices.
  function walk(choose: (pool: string[], step: number) => string): { order: string[]; steps: number } {
    const order: string[] = [];
    for (let guard = 0; guard < POP.length + 5; guard += 1) {
      const s = walkState(order, POP);
      const pool = poolOf(s, POP);
      if (pool.length === 0) return { order, steps: guard };
      order.push(choose(sorted(pool), guard));
    }
    throw new Error("simulation did not terminate");
  }
  const policies: [string, (pool: string[], step: number) => string][] = [
    ["first", (p) => p[0]],
    ["last", (p) => p[p.length - 1]],
    ["alternating", (p, i) => p[i % p.length]],
    ["B as early as possible", (p) => (p.includes(B) ? B : p[0])],
    ["B as late as possible", (p) => (p.length > 1 ? p.find((id) => id !== B)! : p[0])],
  ];
  it.each(policies)("%s: terminates with every recipe discovered exactly once", (_n, choose) => {
    const { order } = walk(choose);
    expect(sorted(order)).toEqual(sorted(POP.map((r) => r.id)));
    expect(new Set(order).size).toBe(order.length);
  });
  it("every policy ends with the same ladder count and entitlement", () => {
    const ends = policies.map(([, choose]) => walkState(walk(choose).order, POP));
    for (const e of ends) {
      expect(e.ladderCount).toBe(ends[0].ladderCount);
      expect(unlocked(e)).toEqual(unlocked(ends[0]));
    }
    expect(ends[0].ladderCount).toBe(W1_RECIPES.length);
  });
});

describe("production isolation", () => {
  // Raw source of every non-test, non-testSupport module under src/.
  const sources = import.meta.glob<string>(["../../**/*.{ts,tsx}", "!../../**/*.test.{ts,tsx}", "!../../**/testSupport/**"], {
    query: "?raw",
    import: "default",
    eager: true,
  });
  it("no production module imports the branching fixture or the hint-roles test support", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const importers = Object.entries(sources)
      .filter(([, text]) => /testSupport\/(branchingFixture|hintRoles)/.test(text))
      .map(([path]) => path);
    expect(importers).toEqual([]);
  });
  it("the synthetic recipe is not a production recipe", async () => {
    const { RECIPES } = await import("../../data/recipes");
    expect(RECIPES.map((r) => r.id)).not.toContain(SYNTHETIC_BRANCH_ID);
  });
});
