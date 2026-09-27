import { buildCompletionFailureMessage } from "../data/completionMessages";
import { getIngredient } from "../data/ingredients";
import type { PizzaCompletionResult } from "../logic/completionGate";
import type { DinnerRunState } from "../mission/dinner/dinnerRun";
import { dinnerBoardRows, formatDinnerClock } from "../state/dinnerView";

/**
 * Dinner Mission DM-3 (Issue #242): the in-game Dinner UI. Every component here only *renders*
 * the DM-2 run (`GameState.dinner.run`) and reports taps; none of them decides run state. The
 * visual skeletons are the existing ones (`mission-hud`, `mission-serve-panel`, `mission-overlay`)
 * with a Dinner modifier -- no new design system.
 */

function remainingMs(run: DinnerRunState, now: number): number {
  return Math.max(0, run.clock.endsAt - now);
}

/** Cooking HUD: one 33px row, like Lunch Rush's -- 🌙 DINNER, time left, completed / total. */
export function DinnerHud({ run, now }: { run: DinnerRunState; now: number }) {
  const left = remainingMs(run, now);
  const urgent = left <= 10_000;
  return (
    <div className={`mission-hud dinner-hud${urgent ? " mission-hud--urgent" : ""}`} data-testid="dinner-hud">
      <span className="dinner-hud__label">{"\u{1F319}"} DINNER</span>
      <span className="mission-hud__timer" aria-label="残り時間">
        {"⏱"} {formatDinnerClock(left)}
      </span>
      <span className="mission-hud__served" aria-label="完成数">
        {run.completedRecipeIds.length} / {run.targetRecipeIds.length}
      </span>
    </div>
  );
}

/** Target selection, between targets: the whole target list on one screen, any order. */
export function DinnerTargetBoard({
  run,
  now,
  titleJa,
  onSelect,
}: {
  run: DinnerRunState;
  now: number;
  titleJa: string;
  onSelect: (recipeId: string) => void;
}) {
  const rows = dinnerBoardRows(run);
  const remaining = rows.filter((r) => !r.completed).length;
  return (
    <section className="dinner-board" aria-label="ターゲット選択">
      <div className="dinner-board__head">
        <h2 className="dinner-board__title">
          {"\u{1F319}"} {titleJa}
        </h2>
        <p className="dinner-board__stats">
          <span>
            残り <strong>{remaining}</strong> / {rows.length}
          </span>
          <span className="dinner-board__timer" aria-label="残り時間">
            {"⏱"} {formatDinnerClock(remainingMs(run, now))}
          </span>
        </p>
        <p className="dinner-board__lead">次に作るピザを選ぼう</p>
      </div>
      <ul className="dinner-board__list">
        {rows.map((row) => (
          <li key={row.recipeId}>
            <button
              type="button"
              className={`dinner-board__item${row.completed ? " dinner-board__item--done" : ""}`}
              disabled={row.completed}
              aria-disabled={row.completed}
              onClick={() => {
                if (!row.completed) onSelect(row.recipeId);
              }}
            >
              <span className="dinner-board__mark" aria-hidden="true">
                {row.completed ? "\u{2714}\u{FE0F}" : "\u{1F355}"}
              </span>
              <span className="dinner-board__name">{row.nameJa}</span>
              <span className="dinner-board__state">{row.completed ? "完成" : "作る →"}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** After a target is judged (run still PLAYING): what happened, then back to the target list. */
export function DinnerTargetResultPanel({
  recipeNameJa,
  completion,
  completed,
  total,
  onBack,
}: {
  recipeNameJa: string;
  completion: PizzaCompletionResult | null;
  completed: number;
  total: number;
  onBack: () => void;
}) {
  const failed = completion?.status !== "PASS";
  return (
    <div className={`mission-serve-panel dinner-target-result${failed ? " mission-serve-panel--failed" : ""}`}>
      {failed ? (
        <>
          <p className="mission-serve-panel__failed-reason" role="alert">
            {completion && completion.status === "FAILED" ? buildCompletionFailureMessage(completion) : "完成しませんでした"}
          </p>
          <p className="dinner-target-result__line">{recipeNameJa}はもう一度作れます</p>
        </>
      ) : (
        <p className="dinner-target-result__line dinner-target-result__line--done" role="status">
          {"\u{2714}\u{FE0F}"} {recipeNameJa} 完成！
        </p>
      )}
      <p className="dinner-target-result__progress">
        完成 {completed} / {total}
      </p>
      <button type="button" className="cta-button cta-button--primary" onClick={onBack}>
        ターゲット一覧へ
      </button>
    </div>
  );
}

/** CLEAR / FAILED (TIME_UP, INFEASIBLE). No reward row until DM-4. */
export function DinnerResultOverlay({
  run,
  titleJa,
  retryBlocked,
  onRetry,
  onHome,
  onOpenShop,
}: {
  run: DinnerRunState;
  titleJa: string;
  retryBlocked: boolean;
  onRetry: () => void;
  onHome: () => void;
  onOpenShop: () => void;
}) {
  const outcome = run.outcome;
  if (!outcome) return null;
  const done = run.completedRecipeIds.length;
  const total = run.targetRecipeIds.length;
  const cleared = outcome.kind === "CLEAR";
  return (
    <div className="mission-overlay" role="dialog" aria-modal="true" aria-label="ディナーミッション結果">
      <div className={`mission-overlay__panel dinner-result${cleared ? " dinner-result--clear" : " dinner-result--failed"}`}>
        <p className="dinner-result__mission">{titleJa}</p>
        {cleared ? (
          <>
            <h2 className="mission-overlay__title dinner-result__title">{"\u{1F389}"} DINNER CLEAR!</h2>
            <p className="dinner-result__row">
              作ったピザ <strong>{done} / {total}</strong>
            </p>
            <p className="dinner-result__row">
              クリアタイム <strong>{formatDinnerClock(outcome.clearMs)}</strong>
            </p>
          </>
        ) : outcome.reason === "TIME_UP" ? (
          <>
            <h2 className="mission-overlay__title dinner-result__title">{"\u{23F0}"} 時間切れ！</h2>
            <p className="dinner-result__row">
              <strong>{done} / {total}</strong> 完成
            </p>
          </>
        ) : (
          <>
            <h2 className="mission-overlay__title dinner-result__title">材料が足りなくなりました</h2>
            <p className="dinner-result__row">
              <strong>{done} / {total}</strong> 完成
            </p>
            {outcome.reason === "INFEASIBLE" && outcome.shortages.length > 0 && (
              <ul className="dinner-result__shortages">
                {outcome.shortages.map((s) => (
                  <li key={s.ingredientId}>
                    {getIngredient(s.ingredientId)?.nameJa ?? s.ingredientId} 必要 {s.need} / 所持 {s.have}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="action-row action-row--column">
          <button
            type="button"
            className="cta-button cta-button--primary"
            onClick={onRetry}
            disabled={retryBlocked}
            aria-disabled={retryBlocked}
          >
            もう一度
          </button>
          {retryBlocked && (
            <>
              <p className="dinner-result__blocked">{"\u{1F6D2}"} 材料を補充すると再挑戦できます</p>
              <button type="button" className="secondary-button" onClick={onOpenShop}>
                ショップへ
              </button>
            </>
          )}
          <button type="button" className="secondary-button" onClick={onHome}>
            {"\u{1F3E0}"} ホーム
          </button>
        </div>
      </div>
    </div>
  );
}

/** HOME during a PLAYING run (replaces `window.confirm`). */
export function DinnerAbandonDialog({ onContinue, onQuit }: { onContinue: () => void; onQuit: () => void }) {
  return (
    <div className="mission-overlay" role="alertdialog" aria-modal="true" aria-labelledby="dinner-abandon-title">
      <div className="mission-overlay__panel dinner-abandon">
        <h2 id="dinner-abandon-title" className="mission-overlay__title">
          ディナーミッションをやめますか？
        </h2>
        <p className="mission-overlay__body">
          ここまで使った材料は戻りません。
          <br />
          報酬はありません。
        </p>
        <div className="action-row action-row--column">
          <button type="button" className="cta-button cta-button--primary" onClick={onContinue}>
            続ける
          </button>
          <button type="button" className="secondary-button" onClick={onQuit}>
            やめる
          </button>
        </div>
      </div>
    </div>
  );
}
