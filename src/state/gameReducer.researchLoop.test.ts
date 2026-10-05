import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { postDiscoveryPrimary } from "../logic/discovery/postDiscoveryPrimary";
import { hint5SheetView, researchEntryViews, researchResultView, researchTargetView, researchableEntryIds } from "./discoveryHint";
import { newShopMaterialCount } from "./materialEntitlement";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza } from "./pizzaState";
import { notebookView } from "../logic/discovery/trialNotebook";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * Discovery 3.0 Research Recipe (#346 S4): the player loop around RESULT -- retry keeps the Research Target,
 * the Hint knowledge only grows from bought Hints, an exact match promotes the entry, and the post-discovery
 * primary CTA follows OD-RX-4. Production data only (ladder step 12 = 2 entries, step 25 = 1 entry).
 */

const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];

function save(step: number, extraDiscovered: readonly string[] = [], pitz = 1000): GameState {
  const owned = ladderOwned(step);
  const base = createInitialGameState(discoveredDex([...keysBefore(step), ...extraDiscovered]), owned, pitz);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) };
}
const single = () => save(25, ["brazilian-calabresa", "aussie"]);
const entryIds = (s: GameState) => deriveResearchEntries(s).entries.map((e) => e.recipeId);
const startResearch = (s: GameState, recipeId: string) => act(s, { type: "START_FREE_COOK", researchTargetId: recipeId });
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";

function bake(s: GameState, pizza: ReturnType<typeof createEmptyPizza>, value: number): GameState {
  let t: GameState = { ...s, pizza: { ...pizza, bakeResult: value } };
  t = act(t, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value });
  for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = act(t, { type: "CONFIRM_MAKING_STEP" });
  return act(t, { type: "REGISTER_TO_DEX" });
}
function cookExactly(s: GameState, recipeId: string): GameState {
  const r = RECIPES.find((x) => x.id === recipeId)!;
  const mid = (r.bakeTarget.start + r.bakeTarget.end) / 2;
  return bake(
    s,
    {
      ...createEmptyPizza(),
      sauceIds: r.requiredIngredients.filter((q) => isSauce(q.ingredientId)).map((q) => q.ingredientId).slice(0, 1),
      toppings: r.requiredIngredients
        .filter((q) => !isSauce(q.ingredientId))
        .flatMap((q) => Array.from({ length: Math.max(1, q.minCount) }, () => q.ingredientId))
        .map((ingredientId, i) => ({ id: `w${i}`, ingredientId, x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 })),
    },
    mid,
  );
}
/** A pizza no recipe has: tomato sauce and a lone chicken. */
function cookOriginal(s: GameState): GameState {
  return bake(
    s,
    {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce"],
      toppings: [{ id: "o0", ingredientId: "chicken", x: 50, y: 50 }],
    },
    68,
  );
}
function buyNext(s: GameState): GameState {
  const view = hint5SheetView(s);
  expect(view?.next).toBeTruthy();
  return act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: view!.next!.rungIndex });
}

describe("A. ORIGINAL -> retry keeps the Research Target (session-only)", () => {
  it("the ORIGINAL round with a target is a plain ORIGINAL (no score), and the target survives the retry", () => {
    const started = startResearch(single(), "pesto-pollo");
    const original = cookOriginal(started);
    expect(original.phase).toBe("DISCOVERED"); // the merged RESULT screen (REGISTER_TO_DEX is auto-applied)
    expect(original.score).toBeNull();
    expect(original.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(original.researchTargetId).toBe("pesto-pollo");
    expect(researchTargetView(original)?.label).toBe("？？？ピザ（チキン）");
    const retry = act(original, { type: "RETRY_SAME_RECIPE" });
    expect(retry.phase).toBe("PREPARE");
    expect(retry.freeCook).toBe(true);
    expect(retry.researchTargetId).toBe("pesto-pollo");
    // a second ORIGINAL + retry still keeps it
    expect(cookOriginal(retry).researchTargetId).toBe("pesto-pollo");
  });

  it("a trial that uses up the target's last stock keeps the RESULT's research context", () => {
    const s = single();
    const started = startResearch({ ...s, inventory: { ...s.inventory, chicken: 1 } }, "pesto-pollo");
    const original = cookOriginal(started);
    expect(original.inventory.chicken ?? 0).toBe(0); // consumed by the bake
    expect(researchTargetView(original)).toBeNull(); // no longer cookable now ...
    expect(researchResultView(original)?.label).toBe("？？？ピザ（チキン）"); // ... but the attempt was still research
    expect(original.researchTargetId).toBe("pesto-pollo");
  });

  it("a normal start (HOME) clears the target", () => {
    const original = cookOriginal(startResearch(single(), "pesto-pollo"));
    expect(act(original, { type: "START_FREE_COOK" }).researchTargetId).toBeNull();
  });

  it("the target never enters a save payload field of the state it rides in the session only", () => {
    const original = cookOriginal(startResearch(single(), "pesto-pollo"));
    expect(Object.keys(original.discoveryHintFacts)).not.toContain("researchTargetId");
    expect(JSON.stringify(original.discoveryHintFacts)).not.toContain("researchTarget");
  });
});

describe("B. ORIGINAL -> Notebook: attempt history only", () => {
  it("the notebook rows carry the player's combination and nothing about the target or the recipes", () => {
    const first = cookOriginal(startResearch(single(), "pesto-pollo"));
    const second = cookOriginal(act(first, { type: "RETRY_SAME_RECIPE" }));
    const rows = notebookView(second.trialNotebook);
    expect(rows.length).toBeGreaterThan(0);
    const json = JSON.stringify(rows);
    for (const r of RECIPES) {
      expect(json).not.toContain(r.id);
      expect(json).not.toContain(r.nameJa);
    }
    expect(json).not.toMatch(/researchTarget|target|distance|similar|candidate|correct|missing|near|far/i);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(Object.keys(rows[0]).sort());
  });
});

describe("C. ORIGINAL -> Hint -> knowledge grows from the purchase only -> retry keeps the target", () => {
  it("an attempt adds no Hint fact; a bought rung does; the retry keeps both and the target", () => {
    const started = startResearch(single(), "pesto-pollo");
    const factsBefore = JSON.stringify(started.discoveryHintFacts);
    const original = cookOriginal(started);
    expect(JSON.stringify(original.discoveryHintFacts)).toBe(factsBefore); // OD-RX-3: attempts create no knowledge
    const retry = act(original, { type: "RETRY_SAME_RECIPE" }, { type: "SHOW_HINT" });
    expect(retry.hintSession?.targetId).toBe("pesto-pollo");
    const bought = buyNext(retry);
    expect(JSON.stringify(bought.discoveryHintFacts)).not.toBe(factsBefore);
    const again = act(bought, { type: "CLOSE_HINT" }, { type: "RETRY_SAME_RECIPE" });
    expect(again.researchTargetId).toBe("pesto-pollo");
    expect(JSON.stringify(again.discoveryHintFacts)).toBe(JSON.stringify(bought.discoveryHintFacts));
  });
});

describe("D/E. exact match promotes the entry; the target never constrains the matcher", () => {
  it("target A, exact B -> B is DISCOVERED and leaves the Research section; A stays an entry", () => {
    const s = save(12, ["aussie"]); // portuguesa + calabresa are the two entries (TQ-1D's aussie already found)
    const [a, b] = entryIds(s);
    const done = cookExactly(startResearch(s, a), b);
    expect(done.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: b });
    expect(entryIds(done)).toEqual([a]);
    expect(researchEntryViews(done).map((v) => v.recipeId)).toEqual([a]);
    expect(done.dex.find((e) => e.recipeId === b)?.discovered).toBe(true);
  });

  it("target recipe exact -> its Research entry disappears and the Dex has the formal card", () => {
    const s = single();
    expect(entryIds(s)).toEqual(["pesto-pollo"]);
    const done = cookExactly(startResearch(s, "pesto-pollo"), "pesto-pollo");
    expect(done.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "pesto-pollo" });
    expect(entryIds(done)).toEqual([]);
    expect(done.dex.find((e) => e.recipeId === "pesto-pollo")?.discovered).toBe(true);
    expect(researchTargetView(done)).toBeNull();
  });

  it("knowledge complete alone never discovers: buying every rung without baking leaves it an entry", () => {
    let s = act(startResearch(single(), "pesto-pollo"), { type: "SHOW_HINT" });
    for (let i = 0; i < 12 && hint5SheetView(s)?.next; i += 1) s = buyNext(s);
    expect(entryIds(s)).toEqual(["pesto-pollo"]);
    expect(s.dex.find((e) => e.recipeId === "pesto-pollo")?.discovered ?? false).toBe(false);
  });
});

describe("F/G/H. post-discovery primary CTA (OD-RX-4)", () => {
  const primaryOf = (s: GameState) =>
    postDiscoveryPrimary({
      researchableEntryIds: researchableEntryIds(s),
      newMaterialAvailable: newShopMaterialCount(s.ownedIngredientIds, s.unlockedForShopIngredientIds) > 0,
    });

  it("F. another researchable entry remains -> 「次のピザを研究する」", () => {
    const s = save(12, ["aussie"]); // exactly two entries
    const [a, b] = entryIds(s);
    const done = cookExactly(startResearch(s, a), b);
    const p = primaryOf(done);
    expect(p.kind).toBe("RESEARCH_NEXT");
    expect(p.labelJa).toBe("🔎 次のピザを研究する");
    expect(p.directResearchId).toBe(a); // exactly one left -> start it
  });

  it("H. nothing to research and no new material -> 「図鑑を見る」", () => {
    const done = cookExactly(startResearch(single(), "pesto-pollo"), "pesto-pollo");
    const owned = new Set(done.ownedIngredientIds);
    const noNew = { ...done, unlockedForShopIngredientIds: done.unlockedForShopIngredientIds.filter((id) => owned.has(id)) };
    expect(primaryOf(noNew).kind).toBe("DEX");
  });

  it("G. nothing to research, a new material waits in the Shop -> 「新しい食材を見る」", () => {
    const done = cookExactly(startResearch(single(), "pesto-pollo"), "pesto-pollo");
    // a finite material the player has not bought yet: unlocked for the Shop, not owned
    const withNew = { ...done, ownedIngredientIds: done.ownedIngredientIds.filter((id) => id !== "chicken") };
    expect(withNew.unlockedForShopIngredientIds).toContain("chicken");
    expect(researchableEntryIds(withNew)).toEqual([]);
    expect(primaryOf(withNew)).toMatchObject({ kind: "SHOP_NEW_MATERIAL", labelJa: "🛒 新しい食材を見る" });
  });

  it("I. two or more entries left -> back to the anonymous Research cards (no direct pick)", () => {
    const s = save(12); // all three entries, nothing discovered yet this round
    expect(primaryOf(s)).toMatchObject({ kind: "RESEARCH_NEXT", directResearchId: null });
  });
});

describe("J. reload: knowledge stays, the entry is re-derived, the target is not restored", () => {
  it("a state rebuilt from the save has the bought facts and the entry but no Research Target", () => {
    let s = act(startResearch(single(), "pesto-pollo"), { type: "SHOW_HINT" });
    s = buyNext(s);
    const reloaded = createInitialGameState(s.dex, s.ownedIngredientIds, s.pitzBalance, s.inventory, [], s.unlockedForShopIngredientIds, s.discoveryHintPurchases, s.discoveryHintFacts);
    expect(reloaded.researchTargetId).toBeNull();
    expect(entryIds(reloaded)).toEqual(["pesto-pollo"]);
    expect(JSON.stringify(reloaded.discoveryHintFacts)).toBe(JSON.stringify(s.discoveryHintFacts));
    expect(researchTargetView(reloaded)).toBeNull();
  });
});
