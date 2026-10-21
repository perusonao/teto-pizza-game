/**
 * FINISH FIN-A harness (dev/test only; never part of the app build): the REAL `GameScreen` at the FINISH step, driven by the
 * test-only BBQ-shaped fixture recipe (never in RECIPES) through the real reducer (CONFIRM_BAKE -> FINISH, PLACE_TOPPING).
 *
 *   ?bake=raw|perfect|burnt (default perfect)  &post=0..4 (parsley placed in FINISH through PLACE_TOPPING)  &cut=1 (the profile also has CUT)
 *   &round=GUIDED|LUNCH_RUSH|DINNER|FREE_COOK (default GUIDED; the last three must NOT show FINISH)  &pan=square (the square-pan override)
 *
 *   &stock=N (parsley's post-bake stock)  &late=2|3 (also require basil / a third late topping, to measure a 2-3 chip tray)
 *
 * FIN-B: stateful -- the real reducer + App's select / tap wiring (App.tsx handleSelectIngredient / handleTapPizza), so a tap on the
 * tray and on the pizza really places a "post" piece. FIN-C: ↩ (UNDO_LAST_PLACEMENT) and 完成 (CONFIRM_MAKING_STEP, then REGISTER_TO_DEX like App) are wired to the real reducer.
 *   &owned=none (no late ingredient owned: the tray's note)
 *
 * FIN-D: &start=bake begins at the BAKE phase (CONFIRM_BAKE is then dispatched by the real BAKE overlay's 止める, or window.__confirmBake(value) for a
 * deterministic bake), and the whole round is exercised through to RESULT / DISCOVERED. `window.__actions()` returns every dispatched action type
 * (to count CONFIRM_MAKING_STEP / REGISTER_TO_DEX), `&cut=` / `&late=` / `&stock=` / `&owned=` apply as before.
 */
import { StrictMode, useCallback, useEffect, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/App.css";
import { GameScreen } from "../../src/screens/GameScreen";
import { gameReducer, type GameState } from "../../src/state/gameReducer";
import { INITIAL_MISSION_STATE } from "../../src/mission/lunchRush";
import { emptySauceMetrics } from "../../src/logic/sauceField";
import type { CookingProfile } from "../../src/data/cookingProfiles";
import { DOUGH_CENTER } from "../../src/logic/pizzaCoordinates";
import { atBake } from "../../src/state/testSupport/confirmBakeMatrix";
import { FINISH_FIXTURE_RECIPE as FX, preBakePizza } from "../../src/state/testSupport/finishFixture";

const params = new URLSearchParams(location.search);
const LATE_EXTRA = [
  { ingredientId: "basil", minCount: 1, applicationPhase: "POST_BAKE" as const },
  { ingredientId: "onion", minCount: 1, applicationPhase: "POST_BAKE" as const },
];
const BAKE_VALUE = { raw: 62, perfect: 70, burnt: 78 } as const;

function build(): GameState {
  const bake = BAKE_VALUE[(params.get("bake") as keyof typeof BAKE_VALUE | null) ?? "perfect"] ?? 70;
  const profile: CookingProfile =
    params.get("cut") === "1"
      ? { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"], cutConfig: { requestedSliceCount: 6 } }
      : { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };
  const base = atBake("guided", "margherita");
  const late = Number(params.get("late") ?? 1);
  const recipe = late > 1 ? { ...FX, requiredIngredients: [...FX.requiredIngredients, ...LATE_EXTRA.slice(0, late - 1)] } : FX;
  const atBakeState: GameState = { ...base, recipe, cookingProfile: profile, pizza: preBakePizza() };
  if (params.get("start") === "bake") {
    return params.has("stock") ? { ...atBakeState, inventory: { ...atBakeState.inventory, parsley: Number(params.get("stock")) } } : atBakeState;
  }
  let state = gameReducer(atBakeState, { type: "CONFIRM_BAKE", value: bake, now: 1_000_000 });
  if (params.has("stock")) state = { ...state, inventory: { ...state.inventory, parsley: Number(params.get("stock")) } };
  const n = Number(params.get("post") ?? 0);
  for (let i = 0; i < n; i += 1) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parsley", x: DOUGH_CENTER - 24 + i * 16, y: DOUGH_CENTER - 20 + (i % 2) * 40 });
  }
  if (params.get("owned") === "none") state = { ...state, ownedIngredientIds: state.ownedIngredientIds.filter((id) => id !== "parsley") };
  const round = params.get("round");
  return round && round !== "GUIDED" ? { ...state, roundKind: round as GameState["roundKind"] } : state;
}

const noop = () => {};
const initial = build();

function Harness() {
  const [state, dispatch] = useReducer(gameReducer, initial);
  const [log] = useState<string[]>([]);
  const send = useCallback(
    (action: Parameters<typeof gameReducer>[1]) => {
      log.push(action.type);
      dispatch(action);
    },
    [log],
  );
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const w = window as unknown as { __state: () => GameState; __actions: () => string[]; __confirmBake: (value: number) => void };
    w.__state = () => state;
    w.__actions = () => [...log];
    w.__confirmBake = (value) => {
      send({ type: "CONFIRM_BAKE", value, now: Date.now() });
      send({ type: "REGISTER_TO_DEX" });
    };
  }, [state, log, send]);
  return (
    <div className="app-frame">
      <GameScreen
        state={state}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory="topping"
        selectedIngredientId={selected}
        bakeProgress={state.pizza.bakeResult}
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
        onGoHome={noop}
        onBeginPrepare={noop}
        onResetPizza={noop}
        onUndoPlacement={() => send({ type: "UNDO_LAST_PLACEMENT" })}
        onConfirmMakingStep={() => {
          send({ type: "CONFIRM_MAKING_STEP", now: Date.now() });
          send({ type: "REGISTER_TO_DEX" });
        }}
        onStartBake={noop}
        onShowHint={() => send({ type: "SHOW_HINT" })}
        onChangeCategory={noop}
        onSelectIngredient={(i) => setSelected(i.id)}
        onClearIngredientSelection={() => setSelected(null)}
        onTapPizza={(x, y) => selected && send({ type: "PLACE_TOPPING", ingredientId: selected, x, y })}
        onBakeTick={noop}
        onConfirmBake={(value) => {
          send({ type: "CONFIRM_BAKE", value, now: Date.now() });
          send({ type: "REGISTER_TO_DEX" });
        }}
        onRetrySameRecipe={noop}
        onBackToPizzaSelect={noop}
        onMissionServeNext={noop}
        onMissionSkipOrder={noop}
        onMissionStart={noop}
        onMissionExitToFree={noop}
        onMissionCloseIntro={noop}
        onShowRanking={noop}
        onReferencePopoverChange={noop}
        onDispenseProgress={noop}
        onDispenseCommit={noop}
        onDoughStretchProgress={noop}
        onDoughStretchCommit={noop}
        onAddCutLine={noop}
        onDoughElementChange={noop}
        resolvePhysicalDrop={() => null}
        onPhysicalDrop={noop}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
