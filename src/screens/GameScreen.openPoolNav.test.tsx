import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { resolvePieceDrop } from "../logic/pieceDrag";
import { emptySauceMetrics } from "../logic/sauceField";
import { getIngredient, INGREDIENTS, MAX_INGREDIENT_PALETTE_SLOTS, type Ingredient, type IngredientCategory } from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";
import { poolOf, walkState, W1_ORDER } from "../logic/testSupport/branchingFixture";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { hintSheetView } from "../state/discoveryHint";
import { OPEN_POOL_ACTIONS } from "../components/openPoolCopy";

/**
 * Discovery 3.0 IP-1: the OPEN_POOL next-action UI (Notebook entry; the 食材庫 route is retired with the pantry), inside the real GameScreen and reducer on the
 * production-representative Dex 12 pool-2 state (pizza-portuguesa + brazilian-calabresa both DISCOVERABLE).
 */
const ONION_STEP = DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes("onion"))!.step;
const w = walkState(W1_ORDER.slice(0, ONION_STEP));
const CANDIDATE_TEXT = /ポルトゲーザ|ポルトガル|カラブレーザ|カラブレサ|portuguesa|calabresa/i;

function dex12(): GameState {
  const initial = createInitialGameState(w.dex, w.ownedIngredientIds, 0, w.inventory, [], w.unlockedForShopIngredientIds, {});
  return gameReducer(initial, { type: "START_FREE_COOK" });
}
function toStep(state: GameState, step: GameState["makingStep"]): GameState {
  let s = gameReducer(state, { type: "BEGIN_PREPARE" });
  for (let i = 0; i < 6 && s.makingStep !== step; i += 1) s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  return s;
}

function Harness({ initial, category = "topping" }: { initial: GameState; category?: IngredientCategory }) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>(category);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  function resolvePhysicalDrop(clientX: number, clientY: number): DoughPoint | null {
    return resolvePieceDrop(clientX, clientY, { left: 0, top: 0, width: 300, height: 300 } as DOMRect);
  }
  function handleTapPizza(x: number, y: number) {
    const ingredient = selectedIngredientId ? getIngredient(selectedIngredientId) : undefined;
    if (ingredient && ingredient.placement !== "spread") dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x, y });
  }
  return (
    <div>
      <span data-testid="state-json">{JSON.stringify({ ...state, hint: null })}</span>
      <span data-testid="selected">{selectedIngredientId ?? ""}</span>
      <GameScreen
        state={state}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory={activeCategory}
        selectedIngredientId={selectedIngredientId}
        bakeProgress={null}
        referenceModeEnabled={false}
        referencePizza={null}
        isReferencePopoverOpen={false}
        isGlobalOverlayOpen={false}
        sauceMetrics={emptySauceMetrics()}
        sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
        isDispensingSauce={false}
        pieceShadowMetrics={[]}
        showDoughShape
        doughShapeComplete={false}
        onGoHome={() => {}}
        onBeginPrepare={() => {}}
        onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
        onConfirmMakingStep={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
        onStartBake={() => {}}
        onShowHint={() => dispatch({ type: "SHOW_HINT" })}
        onUnlockHint={() => {}}
        onCloseHint={() => dispatch({ type: "CLOSE_HINT" })}
        onChangeCategory={setActiveCategory}
        onSelectIngredient={(ingredient: Ingredient) => setSelectedIngredientId(ingredient.id)}
        onClearIngredientSelection={() => setSelectedIngredientId(null)}
        onTapPizza={handleTapPizza}
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
        resolvePhysicalDrop={resolvePhysicalDrop}
        onPhysicalDrop={() => {}}
        {...(initial.dinner ? { dinner: undefined } : {})}
      />
    </div>
  );
}

afterEach(() => cleanup());

const openHint = () => fireEvent.click(screen.getByRole("button", { name: "ヒント" }));
const hintDialog = () => screen.queryByRole("dialog", { name: /ヒント/ });

describe("IP-1 OPEN_POOL action UI (Dex 12, pool 3)", () => {
  it("fixture: the pool is exactly 3 (portuguesa, calabresa, TQ-1D aussie) and the sheet (#353: 3 registered Research Entries, no target) is CHOOSE_RESEARCH, which keeps the IP-1 actions", () => {
    expect(poolOf(w)).toHaveLength(3);
    render(<Harness initial={toStep(dex12(), "TOPPING")} />);
    openHint();
    expect(hintDialog()).toHaveAttribute("data-hint-kind", "CHOOSE_RESEARCH");
  });

  it("at a tray step: notebook line + header notebook entry kept; no 食材庫 route, no ingredient/family/recipe/count", () => {
    render(<Harness initial={toStep(dex12(), "TOPPING")} />);
    openHint();
    const sheet = hintDialog()!;
    expect(within(sheet).getByRole("button", { name: /試作ノートを見る/ })).toBeInTheDocument(); // header entry kept
    expect(sheet).toHaveTextContent(OPEN_POOL_ACTIONS.notebook);
    expect(within(sheet).queryByRole("button", { name: /食材庫/ })).toBeNull();
    expect(sheet.textContent).not.toContain("食材庫");
    const actions = sheet.querySelector("[data-open-pool-actions]")!;
    expect(actions.textContent).not.toMatch(/\d/);
    expect(actions.textContent).not.toMatch(CANDIDATE_TEXT);
    for (const word of ["野菜", "肉", "魚", "チーズ", "ソース"]) expect(actions.textContent).not.toContain(word);
    expect(sheet.textContent).not.toMatch(CANDIDATE_TEXT);
  });

  it("at the DOUGH step: the notebook entry only, no 食材庫 copy or button", () => {
    render(<Harness initial={gameReducer(dex12(), { type: "BEGIN_PREPARE" })} />);
    openHint();
    const sheet = hintDialog()!;
    expect(within(sheet).queryByRole("button", { name: /食材庫/ })).toBeNull();
    expect(sheet.textContent).not.toContain("食材庫");
    expect(within(sheet).getByRole("button", { name: /試作ノートを見る/ })).toBeInTheDocument();
  });
});

describe("All-Owned Cooking Tray inside the real GameScreen (FREE / Research round)", () => {
  it("lists every owned topping through the pager (no 食材庫 entry), and never an unowned one", () => {
    const state = toStep(dex12(), "TOPPING");
    render(<Harness initial={state} category="topping" />);
    expect(screen.queryByRole("button", { name: /食材庫/ })).toBeNull();
    const ownedToppings = INGREDIENTS.filter((i) => i.category === "topping" && state.ownedIngredientIds.includes(i.id));
    const unowned = INGREDIENTS.filter((i) => i.category === "topping" && !state.ownedIngredientIds.includes(i.id));
    expect(unowned.length).toBeGreaterThan(0); // the Dex 12 fixture does not own the whole catalog (locked stays off the tray)
    const seen = new Set<string>();
    const pages = Math.ceil(ownedToppings.length / MAX_INGREDIENT_PALETTE_SLOTS);
    for (let page = 0; page < pages; page += 1) {
      for (const chip of document.querySelectorAll<HTMLElement>(".ingredient-chip")) seen.add(chip.textContent ?? "");
      if (page < pages - 1) fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    }
    for (const ingredient of ownedToppings) expect([...seen].some((text) => text.includes(ingredient.nameJa)), ingredient.id).toBe(true);
    for (const ingredient of unowned) expect([...seen].some((text) => text.includes(ingredient.nameJa)), ingredient.id).toBe(false);
  });
});

describe("IP-1 anti-oracle: the OPEN_POOL action UI does not depend on the candidate pool", () => {
  function actionsHtml(initial: GameState): string {
    const { unmount } = render(<Harness initial={toStep(initial, "TOPPING")} category="topping" />);
    openHint();
    const html = hintDialog()!.querySelector("[data-open-pool-actions]")!.outerHTML;
    unmount();
    return html;
  }

  it("a different candidate pool (more owned materials) renders byte-identical actions; the view carries only its kind", () => {
    const base = dex12();
    const allOwned = [...new Set([...w.ownedIngredientIds, ...INGREDIENTS.map((i) => i.id)])];
    const richer = gameReducer(
      createInitialGameState(w.dex, allOwned, 0, Object.fromEntries(allOwned.map((id) => [id, 30])), [], w.unlockedForShopIngredientIds, {}),
      { type: "START_FREE_COOK" },
    );
    expect(Object.keys(hintSheetView(base))).toEqual(["kind"]);
    expect(Object.keys(hintSheetView(richer))).toEqual(["kind"]);
    expect(hintSheetView(richer).kind).toBe("CHOOSE_RESEARCH");
    expect(actionsHtml(richer)).toBe(actionsHtml(base));
  });

  it("an emptier pool-independent save: the sheet text has no digits, candidate names or ids", () => {
    render(<Harness initial={toStep(dex12(), "SAUCE")} category="sauce" />);
    openHint();
    const sheet = hintDialog()!;
    expect(sheet.textContent).not.toMatch(/\d/);
    expect(sheet.textContent).not.toMatch(CANDIDATE_TEXT);
    const attrs = [...sheet.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value)).join(" ");
    expect(attrs).not.toMatch(/portuguesa|calabresa|onion/i);
  });
});
