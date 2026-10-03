import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import { getIngredient, STARTER_INGREDIENT_IDS, type IngredientCategory } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES } from "../data/recipes";
import { discoveredDex } from "../state/testSupport/guidedRound";

/**
 * Contract 2.1 S5 through the real reducer + real GameScreen: the RESULT panel follows `state.lastResearchRows`
 * (S4). Dex 25 ladder save: pesto-pollo is the single Research Entry (unlock fact: chicken).
 */
const forced = vi.hoisted(() => ({ kind: null as null | "AMBIGUOUS" }));
vi.mock("../logic/discovery/freeCook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logic/discovery/freeCook")>();
  return {
    ...actual,
    resolveFreeCookPizza: (...args: Parameters<typeof actual.resolveFreeCookPizza>) => {
      const real = actual.resolveFreeCookPizza(...args);
      return forced.kind && real.kind === "ORIGINAL" ? { kind: "ORIGINAL", outcome: { kind: forced.kind } } : real;
    },
  };
});

const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const T = "pesto-pollo";
const owned = ladderOwned(25);
const base = (): GameState => {
  const s = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), owned, 1000);
  return { ...s, inventory: Object.fromEntries(owned.map((id) => [id, 10])) };
};
const act = (s: GameState, ...a: GameAction[]) => a.reduce(gameReducer, s);
const mk = (sauce: string | null, ...tops: string[]): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds: sauce ? [sauce] : [],
  toppings: tops.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, x: 30 + i * 5, y: 40 })),
});
const exact = (id: string): PizzaState => {
  const r = RECIPES.find((x) => x.id === id)!;
  const isSauce = (i: string) => getIngredient(i)?.category === "sauce";
  return mk(
    r.requiredIngredients.find((q) => isSauce(q.ingredientId))?.ingredientId ?? null,
    ...r.requiredIngredients.filter((q) => !isSauce(q.ingredientId)).flatMap((q) => Array.from({ length: Math.max(1, q.minCount) }, () => q.ingredientId)),
  );
};
function result(s: GameState, pizza: PizzaState, value = 68): GameState {
  let t: GameState = { ...s, pizza: { ...pizza, bakeResult: value } };
  t = act(t, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value });
  for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = act(t, { type: "CONFIRM_MAKING_STEP" });
  return act(t, { type: "REGISTER_TO_DEX" });
}
const target = (s: GameState = base()) => act(s, { type: "START_FREE_COOK", researchTargetId: T });
const CATEGORY_FOR_STEP: Record<string, IngredientCategory> = { DOUGH: "sauce", SAUCE: "sauce", CHEESE: "cheese", TOPPING: "topping" };
export function renderAt(state: GameState) {
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory={CATEGORY_FOR_STEP[state.makingStep] ?? "topping"}
      selectedIngredientId={null}
      bakeProgress={null}
      referenceModeEnabled
      referencePizza={null}
      isReferencePopoverOpen={false}
      isGlobalOverlayOpen={false}
      sauceMetrics={emptySauceMetrics()}
      sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
      isDispensingSauce={false}
      pieceShadowMetrics={[]}
      showDoughShape
      doughShapeComplete
      onGoHome={() => {}}
      onBeginPrepare={() => {}}
      onResetPizza={() => {}}
      onConfirmMakingStep={() => {}}
      onStartBake={() => {}}
      onShowHint={() => {}}
      onChangeCategory={() => {}}
      onSelectIngredient={() => {}}
      onTapPizza={() => {}}
      onBakeTick={() => {}}
      onConfirmBake={() => {}}
      onRetrySameRecipe={() => {}}
      onBackToPizzaSelect={() => {}}
      onMissionServeNext={() => {}}
      onMissionSkipOrder={() => {}}
      onMissionStart={() => {}}
      onMissionExitToFree={() => {}}
      onMissionCloseIntro={() => {}}
      onShowRanking={() => {}}
      onReferencePopoverChange={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      onAddCutLine={() => {}}
      onUndoCutLine={() => {}}
      cutRejectionMessage={null}
      onDoughElementChange={() => {}}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={() => {}}
    />,
  );
}


afterEach(() => {
  cleanup();
  forced.kind = null;
});
const panel = () => screen.queryByTestId("research-rows");
const chipTexts = () => [...(panel()?.querySelectorAll("li") ?? [])].map((li) => li.textContent);
const nm = (id: string) => getIngredient(id)!.nameJa;
const pizza = () => mk("pesto", "fresh-tomato", "egg");

describe("RESULT panel from lastResearchRows (flag ON under vitest)", () => {
  it("a Research ORIGINAL shows the disclosed chips, and the existing used-ingredients list stays", () => {
    const s = result(target(), pizza());
    renderAt(s);
    expect(chipTexts()).toEqual([`${nm("pesto")}○`, `${nm("fresh-tomato")}○`, `${nm("egg")}×`]);
    expect(screen.getByRole("list", { name: "使った材料" }).textContent).toContain(nm("egg"));
    expect(screen.getByRole("button", { name: "もう一度試す" })).toBeInTheDocument();
  });
  it("ORIGINAL / AMBIGUOUS show the identical panel", () => {
    const a = renderAt(result(target(), pizza()));
    const original = panel()!.outerHTML;
    a.unmount();
    forced.kind = "AMBIGUOUS";
    const s = result(target(), pizza());
    expect(s.lastDiscovery?.kind).toBe("AMBIGUOUS");
    renderAt(s);
    expect(panel()!.outerHTML).toBe(original);
  });
  it("a known (unlock fact / Hint-known) ingredient is not regenerated as a chip", () => {
    const s = result({ ...target(), discoveryHintFacts: { [T]: ["ing:pesto"] } }, mk("pesto", "chicken", "egg"));
    renderAt(s);
    expect(chipTexts()).toEqual([`${nm("egg")}×`]);
    expect(panel()!.textContent).not.toContain(nm("chicken"));
    expect(panel()!.textContent).not.toContain(nm("pesto"));
  });
  it("4+ unknown toppings: the K=3 explanation and no topping chip; sauce / cheese chips stay", () => {
    renderAt(result(target(), mk("pesto", "mozzarella", "fresh-tomato", "egg", "onion", "bacon")));
    expect(chipTexts()).toEqual([`${nm("pesto")}○`, `${nm("mozzarella")}○`]);
    expect(screen.getByText("トッピングは一度に3種類まで調べられるよ")).toBeInTheDocument();
  });
  it("nothing to disclose: no panel", () => {
    renderAt(result(target(), mk(null, "chicken")));
    expect(panel()).toBeNull();
  });
  it("an attempt that used the target's last stock still shows the panel", () => {
    const s = base();
    renderAt(result(target({ ...s, inventory: { ...s.inventory, "fresh-tomato": 1, chicken: 1, mozzarella: 1, pesto: 1 } }), pizza()));
    expect(chipTexts()).toContain(`${nm("fresh-tomato")}○`);
  });
  it("targetless free cook: no panel", () => {
    renderAt(result(act(base(), { type: "START_FREE_COOK" }), pizza()));
    expect(panel()).toBeNull();
  });
  it("a NEW discovery (the target itself, or another recipe) and a repeat of a discovered recipe: no panel", () => {
    renderAt(result(target(), exact(T), 70));
    expect(panel()).toBeNull();
    cleanup();
    const b = base();
    const other = "pesto-caprese";
    renderAt(result(target({ ...b, dex: discoveredDex([...keysBefore(25), "brazilian-calabresa"]) }), exact(other), 70));
    expect(panel()).toBeNull();
  });
  it("a guided round of an already discovered recipe: no panel (ALREADY_DISCOVERED)", () => {
    const s = act(base(), { type: "SELECT_RECIPE", recipeId: "margherita" } as GameAction);
    renderAt(s);
    expect(panel()).toBeNull();
  });
});
