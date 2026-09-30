import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../../data/ingredients";
import { runtimeCatalog } from "./catalogSource";
import type { OwnershipView, StockValue } from "./catalogTypes";
import { HAND_ENFORCEMENT_ENABLED } from "./handPolicy";
import { emptyHandSession, sanitizeHandSession, type HandContext, type HandSession } from "./handSession";
import { clearPins, pinsInCategory, pinTileState, selectedStripRendered, togglePin } from "./pinEdit";

/**
 * LC-R5-c: the pure pin-edit contract (Model D, OD-R5-2 / -6 / -9 / OD-R5c-1..3).
 */
const catalog = runtimeCatalog();
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const toppings = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const sauces = INGREDIENTS.filter((i) => i.category === "sauce").map((i) => i.id);
const cheeses = INGREDIENTS.filter((i) => i.category === "cheese").map((i) => i.id);
const [t0, t1, t2, t3] = toppings;

function ownership(stock: Record<string, StockValue> = {}, ownedIds: readonly string[] = ALL_IDS): OwnershipView {
  return { ownedIds, stock: (id) => stock[id] ?? 5 };
}
const ctx = (over: Partial<HandContext> = {}): HandContext => ({ category: "topping", catalog, ownership: ownership(), ...over });

describe("LC-R5-c togglePin (Model D: a tile tap edits the active category's pins directly)", () => {
  it("adds, keeps the chosen order, and removes on a second tap", () => {
    let s: HandSession = emptyHandSession();
    for (const id of [t2, t0, t1]) {
      const r = togglePin(s, id, ctx());
      expect(r.outcome).toBe("pinned");
      s = r.session;
    }
    expect(s.topping).toEqual([t2, t0, t1]);
    const off = togglePin(s, t0, ctx());
    expect(off.outcome).toBe("unpinned");
    expect(off.session.topping).toEqual([t2, t1]);
  });

  it("OWNED only: an unowned id is refused and the SAME session is returned", () => {
    const s = emptyHandSession();
    const r = togglePin(s, t3, ctx({ ownership: ownership({}, ALL_IDS.filter((id) => id !== t3)) }));
    expect(r.outcome).toBe("rejected-not-owned");
    expect(r.session).toBe(s);
  });

  it("active category only: a sauce / cheese / unknown id is refused on the topping step", () => {
    const s = emptyHandSession();
    for (const id of [sauces[0], cheeses[0], "no-such-ingredient", ""]) {
      const r = togglePin(s, id, ctx());
      expect(r.outcome, id).toBe("rejected-not-owned");
      expect(r.session).toBe(s);
    }
  });

  it("OD-R5-6: no stock => no NEW pin; UNLIMITED stock is pinnable", () => {
    const s = emptyHandSession();
    const zero = togglePin(s, t0, ctx({ ownership: ownership({ [t0]: 0 }) }));
    expect(zero.outcome).toBe("rejected-no-stock");
    expect(zero.session).toBe(s);
    const unlimited = togglePin(s, t0, ctx({ ownership: ownership({ [t0]: "UNLIMITED" }) }));
    expect(unlimited.outcome).toBe("pinned");
  });

  it("an EXISTING pin that reached zero stock stays, and can always be removed", () => {
    const s = togglePin(emptyHandSession(), t0, ctx()).session;
    const empty = ctx({ ownership: ownership({ [t0]: 0 }) });
    expect(pinsInCategory(s, empty)).toEqual([t0]);
    const r = togglePin(s, t0, empty);
    expect(r.outcome).toBe("unpinned");
    expect(r.session.topping).toEqual([]);
  });

  it("category isolation: editing toppings never touches the sauce / cheese pins (same arrays)", () => {
    const s: HandSession = { sauce: [sauces[0]], cheese: [cheeses[1]], topping: [] };
    const r = togglePin(s, t1, ctx());
    expect(r.session.sauce).toBe(s.sauce);
    expect(r.session.cheese).toBe(s.cheese);
    expect(clearPins(r.session, ctx()).sauce).toBe(s.sauce);
  });

  it("invalid existing pins are pruned on read and on every write", () => {
    const raw = sanitizeHandSession({ topping: [t0, "ghost", sauces[0], t0, 42, t1], sauce: "nope", extra: [t2] });
    const notOwningT1 = ctx({ ownership: ownership({}, ALL_IDS.filter((id) => id !== t1)) });
    expect(pinsInCategory(raw, notOwningT1)).toEqual([t0]);
    const r = togglePin(raw, t2, notOwningT1);
    expect(r.session.topping).toEqual([t0, t2]);
    expect(r.session.sauce).toEqual([]);
    expect(pinsInCategory(raw, notOwningT1)).toEqual([t0]); // reading never mutated the input
  });

  it("deterministic: the same taps give the same pins", () => {
    const run = () => [t3, t1, t3, t0].reduce((s, id) => togglePin(s, id, ctx()).session, emptyHandSession());
    expect(run()).toEqual(run());
    expect(run().topping).toEqual([t1, t0]);
  });

  it("clearPins (おまかせに戻す) empties only the active category", () => {
    const s: HandSession = { sauce: [sauces[0]], cheese: [], topping: [t0, t1] };
    expect(clearPins(s, ctx())).toEqual({ sauce: [sauces[0]], cheese: [], topping: [] });
  });
});

describe("LC-R5-c tile state and selected-strip rule (方式 D)", () => {
  it("pinTileState: disabled only for a NEW pin without stock", () => {
    expect(pinTileState(t0, [], 0)).toEqual({ pinned: false, disabled: true });
    expect(pinTileState(t0, [t0], 0)).toEqual({ pinned: true, disabled: false });
    expect(pinTileState(t0, [], 3)).toEqual({ pinned: false, disabled: false });
    expect(pinTileState(t0, [], "UNLIMITED")).toEqual({ pinned: false, disabled: false });
  });

  it("the strip is rendered only with pin editing on and at least one pin", () => {
    expect(selectedStripRendered({ handEditing: false, pinCount: 3 })).toBe(false);
    expect(selectedStripRendered({ handEditing: true, pinCount: 0 })).toBe(false);
    expect(selectedStripRendered({ handEditing: true, pinCount: 1 })).toBe(true);
  });

  it("R5-c keeps enforcement off (pin UI stays dormant in production until R6)", () => {
    expect(HAND_ENFORCEMENT_ENABLED).toBe(false);
  });
});
