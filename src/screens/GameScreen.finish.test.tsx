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
 * Production is unchanged. The tray is FIN-B and the ↩ / 完成 bar is FIN-C (see the describes below).
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

  it("has the FINISH bar (↩, 完成, ヒント) and none of PREPARE's controls: no やり直す / 全消し, no 次へ / 焼く！", () => {
    renderAt(atFinish());
    expect(screen.getAllByRole("button", { name: "ヒント" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "1つ戻す" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "完成" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /やり直す|全消し|次へ|焼く！/ })).toBeNull();
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
function Harness({ initial, onState }: { initial: GameState; onState?: (state: GameState) => void }) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  onState?.(state);
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
      onUndoPlacement={() => dispatch({ type: "UNDO_LAST_PLACEMENT" })}
      onConfirmMakingStep={() => {
        dispatch({ type: "CONFIRM_MAKING_STEP", now: T });
        dispatch({ type: "REGISTER_TO_DEX" });
      }}
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

describe("FINISH ↩ and 完成 (FIN-C)", () => {
  function setup(over: Partial<GameState> = {}, stock = 2) {
    const start = atFinish();
    const initial = { ...start, inventory: { ...start.inventory, parsley: stock }, ...over };
    let latest = initial;
    const view = render(<Harness initial={initial} onState={(st) => (latest = st)} />);
    const dough = view.container.querySelector(".pizza-dough") as HTMLElement;
    dough.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    const tap = (cx: number, cy: number) => {
      fireEvent.pointerDown(dough, { clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0 });
      fireEvent.pointerUp(dough, { clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0 });
    };
    const post = () => latest.pizza.toppings.filter((t) => t.stage === "post");
    return { initial, view, tap, post, get state() { return latest; } };
  }

  it("↩ is disabled with nothing placed in FINISH, even though pre-bake pieces exist", () => {
    const t = setup();
    expect(t.initial.pizza.toppings.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "1つ戻す" })).toBeDisabled();
  });

  it("↩ takes back only the latest FINISH piece, repeatedly, then disables; re-placing after undo works; pre-bake pieces never change", () => {
    const t = setup();
    const preBefore = t.state.pizza.toppings.filter((p) => p.stage !== "post");
    fireEvent.click(screen.getByRole("button", { name: /パセリ/ }));
    t.tap(100, 100);
    t.tap(200, 200);
    expect(t.post()).toHaveLength(2);
    const first = t.post()[0].id;
    const undo = screen.getByRole("button", { name: "1つ戻す" });
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(t.post().map((p) => p.id)).toEqual([first]);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと1/2");
    fireEvent.click(undo);
    expect(t.post()).toHaveLength(0);
    expect(undo).toBeDisabled();
    fireEvent.click(undo); // nothing left: pre-bake pieces are never taken
    expect(t.state.pizza.toppings.filter((p) => p.stage !== "post")).toEqual(preBefore);
    // re-place after undo (the chip is still usable and the stock came back)
    fireEvent.click(screen.getByRole("button", { name: /パセリ/ }));
    t.tap(120, 120);
    expect(t.post()).toHaveLength(1);
    expect(undo).toBeEnabled();
    expect(t.state.pizza.toppings.filter((p) => p.stage !== "post")).toEqual(preBefore);
  });

  it("releases the selection when the stock runs out, and the stage no longer places", () => {
    const t = setup({}, 1);
    const chip = screen.getByRole("button", { name: /パセリ/ });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    t.tap(100, 100);
    expect(chip).toBeDisabled();
    expect(chip).toHaveAttribute("aria-pressed", "false");
    t.tap(200, 200);
    expect(t.post()).toHaveLength(1);
    // undo brings the stock back; the chip is placeable again but is not silently re-selected
    fireEvent.click(screen.getByRole("button", { name: "1つ戻す" }));
    expect(screen.getByRole("button", { name: /パセリ/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /パセリ/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("完成 with no late piece goes to RESULT with a FAILED completion, with no confirm dialog", () => {
    const t = setup();
    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(t.state.phase).not.toBe("POST_BAKE");
    expect(t.state.completion?.status).toBe("FAILED");
  });

  it("完成 with the late pieces placed runs FINAL once; a double press consumes the stock exactly once", () => {
    const t = setup();
    fireEvent.click(screen.getByRole("button", { name: /パセリ/ }));
    t.tap(100, 100);
    t.tap(200, 200);
    const expected = gameReducer(t.state, { type: "CONFIRM_MAKING_STEP", now: T });
    expect(expected.phase).toBe("RESULT");
    const button = screen.getByRole("button", { name: "完成" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(t.state.inventory).toEqual(expected.inventory);
    expect(t.state.inventory.parsley).toBe(0);
    expect(["RESULT", "DISCOVERED"]).toContain(t.state.phase); // the harness registers to the Dex after, like App
    expect(t.state.completion?.status).not.toBe("FAILED");
  });

  it("completing leaves the pre-bake pieces as they were", () => {
    const t = setup();
    const pre = t.state.pizza.toppings.filter((p) => p.stage !== "post");
    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(t.state.pizza.toppings.filter((p) => p.stage !== "post")).toEqual(pre);
  });

  it("shows a one-line note instead of the tray when no late ingredient is owned", () => {
    const start = atFinish();
    const { container } = renderAt({ ...start, ownedIngredientIds: start.ownedIngredientIds.filter((id) => id !== "parsley") });
    expect(screen.getByTestId("finish-tray-empty")).toHaveTextContent("後乗せにつかう食材がありません");
    expect(container.querySelector(".ingredient-tray")).toBeNull();
    expect(screen.getByRole("button", { name: "完成" })).toBeEnabled();
  });
});
