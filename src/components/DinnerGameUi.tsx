import { getIngredient } from "../data/ingredients";
import { getPlayerReferencePizza } from "../data/playerReference";
import { getRecipe, type RecipeId } from "../data/recipes";
import { getReferencePizza } from "../data/referencePizza";
import type { DinnerAttemptView } from "../mission/dinner/dinnerResultDetection";
import type { DinnerRunState } from "../mission/dinner/dinnerRun";
import { dinnerAttemptCopy, dinnerTargetRowItems, formatDinnerClock } from "../state/dinnerView";
import { ReferenceThumbnail } from "./ReferenceThumbnail";

/**
 * Dinner Mission DM-3 (Issue #242, ported from PR #243) / DM-3R-2 (Issue #250): the in-game Dinner
 * UI. Every component here only *renders* the run (`GameState.dinner`) and reports taps; none of
 * them decides run state or a pizza's result. The visual skeletons are the existing ones
 * (`mission-hud`, `mission-serve-panel`, `mission-overlay`) with a Dinner modifier.
 */

function remainingMs(run: DinnerRunState, now: number): number {
  return Math.max(0, run.clock.endsAt - now);
}

const URGENT_MS = 10_000;

/** BAKE / CUT / RESULT HUD: one 33px row, like Lunch Rush's -- 🌙 DINNER, time left, completed / total. */
export function DinnerHud({ run, now }: { run: DinnerRunState; now: number }) {
  const left = remainingMs(run, now);
  return (
    <div className={`mission-hud dinner-hud${left <= URGENT_MS ? " mission-hud--urgent" : ""}`} data-testid="dinner-hud">
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

/** The target's thumbnail from the same resolved reference its popover shows. */
function TargetThumbnail({ recipeId }: { recipeId: string }) {
  const reference = getReferencePizza(recipeId);
  const recipe = getRecipe(recipeId as RecipeId);
  if (reference) {
    return <ReferenceThumbnail sauceIngredientId={reference.sauce.ingredientId} pieceGroups={reference.pieceGroups} />;
  }
  if (!recipe) return null;
  const player = getPlayerReferencePizza(recipe);
  return <ReferenceThumbnail sauceIngredientId={player.sauceIngredientId} pieceGroups={player.pieceGroups} />;
}

/**
 * DM-3R-2 (OD-R7): the PREPARE-time Dinner bar -- time left and progress, then one compact chip
 * per mission target (thumbnail + name, ✓ when done). It takes the place of the order card, so the
 * pizza stage keeps the height it had there (the separate HUD row is folded in, too).
 *
 * A chip tap only opens that target's reference. It is NOT a selection: no action is dispatched,
 * nothing is stored, and the result detection never learns which chip was looked at (OD-R1 / R3).
 */
export function DinnerTargetRow({
  run,
  now,
  onOpenReference,
}: {
  run: DinnerRunState;
  now: number;
  onOpenReference: (recipeId: string) => void;
}) {
  const left = remainingMs(run, now);
  const items = dinnerTargetRowItems(run);
  return (
    <div className="dinner-bar" data-testid="dinner-target-row">
      <div
        className={`dinner-bar__status${left <= URGENT_MS ? " dinner-bar__status--urgent" : ""}`}
        data-testid="dinner-hud"
      >
        <span className="dinner-bar__timer" aria-label="残り時間">
          {"⏱"} {formatDinnerClock(left)}
        </span>
        <span className="dinner-bar__count" aria-label="完成数">
          {"\u{1F319}"} {run.completedRecipeIds.length}/{run.targetRecipeIds.length}
        </span>
      </div>
      <ul className="dinner-bar__targets" aria-label="ディナーのターゲット">
        {items.map((item) => (
          <li key={item.recipeId} className="dinner-bar__item">
            <button
              type="button"
              className={`dinner-chip${item.completed ? " dinner-chip--done" : ""}`}
              onClick={() => onOpenReference(item.recipeId)}
              aria-haspopup="dialog"
              aria-label={`${item.nameJa}${item.completed ? "（完成）" : ""}の見本を見る`}
              data-testid={`dinner-chip-${item.recipeId}`}
            >
              <span className="dinner-chip__thumb" aria-hidden="true">
                <TargetThumbnail recipeId={item.recipeId} />
                {item.completed && <span className="dinner-chip__check">{"✓"}</span>}
              </span>
              <span className="dinner-chip__name">{item.nameJa}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * DM-3R-2: one finished pizza's result (run still PLAYING), then on to the next pizza. Reads only
 * the presentation-safe `DinnerAttemptView` -- an anonymous ORIGINAL has nothing to name.
 */
export function DinnerAttemptResultPanel({
  view,
  completed,
  total,
  onNext,
}: {
  view: DinnerAttemptView;
  completed: number;
  total: number;
  onNext: () => void;
}) {
  const copy = dinnerAttemptCopy(view);
  return (
    <div
      className={`mission-serve-panel dinner-attempt dinner-attempt--${copy.tone}${copy.tone === "fail" ? " mission-serve-panel--failed" : ""}`}
      data-testid="dinner-attempt-result"
      data-category={view.category}
    >
      <p className="dinner-attempt__title" role="status">
        {copy.tone === "success" ? `${"\u{2714}\u{FE0F}"} ` : ""}
        {copy.titleJa}
      </p>
      <p className="dinner-attempt__line">{copy.lineJa}</p>
      <p className="dinner-attempt__progress">
        完成 {completed} / {total}
      </p>
      <button type="button" className="cta-button cta-button--primary" onClick={onNext}>
        次のピザを作る {"→"}
      </button>
    </div>
  );
}

/** CLEAR / FAILED (TIME_UP, INFEASIBLE). No reward row until DM-4. */
export function DinnerResultOverlay({
  run,
  titleJa,
  lastResult,
  retryBlocked,
  onRetry,
  onHome,
  onOpenShop,
}: {
  run: DinnerRunState;
  titleJa: string;
  /** The pizza that ended the run, when one did (CLEAR / INFEASIBLE): shown as one line. TIME_UP
   *  never shows it -- the clock, not a pizza, ended the run. */
  lastResult: DinnerAttemptView | null;
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
            {lastResult && (
              <p className="dinner-result__last" data-testid="dinner-result-last">
                最後のピザ：{dinnerAttemptCopy(lastResult).titleJa}
              </p>
            )}
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
            {lastResult && (
              <p className="dinner-result__last" data-testid="dinner-result-last">
                最後のピザ：{dinnerAttemptCopy(lastResult).titleJa}
              </p>
            )}
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
