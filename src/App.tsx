import { useReducer, useState } from "react";
import { DialogueBox } from "./components/DialogueBox";
import { PizzaStage } from "./components/PizzaStage";
import { IngredientTray } from "./components/IngredientTray";
import { BakeOverlay } from "./components/BakeOverlay";
import { ResultPanel } from "./components/ResultPanel";
import { DexOverlay } from "./components/DexOverlay";
import { getLine } from "./data/dialogue";
import { getIngredient, type Ingredient, type IngredientCategory } from "./data/ingredients";
import { createInitialGameState, gameReducer } from "./state/gameReducer";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>("sauce");
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(
    "tomato-sauce",
  );
  const [isDexOpen, setDexOpen] = useState(false);

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

  const bakeProgress =
    state.phase === "RESULT" || state.phase === "DISCOVERED" ? state.pizza.bakeResult : null;

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
            <DialogueBox {...getLine("order.mito")} />
            <DialogueBox {...getLine("order.teto")} />
          </>
        )}
        {state.phase === "PREPARE" && state.hintKey && <DialogueBox {...getLine(state.hintKey)} />}
        {state.phase === "BAKE" && <DialogueBox {...getLine("bake.teto")} />}
        {state.phase === "RESULT" && state.score && (
          <DialogueBox
            {...getLine(
              state.score.stars === 3
                ? "result.blue.high"
                : state.score.stars === 2
                  ? "result.blue.mid"
                  : "result.blue.low",
            )}
          />
        )}
        {state.phase === "DISCOVERED" && <DialogueBox {...getLine("discovered.mito")} />}
      </section>

      <PizzaStage
        pizza={state.pizza}
        interactive={state.phase === "PREPARE"}
        bakeProgress={bakeProgress}
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
        />
      )}

      {state.phase === "RESULT" && state.score && (
        <ResultPanel score={state.score} onRegister={() => dispatch({ type: "REGISTER_TO_DEX" })} />
      )}

      {state.phase === "DISCOVERED" && (
        <div className="action-row action-row--column">
          {state.justDiscovered && (
            <p className="discovered-banner">{state.recipe.nameJa}を発見しました！</p>
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
        <DexOverlay discoveredRecipeIds={state.dex} onClose={() => setDexOpen(false)} />
      )}
    </div>
  );
}

export default App;
