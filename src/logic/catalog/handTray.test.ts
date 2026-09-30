import { describe, expect, it, vi } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { runtimeCatalog } from "./catalogSource";
import type { OwnershipView } from "./catalogTypes";
import { emptyHandSession, type HandContext, type HandSession } from "./handSession";
import { handTrayTransition, pinFitsHand, resolveTrayHandIds, sameIds, trayPageIds, type TrayHandInput } from "./handTray";
import { togglePin } from "./pinEdit";
import { selectWorkingSet } from "./workingSet";
import { NO_DISCLOSED_HINTS } from "./hintDisclosure";
import { emptyUsageSession } from "./usageSignals";

/**
 * LC-R5-d: the dormant tray hand (OD-R5d-1 R-α / OD-R5d-2 placed protection / OD-R5d-3 Model C). The enforcement flag is
 * forced ON here (the feature is dormant otherwise; `handTray.off.test.ts` proves the OFF side).
 */
vi.mock("./handPolicy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./handPolicy")>()),
  HAND_ENFORCEMENT_ENABLED: true,
  // The real `handCapacityFor` closes over the ORIGINAL flag binding, so a flag flip in R6 (source edit) is mirrored here.
  handCapacityFor: (_owned: number, candidate: 9 | 12) => candidate,
}));

const catalog = runtimeCatalog();
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const toppings = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const sauces = INGREDIENTS.filter((i) => i.category === "sauce").map((i) => i.id);
const FREE = { roundKind: "FREE_COOK", dinner: null } as const;
const own = (stock: Record<string, number> = {}, ownedIds: readonly string[] = ALL_IDS): OwnershipView => ({
  ownedIds,
  stock: (id) => stock[id] ?? 5,
});
function input(over: Partial<TrayHandInput> = {}): TrayHandInput {
  return {
    round: FREE,
    category: "topping",
    catalog,
    ownership: own(),
    session: emptyHandSession(),
    placedIds: [],
    starterIds: STARTER_INGREDIENT_IDS,
    candidateCapacity: 12,
    ...over,
  };
}
const withPins = (ids: string[], category: "topping" | "sauce" | "cheese" = "topping"): HandSession => ({ ...emptyHandSession(), [category]: ids });
const ids = (over: Partial<TrayHandInput> = {}) => resolveTrayHandIds(input(over))!;
const catalogIndex = (id: string) => catalog.findIndex((c) => c.id === id);

describe.each([9, 12] as const)("LC-R5-d tray hand, capacity %i", (capacity) => {
  const cap = { candidateCapacity: capacity } as const;

  it("is active with 22 toppings, holds exactly `capacity` ingredients and shows them in CATALOG order", () => {
    const list = ids(cap);
    expect(list).toHaveLength(capacity);
    expect(list.map(catalogIndex)).toEqual([...list.map(catalogIndex)].sort((a, b) => a - b));
  });

  it("OD-R5d-1 (F-1): pinning an ingredient already in the hand, or placing one, is NOT a hand change (priority-only reorder)", () => {
    const before = ids(cap);
    const inside = before[before.length - 1];
    const pinnedInside = ids({ ...cap, session: withPins([inside]) });
    const placedInside = ids({ ...cap, placedIds: [inside] });
    expect(pinnedInside).toEqual(before);
    expect(placedInside).toEqual(before);
    // The raw priority list DID change order (this is what the tray must not follow).
    const raw = (pins: string[]) =>
      selectWorkingSet({ category: "topping", capacity, catalog, ownership: own(), placedIds: [], pinnedIds: pins, disclosedHints: NO_DISCLOSED_HINTS, usage: emptyUsageSession() }).items.map((i) => i.id);
    expect(raw([inside])).not.toEqual(raw([]));
    for (const after of [pinnedInside, placedInside]) {
      expect(handTrayTransition({ before, after, selectedIngredientId: before[0] })).toEqual({ changed: false, page: 0, selectedIngredientId: before[0] });
    }
  });

  it("an actual membership change is a hand change: page 0", () => {
    const before = ids(cap);
    const outside = toppings.find((t) => !before.includes(t))!;
    const after = ids({ ...cap, session: withPins([outside]) });
    expect(after).toContain(outside);
    expect(after).not.toEqual(before);
    expect(handTrayTransition({ before, after, selectedIngredientId: null }).changed).toBe(true);
    expect(handTrayTransition({ before, after, selectedIngredientId: null }).page).toBe(0);
  });

  it("selection on the NEW page 0 is retained; off it is cleared", () => {
    const before = ids(cap);
    const outside = toppings.find((t) => !before.includes(t))!;
    const after = ids({ ...cap, session: withPins([outside]) });
    const onPage0 = trayPageIds(after, 0)[0];
    const offPage0 = trayPageIds(after, 1)[0];
    expect(handTrayTransition({ before, after, selectedIngredientId: onPage0 }).selectedIngredientId).toBe(onPage0);
    // whole-hand membership is NOT enough: `offPage0` is in the new hand but not on its page 0.
    expect(after).toContain(offPage0);
    expect(handTrayTransition({ before, after, selectedIngredientId: offPage0 }).selectedIngredientId).toBeNull();
    expect(handTrayTransition({ before, after, selectedIngredientId: "not-in-hand" }).selectedIngredientId).toBeNull();
  });

  it("a change that only touches page 0 while the player views page 1 is a hand change (R-α: back to page 0)", () => {
    // One member of page 0 is swapped in place (e.g. an unpin lets another ingredient re-enter); page 1 is untouched.
    const before = toppings.slice(0, capacity);
    const after = [...before];
    after[1] = toppings[capacity];
    expect(trayPageIds(before, 1)).toEqual(trayPageIds(after, 1));
    expect(trayPageIds(before, 0)).not.toEqual(trayPageIds(after, 0));
    const onPage1 = trayPageIds(before, 1)[0];
    expect(handTrayTransition({ before, after, selectedIngredientId: onPage1 })).toEqual({ changed: true, page: 0, selectedIngredientId: null });
    // ...and a page-0 selection that survives the swap is retained.
    expect(handTrayTransition({ before, after, selectedIngredientId: before[0] })).toEqual({ changed: true, page: 0, selectedIngredientId: before[0] });
  });

  it("category isolation: another category's pins never change this list", () => {
    const base = ids(cap);
    expect(ids({ ...cap, session: withPins([sauces[0]], "sauce") })).toEqual(base);
    expect(ids({ ...cap, session: { ...withPins([sauces[0]], "sauce"), cheese: ["mozzarella"] } })).toEqual(base);
  });

  it("OD-R5d-2: placed ingredients are protected first; pins take the remaining slots (brief example: placed 3 + pins 8)", () => {
    const [A, B, C, ...rest] = toppings;
    const pins = rest.slice(0, 8);
    const list = ids({ ...cap, placedIds: [A, B, C], session: withPins(pins) });
    expect(list).toHaveLength(capacity);
    for (const placed of [A, B, C]) expect(list).toContain(placed);
    expect(pins.filter((p) => list.includes(p))).toEqual(pins.slice(0, capacity - 3));
  });

  it("OD-R5d-2: placed > capacity keeps EVERY placed ingredient (safety contract), pins are dropped", () => {
    const placed = toppings.slice(0, capacity + 2);
    const list = ids({ ...cap, placedIds: placed, session: withPins([toppings[toppings.length - 1]]) });
    for (const id of placed) expect(list).toContain(id);
    expect(list).toHaveLength(capacity + 2);
    const ws = selectWorkingSet({ category: "topping", capacity, catalog, ownership: own(), placedIds: placed, pinnedIds: [toppings[toppings.length - 1]], disclosedHints: NO_DISCLOSED_HINTS, usage: emptyUsageSession() });
    expect(ws.overflowIds).toEqual([toppings[toppings.length - 1]]);
  });

  it("OD-R5d-3 (Model C): pins are accepted only while they fit; a full hand refuses a new pin and never unpins", () => {
    const placed = toppings.slice(0, 2);
    const ctx: HandContext = { category: "topping", catalog, ownership: own() };
    const base = input({ ...cap, placedIds: placed });
    const fits = (candidate: HandSession, id: string) => pinFitsHand(base, candidate, id);
    let session = emptyHandSession();
    const candidates = toppings.slice(2, 2 + capacity);
    const outcomes: string[] = [];
    for (const id of candidates) {
      const r = togglePin(session, id, ctx, fits);
      outcomes.push(r.outcome);
      session = r.session;
    }
    expect(outcomes.filter((o) => o === "pinned")).toHaveLength(capacity - 2);
    expect(outcomes.slice(capacity - 2).every((o) => o === "rejected-capacity")).toBe(true);
    // Every accepted pin IS on the visible hand (never "pinned but not on the tray").
    const list = resolveTrayHandIds({ ...base, session })!;
    for (const id of session.topping) expect(list).toContain(id);
    // A refused tap returns the SAME session object; unpinning is never blocked and frees exactly one slot.
    const refused = togglePin(session, candidates[capacity - 1], ctx, fits);
    expect(refused.session).toBe(session);
    const freed = togglePin(session, session.topping[0], ctx, fits);
    expect(freed.outcome).toBe("unpinned");
    expect(togglePin(freed.session, candidates[capacity - 1], ctx, fits).outcome).toBe("pinned");
  });

  it("OD-R5d-3 property: any toggle sequence with the fit rule keeps every pin on the visible hand", () => {
    const ctx: HandContext = { category: "topping", catalog, ownership: own() };
    let seed = 12345 + capacity;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
    let session = emptyHandSession();
    let placedIds: string[] = [];
    for (let step = 0; step < 300; step += 1) {
      const base = input({ ...cap, placedIds, session });
      if (rand(6) === 0) {
        // Placement is only possible for something already on the tray (the hand).
        const list = resolveTrayHandIds(base)!;
        const id = list[rand(list.length)];
        if (!placedIds.includes(id)) placedIds = [...placedIds, id];
      } else {
        const id = toppings[rand(toppings.length)];
        session = togglePin(session, id, ctx, (candidate, pinned) => pinFitsHand({ ...base, session }, candidate, pinned)).session;
      }
      const list = resolveTrayHandIds(input({ ...cap, placedIds, session }))!;
      for (const id of session.topping) expect(list, `step ${step}`).toContain(id);
      for (const id of placedIds) expect(list, `step ${step}`).toContain(id);
    }
  });

  it("inventory 0: an existing pin stays on the hand (disabled chip, slot used); automatic sources skip zero stock; a NEW zero-stock pin is refused", () => {
    const zero = toppings[20];
    const auto = toppings[0];
    const stock = { [zero]: 0, [auto]: 0 };
    const list = ids({ ...cap, ownership: own(stock), session: withPins([zero]) });
    expect(list).toContain(zero);
    expect(list).not.toContain(auto);
    const ctx: HandContext = { category: "topping", catalog, ownership: own(stock) };
    expect(togglePin(emptyHandSession(), auto, ctx).outcome).toBe("rejected-no-stock");
  });

  it("stock input is the round-start stock: placing (any placed list) never changes eligibility of the others", () => {
    const before = ids(cap);
    for (const id of before) expect(ids({ ...cap, placedIds: [id] })).toEqual(before);
  });

  it("'new' tier: the most recently acquired non-starter ingredient is on the hand", () => {
    const acquired = toppings.filter((t) => !STARTER_INGREDIENT_IDS.includes(t));
    const last = acquired[acquired.length - 1];
    const ownedIds = [...STARTER_INGREDIENT_IDS, ...acquired];
    expect(catalogIndex(last)).toBeGreaterThan(catalogIndex(acquired[capacity]));
    expect(ids({ ...cap, ownership: own({}, ownedIds) })).toContain(last);
  });

  it("FREE-only: Dinner / guided / Lunch Rush / forged rounds and a missing tray step get no hand", () => {
    for (const round of [
      { roundKind: "DINNER", dinner: {} },
      { roundKind: "GUIDED", dinner: null },
      { roundKind: "LUNCH_RUSH", dinner: null },
      { roundKind: "FREE_COOK", dinner: {} },
      { roundKind: "FREE_COOK" },
    ] as unknown as TrayHandInput["round"][]) {
      expect(resolveTrayHandIds(input({ ...cap, round, session: withPins(toppings.slice(0, 3)) })), JSON.stringify(round)).toBeNull();
    }
    expect(resolveTrayHandIds(input({ ...cap, category: null }))).toBeNull();
    expect(resolveTrayHandIds(input(cap))).not.toBeNull();
  });

  it("an inactive hand (owned <= capacity) is null: today's tray, pins irrelevant", () => {
    const fewOwned = [...STARTER_INGREDIENT_IDS, ...toppings.slice(0, 3)];
    expect(resolveTrayHandIds(input({ ...cap, ownership: own({}, fewOwned), session: withPins(toppings.slice(0, 2)) }))).toBeNull();
    // An inactive hand never refuses a pin.
    expect(pinFitsHand(input({ ...cap, ownership: own({}, fewOwned) }), withPins([toppings[0]]), toppings[0])).toBe(true);
  });
});

describe("LC-R5-d transition helpers", () => {
  it("sameIds is ordered and length-aware; page slicing is 6 per page", () => {
    expect(sameIds(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameIds(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameIds(["a"], ["a", "b"])).toBe(false);
    expect(trayPageIds(["1", "2", "3", "4", "5", "6", "7"], 1)).toEqual(["7"]);
  });

  it("identical lists never clear a selection, even one that is not on the list", () => {
    expect(handTrayTransition({ before: ["a", "b"], after: ["a", "b"], selectedIngredientId: "x" })).toEqual({ changed: false, page: 0, selectedIngredientId: "x" });
  });
});
