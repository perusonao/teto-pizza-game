import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { getIngredient } from "../data/ingredients";
import { searExperienceEnabled } from "../data/searExperienceGate";
import { searFullMsOverride } from "../preview/searPreview";
import { SEAR_DONE_MS, SEAR_GUARD_MS, searOfferedIngredient } from "../logic/sear/searOffer";
import { searPillNeedsCorner } from "../logic/sear/searPillPlacement";
import { SEAR_FULL_MS, SEAR_IDLE, SEAR_LOOK_COPY, searAmountAt, searHoldReducer, searHoldingTitle, searLookOf } from "../logic/sear/searHold";
import { SEARED_PIECE_CLASS, sausageSearStyle } from "../logic/sear/sausageSear";
import type { RoundKind } from "../state/roundKind";
import { IngredientGlyph } from "./IngredientGlyph";
import "./Sear.css";

interface SearLayerProps {
  phase: string;
  makingStep: string;
  roundKind: RoundKind;
  /** The stage accepts input (same condition as `PizzaStage`'s `interactive`). */
  active: boolean;
  selectedIngredientId: string | null;
  ownedIngredientIds: readonly string[];
  /** `GameState.searedLook`: its keys are the seared ingredients. */
  searedLook?: Readonly<Record<string, number>>;
  /** Any change of these closes a sear screen that is open (a step change / "やり直す" discards it, like an in-flight gesture). */
  makingStepToken: number;
  resetToken: number;
  /** Dispatches SEAR_INGREDIENT with the amount the long press reached (0..1). Called exactly once, when the player lets go after a real hold. */
  onSear: (ingredientId: string, amount: number) => void;
  /** True while the sear screen (and the short guard after it) is up: GameScreen makes the dock inert meanwhile (the same busy state as the 炒める prep). */
  onBusyChange?: (busy: boolean) => void;
}

/** Repaint rate while the finger is down (~20Hz: smooth enough to watch the colour move, cheap enough for a phone). */
const TICK_MS = 50;

const nowMs = () => performance.now();

/** The event's own moment on the `performance.now()` clock; a stamp that is not finite / positive / within a minute of "now" is replaced by "now". */
function eventMoment(stamp: number): number {
  const now = nowMs();
  return Number.isFinite(stamp) && stamp > 0 && Math.abs(stamp - now) <= 60_000 ? stamp : now;
}

/**
 * Cooking Sear Phase 1 (Issue #724): the optional "🔥 炙る" prep as a LONG PRESS, rendered INSIDE `.pizza-stage` after the dough.
 *
 *   sausage selected -> [🔥 炙る] pill -> sear screen: press and HOLD the button -- the sausage browns for as long as the finger stays down;
 *   let go -> that look is kept (a tap that is too short keeps nothing) -> the words for the look -> the screen closes, "✓ 炙り済み"
 *
 * Optional (skip it and the round is unchanged); nothing is ever failed, graded or blocked. No gauge, bar, ring, number or countdown: the sausage's colour,
 * the glow and the smoke are the only clues. Only the release reaches the reducer, once. Renders nothing while the experience is OFF (production), so the
 * DOM is today's. Independent of the 炒める prep (./CookingPrepLayer.tsx), which is untouched.
 */
export function SearLayer(props: SearLayerProps) {
  const { phase, makingStep, roundKind, active, selectedIngredientId, ownedIngredientIds, makingStepToken, resetToken } = props;
  const offered = searOfferedIngredient({ enabled: searExperienceEnabled(), phase, makingStep, roundKind, active, selectedIngredientId, ownedIngredientIds });
  if (offered === null) return null;
  // The sear screen belongs to one (step, pizza, ingredient): any change remounts it, which discards it without dispatching anything.
  return <SearOffer key={`${makingStepToken}:${resetToken}:${offered}`} {...props} offered={offered} />;
}

/** Whether the pill / done mark must use the stage's corner (see ../logic/sear/searPillPlacement.ts). Re-measured when the stage or the dough is resized. */
function useSearCorner(anchor: RefObject<HTMLElement | null>, deps: readonly unknown[]): boolean {
  const [corner, setCorner] = useState(false);
  useLayoutEffect(() => {
    const el = anchor.current;
    const stage = el?.offsetParent as HTMLElement | null;
    const dough = stage?.querySelector<HTMLElement>(".pizza-dough") ?? null;
    if (!el || !stage || !dough) return;
    const measure = () => {
      const s = stage.getBoundingClientRect();
      const d = dough.getBoundingClientRect();
      setCorner(searPillNeedsCorner({ left: s.left, top: s.top, right: s.right, bottom: s.bottom }, { left: d.left, top: d.top, right: d.right, bottom: d.bottom }));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(stage);
    observer?.observe(dough);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return corner;
}

function SearOffer(props: SearLayerProps & { offered: string }) {
  const { offered, searedLook, onSear, onBusyChange } = props;
  const seared = searedLook?.[offered] !== undefined;

  const [hold, dispatchHold] = useReducer(searHoldReducer, SEAR_IDLE);
  const [screen, setScreen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [guard, setGuard] = useState(false);
  const downOnPill = useRef(false);
  const guardTimer = useRef<number | undefined>(undefined);
  const holdRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const onSearRef = useRef(onSear);
  useEffect(() => {
    onSearRef.current = onSear;
  }, [onSear]);

  // The hold length that reaches the fully seared look: the shipped default, or the Preview / DEV comparison value (?cookSearMs=).
  const fullMs = searFullMsOverride() ?? SEAR_FULL_MS;
  const holding = hold.status === "holding";
  const released = hold.status === "released";
  const startedAt = hold.status === "holding" ? hold.startedAt : null;

  // While the finger is down: repaint the colour from the held time. Nothing else runs; there is no time-out.
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setAmount(searAmountAt(nowMs() - startedAt, fullMs)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [startedAt, fullMs]);

  const close = useCallback(() => {
    dispatchHold({ type: "CANCEL" });
    setScreen(false);
    setAmount(0);
  }, []);

  // A kept result: tell the reducer once, show the words for a moment, then close with the guard up.
  const keptAmount = hold.status === "released" ? hold.amount : null;
  useEffect(() => {
    if (keptAmount === null) return;
    onSearRef.current(offered, keptAmount);
    const t = window.setTimeout(() => {
      close();
      setGuard(true);
      window.clearTimeout(guardTimer.current);
      guardTimer.current = window.setTimeout(() => setGuard(false), SEAR_GUARD_MS);
    }, SEAR_DONE_MS);
    return () => window.clearTimeout(t);
  }, [keptAmount, offered, close]);

  useEffect(() => () => window.clearTimeout(guardTimer.current), []);

  // Leaving the page / the app mid-hold discards the hold, and an open screen with it.
  useEffect(() => {
    if (!screen || released) return;
    const abort = () => close();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") close();
    };
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [screen, released, close]);

  const busy = screen || guard;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (screen) holdRef.current?.focus();
  }, [screen]);

  // The pill / done mark are the only things on the stage while the screen is closed; the screen itself covers the whole stage.
  const corner = useSearCorner(anchorRef, [screen, seared]);
  const placement = corner ? "corner" : undefined;

  const press = (stamp: number) => {
    setAmount(0);
    dispatchHold({ type: "PRESS", now: eventMoment(stamp) });
  };
  const release = (stamp: number) => {
    dispatchHold({ type: "RELEASE", now: eventMoment(stamp), fullMs });
  };

  if (!screen) {
    if (seared) {
      return (
        <>
          <span ref={anchorRef} className="cooking-sear-done" role="status" data-testid="cooking-sear-done" data-placement={placement}>
            ✓ 炙り済み
          </span>
          {guard && <div className="cooking-sear-guard" data-testid="cooking-sear-guard" />}
        </>
      );
    }
    const open = () => {
      dispatchHold({ type: "CANCEL" });
      setAmount(0);
      setScreen(true);
    };
    const onPillPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
      const startedHere = downOnPill.current;
      downOnPill.current = false;
      if (!startedHere) return;
      // Open only when the finger is released ON the pill, so a press that slides off it opens nothing.
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) open();
    };
    return (
      <>
        <button
          ref={anchorRef as RefObject<HTMLButtonElement>}
          type="button"
          className="cooking-sear-pill"
          data-testid="cooking-sear-pill"
          data-placement={placement}
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
          🔥 炙る
        </button>
        {guard && <div className="cooking-sear-guard" data-testid="cooking-sear-guard" />}
      </>
    );
  }

  const sausage = getIngredient(offered);
  // What is on screen is only ever what the finger is doing now (holding) or what was kept (released). An idle hold -- never started, cancelled by the
  // system (pointercancel), or a tap that was too short -- shows raw: the repaint `amount` is a leftover there, and showing it would paint a browning that
  // was never kept (#725 review, P2).
  const shownAmount = released ? hold.amount : holding ? amount : 0;
  const look = searLookOf(shownAmount);
  const mode = released ? "done" : holding ? "holding" : "idle";
  const title = released ? SEAR_LOOK_COPY[searLookOf(hold.amount)] : holding ? searHoldingTitle(shownAmount) : hold.status === "idle" && hold.tooShort ? "もう少し押し続けてね" : "押している間、焼き目がつくよ";

  const onHoldPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* a pointer that is already gone: the release below simply never comes, and pointercancel drops the hold */
    }
    press(event.nativeEvent.timeStamp);
  };
  const onHoldKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    press(event.nativeEvent.timeStamp);
  };
  const onHoldKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    release(event.nativeEvent.timeStamp);
  };

  return (
    <div className="cooking-sear" data-testid="cooking-sear" data-mode={mode} data-look={look} data-full-ms={fullMs} style={{ "--sear-heat": shownAmount.toFixed(3) } as CSSProperties}>
      <p className={`cooking-sear__title${released ? " cooking-sear__title--result" : ""}`} data-testid="cooking-sear-title">
        {title}
      </p>
      <div className="cooking-sear__plate">
        <span className="cooking-sear__glow" aria-hidden="true" />
        <span className="cooking-sear__flames" aria-hidden="true" data-testid="cooking-sear-flames">
          <i />
          <i />
          <i />
        </span>
        <span className="cooking-sear__smoke" aria-hidden="true" data-testid="cooking-sear-smoke">
          <i />
          <i />
          <i />
        </span>
        {sausage && (
          <span className={`cooking-sear__food ${SEARED_PIECE_CLASS}`} style={sausageSearStyle(shownAmount)} aria-hidden="true" data-testid="cooking-sear-food">
            <IngredientGlyph ingredient={sausage} />
            {/* Grill marks: a black copy of the same drawing, cut into diagonal bars by a mask, so the bars follow the sausage's own outline. Opacity = the browning. */}
            <span className="cooking-sear__marks" aria-hidden="true" data-testid="cooking-sear-marks">
              <IngredientGlyph ingredient={sausage} />
            </span>
          </span>
        )}
      </div>
      {released ? (
        <div className="cooking-sear__holdslot" aria-hidden="true" />
      ) : (
        <button
          type="button"
          ref={holdRef}
          className="cooking-sear__hold"
          data-testid="cooking-sear-hold"
          data-holding={holding ? "true" : "false"}
          aria-label={`長押しで炙る。押している間だけ焼き目がつき、離すと決まります。最大 ${Math.round(fullMs / 1000)} 秒で濃くなります`}
          onPointerDown={onHoldPointerDown}
          onPointerUp={(event) => release(event.nativeEvent.timeStamp)}
          onPointerCancel={() => dispatchHold({ type: "CANCEL" })}
          onBlur={() => dispatchHold({ type: "INTERRUPT" })}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={onHoldKeyDown}
          onKeyUp={onHoldKeyUp}
        >
          {holding ? "🔥 炙ってる…" : "🔥 長押しで炙る"}
        </button>
      )}
      <span className="cooking-sear-sr" role="status" aria-live="polite">
        {released ? title : holding ? "炙っています。離すと決まります" : "長押しで炙ります"}
      </span>
      {searFullMsOverride() !== null && (
        <span className="cooking-sear__tune" data-testid="cooking-sear-tune" aria-hidden="true">
          {Math.round(fullMs / 1000)}秒設定
        </span>
      )}
      <button type="button" className="cooking-sear__close" data-testid="cooking-sear-cancel" aria-label="やめる" onClick={close}>
        ×
      </button>
    </div>
  );
}
