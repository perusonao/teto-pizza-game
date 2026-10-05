import { describe, expect, it } from "vitest";
import { productionCatalog, type EditorCatalog } from "./editorCatalog";
import { clearHints, diffEditable, hintCounts, ingredientName, ingredientRows, lastAcquiredFinite, moveOwned, setPitz, setStock, toggleOwned } from "./editorModel";
import { buildPreset, PRESET_FINITE_STOCK } from "./presets";
import { freshEditableState, hasErrors, roundTripIssues, validateEditableState } from "./stateModel";

const catalog = productionCatalog();
const finite = catalog.ingredients.filter((i) => i.unlockCondition !== undefined).map((i) => i.id);
const [f0, f1, f2] = finite;

describe("editing operations on a draft", () => {
  it("OWNED on appends the material LAST with the preset stock; off removes it and its stock", () => {
    const fresh = freshEditableState();
    const a = toggleOwned(fresh, f0, catalog);
    const b = toggleOwned(a, f1, catalog);
    expect(b.ownedIngredientIds.slice(-2)).toEqual([f0, f1]);
    expect(b.inventory).toEqual({ [f0]: PRESET_FINITE_STOCK, [f1]: PRESET_FINITE_STOCK });
    const off = toggleOwned(b, f0, catalog);
    expect(off.ownedIngredientIds).not.toContain(f0);
    expect(off.inventory).toEqual({ [f1]: PRESET_FINITE_STOCK });
    expect(lastAcquiredFinite(b, catalog)).toBe(f1);
    expect(fresh.ownedIngredientIds).toEqual([...catalog.starterIds]); // inputs are never mutated
  });

  it("a starter or an unknown id cannot be toggled", () => {
    const fresh = freshEditableState();
    expect(toggleOwned(fresh, catalog.starterIds[0], catalog)).toBe(fresh);
    expect(toggleOwned(fresh, "no-such-id", catalog)).toBe(fresh);
  });

  it("stock is a non-negative integer of an OWNED finite material only", () => {
    const owned = toggleOwned(freshEditableState(), f0, catalog);
    expect(setStock(owned, f0, 3, catalog).inventory[f0]).toBe(3);
    expect(setStock(owned, f0, 0, catalog).inventory[f0]).toBe(0);
    for (const bad of [-1, 1.5, Number.NaN]) expect(setStock(owned, f0, bad, catalog)).toBe(owned);
    expect(setStock(owned, f1, 5, catalog)).toBe(owned); // not owned
    expect(setStock(owned, catalog.starterIds[0], 5, catalog)).toBe(owned); // a starter has no finite stock
  });

  it("↑↓ swap neighbours in the acquisition order, never into the starters, never past the ends", () => {
    let s = freshEditableState();
    for (const id of [f0, f1, f2]) s = toggleOwned(s, id, catalog);
    const up = moveOwned(s, f2, "earlier", catalog);
    expect(up.ownedIngredientIds.slice(-3)).toEqual([f0, f2, f1]);
    const down = moveOwned(up, f2, "later", catalog);
    expect(down.ownedIngredientIds.slice(-3)).toEqual([f0, f1, f2]);
    expect(moveOwned(s, f0, "earlier", catalog)).toBe(s); // would enter the starters
    expect(moveOwned(s, f2, "later", catalog)).toBe(s); // already last
    expect(moveOwned(s, f1, "later", catalog).ownedIngredientIds.slice(-3)).toEqual([f0, f2, f1]);
    expect(moveOwned(s, catalog.starterIds[0], "later", catalog)).toBe(s); // a starter does not move
    expect(s.ownedIngredientIds.slice(0, catalog.starterIds.length)).toEqual([...catalog.starterIds]);
  });

  it("Pitz is a non-negative integer; Hint reset clears facts and purchases", () => {
    const s = freshEditableState();
    expect(setPitz(s, 250).pitzBalance).toBe(250);
    for (const bad of [-1, 2.5, Number.NaN]) expect(setPitz(s, bad)).toBe(s);
    expect(setPitz(s, 0)).toBe(s);
    const withHints = { ...s, discoveryHintFacts: { a: ["ing:x", "h5:y"], b: ["z:w"] }, discoveryHintPurchases: { a: 2 } };
    expect(hintCounts(withHints)).toEqual({ factRecipes: 2, factIds: 3, purchaseRecipes: 1 });
    expect(hintCounts(clearHints(withHints))).toEqual({ factRecipes: 0, factIds: 0, purchaseRecipes: 0 });
  });

  it("every edit result is a state the real save path keeps unchanged", () => {
    let s = buildPreset("step12-abc-undiscovered");
    s = moveOwned(s, finite[0], "later", catalog);
    s = setStock(s, finite[1], 4, catalog);
    s = toggleOwned(s, finite[finite.length - 1], catalog);
    s = setPitz(s, 12345);
    expect(hasErrors(validateEditableState(s, catalog))).toBe(false);
    expect(roundTripIssues(s)).toEqual([]);
  });
});

describe("the ingredient list: search, filter, order numbers", () => {
  const state = buildPreset("step12-abc-undiscovered");

  it("lists every catalog ingredient with no filter; starters are fixed and have no stock or order", () => {
    const rows = ingredientRows(state, catalog, "", "all");
    expect(rows).toHaveLength(catalog.ingredients.length);
    for (const r of rows.filter((x) => x.starter)) expect(r).toMatchObject({ owned: true, stock: null, order: null, canMoveEarlier: false, canMoveLater: false });
  });

  it("order numbers follow the acquisition order; the ends cannot move outward", () => {
    const owned = ingredientRows(state, catalog, "", "owned").filter((r) => !r.starter);
    const ordered = [...owned].sort((a, b) => a.order! - b.order!);
    expect(ordered.map((r) => r.order)).toEqual(ordered.map((_, i) => i + 1));
    expect(ordered[0].canMoveEarlier).toBe(false);
    expect(ordered.at(-1)!.canMoveLater).toBe(false);
    expect(ordered.slice(1).every((r) => r.canMoveEarlier)).toBe(true);
    expect(ordered.map((r) => r.id)).toEqual(state.ownedIngredientIds.filter((id) => !catalog.starterIds.includes(id)));
  });

  it("searches by Japanese name or id, case-insensitively, and by the OWNED filter", () => {
    const name = ingredientName(catalog, finite[0]);
    expect(ingredientRows(state, catalog, name, "all").some((r) => r.id === finite[0])).toBe(true);
    expect(ingredientRows(state, catalog, finite[0].toUpperCase(), "all").some((r) => r.id === finite[0])).toBe(true);
    expect(ingredientRows(state, catalog, "zzzz-no-match", "all")).toEqual([]);
    const owned = ingredientRows(state, catalog, "", "owned");
    const notOwned = ingredientRows(state, catalog, "", "not-owned");
    expect(owned.length + notOwned.length).toBe(catalog.ingredients.length);
    expect(owned.every((r) => r.owned)).toBe(true);
    expect(notOwned.every((r) => !r.owned && !r.starter)).toBe(true);
  });
});

describe("the diff shown before an apply", () => {
  const base = buildPreset("research-step12-ready");

  it("no change, no rows", () => {
    expect(diffEditable(base, base, catalog)).toEqual([]);
    expect(diffEditable(base, { ...base }, catalog)).toEqual([]);
  });

  it("names Pitz, OWNED changes, stock, and the order change with the last-acquired warning row", () => {
    const stepMaterial = catalog.ladder.steps[11].ingredientIds[0];
    let next = toggleOwned(base, stepMaterial, catalog);
    next = setPitz(next, 999);
    next = setStock(next, base.ownedIngredientIds.at(-1)!, 1, catalog);
    const rows = diffEditable(base, next, catalog);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.pitz.detail).toBe(`${base.pitzBalance} → 999`);
    expect(byId["owned-added"].detail).toContain(ingredientName(catalog, stepMaterial));
    expect(byId.stock.detail).toMatch(/→1/);
    expect(byId["last-acquired"].detail).toContain(`→ ${ingredientName(catalog, stepMaterial)}`);
    expect(byId.order).toBeUndefined(); // an append alone does not reorder the common materials

    const reordered = moveOwned(buildPreset("step12-abc-undiscovered"), stepMaterial, "earlier", catalog);
    const orderRows = diffEditable(buildPreset("step12-abc-undiscovered"), reordered, catalog);
    expect(orderRows.map((r) => r.id)).toEqual(expect.arrayContaining(["order", "last-acquired"]));
  });

  it("names Dex, Hint and ledger changes (generic rows for the id lists)", () => {
    const all = buildPreset("everything-unlocked");
    const rows = diffEditable(buildPreset("fresh-start"), all, catalog);
    const ids = rows.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["pitz", "owned-added", "stock", "dex"]));
    expect(rows.some((r) => r.id.startsWith("ledger:"))).toBe(true);
    const cleared = diffEditable({ ...base, discoveryHintFacts: { x: ["a:b"] }, discoveryHintPurchases: { x: 1 } }, base, catalog);
    expect(cleared.map((r) => r.id)).toEqual(["hint-facts", "hint-purchases"]);
  });
});

describe("the editor model scales to a synthetic 172-recipe / 62-ingredient catalog", () => {
  function synthetic(): EditorCatalog {
    const ingredients = Array.from({ length: 62 }, (_, i) => (i < 3 ? { id: `s-${i}`, nameJa: `S${i}` } : { id: `f-${i}`, nameJa: `F${i}`, unlockCondition: {} }));
    const finiteIds = ingredients.slice(3).map((i) => i.id);
    return {
      recipes: Array.from({ length: 172 }, (_, k) => ({ id: `r-${k}`, requiredIngredients: ingredients.slice(0, 3).map((i) => ({ ingredientId: i.id })) })),
      ingredients,
      starterIds: ingredients.slice(0, 3).map((i) => i.id),
      ladder: { populationId: "x", steps: finiteIds.map((id, i) => ({ step: i + 1, kind: "MATERIAL" as const, ingredientIds: [id], keyRecipeId: `r-${i + 1}` })) },
      techniqueIds: [],
      countsTowardLadder: () => true,
      techniqueLedgerFor: () => [],
    };
  }

  it("rows, edits and the diff stay correct and fast", () => {
    const big = synthetic();
    const t0 = performance.now();
    let s = buildPreset("all-ingredients", big);
    expect(ingredientRows(s, big, "", "all")).toHaveLength(62);
    expect(ingredientRows(s, big, "F5", "all").length).toBeGreaterThan(0);
    s = moveOwned(s, "f-10", "earlier", big);
    s = setStock(s, "f-11", 3, big);
    const rows = diffEditable(buildPreset("all-ingredients", big), s, big);
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(["order", "stock"]));
    expect(diffEditable(buildPreset("fresh-start", big), buildPreset("everything-unlocked", big), big).some((r) => r.id === "dex")).toBe(true);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
