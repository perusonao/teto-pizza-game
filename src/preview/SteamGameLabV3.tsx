import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import {
  STEAM_V3_BATCHES,
  STEAM_V3_IDLE,
  STEAM_V3_LAYOUTS,
  steamV3LayoutForRound,
  steamV3Reducer,
  steamV3Snapshot,
  type SteamV3Advice,
  type SteamV3Batch,
  type SteamV3Heat,
  type SteamV3ResultShell,
  type SteamV3ShellStatus,
  type SteamV3Stars,
} from "./steamGameLabStars";
import "./steamGameLab.css";
import "./steamGameLabV2.css";
import "./steamGameLabV3.css";

/**
 * #755 V3, a tap-only standalone Lab behind ?steamGameLab=on&steamGameMode=v3 (Preview / DEV only, nothing is saved).
 * Small shells open first and same-size shells open together; a shell wobbles just before it opens. 5/5 within the star time = ★★★.
 * The time is shown only on the result, never as a countdown.
 */
const SPOTS: ReadonlyArray<readonly [number, number]> = [
  [68, 170], [150, 170], [232, 170], [108, 224], [192, 224],
];
const RETRY_GUARD_MS = 400;
const NOTICE_MS = 1600;
const SIZE_NAME = { small: "小", medium: "中", large: "大" } as const;

type ShellView = SteamV3ShellStatus | SteamV3ResultShell;
const LOOK: Record<ShellView, { shell: string; flesh: string; name: string }> = {
  closed: { shell: "#c5b7ab", flesh: "#e9e2d9", name: "まだ閉じている" },
  ready: { shell: "#d19d7a", flesh: "#ffb340", name: "ふっくら・取り出せる" },
  over: { shell: "#6f4a3c", flesh: "#6b4434", name: "蒸しすぎ（縮んだ）" },
  rescued: { shell: "#588a6d", flesh: "#ffe6a0", name: "ふっくら取り出した" },
  missed: { shell: "#8a8c8e", flesh: "#d5d2cc", name: "取り忘れ" },
};

const ADVICE: Record<SteamV3Advice, string> = {
  master: "名人！手際よく5個ともふっくら",
  faster: "5個ともふっくら！閉じている間は強火にすると、もっと早くできるよ",
  over: "同じ大きさの貝が揺れたら弱火にしよう",
  missed: "開いた貝はタップで取り出そう。全部取ってからふたを開けよう",
  closed: "大きい貝はゆっくり開くよ。最後の貝が開くまで待とう",
};

/** 0 closed, 1 wobbling (about to open), 2 opened (ready / over / rescued): never decreases during a round. */
const shellStage = (status: ShellView, wobbling: boolean): number => (status === "closed" ? (wobbling ? 1 : 0) : 2);

const starText = (n: SteamV3Stars) => "★".repeat(n) + "☆".repeat(3 - n);
const seconds = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1)}秒`;

function Shell({
  index, spot, status, wobbling, size, sizeName, cooking, released, onPick,
}: {
  index: number;
  spot: number;
  status: ShellView;
  wobbling: boolean;
  size: number;
  sizeName: string;
  cooking: boolean;
  released: boolean;
  onPick: (index: number) => void;
}) {
  const [x, y] = SPOTS[spot];
  const look = LOOK[status];
  const opened = status !== "closed";
  // U1: an overcooked (or closed) shell still answers a tap with a message; only a rescued one is done.
  const active = cooking && status !== "rescued";
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
      data-testid={`sgl-v3-shell-${index}`}
      data-shell-state={status}
      data-shell-size={sizeName}
      data-spot={spot}
      data-wobble={wobbling}
      role="button"
      tabIndex={active ? 0 : -1}
      aria-disabled={!active}
      aria-label={`${sizeName}の貝：${look.name}${wobbling ? "（もうすぐ開く）" : ""}`}
      onClick={() => active && onPick(index)}
      onKeyDown={onKeyDown}
      className="sglv2__shell-button sglv3__shell-button"
    >
      <rect x="-29" y="-27" width="58" height="54" rx="10" fill="transparent" pointerEvents="all" className="sglv3__hit" />
      {status === "rescued" ? (
        <>
          <circle r="19" fill="#2f7956" stroke="#a3e8aa" strokeWidth="2" />
          <text textAnchor="middle" y="8" fontSize="25" fontWeight="bold" fill="white">✓</text>
        </>
      ) : (
        <g className="sglv3__wobble" data-wobble={wobbling}>
          <g transform={`scale(${size})`} className="sglv2__shell" data-ready={status === "ready"} data-over={status === "over"}>
            <path d="M-19 5 Q0 20 19 5 L17 0 Q0 10 -17 0 Z" fill={look.shell} stroke="#563e31" strokeWidth="1.8" />
            <ellipse cx="0" cy="-2" rx={opened ? (status === "over" ? 8 : 16) : 8} ry={opened ? (status === "over" ? 4 : 9) : 5} fill={look.flesh} />
            <path d="M-19 4 Q0 -18 19 4 Z" fill={look.shell} stroke="#563e31" strokeWidth="1.8"
              style={{ transform: opened ? "rotate(-48deg)" : "none", transformOrigin: "-19px 4px" }} />
            {status === "ready" && <circle cx="21" cy="-16" r="5" fill="#ffe66b" className="sglv2__spark" />}
            {status === "over" && <path d="M-10 4 L8 -4 M-7 -6 L12 6" stroke="#2e2420" strokeWidth="2" />}
          </g>
          {/* the pre-open cue that also works with reduced motion: small rising bubbles */}
          {wobbling && <g className="sglv3__bubbles" aria-hidden="true">
            <circle cx="-9" cy={-14 - size * 6} r="3" />
            <circle cx="3" cy={-19 - size * 6} r="2.4" />
            <circle cx="11" cy={-13 - size * 6} r="2" />
          </g>}
        </g>
      )}
      {released && status === "missed" && (
        <>
          <rect x="-24" y="-22" width="48" height="44" rx="9" fill="none" stroke="#d9d9d9" strokeWidth="2" strokeDasharray="5 4" />
          <text textAnchor="middle" x="20" y="-14" fontSize="16" fontWeight="bold" fill="#f2f2f2">!</text>
        </>
      )}
      {released && status === "over" && <text textAnchor="middle" x="20" y="-14" fontSize="16" fontWeight="bold" fill="#ffb199">×</text>}
      <text textAnchor="middle" y="31" fontSize="11" fontWeight="bold" fill="#fff8e9" aria-hidden="true">{sizeName}</text>
    </g>
  );
}

export function SteamGameLabV3({ clock = () => performance.now() }: { clock?: () => number }) {
  const [state, dispatch] = useReducer(steamV3Reducer, STEAM_V3_IDLE);
  const [batch, setBatch] = useState<SteamV3Batch>("clam");
  const [preHeat, setPreHeat] = useState<SteamV3Heat>("low");
  const [round, setRound] = useState(0);
  const [now, setNow] = useState(() => clock());
  const [notice, setNotice] = useState<{ text: string; until: number; stages: number[] } | null>(null);
  const [input, setInput] = useState<"pointer" | "keyboard">("pointer");
  const lastRelease = useRef(Number.NEGATIVE_INFINITY);
  const cooking = state.status === "cooking";
  const released = state.status === "released";

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
  const shownBatch: SteamV3Batch = snap.batch ?? batch;
  const layout = STEAM_V3_LAYOUTS[snap.layout ?? steamV3LayoutForRound(round)];
  const specs = STEAM_V3_BATCHES[shownBatch].shells;
  const heat: SteamV3Heat = cooking ? state.heat : preHeat;
  const result = snap.result;

  // U2: a notice is transient. It ends after NOTICE_MS (read from the injected clock), or for good as soon as ANY shell moves on
  // (closed → wobbling → opened), so the hint for the next shell, pair or trio is never hidden behind an old message. A shell's stage
  // only ever grows (a rescue counts as opened), so once a notice has given way it cannot come back.
  const noticeText = cooking && notice && now < notice.until && snap.shells.every((st, i) => shellStage(st, snap.wobbling[i]) <= notice.stages[i]) ? notice.text : "";
  const say = (text: string) => {
    const at = clock();
    const current = steamV3Snapshot(state, at);
    setNow(at);
    setNotice({ text, until: at + NOTICE_MS, stages: current.shells.map((st, i) => shellStage(st, current.wobbling[i])) });
  };

  const start = () => {
    setNotice(null);
    dispatch({ type: "START", now: clock(), batch, layout: steamV3LayoutForRound(round), heat: preHeat });
  };
  const reset = () => {
    setNotice(null);
    dispatch({ type: "RESET" });
  };
  const again = () => {
    if (clock() - lastRelease.current < RETRY_GUARD_MS) return;
    const next = round + 1;
    setRound(next);
    setNotice(null);
    dispatch({ type: "RESET" });
    dispatch({ type: "START", now: clock(), batch, layout: steamV3LayoutForRound(next), heat: preHeat });
  };
  const chooseBatch = (next: SteamV3Batch) => {
    if (cooking) return;
    setBatch(next);
    if (released) reset();
  };
  const chooseHeat = (next: SteamV3Heat) => {
    setPreHeat(next);
    if (cooking) dispatch({ type: "SET_HEAT", heat: next, now: clock() });
  };
  const pick = (index: number) => {
    if (!cooking) return;
    const current = steamV3Snapshot(state, clock()).shells[index];
    if (current === "closed") return say("まだ閉じているよ。揺れたら開く合図！");
    if (current === "over") return say("縮んじゃった…同じ大きさが揺れたら弱火に");
    if (current !== "ready") return;
    say(`${SIZE_NAME[specs[index].sizeClass]}の貝をふっくら取り出した！`);
    dispatch({ type: "PICK", index, now: clock() });
  };
  const open = () => {
    lastRelease.current = clock();
    setNotice(null);
    dispatch({ type: "OPEN", now: lastRelease.current });
  };

  const verdict = result ? (result.stars === 3 ? "master" : result.stars === 2 ? "perfect" : result.rescuedCount === 0 ? "missed" : "partial") : "none";
  const msg = result
    ? ADVICE[result.advice]
    : cooking
      ? noticeText || (snap.rescuedCount === 5
        ? "全部取れた！ふたを開けよう"
        : snap.readyCount > 0
          ? "橙色の貝をタップして取り出そう！"
          : snap.wobbleCount >= 2
            ? "貝がいくつも揺れてる！一緒に開くよ"
            : snap.wobbleCount === 1
              ? "貝が揺れてる…もうすぐ開くよ"
              : "閉じている間は強火で早く蒸せるよ")
      : "小さい貝から開くよ。同じ大きさは一緒に開く！";

  return (
    <main
      className="sgl sglv2 sglv3"
      data-lab="steam-game-lab-v3"
      data-status={state.status}
      data-batch={shownBatch}
      data-layout={snap.layout ?? steamV3LayoutForRound(round)}
      data-input={input}
      onPointerDownCapture={() => setInput("pointer")}
      onKeyDownCapture={() => setInput("keyboard")}
    >
      <header className="sgl__head">
        <h1 className="sgl__title">蒸しミニゲーム V3</h1>
        <span className="sgl__label" role="note">試作・保存されません</span>
      </header>
      <div className="sglv2__batch sglv3__batch" role="group" aria-label="貝の種類">
        {(["clam", "mussel"] as const).map((name) => (
          <button key={name} type="button" disabled={cooking} aria-pressed={batch === name}
            onClick={() => chooseBatch(name)}>{STEAM_V3_BATCHES[name].label}</button>
        ))}
      </div>
      <div className="sgl__scene sglv2__scene">
        <svg className="sgl__svg" viewBox="0 -20 300 330" aria-label="大きさを見て、開いた貝をタップして取り出す蒸し鍋"
          data-testid="sgl-v3-scene" data-rescued={snap.rescuedCount} data-ready={snap.readyCount}
          data-over={snap.overCount} data-wobble={snap.wobbleCount} data-verdict={verdict}
          data-stars={result ? result.stars : "none"} data-elapsed-ms={result ? Math.round(result.elapsedMs) : "none"}>
          <g>
            <rect x="35" y="129" width="230" height="143" rx="20" fill="#6b757c" stroke="#d5d9dc" strokeWidth="3" />
            <rect x="44" y="143" width="212" height="112" rx="12" fill="#2b2827" />
            <rect x="19" y="173" width="20" height="17" rx="6" fill="#aab7c1" />
            <rect x="261" y="173" width="20" height="17" rx="6" fill="#aab7c1" />
            {specs.map((shell, i) => (
              <Shell key={i} index={i} spot={layout.indexOf(i)} status={snap.shells[i]} wobbling={snap.wobbling[i]}
                size={shell.size} sizeName={SIZE_NAME[shell.sizeClass]} cooking={cooking} released={released} onPick={pick} />
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
        <span className="sglv2__count sglv3__count" role="status" data-testid="sgl-v3-count">
          {result
            ? <><span className="sglv3__stars" aria-label={`星${result.stars}つ`}>{starText(result.stars)}</span> {seconds(result.elapsedMs)}</>
            : `ふっくら回収 ${snap.rescuedCount}/5`}
        </span>
      </div>

      <p className="sgl__msg sglv2__msg sglv3__msg" role="status" aria-live="polite" data-verdict={verdict} data-testid="sgl-v3-msg">
        {result && <span className="sglv3__summary" data-testid="sgl-v3-summary">
          ふっくら{result.rescuedCount}・蒸しすぎ{result.overCount}・取り忘れ{result.missedCount}{result.closedCount ? `・閉じたまま${result.closedCount}` : ""}
          {` ／ ★3は${seconds(result.starTimeMs)}以内`}
        </span>}
        <span>{msg}</span>
      </p>
      <div className="sgl__ctl">
        <button type="button" className="sgl__btn sgl__btn--low" aria-pressed={heat === "low"} disabled={released} onClick={() => chooseHeat("low")}>弱火</button>
        <button type="button" className="sgl__btn sgl__btn--high" aria-pressed={heat === "high"} disabled={released} onClick={() => chooseHeat("high")}>強火</button>
        {state.status === "idle" && <button type="button" className="sgl__btn sgl__btn--primary" onClick={start}>ふたをして蒸す</button>}
        {cooking && <button type="button" className="sgl__btn sgl__btn--primary" onClick={open}>ふたを開ける</button>}
        {released && <button type="button" className="sgl__btn sgl__btn--primary" onClick={again}>もう一度蒸す</button>}
        <button type="button" className="sgl__btn sgl__btn--ghost" disabled={state.status === "idle"} onClick={reset}>やり直す</button>
      </div>
    </main>
  );
}
