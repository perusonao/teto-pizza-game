import { useRef, type MouseEvent } from "react";
import { getIngredient } from "../data/ingredients";
import type { PizzaState } from "../state/pizzaState";

interface PizzaStageProps {
  pizza: PizzaState;
  interactive: boolean;
  bakeProgress: number | null;
  onTap: (xPercent: number, yPercent: number) => void;
}

export function PizzaStage({ pizza, interactive, bakeProgress, onTap }: PizzaStageProps) {
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
  const bakeTone = bakeProgress === null ? 0 : Math.min(1, bakeProgress / 100);

  return (
    <div className="pizza-stage">
      <div
        ref={circleRef}
        className={`pizza-dough ${interactive ? "pizza-dough--interactive" : ""}`}
        onClick={handleClick}
        style={{
          filter: bakeProgress !== null ? `brightness(${1 - bakeTone * 0.25}) saturate(${1 + bakeTone * 0.3})` : undefined,
        }}
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
        {bakeProgress !== null && bakeProgress > 0 && (
          <div className="pizza-bake-overlay" style={{ opacity: bakeTone * 0.55 }} />
        )}
      </div>
    </div>
  );
}
