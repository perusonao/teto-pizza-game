import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  STEAM_GAME_IDLE,
  STEAM_GAME_LAB_LABEL,
  STEAM_GAME_LAB_MARK,
  STEAM_GAME_OVER_LIMIT,
  STEAM_GAME_RESULT_COPY,
  fleshLook,
  shellOpenness,
  steamGameAdvance,
  steamGameReducer,
  steamGameSnapshot,
  type SteamGameHeat,
} from "./steamGameLab";
import "./steamGameLab.css";
import { SteamGameLabV2 } from "./SteamGameLabV2";
import { SteamGameLabV3 } from "./SteamGameLabV3";

/**
 * Issue #755 S5b: the Steam Gameplay Lab screen (Preview / DEV only, see ./steamGameLab.ts). Tap-only: 弱火 / 強火 / ふたを開ける / やり直す.
 * It owns a tiny in-memory reducer and an animation clock; nothing is stored, dispatched to the game or scored. No numeric gauge or timer is shown:
 * the player reads the shells, the steam and the flesh.
 */
const SHELL_POS: ReadonlyArray<readonly [number, number]> = [[100, 192], [150, 192], [200, 192], [125, 230], [175, 230]];
const RETRY_GUARD_MS = 400; // a double tap on 「ふたを開ける」 must not also hit the button that takes its place
const WISP_X = [96, 134, 172, 210];

function Flames({ heat }: { heat: SteamGameHeat }) {
  const n = heat === "high" ? 5 : 3;
  const h = heat === "high" ? 38 : 18;
  const xs = Array.from({ length: n }, (_, i) => 150 + (i - (n - 1) / 2) * (heat === "high" ? 30 : 28));
  return (
    <g data-testid="sgl-flames" data-heat={heat}>
      {xs.map((x, i) => (
        <path key={i} className="sgl__flame" style={{ animationDelay: `${i * 70}ms` }} d={`M${x - 9} 292 Q${x - 11} ${292 - h * 0.5} ${x} ${292 - h} Q${x + 11} ${292 - h * 0.5} ${x + 9} 292 Z`} fill={heat === "high" ? "#ff7a1a" : "#5fb4ff"} />
      ))}
    </g>
  );
}

function Shell({ i, open, flesh, limp }: { i: number; open: number; flesh: { color: string; scale: number }; limp: number }) {
  const [cx, cy] = SHELL_POS[i];
  const shellColor = `rgb(${Math.round(207 - 60 * limp)},${Math.round(143 - 30 * limp)},${Math.round(124 - 30 * limp)})`;
  const s = Math.max(0.2, flesh.scale) * open;
  return (
    <g data-shell={i} data-open={open.toFixed(2)} transform={`translate(${cx} ${cy}) scale(1.35)`}>
      <path d="M-13 0 Q0 15 13 0 Z" fill={shellColor} stroke="#6b4033" strokeWidth="1.2" />
      <ellipse className="sgl__flesh" cx="0" cy="-1.5" rx={10 * s} ry={7 * s} fill={flesh.color} />
      <path className="sgl__half" d="M-13 0 Q0 -15 13 0 Z" fill={shellColor} stroke="#6b4033" strokeWidth="1.2" style={{ transform: `rotate(${-58 * open}deg)`, transformOrigin: "-13px 0px" }} />
    </g>
  );
}

function SteamGameLabV1({ clock = () => performance.now() }: { clock?: () => number }) {
  const [state, dispatch] = useReducer(steamGameReducer, STEAM_GAME_IDLE);
  const [now, setNow] = useState(() => clock());
  const releasedAt = useRef(0);
  const [runKey, setRunKey] = useState(0);

  // Repaint while cooking only; the model is advanced from timestamps, never from the number of frames.
  useEffect(() => {
    if (state.status !== "cooking") return;
    let raf = 0;
    const tick = () => {
      setNow(clock());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.status, clock]);

  // Leaving the page or hiding the tab discards a cook in progress (no hidden cooking, no phantom result).
  useEffect(() => {
    const drop = () => dispatch({ type: "INTERRUPT" });
    const onVis = () => {
      if (document.visibilityState === "hidden") drop();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", drop);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", drop);
    };
  }, []);

  const start = useCallback(() => {
    setRunKey((k) => k + 1);
    dispatch({ type: "START", now: clock() });
  }, [clock]);
  const setHeat = (heat: SteamGameHeat) => dispatch({ type: "SET_HEAT", heat, now: clock() });
  const open = () => {
    releasedAt.current = clock();
    dispatch({ type: "OPEN", now: releasedAt.current });
  };
  const again = () => {
    if (clock() - releasedAt.current < RETRY_GUARD_MS) return;
    dispatch({ type: "RETRY" });
    start();
  };
  const reset = () => dispatch(state.status === "cooking" ? { type: "INTERRUPT" } : { type: "RETRY" });

  const t = state.status === "cooking" ? now : 0;
  const snap = steamGameSnapshot(state, t);
  const over = state.status === "cooking" ? steamGameAdvance(state, t).over : state.status === "released" ? state.result.over : 0;
  const overFrac = Math.min(1, over / STEAM_GAME_OVER_LIMIT);
  const openness = shellOpenness(snap.level);
  const flesh = fleshLook(snap.level, state.status === "released" && state.result.outcome !== "overcooked" ? 0 : overFrac);
  const cooking = state.status === "cooking";
  const heat: SteamGameHeat = cooking ? state.heat : "low";
  const outcome = snap.outcome;
  const wisps = cooking ? Math.min(4, Math.ceil(snap.level / 0.2) + (heat === "high" ? 1 : 0)) : 0;
  const msg = outcome ? STEAM_GAME_RESULT_COPY[outcome] : cooking ? "貝の開きを見て、ふたを開けよう" : "ふたをして蒸そう";

  return (
    <main className="sgl" data-lab={STEAM_GAME_LAB_MARK} data-status={state.status} data-heat={cooking ? heat : "off"}>
      <header className="sgl__head">
        <h1 className="sgl__title">蒸しミニゲーム</h1>
        <span className="sgl__label" role="note">{STEAM_GAME_LAB_LABEL}</span>
      </header>

      <div className="sgl__scene">
        <svg className="sgl__svg" viewBox="10 -20 280 330" role="img" aria-label="貝を蒸している鍋" data-testid="sgl-scene" data-outcome={outcome ?? "none"} data-open-count={snap.openCount}>
          {cooking && <Flames heat={heat} />}
          <rect x="36" y="168" width="14" height="14" rx="5" fill="#9aa5ae" />
          <rect x="250" y="168" width="14" height="14" rx="5" fill="#9aa5ae" />
          <rect x="50" y="130" width="200" height="132" rx="16" fill="#5b6570" stroke="#c9d1d8" strokeWidth="2" />
          <rect x="62" y="146" width="176" height="98" rx="8" fill="#2a2622" />
          {SHELL_POS.map((_, i) => (
            <Shell key={i} i={i} open={openness[i]} flesh={flesh} limp={flesh.limp} />
          ))}
          <rect x="44" y="124" width="212" height="10" rx="5" fill="#aab4bd" />
          <g className="sgl__lid" data-lid={state.status === "cooking" ? "on" : "off"} data-heat={cooking ? heat : "off"} data-testid="sgl-lid">
            <path d="M52 124 Q150 44 248 124 Z" fill="#8d98a3" stroke="#d3dae0" strokeWidth="2" />
            <circle cx="150" cy="70" r="8" fill="#6c7782" />
          </g>
          {WISP_X.map((x, i) => (
            <path key={i} className="sgl__wisp" data-on={i < wisps} data-heat={heat} data-over={overFrac > 0.5} data-testid={`sgl-wisp-${i}`} style={{ animationDelay: `${i * 160}ms` }} d={`M${x} 100 q8 -9 0 -18 q-8 -9 0 -18`} />
          ))}
          {state.status === "released" && (
            <g key={runKey} className="sgl__burst" style={{ transformOrigin: "150px 110px" }} data-testid="sgl-burst">
              <circle cx="120" cy="108" r="18" fill="#fffaf0" opacity="0.8" />
              <circle cx="152" cy="96" r="24" fill="#fffaf0" opacity="0.8" />
              <circle cx="184" cy="108" r="18" fill="#fffaf0" opacity="0.8" />
            </g>
          )}
        </svg>
      </div>

      <p className="sgl__msg" role="status" aria-live="polite" data-outcome={outcome ?? "none"}>{msg}</p>

      <div className="sgl__ctl">
        <button type="button" className="sgl__btn sgl__btn--low" aria-pressed={cooking && heat === "low"} disabled={!cooking} onClick={() => setHeat("low")}>弱火</button>
        <button type="button" className="sgl__btn sgl__btn--high" aria-pressed={cooking && heat === "high"} disabled={!cooking} onClick={() => setHeat("high")}>強火</button>
        {state.status === "idle" && <button type="button" className="sgl__btn sgl__btn--primary" onClick={start}>ふたをして蒸す</button>}
        {cooking && <button type="button" className="sgl__btn sgl__btn--primary" onClick={open}>ふたを開ける</button>}
        {state.status === "released" && <button type="button" className="sgl__btn sgl__btn--primary" onClick={again}>もう一度蒸す</button>}
        <button type="button" className="sgl__btn sgl__btn--ghost" disabled={state.status === "idle"} onClick={reset}>やり直す</button>
      </div>
    </main>
  );
}

/** Keep the published V1 at ?steamGameLab=on. V2 is an explicitly opted-in sibling,
 * not a replacement for the iPhone-evaluated build. main.tsx and #746 stay untouched. */
export function SteamGameLab({ clock = () => performance.now() }: { clock?: () => number }) {
  const args = typeof window === "undefined" ? [] : new URLSearchParams(window.location.search).getAll("steamGameMode");
  if (args.length === 1 && args[0] === "v2") return <SteamGameLabV2 clock={clock} />;
  // V3 (#755, design docs/reports/TETO_STEAM-V3_DESIGN.md) is a third, explicitly opted-in sibling; V1 and V2 are unchanged.
  if (args.length === 1 && args[0] === "v3") return <SteamGameLabV3 clock={clock} />;
  return <SteamGameLabV1 clock={clock} />;
}
