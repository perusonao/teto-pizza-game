import { useReducer, useState, type ComponentProps } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { gameReducer, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import { visibleCookingTabCount, type CookingProfile } from "../data/cookingProfiles";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { atBake } from "../state/testSupport/confirmBakeMatrix";
import { FINISH_FIXTURE_RECIPE as FX, piece, preBakePizza } from "../state/testSupport/finishFixture";

/**
 * FINISH FIN-A (Issue #294): `GameScreen` renders the FINISH step -- the 仕上げ tab, the cooking stage layout and Mito's FINISH
 * hint -- for a Guided round whose profile carries FINISH. Driven by the test-only BBQ-shaped fixture (never in RECIPES), so
 * Production is unchanged. The tray is FIN-B (see the FIN-B describe below); 「1つ戻す」 and the completion control are FIN-C and are asserted ABSENT here.
 */
const BBQ_PROFILE: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };
const WITH_CUT_PROFILE: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"], cutConfig: { requestedSliceCount: 6 } };
const T = 1_000_000;

function atFinish(profile: CookingProfile = BBQ_PROFILE, over: Partial<GameState> = {}): GameState {
  const base = atBake("guided", "margherita");
  const bake = Math.round((FX.bakeTarget.start + FX.bakeTarget.end) / 2);
  const state = gameReducer({ ...base, recipe: FX, cookingProfile: profile, pizza: preBakePizza(), ...over }, { type: "CONFIRM_BAKE", value: bake, now: T });
  expect(state.makingStep).toBe("FINISH");
  return state;
}

function renderAt(state: GameState, over: Partial<ComponentProps<typeof GameScreen>> = {}) {
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory="topping"
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
      onUndoPlacement={() => {}}
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
      onDoughElementChange={() => {}}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={() => {}}
      {...over}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("FINISH on the screen (Guided, profile with FINISH)", () => {
  it("shows the 仕上げ tab as the active step, after 焼く, in the cooking layout with the compact (tray) stage", () => {
    const { container } = renderAt(atFinish());
    const tab = screen.getByRole("tab", { name: "仕上げ" });
    expect(tab).toHaveAttribute("aria-current", "step");
    expect(visibleCookingTabCount(BBQ_PROFILE)).toBe(6); // D·S·C·T·焼く·仕上げ -- the 6-tab ceiling
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label") ?? t.textContent)).toContain("仕上げ");
    expect(container.querySelector(".game-screen--cooking")).not.toBeNull();
    expect(container.querySelector(".pizza-stage--compact")).not.toBeNull();
    expect(container.querySelector(".pizza-stage--roomy")).toBeNull();
  });

  it("names the late ingredient in Mito's FINISH hint, then says it is done once enough are placed", () => {
    renderAt(atFinish());
    expect(screen.getByTestId("finish-hint")).toHaveTextContent("パセリを仕上げにのせよう！");
    cleanup();
    const state = atFinish();
    const placed = { ...state, pizza: { ...state.pizza, toppings: [...state.pizza.toppings, piece("parsley", "post"), piece("parsley", "post")] } };
    renderAt(placed);
    expect(screen.getByTestId("finish-hint")).toHaveTextContent("仕上げはここまで！");
  });

  it("draws the post-bake pieces in the separated post layer", () => {
    const state = atFinish();
    const placed = { ...state, pizza: { ...state.pizza, toppings: [...state.pizza.toppings, { ...piece("parsley", "post"), x: DOUGH_CENTER, y: DOUGH_CENTER }] } };
    renderAt(placed);
    expect(screen.getByTestId("pizza-post-layer")).toBeInTheDocument();
  });

  it("does not add the FIN-C controls: no 1つ戻す, no やり直す, no 次へ / 焼く！ CTA", () => {
    renderAt(atFinish());
    expect(screen.getAllByRole("button", { name: "ヒント" })).toHaveLength(1); // the bar holds the hint button only
    expect(screen.queryByRole("button", { name: "1つ戻す" })).toBeNull();
    expect(screen.queryByRole("button", { name: "やり直す" })).toBeNull();
    expect(screen.queryByRole("button", { name: /次へ|焼く！|完成/ })).toBeNull();
  });

  it("the tab after FINISH (CUT) cannot advance the round from the tab strip", () => {
    const state = atFinish(WITH_CUT_PROFILE);
    // enough cut lines that CUT's own readiness (`cutConfirmReady`) would be true: FINISH must still not let the tab advance
    const line = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, path: [] };
    renderAt({ ...state, cutState: { ...state.cutState, lines: [line, line, line, line, line, line] } });
    expect(screen.getByRole("tab", { name: "カット" })).toBeDisabled();
  });
});

describe("FINISH stays off wherever it is not available", () => {
  it("a profile with FINISH in a Lunch Rush or Dinner round renders no FINISH view", () => {
    for (const roundKind of ["LUNCH_RUSH", "DINNER"] as const) {
      const { container } = renderAt({ ...atFinish(), roundKind });
      expect(screen.queryByTestId("finish-order-card"), roundKind).toBeNull();
      expect(screen.queryByRole("tab", { name: "仕上げ" }), roundKind).toBeNull();
      expect(container.querySelector(".game-screen--cooking"), roundKind).toBeNull();
      cleanup();
    }
  });

  it("a Free Cooking round never renders FINISH", () => {
    const { container } = renderAt({ ...atFinish(), roundKind: "FREE_COOK", freeCook: atFinish().freeCook });
    expect(screen.queryByTestId("finish-order-card")).toBeNull();
    expect(container.querySelector(".game-screen--cooking")).toBeNull();
  });
});

/** The real reducer + App's selection / tap wiring (App.tsx handleSelectIngredient / handleTapPizza), around the real screen. */
function Harness({ initial }: { initial: GameState }) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory="topping"
      selectedIngredientId={selected}
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
      onUndoPlacement={() => {}}
      onConfirmMakingStep={() => {}}
      onStartBake={() => {}}
      onShowHint={() => {}}
      onChangeCategory={() => {}}
      onSelectIngredient={(i) => setSelected(i.id)}
      onClearIngredientSelection={() => setSelected(null)}
      onTapPizza={(x, y) => selected && dispatch({ type: "PLACE_TOPPING", ingredientId: selected, x, y })}
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
      onDoughElementChange={() => {}}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={() => {}}
    />
  );
}

describe("FINISH tray (FIN-B)", () => {
  it("the ヒント button shows buildFinishHintLine's explicit wording on the order card", () => {
    const start = atFinish();
    const hinted = gameReducer(start, { type: "SHOW_HINT" });
    renderAt(hinted);
    expect(screen.getByTestId("finish-hint")).toHaveTextContent("パセリをあと2個、仕上げにのせてね。");
  });

  it("offers only the recipe's late ingredient (parsley), not the pre-bake ones, with no family filter or pager", () => {
    const { container } = renderAt(atFinish());
    const chips = container.querySelectorAll(".ingredient-tray .ingredient-chip");
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent("パセリ");
    expect(screen.getByTestId("finish-dock")).toBeInTheDocument();
    expect(container.querySelector(".tray-family-row")).toBeNull();
    expect(screen.queryByRole("group", { name: "素材ページ切り替え" })).toBeNull();
  });

  it("shows the owned count and how many more may be placed, and disables the chip at the limit", () => {
    const state = atFinish();
    const owned = state.inventory.parsley ?? 0;
    const withStock = { ...state, inventory: { ...state.inventory, parsley: 2 } };
    renderAt(withStock);
    expect(owned).toBeGreaterThanOrEqual(0);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと2/2");
    cleanup();
    const placed = { ...withStock, pizza: { ...withStock.pizza, toppings: [...withStock.pizza.toppings, piece("parsley", "post")] } };
    renderAt(placed);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと1/2");
    expect(screen.getByRole("button", { name: /パセリ/ })).toBeEnabled();
    cleanup();
    const full = { ...withStock, pizza: { ...withStock.pizza, toppings: [...withStock.pizza.toppings, piece("parsley", "post"), piece("parsley", "post")] } };
    renderAt(full);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと0/2");
    expect(screen.getByRole("button", { name: /パセリ/ })).toBeDisabled();
  });

  it("counts only FINISH pieces against the stock (a pre-bake piece of the same ingredient is not charged twice)", () => {
    const state = atFinish();
    const s = { ...state, inventory: { ...state.inventory, parsley: 1 }, pizza: { ...state.pizza, toppings: [...state.pizza.toppings, piece("parsley", "pre")] } };
    renderAt(s);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと1/1");
  });

  it("select -> tap the pizza places a stage \"post\" piece, and never more than the stock; pre-bake pieces stay untouched", () => {
    const start = atFinish();
    const initial = { ...start, inventory: { ...start.inventory, parsley: 2 } };
    const before = initial.pizza;
    const { container } = render(<Harness initial={initial} />);
    const dough = container.querySelector(".pizza-dough") as HTMLElement;
    dough.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    const tap = (cx: number, cy: number) => {
      fireEvent.pointerDown(dough, { clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0 });
      fireEvent.pointerUp(dough, { clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0 });
    };
    // no selection yet: a tap places nothing
    tap(100, 100);
    expect(container.querySelectorAll('[data-testid="pizza-post-layer"] *').length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /パセリ/ }));
    expect(screen.getByRole("button", { name: /パセリ/ })).toHaveAttribute("aria-pressed", "true");
    tap(100, 100);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと1/2");
    tap(200, 200);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと0/2");
    expect(screen.getByRole("button", { name: /パセリ/ })).toBeDisabled();
    tap(150, 220);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと0/2");
    expect(before.toppings.every((t) => t.stage !== "post")).toBe(true);
  });
});
