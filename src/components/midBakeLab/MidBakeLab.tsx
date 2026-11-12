import { useEffect, useReducer, useRef, useState } from "react";
import { MID_BAKE_LAB_MARK, parseMidBakeLabSearch } from "../../preview/midBakeLab";
import { getLabScenario, type LabOpKind } from "./labIngredients";
import { createLabSession, labSessionReducer, labSnapshot, type LabSession } from "./labSession";
import "./midBakeLab.css";

/**
 * MID_BAKE Lab screen (Issue #795, stage C-2): an independent, DEV / Preview-only screen (`?dev=midbake`, src/main.tsx).
 * It renders one pure `LabSession` and feeds it animation frames; it never reads or writes the save and imports no HOT file,
 * `App`, PREP or FRY. Production stays OFF (`MID_BAKE_EXPERIENCE_PRODUCTION = false`).
 *
 * The clock only advances while the page is visible and focused (like `BakeOverlay`): a background tab pauses the bake and the
 * hold timeout, and nothing is discarded.
 */
export function MidBakeLab({ search = window.location.search }: { search?: string }) {
  const params = parseMidBakeLabSearch(search);
  const scenario = getLabScenario(params.scenarioId);
  const [run, setRun] = useState(0);
  // "もう一度" remounts the body, so every restart starts from a brand-new session (nothing carries over).
  return (
    <LabBody
      key={run}
      initial={() => createLabSession(scenario, { holdTimeoutMs: params.holdTimeoutMs })}
      onRestart={() => setRun((n) => n + 1)}
      search={search}
    />
  );
}

function LabBody({ initial, onRestart, search }: { initial: () => LabSession; onRestart: () => void; search: string }) {
  const [session, dispatch] = useReducer(labSessionReducer, undefined, initial);
  const lastRef = useRef<number | null>(null);
  const finished = session.clock.status === "finished";

  useEffect(() => {
    if (finished) return undefined;
    let raf = 0;
    const active = () => document.visibilityState === "visible" && document.hasFocus();
    const loop = (now: number) => {
      if (active()) {
        if (lastRef.current !== null) dispatch({ type: "FRAME", dtMs: now - lastRef.current });
        lastRef.current = now;
      } else {
        lastRef.current = null; // paused: the next active frame starts a fresh interval
      }
      raf = requestAnimationFrame(loop);
    };
    // The browser may stop rAF entirely while hidden, so the loop alone cannot notice the pause: any visibility / focus change
    // forgets the last frame time, and the first frame after it starts a fresh interval (never one that spans the absence).
    const reset = () => {
      lastRef.current = null;
    };
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("focus", reset);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("focus", reset);
    };
  }, [finished]);

  const snap = labSnapshot(session);
  const add = (ingredientId: string, op: LabOpKind) => dispatch({ type: "ADD", ingredientId, op });
  const statusText =
    snap.status === "holding"
      ? "とまった！ 今のうちに足そう"
      : snap.status === "finished"
        ? snap.completion === "complete"
          ? "できあがり：必要な個数を足せた"
          : "できあがり：足りないまま焼き上がった"
        : snap.stage === "rebaking"
          ? "仕上げ焼き中"
          : "焼いている…";
  const holdLeft = Math.max(0, snap.holdTimeoutMs - snap.holdActiveMs);
  const logText = [
    `scenario=${session.scenario.id} hold=${snap.holdTimeoutMs}ms (provisional)`,
    `status=${snap.status} stage=${snap.stage} pos=${snap.positionPct.toFixed(1)}%`,
    `accepted=${snap.log.accepted} (direct ${snap.log.acceptedDirect} / alternative ${snap.log.acceptedAlternative})`,
    `rejected=${snap.log.rejected} ${JSON.stringify(snap.log.rejectedByReason)}`,
    `released=${snap.releasedBy ?? "-"} holdActiveMs=${Math.round(snap.log.holdActiveMs ?? snap.holdActiveMs)}`,
    `completion=${snap.completion ?? "-"}`,
  ].join("\n");

  return (
    <main className="mid-bake-lab" data-mid-bake-lab={MID_BAKE_LAB_MARK} data-lab-status={snap.status} data-lab-stage={snap.stage} data-lab-search={search}>
      <h1>MID_BAKE Lab（検証用・本番では使われません）</h1>
      <p className="mid-bake-lab__note">窓の入口で針が止まります。止まっている間だけ足せます。止まる時間は暫定値です。</p>

      <div className="mid-bake-lab__gauge" role="img" aria-label="焼き加減ゲージ" data-testid="lab-gauge" data-lab-position={snap.positionPct.toFixed(2)}>
        <div className="mid-bake-lab__window" style={{ left: `${snap.windowStartPct}%`, width: `${snap.windowEndPct - snap.windowStartPct}%` }} />
        <div className="mid-bake-lab__needle" data-testid="lab-needle" style={{ left: `${snap.positionPct}%` }} />
      </div>

      <p className="mid-bake-lab__status" role="status" aria-live="polite" data-lab-status={snap.status} data-testid="lab-status">
        {statusText}
        {snap.status === "holding" ? `（あと ${(holdLeft / 1000).toFixed(1)} 秒）` : ""}
      </p>

      <div className="mid-bake-lab__tray" data-testid="lab-tray">
        {snap.ingredients.map((ingredient) =>
          ingredient.ops.includes("tap") ? (
            <button
              key={ingredient.ingredientId}
              type="button"
              className="mid-bake-lab__chip"
              data-testid={`lab-chip-${ingredient.ingredientId}`}
              disabled={!snap.trayOpen || ingredient.added >= ingredient.required}
              onClick={() => add(ingredient.ingredientId, "tap")}
            >
              {ingredient.glyph} {ingredient.label} {ingredient.added}/{ingredient.required}
            </button>
          ) : null,
        )}
        <button type="button" className="mid-bake-lab__btn" data-testid="lab-close" disabled={snap.status !== "holding"} onClick={() => dispatch({ type: "CLOSE" })}>
          とじる
        </button>
      </div>

      <details className="mid-bake-lab__alt" data-testid="lab-alt">
        <summary>代替操作（確認用）</summary>
        {snap.ingredients
          .filter((ingredient) => ingredient.ops.includes("alternative"))
          .map((ingredient) => (
            <button
              key={ingredient.ingredientId}
              type="button"
              className="mid-bake-lab__btn"
              data-testid={`lab-alt-${ingredient.ingredientId}`}
              disabled={!snap.trayOpen || ingredient.added >= ingredient.required}
              onClick={() => add(ingredient.ingredientId, "alternative")}
            >
              {ingredient.label}を 1 個足す（代替）
            </button>
          ))}
      </details>

      {snap.status === "finished" ? (
        <>
          <p className="mid-bake-lab__result" data-testid="lab-result" data-lab-completion={snap.completion ?? ""}>
            {snap.completion === "complete" ? "成功：必要な個数をそろえた" : "取り逃し：個数が足りなかった"}
          </p>
          <button type="button" className="mid-bake-lab__btn" data-testid="lab-restart" onClick={onRestart}>
            もう一度
          </button>
        </>
      ) : null}

      <pre className="mid-bake-lab__log" data-testid="lab-log">
        {logText}
      </pre>
    </main>
  );
}
