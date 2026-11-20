import { useEffect, useReducer } from "react";
import { MID_BAKE_LAB_LABEL, MID_BAKE_LAB_MARK, resolveMidBakeLabHoldMs, resolveMidBakeLabStock } from "../../preview/midBakeLab";
import { BAKE_DURATION_S } from "../../logic/bakeProgress";
import { labClockPositionPct } from "../../logic/midBake/labClock";
import { DEFAULT_MID_BAKE_WINDOW } from "../../logic/midBake/midBakeTiming";
import { LAB_DOUGH_CENTER, LAB_DOUGH_RADIUS } from "./labPlacement";
import {
  LAB_BAKE_TARGET,
  createLabSession,
  labCanAdd,
  labCanClose,
  labCanTakeOut,
  labRemainingStock,
  labSessionReducer,
  type LabConfig,
  type LabSession,
} from "./labSession";
import "./midBakeLab.css";

/**
 * MID_BAKE Lab (stage C-2; Preview / DEV only, `?cookMidBakeHv=1`, see ../../preview/midBakeLab.ts). A standalone screen: a bake gauge with the
 * addition window, a mock pizza, one tray chip, a close button and a take-out button. It imports NOTHING from the game's state, reducer,
 * inventory, persistence or normal BAKE and writes nothing anywhere: the whole round lives in this component's state and is gone on reload.
 *
 * Time only advances while the page is visible and focused (the same rule as the normal BAKE), and the clock itself limits one frame (C-1).
 */

export interface LabTiming {
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
}

const REAL_TIMING: LabTiming = {
  now: () => performance.now(),
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
};

const WINDOW_START_PCT = DEFAULT_MID_BAKE_WINDOW.start * 100;
const WINDOW_END_PCT = DEFAULT_MID_BAKE_WINDOW.end * 100;

export interface MidBakeLabProps {
  /** Lab knobs. Absent: read from the query string (the Lab's own optional parameters), else the defaults. */
  config?: Partial<LabConfig>;
  /** Injectable frame source for tests. Absent: the real clock. */
  timing?: LabTiming;
}

function configFromQuery(): Partial<LabConfig> {
  if (typeof window === "undefined") return {};
  const search = window.location.search;
  const holdMs = resolveMidBakeLabHoldMs(search);
  return { stock: resolveMidBakeLabStock(search), ...(holdMs === null ? {} : { holdTimeoutMs: holdMs }) };
}

function statusText(session: LabSession): string {
  if (session.phase === "ready") return "「焼きはじめる」で始めよう";
  if (session.phase === "finished") return "おしまい。結果を見よう";
  if (session.clock.status === "holding") {
    return labCanAdd(session) ? `針が止まった。納豆をタップして足そう（のこり ${labRemainingStock(session)}）` : "針が止まった。「とじる」で再開できる";
  }
  return "焼いています";
}

export function MidBakeLab({ config, timing = REAL_TIMING }: MidBakeLabProps) {
  const [session, dispatch] = useReducer(labSessionReducer, undefined, () => createLabSession({ ...configFromQuery(), ...config }));
  const baking = session.phase === "baking";
  const holding = baking && session.clock.status === "holding";

  useEffect(() => {
    if (!baking) return;
    const t = timing;
    let last = t.now();
    let hidden = typeof document !== "undefined" && document.hidden;
    let blurred = false;
    let handle = 0;
    const paused = () => hidden || blurred;
    const resume = () => {
      last = t.now(); // time away is never counted
    };
    const onVisibility = () => {
      const wasPaused = paused();
      hidden = document.hidden;
      if (wasPaused && !paused()) resume();
    };
    const onBlur = () => {
      blurred = true;
    };
    const onFocus = () => {
      const wasPaused = paused();
      blurred = false;
      if (wasPaused && !paused()) resume();
    };
    const frame = () => {
      const current = t.now();
      if (!paused()) dispatch({ type: "FRAME", dtMs: current - last });
      last = current;
      handle = t.requestFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    handle = t.requestFrame(frame);
    return () => {
      t.cancelFrame(handle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [baking, timing]);

  const position = Math.min(100, Math.max(0, labClockPositionPct(session.clock)));
  const result = session.result;
  const remaining = labRemainingStock(session);

  return (
    <main className="mid-bake-lab__root" data-testid="mb-lab" data-mark={MID_BAKE_LAB_MARK} data-phase={session.phase} data-clock={session.clock.status}>
      <p className="mid-bake-lab__note" role="note">
        {MID_BAKE_LAB_LABEL}
      </p>

      <div className="mid-bake-lab__gauge" data-testid="mb-gauge" aria-hidden="true">
        <div className="mid-bake-lab__target" style={{ left: `${LAB_BAKE_TARGET.start}%`, width: `${LAB_BAKE_TARGET.end - LAB_BAKE_TARGET.start}%` }} />
        <div className="mid-bake-lab__window" data-testid="mb-window" style={{ left: `${WINDOW_START_PCT}%`, width: `${WINDOW_END_PCT - WINDOW_START_PCT}%` }} />
        <div className="mid-bake-lab__needle" data-testid="mb-needle" data-position={position.toFixed(1)} style={{ left: `${position}%` }} />
      </div>
      <p className="mid-bake-lab__legend">濃い帯＝追加の窓（{WINDOW_START_PCT}〜{WINDOW_END_PCT}）／うす帯＝Lab用の仮の取り出し目標（{BAKE_DURATION_S}秒の焼き）</p>

      <p className="mid-bake-lab__status" role="status" aria-live="polite" data-testid="mb-status" data-hold={holding ? "1" : "0"}>
        {statusText(session)}
      </p>

      <svg className="mid-bake-lab__pizza" viewBox="0 0 100 100" role="img" aria-label="ピザ" data-testid="mb-pizza">
        <circle cx={LAB_DOUGH_CENTER.x} cy={LAB_DOUGH_CENTER.y} r={LAB_DOUGH_RADIUS + 4} className="mid-bake-lab__crust" />
        <circle cx={LAB_DOUGH_CENTER.x} cy={LAB_DOUGH_CENTER.y} r={LAB_DOUGH_RADIUS} className="mid-bake-lab__dough" />
        {session.pieces.map((piece) => (
          <circle key={piece.id} cx={piece.at.x} cy={piece.at.y} r={5} className="mid-bake-lab__piece" data-testid="mb-piece" data-input={piece.input} />
        ))}
      </svg>

      <div className="mid-bake-lab__tray">
        <button
          type="button"
          className="mid-bake-lab__chip"
          data-testid="mb-chip-natto"
          disabled={!labCanAdd(session)}
          aria-label={`納豆を1つ足す（のこり ${remaining}）`}
          onClick={() => dispatch({ type: "ADD", input: "direct" })}
        >
          🫘 納豆 <span data-testid="mb-count">{remaining}</span>
        </button>
        <button type="button" className="mid-bake-lab__button" data-testid="mb-close" disabled={!labCanClose(session)} onClick={() => dispatch({ type: "CLOSE" })}>
          とじる
        </button>
      </div>

      <div className="mid-bake-lab__actions">
        {session.phase === "ready" ? (
          <button type="button" className="mid-bake-lab__primary" data-testid="mb-start" onClick={() => dispatch({ type: "START" })}>
            焼きはじめる
          </button>
        ) : (
          <button
            type="button"
            className="mid-bake-lab__primary"
            data-testid="mb-takeout"
            aria-disabled={!labCanTakeOut(session)}
            disabled={session.phase === "finished"}
            onClick={() => dispatch({ type: "TAKE_OUT" })}
          >
            とりだす
          </button>
        )}
        <button type="button" className="mid-bake-lab__button" data-testid="mb-restart" onClick={() => dispatch({ type: "RESTART" })}>
          やりなおす
        </button>
      </div>

      <details className="mid-bake-lab__alt">
        <summary>別の操作方法を使う</summary>
        <button type="button" className="mid-bake-lab__button" data-testid="mb-alt-add" disabled={!labCanAdd(session)} onClick={() => dispatch({ type: "ADD", input: "alternative" })}>
          納豆を1つ足す（代替操作）
        </button>
      </details>

      {result ? (
        <section className="mid-bake-lab__result" data-testid="mb-result" data-completion={result.completion} data-bake={result.bake}>
          <h2>結果</h2>
          <ul>
            <li>追加: {result.completion === "complete" ? "そろった" : "不足"}（{result.additions} 個）</li>
            <li>取り出し: {result.takeOutPct === null ? "自動（焼きすぎ）" : `${Math.round(result.takeOutPct)}%`}／仮の判定 {result.bake}</li>
            <li>在庫: {result.consumed} 消費（のこり {remaining}）</li>
            <li>停止: {result.holdMs} ms／再開の理由 {result.releasedBy ?? "なし"}</li>
            <li>止まっている間に取り出そうとした回数: {session.blockedTakeOuts}／拒否された追加: {session.rejectedAdds}</li>
          </ul>
        </section>
      ) : null}

      <ol className="mid-bake-lab__log" data-testid="mb-log" aria-label="記録">
        {session.log.slice(-6).map((entry) => (
          <li key={entry.seq} data-kind={entry.kind}>
            {entry.atMs.toFixed(0)}ms {entry.text}
          </li>
        ))}
      </ol>
    </main>
  );
}
