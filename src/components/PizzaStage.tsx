import { useRef, type MouseEvent } from "react";
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
  onTap: (xPercent: number, yPercent: number) => void;
}

export function PizzaStage({
  pizza,
  recipe,
  interactive,
  bakeProgress,
  placement,
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
  const sauceColor = sauceId ? getIngredient(sauceId)?.color : undefined;
  const bakeState = bakeProgress !== null ? classifyBake(bakeProgress, recipe.bakeTarget) : null;
  const bakeIntensity = bakeProgress === null ? 0 : Math.min(1, bakeProgress / 100);

  return (
    <div className="pizza-stage">
      <div
        ref={circleRef}
        className={`pizza-dough ${interactive ? "pizza-dough--interactive" : ""} ${
          bakeState ? `pizza-dough--${bakeState}` : ""
        }`}
        onClick={handleClick}
      >
        {sauceColor && (
          <div
            className="pizza-sauce-layer"
            style={{ backgroundColor: sauceColor, opacity: 0.85 }}
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
              {ingredient.emoji}
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
            <span className="pizza-smoke" style={{ left: "32%", top: "18%" }}>
              {"\u{1F4A8}"}
            </span>
            <span className="pizza-smoke pizza-smoke--delay" style={{ left: "62%", top: "24%" }}>
              {"\u{1F4A8}"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
