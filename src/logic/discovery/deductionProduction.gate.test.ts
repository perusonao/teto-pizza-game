import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { TECHNIQUES } from "../../data/techniques";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { requiredTechniquesOf } from "../techniques/detection";
import { techniqueAffordanceStep } from "../techniques/registration";
import { productionTechniqueContext } from "../techniques/runtime";
import { DEDUCTION_HINT_PRICE, DEDUCTION_HINTS_ENABLED } from "./deductionFlag";
import { deductionHintTextJa, INGREDIENT_TOTAL_FACT_ID, MIN_ATTRIBUTE_CANDIDATES } from "./deductionHint";
import { guardedAnswerForParts, hypotheticalReserves, reserveInHypotheses, targetReserveParts, toppingClauseAllowedForParts, TOPPING_TOTAL_FACT_ID } from "./deductionGuard";
import { deductionKnownLines, requestDeductionHint, type DeductionFamily } from "./deductionRequest";
import { attackStateOf, endgameAttack, type GuardUnderAttack } from "./testSupport/deductionAttacker";
import { ALL_INGREDIENT_IDS, inversionCandidates, observeGuardedWithClause, sweepStates } from "./testSupport/deductionInversion";

/**
 * Discovery Hint 4.0 (Issue #253), DH4 Production Enablement Fresh Gate (OD-DH4-PROD-1): what must
 * hold on the real 25-recipe production catalog before 構成 / 特徴 are sold in production at the
 * fixed 5 / 5 price. Report: docs/reports/TETO_DISCOVERY-HINT-4_DH4-PROD_Production-Enablement_Result.md.
 *
 * States: the 300 ladder states (every target at its own step and every later one) plus seeded
 * random acquisition orders (T1a: the starters first, then any order), each at every point where the
 * target is makeable.
 *
 * **Cooking Techniques contract (TQ-1D).** Every production recipe has exactly one sauce, so none of
 * them is a NO_SAUCE (Technique) recipe, and 構成 / 特徴 read ingredients only. The first test here
 * fails as soon as a production recipe breaks that; TQ-1D must then re-run this whole gate (and the
 * DH4 privacy sweeps) with the Technique recipes before it ships them.
 */

const HARDENED: GuardUnderAttack = { answer: guardedAnswerForParts, clauseAllowed: toppingClauseAllowedForParts };
const ladderStates = sweepStates(W1_25_DISCOVERY_LADDER);

/** Deterministic PRNG (mulberry32) so the random orders are the same on every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GateState {
  recipeId: string;
  owned: string[];
  discoveredCount: number;
}

/** Random acquisition orders: starters, then every other ingredient shuffled; for each recipe, the
 *  shortest prefix that makes it makeable and the full list (a late, Dex-pinned target). */
function randomOrderStates(seeds: number): GateState[] {
  const starters = [...STARTER_INGREDIENT_IDS];
  const rest = INGREDIENTS.map((i) => i.id).filter((id) => !starters.includes(id));
  const out: GateState[] = [];
  for (let seed = 1; seed <= seeds; seed += 1) {
    const next = rng(seed);
    const order = [...rest];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const all = [...starters, ...order];
    for (const recipe of RECIPES) {
      if (recipe.id === "margherita") continue;
      const need = new Set(recipe.requiredIngredients.map((r) => r.ingredientId));
      let cut = starters.length;
      while (cut < all.length && [...need].some((id) => !all.slice(0, cut).includes(id))) cut += 1;
      out.push({ recipeId: recipe.id, owned: all.slice(0, cut), discoveredCount: 5 });
      out.push({ recipeId: recipe.id, owned: all, discoveredCount: 5 });
    }
  }
  return out;
}

const GATE_STATES: GateState[] = [
  ...ladderStates.map((s) => ({ recipeId: s.recipeId, owned: s.owned, discoveredCount: s.step })),
  ...RECIPES.filter((r) => r.id !== "margherita").map((r) => ({ recipeId: r.id, owned: [...ALL_INGREDIENT_IDS], discoveredCount: 24 })),
  ...randomOrderStates(40),
];

const ctxOf = (s: GateState) => ({ discoveredCount: s.discoveredCount, ownedIngredientIds: s.owned });

/** One fresh request (nothing owned yet) at the production price. */
function freshRequest(s: GateState, family: DeductionFamily) {
  return requestDeductionHint({
    family,
    recipeId: s.recipeId,
    context: ctxOf(s),
    storedFactIds: [],
    legacyPurchases: {},
    requestPrice: DEDUCTION_HINT_PRICE[family],
    paidCount: 0,
    expectedPaidCount: 0,
    pitzBalance: 1000,
  });
}

const sauceCount = (recipeId: string) =>
  new Set(RECIPES.find((r) => r.id === recipeId)!.requiredIngredients.map((r) => r.ingredientId).filter((id) => getIngredient(id)?.category === "sauce")).size;

describe("DH4-PROD gate: the production switch and price (OD-DH4-PROD-1)", () => {
  it("the flag is on in every build: it is a constant, with no DEV / Preview env condition", async () => {
    expect(DEDUCTION_HINTS_ENABLED).toBe(true);
    const sources = import.meta.glob<string>("./deductionFlag.ts", { query: "?raw", import: "default", eager: true });
    const text = Object.values(sources)[0];
    expect(text).toBeTruthy();
    expect(text).not.toMatch(/import\.meta\.env/);
  });
  it("構成 5 / 特徴 5, never 0", () => {
    expect(DEDUCTION_HINT_PRICE).toEqual({ structure: 5, attribute: 5 });
  });
});

describe("DH4-PROD gate: Cooking Techniques privacy on the 25 production recipes (TQ-1D contract)", () => {
  it("25 production recipes, each with exactly one sauce: no NO_SAUCE (Technique) recipe exists yet", () => {
    expect(RECIPES).toHaveLength(25);
    const breaking = RECIPES.filter((r) => sauceCount(r.id) !== 1).map((r) => r.id);
    // If this fails, a Technique recipe reached production: re-run the DH4 Production gate and the
    // DH4 privacy sweeps with it (TQ-1D contract) before shipping it.
    expect(breaking, "re-run the DH4 privacy gate for Technique recipes (TQ-1D)").toEqual([]);
  });
  it("no request, stored id or line ever carries Technique information", () => {
    const techWords = TECHNIQUES.flatMap((t) => [t.id, t.nameJa, t.riddleJa]);
    for (const s of GATE_STATES) {
      for (const family of ["structure", "attribute"] as const) {
        const r = freshRequest(s, family);
        if (r.outcome === "REJECTED") continue;
        for (const id of r.addFactIds) expect(id, `${s.recipeId}: ${id}`).toMatch(/^(meta:(ingredient|topping)-total|attr:(family|group|category):[a-z]+)$/);
        const lines = deductionKnownLines(s.recipeId, ctxOf(s), r.addFactIds, {});
        for (const line of [...lines.structure, ...lines.attribute]) {
          for (const w of techWords) expect(line.includes(w), `${s.recipeId}: ${line}`).toBe(false);
          expect(line).not.toMatch(/ソース(なし|が?ない|を?使わない)|ぬるもの|技|テクニック/);
        }
      }
    }
  });
  it("INV-TQ-4 on the TQ-1C runtime: no production target requires a technique and no affordance opens", () => {
    const { catalog, materialStep } = productionTechniqueContext();
    expect(catalog).toBe(RECIPE_DISCOVERY_CATALOG);
    expect(catalog.map((t) => t.recipeId).sort()).toEqual(RECIPES.map((r) => r.id).sort());
    const requiring = catalog.filter((t) => requiredTechniquesOf(t).length > 0).map((t) => t.recipeId);
    // If this fails, TQ-1D brought a Technique recipe: re-run this DH4 gate with it first.
    expect(requiring, "re-run the DH4 privacy gate for Technique recipes (TQ-1D)").toEqual([]);
    for (const t of TECHNIQUES) expect(techniqueAffordanceStep(t.id, catalog, materialStep), t.id).toBeNull();
  });
  it("the hint path never reads Technique state: no technique import or ledger field in the hint / deduction modules", () => {
    const sources = import.meta.glob<string>(
      ["./deduction*.ts", "./selectableHint.ts", "./hintSteps.ts", "./hintTarget.ts", "./hintPurchase.ts", "./hintFactMigration.ts", "../../state/discoveryHint.ts", "../../components/HintSheet.tsx", "../../data/ingredientTaxonomy.ts", "!./*.test.ts"],
      { query: "?raw", import: "default", eager: true },
    );
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(10);
    for (const [path, text] of Object.entries(sources)) {
      expect(text, path).not.toMatch(/techniques\/|data\/techniques|discoveredTechniqueIds|lastTechniqueDiscovery|TechniqueId/);
    }
  });
  it("構成 counts ingredients only: the total is the recipe's distinct ingredient count", () => {
    for (const r of RECIPES.filter((x) => x.id !== "margherita")) {
      const s = GATE_STATES.find((g) => g.recipeId === r.id)!;
      const answered = freshRequest(s, "structure");
      expect(answered.outcome).toBe("ANSWERED");
      const line = deductionKnownLines(r.id, ctxOf(s), [INGREDIENT_TOTAL_FACT_ID], {}).structure[0];
      expect(line).toBe(`このピザは全部で${new Set(r.requiredIngredients.map((x) => x.ingredientId)).size}種類の材料を使うよ`);
    }
  });
});

describe("DH4-PROD gate: privacy on real data (ladder + random acquisition orders)", () => {
  it("covers every non-onboarding production recipe in a few thousand states", () => {
    expect(new Set(GATE_STATES.map((s) => s.recipeId)).size).toBe(24);
    expect(GATE_STATES.length).toBeGreaterThan(2000);
  });

  it("k >= 2 with coarse / existence fallback: the guarded answer (with the clause) never narrows the reserve to one", () => {
    let checked = 0;
    let failClosed = 0;
    const preExistingPublic = new Set<string>();
    for (const s of GATE_STATES) {
      const parts = targetReserveParts(s.recipeId, ctxOf(s));
      if (!parts) continue; // T1a: an untrusted order is not a target -> nothing answered
      if (!reserveInHypotheses(parts)) {
        // The public model cannot explain this reserve (e.g. it was bought after the free key in a
        // non-ladder order): the guard fails closed -- existence, no topping clause.
        failClosed += 1;
        expect(guardedAnswerForParts(parts)!.level, `${s.recipeId} @${s.owned.length}`).toBe("existence");
        expect(toppingClauseAllowedForParts(parts)).toBe(false);
        continue;
      }
      checked += 1;
      const h = hypotheticalReserves(parts);
      if (h.length < MIN_ATTRIBUTE_CANDIDATES) {
        // Pre-existing (Hint 3.0, not DH4): Rule W plus a fully known 材料 part already leave one
        // candidate, with no 構成 / 特徴 answer at all. DH4 must add nothing: existence, no clause.
        preExistingPublic.add(s.recipeId);
        expect(guardedAnswerForParts(parts)!.level, `${s.recipeId} @${s.owned.length}`).toBe("existence");
        expect(toppingClauseAllowedForParts(parts)).toBe(false);
        continue;
      }
      expect(inversionCandidates(parts, observeGuardedWithClause).length, `${s.recipeId} @${s.owned.length}`).toBeGreaterThanOrEqual(MIN_ATTRIBUTE_CANDIDATES);
    }
    expect(checked).toBeGreaterThan(1000);
    expect(failClosed).toBeGreaterThan(0);
    expect([...preExistingPublic].sort()).toEqual(["melanzane-pizza", "parmigiana-pizza"]);
  });

  it("an independent attacker (no access to the guard's hypothesis set) names the reserve in 0 states", () => {
    for (const s of GATE_STATES) {
      const parts = targetReserveParts(s.recipeId, ctxOf(s));
      if (!parts) continue;
      const recipe = RECIPES.find((r) => r.id === s.recipeId)!;
      const leaks = endgameAttack(HARDENED, attackStateOf(recipe, parts.reserveId, parts.owned)).filter((r) => r.leak);
      expect(leaks, `${s.recipeId} @${s.owned.length}`).toEqual([]);
    }
  }, 180_000);

  it("「その他」 (provisional copy, OD-DH4-2-9) is unreachable: no family/group 'other' answer in any state", () => {
    const levels = new Map<string, number>();
    for (const s of GATE_STATES) {
      const r = freshRequest(s, "attribute");
      if (r.outcome !== "ANSWERED") continue;
      for (const id of r.addFactIds) levels.set(id, (levels.get(id) ?? 0) + 1);
      expect(r.addFactIds.join()).not.toMatch(/:other$/);
    }
    expect([...levels.keys()].every((id) => /^attr:(category|group|family):/.test(id))).toBe(true);
  });

  it("Pitz is charged only when a real new fact is produced; existence / guidance / owned are free", () => {
    const outcomes = new Map<string, number>();
    for (const s of GATE_STATES) {
      for (const family of ["structure", "attribute"] as const) {
        const r = freshRequest(s, family);
        outcomes.set(r.outcome, (outcomes.get(r.outcome) ?? 0) + 1);
        if (r.outcome === "REJECTED") continue;
        expect(r.charge > 0, `${s.recipeId} ${family} ${r.outcome}`).toBe(r.addFactIds.length > 0);
        if (r.outcome === "ANSWERED") expect(r.charge).toBe(5);
        else expect(r.charge).toBe(0);
        // Owned afterwards: asking again is free and adds nothing.
        if (r.outcome === "ANSWERED") {
          const again = requestDeductionHint({
            family,
            recipeId: s.recipeId,
            context: ctxOf(s),
            storedFactIds: r.addFactIds,
            legacyPurchases: {},
            requestPrice: 5,
            paidCount: 1,
            expectedPaidCount: 1,
            pitzBalance: 1000,
          });
          expect(again.outcome === "REJECTED" ? 0 : again.charge).toBe(0);
          expect(again.outcome === "REJECTED" ? [] : again.addFactIds).toEqual([]);
        }
      }
    }
    expect(outcomes.get("ANSWERED")).toBeGreaterThan(0);
    expect(outcomes.get("EXISTENCE_ONLY")).toBeGreaterThan(0);
  });

  it("lines are positive facts only: no name, recipe identity, remaining count, 0, absence or 「？」", () => {
    const names = [...INGREDIENTS.map((i) => i.nameJa), ...RECIPES.map((r) => r.nameJa), ...RECIPES.map((r) => r.description)];
    const ids = [...INGREDIENTS.map((i) => i.id), ...RECIPES.map((r) => r.id)];
    const seen = new Set<string>();
    for (const s of GATE_STATES) {
      const facts = [
        ...(freshRequest(s, "structure") as { addFactIds?: readonly string[] }).addFactIds ?? [],
        ...(freshRequest(s, "attribute") as { addFactIds?: readonly string[] }).addFactIds ?? [],
      ];
      const lines = deductionKnownLines(s.recipeId, ctxOf(s), facts, {});
      for (const line of [...lines.structure, ...lines.attribute]) seen.add(line);
    }
    expect(seen.size).toBeGreaterThan(3);
    for (const line of seen) {
      expect(line).not.toMatch(/[？?]|残り|あと|0種類|ない材料は|入っていない|使わない|[a-z]{3,}/);
      for (const n of names) expect(line.includes(n), `${line} names ${n}`).toBe(false);
      for (const id of ids) expect(line.includes(id)).toBe(false);
    }
    // Every line is one of the fixed templates.
    for (const line of seen) {
      expect(line).toMatch(/^(このピザは全部で[1-9]\d*種類の材料を使うよ|トッピングは[1-9]\d*種類使うよ|まだわかっていない(材料に、.+の仲間があるよ|ソースがあるよ|チーズがあるよ|トッピングがあるよ))$/);
    }
    expect(deductionHintTextJa({ id: INGREDIENT_TOTAL_FACT_ID, total: 3 })).toBe("このピザは全部で3種類の材料を使うよ");
    expect(TOPPING_TOTAL_FACT_ID).toBe("meta:topping-total");
  });

  it("no pre-purchase leak: the request outcome depends on nothing the player can see before paying", () => {
    // The pure authority's refusals come before any answer: an unaffordable request is refused the
    // same way for every target and family, whatever the answer would have been.
    for (const s of GATE_STATES.slice(0, 400)) {
      for (const family of ["structure", "attribute"] as const) {
        const poor = requestDeductionHint({
          family,
          recipeId: s.recipeId,
          context: ctxOf(s),
          storedFactIds: [],
          legacyPurchases: {},
          requestPrice: 5,
          paidCount: 0,
          expectedPaidCount: 0,
          pitzBalance: 4,
        });
        if (poor.outcome === "REJECTED" && poor.reason === "NOT_A_TARGET") continue;
        expect(poor).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
      }
    }
  });
});
