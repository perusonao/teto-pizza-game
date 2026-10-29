import { useCallback, useEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { prepExperienceEnabled } from "../data/prepExperienceGate";
import { getIngredient } from "../data/ingredients";
import { beefLookStyle, PREPARED_PIECE_CLASS } from "../logic/prep/beefDoneness";
import {
  PAN_ARM_MS,
  PAN_IDLE,
  PAN_TOTAL_MS,
  panReducer,
  panResultCopy,
  panStageAt,
  panStageEdges,
  progressAt,
  type PanStage,
} from "../logic/prep/panDoneness";
import { PREP_DONE_MS, PREP_GUARD_MS, prepOfferedIngredient } from "../logic/prep/prepOffer";
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
  /** Dispatches PREP_INGREDIENT with how far into the pan time the player took it out (0..1). Called exactly once, when the player keeps the result. */
  onPrep: (ingredientId: string, progress: number) => void;
  /** True while the pan screen (and the short guard after it) is up: GameScreen makes the dock inert meanwhile. */
  onBusyChange?: (busy: boolean) => void;
}

/** How often the beef colour is repainted. ~12Hz: the colour moves < 1 ΔE per step, so more would only cost battery. The stages switch on exact timers. */
const COLOR_TICK_MS = 80;

const nowMs = () => performance.now();

/**
 * The press's own moment on the `performance.now()` clock. React's synthetic `timeStamp` falls back to `Date.now()` for a 0 stamp, and a very old engine
 * stamps in epoch milliseconds: either would be a different clock, so a stamp that is not finite, not positive, or more than two pan-times away from
 * "now" is replaced by "now". A real pointer event's stamp is a few milliseconds behind it.
 */
function pressMoment(event: { nativeEvent: { timeStamp: number } }): number {
  const now = nowMs();
  const stamp = event.nativeEvent.timeStamp;
  return Number.isFinite(stamp) && stamp > 0 && Math.abs(stamp - now) <= PAN_TOTAL_MS * 2 ? stamp : now;
}

/**
 * Cooking Prep Phase 1B (Issue #696): the optional "🍳 炒める" prep as a timing game, rendered INSIDE `.pizza-stage` after the dough.
 *
 *   beef selected -> [🍳 炒める] pill -> pan screen: the beef cooks on its own for up to 6 s, the player watches it and presses 「取り出す！」
 *   -> early / best / overdone (the press's own timestamp decides, ../logic/prep/panDoneness.ts) -> best closes by itself and marks "✓ 炒め済み";
 *      early / overdone offer 「もう一度炒める」 or 「これで使う」 (× also closes, leaving nothing)
 *
 * Optional (skip it and the round is unchanged); nothing is ever failed or blocked. No gauge, bar, ring, number or countdown (Q3): the beef's colour,
 * sheen, steam and smoke are the only clues. Only the player's keep reaches the reducer, once. Renders nothing while the experience is OFF
 * (production), so the DOM is today's.
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

  const [pan, dispatchPan] = useReducer(panReducer, PAN_IDLE);
  const [stage, setStage] = useState<PanStage>(0);
  const [progress, setProgress] = useState(0);
  const [armed, setArmed] = useState(false);
  const [resultArmed, setResultArmed] = useState(false);
  const [guard, setGuard] = useState(false);
  const downOnPill = useRef(false);
  const guardTimer = useRef<number | undefined>(undefined);
  const takeRef = useRef<HTMLButtonElement>(null);
  // The latest `onPrep` without making the auto-close timer restart whenever the parent re-renders with a new function.
  const onPrepRef = useRef(onPrep);
  useEffect(() => {
    onPrepRef.current = onPrep;
  }, [onPrep]);

  const mode = pan.status;

  // Everything that runs while the pan cooks: the exact stage switches, the colour repaint, the time-out. One effect, one cleanup, keyed on the run.
  const startedAt = pan.status === "running" ? pan.startedAt : null;
  useEffect(() => {
    if (startedAt === null) return;
    const timers: number[] = [];
    const elapsed = () => nowMs() - startedAt;
    for (const edge of panStageEdges()) timers.push(window.setTimeout(() => setStage(panStageAt(edge)), Math.max(0, edge - elapsed())));
    timers.push(window.setTimeout(() => setArmed(true), Math.max(0, PAN_ARM_MS - elapsed())));
    const colorTimer = window.setInterval(() => setProgress(progressAt(elapsed())), COLOR_TICK_MS);
    // The time-out is the timer's own moment (the total after the start), never "whenever the next frame is".
    timers.push(window.setTimeout(() => dispatchPan({ type: "TICK", now: Math.max(nowMs(), startedAt + PAN_TOTAL_MS) }), Math.max(0, PAN_TOTAL_MS - elapsed())));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(colorTimer);
    };
  }, [startedAt]);

  const finished = pan.status === "finished" ? pan : null;
  const grade = finished?.grade ?? null;

  const commit = useCallback(
    (progressAtTake: number) => {
      // Dispatch first (the pan screen unmounts with the "✓ 炒め済み" mark), then keep a transparent guard over the stage for a moment.
      onPrepRef.current(offered, progressAtTake);
      dispatchPan({ type: "CANCEL" });
      setGuard(true);
      window.clearTimeout(guardTimer.current);
      guardTimer.current = window.setTimeout(() => setGuard(false), PREP_GUARD_MS);
    },
    [offered],
  );

  // A finished pan: "best" closes by itself after the sizzle; the other two wait for the player's choice, whose buttons arm after a short moment.
  useEffect(() => {
    if (finished === null) return;
    if (finished.grade === "best") {
      const t = window.setTimeout(() => commit(finished.progress), PREP_DONE_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setResultArmed(true), PAN_ARM_MS);
    return () => window.clearTimeout(t);
  }, [finished, commit]);

  useEffect(() => () => window.clearTimeout(guardTimer.current), []);

  const reset = useCallback(() => {
    setStage(0);
    setProgress(0);
    setArmed(false);
    setResultArmed(false);
  }, []);

  const cancel = useCallback(() => {
    dispatchPan({ type: "CANCEL" });
    reset();
  }, [reset]);

  // Leaving the page / the app mid-pan discards it too (AC-10), also while a result is showing.
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
    if (mode === "running") takeRef.current?.focus();
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
    reset();
    dispatchPan({ type: "START", now: nowMs() });
  };

  /** One press. The reducer refuses it inside PAN_ARM_MS, once finished, and after the time-out; the stamp is the press's own. */
  const take = (at: number) => dispatchPan({ type: "TAKE", now: at });

  const retry = () => {
    if (!resultArmed) return;
    dispatchPan({ type: "CANCEL" });
    reset();
    dispatchPan({ type: "START", now: nowMs() });
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
  const shownProgress = finished ? finished.progress : progress;
  const shownStage: PanStage = finished ? panStageAt(finished.elapsedMs) : stage;
  const copy = finished ? panResultCopy(finished.grade, finished.by) : null;
  return (
    <div className="cooking-prep-pan" data-testid="cooking-prep-pan" data-mode={finished ? "done" : "running"} data-stage={shownStage} data-grade={grade ?? undefined}>
      {/* One slot for both: the title while it cooks, the result once it is out -- above the pan, so the beef you took out stays fully visible. */}
      {copy ? (
        <p className={`cooking-prep-pan__title cooking-prep-pan__result cooking-prep-pan__result--${finished?.grade}`} data-testid="cooking-prep-result">
          {copy.label}
        </p>
      ) : (
        <p className="cooking-prep-pan__title">いい焼き色で取り出そう</p>
      )}
      <div className="cooking-prep-pan__pan">
        <span className="cooking-prep-pan__oil" aria-hidden="true" />
        <span className="cooking-prep-pan__vapor" aria-hidden="true" data-testid="cooking-prep-vapor">
          <i />
          <i />
          <i />
        </span>
        <span className="cooking-prep-pan__bubbles" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {beef && (
          <span className={`cooking-prep-pan__beef ${PREPARED_PIECE_CLASS}`} style={beefLookStyle(shownProgress)} aria-hidden="true" data-testid="cooking-prep-beef">
            <IngredientGlyph ingredient={beef} />
          </span>
        )}
      </div>
      {finished === null ? (
        <button
          type="button"
          ref={takeRef}
          className="cooking-prep-pan__take"
          data-testid="cooking-prep-take"
          data-armed={armed ? "true" : "false"}
          aria-disabled={armed ? undefined : true}
          onPointerDown={(event) => {
            event.preventDefault();
            take(pressMoment(event));
          }}
          onClick={(event) => {
            if (event.detail === 0) take(nowMs());
          }}
        >
          取り出す！
        </button>
      ) : finished.grade === "best" ? (
        <div className="cooking-prep-pan__choices" aria-hidden="true" />
      ) : (
        <div className="cooking-prep-pan__choices" data-testid="cooking-prep-choices" data-armed={resultArmed ? "true" : "false"}>
          <button type="button" className="cooking-prep-pan__choice" data-testid="cooking-prep-retry" aria-disabled={resultArmed ? undefined : true} onClick={retry}>
            もう一度炒める
          </button>
          <button
            type="button"
            className="cooking-prep-pan__choice cooking-prep-pan__choice--use"
            data-testid="cooking-prep-use"
            aria-disabled={resultArmed ? undefined : true}
            onClick={() => {
              if (resultArmed) commit(finished.progress);
            }}
          >
            これで使う
          </button>
        </div>
      )}
      <span className="cooking-prep-sr" role="status" aria-live="polite">
        {copy ? copy.label : "炒め中。いい焼き色で取り出します"}
      </span>
      <button type="button" className="cooking-prep-pan__close" data-testid="cooking-prep-cancel" aria-label="やめる" onClick={cancel} disabled={finished?.grade === "best"}>
        ×
      </button>
    </div>
  );
}
