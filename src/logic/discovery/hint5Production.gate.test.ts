import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { HINT_CLASS_DISPLAY } from "../../data/hintClassDisplay";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { ingredientAttributeFamily } from "../../data/ingredientTaxonomy";
import { RECIPE_HINT_ROLES } from "../../data/recipeHintRoles";
import { RECIPES } from "../../data/recipes";
import { TECHNIQUES } from "../../data/techniques";
import { requiredTechniquesOf } from "../techniques/detection";
import { INGREDIENT_TOTAL_FACT_ID } from "./deductionHint";
import {
  buildHint5Ladder,
  hint5ClassFactId,
  hint5EmptyFixedRungs,
  hint5Presentation,
  requestHint5Rung,
  subToppingClass,
  type Hint5Presentation,
} from "./hint5Ladder";
import { buildSelectableHintModel } from "./selectableHint";
import { ladderTargets } from "./testSupport/deductionInversion";

/**
 * Discovery Hint 5.0 (Issue #292), H5-1: the production gate on the real 25-recipe catalog
 * (docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §1 AC-1, §3, §12, §13).
 *
 * **Cooking Techniques tripwire (TQ-1D, §12).** Every production recipe is single-sauce and requires
 * no technique. The tripwire test fails on purpose as soon as one does: TQ-1D (or that recipe's PR)
 * must re-audit Hint 5.0 privacy and decide OD-H5-P4 before shipping it. Never weaken it to pass.
 */

const LADDER_INDEX = new Map(ladderTargets(W1_25_DISCOVERY_LADDER).map((id, i) => [id, i]));
/** The Dex counts a target is seen at: its own ladder step and the full Dex. */
const dexCountsOf = (id: string) => [...new Set([Math.max(1, LADDER_INDEX.get(id) ?? 1), 25])];

const namesOf = (id: string) => buildHint5Ladder(id)!.rungs.filter((r) => r.kind !== "SUB_CLASS").flatMap((r) => r.subjectIds);
const subsOf = (id: string) => RECIPE_HINT_ROLES[id as keyof typeof RECIPE_HINT_ROLES].hintSubToppingOrder;
/** P4 / P4b: targets with an empty fixed rung cannot progress past it until the Owner decides. */
const P4_BLOCKED = new Set(RECIPES.filter((r) => hint5EmptyFixedRungs(r.id)!.length > 0).map((r) => r.id));

/** Every string value in a presentation (keys are ours; values are what a sheet could render). */
function stringValues(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringValues(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => stringValues(v, out));
  return out;
}

/** Every presentation state reachable by buying the ladder in order (0..n rungs owned). */
function purchaseStates(recipeId: string, discoveredCount: number): { stored: string[]; view: Hint5Presentation }[] {
  const out: { stored: string[]; view: Hint5Presentation }[] = [];
  let stored: string[] = [];
  for (let guard = 0; guard < 20; guard += 1) {
    const view = hint5Presentation({ recipeId, discoveredCount, storedFactIds: stored, legacyPurchases: {}, pitzBalance: 1000 })!;
    out.push({ stored, view });
    if (!view.next) break;
    const r = requestHint5Rung({ recipeId, discoveredCount, storedFactIds: stored, legacyPurchases: {}, expectedRungIndex: view.next.rungIndex, pitzBalance: 1000 });
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
      if (subs.length === 0 || P4_BLOCKED.has(r.id)) continue;
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
    expect(cases).toBeGreaterThanOrEqual(38);
  });

  it("the P4 / P4b-blocked targets still have a valid classification for every sub-topping (only the empty rung waits)", () => {
    expect([...P4_BLOCKED].sort()).toEqual(["fugazza", "marinara", "pesto-tonno", "pizza-bianca", "puttanesca-pizza", "quattro-formaggi"]);
    for (const id of P4_BLOCKED) for (const s of subsOf(id)) expect(subToppingClass(s), `${id}/${s}`).toBe(ingredientAttributeFamily(s));
  });

  it("G3: buying an unblocked ladder in order classifies every sub-topping, and never degrades to existence / group / category", () => {
    for (const r of RECIPES) {
      if (P4_BLOCKED.has(r.id)) continue;
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

describe("disclosure boundary (H5-INV-1..5)", () => {
  it("G5 / H5-INV-1: a classification never carries an ingredient name, id or glyph", () => {
    const words = INGREDIENTS.flatMap((i) => [i.nameJa, i.emoji]);
    for (const family of Object.keys(HINT_CLASS_DISPLAY)) {
      for (const r of RECIPES) {
        if (P4_BLOCKED.has(r.id)) continue;
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

  it("G15 / H5-INV-5 FREE LEAK: before STRUCTURE, every target's offer and board shape are identical given the same completed rungs", () => {
    for (let k = 0; k <= 3; k += 1) {
      const shapes = new Set<string>();
      for (const r of RECIPES) {
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
