import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import {
  STEAM_V3_BATCHES,
  STEAM_V3_GRADE_LABEL,
  STEAM_V3_IDLE,
  STEAM_V3_SECONDS,
  STEAM_V3_SIZE_SCALE,
  steamV3Advice,
  steamV3GoalLine,
  steamV3Reducer,
  steamV3Snapshot,
  steamV3Spots,
  steamV3WindowFromQuery,
  type SteamV3Batch,
  type SteamV3Heat,
  type SteamV3ShellStatus,
  type SteamV3Size,
} from "./steamGameLabGraded";
import "./steamGameLab.css";
import "./steamGameLabV3.css";

/**
 * #755 Steam Gameplay V3, a tap-only standalone Lab behind ?steamGameLab=on&steamGameMode=v3 (Preview / DEV only, like V1 / V2).
 * Nothing is stored, dispatched to the game or scored. No countdown is shown while cooking: the goal time is said once before a
 * round and the time is shown with the result.
 */
const SHELL_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [68, 170], [150, 170], [232, 170], [108, 224], [192, 224],
];
const RETRY_GUARD_MS = 400;
const NOTICE_MS = 1200;
const SIZE_NAME: Record<SteamV3Size, string> = { small: "小", medium: "中", large: "大" };
const WINDOW_NAME = { standard: "", loose: "・強火ゆるめ", tight: "・強火きつめ" } as const;

const LOOK: Record<SteamV3ShellStatus, { shell: string; flesh: string; name: string }> = {
  closed: { shell: "#c5b7ab", flesh: "#e9e2d9", name: "まだ閉じている" },
  tell: { shell: "#d6c3b2", flesh: "#f1d9bd", name: "もうすぐ開く" },
  ready: { shell: "#d19d7a", flesh: "#ffb340", name: "ふっくら・取り出せる" },
  over: { shell: "#6f5246", flesh: "#6a4234", name: "縮んでしまった" },
  rescued: { shell: "#588a6d", flesh: "#ffe6a0", name: "ふっくら取り出した" },
  missed: { shell: "#8d8f92", flesh: "#c5c2bd", name: "取り出し損ねた" },
};

/** Keep a tap from moving focus to the SVG button (no focus ring after a touch); the keyboard still focuses it with Tab. */
const noPointerFocus = (event: SyntheticEvent) => event.preventDefault();

function Shell({
  index, status, size, interactive, onPick,
}: {
  index: number;
  status: SteamV3ShellStatus;
  size: SteamV3Size;
  interactive: boolean;
  onPick: (index: number) => void;
}) {
  const [x, y] = SHELL_SPOTS[index];
  const look = LOOK[status];
  const opened = status === "ready" || status === "over" || status === "missed";
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick(index);
    }
  };
  return (
    <g
      transform={`translate(${x} ${y})`}
      data-testid={`sgl-v3-shell-${index}`}
      data-shell-state={status}
      data-shell-size={size}
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-disabled={!interactive}
      aria-label={`貝${index + 1}（${SIZE_NAME[size]}）：${look.name}`}
      onPointerDown={noPointerFocus}
      onMouseDown={noPointerFocus}
      onClick={() => interactive && onPick(index)}
      onKeyDown={onKeyDown}
      className="sglv3__shell-button"
    >
      {/* Same 58 x 54 hit area for every size, so a small shell is not harder to tap. */}
      <rect className="sglv3__hit" x="-29" y="-27" width="58" height="54" rx="8" fill="transparent" pointerEvents="all" />
      {status === "rescued" ? (
        <>
          <circle r="19" fill="#2f7956" stroke="#a3e8aa" strokeWidth="2" />
          <text textAnchor="middle" y="8" fontSize="25" fontWeight="bold" fill="white">✓</text>
        </>
      ) : (
        <g transform={`scale(${STEAM_V3_SIZE_SCALE[size]})`}>
          <g className="sglv3__shell" data-state={status}>
            <path d="M-19 5 Q0 20 19 5 L17 0 Q0 10 -17 0 Z" fill={look.shell} stroke="#563e31" strokeWidth="1.8"
              strokeDasharray={status === "missed" ? "3 2" : undefined} />
            <ellipse cx="0" cy="-2" rx={opened ? (status === "over" ? 8 : 16) : 8} ry={opened ? (status === "over" ? 4 : 9) : 5} fill={look.flesh} />
            <path d="M-19 4 Q0 -18 19 4 Z" fill={look.shell} stroke="#563e31" strokeWidth="1.8"
              strokeDasharray={status === "missed" ? "3 2" : undefined}
              style={{ transform: opened ? "rotate(-48deg)" : status === "tell" ? "rotate(-10deg)" : "none", transformOrigin: "-19px 4px" }} />
            {status === "ready" && <circle cx="21" cy="-16" r="5" fill="#ffe66b" className="sglv2__spark" />}
            {status === "over" && <path d="M-11 5 L-4 -3 L2 5 L8 -3 L13 4" stroke="#2f211b" strokeWidth="1.6" fill="none" />}
            {status === "missed" && <text textAnchor="middle" y="4" fontSize="13" fontWeight="bold" fill="#3c3d3f">?</text>}
          </g>
          {status === "tell" && (
            <g className="sglv3__bubbles" aria-hidden="true">
              <circle cx="-8" cy="-13" r="3.6" />
              <circle cx="5" cy="-17" r="3" />
              <circle cx="13" cy="-10" r="2.6" />
            </g>
          )}
        </g>
      )}
      <text textAnchor="middle" y="29" fontSize="10.5" fill="#fff8e9" aria-hidden="true">{index + 1}</text>
    </g>
  );
}

export function SteamGameLabV3({ clock = () => performance.now() }: { clock?: () => number }) {
  const [state, dispatch] = useReducer(steamV3Reducer, STEAM_V3_IDLE);
  const [batch, setBatch] = useState<SteamV3Batch>("clam");
  const [round, setRound] = useState(0);
  const [startHeat, setStartHeat] = useState<SteamV3Heat>("low");
  const [now, setNow] = useState(() => clock());
  const [notice, setNotice] = useState<{ text: string; at: number } | null>(null);
  const [tuning] = useState(() => (typeof window === "undefined" ? "standard" : steamV3WindowFromQuery(window.location.search)));
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

  const snap = steamV3Snapshot(state, cooking ? now : 0);
  const result = snap.result;
  const shownBatch = state.status === "idle" ? batch : state.status === "cooking" ? state.batch : state.result.batch;
  const shownLayout = state.status === "idle" ? round : state.status === "cooking" ? state.layout : state.result.layout;
  const spots = steamV3Spots(shownBatch, shownLayout);
  const heat: SteamV3Heat = cooking ? state.heat : startHeat;

  const say = (text: string) => setNotice({ text, at: clock() });
  const begin = (layout: number) => {
    setNotice(null);
    dispatch({ type: "START", now: clock(), batch, layout, heat: startHeat, window: tuning });
  };
  const reset = () => {
    setNotice(null);
    dispatch({ type: "RESET" });
  };
  const again = () => {
    if (clock() - lastRelease.current < RETRY_GUARD_MS) return;
    const next = round + 1;
    setRound(next);
    reset();
    begin(next);
  };
  const chooseBatch = (next: SteamV3Batch) => {
    if (cooking) return;
    setBatch(next);
    if (state.status === "released") reset();
  };
  const chooseHeat = (next: SteamV3Heat) => {
    if (cooking) dispatch({ type: "SET_HEAT", heat: next, now: clock() });
    else setStartHeat(next);
  };
  const pick = (index: number) => {
    if (!cooking) return;
    const current = steamV3Snapshot(state, clock()).shells[index];
    if (current === "closed") return say("まだ閉じているよ。小さい貝から開く");
    if (current === "tell") return say("もうすぐ開くよ。開いたらタップ！");
    if (current === "over") return say("縮んでしまった…次の貝を見よう");
    if (current !== "ready") return;
    say(`貝${index + 1}をふっくら取り出した！`);
    dispatch({ type: "PICK", index, now: clock() });
  };
  const open = () => {
    lastRelease.current = clock();
    dispatch({ type: "OPEN", now: lastRelease.current });
  };

  const liveNotice = cooking && notice && now - notice.at < NOTICE_MS ? notice.text : "";
  const msg = result
    ? steamV3Advice(result)
    : cooking
      ? liveNotice || (snap.rescuedCount === 5
        ? "全部救えた！すぐふたを開けよう"
        : snap.readyCount > 0
          ? "橙色の貝をタップして取り出そう！"
          : snap.shells.includes("tell")
            ? "ぷるぷる揺れた貝がもうすぐ開く"
            : "貝の大きさを見て火加減を調整")
      : steamV3GoalLine(batch);
  const badge = result
    ? `${STEAM_V3_GRADE_LABEL[result.grade]} ${STEAM_V3_SECONDS(result.elapsedMs)}秒・${result.rescuedCount}/5`
    : `ふっくら回収 ${snap.rescuedCount}/5`;

  return (
    <main className="sgl sglv2 sglv3" data-lab="steam-game-lab-v3" data-status={state.status} data-batch={batch} data-window={tuning}>
      <header className="sgl__head">
        <h1 className="sgl__title">蒸しミニゲーム V3{WINDOW_NAME[tuning]}</h1>
        <span className="sgl__label" role="note">試作・保存されません</span>
      </header>
      <div className="sglv2__batch sglv3__batch" role="group" aria-label="貝の種類">
        {(["clam", "mussel"] as const).map((name) => (
          <button key={name} type="button" disabled={cooking} aria-pressed={batch === name}
            onClick={() => chooseBatch(name)}>{STEAM_V3_BATCHES[name].label}</button>
        ))}
      </div>
      <div className="sgl__scene sglv2__scene">
        <svg className="sgl__svg" viewBox="0 -20 300 330" aria-label="小さい貝から開く蒸し鍋。開いた橙色の貝をタップして取り出す"
          data-testid="sgl-v3-scene" data-rescued={snap.rescuedCount} data-ready={snap.readyCount}
          data-over={snap.overCount} data-grade={result?.grade ?? "none-yet"} data-elapsed={result?.elapsedMs ?? ""}
          data-layout={shownLayout % 4}>
          <g>
            <rect x="35" y="129" width="230" height="143" rx="20" fill="#6b757c" stroke="#d5d9dc" strokeWidth="3" />
            <rect x="44" y="143" width="212" height="112" rx="12" fill="#2b2827" />
            <rect x="19" y="173" width="20" height="17" rx="6" fill="#aab7c1" />
            <rect x="261" y="173" width="20" height="17" rx="6" fill="#aab7c1" />
            {spots.map((shell, i) => (
              <Shell key={i} index={i} status={snap.shells[i]} size={shell.size}
                interactive={cooking && snap.shells[i] !== "rescued"} onPick={pick} />
            ))}
            <path d="M38 140 Q150 135 262 140" stroke="#cdd6db" strokeWidth="8" fill="none" />
          </g>
          <g className="sgl__lid" data-testid="sgl-v3-lid" data-lid={cooking ? "on" : "off"} data-heat={cooking ? heat : "off"}>
            <path d="M45 122 Q150 40 255 122 Z" fill="#8e9aa6" stroke="#d3dce3" strokeWidth="3" />
            <circle cx="150" cy="66" r="9" fill="#616a72" />
          </g>
          {[99, 140, 181, 222].map((x, i) => (
            <path key={i} className="sgl__wisp" data-on={cooking && (heat === "high" || i < 2)}
              data-heat={heat} data-over={snap.overCount > 0}
              d={`M${x} 106 q8 -11 0 -22 q-8 -11 0 -22`}
              style={{ animationDelay: `${i * 150}ms` }} />
          ))}
          {cooking && <g data-testid="sgl-v3-flames" data-heat={heat}>
            {(heat === "high" ? [80, 115, 150, 185, 220] : [105, 150, 195]).map((x) => (
              <path key={x} className="sgl__flame"
                d={`M${x - 9} 299 Q${x - 12} ${heat === "high" ? 273 : 286} ${x} ${heat === "high" ? 257 : 278} Q${x + 12} ${heat === "high" ? 273 : 286} ${x + 9} 299 Z`}
                fill={heat === "high" ? "#ff7222" : "#66bfff"} />
            ))}
          </g>}
        </svg>
        <span className="sglv2__count sglv3__count" role="status" data-testid="sgl-v3-badge" data-grade={result?.grade ?? "none-yet"}>{badge}</span>
      </div>

      <p className="sgl__msg sglv2__msg sglv3__msg" role="status" aria-live="polite" data-grade={result?.grade ?? "none-yet"}>{msg}</p>
      <div className="sgl__ctl">
        <button type="button" className="sgl__btn sgl__btn--low" aria-pressed={heat === "low"} onClick={() => chooseHeat("low")}>弱火</button>
        <button type="button" className="sgl__btn sgl__btn--high" aria-pressed={heat === "high"} onClick={() => chooseHeat("high")}>強火</button>
        {state.status === "idle" && <button type="button" className="sgl__btn sgl__btn--primary" onClick={() => begin(round)}>ふたをして蒸す</button>}
        {cooking && <button type="button" className="sgl__btn sgl__btn--primary" onClick={open}>ふたを開ける</button>}
        {state.status === "released" && <button type="button" className="sgl__btn sgl__btn--primary" onClick={again}>もう一度蒸す</button>}
        <button type="button" className="sgl__btn sgl__btn--ghost" disabled={state.status === "idle"} onClick={reset}>やり直す</button>
      </div>
    </main>
  );
}
