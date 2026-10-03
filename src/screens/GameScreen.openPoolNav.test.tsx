import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { resolvePieceDrop } from "../logic/pieceDrag";
import { emptySauceMetrics } from "../logic/sauceField";
import { getIngredient, INGREDIENTS, type Ingredient, type IngredientCategory } from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";
import { poolOf, walkState, W1_ORDER } from "../logic/testSupport/branchingFixture";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { hintSheetView } from "../state/discoveryHint";
import { OPEN_POOL_ACTIONS } from "../components/openPoolCopy";
import { createDefaultSave } from "../state/persistence";

/**
 * Discovery 3.0 IP-1: OPEN_POOL -> Notebook / Pantry navigation, inside the real GameScreen and reducer on the
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
const pantryDialog = () => screen.queryByRole("dialog", { name: /食材庫/ });
const stateJson = () => screen.getByTestId("state-json").textContent;

describe("IP-1 OPEN_POOL action UI (Dex 12, pool 2)", () => {
  it("fixture: the pool is exactly 2 and the sheet (#353: 2 registered Research Entries, no target) is CHOOSE_RESEARCH, which keeps the IP-1 actions", () => {
    expect(poolOf(w)).toHaveLength(2);
    render(<Harness initial={toStep(dex12(), "TOPPING")} />);
    openHint();
    expect(hintDialog()).toHaveAttribute("data-hint-kind", "CHOOSE_RESEARCH");
  });

  it("at a tray step: notebook line + header notebook entry kept + a 食材庫 button; no ingredient/family/recipe/count", () => {
    render(<Harness initial={toStep(dex12(), "TOPPING")} />);
    openHint();
    const sheet = hintDialog()!;
    expect(within(sheet).getByRole("button", { name: /試作ノートを見る/ })).toBeInTheDocument(); // header entry kept
    expect(sheet).toHaveTextContent(OPEN_POOL_ACTIONS.notebook);
    expect(within(sheet).getByRole("button", { name: OPEN_POOL_ACTIONS.pantryButton })).toBeInTheDocument();
    const actions = sheet.querySelector("[data-open-pool-actions]")!;
    expect(actions.textContent).not.toMatch(/\d/);
    expect(actions.textContent).not.toMatch(CANDIDATE_TEXT);
    for (const word of ["野菜", "肉", "魚", "チーズ", "ソース"]) expect(actions.textContent).not.toContain(word);
    expect(sheet.textContent).not.toMatch(CANDIDATE_TEXT);
  });

  it("at the DOUGH step the pantry does not exist: copy only, no button (the step has no tray)", () => {
    render(<Harness initial={gameReducer(dex12(), { type: "BEGIN_PREPARE" })} />);
    openHint();
    const sheet = hintDialog()!;
    expect(within(sheet).queryByRole("button", { name: /食材庫/ })).toBeNull();
    expect(sheet).toHaveTextContent(OPEN_POOL_ACTIONS.pantryLater);
    expect(within(sheet).getByRole("button", { name: /試作ノートを見る/ })).toBeInTheDocument();
  });
});

describe("IP-1 Hint -> existing pantry -> back to FREE", () => {
  it("opens the pantry on the player's current category with nothing preselected; the cooking state is untouched", () => {
    render(<Harness initial={toStep(dex12(), "TOPPING")} category="topping" />);
    const before = stateJson();
    openHint();
    fireEvent.click(screen.getByRole("button", { name: OPEN_POOL_ACTIONS.pantryButton }));
    expect(hintDialog()).toBeNull();
    const pantry = pantryDialog()!;
    expect(pantry).toBeInTheDocument();
    // no family/shelf chip is preselected: 「すべて」 is the pressed shelf chip when chips exist
    const pressed = pantry.querySelectorAll('[aria-pressed="true"]');
    for (const p of pressed) expect(p).toHaveTextContent("すべて");
    // focus is on the pantry, not stolen back by the 「ヒント」 button
    expect(pantry.contains(document.activeElement)).toBe(true);
    // hint closing changes nothing but the hint flag
    expect(JSON.parse(stateJson()!)).toEqual({ ...JSON.parse(before!), hintSheetOpen: false });
  });

  it("search and category work in the reused pantry (search field present, filters the owned rows)", () => {
    render(<Harness initial={toStep(dex12(), "TOPPING")} category="topping" />);
    openHint();
    fireEvent.click(screen.getByRole("button", { name: OPEN_POOL_ACTIONS.pantryButton }));
    const pantry = pantryDialog()!;
    const search = within(pantry).getByRole("searchbox");
    const rowsBefore = pantry.querySelectorAll(".pantry-sheet__list li").length;
    expect(rowsBefore).toBeGreaterThan(6);
    fireEvent.change(search, { target: { value: "たまご" } });
    const rowsAfter = pantry.querySelectorAll(".pantry-sheet__list li").length;
    expect(rowsAfter).toBeGreaterThan(0);
    expect(rowsAfter).toBeLessThan(rowsBefore);
  });

  it("閉じる returns to the FREE cooking screen (hint stays closed, same step), focus back on the pantry entry", () => {
    render(<Harness initial={toStep(dex12(), "TOPPING")} category="topping" />);
    openHint();
    fireEvent.click(screen.getByRole("button", { name: OPEN_POOL_ACTIONS.pantryButton }));
    fireEvent.click(within(pantryDialog()!).getByRole("button", { name: "閉じる" }));
    expect(pantryDialog()).toBeNull();
    expect(hintDialog()).toBeNull();
    expect(JSON.parse(stateJson()!)).toMatchObject({ phase: "PREPARE", makingStep: "TOPPING", freeCook: true, hintSheetOpen: false });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /食材庫/ }));
  });

  it("does not touch the save schema", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
    expect(Object.keys(createDefaultSave())).not.toContain("trialNotebook");
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
