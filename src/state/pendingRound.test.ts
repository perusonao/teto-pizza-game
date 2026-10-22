import { describe, expect, it } from "vitest";
import {
  PENDING_ROUND_MAX_BYTES,
  buildPendingRound,
  canonicalJson,
  pizzaFromJournal,
  readStoredPendingRound,
  settledPendingRound,
  utf8ByteLength,
  withJournalPizza,
  type JournalSource,
  type PendingRound,
} from "./pendingRound";
import { createEmptyPizza } from "./pizzaState";
import { onionPizza } from "./testSupport/r8Harness";

const source = (over: Partial<JournalSource> = {}): JournalSource => ({
  recipe: { id: "fugazza" },
  roundKind: "GUIDED",
  pizza: onionPizza(5),
  researchTargetId: null,
  researchTargetValidAtStart: false,
  ...over,
});

const summary = { outcome: "REGISTERED" as const, recipeId: "fugazza", stars: 3, earnedPitz: 120, discovered: true, newBest: true, newMaterialIds: ["onion"], newTechniqueIds: [] };

describe("the pendingRound journal", () => {
  it("stores only what scoring needs: no score, clock, UI state or stock", () => {
    const round = buildPendingRound(source(), "r1", 70, 123);
    expect(Object.keys(round).sort()).toEqual(["bakeValue", "createdAt", "id", "kind", "pizza", "recipeId", "status", "v"]);
    expect(Object.keys(round.pizza).sort()).toEqual(["doughShape", "sauceDeposits", "sauceIds", "sauceOrigin", "toppings"]);
    const text = JSON.stringify(round);
    for (const forbidden of ["inventory", "score", "cookingTiming", "hint", "sauceToken", "bakeResult"]) expect(text).not.toContain(forbidden);
  });

  it("a Free Cooking journal carries no recipe (the matcher decides) and its Research context", () => {
    const round = buildPendingRound(source({ roundKind: "FREE_COOK", researchTargetId: "fugazza", researchTargetValidAtStart: true }), "r1", 70, 1);
    expect(round.kind).toBe("FREE_COOK");
    expect(round.recipeId).toBeUndefined();
    expect(round.research).toEqual({ targetId: "fugazza", validAtStart: true });
  });

  it("survives a JSON round trip unchanged and rebuilds the same pizza (coordinates are not rounded)", () => {
    const pizza = { ...onionPizza(5), sauceDeposits: [{ x: 33.123456789012345, y: 41.5, amount: 0.02 }], sauceOrigin: { x: 50.1, y: 49.9 } };
    const round = buildPendingRound(source({ pizza }), "r1", 70.123456789, 7);
    const read = readStoredPendingRound(JSON.parse(JSON.stringify(round)));
    expect(read).toEqual({ kind: "round", round });
    const rebuilt = pizzaFromJournal(round.pizza);
    expect(rebuilt.sauceDeposits).toEqual(pizza.sauceDeposits);
    expect(rebuilt.toppings).toEqual(pizza.toppings);
    expect(rebuilt.doughShape).toEqual(pizza.doughShape);
    expect(rebuilt.bakeResult).toBeNull();
  });

  it("settled needs a valid summary; a finished journal keeps its flag through a read", () => {
    const base = buildPendingRound(source(), "r1", 70, 1);
    const finished = withJournalPizza(base, onionPizza(5));
    expect(finished.finished).toBe(true);
    expect(readStoredPendingRound(JSON.parse(JSON.stringify(finished)))).toEqual({ kind: "round", round: finished });
    const settled = settledPendingRound(finished, summary);
    expect(readStoredPendingRound(JSON.parse(JSON.stringify(settled)))).toEqual({ kind: "round", round: settled });
    expect(readStoredPendingRound({ ...JSON.parse(JSON.stringify(settled)), settled: { outcome: "??" } })).toEqual({ kind: "held", reason: "corrupt" });
    expect(readStoredPendingRound({ ...JSON.parse(JSON.stringify(settled)), settled: undefined })).toEqual({ kind: "held", reason: "corrupt" });
  });

  it("key order does not make two journals different", () => {
    const round = buildPendingRound(source(), "r1", 70, 1);
    const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(round).reverse()))) as PendingRound;
    expect(canonicalJson(reordered)).toBe(canonicalJson(round));
  });
});

describe("a stored value this build cannot act on is held, never repaired", () => {
  const valid = (): Record<string, unknown> => JSON.parse(JSON.stringify(buildPendingRound(source(), "r1", 70, 1))) as Record<string, unknown>;

  it("absent is none", () => expect(readStoredPendingRound(undefined)).toEqual({ kind: "none" }));

  it.each([
    ["not an object", 5, "corrupt"],
    ["null", null, "corrupt"],
    ["an array", [], "corrupt"],
    ["a newer version", { ...valid(), v: 2 }, "unknown-version"],
    ["an unreadable version", { ...valid(), v: "x" }, "corrupt"],
    ["a bad id", { ...valid(), id: "Bad Id" }, "corrupt"],
    ["a bad status", { ...valid(), status: "done" }, "corrupt"],
    ["a bad kind", { ...valid(), kind: "LUNCH_RUSH" }, "corrupt"],
    ["a non-finite bake", { ...valid(), bakeValue: "70" }, "corrupt"],
    ["a guided journal without its recipe", { ...valid(), recipeId: undefined }, "corrupt"],
    ["a recipe this build lacks", { ...valid(), recipeId: "recipe-from-a-later-catalog" }, "unresolvable"],
    ["an ingredient this build lacks", { ...valid(), pizza: { ...(valid().pizza as object), sauceIds: ["sauce-from-a-later-catalog"] } }, "unresolvable"],
    ["a missing pizza", { ...valid(), pizza: undefined }, "corrupt"],
    ["a dough with the wrong number of points", { ...valid(), pizza: { ...(valid().pizza as object), doughShape: { radii: [1, 2, 3] } } }, "corrupt"],
    ["a non-finite coordinate", { ...valid(), pizza: { ...(valid().pizza as object), toppings: [{ id: "a", ingredientId: "onion", x: "1", y: 1 }] } }, "corrupt"],
    ["a non-positive sauce amount", { ...valid(), pizza: { ...(valid().pizza as object), sauceDeposits: [{ x: 1, y: 1, amount: 0 }] } }, "corrupt"],
  ])("%s", (_name, value, reason) => {
    expect(readStoredPendingRound(value)).toEqual({ kind: "held", reason });
  });

  it("a journal over the cap is held (oversize)", () => {
    const big = valid();
    (big.pizza as { sauceDeposits: unknown[] }).sauceDeposits = Array.from({ length: 4000 }, (_, i) => ({ x: i + 0.123456789012345, y: i + 0.987654321098765, amount: 0.02 }));
    expect(utf8ByteLength(JSON.stringify(big))).toBeGreaterThan(PENDING_ROUND_MAX_BYTES);
    expect(readStoredPendingRound(big)).toEqual({ kind: "held", reason: "oversize" });
  });

  it("the size is measured in UTF-8 bytes, not characters", () => {
    expect(utf8ByteLength("あ")).toBe(3);
    expect(utf8ByteLength("a")).toBe(1);
  });

  it("an empty pizza journal is still a valid journal (FAILED later, not corrupt)", () => {
    const round = buildPendingRound(source({ pizza: createEmptyPizza() }), "r1", 70, 1);
    expect(readStoredPendingRound(JSON.parse(JSON.stringify(round))).kind).toBe("round");
  });
});
