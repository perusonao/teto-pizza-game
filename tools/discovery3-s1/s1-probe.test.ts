/**
 * Discovery 3.0 S1 (measurement / migration gate) probe. Tooling only: it READS production modules and never writes to them.
 * brazilian-calabresa exists here only as a synthetic fixture (`CALABRESA`); it is NOT in `RECIPES`.
 *
 * Covers S1 items A (data fidelity), B (reuse-only), C (pool = 2), D (ladder acceleration), J (Notebook), K (matcher collision)
 * and L (economy / inventory). E / F / H are in tools/discovery3_s1_measure.py; I is e2e/discovery3-s1-almost-there-oracle.spec.ts.
 *
 * Run: npx vitest run --config tools/discovery3-s1/vitest.s1.config.ts   (writes docs/reports/data/TETO_DISCOVERY-3_S1_PROBE.json)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../src/data/discoveryLadder";
import { RECIPE_DISCOVERY_CATALOG } from "../../src/data/discoveryCatalog";
import { getIngredient } from "../../src/data/ingredients";
import { RECIPES, type Recipe } from "../../src/data/recipes";
import { discoverableHintCandidates } from "../../src/logic/discovery/hintTarget";
import { classifyNearMiss } from "../../src/logic/discovery/nearMiss";
import { attemptFingerprintOfSignature } from "../../src/logic/discovery/attemptFingerprint";
import { matchDiscovery, type RecipeDiscoveryTarget } from "../../src/logic/discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, type RuntimeSignature } from "../../src/logic/discovery/signature";
import { createTrialNotebook, notebookView, recordAttempt } from "../../src/logic/discovery/trialNotebook";
import { discoveredRecipeCount, ladderUnlockedMaterialIds, reachedStepNumber, validateDiscoveryLadder, validateLadderProgression } from "../../src/logic/discoveryLadder";
import { MATERIAL_PRICE_TIERS, materialK, materialOffer, packQuantity } from "../../src/logic/materialShop";
import { PITZ_FIRST_DISCOVERY_BONUS, calculatePitzReward } from "../../src/logic/pitzReward";
import { resolveFreeCookPizza } from "../../src/logic/discovery/freeCook";
import { createEmptyPizza, type PizzaState } from "../../src/state/pizzaState";
import { recipeDiscoveryState } from "../../src/state/recipeDiscoveryState";
import type { DexState } from "../../src/state/dex";

const STARTERS = ["basil", "mozzarella", "tomato-sauce"];
/** Synthetic. `minCount` values are an authoring placeholder (the evidence has none); they are an S2 blocker, not a finding. */
const CALABRESA = {
  id: "brazilian-calabresa",
  nameJa: "ブラジリアン・カラブレーザ",
  description: "(audit fixture)",
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "sausage", minCount: 2 },
    { ingredientId: "onion", minCount: 2 },
    { ingredientId: "black-olive", minCount: 2 },
    { ingredientId: "oregano", minCount: 1 },
  ],
  bakeTarget: { start: 58, end: 78 },
  baseRewardPitz: 100,
} as unknown as Recipe;
const W1_IDS = new Set<string>(RECIPES.map((r) => r.id));
const ALL: Recipe[] = [...(RECIPES as unknown as Recipe[]), CALABRESA];
const out: Record<string, unknown> = {};

const entry = (recipeId: string) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 });
const materialsAt = (step: number) => ladderUnlockedMaterialIds(DISCOVERY_LADDER, step);
const inputsFor = (step: number, discovered: readonly string[]) => {
  const owned = [...STARTERS, ...materialsAt(step)];
  const inventory: Record<string, number> = {};
  for (const id of owned) if (getIngredient(id)?.unlockCondition) inventory[id] = 30;
  return { dex: discovered.map(entry) as DexState, ownedIngredientIds: owned, unlockedForShopIngredientIds: owned, inventory };
};
const keyOfStep = (s: number) => DISCOVERY_LADDER.steps[s - 1].keyRecipeId;

describe("S1 probe", () => {
  it("B: reuse-only (every ingredient is a runtime ingredient inside the frozen ladder)", () => {
    const rows = CALABRESA.requiredIngredients.map((r) => ({
      id: r.ingredientId,
      inRuntimeIngredients: !!getIngredient(r.ingredientId),
      starter: !getIngredient(r.ingredientId)?.unlockCondition,
      ladderStep: DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(r.ingredientId))?.step ?? null,
    }));
    const lastStep = Math.max(...rows.map((r) => r.ladderStep ?? 0));
    const prog = (list: Recipe[]) => validateLadderProgression(DISCOVERY_LADDER, list.map((r) => ({ id: r.id, ingredientIds: r.requiredIngredients.map((x) => x.ingredientId) })), STARTERS);
    out.B_ladderValidators = { structure: validateDiscoveryLadder(DISCOVERY_LADDER), progressionBaseline: prog(RECIPES as unknown as Recipe[]), progressionWithCalabresa: prog(ALL) };
    expect(prog(ALL)).toEqual([]);
    out.B = { rows, newIngredients: rows.filter((r) => !r.inRuntimeIngredients).length, ladderStepsAdded: 0, lastNeededStep: lastStep, lastNeededIngredients: rows.filter((r) => r.ladderStep === lastStep).map((r) => r.id) };
    expect(rows.every((r) => r.inRuntimeIngredients && (r.starter || r.ladderStep !== null))).toBe(true);
    expect(lastStep).toBe(12);
  });

  it("C: pool per ladder step (real recipeDiscoveryState), baseline vs +calabresa; hint-target order at the branch", () => {
    const rows: Record<string, unknown>[] = [];
    for (let s = 0; s <= 24; s += 1) {
      const discovered = ["margherita", ...Array.from({ length: s }, (_, i) => i + 1).slice(0, Math.max(0, s - 1)).map(keyOfStep)];
      const inputs = inputsFor(s, discovered);
      const pool = (list: Recipe[]) => list.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE").map((r) => r.id);
      rows.push({ step: s, discovered: discovered.length, baseline: pool(RECIPES as unknown as Recipe[]), withCalabresa: pool(ALL) });
    }
    const at12 = inputsFor(12, ["margherita", ...Array.from({ length: 11 }, (_, i) => keyOfStep(i + 1))]);
    const order = discoverableHintCandidates(at12, ALL).map((r) => r.id);
    out.C = { rows, step11PoolWithCalabresa: (rows[11] as { withCalabresa: string[] }).withCalabresa, step12PoolWithCalabresa: (rows[12] as { withCalabresa: string[] }).withCalabresa, hintTargetOrderAtStep12: order };
    expect((rows[12] as { withCalabresa: string[] }).withCalabresa.sort()).toEqual(["brazilian-calabresa", "pizza-portuguesa"]);
    expect((rows[11] as { withCalabresa: string[] }).withCalabresa).toEqual(["capricciosa"]);
  });

  it("D: discovery-count ladder acceleration (players x options)", () => {
    type Option = "O1 status quo (count all)" | "O2 count W1 recipes only" | "O4 calabresa gated until W1 complete";
    const stepFor = (option: Option, discovered: readonly string[]) => {
      const n = option === "O1 status quo (count all)" ? discoveredRecipeCount(discovered.map(entry) as DexState) : discovered.filter((id) => W1_IDS.has(id)).length;
      return reachedStepNumber(DISCOVERY_LADDER, n);
    };
    const poolOf = (option: Option, discovered: string[]) => {
      const step = stepFor(option, discovered);
      const inputs = inputsFor(step, discovered);
      let pool = ALL.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE").map((r) => r.id);
      if (option === "O4 calabresa gated until W1 complete" && step < 24) pool = pool.filter((id) => id !== CALABRESA.id);
      return pool;
    };
    type Player = "normal (never finds it)" | "finds it first" | "finds it later (after 18 discoveries)" | "finds everything immediately";
    const pick = (player: Player, pool: string[], count: number) => {
      const w1 = pool.filter((id) => id !== CALABRESA.id);
      const cal = pool.includes(CALABRESA.id);
      if (player === "normal (never finds it)") return w1[0];
      if (player === "finds it first") return cal ? CALABRESA.id : w1[0];
      if (player === "finds it later (after 18 discoveries)") return cal && count >= 18 ? CALABRESA.id : (w1[0] ?? (cal ? CALABRESA.id : undefined));
      return cal ? CALABRESA.id : w1[0];
    };
    const run = (player: Player, option: Option) => {
      const discovered = ["margherita"];
      const trace: { round: number; discovered: number; step: number; pool: number }[] = [];
      let maxLeadOverW1 = 0;
      let w1AtStep24: number | null = null;
      for (let round = 1; round <= 40; round += 1) {
        const pool = poolOf(option, discovered);
        const step = stepFor(option, discovered);
        const w1 = discovered.filter((id) => W1_IDS.has(id)).length;
        maxLeadOverW1 = Math.max(maxLeadOverW1, step - w1);
        if (step >= 24 && w1AtStep24 === null) w1AtStep24 = w1;
        trace.push({ round, discovered: discovered.length, step, pool: pool.length });
        const next = pick(player, pool, discovered.length);
        if (!next) break;
        discovered.push(next);
      }
      return { trace, discovered: discovered.length, finalStep: stepFor(option, discovered), maxLeadOverW1, w1AtStep24 };
    };
    const baseline = run("normal (never finds it)", "O1 status quo (count all)").trace;
    const players: Player[] = ["normal (never finds it)", "finds it first", "finds it later (after 18 discoveries)", "finds everything immediately"];
    const options: Option[] = ["O1 status quo (count all)", "O2 count W1 recipes only", "O4 calabresa gated until W1 complete"];
    const results: Record<string, unknown>[] = [];
    for (const player of players) {
      for (const option of options) {
        const r = run(player, option);
        let maxLead = 0;
        let leadAt = 0;
        for (const t of r.trace) {
          const b = baseline[t.round - 1];
          if (b && t.step - b.step > maxLead) { maxLead = t.step - b.step; leadAt = t.round; }
        }
        const reach24 = r.trace.find((t) => t.step >= 24)?.round ?? null;
        results.push({
          player, option, rounds: r.trace.length, totalDiscoveries: r.discovered, finalStep: r.finalStep, roundReachingStep24: reach24,
          stepByRoundLeadVsBaseline: maxLead, leadFirstSeenAtRound: leadAt || null,
          maxStepLeadOverW1Discoveries: r.maxLeadOverW1, w1DiscoveriesWhenStep24Reached: r.w1AtStep24,
          poolHistogram: r.trace.reduce<Record<number, number>>((h, t) => ((h[t.pool] = (h[t.pool] ?? 0) + 1), h), {}),
          poolAtRounds12to16: r.trace.slice(11, 16).map((t) => t.pool),
        });
      }
    }
    out.D = { baselineRoundReaching24: baseline.find((t) => t.step >= 24)?.round, results,
      note: "round = one discovery. O3 (per-recipe ladder-credit flag) is numerically identical to O2 for one recipe whose credit is false; O5 (economy retune only) is O1 plus a cost curve (see L)." };
    const find = (p: Player, o: Option) => results.find((r) => r.player === p && r.option === o) as { maxStepLeadOverW1Discoveries: number };
    expect(find("normal (never finds it)", "O1 status quo (count all)").maxStepLeadOverW1Discoveries).toBe(0);
    expect(find("finds it first", "O1 status quo (count all)").maxStepLeadOverW1Discoveries).toBeGreaterThan(0);
    expect(find("finds it first", "O2 count W1 recipes only").maxStepLeadOverW1Discoveries).toBe(0);
  });

  it("K: matcher collision, J: Notebook behaviour (pure model, real matcher / near-miss)", () => {
    const toTarget = (r: Recipe, id: string): RecipeDiscoveryTarget => {
      const ids = [...new Set(r.requiredIngredients.map((x) => x.ingredientId))].sort();
      return { targetId: id, recipeId: r.id as never, items: ids, sauceBase: ids.filter((i) => getIngredient(i)?.category === "sauce"), capabilities: [], identityDimensions: DEFAULT_IDENTITY_DIMENSIONS, eligibility: { status: "ELIGIBLE" } };
    };
    const catalog = [...RECIPE_DISCOVERY_CATALOG, toTarget(CALABRESA, "brazilian-calabresa-audit")];
    const sig = (ids: string[]): RuntimeSignature => {
      const sorted = [...new Set(ids)].sort();
      const sauces = sorted.filter((i) => getIngredient(i)?.category === "sauce");
      const dims = Object.fromEntries(Object.entries(DEFAULT_IDENTITY_DIMENSIONS).map(([k, v]) => [k, { status: "FIXED_BY_FLOW", value: v }]));
      return { ingredientSet: { status: "OBSERVED", value: sorted }, sauceBase: { status: "OBSERVED", value: sauces }, ingredientCounts: {}, dimensions: dims } as unknown as RuntimeSignature;
    };
    const identityKeys = catalog.map((t) => JSON.stringify([t.items, t.sauceBase]));
    const collisions = identityKeys.length - new Set(identityKeys).size;
    const matchOf = (ids: string[]) => { const m = matchDiscovery(sig(ids), catalog); return m.kind === "UNIQUE_MATCH" ? m.target.recipeId : m.kind; };
    const calabresaIds = CALABRESA.requiredIngredients.map((r) => r.ingredientId);
    const portuguesaIds = RECIPES.find((r) => r.id === "pizza-portuguesa")!.requiredIngredients.map((r) => r.ingredientId);
    const capricciosaIds = RECIPES.find((r) => r.id === "capricciosa")!.requiredIngredients.map((r) => r.ingredientId);
    out.K = { catalogSize: catalog.length, identityCollisions: collisions, calabresaMatches: matchOf(calabresaIds), portuguesaMatches: matchOf(portuguesaIds), capricciosaMatches: matchOf(capricciosaIds),
      calabresaPlusMozzarella: matchOf([...calabresaIds, "mozzarella"]), note: "calabresa vs capricciosa share sauce, count 4 and family composition; they differ in cheese and in 3 of 4 toppings" };
    expect(collisions).toBe(0);
    expect(matchOf(calabresaIds)).toBe("brazilian-calabresa");

    // J: two-target pool at step 12; the player alternates; near-miss is classified against the nearest DISCOVERABLE recipe
    const inputs = inputsFor(12, ["margherita", ...Array.from({ length: 11 }, (_, i) => keyOfStep(i + 1))]);
    const pool = discoverableHintCandidates(inputs, ALL);
    const options = { catalog, recipes: ALL };
    let nb = createTrialNotebook();
    const tries: { label: string; ids: string[] }[] = [
      { label: "calabresa + mozzarella (extra cheese)", ids: [...calabresaIds, "mozzarella"] },
      { label: "portuguesa minus ham", ids: portuguesaIds.filter((i) => i !== "ham") },
      { label: "calabresa + mozzarella (same again)", ids: [...calabresaIds, "mozzarella"] },
      { label: "tomato + sausage + onion", ids: ["tomato-sauce", "sausage", "onion"] },
    ];
    const rows: Record<string, unknown>[] = [];
    for (const t of tries) {
      const s = sig(t.ids);
      const nm = classifyNearMiss(s, pool, options);
      const fb = nm ? { kind: nm.kind, textJa: `(near-miss ${nm.kind})` } : null;
      const r = recordAttempt(nb, { fingerprint: attemptFingerprintOfSignature(s), feedback: fb });
      nb = r.state;
      rows.push({ label: t.label, match: matchOf(t.ids), nearMiss: nm, recorded: r.outcome });
    }
    // the notebook stores the player's own combination and the shown line only -- never a recipe, target or distance
    const view = notebookView(nb);
    const leaked = JSON.stringify(view).match(/calabresa|portuguesa|brazilian|pizza-portuguesa|distance/i);
    // prototype (test-local, NOT production) of the two derived views the Owner direction asks for
    const diff = (a: string[], b: string[]) => ({ added: b.filter((x) => !a.includes(x)), removed: a.filter((x) => !b.includes(x)) });
    const diffs = tries.slice(1).map((t, i) => ({ from: tries[i].label, to: t.label, ...diff(tries[i].ids, t.ids) }));
    out.J = { pool: pool.map((r) => r.id), rows, notebookView: view, notebookLeaksRecipeOrDistance: leaked ? leaked[0] : null, derivedDiffPrototype: diffs,
      note: "diff and hint-consistency are pure functions of the player's own attempts (and owned facts); the notebook needs no new hidden fact" };
    expect(leaked).toBeNull();
  });

  it("L: economy / inventory", () => {
    const base = RECIPES as unknown as Recipe[];
    const rows = ["sausage", "onion", "black-olive", "oregano"].map((id) => {
      const ing = getIngredient(id)!;
      const before = materialOffer(ing, { recipes: base });
      const after = materialOffer(ing, { recipes: ALL });
      return { id, k_before: materialK(id, base), k_after: materialK(id, ALL), pack_before: packQuantity(id, base), pack_after: packQuantity(id, ALL), step: before?.step, tier: before?.tier, packPrice: before?.packPrice, refillPrice: before?.refillPrice, offerUnchanged: JSON.stringify(before) === JSON.stringify(after) };
    });
    const r = calculatePitzReward(100, 70, true);
    const perStep = DISCOVERY_LADDER.steps.map((s) => ({ step: s.step, ingredients: s.ingredientIds.length, packPrice: MATERIAL_PRICE_TIERS.find((t) => s.step >= t.firstStep && (t.lastStep === null || s.step <= t.lastStep))!.packPrice }));
    const cumulativeCostToStep = (n: number) => perStep.filter((s) => s.step <= n).reduce((a, s) => a + s.ingredients * s.packPrice, 0);
    out.L = {
      materialsTouchedByCalabresa: rows,
      note_minCount: "calabresa minCount values are a placeholder; k changes only if a minCount exceeds the existing maximum for that ingredient",
      pitzPerFirstDiscoveryAt70: { earned: r.earnedPitz, bonus: r.discoveryBonusPitz, total: r.earnedPitz + r.discoveryBonusPitz, firstDiscoveryBonusConst: PITZ_FIRST_DISCOVERY_BONUS },
      cumulativePackCostToStep: { 12: cumulativeCostToStep(12), 18: cumulativeCostToStep(18), 24: cumulativeCostToStep(24) },
      recipeExtraIncome: "one more discoverable recipe = one more first-discovery payout (base 100 x quality + 50 bonus) and one more ladder credit under O1",
      inventoryConsumption: "no inventory change: calabresa uses 4 finite materials already sold (sausage, onion, black-olive, oregano); a round consumes stock like any recipe",
    };
    expect(rows.every((x) => x.offerUnchanged)).toBe(true);
  });

  it("A: authority data fidelity (172 matrix + PIZZA DB master evidence + master catalog)", () => {
    const matrix = JSON.parse(readFileSync("docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json", "utf8"));
    const row = matrix.rows.find((r: { evidenceId: string }) => r.evidenceId === "brazilian-calabresa-pizzadb-p10");
    const catalog = JSON.parse(readFileSync("data/recipes/pizza_master_catalog.json", "utf8")).recipes as { id: string; ingredients: string[] }[];
    const evidenceText = readFileSync("docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json", "utf8");
    const evidence = JSON.parse(evidenceText);
    const flat = JSON.stringify(evidence);
    const at = flat.indexOf('"id":"brazilian-calabresa-pizzadb-p10"');
    const pick = (o: unknown): unknown => {
      const hits: unknown[] = [];
      const walk = (n: unknown) => { if (n && typeof n === "object") { if ((n as { id?: string }).id === "brazilian-calabresa-pizzadb-p10") hits.push(n); for (const v of Object.values(n as object)) walk(v); } };
      walk(o);
      return hits[0] ?? null;
    };
    const ev = pick(evidence) as Record<string, unknown> | null;
    out.A = {
      matrixIdentitySet: row.ingredients.identityIngredientSet, matrixStatus: row.productDecisionStatus, matrixRepresentability: row.currentFlowRepresentability, matrixBlockers: row.blockers, matrixReviewItems: row.reviewItems,
      fixtureIdentitySet: [...new Set(CALABRESA.requiredIngredients.map((r) => r.ingredientId))].sort(),
      masterEvidenceRecordKeys: ev ? Object.keys(ev) : null, masterEvidenceRecord: ev ? Object.fromEntries(Object.entries(ev).filter(([k]) => /name|ingredient|sauce|origin|source|cheese/i.test(k))) : null, evidenceFoundAtOffset: at,
      masterCatalogSimilarIds: catalog.filter((c) => /calab/.test(c.id)).map((c) => ({ id: c.id, ingredients: c.ingredients })),
      namingCluster: matrix.namingClusterLedger.filter((n: { id: string }) => n.id === "NC-4-calabresa"),
    };
    expect([...new Set(CALABRESA.requiredIngredients.map((r) => r.ingredientId))].sort()).toEqual([...row.ingredients.identityIngredientSet].sort());
  });


  it("I-support: which quality failures turn an exact identity into INCOMPLETE_MATCH (real resolveFreeCookPizza, pure)", () => {
    const pizza = (sauce: string, pieces: string[], bake: number | null, deposits: { x: number; y: number; amount: number }[]): PizzaState => ({
      ...createEmptyPizza(), sauceIds: [sauce], sauceDeposits: deposits, bakeResult: bake,
      toppings: pieces.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, x: 40 + i * 3, y: 50 })),
    });
    const kind = (px: PizzaState) => { const r = resolveFreeCookPizza(px, []); return r.kind === "MATCHED" ? `MATCHED:${r.recipe.id}` : r.kind === "ORIGINAL" ? `ORIGINAL/${r.outcome.kind}` : `FAILED:${r.completion.reason}`; };
    const marinara = ["garlic", "garlic", "garlic", "oregano", "oregano"];
    const funghi = ["mozzarella", "mozzarella", "mushroom", "mushroom", "mushroom"];
    const ring = Array.from({ length: 16 }, (_, i) => ({ x: 50 + Math.cos((i / 16) * 6.283) * 25, y: 50 + Math.sin((i / 16) * 6.283) * 25, amount: 1 }));
    out.I_support = {
      note: "recipe windows: marinara 45-65 (accept +-10), funghi 58-78; generic free-cook window 58-78 (accept +-10). Sauce deposits are empty in the bake-only cases (the sauce check then skips).",
      marinaraBake55_inside: kind(pizza("tomato-sauce", marinara, 55, [])),
      marinaraBake70_insideGenericOnly: kind(pizza("tomato-sauce", marinara, 70, [])),
      marinaraBake77_outsideRecipeInsideGeneric: kind(pizza("tomato-sauce", marinara, 77, [])),
      marinaraBake95_outsideBoth: kind(pizza("tomato-sauce", marinara, 95, [])),
      funghiOneDabSauce_bake68: kind(pizza("tomato-sauce", funghi, 68, [{ x: 50, y: 50, amount: 1 }])),
      funghiFullRingSauce_bake68: kind(pizza("tomato-sauce", funghi, 68, ring)),
      funghiNoSauceDeposits_bake68: kind(pizza("tomato-sauce", funghi, 68, [])),
    };
    expect(Object.keys(out.I_support as object).length).toBeGreaterThan(3);
  });

  it("writes the data file", () => {
    writeFileSync("docs/reports/data/TETO_DISCOVERY-3_S1_PROBE.json", JSON.stringify(out, null, 1));
    expect(Object.keys(out).length).toBeGreaterThan(5);
  });
});
