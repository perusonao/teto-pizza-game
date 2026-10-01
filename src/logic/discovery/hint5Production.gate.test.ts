import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { HINT_CLASS_DISPLAY } from "../../data/hintClassDisplay";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { ingredientAttributeFamily } from "../../data/ingredientTaxonomy";
import { RECIPE_HINT_ROLES, type HintRoles } from "../../data/recipeHintRoles";
import { RECIPES, type Recipe } from "../../data/recipes";
import { TECHNIQUES } from "../../data/techniques";
import { requiredTechniquesOf } from "../techniques/detection";
import { INGREDIENT_TOTAL_FACT_ID } from "./deductionHint";
import {
  buildHint5Ladder,
  hint5ClassFactId,
  hint5EmptyFixedRungs,
  hint5Presentation,
  hint5ReservedRungs,
  HINT5_FIXED_RUNG_KINDS,
  isKeyFreeHintRoles,
  HINT5_LADDER_COMPLETE_TEXT,
  HINT5_RUNG_PRICE,
  requestHint5Rung,
  subToppingClass,
  type Hint5Presentation,
} from "./hint5Ladder";
import { buildSelectableHintModel } from "./selectableHint";
import { ladderTargets } from "./testSupport/deductionInversion";
import { KEYED_RECIPES } from "../testSupport/keyedRecipes";
import { syntheticRecipe } from "../testSupport/syntheticPopulation";

/**
 * Discovery Hint 5.0 (Issue #292), H5-1 / H5-4: the production gate on the real 25-recipe catalog
 * (docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §1 AC-1, §3, §5.3, §12, §13).
 *
 * **OD-H5-M2 = all 25 (round 6).** Every production recipe is a flag-ON target, so every one must walk
 * its ladder to the end (gate A), and none may reach RESERVED_EMPTY_RUNG (gate B, M2 condition 3).
 *
 * **Cooking Techniques tripwire (TQ-1D, §12).** Every production recipe is single-sauce and requires
 * no technique. The tripwire test fails on purpose as soon as one does: TQ-1D (or that recipe's PR)
 * must re-audit Hint 5.0 privacy and decide OD-H5-P4 before shipping it. Never weaken it to pass.
 */

/** Synthetic key-free recipes (no production recipe is key-free): every sauce / cheese presence combination. */
const KEY_FREE_FIXTURES: readonly Recipe[] = [
  syntheticRecipe("kf-full", [{ ingredientId: "tomato-sauce", minCount: 1 }, { ingredientId: "mozzarella", minCount: 2 }, { ingredientId: "sausage", minCount: 2 }, { ingredientId: "onion", minCount: 2 }]),
  syntheticRecipe("kf-no-cheese", [{ ingredientId: "tomato-sauce", minCount: 1 }, { ingredientId: "sausage", minCount: 2 }, { ingredientId: "onion", minCount: 2 }]),
  syntheticRecipe("kf-no-sauce", [{ ingredientId: "mozzarella", minCount: 2 }, { ingredientId: "sausage", minCount: 2 }, { ingredientId: "onion", minCount: 2 }]),
  syntheticRecipe("kf-bare", [{ ingredientId: "sausage", minCount: 2 }, { ingredientId: "onion", minCount: 2 }]),
];

const LADDER_INDEX = new Map(ladderTargets(W1_25_DISCOVERY_LADDER).map((id, i) => [id, i]));
/** The Dex counts a target is seen at: its own ladder step and the full Dex. */
const dexCountsOf = (id: string) => [...new Set([Math.max(1, LADDER_INDEX.get(id) ?? 1), 25])];

const namesOf = (id: string) => buildHint5Ladder(id)!.rungs.filter((r) => r.kind !== "SUB_CLASS").flatMap((r) => r.subjectIds);
/** The SUB_CLASS rung subjects of `id`'s own ladder, in order: the authored `hintSubToppingOrder` for a keyed recipe,
 *  the catalog-ordered toppings for a key-free one (OD-D3-21) -- never an assumption that every recipe is keyed. */
const subsOf = (id: string) => buildHint5Ladder(id)!.rungs.filter((r) => r.kind === "SUB_CLASS").map((r) => r.subjectIds[0]);
/** Round 6 (OD-H5-P4-CHEESE / P4b): the targets whose empty CHEESE / KEY rung is answered 「なし」. */
const NONE_TARGETS = RECIPES.filter((r) => hint5EmptyFixedRungs(r.id)!.length > 0).map((r) => r.id);

/** Every string value in a presentation (keys are ours; values are what a sheet could render). */
function stringValues(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringValues(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => stringValues(v, out));
  return out;
}

/** Every presentation state reachable by buying the ladder in order (0..n rungs owned). */
function purchaseStates(
  recipeId: string,
  discoveredCount: number,
  recipes: readonly Recipe[] = RECIPES,
  roles?: Readonly<Record<string, HintRoles>>,
): { stored: string[]; view: Hint5Presentation }[] {
  const out: { stored: string[]; view: Hint5Presentation }[] = [];
  let stored: string[] = [];
  for (let guard = 0; guard < 20; guard += 1) {
    const view = hint5Presentation({ recipeId, discoveredCount, storedFactIds: stored, legacyPurchases: {}, pitzBalance: 1000 }, recipes, roles)!;
    out.push({ stored, view });
    if (!view.next) break;
    const r = requestHint5Rung({ recipeId, discoveredCount, storedFactIds: stored, legacyPurchases: {}, expectedRungIndex: view.next.rungIndex, pitzBalance: 1000 }, recipes, roles);
    if (r.outcome !== "ANSWERED") break;
    stored = [...stored, ...r.addFactIds];
  }
  return out;
}

describe("AC-1 (primary): the last unclassified sub-topping is still classified", () => {
  it("G4: every sub-topping of every unblocked target, as the LAST unclassified one, is ANSWERED with its family (others bought, or known through legacy names -> 0 Pitz completions first)", () => {
    let cases = 0;
    for (const r of RECIPES) {
      const subs = subsOf(r.id);
      if (subs.length === 0) continue;
      const ladder = buildHint5Ladder(r.id)!;
      const fixedDone = [...namesOf(r.id).map((n) => `ing:${n}`), "h5:sauce", "h5:cheese", "h5:key", INGREDIENT_TOTAL_FACT_ID, "h5:structure"];
      for (const last of subs) {
        const others = subs.filter((s) => s !== last);
        const lastRung = ladder.rungs.find((x) => x.kind === "SUB_CLASS" && x.subjectIds[0] === last)!;
        for (const discoveredCount of dexCountsOf(r.id)) {
          // (a) every other sub-topping already classified on the ladder: the last one is the next rung.
          const stored = [...fixedDone, ...others.map((s) => hint5ClassFactId(s))];
          const view = hint5Presentation({ recipeId: r.id, discoveredCount, storedFactIds: stored, legacyPurchases: {}, pitzBalance: 5 })!;
          expect(view.next, `${r.id}/${last}`).toMatchObject({ rungIndex: lastRung.index, kind: "SUB_CLASS", price: 5, affordable: true });
          const res = requestHint5Rung({ recipeId: r.id, discoveredCount, storedFactIds: stored, legacyPurchases: {}, expectedRungIndex: lastRung.index, pitzBalance: 5 });
          expect(res, `${r.id}/${last}`).toEqual({ outcome: "ANSWERED", rungIndex: lastRung.index, kind: "SUB_CLASS", addFactIds: [`cls:${last}`], charge: 5, persist: true });
          const after = hint5Presentation({ recipeId: r.id, discoveredCount, storedFactIds: [...stored, `cls:${last}`], legacyPurchases: {}, pitzBalance: 0 })!;
          expect(after.board.find((e) => e.rungIndex === lastRung.index), `${r.id}/${last}`).toMatchObject({ kind: "SUB_CLASS", classView: { family: ingredientAttributeFamily(last) } });
          expect(after.next).toBeNull();
          // (b) every other sub-topping known only through a legacy name (M3): walking the ladder
          // completes them for 0 Pitz, and the last one is still ANSWERED with its family.
          let ledger = [...fixedDone, ...others.map((s) => `ing:${s}`)];
          const outcomes: string[] = [];
          for (let guard = 0; guard < 10; guard += 1) {
            const next = hint5Presentation({ recipeId: r.id, discoveredCount, storedFactIds: ledger, legacyPurchases: {}, pitzBalance: 100 })!.next;
            if (!next) break;
            expect(next.price, `${r.id}/${last}`).toBe(5); // never a 0 price before the request (M3)
            const step = requestHint5Rung({ recipeId: r.id, discoveredCount, storedFactIds: ledger, legacyPurchases: {}, expectedRungIndex: next.rungIndex, pitzBalance: 100 });
            if (step.outcome !== "ANSWERED" && step.outcome !== "ALREADY_KNOWN") throw new Error(`${r.id}/${last}: ${step.outcome}`);
            outcomes.push(`${step.outcome}:${step.addFactIds.join("+")}:${step.charge}`);
            ledger = [...ledger, ...step.addFactIds];
          }
          expect(outcomes, `${r.id}/${last}`).toEqual(subs.map((s) => (s === last ? `ANSWERED:cls:${s}:5` : `ALREADY_KNOWN:cls:${s}:0`)));
          cases += 1;
        }
      }
    }
    // H5-1 had 38 cases on the 19 unblocked targets; round 6 adds the no-cheese targets' sub-toppings.
    expect(cases).toBeGreaterThanOrEqual(46);
  });

  it("the round-6 「なし」 targets are the 5 no-cheese recipes and quattro-formaggi, and each has a valid classification for every sub-topping", () => {
    expect([...NONE_TARGETS].sort()).toEqual(["fugazza", "marinara", "pesto-tonno", "pizza-bianca", "puttanesca-pizza", "quattro-formaggi"]);
    for (const id of NONE_TARGETS) for (const s of subsOf(id)) expect(subToppingClass(s), `${id}/${s}`).toBe(ingredientAttributeFamily(s));
  });

  it("G3: buying any ladder in order classifies every sub-topping, and never degrades to existence / group / category", () => {
    for (const r of RECIPES) {
      const states = purchaseStates(r.id, 5);
      const final = states[states.length - 1].view;
      expect(final.next, r.id).toBeNull();
      const classes = final.board.filter((e) => e.kind === "SUB_CLASS");
      expect(classes.length, r.id).toBe(subsOf(r.id).length);
      for (const e of classes) expect("classView" in e && e.classView.family, r.id).toBeTruthy();
      expect(stringValues(final).join("|"), r.id).not.toMatch(/existence|attr:|今はまだ/);
    }
  });

  it("P1 / P2: a family with a single catalog member is still shown as its classification (narrowing to one candidate = PASS)", () => {
    const singletons = INGREDIENTS.filter((i) => i.category === "topping" && INGREDIENTS.filter((j) => ingredientAttributeFamily(j.id) === ingredientAttributeFamily(i.id)).length === 1).map((i) => i.id);
    expect(singletons.sort()).toEqual(["capers", "egg", "pineapple"]);
    for (const [recipeId, sub] of [["breakfast-pizza", "egg"], ["pizza-portuguesa", "egg"]] as const) {
      const final = purchaseStates(recipeId, 5).pop()!.view;
      const entry = final.board.find((e) => e.kind === "SUB_CLASS" && "classView" in e && e.classView.family === ingredientAttributeFamily(sub));
      expect(entry, recipeId).toBeDefined();
      expect(stringValues(entry).join("|")).not.toContain(getIngredient(sub)!.nameJa);
    }
    // capers (the spice singleton) is a puttanesca sub-topping; its classification exists even while
    // puttanesca waits on P4.
    expect(subToppingClass("capers")).toBe("spice");
  });
});

describe("H5-4 gates A / B / C (OD-H5-M2 = all 25)", () => {
  it("A: every one of the 25 recipes walks its ladder from the first rung to the complete line, every request ANSWERED at the P-C price", () => {
    let walked = 0;
    for (const r of RECIPES) {
      for (const discoveredCount of r.id === "margherita" ? [0, ...dexCountsOf(r.id)] : dexCountsOf(r.id)) {
        const states = purchaseStates(r.id, discoveredCount);
        const ladder = buildHint5Ladder(r.id)!;
        const final = states[states.length - 1];
        expect(states.length, `${r.id} @${discoveredCount}`).toBe(ladder.rungs.length + 1);
        expect(final.view.next, r.id).toBeNull();
        expect(final.view.completeText, r.id).toBe(HINT5_LADDER_COMPLETE_TEXT);
        expect(final.view.board.map((e) => e.rungIndex), r.id).toEqual(ladder.rungs.map((x) => x.index));
        // Every completion record is stored exactly once.
        const markers = final.stored.filter((id) => id.startsWith("h5:") || id.startsWith("cls:"));
        expect(new Set(markers).size, r.id).toBe(markers.length);
        expect(markers.length, r.id).toBe(ladder.rungs.length);
        walked += 1;
      }
    }
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(25);
    expect(walked).toBeGreaterThanOrEqual(25);
  });

  it("B: RESERVED gate — no production recipe can reach RESERVED_EMPTY_RUNG (M2 condition 3; OD-H5-P4-SAUCE stays reserved for TQ-1D)", () => {
    const reaching = RECIPES.filter((r) => hint5ReservedRungs(r.id)!.length > 0).map((r) => r.id);
    expect(reaching, "a sauceless recipe needs OD-H5-P4-SAUCE (TQ-1D) before it can be a production target").toEqual([]);
    // And no reachable request state returns it, with or without legacy facts.
    for (const r of RECIPES) {
      for (const { stored, view } of purchaseStates(r.id, 5)) {
        if (!view.next) continue;
        for (const legacy of [{}, { [r.id]: 4 }]) {
          const res = requestHint5Rung({ recipeId: r.id, discoveredCount: 5, storedFactIds: stored, legacyPurchases: legacy, expectedRungIndex: view.next.rungIndex, pitzBalance: 1000 });
          expect(res.outcome, `${r.id} @${view.next.rungIndex}`).not.toBe("RESERVED_EMPTY_RUNG");
        }
      }
    }
  });

  it("C: the purchase order is sauce -> cheese -> key -> structure -> sub ①..ⓝ for every keyed recipe (a key-free recipe: only the rungs that apply, no key), each rung priced by its kind", () => {
    const categoryPresent = (r: Recipe, category: string) => r.requiredIngredients.some((q) => getIngredient(q.ingredientId)?.category === category);
    for (const r of RECIPES) {
      const states = purchaseStates(r.id, 5);
      const offered = states.flatMap((s) => (s.view.next ? [[s.view.next.kind, s.view.next.price] as const] : []));
      const subs = subsOf(r.id);
      // OD-D3-21: the expected order is a function of the recipe's own structure (sauce / cheese presence, key-free or not).
      const fixed = isKeyFreeHintRoles(RECIPE_HINT_ROLES[r.id])
        ? HINT5_FIXED_RUNG_KINDS.filter((k) => k !== "KEY_TOPPING" && (k === "STRUCTURE" || categoryPresent(r, k === "SAUCE" ? "sauce" : "cheese")))
        : HINT5_FIXED_RUNG_KINDS;
      expect(offered.map(([k]) => k), r.id).toEqual([...fixed, ...subs.map(() => "SUB_CLASS")]);
      for (const [kind, price] of offered) expect(price, `${r.id} ${kind}`).toBe(HINT5_RUNG_PRICE[kind]);
      // Out-of-order requests are STALE at every state.
      for (const { stored, view } of states) {
        if (!view.next) continue;
        for (const wrong of [view.next.rungIndex - 1, view.next.rungIndex + 1]) {
          expect(requestHint5Rung({ recipeId: r.id, discoveredCount: 5, storedFactIds: stored, legacyPurchases: {}, expectedRungIndex: wrong, pitzBalance: 1000 }), `${r.id} ${wrong}`).toEqual({ outcome: "REJECTED", reason: "STALE" });
        }
      }
    }
  });
});

describe("disclosure boundary (H5-INV-1..5)", () => {
  it("G5 / H5-INV-1: a classification never carries an ingredient name, id or glyph", () => {
    const words = INGREDIENTS.flatMap((i) => [i.nameJa, i.emoji]);
    for (const family of Object.keys(HINT_CLASS_DISPLAY)) {
      for (const r of RECIPES) {
        for (const e of purchaseStates(r.id, 5).pop()!.view.board) {
          if (e.kind !== "SUB_CLASS" || !("classView" in e)) continue;
          for (const s of stringValues(e.classView)) {
            for (const w of words) expect(s.includes(w), `${r.id}: ${s} / ${w}`).toBe(false);
            expect(INGREDIENTS.some((i) => i.id === s), `${r.id}: ${s}`).toBe(false);
          }
        }
      }
      expect(family).toBeTruthy();
    }
  });

  it("G6 / H5-INV-1 / H5-INV-3: at every purchase state, no recipe identity and no unbought ingredient appears anywhere in the view model", () => {
    for (const r of RECIPES) {
      for (const discoveredCount of dexCountsOf(r.id)) {
        for (const { stored, view } of purchaseStates(r.id, discoveredCount)) {
          const values = stringValues(view);
          const boughtNames = new Set(stored.filter((s) => s.startsWith("ing:")).map((s) => s.slice(4)));
          for (const v of values) {
            // A bought name may equal the recipe id / name (pepperoni's key topping is pepperoni): that
            // is the ingredient the player bought, not the recipe identity (P3).
            if (!boughtNames.has(v)) expect(v === r.id, `${r.id}: ${v}`).toBe(false);
            expect(v.includes(r.description), `${r.id}: ${v}`).toBe(false);
            if (!INGREDIENTS.some((i) => boughtNames.has(i.id) && i.nameJa === r.nameJa)) expect(v.includes(r.nameJa), `${r.id}: ${v}`).toBe(false);
            if (INGREDIENTS.some((i) => i.id === v)) expect(boughtNames.has(v), `${r.id}: unbought ${v}`).toBe(true);
            for (const i of INGREDIENTS) if (!boughtNames.has(i.id)) expect(v.includes(i.nameJa), `${r.id}: ${v} names ${i.id}`).toBe(false);
          }
          expect(JSON.stringify(view)).not.toMatch(/cls:|"ing:|reserve/i);
        }
      }
    }
  });

  it("G15 / H5-INV-5 FREE LEAK: before STRUCTURE, every keyed production target's offer and board shape are identical given the same completed rungs", () => {
    for (let k = 0; k <= 3; k += 1) {
      const shapes = new Set<string>();
      for (const r of KEYED_RECIPES) {
        const states = purchaseStates(r.id, 5);
        if (states.length <= k) continue;
        const { view } = states[k];
        if (view.board.length !== k) continue; // stuck on an empty rung before k (P4): not comparable
        shapes.add(JSON.stringify({ next: view.next, kinds: view.board.map((e) => [e.rungIndex, e.kind]), done: view.completeText }));
      }
      expect(shapes.size, `after ${k} rungs`).toBe(1);
    }
    // No SUB_CLASS offer or entry before STRUCTURE, even with classifications already stored.
    const early = hint5Presentation({ recipeId: "capricciosa", discoveredCount: 5, storedFactIds: ["cls:ham", "ing:tomato-sauce", "h5:sauce"], legacyPurchases: {}, pitzBalance: 100 })!;
    expect(early.board.some((e) => e.kind === "SUB_CLASS")).toBe(false);
    expect(early.next!.kind).toBe("CHEESE");
  });

  // Discovery 3.0 PR-4a (OD-D3-21): a key-free recipe has no KEY_TOPPING rung and an absent rung is never a
  // placeholder, so "every target is identical until STRUCTURE" can no longer mean one global shape. The
  // invariant is recipe-structure-aware: what a player sees before STRUCTURE is a function of the recipe's
  // STRUCTURE-LEVEL signature only -- the kinds of the rungs before STRUCTURE (which of sauce / cheese / key
  // the recipe has) -- never of its ingredients, its identity, or anything it has not been paid to reveal.
  it("G15' (OD-D3-21): over production + key-free fixtures, targets with the same pre-STRUCTURE rung signature are indistinguishable before STRUCTURE", () => {
    const population = [...RECIPES, ...KEY_FREE_FIXTURES];
    const roles: Record<string, HintRoles> = { ...RECIPE_HINT_ROLES, ...Object.fromEntries(KEY_FREE_FIXTURES.map((f) => [f.id, { keyFree: true } as HintRoles])) };
    const signatureOf = (id: string) => {
      const rungs = buildHint5Ladder(id, population, roles)!.rungs;
      return rungs.slice(0, rungs.findIndex((x) => x.kind === "STRUCTURE") + 1).map((x) => x.kind).join(">");
    };
    const signatures = new Set<string>();
    let comparedGroups = 0;
    for (const sig of new Set(population.map((r) => signatureOf(r.id)))) {
      signatures.add(sig);
      const members = population.filter((r) => signatureOf(r.id) === sig);
      const preKinds = sig.split(">").slice(0, -1); // the rungs strictly before STRUCTURE
      for (let k = 0; k <= preKinds.length; k += 1) {
        const shapes = new Set<string>();
        for (const r of members) {
          const states = purchaseStates(r.id, 5, population, roles);
          if (states.length <= k) continue;
          const { view } = states[k];
          if (view.board.length !== k) continue; // stuck on an empty rung before k (P4): not comparable
          // Before STRUCTURE nothing may depend on SUB_CLASS (no entry, no offer), whatever is stored.
          expect(view.board.some((e) => e.kind === "SUB_CLASS"), `${r.id} k=${k}`).toBe(false);
          if (k < preKinds.length) expect(view.next!.kind, `${r.id} k=${k}`).toBe(preKinds[k]);
          shapes.add(JSON.stringify({ next: view.next, kinds: view.board.map((e) => [e.rungIndex, e.kind]), done: view.completeText }));
        }
        expect(shapes.size, `signature ${sig} after ${k} rungs`).toBe(1);
        comparedGroups += 1;
      }
    }
    // The 25 production recipes are one group (SAUCE>CHEESE>KEY_TOPPING>STRUCTURE): their behaviour is unchanged.
    expect(signatureOf("margherita")).toBe("SAUCE>CHEESE>KEY_TOPPING>STRUCTURE");
    expect(new Set(KEYED_RECIPES.map((r) => signatureOf(r.id))).size).toBe(1);
    // Key-free recipes form other groups; none has a KEY_TOPPING rung.
    expect([...signatures].filter((x) => x.includes("KEY_TOPPING"))).toEqual(["SAUCE>CHEESE>KEY_TOPPING>STRUCTURE"]);
    expect(signatures.size).toBeGreaterThan(1);
    expect(comparedGroups).toBeGreaterThan(8);
  });

  it("G15'' (OD-D3-21): the signature is derived from recipe structure only -- two key-free recipes with the same sauce/cheese presence but different toppings are byte-identical before STRUCTURE", () => {
    const [full, other] = [KEY_FREE_FIXTURES[0], syntheticRecipe("kf-full-2", [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "ham", minCount: 2 },
      { ingredientId: "egg", minCount: 1 },
      { ingredientId: "black-olive", minCount: 2 },
    ])];
    const population = [...RECIPES, full, other];
    const roles: Record<string, HintRoles> = { ...RECIPE_HINT_ROLES, [full.id]: { keyFree: true }, [other.id]: { keyFree: true } };
    for (let k = 0; k <= 2; k += 1) {
      const a = purchaseStates(full.id, 5, population, roles)[k].view;
      const b = purchaseStates(other.id, 5, population, roles)[k].view;
      expect(JSON.stringify({ next: a.next, board: a.board })).toBe(JSON.stringify({ next: b.next, board: b.board }));
    }
  });

  it("M3 / G15 with legacy saves: L1 / L2 / L3 are gone. Every legacy fact set Hint 3.0 / DH4 / Economy 1.0 can leave gives the same pre-purchase view as a fresh ledger, at every rung prefix", () => {
    let comparisons = 0;
    for (const r of RECIPES.filter((x) => x.id !== "margherita")) {
      const model = buildSelectableHintModel(r.id, { discoveredCount: 1 })!;
      const sellable = model.purchasableFacts.map((f) => `ing:${f.ingredientId}`);
      // Legacy ledgers: nothing, each single Hint 3.0 fact, every Hint 3.0 fact, plus 構成 / 特徴 facts.
      const legacySets: { stored: string[]; purchases: Record<string, number> }[] = [
        { stored: [], purchases: {} },
        ...sellable.map((id) => ({ stored: [id], purchases: {} })),
        { stored: [...sellable, INGREDIENT_TOTAL_FACT_ID, "meta:topping-total", "attr:family:meat", "attr:group:produce"], purchases: {} },
        ...[1, 2, 3, 4].map((level) => ({ stored: [], purchases: { [r.id]: level } })),
      ];
      // Ladder prefixes a fresh player could reach: 0..all completed rungs (bought in order).
      for (const { stored: prefix } of purchaseStates(r.id, 5)) {
        const markers = prefix.filter((id) => id.startsWith("h5:") || id.startsWith("cls:"));
        const fresh = hint5Presentation({ recipeId: r.id, discoveredCount: 5, storedFactIds: prefix, legacyPurchases: {}, pitzBalance: 100 })!;
        for (const legacy of legacySets) {
          const withLegacy = hint5Presentation({ recipeId: r.id, discoveredCount: 5, storedFactIds: [...legacy.stored, ...markers], legacyPurchases: legacy.purchases, pitzBalance: 100 })!;
          expect({ next: withLegacy.next, kinds: withLegacy.board.map((e) => [e.rungIndex, e.kind]) }, `${r.id} ${legacy.stored.join(",")}`).toEqual({
            next: fresh.next,
            kinds: fresh.board.map((e) => [e.rungIndex, e.kind]),
          });
          comparisons += 1;
        }
      }
    }
    expect(comparisons).toBeGreaterThan(500);
  });

  it("M3: the 0-Pitz completion is learnt only after an affordable request (L1 parmigiana, L2 hawaiian, L3 capricciosa)", () => {
    for (const [recipeId, legacy] of [["parmigiana-pizza", ["ing:mozzarella"]], ["hawaiian", ["ing:mozzarella"]], ["capricciosa", ["ing:ham"]]] as const) {
      const view = hint5Presentation({ recipeId, discoveredCount: 5, storedFactIds: legacy, legacyPurchases: {}, pitzBalance: 100 })!;
      expect(view.next, recipeId).toMatchObject({ rungIndex: 1, kind: "SAUCE", price: 10 });
      expect(view.next!.price, recipeId).not.toBe(0);
      expect(stringValues(view).join("|"), recipeId).not.toMatch(/もう知って|知っていた|already/i);
    }
  });
});

describe("Cooking Techniques tripwire (TQ-1D, §12) — G7", () => {
  it("every production recipe is single-sauce and requires no technique; otherwise re-audit Hint 5.0 privacy and decide OD-H5-P4 first", () => {
    const requiring = RECIPE_DISCOVERY_CATALOG.filter((t) => requiredTechniquesOf(t).length > 0).map((t) => t.recipeId);
    expect(requiring, "TQ-1D (or the recipe PR) must re-audit Hint 5.0 privacy and decide OD-H5-P4 before shipping this recipe").toEqual([]);
    const notSingleSauce = RECIPES.filter((r) => buildHint5Ladder(r.id)!.rungs[0].subjectIds.length !== 1).map((r) => r.id);
    expect(notSingleSauce, "TQ-1D (or the recipe PR) must re-audit Hint 5.0 privacy and decide OD-H5-P4 before shipping this recipe").toEqual([]);
  });

  it("no Hint 5.0 view carries Technique identity, and the Hint 5.0 modules never read Technique state", () => {
    const techWords = TECHNIQUES.flatMap((t) => [t.id, t.nameJa, t.riddleJa]);
    for (const r of RECIPES) {
      for (const { view } of purchaseStates(r.id, 5)) {
        for (const v of stringValues(view)) {
          for (const w of techWords) expect(v.includes(w), `${r.id}: ${v}`).toBe(false);
          expect(v).not.toMatch(/ソース(なし|が?ない|を?使わない)|チーズ(なし|は?使わない)|ぬるもの|技|テクニック/);
        }
      }
    }
    const sources = import.meta.glob<string>(["./hint5Ladder.ts", "../../data/recipeHintRoles.ts", "../../data/hintClassDisplay.ts"], { query: "?raw", import: "default", eager: true });
    expect(Object.keys(sources)).toHaveLength(3);
    for (const [path, text] of Object.entries(sources)) expect(text, path).not.toMatch(/techniques\/|data\/techniques|discoveredTechniqueIds|TechniqueId/);
  });
});

describe("wiring boundary (H5-1 unwired -> H5-2 reducer -> H5-3 sheet, all behind the flag)", () => {
  it("H5-3: the only production importers of the Hint 5.0 layer are the hint state module and the hint sheet (no save, no reducer import)", () => {
    const sources = import.meta.glob<string>(["../../**/*.ts", "../../**/*.tsx", "!../../**/*.test.ts", "!../../**/*.test.tsx", "!../../**/testSupport/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const importers = Object.entries(sources)
      .filter(([path]) => !/\/(hint5Ladder|recipeHintRoles|hintClassDisplay)\.ts$/.test(path))
      .filter(([, text]) => /from\s+["'][^"']*\/(hint5Ladder|recipeHintRoles|hintClassDisplay)["']/.test(text))
      .map(([path]) => path);
    // H5-3: the sheet imports types and the ordinal helper for its ladder body.
    expect(importers.sort()).toEqual(["../../components/HintSheet.tsx", "../../state/discoveryHint.ts"]);
  });
});
