import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  FOLD_LINE_Y,
  FOLD_SEAL_DEFAULT_RADIUS,
  FOLD_SEAL_TIMING,
  SEAL_BUTTON_STEPS,
  SEAM_BINS,
  circleGeometry,
  createInitialFoldSealState,
  foldSealReduce,
  foldSealVisual,
  sealCoverage,
  stepIsComplete,
  type FoldSealEvent,
  type FoldSealState,
} from "../../logic/foldSeal";
import {
  EMPTY_METRICS,
  NO_CONTACTS,
  addContact,
  canAdvance,
  clientToBox,
  recordLabEvent,
  removeContact,
  type Contacts,
  type LabMetrics,
} from "./labController";
import "./foldSealLab.css";

/**
 * FOLD+SEAL Lab (Issue #773 T6-F2): a stand-alone DEV experiment screen for the F1 pure state machine. NOT part of the game: it is opened from the Vite dev
 * server (foldseal-lab.html), is imported by nothing in the app, saves nothing, scores nothing and sends nothing. Drag gestures and buttons send the SAME
 * events to the SAME machine. Every threshold is provisional until the iPhone HV.
 */
const G = circleGeometry();
const R = FOLD_SEAL_DEFAULT_RADIUS;
const TOPPINGS: ReadonlyArray<readonly [number, number]> = [[30, 68], [50, 76], [70, 68], [40, 60], [60, 61], [24, 58], [76, 58]];

function seamPoint(phi: number): [number, number] {
  const a = Math.PI - phi;
  return [50 + R * Math.cos(a), 50 + R * Math.sin(a)];
}
function binPath(i: number): string {
  const [x0, y0] = seamPoint((i * Math.PI) / SEAM_BINS);
  const [x1, y1] = seamPoint(((i + 1) * Math.PI) / SEAM_BINS);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 0 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const BIN_PATHS = Array.from({ length: SEAM_BINS }, (_, i) => binPath(i));

function statusText(s: FoldSealState, advanced: boolean): string {
  if (advanced) return "つぎの工程へ進みました（ダミー）";
  if (s.phase === "folding") return "折っています… 離すと決まります";
  if (s.phase === "sealing") return "縁をとじています…";
  if (s.phase === "folded") {
    const pct = Math.round(sealCoverage(s) * 100);
    return pct === 0 ? "折れました。縁をなぞってとじましょう" : `縁を ${Math.round(pct / 25) * 25}% とじました`;
  }
  return "上の生地をつかんで、下へ引き下ろして折ります";
}

export function FoldSealLab() {
  const contactsRef = useRef<Contacts>(NO_CONTACTS);
  const metricsRef = useRef<LabMetrics>(EMPTY_METRICS);
  const hitRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<FoldSealState>(() => createInitialFoldSealState(0));
  const stateRef = useRef<FoldSealState>(state);
  const [contacts, setContacts] = useState<Contacts>(NO_CONTACTS);
  const [metrics, setMetrics] = useState<LabMetrics>(EMPTY_METRICS);
  const [advanced, setAdvanced] = useState(false);
  const [revision, setRevision] = useState(0);

  const send = useCallback((e: FoldSealEvent) => {
    const before = stateRef.current;
    const after = foldSealReduce(before, e, G);
    metricsRef.current = recordLabEvent(metricsRef.current, e, before, after, performance.now());
    stateRef.current = after;
    if (after !== before) setState(after);
    setMetrics(metricsRef.current);
  }, []);

  const setContactSet = useCallback((c: Contacts) => {
    contactsRef.current = c;
    setContacts(c);
  }, []);

  /** The active gesture's pointer, if any. A cancel of ANOTHER finger must not cancel it. */
  const activePointer = (): number | null => stateRef.current.grab?.pointerId ?? stateRef.current.seal.pointerId;

  const toBox = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = hitRef.current;
    return el ? clientToBox(el.getBoundingClientRect(), e.clientX, e.clientY) : null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setContactSet(addContact(contactsRef.current, e.pointerId));
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer that is already gone: the window-level cleanup below covers it */
    }
    const p = toBox(e);
    if (!p) return;
    const phase = stateRef.current.phase;
    if (phase === "idle") send({ type: "FOLD_DOWN", pointerId: e.pointerId, x: p.x, y: p.y });
    else if (phase === "folded") send({ type: "SEAL_DOWN", pointerId: e.pointerId, x: p.x, y: p.y });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = toBox(e);
    if (!p) return;
    const s = stateRef.current;
    if (s.phase === "folding") send({ type: "FOLD_MOVE", pointerId: e.pointerId, x: p.x, y: p.y });
    else if (s.phase === "sealing") send({ type: "SEAL_MOVE", pointerId: e.pointerId, x: p.x, y: p.y });
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    setContactSet(removeContact(contactsRef.current, e.pointerId));
    const s = stateRef.current;
    if (s.phase === "folding") send({ type: "FOLD_UP", pointerId: e.pointerId });
    else if (s.phase === "sealing") send({ type: "SEAL_UP", pointerId: e.pointerId });
  };
  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    setContactSet(removeContact(contactsRef.current, e.pointerId));
    if (activePointer() === e.pointerId) send({ type: "CANCEL" });
  };

  // Interruptions that the pointer events do not report: the page loses focus / is hidden / is resized or rotated. Everything in contact is dropped.
  useEffect(() => {
    const interrupt = () => {
      setContactSet(NO_CONTACTS);
      send({ type: "CANCEL" });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") interrupt();
    };
    window.addEventListener("blur", interrupt);
    window.addEventListener("resize", interrupt);
    window.addEventListener("orientationchange", interrupt);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", interrupt);
      window.removeEventListener("resize", interrupt);
      window.removeEventListener("orientationchange", interrupt);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [send, setContactSet]);

  const tryAdvance = () => {
    // Re-checked against the refs at click time: a second finger can tap this button while the first is still down.
    if (!canAdvance(stateRef.current, contactsRef.current.size)) {
      metricsRef.current = { ...metricsRef.current, advanceBlocked: metricsRef.current.advanceBlocked + 1 };
      setMetrics(metricsRef.current);
      return;
    }
    metricsRef.current = { ...metricsRef.current, advanceOk: metricsRef.current.advanceOk + 1 };
    setMetrics(metricsRef.current);
    setAdvanced(true);
  };

  const editUpstream = () => {
    // Simulates the player changing the dough / sauce / toppings: the fold and the seal are discarded.
    const next = revision + 1;
    setRevision(next);
    setAdvanced(false);
    send({ type: "INVALIDATE", revision: next });
  };

  const visual = useMemo(() => foldSealVisual(state), [state]);
  const dragging = state.phase === "folding";
  // The drawn lid follows the machine's angle. While dragging there is no easing (the edge sticks to the finger); otherwise a CSS transition (disabled by
  // prefers-reduced-motion in the stylesheet) eases the snap / spring-back / button fold. The machine state is never delayed by this.
  const cos = Math.cos(visual.foldAngle);
  const easeMs = dragging ? 0 : state.foldedVia === "button" ? FOLD_SEAL_TIMING.foldButtonMs : state.phase === "idle" ? FOLD_SEAL_TIMING.returnMs : FOLD_SEAL_TIMING.snapMs;
  const folded = state.phase === "folded" || state.phase === "sealing";
  const advanceEnabled = canAdvance(state, contacts.size);
  const gapBins = useMemo(() => {
    const set = new Set<number>();
    for (const g of visual.gaps) for (let i = g.from; i <= g.to; i += 1) set.add(i);
    return set;
  }, [visual.gaps]);

  return (
    <main className="fsl" data-testid="fsl-root" data-phase={state.phase} data-fold-angle={state.foldAngle.toFixed(4)} data-contacts={contacts.size} data-advanced={advanced ? "1" : "0"}>
      <header className="fsl__head">
        <h1>FOLD+SEAL Lab</h1>
        <p className="fsl__note">DEV 専用の実験画面。保存・採点・送信なし。ゲームには接続していません。</p>
      </header>

      <p className="fsl__status" role="status" aria-live="polite" data-testid="fsl-status">
        {statusText(state, advanced)}
      </p>

      <div className="fsl__stage" data-testid="fsl-stage">
        <svg className="fsl__svg" viewBox="0 0 100 100" aria-hidden="true">
          {/* the lower half only: the upper half is the lid, so it really leaves when the lid folds */}
          <path d={`M${50 - R} ${FOLD_LINE_Y} A${R} ${R} 0 0 0 ${50 + R} ${FOLD_LINE_Y} Z`} className="fsl__dough" />
          <path d={`M${50 - 40} ${FOLD_LINE_Y} A40 40 0 0 0 ${50 + 40} ${FOLD_LINE_Y} Z`} className="fsl__sauce" />
          {TOPPINGS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="5" className="fsl__topping" />
          ))}
          <line x1="2" y1={FOLD_LINE_Y} x2="98" y2={FOLD_LINE_Y} className="fsl__foldline" />
          <g className="fsl__lidg" style={{ transform: `scaleY(${cos.toFixed(4)})`, transitionDuration: `${easeMs}ms` }} data-testid="fsl-lid" data-lid-under={visual.foldAngle > Math.PI / 2 ? "1" : "0"}>
            <path d={`M${50 - R} ${FOLD_LINE_Y} A${R} ${R} 0 0 1 ${50 + R} ${FOLD_LINE_Y} Z`} className={visual.foldAngle > Math.PI / 2 ? "fsl__lid fsl__lid--under" : "fsl__lid"} />
          </g>
          {state.phase === "idle" || dragging ? <path d={`M${50 - 30} 14 A36 36 0 0 1 ${50 + 30} 14`} className="fsl__grabhint" /> : null}
          {folded
            ? BIN_PATHS.map((d, i) => (
                <path key={d} d={d} data-testid={`seam-bin-${i}`} data-sealed={visual.sealedBins[i]} data-gap={gapBins.has(i) ? "1" : "0"} className={visual.sealedBins[i] === 1 ? "fsl__bin fsl__bin--sealed" : gapBins.has(i) ? "fsl__bin fsl__bin--gap" : "fsl__bin"} />
              ))
            : null}
        </svg>
        <div ref={hitRef} className="fsl__hit" data-testid="fsl-hit" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />
      </div>

      <div className="fsl__buttons">
        <button type="button" className="fsl__btn" data-testid="btn-fold" disabled={state.phase !== "idle"} onClick={() => send({ type: "FOLD_BUTTON" })}>
          折る
        </button>
        <button type="button" className="fsl__btn" data-testid="btn-reopen" disabled={!folded} onClick={() => send({ type: "REOPEN" })}>
          あけなおす
        </button>
        <button type="button" className="fsl__btn" data-testid="btn-seal" disabled={state.phase !== "folded" || state.seal.buttonStep >= SEAL_BUTTON_STEPS} onClick={() => send({ type: "SEAL_BUTTON" })}>
          とじる（{state.seal.buttonStep}/{SEAL_BUTTON_STEPS}）
        </button>
        <button type="button" className="fsl__btn" data-testid="btn-seal-reset" disabled={state.phase !== "folded"} onClick={() => send({ type: "SEAL_RESET" })}>
          とじなおす
        </button>
        <button type="button" className="fsl__btn" data-testid="btn-skip" disabled={state.phase !== "folded"} onClick={() => send({ type: "SEAL_SKIP" })}>
          このままにする
        </button>
        <button type="button" className="fsl__btn" data-testid="btn-upstream" onClick={editUpstream}>
          前の工程を変える
        </button>
        <button type="button" className="fsl__btn fsl__btn--next" data-testid="btn-next" aria-disabled={!advanceEnabled} data-enabled={advanceEnabled ? "1" : "0"} onClick={tryAdvance}>
          つぎへ（ダミー）
        </button>
      </div>

      <details className="fsl__metrics">
        <summary>計測（画面内のみ）</summary>
        <dl data-testid="fsl-metrics">
          <dt>折り 触れた／つかみ外／短く離した／確定</dt>
          <dd>
            {metrics.foldTouches}／{metrics.foldGrabMisses}／{metrics.foldReleasedShort}／{metrics.foldCommits}
          </dd>
          <dt>初回で折れた／所要 ms</dt>
          <dd>
            {metrics.foldFirstTry === null ? "—" : metrics.foldFirstTry ? "はい" : "いいえ"}／{metrics.foldMs === null ? "—" : Math.round(metrics.foldMs)}
          </dd>
          <dt>封止 ストローク／帯外／やり直し／スキップ／全周 ms</dt>
          <dd>
            {metrics.sealStrokes}／{metrics.sealBandExits}／{metrics.sealResets}／{metrics.sealSkips}／{metrics.sealMs === null ? "—" : Math.round(metrics.sealMs)}
          </dd>
          <dt>ボタン 折る／とじる／中断／前工程変更</dt>
          <dd>
            {metrics.buttonFolds}／{metrics.buttonSeals}／{metrics.cancels}／{metrics.invalidates}
          </dd>
          <dt>つぎへ 通った／接触中でブロック</dt>
          <dd data-testid="fsl-advance-counts">
            {metrics.advanceOk}／{metrics.advanceBlocked}
          </dd>
          <dt>接触中の指／完了（stepIsComplete）</dt>
          <dd>
            {contacts.size}／{stepIsComplete(state) ? "はい" : "いいえ"}
          </dd>
        </dl>
      </details>
    </main>
  );
}
