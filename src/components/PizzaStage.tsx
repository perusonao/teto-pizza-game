import { useRef, type CSSProperties, type MouseEvent } from "react";
import { getIngredient } from "../data/ingredients";
import type { Recipe } from "../data/recipes";
import type { PizzaState, PlacementFeedback } from "../state/pizzaState";
import { classifyBake } from "../logic/bake";

interface PizzaStageProps {
  pizza: PizzaState;
  recipe: Recipe;
  interactive: boolean;
  bakeProgress: number | null;
  placement: PlacementFeedback | null;
  /** True while RESULT is showing the finished pizza; gates the one-shot perfect glow. */
  resultRevealed: boolean;
  onTap: (xPercent: number, yPercent: number) => void;
}

export function PizzaStage({
  pizza,
  recipe,
  interactive,
  bakeProgress,
  placement,
  resultRevealed,
  onTap,
}: PizzaStageProps) {
  const circleRef = useRef<HTMLDivElement>(null);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!interactive || !circleRef.current) return;
    const rect = circleRef.current.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;

    const dx = rawX - 50;
    const dy = rawY - 50;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 48) return;

    onTap(rawX, rawY);
  }

  const sauceId = pizza.sauceIds[0];
  const sauceIngredient = sauceId ? getIngredient(sauceId) : undefined;
  const isOilSauce = sauceIngredient?.id === "olive-oil";
  const bakeState = bakeProgress !== null ? classifyBake(bakeProgress, recipe.bakeTarget) : null;
  const bakeIntensity = bakeProgress === null ? 0 : Math.min(1, bakeProgress / 100);
  const meltClass =
    bakeState === "perfect"
      ? "pizza-cheese--melted pizza-cheese--toasted"
      : bakeState === "burnt"
        ? "pizza-cheese--melted pizza-cheese--charred"
        : "";
  const sauceOrigin = pizza.sauceOrigin ?? { x: 50, y: 50 };
  const sauceOriginStyle = {
    "--sauce-origin-x": `${sauceOrigin.x}%`,
    "--sauce-origin-y": `${sauceOrigin.y}%`,
  } as CSSProperties;

  return (
    <div className="pizza-stage">
      <div
        ref={circleRef}
        className={`pizza-dough ${interactive ? "pizza-dough--interactive" : ""} ${
          bakeState ? `pizza-dough--${bakeState}` : ""
        }`}
        onClick={handleClick}
      >
        {sauceIngredient && (
          <div
            key={pizza.sauceToken}
            className={`pizza-sauce-layer ${isOilSauce ? "pizza-sauce-layer--oil" : ""}`}
            style={{
              ...(isOilSauce ? {} : { backgroundColor: sauceIngredient.color, opacity: 0.85 }),
              ...sauceOriginStyle,
            }}
          />
        )}
        {pizza.toppings.map((t) => {
          const ingredient = getIngredient(t.ingredientId);
          if (!ingredient) return null;
          return (
            <span
              key={t.id}
              className="pizza-topping"
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
            >
              {ingredient.category === "cheese" ? (
                <span className={`pizza-cheese pizza-cheese--${ingredient.id} ${meltClass}`} />
              ) : (
                <span className="pizza-topping__emoji">{ingredient.emoji}</span>
              )}
            </span>
          );
        })}
        {placement?.status === "rejected" && (
          <span
            key={placement.token}
            className="pizza-reject-mark"
            style={{ left: `${placement.x}%`, top: `${placement.y}%` }}
          >
            {"✕"}
          </span>
        )}
        {bakeState && (
          <div
            className={`pizza-bake-overlay pizza-bake-overlay--${bakeState}`}
            style={{ opacity: bakeState === "perfect" ? 0.3 + bakeIntensity * 0.25 : undefined }}
          />
        )}
        {bakeState === "burnt" && (
          <>
            <div className="pizza-char-spots" />
            <span className="pizza-smoke" style={{ left: "32%", top: "18%" }}>
              {"\u{1F4A8}"}
            </span>
            <span className="pizza-smoke pizza-smoke--delay" style={{ left: "62%", top: "24%" }}>
              {"\u{1F4A8}"}
            </span>
          </>
        )}
        {resultRevealed && bakeState === "perfect" && (
          <div key="perfect-glow" className="pizza-perfect-glow" />
        )}
      </div>
    </div>
  );
}
