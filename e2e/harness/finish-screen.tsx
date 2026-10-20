/**
 * FINISH FIN-A harness (dev/test only; never part of the app build): the REAL `GameScreen` at the FINISH step, driven by the
 * test-only BBQ-shaped fixture recipe (never in RECIPES) through the real reducer (CONFIRM_BAKE -> FINISH, PLACE_TOPPING).
 *
 *   ?bake=raw|perfect|burnt (default perfect)  &post=0..4 (parsley placed in FINISH through PLACE_TOPPING)  &cut=1 (the profile also has CUT)
 *   &round=GUIDED|LUNCH_RUSH|DINNER|FREE_COOK (default GUIDED; the last three must NOT show FINISH)  &pan=square (the square-pan override)
 *
 * The tray, 「1つ戻す」 and the completion control are FIN-B / FIN-C and are not part of this screen yet.
 */
import { StrictMode } from "react";
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
const BAKE_VALUE = { raw: 62, perfect: 70, burnt: 78 } as const;

function build(): GameState {
  const bake = BAKE_VALUE[(params.get("bake") as keyof typeof BAKE_VALUE | null) ?? "perfect"] ?? 70;
  const profile: CookingProfile =
    params.get("cut") === "1"
      ? { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"], cutConfig: { requestedSliceCount: 6 } }
      : { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };
  const base = atBake("guided", "margherita");
  let state = gameReducer({ ...base, recipe: FX, cookingProfile: profile, pizza: preBakePizza() }, { type: "CONFIRM_BAKE", value: bake, now: 1_000_000 });
  const n = Number(params.get("post") ?? 0);
  for (let i = 0; i < n; i += 1) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parsley", x: DOUGH_CENTER - 24 + i * 16, y: DOUGH_CENTER - 20 + (i % 2) * 40 });
  }
  const round = params.get("round");
  return round && round !== "GUIDED" ? { ...state, roundKind: round as GameState["roundKind"] } : state;
}

const noop = () => {};
const state = build();
(window as unknown as { __state: GameState }).__state = state;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="app-frame">
      <GameScreen
        state={state}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory="topping"
        selectedIngredientId={null}
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
        onUndoPlacement={noop}
        onConfirmMakingStep={noop}
        onStartBake={noop}
        onShowHint={noop}
        onChangeCategory={noop}
        onSelectIngredient={noop}
        onTapPizza={noop}
        onBakeTick={noop}
        onConfirmBake={noop}
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
  </StrictMode>,
);
