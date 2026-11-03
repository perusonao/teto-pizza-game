import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { steamExperienceEnabled } from "../data/steamExperienceGate";
import { steamFullMsOverride, steamVariantChoice } from "../preview/steamPreview";
import { STEAM_LID_FULL_MS, STEAM_LID_IDLE, steamLidReducer } from "../logic/steam/steamLid";
import { steamOffer } from "../logic/steam/steamOffer";
import { steamPillNeedsCorner } from "../logic/steam/steamPillPlacement";
import { STEAM_SHELL_COUNT, type SteamVariant } from "../logic/steam/steamPot";
import { STEAM_DONE_MS, STEAM_GUARD_MS, STEAM_TICK_MS, steamAnnouncement, steamLidLive, steamShakeLive, steamShellOpen, steamTitle } from "../logic/steam/steamScreen";
import { STEAM_SHAKE_IDLE, steamShakeReducer } from "../logic/steam/steamShake";
import type { RoundKind } from "../state/roundKind";
import "./Steam.css";

interface SteamLayerProps {
  phase: string;
  makingStep: string;
  roundKind: RoundKind;
  /** The stage accepts input (same condition as `PizzaStage`'s `interactive`). */
  active: boolean;
  selectedIngredientId: string | null;
  ownedIngredientIds: readonly string[];
  /** `GameState.steamedLook`: its keys are the steamed ingredients. */
  steamedLook?: Readonly<Record<string, number>>;
  /** Any change of these closes a steam screen that is open (a step change / "やり直す" discards it, like an in-flight gesture). */
  makingStepToken: number;
  resetToken: number;
  /** Dispatches STEAM_INGREDIENT with the amount the pot kept (0..1). Called exactly once, when the lid is lifted after a real steam. */
  onSteam: (ingredientId: string, amount: number) => void;
  /** True while the steam screen (and the short guard after it) is up: GameScreen makes the dock inert meanwhile (the same busy state as the other treatments). */
  onBusyChange?: (busy: boolean) => void;
}

const nowMs = () => performance.now();

/** The event's own moment on the `performance.now()` clock; a stamp that is not finite / positive / within a minute of "now" is replaced by "now". */
function eventMoment(stamp: number): number {
  const now = nowMs();
  return Number.isFinite(stamp) && stamp > 0 && Math.abs(stamp - now) <= 60_000 ? stamp : now;
}

/**
 * Cooking Steam Phase 1 (Issue #726, S3): the optional "♨ 蒸す" treatment for clam / mussel, rendered INSIDE `.pizza-stage` after the dough.
 *
 *   clam / mussel selected -> [♨ 蒸す] pill -> steam screen: A) put the lid on, wait, lift it  /  B) shake the pot side to side (or tap ゆする), lift the lid
 *   -> the shells open one by one as the steam builds; lifting the lid keeps what they reached -> the words -> the screen closes, "✓ 蒸し済み"
 *
 * Optional (skip it and the round is unchanged); nothing is ever failed, graded or blocked. No gauge, bar, ring, number or countdown: the shells and the steam are
 * the only clues. Only the lifting of the lid reaches the reducer, once. Renders nothing while the experience is OFF (production), so the DOM is today's.
 * Independent of the 炒める prep and the 炙り sear.
 */
export function SteamLayer(props: SteamLayerProps) {
  const { phase, makingStep, roundKind, active, selectedIngredientId, ownedIngredientIds, steamedLook, makingStepToken, resetToken } = props;
  const offer = steamOffer({
    enabled: steamExperienceEnabled(),
    phase,
    makingStep,
    roundKind,
    active,
    selectedIngredientId,
    ownedIngredientIds,
    steamedIngredientIds: Object.keys(steamedLook ?? {}),
  });
  if (offer === null) return null;
  // The steam screen belongs to one (step, pizza, ingredient): any change remounts it, which discards it without dispatching anything.
  return <SteamOffer key={`${makingStepToken}:${resetToken}:${offer.ingredientId}`} {...props} offered={offer.ingredientId} done={offer.done} />;
}

/** Whether the pill / done mark must use the stage's corner (see ../logic/steam/steamPillPlacement.ts). Re-measured when the stage or the dough is resized. */
function useSteamCorner(anchor: RefObject<HTMLElement | null>, deps: readonly unknown[]): boolean {
  const [corner, setCorner] = useState(false);
  useLayoutEffect(() => {
    const el = anchor.current;
    const stage = el?.offsetParent as HTMLElement | null;
    const dough = stage?.querySelector<HTMLElement>(".pizza-dough") ?? null;
    if (!el || !stage || !dough) return;
    const measure = () => {
      const s = stage.getBoundingClientRect();
      const d = dough.getBoundingClientRect();
      setCorner(steamPillNeedsCorner({ left: s.left, top: s.top, right: s.right, bottom: s.bottom }, { left: d.left, top: d.top, right: d.right, bottom: d.bottom }));
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

/** Where each shell sits in the pot (viewBox 0 0 200 150): the back row of three, then the front row of two. They open in this order. */
const SHELL_SPOTS: readonly { x: number; y: number }[] = [
  { x: 64, y: 56 },
  { x: 100, y: 52 },
  { x: 136, y: 56 },
  { x: 82, y: 72 },
  { x: 118, y: 72 },
];

function Shell({ index, open }: { index: number; open: boolean }) {
  const spot = SHELL_SPOTS[index];
  return (
    <g className="cooking-steam__shell" transform={`translate(${spot.x} ${spot.y})`} data-open={open ? "true" : "false"} data-testid={`cooking-steam-shell-${index}`}>
      {/* The pop animation runs on THIS inner group: a CSS transform on the translated group above would replace its `transform` attribute and fling the shell to the pot's corner. */}
      <g className="cooking-steam__shell-pop">
        {/* closed: one domed valve with ridges */}
        <g className="cooking-steam__shell-closed">
          <path className="cooking-steam__shell-valve" d="M-14 4 Q-14 -11 0 -11 Q14 -11 14 4 Q0 9 -14 4 Z" />
          <path className="cooking-steam__shell-ridge" d="M-7 3 Q-6 -5 -3 -8 M0 4 L0 -9 M7 3 Q6 -5 3 -8" />
        </g>
        {/* open: the body shows between two valves */}
        <g className="cooking-steam__shell-open">
          <path className="cooking-steam__shell-valve" d="M-14 4 Q0 12 14 4 L12 0 Q0 6 -12 0 Z" />
          <ellipse className="cooking-steam__shell-body" cx="0" cy="-1" rx="10" ry="4.5" />
          <path className="cooking-steam__shell-valve" transform="translate(-3 -8) rotate(-32)" d="M-14 3 Q-14 -9 0 -9 Q14 -9 14 3 Q0 7 -14 3 Z" />
        </g>
      </g>
    </g>
  );
}

function SteamOffer(props: SteamLayerProps & { offered: string; done: boolean }) {
  const { offered, done, onSteam, onBusyChange } = props;

  const choice = steamVariantChoice();
  const [variant, setVariant] = useState<SteamVariant>(choice === "shake" ? "shake" : "lid");
  const [lid, dispatchLid] = useReducer(steamLidReducer, STEAM_LID_IDLE);
  const [shake, dispatchShake] = useReducer(steamShakeReducer, STEAM_SHAKE_IDLE);
  const [screen, setScreen] = useState(false);
  const [clock, setClock] = useState(0);
  const [guard, setGuard] = useState(false);
  const downOnPill = useRef(false);
  const guardTimer = useRef<number | undefined>(undefined);
  const potRef = useRef<HTMLDivElement>(null);
  const lidButtonRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const onSteamRef = useRef(onSteam);
  useEffect(() => {
    onSteamRef.current = onSteam;
  }, [onSteam]);

  // The lid-on time that opens every shell: the shipped default, or the Preview / DEV comparison value (?cookSteamMs=).
  const fullMs = steamFullMsOverride() ?? STEAM_LID_FULL_MS;
  const live = variant === "lid" ? steamLidLive(lid, clock || nowMs(), fullMs) : steamShakeLive(shake, clock || nowMs());
  const steaming = live.mode === "steaming";
  const finished = live.mode === "done";
  const startedLid = lid.status === "steaming";
  const tooShort = variant === "lid" ? lid.status === "idle" && lid.tooShort === true : shake.status === "idle" && shake.tooShort === true;

  // While steaming: repaint from the clock. Nothing else runs; there is no time-out.
  useEffect(() => {
    if (!steaming) return;
    const timer = window.setInterval(() => setClock(nowMs()), STEAM_TICK_MS);
    return () => window.clearInterval(timer);
  }, [steaming]);

  const close = useCallback(() => {
    dispatchLid({ type: "CANCEL" });
    dispatchShake({ type: "CANCEL" });
    setScreen(false);
    setClock(0);
  }, []);

  // A kept result: tell the reducer once, show the words for a moment, then close with the guard up.
  const kept = lid.status === "released" ? lid.result : shake.status === "released" ? shake.result : null;
  const keptAmount = kept === null ? null : kept.amount;
  useEffect(() => {
    if (keptAmount === null) return;
    onSteamRef.current(offered, keptAmount);
    const t = window.setTimeout(() => {
      close();
      setGuard(true);
      window.clearTimeout(guardTimer.current);
      guardTimer.current = window.setTimeout(() => setGuard(false), STEAM_GUARD_MS);
    }, STEAM_DONE_MS);
    return () => window.clearTimeout(t);
  }, [keptAmount, offered, close]);

  useEffect(() => () => window.clearTimeout(guardTimer.current), []);

  // Leaving the page / the app mid-steam discards it, and an open screen with it.
  useEffect(() => {
    if (!screen || finished) return;
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
  }, [screen, finished, close]);

  const busy = screen || guard;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (screen) lidButtonRef.current?.focus();
  }, [screen]);

  // The pill / done mark are the only things on the stage while the screen is closed; the screen itself covers the whole stage.
  const corner = useSteamCorner(anchorRef, [screen, done]);
  const placement = corner ? "corner" : undefined;

  const selectVariant = (next: SteamVariant) => {
    if (next === variant) return;
    dispatchLid({ type: "CANCEL" });
    dispatchShake({ type: "CANCEL" });
    setClock(0);
    setVariant(next);
  };

  if (!screen) {
    if (done) {
      return (
        <>
          <span ref={anchorRef} className="cooking-steam-done" role="status" data-testid="cooking-steam-done" data-placement={placement}>
            ✓ 蒸し済み
          </span>
          {guard && <div className="cooking-steam-guard" data-testid="cooking-steam-guard" />}
        </>
      );
    }
    const open = () => {
      dispatchLid({ type: "CANCEL" });
      dispatchShake({ type: "CANCEL" });
      setClock(0);
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
          className="cooking-steam-pill"
          data-testid="cooking-steam-pill"
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
          ♨ 蒸す
        </button>
        {guard && <div className="cooking-steam-guard" data-testid="cooking-steam-guard" />}
      </>
    );
  }

  const title = steamTitle(variant, live, tooShort);
  const onLidClick = (event: { nativeEvent: { timeStamp: number } }) => {
    dispatchLid(lid.status === "idle" ? { type: "CLOSE", now: eventMoment(event.nativeEvent.timeStamp) } : { type: "OPEN", now: eventMoment(event.nativeEvent.timeStamp), fullMs });
    setClock(nowMs());
  };
  const onShakeTap = (event: { nativeEvent: { timeStamp: number } }) => {
    dispatchShake({ type: "TAP", now: eventMoment(event.nativeEvent.timeStamp) });
    setClock(nowMs());
  };
  const onOpen = (event: { nativeEvent: { timeStamp: number } }) => {
    dispatchShake({ type: "OPEN", now: eventMoment(event.nativeEvent.timeStamp) });
    setClock(nowMs());
  };
  const onPotPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* a pointer that is already gone: nothing more arrives and pointercancel (if any) just ends the drag */
    }
  };
  const onPotPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (variant !== "shake" || finished || event.buttons === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dispatchShake({ type: "MOVE", now: eventMoment(event.nativeEvent.timeStamp), x: event.clientX - rect.left, width: rect.width });
  };
  const onPotKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Keyboard shake: the two arrow keys are the two directions of the sweep.
    if (variant !== "shake" || finished || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    dispatchShake({ type: "MOVE", now: eventMoment(event.nativeEvent.timeStamp), x: event.key === "ArrowLeft" ? 0 : rect.width, width: rect.width });
  };

  const lidLabel = lid.status === "idle" ? "♨ ふたをする" : "ふたを開ける";
  const heat = live.level.toFixed(3);
  return (
    <div
      className="cooking-steam"
      data-testid="cooking-steam"
      data-variant={variant}
      data-mode={live.mode}
      data-look={live.look}
      data-open-count={live.openCount}
      data-ingredient={offered}
      data-full-ms={fullMs}
      style={{ "--steam-heat": heat } as CSSProperties}
    >
      <p className={`cooking-steam__title${finished ? " cooking-steam__title--result" : ""}`} data-testid="cooking-steam-title">
        {title}
      </p>
      {choice === "both" && (
        <div className="cooking-steam__variants" role="group" aria-label="蒸し方">
          <button type="button" className="cooking-steam__variant" data-testid="cooking-steam-variant-lid" aria-pressed={variant === "lid"} disabled={steaming || finished} onClick={() => selectVariant("lid")}>
            ふた
          </button>
          <button type="button" className="cooking-steam__variant" data-testid="cooking-steam-variant-shake" aria-pressed={variant === "shake"} disabled={steaming || finished} onClick={() => selectVariant("shake")}>
            ゆすり
          </button>
        </div>
      )}
      <div
        ref={potRef}
        className="cooking-steam__pot"
        data-testid="cooking-steam-pot"
        data-lid={variant === "lid" && startedLid ? "on" : "off"}
        tabIndex={variant === "shake" ? 0 : -1}
        aria-label={variant === "shake" ? "鍋。左右になぞるか左右の矢印キーでゆすれます" : "鍋"}
        onPointerDown={variant === "shake" ? onPotPointerDown : undefined}
        onPointerMove={variant === "shake" ? onPotPointerMove : undefined}
        onKeyDown={variant === "shake" ? onPotKeyDown : undefined}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="cooking-steam__puffs" aria-hidden="true" data-testid="cooking-steam-puffs">
          <i />
          <i />
          <i />
        </span>
        <svg className="cooking-steam__svg" viewBox="0 0 200 150" aria-hidden="true" focusable="false">
          <path className="cooking-steam__handle" d="M22 70 H8 Q4 70 4 74 V80 Q4 84 8 84 H24 M178 70 H192 Q196 70 196 74 V80 Q196 84 192 84 H176" />
          <path className="cooking-steam__body" d="M24 62 H176 V108 Q176 140 144 140 H56 Q24 140 24 108 Z" />
          <ellipse className="cooking-steam__inside" cx="100" cy="62" rx="76" ry="26" />
          <ellipse className="cooking-steam__water" cx="100" cy="66" rx="68" ry="20" />
          {Array.from({ length: STEAM_SHELL_COUNT }, (_, i) => (
            <Shell key={i} index={i} open={steamShellOpen(i, live.openCount)} />
          ))}
          <ellipse className="cooking-steam__rim" cx="100" cy="62" rx="76" ry="26" />
          {variant === "lid" && (
            <g className="cooking-steam__lid" data-testid="cooking-steam-lid">
              <path className="cooking-steam__lid-glass" d="M28 62 Q28 10 100 10 Q172 10 172 62 Q100 78 28 62 Z" />
              <circle className="cooking-steam__lid-knob" cx="100" cy="10" r="6" />
            </g>
          )}
        </svg>
      </div>
      {finished ? (
        <div className="cooking-steam__controls cooking-steam__controls--slot" aria-hidden="true" />
      ) : variant === "lid" ? (
        <div className="cooking-steam__controls">
          <button ref={lidButtonRef} type="button" className="cooking-steam__button cooking-steam__button--main" data-testid="cooking-steam-lid-button" data-step={lid.status === "idle" ? "close" : "open"} onClick={onLidClick}>
            {lidLabel}
          </button>
        </div>
      ) : (
        <div className="cooking-steam__controls cooking-steam__controls--pair">
          <button ref={lidButtonRef} type="button" className="cooking-steam__button" data-testid="cooking-steam-shake" onClick={onShakeTap} aria-label="ゆする。鍋を左右になぞる代わりにタップします">
            ← ゆする →
          </button>
          <button type="button" className="cooking-steam__button cooking-steam__button--main" data-testid="cooking-steam-open" disabled={shake.status !== "steaming"} onClick={onOpen}>
            ふたを開ける
          </button>
        </div>
      )}
      <span className="cooking-steam-sr" role="status" aria-live="polite">
        {steamAnnouncement(variant, live)}
      </span>
      {steamFullMsOverride() !== null && variant === "lid" && (
        <span className="cooking-steam__tune" data-testid="cooking-steam-tune" aria-hidden="true">
          {(fullMs / 1000).toFixed(1)}秒設定
        </span>
      )}
      <button type="button" className="cooking-steam__close" data-testid="cooking-steam-cancel" aria-label="やめる" onClick={close}>
        ×
      </button>
    </div>
  );
}
