/**
 * CUT-S2 Owner Human Verification (Issue #288): the Preview-only page where the Owner cuts a 6-slice
 * pizza with a real finger and reads CutQuality next to the existing cutScore. Reached only through
 * ../main.tsx (`?cuthv=1`, Preview/DEV builds; compiled out of production).
 *
 * It renders the REAL `PizzaStage` CUT gesture layer (same stage size, same rim-to-rim line
 * construction, same duplicate/limit gates as the reducer), but owns its own throw-away state: no
 * `GameState`, no reducer, no save, no scoring, no Dex/Pitz/Lunch Rush/Dinner. The only thing it
 * persists is its own trial records under a Preview-only key.
 */
import { useMemo, useState } from "react";
import "./CutHvPage.css";
import { PizzaStage } from "../components/PizzaStage";
import { getRecipe } from "../data/recipes";
import { addCutLine, createCutState, undoLastCutLine } from "../logic/cut/state";
import { requiredCutCount } from "../logic/cut/evaluation";
import { isDuplicateCutLine } from "../logic/cut/geometry";
import { isEdgeToEdgeCutLine, resolveRequestedSliceCount, type CutLine } from "../logic/cut/types";
import { createEmptyPizza } from "../state/pizzaState";
import {
  HV_STYLE_LABEL_JA,
  HV_TRIAL_PLAN,
  buildHvResultText,
  computeHvMetrics,
  loadHvTrials,
  saveHvTrials,
  type HvMetrics,
  type HvStyle,
  type HvAttemptRecord,
} from "./cutHvSession";

const CUT_CONFIG = { requestedSliceCount: 6 } as const;

const STYLE_HINT_JA: Readonly<Record<HvStyle, string>> = {
  careful: "ゆっくり、ていねいに。6等分をねらって切る",
  normal: "いつもの感じで、ふつうに切る",
  rough: "わざと雑に、急いで切る",
};

const NO_OP = () => {};

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function CutHvPage() {
  const storage = useMemo(() => safeStorage(), []);
  const recipe = useMemo(() => getRecipe("margherita")!, []);
  const pizza = useMemo(() => ({ ...createEmptyPizza(), bakeResult: 70 }), []);
  const [trials, setTrials] = useState<HvAttemptRecord[]>(() => loadHvTrials(storage));
  const [cutState, setCutState] = useState(() => createCutState(CUT_CONFIG));
  const [metrics, setMetrics] = useState<HvMetrics | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const index = trials.length;
  const done = index >= HV_TRIAL_PLAN.length;
  const instructed = HV_TRIAL_PLAN[Math.min(index, HV_TRIAL_PLAN.length - 1)];
  const required = requiredCutCount(resolveRequestedSliceCount(cutState.config));
  const limit = required + 2;
  const viewport = `${window.innerWidth}x${window.innerHeight}`;

  function onAddCutLine(line: CutLine) {
    if (metrics) return;
    if (!isEdgeToEdgeCutLine(line)) return;
    if (cutState.lines.length >= limit) return;
    if (isDuplicateCutLine(line, cutState.lines)) {
      setRejection("同じ位置には切れません");
      return;
    }
    setRejection(null);
    setCutState((s) => addCutLine(s, line));
  }

  function restartTrial() {
    setCutState(createCutState(CUT_CONFIG));
    setMetrics(null);
    setRejection(null);
    setAttempt((a) => a + 1);
  }

  function confirmCut() {
    if (cutState.lines.length < required) return;
    setMetrics(computeHvMetrics(cutState.lines));
  }

  function rate(selfRating: HvStyle) {
    if (!metrics) return;
    const record: HvAttemptRecord = { index, instructed, selfRating, metrics, lines: cutState.lines, viewport };
    const next = [...trials, record];
    setTrials(next);
    saveHvTrials(storage, next);
    restartTrial();
  }

  function resetAll() {
    setTrials([]);
    saveHvTrials(storage, []);
    restartTrial();
  }

  const resultText = done ? buildHvResultText(trials) : "";

  return (
    <div className="app-frame" data-testid="cut-hv-page">
      <div className="game-screen game-screen--cooking">
        <div className="order-card">
          <div className="order-card__text">
            <span className="order-card__recipe-name">
              CUT HV {done ? "完了" : `${index + 1} / ${HV_TRIAL_PLAN.length}`}
            </span>
            <span className="order-card__hint" data-testid="cut-hv-instruction">
              {done
                ? "全部終わり！下の結果をコピーして送ってね"
                : metrics
                  ? "見た目はどうだった？ 下から選んでね"
                  : `【${HV_STYLE_LABEL_JA[instructed]}】${STYLE_HINT_JA[instructed]}`}
            </span>
          </div>
        </div>

        {!done && (
          <PizzaStage
            key={attempt}
            pizza={pizza}
            recipe={recipe}
            interactive={!metrics}
            activeIngredient={null}
            bakeProgress={null}
            placement={null}
            resultRevealed={false}
            referenceModeEnabled={false}
            resetToken={attempt}
            makingStepToken={attempt}
            makingStep="CUT"
            showDoughShape
            onDoughStretchProgress={NO_OP}
            onDoughStretchCommit={NO_OP}
            onTap={NO_OP}
            onDispenseProgress={NO_OP}
            onDispenseCommit={NO_OP}
            cutState={cutState}
            onAddCutLine={onAddCutLine}
            roomy
          />
        )}

        {!done && !metrics && (
          <>
            <div className="cut-progress-readout">
              {cutState.lines.length} / {required} 本
              {cutState.lines.length >= required ? "・切り終わったよ！" : `・あと${required - cutState.lines.length}本切ろう`}
            </div>
            {rejection && (
              <p className="cut-rejection-feedback" role="status">
                {rejection}
              </p>
            )}
            <div className="action-row prepare-bake-bar">
              <button type="button" className="secondary-button" onClick={() => setCutState((s) => undoLastCutLine(s))} disabled={cutState.lines.length === 0}>
                {"\u{21A9}"} 1本戻す
              </button>
              <button type="button" className="cta-button cta-button--bake" onClick={confirmCut} disabled={cutState.lines.length < required}>
                切り終わる {"→"}
              </button>
            </div>
          </>
        )}

        {!done && metrics && (
          <section className="cut-hv-result" data-testid="cut-hv-metrics" aria-label="CutQuality">
            <dl className="cut-hv-result__grid">
              <dt>Q (zero 0.6)</dt>
              <dd data-testid="q06"><strong>{fmt(metrics.overall06)}</strong></dd>
              <dt>Q (zero 0.4)</dt>
              <dd data-testid="q04"><strong>{fmt(metrics.overall04)}</strong></dd>
              <dt>uniformity 0.6 / 0.4</dt>
              <dd>{fmt(metrics.uniformity06)} / {fmt(metrics.uniformity04)}</dd>
              <dt>center</dt>
              <dd>{fmt(metrics.center)}</dd>
              <dt>validity</dt>
              <dd>{fmt(metrics.validity)}</dd>
              <dt>count</dt>
              <dd>{fmt(metrics.count)}</dd>
              <dt>現行 cutScore</dt>
              <dd data-testid="cut-score">{Math.round(metrics.cutScore)}</dd>
              <dt>sliver / 枚数</dt>
              <dd>{metrics.sliverCount} / {metrics.pieces}</dd>
            </dl>
            <p className="cut-hv-result__ask">見た目の自己評価は？</p>
            <div className="action-row cut-hv-result__rate">
              {(["careful", "normal", "rough"] as const).map((s) => (
                <button key={s} type="button" className="secondary-button" onClick={() => rate(s)}>
                  {HV_STYLE_LABEL_JA[s]}
                </button>
              ))}
            </div>
            <button type="button" className="secondary-button cut-hv-result__redo" onClick={restartTrial}>
              この回をやり直す（記録しない）
            </button>
          </section>
        )}

        {done && (
          <section className="cut-hv-result" data-testid="cut-hv-final">
            <div className="cut-hv-result__table-wrap">
              <table className="cut-hv-result__table">
                <thead>
                  <tr>
                    <th>#</th><th>指示</th><th>自己</th><th>Q.6</th><th>Q.4</th><th>cut</th>
                  </tr>
                </thead>
                <tbody>
                  {trials.map((t, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{HV_STYLE_LABEL_JA[t.instructed]}</td>
                      <td>{HV_STYLE_LABEL_JA[t.selfRating]}</td>
                      <td>{fmt(t.metrics.overall06)}</td>
                      <td>{fmt(t.metrics.overall04)}</td>
                      <td>{Math.round(t.metrics.cutScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <textarea className="cut-hv-result__text" readOnly value={resultText} rows={4} onFocus={(e) => e.currentTarget.select()} aria-label="結果テキスト" />
            <div className="action-row">
              <button
                type="button"
                className="cta-button cta-button--bake"
                onClick={() => {
                  void navigator.clipboard?.writeText(resultText).catch(() => {});
                }}
              >
                結果をコピー
              </button>
              <button type="button" className="secondary-button" onClick={resetAll}>
                最初からやり直す
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
