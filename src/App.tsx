import { useReducer, useRef, useState } from "react";
import { DialogueBox } from "./components/DialogueBox";
import { PizzaStage } from "./components/PizzaStage";
import { IngredientTray } from "./components/IngredientTray";
import { BakeOverlay } from "./components/BakeOverlay";
import { ResultPanel } from "./components/ResultPanel";
import { DexOverlay } from "./components/DexOverlay";
import { getLine, type DialogueLine } from "./data/dialogue";
import { getIngredient, type Ingredient, type IngredientCategory } from "./data/ingredients";
import { createInitialGameState, gameReducer } from "./state/gameReducer";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>("sauce");
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  const [isDexOpen, setDexOpen] = useState(false);
  const [liveBake, setLiveBake] = useState(0);
  const bakeFrameSkip = useRef(0);

  // Every new order should start the player off with the recipe's own sauce selected,
  // so a fresh order never opens on a sauce that belongs to a different recipe.
  const [lastOrderId, setLastOrderId] = useState(state.order.id);
  if (lastOrderId !== state.order.id) {
    setLastOrderId(state.order.id);
    const primarySauce = state.recipe.requiredIngredients.find(
      (req) => getIngredient(req.ingredientId)?.category === "sauce",
    );
    setSelectedIngredientId(primarySauce?.ingredientId ?? null);
    setActiveCategory("sauce");
  }

  const [lastPhase, setLastPhase] = useState(state.phase);
  if (lastPhase !== state.phase) {
    setLastPhase(state.phase);
    if (state.phase === "BAKE") {
      setLiveBake(0);
    }
  }

  function handleSelectIngredient(ingredient: Ingredient) {
    setSelectedIngredientId(ingredient.id);
  }

  function handleChangeCategory(category: IngredientCategory) {
    setActiveCategory(category);
  }

  function handleTapPizza(x: number, y: number) {
    if (!selectedIngredientId) return;
    const ingredient = getIngredient(selectedIngredientId);
    if (!ingredient) return;
    if (ingredient.placement === "spread") {
      dispatch({ type: "APPLY_SAUCE", ingredientId: ingredient.id });
    } else {
      dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x, y });
    }
  }

  function handleBakeTick(value: number) {
    bakeFrameSkip.current += 1;
    if (bakeFrameSkip.current % 3 !== 0) return;
    setLiveBake(value);
  }

  const bakeProgress =
    state.phase === "BAKE"
      ? liveBake
      : state.phase === "RESULT" || state.phase === "DISCOVERED"
        ? state.pizza.bakeResult
        : null;

  const orderLine: DialogueLine = {
    speaker: "mito",
    id: state.order.id,
    textJa: state.order.lineJa,
  };

  const discoveredLine: DialogueLine = {
    speaker: "mito",
    id: `discovered.${state.recipe.id}`,
    textJa: state.justDiscovered
      ? `${state.recipe.nameJa}がレシピ図鑑に載ったよ！やったね！`
      : `${state.recipe.nameJa}、また上手にできたね！`,
  };

  let resultLineKey = "result.blue.mid";
  if (state.score) {
    if (state.score.stars === 3) resultLineKey = "result.blue.high";
    else if (state.score.stars === 2) resultLineKey = "result.blue.mid";
    else if (state.bakeState === "raw") resultLineKey = "result.blue.low.raw";
    else if (state.bakeState === "burnt") resultLineKey = "result.blue.low.burnt";
    else resultLineKey = "result.blue.low";
  }

  return (
    <div className="app-frame">
      <header className="app-header">
        <h1 className="app-header__title">テトのピザ屋さん</h1>
        <button type="button" className="app-header__dex-button" onClick={() => setDexOpen(true)}>
          {"\u{1F4D6}"} レシピ図鑑
        </button>
      </header>

      <section className="dialogue-area">
        {state.phase === "ORDER" && (
          <>
            <DialogueBox {...orderLine} />
            <DialogueBox {...getLine("order.teto")} />
          </>
        )}
        {state.phase === "PREPARE" && state.hint && <DialogueBox {...state.hint} />}
        {state.phase === "BAKE" && <DialogueBox {...getLine("bake.teto")} />}
        {state.phase === "RESULT" && state.score && <DialogueBox {...getLine(resultLineKey)} />}
        {state.phase === "DISCOVERED" && <DialogueBox {...discoveredLine} />}
      </section>

      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive={state.phase === "PREPARE"}
        bakeProgress={bakeProgress}
        placement={state.placement}
        onTap={handleTapPizza}
      />

      {state.phase === "ORDER" && (
        <div className="action-row">
          <button
            type="button"
            className="cta-button cta-button--primary"
            onClick={() => dispatch({ type: "BEGIN_PREPARE" })}
          >
            ピザを作る！
          </button>
        </div>
      )}

      {state.phase === "PREPARE" && (
        <>
          <IngredientTray
            activeCategory={activeCategory}
            onChangeCategory={handleChangeCategory}
            selectedIngredientId={selectedIngredientId}
            onSelectIngredient={handleSelectIngredient}
          />
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => dispatch({ type: "RESET_PIZZA" })}
            >
              やり直す
            </button>
            <button
              type="button"
              className="cta-button cta-button--bake"
              onClick={() => dispatch({ type: "START_BAKE" })}
            >
              {"\u{1F525}"} 焼く！
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => dispatch({ type: "SHOW_HINT" })}
            >
              ヒント
            </button>
          </div>
        </>
      )}

      {state.phase === "BAKE" && (
        <BakeOverlay
          targetStart={state.recipe.bakeTarget.start}
          targetEnd={state.recipe.bakeTarget.end}
          onConfirm={(value) => dispatch({ type: "CONFIRM_BAKE", value })}
          onTick={handleBakeTick}
        />
      )}

      {state.phase === "RESULT" && state.score && (
        <ResultPanel
          score={state.score}
          bakeState={state.bakeState}
          onRegister={() => dispatch({ type: "REGISTER_TO_DEX" })}
        />
      )}

      {state.phase === "DISCOVERED" && (
        <div className="action-row action-row--column">
          {state.justDiscovered && (
            <p className="discovered-banner">{"✨"} {state.recipe.nameJa}を発見しました！</p>
          )}
          <button
            type="button"
            className="cta-button cta-button--primary"
            onClick={() => dispatch({ type: "PLAY_AGAIN" })}
          >
            もう一度作る
          </button>
        </div>
      )}

      {isDexOpen && (
        <DexOverlay
          discoveredRecipeIds={state.dex}
          newlyDiscoveredId={state.justDiscovered ? state.recipe.id : null}
          onClose={() => setDexOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
