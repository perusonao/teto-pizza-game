import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { prepExperienceEnabled } from "../data/prepExperienceGate";
import { getIngredient } from "../data/ingredients";
import { beefDonenessStyle, PREPARED_PIECE_CLASS } from "../logic/prep/beefDoneness";
import { PREP_DONE_MS, PREP_GUARD_MS, PREP_TOSSES, PREP_TOSS_DEBOUNCE_MS, prepOfferedIngredient } from "../logic/prep/prepOffer";
import type { RoundKind } from "../state/roundKind";
import { IngredientGlyph } from "./IngredientGlyph";
import "./CookingPrep.css";

interface CookingPrepLayerProps {
  phase: string;
  makingStep: string;
  roundKind: RoundKind;
  /** The stage accepts input (same condition as `PizzaStage`'s `interactive`). */
  active: boolean;
  selectedIngredientId: string | null;
  ownedIngredientIds: readonly string[];
  preparedIngredientIds?: readonly string[];
  /** Any change of these closes a pan screen that is open (a step change / "やり直す" discards it, like an in-flight gesture). */
  makingStepToken: number;
  resetToken: number;
  /** Dispatches PREP_INGREDIENT. Called exactly once, on the third toss. */
  onPrep: (ingredientId: string) => void;
  /** True while the pan screen (and the short guard after it) is up: GameScreen makes the dock inert meanwhile. */
  onBusyChange?: (busy: boolean) => void;
}

type Mode = "idle" | "pan" | "done";

/**
 * Cooking Prep Phase 1 PR-B S4: the optional "🍳 炒める" prep, rendered INSIDE `.pizza-stage` after the dough (PizzaStage's `overlay` slot).
 *
 *   beef selected -> [🍳 炒める] pill -> pan screen (tap 3 times anywhere; × cancels, nothing is left) -> "ジュッ！" -> closes by itself -> "✓ 炒め済み"
 *
 * Optional (skip it and the round is unchanged), no fail state, no timer. Only the third toss reaches the reducer. Renders nothing at all while
 * the experience is OFF (production), so the DOM is today's. Spec §3, §9, AC-8..AC-16.
 */
export function CookingPrepLayer(props: CookingPrepLayerProps) {
  const { phase, makingStep, roundKind, active, selectedIngredientId, ownedIngredientIds, makingStepToken, resetToken } = props;
  const offered = prepOfferedIngredient({ enabled: prepExperienceEnabled(), phase, makingStep, roundKind, active, selectedIngredientId, ownedIngredientIds });
  if (offered === null) return null;
  // The pan screen belongs to one (step, pizza, ingredient): any change remounts it, which discards it without dispatching anything.
  return <CookingPrepOffer key={`${makingStepToken}:${resetToken}:${offered}`} {...props} offered={offered} />;
}

function CookingPrepOffer(props: CookingPrepLayerProps & { offered: string }) {
  const { offered, preparedIngredientIds, onPrep, onBusyChange } = props;
  const prepared = preparedIngredientIds?.includes(offered) ?? false;

  const [mode, setMode] = useState<Mode>("idle");
  const [tosses, setTosses] = useState(0);
  const [guard, setGuard] = useState(false);
  const lastTossAt = useRef(-Infinity);
  const downOnPill = useRef(false);
  const timers = useRef<number[]>([]);
  const surfaceRef = useRef<HTMLButtonElement>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  const cancel = useCallback(() => {
    clearTimers();
    setMode("idle");
    setTosses(0);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Leaving the page / the app mid-pan discards it too (AC-10).
  useEffect(() => {
    if (mode === "idle") return;
    const abort = () => cancel();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, cancel]);

  const busy = mode !== "idle" || guard;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (mode === "pan") surfaceRef.current?.focus();
  }, [mode]);

  if (prepared) {
    return (
      <>
        <span className="cooking-prep-done" role="status" data-testid="cooking-prep-done">
          ✓ 炒め済み
        </span>
        {guard && <div className="cooking-prep-guard" data-testid="cooking-prep-guard" />}
      </>
    );
  }

  const open = () => {
    setTosses(0);
    lastTossAt.current = -Infinity;
    setMode("pan");
  };

  const toss = (at: number) => {
    if (mode !== "pan") return;
    if (at - lastTossAt.current < PREP_TOSS_DEBOUNCE_MS) return;
    lastTossAt.current = at;
    const next = tosses + 1;
    setTosses(next);
    if (next < PREP_TOSSES) return;
    setMode("done");
    timers.current.push(
      window.setTimeout(() => {
        // Dispatch first (the pan screen unmounts with the "✓ 炒め済み" mark), then keep a transparent guard over the stage for a moment.
        onPrep(offered);
        setMode("idle");
        setTosses(0);
        setGuard(true);
        timers.current.push(window.setTimeout(() => setGuard(false), PREP_GUARD_MS));
      }, PREP_DONE_MS),
    );
  };

  if (mode === "idle") {
    const onPillPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
      const startedHere = downOnPill.current;
      downOnPill.current = false;
      if (!startedHere) return;
      // Start only when the finger is released ON the pill (AC-16 b).
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) open();
    };
    return (
      <>
        <button
          type="button"
          className="cooking-prep-pill"
          data-testid="cooking-prep-pill"
          onPointerDown={() => {
            downOnPill.current = true;
          }}
          onPointerUp={onPillPointerUp}
          onPointerCancel={() => {
            downOnPill.current = false;
          }}
          onClick={(event) => {
            // Keyboard (Enter / Space) only: a pointer press is handled by pointerup above.
            if (event.detail === 0) open();
          }}
        >
          🍳 炒める
        </button>
        {guard && <div className="cooking-prep-guard" data-testid="cooking-prep-guard" />}
      </>
    );
  }

  const beef = getIngredient(offered);
  const doneness = tosses / PREP_TOSSES;
  return (
    <div className="cooking-prep-pan" data-testid="cooking-prep-pan" data-tosses={tosses} data-mode={mode}>
      <button
        type="button"
        ref={surfaceRef}
        className="cooking-prep-pan__surface"
        data-testid="cooking-prep-surface"
        aria-label="フライパン。3回タップして炒めます"
        disabled={mode === "done"}
        onPointerDown={(event) => {
          event.preventDefault();
          toss(event.timeStamp);
        }}
        onClick={(event) => {
          if (event.detail === 0) toss(performance.now());
        }}
      />
      <p className="cooking-prep-pan__title">炒めよう</p>
      <div className="cooking-prep-pan__pan">
        {tosses > 0 && (
          <span className="cooking-prep-pan__steam" aria-hidden="true">
            {Array.from({ length: tosses }, (_, i) => (
              <span key={i}>♨</span>
            ))}
          </span>
        )}
        {beef && (
          <span
            key={tosses}
            className={`cooking-prep-pan__beef ${PREPARED_PIECE_CLASS}${tosses > 0 ? " cooking-prep-pan__beef--toss" : ""}`}
            style={beefDonenessStyle(doneness)}
            aria-hidden="true"
          >
            <IngredientGlyph ingredient={beef} />
          </span>
        )}
        {mode === "done" && <span className="cooking-prep-pan__sizzle">ジュッ！</span>}
      </div>
      <div className="cooking-prep-pan__dots" aria-hidden="true">
        {Array.from({ length: PREP_TOSSES }, (_, i) => (
          <span key={i} className={`cooking-prep-pan__dot${i < tosses ? " cooking-prep-pan__dot--on" : ""}`} />
        ))}
      </div>
      <p className="cooking-prep-pan__hint">{mode === "done" ? "炒め済み！" : "タップ！"}</p>
      <span className="cooking-prep-sr" role="status" aria-live="polite">
        {mode === "done" ? "炒め済み" : tosses === 0 ? "フライパンです。3回タップして炒めます" : `${tosses} / ${PREP_TOSSES}`}
      </span>
      <button type="button" className="cooking-prep-pan__close" data-testid="cooking-prep-cancel" aria-label="やめる" onClick={cancel} disabled={mode === "done"}>
        ×
      </button>
    </div>
  );
}
