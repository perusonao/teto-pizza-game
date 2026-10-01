import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES, countsTowardLadder, getRecipe, type Recipe } from "../data/recipes";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import { discoveredRecipeCount, reachedStepNumber } from "../logic/discoveryLadder";
import { nextMaterialHint } from "../logic/materialShop";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "../state/recipeDiscoveryState";
import { discoverableHintCandidates, selectHintTarget } from "../logic/discovery/hintTarget";
import { buildHint5Ladder, hint5Presentation, requestHint5Rung } from "../logic/discovery/hint5Ladder";
import { buildHintSteps } from "../logic/discovery/hintSteps";
import { buildRecipeChapters, chapterProgress, recipeChapterSlot, recipeChapter, recipeKeyStep } from "../state/recipeChapters";
import { missionOrderRecipeIds, cookableMissionRecipeIds } from "../mission/lunchRush";
import { DINNER_MISSIONS } from "../mission/dinner/dinnerMission";
import { discoveredDex } from "../state/testSupport/guidedRound";
import { cook, freeRound, pieces, referencePieces, register, type Pizza } from "../state/testSupport/trialNotebookFlow";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { gameReducer } from "../state/gameReducer";
import { resultNearMiss } from "../state/resultNearMiss";
import { originalResultLeadJa } from "../state/originalResultCopy";
import { findOrderForRecipe } from "../data/orders";

const out: Record<string, unknown> = {};
const CAL = "brazilian-calabresa";
const POR = "pizza-portuguesa";
const keyOf = (n: number) => DISCOVERY_LADDER.steps.find((s) => s.step === n)!.keyRecipeId as string;
const STARTERS = [...STARTER_INGREDIENT_IDS];

function world(discovered: readonly string[], recipes: readonly Recipe[] = RECIPES) {
  const dex = discoveredDex(discovered);
  const ent = resolveShopEntitlement(dex, STARTERS, []);
  const ledger = ent.unlockedForShopIngredientIds;
  const owned = [...STARTERS, ...ledger];
  const inventory = Object.fromEntries(ledger.map((id) => [id, 30]));
  const inputs: RecipeDiscoveryInputs = { dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: ledger, inventory };
  const count = discoveredRecipeCount(dex, countsTowardLadder);
  return {
    count, step: reachedStepNumber(DISCOVERY_LADDER, count), ledger, inputs,
    next: nextMaterialHint(count, ledger),
    pool: discoverableHintCandidates(inputs, recipes).map((r) => r.id),
    unknown: recipes.filter((r) => recipeDiscoveryState(r, inputs) === "UNKNOWN").map((r) => r.id),
    dexSize: discovered.length,
  };
}
const snap = (w: ReturnType<typeof world>) => ({ dex: w.dexSize, ladderCount: w.count, step: w.step, next: w.next, ledgerSize: w.ledger.length, pool: w.pool, unknownN: w.unknown.length });

it("measure", () => {
  const base = ["margherita", ...Array.from({ length: 11 }, (_, i) => keyOf(i + 1))];
  const w0 = world(base);
  out.atOnionUnlock = { ...snap(w0), onionInLedger: w0.ledger.includes("onion"), calabresaState: recipeDiscoveryState(getRecipe(CAL)!, w0.inputs), portuguesaState: recipeDiscoveryState(getRecipe(POR)!, w0.inputs), pool: w0.pool };
  const before11 = world(base.slice(0, 11));
  out.oneStepBefore = { ...snap(before11), calabresaState: recipeDiscoveryState(getRecipe(CAL)!, before11.inputs) };

  // both orders
  const orderA = world([...base, CAL]);            // calabresa first
  const orderA2 = world([...base, CAL, POR]);
  const orderB = world([...base, POR]);            // portuguesa first
  const orderB2 = world([...base, POR, CAL]);
  out.orderA_calabresaFirst = { afterCal: snap(orderA), afterCalThenPor: snap(orderA2) };
  out.orderB_portuguesaFirst = { afterPor: snap(orderB), afterPorThenCal: snap(orderB2) };
  out.orderSameFinalLedger = JSON.stringify(orderA2.ledger) === JSON.stringify(orderB2.ledger);
  out.calabresaAloneLedgerUnchanged = JSON.stringify(orderA.ledger) === JSON.stringify(w0.ledger);

  // full greedy walks: ignoring calabresa, and taking it as early as possible
  function walk(takeCalEarly: boolean) {
    const dexIds = ["margherita"]; const poolSizes: { count: number; pool: number }[] = [];
    for (let guard = 0; guard < 60; guard += 1) {
      const w = world(dexIds);
      poolSizes.push({ count: w.count, pool: w.pool.length });
      const pool = w.pool;
      if (pool.length === 0) break;
      const pick = takeCalEarly && pool.includes(CAL) ? CAL : pool.find((id) => id !== CAL) ?? pool[0];
      dexIds.push(pick);
    }
    const fin = world(dexIds);
    return { finalDex: dexIds.length, finalLadderCount: fin.count, finalStep: fin.step, finalLedgerSize: fin.ledger.length, poolSizes, remainingUnknown: fin.unknown, dexIds };
  }
  const ignore = walk(false); const early = walk(true);
  out.walkIgnoringCalabresa = { ...ignore, dexIds: undefined, calabresaDiscovered: ignore.dexIds.includes(CAL) };
  out.walkCalabresaEarly = { ...early, dexIds: undefined, calabresaPos: early.dexIds.indexOf(CAL) };
  out.pool2Duration = ignore.poolSizes.filter((p) => p.pool >= 2).length;
  out.pool2Counts = ignore.poolSizes.filter((p) => p.pool >= 2).map((p) => p.count);
  const baselineRecipes = RECIPES.filter((r) => r.id !== CAL);
  const baseWalk: number[] = []; { const ids = ["margherita"]; for (let g = 0; g < 60; g += 1) { const w = world(ids, baselineRecipes); baseWalk.push(w.pool.length); if (!w.pool.length) break; ids.push(w.pool[0]); } }
  out.baseline25PoolMax = Math.max(...baseWalk);
  out.ladderEndsWithout = world(ignore.dexIds).step;

  // auto target order at step 12
  out.autoHintTargetAtStep12 = selectHintTarget(w0.inputs);
  out.candidateOrderAtStep12 = w0.pool;

  // matcher identity collisions
  const keyOfTarget = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase]);
  const seen = new Map<string, string[]>(); for (const t of RECIPE_DISCOVERY_CATALOG) seen.set(keyOfTarget(t), [...(seen.get(keyOfTarget(t)) ?? []), t.recipeId]);
  out.matcherCollisions = [...seen.values()].filter((v) => v.length > 1);
  out.calabresaTarget = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === CAL);

  // Hint 5.0 for calabresa (production roles default)
  const ladder = buildHint5Ladder(CAL)!;
  out.hint5Rungs = ladder.rungs.map((r) => ({ i: r.index, kind: r.kind, subj: r.subjectIds }));
  const walkH5: unknown[] = []; let stored: string[] = []; let spent = 0;
  for (let g = 0; g < 12; g += 1) {
    const input = { recipeId: CAL, discoveredCount: 12, storedFactIds: stored, legacyPurchases: {}, pitzBalance: 1000 };
    const v = hint5Presentation(input)!; if (!v.next) { walkH5.push({ complete: v.completeText, board: v.board.map((b) => b.kind) }); break; }
    const r = requestHint5Rung({ ...input, expectedRungIndex: v.next.rungIndex });
    walkH5.push({ offer: v.next.labelJa, price: v.next.price, outcome: r.outcome, charge: (r as { charge?: number }).charge, board: v.board.map((b) => ("none" in b ? `${b.kind}:none=${b.none}` : b.kind)) });
    if (r.outcome !== "ANSWERED") break; spent += r.charge; stored = [...stored, ...r.addFactIds];
  }
  out.hint5Walk = walkH5; out.hint5TotalSpent = spent; out.hint5Facts = stored;
  out.hint3Steps = buildHintSteps(getRecipe(CAL)!, { discoveredCount: 12 }).map((s) => `${s.axis}: ${s.textJa}`);

  // reducer: discovery, oracle neutralisation, notebook
  const dex = discoveredDex(base);
  const owned = [...STARTERS, ...w0.ledger]; const inv = Object.fromEntries(w0.ledger.map((id) => [id, 30]));
  const start = (): ReturnType<typeof freeRound> => gameReducer({ ...freeRound(dex) , ownedIngredientIds: owned, inventory: inv } as never, { type: "START_FREE_COOK", now: 1_000_000 });
  const calPizza: Pizza = { sauce: "tomato-sauce", cheese: [], toppings: ["sausage", "onion", "black-olive", "oregano"].flatMap((id) => referencePieces(CAL, id)) };
  const play = (p: Pizza) => register(cook(start(), p));
  const good = play(calPizza);
  out.discoveryOutcome = good.lastDiscovery?.kind; out.dexAfter = good.dex.filter((e) => e.discovered).length;
  out.ladderCountAfterReducer = discoveredRecipeCount(good.dex, countsTowardLadder);
  out.ledgerUnchangedByReducer = JSON.stringify(good.unlockedForShopIngredientIds) === JSON.stringify(w0.ledger);
  const thinCal: Pizza = { ...calPizza, sauceDeposits: buildIdealSauceFixture().slice(0, 1) };
  const otherThin: Pizza = { sauce: "tomato-sauce", sauceDeposits: buildIdealSauceFixture().slice(0, 1), cheese: [], toppings: [...pieces("sausage", 2), ...pieces("onion", 2, 2), ...pieces("black-olive", 1, 4)] };
  const inc = play(thinCal); const oth = play(otherThin);
  out.oracle = { exactThin: inc.lastDiscovery?.kind, otherThin: oth.lastDiscovery?.kind,
    nearMissExact: resultNearMiss(inc), nearMissOther: resultNearMiss(oth),
    notebookExactThin: inc.lastTrialAttempt?.kind ?? null, notebookOtherThin: oth.lastTrialAttempt?.kind ?? null };
  // retry duplicate notice
  const inc2 = register(cook(gameReducer(inc, { type: "START_FREE_COOK", now: 1_000_000 }), thinCal));
  out.notebookRetry = inc2.lastTrialAttempt?.kind ?? null;

  // chapters / dex numbering
  const chapters = buildRecipeChapters();
  out.chapters = chapters.map((c) => ({ chapter: c.chapter, total: c.recipes?.length }));
  out.calabresaChapter = recipeChapter(getRecipe(CAL)!); out.calabresaKeyStep = recipeKeyStep(getRecipe(CAL)!);
  out.calabresaSlot = recipeChapterSlot(getRecipe(CAL)!);
  out.dexNoOfCalabresa = RECIPES.findIndex((r) => r.id === CAL) + 1;

  // Lunch Rush / Dinner / orders
  const lrIn = { dex: good.dex, ownedIngredientIds: owned, inventory: inv };
  out.lunchRushPoolAfterDiscovery = missionOrderRecipeIds(lrIn); out.lunchRushPoolIncludesCal = missionOrderRecipeIds(lrIn).includes(CAL as never);
  out.lunchRushPoolBefore = missionOrderRecipeIds({ ...lrIn, dex: discoveredDex(base) }).includes(CAL as never);
  out.dinnerMissionTargetsIncludeCal = DINNER_MISSIONS.some((m) => (m.targetRecipeIds as readonly string[]).includes(CAL));
  out.orderForCal = findOrderForRecipe(CAL as never)?.id ?? null;
  out.refPiecesTotal = getReferencePizza(CAL)!.pieceGroups.reduce((n, g) => n + g.positions.length, 0);
  out.ingredientsKnown = ["sausage", "onion", "black-olive", "oregano", "tomato-sauce"].map((id) => INGREDIENTS.find((i) => i.id === id)?.unlockCondition ?? "starter");
  writeFileSync("/tmp/claude-0/-home-user-teto-pizza-game/8364be5e-7536-5839-8678-074a5ecb1a8b/scratchpad/measure.json", JSON.stringify(out, null, 1));
});
