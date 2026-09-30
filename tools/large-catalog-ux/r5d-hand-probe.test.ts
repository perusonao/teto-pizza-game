/**
 * LC-R5-d Fresh Audit probe (measurement tooling, NOT a CI test, NOT production code).
 *
 * Runs the CURRENT main pure layer (`selectWorkingSet` / `resolveHand` / `togglePin`) on the audit's scenarios and
 * prints the facts the report quotes. A throw-away prototype of the page-level #197 transition (`probeTransition`)
 * lives here only to generate the truth table; it is not a proposal for the production API shape.
 *
 * Run: npx vitest run --config tools/large-catalog-ux/vitest.r5d-probe.config.ts
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INGREDIENTS, MAX_INGREDIENT_PALETTE_SLOTS } from "../../src/data/ingredients";
import { runtimeCatalog } from "../../src/logic/catalog/catalogSource";
import { compareCatalogOrder, indexCatalog, type OwnershipView } from "../../src/logic/catalog/catalogTypes";
import { NO_DISCLOSED_HINTS } from "../../src/logic/catalog/hintDisclosure";
import { emptyHandSession, type HandContext } from "../../src/logic/catalog/handSession";
import { togglePin } from "../../src/logic/catalog/pinEdit";
import { emptyUsageSession } from "../../src/logic/catalog/usageSignals";
import { selectWorkingSet, type WorkingSet } from "../../src/logic/catalog/workingSet";

const catalog = runtimeCatalog();
const byId = indexCatalog(catalog);
const toppings = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const ALL = INGREDIENTS.map((i) => i.id);
const own = (stock: Record<string, number> = {}): OwnershipView => ({ ownedIds: ALL, stock: (id) => stock[id] ?? 5 });

function hand(capacity: number, placed: string[], pinned: string[], ownership = own()): WorkingSet {
  return selectWorkingSet({
    category: "topping",
    capacity,
    catalog,
    ownership,
    placedIds: placed,
    pinnedIds: pinned,
    disclosedHints: NO_DISCLOSED_HINTS,
    usage: emptyUsageSession(),
  });
}
const sourceOrder = (h: WorkingSet) => h.items.map((i) => i.id);
const catalogOrder = (h: WorkingSet) =>
  h.items.map((i) => byId.get(i.id)!).sort(compareCatalogOrder).map((i) => i.id);
const page = (ids: readonly string[], p: number) =>
  ids.slice(p * MAX_INGREDIENT_PALETTE_SLOTS, (p + 1) * MAX_INGREDIENT_PALETTE_SLOTS);
const pageCount = (ids: readonly string[]) => Math.max(1, Math.ceil(ids.length / MAX_INGREDIENT_PALETTE_SLOTS));
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Prototype: visible-page diff gate + page 0 reset + page-level selection (§21.1). */
function probeTransition(before: readonly string[], currentPage: number, selected: string | null, after: readonly string[]) {
  const cur = Math.min(currentPage, pageCount(before) - 1);
  const visibleBefore = page(before, cur);
  const samePageAfter = cur < pageCount(after) ? page(after, cur) : [];
  if (same(visibleBefore, samePageAfter)) return { changed: false, page: cur, selected };
  const visibleAfter = page(after, 0);
  return { changed: true, page: 0, selected: selected !== null && visibleAfter.includes(selected) ? selected : null };
}

const out: Record<string, unknown> = {};

describe("LC-R5-d probe (current main)", () => {
  for (const cap of [9, 12]) {
    it(`cap ${cap}: placed 3 + pins 8 (brief example)`, () => {
      const [A, B, C, D, E, F, G, H, I, J, K] = toppings;
      const h = hand(cap, [A, B, C], [D, E, F, G, H, I, J, K]);
      out[`cap${cap}.placed3.pins8`] = { items: h.items, overflowIds: h.overflowIds };
      expect(h.items.slice(0, 3).map((i) => i.source)).toEqual(["placed", "placed", "placed"]);
    });

    it(`cap ${cap}: placed count > capacity`, () => {
      const placed = toppings.slice(0, cap + 1);
      const h = hand(cap, placed, []);
      const dropped = placed.filter((id) => !sourceOrder(h).includes(id));
      out[`cap${cap}.placedOverCap`] = { placed: placed.length, inHand: h.items.length, droppedPlaced: dropped, overflowIds: h.overflowIds };
    });

    it(`cap ${cap}: placing an in-hand item keeps membership, changes source order`, () => {
      const before = hand(cap, [], []);
      const x = sourceOrder(before)[cap - 1];
      const after = hand(cap, [x], []);
      out[`cap${cap}.placeInHand`] = {
        x,
        sameSet: [...sourceOrder(before)].sort().join() === [...sourceOrder(after)].sort().join(),
        sourceOrderChanged: !same(sourceOrder(before), sourceOrder(after)),
        catalogOrderChanged: !same(catalogOrder(before), catalogOrder(after)),
      };
    });

    it(`cap ${cap}: pin of an out-of-hand item, page-level #197`, () => {
      const before = hand(cap, [], []);
      const outside = toppings.find((id) => !sourceOrder(before).includes(id))!;
      const after = hand(cap, [], [outside]);
      const b = catalogOrder(before);
      const a = catalogOrder(after);
      const rows = [];
      for (const p of [0, 1]) {
        for (const sel of [null, page(b, p)[0], page(b, p)[page(b, p).length - 1]]) {
          const t = probeTransition(b, p, sel, a);
          rows.push({ fromPage: p, selectedBefore: sel, changed: t.changed, toPage: t.page, selectedAfter: t.selected });
        }
      }
      out[`cap${cap}.pinOutside`] = { outside, displaced: b.filter((id) => !a.includes(id)), before: b, after: a, rows };
    });

    it(`cap ${cap}: unpin with many pins shifts page 0 (fill re-enters mid-list)`, () => {
      const pins = toppings.slice(toppings.length - (cap - 1));
      const b = catalogOrder(hand(cap, [], pins));
      const a = catalogOrder(hand(cap, [], pins.slice(1)));
      const rows = [];
      for (const p of [0, 1]) {
        for (const sel of [null, ...page(b, p)]) {
          const t = probeTransition(b, p, sel, a);
          rows.push({ fromPage: p, selectedBefore: sel, changed: t.changed, toPage: t.page, selectedAfter: t.selected });
        }
      }
      out[`cap${cap}.unpinShift`] = { unpinned: pins[0], before: b, after: a, rows };
    });

    it(`cap ${cap}: pin of an item already in hand automatically`, () => {
      const before = hand(cap, [], []);
      const inside = sourceOrder(before)[2];
      const after = hand(cap, [], [inside]);
      out[`cap${cap}.pinInside`] = {
        catalogOrderChanged: !same(catalogOrder(before), catalogOrder(after)),
        sourceOrderChanged: !same(sourceOrder(before), sourceOrder(after)),
      };
    });

    it(`cap ${cap}: zero stock (pinned kept, auto skipped, placed kept)`, () => {
      const [P0, Z] = [toppings[20], toppings[0]];
      const h = hand(cap, [toppings[21]], [P0], own({ [P0]: 0, [Z]: 0, [toppings[21]]: 0 }));
      out[`cap${cap}.zeroStock`] = {
        pinnedZeroInHand: sourceOrder(h).includes(P0),
        placedZeroInHand: sourceOrder(h).includes(toppings[21]),
        autoZeroInHand: sourceOrder(h).includes(Z),
      };
    });
  }

  it("togglePin has no capacity limit and accepts a 23rd... (pins > capacity)", () => {
    const ctx: HandContext = { category: "topping", catalog, ownership: own() };
    let s = emptyHandSession();
    for (const id of toppings) s = togglePin(s, id, ctx).session;
    const h = hand(12, [], [...s.topping]);
    out["togglePin.all"] = { pins: s.topping.length, inHand: h.items.length, overflow: h.overflowIds.length };
    expect(s.topping.length).toBe(toppings.length);
  });

  it("category isolation: a sauce pin never changes the topping hand", () => {
    const ctx: HandContext = { category: "sauce", catalog, ownership: own() };
    const sauce = INGREDIENTS.find((i) => i.category === "sauce")!.id;
    const s = togglePin(emptyHandSession(), sauce, ctx).session;
    out["isolation"] = { toppingPins: s.topping.length, same: same(catalogOrder(hand(12, [], s.topping)), catalogOrder(hand(12, [], []))) };
  });

  it("prints", () => {
    writeFileSync("docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R5d_PROBE.json", `${JSON.stringify({ auditedMain: "e14f33ef196cc4eb8c9080974cddd5dc67ba6459", toppings: toppings.length, ...out }, null, 1)}\n`);
  });
});
