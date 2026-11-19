import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import {
  STEAM_V2_BATCHES,
  STEAM_V2_IDLE,
  steamV2Reducer,
  steamV2Snapshot,
  type SteamV2Batch,
  type SteamV2Heat,
  type SteamV2ShellStatus,
} from "./steamGameLabRescue";
import "./steamGameLab.css";
import "./steamGameLabV2.css";

/** #755 V2, a tap-only standalone Lab behind ?steamGameLab=on&steamGameMode=v2. */
const SHELL_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [68, 170], [150, 170], [232, 170], [108, 224], [192, 224],
];
const RETRY_GUARD_MS = 400;

const LOOK: Record<SteamV2ShellStatus, { shell: string; flesh: string; name: string }> = {
  closed: { shell: "#c5b7ab", flesh: "#e9e2d9", name: "まだ閉じている" },
  ready: { shell: "#d19d7a", flesh: "#ffb340", name: "ふっくら・取り出せる" },
  over: { shell: "#7d6962", flesh: "#785647", name: "縮んでしまった" },
  rescued: { shell: "#588a6d", flesh: "#ffe6a0", name: "ふっくら取り出した" },
  missed: { shell: "#777879", flesh: "#c5c2bd", name: "取り出し損ねた" },
};

function Shell({
  index, status, size, label, cooking, onPick,
}: {
  index: number;
  status: SteamV2ShellStatus;
  size: number;
  label: string;
  cooking: boolean;
  onPick: (index: number) => void;
}) {
  const [x, y] = SHELL_SPOTS[index];
  const look = LOOK[status];
  const opened = status !== "closed";
  const active = cooking && status !== "rescued" && status !== "over";
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (!active) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick(index);
    }
  };
  return (
    <g
      transform={`translate(${x} ${y})`}
      data-testid={`sgl-v2-shell-${index}`}
      data-shell-state={status}
      data-shell-size={label}
      role="button"
      tabIndex={active ? 0 : -1}
      aria-disabled={!active}
      aria-label={`貝${index + 1}（${label}）：${look.name}`}
      onClick={() => active && onPick(index)}
      onKeyDown={onKeyDown}
      className="sglv2__shell-button"
    >
      {/* 58px SVG hit area; the real touch target is measured in the phone E2E. */}
      <rect x="-29" y="-27" width="58" height="54" fill="transparent" pointerEvents="all" />
      {status === "rescued" ? (
        <>
          <circle r="19" fill="#2f7956" stroke="#a3e8aa" strokeWidth="2" />
          <text textAnchor="middle" y="8" fontSize="25" fontWeight="bold" fill="white">✓</text>
        </>
      ) : (
        <g transform={`scale(${size})`} className="sglv2__shell" data-ready={status === "ready"}>
          <path d="M-19 5 Q0 20 19 5 L17 0 Q0 10 -17 0 Z" fill={look.shell} stroke="#563e31" strokeWidth="1.8" />
          <ellipse cx="0" cy="-2" rx={opened ? (status === "over" ? 9 : 16) : 8} ry={opened ? (status === "over" ? 5 : 9) : 5} fill={look.flesh} />
          <path d="M-19 4 Q0 -18 19 4 Z" fill={look.shell} stroke="#563e31" strokeWidth="1.8"
            style={{ transform: opened ? "rotate(-48deg)" : "none", transformOrigin: "-19px 4px" }} />
          {status === "ready" && <circle cx="21" cy="-16" r="5" fill="#ffe66b" className="sglv2__spark" />}
          {status === "over" && <path d="M-10 4 L8 -4 M-7 -6 L12 6" stroke="#564d4a" strokeWidth="1.5" />}
        </g>
      )}
      <text textAnchor="middle" y="29" fontSize="10.5" fill="#fff8e9" aria-hidden="true">{index + 1}</text>
    </g>
  );
}

export function SteamGameLabV2({ clock = () => performance.now() }: { clock?: () => number }) {
  const [state, dispatch] = useReducer(steamV2Reducer, STEAM_V2_IDLE);
  const [batch, setBatch] = useState<SteamV2Batch>("clam");
  const [now, setNow] = useState(() => clock());
  const [notice, setNotice] = useState("");
  const lastRelease = useRef(Number.NEGATIVE_INFINITY);
  const cooking = state.status === "cooking";

  useEffect(() => {
    if (!cooking) return;
    let raf = 0;
    const tick = () => {
      setNow(clock());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, cooking]);

  useEffect(() => {
    const interrupt = () => dispatch({ type: "INTERRUPT" });
    const visibility = () => {
      if (document.visibilityState === "hidden") interrupt();
    };
    window.addEventListener("pagehide", interrupt);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", interrupt);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const snap = steamV2Snapshot(state, cooking ? now : 0);
  const heat: SteamV2Heat = cooking ? state.heat : "low";
  const shellSpecs = STEAM_V2_BATCHES[batch].shells;

  const start = () => {
    setNotice("");
    dispatch({ type: "START", now: clock(), batch });
  };
  const reset = () => {
    setNotice("");
    dispatch({ type: "RESET" });
  };
  const again = () => {
    if (clock() - lastRelease.current < RETRY_GUARD_MS) return;
    reset();
    dispatch({ type: "START", now: clock(), batch });
  };
  const chooseBatch = (next: SteamV2Batch) => {
    if (cooking) return;
    setBatch(next);
    if (state.status === "released") reset();
  };
  const setHeat = (next: SteamV2Heat) => dispatch({ type: "SET_HEAT", heat: next, now: clock() });
  const pick = (index: number) => {
    if (!cooking) return;
    const current = steamV2Snapshot(state, clock()).shells[index];
    if (current === "closed") {
      setNotice("まだ閉じているよ。開いたらタップ！");
      return;
    }
    if (current === "over") {
      setNotice("その貝は蒸しすぎ！次の貝を見よう");
      return;
    }
    if (current !== "ready") return;
    setNotice(`貝${index + 1}をふっくら取り出した！`);
    dispatch({ type: "PICK", index, now: clock() });
  };
  const open = () => {
    lastRelease.current = clock();
    dispatch({ type: "OPEN", now: lastRelease.current });
  };
  const msg = state.status === "released"
    ? state.result.verdict === "perfect"
      ? "大成功！5個ともふっくら！"
      : `${state.result.rescuedCount}/5個ふっくら！次はもっと救おう`
    : cooking
      ? notice || (snap.rescuedCount === 5
        ? "全部救えた！ふたを開けよう"
        : snap.readyCount > 0
          ? "橙色の貝をタップして取り出そう！"
          : "貝の開きを見ながら火加減を調整")
      : "開いた貝をタップで取り出そう！";

  return (
    <main className="sgl sglv2" data-lab="steam-game-lab-v2" data-status={state.status} data-batch={batch}>
      <header className="sgl__head">
        <h1 className="sgl__title">蒸しミニゲーム V2</h1>
        <span className="sgl__label" role="note">試作・保存されません</span>
      </header>
      <div className="sglv2__batch" role="group" aria-label="貝の種類">
        {(["clam", "mussel"] as const).map((name) => (
          <button key={name} type="button" disabled={cooking} aria-pressed={batch === name}
            onClick={() => chooseBatch(name)}>{STEAM_V2_BATCHES[name].label}</button>
        ))}
      </div>
      <div className="sgl__scene sglv2__scene">
        <svg className="sgl__svg" viewBox="0 -20 300 330" aria-label="オレンジの貝をタップして取り出す蒸し鍋"
          data-testid="sgl-v2-scene" data-rescued={snap.rescuedCount} data-ready={snap.readyCount}
          data-over={snap.overCount} data-verdict={snap.verdict ?? "none"}>
          <g>
            <rect x="35" y="129" width="230" height="143" rx="20" fill="#6b757c" stroke="#d5d9dc" strokeWidth="3" />
            <rect x="44" y="143" width="212" height="112" rx="12" fill="#2b2827" />
            <rect x="19" y="173" width="20" height="17" rx="6" fill="#aab7c1" />
            <rect x="261" y="173" width="20" height="17" rx="6" fill="#aab7c1" />
            {shellSpecs.map((shell, i) => (
              <Shell key={i} index={i} status={snap.shells[i]} size={shell.size}
                label={shell.label} cooking={cooking} onPick={pick} />
            ))}
            <path d="M38 140 Q150 135 262 140" stroke="#cdd6db" strokeWidth="8" fill="none" />
          </g>
          <g className="sgl__lid" data-testid="sgl-v2-lid" data-lid={cooking ? "on" : "off"} data-heat={cooking ? heat : "off"}>
            <path d="M45 122 Q150 40 255 122 Z" fill="#8e9aa6" stroke="#d3dce3" strokeWidth="3" />
            <circle cx="150" cy="66" r="9" fill="#616a72" />
          </g>
          {[99, 140, 181, 222].map((x, i) => (
            <path key={i} className="sgl__wisp" data-on={cooking && (heat === "high" || i < 2)}
              data-heat={heat} data-over={snap.overCount > 0}
              d={`M${x} 106 q8 -11 0 -22 q-8 -11 0 -22`}
              style={{ animationDelay: `${i * 150}ms` }} />
          ))}
          {cooking && <g data-testid="sgl-v2-flames" data-heat={heat}>
            {(heat === "high" ? [80, 115, 150, 185, 220] : [105, 150, 195]).map((x) => (
              <path key={x} className="sgl__flame"
                d={`M${x - 9} 299 Q${x - 12} ${heat === "high" ? 273 : 286} ${x} ${heat === "high" ? 257 : 278} Q${x + 12} ${heat === "high" ? 273 : 286} ${x + 9} 299 Z`}
                fill={heat === "high" ? "#ff7222" : "#66bfff"} />
            ))}
          </g>}
        </svg>
        <span className="sglv2__count" role="status">ふっくら回収 {snap.rescuedCount}/5</span>
      </div>

      <p className="sgl__msg sglv2__msg" role="status" aria-live="polite"
        data-verdict={snap.verdict ?? "none"}>{msg}</p>
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
