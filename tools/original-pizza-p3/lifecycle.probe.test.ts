import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../src/data/discoveryCatalog";
import { FREE_COOK_BAKE_TARGET } from "../../src/data/freeCook";
import { buildIdealSauceFixture, getReferencePizza } from "../../src/data/referencePizza";
import { STARTER_INGREDIENT_IDS } from "../../src/data/ingredients";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../../src/state/gameReducer";
import { resultNearMiss } from "../../src/state/resultNearMiss";
import { walkPostBakeToResult } from "../../src/state/testSupport/postBakeFlow";
import { discoveredDex } from "../../src/state/testSupport/guidedRound";

/**
 * Original Pizza Recovery P3-3 Fresh Audit: lifecycle probe against CURRENT main (read-only: it drives the real
 * reducer and reads the source; nothing in `src/` changes). It produces the evidence behind the report's
 * "exactly-once record point", eligibility matrix and session-lifecycle sections. Output JSON: $P3_PROBE_OUT.
 */
const OUT = process.env.P3_PROBE_OUT ?? resolve("docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-3_LifecycleProbe.json");
const NOW = 1_000_000;
const BAKE = (FREE_COOK_BAKE_TARGET.start + FREE_COOK_BAKE_TARGET.end) / 2;
const evidence: Record<string, unknown> = {};

const dex3 = discoveredDex(["margherita", "bismarck", "breakfast-pizza"]);
const OWNED = [...STARTER_INGREDIENT_IDS, "egg", "bacon", "mushroom"];
const INVENTORY = { egg: 30, bacon: 30, mushroom: 30 };

function piecesOf(recipeId: string, ingredientId: string) {
  const group = getReferencePizza(recipeId as never)!.pieceGroups.find((g) => g.ingredientId === ingredientId)!;
  return group.positions.map((p) => ({ id: ingredientId, ...p }));
}
const spot = (n: number) => ({ x: 30 + (n % 5) * 10, y: 35 + Math.floor(n / 5) * 12 });
function pieces(id: string, count: number, from = 0) {
  return Array.from({ length: count }, (_, i) => ({ id, ...spot(from + i) }));
}

interface Pizza {
  sauce?: string;
  sauceDeposits?: ReturnType<typeof buildIdealSauceFixture>;
  cheese?: { id: string; x: number; y: number }[];
  toppings?: { id: string; x: number; y: number }[];
}
function freeRound(dex = dex3): GameState {
  return gameReducer(createInitialGameState(dex, OWNED, 0, INVENTORY, []), { type: "START_FREE_COOK", now: NOW });
}
function cook(state: GameState, pizza: Pizza, bake = BAKE): GameState {
  let s = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  if (pizza.sauce) s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: pizza.sauce, deposits: pizza.sauceDeposits ?? buildIdealSauceFixture() });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.cheese ?? []) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.toppings ?? []) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  s = [{ type: "START_BAKE", now: NOW + 60_000 }, { type: "CONFIRM_BAKE", value: bake }].reduce(gameReducer as never, s) as GameState;
  return walkPostBakeToResult(s);
}
const register = (s: GameState) => gameReducer(s, { type: "REGISTER_TO_DEX" });

// scenarios (Dex 3; funghi = tomato sauce + mozzarella + mushroom is the one discoverable recipe)
const ORDINARY: Pizza = { sauce: "tomato-sauce", cheese: pieces("mozzarella", 3), toppings: [] };
const FAR_ORIGINAL: Pizza = { sauce: "tomato-sauce", cheese: [], toppings: [...pieces("basil", 1), ...pieces("egg", 2, 1), ...pieces("bacon", 2, 3)] };
const INCOMPLETE: Pizza = { sauce: "tomato-sauce", sauceDeposits: buildIdealSauceFixture().slice(0, 1), cheese: pieces("mozzarella", 2), toppings: pieces("mushroom", 3, 2) };
const KNOWN_OR_NEW: Pizza = { sauce: "tomato-sauce", cheese: piecesOf("margherita", "mozzarella"), toppings: piecesOf("margherita", "basil") };

describe("P3-3 lifecycle probe (current main)", () => {
  it("the ORIGINAL result commits exactly once: CONFIRM_BAKE -> RESULT, REGISTER_TO_DEX -> DISCOVERED, then inert", () => {
    const atResult = cook(freeRound(), ORDINARY);
    expect(atResult.phase).toBe("RESULT");
    expect(atResult.score).toBeNull();
    const first = register(atResult);
    expect(first.phase).toBe("DISCOVERED");
    expect(first.lastDiscovery?.kind).toBe("ORIGINAL");
    const second = register(first);
    expect(second).toBe(first); // same reference: a repeated dispatch changes nothing
    const third = gameReducer(first, { type: "CONFIRM_BAKE", value: BAKE });
    expect(third).toBe(first);
    evidence.exactlyOnce = { afterConfirmBake: "RESULT", afterRegister: "DISCOVERED", repeatedRegisterSameReference: true, repeatedConfirmBakeSameReference: true };
  });

  it("the commit transition is pure (React StrictMode double-invokes reducers): same input, same output", () => {
    const atResult = cook(freeRound(), ORDINARY);
    const a = register(atResult);
    const b = register(atResult);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    evidence.strictModePure = true;
  });

  it("which free-cook outcomes reach the ORIGINAL branch of REGISTER_TO_DEX (the only branch that would record)", () => {
    const rows: Record<string, unknown> = {};
    const probe = (label: string, pizza: Pizza, bake = BAKE, dex = dex3) => {
      const atResult = cook(freeRound(dex), pizza, bake);
      const after = register(atResult);
      rows[label] = {
        phaseAfterConfirmBake: atResult.phase,
        scoreIsNull: atResult.score === null,
        completion: atResult.completion?.status,
        phaseAfterRegister: after.phase,
        lastDiscovery: after.lastDiscovery?.kind ?? null,
        discoveryKindAtRegister: atResult.freeCook ? "see lastDiscovery" : null,
        reachesOriginalBranch: atResult.phase === "RESULT" && atResult.score === null && atResult.completion?.status === "PASS" && after.phase === "DISCOVERED" && after.score === null,
        nearMissLineShown: resultNearMiss(after)?.kind ?? null,
      };
    };
    probe("ORDINARY_ORIGINAL (ADD_ONE line)", ORDINARY);
    probe("ORDINARY_ORIGINAL (far, key-unused line)", FAR_ORIGINAL);
    probe("INCOMPLETE_MATCH", INCOMPLETE);
    probe("MATCHED, ALREADY_DISCOVERED (margherita is in the Dex)", KNOWN_OR_NEW);
    probe("MATCHED, NEW_DISCOVERY (margherita not yet discovered)", KNOWN_OR_NEW, BAKE, discoveredDex(["bismarck", "breakfast-pizza"]));
    probe("FAILED (raw bake)", ORDINARY, 5);
    evidence.freeCookOutcomes = rows;
    expect((rows["ORDINARY_ORIGINAL (ADD_ONE line)"] as { reachesOriginalBranch: boolean }).reachesOriginalBranch).toBe(true);
    expect((rows["FAILED (raw bake)"] as { reachesOriginalBranch: boolean }).reachesOriginalBranch).toBe(false);
  });

  it("AMBIGUOUS is unreachable in production (no identity collision in the shipped catalogue)", () => {
    const seen = new Map<string, string[]>();
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      const key = JSON.stringify([[...t.items].sort(), [...(t.sauceBase ?? [])].sort()]);
      seen.set(key, [...(seen.get(key) ?? []), t.recipeId]);
    }
    const groups = [...seen.values()].filter((v) => v.length > 1);
    expect(groups).toEqual([]);
    evidence.ambiguousReachableInProduction = false;
  });

  it("the P2 line seen on first paint is a pure function of state that cannot change while the ORIGINAL result is on screen", () => {
    const after = register(cook(freeRound(), ORDINARY));
    const lines = Array.from({ length: 5 }, () => JSON.stringify(resultNearMiss(after)));
    expect(new Set(lines).size).toBe(1);
    // Its inputs: owned / inventory / unlocks / dex change only through PURCHASE_* / refill actions. The GAME screen's
    // header has HOME only (GameScreen.tsx: Shop / Dex were removed from the Making phases), so no player path exists.
    const source = readFileSync(resolve("src/screens/GameScreen.tsx"), "utf8");
    const header = source.slice(source.indexOf('<header className="app-header">'), source.indexOf("</header>"));
    expect(header).not.toMatch(/onOpenShop|onOpenDex|setShopOpen/);
    evidence.nearMissStableWhileOnScreen = { headerHasShopOrDex: false };
  });

  it("every fresh-round path threads `carryOf(state)` (so a session-only field added to ProgressionCarry survives all of them)", () => {
    const source = readFileSync(resolve("src/state/gameReducer.ts"), "utf8");
    const callSites = [...source.matchAll(/(buildOrderState|nextOrderState|startPreparingRecipe|startFreeCook|nextMissionOrderState)\(([^)]*)/g)];
    const externalCalls = callSites.filter((m) => !/^function\b/.test(source.slice(Math.max(0, m.index! - 9), m.index!)));
    // a call site passes carryOf(...), a `carry` parameter, or (createInitialGameState) an explicit literal typed ProgressionCarry
    const uncarried = externalCalls.filter((m) => !/carryOf|carry\b|state\b|registered|ownedIngredientIds,/.test(m[2] ?? "")).map((m) => m[0]);
    evidence.freshRoundCallSites = externalCalls.length;
    expect(uncarried).toEqual([]);
    // the existing session-only precedent: `hintSession` / `preDiscoveryFreeCookAttempts` ride the same carry
    expect(source).toMatch(/hintSession: state\.hintSession/);
    expect(source).toMatch(/discoveredTechniqueIds: state\.discoveredTechniqueIds/);
  });

  it("session-only precedent: a carried field survives START_FREE_COOK / RETRY_SAME_RECIPE / PLAY_AGAIN / SELECT_RECIPE", () => {
    let s = register(cook(freeRound(), ORDINARY));
    const before = s.preDiscoveryFreeCookAttempts;
    const dexHint = { ...s, hintSession: { targetId: "funghi", revealedIndex: 1 } } as GameState;
    const actions: GameAction[] = [
      { type: "RETRY_SAME_RECIPE", now: NOW },
      { type: "START_FREE_COOK", now: NOW },
      { type: "PLAY_AGAIN" },
    ];
    const survived = actions.map((a) => gameReducer(dexHint, a).hintSession?.targetId === "funghi");
    expect(survived).toEqual([true, true, true]);
    s = gameReducer(dexHint, { type: "SELECT_RECIPE", recipeId: "margherita", now: NOW });
    expect(s.hintSession?.targetId).toBe("funghi");
    expect(before).toBeGreaterThanOrEqual(0);
    evidence.carriedSessionFieldSurvives = ["RETRY_SAME_RECIPE", "START_FREE_COOK", "PLAY_AGAIN", "SELECT_RECIPE"];
  });

  it("the save writer lists fields explicitly (a new session-only field is not saved unless added there)", () => {
    const app = readFileSync(resolve("src/App.tsx"), "utf8");
    const call = app.slice(app.indexOf("persistProgress({"), app.indexOf("requireDinnerRecords: true"));
    expect(call).not.toMatch(/\.\.\.state\b/);
    evidence.saveWriterSpreadsState = false;
    evidence.saveWriterFields = [...call.matchAll(/^\s+([A-Za-z]+): state\./gm)].map((m) => m[1]);
  });

  it("writes the evidence", () => {
    writeFileSync(OUT, `${JSON.stringify({ tool: "tools/original-pizza-p3/lifecycle.probe.test.ts", evidence }, null, 2)}\n`);
  });
});
